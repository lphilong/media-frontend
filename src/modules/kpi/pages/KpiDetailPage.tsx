import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { createKpiActionCapabilityHint } from '@modules/kpi/capability-hints';
import { fetchKpiManagedMembers } from '@modules/kpi/api/kpi.api';
import {
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import {
  formatKpiDateTime,
  formatKpiMetricInput,
  formatKpiNumber,
  isStrictKpiDate,
  parseKpiMetricInput,
} from '@modules/kpi/formatting/kpi-formatting';
import {
  useApproveKpiAllocationMutation,
  useCreateKpiOrgUnitActualMutation,
  useCreateKpiOrgUnitCorrectionMutation,
  useKpiLifecycleMutation,
  useKpiOrgUnitActualGrid,
  useKpiOrgUnitAllocations,
  useKpiOrgUnitCorrectionHistory,
  useKpiOrgUnitFinalResult,
  useKpiOrgUnitManagedMembers,
  useKpiOrgUnitProgress,
  useKpiPlanDetail,
  useKpiProgress,
  useMarkKpiOrgUnitActualExcuseMutation,
  usePublishKpiAllocationMutation,
  useRejectKpiAllocationMutation,
  useReplaceKpiAllocationsMutation,
  useSubmitKpiAllocationDraftMutation,
  useUnmarkKpiOrgUnitActualExcuseMutation,
  useUpdateKpiOrgUnitActualMutation,
  useUpsertKpiAllocationDraftMutation,
} from '@modules/kpi/hooks/use-kpi';
import type {
  KpiActualEntryStatusSummary,
  KpiActualExcuseReasonCode,
  KpiActualExcuseStatus,
  KpiActualGridMetricCell,
  KpiAllocationStatus,
  KpiFinalResultSnapshot,
  KpiMetricCode,
  KpiOrgUnitActualGridRow,
  KpiOrgUnitAllocation,
  KpiPlanDetail,
} from '@modules/kpi/types/kpi.types';
import { kpiActualExcuseReasonCodes } from '@modules/kpi/types/kpi.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ActionRail,
  DetailPageShell,
  ErrorState,
  LoadingState,
  MetadataSection,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  StatusBadge,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { AsyncReferencePicker, type ReferenceOption } from '@shared/components/reference';

const readDisabledReason = (plan: KpiPlanDetail, action: 'publish' | 'finalize' | 'archive') => {
  if (action === 'publish' && plan.status !== 'DRAFT') {
    return 'kpi:disabled.publishDraftOnly';
  }
  if (action === 'finalize' && plan.status !== 'PUBLISHED') {
    return 'kpi:disabled.finalizePublishedOnly';
  }
  if (action === 'archive' && plan.status === 'ARCHIVED') {
    return 'kpi:disabled.alreadyArchived';
  }
  return undefined;
};

type AllocationDraftRow = {
  employmentProfileId: string;
  allocationStartDate: string;
  note: string;
  values: Partial<Record<KpiMetricCode, string>>;
};

type OrgUnitCorrectionTarget = {
  row: KpiOrgUnitActualGridRow;
  cell: KpiActualGridMetricCell;
};

type OrgUnitExcuseDraft = {
  cellKey: string;
  allocationId: string;
  metricCode: KpiMetricCode;
  status: KpiActualExcuseStatus;
  reasonCode: KpiActualExcuseReasonCode | '';
  reasonText: string;
};

const toContractDate = (periodMonth: KpiPlanDetail['periodMonth']): string =>
  /^\d{4}-\d{2}$/.test(periodMonth) ? `${periodMonth}-01` : '';

const officialAllocationStatuses = new Set<KpiAllocationStatus>(['PUBLISHED']);

const formatFinalAchievement = (value: number | null): string =>
  value === null ? '-' : `${Number(value.toFixed(2))}%`;

const currentHcmDate = (now = Date.now()): string => {
  const local = new Date(now + 7 * 60 * 60 * 1000);
  return `${String(local.getUTCDate()).padStart(2, '0')}-${String(local.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}-${local.getUTCFullYear()}`;
};

const orgUnitCellKey = (row: KpiOrgUnitActualGridRow, cell: KpiActualGridMetricCell): string =>
  `${row.allocationId}:${cell.metricCode}`;

const isOrgUnitCellBlockedByException = (cell: KpiActualGridMetricCell): boolean =>
  cell.dailyActualStatus === 'EXCUSED' || cell.dailyActualStatus === 'NOT_REQUIRED';

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

const displayOrgUnitMember = (
  allocation: KpiOrgUnitAllocation | undefined,
  fallback: string,
): string => allocation?.snapshotMemberDisplayName ?? fallback;

const renderFinalStatusSummary = (
  t: (key: string) => string,
  summary: KpiActualEntryStatusSummary,
): string =>
  [
    `${t('kpi:actualStatusSummary.entered')}: ${summary.enteredEntryCount}`,
    `${t('kpi:actualStatusSummary.enteredZero')}: ${summary.enteredZeroCount}`,
    `${t('kpi:actualStatusSummary.overdue')}: ${summary.overdueEntryCount}`,
    `${t('kpi:actualStatusSummary.dueOpen')}: ${summary.pendingEntryCount}`,
    `${t('kpi:actualStatusSummary.excused')}: ${summary.excusedEntryCount}`,
    `${t('kpi:actualStatusSummary.notRequired')}: ${summary.notRequiredEntryCount}`,
    `${t('kpi:actualStatusSummary.notDue')}: ${summary.notDueEntryCount}`,
  ].join(' | ');

const KpiFinalResultSnapshotSection = ({
  status,
  finalResult,
}: {
  status: KpiPlanDetail['status'];
  finalResult?: KpiFinalResultSnapshot | null;
}): JSX.Element | null => {
  const { t } = useTranslation('kpi');
  if (status !== 'FINALIZED') {
    return null;
  }

  return (
    <section
      aria-label={t('finalResult.title')}
      className="space-y-3 rounded border border-border bg-panel p-4"
    >
      <div>
        <h3 className="font-semibold">{t('finalResult.title')}</h3>
        <p className="text-sm text-muted">{t('finalResult.captured')}</p>
        <p className="text-sm text-muted">{t('finalResult.readOnly')}</p>
      </div>
      {!finalResult ? (
        <p className="text-sm text-muted">{t('finalResult.unavailable')}</p>
      ) : (
        <>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div>
              <span className="text-muted">{t('finalResult.status')}: </span>
              {t('finalResult.closed')}
            </div>
            <div>
              <span className="text-muted">{t('fields.finalizedAt')}: </span>
              {formatKpiDateTime(finalResult.finalizedAt)}
            </div>
            <div>
              <span className="text-muted">{t('actualWorkspace.revenueTarget')}: </span>
              {formatKpiNumber('REVENUE_VND', finalResult.revenue.operationalTargetValue)}
            </div>
            <div>
              <span className="text-muted">{t('actualWorkspace.revenueActual')}: </span>
              {formatKpiNumber('REVENUE_VND', finalResult.revenue.actualValue)}
            </div>
            <div>
              <span className="text-muted">{t('actualWorkspace.achievement')}: </span>
              {formatFinalAchievement(finalResult.revenue.achievementPercent)}
            </div>
            <div>
              <span className="text-muted">{t('finalResult.targetMismatch')}: </span>
              {t(`finalResult.boolean.${String(finalResult.revenue.targetMismatch)}`)}
            </div>
            <div>
              <span className="text-muted">{t('actualWorkspace.allocationCoverage')}: </span>
              {finalResult.allocationCoverage.publishedAllocationCount}/
              {finalResult.allocationCoverage.totalAllocationCount}
            </div>
            <div className="md:col-span-3">
              <span className="text-muted">{t('actualWorkspace.statusSummary')}: </span>
              {renderFinalStatusSummary(t, finalResult.actualEntryStatusSummary)}
            </div>
            {finalResult.supportingMetrics.length > 0 ? (
              <div className="md:col-span-3">
                <span className="text-muted">{t('actualWorkspace.supportingMetrics')}: </span>
                {finalResult.supportingMetrics
                  .map(
                    (metric) =>
                      `${t(`metricCodes.${metric.metricCode}`)}: ${formatKpiNumber(
                        metric.metricCode,
                        metric.actualValue,
                      )}/${formatKpiNumber(metric.metricCode, metric.targetValue)} (${formatFinalAchievement(
                        metric.achievementPercent,
                      )})`,
                  )
                  .join(' | ')}
              </div>
            ) : null}
          </div>
          {finalResult.members.length > 0 ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('fields.member')}</th>
                    <th className="px-3 py-2 text-left">{t('actualWorkspace.revenueTarget')}</th>
                    <th className="px-3 py-2 text-left">{t('actualWorkspace.revenueActual')}</th>
                    <th className="px-3 py-2 text-left">{t('actualWorkspace.achievement')}</th>
                  </tr>
                </thead>
                <tbody>
                  {finalResult.members.map((member) => (
                    <tr key={member.allocationId} className="border-t border-border">
                      <td className="px-3 py-2">
                        {member.memberDisplayName ?? t('actualWorkspace.unnamedMember')}
                      </td>
                      <td className="px-3 py-2">
                        {formatKpiNumber('REVENUE_VND', member.revenue.targetValue)}
                      </td>
                      <td className="px-3 py-2">
                        {formatKpiNumber('REVENUE_VND', member.revenue.actualValue)}
                      </td>
                      <td className="px-3 py-2">
                        {formatFinalAchievement(member.revenue.achievementPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
};

const readAllocationWorkflowStatus = (
  plan: KpiPlanDetail,
): KpiAllocationStatus | 'NONE' | 'MIXED' => {
  if (plan.allocations.length === 0) {
    return 'NONE';
  }
  const statuses = new Set(plan.allocations.map((allocation) => allocation.allocationStatus));
  return statuses.size === 1 ? (plan.allocations[0]?.allocationStatus ?? 'NONE') : 'MIXED';
};

const readOrgUnitAllocationWorkflowStatus = (
  allocations: readonly KpiOrgUnitAllocation[],
): KpiAllocationStatus | 'NONE' | 'MIXED' => {
  if (allocations.length === 0) {
    return 'NONE';
  }
  const statuses = new Set(allocations.map((allocation) => allocation.allocationStatus));
  return statuses.size === 1 ? (allocations[0]?.allocationStatus ?? 'NONE') : 'MIXED';
};

const toDraftRows = (plan: KpiPlanDetail): AllocationDraftRow[] =>
  plan.allocations.length > 0
    ? plan.allocations.map((allocation) => ({
        employmentProfileId: allocation.memberEmploymentProfileId ?? '',
        allocationStartDate: allocation.allocationStartDate,
        note: allocation.note ?? '',
        values: Object.fromEntries(
          plan.targetMetrics.map((metric) => [
            metric.metricCode,
            formatKpiMetricInput(
              metric.metricCode,
              allocation.targetMetrics.find((item) => item.metricCode === metric.metricCode)
                ?.targetValue ?? 0,
            ),
          ]),
        ) as Partial<Record<KpiMetricCode, string>>,
      }))
    : [
        {
          employmentProfileId: '',
          allocationStartDate: toContractDate(plan.periodMonth),
          note: '',
          values: Object.fromEntries(
            plan.targetMetrics.map((metric) => [metric.metricCode, '0']),
          ) as Partial<Record<KpiMetricCode, string>>,
        },
      ];

const toOrgUnitDraftRows = (
  plan: KpiPlanDetail,
  allocations: readonly KpiOrgUnitAllocation[],
): AllocationDraftRow[] =>
  allocations.length > 0
    ? allocations.map((allocation) => ({
        employmentProfileId: allocation.memberEmploymentProfileId,
        allocationStartDate: allocation.allocationStartDate,
        note: allocation.note ?? '',
        values: Object.fromEntries(
          plan.targetMetrics.map((metric) => [
            metric.metricCode,
            formatKpiMetricInput(
              metric.metricCode,
              allocation.targetMetrics.find((item) => item.metricCode === metric.metricCode)
                ?.targetValue ?? 0,
            ),
          ]),
        ) as Partial<Record<KpiMetricCode, string>>,
      }))
    : [
        {
          employmentProfileId: '',
          allocationStartDate: toContractDate(plan.periodMonth),
          note: '',
          values: Object.fromEntries(
            plan.targetMetrics.map((metric) => [metric.metricCode, '0']),
          ) as Partial<Record<KpiMetricCode, string>>,
        },
      ];

const KpiOrgUnitOperationsSection = ({ plan }: { plan: KpiPlanDetail }): JSX.Element => {
  const { t } = useTranslation(['kpi', 'common']);
  const { notifyError, notifySuccess } = useMutationFeedback();
  const [actualDate, setActualDate] = useState(() => currentHcmDate());
  const [loadedActualDate, setLoadedActualDate] = useState<string>();
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const [actualError, setActualError] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<OrgUnitCorrectionTarget | null>(null);
  const [correctedValue, setCorrectedValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [excuseDraft, setExcuseDraft] = useState<OrgUnitExcuseDraft | null>(null);
  const [allocationDraftRows, setAllocationDraftRows] = useState<AllocationDraftRow[]>([]);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const allocationsQuery = useKpiOrgUnitAllocations(plan.id, { limit: 100 });
  const managedMembersQuery = useKpiOrgUnitManagedMembers(plan.id, { limit: 20 });
  const progressQuery = useKpiOrgUnitProgress(plan.status === 'PUBLISHED' ? plan.id : undefined);
  const actualGridQuery = useKpiOrgUnitActualGrid(plan.id, loadedActualDate);
  const finalResultQuery = useKpiOrgUnitFinalResult(
    plan.status === 'FINALIZED' ? plan.id : undefined,
  );
  const createActualMutation = useCreateKpiOrgUnitActualMutation();
  const updateActualMutation = useUpdateKpiOrgUnitActualMutation();
  const markExcuseMutation = useMarkKpiOrgUnitActualExcuseMutation();
  const unmarkExcuseMutation = useUnmarkKpiOrgUnitActualExcuseMutation();
  const createCorrectionMutation = useCreateKpiOrgUnitCorrectionMutation();
  const allocationDraftMutation = useUpsertKpiAllocationDraftMutation();
  const allocationSubmitMutation = useSubmitKpiAllocationDraftMutation();
  const allocationApproveMutation = useApproveKpiAllocationMutation();
  const allocationRejectMutation = useRejectKpiAllocationMutation();
  const allocationPublishMutation = usePublishKpiAllocationMutation();
  const correctionHistoryQuery = useKpiOrgUnitCorrectionHistory(
    plan.id,
    correctionTarget?.cell.actualEntryId ?? undefined,
  );
  const capabilitiesQuery = useCurrentActorCapabilities();
  const capabilityCopy = useMemo(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      unavailable: t('kpi:states.capabilityUnavailable'),
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
  const managerAllocationDraftHint = createKpiActionCapabilityHint(
    capabilityState,
    'draftAllocation',
    capabilityCopy,
  );
  const managerAllocationSubmitHint = createKpiActionCapabilityHint(
    capabilityState,
    'submitAllocation',
    capabilityCopy,
  );
  const allocationApproveHint = createKpiActionCapabilityHint(
    capabilityState,
    'approveAllocation',
    capabilityCopy,
  );
  const allocationRejectHint = createKpiActionCapabilityHint(
    capabilityState,
    'rejectAllocation',
    capabilityCopy,
  );
  const allocationPublishHint = createKpiActionCapabilityHint(
    capabilityState,
    'publishAllocation',
    capabilityCopy,
  );

  const allocations = useMemo(() => allocationsQuery.data ?? [], [allocationsQuery.data]);
  const allocationById = useMemo(
    () => new Map(allocations.map((allocation) => [allocation.id, allocation])),
    [allocations],
  );
  const memberByEmploymentProfileId = useMemo(
    () =>
      new Map(
        (managedMembersQuery.data ?? []).map((member) => [member.employmentProfileId, member]),
      ),
    [managedMembersQuery.data],
  );
  const canAttemptWrite = plan.status === 'PUBLISHED' && enterActualHint.allowed;
  const canAttemptCorrection = plan.status === 'PUBLISHED' && correctActualHint.allowed;
  const finalResult = finalResultQuery.data?.finalResult ?? plan.finalResult ?? null;
  const allocationWorkflowStatus = readOrgUnitAllocationWorkflowStatus(allocations);
  const allocationIsOfficial =
    allocationWorkflowStatus !== 'NONE' &&
    allocationWorkflowStatus !== 'MIXED' &&
    officialAllocationStatuses.has(allocationWorkflowStatus);
  const allocationPlanStateDisabledReason =
    plan.status === 'FINALIZED'
      ? t('kpi:errors.finalizedReadOnly')
      : plan.status !== 'PUBLISHED'
        ? t('kpi:disabled.allocationPlanPublishedOnly')
        : undefined;
  const allocationDraftDisabledReason =
    allocationPlanStateDisabledReason ??
    (allocationWorkflowStatus !== 'DRAFT' && allocationWorkflowStatus !== 'NONE'
      ? t('kpi:disabled.allocationDraftOnly')
      : undefined);
  const allocationSubmitDisabledReason =
    allocationPlanStateDisabledReason ??
    (allocationWorkflowStatus !== 'DRAFT'
      ? t('kpi:disabled.allocationSubmitDraftOnly')
      : undefined);
  const allocationApproveDisabledReason =
    allocationPlanStateDisabledReason ??
    (allocationWorkflowStatus !== 'PENDING_APPROVAL'
      ? t('kpi:disabled.allocationApprovePendingOnly')
      : undefined);
  const allocationPublishDisabledReason =
    allocationWorkflowStatus !== 'APPROVED'
      ? t('kpi:disabled.allocationPublishApprovedOnly')
      : undefined;

  useEffect(() => {
    if (!actualGridQuery.data) {
      return;
    }
    setCellDrafts(
      Object.fromEntries(
        actualGridQuery.data.rows.flatMap((row) =>
          row.metrics.map((cell) => [
            orgUnitCellKey(row, cell),
            cell.actualEntryId ? formatKpiMetricInput(cell.metricCode, cell.effectiveValue) : '',
          ]),
        ),
      ),
    );
  }, [actualGridQuery.data]);

  useEffect(() => {
    setAllocationDraftRows(toOrgUnitDraftRows(plan, allocations));
  }, [allocations, plan]);

  const saveAllocationDraft = async (): Promise<void> => {
    setAllocationError(null);
    if (managerAllocationDraftHint.disabled || allocationDraftDisabledReason) {
      setAllocationError(
        managerAllocationDraftHint.disabledReason ?? allocationDraftDisabledReason ?? null,
      );
      return;
    }
    let invalidMetric = false;
    const rows = allocationDraftRows.map((row) => ({
      employmentProfileId: row.employmentProfileId.trim(),
      allocationStartDate: row.allocationStartDate.trim(),
      allocationEndDate: null,
      note: row.note.trim() || null,
      targetMetrics: plan.targetMetrics.map((metric) => {
        const parsed = parseKpiMetricInput(metric.metricCode, row.values[metric.metricCode] ?? '');
        if (parsed === undefined) {
          invalidMetric = true;
        }
        return { metricCode: metric.metricCode, targetValue: parsed ?? 0 };
      }),
    }));
    if (invalidMetric) {
      setAllocationError(t('kpi:validation.invalidMetricValue'));
      return;
    }
    if (rows.some((row) => !row.employmentProfileId)) {
      setAllocationError(t('kpi:validation.employmentProfileRequired'));
      return;
    }
    try {
      await allocationDraftMutation.mutateAsync({ kpiPlanId: plan.id, allocations: rows });
      notifySuccess('kpi:feedback.allocationDraftSaved');
    } catch (error) {
      setAllocationError((error as Error | NormalizedApiError).message);
    }
  };

  const submitAllocationDraft = async (): Promise<void> => {
    setAllocationError(null);
    if (managerAllocationSubmitHint.disabled || allocationSubmitDisabledReason) {
      setAllocationError(
        managerAllocationSubmitHint.disabledReason ?? allocationSubmitDisabledReason ?? null,
      );
      return;
    }
    try {
      await allocationSubmitMutation.mutateAsync({ kpiPlanId: plan.id });
      notifySuccess('kpi:feedback.allocationSubmitted');
    } catch (error) {
      setAllocationError((error as Error | NormalizedApiError).message);
    }
  };

  const approveAllocation = async (): Promise<void> => {
    setAllocationError(null);
    try {
      await allocationApproveMutation.mutateAsync({
        kpiPlanId: plan.id,
        approvalNote: approvalNote.trim() || null,
      });
      notifySuccess('kpi:feedback.allocationApproved');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const rejectAllocation = async (): Promise<void> => {
    setAllocationError(null);
    if (!rejectionReason.trim()) {
      setAllocationError(t('kpi:validation.reasonRequired'));
      return;
    }
    try {
      await allocationRejectMutation.mutateAsync({
        kpiPlanId: plan.id,
        rejectionReason: rejectionReason.trim(),
      });
      notifySuccess('kpi:feedback.allocationRejected');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const publishAllocation = async (): Promise<void> => {
    setAllocationError(null);
    try {
      await allocationPublishMutation.mutateAsync({ kpiPlanId: plan.id });
      notifySuccess('kpi:feedback.allocationPublished');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const openActualGrid = (): void => {
    setActualError(null);
    setCorrectionTarget(null);
    setExcuseDraft(null);
    if (!isStrictKpiDate(actualDate)) {
      setActualError(t('kpi:validation.invalidActualDate'));
      return;
    }
    setLoadedActualDate(actualDate);
  };

  const saveActuals = async (): Promise<void> => {
    setActualError(null);
    const grid = actualGridQuery.data;
    if (!grid) {
      return;
    }
    if (enterActualHint.disabled) {
      setActualError(enterActualHint.disabledReason ?? t('kpi:states.capabilityUnavailable'));
      return;
    }

    const changedCells = grid.rows.flatMap((row) =>
      row.metrics
        .map((cell) => ({ row, cell, draft: cellDrafts[orgUnitCellKey(row, cell)] }))
        .filter(({ cell, draft }) => {
          if (draft === undefined || isOrgUnitCellBlockedByException(cell)) {
            return false;
          }
          if (!cell.actualEntryId) {
            return draft.trim().length > 0;
          }
          return draft !== formatKpiMetricInput(cell.metricCode, cell.effectiveValue);
        }),
    );
    if (changedCells.length === 0) {
      setActualError(t('kpi:orgUnitOperations.noActualChanges'));
      return;
    }

    try {
      for (const { cell, row, draft } of changedCells) {
        const parsed = parseKpiMetricInput(cell.metricCode, draft ?? '');
        if (parsed === undefined) {
          setActualError(t('kpi:validation.invalidMetricValue'));
          return;
        }
        if (cell.actualEntryId && cell.canDirectEdit) {
          await updateActualMutation.mutateAsync({
            kpiPlanId: plan.id,
            actualEntryId: cell.actualEntryId,
            actualValue: parsed,
          });
        } else if (!cell.actualEntryId && cell.canMarkExcused) {
          await createActualMutation.mutateAsync({
            kpiPlanId: plan.id,
            allocationId: row.allocationId,
            metricCode: cell.metricCode,
            actualDate: grid.actualDate,
            actualValue: parsed,
          });
        }
      }
      notifySuccess('kpi:feedback.actualSaved');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const openCorrection = (row: KpiOrgUnitActualGridRow, cell: KpiActualGridMetricCell): void => {
    setCorrectionTarget({ row, cell });
    setCorrectedValue(formatKpiMetricInput(cell.metricCode, cell.effectiveValue));
    setCorrectionReason('');
  };

  const submitCorrection = async (): Promise<void> => {
    setActualError(null);
    if (!correctionTarget?.cell.actualEntryId) {
      setActualError(t('kpi:validation.missingActualEntry'));
      return;
    }
    if (correctActualHint.disabled) {
      setActualError(correctActualHint.disabledReason ?? t('kpi:states.capabilityUnavailable'));
      return;
    }
    if (!correctionTarget.cell.requiresCorrection) {
      setActualError(correctionTarget.cell.disabledReason ?? t('kpi:actualEntry.directEdit'));
      return;
    }
    const parsed = parseKpiMetricInput(correctionTarget.cell.metricCode, correctedValue);
    if (parsed === undefined) {
      setActualError(t('kpi:validation.invalidMetricValue'));
      return;
    }
    if (!correctionReason.trim()) {
      setActualError(t('kpi:validation.reasonRequired'));
      return;
    }
    try {
      await createCorrectionMutation.mutateAsync({
        kpiPlanId: plan.id,
        actualEntryId: correctionTarget.cell.actualEntryId,
        correctedValue: parsed,
        reason: correctionReason.trim(),
      });
      notifySuccess('kpi:feedback.correctionCreated');
      setCorrectionReason('');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const submitExcuse = async (): Promise<void> => {
    setActualError(null);
    if (!excuseDraft?.reasonCode || !excuseDraft.reasonText.trim()) {
      setActualError(t('kpi:validation.reasonRequired'));
      return;
    }
    try {
      await markExcuseMutation.mutateAsync({
        kpiPlanId: plan.id,
        allocationId: excuseDraft.allocationId,
        metricCode: excuseDraft.metricCode,
        actualDate: loadedActualDate ?? actualDate,
        status: excuseDraft.status,
        reasonCode: excuseDraft.reasonCode,
        reasonText: excuseDraft.reasonText.trim(),
      });
      notifySuccess('kpi:feedback.excuseMarked');
      setExcuseDraft(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  return (
    <MetadataSection title={t('kpi:orgUnitOperations.title')}>
      <div className="space-y-5" data-testid="org-unit-operations">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-border p-3 text-sm">
            <div className="text-xs uppercase text-muted">{t('kpi:orgUnitOperations.context')}</div>
            <div>{plan.subjectRef?.displayName ?? plan.subjectRef?.name ?? '-'}</div>
          </div>
          <div className="rounded border border-border p-3 text-sm">
            <div className="text-xs uppercase text-muted">{t('kpi:fields.status')}</div>
            <div>{t(`kpi:statuses.${plan.status}`)}</div>
          </div>
          <div className="rounded border border-border p-3 text-sm">
            <div className="text-xs uppercase text-muted">{t('kpi:fields.periodMonth')}</div>
            <div>{plan.periodMonth}</div>
          </div>
          <div className="rounded border border-border p-3 text-sm">
            <div className="text-xs uppercase text-muted">
              {t('kpi:orgUnitOperations.writePosture')}
            </div>
            <div>
              {canAttemptWrite
                ? t('kpi:orgUnitOperations.writeAvailable')
                : t('kpi:orgUnitOperations.readOnly')}
            </div>
          </div>
        </div>

        <section className="space-y-3" aria-label={t('kpi:orgUnitOperations.allocations')}>
          <div>
            <h3 className="text-sm font-semibold">{t('kpi:orgUnitOperations.allocations')}</h3>
            <p className="text-sm text-muted">{t('kpi:orgUnitOperations.allocationReadOnly')}</p>
          </div>
          {allocationError ? (
            <p className="text-sm text-danger" role="alert">
              {allocationError}
            </p>
          ) : null}
          <div className="space-y-2 rounded border border-border bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t('kpi:allocation.workflowStatus')}</span>
              <StatusBadge label={t(`kpi:allocationStatuses.${allocationWorkflowStatus}`)} />
              {allocationIsOfficial ? (
                <span className="text-muted">{t('kpi:allocation.official')}</span>
              ) : (
                <span className="text-muted">{t('kpi:allocation.notOfficialUntilPublished')}</span>
              )}
            </div>
            {managerAllocationDraftHint.allowed ? (
              <div className="space-y-3">
                {allocationPlanStateDisabledReason ? (
                  <p className="text-sm text-danger">{allocationPlanStateDisabledReason}</p>
                ) : null}
                <div className="overflow-x-auto rounded border border-border bg-panel">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left">{t('kpi:fields.managedMember')}</th>
                        {plan.targetMetrics.map((metric) => (
                          <th key={metric.metricCode} className="px-3 py-2 text-left">
                            {t(`kpi:metricCodes.${metric.metricCode}`)}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-left">{t('kpi:fields.note')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationDraftRows.map((row, rowIndex) => (
                        <tr
                          key={`${row.employmentProfileId}-${rowIndex}`}
                          className="border-t border-border"
                        >
                          <td className="min-w-[240px] px-3 py-2">
                            <select
                              aria-label={`${t('kpi:fields.managedMember')} ${rowIndex + 1}`}
                              value={row.employmentProfileId}
                              disabled={Boolean(allocationDraftDisabledReason)}
                              className="w-full rounded border border-border bg-panel px-2 py-1 disabled:opacity-50"
                              onChange={(event) =>
                                setAllocationDraftRows((current) =>
                                  current.map((item, index) =>
                                    index === rowIndex
                                      ? { ...item, employmentProfileId: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="">{t('kpi:filters.managedMemberPlaceholder')}</option>
                              {(managedMembersQuery.data ?? []).map((member) => (
                                <option
                                  key={member.employmentProfileId}
                                  value={member.employmentProfileId}
                                >
                                  {member.employeeCode
                                    ? `${member.displayName} - ${member.employeeCode}`
                                    : member.displayName}
                                </option>
                              ))}
                            </select>
                          </td>
                          {plan.targetMetrics.map((metric) => {
                            const selectedMember = memberByEmploymentProfileId.get(
                              row.employmentProfileId,
                            );
                            return (
                              <td key={metric.metricCode} className="px-3 py-2">
                                <input
                                  aria-label={`${selectedMember?.displayName ?? t('kpi:fields.member')} ${t(
                                    `kpi:metricCodes.${metric.metricCode}`,
                                  )}`}
                                  value={row.values[metric.metricCode] ?? ''}
                                  disabled={Boolean(allocationDraftDisabledReason)}
                                  className="w-32 rounded border border-border bg-panel px-2 py-1 disabled:opacity-50"
                                  onChange={(event) =>
                                    setAllocationDraftRows((current) =>
                                      current.map((item, index) =>
                                        index === rowIndex
                                          ? {
                                              ...item,
                                              values: {
                                                ...item.values,
                                                [metric.metricCode]: event.target.value,
                                              },
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-2">
                            <input
                              aria-label={`${t('kpi:fields.note')} ${rowIndex + 1}`}
                              value={row.note}
                              disabled={Boolean(allocationDraftDisabledReason)}
                              className="w-48 rounded border border-border bg-panel px-2 py-1 disabled:opacity-50"
                              onChange={(event) =>
                                setAllocationDraftRows((current) =>
                                  current.map((item, index) =>
                                    index === rowIndex
                                      ? { ...item, note: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={Boolean(allocationDraftDisabledReason)}
                    onClick={() =>
                      setAllocationDraftRows((current) => [
                        ...current,
                        {
                          employmentProfileId: '',
                          allocationStartDate: toContractDate(plan.periodMonth),
                          note: '',
                          values: Object.fromEntries(
                            plan.targetMetrics.map((metric) => [metric.metricCode, '0']),
                          ) as Partial<Record<KpiMetricCode, string>>,
                        },
                      ])
                    }
                  >
                    {t('kpi:actions.addAllocationMember')}
                  </button>
                  <button
                    type="button"
                    disabled={
                      allocationDraftMutation.isPending ||
                      managerAllocationDraftHint.disabled ||
                      Boolean(allocationDraftDisabledReason)
                    }
                    title={
                      managerAllocationDraftHint.disabledReason ?? allocationDraftDisabledReason
                    }
                    className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    onClick={() => void saveAllocationDraft()}
                  >
                    {t('kpi:actions.saveAllocationDraft')}
                  </button>
                  <button
                    type="button"
                    disabled={
                      allocationSubmitMutation.isPending ||
                      managerAllocationSubmitHint.disabled ||
                      Boolean(allocationSubmitDisabledReason)
                    }
                    title={
                      managerAllocationSubmitHint.disabledReason ?? allocationSubmitDisabledReason
                    }
                    className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    onClick={() => void submitAllocationDraft()}
                  >
                    {t('kpi:actions.submitAllocation')}
                  </button>
                </div>
              </div>
            ) : null}
            {!allocationApproveHint.hidden || !allocationPublishHint.hidden ? (
              <div className="space-y-3 rounded border border-border bg-panel p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span>{t('kpi:fields.approvalNote')}</span>
                    <input
                      value={approvalNote}
                      className="rounded border border-border bg-panel px-2 py-1.5"
                      onChange={(event) => setApprovalNote(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>{t('kpi:fields.rejectionReason')}</span>
                    <input
                      value={rejectionReason}
                      className="rounded border border-border bg-panel px-2 py-1.5"
                      onChange={(event) => setRejectionReason(event.target.value)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!allocationApproveHint.hidden ? (
                    <button
                      type="button"
                      disabled={
                        allocationApproveMutation.isPending ||
                        allocationApproveHint.disabled ||
                        Boolean(allocationApproveDisabledReason)
                      }
                      title={
                        allocationApproveHint.disabledReason ?? allocationApproveDisabledReason
                      }
                      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      onClick={() => void approveAllocation()}
                    >
                      {t('kpi:actions.approveAllocation')}
                    </button>
                  ) : null}
                  {!allocationRejectHint.hidden ? (
                    <button
                      type="button"
                      disabled={
                        allocationRejectMutation.isPending ||
                        allocationRejectHint.disabled ||
                        Boolean(allocationApproveDisabledReason)
                      }
                      title={allocationRejectHint.disabledReason ?? allocationApproveDisabledReason}
                      className="rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
                      onClick={() => void rejectAllocation()}
                    >
                      {t('kpi:actions.rejectAllocation')}
                    </button>
                  ) : null}
                  {!allocationPublishHint.hidden ? (
                    <button
                      type="button"
                      disabled={
                        allocationPublishMutation.isPending ||
                        allocationPublishHint.disabled ||
                        Boolean(allocationPublishDisabledReason)
                      }
                      title={
                        allocationPublishHint.disabledReason ?? allocationPublishDisabledReason
                      }
                      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      onClick={() => void publishAllocation()}
                    >
                      {t('kpi:actions.publishAllocation')}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          {allocationsQuery.isError ? (
            <p className="text-sm text-danger">{t('kpi:states.allocationUnavailable')}</p>
          ) : allocations.length > 0 ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.employeeCode')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.allocationStatus')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:progress.target')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((allocation) => {
                    const member = memberByEmploymentProfileId.get(
                      allocation.memberEmploymentProfileId,
                    );
                    return (
                      <tr key={allocation.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          {member?.displayName ??
                            displayOrgUnitMember(
                              allocation,
                              t('kpi:actualWorkspace.unnamedMember'),
                            )}
                        </td>
                        <td className="px-3 py-2">{member?.employeeCode ?? '-'}</td>
                        <td className="px-3 py-2">
                          {t(`kpi:allocationStatuses.${allocation.allocationStatus}`)}
                        </td>
                        <td className="px-3 py-2">
                          {allocation.targetMetrics
                            .map(
                              (metric) =>
                                `${t(`kpi:metricCodes.${metric.metricCode}`)}: ${formatKpiNumber(
                                  metric.metricCode,
                                  metric.targetValue,
                                )}`,
                            )
                            .join(' | ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
              {allocationsQuery.isPending
                ? t('kpi:states.loading')
                : t('kpi:orgUnitOperations.noAllocations')}
            </div>
          )}
          <div className="rounded border border-border p-3 text-sm">
            <div className="font-medium">{t('kpi:orgUnitOperations.managedMemberPicker')}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(managedMembersQuery.data ?? []).map((member) => (
                <span
                  key={member.employmentProfileId}
                  className="rounded border border-border px-2 py-1"
                >
                  {member.employeeCode
                    ? `${member.displayName} - ${member.employeeCode}`
                    : member.displayName}
                </span>
              ))}
              {managedMembersQuery.isPending ? (
                <span className="text-muted">{t('kpi:states.loading')}</span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-3" aria-label={t('kpi:orgUnitOperations.progressActuals')}>
          <h3 className="text-sm font-semibold">{t('kpi:orgUnitOperations.progressActuals')}</h3>
          {plan.status !== 'PUBLISHED' ? (
            <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
              {plan.status === 'FINALIZED'
                ? t('kpi:errors.finalizedReadOnly')
                : t('kpi:orgUnitOperations.draftReadOnly')}
            </div>
          ) : progressQuery.data ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">{t('kpi:progress.elapsed')}</div>
                  <div>{progressQuery.data.periodElapsedPercent.toFixed(1)}%</div>
                </div>
                {progressQuery.data.groupTotals.map((metric) => (
                  <div key={metric.metricCode} className="rounded border border-border p-3 text-sm">
                    <div className="text-xs uppercase text-muted">
                      {t(`kpi:metricCodes.${metric.metricCode}`)}
                    </div>
                    <div>
                      {formatKpiNumber(metric.metricCode, metric.actualValue)} /{' '}
                      {formatKpiNumber(metric.metricCode, metric.targetValue)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto rounded border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                      <th className="px-3 py-2 text-left">{t('kpi:fields.metricCode')}</th>
                      <th className="px-3 py-2 text-left">{t('kpi:progress.actual')}</th>
                      <th className="px-3 py-2 text-left">{t('kpi:progress.percent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressQuery.data.memberProgress.map((row) => (
                      <tr
                        key={`${row.allocationId}-${row.metricCode}`}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2">
                          {displayOrgUnitMember(
                            allocationById.get(row.allocationId),
                            t('kpi:actualWorkspace.unnamedMember'),
                          )}
                        </td>
                        <td className="px-3 py-2">{t(`kpi:metricCodes.${row.metricCode}`)}</td>
                        <td className="px-3 py-2">
                          {formatKpiNumber(row.metricCode, row.actualValue)}
                        </td>
                        <td className="px-3 py-2">
                          {row.progressPercent === null ? '-' : `${row.progressPercent}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : progressQuery.isError ? (
            <p className="text-sm text-danger">{t('kpi:states.progressUnavailable')}</p>
          ) : (
            <LoadingState lines={3} />
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('kpi:fields.actualDate')}</span>
              <input
                value={actualDate}
                className="rounded border border-border bg-panel px-2 py-1.5"
                onChange={(event) => {
                  setActualDate(event.target.value);
                  setLoadedActualDate(undefined);
                  setCorrectionTarget(null);
                  setExcuseDraft(null);
                }}
              />
            </label>
            <button
              type="button"
              disabled={plan.status !== 'PUBLISHED'}
              className="rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
              onClick={openActualGrid}
            >
              {t('kpi:actions.loadGrid')}
            </button>
          </div>
          {actualError ? (
            <p className="text-sm text-danger" role="alert">
              {actualError}
            </p>
          ) : null}
          {loadedActualDate && actualGridQuery.isPending ? <LoadingState lines={3} /> : null}
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
                      {row.metrics.map((cell) => {
                        const key = orgUnitCellKey(row, cell);
                        const blockedByException = isOrgUnitCellBlockedByException(cell);
                        const inputDisabled =
                          !canAttemptWrite ||
                          enterActualHint.disabled ||
                          actualGridQuery.data.editability.isPlanFinalized ||
                          blockedByException ||
                          (!cell.canDirectEdit && Boolean(cell.actualEntryId));
                        return (
                          <td key={cell.metricCode} className="space-y-2 px-3 py-2 align-top">
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
                              value={cellDrafts[key] ?? ''}
                              disabled={inputDisabled}
                              className="w-36 rounded border border-border bg-panel px-2 py-1 disabled:opacity-50"
                              onChange={(event) =>
                                setCellDrafts((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                            />
                            <div className="text-xs text-muted">
                              {blockedByException
                                ? t('kpi:errors.correctionActiveExcuse')
                                : (cell.disabledReason ?? t('kpi:actualEntry.directEdit'))}
                            </div>
                            {canAttemptCorrection &&
                            cell.actualEntryId &&
                            cell.requiresCorrection &&
                            !blockedByException &&
                            !actualGridQuery.data.editability.isPlanFinalized ? (
                              <button
                                type="button"
                                disabled={correctActualHint.disabled}
                                title={correctActualHint.disabledReason}
                                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                                onClick={() => openCorrection(row, cell)}
                              >
                                {t('kpi:actions.correction')}
                              </button>
                            ) : null}
                            {canAttemptWrite && cell.canMarkExcused ? (
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="rounded border border-border px-2 py-1 text-xs"
                                  onClick={() =>
                                    setExcuseDraft({
                                      cellKey: key,
                                      allocationId: row.allocationId,
                                      metricCode: cell.metricCode,
                                      status: 'EXCUSED',
                                      reasonCode: '',
                                      reasonText: '',
                                    })
                                  }
                                >
                                  {t('kpi:actions.markExcused')}
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-border px-2 py-1 text-xs"
                                  onClick={() =>
                                    setExcuseDraft({
                                      cellKey: key,
                                      allocationId: row.allocationId,
                                      metricCode: cell.metricCode,
                                      status: 'NOT_REQUIRED',
                                      reasonCode: '',
                                      reasonText: '',
                                    })
                                  }
                                >
                                  {t('kpi:actions.markNotRequired')}
                                </button>
                              </div>
                            ) : null}
                            {canAttemptWrite && cell.canUnmarkExcused && cell.actualExcuse ? (
                              <button
                                type="button"
                                disabled={unmarkExcuseMutation.isPending}
                                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                                onClick={() => {
                                  void unmarkExcuseMutation
                                    .mutateAsync({
                                      kpiPlanId: plan.id,
                                      excuseId: cell.actualExcuse?.id ?? '',
                                    })
                                    .then(() => notifySuccess('kpi:feedback.excuseUnmarked'))
                                    .catch((error: unknown) =>
                                      notifyError(error as NormalizedApiError),
                                    );
                                }}
                              >
                                {t('kpi:actions.unmarkExcuse')}
                              </button>
                            ) : null}
                            {excuseDraft?.cellKey === key ? (
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
                                    disabled={markExcuseMutation.isPending}
                                    className="rounded border border-accent bg-accent px-2 py-1 text-xs text-white disabled:opacity-50"
                                    onClick={() => void submitExcuse()}
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
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {canAttemptWrite ? (
                <div className="p-3">
                  <button
                    type="button"
                    disabled={
                      enterActualHint.disabled ||
                      createActualMutation.isPending ||
                      updateActualMutation.isPending
                    }
                    title={enterActualHint.disabledReason}
                    className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    onClick={() => void saveActuals()}
                  >
                    {t('kpi:actions.saveChangedCells')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : actualGridQuery.isError ? (
            <p className="text-sm text-danger">{t('kpi:states.actualGridLoadErrorMessage')}</p>
          ) : null}
        </section>

        {correctionTarget ? (
          <section
            role="dialog"
            aria-label={t('kpi:correction.title')}
            className="space-y-3 rounded border border-border bg-panel p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('kpi:correction.title')}</h3>
                <p className="text-sm text-muted">
                  {correctionTarget.row.memberDisplayName ?? t('kpi:actualWorkspace.unnamedMember')}{' '}
                  - {t(`kpi:metricCodes.${correctionTarget.cell.metricCode}`)}
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-sm"
                onClick={() => setCorrectionTarget(null)}
              >
                {t('common:actions.close')}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border border-border p-3 text-sm">
                <div className="text-xs uppercase text-muted">
                  {t('kpi:correction.previousValue')}
                </div>
                <div>
                  {formatKpiNumber(
                    correctionTarget.cell.metricCode,
                    correctionTarget.cell.effectiveValue,
                  )}
                </div>
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
                  value={correctionReason}
                  className="rounded border border-border bg-panel px-2 py-1.5"
                  onChange={(event) => setCorrectionReason(event.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={correctActualHint.disabled || createCorrectionMutation.isPending}
              title={correctActualHint.disabledReason}
              className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void submitCorrection()}
            >
              {t('kpi:actions.submitCorrection')}
            </button>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('kpi:correction.history')}</h4>
              {correctionHistoryQuery.data?.length ? (
                correctionHistoryQuery.data.map((item) => (
                  <div key={item.id} className="rounded border border-border p-2 text-sm">
                    {formatKpiNumber(item.metricCode, item.previousValue)} {'->'}{' '}
                    {formatKpiNumber(item.metricCode, item.correctedValue)} - {item.reason}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">{t('kpi:correction.emptyHistory')}</p>
              )}
            </div>
          </section>
        ) : null}

        <section className="space-y-3" aria-label={t('kpi:orgUnitOperations.finalResult')}>
          <h3 className="text-sm font-semibold">{t('kpi:orgUnitOperations.finalResult')}</h3>
          {plan.status !== 'FINALIZED' ? (
            <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
              {t('kpi:states.notFinalizedYet')}
            </div>
          ) : finalResultQuery.isError ? (
            <p className="text-sm text-danger">{t('kpi:finalResult.unavailable')}</p>
          ) : (
            <KpiFinalResultSnapshotSection status={plan.status} finalResult={finalResult} />
          )}
        </section>
      </div>
    </MetadataSection>
  );
};

export const KpiDetailPage = (): JSX.Element => {
  const { kpiPlanId } = useParams<{ kpiPlanId: string }>();
  const { t } = useTranslation(['kpi', 'common']);
  const detailQuery = useKpiPlanDetail(kpiPlanId);
  const loadedPlan = detailQuery.data;
  const canLoadManagedMembers = Boolean(
    kpiPlanId && loadedPlan?.status === 'PUBLISHED' && loadedPlan.subjectType === 'TALENT_GROUP',
  );
  const canLoadKpiProgress = Boolean(
    kpiPlanId && loadedPlan?.status === 'PUBLISHED' && loadedPlan.subjectType === 'TALENT_GROUP',
  );
  const progressQuery = useKpiProgress(canLoadKpiProgress ? kpiPlanId : undefined);
  const lifecycleMutation = useKpiLifecycleMutation();
  const allocationsMutation = useReplaceKpiAllocationsMutation();
  const allocationDraftMutation = useUpsertKpiAllocationDraftMutation();
  const allocationSubmitMutation = useSubmitKpiAllocationDraftMutation();
  const allocationApproveMutation = useApproveKpiAllocationMutation();
  const allocationRejectMutation = useRejectKpiAllocationMutation();
  const allocationPublishMutation = usePublishKpiAllocationMutation();
  const capabilitiesQuery = useCurrentActorCapabilities();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestConfirm = useDestructiveConfirm();
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationDraftRows, setAllocationDraftRows] = useState<AllocationDraftRow[]>([]);
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const loadManagedMemberOptions = useCallback(
    async (search: string): Promise<ReferenceOption[]> => {
      if (!canLoadManagedMembers || !kpiPlanId) {
        return [];
      }

      const items = await fetchKpiManagedMembers(kpiPlanId ?? '', { search, limit: 20 });
      return items.map((item) => ({
        id: item.employmentProfileId,
        label: item.employeeCode ? `${item.displayName} - ${item.employeeCode}` : item.displayName,
        description: [item.talentCode, item.groupId].filter(Boolean).join(' - ') || undefined,
      }));
    },
    [canLoadManagedMembers, kpiPlanId],
  );

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );
  const kpiCapabilityCopy = useMemo(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      unavailable: t('kpi:states.capabilityUnavailable'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  useEffect(() => {
    if (detailQuery.data) {
      setAllocationDraftRows(toDraftRows(detailQuery.data));
    }
  }, [detailQuery.data]);

  if (detailQuery.isPending) {
    return <LoadingState lines={8} />;
  }

  const detailError = detailQuery.error as NormalizedApiError | null;
  if (detailQuery.isError) {
    return detailError?.permissionDenied ? (
      <PermissionDeniedState />
    ) : (
      <ErrorState
        title={t('kpi:states.loadErrorTitle')}
        message={detailError?.message ?? t('kpi:states.loadErrorMessage')}
        actionLabel={t('common:actions.retry')}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const plan = detailQuery.data;
  if (!plan) {
    return (
      <ErrorState
        title={t('kpi:states.loadErrorTitle')}
        message={t('kpi:states.loadErrorMessage')}
      />
    );
  }

  const capabilityState = {
    capabilities: capabilitiesQuery.data,
    isLoading: capabilitiesQuery.isLoading,
    isError: capabilitiesQuery.isError,
  };
  const lifecycleScope = { module: 'kpi' as const, value: 'global' as const };
  const publishHint = createActionCapabilityHint(
    capabilityState,
    { permission: PERMISSIONS.KPI_PUBLISH, scope: lifecycleScope },
    capabilityCopy,
  );
  const finalizeHint = createActionCapabilityHint(
    capabilityState,
    { permission: PERMISSIONS.KPI_FINALIZE, scope: lifecycleScope },
    capabilityCopy,
  );
  const archiveHint = createActionCapabilityHint(
    capabilityState,
    { permission: PERMISSIONS.KPI_ARCHIVE, scope: lifecycleScope },
    capabilityCopy,
  );
  const allocationHint = createActionCapabilityHint(
    capabilityState,
    { permission: PERMISSIONS.KPI_MANAGE_ALLOCATION, scope: lifecycleScope },
    capabilityCopy,
  );
  const draftHint = createActionCapabilityHint(
    capabilityState,
    { permission: PERMISSIONS.KPI_UPDATE_DRAFT, scope: lifecycleScope },
    capabilityCopy,
  );
  const managerAllocationDraftHint = createKpiActionCapabilityHint(
    capabilityState,
    'draftAllocation',
    kpiCapabilityCopy,
  );
  const managerAllocationSubmitHint = createKpiActionCapabilityHint(
    capabilityState,
    'submitAllocation',
    kpiCapabilityCopy,
  );
  const allocationApproveHint = createActionCapabilityHint(
    capabilityState,
    { permission: PERMISSIONS.KPI_MANAGE_ALLOCATION, scope: lifecycleScope },
    capabilityCopy,
  );
  const allocationRejectHint = createActionCapabilityHint(
    capabilityState,
    { permission: PERMISSIONS.KPI_MANAGE_ALLOCATION, scope: lifecycleScope },
    capabilityCopy,
  );
  const allocationPublishHint = createActionCapabilityHint(
    capabilityState,
    { permission: PERMISSIONS.KPI_PUBLISH, scope: lifecycleScope },
    capabilityCopy,
  );

  const runLifecycle = async (action: 'publish' | 'finalize' | 'archive'): Promise<void> => {
    const confirmed = await requestConfirm({
      description: t(`kpi:confirm.${action}`),
    });
    if (!confirmed) {
      return;
    }
    try {
      await lifecycleMutation.mutateAsync({ kpiPlanId: plan.id, action });
      notifySuccess('kpi:feedback.lifecycleUpdated');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const allocationWorkflowStatus = readAllocationWorkflowStatus(plan);
  const allocationIsOfficial =
    allocationWorkflowStatus !== 'NONE' &&
    allocationWorkflowStatus !== 'MIXED' &&
    officialAllocationStatuses.has(allocationWorkflowStatus);
  const allocationPlanStateDisabledReason =
    plan.status === 'FINALIZED'
      ? t('kpi:errors.finalizedReadOnly')
      : plan.status !== 'PUBLISHED'
        ? t('kpi:disabled.allocationPlanPublishedOnly')
        : undefined;
  const allocationDraftDisabledReason =
    allocationPlanStateDisabledReason ??
    (allocationWorkflowStatus !== 'DRAFT' && allocationWorkflowStatus !== 'NONE'
      ? t('kpi:disabled.allocationDraftOnly')
      : undefined);
  const allocationSubmitDisabledReason =
    allocationPlanStateDisabledReason ??
    (allocationWorkflowStatus !== 'DRAFT'
      ? t('kpi:disabled.allocationSubmitDraftOnly')
      : undefined);
  const allocationApproveDisabledReason =
    allocationPlanStateDisabledReason ??
    (allocationWorkflowStatus !== 'PENDING_APPROVAL'
      ? t('kpi:disabled.allocationApprovePendingOnly')
      : undefined);
  const allocationPublishDisabledReason =
    allocationWorkflowStatus !== 'APPROVED'
      ? t('kpi:disabled.allocationPublishApprovedOnly')
      : undefined;
  const subjectDisplay =
    plan.subjectRef?.displayName ?? plan.subjectRef?.name ?? t('kpi:fields.subjectUnavailable');

  const saveAllocationDraft = async (): Promise<void> => {
    setAllocationError(null);
    if (managerAllocationDraftHint.disabled || allocationDraftDisabledReason) {
      setAllocationError(
        managerAllocationDraftHint.disabledReason ?? allocationDraftDisabledReason ?? null,
      );
      return;
    }
    let invalidMetric = false;
    const rows = allocationDraftRows.map((row) => ({
      employmentProfileId: row.employmentProfileId.trim(),
      allocationStartDate: row.allocationStartDate.trim(),
      allocationEndDate: null,
      note: row.note.trim() || null,
      targetMetrics: plan.targetMetrics.map((metric) => {
        const parsed = parseKpiMetricInput(metric.metricCode, row.values[metric.metricCode] ?? '');
        if (parsed === undefined) {
          invalidMetric = true;
        }
        return { metricCode: metric.metricCode, targetValue: parsed ?? 0 };
      }),
    }));
    if (invalidMetric) {
      setAllocationError(t('kpi:validation.invalidMetricValue'));
      return;
    }
    if (rows.some((row) => !row.employmentProfileId)) {
      setAllocationError(t('kpi:validation.employmentProfileRequired'));
      return;
    }
    try {
      await allocationDraftMutation.mutateAsync({ kpiPlanId: plan.id, allocations: rows });
      notifySuccess('kpi:feedback.allocationDraftSaved');
    } catch (error) {
      setAllocationError((error as Error | NormalizedApiError).message);
    }
  };

  const submitAllocationDraft = async (): Promise<void> => {
    setAllocationError(null);
    if (managerAllocationSubmitHint.disabled || allocationSubmitDisabledReason) {
      setAllocationError(
        managerAllocationSubmitHint.disabledReason ?? allocationSubmitDisabledReason ?? null,
      );
      return;
    }
    try {
      await allocationSubmitMutation.mutateAsync({ kpiPlanId: plan.id });
      notifySuccess('kpi:feedback.allocationSubmitted');
    } catch (error) {
      setAllocationError((error as Error | NormalizedApiError).message);
    }
  };

  const approveAllocation = async (): Promise<void> => {
    try {
      await allocationApproveMutation.mutateAsync({
        kpiPlanId: plan.id,
        approvalNote: approvalNote.trim() || null,
      });
      notifySuccess('kpi:feedback.allocationApproved');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const rejectAllocation = async (): Promise<void> => {
    if (!rejectionReason.trim()) {
      setAllocationError(t('kpi:validation.reasonRequired'));
      return;
    }
    try {
      await allocationRejectMutation.mutateAsync({
        kpiPlanId: plan.id,
        rejectionReason: rejectionReason.trim(),
      });
      notifySuccess('kpi:feedback.allocationRejected');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const publishAllocation = async (): Promise<void> => {
    try {
      await allocationPublishMutation.mutateAsync({ kpiPlanId: plan.id });
      notifySuccess('kpi:feedback.allocationPublished');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const draftActionItems =
    plan.status === 'DRAFT'
      ? [
          !draftHint.hidden
            ? {
                id: 'draft-core',
                label: t('kpi:actions.updateDraft'),
                disabled: draftHint.disabled,
                disabledReason: draftHint.disabledReason,
                onClick: !draftHint.disabled ? () => undefined : undefined,
              }
            : undefined,
          !draftHint.hidden
            ? {
                id: 'replace-metrics',
                label: t('kpi:actions.replaceMetrics'),
                disabled: draftHint.disabled,
                disabledReason: draftHint.disabledReason,
                onClick: !draftHint.disabled ? () => undefined : undefined,
              }
            : undefined,
          !allocationHint.hidden
            ? {
                id: 'replace-allocations',
                label: t('kpi:actions.replaceAllocations'),
                disabled: allocationHint.disabled,
                disabledReason: allocationHint.disabledReason,
                onClick: !allocationHint.disabled ? () => undefined : undefined,
              }
            : undefined,
        ].filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [];

  const actionItems = [
    ...draftActionItems,
    !publishHint.hidden
      ? {
          id: 'publish',
          label: t('kpi:actions.publish'),
          disabled: Boolean(readDisabledReason(plan, 'publish')) || publishHint.disabled,
          disabledReason:
            (readDisabledReason(plan, 'publish')
              ? t(readDisabledReason(plan, 'publish') ?? '')
              : undefined) ?? publishHint.disabledReason,
          onClick:
            !readDisabledReason(plan, 'publish') && !publishHint.disabled
              ? () => void runLifecycle('publish')
              : undefined,
        }
      : undefined,
    !finalizeHint.hidden
      ? {
          id: 'finalize',
          label: t('kpi:actions.finalize'),
          disabled: Boolean(readDisabledReason(plan, 'finalize')) || finalizeHint.disabled,
          disabledReason:
            (readDisabledReason(plan, 'finalize')
              ? t(readDisabledReason(plan, 'finalize') ?? '')
              : undefined) ?? finalizeHint.disabledReason,
          onClick:
            !readDisabledReason(plan, 'finalize') && !finalizeHint.disabled
              ? () => void runLifecycle('finalize')
              : undefined,
        }
      : undefined,
    !archiveHint.hidden
      ? {
          id: 'archive',
          label: t('kpi:actions.archive'),
          tone: 'danger' as const,
          disabled: Boolean(readDisabledReason(plan, 'archive')) || archiveHint.disabled,
          disabledReason:
            (readDisabledReason(plan, 'archive')
              ? t(readDisabledReason(plan, 'archive') ?? '')
              : undefined) ?? archiveHint.disabledReason,
          onClick:
            !readDisabledReason(plan, 'archive') && !archiveHint.disabled
              ? () => void runLifecycle('archive')
              : undefined,
        }
      : undefined,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const allocationTotals = new Map<KpiMetricCode, number>();
  plan.targetMetrics.forEach((metric) => allocationTotals.set(metric.metricCode, 0));
  plan.allocations.forEach((allocation) => {
    allocation.targetMetrics.forEach((metric) => {
      allocationTotals.set(
        metric.metricCode,
        (allocationTotals.get(metric.metricCode) ?? 0) + metric.targetValue,
      );
    });
  });
  const allocationMatches = plan.targetMetrics.every(
    (metric) => allocationTotals.get(metric.metricCode) === metric.targetValue,
  );

  const publishBlockedByAllocation = plan.status === 'DRAFT' && !allocationMatches;
  return (
    <DetailPageShell
      banner={
        <section className="rounded-lg border border-border bg-panel p-4 shadow-shell">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{plan.planCode}</p>
              <h1 className="text-xl font-semibold">{plan.title}</h1>
              <p className="text-sm text-muted">
                {t(`kpi:subjectTypes.${plan.subjectType}`)} - {subjectDisplay} - {plan.periodMonth}
              </p>
            </div>
            <StatusBadge label={t(`kpi:statuses.${plan.status}`)} />
          </div>
        </section>
      }
      metadataSection={
        <div className="space-y-4">
          <MetadataSection title={t('kpi:sections.lifecycle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'planStatus',
                  label: t('kpi:fields.planStatus'),
                  value: t(`kpi:statuses.${plan.status}`),
                },
                {
                  key: 'subjectType',
                  label: t('kpi:fields.subjectType'),
                  value: t(`kpi:subjectTypes.${plan.subjectType}`),
                },
                { key: 'subject', label: t('kpi:fields.subject'), value: subjectDisplay },
                { key: 'period', label: t('kpi:fields.periodMonth'), value: plan.periodMonth },
                {
                  key: 'publishedAt',
                  label: t('kpi:fields.planPublishedAt'),
                  value: formatKpiDateTime(plan.publishedAt),
                },
                {
                  key: 'finalizedAt',
                  label: t('kpi:fields.planFinalizedAt'),
                  value: plan.finalizedAt
                    ? formatKpiDateTime(plan.finalizedAt)
                    : t('kpi:states.notFinalizedYet'),
                },
                {
                  key: 'archivedAt',
                  label: t('kpi:fields.archivedAt'),
                  value: formatKpiDateTime(plan.archivedAt),
                },
              ]}
            />
          </MetadataSection>

          {plan.subjectType === 'TALENT_GROUP' ? (
            <KpiFinalResultSnapshotSection status={plan.status} finalResult={plan.finalResult} />
          ) : null}

          <MetadataSection title={t('kpi:sections.targetMetrics')}>
            <div className="overflow-x-auto rounded border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.metricCode')}</th>
                    <th className="px-3 py-2 text-left">{t('kpi:fields.targetValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.targetMetrics.map((metric) => (
                    <tr key={metric.id} className="border-t border-border">
                      <td className="px-3 py-2">{t(`kpi:metricCodes.${metric.metricCode}`)}</td>
                      <td className="px-3 py-2">
                        {formatKpiNumber(metric.metricCode, metric.targetValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MetadataSection>

          {plan.subjectType === 'ORG_UNIT' ? <KpiOrgUnitOperationsSection plan={plan} /> : null}

          {plan.subjectType === 'TALENT_GROUP' ? (
            <MetadataSection title={t('kpi:sections.allocations')}>
              {allocationError ? <p className="text-sm text-danger">{allocationError}</p> : null}
              <div className="space-y-2 rounded border border-border bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t('kpi:allocation.workflowStatus')}</span>
                  <StatusBadge
                    label={
                      allocationWorkflowStatus === 'NONE' || allocationWorkflowStatus === 'MIXED'
                        ? t(`kpi:allocationStatuses.${allocationWorkflowStatus}`)
                        : t(`kpi:allocationStatuses.${allocationWorkflowStatus}`)
                    }
                  />
                  {allocationIsOfficial ? (
                    <span className="text-muted">{t('kpi:allocation.official')}</span>
                  ) : (
                    <span className="text-muted">
                      {t('kpi:allocation.notOfficialUntilPublished')}
                    </span>
                  )}
                </div>
                {managerAllocationDraftHint.allowed ? (
                  <div className="space-y-3">
                    {allocationPlanStateDisabledReason ? (
                      <p className="text-sm text-danger">{allocationPlanStateDisabledReason}</p>
                    ) : null}
                    <div className="overflow-x-auto rounded border border-border bg-panel">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left">
                              {t('kpi:fields.employmentProfileId')}
                            </th>
                            {plan.targetMetrics.map((metric) => (
                              <th key={metric.metricCode} className="px-3 py-2 text-left">
                                {t(`kpi:metricCodes.${metric.metricCode}`)}
                              </th>
                            ))}
                            <th className="px-3 py-2 text-left">{t('kpi:fields.note')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allocationDraftRows.map((row, rowIndex) => (
                            <tr
                              key={`${row.employmentProfileId}-${rowIndex}`}
                              className="border-t border-border"
                            >
                              <td className="min-w-[280px] px-3 py-2">
                                <AsyncReferencePicker
                                  pickerId={`kpi-managed-member-${rowIndex}`}
                                  value={row.employmentProfileId}
                                  disabled={Boolean(allocationDraftDisabledReason)}
                                  resourceLabel={t('kpi:fields.managedMember')}
                                  placeholder={t('kpi:filters.managedMemberPlaceholder')}
                                  loadOptions={loadManagedMemberOptions}
                                  onChange={(nextId) =>
                                    setAllocationDraftRows((current) =>
                                      current.map((item, index) =>
                                        index === rowIndex
                                          ? { ...item, employmentProfileId: nextId ?? '' }
                                          : item,
                                      ),
                                    )
                                  }
                                  emptySlot={
                                    <p className="text-xs text-muted">
                                      {t('kpi:states.noManagedMembers')}
                                    </p>
                                  }
                                />
                              </td>
                              {plan.targetMetrics.map((metric) => (
                                <td key={metric.metricCode} className="px-3 py-2">
                                  <input
                                    aria-label={`${row.employmentProfileId || t('kpi:fields.member')} ${t(
                                      `kpi:metricCodes.${metric.metricCode}`,
                                    )}`}
                                    value={row.values[metric.metricCode] ?? ''}
                                    disabled={Boolean(allocationDraftDisabledReason)}
                                    className="w-32 rounded border border-border bg-panel px-2 py-1 disabled:opacity-50"
                                    onChange={(event) =>
                                      setAllocationDraftRows((current) =>
                                        current.map((item, index) =>
                                          index === rowIndex
                                            ? {
                                                ...item,
                                                values: {
                                                  ...item.values,
                                                  [metric.metricCode]: event.target.value,
                                                },
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                </td>
                              ))}
                              <td className="px-3 py-2">
                                <input
                                  aria-label={`${t('kpi:fields.note')} ${rowIndex + 1}`}
                                  value={row.note}
                                  disabled={Boolean(allocationDraftDisabledReason)}
                                  className="w-48 rounded border border-border bg-panel px-2 py-1 disabled:opacity-50"
                                  onChange={(event) =>
                                    setAllocationDraftRows((current) =>
                                      current.map((item, index) =>
                                        index === rowIndex
                                          ? { ...item, note: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
                        disabled={Boolean(allocationDraftDisabledReason)}
                        onClick={() =>
                          setAllocationDraftRows((current) => [
                            ...current,
                            {
                              employmentProfileId: '',
                              allocationStartDate: toContractDate(plan.periodMonth),
                              note: '',
                              values: Object.fromEntries(
                                plan.targetMetrics.map((metric) => [metric.metricCode, '0']),
                              ) as Partial<Record<KpiMetricCode, string>>,
                            },
                          ])
                        }
                      >
                        {t('kpi:actions.addAllocationMember')}
                      </button>
                      <button
                        type="button"
                        disabled={
                          allocationDraftMutation.isPending ||
                          managerAllocationDraftHint.disabled ||
                          Boolean(allocationDraftDisabledReason)
                        }
                        title={
                          managerAllocationDraftHint.disabledReason ?? allocationDraftDisabledReason
                        }
                        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        onClick={() => void saveAllocationDraft()}
                      >
                        {t('kpi:actions.saveAllocationDraft')}
                      </button>
                      <button
                        type="button"
                        disabled={
                          allocationSubmitMutation.isPending ||
                          managerAllocationSubmitHint.disabled ||
                          Boolean(allocationSubmitDisabledReason)
                        }
                        title={
                          managerAllocationSubmitHint.disabledReason ??
                          allocationSubmitDisabledReason
                        }
                        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        onClick={() => void submitAllocationDraft()}
                      >
                        {t('kpi:actions.submitAllocation')}
                      </button>
                    </div>
                  </div>
                ) : null}
                {!allocationApproveHint.hidden || !allocationPublishHint.hidden ? (
                  <div className="space-y-3 rounded border border-border bg-panel p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span>{t('kpi:fields.approvalNote')}</span>
                        <input
                          value={approvalNote}
                          className="rounded border border-border bg-panel px-2 py-1.5"
                          onChange={(event) => setApprovalNote(event.target.value)}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span>{t('kpi:fields.rejectionReason')}</span>
                        <input
                          value={rejectionReason}
                          className="rounded border border-border bg-panel px-2 py-1.5"
                          onChange={(event) => setRejectionReason(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!allocationApproveHint.hidden ? (
                        <button
                          type="button"
                          disabled={
                            allocationApproveMutation.isPending ||
                            allocationApproveHint.disabled ||
                            Boolean(allocationApproveDisabledReason)
                          }
                          title={
                            allocationApproveHint.disabledReason ?? allocationApproveDisabledReason
                          }
                          className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() => void approveAllocation()}
                        >
                          {t('kpi:actions.approveAllocation')}
                        </button>
                      ) : null}
                      {!allocationRejectHint.hidden ? (
                        <button
                          type="button"
                          disabled={
                            allocationRejectMutation.isPending ||
                            allocationRejectHint.disabled ||
                            Boolean(allocationApproveDisabledReason)
                          }
                          title={
                            allocationRejectHint.disabledReason ?? allocationApproveDisabledReason
                          }
                          className="rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
                          onClick={() => void rejectAllocation()}
                        >
                          {t('kpi:actions.rejectAllocation')}
                        </button>
                      ) : null}
                      {!allocationPublishHint.hidden ? (
                        <button
                          type="button"
                          disabled={
                            allocationPublishMutation.isPending ||
                            allocationPublishHint.disabled ||
                            Boolean(allocationPublishDisabledReason)
                          }
                          title={
                            allocationPublishHint.disabledReason ?? allocationPublishDisabledReason
                          }
                          className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() => void publishAllocation()}
                        >
                          {t('kpi:actions.publishAllocation')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                      {plan.targetMetrics.map((metric) => (
                        <th key={metric.metricCode} className="px-3 py-2 text-left">
                          {t(`kpi:metricCodes.${metric.metricCode}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.allocations.map((allocation) => (
                      <tr key={allocation.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          {allocation.snapshotMemberDisplayName ??
                            t('kpi:actualWorkspace.unnamedMember')}
                        </td>
                        {plan.targetMetrics.map((metric) => {
                          const value =
                            allocation.targetMetrics.find(
                              (item) => item.metricCode === metric.metricCode,
                            )?.targetValue ?? 0;
                          return (
                            <td key={metric.metricCode} className="px-3 py-2">
                              {formatKpiNumber(metric.metricCode, value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-t border-border font-semibold">
                      <td className="px-3 py-2">{t('kpi:allocation.targetTotal')}</td>
                      {plan.targetMetrics.map((metric) => (
                        <td key={metric.metricCode} className="px-3 py-2">
                          {formatKpiNumber(metric.metricCode, metric.targetValue)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-t border-border font-semibold">
                      <td className="px-3 py-2">{t('kpi:allocation.allocatedTotal')}</td>
                      {plan.targetMetrics.map((metric) => (
                        <td key={metric.metricCode} className="px-3 py-2">
                          {formatKpiNumber(
                            metric.metricCode,
                            allocationTotals.get(metric.metricCode) ?? 0,
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-t border-border font-semibold">
                      <td className="px-3 py-2">{t('kpi:allocation.difference')}</td>
                      {plan.targetMetrics.map((metric) => (
                        <td key={metric.metricCode} className="px-3 py-2">
                          {formatKpiNumber(
                            metric.metricCode,
                            (allocationTotals.get(metric.metricCode) ?? 0) - metric.targetValue,
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              {publishBlockedByAllocation ? (
                <p className="text-sm text-danger">{t('kpi:validation.allocationMismatch')}</p>
              ) : null}
              {plan.status === 'DRAFT' && !allocationHint.hidden ? (
                <button
                  type="button"
                  disabled={allocationsMutation.isPending || allocationHint.disabled}
                  className="mt-3 rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
                  title={allocationHint.disabledReason}
                  onClick={async () => {
                    setAllocationError(null);
                    try {
                      await allocationsMutation.mutateAsync({
                        kpiPlanId: plan.id,
                        allocations: plan.allocations.map((allocation) => ({
                          memberTalentId: allocation.memberTalentId,
                          membershipId: allocation.membershipId,
                          allocationStartDate: allocation.allocationStartDate,
                          allocationEndDate: allocation.allocationEndDate,
                          targetMetrics: allocation.targetMetrics,
                          snapshotMemberDisplayName: allocation.snapshotMemberDisplayName,
                        })),
                      });
                      notifySuccess('kpi:feedback.allocationsUpdated');
                    } catch (error) {
                      setAllocationError((error as NormalizedApiError).message);
                    }
                  }}
                >
                  {t('kpi:actions.replaceAllocations')}
                </button>
              ) : null}
            </MetadataSection>
          ) : null}

          <MetadataSection title={t('kpi:sections.progress')}>
            {!canLoadKpiProgress ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:progress.officialPosture')}
                  </div>
                  <div>{t('kpi:progress.publishedOnly')}</div>
                </div>
                <div className="rounded border border-border p-3 text-sm">
                  <div className="text-xs uppercase text-muted">
                    {t('kpi:progress.actualSource')}
                  </div>
                  <div>{t('kpi:progress.publishedAllocationsOnly')}</div>
                </div>
              </div>
            ) : progressQuery.isError ? (
              <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
                {t('kpi:states.progressUnavailable')}
              </div>
            ) : progressQuery.data ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded border border-border p-3 text-sm">
                    <div className="text-xs uppercase text-muted">
                      {t('kpi:progress.officialPosture')}
                    </div>
                    <div>{t('kpi:progress.publishedOnly')}</div>
                  </div>
                  <div className="rounded border border-border p-3 text-sm">
                    <div className="text-xs uppercase text-muted">{t('kpi:progress.elapsed')}</div>
                    <div>{progressQuery.data.periodElapsedPercent.toFixed(1)}%</div>
                  </div>
                  <div className="rounded border border-border p-3 text-sm">
                    <div className="text-xs uppercase text-muted">
                      {t('kpi:progress.actualSource')}
                    </div>
                    <div>{t('kpi:progress.publishedAllocationsOnly')}</div>
                  </div>
                </div>
                <div className="overflow-x-auto rounded border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left">{t('kpi:fields.metricCode')}</th>
                        <th className="px-3 py-2 text-left">{t('kpi:progress.target')}</th>
                        <th className="px-3 py-2 text-left">{t('kpi:progress.actual')}</th>
                        <th className="px-3 py-2 text-left">{t('kpi:progress.percent')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressQuery.data.groupTotals.map((metric) => (
                        <tr key={metric.metricCode} className="border-t border-border">
                          <td className="px-3 py-2">{t(`kpi:metricCodes.${metric.metricCode}`)}</td>
                          <td className="px-3 py-2">
                            {formatKpiNumber(metric.metricCode, metric.targetValue)}
                          </td>
                          <td className="px-3 py-2">
                            {formatKpiNumber(metric.metricCode, metric.actualValue)}
                          </td>
                          <td className="px-3 py-2">
                            {metric.progressPercent === null ? '-' : `${metric.progressPercent}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {plan.subjectType === 'TALENT_GROUP' &&
                progressQuery.data.memberProgress.length > 0 ? (
                  <div className="overflow-x-auto rounded border border-border">
                    <table className="min-w-full text-sm">
                      <caption className="sr-only">{t('kpi:progress.memberBreakdown')}</caption>
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                          <th className="px-3 py-2 text-left">{t('kpi:fields.metricCode')}</th>
                          <th className="px-3 py-2 text-left">{t('kpi:progress.percent')}</th>
                          <th className="px-3 py-2 text-left">
                            {t('kpi:progress.actualEntryCount')}
                          </th>
                          <th className="px-3 py-2 text-left">
                            {t('kpi:progress.missingEntryCount')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressQuery.data.memberProgress.map((row) => (
                          <tr
                            key={`${row.allocationId}-${row.metricCode}`}
                            className="border-t border-border"
                          >
                            <td className="px-3 py-2">
                              {plan.allocations.find(
                                (allocation) => allocation.id === row.allocationId,
                              )?.snapshotMemberDisplayName ??
                                t('kpi:actualWorkspace.unnamedMember')}
                            </td>
                            <td className="px-3 py-2">{t(`kpi:metricCodes.${row.metricCode}`)}</td>
                            <td className="px-3 py-2">
                              {row.progressPercent === null ? '-' : `${row.progressPercent}%`}
                            </td>
                            <td className="px-3 py-2">{row.actualEntryCount}</td>
                            <td className="px-3 py-2">{row.missingEntryCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : plan.subjectType === 'TALENT_GROUP' ? (
                  <div className="rounded border border-dashed border-border p-4 text-sm text-muted">
                    {t('kpi:states.memberProgressEmpty')}
                  </div>
                ) : null}
              </div>
            ) : (
              <LoadingState lines={3} />
            )}
          </MetadataSection>
        </div>
      }
      actionRail={<ActionRail title={t('kpi:actionRail.title')} items={actionItems} />}
    />
  );
};
