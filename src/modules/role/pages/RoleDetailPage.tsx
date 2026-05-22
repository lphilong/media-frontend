import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { createRoleActionRailItems } from '@modules/role/actions/role-action-rail';
import { RoleBoundaryNotice } from '@modules/role/components/RoleBoundaryNotice';
import { roleAssignmentStateValues } from '@modules/role/constants/role.constants';
import {
  RoleAssignmentRulesSurface,
  RoleAssignUserSurface,
  RoleEditSurface,
  RoleLifecycleReasonSurface,
  RolePermissionsSurface,
  RoleRevokeAssignmentSurface,
} from '@modules/role/forms/role-mutation-forms';
import {
  useRoleAssignmentRuleReplacementMutation,
  useRoleAssignments,
  useRoleAssignToUserMutation,
  useRoleDetail,
  useRoleLifecycleMutation,
  useRolePermissionMatrix,
  useRolePermissionReplacementMutation,
  useRoleRevokeAssignmentMutation,
  useRoleTemplates,
  useUpdateRoleMutation,
} from '@modules/role/hooks/use-role';
import { createRoleAssignmentColumns } from '@modules/role/tables/role-columns';
import type {
  RoleAssignmentItem,
  RoleAssignmentListQuery,
  RoleLifecycleAction,
  RoleTemplateCode,
} from '@modules/role/types/role.types';
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
import { formatCreatedDate, formatBusinessTimestamp } from '@shared/formatting/formatters';
import {
  applyActionCapabilityHints,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import { ModuleDetailScreenShell } from '@shared/modules';
import {
  createCursorStack,
  moveNextCursor,
  movePreviousCursor,
  roleAssignmentListQueryConfig,
  serializeScreenQueryParams,
  useRouteQueryState,
} from '@shared/query';

type ActiveMutationSurface =
  | 'edit'
  | 'permissions'
  | 'assignment-rules'
  | 'assign-to-user'
  | 'deactivate'
  | 'archive'
  | 'revoke-assignment'
  | null;

const statusToneMap = {
  DRAFT: 'neutral',
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

const formatOptionalTimestamp = (value?: number | string | null): string =>
  value === null || value === undefined ? '-' : formatBusinessTimestamp(value);

const readPermissionCodes = (permissions: Array<{ code: string }>): string =>
  permissions.length === 0 ? '-' : permissions.map((permission) => permission.code).join(', ');

const roleTemplateDisplayNames: Record<RoleTemplateCode, string> = {
  ADMIN_FULL: 'Admin Full',
  HR_OPERATIONS: 'HR Operations',
  TEAM_MANAGER: 'Team Manager',
  PRODUCTION_OPS: 'Production Ops',
  COMMERCIAL_FINANCE: 'Commercial Finance',
  TALENT_STAFF_SELF: 'Talent/Staff Self',
  VIEWER_AUDITOR: 'Viewer/Auditor',
};

const readTemplateDisplay = (templateCode?: RoleTemplateCode | null): string =>
  templateCode ? `${roleTemplateDisplayNames[templateCode]} (${templateCode})` : '-';

export const RoleDetailPage = (): JSX.Element => {
  const { roleId } = useParams<{ roleId: string }>();
  const { t } = useTranslation(['role', 'common', 'errors']);
  const { query, patchQuery } = useRouteQueryState(roleAssignmentListQueryConfig);

  const detailQuery = useRoleDetail(roleId);
  const assignmentsQuery = useRoleAssignments(roleId, query);
  const permissionMatrixQuery = useRolePermissionMatrix(roleId);
  const roleTemplatesQuery = useRoleTemplates();
  const capabilitiesQuery = useCurrentActorCapabilities();
  const updateMutation = useUpdateRoleMutation();
  const lifecycleMutation = useRoleLifecycleMutation();
  const permissionsMutation = useRolePermissionReplacementMutation();
  const assignmentRulesMutation = useRoleAssignmentRuleReplacementMutation();
  const assignToUserMutation = useRoleAssignToUserMutation();
  const revokeAssignmentMutation = useRoleRevokeAssignmentMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<RoleAssignmentItem | null>(null);
  const [, setCursorStack] = useState(createCursorStack);

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  const queryShapeSignature = useMemo(
    () =>
      serializeScreenQueryParams(
        {
          ...query,
          cursor: undefined,
        },
        roleAssignmentListQueryConfig,
      ).toString(),
    [query],
  );
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    setActiveSurface(null);
    setSelectedAssignment(null);
  }, [roleId]);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

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
  const nextCursor = assignmentsQuery.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(query.cursor);

  const onNextAssignments = (): void => {
    if (!nextCursor) {
      return;
    }

    setCursorStack((current) => moveNextCursor(current, nextCursor));
    patchQuery({ cursor: nextCursor }, { resetCursorOnChange: false });
  };

  const onPreviousAssignments = (): void => {
    setCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      patchQuery({ cursor: nextStack.current ?? undefined }, { resetCursorOnChange: false });

      return nextStack;
    });
  };

  const onLifecycleAction = useCallback(
    async (action: RoleLifecycleAction) => {
      if (!record) {
        return;
      }

      if (action === 'activate') {
        const confirmed = await requestDestructiveConfirm({
          description: t('role:confirm.activate'),
        });
        if (!confirmed) {
          return;
        }

        try {
          await lifecycleMutation.mutateAsync({
            roleId: record.id,
            action,
          });
          notifySuccess('role:feedback.lifecycleUpdated');
        } catch (error) {
          notifyError(error as NormalizedApiError);
        }
        return;
      }

      setActiveSurface(action);
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onUpdateSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({ roleId: record.id, payload });
      notifySuccess('role:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onPermissionsSubmit = async (
    payload: Parameters<typeof permissionsMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await permissionsMutation.mutateAsync({ roleId: record.id, payload });
      notifySuccess('role:feedback.permissionsUpdated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAssignmentRulesSubmit = async (
    payload: Parameters<typeof assignmentRulesMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await assignmentRulesMutation.mutateAsync({ roleId: record.id, payload });
      notifySuccess('role:feedback.assignmentRulesUpdated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onLifecycleReasonSubmit = async (
    action: 'deactivate' | 'archive',
    payload: Parameters<typeof lifecycleMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await lifecycleMutation.mutateAsync({ roleId: record.id, action, payload });
      notifySuccess('role:feedback.lifecycleUpdated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAssignToUserSubmit = async (
    payload: Parameters<typeof assignToUserMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await assignToUserMutation.mutateAsync({ roleId: record.id, payload });
      notifySuccess('role:feedback.assignedToUser');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onRevokeAssignmentSubmit = async (
    payload: Parameters<typeof revokeAssignmentMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record || !selectedAssignment) {
      return;
    }

    try {
      await revokeAssignmentMutation.mutateAsync({
        roleId: record.id,
        assignmentId: selectedAssignment.assignmentId,
        payload,
      });
      notifySuccess('role:feedback.assignmentRevoked');
      setSelectedAssignment(null);
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return applyActionCapabilityHints(
      createRoleActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onPermissions: () => setActiveSurface('permissions'),
        onAssignmentRules: () => setActiveSurface('assignment-rules'),
        onAssignToUser: () => setActiveSurface('assign-to-user'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.roleId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        edit: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_UPDATE },
          capabilityCopy,
        ),
        permissions: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_PERMISSION_ASSIGN },
          capabilityCopy,
        ),
        'assignment-rules': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_ASSIGNMENT_RULE_SET },
          capabilityCopy,
        ),
        'assign-to-user': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_ASSIGN_TO_USER },
          capabilityCopy,
        ),
        activate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_ACTIVATE },
          capabilityCopy,
        ),
        deactivate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_DEACTIVATE },
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_ARCHIVE },
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

  const assignmentColumns = useMemo(
    () =>
      createRoleAssignmentColumns(t, {
        roleState: record?.state,
        canRevokeAssignment: !createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_REVOKE_FROM_USER },
          capabilityCopy,
        ).disabled,
        revokeDisabledReason: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_REVOKE_FROM_USER },
          capabilityCopy,
        ).disabledReason,
        onRevokeAssignment: (assignment) => {
          setSelectedAssignment(assignment);
          setActiveSurface('revoke-assignment');
        },
        isActionPending: (assignmentId) =>
          revokeAssignmentMutation.isPending &&
          revokeAssignmentMutation.variables?.assignmentId === assignmentId,
      }),
    [
      capabilityCopy,
      capabilitiesQuery.data,
      capabilitiesQuery.isError,
      capabilitiesQuery.isLoading,
      record?.state,
      revokeAssignmentMutation.isPending,
      revokeAssignmentMutation.variables,
      t,
    ],
  );

  const matrix = permissionMatrixQuery.data;
  const recommendedScopeGrants = record?.templateCode
    ? roleTemplatesQuery.data?.find((template) => template.code === record.templateCode)
        ?.recommendedScopeGrants
    : undefined;

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.state}
            label={t(`role:states.${record.state}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.state === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('role:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('role:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'code',
                  label: t('role:fields.code'),
                  value: <ReferenceChip label={record.code} />,
                },
                {
                  key: 'name',
                  label: t('role:fields.name'),
                  value: record.name,
                },
                {
                  key: 'state',
                  label: t('role:fields.state'),
                  value: t(`role:states.${record.state}`),
                },
                {
                  key: 'description',
                  label: t('role:fields.description'),
                  value: record.description ?? '-',
                },
                {
                  key: 'delegationBand',
                  label: t('role:fields.delegationBand'),
                  value: t(`role:delegationBands.${record.delegationBand}`),
                },
                {
                  key: 'maxDelegatableBand',
                  label: t('role:fields.maxDelegatableBand'),
                  value: t(`role:maxDelegatableBands.${record.maxDelegatableBand}`),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <div className="space-y-4">
            <MetadataSection title={t('role:detail.policyTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'templateCode',
                    label: t('role:templates.basedOnTemplate'),
                    value: record.templateCode
                      ? readTemplateDisplay(record.templateCode)
                      : t('role:templates.custom'),
                    description: t('role:templates.permissionsRemainExplicit'),
                  },
                  {
                    key: 'templateVersion',
                    label: t('role:templates.templateVersion'),
                    value: record.templateVersion ?? '-',
                  },
                  {
                    key: 'templateAppliedAt',
                    label: t('role:templates.templateAppliedAt'),
                    value: formatOptionalTimestamp(record.templateAppliedAt),
                  },
                  {
                    key: 'permissions',
                    label: t('role:fields.permissions'),
                    value: readPermissionCodes(record.permissions),
                  },
                  {
                    key: 'assignmentRules',
                    label: t('role:fields.assignmentRules'),
                    value: String(record.assignmentRules.length),
                  },
                  {
                    key: 'createdAt',
                    label: t('role:fields.createdAt'),
                    value:
                      record.createdAt === null || record.createdAt === undefined
                        ? '-'
                        : formatCreatedDate(record.createdAt),
                  },
                  {
                    key: 'updatedAt',
                    label: t('role:fields.updatedAt'),
                    value: formatBusinessTimestamp(record.updatedAt),
                  },
                  {
                    key: 'activatedAt',
                    label: t('role:fields.activatedAt'),
                    value: formatOptionalTimestamp(record.activatedAt),
                  },
                  {
                    key: 'archivedAt',
                    label: t('role:fields.archivedAt'),
                    value: formatOptionalTimestamp(record.archivedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('role:detail.permissionMatrixTitle')}>
              {permissionMatrixQuery.isPending ? (
                <LoadingState lines={3} />
              ) : matrix ? (
                <ReadOnlyFieldGrid
                  fields={[
                    {
                      key: 'matrix-role-id',
                      label: t('role:fields.roleId'),
                      value: matrix.roleId,
                    },
                    {
                      key: 'matrix-role-code',
                      label: t('role:fields.code'),
                      value: matrix.roleCode,
                    },
                    {
                      key: 'matrix-state',
                      label: t('role:fields.state'),
                      value: t(`role:states.${matrix.roleState}`),
                    },
                    {
                      key: 'matrix-permissions',
                      label: t('role:fields.permissions'),
                      value: readPermissionCodes(matrix.permissions),
                    },
                  ]}
                  columns={2}
                />
              ) : (
                <p className="text-sm text-muted">
                  {t('role:statesView.permissionMatrixUnavailable')}
                </p>
              )}
            </MetadataSection>
          </div>
        ) : undefined
      }
      sections={
        record ? (
          <div className="space-y-4">
            <RoleBoundaryNotice />
            {activeSurface === 'edit' ? (
              <RoleEditSurface
                initialRecord={record}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onUpdateSubmit}
              />
            ) : null}
            {activeSurface === 'permissions' ? (
              <RolePermissionsSurface
                initialPermissions={record.permissions.map((permission) => permission.code)}
                isPending={permissionsMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onPermissionsSubmit}
              />
            ) : null}
            {activeSurface === 'assignment-rules' ? (
              <RoleAssignmentRulesSurface
                initialRules={record.assignmentRules}
                isPending={assignmentRulesMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onAssignmentRulesSubmit}
              />
            ) : null}
            {activeSurface === 'assign-to-user' ? (
              <RoleAssignUserSurface
                isPending={assignToUserMutation.isPending}
                recommendedScopeGrants={recommendedScopeGrants}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onAssignToUserSubmit}
              />
            ) : null}
            {activeSurface === 'deactivate' ? (
              <RoleLifecycleReasonSurface
                action="deactivate"
                isPending={lifecycleMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={(payload) => onLifecycleReasonSubmit('deactivate', payload)}
              />
            ) : null}
            {activeSurface === 'archive' ? (
              <RoleLifecycleReasonSurface
                action="archive"
                isPending={lifecycleMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={(payload) => onLifecycleReasonSubmit('archive', payload)}
              />
            ) : null}
            {activeSurface === 'revoke-assignment' && selectedAssignment ? (
              <RoleRevokeAssignmentSurface
                assignmentId={selectedAssignment.assignmentId}
                isPending={revokeAssignmentMutation.isPending}
                onCancel={() => {
                  setSelectedAssignment(null);
                  setActiveSurface(null);
                }}
                onSubmit={onRevokeAssignmentSubmit}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <RelatedSectionShell title={t('role:assignments.title')}>
            <div className="space-y-3">
              <label className="flex max-w-[220px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('role:assignments.state')}
                </span>
                <select
                  value={query.state ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      state: (event.target.value || undefined) as RoleAssignmentListQuery['state'],
                    })
                  }
                >
                  <option value="">{t('role:assignments.allStates')}</option>
                  {roleAssignmentStateValues.map((state) => (
                    <option key={state} value={state}>
                      {t(`role:assignmentStates.${state}`)}
                    </option>
                  ))}
                </select>
              </label>
              <AdminTableShell
                data={assignmentsQuery.data?.data ?? []}
                columns={assignmentColumns}
                isLoading={assignmentsQuery.isFetching && !assignmentsQuery.data}
                emptyTitle={t('role:assignments.emptyTitle')}
                emptyMessage={t('role:assignments.emptyMessage')}
                caption={t('role:assignments.caption')}
              />
              <div className="flex justify-end">
                <CursorPager
                  canGoBack={canGoBack}
                  canGoNext={canGoNext}
                  onNext={onNextAssignments}
                  onPrevious={onPreviousAssignments}
                />
              </div>
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('role:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('role:statesView.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'role:statesView.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
