import { z } from 'zod';

import type {
  ContractAssignOwnerPayload,
  ContractByLinkedEntityItem,
  ContractByLinkedEntityQuery,
  ContractByOwnerItem,
  ContractByOwnerQuery,
  ContractCreatePayload,
  ContractDraftCorePayload,
  ContractExpirePayload,
  ContractFileReferencePayload,
  ContractFlatListQuery,
  ContractLifecycleAction,
  ContractListItem,
  ContractObligation,
  ContractObligationAcceptPayload,
  ContractObligationArchivePayload,
  ContractObligationDeliverPayload,
  ContractObligationEventEvidenceLink,
  ContractObligationEventEvidenceLinkPayload,
  ContractObligationEventEvidenceRemovePayload,
  ContractObligationPayload,
  ContractObligationReasonPayload,
  ContractRecord,
  ContractTerminatePayload,
  CursorPagedResponse,
} from '@modules/contract-registry/types/contract-registry.types';
import {
  CONTRACT_OBLIGATION_DELIVERY_NOTE_MAX_LENGTH,
  CONTRACT_OBLIGATION_DESCRIPTION_MAX_LENGTH,
  CONTRACT_OBLIGATION_EVIDENCE_REF_LABEL_MAX_LENGTH,
  CONTRACT_OBLIGATION_EVIDENCE_REF_MAX_COUNT,
  CONTRACT_OBLIGATION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH,
  CONTRACT_OBLIGATION_EVIDENCE_REF_URL_MAX_LENGTH,
  CONTRACT_OBLIGATION_EVENT_EVIDENCE_REASON_MAX_LENGTH,
  CONTRACT_OBLIGATION_REASON_MAX_LENGTH,
  CONTRACT_OBLIGATION_TITLE_MAX_LENGTH,
} from '@modules/contract-registry/types/contract-registry.types';
import { apiRequest } from '@shared/api';

const statusSchema = z.enum([
  'DRAFT',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'ARCHIVED',
]);
const contractReadKindSchema = z.string().trim().min(1);
const commercialLegalContractKindSchema = z.enum(['TALENT_SERVICE', 'TALENT_MANAGEMENT']);
const linkedEntityKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT']);
const confidentialityTierSchema = z.enum(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']);
const timestampSchema = z.union([z.number(), z.string()]);
const boundaryMetadataSchema = z
  .object({
    semanticBoundary: z.enum(['COMMERCIAL_LEGAL', 'LEGACY_EMPLOYMENT', 'UNSUPPORTED']),
    kindClassification: z.enum([
      'COMMERCIAL_LEGAL_SUPPORTED',
      'LEGACY_EMPLOYMENT_DEPRECATED',
      'UNSUPPORTED_CONTRACT_KIND',
    ]),
    commercialLegalRegistry: z.boolean(),
    commercialChainContextEligible: z.boolean(),
    directRevenueSourceEligible: z.literal(false),
    directCommissionSourceEligible: z.literal(false),
    payrollSourceEligible: z.literal(false),
    obligationAcceptanceImplemented: z.boolean(),
    eventEvidenceLinkImplemented: z.boolean(),
  })
  .strict();
const obligationTypeSchema = z.enum(['DELIVERABLE', 'SERVICE_MILESTONE', 'REPORTING', 'OTHER']);
const obligationStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'DELIVERED',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'ARCHIVED',
]);
const obligationEvidencePolicySchema = z.enum(['OPTIONAL', 'REQUIRED']);
const evidenceRefTypeSchema = z.enum([
  'URL',
  'PLATFORM_REFERENCE',
  'EXTERNAL_REFERENCE',
  'INTERNAL_REFERENCE',
]);
const obligationEvidenceRefSchema = z
  .object({
    type: evidenceRefTypeSchema,
    label: z.string().trim().min(1).max(CONTRACT_OBLIGATION_EVIDENCE_REF_LABEL_MAX_LENGTH),
    url: z.string().max(CONTRACT_OBLIGATION_EVIDENCE_REF_URL_MAX_LENGTH).nullable(),
    referenceId: z
      .string()
      .max(CONTRACT_OBLIGATION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH)
      .nullable(),
  })
  .strict()
  .superRefine((ref, context) => {
    if (ref.type === 'URL') {
      if (!ref.url || ref.referenceId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'URL evidence references require a URL and no reference ID',
        });
        return;
      }
      try {
        const parsed = new URL(ref.url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('invalid protocol');
        }
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: 'URL evidence references require a valid http(s) URL',
        });
      }
      return;
    }

    if (!ref.referenceId || ref.url) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Non-URL evidence references require a reference ID and no URL',
      });
    }
  });
