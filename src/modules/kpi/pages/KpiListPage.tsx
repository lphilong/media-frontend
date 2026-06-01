import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { createKpiActionCapabilityHint } from '@modules/kpi/capability-hints';
import {
  formatKpiMetricInput,
  formatKpiNumber,
  isStrictKpiDate,
  parseKpiDate,
  parseKpiMetricInput,
} from '@modules/kpi/formatting/kpi-formatting';
import {
  useCreateKpiActualMutation,
  useCreateKpiCorrectionMutation,
  useKpiAllocations,
  useCreateKpiPlanMutation,
  useKpiActualDailyGrid,
  useKpiCorrectionHistory,
  useKpiPlans,
  useUpdateKpiActualMutation,
} from '@modules/kpi/hooks/use-kpi';
import type {
  KpiActualGridMetricCell,
  KpiActualGridRow,
  KpiCreatePlanPayload,
  KpiMetricCode,
  KpiPlanQuery,
} from '@modules/kpi/types/kpi.types';
import { kpiMetricCodes, kpiPlanStatuses, kpiSubjectTypes } from '@modules/kpi/types/kpi.types';
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
  loadTalentGroupReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';

type TargetDraft = {
  metricCode: KpiMetricCode;
  value: string;
};

type AllocationDraft = {
  memberTalentId: string;
  memberName: string;
  values: Partial<Record<KpiMetricCode, string>>;
};

type CorrectionTarget = {
  row: KpiActualGridRow;
  cell: KpiActualGridMetricCell;
  proposedValue?: string;
};

const defaultTargets: TargetDraft[] = [
  { metricCode: 'REVENUE_VND', value: '1.000.000' },
  { metricCode: 'CONTENT_OUTPUT_COUNT', value: '10' },
];

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

