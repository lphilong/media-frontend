import { z } from 'zod';

import { apiRequest } from '@shared/api';

import type {
  CursorPagedResponse,
  PlatformAccountCapabilitiesPayload,
  PlatformAccountCreatePayload,
  PlatformAccountLifecycleAction,
  PlatformAccountListQuery,
  PlatformAccountOwnershipTransferPayload,
  PlatformAccountRecord,
  PlatformAccountUpdatePayload,
} from '@modules/platform-account/types/platform-account.types';

const ownerKindSchema = z.enum(['ORG_UNIT', 'TALENT', 'TALENT_GROUP']);
const operationalStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
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

const platformAccountSchema = z
  .object({
    id: z.string().trim().min(1),
    accountCode: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    platformSurfaceType: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    handle: z.string().nullable().optional(),
    externalPlatformId: z.string().nullable().optional(),
    profileUrl: z.string().nullable().optional(),
    ownerKind: ownerKindSchema,
    ownerOrgUnitId: z.string().nullable().optional(),
    ownerTalentId: z.string().nullable().optional(),
    ownerTalentGroupId: z.string().nullable().optional(),
    ownerRef: referenceSummarySchema.nullable().optional(),
    operationalStatus: operationalStatusSchema,
    livestreamEnabled: z.boolean(),
    contentPublishingEnabled: z.boolean(),
    monetizationEnabled: z.boolean(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    createdAt: z.union([z.number(), z.string()]),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const listItemSchema = platformAccountSchema
  .omit({
    description: true,
    externalRef: true,
  })
  .strict();

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const listResponseSchema = z
  .object({
    data: z.array(listItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: platformAccountSchema,
  })
  .strict();

const sanitizeListQuery = (
  query: PlatformAccountListQuery,
): Record<string, string | number | boolean | undefined> => {
  return {
    platform: query.platform,
    platformSurfaceType: query.platformSurfaceType,
    operationalStatus: query.operationalStatus,
    ownerKind: query.ownerKind,
    ownerOrgUnitId: query.ownerOrgUnitId,
    ownerTalentId: query.ownerTalentId,
    ownerTalentGroupId: query.ownerTalentGroupId,
    livestreamEnabled: query.livestreamEnabled,
    contentPublishingEnabled: query.contentPublishingEnabled,
    monetizationEnabled: query.monetizationEnabled,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    limit: query.limit,
    cursor: query.cursor,
  };
};

export const fetchPlatformAccounts = async (
  query: PlatformAccountListQuery,
): Promise<CursorPagedResponse<PlatformAccountRecord>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/platform-accounts',
    params: sanitizeListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchPlatformAccountDetail = async (
  platformAccountId: string,
): Promise<PlatformAccountRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/platform-accounts/${encodeURIComponent(platformAccountId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const createPlatformAccount = async (
  payload: PlatformAccountCreatePayload,
): Promise<PlatformAccountRecord> => {
  const response = await apiRequest<unknown, PlatformAccountCreatePayload>({
    method: 'POST',
    url: '/admin/platform-accounts',
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const updatePlatformAccount = async (
  platformAccountId: string,
  payload: PlatformAccountUpdatePayload,
): Promise<PlatformAccountRecord> => {
  const response = await apiRequest<unknown, PlatformAccountUpdatePayload>({
    method: 'PATCH',
    url: `/admin/platform-accounts/${encodeURIComponent(platformAccountId)}`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const transferPlatformAccountOwnership = async (
  platformAccountId: string,
  payload: PlatformAccountOwnershipTransferPayload,
): Promise<PlatformAccountRecord> => {
  const response = await apiRequest<unknown, PlatformAccountOwnershipTransferPayload>({
    method: 'POST',
    url: `/admin/platform-accounts/${encodeURIComponent(platformAccountId)}/ownership-transfer`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const updatePlatformAccountCapabilities = async (
  platformAccountId: string,
  payload: PlatformAccountCapabilitiesPayload,
): Promise<PlatformAccountRecord> => {
  const response = await apiRequest<unknown, PlatformAccountCapabilitiesPayload>({
    method: 'POST',
    url: `/admin/platform-accounts/${encodeURIComponent(platformAccountId)}/capabilities`,
    data: {
      livestreamEnabled: payload.livestreamEnabled,
      contentPublishingEnabled: payload.contentPublishingEnabled,
      monetizationEnabled: payload.monetizationEnabled,
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const performPlatformAccountLifecycleAction = async (
  platformAccountId: string,
  action: PlatformAccountLifecycleAction,
): Promise<PlatformAccountRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/platform-accounts/${encodeURIComponent(platformAccountId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};