const obligationBoundaryMetadataSchema = z
  .object({
    activeSupportedCommercialLegalContractRequired: z.literal(true),
    legacyEmploymentContractAllowed: z.literal(false),
    unsupportedContractKindAllowed: z.literal(false),
    responsibleOwnerGrantsAuthority: z.literal(false),
    eventEvidenceLinkImplemented: z.literal(true),
    eventCompletionMutatesObligation: z.literal(false),
    acceptanceCreatesRevenue: z.literal(false),
    acceptanceCreatesCommission: z.literal(false),
    acceptanceCreatesPayroll: z.literal(false),
    acceptanceCreatesPayment: z.literal(false),
    acceptanceCreatesTaxOrAccounting: z.literal(false),
    fileStorageImplemented: z.literal(false),
  })
  .strict();
const obligationStatusTransitionSchema = z
  .object({
    fromStatus: obligationStatusSchema.nullable(),
    toStatus: obligationStatusSchema,
    actorId: z.string().trim().min(1),
    occurredAt: timestampSchema,
    reason: z.string().nullable(),
  })
  .strict();
const obligationSchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1),
    contractRecordId: z.string().trim().min(1),
    obligationType: obligationTypeSchema,
    title: z.string().trim().min(1),
    description: z.string().nullable(),
    dueDate: timestampSchema.nullable(),
    responsibleOwnerEmploymentProfileId: z.string().trim().min(1),
    evidencePolicy: obligationEvidencePolicySchema,
    status: obligationStatusSchema,
    latestDeliveryNote: z.string().nullable(),
    latestEvidenceRefs: z.array(obligationEvidenceRefSchema),
    latestEventEvidenceLinkIds: z.array(z.string().trim().min(1)),
    latestDeliveredByActorId: z.string().nullable(),
    latestDeliveredAt: timestampSchema.nullable(),
    latestReviewedByActorId: z.string().nullable(),
    latestReviewedAt: timestampSchema.nullable(),
    acceptedByActorId: z.string().nullable(),
    acceptedAt: timestampSchema.nullable(),
    rejectedByActorId: z.string().nullable(),
    rejectedAt: timestampSchema.nullable(),
    rejectionReason: z.string().nullable(),
    statusHistory: z.array(obligationStatusTransitionSchema),
    createdByActorId: z.string().trim().min(1),
    createdAt: timestampSchema,
    updatedByActorId: z.string().trim().min(1),
    updatedAt: timestampSchema,
    boundaryMetadata: obligationBoundaryMetadataSchema,
  })
  .strict();
const eventEvidenceLinkBoundaryMetadataSchema = z
  .object({
    linkTarget: z.literal('CONTRACT_OBLIGATION'),
    supportingEvidenceOnly: z.literal(true),
    historicalSnapshot: z.literal(true),
    linkMutatesEvent: z.literal(false),
    linkMutatesObligationStatus: z.literal(false),
    deliveryRemainsExplicit: z.literal(true),
    acceptanceCreated: z.literal(false),
    revenueCreated: z.literal(false),
    commissionCreated: z.literal(false),
    payrollCreated: z.literal(false),
    paymentCreated: z.literal(false),
    taxOrAccountingCreated: z.literal(false),
    fileStorageCreated: z.literal(false),
    inferredEventContractMatching: z.literal(false),
  })
  .strict();
