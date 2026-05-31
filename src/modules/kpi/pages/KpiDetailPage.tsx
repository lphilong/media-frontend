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
  parseKpiMetricInput,
} from '@modules/kpi/formatting/kpi-formatting';
import {
  useApproveKpiAllocationMutation,
  useKpiLifecycleMutation,
  useKpiPlanDetail,
  useKpiProgress,
  usePublishKpiAllocationMutation,
  useRejectKpiAllocationMutation,
  useReplaceKpiAllocationsMutation,
  useSubmitKpiAllocationDraftMutation,
  useUpsertKpiAllocationDraftMutation,
} from '@modules/kpi/hooks/use-kpi';
import type {
  KpiAllocationStatus,
  KpiMetricCode,
  KpiPlanDetail,
} from '@modules/kpi/types/kpi.types';
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

const officialAllocationStatuses = new Set<KpiAllocationStatus>(['PUBLISHED']);

const readAllocationWorkflowStatus = (
  plan: KpiPlanDetail,
): KpiAllocationStatus | 'NONE' | 'MIXED' => {
  if (plan.allocations.length === 0) {
    return 'NONE';
  }
  const statuses = new Set(plan.allocations.map((allocation) => allocation.allocationStatus));
  return statuses.size === 1 ? (plan.allocations[0]?.allocationStatus ?? 'NONE') : 'MIXED';
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
          allocationStartDate: '01-05-2026',
          note: '',
          values: Object.fromEntries(
            plan.targetMetrics.map((metric) => [metric.metricCode, '0']),
          ) as Partial<Record<KpiMetricCode, string>>,
        },
      ];

export const KpiDetailPage = (): JSX.Element => {
  const { kpiPlanId } = useParams<{ kpiPlanId: string }>();
  const { t } = useTranslation(['kpi', 'common']);
  const detailQuery = useKpiPlanDetail(kpiPlanId);
  const progressQuery = useKpiProgress(kpiPlanId);
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
      const items = await fetchKpiManagedMembers(kpiPlanId ?? '', { search, limit: 20 });
      return items.map((item) => ({
        id: item.employmentProfileId,
        label: item.employeeCode ? `${item.displayName} - ${item.employeeCode}` : item.displayName,
        description: [item.talentCode, item.groupId].filter(Boolean).join(' - ') || undefined,
      }));
    },
    [kpiPlanId],
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
    plan.status !== 'PUBLISHED' ? t('kpi:disabled.allocationPlanPublishedOnly') : undefined;
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
    allocationWorkflowStatus !== 'PENDING_APPROVAL'
      ? t('kpi:disabled.allocationApprovePendingOnly')
      : undefined;
  const allocationPublishDisabledReason =
    allocationWorkflowStatus !== 'APPROVED'
      ? t('kpi:disabled.allocationPublishApprovedOnly')
      : undefined;

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
                              allocationStartDate: '01-05-2026',
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
                          {allocation.snapshotMemberDisplayName ?? allocation.memberTalentId}
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
            {progressQuery.isError ? (
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
