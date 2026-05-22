import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  buildEntityDetailHref,
  buildRevenueLedgerByEventHref,
  buildRevenueLedgerByPlatformHref,
  buildRevenueLedgerByTalentHref,
} from '@app/router/reference-links';
import { createTalentKpiActionRailItems } from '@modules/talent-kpi/actions/talent-kpi-action-rail';
import {
  TalentKpiDraftCoreSurface,
  TalentKpiMetricsSurface,
} from '@modules/talent-kpi/forms/talent-kpi-mutation-forms';
import {
  useReplaceTalentKpiMetricsMutation,
  useTalentKpiDetail,
  useTalentKpiLifecycleMutation,
  useTalentKpiMetrics,
  useUpdateTalentKpiDraftCoreMutation,
} from '@modules/talent-kpi/hooks/use-talent-kpi';
import { talentKpiStatusToneMap } from '@modules/talent-kpi/tables/talent-kpi-columns';
import type { TalentKpiLifecycleAction } from '@modules/talent-kpi/types/talent-kpi.types';
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
  formatDecimal,
  formatCreatedDate,
  formatBusinessTimestamp,
  readReferenceDisplay,
} from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface = 'draft-core' | 'metrics' | null;

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

const readLifecycleConfirmKey = (action: TalentKpiLifecycleAction): string => {
  switch (action) {
    case 'finalize':
      return 'talent-kpi:confirm.finalize';
    case 'archive':
      return 'talent-kpi:confirm.archive';
    default:
      return 'talent-kpi:confirm.archive';
  }
};

