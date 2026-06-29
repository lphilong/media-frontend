import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTalent,
  fetchTalentDetail,
  fetchTalents,
  linkTalentEmploymentProfile,
  performTalentLifecycleAction,
  updateTalent,
  updateTalentCommercialParticipation,
} from '@modules/talent/api/talent.api';
import type {
  TalentCommercialParticipationPayload,
  TalentCreatePayload,
  TalentEmploymentProfileLinkPayload,
  TalentLifecycleAction,
  TalentListQuery,
  TalentUpdatePayload,
} from '@modules/talent/types/talent.types';
import { serializeScreenQueryParams, talentFlatListQueryConfig } from '@shared/query';

const TALENT_QUERY_ROOT = ['talent'] as const;
const TALENT_GROUP_QUERY_ROOT = ['talent-group'] as const;

const toListQueryToken = (query: TalentListQuery): string => {
  return serializeScreenQueryParams(query, talentFlatListQueryConfig).toString();
};

export const talentQueryKeys = {
  all: (): readonly ['talent'] => TALENT_QUERY_ROOT,
  list: (query: TalentListQuery) => ['talent', 'list', toListQueryToken(query)] as const,
  detail: (talentId: string) => ['talent', 'detail', talentId] as const,
};

export const useTalentList = (query: TalentListQuery) => {
  return useQuery({
    queryKey: talentQueryKeys.list(query),
    queryFn: () => fetchTalents(query),
  });
};

export const useTalentDetail = (talentId?: string) => {
  return useQuery({
    queryKey: talentId ? talentQueryKeys.detail(talentId) : [...TALENT_QUERY_ROOT, 'detail'],
    queryFn: () => fetchTalentDetail(talentId ?? ''),
    enabled: Boolean(talentId),
  });
};

const invalidateTalentModuleQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: TALENT_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: TALENT_GROUP_QUERY_ROOT });
};

export const useCreateTalentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TalentCreatePayload) => createTalent(payload),
    onSuccess: async () => {
      await invalidateTalentModuleQueries(queryClient);
    },
  });
};

export const useUpdateTalentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ talentId, payload }: { talentId: string; payload: TalentUpdatePayload }) =>
      updateTalent(talentId, payload),
    onSuccess: async () => {
      await invalidateTalentModuleQueries(queryClient);
    },
  });
};

export const useTalentEmploymentLinkMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      talentId,
      payload,
    }: {
      talentId: string;
      payload: TalentEmploymentProfileLinkPayload;
    }) => linkTalentEmploymentProfile(talentId, payload),
    onSuccess: async () => {
      await invalidateTalentModuleQueries(queryClient);
    },
  });
};

export const useTalentCommercialParticipationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      talentId,
      payload,
    }: {
      talentId: string;
      payload: TalentCommercialParticipationPayload;
    }) => updateTalentCommercialParticipation(talentId, payload),
    onSuccess: async () => {
      await invalidateTalentModuleQueries(queryClient);
    },
  });
};

export const useTalentLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ talentId, action }: { talentId: string; action: TalentLifecycleAction }) =>
      performTalentLifecycleAction(talentId, action),
    onSuccess: async () => {
      await invalidateTalentModuleQueries(queryClient);
    },
  });
};
