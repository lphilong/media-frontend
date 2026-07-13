import { useCallback, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { usePageActions } from '@app/store/use-page-actions';
import { previewRoleTemplate } from '@modules/role/api/role.api';
import {
  AccessRiskBadges,
  ReviewDueBadge,
  formatRiskDate,
} from '@modules/role/components/AccessRiskIndicators';
import { RoleCreateSurface } from '@modules/role/forms/role-mutation-forms';
import {
  useCreateRoleFromTemplateMutation,
  useEffectiveAccess,
  useRoleBundles,
  useRoleTemplates,
} from '@modules/role/hooks/use-role';
import { AccessAssignmentTab } from '@modules/role/components/AccessAssignmentTab';
import type {
  CatalogOperatorFlowGroup,
  EffectiveAccessRecord,
  RoleTemplateListItem,
  RoleBundleListItem,
} from '@modules/role/types/role.types';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';
import {
  AdminTableShell,
  EmptyState,
  ErrorState,
  LoadingState,
  MetadataSection,
  useModalHost,
  ReadOnlyFieldGrid,
  ReferenceChip,
  StatusBadge,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  AsyncReferencePicker,
  type ReferenceOption,
  useReferenceRegistry,
} from '@shared/components/reference';
import { ModuleListScreenShell } from '@shared/modules';

type RoleScreenTab = 'templates' | 'bundles' | 'assignments' | 'user-access';

type RoleReferenceLoaders = {
  loadUserReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
};

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

  if (containsRawTechnicalToken(error.message)) {
    return t(fallbackKey);
  }

  if (error.message.includes(':')) {
    return t(error.message);
  }

  return error.message;
};

const containsRawTechnicalToken = (message: string): boolean =>
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu.test(message) ||
  /\b(objectId|uuid|_id|assignmentId|bundleAssignmentId|scopeFingerprint)\b/iu.test(message) ||
  /\bnot found:\s*\S+/iu.test(message);