export const TalentKpiDetailPage = (): JSX.Element => {
  const { talentKpiRecordId } = useParams<{ talentKpiRecordId: string }>();
  const { t } = useTranslation(['talent-kpi', 'common', 'errors']);
  const detailQuery = useTalentKpiDetail(talentKpiRecordId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const metricsQuery = useTalentKpiMetrics(talentKpiRecordId);
  const draftCoreMutation = useUpdateTalentKpiDraftCoreMutation();
  const metricsMutation = useReplaceTalentKpiMetricsMutation();
  const lifecycleMutation = useTalentKpiLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [talentKpiRecordId]);

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  const detailError = detailQuery.error as NormalizedApiError | null;
  const metricsError = metricsQuery.error as NormalizedApiError | null;
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
  const metrics = metricsQuery.data ?? [];

  const onLifecycleAction = useCallback(
    async (action: TalentKpiLifecycleAction) => {
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
          talentKpiRecordId: record.id,
          action,
        });
        notifySuccess('talent-kpi:feedback.lifecycleUpdated');
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

    const capabilityState = {
      capabilities: capabilitiesQuery.data,
      isLoading: capabilitiesQuery.isLoading,
      isError: capabilitiesQuery.isError,
    };
    const lifecycleRequirement = {
      permission: PERMISSIONS.TALENT_KPI_MANAGE_LIFECYCLE,
      scope: { module: 'talentKpi' as const, value: 'global' as const },
    };

    return applyActionCapabilityHints(
      createTalentKpiActionRailItems(t, record, {
        onDraftCoreEdit: () => setActiveSurface('draft-core'),
        onReplaceMetrics: () => setActiveSurface('metrics'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.talentKpiRecordId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        'draft-core': createActionCapabilityHint(
          capabilityState,
          {
            permission: PERMISSIONS.TALENT_KPI_UPDATE,
            scope: { module: 'talentKpi', value: 'global' },
          },
          capabilityCopy,
        ),
        'replace-metrics': createActionCapabilityHint(
          capabilityState,
          {
            permission: PERMISSIONS.TALENT_KPI_MANAGE_METRICS,
            scope: { module: 'talentKpi', value: 'global' },
          },
          capabilityCopy,
        ),
        finalize: createActionCapabilityHint(capabilityState, lifecycleRequirement, capabilityCopy),
        archive: createActionCapabilityHint(capabilityState, lifecycleRequirement, capabilityCopy),
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
  const revenueByTalentHref = buildRevenueLedgerByTalentHref(record?.subjectTalentId);
  const revenueByPlatformHref = buildRevenueLedgerByPlatformHref(
    record?.attributionPlatformAccountId,
  );
  const revenueByEventHref = buildRevenueLedgerByEventHref(record?.attributionEventId);

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`talent-kpi:statuses.${record.status}`)}
            toneByStatus={talentKpiStatusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.status === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('talent-kpi:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('talent-kpi:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'code',
                  label: t('talent-kpi:generatedCode.label'),
                  value: <ReferenceChip label={record.kpiRecordCode} />,
                },
                {
                  key: 'title',
                  label: t('talent-kpi:fields.title'),
                  value: record.title,
                },
                {
                  key: 'status',
                  label: t('talent-kpi:fields.status'),
                  value: t(`talent-kpi:statuses.${record.status}`),
                },
                {
                  key: 'scope',
                  label: t('talent-kpi:fields.scopeBoundary'),
                  value: t('talent-kpi:detail.globalOnly'),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('talent-kpi:detail.measurementTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'measurement-source',
                  label: t('talent-kpi:fields.measurementSource'),
                  value: t(`talent-kpi:measurementSources.${record.measurementSource}`),
                },
                {
                  key: 'period-start',
                  label: t('talent-kpi:fields.periodStartAt'),
                  value: formatBusinessTimestamp(record.periodStartAt),
                },
                {
                  key: 'period-end',
                  label: t('talent-kpi:fields.periodEndAt'),
                  value: formatBusinessTimestamp(record.periodEndAt),
                },
                {
                  key: 'published',
                  label: t('talent-kpi:fields.publishedAt'),
                  value: formatNullableTimestamp(record.publishedAt),
                },
                {
                  key: 'created',
                  label: t('talent-kpi:fields.createdAt'),
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated',
                  label: t('talent-kpi:fields.updatedAt'),
                  value: formatBusinessTimestamp(record.updatedAt),
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
            <MetadataSection title={t('talent-kpi:detail.attributionTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'subject-talent',
                    label: t('talent-kpi:fields.subjectTalentId'),
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
                    label: t('talent-kpi:fields.attributionPlatformAccountId'),
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
                    label: t('talent-kpi:fields.attributionEventId'),
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
            <MetadataSection title={t('talent-kpi:detail.metricsTitle')}>
              {metricsQuery.isError ? (
                <ErrorState
                  title={t('talent-kpi:states.metricsLoadErrorTitle')}
                  message={readErrorMessage(
                    t,
                    metricsError,
                    'talent-kpi:states.metricsLoadErrorMessage',
                  )}
                  actionLabel={t('common:actions.retry')}
                  onRetry={() => void metricsQuery.refetch()}
                />
              ) : (
                <div className="overflow-hidden rounded border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-left">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-text">
                          {t('talent-kpi:fields.metricCode')}
                        </th>
                        <th className="px-3 py-2 font-semibold text-text">
                          {t('talent-kpi:fields.numericValue')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric) => (
                        <tr key={metric.id ?? metric.metricCode} className="border-t border-border">
                          <td className="px-3 py-2 text-text">
                            {t(`talent-kpi:metricCodes.${metric.metricCode}`)}
                          </td>
                          <td className="px-3 py-2 font-mono text-text">
                            {formatDecimal(metric.numericValue)}
                          </td>
                        </tr>
                      ))}
                      {!metricsQuery.isPending && metrics.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-muted" colSpan={2}>
                            {t('talent-kpi:states.noMetrics')}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </MetadataSection>
            <MetadataSection title={t('talent-kpi:detail.freeTextTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'description',
                    label: t('talent-kpi:fields.description'),
                    value: formatNullable(record.description),
                  },
                  {
                    key: 'external-ref',
                    label: t('talent-kpi:fields.externalRef'),
                    value: formatNullable(record.externalRef),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            {activeSurface === 'draft-core' ? (
              <TalentKpiDraftCoreSurface
                initialValues={record}
                isPending={draftCoreMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await draftCoreMutation.mutateAsync({
                      talentKpiRecordId: record.id,
                      payload,
                    });
                    notifySuccess('talent-kpi:feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'metrics' ? (
              <TalentKpiMetricsSurface
                initialMetrics={metrics}
                isPending={metricsMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await metricsMutation.mutateAsync({
                      talentKpiRecordId: record.id,
                      payload,
                    });
                    notifySuccess('talent-kpi:feedback.metricsUpdated');
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
          <RelatedSectionShell title={t('talent-kpi:related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {revenueByTalentHref ? (
                <Link
                  to={revenueByTalentHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('talent-kpi:related.revenueByTalent')}
                </Link>
              ) : null}
              {revenueByPlatformHref ? (
                <Link
                  to={revenueByPlatformHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('talent-kpi:related.revenueByPlatform')}
                </Link>
              ) : null}
              {revenueByEventHref ? (
                <Link
                  to={revenueByEventHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('talent-kpi:related.revenueByEvent')}
                </Link>
              ) : null}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('talent-kpi:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('talent-kpi:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'talent-kpi:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
