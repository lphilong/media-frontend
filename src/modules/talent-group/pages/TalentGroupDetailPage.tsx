import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import {
  buildEventsByAssignmentTalentGroupHref,
  buildPlatformAccountsByOwnerTalentGroupHref,
  buildWorkShiftsBySubjectTalentGroupHref,
} from '@app/router/reference-links';
import { createTalentGroupActionRailItems } from '@modules/talent-group/actions/talent-group-action-rail';
import {
  TalentGroupAddMemberSurface,
  TalentGroupEditSurface,
  TalentGroupUpdateLineupSurface,
} from '@modules/talent-group/forms/talent-group-mutation-forms';
import {
  useTalentGroupAddMemberMutation,
  useTalentGroupDetail,
  useTalentGroupLifecycleMutation,
  useTalentGroupMembershipLifecycleMutation,
  useTalentGroupMembers,
  useTalentGroupUpdateLineupMutation,
  useUpdateTalentGroupMutation,
} from '@modules/talent-group/hooks/use-talent-group';
import { ResponsibilitySummarySection } from '@modules/responsibility';
import { createTalentGroupMemberColumns } from '@modules/talent-group/tables/talent-group-columns';
import type {
  TalentGroupLifecycleAction,
  TalentGroupMemberRecord,
  TalentGroupMembershipLifecycleAction,
} from '@modules/talent-group/types/talent-group.types';
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
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  applyActionCapabilityHints,
  canShowAction,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import { formatCreatedDate, formatBusinessTimestamp } from '@shared/formatting/formatters';
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query/cursor';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveMutationSurface = 'edit' | 'add-member' | 'update-lineup' | null;

const statusToneMap = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

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

const readGroupLifecycleConfirmKey = (action: TalentGroupLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'talent-group:confirm.activate';
    case 'deactivate':
      return 'talent-group:confirm.deactivate';
    case 'archive':
      return 'talent-group:confirm.archive';
    default:
      return 'talent-group:confirm.archive';
  }
};

const readMembershipLifecycleConfirmKey = (
  action: TalentGroupMembershipLifecycleAction,
): string => {
  switch (action) {
    case 'deactivate':
      return 'talent-group:confirm.deactivateMember';
    case 'reactivate':
      return 'talent-group:confirm.reactivateMember';
    case 'remove':
      return 'talent-group:confirm.removeMember';
    default:
      return 'talent-group:confirm.removeMember';
  }
};

