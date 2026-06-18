import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  useApprovePlatformEarningBatchMutation,
  useCreateRevenueEntryFromPlatformEarningBatchMutation,
  usePlatformEarningBatchDetail,
  usePlatformEarningBatches,
  usePlatformEarningLifecycleMutation,
  usePlatformEarningLines,
  useRejectPlatformEarningBatchMutation,
  useVoidPlatformEarningBatchMutation,
} from '@modules/revenue-ledger/hooks/use-revenue-ledger';
import type {
  PlatformEarningApprovePayload,
  PlatformEarningBatch,
  PlatformEarningBatchQuery,
  PlatformEarningBatchStatus,
} from '@modules/revenue-ledger/types/revenue-ledger.types';
import { platformEarningBatchStatusValues } from '@modules/revenue-ledger/types/revenue-ledger.types';
import type { NormalizedApiError } from '@shared/api';
import {
  CursorPager,
  ErrorState,
  LoadingState,
  StatusBadge,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  PERMISSIONS,
  canShowAction,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  formatCurrency,
  formatDecimal,
  formatUtcMidnightDateLike,
  formatVietnamMonthLabel,
  formatVietnamTimestamp,
} from '@shared/formatting/formatters';

type ApprovalFormValues = {
  targetCurrency: string;
  appliedRate: string;
  platformCutRate: string;
  companyShareRate: string;
  rateType: string;
  sourceNote: string;
};

type ReasonAction = 'reject' | 'void';

const statusTone = {
  DRAFT: 'muted',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  VOIDED: 'muted',
  ARCHIVED: 'muted',
} as const;

const revenueLedgerGlobalScope = { module: 'revenueLedger', value: 'global' } as const;

const formatNullableMoney = (value: number | null, currencyCode = 'VND'): string =>
  value === null ? '-' : formatCurrency(value, currencyCode);

const canSubmit = (batch: PlatformEarningBatch): boolean => batch.status === 'DRAFT';
const canStartReview = (batch: PlatformEarningBatch): boolean => batch.status === 'SUBMITTED';
const canApprove = (batch: PlatformEarningBatch): boolean => batch.status === 'UNDER_REVIEW';
const canReject = (batch: PlatformEarningBatch): boolean =>
  batch.status === 'SUBMITTED' || batch.status === 'UNDER_REVIEW';
const canVoid = (batch: PlatformEarningBatch): boolean =>
  ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(batch.status);
const canArchive = (batch: PlatformEarningBatch): boolean =>
  ['REJECTED', 'VOIDED', 'APPROVED'].includes(batch.status);
const canCreateRevenueEntry = (batch: PlatformEarningBatch): boolean =>
  batch.status === 'APPROVED' && !batch.revenueEntryId;

export const getPlatformEarningActionAvailabilityForTest = (
  batch: PlatformEarningBatch,
) => ({
  submit: canSubmit(batch),
  startReview: canStartReview(batch),
  approve: canApprove(batch),
  reject: canReject(batch),
  void: canVoid(batch),
  archive: canArchive(batch),
  createRevenueEntry: canCreateRevenueEntry(batch),
});

