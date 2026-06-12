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
  ContractRecord,
  ContractTerminatePayload,
  CursorPagedResponse,
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
    obligationAcceptanceImplemented: z.literal(false),
    eventEvidenceLinkImplemented: z.literal(false),
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
