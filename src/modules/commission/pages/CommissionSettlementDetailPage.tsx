import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { buildEntityDetailHref } from '@app/router/reference-links';
import { createCommissionSettlementActionRailItems } from '@modules/commission/actions/commission-action-rail';
import {
  CommissionSettlementDraftCoreSurface,
  CommissionSettlementRevenueEntriesSurface,
} from '@modules/commission/forms/commission-mutation-forms';
import {
  useCommissionSettlementDetail,
  useCommissionSettlementLifecycleMutation,
  useCommissionSettlementLines,
  useReplaceCommissionSettlementRevenueEntriesMutation,
  useUpdateCommissionSettlementDraftCoreMutation,
} from '@modules/commission/hooks/use-commission';
import { commissionSettlementStatusToneMap } from '@modules/commission/tables/commission-columns';
import type { CommissionSettlementLifecycleAction } from '@modules/commission/types/commission.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ActionRail,
  ErrorState,
  LoadingState,
  MetadataSection,
  NotFoundState,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  ReferenceChip,
  RelatedSectionShell,
  StatusBadge,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { formatCurrency, formatDecimal, formatUtcTimestamp } from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface = 'draft-core' | 'revenue-entries' | null;

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const formatNullableTimestamp = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return formatUtcTimestamp(value);
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

const readLifecycleConfirmKey = (action: CommissionSettlementLifecycleAction): string => {
  switch (action) {
    case 'finalize':
      return 'commission:settlements.confirm.finalize';
    case 'void':
      return 'commission:settlements.confirm.void';
    case 'archive':
      return 'commission:settlements.confirm.archive';
    default:
      return 'commission:settlements.confirm.archive';
  }
};

