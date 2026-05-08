import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  buildCommissionSettlementsBySubjectTalentHref,
  buildContractRegistryByLinkedTalentHref,
  buildEntityDetailHref,
  buildEventsByAssignmentTalentHref,
  buildPlatformAccountsByOwnerTalentHref,
  buildRevenueLedgerByTalentHref,
  buildTalentGroupsByTalentHref,
  buildTalentKpiByTalentHref,
  buildWorkShiftsBySubjectTalentHref,
} from '@app/router/reference-links';
import { createTalentActionRailItems } from '@modules/talent/actions/talent-action-rail';
import {
  TalentCommercialParticipationSurface,
  TalentEditSurface,
  TalentEmploymentLinkSurface,
  TalentManagerAssignmentSurface,
} from '@modules/talent/forms/talent-mutation-forms';
import {
  useTalentCommercialParticipationMutation,
  useTalentDetail,
  useTalentEmploymentLinkMutation,
  useTalentLifecycleMutation,
  useTalentManagerAssignmentMutation,
  useUpdateTalentMutation,
} from '@modules/talent/hooks/use-talent';
import type {
  TalentCommercialParticipationStatus,
  TalentLifecycleAction,
  TalentOrigin,
} from '@modules/talent/types/talent.types';
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
import { formatUtcTimestamp } from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveMutationSurface =
  | 'edit'
  | 'assign-manager'
  | 'link-employment-profile'
  | 'commercial-participation'
  | null;

const operationalStatusToneMap = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const commercialStatusToneMap = {
  ALLOWED: 'success',
  BLOCKED: 'danger',
} as const satisfies Record<TalentCommercialParticipationStatus, 'success' | 'danger'>;

const readErrorMessage = (
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  if (!error?.message) {
    return t(fallbackKey);
  }

  if (error.message.includes(':')) {
    return t(error.message);
  }

  return error.message;
};

const readLifecycleConfirmKey = (action: TalentLifecycleAction): string => {
  switch (action) {
    case 'suspend':
      return 'talent:confirm.suspend';
    case 'reactivate':
      return 'talent:confirm.reactivate';
    case 'deactivate':
      return 'talent:confirm.deactivate';
    case 'archive':
      return 'talent:confirm.archive';
    default:
      return 'talent:confirm.archive';
  }
};

