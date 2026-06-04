import { BarChart3, Building2, LayoutDashboard, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_PATHS } from '@app/router/paths';
import { useKpiPlans } from '@modules/kpi/hooks/use-kpi';
import type { KpiPlanListItem, KpiSubjectType } from '@modules/kpi/types/kpi.types';
import {
  useManagerWorkspaceContext,
  type ManagerWorkspaceContext,
} from '@modules/manager-workspace/api/manager-workspace.api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  StatusBadge,
} from '@shared/components/primitives';

type KpiTabId = 'unit' | 'talentGroup';

type ManagerWorkspaceView = 'overview' | 'kpi';

type ManagerWorkspaceNavItem = {
  id: ManagerWorkspaceView;
  path: string;
  icon: typeof LayoutDashboard;
};

const managerWorkspaceNavItems: ManagerWorkspaceNavItem[] = [
  { id: 'overview', path: APP_PATHS.manager, icon: LayoutDashboard },
  { id: 'kpi', path: APP_PATHS.managerKpi, icon: BarChart3 },
];

const statusTone = {
  DRAFT: 'muted',
  PUBLISHED: 'success',
  FINALIZED: 'success',
  ARCHIVED: 'muted',
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  DEPARTMENT_OWNER: 'info',
  UNIT_MANAGER: 'success',
  UNIT_OPERATOR: 'neutral',
} as const;

const getSubjectName = (plan: KpiPlanListItem, fallback: string): string =>
  plan.subjectRef?.name ?? plan.subjectRef?.displayName ?? plan.subjectRef?.code ?? fallback;

const getActiveView = (pathname: string): ManagerWorkspaceView =>
  pathname === APP_PATHS.managerKpi ? 'kpi' : 'overview';

const getEnabledKpiTabs = (context: ManagerWorkspaceContext): KpiTabId[] => {
  const tabs: KpiTabId[] = [];
  if (context.modules.kpi.unitKpiVisible) {
    tabs.push('unit');
  }
  if (context.modules.kpi.talentGroupKpiVisible) {
    tabs.push('talentGroup');
  }
  return tabs;
};

