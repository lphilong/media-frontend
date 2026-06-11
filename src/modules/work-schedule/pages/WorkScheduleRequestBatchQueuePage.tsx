import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import {
  useApproveWorkScheduleRequestBatchLinesMutation,
  useCancelWorkScheduleRequestBatchLinesMutation,
  useRejectWorkScheduleRequestBatchLinesMutation,
  useWorkScheduleRequestBatchDetail,
  useWorkScheduleRequestBatchList,
} from '@modules/work-schedule/hooks/use-work-schedule';
import type {
  WorkScheduleRequestBatchLine,
  WorkScheduleRequestBatchStatus,
} from '@modules/work-schedule/types/work-schedule.types';
import {
  hasPermission,
  hasScopeGrant,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  AppliedFilterChips,
  CursorPager,
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  PageContainer,
  StatusBadge,
} from '@shared/components/primitives';

const QUEUE_LIMIT = 50;

const batchStatusTone = {
  PENDING: 'warning',
  PARTIALLY_APPROVED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
  FAILED_TO_APPLY: 'danger',
} as const;

const formatTimestamp = (value: number | string | null, timezone = 'Asia/Ho_Chi_Minh'): string =>
  value === null
    ? '-'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(Number(value));

const getReferenceLabel = (
  ref: WorkScheduleRequestBatchLine['memberEmploymentProfileRef'],
  fallback: string,
): string => ref?.displayName ?? ref?.name ?? ref?.title ?? ref?.code ?? fallback;

