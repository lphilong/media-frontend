import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { createKpiActionCapabilityHint } from '@modules/kpi/capability-hints';
import {
  formatKpiMetricInput,
  formatKpiNumber,
  isStrictKpiDate,
  parseKpiMetricInput,
} from '@modules/kpi/formatting/kpi-formatting';
import {
  useCreateKpiActualMutation,
  useCreateKpiCorrectionMutation,
  useKpiAllocations,
  useCreateKpiPlanMutation,
  useKpiActualDailyGrid,
  useKpiActualWorkspacePlanDetail,
  useKpiActualWorkspacePlans,
  useKpiCorrectionHistory,
  useKpiPlans,
  useMarkKpiActualExcuseMutation,
  useUnmarkKpiActualExcuseMutation,
  useUpdateKpiActualMutation,
} from '@modules/kpi/hooks/use-kpi';
import type {
  KpiActualEntryStatusSummary,
  KpiActualExcuseReasonCode,
  KpiActualExcuseStatus,
  KpiActualGridMetricCell,
  KpiActualGridRow,
  KpiActualWorkspaceMetricSummary,
  KpiActualWorkspaceMissingSignal,
  KpiActualWorkspacePlanQuery,
  KpiActualWorkspacePlanSummary,
  KpiAllocation,
  KpiCreatePlanPayload,
  KpiMetricCode,
  KpiPlanQuery,
} from '@modules/kpi/types/kpi.types';
import {
  kpiActualExcuseReasonCodes,
  kpiCreateSubjectTypes,
  kpiMetricCodes,
  kpiMetricsBySubjectType,
  kpiPlanStatuses,
  kpiSubjectTypes,
} from '@modules/kpi/types/kpi.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ErrorState,
  LoadingState,
  PageContainer,
  PermissionDeniedState,
  useMutationFeedback,
} from '@shared/components/primitives';
import { formatKpiDateTime } from '@modules/kpi/formatting/kpi-formatting';
import {
  hasScopeGrant,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import { ReferenceFilterField } from '@shared/components/reference';
import {
  loadOrgUnitReferenceOptions,
  loadTalentGroupReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';

type TargetDraft = {
  metricCode: KpiMetricCode;
  value: string;
};

type CorrectionTarget = {
  row: KpiActualGridRow;
  cell: KpiActualGridMetricCell;
  proposedValue?: string;
};

type ExcuseDraft = {
  cellKey: string;
  allocationId: string;
  metricCode: KpiMetricCode;
  status: KpiActualExcuseStatus;
  reasonCode: KpiActualExcuseReasonCode | '';
  reasonText: string;
};

type AllocationWorkflowSummary = {
  total: number;
  byStatus: {
    draft: number;
    pendingApproval: number;
    approved: number;
    published: number;
    rejected: number;
    active: number;
    closed: number;
    cancelled: number;
  };
  officialPublishedCount: number;
};

const allocationWorkflowStatusEntries: Array<{
  key: keyof AllocationWorkflowSummary['byStatus'];
  labelKey: string;
}> = [
  { key: 'draft', labelKey: 'kpi:allocationWorkflow.draft' },
  { key: 'pendingApproval', labelKey: 'kpi:allocationWorkflow.pendingApproval' },
  { key: 'approved', labelKey: 'kpi:allocationWorkflow.approved' },
  { key: 'published', labelKey: 'kpi:allocationWorkflow.published' },
  { key: 'rejected', labelKey: 'kpi:allocationWorkflow.rejected' },
  { key: 'active', labelKey: 'kpi:allocationWorkflow.legacyActive' },
  { key: 'closed', labelKey: 'kpi:allocationWorkflow.closed' },
  { key: 'cancelled', labelKey: 'kpi:allocationWorkflow.cancelled' },
];

type AdminWorkspaceTab = 'plans' | 'approvalQueue' | 'progressActuals';
type AllocationQueueView =
  | 'actionNeeded'
  | 'pendingApproval'
  | 'readyToPublish'
  | 'published'
  | 'rejected';

const adminWorkspaceTabs: AdminWorkspaceTab[] = ['plans', 'approvalQueue', 'progressActuals'];
const allocationQueueViews: AllocationQueueView[] = [
  'actionNeeded',
  'pendingApproval',
  'readyToPublish',
  'published',
  'rejected',
];
const actualWorkspacePageLimit = 50;

const readActualWorkspaceSortBy = (
  searchParams: URLSearchParams,
): KpiActualWorkspacePlanQuery['sortBy'] => {
  const value = searchParams.get('sortBy');
  return value === 'periodMonth' ||
    value === 'planCode' ||
    value === 'revenueActual' ||
    value === 'achievementPercent'
    ? value
    : 'periodMonth';
};

const readActualWorkspaceSortDirection = (
  searchParams: URLSearchParams,
): KpiActualWorkspacePlanQuery['sortDirection'] => {
  const value = searchParams.get('sortDirection')?.toUpperCase();
  return value === 'ASC' || value === 'DESC' ? value : 'DESC';
};

const readActualWorkspaceAllocationCoverage = (
  searchParams: URLSearchParams,
): KpiActualWorkspacePlanQuery['allocationCoverage'] => {
  const value = searchParams.get('allocationCoverage');
  return value === 'complete' || value === 'incomplete' ? value : undefined;
};

const readActualWorkspaceBooleanFilter = (
  searchParams: URLSearchParams,
  key: 'hasOverdueActuals' | 'hasPendingActuals',
): boolean | undefined => {
  const value = searchParams.get(key);
  return value === 'true' ? true : value === 'false' ? false : undefined;
};

const defaultTargets: TargetDraft[] = [{ metricCode: 'REVENUE_VND', value: '1.000.000' }];

const normalizeTargetDrafts = (
  current: TargetDraft[],
  allowedMetricCodes: readonly KpiMetricCode[],
): TargetDraft[] => {
  const allowed = new Set<KpiMetricCode>(allowedMetricCodes);
  const seen = new Set<KpiMetricCode>();
  const kept = current.filter((target) => {
    if (!allowed.has(target.metricCode) || seen.has(target.metricCode)) {
      return false;
    }
    seen.add(target.metricCode);
    return true;
  });

  return kept.length > 0
    ? kept
    : [{ metricCode: allowedMetricCodes[0] ?? 'REVENUE_VND', value: '0' }];
};

const metricOptionsForRow = (
  targets: TargetDraft[],
  rowIndex: number,
  allowedMetricCodes: readonly KpiMetricCode[],
): KpiMetricCode[] => {
  const selectedByOtherRows = new Set(
    targets.filter((_, index) => index !== rowIndex).map((target) => target.metricCode),
  );

  return allowedMetricCodes.filter(
    (metricCode) =>
      metricCode === targets[rowIndex]?.metricCode || !selectedByOtherRows.has(metricCode),
  );
};

const readPlanQuery = (searchParams: URLSearchParams): KpiPlanQuery => {
  const subjectType = searchParams.get('subjectType');
  const status = searchParams.get('status');
  const metricCode = searchParams.get('metricCode');
  return {
    search: searchParams.get('search') || undefined,
    subjectType: kpiSubjectTypes.includes(subjectType as never)
      ? (subjectType as never)
      : undefined,
    subjectId: searchParams.get('subjectId') || undefined,
    groupId: searchParams.get('groupId') || undefined,
    periodMonth: searchParams.get('periodMonth') || undefined,
    status: kpiPlanStatuses.includes(status as never) ? (status as never) : undefined,
    metricCode: kpiMetricCodes.includes(metricCode as never) ? (metricCode as never) : undefined,
    limit: 50,
  };
};

const toMonthBounds = (periodMonth: string): { start: number; end: number } | undefined => {
  const match = /^(\d{4})-(\d{2})$/.exec(periodMonth);
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return undefined;
  }
  return {
    start: Date.UTC(year, month - 1, 1, -7, 0, 0, 0),
    end: Date.UTC(year, month, 1, -7, 0, 0, 0) - 1,
  };
};

const currentHcmMonth = (now = Date.now()): string => {
  const local = new Date(now + 7 * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
};

const currentHcmDate = (now = Date.now()): string => {
  const local = new Date(now + 7 * 60 * 60 * 1000);
  return `${String(local.getUTCDate()).padStart(2, '0')}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${local.getUTCFullYear()}`;
};

const formatPeriodMonth = (value: string | null | undefined): string => {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  return match ? `${match[2]}-${match[1]}` : (value ?? '-');
};

const readErrorMessage = (
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  if (!error?.message) {
    return t(fallbackKey);
  }
  return error.message.includes(':') ? t(error.message) : error.message;
};

const readKpiSafeErrorMessage = (
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  const message = error?.message ?? '';
  const normalized = message.toLowerCase();
  if (
    normalized.includes('use direct edit before cutoff') ||
    normalized.includes('allowed only after the direct edit window')
  ) {
    return t('kpi:errors.correctionDirectEditWindow');
  }
  if (normalized.includes('active excuse') || normalized.includes('not-required')) {
    return t('kpi:errors.correctionActiveExcuse');
  }
  if (normalized.includes('finalized kpi') || normalized.includes('plan_finalized')) {
    return t('kpi:errors.finalizedReadOnly');
  }
  return readErrorMessage(t, error, fallbackKey);
};

const isConflict = (error: unknown): boolean => {
  const apiError = error as NormalizedApiError | undefined;
  return apiError?.status === 409;
};

export const KpiListPage = (): JSX.Element => {
  const { t } = useTranslation(['kpi', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => readPlanQuery(searchParams), [searchParams]);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const createMutation = useCreateKpiPlanMutation();

  const [activeTab, setActiveTab] = useState<'management' | 'group' | 'my'>('management');
  const [adminWorkspaceTab, setAdminWorkspaceTab] = useState<AdminWorkspaceTab>('plans');
  const [allocationQueueView, setAllocationQueueView] =
    useState<AllocationQueueView>('actionNeeded');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSubjectType, setCreateSubjectType] = useState<'TALENT_GROUP' | 'ORG_UNIT'>(
    'TALENT_GROUP',
  );
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('May KPI plan');
  const [periodMonth, setPeriodMonth] = useState(() => currentHcmMonth());
  const [description, setDescription] = useState('');
  const [targets, setTargets] = useState<TargetDraft[]>(defaultTargets);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedWorkspacePlanId, setSelectedWorkspacePlanId] = useState<string>();
  const [actualDate, setActualDate] = useState(() => currentHcmDate());
  const [loadedActualGrid, setLoadedActualGrid] = useState<{
    kpiPlanId: string;
    actualDate: string;
  }>();
  const [actualWorkspaceCursor, setActualWorkspaceCursor] = useState<string>();
  const [actualWorkspaceNextCursor, setActualWorkspaceNextCursor] = useState<string>();
  const [actualWorkspacePages, setActualWorkspacePages] = useState<KpiActualWorkspacePlanSummary[]>(
    [],
  );
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const [actualError, setActualError] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<CorrectionTarget | null>(null);
  const [excuseDraft, setExcuseDraft] = useState<ExcuseDraft | null>(null);

  const actualGridQuery = useKpiActualDailyGrid(
    loadedActualGrid?.kpiPlanId,
    loadedActualGrid?.actualDate,
  );
  const createActualMutation = useCreateKpiActualMutation();
  const updateActualMutation = useUpdateKpiActualMutation();
  const markActualExcuseMutation = useMarkKpiActualExcuseMutation();
  const unmarkActualExcuseMutation = useUnmarkKpiActualExcuseMutation();
  const capabilityCopy = useMemo(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      unavailable: 'KPI permissions could not be verified. Try again.',
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );
  const capabilityState = {
    capabilities: capabilitiesQuery.data,
    isLoading: capabilitiesQuery.isLoading,
    isError: capabilitiesQuery.isError,
  };
  const createPlanHint = createKpiActionCapabilityHint(
    capabilityState,
    'createPlan',
    capabilityCopy,
  );
  const enterActualHint = createKpiActionCapabilityHint(
    capabilityState,
    'enterActual',
    capabilityCopy,
  );
  const correctActualHint = createKpiActionCapabilityHint(
    capabilityState,
    'correctActual',
    capabilityCopy,
  );
  const approveAllocationHint = createKpiActionCapabilityHint(
    capabilityState,
    'approveAllocation',
    capabilityCopy,
  );
  const publishAllocationHint = createKpiActionCapabilityHint(
    capabilityState,
    'publishAllocation',
    capabilityCopy,
  );
  const pendingAllocationQueueQuery = useKpiAllocations({
    status: 'PENDING_APPROVAL',
    limit: 50,
  });
  const approvedAllocationQueueQuery = useKpiAllocations({ status: 'APPROVED', limit: 50 });
  const publishedAllocationQueueQuery = useKpiAllocations({ status: 'PUBLISHED', limit: 50 });
  const rejectedAllocationQueueQuery = useKpiAllocations({ status: 'REJECTED', limit: 50 });
  const hasGlobalKpiScope = hasScopeGrant(capabilitiesQuery.data, 'kpi', 'global');
  const hasManagedGroupKpiScope = hasScopeGrant(capabilitiesQuery.data, 'kpi', 'managedGroup');
  const visibleTabs = useMemo(
    () =>
      [
        hasGlobalKpiScope ? 'management' : undefined,
        hasManagedGroupKpiScope ? 'group' : undefined,
      ].filter((tab): tab is 'management' | 'group' => Boolean(tab)),
    [hasGlobalKpiScope, hasManagedGroupKpiScope],
  );
  const selectedTab: 'management' | 'group' | undefined = visibleTabs.includes(
    activeTab as 'management' | 'group',
  )
    ? (activeTab as 'management' | 'group')
    : visibleTabs[0];
  const isManagedGroupKpiView = selectedTab === 'group';
  const canShowCreatePlan = createPlanHint.allowed;
  const canShowActualEntrySurface = enterActualHint.allowed || correctActualHint.allowed;
  const canShowAllocationApprovalQueue =
    approveAllocationHint.allowed || publishAllocationHint.allowed;
  const visibleAdminWorkspaceTabs = useMemo(
    () =>
      adminWorkspaceTabs.filter((tab) => {
        if (tab === 'approvalQueue') {
          return canShowAllocationApprovalQueue;
        }
        if (tab === 'progressActuals') {
          return canShowActualEntrySurface;
        }
        return true;
      }),
    [canShowActualEntrySurface, canShowAllocationApprovalQueue],
  );
  const effectiveQuery = useMemo<KpiPlanQuery>(
    () =>
      isManagedGroupKpiView
        ? {
            ...query,
            subjectId: undefined,
            status: 'PUBLISHED',
            subjectType: 'TALENT_GROUP',
          }
        : query,
    [isManagedGroupKpiView, query],
  );
  const plansQuery = useKpiPlans(effectiveQuery, { enabled: visibleTabs.length > 0 });
  const actualWorkspaceAllocationCoverage = useMemo(
    () => readActualWorkspaceAllocationCoverage(searchParams),
    [searchParams],
  );
  const actualWorkspaceSortBy = useMemo(
    () => readActualWorkspaceSortBy(searchParams),
    [searchParams],
  );
  const actualWorkspaceSortDirection = useMemo(
    () => readActualWorkspaceSortDirection(searchParams),
    [searchParams],
  );
  const actualWorkspaceHasOverdueActuals = useMemo(
    () => readActualWorkspaceBooleanFilter(searchParams, 'hasOverdueActuals'),
    [searchParams],
  );
  const actualWorkspaceHasPendingActuals = useMemo(
    () => readActualWorkspaceBooleanFilter(searchParams, 'hasPendingActuals'),
    [searchParams],
  );
  const actualWorkspaceBaseQuery = useMemo<KpiActualWorkspacePlanQuery>(
    () => ({
      search: query.search,
      periodMonth: query.periodMonth,
      subjectId: query.subjectType === 'TALENT_GROUP' ? query.subjectId : undefined,
      groupId: query.groupId,
      allocationCoverage: actualWorkspaceAllocationCoverage,
      hasOverdueActuals: actualWorkspaceHasOverdueActuals,
      hasPendingActuals: actualWorkspaceHasPendingActuals,
      limit: actualWorkspacePageLimit,
      sortBy: actualWorkspaceSortBy,
      sortDirection: actualWorkspaceSortDirection,
    }),
    [
      actualWorkspaceAllocationCoverage,
      actualWorkspaceHasOverdueActuals,
      actualWorkspaceHasPendingActuals,
      actualWorkspaceSortBy,
      actualWorkspaceSortDirection,
      query.groupId,
      query.periodMonth,
      query.search,
      query.subjectId,
      query.subjectType,
    ],
  );
  const actualWorkspaceQueryShape = useMemo(
    () =>
      new URLSearchParams(
        Object.entries(actualWorkspaceBaseQuery)
          .filter(([, value]) => value !== undefined && value !== '')
          .map(([key, value]) => [key, String(value)]),
      ).toString(),
    [actualWorkspaceBaseQuery],
  );
  const actualWorkspacePlansQuery = useKpiActualWorkspacePlans(
    { ...actualWorkspaceBaseQuery, cursor: actualWorkspaceCursor },
    {
      enabled:
        selectedTab === 'management' &&
        adminWorkspaceTab === 'progressActuals' &&
        canShowActualEntrySurface,
    },
  );
  const actualWorkspaceDetailQuery = useKpiActualWorkspacePlanDetail(selectedWorkspacePlanId);
  const actualWorkspacePlans = actualWorkspacePages;
  const availableCreateMetricCodes = useMemo(
    () => [...kpiMetricsBySubjectType[createSubjectType]],
    [createSubjectType],
  );
  const canAddMetric = targets.length < availableCreateMetricCodes.length;

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab as 'management' | 'group')) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (
      selectedTab === 'management' &&
      visibleAdminWorkspaceTabs.length > 0 &&
      !visibleAdminWorkspaceTabs.includes(adminWorkspaceTab)
    ) {
      setAdminWorkspaceTab(visibleAdminWorkspaceTabs[0]);
    }
  }, [adminWorkspaceTab, selectedTab, visibleAdminWorkspaceTabs]);

  useEffect(() => {
    setActualWorkspaceCursor(undefined);
    setActualWorkspaceNextCursor(undefined);
    setActualWorkspacePages([]);
    setSelectedWorkspacePlanId(undefined);
    setLoadedActualGrid(undefined);
    setCellDrafts({});
    setActualError(null);
    setCorrectionTarget(null);
    setExcuseDraft(null);
  }, [actualWorkspaceQueryShape]);

  useEffect(() => {
    const page = actualWorkspacePlansQuery.data;
    if (!page) {
      return;
    }
    setActualWorkspaceNextCursor(page.meta?.nextCursor);
    setActualWorkspacePages((current) => {
      if (!actualWorkspaceCursor) {
        return page.data;
      }
      const seen = new Set(current.map((plan) => plan.planId));
      return [...current, ...page.data.filter((plan) => !seen.has(plan.planId))];
    });
  }, [actualWorkspaceCursor, actualWorkspacePlansQuery.data]);

  useEffect(() => {
    setTargets((current) => {
      return normalizeTargetDrafts(current, availableCreateMetricCodes);
    });
  }, [availableCreateMetricCodes]);

  const patchQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      });
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const parsedTargets = useMemo(() => {
    const result = targets.map((target) => ({
      metricCode: target.metricCode,
      targetValue: parseKpiMetricInput(target.metricCode, target.value),
    }));
    return result.every((item) => item.targetValue !== undefined)
      ? result.map((item) => ({
          metricCode: item.metricCode,
          targetValue: item.targetValue ?? 0,
        }))
      : undefined;
  }, [targets]);

  const submitCreate = async (): Promise<void> => {
    setFormError(null);
    if (createPlanHint.disabled) {
      setFormError(createPlanHint.disabledReason ?? capabilityCopy.unavailable);
      return;
    }
    const bounds = toMonthBounds(periodMonth);
    if (!bounds) {
      setFormError(t('kpi:validation.invalidPeriodMonth'));
      return;
    }
    const minPeriodMonth = currentHcmMonth();
    if (periodMonth < minPeriodMonth) {
      setFormError(t('kpi:validation.pastPeriodMonth'));
      return;
    }
    if (!parsedTargets) {
      setFormError(t('kpi:validation.invalidMetricValue'));
      return;
    }
    if (new Set(parsedTargets.map((target) => target.metricCode)).size !== parsedTargets.length) {
      setFormError(t('kpi:validation.duplicateMetric'));
      return;
    }

    const payload: KpiCreatePlanPayload = {
      title,
      description: description.trim() || null,
      subjectType: createSubjectType,
      subjectId,
      currencyCode: 'VND',
      periodMonth,
      periodStartAt: bounds.start,
      periodEndAt: bounds.end,
      timezone: 'Asia/Ho_Chi_Minh',
      targetMetrics: parsedTargets,
      externalRef: null,
    };

    try {
      await createMutation.mutateAsync(payload);
      notifySuccess('kpi:feedback.created');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const cellKey = (row: KpiActualGridRow, cell: KpiActualGridMetricCell): string =>
    `${row.allocationId}:${cell.metricCode}`;

  const openExcuseDraft = (
    row: KpiActualGridRow,
    cell: KpiActualGridMetricCell,
    status: KpiActualExcuseStatus,
  ): void => {
    setActualError(null);
    setExcuseDraft({
      cellKey: cellKey(row, cell),
      allocationId: row.allocationId,
      metricCode: cell.metricCode,
      status,
      reasonCode: '',
      reasonText: '',
    });
  };

  const submitExcuseDraft = async (): Promise<void> => {
    setActualError(null);
    if (!loadedActualGrid?.kpiPlanId || !excuseDraft) {
      return;
    }
    if (!excuseDraft.reasonCode || !excuseDraft.reasonText.trim()) {
      setActualError(t('kpi:validation.excuseReasonRequired'));
      return;
    }
    try {
      await markActualExcuseMutation.mutateAsync({
        kpiPlanId: loadedActualGrid.kpiPlanId,
        allocationId: excuseDraft.allocationId,
        metricCode: excuseDraft.metricCode,
        actualDate: loadedActualGrid.actualDate,
        status: excuseDraft.status,
        reasonCode: excuseDraft.reasonCode,
        reasonText: excuseDraft.reasonText,
      });
      setExcuseDraft(null);
      setCellDrafts({});
      notifySuccess('kpi:feedback.actualExcuseMarked');
    } catch (error) {
      setActualError(
        readErrorMessage(
          t,
          error as NormalizedApiError,
          'kpi:states.actualExcuseMutationErrorMessage',
        ),
      );
    }
  };

  const unmarkExcuse = async (cell: KpiActualGridMetricCell): Promise<void> => {
    setActualError(null);
    if (!loadedActualGrid?.kpiPlanId || !cell.actualExcuse) {
      return;
    }
    try {
      await unmarkActualExcuseMutation.mutateAsync({
        kpiPlanId: loadedActualGrid.kpiPlanId,
        excuseId: cell.actualExcuse.id,
      });
      setExcuseDraft(null);
      setCellDrafts({});
      notifySuccess('kpi:feedback.actualExcuseUnmarked');
    } catch (error) {
      setActualError(
        readErrorMessage(
          t,
          error as NormalizedApiError,
          'kpi:states.actualExcuseMutationErrorMessage',
        ),
      );
    }
  };

  const saveActuals = async (): Promise<void> => {
    setActualError(null);
    if (enterActualHint.disabled) {
      setActualError(enterActualHint.disabledReason ?? capabilityCopy.unavailable);
      return;
    }
    if (!isStrictKpiDate(actualDate)) {
      setActualError(t('kpi:validation.invalidActualDate'));
      return;
    }
    const grid = actualGridQuery.data;
    if (!grid) {
      return;
    }

    for (const row of grid.rows) {
      for (const cell of row.metrics) {
        const draft = cellDrafts[cellKey(row, cell)];
        if (draft === undefined) {
          continue;
        }
        const parsed = parseKpiMetricInput(cell.metricCode, draft);
        if (parsed === undefined) {
          setActualError(t('kpi:validation.invalidMetricValue'));
          return;
        }
        try {
          if (!cell.hasEntry) {
            await createActualMutation.mutateAsync({
              kpiPlanId: grid.kpiPlanId,
              allocationId: row.allocationId,
              metricCode: cell.metricCode,
              actualDate: grid.actualDate,
              actualValue: parsed,
            });
          } else if (cell.canDirectEdit && !cell.requiresCorrection && cell.actualEntryId) {
            await updateActualMutation.mutateAsync({
              kpiPlanId: grid.kpiPlanId,
              actualEntryId: cell.actualEntryId,
              actualValue: parsed,
            });
          } else if (cell.actualEntryId) {
            if (correctActualHint.disabled) {
              setActualError(correctActualHint.disabledReason ?? capabilityCopy.unavailable);
              return;
            }
            setCorrectionTarget({ row, cell, proposedValue: draft });
            return;
          }
        } catch (error) {
          if (isConflict(error)) {
            setActualError(
              readErrorMessage(t, error as NormalizedApiError, 'kpi:validation.duplicateConflict'),
            );
          } else {
            notifyError(error as NormalizedApiError);
          }
          return;
        }
      }
    }
    setCellDrafts({});
    notifySuccess('kpi:feedback.actualSaved');
  };

  const loadActualGrid = (): void => {
    setActualError(null);
    if (
      !selectedWorkspacePlanId ||
      !actualWorkspaceDetailQuery.data?.actionHints.canReadActualGrid
    ) {
      return;
    }
    if (!isStrictKpiDate(actualDate)) {
      setActualError(t('kpi:validation.invalidActualDate'));
      return;
    }
    const next = { kpiPlanId: selectedWorkspacePlanId, actualDate };
    if (
      loadedActualGrid?.kpiPlanId === next.kpiPlanId &&
      loadedActualGrid.actualDate === next.actualDate
    ) {
      void actualGridQuery.refetch();
      return;
    }
    setCellDrafts({});
    setExcuseDraft(null);
    setLoadedActualGrid(next);
  };

  const listError = plansQuery.error as NormalizedApiError | null;
  const renderAllocationWorkflowSummary = (summary: AllocationWorkflowSummary) => {
    if (summary.total === 0) {
      return (
        <span className="inline-flex rounded border border-dashed border-border px-2 py-1 text-xs text-muted">
          {t('kpi:allocationWorkflow.noAllocations')}
        </span>
      );
    }

    const nonzeroStatuses = allocationWorkflowStatusEntries.filter(
      (entry) =>
        summary.byStatus[entry.key] > 0 &&
        !(entry.key === 'published' && summary.officialPublishedCount > 0),
    );

    return (
      <div
        className="flex max-w-[320px] flex-wrap gap-1"
        aria-label={t('kpi:allocationWorkflow.title')}
      >
        {nonzeroStatuses.map((entry) => (
          <span
            key={entry.key}
            className="inline-flex items-center gap-1 rounded border border-border bg-slate-50 px-2 py-1 text-xs"
          >
            <span>{t(entry.labelKey)}</span>
            <span className="font-semibold">{summary.byStatus[entry.key]}</span>
          </span>
        ))}
        {summary.officialPublishedCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
            <span>{t('kpi:allocationWorkflow.officialPublished')}</span>
            <span className="font-semibold">{summary.officialPublishedCount}</span>
          </span>
        ) : null}
      </div>
    );
  };

  const formatAchievement = (value: number | null): string => (value === null ? '-' : `${value}%`);

  const renderAllocationCoverage = ({
    publishedAllocationCount,
    totalAllocationCount,
  }: {
    publishedAllocationCount: number;
    totalAllocationCount: number;
  }): string =>
    totalAllocationCount === 0
      ? t('kpi:actualWorkspace.noAllocations')
      : `${publishedAllocationCount}/${totalAllocationCount}`;

  const renderMissingSignal = (missingSignal: KpiActualWorkspaceMissingSignal): string =>
    `${missingSignal.count} - ${t('kpi:actualWorkspace.limitedMissingSignal')}`;

  const renderActualEntryStatusSummary = (summary: KpiActualEntryStatusSummary) => {
    const entries: Array<[string, number]> = [
      ['dueOpen', summary.pendingEntryCount],
      ['overdue', summary.overdueEntryCount],
      ['entered', summary.enteredEntryCount],
      ['enteredZero', summary.enteredZeroCount],
      ['excused', summary.excusedEntryCount],
      ['notRequired', summary.notRequiredEntryCount],
      ['notDue', summary.notDueEntryCount],
    ];
    return (
      <div className="flex flex-wrap gap-1" aria-label={t('kpi:actualWorkspace.statusSummary')}>
        {entries
          .filter(([, count]) => count > 0)
          .map(([key, count]) => (
            <span key={key} className="rounded border border-border px-2 py-0.5 text-xs">
              {t(`kpi:actualStatusSummary.${key}`)}: {count}
            </span>
          ))}
        {summary.expectedEntryCount === 0 ? (
          <span className="text-xs text-muted">{t('kpi:actualStatusSummary.none')}</span>
        ) : null}
      </div>
    );
  };

  const actualStatusClassName = (status: KpiActualGridMetricCell['dailyActualStatus']): string => {
    if (status === 'OVERDUE') return 'border-danger bg-red-50 text-danger';
    if (status === 'ENTERED') return 'border-emerald-600 bg-emerald-50 text-emerald-700';
    if (status === 'ENTERED_ZERO') return 'border-amber-600 bg-amber-50 text-amber-700';
    if (status === 'EXCUSED' || status === 'NOT_REQUIRED') {
      return 'border-sky-600 bg-sky-50 text-sky-700';
    }
    if (status === 'DUE_OPEN') return 'border-accent bg-accent/10 text-accent';
    return 'border-border bg-slate-50 text-muted';
  };

  const renderSupportingMetrics = (metrics: KpiActualWorkspaceMetricSummary[]) =>
    metrics.length === 0
      ? '-'
      : metrics.map((metric) => (
          <div key={metric.metricCode}>
            {t(`kpi:metricCodes.${metric.metricCode}`)}:{' '}
            {formatKpiNumber(metric.metricCode, metric.actualValue)}/
            {formatKpiNumber(metric.metricCode, metric.targetValue)} (
            {formatAchievement(metric.achievementPercent)})
          </div>
        ));

  const queueQueryByStatus: Record<
    Exclude<AllocationQueueView, 'actionNeeded'>,
    typeof pendingAllocationQueueQuery
  > = {
    pendingApproval: pendingAllocationQueueQuery,
    readyToPublish: approvedAllocationQueueQuery,
    published: publishedAllocationQueueQuery,
    rejected: rejectedAllocationQueueQuery,
  };
  const actionNeededQueueData = useMemo<KpiAllocation[] | undefined>(() => {
    if (!pendingAllocationQueueQuery.data || !approvedAllocationQueueQuery.data) {
      return undefined;
    }
    return [...pendingAllocationQueueQuery.data, ...approvedAllocationQueueQuery.data];
  }, [approvedAllocationQueueQuery.data, pendingAllocationQueueQuery.data]);
  const allocationQueueData =
    allocationQueueView === 'actionNeeded'
      ? actionNeededQueueData
      : queueQueryByStatus[allocationQueueView].data;
  const allocationQueueIsPending =
    allocationQueueView === 'actionNeeded'
      ? pendingAllocationQueueQuery.isPending || approvedAllocationQueueQuery.isPending
      : queueQueryByStatus[allocationQueueView].isPending;
  const allocationQueueError =
    allocationQueueView === 'actionNeeded'
      ? ((pendingAllocationQueueQuery.error ??
          approvedAllocationQueueQuery.error) as NormalizedApiError | null)
      : (queueQueryByStatus[allocationQueueView].error as NormalizedApiError | null);
  const allocationQueueIsError = Boolean(allocationQueueError);
  const refetchAllocationQueue = () =>
    allocationQueueView === 'actionNeeded'
      ? Promise.all([
          pendingAllocationQueueQuery.refetch(),
          approvedAllocationQueueQuery.refetch(),
        ]).then(() => undefined)
      : queueQueryByStatus[allocationQueueView].refetch().then(() => undefined);
  const isAdminPlansSectionVisible =
    selectedTab === 'group' || (selectedTab === 'management' && adminWorkspaceTab === 'plans');
  const isApprovalQueueSectionVisible =
    selectedTab === 'management' &&
    adminWorkspaceTab === 'approvalQueue' &&
    canShowAllocationApprovalQueue;
  const isProgressActualsSectionVisible =
    selectedTab === 'management' &&
    adminWorkspaceTab === 'progressActuals' &&
    canShowActualEntrySurface;

  return (
    <PageContainer className="space-y-4">
      <section className="space-y-3 rounded-lg border border-border bg-panel p-4 shadow-shell">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('kpi:tabs.label')}>
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selectedTab === tab}
              className="rounded border border-border px-3 py-2 text-sm font-medium aria-selected:bg-accent aria-selected:text-white"
              onClick={() => setActiveTab(tab)}
            >
              {t(`kpi:tabs.${tab}`)}
            </button>
          ))}
        </div>
        {selectedTab === 'management' ? (
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label={t('kpi:adminWorkspace.label')}
          >
            {visibleAdminWorkspaceTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={adminWorkspaceTab === tab}
                className="rounded border border-border px-3 py-2 text-sm font-medium aria-selected:bg-accent aria-selected:text-white"
                onClick={() => setAdminWorkspaceTab(tab)}
              >
                {t(`kpi:adminWorkspace.${tab}`)}
              </button>
            ))}
          </div>
        ) : null}
        {isAdminPlansSectionVisible ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[220px] flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('kpi:filters.search')}
                </span>
                <input
                  value={query.search ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5"
                  placeholder={t('kpi:filters.searchPlaceholder')}
                  onChange={(event) => patchQuery({ search: event.target.value || undefined })}
                />
              </label>
              {isManagedGroupKpiView ? (
                <>
                  <div className="flex min-w-[160px] flex-col gap-1 text-sm">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('kpi:fields.planStatus')}
                    </span>
                    <span className="rounded border border-border bg-slate-50 px-2 py-1.5">
                      {t('kpi:statuses.PUBLISHED')}
                    </span>
                  </div>
                  <div className="flex min-w-[180px] flex-col gap-1 text-sm">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('kpi:fields.subjectType')}
                    </span>
                    <span className="rounded border border-border bg-slate-50 px-2 py-1.5">
                      {t('kpi:subjectTypes.TALENT_GROUP')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <label className="flex min-w-[160px] flex-col gap-1 text-sm">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('kpi:fields.planStatus')}
                    </span>
                    <select
                      value={query.status ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5"
                      onChange={(event) => patchQuery({ status: event.target.value || undefined })}
                    >
                      <option value="">{t('kpi:filters.allStatuses')}</option>
                      {kpiPlanStatuses.map((status) => (
                        <option key={status} value={status}>
                          {t(`kpi:statuses.${status}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[180px] flex-col gap-1 text-sm">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('kpi:fields.subjectType')}
                    </span>
                    <select
                      value={query.subjectType ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5"
                      onChange={(event) =>
                        patchQuery({ subjectType: event.target.value || undefined })
                      }
                    >
                      <option value="">{t('kpi:filters.allSubjectTypes')}</option>
                      {kpiSubjectTypes.map((type) => (
                        <option key={type} value={type}>
                          {t(`kpi:subjectTypes.${type}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label className="flex min-w-[150px] flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('kpi:fields.periodMonth')}
                </span>
                <input
                  type="month"
                  value={query.periodMonth ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5"
                  placeholder="2026-05"
                  onChange={(event) => patchQuery({ periodMonth: event.target.value || undefined })}
                />
              </label>
              <label className="flex min-w-[210px] flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('kpi:fields.metricCode')}
                </span>
                <select
                  value={query.metricCode ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5"
                  onChange={(event) => patchQuery({ metricCode: event.target.value || undefined })}
                >
                  <option value="">{t('kpi:filters.allMetrics')}</option>
                  {kpiMetricCodes.map((metricCode) => (
                    <option key={metricCode} value={metricCode}>
                      {t(`kpi:metricCodes.${metricCode}`)}
                    </option>
                  ))}
                </select>
              </label>
              {!isManagedGroupKpiView &&
              (query.subjectType === 'TALENT' ||
                query.subjectType === 'TALENT_GROUP' ||
                query.subjectType === 'ORG_UNIT') ? (
                <ReferenceFilterField
                  label={
                    query.subjectType === 'TALENT_GROUP'
                      ? t('kpi:fields.targetGroup')
                      : query.subjectType === 'ORG_UNIT'
                        ? t('kpi:fields.targetOrgUnit')
                        : t('kpi:fields.talent')
                  }
                  pickerId="kpi-filter-subject"
                  value={query.subjectId}
                  loadOptions={
                    query.subjectType === 'TALENT'
                      ? loadTalentReferenceOptions
                      : query.subjectType === 'ORG_UNIT'
                        ? loadOrgUnitReferenceOptions
                        : loadTalentGroupReferenceOptions
                  }
                  onChange={(nextId) => patchQuery({ subjectId: nextId })}
                  placeholder={
                    query.subjectType === 'ORG_UNIT'
                      ? t('kpi:filters.orgUnitSubjectPlaceholder')
                      : query.subjectType === 'TALENT_GROUP'
                        ? t('kpi:filters.talentGroupSubjectPlaceholder')
                        : t('kpi:filters.subjectPlaceholder')
                  }
                  clearLabel={t('common:actions.clear')}
                  className="min-w-[260px]"
                />
              ) : null}
              {canShowCreatePlan ? (
                <button
                  type="button"
                  disabled={createPlanHint.disabled}
                  className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  title={createPlanHint.disabledReason}
                  onClick={() => {
                    if (!createPlanHint.disabled) {
                      setIsCreateOpen((current) => !current);
                    }
                  }}
                >
                  {isCreateOpen ? t('common:actions.close') : t('kpi:actions.create')}
                </button>
              ) : null}
            </div>
            {canShowCreatePlan && createPlanHint.disabledReason ? (
              <p className="text-sm text-danger">{createPlanHint.disabledReason}</p>
            ) : null}
          </>
        ) : null}
      </section>

      {isAdminPlansSectionVisible && canShowCreatePlan && isCreateOpen ? (
        <section className="space-y-4 rounded-lg border border-border bg-panel p-4 shadow-shell">
          <h2 className="text-base font-semibold">{t('kpi:create.title')}</h2>
          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('kpi:fields.subjectType')}</span>
              <select
                value={createSubjectType}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) => {
                  const nextSubjectType = event.target.value as 'TALENT_GROUP' | 'ORG_UNIT';
                  setCreateSubjectType(nextSubjectType);
                  setSubjectId('');
                }}
              >
                {kpiCreateSubjectTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(`kpi:subjectTypes.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>
                {createSubjectType === 'ORG_UNIT'
                  ? t('kpi:fields.targetOrgUnit')
                  : t('kpi:fields.targetGroup')}
              </span>
              <ReferenceFilterField
                label={
                  createSubjectType === 'ORG_UNIT'
                    ? t('kpi:fields.targetOrgUnit')
                    : t('kpi:fields.targetGroup')
                }
                pickerId={`kpi-create-subject-${createSubjectType}`}
                value={subjectId}
                loadOptions={
                  createSubjectType === 'ORG_UNIT'
                    ? loadOrgUnitReferenceOptions
                    : loadTalentGroupReferenceOptions
                }
                onChange={(nextId) => setSubjectId(nextId ?? '')}
                placeholder={
                  createSubjectType === 'ORG_UNIT'
                    ? t('kpi:filters.orgUnitSubjectPlaceholder')
                    : t('kpi:filters.talentGroupSubjectPlaceholder')
                }
                clearLabel={t('common:actions.clear')}
                className=""
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('kpi:fields.title')}</span>
              <input
                value={title}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('kpi:fields.periodMonth')}</span>
              <input
                type="month"
                value={periodMonth}
                min={currentHcmMonth()}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) => setPeriodMonth(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span>{t('kpi:fields.description')}</span>
              <input
                value={description}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t('kpi:sections.targetMetrics')}</h3>
            {targets.map((target, index) => (
              <div key={target.metricCode} className="grid gap-2 md:grid-cols-[260px_1fr_auto]">
                <select
                  aria-label={t('kpi:fields.metricCode')}
                  value={target.metricCode}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    setTargets((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, metricCode: event.target.value as KpiMetricCode }
                          : item,
                      ),
                    )
                  }
                >
                  {metricOptionsForRow(targets, index, availableCreateMetricCodes).map(
                    (metricCode) => (
                      <option key={metricCode} value={metricCode}>
                        {t(`kpi:metricCodes.${metricCode}`)}
                      </option>
                    ),
                  )}
                </select>
                <input
                  aria-label={`${t(`kpi:metricCodes.${target.metricCode}`)} ${t('kpi:fields.targetValue')}`}
                  value={target.value}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    setTargets((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value: event.target.value } : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1.5 text-sm"
                  onClick={() =>
                    setTargets((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  {t('kpi:actions.remove')}
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={!canAddMetric}
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={() =>
                setTargets((current) => {
                  const used = new Set(current.map((target) => target.metricCode));
                  const nextMetric = availableCreateMetricCodes.find(
                    (metricCode) => !used.has(metricCode),
                  );
                  return nextMetric
                    ? [...current, { metricCode: nextMetric, value: '0' }]
                    : current;
                })
              }
            >
              {t('kpi:actions.addMetric')}
            </button>
          </div>

          <button
            type="button"
            disabled={createMutation.isPending || createPlanHint.disabled}
            title={createPlanHint.disabledReason}
            className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => void submitCreate()}
          >
            {t('kpi:create.submit')}
          </button>
        </section>
      ) : null}

      {isApprovalQueueSectionVisible ? (
        <section className="space-y-3 rounded-lg border border-border bg-panel p-4 shadow-shell">
          <h2 className="text-base font-semibold">{t('kpi:allocationQueue.title')}</h2>
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label={t('kpi:allocationQueue.viewsLabel')}
          >
            {allocationQueueViews.map((view) => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={allocationQueueView === view}
                className="rounded border border-border px-3 py-2 text-sm font-medium aria-selected:bg-accent aria-selected:text-white"
                onClick={() => setAllocationQueueView(view)}
              >
                {t(`kpi:allocationQueue.views.${view}`)}
              </button>
            ))}
          </div>
          {allocationQueueIsPending ? <LoadingState lines={3} /> : null}
          {allocationQueueIsError ? (
            <ErrorState
              title={t('kpi:states.loadErrorTitle')}
              message={readErrorMessage(t, allocationQueueError, 'kpi:states.loadErrorMessage')}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void refetchAllocationQueue()}
            />
          ) : null}
          {allocationQueueData && allocationQueueData.length === 0 ? (
            <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
              {t('kpi:allocationQueue.empty')}
            </div>
          ) : null}
          {allocationQueueData && allocationQueueData.length > 0 ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.planId')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.allocationStatus')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allocationQueueData.map((allocation) => (
                    <tr key={allocation.id} className="border-t border-border">
                      <td className="px-3 py-2">{allocation.kpiPlanId}</td>
                      <td className="px-3 py-2">
                        {allocation.snapshotMemberDisplayName ??
                          t('kpi:actualWorkspace.unnamedMember')}
                      </td>
                      <td className="px-3 py-2">
                        {t(`kpi:allocationStatuses.${allocation.allocationStatus}`)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="rounded border border-border px-2 py-1 text-sm"
                          onClick={() => navigate(APP_PATHS.kpiPlanDetail(allocation.kpiPlanId))}
                        >
                          {t('kpi:actions.open')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {isAdminPlansSectionVisible ? (
        <section className="space-y-3 rounded-lg border border-border bg-panel p-4 shadow-shell">
          <h2 className="text-base font-semibold">{t('kpi:list.title')}</h2>
          {plansQuery.isPending ? <LoadingState lines={6} /> : null}
          {plansQuery.isError && listError?.permissionDenied ? <PermissionDeniedState /> : null}
          {plansQuery.isError && !listError?.permissionDenied ? (
            <ErrorState
              title={t('kpi:states.loadErrorTitle')}
              message={readErrorMessage(t, listError, 'kpi:states.loadErrorMessage')}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void plansQuery.refetch()}
            />
          ) : null}
          {plansQuery.data && plansQuery.data.length === 0 ? (
            <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
              {isManagedGroupKpiView
                ? t('kpi:states.emptyManagedGroups')
                : t('kpi:states.emptyPlans')}
            </div>
          ) : null}
          {plansQuery.data && plansQuery.data.length > 0 ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.planCode')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.title')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.subjectType')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.subject')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.planStatus')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:allocationWorkflow.title')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.periodMonth')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.publishedAt')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.finalizedAt')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plansQuery.data.map((plan) => (
                    <tr key={plan.id} className="border-t border-border">
                      <td className="px-3 py-2">{plan.planCode}</td>
                      <td className="px-3 py-2">{plan.title}</td>
                      <td className="px-3 py-2">{t(`kpi:subjectTypes.${plan.subjectType}`)}</td>
                      <td className="px-3 py-2">
                        {plan.subjectRef?.displayName ??
                          plan.subjectRef?.name ??
                          t('kpi:fields.subjectUnavailable')}
                      </td>
                      <td className="px-3 py-2">{t(`kpi:statuses.${plan.status}`)}</td>
                      <td className="px-3 py-2">
                        {renderAllocationWorkflowSummary(plan.allocationWorkflowSummary)}
                      </td>
                      <td className="px-3 py-2">{formatPeriodMonth(plan.periodMonth)}</td>
                      <td className="px-3 py-2">{formatKpiDateTime(plan.publishedAt)}</td>
                      <td className="px-3 py-2">{formatKpiDateTime(plan.finalizedAt)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="rounded border border-border px-2 py-1 text-sm"
                          onClick={() => navigate(APP_PATHS.kpiPlanDetail(plan.id))}
                        >
                          {t('kpi:actions.open')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {isProgressActualsSectionVisible ? (
        <section className="space-y-3 rounded-lg border border-border bg-panel p-4 shadow-shell">
          <h2 className="text-base font-semibold">{t('kpi:actualWorkspace.title')}</h2>
          <p className="text-sm text-muted">{t('kpi:actualWorkspace.policy')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase text-muted">
                {t('kpi:filters.search')}
              </span>
              <input
                value={query.search ?? ''}
                className="rounded border border-border bg-panel px-2 py-1.5"
                placeholder={t('kpi:filters.searchPlaceholder')}
                onChange={(event) => patchQuery({ search: event.target.value || undefined })}
              />
            </label>
            <label className="flex min-w-[150px] flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase text-muted">
                {t('kpi:fields.periodMonth')}
              </span>
              <input
                type="month"
                value={query.periodMonth ?? ''}
                className="rounded border border-border bg-panel px-2 py-1.5"
                placeholder="2026-05"
                onChange={(event) => patchQuery({ periodMonth: event.target.value || undefined })}
              />
            </label>
            <label className="flex min-w-[220px] flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase text-muted">
                {t('kpi:actualWorkspace.allocationCoverage')}
              </span>
              <select
                value={actualWorkspaceAllocationCoverage ?? ''}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) =>
                  patchQuery({ allocationCoverage: event.target.value || undefined })
                }
              >
                <option value="">{t('kpi:actualWorkspace.coverageFilters.all')}</option>
                <option value="complete">
                  {t('kpi:actualWorkspace.coverageFilters.complete')}
                </option>
                <option value="incomplete">
                  {t('kpi:actualWorkspace.coverageFilters.incomplete')}
                </option>
              </select>
            </label>
            <label className="flex min-w-[180px] flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase text-muted">
                {t('kpi:actualWorkspace.overdueActuals')}
              </span>
              <select
                value={
                  actualWorkspaceHasOverdueActuals === undefined
                    ? ''
                    : String(actualWorkspaceHasOverdueActuals)
                }
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) =>
                  patchQuery({ hasOverdueActuals: event.target.value || undefined })
                }
              >
                <option value="">{t('kpi:actualWorkspace.statusFilters.all')}</option>
                <option value="true">{t('kpi:actualWorkspace.statusFilters.hasOverdue')}</option>
                <option value="false">{t('kpi:actualWorkspace.statusFilters.noOverdue')}</option>
              </select>
            </label>
            <label className="flex min-w-[180px] flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase text-muted">
                {t('kpi:actualWorkspace.dueOpenActuals')}
              </span>
              <select
                value={
                  actualWorkspaceHasPendingActuals === undefined
                    ? ''
                    : String(actualWorkspaceHasPendingActuals)
                }
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) =>
                  patchQuery({ hasPendingActuals: event.target.value || undefined })
                }
              >
                <option value="">{t('kpi:actualWorkspace.statusFilters.all')}</option>
                <option value="true">{t('kpi:actualWorkspace.statusFilters.hasDueOpen')}</option>
                <option value="false">{t('kpi:actualWorkspace.statusFilters.noDueOpen')}</option>
              </select>
            </label>
            <label className="flex min-w-[190px] flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase text-muted">
                {t('kpi:actualWorkspace.sortBy')}
              </span>
              <select
                value={actualWorkspaceSortBy}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) =>
                  patchQuery({
                    sortBy: event.target.value as NonNullable<
                      KpiActualWorkspacePlanQuery['sortBy']
                    >,
                  })
                }
              >
                <option value="periodMonth">
                  {t('kpi:actualWorkspace.sortFields.periodMonth')}
                </option>
                <option value="planCode">{t('kpi:actualWorkspace.sortFields.planCode')}</option>
                <option value="revenueActual">
                  {t('kpi:actualWorkspace.sortFields.revenueActual')}
                </option>
                <option value="achievementPercent">
                  {t('kpi:actualWorkspace.sortFields.achievementPercent')}
                </option>
              </select>
            </label>
            <label className="flex min-w-[170px] flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase text-muted">
                {t('kpi:actualWorkspace.sortDirection')}
              </span>
              <select
                value={actualWorkspaceSortDirection}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) =>
                  patchQuery({
                    sortDirection: event.target.value as NonNullable<
                      KpiActualWorkspacePlanQuery['sortDirection']
                    >,
                  })
                }
              >
                <option value="ASC">{t('kpi:actualWorkspace.sortDirections.ASC')}</option>
                <option value="DESC">{t('kpi:actualWorkspace.sortDirections.DESC')}</option>
              </select>
            </label>
          </div>
          {actualWorkspacePlansQuery.isPending && actualWorkspacePlans.length === 0 ? (
            <LoadingState lines={4} />
          ) : null}
          {actualWorkspacePlansQuery.isError ? (
            <ErrorState
              title={t('kpi:states.actualWorkspaceLoadErrorTitle')}
              message={readErrorMessage(
                t,
                actualWorkspacePlansQuery.error as unknown as NormalizedApiError,
                'kpi:states.actualWorkspaceLoadErrorMessage',
              )}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void actualWorkspacePlansQuery.refetch()}
            />
          ) : null}
          {actualWorkspacePlans.length === 0 && !actualWorkspacePlansQuery.isPending ? (
            <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
              {t('kpi:states.emptyActualWorkspace')}
            </div>
          ) : null}
          {actualWorkspacePlans.length > 0 ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.planCode')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.group')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.periodMonth')}</th>
                    <th className="px-3 py-2 text-left">
                      {t('kpi:actualWorkspace.revenueTarget')}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t('kpi:actualWorkspace.revenueActual')}
                    </th>
                    <th className="px-3 py-2 text-left">{t('kpi:actualWorkspace.achievement')}</th>
                    <th className="px-3 py-2 text-left">
                      {t('kpi:actualWorkspace.allocationCoverage')}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t('kpi:actualWorkspace.missingSignal')}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t('kpi:actualWorkspace.statusSummary')}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t('kpi:actualWorkspace.supportingMetrics')}
                    </th>
                    <th className="px-3 py-2 text-left">{t('kpi:table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {actualWorkspacePlans.map((plan) => (
                    <tr key={plan.planId} className="border-t border-border">
                      <td className="px-3 py-2">{plan.planCode}</td>
                      <td className="px-3 py-2">
                        {plan.subjectRef?.displayName ??
                          plan.subjectRef?.name ??
                          t('kpi:fields.subjectUnavailable')}
                      </td>
                      <td className="px-3 py-2">{formatPeriodMonth(plan.periodMonth)}</td>
                      <td className="px-3 py-2">
                        {formatKpiNumber('REVENUE_VND', plan.revenue.operationalTargetValue)}
                      </td>
                      <td className="px-3 py-2">
                        {formatKpiNumber('REVENUE_VND', plan.revenue.actualValue)}
                      </td>
                      <td className="px-3 py-2">
                        {formatAchievement(plan.revenue.achievementPercent)}
                      </td>
                      <td className="px-3 py-2">
                        {renderAllocationCoverage(plan.allocationCoverage)}
                      </td>
                      <td className="px-3 py-2">{renderMissingSignal(plan.missingSignal)}</td>
                      <td className="px-3 py-2">
                        {renderActualEntryStatusSummary(plan.actualEntryStatusSummary)}
                      </td>
                      <td className="px-3 py-2">
                        {renderSupportingMetrics(plan.supportingMetrics)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="rounded border border-border px-2 py-1 text-sm"
                          onClick={() => {
                            setSelectedWorkspacePlanId(plan.planId);
                            setLoadedActualGrid(undefined);
                            setCellDrafts({});
                            setExcuseDraft(null);
                          }}
                        >
                          {t('kpi:actualWorkspace.viewDetail')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {actualWorkspaceNextCursor ? (
            <button
              type="button"
              disabled={actualWorkspacePlansQuery.isFetching}
              className="rounded border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
              onClick={() => setActualWorkspaceCursor(actualWorkspaceNextCursor)}
            >
              {actualWorkspacePlansQuery.isFetching
                ? t('kpi:actualWorkspace.loadingMore')
                : t('kpi:actualWorkspace.loadMore')}
            </button>
          ) : null}

          {actualWorkspaceDetailQuery.isPending ? <LoadingState lines={3} /> : null}
          {actualWorkspaceDetailQuery.isError ? (
            <ErrorState
              title={t('kpi:states.actualWorkspaceDetailLoadErrorTitle')}
              message={readErrorMessage(
                t,
                actualWorkspaceDetailQuery.error as unknown as NormalizedApiError,
                'kpi:states.actualWorkspaceDetailLoadErrorMessage',
              )}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void actualWorkspaceDetailQuery.refetch()}
            />
          ) : null}
          {actualWorkspaceDetailQuery.data ? (
            <div className="space-y-3 rounded border border-border p-3">
              <div>
                <h3 className="font-semibold">{t('kpi:actualWorkspace.selectedPlan')}</h3>
                <p className="text-sm text-muted">
                  {actualWorkspaceDetailQuery.data.subjectRef?.displayName ??
                    actualWorkspaceDetailQuery.data.subjectRef?.name ??
                    t('kpi:fields.subjectUnavailable')}{' '}
                  - {formatPeriodMonth(actualWorkspaceDetailQuery.data.periodMonth)}
                </p>
              </div>
              {actualWorkspaceDetailQuery.data.planStatus === 'FINALIZED' ? (
                <section
                  aria-label={t('kpi:finalResult.title')}
                  className="space-y-2 rounded border border-border bg-panel p-3 text-sm"
                >
                  <div>
                    <h3 className="font-semibold">{t('kpi:finalResult.title')}</h3>
                    <p className="text-muted">{t('kpi:finalResult.captured')}</p>
                    <p className="text-muted">{t('kpi:finalResult.readOnly')}</p>
                  </div>
                  {actualWorkspaceDetailQuery.data.finalResult ? (
                    <div className="grid gap-2 md:grid-cols-3">
                      <div>
                        <span className="text-muted">{t('kpi:fields.finalizedAt')}: </span>
                        {formatKpiDateTime(actualWorkspaceDetailQuery.data.finalResult.finalizedAt)}
                      </div>
                      <div>
                        <span className="text-muted">
                          {t('kpi:actualWorkspace.revenueTarget')}:{' '}
                        </span>
                        {formatKpiNumber(
                          'REVENUE_VND',
                          actualWorkspaceDetailQuery.data.finalResult.revenue
                            .operationalTargetValue,
                        )}
                      </div>
                      <div>
                        <span className="text-muted">
                          {t('kpi:actualWorkspace.revenueActual')}:{' '}
                        </span>
                        {formatKpiNumber(
                          'REVENUE_VND',
                          actualWorkspaceDetailQuery.data.finalResult.revenue.actualValue,
                        )}
                      </div>
                      <div>
                        <span className="text-muted">{t('kpi:actualWorkspace.achievement')}: </span>
                        {formatAchievement(
                          actualWorkspaceDetailQuery.data.finalResult.revenue.achievementPercent,
                        )}
                      </div>
                      <div>
                        <span className="text-muted">
                          {t('kpi:actualWorkspace.allocationCoverage')}:{' '}
                        </span>
                        {renderAllocationCoverage(
                          actualWorkspaceDetailQuery.data.finalResult.allocationCoverage,
                        )}
                      </div>
                      <div className="md:col-span-3">
                        <span className="text-muted">
                          {t('kpi:actualWorkspace.statusSummary')}:{' '}
                        </span>
                        {renderActualEntryStatusSummary(
                          actualWorkspaceDetailQuery.data.finalResult.actualEntryStatusSummary,
                        )}
                      </div>
                      <div className="md:col-span-3">
                        <span className="text-muted">
                          {t('kpi:actualWorkspace.supportingMetrics')}:{' '}
                        </span>
                        {renderSupportingMetrics(
                          actualWorkspaceDetailQuery.data.finalResult.supportingMetrics,
                        )}
                      </div>
                      {actualWorkspaceDetailQuery.data.finalResult.members.length > 0 ? (
                        <div className="md:col-span-3">
                          <span className="text-muted">{t('kpi:fields.member')}: </span>
                          {actualWorkspaceDetailQuery.data.finalResult.members
                            .map(
                              (member) =>
                                member.memberDisplayName ?? t('kpi:actualWorkspace.unnamedMember'),
                            )
                            .join(', ')}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-muted">{t('kpi:finalResult.unavailable')}</p>
                  )}
                </section>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:actualWorkspace.revenueTarget')}
                  </div>
                  <div>
                    {formatKpiNumber(
                      'REVENUE_VND',
                      actualWorkspaceDetailQuery.data.revenue.operationalTargetValue,
                    )}
                  </div>
                </div>
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:actualWorkspace.revenueActual')}
                  </div>
                  <div>
                    {formatKpiNumber(
                      'REVENUE_VND',
                      actualWorkspaceDetailQuery.data.revenue.actualValue,
                    )}
                  </div>
                </div>
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:actualWorkspace.achievement')}
                  </div>
                  <div>
                    {formatAchievement(actualWorkspaceDetailQuery.data.revenue.achievementPercent)}
                  </div>
                </div>
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:actualWorkspace.allocationCoverage')}
                  </div>
                  <div>
                    {renderAllocationCoverage(actualWorkspaceDetailQuery.data.allocationCoverage)}
                  </div>
                </div>
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:actualWorkspace.missingSignal')}
                  </div>
                  <div>{renderMissingSignal(actualWorkspaceDetailQuery.data.missingSignal)}</div>
                </div>
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:actualWorkspace.statusSummary')}
                  </div>
                  <div>
                    {renderActualEntryStatusSummary(
                      actualWorkspaceDetailQuery.data.actualEntryStatusSummary,
                    )}
                  </div>
                </div>
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:actualWorkspace.closingState')}
                  </div>
                  <div>
                    {t(
                      `kpi:actualWorkspace.periodStates.${actualWorkspaceDetailQuery.data.closing.periodState}`,
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto rounded border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                      <th className="px-3 py-2 text-left">{t('kpi:fields.allocationId')}</th>
                      <th className="px-3 py-2 text-left">
                        {t('kpi:actualWorkspace.revenueTarget')}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t('kpi:actualWorkspace.revenueActual')}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t('kpi:actualWorkspace.achievement')}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t('kpi:actualWorkspace.supportingMetrics')}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t('kpi:actualWorkspace.missingSignal')}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t('kpi:actualWorkspace.statusSummary')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {actualWorkspaceDetailQuery.data.members.map((member) => (
                      <tr key={member.allocationId} className="border-t border-border">
                        <td className="px-3 py-2">
                          {member.memberDisplayName ?? t('kpi:actualWorkspace.unnamedMember')}
                        </td>
                        <td className="px-3 py-2">{member.allocationId}</td>
                        <td className="px-3 py-2">
                          {formatKpiNumber('REVENUE_VND', member.revenue.targetValue)}
                        </td>
                        <td className="px-3 py-2">
                          {formatKpiNumber('REVENUE_VND', member.revenue.actualValue)}
                        </td>
                        <td className="px-3 py-2">
                          {formatAchievement(member.revenue.achievementPercent)}
                        </td>
                        <td className="px-3 py-2">
                          {renderSupportingMetrics(member.supportingMetrics)}
                        </td>
                        <td className="px-3 py-2">{renderMissingSignal(member.missingSignal)}</td>
                        <td className="px-3 py-2">
                          {renderActualEntryStatusSummary(member.actualEntryStatusSummary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('kpi:fields.actualDate')}</span>
                  <input
                    value={actualDate}
                    className="rounded border border-border bg-panel px-2 py-1.5"
                    onChange={(event) => {
                      setActualDate(event.target.value);
                      setLoadedActualGrid(undefined);
                      setCellDrafts({});
                      setExcuseDraft(null);
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={!actualWorkspaceDetailQuery.data.actionHints.canReadActualGrid}
                  className="rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
                  onClick={loadActualGrid}
                >
                  {t('kpi:actions.loadGrid')}
                </button>
              </div>
              {!isStrictKpiDate(actualDate) ? (
                <p className="text-sm text-danger" role="alert">
                  {t('kpi:validation.invalidActualDate')}
                </p>
              ) : null}
              {actualError ? (
                <p className="text-sm text-danger" role="alert">
                  {actualError}
                </p>
              ) : null}
              {enterActualHint.allowed && enterActualHint.disabledReason ? (
                <p className="text-sm text-danger">{enterActualHint.disabledReason}</p>
              ) : null}
              {correctActualHint.allowed && correctActualHint.disabledReason ? (
                <p className="text-sm text-danger">{correctActualHint.disabledReason}</p>
              ) : null}
              {loadedActualGrid && actualGridQuery.isPending ? <LoadingState lines={3} /> : null}
              {actualGridQuery.isError ? (
                <ErrorState
                  title={t('kpi:states.actualGridLoadErrorTitle')}
                  message={readErrorMessage(
                    t,
                    actualGridQuery.error as unknown as NormalizedApiError,
                    'kpi:states.actualGridLoadErrorMessage',
                  )}
                />
              ) : null}
              {actualGridQuery.data ? (
                <div className="overflow-x-auto rounded border border-border">
                  {actualGridQuery.data.editability.isPlanFinalized ? (
                    <p className="p-3 text-sm text-danger">{t('kpi:errors.finalizedReadOnly')}</p>
                  ) : null}
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                        {actualGridQuery.data.targetMetrics.map((metric) => (
                          <th key={metric.metricCode} className="px-3 py-2 text-left">
                            {t(`kpi:metricCodes.${metric.metricCode}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {actualGridQuery.data.rows.map((row) => (
                        <tr key={row.allocationId} className="border-t border-border">
                          <td className="px-3 py-2">
                            {row.memberDisplayName ?? t('kpi:actualWorkspace.unnamedMember')}
                          </td>
                          {row.metrics.map((cell) => (
                            <td key={cell.metricCode} className="space-y-1 px-3 py-2">
                              <span
                                className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${actualStatusClassName(
                                  cell.dailyActualStatus,
                                )}`}
                              >
                                {t(`kpi:dailyActualStatuses.${cell.dailyActualStatus}`)}
                              </span>
                              {cell.actualExcuse ? (
                                <div className="text-xs text-muted">
                                  {t(`kpi:actualExcuseStatuses.${cell.actualExcuse.status}`)} -{' '}
                                  {t(`kpi:actualExcuseReasonCodes.${cell.actualExcuse.reasonCode}`)}
                                  {': '}
                                  {cell.actualExcuse.reasonText}
                                </div>
                              ) : null}
                              <input
                                aria-label={`${row.memberDisplayName ?? t('kpi:actualWorkspace.unnamedMember')} ${t(`kpi:metricCodes.${cell.metricCode}`)} actual`}
                                value={
                                  cellDrafts[cellKey(row, cell)] ??
                                  formatKpiMetricInput(cell.metricCode, cell.effectiveValue)
                                }
                                disabled={
                                  !actualWorkspaceDetailQuery.data.actionHints.canEnterActual ||
                                  !enterActualHint.allowed ||
                                  enterActualHint.disabled
                                }
                                className="w-32 rounded border border-border bg-panel px-2 py-1 disabled:opacity-50"
                                onChange={(event) =>
                                  setCellDrafts((current) => ({
                                    ...current,
                                    [cellKey(row, cell)]: event.target.value,
                                  }))
                                }
                              />
                              <div className="text-xs text-muted">
                                {cell.requiresCorrection || !cell.canDirectEdit
                                  ? (cell.disabledReason ?? t('kpi:actualEntry.requiresCorrection'))
                                  : t('kpi:actualEntry.directEdit')}
                              </div>
                              {correctActualHint.allowed &&
                              cell.actualEntryId &&
                              !actualGridQuery.data.editability.isPlanFinalized &&
                              cell.dailyActualStatus !== 'EXCUSED' &&
                              cell.dailyActualStatus !== 'NOT_REQUIRED' ? (
                                <button
                                  type="button"
                                  disabled={correctActualHint.disabled}
                                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                                  title={correctActualHint.disabledReason}
                                  onClick={() => {
                                    if (!correctActualHint.disabled) {
                                      setCorrectionTarget({ row, cell });
                                    }
                                  }}
                                >
                                  {t('kpi:actions.correction')}
                                </button>
                              ) : null}
                              {cell.canMarkExcused ? (
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    className="rounded border border-border px-2 py-1 text-xs"
                                    onClick={() => openExcuseDraft(row, cell, 'EXCUSED')}
                                  >
                                    {t('kpi:actions.markExcused')}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded border border-border px-2 py-1 text-xs"
                                    onClick={() => openExcuseDraft(row, cell, 'NOT_REQUIRED')}
                                  >
                                    {t('kpi:actions.markNotRequired')}
                                  </button>
                                </div>
                              ) : null}
                              {cell.canUnmarkExcused && cell.actualExcuse ? (
                                <button
                                  type="button"
                                  disabled={unmarkActualExcuseMutation.isPending}
                                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                                  onClick={() => void unmarkExcuse(cell)}
                                >
                                  {t('kpi:actions.unmarkExcuse')}
                                </button>
                              ) : null}
                              {excuseDraft?.cellKey === cellKey(row, cell) ? (
                                <div className="space-y-2 rounded border border-border p-2">
                                  <div className="text-xs font-medium">
                                    {t(`kpi:actualExcuseStatuses.${excuseDraft.status}`)}
                                  </div>
                                  <label className="flex flex-col gap-1 text-xs">
                                    <span>{t('kpi:actualExcuse.reasonCode')}</span>
                                    <select
                                      value={excuseDraft.reasonCode}
                                      className="rounded border border-border bg-panel px-2 py-1"
                                      onChange={(event) =>
                                        setExcuseDraft((current) =>
                                          current
                                            ? {
                                                ...current,
                                                reasonCode: event.target.value as
                                                  | KpiActualExcuseReasonCode
                                                  | '',
                                              }
                                            : current,
                                        )
                                      }
                                    >
                                      <option value="">
                                        {t('kpi:actualExcuse.selectReasonCode')}
                                      </option>
                                      {kpiActualExcuseReasonCodes.map((reasonCode) => (
                                        <option key={reasonCode} value={reasonCode}>
                                          {t(`kpi:actualExcuseReasonCodes.${reasonCode}`)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-1 text-xs">
                                    <span>{t('kpi:actualExcuse.reasonText')}</span>
                                    <textarea
                                      value={excuseDraft.reasonText}
                                      className="rounded border border-border bg-panel px-2 py-1"
                                      onChange={(event) =>
                                        setExcuseDraft((current) =>
                                          current
                                            ? { ...current, reasonText: event.target.value }
                                            : current,
                                        )
                                      }
                                    />
                                  </label>
                                  <div className="flex flex-wrap gap-1">
                                    <button
                                      type="button"
                                      disabled={markActualExcuseMutation.isPending}
                                      className="rounded border border-accent bg-accent px-2 py-1 text-xs text-white disabled:opacity-50"
                                      onClick={() => void submitExcuseDraft()}
                                    >
                                      {t('kpi:actions.submitExcuse')}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded border border-border px-2 py-1 text-xs"
                                      onClick={() => setExcuseDraft(null)}
                                    >
                                      {t('common:actions.cancel')}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {enterActualHint.allowed &&
                  actualWorkspaceDetailQuery.data.actionHints.canEnterActual ? (
                    <div className="p-3">
                      <button
                        type="button"
                        disabled={enterActualHint.disabled}
                        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        title={enterActualHint.disabledReason}
                        onClick={() => void saveActuals()}
                      >
                        {t('kpi:actions.saveChangedCells')}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {correctActualHint.allowed && correctionTarget ? (
        <CorrectionPanel
          kpiPlanId={actualGridQuery.data?.kpiPlanId ?? selectedWorkspacePlanId ?? ''}
          actualDate={actualGridQuery.data?.actualDate ?? actualDate}
          target={correctionTarget}
          initialValue={correctionTarget.proposedValue}
          correctionHint={correctActualHint}
          onClose={() => setCorrectionTarget(null)}
        />
      ) : null}

      <Link className="sr-only" to={APP_PATHS.kpiPlans}>
        {t('kpi:page.title')}
      </Link>
    </PageContainer>
  );
};

const CorrectionPanel = ({
  kpiPlanId,
  actualDate,
  target,
  initialValue,
  correctionHint,
  onClose,
}: {
  kpiPlanId: string;
  actualDate: string;
  target: CorrectionTarget;
  initialValue?: string;
  correctionHint: ReturnType<typeof createKpiActionCapabilityHint>;
  onClose: () => void;
}): JSX.Element => {
  const { t } = useTranslation(['kpi', 'common']);
  const { notifySuccess } = useMutationFeedback();
  const correctionMutation = useCreateKpiCorrectionMutation();
  const historyQuery = useKpiCorrectionHistory(kpiPlanId, target.cell.actualEntryId ?? undefined);
  const [correctedValue, setCorrectedValue] = useState(
    initialValue ?? formatKpiMetricInput(target.cell.metricCode, target.cell.effectiveValue),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setError(null);
    if (correctionHint.disabled) {
      setError(
        correctionHint.disabledReason ?? 'KPI permissions could not be verified. Try again.',
      );
      return;
    }
    const parsed = parseKpiMetricInput(target.cell.metricCode, correctedValue);
    if (parsed === undefined) {
      setError(t('kpi:validation.invalidMetricValue'));
      return;
    }
    if (!reason.trim()) {
      setError(t('kpi:validation.reasonRequired'));
      return;
    }
    if (!target.cell.actualEntryId) {
      setError(t('kpi:validation.missingActualEntry'));
      return;
    }
    try {
      await correctionMutation.mutateAsync({
        kpiPlanId,
        actualEntryId: target.cell.actualEntryId,
        correctedValue: parsed,
        reason,
      });
      notifySuccess('kpi:feedback.correctionCreated');
      onClose();
    } catch (submitError) {
      setError(
        readKpiSafeErrorMessage(
          t,
          submitError as NormalizedApiError,
          'kpi:states.correctionMutationErrorMessage',
        ),
      );
    }
  };

  return (
    <section
      role="dialog"
      aria-label={t('kpi:correction.title')}
      className="space-y-3 rounded-lg border border-border bg-panel p-4 shadow-shell"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('kpi:correction.title')}</h2>
          <p className="text-sm text-muted">
            {target.row.memberDisplayName ?? t('kpi:actualWorkspace.unnamedMember')} -{' '}
            {t(`kpi:metricCodes.${target.cell.metricCode}`)} - {actualDate}
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-sm"
          onClick={onClose}
        >
          {t('common:actions.close')}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {correctionHint.disabledReason ? (
        <p className="text-sm text-danger">{correctionHint.disabledReason}</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-border p-3 text-sm">
          <div className="text-xs uppercase text-muted">{t('kpi:correction.previousValue')}</div>
          <div>{formatKpiNumber(target.cell.metricCode, target.cell.effectiveValue)}</div>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>{t('kpi:correction.correctedValue')}</span>
          <input
            value={correctedValue}
            className="rounded border border-border bg-panel px-2 py-1.5"
            onChange={(event) => setCorrectedValue(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span>{t('kpi:correction.reason')}</span>
          <textarea
            value={reason}
            className="rounded border border-border bg-panel px-2 py-1.5"
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={correctionHint.disabled || correctionMutation.isPending}
        title={correctionHint.disabledReason}
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        onClick={() => void submit()}
      >
        {t('kpi:actions.submitCorrection')}
      </button>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t('kpi:correction.history')}</h3>
        {historyQuery.data?.map((item) => (
          <div key={item.id} className="rounded border border-border p-2 text-sm">
            {formatKpiNumber(item.metricCode, item.previousValue)} {'->'}{' '}
            {formatKpiNumber(item.metricCode, item.correctedValue)} - {item.reason}
          </div>
        ))}
      </div>
    </section>
  );
};