const eventEvidenceLinkSchema = z
  .object({
    id: z.string().trim().min(1),
    contractObligationId: z.string().trim().min(1),
    contractRecordId: z.string().trim().min(1),
    eventId: z.string().trim().min(1),
    status: z.enum(['ACTIVE', 'REMOVED']),
    linkedByActorId: z.string().trim().min(1),
    linkedAt: timestampSchema,
    linkReason: z.string().trim().min(1),
    removedByActorId: z.string().nullable(),
    removedAt: timestampSchema.nullable(),
    removeReason: z.string().nullable(),
    snapshot: z
      .object({
        eventId: z.string().trim().min(1),
        eventCode: z.string().trim().min(1),
        eventTitle: z.string().trim().min(1),
        eventStatus: z.string().trim().min(1),
        eventUpdatedAt: timestampSchema,
        eventCompletedAt: timestampSchema,
        eventCompletedByActorId: z.string().trim().min(1),
        completionEvidenceNote: z.string(),
        completionEvidenceRefs: z.array(obligationEvidenceRefSchema),
      })
      .strict(),
    actionHistory: z.array(
      z
        .object({
          action: z.enum(['LINKED', 'REMOVED']),
          actorId: z.string().trim().min(1),
          occurredAt: timestampSchema,
          reason: z.string().trim().min(1),
        })
        .strict(),
    ),
    createdByActorId: z.string().trim().min(1),
    createdAt: timestampSchema,
    updatedByActorId: z.string().trim().min(1),
    updatedAt: timestampSchema,
    boundaryMetadata: eventEvidenceLinkBoundaryMetadataSchema,
  })
  .strict();
const referenceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    displayName: z.string().optional(),
    handle: z.string().optional(),
    platform: z.string().optional(),
    status: z.string().optional(),
  })
  .strict();

const listItemSchema = z
  .object({
    id: z.string().trim().min(1),
    contractCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    contractKind: contractReadKindSchema,
    linkedEntityKind: linkedEntityKindSchema,
    linkedEmploymentProfileId: z.string().nullable().optional(),
    linkedTalentId: z.string().nullable().optional(),
    ownerEmploymentProfileId: z.string().trim().min(1),
    linkedEmploymentProfileRef: referenceSummarySchema.nullable().optional(),
    linkedTalentRef: referenceSummarySchema.nullable().optional(),
    ownerEmploymentProfileRef: referenceSummarySchema.nullable().optional(),
    confidentialityTier: confidentialityTierSchema,
    status: statusSchema,
    effectiveStartDate: timestampSchema,
    effectiveEndDate: timestampSchema.nullable().optional(),
    boundaryMetadata: boundaryMetadataSchema,
    createdAt: timestampSchema,
  })
  .strict();

const byLinkedEntityItemSchema = listItemSchema
  .pick({
    id: true,
    contractCode: true,
    title: true,
    contractKind: true,
    linkedEntityKind: true,
    linkedEmploymentProfileId: true,
    linkedTalentId: true,
    linkedEmploymentProfileRef: true,
    linkedTalentRef: true,
    status: true,
    effectiveStartDate: true,
    effectiveEndDate: true,
    boundaryMetadata: true,
  })
  .strict();

const byOwnerItemSchema = listItemSchema
  .pick({
    id: true,
    contractCode: true,
    title: true,
    contractKind: true,
    ownerEmploymentProfileId: true,
    ownerEmploymentProfileRef: true,
    confidentialityTier: true,
    status: true,
    effectiveStartDate: true,
    effectiveEndDate: true,
    boundaryMetadata: true,
  })
  .strict();

const detailSchema = listItemSchema
  .extend({
    fileReferenceId: z.string().nullable().optional(),
    fileDisplayName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    updatedAt: timestampSchema,
  })
  .strict();

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const listResponseSchema = z
  .object({ data: z.array(listItemSchema), meta: cursorMetaSchema })
  .strict();
