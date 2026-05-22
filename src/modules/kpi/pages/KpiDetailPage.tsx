import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import {
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import { formatKpiDateTime, formatKpiNumber } from '@modules/kpi/formatting/kpi-formatting';
import {
  useKpiLifecycleMutation,
  useKpiPlanDetail,
  useKpiProgress,
  useReplaceKpiAllocationsMutation,
} from '@modules/kpi/hooks/use-kpi';
import type { KpiMetricCode, KpiPlanDetail } from '@modules/kpi/types/kpi.types';
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

export const KpiDetailPage = (): JSX.Element => {
  const { kpiPlanId } = useParams<{ kpiPlanId: string }>();
  const { t } = useTranslation(['kpi', 'common']);
  const detailQuery = useKpiPlanDetail(kpiPlanId);
  const progressQuery = useKpiProgress(kpiPlanId);
  const lifecycleMutation = useKpiLifecycleMutation();
  const allocationsMutation = useReplaceKpiAllocationsMutation();
  const capabilitiesQuery = useCurrentActorCapabilities();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestConfirm = useDestructiveConfirm();
  const [allocationError, setAllocationError] = useState<string | null>(null);

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

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
    return <ErrorState title={t('kpi:states.loadErrorTitle')} message={t('kpi:states.loadErrorMessage')} />;
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

  const draftActionItems =
    plan.status === 'DRAFT'
      ? [
          {
            id: 'draft-core',
            label: t('kpi:actions.updateDraft'),
            onClick: () => undefined,
          },
          {
            id: 'replace-metrics',
            label: t('kpi:actions.replaceMetrics'),
            onClick: () => undefined,
          },
          {
            id: 'replace-allocations',
            label: t('kpi:actions.replaceAllocations'),
            disabled: allocationHint.disabled,
            disabledReason: allocationHint.disabledReason,
            onClick: !allocationHint.disabled ? () => undefined : undefined,
          },
        ]
      : [];

  const actionItems = [
    ...draftActionItems,
    {
      id: 'publish',
      label: t('kpi:actions.publish'),
      disabled: Boolean(readDisabledReason(plan, 'publish')) || publishHint.disabled,
      disabledReason:
        (readDisabledReason(plan, 'publish') ? t(readDisabledReason(plan, 'publish') ?? '') : undefined) ??
        publishHint.disabledReason,
      onClick:
        !readDisabledReason(plan, 'publish') && !publishHint.disabled
          ? () => void runLifecycle('publish')
          : undefined,
    },
    {
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
    },
    {
      id: 'archive',
      label: t('kpi:actions.archive'),
      tone: 'danger' as const,
      disabled: Boolean(readDisabledReason(plan, 'archive')) || archiveHint.disabled,
      disabledReason:
        (readDisabledReason(plan, 'archive') ? t(readDisabledReason(plan, 'archive') ?? '') : undefined) ??
        archiveHint.disabledReason,
      onClick:
        !readDisabledReason(plan, 'archive') && !archiveHint.disabled
          ? () => void runLifecycle('archive')
          : undefined,
    },
  ];

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
                {plan.subjectRef?.displayName ?? plan.subjectRef?.name ?? plan.subjectId} -{' '}
                {plan.periodMonth}
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
                { key: 'subject', label: t('kpi:fields.subject'), value: plan.subjectId },
                { key: 'period', label: t('kpi:fields.periodMonth'), value: plan.periodMonth },
                { key: 'publishedAt', label: t('kpi:fields.publishedAt'), value: formatKpiDateTime(plan.publishedAt) },
                { key: 'finalizedAt', label: t('kpi:fields.finalizedAt'), value: formatKpiDateTime(plan.finalizedAt) },
                { key: 'archivedAt', label: t('kpi:fields.archivedAt'), value: formatKpiDateTime(plan.archivedAt) },
              ]}
            />
          </MetadataSection>

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
                      <td className="px-3 py-2">{formatKpiNumber(metric.metricCode, metric.targetValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MetadataSection>

          {plan.subjectType === 'TALENT_GROUP' ? (
            <MetadataSection title={t('kpi:sections.allocations')}>
              {allocationError ? <p className="text-sm text-danger">{allocationError}</p> : null}
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
                          {allocation.snapshotMemberDisplayName ?? allocation.memberTalentId}
                        </td>
                        {plan.targetMetrics.map((metric) => {
                          const value =
                            allocation.targetMetrics.find((item) => item.metricCode === metric.metricCode)
                              ?.targetValue ?? 0;
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
                          {formatKpiNumber(metric.metricCode, allocationTotals.get(metric.metricCode) ?? 0)}
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
              {plan.status === 'DRAFT' ? (
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
            {progressQuery.data ? (
              <div className="space-y-3">
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
                          <td className="px-3 py-2">{formatKpiNumber(metric.metricCode, metric.targetValue)}</td>
                          <td className="px-3 py-2">{formatKpiNumber(metric.metricCode, metric.actualValue)}</td>
                          <td className="px-3 py-2">
                            {metric.progressPercent === null ? '-' : `${metric.progressPercent}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {plan.subjectType === 'TALENT_GROUP' ? (
                  <div className="overflow-x-auto rounded border border-border">
                    <table className="min-w-full text-sm">
                      <caption className="sr-only">{t('kpi:progress.memberBreakdown')}</caption>
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left">{t('kpi:fields.member')}</th>
                          <th className="px-3 py-2 text-left">{t('kpi:fields.metricCode')}</th>
                          <th className="px-3 py-2 text-left">{t('kpi:progress.percent')}</th>
                          <th className="px-3 py-2 text-left">{t('kpi:progress.actualEntryCount')}</th>
                          <th className="px-3 py-2 text-left">{t('kpi:progress.missingEntryCount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressQuery.data.memberProgress.map((row) => (
                          <tr key={`${row.allocationId}-${row.metricCode}`} className="border-t border-border">
                            <td className="px-3 py-2">{row.memberTalentId}</td>
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