const createEmptyAllocation = (index: number): AllocationDraft => ({
  memberTalentId: `talent-00${index}`,
  memberName: index === 1 ? 'Luna Park' : 'Minh Tran',
  values: {
    REVENUE_VND: index === 1 ? '600.000' : '400.000',
    CONTENT_OUTPUT_COUNT: index === 1 ? '6' : '4',
  },
});

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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [subjectType, setSubjectType] = useState<'TALENT' | 'TALENT_GROUP'>('TALENT_GROUP');
  const [subjectId, setSubjectId] = useState('group-001');
  const [title, setTitle] = useState('May KPI plan');
  const [periodMonth, setPeriodMonth] = useState('2026-05');
  const [description, setDescription] = useState('');
  const [targets, setTargets] = useState<TargetDraft[]>(defaultTargets);
  const [allocations, setAllocations] = useState<AllocationDraft[]>([
    createEmptyAllocation(1),
    createEmptyAllocation(2),
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const [actualPlanId, setActualPlanId] = useState('kpi-plan-published');
  const [actualDate, setActualDate] = useState('16-05-2026');
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const [actualError, setActualError] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<CorrectionTarget | null>(null);

  const actualGridQuery = useKpiActualDailyGrid(
    actualPlanId,
    parseKpiDate(actualDate) ? actualDate : undefined,
  );
  const createActualMutation = useCreateKpiActualMutation();
  const updateActualMutation = useUpdateKpiActualMutation();
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
  const allocationQueueQuery = useKpiAllocations({ limit: 50 });
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

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab as 'management' | 'group')) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, visibleTabs]);

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

  const allocationTotals = useMemo(() => {
    const totals = new Map<KpiMetricCode, number>();
    targets.forEach((target) => totals.set(target.metricCode, 0));
    allocations.forEach((allocation) => {
      targets.forEach((target) => {
        const parsed = parseKpiMetricInput(
          target.metricCode,
          allocation.values[target.metricCode] ?? '',
        );
        totals.set(target.metricCode, (totals.get(target.metricCode) ?? 0) + (parsed ?? 0));
      });
    });
    return totals;
  }, [allocations, targets]);

  const allocationMatches = useMemo(() => {
    if (!parsedTargets) {
      return false;
    }
    return parsedTargets.every(
      (target) => allocationTotals.get(target.metricCode) === target.targetValue,
    );
  }, [allocationTotals, parsedTargets]);

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
    if (!parsedTargets) {
      setFormError(t('kpi:validation.invalidMetricValue'));
      return;
    }
    if (subjectType === 'TALENT_GROUP' && !allocationMatches) {
      setFormError(t('kpi:validation.allocationMismatch'));
      return;
    }

    const payload: KpiCreatePlanPayload = {
      title,
      description: description.trim() || null,
      subjectType,
      subjectId,
      currencyCode: 'VND',
      periodMonth,
      periodStartAt: bounds.start,
      periodEndAt: bounds.end,
      timezone: 'Asia/Ho_Chi_Minh',
      targetMetrics: parsedTargets,
      allocations:
        subjectType === 'TALENT_GROUP'
          ? allocations.map((allocation) => ({
              memberTalentId: allocation.memberTalentId,
              membershipId: null,
              allocationStartDate: '01-05-2026',
              allocationEndDate: null,
              snapshotMemberDisplayName: allocation.memberName,
              targetMetrics: parsedTargets.map((target) => ({
                metricCode: target.metricCode,
                targetValue:
                  parseKpiMetricInput(
                    target.metricCode,
                    allocation.values[target.metricCode] ?? '',
                  ) ?? 0,
              })),
            }))
          : undefined,
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
            setActualError(t('kpi:validation.duplicateConflict'));
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

  const listError = plansQuery.error as NormalizedApiError | null;

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
                  onChange={(event) => patchQuery({ subjectType: event.target.value || undefined })}
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
          (query.subjectType === 'TALENT' || query.subjectType === 'TALENT_GROUP') ? (
            <ReferenceFilterField
              label={
                query.subjectType === 'TALENT_GROUP'
                  ? t('kpi:fields.targetGroup')
                  : t('kpi:fields.talent')
              }
              pickerId="kpi-filter-subject"
              value={query.subjectId}
              loadOptions={
                query.subjectType === 'TALENT'
                  ? loadTalentReferenceOptions
                  : loadTalentGroupReferenceOptions
              }
              onChange={(nextId) => patchQuery({ subjectId: nextId })}
              placeholder={t('kpi:filters.subjectPlaceholder')}
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
      </section>

      {canShowCreatePlan && isCreateOpen ? (
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
                value={subjectType}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) =>
                  setSubjectType(event.target.value as 'TALENT' | 'TALENT_GROUP')
                }
              >
                <option value="TALENT_GROUP">{t('kpi:subjectTypes.TALENT_GROUP')}</option>
                <option value="TALENT">{t('kpi:subjectTypes.TALENT')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>
                {subjectType === 'TALENT_GROUP'
                  ? t('kpi:fields.targetGroup')
                  : t('kpi:fields.talent')}
              </span>
              <ReferenceFilterField
                label={
                  subjectType === 'TALENT_GROUP'
                    ? t('kpi:fields.targetGroup')
                    : t('kpi:fields.talent')
                }
                pickerId="kpi-create-subject"
                value={subjectId}
                loadOptions={
                  subjectType === 'TALENT'
                    ? loadTalentReferenceOptions
                    : loadTalentGroupReferenceOptions
                }
                onChange={(nextId) => setSubjectId(nextId ?? '')}
                placeholder={t('kpi:filters.subjectPlaceholder')}
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
                  {kpiMetricCodes.map((metricCode) => (
                    <option key={metricCode} value={metricCode}>
                      {t(`kpi:metricCodes.${metricCode}`)}
                    </option>
                  ))}
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
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={() =>
                setTargets((current) => [...current, { metricCode: 'LIVE_HOURS', value: '1,5' }])
              }
            >
              {t('kpi:actions.addMetric')}
            </button>
          </div>

          {subjectType === 'TALENT_GROUP' ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t('kpi:sections.allocations')}</h3>
              <div className="overflow-x-auto rounded border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                      {targets.map((target) => (
                        <th key={target.metricCode} className="px-3 py-2 text-left">
                          {t(`kpi:metricCodes.${target.metricCode}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((allocation, allocationIndex) => (
                      <tr key={allocation.memberTalentId} className="border-t border-border">
                        <td className="min-w-[260px] px-3 py-2">
                          <ReferenceFilterField
                            label={t('kpi:fields.member')}
                            pickerId={`kpi-create-allocation-${allocationIndex}`}
                            value={allocation.memberTalentId}
                            loadOptions={loadTalentReferenceOptions}
                            onChange={(nextId) =>
                              setAllocations((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === allocationIndex
                                    ? {
                                        ...item,
                                        memberTalentId: nextId ?? '',
                                        memberName: nextId ?? '',
                                      }
                                    : item,
                                ),
                              )
                            }
                            placeholder={t('kpi:filters.subjectPlaceholder')}
                            clearLabel={t('common:actions.clear')}
                            className=""
                          />
                        </td>
                        {targets.map((target) => (
                          <td key={target.metricCode} className="px-3 py-2">
                            <input
                              aria-label={`${allocation.memberName} ${t(`kpi:metricCodes.${target.metricCode}`)}`}
                              value={allocation.values[target.metricCode] ?? ''}
                              className="w-32 rounded border border-border bg-panel px-2 py-1"
                              onChange={(event) =>
                                setAllocations((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === allocationIndex
                                      ? {
                                          ...item,
                                          values: {
                                            ...item.values,
                                            [target.metricCode]: event.target.value,
                                          },
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t border-border font-medium">
                      <td className="px-3 py-2">{t('kpi:allocation.allocatedTotal')}</td>
                      {targets.map((target) => (
                        <td key={target.metricCode} className="px-3 py-2">
                          {formatKpiNumber(
                            target.metricCode,
                            allocationTotals.get(target.metricCode) ?? 0,
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-t border-border font-medium">
                      <td className="px-3 py-2">{t('kpi:allocation.difference')}</td>
                      {targets.map((target) => {
                        const targetValue =
                          parseKpiMetricInput(target.metricCode, target.value) ?? 0;
                        const diff = (allocationTotals.get(target.metricCode) ?? 0) - targetValue;
                        return (
                          <td key={target.metricCode} className="px-3 py-2">
                            {formatKpiNumber(target.metricCode, diff)}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {!allocationMatches ? (
                <p className="text-sm text-danger">{t('kpi:validation.allocationMismatch')}</p>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            disabled={
              createMutation.isPending ||
              createPlanHint.disabled ||
              (subjectType === 'TALENT_GROUP' && Boolean(parsedTargets) && !allocationMatches)
            }
            title={createPlanHint.disabledReason}
            className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => void submitCreate()}
          >
            {t('kpi:create.submit')}
          </button>
        </section>
      ) : null}

      {canShowAllocationApprovalQueue ? (
        <section className="space-y-3 rounded-lg border border-border bg-panel p-4 shadow-shell">
          <h2 className="text-base font-semibold">{t('kpi:allocationQueue.title')}</h2>
          {allocationQueueQuery.isPending ? <LoadingState lines={3} /> : null}
          {allocationQueueQuery.data && allocationQueueQuery.data.length === 0 ? (
            <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
              {t('kpi:allocationQueue.empty')}
            </div>
          ) : null}
          {allocationQueueQuery.data && allocationQueueQuery.data.length > 0 ? (
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
                  {allocationQueueQuery.data.map((allocation) => (
                    <tr key={allocation.id} className="border-t border-border">
                      <td className="px-3 py-2">{allocation.kpiPlanId}</td>
                      <td className="px-3 py-2">
                        {allocation.snapshotMemberDisplayName ??
                          allocation.memberEmploymentProfileId}
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
                  <th className="px-3 py-2 text-left">{t('kpi:fields.subject')}</th>
                  <th className="px-3 py-2 text-left">{t('kpi:fields.planStatus')}</th>
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
                    <td className="px-3 py-2">
                      {plan.subjectRef?.displayName ?? plan.subjectRef?.name ?? plan.subjectId}
                    </td>
                    <td className="px-3 py-2">{t(`kpi:statuses.${plan.status}`)}</td>
                    <td className="px-3 py-2">{plan.periodMonth}</td>
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

      {canShowActualEntrySurface ? (
        <section className="space-y-3 rounded-lg border border-border bg-panel p-4 shadow-shell">
          <h2 className="text-base font-semibold">{t('kpi:actualEntry.title')}</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('kpi:fields.planId')}</span>
              <input
                value={actualPlanId}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) => setActualPlanId(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('kpi:fields.actualDate')}</span>
              <input
                value={actualDate}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) => setActualDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={() => void actualGridQuery.refetch()}
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
          {actualGridQuery.data ? (
            <div className="overflow-x-auto rounded border border-border">
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
                      <td className="px-3 py-2">{row.memberDisplayName ?? row.memberTalentId}</td>
                      {row.metrics.map((cell) => (
                        <td key={cell.metricCode} className="space-y-1 px-3 py-2">
                          <input
                            aria-label={`${row.memberDisplayName ?? row.memberTalentId} ${t(`kpi:metricCodes.${cell.metricCode}`)} actual`}
                            value={
                              cellDrafts[cellKey(row, cell)] ??
                              formatKpiMetricInput(cell.metricCode, cell.effectiveValue)
                            }
                            disabled={!enterActualHint.allowed || enterActualHint.disabled}
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
                          {correctActualHint.allowed && cell.actualEntryId ? (
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
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {enterActualHint.allowed ? (
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
        </section>
      ) : null}

      {correctActualHint.allowed && correctionTarget ? (
        <CorrectionPanel
          kpiPlanId={actualGridQuery.data?.kpiPlanId ?? actualPlanId}
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
  const { notifyError, notifySuccess } = useMutationFeedback();
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
      notifyError(submitError as NormalizedApiError);
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
            {target.row.memberDisplayName ?? target.row.memberTalentId} -{' '}
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
