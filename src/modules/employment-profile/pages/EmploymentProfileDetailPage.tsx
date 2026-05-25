import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  buildContractRegistryByLinkedEmploymentProfileHref,
  buildContractRegistryByOwnerHref,
  buildEntityDetailHref,
  buildEventsByAssignmentEmploymentProfileHref,
  buildWorkShiftsBySubjectEmploymentProfileHref,
} from '@app/router/reference-links';
import { createEmploymentProfileActionRailItems } from '@modules/employment-profile/actions/employment-profile-action-rail';
import {
  EmploymentProfileContractStatusSurface,
  EmploymentProfileEditSurface,
  EmploymentProfileManagerAssignmentSurface,
  EmploymentProfileOrgAssignmentSurface,
  EmploymentProfileTerminateSurface,
  EmploymentProfileUserLinkSurface,
} from '@modules/employment-profile/forms/employment-profile-mutation-forms';
import {
  useEmploymentProfileContractStatusMutation,
  useEmploymentProfileDetail,
  useEmploymentProfileDirectReports,
  useEmploymentProfileLifecycleMutation,
  useEmploymentProfileManagerAssignmentMutation,
  useEmploymentProfileOrgAssignmentMutation,
  useEmploymentProfileTerminateMutation,
  useUpdateEmploymentProfileMutation,
  useEmploymentProfileUserLinkMutation,
  useEmploymentProfileUserUnlinkMutation,
} from '@modules/employment-profile/hooks/use-employment-profile';
import { createEmploymentDirectReportsColumns } from '@modules/employment-profile/tables/employment-profile-columns';
import type {
  EmploymentContractStatus,
  EmploymentProfileLifecycleAction,
} from '@modules/employment-profile/types/employment-profile.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ActionRail,
  AdminTableShell,
  CursorPager,
  ErrorState,
  LoadingState,
  MetadataSection,
  NotFoundState,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  ReferenceChip,
  RelatedSectionShell,
  StatusBadge,
} from '@shared/components/primitives';
import { useDestructiveConfirm, useMutationFeedback } from '@shared/components/primitives';
import {
  applyActionCapabilityHints,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import {
  formatCreatedDate,
  formatUtcMidnightDateLike,
  formatBusinessTimestamp,
  readReferenceDisplay,
} from '@shared/formatting/formatters';
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveMutationSurface =
  | 'edit'
  | 'assign-org-unit'
  | 'assign-manager'
  | 'link-user'
  | 'contract-status'
  | 'terminate'
  | null;

const employmentStatusToneMap = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  SUSPENDED: 'danger',
  TERMINATED: 'neutral',
  ARCHIVED: 'muted',
} as const;

const contractStatusToneMap = {
  NONE: 'neutral',
  PENDING_SIGNATURE: 'warning',
  ACTIVE: 'success',
  EXPIRED: 'danger',
  TERMINATED: 'muted',
} as const;

