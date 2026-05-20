import { z } from 'zod';

import { apiRequest } from '@shared/api';

import type {
  CursorPagedResponse,
  OrgUnitChildRecord,
  OrgUnitCreatePayload,
  OrgUnitLifecycleAction,
  OrgUnitListQuery,
  OrgUnitMovePayload,
  OrgUnitRecord,
  OrgUnitUpdatePayload,
} from '@modules/org-unit/types/org-unit.types';

const orgUnitStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
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

const listOrgUnitSchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
    status: orgUnitStatusSchema,
    parentOrgUnitId: z.string().trim().min(1).nullable().optional(),
    parentOrgUnitRef: referenceSummarySchema.nullable().optional(),
    depth: z.number().int().nonnegative(),
    displayOrder: z.number().int(),
    createdAt: z.union([z.number(), z.string()]),
  })
  .strict();

const detailOrgUnitSchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
    status: orgUnitStatusSchema,
    parentOrgUnitId: z.string().trim().min(1).nullable().optional(),
    parentOrgUnitRef: referenceSummarySchema.nullable().optional(),
    depth: z.number().int().nonnegative(),
    displayOrder: z.number().int(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    createdAt: z.union([z.number(), z.string()]),
    updatedAt: z.union([z.number(), z.string()]),
    hierarchy: z
      .object({
        id: z.string().trim().min(1),
        parentOrgUnitId: z.string().trim().min(1).nullable().optional(),
        depth: z.number().int().nonnegative(),
        ancestorChain: z.array(z.string().trim().min(1)),
      })
      .strict(),
  })
  .strict();

const childrenOrgUnitSchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    type: z.string().trim().min(1),
    status: orgUnitStatusSchema,
    parentOrgUnitId: z.string().trim().min(1).nullable().optional(),
    parentOrgUnitRef: referenceSummarySchema.nullable().optional(),
    depth: z.number().int().nonnegative(),
    displayOrder: z.number().int(),
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
    data: z.array(listOrgUnitSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: detailOrgUnitSchema,
  })
  .strict();

const childrenResponseSchema = z
  .object({
    data: z.array(childrenOrgUnitSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const sanitizeQueryParams = (
  query: OrgUnitListQuery,
): Record<string, string | number | boolean | undefined> => {
  return {
    status: query.status,
    type: query.type,
    parentOrgUnitId: query.parentOrgUnitId,
    rootOnly: query.rootOnly,
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  };
};

export const fetchOrgUnits = async (
  query: OrgUnitListQuery,
): Promise<CursorPagedResponse<OrgUnitRecord>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/org-units',
    params: sanitizeQueryParams(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchOrgUnitDetail = async (orgUnitId: string): Promise<OrgUnitRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/org-units/${encodeURIComponent(orgUnitId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const fetchOrgUnitChildren = async (
  orgUnitId: string,
  query: Pick<OrgUnitListQuery, 'cursor' | 'limit'>,
): Promise<CursorPagedResponse<OrgUnitChildRecord>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/org-units/${encodeURIComponent(orgUnitId)}/children`,
    params: {
      cursor: query.cursor,
      limit: query.limit,
    },
  });

  return childrenResponseSchema.parse(response);
};

export const createOrgUnit = async (payload: OrgUnitCreatePayload): Promise<OrgUnitRecord> => {
  const response = await apiRequest<unknown, OrgUnitCreatePayload>({
    method: 'POST',
    url: '/admin/org-units',
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const updateOrgUnit = async (
  orgUnitId: string,
  payload: OrgUnitUpdatePayload,
): Promise<OrgUnitRecord> => {
  const response = await apiRequest<unknown, OrgUnitUpdatePayload>({
    method: 'PATCH',
    url: `/admin/org-units/${encodeURIComponent(orgUnitId)}`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const moveOrgUnit = async (
  orgUnitId: string,
  payload: OrgUnitMovePayload,
): Promise<OrgUnitRecord> => {
  const response = await apiRequest<unknown, OrgUnitMovePayload>({
    method: 'POST',
    url: `/admin/org-units/${encodeURIComponent(orgUnitId)}/move`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const performOrgUnitLifecycleAction = async (
  orgUnitId: string,
  action: OrgUnitLifecycleAction,
): Promise<OrgUnitRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/org-units/${encodeURIComponent(orgUnitId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};