const KpiPlanTable = ({
  plans,
  subjectLabel,
}: {
  plans: KpiPlanListItem[];
  subjectLabel: string;
}): JSX.Element => {
  const { t } = useTranslation(['manager-workspace', 'kpi']);

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full text-left text-sm"
        aria-label={t('manager-workspace:kpi.tableLabel')}
      >
        <thead className="border-b border-border text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">{t('manager-workspace:kpi.fields.plan')}</th>
            <th className="px-3 py-2 font-medium">{subjectLabel}</th>
            <th className="px-3 py-2 font-medium">{t('manager-workspace:kpi.fields.period')}</th>
            <th className="px-3 py-2 font-medium">{t('manager-workspace:kpi.fields.status')}</th>
            <th className="px-3 py-2 font-medium">{t('manager-workspace:kpi.fields.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {plans.map((plan) => (
            <tr key={plan.id} data-testid="manager-kpi-plan-row">
              <td className="px-3 py-3">
                <div className="font-medium text-text">{plan.title}</div>
                <div className="font-mono text-xs text-muted">{plan.planCode}</div>
              </td>
              <td className="px-3 py-3">
                {getSubjectName(plan, t('manager-workspace:values.notAvailable'))}
              </td>
              <td className="px-3 py-3">{plan.periodMonth}</td>
              <td className="px-3 py-3">
                <StatusBadge
                  label={t(`kpi:statuses.${plan.status}`)}
                  status={plan.status}
                  toneByStatus={statusTone}
                />
              </td>
              <td className="px-3 py-3">
                <Link
                  className="inline-flex rounded border border-border px-3 py-2 text-sm font-medium text-text hover:bg-panel"
                  to={APP_PATHS.kpiPlanDetail(plan.id)}
                >
                  {t('manager-workspace:actions.open')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ManagerKpiSlice = ({ context }: { context: ManagerWorkspaceContext }): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const enabledTabs = useMemo(() => getEnabledKpiTabs(context), [context]);
  const [selectedTab, setSelectedTab] = useState<KpiTabId>(enabledTabs[0] ?? 'unit');

  useEffect(() => {
    if (enabledTabs.length > 0 && !enabledTabs.includes(selectedTab)) {
      setSelectedTab(enabledTabs[0]);
    }
  }, [enabledTabs, selectedTab]);

  const unitPlansQuery = useKpiPlans(
    { subjectType: 'ORG_UNIT' as KpiSubjectType, status: 'PUBLISHED', limit: 50 },
    { enabled: selectedTab === 'unit' && context.modules.kpi.unitKpiVisible },
  );
  const talentGroupPlansQuery = useKpiPlans(
    { subjectType: 'TALENT_GROUP' as KpiSubjectType, status: 'PUBLISHED', limit: 50 },
    {
      enabled: selectedTab === 'talentGroup' && context.modules.kpi.talentGroupKpiVisible,
    },
  );

  if (!context.modules.kpi.visible || enabledTabs.length === 0) {
    return (
      <EmptyState
        title={t('manager-workspace:empty.kpiTitle')}
        message={t('manager-workspace:empty.kpiMessage')}
      />
    );
  }

  const activeQuery = selectedTab === 'unit' ? unitPlansQuery : talentGroupPlansQuery;
  const plans = activeQuery.data ?? [];

  return (
    <section className="rounded border border-border bg-panel p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">{t('manager-workspace:kpi.title')}</h2>
          <p className="text-sm text-muted">{t('manager-workspace:kpi.summary')}</p>
        </div>
        <StatusBadge label={t('manager-workspace:status.readOnlyShell')} tone="neutral" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {enabledTabs.map((tab) => {
          const active = selectedTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedTab(tab)}
              className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium ${
                active
                  ? 'border-text bg-text text-bg'
                  : 'border-border bg-bg text-text hover:bg-panel'
              }`}
              data-testid={`manager-kpi-tab-${tab}`}
            >
              {tab === 'unit' ? (
                <Building2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <UsersRound className="h-4 w-4" aria-hidden="true" />
              )}
              {t(`manager-workspace:kpi.tabs.${tab}`)}
            </button>
          );
        })}
      </div>

      {activeQuery.isLoading ? (
        <div data-testid="manager-kpi-loading">
          <LoadingState lines={4} />
        </div>
      ) : null}

      {activeQuery.isError ? (
        <ErrorState
          title={t('manager-workspace:errors.kpiTitle')}
          message={t('manager-workspace:errors.kpiMessage')}
        />
      ) : null}

      {!activeQuery.isLoading && !activeQuery.isError && plans.length === 0 ? (
        <EmptyState
          title={t('manager-workspace:empty.kpiListTitle')}
          message={t('manager-workspace:empty.kpiListMessage')}
        />
      ) : null}

      {plans.length > 0 ? (
        <KpiPlanTable
          plans={plans}
          subjectLabel={t(`manager-workspace:kpi.subject.${selectedTab}`)}
        />
      ) : null}
    </section>
  );
};

const ManagerWorkspaceOverview = ({
  context,
}: {
  context: ManagerWorkspaceContext;
}): JSX.Element => {
  const { t } = useTranslation(['manager-workspace', 'common']);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded border border-border bg-panel p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-text">
          {t('manager-workspace:overview.profileTitle')}
        </h2>
        {context.employmentProfile ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-border bg-bg px-3 py-2">
              <dt className="text-xs font-medium uppercase text-muted">
                {t('manager-workspace:fields.displayName')}
              </dt>
              <dd className="mt-1 text-sm font-medium text-text">
                {context.employmentProfile.displayName}
              </dd>
            </div>
            <div className="rounded border border-border bg-bg px-3 py-2">
              <dt className="text-xs font-medium uppercase text-muted">
                {t('manager-workspace:fields.employeeCode')}
              </dt>
              <dd className="mt-1 font-mono text-sm text-text">
                {context.employmentProfile.employeeCode ??
                  t('manager-workspace:values.notAvailable')}
              </dd>
            </div>
            <div className="rounded border border-border bg-bg px-3 py-2">
              <dt className="text-xs font-medium uppercase text-muted">
                {t('manager-workspace:fields.status')}
              </dt>
              <dd className="mt-1">
                <StatusBadge
                  label={
                    context.employmentProfile.employmentStatus
                      ? t(
                          `manager-workspace:employmentStatus.${context.employmentProfile.employmentStatus}`,
                        )
                      : t('manager-workspace:values.notAvailable')
                  }
                  status={context.employmentProfile.employmentStatus}
                  toneByStatus={statusTone}
                />
              </dd>
            </div>
          </dl>
        ) : (
          <EmptyState
            title={t('manager-workspace:empty.noProfileTitle')}
            message={t('manager-workspace:empty.noProfileMessage')}
          />
        )}
      </section>

      <section className="rounded border border-border bg-panel p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-text">
          {t('manager-workspace:overview.scopeTitle')}
        </h2>
        {context.scopes.orgUnits.length === 0 && context.scopes.talentGroups.length === 0 ? (
          <EmptyState
            title={t('manager-workspace:empty.noAssignmentsTitle')}
            message={t('manager-workspace:empty.noAssignmentsMessage')}
          />
        ) : (
          <div className="mt-3 space-y-3">
            {context.scopes.orgUnits.map((scope) => (
              <div
                key={`ou-${scope.orgUnitId}`}
                className="rounded border border-border bg-bg px-3 py-2"
                data-testid="manager-scope-org-unit"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-text">{scope.name}</div>
                    <div className="font-mono text-xs text-muted">
                      {scope.code ?? scope.orgUnitId}
                    </div>
                  </div>
                  <StatusBadge
                    label={t(`manager-workspace:orgUnitRole.${scope.role}`)}
                    status={scope.role}
                    toneByStatus={statusTone}
                    uppercase={false}
                  />
                </div>
              </div>
            ))}
            {context.scopes.talentGroups.map((scope) => (
              <div
                key={`tg-${scope.talentGroupId}`}
                className="rounded border border-border bg-bg px-3 py-2"
                data-testid="manager-scope-talent-group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-text">{scope.name}</div>
                    <div className="font-mono text-xs text-muted">
                      {scope.code ?? scope.talentGroupId}
                    </div>
                  </div>
                  <StatusBadge
                    label={t('manager-workspace:kpi.tabs.talentGroup')}
                    tone="info"
                    uppercase={false}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const ManagerWorkspacePage = (): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const location = useLocation();
  const activeView = getActiveView(location.pathname);
  const contextQuery = useManagerWorkspaceContext();
  const context = contextQuery.data;

  return (
    <main className="min-h-screen bg-bg text-text" data-testid="manager-workspace-shell">
      <div className="border-b border-border bg-panel">
        <PageContainer className="py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-text">{t('manager-workspace:title')}</h1>
              <p className="text-sm text-muted">{t('manager-workspace:subtitle')}</p>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label={t('manager-workspace:nav.label')}>
              {managerWorkspaceNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                const disabled =
                  item.id === 'kpi' && context ? !context.modules.kpi.visible : false;

                return (
                  <Link
                    key={item.id}
                    to={disabled ? APP_PATHS.manager : item.path}
                    aria-disabled={disabled}
                    className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium ${
                      active
                        ? 'border-text bg-text text-bg'
                        : 'border-border bg-bg text-text hover:bg-bg'
                    } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
                    data-testid={`manager-nav-${item.id}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(`manager-workspace:nav.${item.id}`)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </PageContainer>
      </div>

      <PageContainer className="space-y-5 py-5">
        {contextQuery.isLoading ? <LoadingState lines={5} /> : null}
        {contextQuery.isError ? (
          <ErrorState
            title={t('manager-workspace:errors.contextTitle')}
            message={t('manager-workspace:errors.contextMessage')}
          />
        ) : null}

        {context && context.readiness.reasons.length > 0 ? (
          <section className="rounded border border-border bg-panel p-4 shadow-sm">
            <StatusBadge
              label={t(`manager-workspace:readiness.${context.readiness.reasons[0]}`)}
              tone={context.readiness.canUseManagerWorkspace ? 'warning' : 'danger'}
              uppercase={false}
            />
          </section>
        ) : null}

        {context && activeView === 'overview' ? (
          <ManagerWorkspaceOverview context={context} />
        ) : null}
        {context && activeView === 'kpi' ? <ManagerKpiSlice context={context} /> : null}
      </PageContainer>
    </main>
  );
};