const contractStatusTransitionMap: Record<EmploymentContractStatus, EmploymentContractStatus[]> = {
  NONE: ['PENDING_SIGNATURE', 'ACTIVE'],
  PENDING_SIGNATURE: ['NONE', 'ACTIVE'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
};

const readAllowedContractStatuses = (
  currentStatus: EmploymentContractStatus,
  employmentStatus: string,
): EmploymentContractStatus[] => {
  const nextStatuses = contractStatusTransitionMap[currentStatus] ?? [];

  return nextStatuses.filter((status) => {
    if (status !== 'TERMINATED') {
      return true;
    }

    return employmentStatus === 'TERMINATED' || employmentStatus === 'ARCHIVED';
  });
};

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

const readLifecycleConfirmKey = (action: EmploymentProfileLifecycleAction): string => {
  switch (action) {
    case 'place-on-leave':
      return 'employment-profile:confirm.place-on-leave';
    case 'return-from-leave':
      return 'employment-profile:confirm.return-from-leave';
    case 'suspend':
      return 'employment-profile:confirm.suspend';
    case 'reactivate':
      return 'employment-profile:confirm.reactivate';
    case 'archive':
      return 'employment-profile:confirm.archive';
    default:
      return 'employment-profile:confirm.archive';
  }
};

export const EmploymentProfileDetailPage = (): JSX.Element => {
  const { employmentProfileId } = useParams<{ employmentProfileId: string }>();
  const { t } = useTranslation(['employment-profile', 'common', 'errors']);

  const detailQuery = useEmploymentProfileDetail(employmentProfileId);
  const capabilitiesQuery = useCurrentActorCapabilities();

  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);
  const [directReportsCursor, setDirectReportsCursor] = useState<string | undefined>(undefined);
  const [directReportsSortBy, setDirectReportsSortBy] = useState<
    'employeeCode' | 'displayName' | undefined
  >('employeeCode');
  const [directReportsSortDirection, setDirectReportsSortDirection] = useState<
    'asc' | 'desc' | undefined
  >('asc');
  const [, setDirectReportsCursorStack] = useState(createCursorStack);

  useEffect(() => {
    setActiveSurface(null);
    setDirectReportsCursor(undefined);
    setDirectReportsSortBy('employeeCode');
    setDirectReportsSortDirection('asc');
    setDirectReportsCursorStack(createCursorStack());
  }, [employmentProfileId]);

  const directReportsQuery = useEmploymentProfileDirectReports(employmentProfileId, {
    sortBy: directReportsSortBy,
    sortDirection: directReportsSortDirection,
    limit: 20,
    cursor: directReportsCursor,
  });

  const updateMutation = useUpdateEmploymentProfileMutation();
  const assignOrgMutation = useEmploymentProfileOrgAssignmentMutation();
  const assignManagerMutation = useEmploymentProfileManagerAssignmentMutation();
  const linkUserMutation = useEmploymentProfileUserLinkMutation();
  const unlinkUserMutation = useEmploymentProfileUserUnlinkMutation();
  const contractStatusMutation = useEmploymentProfileContractStatusMutation();
  const terminateMutation = useEmploymentProfileTerminateMutation();
  const lifecycleMutation = useEmploymentProfileLifecycleMutation();

  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

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
  const directReportsColumns = useMemo(() => createEmploymentDirectReportsColumns(t), [t]);
  const directReportsNextCursor = directReportsQuery.data?.meta?.nextCursor;

  const onDirectReportsNext = (): void => {
    if (!directReportsNextCursor) {
      return;
    }

    setDirectReportsCursorStack((current) => moveNextCursor(current, directReportsNextCursor));
    setDirectReportsCursor(directReportsNextCursor);
  };

  const onDirectReportsPrevious = (): void => {
    setDirectReportsCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      setDirectReportsCursor(nextStack.current);
      return nextStack;
    });
  };

  const onDirectReportsSortChange = (
    sortBy: 'employeeCode' | 'displayName',
    sortDirection: 'asc' | 'desc',
  ) => {
    setDirectReportsSortBy(sortBy);
    setDirectReportsSortDirection(sortDirection);
    setDirectReportsCursor(undefined);
    setDirectReportsCursorStack(createCursorStack());
  };

  const onLifecycleAction = useCallback(
    async (action: EmploymentProfileLifecycleAction) => {
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
          employmentProfileId: record.id,
          action,
        });
        notifySuccess('employment-profile:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onUnlinkUser = useCallback(async () => {
    if (!record) {
      return;
    }

    const confirmed = await requestDestructiveConfirm({
      description: t('employment-profile:confirm.unlinkUser'),
    });

    if (!confirmed) {
      return;
    }

    try {
      await unlinkUserMutation.mutateAsync({ employmentProfileId: record.id });
      notifySuccess('employment-profile:feedback.userUnlinked');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  }, [notifyError, notifySuccess, record, requestDestructiveConfirm, t, unlinkUserMutation]);

  const onEditSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        employmentProfileId: record.id,
        payload,
      });
      notifySuccess('employment-profile:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAssignOrgSubmit = async (
    payload: Parameters<typeof assignOrgMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await assignOrgMutation.mutateAsync({
        employmentProfileId: record.id,
        payload,
      });
      notifySuccess('employment-profile:feedback.orgUnitAssigned');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAssignManagerSubmit = async (
    payload: Parameters<typeof assignManagerMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await assignManagerMutation.mutateAsync({
        employmentProfileId: record.id,
        payload,
      });
      notifySuccess('employment-profile:feedback.managerAssigned');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onLinkUserSubmit = async (
    payload: Parameters<typeof linkUserMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await linkUserMutation.mutateAsync({
        employmentProfileId: record.id,
        payload,
      });
      notifySuccess('employment-profile:feedback.userLinked');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onContractStatusSubmit = async (
    payload: Parameters<typeof contractStatusMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await contractStatusMutation.mutateAsync({
        employmentProfileId: record.id,
        payload,
      });
      notifySuccess('employment-profile:feedback.contractStatusUpdated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onTerminateSubmit = async (
    payload: Parameters<typeof terminateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await terminateMutation.mutateAsync({
        employmentProfileId: record.id,
        payload,
      });
      notifySuccess('employment-profile:feedback.terminated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const relatedManagerHref = record?.managerEmploymentProfileId
    ? buildEntityDetailHref('employmentProfile', record.managerEmploymentProfileId)
    : undefined;
  const relatedRecruiterHref = record?.recruiterEmploymentProfileId
    ? buildEntityDetailHref('employmentProfile', record.recruiterEmploymentProfileId)
    : undefined;
  const relatedHrOwnerHref = record?.hrOwnerEmploymentProfileId
    ? buildEntityDetailHref('employmentProfile', record.hrOwnerEmploymentProfileId)
    : undefined;
  const relatedOnboardingOwnerHref = record?.onboardingOwnerEmploymentProfileId
    ? buildEntityDetailHref('employmentProfile', record.onboardingOwnerEmploymentProfileId)
    : undefined;
  const relatedSourcedByHref = record?.sourcedByEmploymentProfileId
    ? buildEntityDetailHref('employmentProfile', record.sourcedByEmploymentProfileId)
    : undefined;
  const relatedOrgUnitHref = record?.orgUnitId
    ? buildEntityDetailHref('orgUnit', record.orgUnitId)
    : undefined;
  const contractByOwnerHref = record ? buildContractRegistryByOwnerHref(record.id) : undefined;
  const contractByLinkedEntityHref = record
    ? buildContractRegistryByLinkedEmploymentProfileHref(record.id)
    : undefined;
  const workShiftsBySubjectHref = record
    ? buildWorkShiftsBySubjectEmploymentProfileHref(record.id)
    : undefined;
  const eventsByAssignmentHref = record
    ? buildEventsByAssignmentEmploymentProfileHref(record.id)
    : undefined;

  const allowedContractStatuses = record
    ? readAllowedContractStatuses(record.contractStatus, record.employmentStatus)
    : [];
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
      createEmploymentProfileActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onAssignOrgUnit: () => setActiveSurface('assign-org-unit'),
        onAssignManager: () => setActiveSurface('assign-manager'),
        onLinkUser: () => setActiveSurface('link-user'),
        onContractStatus: () => setActiveSurface('contract-status'),
        onTerminate: () => setActiveSurface('terminate'),
        onUnlinkUser,
        onLifecycleAction,
        canUpdateContractStatus: allowedContractStatuses.length > 0,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.employmentProfileId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        edit: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_UPDATE },
          capabilityCopy,
        ),
        'assign-org-unit': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_ORG_ASSIGNMENT },
          capabilityCopy,
        ),
        'assign-manager': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_MANAGER_ASSIGNMENT },
          capabilityCopy,
        ),
        'link-user': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_USER_LINKAGE },
          capabilityCopy,
        ),
        'unlink-user': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_USER_LINKAGE },
          capabilityCopy,
        ),
        'contract-status': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_UPDATE },
          capabilityCopy,
        ),
        'place-on-leave': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        'return-from-leave': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        suspend: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        reactivate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        terminate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_LIFECYCLE },
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
    onUnlinkUser,
    record,
    t,
    allowedContractStatuses.length,
  ]);

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={record.employmentStatus}
              label={t(`employment-profile:statuses.${record.employmentStatus}`)}
              toneByStatus={employmentStatusToneMap}
            />
            <StatusBadge
              status={record.contractStatus}
              label={t(`employment-profile:contractStatuses.${record.contractStatus}`)}
              toneByStatus={contractStatusToneMap}
            />
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('employment-profile:detail.summaryTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'employee-code',
                  label: t('employment-profile:fields.employeeCode'),
                  value: <ReferenceChip label={record.employeeCode} />,
                },
                {
                  key: 'display-name',
                  label: t('employment-profile:fields.displayName'),
                  value: record.displayName,
                },
                {
                  key: 'legal-name',
                  label: t('employment-profile:fields.legalName'),
                  value: record.legalName,
                },
                {
                  key: 'employment-kind',
                  label: t('employment-profile:fields.employmentKind'),
                  value: record.employmentKind,
                },
                {
                  key: 'job-title',
                  label: t('employment-profile:fields.jobTitle'),
                  value: record.jobTitle,
                },
                {
                  key: 'title-description',
                  label: t('employment-profile:fields.titleDescription'),
                  value: record.titleDescription ?? '-',
                },
                {
                  key: 'external-ref',
                  label: t('employment-profile:fields.externalRef'),
                  value: record.externalRef ?? '-',
                },
                {
                  key: 'linked-user-id',
                  label: t('employment-profile:fields.linkedUserId'),
                  value: readReferenceDisplay(record.linkedUserRef, record.linkedUserId),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('employment-profile:detail.assignmentTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'org-unit',
                  label: t('employment-profile:fields.orgUnitId'),
                  value: record.orgUnitId ? (
                    <ReferenceChip
                      label={readReferenceDisplay(record.orgUnitRef, record.orgUnitId)}
                      to={relatedOrgUnitHref}
                    />
                  ) : (
                    '-'
                  ),
                },
                {
                  key: 'manager',
                  label: t('employment-profile:fields.managerEmploymentProfileId'),
                  value: record.managerEmploymentProfileId ? (
                    <ReferenceChip
                      label={readReferenceDisplay(
                        record.managerEmploymentProfileRef,
                        record.managerEmploymentProfileId,
                      )}
                      to={relatedManagerHref}
                    />
                  ) : (
                    t('employment-profile:detail.noManager')
                  ),
                },
                {
                  key: 'start-date',
                  label: t('employment-profile:fields.employmentStartDate'),
                  value: formatUtcMidnightDateLike(record.employmentStartDate),
                },
                {
                  key: 'end-date',
                  label: t('employment-profile:fields.employmentEndDate'),
                  value: record.employmentEndDate
                    ? formatUtcMidnightDateLike(record.employmentEndDate)
                    : '-',
                },
                {
                  key: 'created-at',
                  label: t('employment-profile:fields.createdAt'),
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('employment-profile:fields.updatedAt'),
                  value: record.updatedAt ? formatBusinessTimestamp(record.updatedAt) : '-',
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
            <MetadataSection title={t('employment-profile:detail.hrAttributionTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'recruiter',
                    label: t('employment-profile:fields.recruiterEmploymentProfileId'),
                    value: record.recruiterEmploymentProfileId ? (
                      <ReferenceChip
                        label={readReferenceDisplay(
                          record.recruiterEmploymentProfileRef,
                          record.recruiterEmploymentProfileId,
                        )}
                        to={relatedRecruiterHref}
                      />
                    ) : (
                      t('employment-profile:detail.notAssigned')
                    ),
                  },
                  {
                    key: 'hr-owner',
                    label: t('employment-profile:fields.hrOwnerEmploymentProfileId'),
                    value: record.hrOwnerEmploymentProfileId ? (
                      <ReferenceChip
                        label={readReferenceDisplay(
                          record.hrOwnerEmploymentProfileRef,
                          record.hrOwnerEmploymentProfileId,
                        )}
                        to={relatedHrOwnerHref}
                      />
                    ) : (
                      t('employment-profile:detail.notAssigned')
                    ),
                  },
                  {
                    key: 'onboarding-owner',
                    label: t('employment-profile:fields.onboardingOwnerEmploymentProfileId'),
                    value: record.onboardingOwnerEmploymentProfileId ? (
                      <ReferenceChip
                        label={readReferenceDisplay(
                          record.onboardingOwnerEmploymentProfileRef,
                          record.onboardingOwnerEmploymentProfileId,
                        )}
                        to={relatedOnboardingOwnerHref}
                      />
                    ) : (
                      t('employment-profile:detail.notAssigned')
                    ),
                  },
                  {
                    key: 'sourced-by',
                    label: t('employment-profile:fields.sourcedByEmploymentProfileId'),
                    value: record.sourcedByEmploymentProfileId ? (
                      <ReferenceChip
                        label={readReferenceDisplay(
                          record.sourcedByEmploymentProfileRef,
                          record.sourcedByEmploymentProfileId,
                        )}
                        to={relatedSourcedByHref}
                      />
                    ) : (
                      t('employment-profile:detail.notAssigned')
                    ),
                  },
                  {
                    key: 'hired-at',
                    label: t('employment-profile:fields.hiredAt'),
                    value: record.hiredAt
                      ? formatUtcMidnightDateLike(record.hiredAt)
                      : t('employment-profile:detail.notAssigned'),
                  },
                  {
                    key: 'onboarded-at',
                    label: t('employment-profile:fields.onboardedAt'),
                    value: record.onboardedAt
                      ? formatUtcMidnightDateLike(record.onboardedAt)
                      : t('employment-profile:detail.notAssigned'),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            {activeSurface === 'edit' ? (
              <EmploymentProfileEditSurface
                initialValues={{
                  legalName: record.legalName,
                  displayName: record.displayName,
                  employmentKind: record.employmentKind,
                  jobTitle: record.jobTitle,
                  recruiterEmploymentProfileId: record.recruiterEmploymentProfileId,
                  hrOwnerEmploymentProfileId: record.hrOwnerEmploymentProfileId,
                  onboardingOwnerEmploymentProfileId: record.onboardingOwnerEmploymentProfileId,
                  sourcedByEmploymentProfileId: record.sourcedByEmploymentProfileId,
                  hiredAt: record.hiredAt,
                  onboardedAt: record.onboardedAt,
                  externalRef: record.externalRef,
                  titleDescription: record.titleDescription,
                }}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onEditSubmit}
              />
            ) : null}
            {activeSurface === 'assign-org-unit' ? (
              <EmploymentProfileOrgAssignmentSurface
                initialOrgUnitId={record.orgUnitId}
                isPending={assignOrgMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onAssignOrgSubmit}
              />
            ) : null}
            {activeSurface === 'assign-manager' ? (
              <EmploymentProfileManagerAssignmentSurface
                currentEmploymentProfileId={record.id}
                currentManagerEmploymentProfileId={record.managerEmploymentProfileId}
                isPending={assignManagerMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onAssignManagerSubmit}
              />
            ) : null}
            {activeSurface === 'link-user' ? (
              <EmploymentProfileUserLinkSurface
                isPending={linkUserMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onLinkUserSubmit}
              />
            ) : null}
            {activeSurface === 'contract-status' && allowedContractStatuses.length > 0 ? (
              <EmploymentProfileContractStatusSurface
                currentStatus={record.contractStatus}
                allowedStatuses={allowedContractStatuses}
                isPending={contractStatusMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onContractStatusSubmit}
              />
            ) : null}
            {activeSurface === 'terminate' ? (
              <EmploymentProfileTerminateSurface
                isPending={terminateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onTerminateSubmit}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <div className="space-y-4">
            <RelatedSectionShell title={t('employment-profile:related.navigationTitle')}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('employment-profile:related.workShifts')}
                  </p>
                  {workShiftsBySubjectHref ? (
                    <Link
                      to={workShiftsBySubjectHref}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('employment-profile:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('employment-profile:related.unavailable')}
                    </p>
                  )}
                </div>
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('employment-profile:related.events')}
                  </p>
                  {eventsByAssignmentHref ? (
                    <Link
                      to={eventsByAssignmentHref}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('employment-profile:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('employment-profile:related.unavailable')}
                    </p>
                  )}
                </div>
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('employment-profile:related.contractsByOwner')}
                  </p>
                  {contractByOwnerHref ? (
                    <Link
                      to={contractByOwnerHref}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('employment-profile:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('employment-profile:related.unavailable')}
                    </p>
                  )}
                </div>
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('employment-profile:related.contractsByLinkedEntity')}
                  </p>
                  {contractByLinkedEntityHref ? (
                    <Link
                      to={contractByLinkedEntityHref}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('employment-profile:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('employment-profile:related.unavailable')}
                    </p>
                  )}
                </div>
              </div>
            </RelatedSectionShell>
            <RelatedSectionShell title={t('employment-profile:related.directReportsTitle')}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs uppercase text-muted" htmlFor="direct-reports-sort-by">
                    {t('employment-profile:directReports.sortBy')}
                  </label>
                  <select
                    id="direct-reports-sort-by"
                    className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                    value={directReportsSortBy ?? ''}
                    onChange={(event) =>
                      onDirectReportsSortChange(
                        (event.target.value as 'employeeCode' | 'displayName') || 'employeeCode',
                        directReportsSortDirection ?? 'asc',
                      )
                    }
                  >
                    <option value="employeeCode">
                      {t('employment-profile:directReports.sort.employeeCode')}
                    </option>
                    <option value="displayName">
                      {t('employment-profile:directReports.sort.displayName')}
                    </option>
                  </select>
                  <select
                    className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                    value={directReportsSortDirection ?? 'asc'}
                    onChange={(event) =>
                      onDirectReportsSortChange(
                        directReportsSortBy ?? 'employeeCode',
                        (event.target.value as 'asc' | 'desc') || 'asc',
                      )
                    }
                  >
                    <option value="asc">{t('common:labels.sortAscending')}</option>
                    <option value="desc">{t('common:labels.sortDescending')}</option>
                  </select>
                </div>
                <AdminTableShell
                  data={directReportsQuery.data?.data ?? []}
                  columns={directReportsColumns}
                  isLoading={directReportsQuery.isPending}
                  emptyTitle={t('employment-profile:directReports.emptyTitle')}
                  emptyMessage={t('employment-profile:directReports.emptyMessage')}
                  caption={t('employment-profile:directReports.caption')}
                />
                <div className="flex justify-end">
                  <CursorPager
                    canGoBack={Boolean(directReportsCursor)}
                    canGoNext={Boolean(directReportsNextCursor)}
                    onPrevious={onDirectReportsPrevious}
                    onNext={onDirectReportsNext}
                  />
                </div>
              </div>
            </RelatedSectionShell>
          </div>
        ) : undefined
      }
      actionRail={
        <ActionRail title={t('employment-profile:actionRail.title')} items={actionItems} />
      }
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('employment-profile:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'employment-profile:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
