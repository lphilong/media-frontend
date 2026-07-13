import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { WorkScheduleDeadlineCue } from '@modules/work-schedule/components/WorkScheduleDeadlineCue';
import {
  useApplyAvailabilityLinesToMonthlyRosterMutation,
  useApproveWorkScheduleAvailabilityBatchLinesMutation,
  useCancelWorkScheduleAvailabilityBatchLinesMutation,
  useMonthlyRosterList,
  useRejectWorkScheduleAvailabilityBatchLinesMutation,
  useWorkScheduleAvailabilityBatchDetail,
  useWorkScheduleAvailabilityBatchList,
} from '@modules/work-schedule/hooks/use-work-schedule';
import type {
  ApplyAvailabilityLinesToMonthlyRosterResult,
  WorkScheduleAvailabilityBatchStatus,
  WorkScheduleAvailabilityLine,
} from '@modules/work-schedule/types/work-schedule.types';
import {
  hasPermission,
  hasScopeGrant,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  AppliedFilterChips,
  Button,
  CursorPager,
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  PageContainer,
  SensitiveActionDialog,
  StatusBadge,
  TechnicalDetailsDisclosure,
} from '@shared/components/primitives';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';

const QUEUE_LIMIT = 50;

const batchStatusTone = {
  PENDING: 'warning',
  PARTIALLY_APPROVED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
} as const;

const lineStatusTone = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
} as const;

const applyStatusTone = {
  NOT_APPLIED: 'warning',
  ADVISORY_ONLY: 'info',
  APPLIED: 'success',
} as const;

const canReviewLine = (line: WorkScheduleAvailabilityLine): boolean => line.status === 'PENDING';

const canApplyLine = (line: WorkScheduleAvailabilityLine): boolean =>
  line.status === 'APPROVED' &&
  (line.applyStatus === 'NOT_APPLIED' || line.applyStatus === 'ADVISORY_ONLY');