export const TalentGroupDetailPage = (): JSX.Element => {
  const { groupId } = useParams<{ groupId: string }>();
  const { t } = useTranslation(['talent-group', 'common', 'errors']);
  const navigate = useNavigate();
  const capabilitiesQuery = useCurrentActorCapabilities();

  const detailQuery = useTalentGroupDetail(groupId);
  const [membersCursor, setMembersCursor] = useState<string | undefined>(undefined);
  const [, setMembersCursorStack] = useState(createCursorStack);
  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);
  const [selectedMembership, setSelectedMembership] = useState<TalentGroupMemberRecord | null>(
    null,
  );

  useEffect(() => {
    setMembersCursor(undefined);
    setMembersCursorStack(createCursorStack());
    setActiveSurface(null);
    setSelectedMembership(null);
  }, [groupId]);

  const membersQuery = useTalentGroupMembers(groupId, {
    cursor: membersCursor,
    limit: 20,
  });
  const updateMutation = useUpdateTalentGroupMutation();
  const addMemberMutation = useTalentGroupAddMemberMutation();
  const updateLineupMutation = useTalentGroupUpdateLineupMutation();
  const lifecycleMutation = useTalentGroupLifecycleMutation();
  const membershipLifecycleMutation = useTalentGroupMembershipLifecycleMutation();
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
  const membersNextCursor = membersQuery.data?.meta?.nextCursor;
  const canGoMembersNext = Boolean(membersNextCursor);
  const canGoMembersBack = Boolean(membersCursor);

  const onMembersNext = (): void => {
    if (!membersNextCursor) {
      return;
    }

    setMembersCursorStack((current) => moveNextCursor(current, membersNextCursor));
    setMembersCursor(membersNextCursor);
  };

  const onMembersPrevious = (): void => {
    setMembersCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      setMembersCursor(nextStack.current);
      return nextStack;
    });
  };

  const onGroupLifecycleAction = useCallback(
    async (action: TalentGroupLifecycleAction) => {
      if (!record) {
        return;
      }

      const confirmed = await requestDestructiveConfirm({
        description: t(readGroupLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          groupId: record.id,
          action,
        });
        notifySuccess('talent-group:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onMembershipLifecycleAction = useCallback(
    async (membershipId: string, action: TalentGroupMembershipLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readMembershipLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await membershipLifecycleMutation.mutateAsync({
          membershipId,
          action,
        });
        notifySuccess('talent-group:feedback.membershipLifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [membershipLifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const onEditSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        groupId: record.id,
        payload,
      });
      notifySuccess('talent-group:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAddMemberSubmit = async (
    payload: Parameters<typeof addMemberMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        groupId: record.id,
        payload,
      });
      notifySuccess('talent-group:feedback.memberAdded');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onUpdateLineupSubmit = async (
    payload: Parameters<typeof updateLineupMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!selectedMembership) {
      return;
    }

    try {
      await updateLineupMutation.mutateAsync({
        membershipId: selectedMembership.id,
        payload,
      });
      notifySuccess('talent-group:feedback.lineupUpdated');
      setActiveSurface(null);
      setSelectedMembership(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

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
      createTalentGroupActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onAddMember: () => setActiveSurface('add-member'),
        onLifecycleAction: onGroupLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.groupId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        edit: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_GROUP_UPDATE },
          capabilityCopy,
        ),
        'add-member': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_GROUP_MANAGE_MEMBERSHIP },
          capabilityCopy,
        ),
        activate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_GROUP_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        deactivate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_GROUP_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.TALENT_GROUP_MANAGE_LIFECYCLE },
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
    onGroupLifecycleAction,
    record,
    t,
  ]);

  const canManageMembership = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.TALENT_GROUP_MANAGE_MEMBERSHIP,
  });

  const memberColumns = useMemo(
    () =>
      createTalentGroupMemberColumns(t, {
        onOpenTalentDetail: (talentId) => navigate(APP_PATHS.talentDetail(talentId)),
        onOpenLineupSurface: (membershipId) => {
          const membership =
            membersQuery.data?.data.find((item) => item.id === membershipId) ?? null;
          setSelectedMembership(membership);
          setActiveSurface('update-lineup');
        },
        onLifecycleAction: onMembershipLifecycleAction,
        isLifecyclePending: (membershipId, action) =>
          membershipLifecycleMutation.isPending &&
          membershipLifecycleMutation.variables?.membershipId === membershipId &&
          membershipLifecycleMutation.variables?.action === action,
        canShowMemberMutationActions: canManageMembership,
        isGroupArchived: record?.status === 'ARCHIVED',
      }),
    [
      canManageMembership,
      membersQuery.data?.data,
      membershipLifecycleMutation.isPending,
      membershipLifecycleMutation.variables,
      navigate,
      onMembershipLifecycleAction,
      record?.status,
      t,
    ],
  );

  const relatedPlatformAccountsHref = record
    ? buildPlatformAccountsByOwnerTalentGroupHref(record.id)
    : undefined;
  const relatedWorkShiftsHref = record
    ? buildWorkShiftsBySubjectTalentGroupHref(record.id)
    : undefined;
  const relatedEventsHref = record ? buildEventsByAssignmentTalentGroupHref(record.id) : undefined;

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`talent-group:statuses.${record.status}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('talent-group:detail.summaryTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'group-code',
                  label: t('talent-group:fields.groupCode'),
                  value: <ReferenceChip label={record.groupCode} />,
                },
                {
                  key: 'name',
                  label: t('talent-group:fields.name'),
                  value: record.name,
                },
                {
                  key: 'short-name',
                  label: t('talent-group:fields.shortName'),
                  value: record.shortName ?? '-',
                },
                {
                  key: 'display-order',
                  label: t('talent-group:fields.displayOrder'),
                  value: String(record.displayOrder),
                  description: t('talent-group:help.displayOrder'),
                },
                {
                  key: 'status',
                  label: t('talent-group:fields.status'),
                  value: t(`talent-group:statuses.${record.status}`),
                },
                {
                  key: 'created-at',
                  label: t('talent-group:fields.createdAt'),
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('talent-group:fields.updatedAt'),
                  value: formatBusinessTimestamp(record.updatedAt),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('talent-group:detail.metadataTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'description',
                  label: t('talent-group:fields.description'),
                  value: record.description ?? '-',
                },
                {
                  key: 'external-ref',
                  label: t('talent-group:fields.externalRef'),
                  value: record.externalRef ?? '-',
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
              <TalentGroupEditSurface
                initialValues={{
                  name: record.name,
                  shortName: record.shortName,
                  description: record.description,
                  displayOrder: record.displayOrder,
                  externalRef: record.externalRef,
                }}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onEditSubmit}
              />
            ) : null}
            {activeSurface === 'add-member' ? (
              <TalentGroupAddMemberSurface
                isPending={addMemberMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onAddMemberSubmit}
              />
            ) : null}
            {activeSurface === 'update-lineup' && selectedMembership ? (
              <TalentGroupUpdateLineupSurface
                initialLineupOrder={selectedMembership.lineupOrder}
                isPending={updateLineupMutation.isPending}
                onCancel={() => {
                  setActiveSurface(null);
                  setSelectedMembership(null);
                }}
                onSubmit={onUpdateLineupSubmit}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <div className="space-y-4">
            <ResponsibilitySummarySection
              subjectType="TALENT_GROUP"
              subjectId={record.id}
              title={t('talent-group:managers.title')}
            />
            <RelatedSectionShell title={t('talent-group:related.navigationTitle')}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('talent-group:related.platformAccounts')}
                  </p>
                  {relatedPlatformAccountsHref ? (
                    <Link
                      to={relatedPlatformAccountsHref}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('talent-group:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('talent-group:related.unavailable')}
                    </p>
                  )}
                </div>
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('talent-group:related.workShifts')}
                  </p>
                  {relatedWorkShiftsHref ? (
                    <Link
                      to={relatedWorkShiftsHref}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('talent-group:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('talent-group:related.unavailable')}
                    </p>
                  )}
                </div>
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('talent-group:related.events')}
                  </p>
                  {relatedEventsHref ? (
                    <Link
                      to={relatedEventsHref}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('talent-group:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('talent-group:related.unavailable')}
                    </p>
                  )}
                </div>
              </div>
            </RelatedSectionShell>
            <RelatedSectionShell title={t('talent-group:related.membersTitle')}>
              <div className="space-y-3">
                <AdminTableShell
                  data={membersQuery.data?.data ?? []}
                  columns={memberColumns}
                  isLoading={membersQuery.isPending}
                  emptyTitle={t('talent-group:related.membersEmptyTitle')}
                  emptyMessage={t('talent-group:related.membersEmptyMessage')}
                  caption={t('talent-group:membersTable.caption')}
                />
                <div className="flex justify-end">
                  <CursorPager
                    canGoBack={canGoMembersBack}
                    canGoNext={canGoMembersNext}
                    onPrevious={onMembersPrevious}
                    onNext={onMembersNext}
                  />
                </div>
              </div>
            </RelatedSectionShell>
          </div>
        ) : undefined
      }
      actionRail={<ActionRail title={t('talent-group:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('talent-group:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'talent-group:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
