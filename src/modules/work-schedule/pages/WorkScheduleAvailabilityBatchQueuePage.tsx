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
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  StatusBadge,
} from '@shared/components/primitives';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';

const batchStatusTone = {
  PENDING: 'warning',
  PARTIALLY_APPROVED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
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
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>();
  const [selectedReviewLineIds, setSelectedReviewLineIds] = useState<string[]>([]);
  const [selectedApplyLineIds, setSelectedApplyLineIds] = useState<string[]>([]);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [monthlyRosterId, setMonthlyRosterId] = useState('');
  const [applyNote, setApplyNote] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [applyResult, setApplyResult] =
    useState<ApplyAvailabilityLinesToMonthlyRosterResult | null>(null);
  const listQuery = useWorkScheduleAvailabilityBatchList({
    status: status || undefined,
    periodMonth: periodMonth || undefined,
    targetType: targetType || undefined,
    limit: 50,
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
    resetDecisionInputs();
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
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-text">
                {t('work-schedule:availabilityBatches.page.title')}
              </h1>
              <p className="text-sm text-muted">
                {t('work-schedule:availabilityBatches.page.subtitle')}
              </p>
            </div>
            <StatusBadge label={t('work-schedule:availabilityBatches.badges.global')} tone="info" />
          </div>

          <div className="mt-4 rounded border border-border bg-bg p-3 text-sm text-muted">
            <p>{t('work-schedule:availabilityBatches.copy.planning')}</p>
            <p>{t('work-schedule:availabilityBatches.copy.applyDraftOnly')}</p>
            <p>{t('work-schedule:availabilityBatches.copy.publishStillRequired')}</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-text">
              {t('work-schedule:availabilityBatches.filters.status')}
              <select
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as WorkScheduleAvailabilityBatchStatus | '')
                }
              >
                <option value="">{t('work-schedule:availabilityBatches.filters.all')}</option>
                {Object.keys(batchStatusTone).map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
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
                onChange={(event) => setPeriodMonth(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-text">
              {t('work-schedule:availabilityBatches.filters.targetType')}
              <select
                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                value={targetType}
                onChange={(event) =>
                  setTargetType(event.target.value as 'ORG_UNIT' | 'TALENT_GROUP' | '')
                }
              >
                <option value="">{t('work-schedule:availabilityBatches.filters.all')}</option>
                <option value="ORG_UNIT">ORG_UNIT</option>
                <option value="TALENT_GROUP">TALENT_GROUP</option>
              </select>
            </label>
          </div>

          {listQuery.isLoading ? <LoadingState lines={4} /> : null}
          {listQuery.isError ? (
            <ErrorState
              title={t('work-schedule:availabilityBatches.states.loadErrorTitle')}
              message={t('work-schedule:availabilityBatches.states.loadErrorMessage')}
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
                      label={batch.status}
                      tone={batchStatusTone[batch.status] ?? 'neutral'}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {batch.submitter?.displayName ?? '-'} - {batch.periodMonth} -{' '}
                    {batch.target?.displayName ?? batch.target?.name ?? batch.targetType}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {batch.lineCounts.pending} pending / {batch.lineCounts.approved} approved /{' '}
                    {batch.lineCounts.cancelled} cancelled
                  </div>
                </button>
              ))}
              {!listQuery.isLoading && (listQuery.data?.items ?? []).length === 0 ? (
                <EmptyState
                  title={t('work-schedule:availabilityBatches.states.emptyTitle')}
                  message={t('work-schedule:availabilityBatches.states.emptyMessage')}
                />
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
                      label={detailQuery.data.status}
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
                      value="NOT_EVALUATED"
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
                          <button
                            type="button"
                            className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                            disabled={selectedReviewLines.length === 0 || approveMutation.isPending}
                            onClick={() => void runDecision('approve')}
                          >
                            {t('work-schedule:availabilityBatches.actions.approve')}
                          </button>
                          <button
                            type="button"
                            className="rounded border border-danger px-3 py-2 text-sm font-medium text-danger disabled:opacity-50"
                            disabled={selectedReviewLines.length === 0 || rejectMutation.isPending}
                            onClick={() => void runDecision('reject')}
                          >
                            {t('work-schedule:availabilityBatches.actions.reject')}
                          </button>
                          <button
                            type="button"
                            className="rounded border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
                            disabled={selectedReviewLines.length === 0 || cancelMutation.isPending}
                            onClick={() => void runDecision('cancel')}
                          >
                            {t('work-schedule:availabilityBatches.actions.cancel')}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-text">
                          {t('work-schedule:availabilityBatches.apply.title')}
                        </h3>
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
                        <button
                          type="button"
                          className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          disabled={selectedApplyLines.length === 0 || applyMutation.isPending}
                          onClick={() => void runApply()}
                        >
                          {t('work-schedule:availabilityBatches.actions.apply')}
                        </button>
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
                          <th className="px-3 py-2">
                            {t('work-schedule:availabilityBatches.table.refs')}
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
                            <td className="px-3 py-2">{line.status}</td>
                            <td className="px-3 py-2">{line.applyStatus}</td>
                            <td className="px-3 py-2">{line.policyEvaluationStatus}</td>
                            <td className="px-3 py-2">
                              {line.appliedRosterId ?? '-'}
                              {line.appliedRosterExceptionIds.length > 0 ? (
                                <div className="text-xs text-muted">
                                  {line.appliedRosterExceptionIds.join(', ')}
                                </div>
                              ) : null}
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
                        {applyResult.results.map((result) => (
                          <li key={`${result.availabilityLineId}-${result.outcome}`}>
                            {result.availabilityLineId}: {result.outcome}
                            {result.rosterExceptionIds.length > 0
                              ? ` (${result.rosterExceptionIds.join(', ')})`
                              : ''}
                            {result.reason ? ` - ${result.reason}` : ''}
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