export const CommissionSettlementDetailPage = (): JSX.Element => {
  const { commissionSettlementId } = useParams<{ commissionSettlementId: string }>();
  const { t } = useTranslation(['commission', 'common', 'errors']);
  const detailQuery = useCommissionSettlementDetail(commissionSettlementId);
  const linesQuery = useCommissionSettlementLines(commissionSettlementId);
  const draftCoreMutation = useUpdateCommissionSettlementDraftCoreMutation();
  const revenueEntriesMutation = useReplaceCommissionSettlementRevenueEntriesMutation();
  const lifecycleMutation = useCommissionSettlementLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [commissionSettlementId]);

  const detailError = detailQuery.error as NormalizedApiError | null;
  const linesError = linesQuery.error as NormalizedApiError | null;
  const detailState = useMemo(() => {
    if (detailQuery.isPending) {
      return 'loading' as const;
    }

    if (detailQuery.isError) {
      if (detailError?.permissionDenied) {
        return 'denied' as const;
      }

      if (detailError?.notFound) {
        return 'not-found' as const;
      }

      return 'error' as const;
    }

    return 'ready' as const;
  }, [
    detailError?.notFound,
    detailError?.permissionDenied,
    detailQuery.isError,
    detailQuery.isPending,
  ]);

  const record = detailQuery.data;
  const lines = linesQuery.data ?? [];

  const onLifecycleAction = useCallback(
    async (action: CommissionSettlementLifecycleAction) => {
      if (!record) {
        return;
      }

      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          commissionSettlementId: record.id,
          action,
        });
        notifySuccess('commission:settlements.feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return createCommissionSettlementActionRailItems(t, record, {
      onDraftCoreEdit: () => setActiveSurface('draft-core'),
      onReplaceRevenueEntries: () => setActiveSurface('revenue-entries'),
      onLifecycleAction,
      isLifecyclePending: (action) =>
        lifecycleMutation.isPending &&
        lifecycleMutation.variables?.commissionSettlementId === record.id &&
        lifecycleMutation.variables?.action === action,
    });
  }, [lifecycleMutation.isPending, lifecycleMutation.variables, onLifecycleAction, record, t]);

  const sourceRuleHref = buildEntityDetailHref('commissionRule', record?.sourceRuleId);
  const sourceContractHref = buildEntityDetailHref(
    'contractRecord',
    record?.sourceContractRecordIdSnapshot,
  );
  const beneficiaryId =
    record?.beneficiaryKindSnapshot === 'EMPLOYMENT_PROFILE'
      ? record.beneficiaryEmploymentProfileIdSnapshot
      : record?.beneficiaryTalentIdSnapshot;
  const beneficiaryHref =
    record?.beneficiaryKindSnapshot === 'EMPLOYMENT_PROFILE'
      ? buildEntityDetailHref('employmentProfile', beneficiaryId)
      : buildEntityDetailHref('talent', beneficiaryId);
  const subjectTalentHref = buildEntityDetailHref('talent', record?.subjectTalentId);

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`commission:settlements.statuses.${record.status}`)}
            toneByStatus={commissionSettlementStatusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.status === 'ARCHIVED' ||
        record?.status === 'FINALIZED' ||
        record?.status === 'VOIDED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {record.status === 'ARCHIVED'
              ? t('commission:settlements.detail.archivedReadOnly')
              : t('commission:settlements.detail.derivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('commission:settlements.detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'settlement-code',
                  label: t('commission:settlements.fields.settlementCode'),
                  value: <ReferenceChip label={record.settlementCode} />,
                },
                {
                  key: 'title',
                  label: t('commission:settlements.fields.title'),
                  value: record.title,
                },
                {
                  key: 'status',
                  label: t('commission:settlements.fields.status'),
                  value: t(`commission:settlements.statuses.${record.status}`),
                },
                {
                  key: 'scope',
                  label: t('commission:settlements.fields.scopeBoundary'),
                  value: t('commission:globalOnly'),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('commission:settlements.detail.amountsTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'currency',
                  label: t('commission:settlements.fields.settlementCurrencyCode'),
                  value: record.settlementCurrencyCode,
                },
                {
                  key: 'gross',
                  label: t('commission:settlements.fields.grossRevenueAmount'),
                  value: formatCurrency(record.grossRevenueAmount, record.settlementCurrencyCode),
                },
                {
                  key: 'amount',
                  label: t('commission:settlements.fields.settlementAmount'),
                  value: formatCurrency(record.settlementAmount, record.settlementCurrencyCode),
                },
                {
                  key: 'rate',
                  label: t('commission:settlements.fields.ratePercentSnapshot'),
                  value: `${formatDecimal(record.ratePercentSnapshot, undefined, 4)}%`,
                },
                {
                  key: 'basis',
                  label: t('commission:settlements.fields.settlementBasisSnapshot'),
                  value: t(`commission:settlementBases.${record.settlementBasisSnapshot}`),
                },
                {
                  key: 'kind',
                  label: t('commission:settlements.fields.settlementKindSnapshot'),
                  value: t(`commission:settlementKinds.${record.settlementKindSnapshot}`),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      sections={
        record ? (
          <div className="space-y-4">
            <MetadataSection title={t('commission:settlements.detail.sourceTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'source-rule',
                    label: t('commission:settlements.fields.sourceRuleId'),
                    value:
                      sourceRuleHref && record.sourceRuleId ? (
                        <Link className="font-mono text-accent hover:underline" to={sourceRuleHref}>
                          {record.sourceRuleId}
                        </Link>
                      ) : (
                        record.sourceRuleId
                      ),
                  },
                  {
                    key: 'source-contract',
                    label: t('commission:settlements.fields.sourceContractRecordIdSnapshot'),
                    value:
                      sourceContractHref && record.sourceContractRecordIdSnapshot ? (
                        <Link
                          className="font-mono text-accent hover:underline"
                          to={sourceContractHref}
                        >
                          {record.sourceContractRecordIdSnapshot}
                        </Link>
                      ) : (
                        formatNullable(record.sourceContractRecordIdSnapshot)
                      ),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('commission:settlements.detail.beneficiaryTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'beneficiary-kind',
                    label: t('commission:settlements.fields.beneficiaryKindSnapshot'),
                    value: t(`commission:beneficiaryKinds.${record.beneficiaryKindSnapshot}`),
                  },
                  {
                    key: 'beneficiary-id',
                    label: t('commission:settlements.fields.beneficiarySnapshotId'),
                    value:
                      beneficiaryHref && beneficiaryId ? (
                        <Link
                          className="font-mono text-accent hover:underline"
                          to={beneficiaryHref}
                        >
                          {beneficiaryId}
                        </Link>
                      ) : (
                        formatNullable(beneficiaryId)
                      ),
                  },
                  {
                    key: 'subject-talent',
                    label: t('commission:settlements.fields.subjectTalentId'),
                    value:
                      subjectTalentHref && record.subjectTalentId ? (
                        <Link
                          className="font-mono text-accent hover:underline"
                          to={subjectTalentHref}
                        >
                          {record.subjectTalentId}
                        </Link>
                      ) : (
                        record.subjectTalentId
                      ),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('commission:settlements.detail.periodTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'period-start',
                    label: t('commission:settlements.fields.settlementPeriodStartAt'),
                    value: formatUtcTimestamp(record.settlementPeriodStartAt),
                  },
                  {
                    key: 'period-end',
                    label: t('commission:settlements.fields.settlementPeriodEndAt'),
                    value: formatUtcTimestamp(record.settlementPeriodEndAt),
                  },
                  {
                    key: 'finalized',
                    label: t('commission:settlements.fields.finalizedAt'),
                    value: formatNullableTimestamp(record.finalizedAt),
                  },
                  {
                    key: 'voided',
                    label: t('commission:settlements.fields.voidedAt'),
                    value: formatNullableTimestamp(record.voidedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('commission:settlements.detail.revenueEntriesTitle')}>
              <div className="flex flex-wrap gap-2">
                {record.revenueEntryIds.map((revenueEntryId) => {
                  const href = buildEntityDetailHref('revenueEntry', revenueEntryId);
                  return href ? (
                    <Link
                      key={revenueEntryId}
                      to={href}
                      className="rounded border border-border bg-bg px-2 py-1 font-mono text-xs text-accent hover:underline"
                    >
                      {revenueEntryId}
                    </Link>
                  ) : (
                    <span
                      key={revenueEntryId}
                      className="rounded border border-border bg-bg px-2 py-1 font-mono text-xs"
                    >
                      {revenueEntryId}
                    </span>
                  );
                })}
              </div>
            </MetadataSection>
            <MetadataSection title={t('commission:settlements.detail.linesTitle')}>
              {linesQuery.isPending ? (
                <LoadingState lines={4} />
              ) : linesQuery.isError ? (
                <ErrorState
                  title={t('commission:settlements.states.linesLoadErrorTitle')}
                  message={readErrorMessage(
                    t,
                    linesError,
                    'commission:settlements.states.linesLoadErrorMessage',
                  )}
                  actionLabel={t('common:actions.retry')}
                  onRetry={() => void linesQuery.refetch()}
                />
              ) : (
                <div className="overflow-hidden rounded border border-border">
                  <table className="min-w-full text-sm">
                    <caption className="sr-only">
                      {t('commission:settlements.lines.caption')}
                    </caption>
                    <thead className="bg-slate-100 text-left">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-text">
                          {t('commission:settlements.lines.revenueEntryId')}
                        </th>
                        <th className="px-3 py-2 font-semibold text-text">
                          {t('commission:settlements.lines.revenueEntryCodeSnapshot')}
                        </th>
                        <th className="px-3 py-2 font-semibold text-text">
                          {t('commission:settlements.lines.revenueKindSnapshot')}
                        </th>
                        <th className="px-3 py-2 font-semibold text-text">
                          {t('commission:settlements.lines.revenueRecognizedAmountSnapshot')}
                        </th>
                        <th className="px-3 py-2 font-semibold text-text">
                          {t('commission:settlements.lines.lineSettlementAmount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const href = buildEntityDetailHref('revenueEntry', line.revenueEntryId);
                        return (
                          <tr key={line.id} className="border-t border-border">
                            <td className="px-3 py-2">
                              {href ? (
                                <Link to={href} className="font-mono text-accent hover:underline">
                                  {line.revenueEntryId}
                                </Link>
                              ) : (
                                <span className="font-mono">{line.revenueEntryId}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono">{line.revenueEntryCodeSnapshot}</td>
                            <td className="px-3 py-2">
                              {t(`commission:revenueKinds.${line.revenueKindSnapshot}`)}
                            </td>
                            <td className="px-3 py-2">
                              {formatCurrency(
                                line.revenueRecognizedAmountSnapshot,
                                line.revenueCurrencyCodeSnapshot,
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {formatCurrency(
                                line.lineSettlementAmount,
                                record.settlementCurrencyCode,
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {lines.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-muted" colSpan={5}>
                            {t('commission:settlements.states.noLines')}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </MetadataSection>
            <MetadataSection title={t('commission:settlements.detail.lifecycleTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'created',
                    label: t('commission:settlements.fields.createdAt'),
                    value: formatUtcTimestamp(record.createdAt),
                  },
                  {
                    key: 'updated',
                    label: t('commission:settlements.fields.updatedAt'),
                    value: formatUtcTimestamp(record.updatedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('commission:settlements.detail.freeTextTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'description',
                    label: t('commission:settlements.fields.description'),
                    value: formatNullable(record.description),
                  },
                  {
                    key: 'external-ref',
                    label: t('commission:settlements.fields.externalRef'),
                    value: formatNullable(record.externalRef),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            {activeSurface === 'draft-core' ? (
              <CommissionSettlementDraftCoreSurface
                initialValues={record}
                isPending={draftCoreMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await draftCoreMutation.mutateAsync({
                      commissionSettlementId: record.id,
                      payload,
                    });
                    notifySuccess('commission:settlements.feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'revenue-entries' ? (
              <CommissionSettlementRevenueEntriesSurface
                initialRevenueEntryIds={record.revenueEntryIds}
                isPending={revenueEntriesMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await revenueEntriesMutation.mutateAsync({
                      commissionSettlementId: record.id,
                      payload,
                    });
                    notifySuccess('commission:settlements.feedback.revenueEntriesUpdated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <RelatedSectionShell title={t('commission:settlements.related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {sourceRuleHref ? (
                <Link
                  to={sourceRuleHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('commission:settlements.related.sourceRule')}
                </Link>
              ) : null}
              {sourceContractHref ? (
                <Link
                  to={sourceContractHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('commission:settlements.related.sourceContract')}
                </Link>
              ) : null}
              {beneficiaryHref ? (
                <Link
                  to={beneficiaryHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('commission:settlements.related.beneficiary')}
                </Link>
              ) : null}
              {subjectTalentHref ? (
                <Link
                  to={subjectTalentHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('commission:settlements.related.subjectTalent')}
                </Link>
              ) : null}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={
        <ActionRail title={t('commission:settlements.actionRail.title')} items={actionItems} />
      }
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('commission:settlements.states.loadErrorTitle')}
          message={readErrorMessage(
            t,
            detailError,
            'commission:settlements.states.loadErrorMessage',
          )}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
