import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import {
  buildEmploymentProfilesByOrgUnitHref,
  buildPlatformAccountsByOwnerOrgUnitHref,
} from '@app/router/reference-links';
import { createOrgUnitActionRailItems } from '@modules/org-unit/actions/org-unit-action-rail';
import {
  OrgUnitAssignResponsibilitySurface,
  OrgUnitEditSurface,
  OrgUnitEditResponsibilitySurface,
  OrgUnitMoveSurface,
} from '@modules/org-unit/forms/org-unit-mutation-forms';
import {
  useAssignOrgUnitResponsibilityMutation,
  useMoveOrgUnitMutation,
  useOrgUnitChildren,
  useOrgUnitDetail,
  useOrgUnitLifecycleMutation,
  useOrgUnitResponsibilities,
  useRevokeOrgUnitResponsibilityMutation,
  useUpdateOrgUnitResponsibilityMutation,
  useUpdateOrgUnitMutation,
} from '@modules/org-unit/hooks/use-org-unit';
import { createOrgUnitChildrenColumns } from '@modules/org-unit/tables/org-unit-columns';
import type {
  OrgUnitLifecycleAction,
  OrgUnitResponsibilityRecord,
} from '@modules/org-unit/types/org-unit.types';
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
  canShowAction,
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
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveMutationSurface =
  | 'edit'
  | 'move'
  | 'assign-responsibility'
  | 'edit-responsibility'
  | null;

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

const readLifecycleConfirmKey = (action: OrgUnitLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'org-unit:confirm.activate';
    case 'deactivate':
      return 'org-unit:confirm.deactivate';
    case 'archive':
      return 'org-unit:confirm.archive';
    default:
      return 'org-unit:confirm.archive';
  }
};

const statusToneMap = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const responsibilityStatusToneMap = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  REMOVED: 'muted',
} as const;

const readResponsibilityManagerLabel = (assignment: OrgUnitResponsibilityRecord): string =>
  readReferenceDisplay(assignment.managerRef, assignment.managerEmploymentProfileId);

