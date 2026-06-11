import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  buildCommissionSettlementsByRevenueEntryHref,
  buildEntityDetailHref,
  buildTalentKpiByEventHref,
  buildTalentKpiByPlatformHref,
  buildTalentKpiByTalentHref,
} from '@app/router/reference-links';
import { createRevenueLedgerActionRailItems } from '@modules/revenue-ledger/actions/revenue-ledger-action-rail';
import {
  RevenueEntryDraftCoreSurface,
  RevenueEntryReconcileSurface,
} from '@modules/revenue-ledger/forms/revenue-ledger-mutation-forms';
import {
  useReconcileRevenueEntryMutation,
  useRevenueEntryDetail,
  useRevenueEntryLifecycleMutation,
  useUpdateRevenueEntryDraftCoreMutation,
} from '@modules/revenue-ledger/hooks/use-revenue-ledger';
import { revenueLedgerStatusToneMap } from '@modules/revenue-ledger/tables/revenue-ledger-columns';
import type { RevenueLedgerLifecycleAction } from '@modules/revenue-ledger/types/revenue-ledger.types';
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
import {
  applyActionCapabilityHints,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import {
  formatCurrency,
  formatCreatedDate,
  formatBusinessTimestamp,
  readReferenceDisplay,
} from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface = 'draft-core' | 'reconcile' | null;

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

  return formatBusinessTimestamp(value);
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

const readLifecycleConfirmKey = (
  action: Exclude<RevenueLedgerLifecycleAction, 'reconcile'>,
): string => {
  switch (action) {
    case 'finalize':
      return 'revenue-ledger:confirm.finalize';
    case 'void':
      return 'revenue-ledger:confirm.void';
    case 'archive':
      return 'revenue-ledger:confirm.archive';
    default:
      return 'revenue-ledger:confirm.archive';
  }
};

export const RevenueLedgerDetailPage = (): JSX.Element => {
  const { revenueEntryId } = useParams<{ revenueEntryId: string }>();
  const { t } = useTranslation(['revenue-ledger', 'common', 'errors']);
  const detailQuery = useRevenueEntryDetail(revenueEntryId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const draftCoreMutation = useUpdateRevenueEntryDraftCoreMutation();
  const reconcileMutation = useReconcileRevenueEntryMutation();
  const lifecycleMutation = useRevenueEntryLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  useEffect(() => {
    setActiveSurface(null);
  }, [revenueEntryId]);

  const detailError = detailQuery.error as NormalizedApiError | null;
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

  const onLifecycleAction = useCallback(
    async (action: Exclude<RevenueLedgerLifecycleAction, 'reconcile'>) => {
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
          revenueEntryId: record.id,
          action,
        });
        notifySuccess('revenue-ledger:feedback.lifecycleUpdated');
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

    return applyActionCapabilityHints(
      createRevenueLedgerActionRailItems(t, record, {
        onDraftCoreEdit: () => setActiveSurface('draft-core'),
        onReconcile: () => setActiveSurface('reconcile'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.revenueEntryId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        'draft-core': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          {
            permission: PERMISSIONS.REVENUE_LEDGER_UPDATE,
            scope: { module: 'revenueLedger', value: 'global' },
          },
          capabilityCopy,
        ),
        finalize: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          {
            permission: PERMISSIONS.REVENUE_LEDGER_MANAGE_LIFECYCLE,
            scope: { module: 'revenueLedger', value: 'global' },
          },
          capabilityCopy,
        ),
        reconcile: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          {
            permission: PERMISSIONS.REVENUE_LEDGER_RECONCILE,
            scope: { module: 'revenueLedger', value: 'global' },
          },
          capabilityCopy,
        ),
        void: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          {
            permission: PERMISSIONS.REVENUE_LEDGER_MANAGE_LIFECYCLE,
            scope: { module: 'revenueLedger', value: 'global' },
          },
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          {
            permission: PERMISSIONS.REVENUE_LEDGER_MANAGE_LIFECYCLE,
            scope: { module: 'revenueLedger', value: 'global' },
          },
          capabilityCopy,
        ),
      },
    );
  }, [
    capabilityCopy,
    capabilitiesQuery.data,
    capabilitiesQuery.isError,
    capabilitiesQuery.isLoading,
    lifecycleMutation.isPending,
    lifecycleMutation.variables,
    onLifecycleAction,
    record,
    t,
  ]);

  const talentHref = buildEntityDetailHref('talent', record?.subjectTalentId);
  const platformHref = buildEntityDetailHref(
    'platformAccount',
    record?.attributionPlatformAccountId,
  );
  const eventHref = buildEntityDetailHref('event', record?.attributionEventId);
  const kpiByTalentHref = buildTalentKpiByTalentHref(record?.subjectTalentId);
  const kpiByPlatformHref = buildTalentKpiByPlatformHref(record?.attributionPlatformAccountId);
  const kpiByEventHref = buildTalentKpiByEventHref(record?.attributionEventId);
  const settlementHref = buildCommissionSettlementsByRevenueEntryHref(record?.id);

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`revenue-ledger:statuses.${record.status}`)}
            toneByStatus={revenueLedgerStatusToneMap}
          />
        ) : undefined
      }
      banner={
        record ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('revenue-ledger:detail.boundaryHelper')}
          </div>
        ) : undefined
      }
      readOnlyNotice={
        record?.status === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('revenue-ledger:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('revenue-ledger:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'code',
                  label: t('revenue-ledger:generatedCode.label'),
                  value: <ReferenceChip label={record.revenueEntryCode} />,
                },
                {
                  key: 'title',
                  label: t('revenue-ledger:fields.title'),
                  value: record.title,
                },
                {
                  key: 'status',
                  label: t('revenue-ledger:fields.status'),
                  value: t(`revenue-ledger:statuses.${record.status}`),
                },
                {
                  key: 'scope',
                  label: t('revenue-ledger:fields.scopeBoundary'),
                  value: t('revenue-ledger:detail.globalOnly'),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('revenue-ledger:detail.revenueTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'kind',
                  label: t('revenue-ledger:fields.revenueKind'),
                  value: t(`revenue-ledger:revenueKinds.${record.revenueKind}`),
                },
                {
                  key: 'source',
                  label: t('revenue-ledger:fields.entrySource'),
                  value: t(`revenue-ledger:entrySources.${record.entrySource}`),
                },
                {
                  key: 'currency',
                  label: t('revenue-ledger:fields.currencyCode'),
                  value: record.currencyCode,
                },
                {
                  key: 'amount',
                  label: t('revenue-ledger:fields.recognizedAmount'),
                  value: formatCurrency(record.recognizedAmount, record.currencyCode),
                },
                {
                  key: 'recognized-at',
                  label: t('revenue-ledger:fields.recognizedAt'),
                  value: formatBusinessTimestamp(record.recognizedAt),
                },
                {
                  key: 'reconcile-ref',
                  label: t('revenue-ledger:fields.reconciliationReference'),
                  value: formatNullable(record.reconciliationReference),
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
            <MetadataSection title={t('revenue-ledger:detail.attributionTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'subject-talent',
                    label: t('revenue-ledger:fields.subjectTalentId'),
                    value:
                      talentHref && record.subjectTalentId ? (
                        <Link className="text-accent hover:underline" to={talentHref}>
                          {readReferenceDisplay(record.subjectTalentRef, record.subjectTalentId)}
                        </Link>
                      ) : (
                        readReferenceDisplay(record.subjectTalentRef, record.subjectTalentId)
                      ),
                  },
                  {
                    key: 'platform',
                    label: t('revenue-ledger:fields.attributionPlatformAccountId'),
                    value:
                      platformHref && record.attributionPlatformAccountId ? (
                        <Link className="text-accent hover:underline" to={platformHref}>
                          {readReferenceDisplay(
                            record.attributionPlatformAccountRef,
                            record.attributionPlatformAccountId,
                          )}
                        </Link>
                      ) : (
                        readReferenceDisplay(
                          record.attributionPlatformAccountRef,
                          record.attributionPlatformAccountId,
                        )
                      ),
                  },
                  {
                    key: 'event',
                    label: t('revenue-ledger:fields.attributionEventId'),
                    value:
                      eventHref && record.attributionEventId ? (
                        <Link className="text-accent hover:underline" to={eventHref}>
                          {readReferenceDisplay(
                            record.attributionEventRef,
                            record.attributionEventId,
                          )}
                        </Link>
                      ) : (
                        readReferenceDisplay(record.attributionEventRef, record.attributionEventId)
                      ),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('revenue-ledger:detail.lifecycleTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'finalized',
                    label: t('revenue-ledger:fields.finalizedAt'),
                    value: formatNullableTimestamp(record.finalizedAt),
                  },
                  {
                    key: 'reconciled',
                    label: t('revenue-ledger:fields.reconciledAt'),
                    value: formatNullableTimestamp(record.reconciledAt),
                  },
                  {
                    key: 'voided',
                    label: t('revenue-ledger:fields.voidedAt'),
                    value: formatNullableTimestamp(record.voidedAt),
                  },
                  {
                    key: 'created',
                    label: t('revenue-ledger:fields.createdAt'),
                    value: formatCreatedDate(record.createdAt),
                  },
                  {
                    key: 'updated',
                    label: t('revenue-ledger:fields.updatedAt'),
                    value: formatBusinessTimestamp(record.updatedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('revenue-ledger:detail.freeTextTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'description',
                    label: t('revenue-ledger:fields.description'),
                    value: formatNullable(record.description),
                  },
                  {
                    key: 'external-ref',
                    label: t('revenue-ledger:fields.externalRef'),
                    value: formatNullable(record.externalRef),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            {activeSurface === 'draft-core' ? (
              <RevenueEntryDraftCoreSurface
                initialValues={record}
                isPending={draftCoreMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await draftCoreMutation.mutateAsync({
                      revenueEntryId: record.id,
                      payload,
                    });
                    notifySuccess('revenue-ledger:feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'reconcile' ? (
              <RevenueEntryReconcileSurface
                initialReconciliationReference={record.reconciliationReference}
                isPending={reconcileMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await reconcileMutation.mutateAsync({
                      revenueEntryId: record.id,
                      payload,
                    });
                    notifySuccess('revenue-ledger:feedback.reconciled');
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
          <RelatedSectionShell title={t('revenue-ledger:related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {kpiByTalentHref ? (
                <Link
                  to={kpiByTalentHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('revenue-ledger:related.kpiByTalent')}
                </Link>
              ) : null}
              {kpiByPlatformHref ? (
                <Link
                  to={kpiByPlatformHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('revenue-ledger:related.kpiByPlatform')}
                </Link>
              ) : null}
              {kpiByEventHref ? (
                <Link
                  to={kpiByEventHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('revenue-ledger:related.kpiByEvent')}
                </Link>
              ) : null}
              {settlementHref ? (
                <Link
                  to={settlementHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('revenue-ledger:related.commissionSettlements')}
                </Link>
              ) : null}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('revenue-ledger:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('revenue-ledger:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'revenue-ledger:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
