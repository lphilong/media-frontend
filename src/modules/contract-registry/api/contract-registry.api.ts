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
const contractKindSchema = z.enum(['EMPLOYMENT', 'TALENT_SERVICE', 'TALENT_MANAGEMENT']);
const linkedEntityKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT']);
const confidentialityTierSchema = z.enum(['STANDARD', 'CONFIDENTIAL', 'RESTRICTED']);
const timestampSchema = z.union([z.number(), z.string()]);

const listItemSchema = z
  .object({
    id: z.string().trim().min(1),
    contractCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    contractKind: contractKindSchema,
    linkedEntityKind: linkedEntityKindSchema,
    linkedEmploymentProfileId: z.string().nullable().optional(),
    linkedTalentId: z.string().nullable().optional(),
    ownerEmploymentProfileId: z.string().trim().min(1),
    confidentialityTier: confidentialityTierSchema,
    status: statusSchema,
    effectiveStartDate: timestampSchema,
    effectiveEndDate: timestampSchema.nullable().optional(),
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
    status: true,
    effectiveStartDate: true,
    effectiveEndDate: true,
  })
  .strict();

const byOwnerItemSchema = listItemSchema
  .pick({
    id: true,
    contractCode: true,
    title: true,
    contractKind: true,
    ownerEmploymentProfileId: true,
    confidentialityTier: true,
    status: true,
    effectiveStartDate: true,
    effectiveEndDate: true,
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
  const base: ContractCreatePayload = {
    contractCode: payload.contractCode,
    title: payload.title,
    contractKind: payload.contractKind,
    linkedEntityKind: payload.linkedEntityKind,
    ownerEmploymentProfileId: payload.ownerEmploymentProfileId,
    confidentialityTier: payload.confidentialityTier,
    effectiveStartDate: payload.effectiveStartDate,
    effectiveEndDate: payload.effectiveEndDate,
    description: payload.description,
    externalRef: payload.externalRef,
  };

  if (payload.linkedEntityKind === 'EMPLOYMENT_PROFILE') {
    base.linkedEmploymentProfileId = payload.linkedEmploymentProfileId;
  } else {
    base.linkedTalentId = payload.linkedTalentId;
  }

  if (payload.fileReferenceId && payload.fileDisplayName) {
    base.fileReferenceId = payload.fileReferenceId;
    base.fileDisplayName = payload.fileDisplayName;
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
