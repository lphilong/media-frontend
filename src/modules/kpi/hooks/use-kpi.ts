import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approveKpiAllocation,
  createKpiActual,
  createKpiCorrection,
  createKpiPlan,
  fetchKpiAllocations,
  fetchKpiActualDailyGrid,
  fetchKpiActualWorkspacePlanDetail,
  fetchKpiActualWorkspacePlans,
  fetchKpiCorrectionHistory,
  fetchKpiPlanDetail,
  fetchKpiPlans,
  fetchKpiProgress,
  fetchMyKpiProgress,
  markKpiActualExcuse,
  performKpiLifecycleAction,
  publishKpiAllocation,
  rejectKpiAllocation,
  replaceKpiAllocations,
  replaceKpiTargetMetrics,
  submitKpiAllocationDraft,
  unmarkKpiActualExcuse,
  updateKpiActual,
  updateKpiDraftCore,
  upsertKpiAllocationDraft,
} from '@modules/kpi/api/kpi.api';
import type {
  KpiAllocationDraftMemberInput,
  KpiAllocationInput,
  KpiAllocationQuery,
  KpiActualWorkspacePlanQuery,
  KpiCreatePlanPayload,
  KpiDraftCorePayload,
  MarkKpiActualExcusePayload,
  KpiPlanQuery,
  KpiTargetMetricInput,
  UnmarkKpiActualExcusePayload,
} from '@modules/kpi/types/kpi.types';

const KPI_QUERY_ROOT = ['kpi'] as const;

const stableQueryToken = (query: Record<string, string | number | undefined>): string => new URLSearchParams(
  Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => [key, String(value)]),
).toString();

export const kpiQueryKeys = {
  all: () => KPI_QUERY_ROOT,
  list: (query: KpiPlanQuery) => ['kpi', 'plans', stableQueryToken(query)] as const,
  actualWorkspacePlans: (query: KpiActualWorkspacePlanQuery) =>
    ['kpi', 'actual-workspace', 'plans', stableQueryToken(query)] as const,
  actualWorkspacePlanDetail: (kpiPlanId: string) =>
    ['kpi', 'actual-workspace', 'plan', kpiPlanId] as const,
  allocations: (query: KpiAllocationQuery) => ['kpi', 'allocations', stableQueryToken(query)] as const,
  detail: (kpiPlanId: string) => ['kpi', 'plan', kpiPlanId] as const,
  progress: (kpiPlanId: string) => ['kpi', 'progress', kpiPlanId] as const,
  myProgress: (kpiPlanId: string) => ['kpi', 'my-progress', kpiPlanId] as const,
  actualGrid: (kpiPlanId: string, actualDate: string) =>
    ['kpi', 'actual-grid', kpiPlanId, actualDate] as const,
  corrections: (kpiPlanId: string, actualEntryId: string) =>
    ['kpi', 'corrections', kpiPlanId, actualEntryId] as const,
};

const invalidateKpi = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: KPI_QUERY_ROOT });
};

export const useKpiPlans = (query: KpiPlanQuery, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: kpiQueryKeys.list(query),
    queryFn: () => fetchKpiPlans(query),
    enabled: options?.enabled ?? true,
  });

export const useKpiActualWorkspacePlans = (
  query: KpiActualWorkspacePlanQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: kpiQueryKeys.actualWorkspacePlans(query),
    queryFn: () => fetchKpiActualWorkspacePlans(query),
    enabled: options?.enabled ?? true,
  });

export const useKpiActualWorkspacePlanDetail = (kpiPlanId?: string) =>
  useQuery({
    queryKey: kpiPlanId
      ? kpiQueryKeys.actualWorkspacePlanDetail(kpiPlanId)
      : ['kpi', 'actual-workspace', 'plan'],
    queryFn: () => fetchKpiActualWorkspacePlanDetail(kpiPlanId ?? ''),
    enabled: Boolean(kpiPlanId),
  });

export const useKpiAllocations = (query: KpiAllocationQuery) =>
  useQuery({
    queryKey: kpiQueryKeys.allocations(query),
    queryFn: () => fetchKpiAllocations(query),
  });

