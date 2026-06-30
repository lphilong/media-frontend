import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { previewRoleTemplate } from '@modules/role/api/role.api';
import { roleStateValues } from '@modules/role/constants/role.constants';
import { RoleCreateSurface } from '@modules/role/forms/role-mutation-forms';
import {
  useCreateRoleFromTemplateMutation,
  useRoleLifecycleMutation,
  useEffectiveAccess,
  useRoleBundles,
  useRoleList,
  useRoleTemplates,
} from '@modules/role/hooks/use-role';
import { AccessAssignmentTab } from '@modules/role/components/AccessAssignmentTab';
import { createRoleListColumns } from '@modules/role/tables/role-columns';
import type {
  EffectiveAccessRecord,
  RoleTemplateListItem,
  RoleBundleListItem,
  RoleLifecycleAction,
  RoleListQuery,
} from '@modules/role/types/role.types';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  AppliedFilterChips,
  type AppliedFilterChipItem,
  AdminTableShell,
  CursorPager,
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  MetadataSection,
  useModalHost,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  ReferenceChip,
  StatusBadge,
  SearchBoxSeam,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { AsyncReferencePicker } from '@shared/components/reference';
import { loadUserReferenceOptions } from '@shared/components/reference/admin-reference-options';
import { ModuleListScreenShell } from '@shared/modules';
import {
  createCursorStack,
  moveNextCursor,
  movePreviousCursor,
  roleFlatListQueryConfig,
  serializeScreenQueryParams,
  useRouteQueryState,
} from '@shared/query';

type RoleScreenTab = 'templates' | 'bundles' | 'assignments' | 'user-access';

const roleScreenTabs: Array<{ id: RoleScreenTab; labelKey: string }> = [
  { id: 'templates', labelKey: 'role:tabs.templates' },
  { id: 'bundles', labelKey: 'role:tabs.bundles' },
  { id: 'assignments', labelKey: 'role:tabs.assignments' },
  { id: 'user-access', labelKey: 'role:tabs.userAccess' },
];

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

const readLifecycleConfirmKey = (action: RoleLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'role:confirm.activate';
    case 'deactivate':
      return 'role:confirm.deactivate';
    case 'archive':
      return 'role:confirm.archive';
    default:
      return 'role:confirm.archive';
  }
};