const byLinkedEntityResponseSchema = z
  .object({ data: z.array(byLinkedEntityItemSchema), meta: cursorMetaSchema })
  .strict();
const byOwnerResponseSchema = z
  .object({ data: z.array(byOwnerItemSchema), meta: cursorMetaSchema })
  .strict();
const detailResponseSchema = z.object({ data: detailSchema }).strict();
const obligationListResponseSchema = z
  .object({ data: z.array(obligationSchema), meta: cursorMetaSchema })
  .strict();
const obligationDetailResponseSchema = z.object({ data: obligationSchema }).strict();
const eventEvidenceLinkListResponseSchema = z
  .object({ data: z.array(eventEvidenceLinkSchema), meta: cursorMetaSchema })
  .strict();
const eventEvidenceLinkDetailResponseSchema = z.object({ data: eventEvidenceLinkSchema }).strict();
const obligationPayloadSchema = z
  .object({
    obligationType: obligationTypeSchema,
    title: z.string().trim().min(1).max(CONTRACT_OBLIGATION_TITLE_MAX_LENGTH),
    description: z.string().max(CONTRACT_OBLIGATION_DESCRIPTION_MAX_LENGTH).nullable(),
    dueDate: z.string().date().nullable(),
    responsibleOwnerEmploymentProfileId: z.string().trim().min(1),
    evidencePolicy: obligationEvidencePolicySchema,
  })
  .strict();
const obligationOpenPayloadSchema = z.object({}).strict();
const obligationReasonPayloadSchema = z
  .object({
    reason: z.string().trim().min(1).max(CONTRACT_OBLIGATION_REASON_MAX_LENGTH),
  })
  .strict();
const obligationArchivePayloadSchema = z
  .object({
    reason: z.string().trim().max(CONTRACT_OBLIGATION_REASON_MAX_LENGTH).nullable(),
  })
  .strict();
const obligationAcceptPayloadSchema = z
  .object({
    reviewNote: z.string().trim().max(CONTRACT_OBLIGATION_REASON_MAX_LENGTH).nullable(),
  })
  .strict();
const obligationDeliverPayloadSchema = z
  .object({
    deliveryNote: z.string().trim().max(CONTRACT_OBLIGATION_DELIVERY_NOTE_MAX_LENGTH).nullable(),
    evidenceRefs: z
      .array(obligationEvidenceRefSchema)
      .max(CONTRACT_OBLIGATION_EVIDENCE_REF_MAX_COUNT),
    eventEvidenceLinkIds: z
      .array(z.string().trim().min(1))
      .max(CONTRACT_OBLIGATION_EVIDENCE_REF_MAX_COUNT)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Event evidence link IDs must be unique',
      }),
  })
  .strict();
const eventEvidenceLinkPayloadSchema = z
  .object({
    eventId: z.string().trim().min(1),
    linkReason: z.string().trim().min(1).max(CONTRACT_OBLIGATION_EVENT_EVIDENCE_REASON_MAX_LENGTH),
  })
  .strict();
const eventEvidenceRemovePayloadSchema = z
  .object({
    removeReason: z
      .string()
      .trim()
      .min(1)
      .max(CONTRACT_OBLIGATION_EVENT_EVIDENCE_REASON_MAX_LENGTH),
  })
  .strict();