export const useKpiPlanDetail = (kpiPlanId?: string) =>
  useQuery({
    queryKey: kpiPlanId ? kpiQueryKeys.detail(kpiPlanId) : ['kpi', 'plan'],
    queryFn: () => fetchKpiPlanDetail(kpiPlanId ?? ''),
    enabled: Boolean(kpiPlanId),
  });

export const useKpiProgress = (kpiPlanId?: string, options?: { self?: boolean }) =>
  useQuery({
    queryKey: kpiPlanId
      ? options?.self
        ? kpiQueryKeys.myProgress(kpiPlanId)
        : kpiQueryKeys.progress(kpiPlanId)
      : ['kpi', 'progress'],
    queryFn: () => (options?.self ? fetchMyKpiProgress(kpiPlanId ?? '') : fetchKpiProgress(kpiPlanId ?? '')),
    enabled: Boolean(kpiPlanId),
  });

export const useKpiActualDailyGrid = (
  kpiPlanId: string | undefined,
  actualDate: string | undefined,
) =>
  useQuery({
    queryKey:
      kpiPlanId && actualDate
        ? kpiQueryKeys.actualGrid(kpiPlanId, actualDate)
        : ['kpi', 'actual-grid'],
    queryFn: () => fetchKpiActualDailyGrid(kpiPlanId ?? '', actualDate ?? ''),
    enabled: Boolean(kpiPlanId && actualDate),
  });

export const useKpiCorrectionHistory = (
  kpiPlanId: string | undefined,
  actualEntryId: string | undefined,
) =>
  useQuery({
    queryKey:
      kpiPlanId && actualEntryId
        ? kpiQueryKeys.corrections(kpiPlanId, actualEntryId)
        : ['kpi', 'corrections'],
    queryFn: () => fetchKpiCorrectionHistory(kpiPlanId ?? '', actualEntryId ?? ''),
    enabled: Boolean(kpiPlanId && actualEntryId),
  });

export const useCreateKpiPlanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KpiCreatePlanPayload) => createKpiPlan(payload),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useUpdateKpiDraftCoreMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kpiPlanId, payload }: { kpiPlanId: string; payload: KpiDraftCorePayload }) =>
      updateKpiDraftCore(kpiPlanId, payload),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useReplaceKpiTargetMetricsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kpiPlanId,
      targetMetrics,
    }: {
      kpiPlanId: string;
      targetMetrics: KpiTargetMetricInput[];
    }) => replaceKpiTargetMetrics(kpiPlanId, targetMetrics),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useReplaceKpiAllocationsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kpiPlanId, allocations }: { kpiPlanId: string; allocations: KpiAllocationInput[] }) =>
      replaceKpiAllocations(kpiPlanId, allocations),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useUpsertKpiAllocationDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kpiPlanId,
      allocations,
    }: {
      kpiPlanId: string;
      allocations: KpiAllocationDraftMemberInput[];
    }) => upsertKpiAllocationDraft(kpiPlanId, allocations),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useSubmitKpiAllocationDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kpiPlanId }: { kpiPlanId: string }) => submitKpiAllocationDraft(kpiPlanId),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useApproveKpiAllocationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kpiPlanId, approvalNote }: { kpiPlanId: string; approvalNote?: string | null }) =>
      approveKpiAllocation(kpiPlanId, approvalNote),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useRejectKpiAllocationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kpiPlanId, rejectionReason }: { kpiPlanId: string; rejectionReason: string }) =>
      rejectKpiAllocation(kpiPlanId, rejectionReason),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const usePublishKpiAllocationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kpiPlanId }: { kpiPlanId: string }) => publishKpiAllocation(kpiPlanId),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useKpiLifecycleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kpiPlanId,
      action,
    }: {
      kpiPlanId: string;
      action: 'publish' | 'archive' | 'finalize';
    }) => performKpiLifecycleAction(kpiPlanId, action),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useCreateKpiActualMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKpiActual,
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useUpdateKpiActualMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateKpiActual,
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useMarkKpiActualExcuseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MarkKpiActualExcusePayload) => markKpiActualExcuse(payload),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useUnmarkKpiActualExcuseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UnmarkKpiActualExcusePayload) => unmarkKpiActualExcuse(payload),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useCreateKpiCorrectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKpiCorrection,
    onSuccess: () => invalidateKpi(queryClient),
  });
};
