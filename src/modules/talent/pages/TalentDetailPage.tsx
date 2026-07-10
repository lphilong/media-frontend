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
  buildWorkShiftsBySubjectTalentHref,
} from '@app/router/reference-links';
import { createTalentActionRailItems } from '@modules/talent/actions/talent-action-rail';
import {
  TalentCommercialParticipationSurface,
  TalentEditSurface,
  TalentEmploymentLinkSurface,
} from '@modules/talent/forms/talent-mutation-forms';
import {
  useTalentCommercialParticipationMutation,
  useTalentDetail,
  useTalentEmploymentLinkMutation,
  useTalentLifecycleMutation,
  useUpdateTalentMutation,
} from '@modules/talent/hooks/use-talent';
import { ResponsibilitySummarySection } from '@modules/responsibility';
import type {
  TalentCommercialParticipationStatus,
  TalentLifecycleAction,
  TalentOrigin,
} from '@modules/talent/types/talent.types';
import {
  readTalentPerformanceAlias,
  readTalentPrimaryDisplay,
} from '@modules/talent/utils/talent-display';
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
  formatCreatedDate,
  formatBusinessTimestamp,
  readReferenceDisplay,
} from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveMutationSurface = 'edit' | 'link-employment-profile' | 'commercial-participation' | null;

const operationalStatusToneMap = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const commercialStatusToneMap = {
  ELIGIBLE: 'success',
  RESTRICTED: 'warning',
  BLOCKED: 'danger',
} as const satisfies Record<TalentCommercialParticipationStatus, 'success' | 'warning' | 'danger'>;

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
  const capabilitiesQuery = useCurrentActorCapabilities();
  const updateMutation = useUpdateTalentMutation();
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

  const relatedEmploymentProfileHref = record?.linkedEmploymentProfileId
    ? buildEntityDetailHref('employmentProfile', record.linkedEmploymentProfileId)
    : undefined;
  const relatedTalentGroupsHref = record ? buildTalentGroupsByTalentHref(record.id) : undefined;
  const relatedPlatformAccountsHref = record
    ? buildPlatformAccountsByOwnerTalentHref(record.id)
    : undefined;
  const relatedWorkShiftsHref = record ? buildWorkShiftsBySubjectTalentHref(record.id) : undefined;
  const relatedEventsHref = record ? buildEventsByAssignmentTalentHref(record.id) : undefined;
  const relatedRevenueHref = record ? buildRevenueLedgerByTalentHref(record.id) : undefined;
  const relatedSettlementsHref = record
    ? buildCommissionSettlementsBySubjectTalentHref(record.id)
    : undefined;
  const relatedContractsHref = record
    ? buildContractRegistryByLinkedTalentHref(record.id)
    : undefined;
  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return applyActionCapabilityHints(
      createTalentActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onLinkEmploymentProfile: () => setActiveSurface('link-employment-profile'),
        onUpdateCommercialParticipation: () => setActiveSurface('commercial-participation'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.talentId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        edit: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_UPDATE },
          capabilityCopy,
        ),
        'employment-link': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_MANAGE_EMPLOYMENT_LINK },
          capabilityCopy,
        ),
        'commercial-participation': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_MANAGE_COMMERCIAL_PARTICIPATION },
          capabilityCopy,
        ),
        suspend: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        reactivate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        deactivate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_MANAGE_LIFECYCLE },
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
                  key: 'display-name',
                  label: t('talent:fields.displayName'),
                  value: readTalentPrimaryDisplay(record),
                },
                {
                  key: 'performance-alias',
                  label: t('talent:fields.performanceAlias'),
                  value: readTalentPerformanceAlias(record) ?? '-',
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
                  key: 'linked-employment-profile-id',
                  label: t('talent:fields.linkedEmploymentProfileId'),
                  value: record.linkedEmploymentProfileId ? (
                    <ReferenceChip
                      label={readReferenceDisplay(
                        record.linkedEmploymentProfileRef,
                        record.linkedEmploymentProfileId,
                      )}
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
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('talent:fields.updatedAt'),
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
            {activeSurface === 'edit' ? (
              <TalentEditSurface
                initialValues={{
                  stageName: record.stageName,
                  legalName: record.legalName,
                  talentOrigin: record.talentOrigin,
                  displayShortName: record.displayShortName,
                  externalRef: record.externalRef,
                  profileSummary: record.profileSummary,
                }}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onEditSubmit}
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
          <div className="space-y-4">
            <ResponsibilitySummarySection subjectType="TALENT" subjectId={record.id} />
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
          </div>
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