export const WorkScheduleAvailabilityBatchQueuePage = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const capabilities = capabilitiesQuery.data;
  const canDecide =
    hasPermission(capabilities, PERMISSIONS.WORK_SCHEDULE_UPDATE) &&
    hasScopeGrant(capabilities, 'workSchedule', 'global');
  const [status, setStatus] = useState<WorkScheduleAvailabilityBatchStatus | ''>('');
  const [periodMonth, setPeriodMonth] = useState('');
  const [targetType, setTargetType] = useState<'ORG_UNIT' | 'TALENT_GROUP' | ''>('');
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>();
  const [selectedReviewLineIds, setSelectedReviewLineIds] = useState<string[]>([]);
  const [selectedApplyLineIds, setSelectedApplyLineIds] = useState<string[]>([]);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [monthlyRosterId, setMonthlyRosterId] = useState('');
  const [applyNote, setApplyNote] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pendingDecisionAction, setPendingDecisionAction] = useState<
    'approve' | 'reject' | 'cancel' | null
  >(null);
  const [applyResult, setApplyResult] =
    useState<ApplyAvailabilityLinesToMonthlyRosterResult | null>(null);
  const resetQueueSelection = (): void => {
    setSelectedBatchId(undefined);
    setSelectedReviewLineIds([]);
    setSelectedApplyLineIds([]);
    setApplyResult(null);
  };
  const resetCursorAndSelection = (): void => {
    setCursorStack([]);
    resetQueueSelection();
  };
  const listQuery = useWorkScheduleAvailabilityBatchList({
    status: status || undefined,
    periodMonth: periodMonth || undefined,
    targetType: targetType || undefined,
    limit: QUEUE_LIMIT,
    cursor: cursorStack[cursorStack.length - 1],
  });
  const selectedBatchIdOrFirst = selectedBatchId ?? listQuery.data?.items[0]?.id;
  const detailQuery = useWorkScheduleAvailabilityBatchDetail(selectedBatchIdOrFirst, {
    enabled: Boolean(selectedBatchIdOrFirst),
  });
  const rosterQuery = useMonthlyRosterList(
    {
      status: 'DRAFT',
      rosterMonth: detailQuery.data?.periodMonth,
      targetType: detailQuery.data?.targetType,
      targetOrgUnitId: detailQuery.data?.targetOrgUnitId ?? undefined,
      targetTalentGroupId: detailQuery.data?.targetTalentGroupId ?? undefined,
      scope: 'global',
      limit: 50,
    },
    { enabled: canDecide && Boolean(detailQuery.data) },
  );
  const approveMutation = useApproveWorkScheduleAvailabilityBatchLinesMutation();
  const rejectMutation = useRejectWorkScheduleAvailabilityBatchLinesMutation();
  const cancelMutation = useCancelWorkScheduleAvailabilityBatchLinesMutation();
  const applyMutation = useApplyAvailabilityLinesToMonthlyRosterMutation();
  const selectedReviewLines = useMemo(
    () => (detailQuery.data?.lines ?? []).filter((line) => selectedReviewLineIds.includes(line.id)),
    [detailQuery.data?.lines, selectedReviewLineIds],
  );
  const selectedApplyLines = useMemo(
    () => (detailQuery.data?.lines ?? []).filter((line) => selectedApplyLineIds.includes(line.id)),
    [detailQuery.data?.lines, selectedApplyLineIds],
  );
  const approvedNotAppliedCount = useMemo(
    () =>
      (detailQuery.data?.lines ?? []).filter(
        (line) =>
          line.status === 'APPROVED' &&
          (line.applyStatus === 'NOT_APPLIED' || line.applyStatus === 'ADVISORY_ONLY'),
      ).length,
    [detailQuery.data?.lines],
  );
  const activeFilterChips = [
    ...(status
      ? [
          {
            id: 'status',
            label: t('work-schedule:availabilityBatches.filters.status'),
            value: t(`work-schedule:availabilityBatches.statuses.${status}`),
            onClear: () => {
              setStatus('');
              resetCursorAndSelection();
            },
          },
        ]
      : []),
    ...(periodMonth
      ? [
          {
            id: 'periodMonth',
            label: t('work-schedule:availabilityBatches.filters.periodMonth'),
            value: periodMonth,
            onClear: () => {
              setPeriodMonth('');
              resetCursorAndSelection();
            },
          },
        ]
      : []),
    ...(targetType
      ? [
          {
            id: 'targetType',
            label: t('work-schedule:availabilityBatches.filters.targetType'),
            value: t(`work-schedule:availabilityBatches.targetTypes.${targetType}`),
            onClear: () => {
              setTargetType('');
              resetCursorAndSelection();
            },
          },
        ]
      : []),
  ];

  const resetDecisionInputs = (): void => {
    setSelectedReviewLineIds([]);
    setDecisionNote('');
    setDecisionReason('');
    setValidationMessage(null);
  };

  const runDecision = async (action: 'approve' | 'reject' | 'cancel'): Promise<void> => {
    if (!detailQuery.data || selectedReviewLineIds.length === 0) {
      return;
    }
    if ((action === 'reject' || action === 'cancel') && !decisionReason.trim()) {
      setValidationMessage(t('work-schedule:availabilityBatches.validation.reasonRequired'));
      return;
    }
    const payload = {
      lineIds: selectedReviewLineIds,
      adminDecisionNote: decisionNote,
      rejectionReason: action === 'reject' ? decisionReason : undefined,
      cancellationReason: action === 'cancel' ? decisionReason : undefined,
    };
    if (action === 'approve') {
      await approveMutation.mutateAsync({ batchId: detailQuery.data.id, payload });
    } else if (action === 'reject') {
      await rejectMutation.mutateAsync({ batchId: detailQuery.data.id, payload });
    } else {
      await cancelMutation.mutateAsync({ batchId: detailQuery.data.id, payload });
    }
    setPendingDecisionAction(null);
    resetDecisionInputs();
  };

  const requestDecision = (action: 'approve' | 'reject' | 'cancel'): void => {
    if (selectedReviewLineIds.length === 0) {
      return;
    }
    if ((action === 'reject' || action === 'cancel') && !decisionReason.trim()) {
      setValidationMessage(t('work-schedule:availabilityBatches.validation.reasonRequired'));
      return;
    }
    setValidationMessage(null);
    setPendingDecisionAction(action);
  };

  const runApply = async (): Promise<void> => {
    if (!monthlyRosterId || selectedApplyLineIds.length === 0) {
      setValidationMessage(
        t('work-schedule:availabilityBatches.validation.applySelectionRequired'),
      );
      return;
    }
    const result = await applyMutation.mutateAsync({
      monthlyRosterId,
      payload: {
        availabilityLineIds: selectedApplyLineIds,
        applyNote,
        scope: 'global',
      },
    });
    setApplyResult(result);
    setSelectedApplyLineIds([]);
    setApplyNote('');
    setValidationMessage(null);
  };

  return (
    <PageContainer>
      <div className="space-y-4">
        <WorkScheduleSubnavigation active="availability-batches" />
        <section className="rounded border border-border bg-panel p-4 shadow-sm">
          <div className="flex justify-end">
            <StatusBadge label={t('work-schedule:availabilityBatches.badges.global')} tone="info" />
          </div>

          <div className="mt-4 rounded border border-border bg-bg p-3 text-sm text-muted">
            <p>{t('work-schedule:availabilityBatches.copy.planning')}</p>
            <p>{t('work-schedule:availabilityBatches.copy.approvedNotChanged')}</p>
            <p>{t('work-schedule:availabilityBatches.copy.applyDraftOnly')}</p>
            <p>{t('work-schedule:availabilityBatches.copy.publishStillRequired')}</p>
            <p>{t('work-schedule:availabilityBatches.copy.officialShiftBoundary')}</p>
          </div>

          <FilterToolbar
            appliedFilters={
              <AppliedFilterChips
                items={activeFilterChips}
                title={t('common:filters.appliedFilters')}
                clearFilterLabel={t('common:filters.clearFilter')}
                clearAllLabel={t('common:filters.clearAll')}
                emptyLabel={t('common:filters.noFiltersApplied')}
                onClearAll={
                  activeFilterChips.length > 0
                    ? () => {
                        setStatus('');
                        setPeriodMonth('');
                        setTargetType('');
                        resetCursorAndSelection();
                      }
                    : undefined
                }
              />
            }
          >
            <label className="text-sm font-medium text-text">
              {t('work-schedule:availabilityBatches.filters.status')}
              <select
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as WorkScheduleAvailabilityBatchStatus | '');
                  resetCursorAndSelection();
                }}
              >
                <option value="">{t('work-schedule:availabilityBatches.filters.all')}</option>
                {Object.keys(batchStatusTone).map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {t(`work-schedule:availabilityBatches.statuses.${candidate}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-text">
              {t('work-schedule:availabilityBatches.filters.periodMonth')}
              <input
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                type="month"
                value={periodMonth}
                onChange={(event) => {
                  setPeriodMonth(event.target.value);
                  resetCursorAndSelection();
                }}
              />
            </label>
            <label className="text-sm font-medium text-text">
              {t('work-schedule:availabilityBatches.filters.targetType')}
              <select
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                value={targetType}
                onChange={(event) => {
                  setTargetType(event.target.value as 'ORG_UNIT' | 'TALENT_GROUP' | '');
                  resetCursorAndSelection();
                }}
              >
                <option value="">{t('work-schedule:availabilityBatches.filters.all')}</option>
                <option value="ORG_UNIT">
                  {t('work-schedule:availabilityBatches.targetTypes.ORG_UNIT')}
                </option>
                <option value="TALENT_GROUP">
                  {t('work-schedule:availabilityBatches.targetTypes.TALENT_GROUP')}
                </option>
              </select>
            </label>
          </FilterToolbar>

          {listQuery.isLoading ? <LoadingState lines={4} /> : null}
          {listQuery.isError ? (
            <ErrorState
              title={t('work-schedule:availabilityBatches.states.loadErrorTitle')}
              message={t('work-schedule:availabilityBatches.states.loadErrorMessage')}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void listQuery.refetch()}
            />
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <div className="rounded border border-border bg-bg">
              <div className="border-b border-border px-3 py-2 text-sm font-semibold text-text">
                {t('work-schedule:availabilityBatches.list.title')}
              </div>
              {(listQuery.data?.items ?? []).map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  className={`block w-full border-b border-border px-3 py-3 text-left hover:bg-panel ${
                    selectedBatchIdOrFirst === batch.id ? 'bg-panel' : ''
                  }`}
                  onClick={() => {
                    setSelectedBatchId(batch.id);
                    setSelectedReviewLineIds([]);
                    setSelectedApplyLineIds([]);
                    setApplyResult(null);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text">
                      {batch.availabilityBatchCode}
                    </span>
                    <StatusBadge
                      label={t(`work-schedule:availabilityBatches.statuses.${batch.status}`)}
                      tone={batchStatusTone[batch.status] ?? 'neutral'}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {batch.submitter?.displayName ?? '-'} - {batch.periodMonth} -{' '}
                    {batch.target?.displayName ??
                      batch.target?.name ??
                      t(`work-schedule:availabilityBatches.targetTypes.${batch.targetType}`)}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {t('work-schedule:availabilityBatches.lineCounts.summary', batch.lineCounts)}
                  </div>
                </button>
              ))}
              {!listQuery.isLoading && (listQuery.data?.items ?? []).length === 0 ? (
                <EmptyState
                  title={t('work-schedule:availabilityBatches.states.emptyTitle')}
                  message={t('work-schedule:availabilityBatches.states.emptyMessage')}
                />
              ) : null}
              {listQuery.data ? (
                <div className="p-3">
                  <CursorPager
                    canGoBack={cursorStack.length > 0}
                    canGoNext={Boolean(listQuery.data.nextCursor)}
                    displayedCount={listQuery.data.items.length}
                    limit={QUEUE_LIMIT}
                    onPrevious={() => {
                      setCursorStack((current) => current.slice(0, -1));
                      resetQueueSelection();
                    }}
                    onNext={() => {
                      const nextCursor = listQuery.data?.nextCursor;
                      if (nextCursor) {
                        setCursorStack((current) => [...current, nextCursor]);
                        resetQueueSelection();
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded border border-border bg-bg p-3">
              {detailQuery.data ? (
                <>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-text">
                        {detailQuery.data.availabilityBatchCode}
                      </h2>
                      <p className="text-sm text-muted">
                        {formatBusinessTimestamp(detailQuery.data.submittedAt)} -{' '}
                        {detailQuery.data.periodMonth}
                      </p>
                    </div>
                    <StatusBadge
                      label={t(
                        `work-schedule:availabilityBatches.statuses.${detailQuery.data.status}`,
                      )}
                      tone={batchStatusTone[detailQuery.data.status] ?? 'neutral'}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-5">
                    <SummaryCard
                      label={t('work-schedule:availabilityBatches.summary.pending')}
                      value={detailQuery.data.lineCounts.pending}
                    />
                    <SummaryCard
                      label={t('work-schedule:availabilityBatches.summary.approved')}
                      value={detailQuery.data.lineCounts.approved}
                    />
                    <SummaryCard
                      label={t('work-schedule:availabilityBatches.summary.rejected')}
                      value={detailQuery.data.lineCounts.rejected}
                    />
                    <SummaryCard
                      label={t('work-schedule:availabilityBatches.summary.cancelled')}
                      value={detailQuery.data.lineCounts.cancelled}
                    />
                    <SummaryCard
                      label={t('work-schedule:availabilityBatches.summary.policy')}
                      value={t('work-schedule:availabilityBatches.policyStatuses.NOT_EVALUATED')}
                    />
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <WorkScheduleDeadlineCue
                      targetMonth={detailQuery.data.periodMonth}
                      cueType="AVAILABILITY_CUTOFF"
                    />
                    <SummaryCard
                      label={t('work-schedule:availabilityBatches.summary.approvedNotApplied')}
                      value={approvedNotAppliedCount}
                    />
                  </div>

                  {validationMessage ? (
                    <div className="rounded border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
                      {validationMessage}
                    </div>
                  ) : null}

                  {canDecide ? (
                    <div className="grid gap-3 rounded border border-border bg-panel p-3 lg:grid-cols-2">
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-text">
                          {t('work-schedule:availabilityBatches.review.title')}
                        </h3>
                        <p className="text-xs text-muted">
                          {t('work-schedule:availabilityBatches.review.selectedContext', {
                            count: selectedReviewLines.length,
                          })}
                        </p>
                        <p className="text-xs text-muted">
                          {t('work-schedule:availabilityBatches.review.helper')}
                        </p>
                        <label className="block text-sm font-medium text-text">
                          {t('work-schedule:availabilityBatches.review.note')}
                          <input
                            className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                            value={decisionNote}
                            onChange={(event) => setDecisionNote(event.target.value)}
                          />
                        </label>
                        <label className="block text-sm font-medium text-text">
                          {t('work-schedule:availabilityBatches.review.reason')}
                          <input
                            className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                            value={decisionReason}
                            onChange={(event) => setDecisionReason(event.target.value)}
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            disabled={selectedReviewLines.length === 0 || approveMutation.isPending}
                            onClick={() => requestDecision('approve')}
                          >
                            {t('work-schedule:availabilityBatches.actions.approve')}
                          </Button>
                          <Button
                            variant="danger"
                            disabled={selectedReviewLines.length === 0 || rejectMutation.isPending}
                            onClick={() => requestDecision('reject')}
                          >
                            {t('work-schedule:availabilityBatches.actions.reject')}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={selectedReviewLines.length === 0 || cancelMutation.isPending}
                            onClick={() => requestDecision('cancel')}
                          >
                            {t('work-schedule:availabilityBatches.actions.cancel')}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-text">
                          {t('work-schedule:availabilityBatches.apply.title')}
                        </h3>
                        <p className="text-xs text-muted">
                          {t('work-schedule:availabilityBatches.apply.selectedContext', {
                            count: selectedApplyLines.length,
                          })}
                        </p>
                        <div className="space-y-1 rounded border border-border bg-bg p-2 text-xs text-muted">
                          <p>{t('work-schedule:availabilityBatches.copy.approvedNotChanged')}</p>
                          <p>{t('work-schedule:availabilityBatches.copy.applyDraftOnly')}</p>
                          <p>{t('work-schedule:availabilityBatches.copy.publishStillRequired')}</p>
                        </div>
                        <label className="block text-sm font-medium text-text">
                          {t('work-schedule:availabilityBatches.apply.roster')}
                          <select
                            className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                            value={monthlyRosterId}
                            onChange={(event) => setMonthlyRosterId(event.target.value)}
                          >
                            <option value="">
                              {t('work-schedule:availabilityBatches.apply.selectRoster')}
                            </option>
                            {(rosterQuery.data?.data ?? []).map((roster) => (
                              <option key={roster.monthlyRosterId} value={roster.monthlyRosterId}>
                                {roster.rosterCode} - {roster.rosterMonth}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-text">
                          {t('work-schedule:availabilityBatches.apply.note')}
                          <input
                            className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                            value={applyNote}
                            onChange={(event) => setApplyNote(event.target.value)}
                          />
                        </label>
                        <Button
                          variant="primary"
                          disabled={selectedApplyLines.length === 0 || applyMutation.isPending}
                          loading={applyMutation.isPending}
                          onClick={() => void runApply()}
                        >
                          {t('work-schedule:availabilityBatches.actions.apply')}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-x-auto rounded border border-border">
                    <table className="min-w-full divide-y divide-border text-left text-sm">
                      <thead className="bg-panel text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.review')}
                          </th>
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.apply')}
                          </th>
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.member')}
                          </th>
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.type')}
                          </th>
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.date')}
                          </th>
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.status')}
                          </th>
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.applyStatus')}
                          </th>
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.policy')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-bg">
                        {detailQuery.data.lines.map((line) => (
                          <tr key={line.id}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                disabled={!canDecide || !canReviewLine(line)}
                                checked={selectedReviewLineIds.includes(line.id)}
                                onChange={(event) =>
                                  setSelectedReviewLineIds((current) =>
                                    event.target.checked
                                      ? [...current, line.id]
                                      : current.filter((lineId) => lineId !== line.id),
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                disabled={!canDecide || !canApplyLine(line)}
                                checked={selectedApplyLineIds.includes(line.id)}
                                onChange={(event) =>
                                  setSelectedApplyLineIds((current) =>
                                    event.target.checked
                                      ? [...current, line.id]
                                      : current.filter((lineId) => lineId !== line.id),
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              {line.member.displayName}
                              {line.member.employeeCode ? (
                                <div className="font-mono text-xs text-muted">
                                  {line.member.employeeCode}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <div>
                                {t(
                                  `work-schedule:availabilityBatches.types.${line.availabilityType}`,
                                )}
                              </div>
                              <div className="text-xs text-muted">
                                {t(
                                  `work-schedule:availabilityBatches.taxonomy.${line.taxonomyCode}`,
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {line.dateRangeStart ?? line.availabilityDate} -{' '}
                              {line.dateRangeEnd ?? line.availabilityDate}
                              {line.preferredStartLocalTime ? (
                                <div className="text-xs text-muted">
                                  {line.preferredStartLocalTime} - {line.preferredEndLocalTime}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge
                                label={t(
                                  `work-schedule:availabilityBatches.lineStatuses.${line.status}`,
                                )}
                                status={line.status}
                                toneByStatus={lineStatusTone}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge
                                label={t(
                                  `work-schedule:availabilityBatches.applyStatuses.${line.applyStatus}`,
                                )}
                                status={line.applyStatus}
                                toneByStatus={applyStatusTone}
                              />
                            </td>
                            <td className="px-3 py-2">
                              {t(
                                `work-schedule:availabilityBatches.policyStatuses.${line.policyEvaluationStatus}`,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {applyResult ? (
                    <div className="rounded border border-border bg-panel p-3">
                      <h3 className="text-sm font-semibold text-text">
                        {t('work-schedule:availabilityBatches.apply.resultTitle')}
                      </h3>
                      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                        <SummaryCard
                          label={t('work-schedule:availabilityBatches.apply.applied')}
                          value={applyResult.appliedCount}
                        />
                        <SummaryCard
                          label={t('work-schedule:availabilityBatches.apply.advisory')}
                          value={applyResult.advisoryOnlyCount}
                        />
                        <SummaryCard
                          label={t('work-schedule:availabilityBatches.apply.skipped')}
                          value={applyResult.skippedAlreadyAppliedCount}
                        />
                        <SummaryCard
                          label={t('work-schedule:availabilityBatches.apply.failed')}
                          value={applyResult.failedCount}
                        />
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-muted">
                        {applyResult.results.map((result, index) => (
                          <li key={`${result.availabilityLineId}-${result.outcome}`}>
                            <span>
                              {t('work-schedule:availabilityBatches.apply.resultLine', {
                                number: index + 1,
                              })}
                              :{' '}
                              {t(
                                `work-schedule:availabilityBatches.apply.outcomes.${result.outcome}`,
                              )}
                            </span>
                            <TechnicalDetailsDisclosure
                              className="mt-1 text-left text-xs text-muted"
                              label={t('work-schedule:availabilityBatches.apply.technicalDetails')}
                              details={{
                                availabilityLineId: result.availabilityLineId,
                                rosterExceptionIds: result.rosterExceptionIds,
                                reason: result.reason,
                              }}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title={t('work-schedule:availabilityBatches.states.selectTitle')}
                  message={t('work-schedule:availabilityBatches.states.selectMessage')}
                />
              )}
            </div>
          </div>
        </section>
        <SensitiveActionDialog
          open={pendingDecisionAction !== null}
          title={
            pendingDecisionAction
              ? t(`work-schedule:availabilityBatches.dialogs.${pendingDecisionAction}.title`)
              : ''
          }
          summary={t('work-schedule:availabilityBatches.dialogs.summary', {
            count: selectedReviewLines.length,
          })}
          riskItems={[
            t('work-schedule:availabilityBatches.dialogs.availabilityOnly'),
            t('work-schedule:availabilityBatches.dialogs.noScheduleMutation'),
          ]}
          confirmLabel={
            pendingDecisionAction
              ? t(`work-schedule:availabilityBatches.actions.${pendingDecisionAction}`)
              : ''
          }
          cancelLabel={t('common:actions.cancel')}
          tone={pendingDecisionAction === 'approve' ? 'warning' : 'critical'}
          isSubmitting={
            approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending
          }
          onCancel={() => setPendingDecisionAction(null)}
          onConfirm={() => {
            if (pendingDecisionAction) {
              void runDecision(pendingDecisionAction);
            }
          }}
        />
      </div>
    </PageContainer>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: string | number }): JSX.Element => (
  <div className="rounded border border-border bg-bg px-3 py-2">
    <dt className="text-xs font-medium uppercase text-muted">{label}</dt>
    <dd className="mt-1 text-sm font-semibold text-text">{value}</dd>
  </div>
);