export const TalentDetailPage = (): JSX.Element => {
  const { talentId } = useParams<{ talentId: string }>();
  const { t } = useTranslation(['talent', 'common', 'errors']);

  const detailQuery = useTalentDetail(talentId);
  const updateMutation = useUpdateTalentMutation();
  const managerAssignmentMutation = useTalentManagerAssignmentMutation();
  const employmentLinkMutation = useTalentEmploymentLinkMutation();
  const commercialMutation = useTalentCommercialParticipationMutation();
  const lifecycleMutation = useTalentLifecycleMutation();

  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [talentId]);

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
    async (action: TalentLifecycleAction) => {
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
          talentId: record.id,
          action,
        });
        notifySuccess('talent:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onEditSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        talentId: record.id,
        payload,
      });
      notifySuccess('talent:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAssignManagerSubmit = async (
    payload: Parameters<typeof managerAssignmentMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await managerAssignmentMutation.mutateAsync({
        talentId: record.id,
        payload,
      });
      notifySuccess('talent:feedback.managerAssigned');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onEmploymentLinkSubmit = async (
    payload: Parameters<typeof employmentLinkMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await employmentLinkMutation.mutateAsync({
        talentId: record.id,
        payload,
      });
      notifySuccess('talent:feedback.employmentProfileLinked');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onCommercialSubmit = async (
    payload: Parameters<typeof commercialMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await commercialMutation.mutateAsync({
        talentId: record.id,
        payload,
      });
      notifySuccess('talent:feedback.commercialParticipationUpdated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const relatedManagerHref = record?.managerEmploymentProfileId
    ? buildEntityDetailHref('employmentProfile', record.managerEmploymentProfileId)
    : undefined;
  const relatedEmploymentProfileHref = record?.linkedEmploymentProfileId
    ? buildEntityDetailHref('employmentProfile', record.linkedEmploymentProfileId)
    : undefined;
  const relatedTalentGroupsHref = record ? buildTalentGroupsByTalentHref(record.id) : undefined;
  const relatedPlatformAccountsHref = record
    ? buildPlatformAccountsByOwnerTalentHref(record.id)
    : undefined;
  const relatedWorkShiftsHref = record ? buildWorkShiftsBySubjectTalentHref(record.id) : undefined;
  const relatedEventsHref = record ? buildEventsByAssignmentTalentHref(record.id) : undefined;
  const relatedKpiHref = record ? buildTalentKpiByTalentHref(record.id) : undefined;
  const relatedRevenueHref = record ? buildRevenueLedgerByTalentHref(record.id) : undefined;
  const relatedSettlementsHref = record
    ? buildCommissionSettlementsBySubjectTalentHref(record.id)
    : undefined;
  const relatedContractsHref = record
    ? buildContractRegistryByLinkedTalentHref(record.id)
    : undefined;

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return createTalentActionRailItems(t, record, {
      onEdit: () => setActiveSurface('edit'),
      onAssignManager: () => setActiveSurface('assign-manager'),
      onLinkEmploymentProfile: () => setActiveSurface('link-employment-profile'),
      onUpdateCommercialParticipation: () => setActiveSurface('commercial-participation'),
      onLifecycleAction,
      isLifecyclePending: (action) =>
        lifecycleMutation.isPending &&
        lifecycleMutation.variables?.talentId === record.id &&
        lifecycleMutation.variables?.action === action,
    });
  }, [lifecycleMutation.isPending, lifecycleMutation.variables, onLifecycleAction, record, t]);

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={record.operationalStatus}
              label={t(`talent:statuses.${record.operationalStatus}`)}
              toneByStatus={operationalStatusToneMap}
            />
            <StatusBadge
              status={record.commercialParticipationStatus}
              label={t(`talent:commercialStatuses.${record.commercialParticipationStatus}`)}
              toneByStatus={commercialStatusToneMap}
              uppercase
            />
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('talent:detail.summaryTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'talent-code',
                  label: t('talent:fields.talentCode'),
                  value: <ReferenceChip label={record.talentCode} />,
                },
                {
                  key: 'stage-name',
                  label: t('talent:fields.stageName'),
                  value: record.stageName,
                },
                {
                  key: 'legal-name',
                  label: t('talent:fields.legalName'),
                  value: record.legalName,
                },
                {
                  key: 'display-short-name',
                  label: t('talent:fields.displayShortName'),
                  value: record.displayShortName ?? '-',
                },
                {
                  key: 'talent-origin',
                  label: t('talent:fields.talentOrigin'),
                  value: t(`talent:origins.${record.talentOrigin as TalentOrigin}`),
                },
                {
                  key: 'external-ref',
                  label: t('talent:fields.externalRef'),
                  value: record.externalRef ?? '-',
                },
                {
                  key: 'profile-summary',
                  label: t('talent:fields.profileSummary'),
                  value: record.profileSummary ?? '-',
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('talent:detail.assignmentTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'manager-employment-profile-id',
                  label: t('talent:fields.managerEmploymentProfileId'),
                  value: record.managerEmploymentProfileId ? (
                    <ReferenceChip
                      label={record.managerEmploymentProfileId}
                      to={relatedManagerHref}
                    />
                  ) : (
                    '-'
                  ),
                },
                {
                  key: 'linked-employment-profile-id',
                  label: t('talent:fields.linkedEmploymentProfileId'),
                  value: record.linkedEmploymentProfileId ? (
                    <ReferenceChip
                      label={record.linkedEmploymentProfileId}
                      to={relatedEmploymentProfileHref}
                    />
                  ) : (
                    '-'
                  ),
                },
                {
                  key: 'commercial-participation-status',
                  label: t('talent:fields.commercialParticipationStatus'),
                  value: t(
                    `talent:commercialStatuses.${
                      record.commercialParticipationStatus as TalentCommercialParticipationStatus
                    }`,
                  ),
                },
                {
                  key: 'livestream-eligible',
                  label: t('talent:fields.livestreamEligible'),
                  value: record.livestreamEligible
                    ? t('talent:boolean.true')
                    : t('talent:boolean.false'),
                },
                {
                  key: 'event-eligible',
                  label: t('talent:fields.eventEligible'),
                  value: record.eventEligible
                    ? t('talent:boolean.true')
                    : t('talent:boolean.false'),
                },
                {
                  key: 'created-at',
                  label: t('talent:fields.createdAt'),
                  value: formatUtcTimestamp(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('talent:fields.updatedAt'),
                  value: formatUtcTimestamp(record.updatedAt),
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
            {activeSurface === 'edit' ? (
              <TalentEditSurface
                initialValues={{
                  stageName: record.stageName,
                  legalName: record.legalName,
                  displayShortName: record.displayShortName,
                  externalRef: record.externalRef,
                  profileSummary: record.profileSummary,
                }}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onEditSubmit}
              />
            ) : null}
            {activeSurface === 'assign-manager' ? (
              <TalentManagerAssignmentSurface
                currentTalentId={record.id}
                currentManagerEmploymentProfileId={record.managerEmploymentProfileId}
                isPending={managerAssignmentMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onAssignManagerSubmit}
              />
            ) : null}
            {activeSurface === 'link-employment-profile' ? (
              <TalentEmploymentLinkSurface
                currentLinkedEmploymentProfileId={record.linkedEmploymentProfileId}
                isPending={employmentLinkMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onEmploymentLinkSubmit}
              />
            ) : null}
            {activeSurface === 'commercial-participation' ? (
              <TalentCommercialParticipationSurface
                initialValues={{
                  commercialParticipationStatus: record.commercialParticipationStatus,
                  livestreamEligible: record.livestreamEligible,
                  eventEligible: record.eventEligible,
                }}
                isPending={commercialMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onCommercialSubmit}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <RelatedSectionShell title={t('talent:related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded border border-border bg-bg px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('talent:related.talentGroups')}
                </p>
                {relatedTalentGroupsHref ? (
                  <Link
                    to={relatedTalentGroupsHref}
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('talent:related.openFilteredList')}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('talent:related.unavailable')}</p>
                )}
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('talent:related.platformAccounts')}
                </p>
                {relatedPlatformAccountsHref ? (
                  <Link
                    to={relatedPlatformAccountsHref}
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('talent:related.openFilteredList')}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('talent:related.unavailable')}</p>
                )}
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('talent:related.workShifts')}
                </p>
                {relatedWorkShiftsHref ? (
                  <Link
                    to={relatedWorkShiftsHref}
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('talent:related.openFilteredList')}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('talent:related.unavailable')}</p>
                )}
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('talent:related.events')}
                </p>
                {relatedEventsHref ? (
                  <Link
                    to={relatedEventsHref}
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('talent:related.openFilteredList')}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('talent:related.unavailable')}</p>
                )}
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('talent:related.talentKpi')}
                </p>
                {relatedKpiHref ? (
                  <Link
                    to={relatedKpiHref}
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('talent:related.openFilteredList')}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('talent:related.unavailable')}</p>
                )}
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('talent:related.revenueLedger')}
                </p>
                {relatedRevenueHref ? (
                  <Link
                    to={relatedRevenueHref}
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('talent:related.openFilteredList')}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('talent:related.unavailable')}</p>
                )}
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('talent:related.commissionSettlements')}
                </p>
                {relatedSettlementsHref ? (
                  <Link
                    to={relatedSettlementsHref}
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('talent:related.openFilteredList')}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('talent:related.unavailable')}</p>
                )}
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('talent:related.contractRegistry')}
                </p>
                {relatedContractsHref ? (
                  <Link
                    to={relatedContractsHref}
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('talent:related.openFilteredList')}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('talent:related.unavailable')}</p>
                )}
              </div>
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('talent:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('talent:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'talent:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
