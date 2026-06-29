import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addTalentGroupMember,
  createTalentGroup,
  fetchTalentGroupDetail,
  fetchTalentGroupMembers,
  fetchTalentGroups,
  fetchTalentGroupsByTalent,
  performTalentGroupLifecycleAction,
  performTalentGroupMembershipLifecycleAction,
  updateTalentGroup,
  updateTalentGroupMemberLineup,
} from '@modules/talent-group/api/talent-group.api';
import type {
  TalentGroupAddMemberPayload,
  TalentGroupByTalentQuery,
  TalentGroupCreatePayload,
  TalentGroupFlatListQuery,
  TalentGroupLifecycleAction,
  TalentGroupMembershipLifecycleAction,
  TalentGroupMembersQuery,
  TalentGroupUpdateLineupPayload,
  TalentGroupUpdatePayload,
} from '@modules/talent-group/types/talent-group.types';
import {
  serializeScreenQueryParams,
  talentGroupByTalentQueryConfig,
  talentGroupFlatListQueryConfig,
} from '@shared/query';

const TALENT_GROUP_QUERY_ROOT = ['talent-group'] as const;
const TALENT_QUERY_ROOT = ['talent'] as const;

const toFlatListQueryToken = (query: TalentGroupFlatListQuery): string => {
  return serializeScreenQueryParams(query, talentGroupFlatListQueryConfig).toString();
};

const toByTalentQueryToken = (query: TalentGroupByTalentQuery): string => {
  return serializeScreenQueryParams(query, talentGroupByTalentQueryConfig).toString();
};

export const talentGroupQueryKeys = {
  all: (): readonly ['talent-group'] => TALENT_GROUP_QUERY_ROOT,
  flatList: (query: TalentGroupFlatListQuery) =>
    ['talent-group', 'flat-list', toFlatListQueryToken(query)] as const,
  byTalentList: (query: TalentGroupByTalentQuery) =>
    ['talent-group', 'by-talent', toByTalentQueryToken(query)] as const,
  detail: (groupId: string) => ['talent-group', 'detail', groupId] as const,
  members: (groupId: string, query: TalentGroupMembersQuery) =>
    ['talent-group', 'members', groupId, query.cursor ?? 'root', query.limit ?? 20] as const,
};

export const useTalentGroupFlatList = (
  query: TalentGroupFlatListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: talentGroupQueryKeys.flatList(query),
    queryFn: () => fetchTalentGroups(query),
    enabled: options?.enabled ?? true,
  });
};

export const useTalentGroupByTalentList = (
  query: TalentGroupByTalentQuery & { talentId?: string },
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: talentGroupQueryKeys.byTalentList(query),
    queryFn: () =>
      fetchTalentGroupsByTalent(query as TalentGroupByTalentQuery & { talentId: string }),
    enabled: (options?.enabled ?? true) && Boolean(query.talentId),
  });
};

export const useTalentGroupDetail = (groupId?: string) => {
  return useQuery({
    queryKey: groupId
      ? talentGroupQueryKeys.detail(groupId)
      : [...TALENT_GROUP_QUERY_ROOT, 'detail'],
    queryFn: () => fetchTalentGroupDetail(groupId ?? ''),
    enabled: Boolean(groupId),
  });
};

export const useTalentGroupMembers = (
  groupId: string | undefined,
  query: TalentGroupMembersQuery,
) => {
  return useQuery({
    queryKey: groupId
      ? talentGroupQueryKeys.members(groupId, query)
      : [...TALENT_GROUP_QUERY_ROOT, 'members'],
    queryFn: () => fetchTalentGroupMembers(groupId ?? '', query),
    enabled: Boolean(groupId),
  });
};

const invalidateTalentGroupModuleQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  await queryClient.invalidateQueries({ queryKey: TALENT_GROUP_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: TALENT_QUERY_ROOT });
};

export const useCreateTalentGroupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TalentGroupCreatePayload) => createTalentGroup(payload),
    onSuccess: async () => {
      await invalidateTalentGroupModuleQueries(queryClient);
    },
  });
};

export const useUpdateTalentGroupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: TalentGroupUpdatePayload }) =>
      updateTalentGroup(groupId, payload),
    onSuccess: async () => {
      await invalidateTalentGroupModuleQueries(queryClient);
    },
  });
};

export const useTalentGroupLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, action }: { groupId: string; action: TalentGroupLifecycleAction }) =>
      performTalentGroupLifecycleAction(groupId, action),
    onSuccess: async () => {
      await invalidateTalentGroupModuleQueries(queryClient);
    },
  });
};

export const useTalentGroupAddMemberMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: TalentGroupAddMemberPayload }) =>
      addTalentGroupMember(groupId, payload),
    onSuccess: async () => {
      await invalidateTalentGroupModuleQueries(queryClient);
    },
  });
};

export const useTalentGroupUpdateLineupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      payload,
    }: {
      membershipId: string;
      payload: TalentGroupUpdateLineupPayload;
    }) => updateTalentGroupMemberLineup(membershipId, payload),
    onSuccess: async () => {
      await invalidateTalentGroupModuleQueries(queryClient);
    },
  });
};

export const useTalentGroupMembershipLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      membershipId,
      action,
    }: {
      membershipId: string;
      action: TalentGroupMembershipLifecycleAction;
    }) => performTalentGroupMembershipLifecycleAction(membershipId, action),
    onSuccess: async () => {
      await invalidateTalentGroupModuleQueries(queryClient);
    },
  });
};