export const RoleListPage = (): JSX.Element => {
  const { t } = useTranslation(['role', 'common', 'errors']);
  const [activeTab, setActiveTab] = useState<RoleScreenTab>('templates');
  const [effectiveAccessUserId, setEffectiveAccessUserId] = useState<string | undefined>();
  const roleTemplatesQuery = useRoleTemplates();
  const roleBundlesQuery = useRoleBundles();
  const effectiveAccessQuery = useEffectiveAccess(effectiveAccessUserId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const createFromTemplateMutation = useCreateRoleFromTemplateMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const modalHost = useModalHost();

  const canCreateRole = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.ROLE_CREATE,
  });

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
      filterBar={null}
      interactionSection={null}
      tableSection={
        activeTab === 'templates' ? (
          <RoleTemplateCatalogPanel
            templates={roleTemplatesQuery.data ?? []}
            isLoading={roleTemplatesQuery.isLoading}
            error={roleTemplatesQuery.error as NormalizedApiError | null}
            onRetry={() => void roleTemplatesQuery.refetch()}
          />
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
      pager={null}
      state="ready"
      loadingState={<LoadingState lines={8} />}
      deniedState={null}
      errorState={null}
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
        row.original.warnings.length > 0 ||
        row.original.isSensitive ||
        row.original.isGlobalLike ||
        row.original.isHighRisk ||
        row.original.requiresReview ? (
          <div className="flex flex-wrap gap-1">
            <AccessRiskBadges risk={row.original} />
            {row.original.warnings.length > 0 ? (
              <StatusBadge label={t('role:templateCatalog.sensitiveWarning')} tone="warning" />
            ) : null}
          </div>
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
      <div className="space-y-4">
        {groupCatalogItems(templates).map(({ group, items }) => (
          <div key={group} className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-text">{t(`role:catalogGroups.${group}`)}</p>
              <p className="text-xs text-muted">{t(`role:catalogGroupHelp.${group}`)}</p>
            </div>
            <AdminTableShell
              data={items}
              columns={columns}
              emptyTitle={t('role:templateCatalog.emptyTitle')}
              emptyMessage={t('role:templateCatalog.emptyMessage')}
              caption={`${t('role:templateCatalog.title')} - ${t(`role:catalogGroups.${group}`)}`}
            />
          </div>
        ))}
      </div>
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

  return (
    <div className="space-y-4">
      {groupCatalogItems(bundles).map(({ group, items }) => (
        <MetadataSection
          key={group}
          title={t(`role:catalogGroups.${group}`)}
          subtitle={t(`role:catalogGroupHelp.${group}`)}
        >
          <div className="grid gap-3 xl:grid-cols-2">
            {items.map((bundle) => (
              <article key={bundle.code} className="rounded border border-border bg-bg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">
                      {formatBundleCodeLabel(bundle.code)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatBundlePurpose(bundle.code, bundle.businessPurpose)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge label="Gói đề xuất" tone="info" uppercase={false} />
                    <StatusBadge
                      label={formatCatalogStatusLabel(bundle.assignabilityStatus)}
                      tone={
                        bundle.assignabilityStatus === 'RESTRICTED_SENSITIVE'
                          ? 'warning'
                          : 'success'
                      }
                      uppercase={false}
                    />
                  </div>
                </div>
                <ReadOnlyFieldGrid
                  columns={2}
                  fields={[
                    {
                      key: 'who',
                      label: 'Dành cho',
                      value: formatBundleAudience(bundle.code),
                    },
                    {
                      key: 'scope',
                      label: t('role:bundles.recommendedScope'),
                      value: formatScopeTypeList(bundle.recommendedScopes),
                    },
                    {
                      key: 'included',
                      label: t('role:bundles.childRoles'),
                      value: bundle.childRoles.map(formatRoleCodeLabel).join(', '),
                    },
                    {
                      key: 'review',
                      label: 'Kiểm soát',
                      value:
                        bundle.reviewPolicy === 'REVIEW_REQUIRED' || bundle.sensitive
                          ? 'Cần lý do và rà soát theo chính sách'
                          : 'Theo quy trình gán quyền thông thường',
                    },
                  ]}
                />
                <p className="mt-3 text-xs text-muted">
                  Khuyến nghị dùng gói này trước khi chọn mẫu vai trò thủ công.
                </p>
              </article>
            ))}
          </div>
        </MetadataSection>
      ))}
    </div>
  );

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
          <div className="flex flex-wrap gap-1">
            <StatusBadge label={t('role:bundles.sensitiveWarning')} tone="warning" />
            <AccessRiskBadges
              risk={{
                ...row.original,
                isSensitive: row.original.isSensitive ?? row.original.sensitive,
                requiresReview: row.original.requiresReview ?? row.original.sensitive,
              }}
            />
          </div>
        ) : (
          <div>
            <p>{t('role:bundles.readOnlySupport')}</p>
            {row.original.code === 'AUDITOR_BUNDLE' ? (
              <p className="mt-1 text-xs text-muted">
                Auditor mặc định chỉ có quyền đọc không nhạy cảm. Dữ liệu lương, phụ cấp hoặc dữ
                liệu nhạy cảm cần quyền riêng.
              </p>
            ) : null}
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {groupCatalogItems(bundles).map(({ group, items }) => (
        <MetadataSection
          key={group}
          title={t(`role:catalogGroups.${group}`)}
          subtitle={t(`role:catalogGroupHelp.${group}`)}
        >
          <AdminTableShell
            data={items}
            columns={columns}
            emptyTitle={t('role:bundles.emptyTitle')}
            emptyMessage={t('role:bundles.emptyMessage')}
            caption={`${t('role:tabs.bundles')} - ${t(`role:catalogGroups.${group}`)}`}
          />
        </MetadataSection>
      ))}
    </div>
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
  const { loadUserReferenceOptions } = useReferenceRegistry<RoleReferenceLoaders>();
  const loadSearchFirstUserOptions = useCallback(
    (search: string): ReturnType<typeof loadUserReferenceOptions> => {
      if (search.trim().length < 2) {
        return Promise.resolve([]);
      }

      return loadUserReferenceOptions(search).then(sanitizeUserAccessReferenceOptions);
    },
    [loadUserReferenceOptions],
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
          showTechnicalMetadata={false}
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
          technicalDetails={error}
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
              value: access.user.displayName ?? access.user.email ?? t('userAccess.userResource'),
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
                    {formatEffectiveRoleAssignmentLabel(assignment)}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge label={formatAssignmentOrigin(assignment.origin)} tone="info" />
                    <AccessRiskBadges risk={assignment} />
                    <ReviewDueBadge risk={assignment} />
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {t('userAccess.scopeCount', {
                    count: assignment.structuredScopeGrants.length,
                  })}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Ngày rà soát: {formatRiskDate(assignment.reviewAt)} · Ngày hết hiệu lực:{' '}
                  {formatRiskDate(assignment.expiresAt)}
                </p>
                <ReadOnlyFieldGrid
                  columns={3}
                  fields={[
                    {
                      key: 'scope',
                      label: t('userAccess.scopeGrants'),
                      value: formatEffectiveScopeSummary(assignment.structuredScopeGrants, t),
                    },
                    {
                      key: 'bundle',
                      label: t('userAccess.bundleOrigin'),
                      value: formatEffectiveBundleOrigin(assignment.bundleOrigin),
                    },
                    {
                      key: 'assignedBy',
                      label: t('userAccess.assignedBy'),
                      value: assignment.assignedBy ? t('userAccess.available') : '-',
                    },
                    {
                      key: 'assignedAt',
                      label: t('userAccess.assignedAt'),
                      value: formatBusinessTimestamp(assignment.assignedAt),
                    },
                    {
                      key: 'reason',
                      label: t('userAccess.reason'),
                      value: assignment.reason ?? '-',
                    },
                    {
                      key: 'permissions',
                      label: t('userAccess.childPermissions'),
                      value: formatCapabilityGroupSummary(assignment.permissions),
                    },
                  ]}
                />
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

      <MetadataSection title={t('userAccess.responsibilityTitle')}>
        {access.businessResponsibilitySupport.claims.length > 0 ? (
          <p className="text-sm text-muted">
            {t('userAccess.responsibilityClaimCount', {
              count: access.businessResponsibilitySupport.claims.length,
            })}
          </p>
        ) : (
          <p className="text-sm text-muted">{access.businessResponsibilitySupport.note}</p>
        )}
      </MetadataSection>

      <details className="rounded border border-border bg-bg p-3">
        <summary className="cursor-pointer text-sm font-semibold text-text">
          {t('userAccess.traceTitle')}
        </summary>
        <ReadOnlyFieldGrid
          columns={2}
          fields={[
            {
              key: 'permissionTrace',
              label: t('userAccess.permissionSourceTrace'),
              value:
                access.permissionSourceTrace.length > 0
                  ? access.permissionSourceTrace.map(formatTraceRecord).join(' | ')
                  : '-',
            },
            {
              key: 'workspaceTrace',
              label: t('userAccess.workspaceSourceTrace'),
              value:
                access.workspaceAvailability.sourceTrace.length > 0
                  ? access.workspaceAvailability.sourceTrace.map(formatTraceRecord).join(' | ')
                  : '-',
            },
            {
              key: 'history',
              label: t('userAccess.historySupport'),
              value: t('userAccess.historyUnavailable'),
            },
            {
              key: 'lifecycle',
              label: t('userAccess.lifecycleActions'),
              value: t('userAccess.lifecycleReadOnlyHere'),
            },
          ]}
        />
      </details>
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
};

const capabilityGroupLabels: Record<string, string> = {
  role: 'Vai trò',
  user: 'Tài khoản đăng nhập',
  workSchedule: 'Lịch làm việc',
  eventAssignment: 'Sự kiện',
  kpi: 'KPI',
  dashboardLite: 'Bảng điều hành',
  contractRegistry: 'Hợp đồng',
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
  PRODUCTION_OPS_BUNDLE: 'Vận hành sản xuất',
  PLATFORM_CHANNEL_OPS_BUNDLE: 'Vận hành kênh nền tảng',
  CREATIVE_VISUAL_LEAD_BUNDLE: 'Phụ trách hình ảnh sáng tạo',
  CONTENT_OPS_BUNDLE: 'Vận hành nội dung',
  TALENT_GROUP_MANAGER_BUNDLE: 'Quản lý nhóm Talent',
  ORG_UNIT_MANAGER_BUNDLE: 'Quản lý phòng ban',
  KPI_OPERATOR_BUNDLE: 'Vận hành KPI',
  COMMERCIAL_STAFF_BUNDLE: 'Vận hành hợp đồng thương mại',
  HR_MANAGER_BUNDLE: 'Quản lý HR',
  HR_STAFF_BUNDLE: 'Vận hành HR',
  FINANCE_STAFF_BUNDLE: 'Vận hành tài chính',
  FINANCE_APPROVER_BUNDLE: 'Duyệt doanh thu',
  COMMISSION_APPROVER_BUNDLE: 'Duyệt hoa hồng',
  ATTENDANCE_OPERATOR_BUNDLE: 'Vận hành chấm công',
  ATTENDANCE_APPROVER_BUNDLE: 'Duyệt chấm công',
  MONTHLY_CLOSE_OWNER_BUNDLE: 'Phụ trách khóa sổ tháng',
  PAYROLL_DRAFT_OPERATOR_BUNDLE: 'Vận hành nháp lương',
  PAYROLL_DRAFT_APPROVER_BUNDLE: 'Duyệt nháp lương',
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
  AUDITOR_BUNDLE:
    'Auditor mặc định chỉ có quyền đọc không nhạy cảm. Dữ liệu lương, phụ cấp hoặc dữ liệu nhạy cảm cần quyền riêng.',
};

const catalogGroupOrder: CatalogOperatorFlowGroup[] = [
  'READY_TO_ASSIGN',
  'REQUIRES_SCOPE_SELECTION',
  'READ_ONLY_AUDIT',
  'RESTRICTED_SENSITIVE',
  'FUTURE_READINESS',
  'SYSTEM_CONTROLLED',
];

const groupCatalogItems = <TItem extends { operatorFlowGroup?: CatalogOperatorFlowGroup }>(
  items: TItem[],
): Array<{ group: CatalogOperatorFlowGroup; items: TItem[] }> => {
  const grouped = items.reduce<Partial<Record<CatalogOperatorFlowGroup, TItem[]>>>(
    (accumulator, item) => {
      const group =
        item.operatorFlowGroup && catalogGroupOrder.includes(item.operatorFlowGroup)
          ? item.operatorFlowGroup
          : 'SYSTEM_CONTROLLED';
      accumulator[group] = [...(accumulator[group] ?? []), item];
      return accumulator;
    },
    {},
  );

  return catalogGroupOrder
    .map((group) => ({ group, items: grouped[group] ?? [] }))
    .filter(({ items }) => items.length > 0);
};

const formatRoleCategoryLabel = (category: string): string =>
  roleCategoryLabels[category] ?? category;

const legacyRoleCodes = new Set([
  'ADMIN_FULL',
  'TEAM_MANAGER',
  'COMMERCIAL_FINANCE',
  'TALENT_STAFF_SELF',
]);

const formatRoleCodeLabel = (roleCode: string): string =>
  legacyRoleCodes.has(roleCode) ? '-' : (roleCodeLabels[roleCode] ?? 'Quyền truy cập cần rà soát');

const hasInternalAccessTerm = (value: string | null | undefined): boolean =>
  /console|account context|workspace/i.test(value ?? '');

const sanitizeInternalAccessLabel = (
  value: string | null | undefined,
  fallback: string,
): string => {
  if (!value) {
    return fallback;
  }

  if (/staff console/i.test(value)) {
    return 'Nhân sự tự xem dữ liệu';
  }

  if (/manager console/i.test(value)) {
    return 'Quyền xem công việc được phân công';
  }

  if (/admin console/i.test(value)) {
    return 'Quyền vận hành nội bộ';
  }

  return hasInternalAccessTerm(value) ? fallback : value;
};

const formatEffectiveRoleAssignmentLabel = (
  assignment: EffectiveAccessRecord['activeRoleAssignments'][number],
): string => {
  if (assignment.roleCode) {
    const codeLabel = formatRoleCodeLabel(assignment.roleCode);
    return hasInternalAccessTerm(codeLabel)
      ? sanitizeInternalAccessLabel(codeLabel, '-')
      : codeLabel;
  }

  return sanitizeInternalAccessLabel(assignment.roleName, '-');
};

const formatBundleCodeLabel = (bundleCode: string): string =>
  bundleCodeLabels[bundleCode] ?? 'Gói quyền cần rà soát';

const formatBundlePurpose = (bundleCode: string, fallback: string): string =>
  bundlePurposeLabels[bundleCode] ?? fallback;

const formatBundleAudience = (bundleCode: string): string => {
  if (/TALENT_GROUP_MANAGER/u.test(bundleCode)) {
    return 'Nhân sự quản lý nhóm Talent được chỉ định';
  }
  if (/ORG_UNIT_MANAGER/u.test(bundleCode)) {
    return 'Nhân sự quản lý phòng ban được chỉ định';
  }
  if (/FINANCE|COMMISSION/u.test(bundleCode)) {
    return 'Nhân sự tài chính, phê duyệt hoặc đối soát';
  }
  if (/AUDITOR/u.test(bundleCode)) {
    return 'Người rà soát chỉ đọc';
  }
  if (/STAFF_CONSOLE/u.test(bundleCode)) {
    return 'Nhân sự tự xem dữ liệu cá nhân';
  }
  if (/OWNER|ACCESS/u.test(bundleCode)) {
    return 'Người quản trị phân quyền có kiểm soát';
  }
  return 'Nhân sự vận hành nội bộ';
};

const scopeTypeLabels: Record<string, string> = {
  self: 'Dữ liệu của chính nhân sự',
  global: 'Toàn hệ thống',
  managedTalentGroup: 'Nhóm Talent được quản lý',
  managedOrgUnit: 'Phòng ban được quản lý',
  assignedPlatformAccount: 'Tài khoản nền tảng được phân công',
  financeGlobal: 'Tài chính toàn cục',
  financePeriod: 'Kỳ tài chính',
  assignedEvent: 'Sự kiện được phân công',
  assignedStudioResource: 'Tài nguyên studio được phân công',
  contractPortfolio: 'Danh mục hợp đồng',
  attendancePeriodOrg: 'Kỳ chấm công theo phòng ban',
  payrollPeriod: 'Kỳ nháp lương',
};

const formatScopeTypeList = (scopes: string[]): string =>
  scopes.length > 0
    ? scopes.map((scope) => scopeTypeLabels[scope] ?? 'Phạm vi cần rà soát').join(', ')
    : 'Không cần chọn phạm vi riêng';

const formatCatalogStatusLabel = (status: CatalogOperatorFlowGroup | string): string => {
  switch (status) {
    case 'READY_ASSIGNABLE':
    case 'READY_TO_ASSIGN':
      return 'Sẵn sàng';
    case 'REQUIRES_SCOPE_SELECTION':
      return 'Cần chọn phạm vi';
    case 'RESTRICTED_SENSITIVE':
      return 'Quản trị có kiểm soát';
    case 'READ_ONLY_AUDIT':
      return 'Chỉ đọc';
    case 'FUTURE_READINESS':
    case 'FUTURE_READY_CONDITION':
    default:
      return 'Chưa khả dụng';
  }
};

const formatAssignmentOrigin = (
  origin: EffectiveAccessRecord['activeRoleAssignments'][number]['origin'],
): string => {
  if (origin === 'BUNDLE') {
    return 'Gói vai trò';
  }

  if (origin === 'LEGACY') {
    return 'Cần rà soát';
  }

  return 'Gán trực tiếp';
};

const formatAccountContextLabel = (context: string): string => {
  switch (context) {
    case 'ADMIN_CONSOLE':
      return 'Quyền vận hành nội bộ';
    case 'MANAGER_CONSOLE':
      return 'Quyền xem công việc được phân công';
    case 'STAFF_CONSOLE':
      return 'Quyền xem dữ liệu cá nhân';
    default:
      return 'Điều kiện truy cập khác';
  }
};

const formatAccountContextList = (contexts: string[]): string =>
  contexts.length > 0 ? contexts.map(formatAccountContextLabel).join(', ') : '-';

const sanitizeUserAccessReferenceOptions = (options: ReferenceOption[]): ReferenceOption[] =>
  options.map((option) => ({
    ...option,
    code: undefined,
    status: undefined,
    state: undefined,
    badges: undefined,
  }));

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

const formatEffectiveScopeSummary = (
  scopes: Array<Record<string, unknown>>,
  t: (key: string) => string,
): string => {
  if (scopes.length === 0) {
    return '-';
  }

  return scopes
    .map((scope) =>
      [
        formatEffectiveScopeType(String(scope.scopeType ?? ''), t),
        typeof scope.targetId === 'string' ? 'Đối tượng được phân công' : null,
        typeof scope.periodKey === 'string' ? scope.periodKey : null,
      ]
        .filter(Boolean)
        .join(': '),
    )
    .join(', ');
};

const formatEffectiveScopeType = (scopeType: string, t: (key: string) => string): string => {
  if (!scopeType) {
    return '-';
  }
  const key = `userAccess.scopeTypes.${scopeType}`;
  const translated = t(key);
  return translated === key ? scopeType : translated;
};

const formatEffectiveBundleOrigin = (origin: Record<string, unknown> | null): string => {
  if (!origin) {
    return '-';
  }
  const bundleCode = typeof origin.bundleCode === 'string' ? origin.bundleCode : null;
  return bundleCode ? formatBundleCodeLabel(bundleCode) : 'Gói quyền';
};

const formatTraceRecord = (record: Record<string, unknown>): string => {
  const preferredKeys = [
    'permission',
    'source',
    'assignmentId',
    'roleCode',
    'scopeFingerprint',
    'origin',
    'bundleCode',
    'subjectType',
    'subjectId',
    'responsibilityType',
    'status',
  ];
  const parts = preferredKeys
    .map((key) => {
      const value = record[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return `${key}: ${String(value)}`;
      }
      if (key === 'source' && Array.isArray(value)) {
        return `${key}: ${value.length}`;
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(record);
};
