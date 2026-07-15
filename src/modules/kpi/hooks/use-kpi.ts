import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approveKpiAllocation,
  createKpiActual,
  createKpiCorrection,
  createKpiOrgUnitActual,
  createKpiOrgUnitCorrection,
  createKpiPlan,
  fetchKpiAllocations,
  fetchKpiActualDailyGrid,
  fetchKpiActualWorkspacePlanDetail,
  fetchKpiActualWorkspacePlans,
  fetchKpiCorrectionHistory,
  fetchKpiOrgUnitActualGrid,
  fetchKpiOrgUnitAllocations,
  fetchKpiOrgUnitCorrectionHistory,
  fetchKpiOrgUnitFinalResult,
  fetchKpiOrgUnitManagedMembers,
  fetchKpiOrgUnitProgress,
  fetchKpiPlanDetail,
  fetchKpiPlans,
  fetchKpiProgress,
  fetchMyKpiProgress,
  markKpiActualExcuse,
  markKpiOrgUnitActualExcuse,
  performKpiLifecycleAction,
  publishKpiAllocation,
  rejectKpiAllocation,
  replaceKpiAllocations,
  replaceKpiTargetMetrics,
  submitKpiAllocationDraft,
  unmarkKpiActualExcuse,
  unmarkKpiOrgUnitActualExcuse,
  updateKpiActual,
  updateKpiOrgUnitActual,
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
  KpiOrgUnitAllocationQuery,
  KpiPlanQuery,
  KpiTargetMetricInput,
  UnmarkKpiActualExcusePayload,
} from '@modules/kpi/types/kpi.types';

const KPI_QUERY_ROOT = ['kpi'] as const;

