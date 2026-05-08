import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTalentKpiRecord,
  fetchTalentKpiMetrics,
  fetchTalentKpiRecordDetail,
  fetchTalentKpiRecords,
  fetchTalentKpiRecordsByEvent,
  fetchTalentKpiRecordsByPlatform,
  fetchTalentKpiRecordsByTalent,
  performTalentKpiLifecycleAction,
  replaceTalentKpiMetrics,
  updateTalentKpiDraftCore,
} from '@modules/talent-kpi/api/talent-kpi.api';
import type {
  TalentKpiByEventQuery,
  TalentKpiByPlatformQuery,
  TalentKpiByTalentQuery,
  TalentKpiCreatePayload,
  TalentKpiDraftCorePayload,
  TalentKpiFlatListQuery,
  TalentKpiLifecycleAction,
  TalentKpiMetricsReplacementPayload,
} from '@modules/talent-kpi/types/talent-kpi.types';
import {
  serializeScreenQueryParams,
  talentKpiByEventQueryConfig,
  talentKpiByPlatformQueryConfig,
  talentKpiByTalentQueryConfig,
  talentKpiFlatListQueryConfig,
} from '@shared/query';

const TALENT_KPI_QUERY_ROOT = ['talent-kpi'] as const;

const toFlatListQueryToken = (query: TalentKpiFlatListQuery): string =>
  serializeScreenQueryParams(query, talentKpiFlatListQueryConfig).toString();

const toByTalentQueryToken = (query: TalentKpiByTalentQuery): string =>
  serializeScreenQueryParams(query, talentKpiByTalentQueryConfig).toString();

const toByPlatformQueryToken = (query: TalentKpiByPlatformQuery): string =>
  serializeScreenQueryParams(query, talentKpiByPlatformQueryConfig).toString();

const toByEventQueryToken = (query: TalentKpiByEventQuery): string =>
  serializeScreenQueryParams(query, talentKpiByEventQueryConfig).toString();

export const talentKpiQueryKeys = {
  all: (): readonly ['talent-kpi'] => TALENT_KPI_QUERY_ROOT,
  flatList: (query: TalentKpiFlatListQuery) =>
    ['talent-kpi', 'flat-list', toFlatListQueryToken(query)] as const,
  byTalent: (query: TalentKpiByTalentQuery) =>
    ['talent-kpi', 'by-talent', toByTalentQueryToken(query)] as const,
  byPlatform: (query: TalentKpiByPlatformQuery) =>
    ['talent-kpi', 'by-platform', toByPlatformQueryToken(query)] as const,
  byEvent: (query: TalentKpiByEventQuery) =>
    ['talent-kpi', 'by-event', toByEventQueryToken(query)] as const,
  detail: (talentKpiRecordId: string) => ['talent-kpi', 'detail', talentKpiRecordId] as const,
  metrics: (talentKpiRecordId: string) => ['talent-kpi', 'metrics', talentKpiRecordId] as const,
};

export const useTalentKpiFlatList = (
  query: TalentKpiFlatListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: talentKpiQueryKeys.flatList(query),
    queryFn: () => fetchTalentKpiRecords(query),
    enabled: options?.enabled ?? true,
  });
};

export const useTalentKpiByTalent = (
  query: TalentKpiByTalentQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: talentKpiQueryKeys.byTalent(query),
    queryFn: () => fetchTalentKpiRecordsByTalent(query),
    enabled: options?.enabled ?? true,
  });
};

export const useTalentKpiByPlatform = (
  query: TalentKpiByPlatformQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: talentKpiQueryKeys.byPlatform(query),
    queryFn: () => fetchTalentKpiRecordsByPlatform(query),
    enabled: options?.enabled ?? true,
  });
};

export const useTalentKpiByEvent = (
  query: TalentKpiByEventQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: talentKpiQueryKeys.byEvent(query),
    queryFn: () => fetchTalentKpiRecordsByEvent(query),
    enabled: options?.enabled ?? true,
  });
};

export const useTalentKpiDetail = (talentKpiRecordId?: string) => {
  return useQuery({
    queryKey: talentKpiRecordId
      ? talentKpiQueryKeys.detail(talentKpiRecordId)
      : [...TALENT_KPI_QUERY_ROOT, 'detail'],
    queryFn: () => fetchTalentKpiRecordDetail(talentKpiRecordId ?? ''),
    enabled: Boolean(talentKpiRecordId),
  });
};

export const useTalentKpiMetrics = (talentKpiRecordId?: string) => {
  return useQuery({
    queryKey: talentKpiRecordId
      ? talentKpiQueryKeys.metrics(talentKpiRecordId)
      : [...TALENT_KPI_QUERY_ROOT, 'metrics'],
    queryFn: () => fetchTalentKpiMetrics(talentKpiRecordId ?? ''),
    enabled: Boolean(talentKpiRecordId),
  });
};

const invalidateTalentKpiQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: TALENT_KPI_QUERY_ROOT });
};

export const useCreateTalentKpiMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TalentKpiCreatePayload) => createTalentKpiRecord(payload),
    onSuccess: async () => {
      await invalidateTalentKpiQueries(queryClient);
    },
  });
};

export const useUpdateTalentKpiDraftCoreMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      talentKpiRecordId,
      payload,
    }: {
      talentKpiRecordId: string;
      payload: TalentKpiDraftCorePayload;
    }) => updateTalentKpiDraftCore(talentKpiRecordId, payload),
    onSuccess: async () => {
      await invalidateTalentKpiQueries(queryClient);
    },
  });
};

export const useReplaceTalentKpiMetricsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      talentKpiRecordId,
      payload,
    }: {
      talentKpiRecordId: string;
      payload: TalentKpiMetricsReplacementPayload;
    }) => replaceTalentKpiMetrics(talentKpiRecordId, payload),
    onSuccess: async () => {
      await invalidateTalentKpiQueries(queryClient);
    },
  });
};

export const useTalentKpiLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      talentKpiRecordId,
      action,
    }: {
      talentKpiRecordId: string;
      action: TalentKpiLifecycleAction;
    }) => performTalentKpiLifecycleAction(talentKpiRecordId, action),
    onSuccess: async () => {
      await invalidateTalentKpiQueries(queryClient);
    },
  });
};