export const WorkScheduleRequestBatchQueuePage = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const capabilities = capabilitiesQuery.data;
  const canDecide =
    hasPermission(capabilities, PERMISSIONS.WORK_SCHEDULE_UPDATE) &&
    hasScopeGrant(capabilities, 'workSchedule', 'global');
  const [status, setStatus] = useState<WorkScheduleRequestBatchStatus | ''>('PENDING');
  const [periodMonth, setPeriodMonth] = useState('');
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>();
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [approvalNote, setApprovalNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const resetQueueSelection = (): void => {
    setSelectedBatchId(undefined);
    setSelectedLineIds([]);
  };
  const resetCursorAndSelection = (): void => {
    setCursorStack([]);
    resetQueueSelection();
  };
  const listQuery = useWorkScheduleRequestBatchList({
    status: status || undefined,
    periodMonth: periodMonth || undefined,
    limit: QUEUE_LIMIT,
    cursor: cursorStack[cursorStack.length - 1],
  });
  const selectedBatchIdOrFirst = selectedBatchId ?? listQuery.data?.data[0]?.id;
  const detailQuery = useWorkScheduleRequestBatchDetail(selectedBatchIdOrFirst, {
    enabled: Boolean(selectedBatchIdOrFirst),
  });
  const approveMutation = useApproveWorkScheduleRequestBatchLinesMutation();
  const rejectMutation = useRejectWorkScheduleRequestBatchLinesMutation();
  const cancelMutation = useCancelWorkScheduleRequestBatchLinesMutation();
  const pendingLines = useMemo(
    () => detailQuery.data?.lines.filter((line) => line.status === 'PENDING') ?? [],
    [detailQuery.data],
  );
  const selectedPendingLineIds = selectedLineIds.filter((lineId) =>
    pendingLines.some((line) => line.id === lineId),
  );
  const activeFilterChips = [
    ...(status
      ? [
          {
            id: 'status',
            label: t('work-schedule:requestBatches.filters.status'),
            value: t(`work-schedule:requestBatches.statuses.${status}`),
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
            label: t('work-schedule:requestBatches.filters.periodMonth'),
            value: periodMonth,
            onClear: () => {
              setPeriodMonth('');
              resetCursorAndSelection();
            },
          },
        ]
      : []),
  ];

  const resetDecisionInputs = (): void => {
    setApprovalNote('');
    setDecisionReason('');
    setSelectedLineIds([]);
  };

  const runDecision = async (action: 'approve' | 'reject' | 'cancel'): Promise<void> => {
    if (!detailQuery.data || selectedPendingLineIds.length === 0) {
      return;
    }
    if ((action === 'reject' || action === 'cancel') && decisionReason.trim().length < 10) {
      return;
    }
    const payload = {
      lineIds: selectedPendingLineIds,
      ...(action === 'approve' && approvalNote.trim() ? { approvalNote } : {}),
      ...(action === 'reject' ? { rejectionReason: decisionReason } : {}),
      ...(action === 'cancel' ? { cancellationReason: decisionReason } : {}),
    };
    if (action === 'approve') {
      await approveMutation.mutateAsync({ batchId: detailQuery.data.id, payload });
    } else if (action === 'reject') {
      await rejectMutation.mutateAsync({ batchId: detailQuery.data.id, payload });
    } else {
      await cancelMutation.mutateAsync({ batchId: detailQuery.data.id, payload });
    }
    resetDecisionInputs();
  };

  return (
    <PageContainer>
      <div className="space-y-4">
        <WorkScheduleSubnavigation active="request-batches" />
        <section className="rounded border border-border bg-panel p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-text">
                {t('work-schedule:requestBatches.page.title')}
              </h1>
              <p className="text-sm text-muted">
                {t('work-schedule:requestBatches.page.subtitle')}
              </p>
            </div>
            <StatusBadge
              label={t('work-schedule:requestBatches.copy.adminAuthority')}
              tone={canDecide ? 'success' : 'neutral'}
              uppercase={false}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <div className="space-y-4 rounded border border-border bg-panel p-4 shadow-sm">
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
                          resetCursorAndSelection();
                        }
                      : undefined
                  }
                />
              }
            >
              <label className="text-sm font-medium text-text">
                {t('work-schedule:requestBatches.filters.status')}
                <select
                  className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as WorkScheduleRequestBatchStatus | '');
                    resetCursorAndSelection();
                  }}
                >
                  <option value="">{t('work-schedule:requestBatches.filters.allStatuses')}</option>
                  {(['PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map(
                    (item) => (
                      <option key={item} value={item}>
                        {t(`work-schedule:requestBatches.statuses.${item}`)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="text-sm font-medium text-text">
                {t('work-schedule:requestBatches.filters.periodMonth')}
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
            </FilterToolbar>

            {listQuery.isLoading ? <LoadingState lines={4} /> : null}
            {listQuery.isError ? (
              <ErrorState
                title={t('work-schedule:requestBatches.states.listErrorTitle')}
                message={t('work-schedule:requestBatches.states.listErrorMessage')}
              />
            ) : null}
            {listQuery.data?.data.length === 0 ? (
              <EmptyState
                title={t('work-schedule:requestBatches.states.emptyTitle')}
                message={t('work-schedule:requestBatches.states.emptyMessage')}
              />
            ) : null}
            <div className="space-y-2">
              {listQuery.data?.data.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  className={`w-full rounded border px-3 py-2 text-left ${
                    selectedBatchIdOrFirst === batch.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-bg hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    setSelectedBatchId(batch.id);
                    setSelectedLineIds([]);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted">{batch.batchCode}</span>
                    <StatusBadge
                      label={t(`work-schedule:requestBatches.statuses.${batch.status}`)}
                      status={batch.status}
                      toneByStatus={batchStatusTone}
                    />
                  </div>
                  <div className="mt-1 text-sm text-text">{batch.periodMonth}</div>
                  <div className="text-xs text-muted">
                    {t('work-schedule:requestBatches.lineCounts.summary', batch.lineCounts)}
                  </div>
                </button>
              ))}
            </div>
            {listQuery.data ? (
              <CursorPager
                canGoBack={cursorStack.length > 0}
                canGoNext={Boolean(listQuery.data.meta?.nextCursor)}
                displayedCount={listQuery.data.data.length}
                limit={QUEUE_LIMIT}
                onPrevious={() => {
                  setCursorStack((current) => current.slice(0, -1));
                  resetQueueSelection();
                }}
                onNext={() => {
                  const nextCursor = listQuery.data.meta?.nextCursor;
                  if (nextCursor) {
                    setCursorStack((current) => [...current, nextCursor]);
                    resetQueueSelection();
                  }
                }}
              />
            ) : null}
          </div>

          <div className="space-y-4 rounded border border-border bg-panel p-4 shadow-sm">
            {detailQuery.isLoading ? <LoadingState lines={5} /> : null}
            {detailQuery.isError ? (
              <ErrorState
                title={t('work-schedule:requestBatches.states.detailErrorTitle')}
                message={t('work-schedule:requestBatches.states.detailErrorMessage')}
              />
            ) : null}
            {detailQuery.data ? (
              <>
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text">{detailQuery.data.batchCode}</h2>
                    <p className="text-sm text-muted">
                      {getReferenceLabel(
                        detailQuery.data.submittedByEmploymentProfileRef,
                        detailQuery.data.submittedByEmploymentProfileId,
                      )}
                    </p>
                  </div>
                  <StatusBadge
                    label={t(`work-schedule:requestBatches.statuses.${detailQuery.data.status}`)}
                    status={detailQuery.data.status}
                    toneByStatus={batchStatusTone}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryCard
                    label={t('work-schedule:requestBatches.fields.periodMonth')}
                    value={detailQuery.data.periodMonth}
                  />
                  <SummaryCard
                    label={t('work-schedule:requestBatches.fields.scopeSummary')}
                    value={t(`work-schedule:requestBatches.scopeSummaries.${detailQuery.data.scopeSummary}`)}
                  />
                  <SummaryCard
                    label={t('work-schedule:requestBatches.fields.pending')}
                    value={detailQuery.data.lineCounts.pending}
                  />
                </div>

                {canDecide ? (
                  <div className="space-y-3 rounded border border-border bg-bg p-3">
                    <div>
                      <div className="text-sm font-semibold text-text">
                        {t('work-schedule:requestBatches.decisions.title')}
                      </div>
                      <p className="text-xs text-muted">
                        {t('work-schedule:requestBatches.decisions.selectedContext', {
                          count: selectedPendingLineIds.length,
                        })}
                      </p>
                      <p className="text-xs text-muted">
                        {t('work-schedule:requestBatches.decisions.helper')}
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm font-medium text-text">
                        {t('work-schedule:requestBatches.decisions.approvalNote')}
                        <textarea
                          className="mt-1 min-h-20 w-full rounded border border-border bg-panel px-3 py-2"
                          value={approvalNote}
                          onChange={(event) => setApprovalNote(event.target.value)}
                        />
                      </label>
                      <label className="text-sm font-medium text-text">
                        {t('work-schedule:requestBatches.decisions.reason')}
                        <textarea
                          className="mt-1 min-h-20 w-full rounded border border-border bg-panel px-3 py-2"
                          value={decisionReason}
                          onChange={(event) => setDecisionReason(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        disabled={selectedPendingLineIds.length === 0 || approveMutation.isPending}
                        onClick={() => void runDecision('approve')}
                      >
                        {t('work-schedule:requestBatches.actions.approveSelected')}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-3 py-2 text-sm font-medium text-text disabled:opacity-50"
                        disabled={selectedPendingLineIds.length === 0 || decisionReason.trim().length < 10}
                        onClick={() => void runDecision('reject')}
                      >
                        {t('work-schedule:requestBatches.actions.rejectSelected')}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-3 py-2 text-sm font-medium text-text disabled:opacity-50"
                        disabled={selectedPendingLineIds.length === 0 || decisionReason.trim().length < 10}
                        onClick={() => void runDecision('cancel')}
                      >
                        {t('work-schedule:requestBatches.actions.cancelSelected')}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <table
                    className="min-w-full text-left text-sm"
                    aria-label={t('work-schedule:requestBatches.table.caption')}
                  >
                    <thead className="border-b border-border text-xs uppercase text-muted">
                      <tr>
                        {canDecide ? <th className="px-3 py-2 font-medium"> </th> : null}
                        <th className="px-3 py-2 font-medium">{t('work-schedule:requestBatches.table.line')}</th>
                        <th className="px-3 py-2 font-medium">{t('work-schedule:requestBatches.table.member')}</th>
                        <th className="px-3 py-2 font-medium">{t('work-schedule:requestBatches.table.request')}</th>
                        <th className="px-3 py-2 font-medium">{t('work-schedule:requestBatches.table.status')}</th>
                        <th className="px-3 py-2 font-medium">{t('work-schedule:requestBatches.table.notes')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailQuery.data.lines.map((line) => {
                        const selectable = canDecide && line.status === 'PENDING';
                        return (
                          <tr key={line.id} data-testid="admin-request-batch-line">
                            {canDecide ? (
                              <td className="px-3 py-3">
                                <input
                                  aria-label={t('work-schedule:requestBatches.actions.selectLine', {
                                    lineNo: line.lineNo,
                                  })}
                                  type="checkbox"
                                  disabled={!selectable}
                                  checked={selectedLineIds.includes(line.id)}
                                  onChange={(event) =>
                                    setSelectedLineIds((current) =>
                                      event.target.checked
                                        ? [...current, line.id]
                                        : current.filter((lineId) => lineId !== line.id),
                                    )
                                  }
                                />
                              </td>
                            ) : null}
                            <td className="px-3 py-3">{line.lineNo}</td>
                            <td className="px-3 py-3">
                              {getReferenceLabel(line.memberEmploymentProfileRef, line.memberEmploymentProfileId)}
                            </td>
                            <td className="px-3 py-3">
                              <div>{t(`work-schedule:requests.types.${line.requestType}`)}</div>
                              <div className="text-xs text-muted">
                                {line.title ?? line.workShiftRef?.title ?? line.workShiftId ?? '-'}
                              </div>
                              <div className="text-xs text-muted">
                                {formatTimestamp(line.requestedStartAt, line.timezone)}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge
                                label={t(`work-schedule:requestBatches.lineStatuses.${line.status}`)}
                                status={line.status}
                                toneByStatus={batchStatusTone}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="max-w-sm text-text">{line.reason}</div>
                              {line.approvalNote ? <div className="text-xs text-muted">{line.approvalNote}</div> : null}
                              {line.rejectionReason ? <div className="text-xs text-muted">{line.rejectionReason}</div> : null}
                              {line.cancellationReason ? <div className="text-xs text-muted">{line.cancellationReason}</div> : null}
                              {line.failureReason ? <div className="text-xs text-danger">{line.failureReason}</div> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </section>
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