const stableQueryToken = (query: Record<string, string | number | boolean | undefined>): string =>
  new URLSearchParams(
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
  allocations: (query: KpiAllocationQuery) =>
    ['kpi', 'allocations', stableQueryToken(query)] as const,
  orgUnitAllocations: (kpiPlanId: string, query: KpiOrgUnitAllocationQuery) =>
    ['kpi', 'org-unit-allocations', kpiPlanId, stableQueryToken(query)] as const,
  detail: (kpiPlanId: string) => ['kpi', 'plan', kpiPlanId] as const,
  progress: (kpiPlanId: string) => ['kpi', 'progress', kpiPlanId] as const,
  orgUnitProgress: (kpiPlanId: string) => ['kpi', 'org-unit-progress', kpiPlanId] as const,
  orgUnitManagedMembers: (kpiPlanId: string, query: { search?: string; limit?: number }) =>
    ['kpi', 'org-unit-managed-members', kpiPlanId, stableQueryToken(query)] as const,
  orgUnitFinalResult: (kpiPlanId: string) => ['kpi', 'org-unit-final-result', kpiPlanId] as const,
  myProgress: (kpiPlanId: string) => ['kpi', 'my-progress', kpiPlanId] as const,
  actualGrid: (kpiPlanId: string, actualDate: string) =>
    ['kpi', 'actual-grid', kpiPlanId, actualDate] as const,
  orgUnitActualGrid: (kpiPlanId: string, actualDate: string) =>
    ['kpi', 'org-unit-actual-grid', kpiPlanId, actualDate] as const,
  corrections: (kpiPlanId: string, actualEntryId: string) =>
    ['kpi', 'corrections', kpiPlanId, actualEntryId] as const,
  orgUnitCorrections: (kpiPlanId: string, actualEntryId: string) =>
    ['kpi', 'org-unit-corrections', kpiPlanId, actualEntryId] as const,
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

export const useKpiOrgUnitAllocations = (
  kpiPlanId: string | undefined,
  query: KpiOrgUnitAllocationQuery = {},
) =>
  useQuery({
    queryKey: kpiPlanId
      ? kpiQueryKeys.orgUnitAllocations(kpiPlanId, query)
      : ['kpi', 'org-unit-allocations'],
    queryFn: () => fetchKpiOrgUnitAllocations(kpiPlanId ?? '', query),
    enabled: Boolean(kpiPlanId),
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
    queryFn: () =>
      options?.self ? fetchMyKpiProgress(kpiPlanId ?? '') : fetchKpiProgress(kpiPlanId ?? ''),
    enabled: Boolean(kpiPlanId),
  });

export const useKpiOrgUnitProgress = (kpiPlanId?: string) =>
  useQuery({
    queryKey: kpiPlanId ? kpiQueryKeys.orgUnitProgress(kpiPlanId) : ['kpi', 'org-unit-progress'],
    queryFn: () => fetchKpiOrgUnitProgress(kpiPlanId ?? ''),
    enabled: Boolean(kpiPlanId),
  });

export const useKpiOrgUnitManagedMembers = (
  kpiPlanId: string | undefined,
  query: { search?: string; limit?: number } = {},
) =>
  useQuery({
    queryKey: kpiPlanId
      ? kpiQueryKeys.orgUnitManagedMembers(kpiPlanId, query)
      : ['kpi', 'org-unit-managed-members'],
    queryFn: () => fetchKpiOrgUnitManagedMembers(kpiPlanId ?? '', query),
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

export const useKpiOrgUnitActualGrid = (
  kpiPlanId: string | undefined,
  actualDate: string | undefined,
) =>
  useQuery({
    queryKey:
      kpiPlanId && actualDate
        ? kpiQueryKeys.orgUnitActualGrid(kpiPlanId, actualDate)
        : ['kpi', 'org-unit-actual-grid'],
    queryFn: () => fetchKpiOrgUnitActualGrid(kpiPlanId ?? '', actualDate ?? ''),
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

export const useKpiOrgUnitCorrectionHistory = (
  kpiPlanId: string | undefined,
  actualEntryId: string | undefined,
) =>
  useQuery({
    queryKey:
      kpiPlanId && actualEntryId
        ? kpiQueryKeys.orgUnitCorrections(kpiPlanId, actualEntryId)
        : ['kpi', 'org-unit-corrections'],
    queryFn: () => fetchKpiOrgUnitCorrectionHistory(kpiPlanId ?? '', actualEntryId ?? ''),
    enabled: Boolean(kpiPlanId && actualEntryId),
  });

export const useKpiOrgUnitFinalResult = (kpiPlanId?: string) =>
  useQuery({
    queryKey: kpiPlanId
      ? kpiQueryKeys.orgUnitFinalResult(kpiPlanId)
      : ['kpi', 'org-unit-final-result'],
    queryFn: () => fetchKpiOrgUnitFinalResult(kpiPlanId ?? ''),
    enabled: Boolean(kpiPlanId),
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
    mutationFn: ({
      kpiPlanId,
      allocations,
    }: {
      kpiPlanId: string;
      allocations: KpiAllocationInput[];
    }) => replaceKpiAllocations(kpiPlanId, allocations),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useUpsertKpiAllocationDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kpiPlanId,
      allocations,
      identity,
    }: {
      kpiPlanId: string;
      allocations: KpiAllocationDraftMemberInput[];
      identity?: Parameters<typeof upsertKpiAllocationDraft>[2];
    }) => upsertKpiAllocationDraft(kpiPlanId, allocations, identity),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useSubmitKpiAllocationDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kpiPlanId,
      identity,
    }: {
      kpiPlanId: string;
      identity?: Parameters<typeof submitKpiAllocationDraft>[1];
    }) => submitKpiAllocationDraft(kpiPlanId, identity),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useApproveKpiAllocationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kpiPlanId,
      approvalNote,
      identity,
    }: {
      kpiPlanId: string;
      approvalNote?: string | null;
      identity?: Parameters<typeof approveKpiAllocation>[2];
    }) => approveKpiAllocation(kpiPlanId, approvalNote, identity),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const useRejectKpiAllocationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kpiPlanId,
      rejectionReason,
      identity,
    }: {
      kpiPlanId: string;
      rejectionReason: string;
      identity?: Parameters<typeof rejectKpiAllocation>[2];
    }) => rejectKpiAllocation(kpiPlanId, rejectionReason, identity),
    onSuccess: () => invalidateKpi(queryClient),
  });
};

export const usePublishKpiAllocationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kpiPlanId,
      identity,
    }: {
      kpiPlanId: string;
      identity?: Parameters<typeof publishKpiAllocation>[1];
    }) => publishKpiAllocation(kpiPlanId, identity),
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

export const useCreateKpiOrgUnitActualMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKpiOrgUnitActual,
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

export const useUpdateKpiOrgUnitActualMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateKpiOrgUnitActual,
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

export const useMarkKpiOrgUnitActualExcuseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MarkKpiActualExcusePayload) => markKpiOrgUnitActualExcuse(payload),
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

export const useUnmarkKpiOrgUnitActualExcuseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UnmarkKpiActualExcusePayload) => unmarkKpiOrgUnitActualExcuse(payload),
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

export const useCreateKpiOrgUnitCorrectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createKpiOrgUnitCorrection,
    onSuccess: () => invalidateKpi(queryClient),
  });
};