export const PlatformEarningBatchesPanel = (): JSX.Element => {
  const { t } = useTranslation(['revenue-ledger', 'common']);
  const [query, setQuery] = useState<PlatformEarningBatchQuery>({ limit: 20 });
  const [selectedBatchId, setSelectedBatchId] = useState<string>();
  const [approvalBatchId, setApprovalBatchId] = useState<string>();
  const [reasonAction, setReasonAction] = useState<ReasonAction>();
  const [reason, setReason] = useState('');
  const [reasonValidation, setReasonValidation] = useState<string>();
  const [revenueEntryBatchId, setRevenueEntryBatchId] = useState<string>();
  const [subjectTalentId, setSubjectTalentId] = useState('');
  const [subjectValidation, setSubjectValidation] = useState<string>();
  const batchesQuery = usePlatformEarningBatches(query);
  const detailQuery = usePlatformEarningBatchDetail(selectedBatchId);
  const linesQuery = usePlatformEarningLines(
    { batchId: selectedBatchId, limit: 20 },
    Boolean(selectedBatchId),
  );
  const capabilitiesQuery = useCurrentActorCapabilities();
  const lifecycleMutation = usePlatformEarningLifecycleMutation();
  const approveMutation = useApprovePlatformEarningBatchMutation();
  const rejectMutation = useRejectPlatformEarningBatchMutation();
  const voidMutation = useVoidPlatformEarningBatchMutation();
  const createEntryMutation = useCreateRevenueEntryFromPlatformEarningBatchMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const approvalForm = useForm<ApprovalFormValues>({
    defaultValues: {
      targetCurrency: 'VND',
      appliedRate: '1',
      platformCutRate: '0.5',
      companyShareRate: '0.5',
      rateType: 'FINANCE_APPROVED',
      sourceNote: '',
    },
  });

  const permissions = useMemo(
    () => ({
      submit: canShowAction(capabilitiesQuery.data, {
        permission: PERMISSIONS.REVENUE_LEDGER_PLATFORM_EARNING_SUBMIT,
        scope: revenueLedgerGlobalScope,
      }),
      review: canShowAction(capabilitiesQuery.data, {
        permission: PERMISSIONS.REVENUE_LEDGER_PLATFORM_EARNING_REVIEW,
        scope: revenueLedgerGlobalScope,
      }),
      approve: canShowAction(capabilitiesQuery.data, {
        permission: PERMISSIONS.REVENUE_LEDGER_PLATFORM_EARNING_APPROVE,
        scope: revenueLedgerGlobalScope,
      }),
      void: canShowAction(capabilitiesQuery.data, {
        permission: PERMISSIONS.REVENUE_LEDGER_PLATFORM_EARNING_VOID,
        scope: revenueLedgerGlobalScope,
      }),
      createRevenueEntry: canShowAction(capabilitiesQuery.data, {
        permission: PERMISSIONS.REVENUE_LEDGER_CREATE,
        scope: revenueLedgerGlobalScope,
      }),
    }),
    [capabilitiesQuery.data],
  );

  const selectedBatch = detailQuery.data;
  const selectedCurrency = selectedBatch?.conversionSnapshot?.targetCurrency ?? 'VND';

  const patchQuery = (patch: Partial<PlatformEarningBatchQuery>): void => {
    setQuery((current) => ({ ...current, ...patch, cursor: undefined }));
  };

  const runLifecycle = async (
    batchId: string,
    action: 'submit' | 'start-review' | 'archive',
  ): Promise<void> => {
    try {
      await lifecycleMutation.mutateAsync({ batchId, action });
      notifySuccess('revenue-ledger:platformEarnings.feedback.updated');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const runReasonAction = async (batchId: string): Promise<void> => {
    if (!reasonAction) return;
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setReasonValidation(t('revenue-ledger:platformEarnings.validation.reasonRequired'));
      return;
    }
    try {
      if (reasonAction === 'reject') {
        await rejectMutation.mutateAsync({ batchId, payload: { reason: normalizedReason } });
      } else {
        await voidMutation.mutateAsync({ batchId, payload: { reason: normalizedReason } });
      }
      notifySuccess('revenue-ledger:platformEarnings.feedback.updated');
      setReasonAction(undefined);
      setReason('');
      setReasonValidation(undefined);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onApprove = approvalForm.handleSubmit(async (values) => {
    if (!approvalBatchId) return;
    const payload: PlatformEarningApprovePayload = {
      targetCurrency: values.targetCurrency.trim().toUpperCase(),
      appliedRate: Number(values.appliedRate),
      platformCutRate: Number(values.platformCutRate),
      companyShareRate: Number(values.companyShareRate),
      rateType: values.rateType.trim() || 'FINANCE_APPROVED',
      sourceNote: values.sourceNote.trim() || null,
    };
    try {
      await approveMutation.mutateAsync({ batchId: approvalBatchId, payload });
      notifySuccess('revenue-ledger:platformEarnings.feedback.updated');
      setApprovalBatchId(undefined);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  });

  const batchTalentIds = useMemo(
    () =>
      [
        ...new Set(
          (linesQuery.data?.data ?? [])
            .map((line) => line.memberTalentId)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [linesQuery.data?.data],
  );

  const createRevenueEntry = async (
    batchId: string,
    selectedSubjectTalentId?: string,
  ): Promise<void> => {
    try {
      await createEntryMutation.mutateAsync({
        batchId,
        payload: selectedSubjectTalentId ? { subjectTalentId: selectedSubjectTalentId } : {},
      });
      notifySuccess('revenue-ledger:platformEarnings.feedback.revenueEntryCreated');
      setRevenueEntryBatchId(undefined);
      setSubjectTalentId('');
      setSubjectValidation(undefined);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const startRevenueEntryCreation = (batchId: string): void => {
    if (batchTalentIds.length === 1) {
      void createRevenueEntry(batchId, batchTalentIds[0]);
      return;
    }
    setRevenueEntryBatchId(batchId);
    setSubjectTalentId('');
    setSubjectValidation(undefined);
  };

  const submitRevenueEntryCreation = (): void => {
    if (!revenueEntryBatchId) return;
    const normalizedSubjectTalentId = subjectTalentId.trim();
    if (!normalizedSubjectTalentId) {
      setSubjectValidation(
        t('revenue-ledger:platformEarnings.validation.subjectTalentRequired'),
      );
      return;
    }
    void createRevenueEntry(revenueEntryBatchId, normalizedSubjectTalentId);
  };

  return (
    <section className="space-y-4 rounded border border-border bg-panel p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">
            {t('revenue-ledger:platformEarnings.title')}
          </h2>
          <p className="text-sm text-muted">
            {t('revenue-ledger:platformEarnings.boundaryHelper')}
          </p>
        </div>
        <StatusBadge
          label={t('revenue-ledger:platformEarnings.reviewBadge')}
          tone="info"
          uppercase={false}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted">
            {t('revenue-ledger:platformEarnings.filters.status')}
          </span>
          <select
            className="rounded border border-border bg-bg px-2 py-1.5"
            value={query.status ?? ''}
            onChange={(event) =>
              patchQuery({
                status: (event.target.value || undefined) as PlatformEarningBatchStatus | undefined,
              })
            }
          >
            <option value="">{t('revenue-ledger:platformEarnings.filters.allStatuses')}</option>
            {platformEarningBatchStatusValues.map((status) => (
              <option key={status} value={status}>
                {t(`revenue-ledger:platformEarnings.statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted">
            {t('revenue-ledger:platformEarnings.filters.periodMonth')}
          </span>
          <input
            type="month"
            className="rounded border border-border bg-bg px-2 py-1.5"
            value={query.periodMonth ?? ''}
            onChange={(event) => patchQuery({ periodMonth: event.target.value || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted">
            {t('revenue-ledger:platformEarnings.fields.platform')}
          </span>
          <input
            className="rounded border border-border bg-bg px-2 py-1.5"
            value={query.platform ?? ''}
            placeholder="TIKTOK"
            onChange={(event) => patchQuery({ platform: event.target.value || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted">
            {t('revenue-ledger:platformEarnings.fields.platformAccountId')}
          </span>
          <input
            className="rounded border border-border bg-bg px-2 py-1.5"
            value={query.platformAccountId ?? ''}
            onChange={(event) =>
              patchQuery({ platformAccountId: event.target.value || undefined })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted">
            {t('revenue-ledger:platformEarnings.fields.talentGroupId')}
          </span>
          <input
            className="rounded border border-border bg-bg px-2 py-1.5"
            value={query.talentGroupId ?? ''}
            onChange={(event) => patchQuery({ talentGroupId: event.target.value || undefined })}
          />
        </label>
      </div>

      {batchesQuery.isLoading ? <LoadingState lines={4} /> : null}
      {batchesQuery.isError ? (
        <ErrorState
          title={t('revenue-ledger:platformEarnings.states.loadErrorTitle')}
          message={t('revenue-ledger:platformEarnings.states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void batchesQuery.refetch()}
        />
      ) : null}
      <div className="overflow-x-auto rounded border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t('revenue-ledger:platformEarnings.fields.batchCode')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('revenue-ledger:platformEarnings.fields.periodMonth')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('revenue-ledger:platformEarnings.fields.status')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('revenue-ledger:platformEarnings.fields.rawQuantityTotal')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('revenue-ledger:platformEarnings.fields.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(batchesQuery.data?.data ?? []).map((batch) => (
              <tr key={batch.id}>
                <td className="px-3 py-3">
                  <div className="font-medium text-text">{batch.batchCode}</div>
                  <div className="font-mono text-xs text-muted">{batch.platformAccountId}</div>
                </td>
                <td className="px-3 py-3">{formatVietnamMonthLabel(batch.periodMonth)}</td>
                <td className="px-3 py-3">
                  <StatusBadge
                    status={batch.status}
                    label={t(`revenue-ledger:platformEarnings.statuses.${batch.status}`)}
                    toneByStatus={statusTone}
                  />
                </td>
                <td className="px-3 py-3">{formatDecimal(batch.rawQuantityTotal, 'vi-VN', 0)}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg"
                    onClick={() => setSelectedBatchId(batch.id)}
                  >
                    {t('revenue-ledger:actions.open')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CursorPager
        canGoBack={Boolean(query.cursor)}
        canGoNext={Boolean(batchesQuery.data?.meta?.nextCursor)}
        onNext={() => setQuery((current) => ({ ...current, cursor: batchesQuery.data?.meta?.nextCursor }))}
        onPrevious={() => setQuery((current) => ({ ...current, cursor: undefined }))}
      />

      {selectedBatch ? (
        <div className="space-y-4 rounded border border-border bg-bg p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-text">{selectedBatch.batchCode}</h3>
              <p className="text-sm text-muted">
                {formatUtcMidnightDateLike(selectedBatch.sourceDateFrom)} -{' '}
                {formatUtcMidnightDateLike(selectedBatch.sourceDateTo)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {permissions.submit && canSubmit(selectedBatch) ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={() => void runLifecycle(selectedBatch.id, 'submit')}
                >
                  {t('revenue-ledger:platformEarnings.actions.submit')}
                </button>
              ) : null}
              {permissions.review && canStartReview(selectedBatch) ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={() => void runLifecycle(selectedBatch.id, 'start-review')}
                >
                  {t('revenue-ledger:platformEarnings.actions.startReview')}
                </button>
              ) : null}
              {permissions.approve && canApprove(selectedBatch) ? (
                <button
                  type="button"
                  className="rounded border border-accent px-3 py-1.5 text-sm text-accent"
                  onClick={() => setApprovalBatchId(selectedBatch.id)}
                >
                  {t('revenue-ledger:platformEarnings.actions.approve')}
                </button>
              ) : null}
              {permissions.review && canReject(selectedBatch) ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={() => {
                    setReasonAction('reject');
                    setReason('');
                    setReasonValidation(undefined);
                  }}
                >
                  {t('revenue-ledger:platformEarnings.actions.reject')}
                </button>
              ) : null}
              {permissions.void && canVoid(selectedBatch) ? (
                <button
                  type="button"
                  className="rounded border border-danger px-3 py-1.5 text-sm text-danger"
                  onClick={() => {
                    setReasonAction('void');
                    setReason('');
                    setReasonValidation(undefined);
                  }}
                >
                  {t('revenue-ledger:platformEarnings.actions.void')}
                </button>
              ) : null}
              {permissions.review && canArchive(selectedBatch) ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={() => void runLifecycle(selectedBatch.id, 'archive')}
                >
                  {t('revenue-ledger:platformEarnings.actions.archive')}
                </button>
              ) : null}
              {permissions.createRevenueEntry && canCreateRevenueEntry(selectedBatch) ? (
                <button
                  type="button"
                  className="rounded border border-accent bg-accent px-3 py-1.5 text-sm text-white"
                  onClick={() => startRevenueEntryCreation(selectedBatch.id)}
                >
                  {t('revenue-ledger:platformEarnings.actions.createRevenueEntry')}
                </button>
              ) : null}
            </div>
          </div>

          {reasonAction ? (
            <div className="space-y-3 rounded border border-border bg-panel p-3">
              <label className="block text-sm font-medium text-text">
                {t(`revenue-ledger:platformEarnings.reason.${reasonAction}Label`)}
                <textarea
                  className="mt-1 min-h-24 w-full rounded border border-border bg-bg px-3 py-2"
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonValidation(undefined);
                  }}
                />
              </label>
              {reasonValidation ? (
                <p className="text-sm text-danger" role="alert">
                  {reasonValidation}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-danger px-3 py-1.5 text-sm text-danger"
                  onClick={() => void runReasonAction(selectedBatch.id)}
                >
                  {t(`revenue-ledger:platformEarnings.actions.${reasonAction}`)}
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={() => {
                    setReasonAction(undefined);
                    setReason('');
                    setReasonValidation(undefined);
                  }}
                >
                  {t('common:actions.cancel')}
                </button>
              </div>
            </div>
          ) : null}

          {revenueEntryBatchId === selectedBatch.id ? (
            <div className="space-y-3 rounded border border-border bg-panel p-3">
              <p className="text-sm text-muted">
                {t('revenue-ledger:platformEarnings.revenueEntry.subjectHelper')}
              </p>
              <label className="block text-sm font-medium text-text">
                {t('revenue-ledger:platformEarnings.revenueEntry.subjectTalent')}
                {batchTalentIds.length > 0 ? (
                  <select
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                    value={subjectTalentId}
                    onChange={(event) => {
                      setSubjectTalentId(event.target.value);
                      setSubjectValidation(undefined);
                    }}
                  >
                    <option value="">
                      {t('revenue-ledger:platformEarnings.revenueEntry.selectSubject')}
                    </option>
                    {batchTalentIds.map((talentId) => (
                      <option key={talentId} value={talentId}>
                        {talentId}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                    value={subjectTalentId}
                    onChange={(event) => {
                      setSubjectTalentId(event.target.value);
                      setSubjectValidation(undefined);
                    }}
                  />
                )}
              </label>
              {subjectValidation ? (
                <p className="text-sm text-danger" role="alert">
                  {subjectValidation}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded bg-accent px-3 py-1.5 text-sm text-white"
                  onClick={submitRevenueEntryCreation}
                >
                  {t('revenue-ledger:platformEarnings.actions.createRevenueEntry')}
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-3 py-1.5 text-sm"
                  onClick={() => {
                    setRevenueEntryBatchId(undefined);
                    setSubjectTalentId('');
                    setSubjectValidation(undefined);
                  }}
                >
                  {t('common:actions.cancel')}
                </button>
              </div>
            </div>
          ) : null}

          {approvalBatchId === selectedBatch.id ? (
            <form className="grid gap-3 rounded border border-border p-3 md:grid-cols-3" onSubmit={(event) => void onApprove(event)}>
              <input
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('revenue-ledger:platformEarnings.approval.targetCurrency')}
                {...approvalForm.register('targetCurrency')}
              />
              <input
                type="number"
                step="0.00000001"
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('revenue-ledger:platformEarnings.approval.appliedRate')}
                {...approvalForm.register('appliedRate')}
              />
              <input
                type="number"
                step="0.000001"
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('revenue-ledger:platformEarnings.approval.platformCutRate')}
                {...approvalForm.register('platformCutRate')}
              />
              <input
                type="number"
                step="0.000001"
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('revenue-ledger:platformEarnings.approval.companyShareRate')}
                {...approvalForm.register('companyShareRate')}
              />
              <input
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('revenue-ledger:platformEarnings.approval.rateType')}
                {...approvalForm.register('rateType')}
              />
              <button type="submit" className="rounded border border-accent px-3 py-1.5 text-sm text-accent">
                {t('revenue-ledger:platformEarnings.actions.approve')}
              </button>
            </form>
          ) : null}

          <dl className="grid gap-3 md:grid-cols-4">
            <div>
              <dt className="text-xs uppercase text-muted">
                {t('revenue-ledger:platformEarnings.fields.sourceLineCount')}
              </dt>
              <dd className="font-medium">{selectedBatch.sourceLineCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted">
                {t('revenue-ledger:platformEarnings.fields.companyNetAmount')}
              </dt>
              <dd className="font-medium">
                {formatNullableMoney(selectedBatch.companyNetAmount, selectedCurrency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted">
                {t('revenue-ledger:platformEarnings.fields.commissionableBasisAmount')}
              </dt>
              <dd className="font-medium">
                {formatNullableMoney(selectedBatch.commissionableBasisAmount, selectedCurrency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted">
                {t('revenue-ledger:platformEarnings.fields.revenueEntry')}
              </dt>
              <dd className="font-mono text-sm">{selectedBatch.revenueEntryId ?? '-'}</dd>
            </div>
          </dl>

          <div className="grid gap-3 lg:grid-cols-3">
            <SnapshotBlock title={t('revenue-ledger:platformEarnings.snapshots.conversion')}>
              {selectedBatch.conversionSnapshot ? (
                <>
                  <p>{selectedBatch.conversionSnapshot.targetCurrency}</p>
                  <p>{formatDecimal(selectedBatch.conversionSnapshot.appliedRate, 'vi-VN', 8)}</p>
                  <p>
                    {formatCurrency(
                      selectedBatch.conversionSnapshot.grossConvertedAmount,
                      selectedBatch.conversionSnapshot.targetCurrency,
                    )}
                  </p>
                </>
              ) : (
                <p>-</p>
              )}
            </SnapshotBlock>
            <SnapshotBlock title={t('revenue-ledger:platformEarnings.snapshots.platformCut')}>
              {selectedBatch.platformCutSnapshot ? (
                <>
                  <p>{formatDecimal(selectedBatch.platformCutSnapshot.platformCutRate, 'vi-VN', 6)}</p>
                  <p>{formatCurrency(selectedBatch.platformCutSnapshot.platformCutAmount, selectedCurrency)}</p>
                  <p>{formatCurrency(selectedBatch.platformCutSnapshot.companyNetAmount, selectedCurrency)}</p>
                </>
              ) : (
                <p>-</p>
              )}
            </SnapshotBlock>
            <SnapshotBlock title={t('revenue-ledger:platformEarnings.snapshots.traceability')}>
              <p className="break-all font-mono text-xs">{selectedBatch.sourceFingerprint ?? '-'}</p>
              <p>{selectedBatch.approvedAt ? formatVietnamTimestamp(selectedBatch.approvedAt) : '-'}</p>
            </SnapshotBlock>
          </div>

          <div className="overflow-x-auto rounded border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t('revenue-ledger:platformEarnings.lines.sourceDate')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('revenue-ledger:platformEarnings.lines.member')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('revenue-ledger:platformEarnings.lines.rawQuantity')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('revenue-ledger:platformEarnings.lines.externalSourceRef')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(linesQuery.data?.data ?? []).map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-3">{formatUtcMidnightDateLike(line.sourceDate)}</td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {line.memberEmploymentProfileId ?? line.memberTalentId ?? '-'}
                    </td>
                    <td className="px-3 py-3">{formatDecimal(line.rawQuantity, 'vi-VN', 0)}</td>
                    <td className="px-3 py-3">{line.externalSourceRef ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
};

const SnapshotBlock = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element => (
  <div className="rounded border border-border bg-panel p-3 text-sm">
    <h4 className="font-medium text-text">{title}</h4>
    <div className="mt-2 space-y-1 text-muted">{children}</div>
  </div>
);