export const OrgUnitDetailPage = (): JSX.Element => {
  const { orgUnitId } = useParams<{ orgUnitId: string }>();
  const { t } = useTranslation(['org-unit', 'common', 'errors']);
  const navigate = useNavigate();
  const capabilitiesQuery = useCurrentActorCapabilities();

  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);
  const [selectedResponsibility, setSelectedResponsibility] =
    useState<OrgUnitResponsibilityRecord | null>(null);
  const [childrenCursor, setChildrenCursor] = useState<string | undefined>(undefined);
  const [, setChildrenCursorStack] = useState(createCursorStack);

  useEffect(() => {
    setActiveSurface(null);
    setSelectedResponsibility(null);
    setChildrenCursor(undefined);
    setChildrenCursorStack(createCursorStack());
  }, [orgUnitId]);

  const detailQuery = useOrgUnitDetail(orgUnitId);
  const childrenQuery = useOrgUnitChildren(orgUnitId, { cursor: childrenCursor, limit: 20 });
  const responsibilitiesQuery = useOrgUnitResponsibilities(orgUnitId);

  const updateMutation = useUpdateOrgUnitMutation();
  const moveMutation = useMoveOrgUnitMutation();
  const lifecycleMutation = useOrgUnitLifecycleMutation();
  const assignResponsibilityMutation = useAssignOrgUnitResponsibilityMutation();
  const updateResponsibilityMutation = useUpdateOrgUnitResponsibilityMutation();
  const revokeResponsibilityMutation = useRevokeOrgUnitResponsibilityMutation();

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
  const childrenNextCursor = childrenQuery.data?.meta?.nextCursor;
  const canGoChildrenNext = Boolean(childrenNextCursor);
  const canGoChildrenBack = Boolean(childrenCursor);
  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  const onChildrenNext = (): void => {
    if (!childrenNextCursor) {
      return;
    }

    setChildrenCursorStack((current) => moveNextCursor(current, childrenNextCursor));
    setChildrenCursor(childrenNextCursor);
  };

  const onChildrenPrevious = (): void => {
    setChildrenCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      setChildrenCursor(nextStack.current);
      return nextStack;
    });
  };

  const onUpdateSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        orgUnitId: record.id,
        payload,
      });
      notifySuccess('org-unit:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onMoveSubmit = async (
    payload: Parameters<typeof moveMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await moveMutation.mutateAsync({
        orgUnitId: record.id,
        payload,
      });
      notifySuccess('org-unit:feedback.moved');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAssignResponsibilitySubmit = async (
    payload: Parameters<typeof assignResponsibilityMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await assignResponsibilityMutation.mutateAsync({
        orgUnitId: record.id,
        payload,
      });
      notifySuccess('org-unit:feedback.responsibilityAssigned');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onEditResponsibilitySubmit = async (
    payload: Parameters<typeof updateResponsibilityMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record || !selectedResponsibility) {
      return;
    }

    try {
      await updateResponsibilityMutation.mutateAsync({
        orgUnitId: record.id,
        assignmentId: selectedResponsibility.id,
        payload,
      });
      notifySuccess('org-unit:feedback.responsibilityUpdated');
      setActiveSurface(null);
      setSelectedResponsibility(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onRevokeResponsibility = useCallback(
    async (assignment: OrgUnitResponsibilityRecord) => {
      if (!record) {
        return;
      }

      const confirmed = await requestDestructiveConfirm({
        description: t('org-unit:confirm.revokeResponsibility'),
      });

      if (!confirmed) {
        return;
      }

      try {
        await revokeResponsibilityMutation.mutateAsync({
          orgUnitId: record.id,
          assignmentId: assignment.id,
        });
        notifySuccess('org-unit:feedback.responsibilityRevoked');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [
      notifyError,
      notifySuccess,
      record,
      requestDestructiveConfirm,
      revokeResponsibilityMutation,
      t,
    ],
  );

  const onLifecycleAction = useCallback(
    async (action: OrgUnitLifecycleAction) => {
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
          orgUnitId: record.id,
          action,
        });
        notifySuccess('org-unit:feedback.lifecycleUpdated');
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
      createOrgUnitActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onMove: () => setActiveSurface('move'),
        onLifecycleAction,
        isLifecyclePending: (action) => {
          return (
            lifecycleMutation.isPending &&
            lifecycleMutation.variables?.orgUnitId === record.id &&
            lifecycleMutation.variables?.action === action
          );
        },
      }),
      {
        edit: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ORG_UNIT_UPDATE },
          capabilityCopy,
        ),
        move: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ORG_UNIT_MANAGE_HIERARCHY },
          capabilityCopy,
        ),
        activate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ORG_UNIT_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        deactivate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ORG_UNIT_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ORG_UNIT_MANAGE_LIFECYCLE },
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

  const childrenColumns = useMemo(() => createOrgUnitChildrenColumns(t), [t]);
  const canManageResponsibilities = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.ORG_UNIT_UPDATE,
  });

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            toneByStatus={statusToneMap}
            label={t(`org-unit:statuses.${record.status}`)}
          />
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('org-unit:detail.summaryTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'code',
                  label: t('org-unit:fields.code'),
                  value: <ReferenceChip label={record.code} />,
                },
                {
                  key: 'name',
                  label: t('org-unit:fields.name'),
                  value: record.name,
                },
                {
                  key: 'type',
                  label: t('org-unit:fields.type'),
                  value: record.type,
                },
                {
                  key: 'status',
                  label: t('org-unit:fields.status'),
                  value: t(`org-unit:statuses.${record.status}`),
                },
                {
                  key: 'display-order',
                  label: t('org-unit:fields.displayOrder'),
                  value: String(record.displayOrder),
                  description: t('org-unit:help.displayOrder'),
                },
                {
                  key: 'created-at',
                  label: t('org-unit:fields.createdAt'),
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('org-unit:fields.updatedAt'),
                  value: record.updatedAt ? formatBusinessTimestamp(record.updatedAt) : '-',
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('org-unit:detail.hierarchyTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'parent-id',
                  label: t('org-unit:fields.parentOrgUnitId'),
                  value: record.parentOrgUnitId ? (
                    <ReferenceChip
                      label={readReferenceDisplay(record.parentOrgUnitRef, record.parentOrgUnitId)}
                      to={APP_PATHS.orgUnitDetail(record.parentOrgUnitId)}
                    />
                  ) : (
                    t('org-unit:detail.rootUnit')
                  ),
                },
                {
                  key: 'depth',
                  label: t('org-unit:fields.depth'),
                  value: String(record.depth),
                },
                {
                  key: 'ancestor-chain',
                  label: t('org-unit:fields.ancestorChain'),
                  value:
                    record.hierarchy?.ancestorChain.length &&
                    record.hierarchy.ancestorChain.length > 0
                      ? record.hierarchy.ancestorChain.join(' > ')
                      : '-',
                },
                {
                  key: 'external-ref',
                  label: t('org-unit:fields.externalRef'),
                  value: record.externalRef ?? '-',
                },
                {
                  key: 'description',
                  label: t('org-unit:fields.description'),
                  value: record.description ?? '-',
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
              <OrgUnitEditSurface
                initialValues={{
                  name: record.name,
                  displayOrder: record.displayOrder,
                  description: record.description,
                  externalRef: record.externalRef,
                }}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onUpdateSubmit}
              />
            ) : null}
            {activeSurface === 'move' ? (
              <OrgUnitMoveSurface
                currentOrgUnitId={record.id}
                currentParentOrgUnitId={record.parentOrgUnitId}
                isPending={moveMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onMoveSubmit}
              />
            ) : null}
            {activeSurface === 'assign-responsibility' ? (
              <OrgUnitAssignResponsibilitySurface
                isPending={assignResponsibilityMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onAssignResponsibilitySubmit}
              />
            ) : null}
            {activeSurface === 'edit-responsibility' && selectedResponsibility ? (
              <OrgUnitEditResponsibilitySurface
                assignment={selectedResponsibility}
                isPending={updateResponsibilityMutation.isPending}
                onCancel={() => {
                  setActiveSurface(null);
                  setSelectedResponsibility(null);
                }}
                onSubmit={onEditResponsibilitySubmit}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <div className="space-y-4">
            <RelatedSectionShell title={t('org-unit:responsibilities.title')}>
              <div className="space-y-3">
                <p className="text-sm text-muted">{t('org-unit:responsibilities.helper')}</p>
                <div className="flex justify-end">
                  {canManageResponsibilities && record.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="rounded border border-border px-3 py-2 text-sm font-medium text-fg hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => setActiveSurface('assign-responsibility')}
                      disabled={assignResponsibilityMutation.isPending}
                    >
                      {t('org-unit:responsibilities.assign')}
                    </button>
                  ) : null}
                </div>
                {responsibilitiesQuery.isPending ? (
                  <LoadingState lines={3} />
                ) : responsibilitiesQuery.data && responsibilitiesQuery.data.length > 0 ? (
                  <div className="divide-y divide-border rounded border border-border">
                    {responsibilitiesQuery.data.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex flex-col gap-3 px-3 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-fg">
                              {readResponsibilityManagerLabel(assignment)}
                            </p>
                            <StatusBadge
                              status={assignment.status}
                              toneByStatus={responsibilityStatusToneMap}
                              label={t(`org-unit:responsibilityStatuses.${assignment.status}`)}
                            />
                          </div>
                          <p className="text-xs text-muted">
                            {assignment.managerRef.code ?? assignment.managerEmploymentProfileId}
                            {assignment.managerRef.title ? ` - ${assignment.managerRef.title}` : ''}
                          </p>
                          <p className="text-xs text-muted">
                            {t(`org-unit:responsibilityRoles.${assignment.role}`)}
                            {assignment.isPrimary
                              ? ` - ${t('org-unit:responsibilities.primary')}`
                              : ''}
                            {assignment.includeDescendants
                              ? ` - ${t('org-unit:responsibilities.descendantsIncluded')}`
                              : ''}
                          </p>
                          <p className="text-xs text-muted">
                            {t('org-unit:responsibilities.effectiveRange', {
                              from: formatBusinessTimestamp(assignment.effectiveFrom),
                              to: assignment.effectiveTo
                                ? formatBusinessTimestamp(assignment.effectiveTo)
                                : t('org-unit:responsibilities.openEnded'),
                            })}
                          </p>
                        </div>
                        {canManageResponsibilities && assignment.status === 'ACTIVE' ? (
                          <div className="flex flex-wrap gap-2 self-start md:self-center">
                            <button
                              type="button"
                              className="rounded border border-border px-3 py-2 text-sm font-medium text-fg hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={
                                updateResponsibilityMutation.isPending &&
                                updateResponsibilityMutation.variables?.assignmentId ===
                                  assignment.id
                              }
                              onClick={() => {
                                setSelectedResponsibility(assignment);
                                setActiveSurface('edit-responsibility');
                              }}
                            >
                              {t('common:actions.edit')}
                            </button>
                            <button
                              type="button"
                              className="rounded border border-danger px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={
                                revokeResponsibilityMutation.isPending &&
                                revokeResponsibilityMutation.variables?.assignmentId ===
                                  assignment.id
                              }
                              onClick={() => void onRevokeResponsibility(assignment)}
                            >
                              {t('org-unit:responsibilities.revoke')}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded border border-border px-3 py-4">
                    <p className="text-sm font-medium text-fg">
                      {t('org-unit:responsibilities.emptyTitle')}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {t('org-unit:responsibilities.emptyMessage')}
                    </p>
                  </div>
                )}
              </div>
            </RelatedSectionShell>
            <RelatedSectionShell title={t('org-unit:related.navigationTitle')}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('org-unit:related.employmentProfiles')}
                  </p>
                  <Link
                    to={
                      buildEmploymentProfilesByOrgUnitHref(record.id) ??
                      APP_PATHS.employmentProfiles
                    }
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('org-unit:related.openFilteredList')}
                  </Link>
                </div>
                <div className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t('org-unit:related.platformAccounts')}
                  </p>
                  <Link
                    to={
                      buildPlatformAccountsByOwnerOrgUnitHref(record.id) ??
                      APP_PATHS.platformAccounts
                    }
                    className="mt-1 inline-flex text-sm text-accent hover:underline"
                  >
                    {t('org-unit:related.openFilteredList')}
                  </Link>
                </div>
              </div>
            </RelatedSectionShell>
            <RelatedSectionShell title={t('org-unit:related.childrenTitle')}>
              <div className="space-y-3">
                <AdminTableShell
                  data={childrenQuery.data?.data ?? []}
                  columns={childrenColumns}
                  isLoading={childrenQuery.isPending}
                  emptyTitle={t('org-unit:related.childrenEmptyTitle')}
                  emptyMessage={t('org-unit:related.childrenEmptyMessage')}
                  onRowClick={(child) => navigate(APP_PATHS.orgUnitDetail(child.id))}
                />
                <div className="flex justify-end">
                  <CursorPager
                    canGoBack={canGoChildrenBack}
                    canGoNext={canGoChildrenNext}
                    onPrevious={onChildrenPrevious}
                    onNext={onChildrenNext}
                  />
                </div>
              </div>
            </RelatedSectionShell>
          </div>
        ) : undefined
      }
      actionRail={<ActionRail title={t('org-unit:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('org-unit:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'org-unit:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
