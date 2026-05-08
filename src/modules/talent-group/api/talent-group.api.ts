import { z } from 'zod';

import { apiRequest } from '@shared/api';

import type {
  CursorPagedResponse,
  TalentGroupAddMemberPayload,
  TalentGroupByTalentListItem,
  TalentGroupByTalentQuery,
  TalentGroupCreatePayload,
  TalentGroupFlatListQuery,
  TalentGroupLifecycleAction,
  TalentGroupMemberRecord,
  TalentGroupMembershipLifecycleAction,
  TalentGroupMembersQuery,
  TalentGroupRecord,
  TalentGroupUpdateLineupPayload,
  TalentGroupUpdatePayload,
} from '@modules/talent-group/types/talent-group.types';

const groupStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
const membershipStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'REMOVED']);

const listTalentGroupSchema = z
  .object({
    id: z.string().trim().min(1),
    groupCode: z.string().trim().min(1),
    name: z.string().trim().min(1),
    shortName: z.string().nullable().optional(),
    status: groupStatusSchema,
    displayOrder: z.number().int(),
    createdAt: z.union([z.number(), z.string()]),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const detailTalentGroupSchema = listTalentGroupSchema
  .extend({
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
  })
  .strict();

const memberSchema = z
  .object({
    id: z.string().trim().min(1),
    groupId: z.string().trim().min(1),
    talentId: z.string().trim().min(1),
    membershipStatus: membershipStatusSchema,
    lineupOrder: z.number().int(),
    joinedAt: z.union([z.number(), z.string()]),
    leftAt: z.union([z.number(), z.string()]).nullable().optional(),
    createdAt: z.union([z.number(), z.string()]),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const byTalentSchema = z
  .object({
    id: z.string().trim().min(1),
    groupCode: z.string().trim().min(1),
    name: z.string().trim().min(1),
    shortName: z.string().nullable().optional(),
    status: groupStatusSchema,
    displayOrder: z.number().int(),
    membershipId: z.string().trim().min(1),
    talentId: z.string().trim().min(1),
    membershipStatus: membershipStatusSchema,
    lineupOrder: z.number().int(),
    joinedAt: z.union([z.number(), z.string()]),
    createdAt: z.union([z.number(), z.string()]),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const flatListResponseSchema = z
  .object({
    data: z.array(listTalentGroupSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const byTalentResponseSchema = z
  .object({
    data: z.array(byTalentSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: detailTalentGroupSchema,
  })
  .strict();

const membersResponseSchema = z
  .object({
    data: z.array(memberSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const sanitizeFlatListQuery = (
  query: TalentGroupFlatListQuery,
): Record<string, string | number | undefined> => {
  return {
    status: query.status,
    containsTalentId: query.containsTalentId,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    limit: query.limit,
    cursor: query.cursor,
  };
};

const sanitizeByTalentQuery = (
  query: TalentGroupByTalentQuery,
): Record<string, string | number | undefined> => {
  return {
    status: query.status,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    limit: query.limit,
    cursor: query.cursor,
  };
};

export const fetchTalentGroups = async (
  query: TalentGroupFlatListQuery,
): Promise<CursorPagedResponse<TalentGroupRecord>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/talent-groups',
    params: sanitizeFlatListQuery(query),
  });

  return flatListResponseSchema.parse(response);
};

export const fetchTalentGroupsByTalent = async (
  query: TalentGroupByTalentQuery & { talentId: string },
): Promise<CursorPagedResponse<TalentGroupByTalentListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/talent-groups/by-talent/${encodeURIComponent(query.talentId)}`,
    params: sanitizeByTalentQuery(query),
  });

  return byTalentResponseSchema.parse(response);
};

export const fetchTalentGroupDetail = async (groupId: string): Promise<TalentGroupRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/talent-groups/${encodeURIComponent(groupId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const fetchTalentGroupMembers = async (
  groupId: string,
  query: TalentGroupMembersQuery,
): Promise<CursorPagedResponse<TalentGroupMemberRecord>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/talent-groups/${encodeURIComponent(groupId)}/members`,
    params: {
      limit: query.limit,
      cursor: query.cursor,
    },
  });

  return membersResponseSchema.parse(response);
};

export const createTalentGroup = async (
  payload: TalentGroupCreatePayload,
): Promise<TalentGroupRecord> => {
  const response = await apiRequest<unknown, TalentGroupCreatePayload>({
    method: 'POST',
    url: '/admin/talent-groups',
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const updateTalentGroup = async (
  groupId: string,
  payload: TalentGroupUpdatePayload,
): Promise<TalentGroupRecord> => {
  const response = await apiRequest<unknown, TalentGroupUpdatePayload>({
    method: 'PATCH',
    url: `/admin/talent-groups/${encodeURIComponent(groupId)}`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const performTalentGroupLifecycleAction = async (
  groupId: string,
  action: TalentGroupLifecycleAction,
): Promise<TalentGroupRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/talent-groups/${encodeURIComponent(groupId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};

export const addTalentGroupMember = async (
  groupId: string,
  payload: TalentGroupAddMemberPayload,
): Promise<TalentGroupMemberRecord> => {
  const response = await apiRequest<unknown, TalentGroupAddMemberPayload>({
    method: 'POST',
    url: `/admin/talent-groups/${encodeURIComponent(groupId)}/members`,
    data: payload,
  });

  return z
    .object({
      data: memberSchema,
    })
    .strict()
    .parse(response).data;
};

export const updateTalentGroupMemberLineup = async (
  membershipId: string,
  payload: TalentGroupUpdateLineupPayload,
): Promise<TalentGroupMemberRecord> => {
  const response = await apiRequest<unknown, TalentGroupUpdateLineupPayload>({
    method: 'PATCH',
    url: `/admin/talent-groups/members/${encodeURIComponent(membershipId)}/lineup`,
    data: payload,
  });

  return z
    .object({
      data: memberSchema,
    })
    .strict()
    .parse(response).data;
};

export const performTalentGroupMembershipLifecycleAction = async (
  membershipId: string,
  action: TalentGroupMembershipLifecycleAction,
): Promise<TalentGroupMemberRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/talent-groups/members/${encodeURIComponent(membershipId)}/${action}`,
    data: {},
  });

  return z
    .object({
      data: memberSchema,
    })
    .strict()
    .parse(response).data;
};
