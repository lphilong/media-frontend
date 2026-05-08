import { z } from 'zod';

import { apiRequest } from '@shared/api';

import type {
  CursorPagedResponse,
  StudioResourceAvailabilityAction,
  StudioResourceAvailabilityItem,
  StudioResourceAvailabilityQuery,
  StudioResourceCreatePayload,
  StudioResourceLifecycleAction,
  StudioResourceListItem,
  StudioResourceListQuery,
  StudioResourceRecord,
  StudioResourceUpdatePayload,
} from '@modules/studio-resource/types/studio-resource.types';

const operationalStatusSchema = z.enum(['ACTIVE', 'OUT_OF_SERVICE', 'INACTIVE', 'ARCHIVED']);

const listItemSchema = z
  .object({
    id: z.string().trim().min(1),
    resourceCode: z.string().trim().min(1),
    name: z.string().trim().min(1),
    shortName: z.string().nullable().optional(),
    resourceClass: z.string().trim().min(1),
    operationalStatus: operationalStatusSchema,
    locationLabel: z.string().nullable().optional(),
    maxOccupancy: z.number().int().positive().nullable().optional(),
    createdAt: z.union([z.number(), z.string()]),
  })
  .strict();

const availabilityItemSchema = z
  .object({
    id: z.string().trim().min(1),
    resourceCode: z.string().trim().min(1),
    name: z.string().trim().min(1),
    resourceClass: z.string().trim().min(1),
    operationalStatus: operationalStatusSchema,
    maxOccupancy: z.number().int().positive().nullable().optional(),
  })
  .strict();

const detailSchema = listItemSchema
  .extend({
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    updatedAt: z.union([z.number(), z.string()]),
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

const availabilityResponseSchema = z
  .object({
    data: z.array(availabilityItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: detailSchema,
  })
  .strict();

const sanitizeListQuery = (
  query: StudioResourceListQuery | StudioResourceAvailabilityQuery,
): Record<string, string | number | boolean | undefined> => {
  return {
    resourceClass: query.resourceClass,
    operationalStatus: query.operationalStatus,
    hasMaxOccupancy: query.hasMaxOccupancy,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    limit: query.limit,
    cursor: query.cursor,
  };
};

export const fetchStudioResources = async (
  query: StudioResourceListQuery,
): Promise<CursorPagedResponse<StudioResourceListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/studio-resources',
    params: sanitizeListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchStudioResourceAvailability = async (
  query: StudioResourceAvailabilityQuery,
): Promise<CursorPagedResponse<StudioResourceAvailabilityItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/studio-resources/availability',
    params: sanitizeListQuery(query),
  });

  return availabilityResponseSchema.parse(response);
};

export const fetchStudioResourceDetail = async (
  studioResourceId: string,
): Promise<StudioResourceRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/studio-resources/${encodeURIComponent(studioResourceId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const createStudioResource = async (
  payload: StudioResourceCreatePayload,
): Promise<StudioResourceRecord> => {
  const response = await apiRequest<unknown, StudioResourceCreatePayload>({
    method: 'POST',
    url: '/admin/studio-resources',
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const updateStudioResource = async (
  studioResourceId: string,
  payload: StudioResourceUpdatePayload,
): Promise<StudioResourceRecord> => {
  const response = await apiRequest<unknown, StudioResourceUpdatePayload>({
    method: 'PATCH',
    url: `/admin/studio-resources/${encodeURIComponent(studioResourceId)}`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const performStudioResourceAvailabilityAction = async (
  studioResourceId: string,
  action: StudioResourceAvailabilityAction,
): Promise<StudioResourceRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/studio-resources/${encodeURIComponent(studioResourceId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};

export const performStudioResourceLifecycleAction = async (
  studioResourceId: string,
  action: StudioResourceLifecycleAction,
): Promise<StudioResourceRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/studio-resources/${encodeURIComponent(studioResourceId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};