export const RoleListPage = (): JSX.Element => {
  const { t } = useTranslation(['role', 'common', 'errors']);
  const navigate = useNavigate();
  const { query, patchQuery } = useRouteQueryState(roleFlatListQueryConfig);
  const [activeTab, setActiveTab] = useState<RoleScreenTab>('templates');
  const [effectiveAccessUserId, setEffectiveAccessUserId] = useState<string | undefined>();
  const listQueryResult = useRoleList(query);
  const roleTemplatesQuery = useRoleTemplates();
  const roleBundlesQuery = useRoleBundles();
  const effectiveAccessQuery = useEffectiveAccess(effectiveAccessUserId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const createFromTemplateMutation = useCreateRoleFromTemplateMutation();
  const lifecycleMutation = useRoleLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const modalHost = useModalHost();

  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(
    () =>
      serializeScreenQueryParams(
        {
          ...query,
          cursor: undefined,
        },
        roleFlatListQueryConfig,
      ).toString(),
    [query],
  );
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const canCreateRole = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.ROLE_CREATE,
  });
  const canShowLifecycleAction = useCallback(
    (action: RoleLifecycleAction) => {
      const permission =
        action === 'activate'
          ? PERMISSIONS.ROLE_ACTIVATE
          : action === 'deactivate'
            ? PERMISSIONS.ROLE_DEACTIVATE
            : PERMISSIONS.ROLE_ARCHIVE;
      return canShowAction(capabilitiesQuery.data, { permission });
    },
    [capabilitiesQuery.data],
  );

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(query.cursor);

  const onNext = (): void => {
    if (!nextCursor) {
      return;
    }

    setCursorStack((current) => moveNextCursor(current, nextCursor));
    patchQuery({ cursor: nextCursor }, { resetCursorOnChange: false });
  };

  const onPrevious = (): void => {
    setCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      patchQuery({ cursor: nextStack.current ?? undefined }, { resetCursorOnChange: false });

      return nextStack;
    });
  };

  const onCreateFromTemplateSubmit = useCallback(
    async (payload: Parameters<typeof createFromTemplateMutation.mutateAsync>[0]) => {
      try {
        await createFromTemplateMutation.mutateAsync(payload);
        notifySuccess('role:feedback.created');
        modalHost.close();
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [createFromTemplateMutation, modalHost, notifyError, notifySuccess],
  );

  const openCreateDrawer = useCallback(() => {
    modalHost.openDrawer({
      title: t('role:mutations.create.title'),
      content: (
        <RoleCreateSurface
          isPending={createFromTemplateMutation.isPending}
          onCancel={modalHost.close}
          onTemplateSubmit={onCreateFromTemplateSubmit}
          onPreviewTemplate={previewRoleTemplate}
          templateCatalog={roleTemplatesQuery.data ?? []}
          isTemplateCatalogLoading={roleTemplatesQuery.isLoading}
        />
      ),
    });
  }, [
    createFromTemplateMutation.isPending,
    modalHost,
    onCreateFromTemplateSubmit,
    roleTemplatesQuery.data,
    roleTemplatesQuery.isLoading,
    t,
  ]);

  const pageActions =
    activeTab === 'templates' && canCreateRole ? (
      <button
        type="button"
        onClick={openCreateDrawer}
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {t('role:actions.create')}
      </button>
    ) : null;

  usePageActions(pageActions);

  const onLifecycleAction = useCallback(
    async (roleId: string, action: RoleLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          roleId,
          action,
          payload: action === 'activate' ? undefined : { reason: null },
        });
        notifySuccess('role:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createRoleListColumns(t, {
        onOpenDetail: (roleId) => navigate(APP_PATHS.roleDetail(roleId)),
        onLifecycleAction,
        canShowLifecycleAction,
        isActionPending: (roleId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.roleId === roleId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      canShowLifecycleAction,
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      t,
    ],
  );

  const listError = listQueryResult.error as NormalizedApiError | null;
  const shellState = useMemo(() => {
    if (activeTab !== 'templates') {
      return 'ready' as const;
    }

    if (listQueryResult.isPending) {
      return 'loading' as const;
    }

    if (listQueryResult.isError) {
      if (listError?.permissionDenied) {
        return 'denied' as const;
      }

      return 'error' as const;
    }

    return 'ready' as const;
  }, [activeTab, listError?.permissionDenied, listQueryResult.isError, listQueryResult.isPending]);

  const clearRoleFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      state: undefined,
    });
  }, [patchQuery]);

  const appliedFilterChips = useMemo<AppliedFilterChipItem[]>(() => {
    const items: AppliedFilterChipItem[] = [];

    if (query.search) {
      items.push({
        id: 'search',
        label: t('common:labels.search'),
        value: query.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    if (query.state) {
      items.push({
        id: 'state',
        label: t('role:filters.state'),
        value: t(`role:states.${query.state}`),
        onClear: () => patchQuery({ state: undefined }),
      });
    }

    return items;
  }, [patchQuery, query.search, query.state, t]);

  return (
    <ModuleListScreenShell
      banner={
        <RoleScreenTabs
          tabs={roleScreenTabs.map((tab) => ({
            ...tab,
            label: t(tab.labelKey),
          }))}
          activeTab={activeTab}
          onChange={(nextTab) => {
            setActiveTab(nextTab);
            modalHost.close();
          }}
        />
      }
      filterBar={
        activeTab === 'templates' ? (
          <FilterToolbar
            searchSlot={
              <SearchBoxSeam
                value={query.search ?? ''}
                placeholder={t('role:filters.searchPlaceholder')}
                onApply={(value) => patchQuery({ search: value || undefined })}
              />
            }
            appliedFilters={
              <AppliedFilterChips
                title={t('common:filters.appliedFilters')}
                items={appliedFilterChips}
                clearFilterLabel={t('common:filters.clearFilter')}
                clearAllLabel={t('common:filters.clearAll')}
                onClearAll={appliedFilterChips.length > 0 ? clearRoleFilters : undefined}
              />
            }
          >
            <label className="flex min-w-[180px] flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('role:filters.state')}
              </span>
              <select
                value={query.state ?? ''}
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                onChange={(event) =>
                  patchQuery({
                    state: (event.target.value || undefined) as RoleListQuery['state'],
                  })
                }
              >
                <option value="">{t('role:filters.allStates')}</option>
                {roleStateValues.map((state) => (
                  <option key={state} value={state}>
                    {t(`role:states.${state}`)}
                  </option>
                ))}
              </select>
            </label>
          </FilterToolbar>
        ) : null
      }
      interactionSection={null}
      tableSection={
        activeTab === 'templates' ? (
          <div className="space-y-4">
            <RoleTemplateCatalogPanel
              templates={roleTemplatesQuery.data ?? []}
              isLoading={roleTemplatesQuery.isLoading}
              error={roleTemplatesQuery.error as NormalizedApiError | null}
              onRetry={() => void roleTemplatesQuery.refetch()}
            />
            <AdminTableShell
              data={listQueryResult.data?.data ?? []}
              columns={columns}
              isLoading={listQueryResult.isFetching && !listQueryResult.data}
              emptyTitle={t('role:statesView.emptyTitle')}
              emptyMessage={t('role:statesView.emptyMessage')}
              caption={t('role:table.caption')}
            />
          </div>
        ) : activeTab === 'bundles' ? (
          <RoleBundleTab
            bundles={roleBundlesQuery.data ?? []}
            isLoading={roleBundlesQuery.isLoading}
            error={roleBundlesQuery.error as NormalizedApiError | null}
            onRetry={() => void roleBundlesQuery.refetch()}
          />
        ) : activeTab === 'assignments' ? (
          <AccessAssignmentTab />
        ) : (
          <RoleUserAccessTab
            userId={effectiveAccessUserId}
            onUserChange={setEffectiveAccessUserId}
            access={effectiveAccessQuery.data}
            isLoading={effectiveAccessQuery.isLoading}
            error={effectiveAccessQuery.error as NormalizedApiError | null}
            onRetry={() => void effectiveAccessQuery.refetch()}
          />
        )
      }
      pager={
        activeTab === 'templates' ? (
          <CursorPager
            canGoBack={canGoBack}
            canGoNext={canGoNext}
            displayedCount={listQueryResult.data?.data.length}
            limit={query.limit ?? 20}
            onNext={onNext}
            onPrevious={onPrevious}
          />
        ) : null
      }
      state={shellState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      errorState={
        <ErrorState
          title={t('role:statesView.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'role:statesView.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};

type RoleScreenTabsProps = {
  tabs: Array<{ id: RoleScreenTab; label: string }>;
  activeTab: RoleScreenTab;
  onChange: (tab: RoleScreenTab) => void;
};

const RoleScreenTabs = ({ tabs, activeTab, onChange }: RoleScreenTabsProps): JSX.Element => (
  <div className="rounded border border-border bg-panel p-1" role="tablist">
    <div className="grid gap-1 md:grid-cols-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          onClick={() => onChange(tab.id)}
          className={`rounded px-3 py-2 text-sm font-medium ${
            tab.id === activeTab ? 'bg-accent text-white' : 'text-muted hover:bg-bg hover:text-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);

const RoleTemplateCatalogPanel = ({
  templates,
  isLoading,
  error,
  onRetry,
}: {
  templates: RoleTemplateListItem[];
  isLoading: boolean;
  error: NormalizedApiError | null;
  onRetry: () => void;
}): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);

  if (isLoading) {
    return <LoadingState lines={4} />;
  }

  if (error) {
    return (
      <ErrorState
        title={t('role:templateCatalog.loadErrorTitle')}
        message={readErrorMessage(t, error, 'role:templateCatalog.loadErrorMessage')}
        actionLabel={t('common:actions.retry')}
        onRetry={onRetry}
      />
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        variant="inline"
        title={t('role:templateCatalog.emptyTitle')}
        message={t('role:templateCatalog.emptyMessage')}
      />
    );
  }

  const columns: Array<ColumnDef<RoleTemplateListItem>> = [
    {
      accessorKey: 'code',
      header: t('role:fields.name'),
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-text">{formatRoleCodeLabel(row.original.code)}</p>
          <p className="text-xs text-muted">{formatRoleCategoryLabel(row.original.category)}</p>
        </div>
      ),
    },
    {
      accessorKey: 'recommendedAccountContext',
      header: t('role:templateCatalog.requiredContext'),
      cell: ({ row }) => formatAccountContextLabel(row.original.recommendedAccountContext),
    },
    {
      accessorKey: 'permissionCount',
      header: t('role:templateCatalog.capabilitySummary'),
      cell: ({ row }) =>
        t('role:templateCatalog.capabilityCount', {
          count: row.original.permissionCount,
        }),
    },
    {
      accessorKey: 'status',
      header: t('role:bundles.status'),
      cell: ({ row }) => <StatusBadge status={row.original.status} family="readiness" />,
    },
    {
      id: 'warning',
      header: t('role:templates.warnings'),
      cell: ({ row }) =>
        row.original.warnings.length > 0 ? (
          <StatusBadge label={t('role:templateCatalog.sensitiveWarning')} tone="warning" />
        ) : (
          '-'
        ),
    },
  ];

  return (
    <MetadataSection
      title={t('role:templateCatalog.title')}
      subtitle={t('role:templateCatalog.subtitle')}
    >
      <AdminTableShell
        data={templates}
        columns={columns}
        emptyTitle={t('role:templateCatalog.emptyTitle')}
        emptyMessage={t('role:templateCatalog.emptyMessage')}
        caption={t('role:templateCatalog.title')}
      />
    </MetadataSection>
  );
};

const RoleBundleTab = ({
  bundles,
  isLoading,
  error,
  onRetry,
}: {
  bundles: RoleBundleListItem[];
  isLoading: boolean;
  error: NormalizedApiError | null;
  onRetry: () => void;
}): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);

  if (isLoading) {
    return <LoadingState lines={5} />;
  }

  if (error) {
    return (
      <ErrorState
        title={t('role:bundles.loadErrorTitle')}
        message={readErrorMessage(t, error, 'role:bundles.loadErrorMessage')}
        actionLabel={t('common:actions.retry')}
        onRetry={onRetry}
      />
    );
  }

  if (bundles.length === 0) {
    return (
      <EmptyState title={t('role:bundles.emptyTitle')} message={t('role:bundles.emptyMessage')} />
    );
  }

  const columns: Array<ColumnDef<RoleBundleListItem>> = [
    {
      accessorKey: 'code',
      header: t('role:fields.name'),
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-text">{formatBundleCodeLabel(row.original.code)}</p>
          <p className="text-xs text-muted">
            {formatBundlePurpose(row.original.code, row.original.businessPurpose)}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: t('role:bundles.status'),
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          tone={row.original.status === 'ACTIVE' ? 'success' : 'muted'}
        />
      ),
    },
    {
      accessorKey: 'recommendedAccountContext',
      header: t('role:bundles.recommendedContext'),
      cell: ({ row }) => formatAccountContextLabel(row.original.recommendedAccountContext),
    },
    {
      accessorKey: 'childRoles',
      header: t('role:bundles.childRoles'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.childRoles.map((roleCode) => (
            <ReferenceChip key={roleCode} label={formatRoleCodeLabel(roleCode)} />
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'recommendedScopes',
      header: t('role:bundles.recommendedScope'),
      cell: ({ row }) =>
        t('role:bundles.scopeCount', {
          count: row.original.recommendedScopes.length,
        }),
    },
    {
      id: 'support',
      header: t('role:bundles.supportMode'),
      cell: ({ row }) =>
        row.original.sensitive || row.original.sensitiveWarning ? (
          <StatusBadge label={t('role:bundles.sensitiveWarning')} tone="warning" />
        ) : (
          t('role:bundles.readOnlySupport')
        ),
    },
  ];

  return (
    <AdminTableShell
      data={bundles}
      columns={columns}
      emptyTitle={t('role:bundles.emptyTitle')}
      emptyMessage={t('role:bundles.emptyMessage')}
      caption={t('role:tabs.bundles')}
    />
  );
};

const RoleUserAccessTab = ({
  userId,
  onUserChange,
  access,
  isLoading,
  error,
  onRetry,
}: {
  userId?: string;
  onUserChange: (userId?: string) => void;
  access?: EffectiveAccessRecord;
  isLoading: boolean;
  error: NormalizedApiError | null;
  onRetry: () => void;
}): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const loadSearchFirstUserOptions = useCallback(
    (search: string): ReturnType<typeof loadUserReferenceOptions> => {
      if (search.trim().length < 2) {
        return Promise.resolve([]);
      }

      return loadUserReferenceOptions(search);
    },
    [],
  );

  return (
    <div className="space-y-4">
      <MetadataSection
        title={t('role:userAccess.selectorTitle')}
        subtitle={t('role:userAccess.selectorSubtitle')}
      >
        <AsyncReferencePicker
          pickerId="role-effective-access-user"
          value={userId}
          onChange={onUserChange}
          loadOptions={loadSearchFirstUserOptions}
          placeholder={t('role:placeholders.userSearch')}
          resourceLabel={t('role:userAccess.userResource')}
          emptySlot={<p className="text-xs text-muted">{t('role:userAccess.noUserResults')}</p>}
        />
      </MetadataSection>

      {!userId ? (
        <EmptyState
          variant="inline"
          title={t('role:userAccess.emptyTitle')}
          message={t('role:userAccess.emptyMessage')}
        />
      ) : isLoading ? (
        <LoadingState lines={5} />
      ) : error ? (
        <ErrorState
          title={t('role:userAccess.loadErrorTitle')}
          message={readErrorMessage(t, error, 'role:userAccess.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={onRetry}
        />
      ) : access ? (
        <RoleEffectiveAccessSummary access={access} />
      ) : null}
    </div>
  );
};

const RoleEffectiveAccessSummary = ({ access }: { access: EffectiveAccessRecord }): JSX.Element => {
  const { t } = useTranslation('role');
  const availableWorkspaces = access.workspaceAvailability.availableWorkspaces
    .filter((workspace) => workspace.available)
    .map((workspace) => workspace.context);

  return (
    <div className="space-y-4">
      <MetadataSection title={t('userAccess.summaryTitle')}>
        <ReadOnlyFieldGrid
          columns={3}
          fields={[
            {
              key: 'user',
              label: t('userAccess.user'),
              value: access.user.displayName ?? access.user.email ?? access.user.id,
            },
            {
              key: 'accountContexts',
              label: t('userAccess.accountContexts'),
              value: formatAccountContextList(access.accountContextSignals.accountContexts),
            },
            {
              key: 'primaryWorkspace',
              label: t('userAccess.primaryWorkspace'),
              value: access.workspaceAvailability.primaryWorkspace
                ? formatAccountContextLabel(access.workspaceAvailability.primaryWorkspace)
                : t('userAccess.noPrimaryWorkspace'),
            },
            {
              key: 'eligibleWorkspaces',
              label: t('userAccess.eligibleWorkspaces'),
              value: formatAccountContextList(availableWorkspaces),
            },
            {
              key: 'ownData',
              label: t('userAccess.ownData'),
              value: access.workspaceAvailability.ownDataAvailable
                ? t('userAccess.available')
                : t('userAccess.unavailable'),
            },
            {
              key: 'managerData',
              label: t('userAccess.managerResponsibilities'),
              value: access.workspaceAvailability.managerResponsibilitiesAvailable
                ? t('userAccess.available')
                : t('userAccess.unavailable'),
            },
          ]}
        />
      </MetadataSection>

      <MetadataSection title={t('userAccess.rolesTitle')}>
        {access.activeRoleAssignments.length > 0 ? (
          <div className="space-y-2">
            {access.activeRoleAssignments.map((assignment) => (
              <div
                key={assignment.assignmentId}
                className="rounded border border-border bg-bg px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-text">
                    {assignment.roleCode
                      ? formatRoleCodeLabel(assignment.roleCode)
                      : (assignment.roleName ?? '-')}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge label={formatAssignmentOrigin(assignment.origin)} tone="info" />
                    {assignment.sensitiveOrGlobal ? (
                      <StatusBadge label={t('userAccess.sensitive')} tone="warning" />
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {t('userAccess.scopeCount', {
                    count: assignment.structuredScopeGrants.length,
                  })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            variant="inline"
            title={t('userAccess.noAssignmentsTitle')}
            message={t('userAccess.noAssignmentsMessage')}
          />
        )}
      </MetadataSection>

      <MetadataSection title={t('userAccess.capabilitiesTitle')}>
        <ReadOnlyFieldGrid
          columns={2}
          fields={[
            {
              key: 'groups',
              label: t('userAccess.businessCapabilityGroups'),
              value: formatCapabilityGroupSummary(access.permissions),
            },
            {
              key: 'trace',
              label: t('userAccess.sourceTrace'),
              value: access.workspaceAvailability.effectiveAccessTraceAvailable
                ? t('userAccess.available')
                : t('userAccess.unavailable'),
            },
          ]}
        />
      </MetadataSection>
    </div>
  );
};

const roleCodeLabels: Record<string, string> = {
  OWNER_ADMIN: 'Quản trị chủ sở hữu',
  ACCESS_ADMIN: 'Quản trị phân quyền',
  HR_OPERATIONS: 'Vận hành nhân sự',
  HR_TERMS_APPROVER: 'Duyệt điều khoản nhân sự',
  PRODUCTION_OPS: 'Vận hành sản xuất',
  PLATFORM_CHANNEL_OPS: 'Vận hành kênh nền tảng',
  CREATIVE_VISUAL_LEAD: 'Phụ trách hình ảnh sáng tạo',
  CONTENT_OPS: 'Vận hành nội dung',
  TALENT_GROUP_MANAGER: 'Quản lý nhóm Talent',
  ORG_UNIT_MANAGER: 'Quản lý phòng ban',
  KPI_OPERATIONS: 'Vận hành KPI',
  COMMERCIAL_CONTRACT_OPS: 'Vận hành hợp đồng thương mại',
  REVENUE_FINANCE_OPS: 'Vận hành tài chính doanh thu',
  REVENUE_APPROVER: 'Duyệt doanh thu',
  REVENUE_RECONCILER: 'Đối soát doanh thu',
  COMMISSION_OPS: 'Vận hành hoa hồng',
  COMMISSION_APPROVER: 'Duyệt hoa hồng',
  ATTENDANCE_OPS: 'Vận hành chấm công',
  LEAVE_REVIEWER: 'Rà soát nghỉ phép',
  ATTENDANCE_APPROVER: 'Duyệt chấm công',
  MONTHLY_CLOSE_OWNER: 'Phụ trách khóa sổ tháng',
  PAYROLL_DRAFT_OPS: 'Vận hành nháp lương',
  PAYROLL_DRAFT_APPROVER: 'Duyệt nháp lương',
  VIEWER_AUDITOR: 'Audit / Chỉ đọc',
  STAFF_CONSOLE_USER: 'Nhân sự tự xem dữ liệu',
  ADMIN_FULL: 'Vai trò cũ: quản trị toàn hệ thống',
  TEAM_MANAGER: 'Vai trò cũ: quản lý nhóm',
  COMMERCIAL_FINANCE: 'Vai trò cũ: tài chính thương mại',
  TALENT_STAFF_SELF: 'Vai trò cũ: nhân sự tự phục vụ',
};

const capabilityGroupLabels: Record<string, string> = {
  role: 'Vai trò',
  user: 'Tài khoản đăng nhập',
  workSchedule: 'Lịch làm việc',
  eventAssignment: 'Sự kiện',
  kpi: 'KPI',
  dashboardLite: 'Bảng điều hành',
  contractRegistry: 'Hợp đồng',
  talentKpi: 'Talent KPI',
  revenueLedger: 'Doanh thu',
  commission: 'Hoa hồng',
};

const roleCategoryLabels: Record<string, string> = {
  ADMINISTRATION: 'Quản trị hệ thống',
  ACCESS: 'Phân quyền',
  PEOPLE_OPERATIONS: 'Vận hành nhân sự',
  HR: 'Nhân sự',
  MANAGEMENT: 'Quản lý theo phạm vi',
  PRODUCTION: 'Sản xuất',
  FINANCE: 'Tài chính',
  COMMERCIAL: 'Thương mại',
  KPI: 'KPI',
  AUDIT: 'Audit / Chỉ đọc',
};

const bundleCodeLabels: Record<string, string> = {
  OWNER_ADMIN_BUNDLE: 'Quản trị chủ sở hữu',
  ACCESS_ADMIN_BUNDLE: 'Quản trị phân quyền',
  TALENT_GROUP_MANAGER_BUNDLE: 'Quản lý nhóm Talent',
  ORG_UNIT_MANAGER_BUNDLE: 'Quản lý phòng ban',
  HR_MANAGER_BUNDLE: 'Quản lý HR',
  HR_STAFF_BUNDLE: 'Vận hành HR',
  FINANCE_STAFF_BUNDLE: 'Vận hành tài chính',
  FINANCE_APPROVER_BUNDLE: 'Duyệt doanh thu',
  STAFF_CONSOLE_BUNDLE: 'Nhân sự tự xem dữ liệu',
  AUDITOR_BUNDLE: 'Audit / Chỉ đọc',
};

const bundlePurposeLabels: Record<string, string> = {
  OWNER_ADMIN_BUNDLE: 'Dành cho chủ sở hữu hoặc người được giao quản trị toàn hệ thống.',
  ACCESS_ADMIN_BUNDLE: 'Dành cho người phụ trách tài khoản, vai trò và rà soát quyền.',
  TALENT_GROUP_MANAGER_BUNDLE: 'Dành cho nhân sự quản lý một hoặc nhiều nhóm Talent được chỉ định.',
  ORG_UNIT_MANAGER_BUNDLE: 'Dành cho nhân sự quản lý phòng ban hoặc đơn vị được chỉ định.',
  HR_MANAGER_BUNDLE: 'Dành cho người quản lý nghiệp vụ HR.',
  HR_STAFF_BUNDLE: 'Dành cho nhân sự vận hành hồ sơ và quy trình HR.',
  FINANCE_STAFF_BUNDLE: 'Dành cho nhân sự vận hành dữ liệu tài chính hiện tại.',
  FINANCE_APPROVER_BUNDLE: 'Dành cho người được giao duyệt doanh thu.',
  STAFF_CONSOLE_BUNDLE: 'Dành cho nhân sự tự xem dữ liệu của chính mình.',
  AUDITOR_BUNDLE: 'Dành cho người rà soát chỉ đọc và theo dõi lịch sử thay đổi.',
};

const formatRoleCategoryLabel = (category: string): string =>
  roleCategoryLabels[category] ?? category;

const formatRoleCodeLabel = (roleCode: string): string => roleCodeLabels[roleCode] ?? roleCode;

const formatBundleCodeLabel = (bundleCode: string): string =>
  bundleCodeLabels[bundleCode] ?? bundleCode;

const formatBundlePurpose = (bundleCode: string, fallback: string): string =>
  bundlePurposeLabels[bundleCode] ?? fallback;

const formatAssignmentOrigin = (
  origin: EffectiveAccessRecord['activeRoleAssignments'][number]['origin'],
): string => {
  if (origin === 'BUNDLE') {
    return 'Gói vai trò';
  }

  if (origin === 'LEGACY') {
    return 'Dữ liệu cũ để rà soát';
  }

  return 'Gán trực tiếp';
};

const formatAccountContextLabel = (context: string): string => {
  switch (context) {
    case 'ADMIN_CONSOLE':
      return 'Không gian quản trị';
    case 'MANAGER_CONSOLE':
      return 'Không gian quản lý';
    case 'STAFF_CONSOLE':
      return 'Không gian nhân sự';
    default:
      return context;
  }
};

const formatAccountContextList = (contexts: string[]): string =>
  contexts.length > 0 ? contexts.map(formatAccountContextLabel).join(', ') : '-';

const formatCapabilityGroupSummary = (permissions: string[]): string => {
  if (permissions.length === 0) {
    return '-';
  }

  const counts = permissions.reduce<Record<string, number>>((accumulator, permission) => {
    const group = permission.split(/[.:]/u)[0] || 'other';
    accumulator[group] = (accumulator[group] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([group, count]) => `${capabilityGroupLabels[group] ?? 'Nhóm nghiệp vụ khác'} (${count})`)
    .join(', ');
};