const createPayloadSchema = z
  .object({
    contractCode: z.string().optional(),
    title: z.string(),
    contractKind: commercialLegalContractKindSchema,
    linkedEntityKind: z.literal('TALENT'),
    linkedTalentId: z.string().trim().min(1),
    ownerEmploymentProfileId: z.string(),
    confidentialityTier: confidentialityTierSchema,
    effectiveStartDate: z.string(),
    effectiveEndDate: z.string().nullable().optional(),
    fileReferenceId: z.string().optional(),
    fileDisplayName: z.string().optional(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
  })
  .strict();

const sanitizeFlatListQuery = (
  query: ContractFlatListQuery,
): Record<string, string | number | boolean | undefined> => ({
  status: query.status,
  contractKind: query.contractKind,
  linkedEntityKind: query.linkedEntityKind,
  linkedEmploymentProfileId: query.linkedEmploymentProfileId,
  linkedTalentId: query.linkedTalentId,
  ownerEmploymentProfileId: query.ownerEmploymentProfileId,
  confidentialityTier: query.confidentialityTier,
  hasFileReference: query.hasFileReference,
  windowStartDate: query.windowStartDate,
  windowEndDate: query.windowEndDate,
  effectiveEndDateFrom: query.effectiveEndDateFrom,
  effectiveEndDateTo: query.effectiveEndDateTo,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByLinkedEntityQuery = (
  query: ContractByLinkedEntityQuery,
): Record<string, string | number | undefined> => ({
  linkedEntityKind: query.linkedEntityKind,
  linkedEmploymentProfileId: query.linkedEmploymentProfileId,
  linkedTalentId: query.linkedTalentId,
  status: query.status,
  windowStartDate: query.windowStartDate,
  windowEndDate: query.windowEndDate,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByOwnerQuery = (
  query: ContractByOwnerQuery,
): Record<string, string | number | undefined> => ({
  ownerEmploymentProfileId: query.ownerEmploymentProfileId,
  status: query.status,
  windowStartDate: query.windowStartDate,
  windowEndDate: query.windowEndDate,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeCreatePayload = (payload: ContractCreatePayload): ContractCreatePayload => {
  const parsed = createPayloadSchema.parse({
    contractCode: payload.contractCode,
    title: payload.title,
    contractKind: payload.contractKind,
    linkedEntityKind: payload.linkedEntityKind,
    linkedTalentId: payload.linkedTalentId,
    ownerEmploymentProfileId: payload.ownerEmploymentProfileId,
    confidentialityTier: payload.confidentialityTier,
    effectiveStartDate: payload.effectiveStartDate,
    effectiveEndDate: payload.effectiveEndDate,
    fileReferenceId: payload.fileReferenceId,
    fileDisplayName: payload.fileDisplayName,
    description: payload.description,
    externalRef: payload.externalRef,
  });
  const base: ContractCreatePayload = {
    title: parsed.title,
    contractKind: parsed.contractKind,
    linkedEntityKind: parsed.linkedEntityKind,
    linkedTalentId: parsed.linkedTalentId,
    ownerEmploymentProfileId: parsed.ownerEmploymentProfileId,
    confidentialityTier: parsed.confidentialityTier,
    effectiveStartDate: parsed.effectiveStartDate,
    effectiveEndDate: parsed.effectiveEndDate,
    description: parsed.description,
    externalRef: parsed.externalRef,
  };

  if (parsed.contractCode !== undefined) {
    base.contractCode = parsed.contractCode;
  }

  if (parsed.fileReferenceId && parsed.fileDisplayName) {
    base.fileReferenceId = parsed.fileReferenceId;
    base.fileDisplayName = parsed.fileDisplayName;
  }

  return base;
};

const sanitizeDraftCorePayload = (payload: ContractDraftCorePayload): ContractDraftCorePayload => {
  const next: ContractDraftCorePayload = {
    title: payload.title,
    linkedEntityKind: payload.linkedEntityKind,
    confidentialityTier: payload.confidentialityTier,
    effectiveStartDate: payload.effectiveStartDate,
    effectiveEndDate: payload.effectiveEndDate,
    description: payload.description,
    externalRef: payload.externalRef,
  };

  if (payload.linkedEntityKind === 'EMPLOYMENT_PROFILE') {
    next.linkedEmploymentProfileId = payload.linkedEmploymentProfileId;
    next.linkedTalentId = null;
  } else if (payload.linkedEntityKind === 'TALENT') {
    next.linkedTalentId = payload.linkedTalentId;
    next.linkedEmploymentProfileId = null;
  }

  return next;
};

export const fetchContractRecords = async (
  query: ContractFlatListQuery,
): Promise<CursorPagedResponse<ContractListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/contract-records',
    params: sanitizeFlatListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchContractRecordsByLinkedEntity = async (
  query: ContractByLinkedEntityQuery,
): Promise<CursorPagedResponse<ContractByLinkedEntityItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/contract-records/by-linked-entity',
    params: sanitizeByLinkedEntityQuery(query),
  });

  return byLinkedEntityResponseSchema.parse(response);
};

export const fetchContractRecordsByOwner = async (
  query: ContractByOwnerQuery,
): Promise<CursorPagedResponse<ContractByOwnerItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/contract-records/by-owner',
    params: sanitizeByOwnerQuery(query),
  });

  return byOwnerResponseSchema.parse(response);
};

export const fetchContractRecordDetail = async (
  contractRecordId: string,
): Promise<ContractRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const createContractRecord = async (
  payload: ContractCreatePayload,
): Promise<ContractRecord> => {
  const response = await apiRequest<unknown, ContractCreatePayload>({
    method: 'POST',
    url: '/admin/contract-records',
    data: sanitizeCreatePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const updateContractDraftCore = async (
  contractRecordId: string,
  payload: ContractDraftCorePayload,
): Promise<ContractRecord> => {
  const response = await apiRequest<unknown, ContractDraftCorePayload>({
    method: 'PATCH',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}/draft-core`,
    data: sanitizeDraftCorePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const assignContractOwner = async (
  contractRecordId: string,
  payload: ContractAssignOwnerPayload,
): Promise<ContractRecord> => {
  const response = await apiRequest<unknown, ContractAssignOwnerPayload>({
    method: 'POST',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}/assign-owner`,
    data: { newOwnerEmploymentProfileId: payload.newOwnerEmploymentProfileId },
  });

  return detailResponseSchema.parse(response).data;
};

export const updateContractFileReference = async (
  contractRecordId: string,
  payload: ContractFileReferencePayload,
): Promise<ContractRecord> => {
  const response = await apiRequest<unknown, ContractFileReferencePayload>({
    method: 'POST',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}/file-reference`,
    data: {
      newFileReferenceId: payload.newFileReferenceId,
      newFileDisplayName: payload.newFileDisplayName,
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const expireContractRecord = async (
  contractRecordId: string,
  payload: ContractExpirePayload,
): Promise<ContractRecord> => {
  const response = await apiRequest<unknown, ContractExpirePayload>({
    method: 'POST',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}/expire`,
    data: { expiryDate: payload.expiryDate },
  });

  return detailResponseSchema.parse(response).data;
};

export const terminateContractRecord = async (
  contractRecordId: string,
  payload: ContractTerminatePayload,
): Promise<ContractRecord> => {
  const response = await apiRequest<unknown, ContractTerminatePayload>({
    method: 'POST',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}/terminate`,
    data: { terminationDate: payload.terminationDate },
  });

  return detailResponseSchema.parse(response).data;
};

export const performContractLifecycleAction = async (
  contractRecordId: string,
  action: ContractLifecycleAction,
): Promise<ContractRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};

export const fetchContractObligations = async (
  contractRecordId: string,
): Promise<CursorPagedResponse<ContractObligation>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}/obligations`,
  });

  return obligationListResponseSchema.parse(response);
};

export const fetchContractObligationDetail = async (
  obligationId: string,
): Promise<ContractObligation> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}`,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const createContractObligation = async (
  contractRecordId: string,
  payload: ContractObligationPayload,
): Promise<ContractObligation> => {
  const parsed = obligationPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, ContractObligationPayload>({
    method: 'POST',
    url: `/admin/contract-records/${encodeURIComponent(contractRecordId)}/obligations`,
    data: parsed,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const updateContractObligation = async (
  obligationId: string,
  payload: ContractObligationPayload,
): Promise<ContractObligation> => {
  const parsed = obligationPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, ContractObligationPayload>({
    method: 'PATCH',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}`,
    data: parsed,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const performContractObligationOpen = async (
  obligationId: string,
): Promise<ContractObligation> => {
  const payload = obligationOpenPayloadSchema.parse({});
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}/open`,
    data: payload,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const reopenContractObligation = async (
  obligationId: string,
  payload: ContractObligationReasonPayload,
): Promise<ContractObligation> => {
  const parsed = obligationReasonPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, ContractObligationReasonPayload>({
    method: 'POST',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}/reopen`,
    data: parsed,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const deliverContractObligation = async (
  obligationId: string,
  payload: ContractObligationDeliverPayload,
): Promise<ContractObligation> => {
  const parsed = obligationDeliverPayloadSchema.parse({
    deliveryNote: payload.deliveryNote ?? null,
    evidenceRefs: payload.evidenceRefs ?? [],
    eventEvidenceLinkIds: payload.eventEvidenceLinkIds ?? [],
  });
  const response = await apiRequest<unknown, ContractObligationDeliverPayload>({
    method: 'POST',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}/deliver`,
    data: parsed,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const acceptContractObligation = async (
  obligationId: string,
  payload: ContractObligationAcceptPayload,
): Promise<ContractObligation> => {
  const parsed = obligationAcceptPayloadSchema.parse({
    reviewNote: payload.reviewNote ?? null,
  });
  const response = await apiRequest<unknown, ContractObligationAcceptPayload>({
    method: 'POST',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}/accept`,
    data: parsed,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const rejectContractObligation = async (
  obligationId: string,
  payload: ContractObligationReasonPayload,
): Promise<ContractObligation> => {
  const parsed = obligationReasonPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, ContractObligationReasonPayload>({
    method: 'POST',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}/reject`,
    data: parsed,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const cancelContractObligation = async (
  obligationId: string,
  payload: ContractObligationReasonPayload,
): Promise<ContractObligation> => {
  const parsed = obligationReasonPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, ContractObligationReasonPayload>({
    method: 'POST',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}/cancel`,
    data: parsed,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const archiveContractObligation = async (
  obligationId: string,
  payload: ContractObligationArchivePayload,
): Promise<ContractObligation> => {
  const parsed = obligationArchivePayloadSchema.parse({
    reason: payload.reason ?? null,
  });
  const response = await apiRequest<unknown, ContractObligationArchivePayload>({
    method: 'POST',
    url: `/admin/contract-records/obligations/${encodeURIComponent(obligationId)}/archive`,
    data: parsed,
  });

  return obligationDetailResponseSchema.parse(response).data;
};

export const fetchContractObligationEventEvidenceLinks = async (
  obligationId: string,
): Promise<CursorPagedResponse<ContractObligationEventEvidenceLink>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/contract-records/obligations/${encodeURIComponent(
      obligationId,
    )}/event-evidence-links`,
  });

  return eventEvidenceLinkListResponseSchema.parse(response);
};

export const linkContractObligationEventEvidence = async (
  obligationId: string,
  payload: ContractObligationEventEvidenceLinkPayload,
): Promise<ContractObligationEventEvidenceLink> => {
  const parsed = eventEvidenceLinkPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, ContractObligationEventEvidenceLinkPayload>({
    method: 'POST',
    url: `/admin/contract-records/obligations/${encodeURIComponent(
      obligationId,
    )}/event-evidence-links`,
    data: parsed,
  });

  return eventEvidenceLinkDetailResponseSchema.parse(response).data;
};

export const removeContractObligationEventEvidence = async (
  linkId: string,
  payload: ContractObligationEventEvidenceRemovePayload,
): Promise<ContractObligationEventEvidenceLink> => {
  const parsed = eventEvidenceRemovePayloadSchema.parse(payload);
  const response = await apiRequest<unknown, ContractObligationEventEvidenceRemovePayload>({
    method: 'POST',
    url: `/admin/contract-records/obligations/event-evidence-links/${encodeURIComponent(
      linkId,
    )}/remove`,
    data: parsed,
  });

  return eventEvidenceLinkDetailResponseSchema.parse(response).data;
};
