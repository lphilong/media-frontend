import { Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, useParams, type RouteObject } from 'react-router-dom';

import { RequireAuth } from '@app/guards/RequireAuth';
import { AdminShellLayout } from '@app/layouts/AdminShellLayout';
import { AppLocaleSwitcher } from '@app/layouts/AppLocaleSwitcher';
import { ModuleAccessGuard } from '@app/router/ModuleAccessGuard';
import { WorkspaceAccessGuard } from '@app/router/WorkspaceAccessGuard';
import {
  createStubCommissionBranchRoute,
  createStubModuleBranchRoute,
  type ModuleRouteHandle,
} from '@app/router/module-route-composition';
import { moduleRouteDefinitions, type ModuleRouteDefinition } from '@app/router/module-definitions';
import { canAccessModule, type ModuleAccessModuleId } from '@app/router/module-access';
import { APP_PATHS } from '@app/router/paths';
import { lazyRoute as lazy } from '@app/router/lazy-route';
import {
  AuthCallbackPage,
  ForbiddenPage,
  LoginPage,
  NotFoundPage,
  RouteErrorPage,
} from '@app/router/system-pages';
import {
  getPrimaryWorkspace,
  hasWorkspace,
  hasAnyPermission,
  hasScopeGrant,
  PERMISSIONS,
  type CurrentActorCapabilities,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  ErrorState,
  LoadingState,
  ModulePlaceholderPage,
  PageContainer,
} from '@shared/components/primitives';

type LazyModuleRoute = ComponentType<Record<string, never>>;

const modulePageMap: Record<string, LazyExoticComponent<LazyModuleRoute>> = {
  'people-readiness': lazy(() =>
    import('@modules/people-readiness/pages/PeopleReadinessDashboardPage').then((module) => ({
      default: module.PeopleReadinessDashboardPage,
    })),
  ),
  'employment-terms': lazy(() =>
    import('@modules/employment-terms/pages/EmploymentTermsWorkspacePage').then((module) => ({
      default: module.EmploymentTermsWorkspacePage,
    })),
  ),
  'org-unit': lazy(() =>
    import('@modules/org-unit/pages/OrgUnitListPage').then((module) => ({
      default: module.OrgUnitListPage,
    })),
  ),
  user: lazy(() =>
    import('@modules/user/pages/UserListPage').then((module) => ({
      default: module.UserListPage,
    })),
  ),
  role: lazy(() =>
    import('@modules/role/pages/RoleListPage').then((module) => ({
      default: module.RoleListPage,
    })),
  ),
  'employment-profile': lazy(() =>
    import('@modules/employment-profile/pages/EmploymentProfileListPage').then((module) => ({
      default: module.EmploymentProfileListPage,
    })),
  ),
  talent: lazy(() =>
    import('@modules/talent/pages/TalentListPage').then((module) => ({
      default: module.TalentListPage,
    })),
  ),
  'talent-group': lazy(() =>
    import('@modules/talent-group/pages/TalentGroupListPage').then((module) => ({
      default: module.TalentGroupListPage,
    })),
  ),
  responsibility: lazy(() =>
    import('@modules/responsibility/pages/ResponsibilityAssignmentPage').then((module) => ({
      default: module.ResponsibilityAssignmentPage,
    })),
  ),
  'platform-account': lazy(() =>
    import('@modules/platform-account/pages/PlatformAccountListPage').then((module) => ({
      default: module.PlatformAccountListPage,
    })),
  ),
  'studio-resource': lazy(() =>
    import('@modules/studio-resource/pages/StudioResourceListPage').then((module) => ({
      default: module.StudioResourceListPage,
    })),
  ),
  'work-schedule': lazy(() =>
    import('@modules/work-schedule/pages/WorkScheduleListPage').then((module) => ({
      default: module.WorkScheduleListPage,
    })),
  ),
  'event-assignment': lazy(() =>
    import('@modules/event-assignment/pages/EventAssignmentListPage').then((module) => ({
      default: module.EventAssignmentListPage,
    })),
  ),
  'contract-registry': lazy(() =>
    import('@modules/contract-registry/pages/ContractRegistryListPage').then((module) => ({
      default: module.ContractRegistryListPage,
    })),
  ),
  kpi: lazy(() =>
    import('@modules/kpi/pages/KpiListPage').then((module) => ({
      default: module.KpiListPage,
    })),
  ),
  'revenue-ledger': lazy(() =>
    import('@modules/revenue-ledger/pages/RevenueLedgerListPage').then((module) => ({
      default: module.RevenueLedgerListPage,
    })),
  ),
  'commission-rules': lazy(() =>
    import('@modules/commission/pages/CommissionRulesListPage').then((module) => ({
      default: module.CommissionRulesListPage,
    })),
  ),
  'commission-settlements': lazy(() =>
    import('@modules/commission/pages/CommissionSettlementsListPage').then((module) => ({
      default: module.CommissionSettlementsListPage,
    })),
  ),
};

const moduleDetailPageMap: Record<string, LazyExoticComponent<LazyModuleRoute>> = {
  'org-unit': lazy(() =>
    import('@modules/org-unit/pages/OrgUnitDetailPage').then((module) => ({
      default: module.OrgUnitDetailPage,
    })),
  ),
  user: lazy(() =>
    import('@modules/user/pages/UserDetailPage').then((module) => ({
      default: module.UserDetailPage,
    })),
  ),
  role: lazy(() =>
    import('@modules/role/pages/RoleDetailPage').then((module) => ({
      default: module.RoleDetailPage,
    })),
  ),
  'employment-profile': lazy(() =>
    import('@modules/employment-profile/pages/EmploymentProfileDetailPage').then((module) => ({
      default: module.EmploymentProfileDetailPage,
    })),
  ),
  talent: lazy(() =>
    import('@modules/talent/pages/TalentDetailPage').then((module) => ({
      default: module.TalentDetailPage,
    })),
  ),
  'talent-group': lazy(() =>
    import('@modules/talent-group/pages/TalentGroupDetailPage').then((module) => ({
      default: module.TalentGroupDetailPage,
    })),
  ),
  'platform-account': lazy(() =>
    import('@modules/platform-account/pages/PlatformAccountDetailPage').then((module) => ({
      default: module.PlatformAccountDetailPage,
    })),
  ),
  'studio-resource': lazy(() =>
    import('@modules/studio-resource/pages/StudioResourceDetailPage').then((module) => ({
      default: module.StudioResourceDetailPage,
    })),
  ),
  'work-schedule': lazy(() =>
    import('@modules/work-schedule/pages/WorkScheduleDetailPage').then((module) => ({
      default: module.WorkScheduleDetailPage,
    })),
  ),
  'event-assignment': lazy(() =>
    import('@modules/event-assignment/pages/EventAssignmentDetailPage').then((module) => ({
      default: module.EventAssignmentDetailPage,
    })),
  ),
  'contract-registry': lazy(() =>
    import('@modules/contract-registry/pages/ContractRegistryDetailPage').then((module) => ({
      default: module.ContractRegistryDetailPage,
    })),
  ),
  kpi: lazy(() =>
    import('@modules/kpi/pages/KpiDetailPage').then((module) => ({
      default: module.KpiDetailPage,
    })),
  ),
  'revenue-ledger': lazy(() =>
    import('@modules/revenue-ledger/pages/RevenueLedgerDetailPage').then((module) => ({
      default: module.RevenueLedgerDetailPage,
    })),
  ),
  'commission-rules': lazy(() =>
    import('@modules/commission/pages/CommissionRuleDetailPage').then((module) => ({
      default: module.CommissionRuleDetailPage,
    })),
  ),
  'commission-settlements': lazy(() =>
    import('@modules/commission/pages/CommissionSettlementDetailPage').then((module) => ({
      default: module.CommissionSettlementDetailPage,
    })),
  ),
};

const EmploymentProfileCreatePage = lazy(() =>
  import('@modules/employment-profile/pages/EmploymentProfileCreatePage').then((module) => ({
    default: module.EmploymentProfileCreatePage,
  })),
);

const DashboardLitePage = lazy(() =>
  import('@modules/dashboard-lite/pages/DashboardLitePage').then((module) => ({
    default: module.DashboardLitePage,
  })),
);

const SelfServicePage = lazy(() =>
  import('@modules/self-service/pages/SelfServicePage').then((module) => ({
    default: module.SelfServicePage,
  })),
);

const ManagerWorkspacePage = lazy(() =>
  import('@modules/manager-workspace/pages/ManagerWorkspacePage').then((module) => ({
    default: module.ManagerWorkspacePage,
  })),
);

const WorkPatternListPage = lazy(() =>
  import('@modules/work-schedule/pages/WorkPatternListPage').then((module) => ({
    default: module.WorkPatternListPage,
  })),
);

const WorkPatternDetailPage = lazy(() =>
  import('@modules/work-schedule/pages/WorkPatternDetailPage').then((module) => ({
    default: module.WorkPatternDetailPage,
  })),
);

const HolidayCalendarListPage = lazy(() =>
  import('@modules/work-schedule/pages/HolidayCalendarListPage').then((module) => ({
    default: module.HolidayCalendarListPage,
  })),
);

const HolidayCalendarDetailPage = lazy(() =>
  import('@modules/work-schedule/pages/HolidayCalendarDetailPage').then((module) => ({
    default: module.HolidayCalendarDetailPage,
  })),
);

const MonthlyRosterListPage = lazy(() =>
  import('@modules/work-schedule/pages/MonthlyRosterListPage').then((module) => ({
    default: module.MonthlyRosterListPage,
  })),
);

const MonthlyRosterDetailPage = lazy(() =>
  import('@modules/work-schedule/pages/MonthlyRosterDetailPage').then((module) => ({
    default: module.MonthlyRosterDetailPage,
  })),
);

const WorkScheduleRequestBatchQueuePage = lazy(() =>
  import('@modules/work-schedule/pages/WorkScheduleRequestBatchQueuePage').then((module) => ({
    default: module.WorkScheduleRequestBatchQueuePage,
  })),
);

const WorkScheduleAvailabilityBatchQueuePage = lazy(() =>
  import('@modules/work-schedule/pages/WorkScheduleAvailabilityBatchQueuePage').then((module) => ({
    default: module.WorkScheduleAvailabilityBatchQueuePage,
  })),
);

const RouteLoadingFallback = (): JSX.Element => (
  <PageContainer>
    <LoadingState lines={5} />
  </PageContainer>
);

function RootLandingRedirect(): JSX.Element {
  const capabilitiesQuery = useCurrentActorCapabilities();
  const capabilities = capabilitiesQuery.data;

  if (capabilitiesQuery.isLoading && !capabilitiesQuery.data) {
    return <RouteLoadingFallback />;
  }

  if (capabilitiesQuery.isError || !capabilities) {
    return <NoWorkspaceAvailableState />;
  }

  const primaryWorkspace = getPrimaryWorkspace(capabilities);
  if (primaryWorkspace === 'ADMIN_CONSOLE') {
    if (canAccessModule(capabilities, 'dashboard')) {
      return <Navigate to={APP_PATHS.dashboard} replace />;
    }
    return <Navigate to={APP_PATHS.forbidden} replace />;
  }
  if (primaryWorkspace === 'MANAGER_CONSOLE') {
    return <Navigate to={APP_PATHS.manager} replace />;
  }
  if (primaryWorkspace === 'STAFF_CONSOLE') {
    return <Navigate to={APP_PATHS.selfService} replace />;
  }

  return <NoWorkspaceAvailableState />;
}

function NoWorkspaceAvailableState(): JSX.Element {
  return (
    <PageContainer>
      <ErrorState
        title="Chưa có chức năng được phân quyền"
        message="Tài khoản hiện tại chưa có chức năng phù hợp để mở. Vui lòng liên hệ người phụ trách phân quyền để kiểm tra quyền và phạm vi dữ liệu."
      />
    </PageContainer>
  );
}

const withModuleAccess = (moduleId: ModuleAccessModuleId, element: JSX.Element): JSX.Element => (
  <ModuleAccessGuard moduleId={moduleId}>{element}</ModuleAccessGuard>
);

const isManagerOnlyKpiActor = (capabilities: CurrentActorCapabilities | undefined): boolean =>
  !hasWorkspace(capabilities, 'ADMIN_CONSOLE') &&
  hasWorkspace(capabilities, 'MANAGER_CONSOLE') &&
  !hasScopeGrant(capabilities, 'kpi', 'global') &&
  hasScopeGrant(capabilities, 'kpi', 'managedGroup') &&
  hasAnyPermission(capabilities, [PERMISSIONS.KPI_READ, PERMISSIONS.KPI_READ_PROGRESS]);

function AdminKpiRouteBoundary({ children }: { children: JSX.Element }): JSX.Element {
  const capabilitiesQuery = useCurrentActorCapabilities();
  const { kpiPlanId } = useParams<{ kpiPlanId?: string }>();

  if (capabilitiesQuery.isLoading && !capabilitiesQuery.data) {
    return <RouteLoadingFallback />;
  }

  if (isManagerOnlyKpiActor(capabilitiesQuery.data)) {
    return (
      <Navigate
        to={kpiPlanId ? APP_PATHS.managerKpiPlanDetail(kpiPlanId) : APP_PATHS.managerKpi}
        replace
      />
    );
  }

  return children;
}

function LazyModuleElement({ moduleId }: { moduleId: string }): JSX.Element {
  const LazyPage = modulePageMap[moduleId];

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <LazyPage />
    </Suspense>
  );
}

function LazyModuleDetailElement({
  moduleId,
  definition,
}: {
  moduleId: string;
  definition: ModuleRouteDefinition;
}): JSX.Element {
  const LazyDetailPage = moduleDetailPageMap[moduleId];

  if (!LazyDetailPage) {
    return <ModuleDetailStubElement definition={definition} />;
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <LazyDetailPage />
    </Suspense>
  );
}

function LazyEmploymentProfileCreateElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <EmploymentProfileCreatePage />
    </Suspense>
  );
}

function LazyDashboardElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <DashboardLitePage />
    </Suspense>
  );
}

function LazySelfServiceElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <SelfServicePage localeSwitcher={<AppLocaleSwitcher />} />
    </Suspense>
  );
}

function LazyManagerWorkspaceElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <ManagerWorkspacePage localeSwitcher={<AppLocaleSwitcher />} />
    </Suspense>
  );
}

function LazyWorkPatternListElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <WorkPatternListPage />
    </Suspense>
  );
}

function LazyWorkPatternDetailElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <WorkPatternDetailPage />
    </Suspense>
  );
}

function LazyHolidayCalendarListElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <HolidayCalendarListPage />
    </Suspense>
  );
}

function LazyHolidayCalendarDetailElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <HolidayCalendarDetailPage />
    </Suspense>
  );
}

function LazyMonthlyRosterListElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <MonthlyRosterListPage />
    </Suspense>
  );
}

function LazyMonthlyRosterDetailElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <MonthlyRosterDetailPage />
    </Suspense>
  );
}

function LazyWorkScheduleRequestBatchQueueElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <WorkScheduleRequestBatchQueuePage />
    </Suspense>
  );
}

function LazyWorkScheduleAvailabilityBatchQueueElement(): JSX.Element {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <WorkScheduleAvailabilityBatchQueuePage />
    </Suspense>
  );
}

function ModuleDetailStubElement({
  definition,
}: {
  definition: ModuleRouteDefinition;
}): JSX.Element {
  const params = useParams<Record<string, string>>();
  const entityId = definition.detailParamKey ? params[definition.detailParamKey] : undefined;

  return (
    <ModulePlaceholderPage
      namespace={definition.namespace}
      placeholderKey={definition.placeholderKey}
      mode="detail"
      entityId={entityId}
    />
  );
}

const dashboardDefinition = moduleRouteDefinitions.find(
  (definition) => definition.id === 'dashboard',
);
const commissionRulesDefinition = moduleRouteDefinitions.find(
  (definition) => definition.id === 'commission-rules',
);
const commissionSettlementsDefinition = moduleRouteDefinitions.find(
  (definition) => definition.id === 'commission-settlements',
);

if (!dashboardDefinition || !commissionRulesDefinition || !commissionSettlementsDefinition) {
  throw new Error('Missing required module route definitions');
}

const standardModuleDefinitions = moduleRouteDefinitions.filter(
  (definition) =>
    !['dashboard', 'commission-rules', 'commission-settlements'].includes(definition.id),
);
const realModuleIds = new Set([...Object.keys(modulePageMap), ...Object.keys(moduleDetailPageMap)]);

export const appRoutes: RouteObject[] = [
  {
    path: APP_PATHS.login,
    element: <LoginPage />,
  },
  {
    path: APP_PATHS.callback,
    element: <AuthCallbackPage />,
  },
  {
    path: APP_PATHS.forbidden,
    element: <ForbiddenPage />,
  },
  {
    path: APP_PATHS.selfService,
    element: (
      <RequireAuth>
        <WorkspaceAccessGuard workspace="STAFF_CONSOLE">
          <LazySelfServiceElement />
        </WorkspaceAccessGuard>
      </RequireAuth>
    ),
  },
  {
    path: APP_PATHS.manager,
    element: (
      <RequireAuth>
        <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
          <LazyManagerWorkspaceElement />
        </WorkspaceAccessGuard>
      </RequireAuth>
    ),
  },
  {
    path: APP_PATHS.managerKpi,
    element: (
      <RequireAuth>
        <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
          <LazyManagerWorkspaceElement />
        </WorkspaceAccessGuard>
      </RequireAuth>
    ),
  },
  {
    path: APP_PATHS.managerWorkShifts,
    element: (
      <RequireAuth>
        <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
          <LazyManagerWorkspaceElement />
        </WorkspaceAccessGuard>
      </RequireAuth>
    ),
  },
  {
    path: APP_PATHS.managerRevenueSource,
    element: (
      <RequireAuth>
        <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
          <LazyManagerWorkspaceElement />
        </WorkspaceAccessGuard>
      </RequireAuth>
    ),
  },
  {
    path: APP_PATHS.managerEvents,
    element: (
      <RequireAuth>
        <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
          <LazyManagerWorkspaceElement />
        </WorkspaceAccessGuard>
      </RequireAuth>
    ),
  },
  {
    path: APP_PATHS.managerEventDetailPattern,
    element: (
      <RequireAuth>
        <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
          <LazyManagerWorkspaceElement />
        </WorkspaceAccessGuard>
      </RequireAuth>
    ),
  },
  {
    path: APP_PATHS.managerKpiPlanDetailPattern,
    element: (
      <RequireAuth>
        <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
          <LazyManagerWorkspaceElement />
        </WorkspaceAccessGuard>
      </RequireAuth>
    ),
  },
  {
    path: APP_PATHS.root,
    errorElement: <RouteErrorPage />,
    element: (
      <RequireAuth>
        <AdminShellLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <RootLandingRedirect />,
      },
      {
        path: dashboardDefinition.listPath.replace(/^\//, ''),
        element: withModuleAccess('dashboard', <LazyDashboardElement />),
        handle: {
          breadcrumbKey: `nav:items.${dashboardDefinition.navItemKey}`,
          titleKey: dashboardDefinition.listTitleKey,
          subtitleKey: dashboardDefinition.listSubtitleKey,
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.workScheduleMyShifts.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyModuleElement moduleId="work-schedule" />),
        handle: {
          breadcrumbKey: 'work-schedule:rosterNav.myShifts',
          titleKey: 'work-schedule:surfaces.my.title',
          subtitleKey: 'work-schedule:surfaces.my.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.workScheduleTeamShifts.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyModuleElement moduleId="work-schedule" />),
        handle: {
          breadcrumbKey: 'work-schedule:rosterNav.teamShifts',
          titleKey: 'work-schedule:surfaces.team.title',
          subtitleKey: 'work-schedule:surfaces.team.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.workScheduleDepartmentShifts.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyModuleElement moduleId="work-schedule" />),
        handle: {
          breadcrumbKey: 'work-schedule:rosterNav.departmentShifts',
          titleKey: 'work-schedule:surfaces.department.title',
          subtitleKey: 'work-schedule:surfaces.department.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.workScheduleGlobalOps.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyModuleElement moduleId="work-schedule" />),
        handle: {
          breadcrumbKey: 'work-schedule:rosterNav.globalOps',
          titleKey: 'work-schedule:surfaces.globalOps.title',
          subtitleKey: 'work-schedule:surfaces.globalOps.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.workScheduleRequestBatches.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyWorkScheduleRequestBatchQueueElement />),
        handle: {
          breadcrumbKey: 'work-schedule:rosterNav.requestBatches',
          titleKey: 'work-schedule:requestBatches.page.title',
          subtitleKey: 'work-schedule:requestBatches.page.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.workScheduleAvailabilityBatches.replace(/^\//, ''),
        element: withModuleAccess(
          'work-schedule',
          <LazyWorkScheduleAvailabilityBatchQueueElement />,
        ),
        handle: {
          breadcrumbKey: 'work-schedule:rosterNav.availabilityBatches',
          titleKey: 'work-schedule:availabilityBatches.page.title',
          subtitleKey: 'work-schedule:availabilityBatches.page.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.workPatterns.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyWorkPatternListElement />),
        handle: {
          breadcrumbKey: 'work-schedule:patterns.page.title',
          titleKey: 'work-schedule:patterns.page.title',
          subtitleKey: 'work-schedule:patterns.page.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.workPatternDetailPattern.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyWorkPatternDetailElement />),
        handle: {
          breadcrumbKey: 'work-schedule:patterns.detail.pageTitle',
          titleKey: 'work-schedule:patterns.detail.pageTitle',
          subtitleKey: 'work-schedule:patterns.detail.pageSubtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.holidayCalendars.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyHolidayCalendarListElement />),
        handle: {
          breadcrumbKey: 'work-schedule:holidayCalendars.page.title',
          titleKey: 'work-schedule:holidayCalendars.page.title',
          subtitleKey: 'work-schedule:holidayCalendars.page.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.holidayCalendarDetailPattern.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyHolidayCalendarDetailElement />),
        handle: {
          breadcrumbKey: 'work-schedule:holidayCalendars.detail.pageTitle',
          titleKey: 'work-schedule:holidayCalendars.detail.pageTitle',
          subtitleKey: 'work-schedule:holidayCalendars.detail.pageSubtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.monthlyRosters.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyMonthlyRosterListElement />),
        handle: {
          breadcrumbKey: 'work-schedule:monthlyRosters.page.title',
          titleKey: 'work-schedule:monthlyRosters.page.title',
          subtitleKey: 'work-schedule:monthlyRosters.page.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.monthlyRosterDetailPattern.replace(/^\//, ''),
        element: withModuleAccess('work-schedule', <LazyMonthlyRosterDetailElement />),
        handle: {
          breadcrumbKey: 'work-schedule:monthlyRosters.detail.pageTitle',
          titleKey: 'work-schedule:monthlyRosters.detail.pageTitle',
          subtitleKey: 'work-schedule:monthlyRosters.detail.pageSubtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.kpiPlans.replace(/^\//, ''),
        element: (
          <AdminKpiRouteBoundary>
            {withModuleAccess('kpi', <LazyModuleElement moduleId="kpi" />)}
          </AdminKpiRouteBoundary>
        ),
        handle: {
          breadcrumbKey: 'nav:items.kpi',
          titleKey: 'kpi:page.title',
          subtitleKey: 'kpi:page.subtitle',
        } satisfies ModuleRouteHandle,
      },
      {
        path: APP_PATHS.employmentProfileCreate.replace(/^\//, ''),
        element: withModuleAccess('employment-profile', <LazyEmploymentProfileCreateElement />),
        handle: {
          breadcrumbKey: 'employment-profile:createWorkflow.pageTitle',
          titleKey: 'employment-profile:createWorkflow.pageTitle',
          subtitleKey: 'employment-profile:createWorkflow.pageSubtitle',
        } satisfies ModuleRouteHandle,
      },
      ...standardModuleDefinitions.map((definition) => {
        const listElement = withModuleAccess(
          definition.id as ModuleAccessModuleId,
          <LazyModuleElement moduleId={definition.id} />,
        );
        const detailElement = withModuleAccess(
          definition.id as ModuleAccessModuleId,
          <LazyModuleDetailElement moduleId={definition.id} definition={definition} />,
        );
        const routeListElement =
          definition.id === 'kpi' ? (
            <AdminKpiRouteBoundary>{listElement}</AdminKpiRouteBoundary>
          ) : (
            listElement
          );
        const routeDetailElement =
          definition.id === 'kpi' ? (
            <AdminKpiRouteBoundary>{detailElement}</AdminKpiRouteBoundary>
          ) : (
            detailElement
          );

        return createStubModuleBranchRoute({
          definition,
          listElement: routeListElement,
          detailElement: routeDetailElement,
          stubRoute: !realModuleIds.has(definition.id),
        });
      }),
      {
        path: APP_PATHS.commission.replace(/^\//, ''),
        handle: {
          breadcrumbKey: 'nav:items.commission',
        } satisfies ModuleRouteHandle,
        children: [
          {
            index: true,
            element: <Navigate to={APP_PATHS.commissionRules} replace />,
          },
          createStubCommissionBranchRoute({
            definition: commissionRulesDefinition,
            commissionPath: APP_PATHS.commission,
            listElement: withModuleAccess(
              'commission-rules',
              <LazyModuleElement moduleId={commissionRulesDefinition.id} />,
            ),
            detailElement: withModuleAccess(
              'commission-rules',
              <LazyModuleDetailElement
                moduleId={commissionRulesDefinition.id}
                definition={commissionRulesDefinition}
              />,
            ),
            stubRoute: false,
          }),
          createStubCommissionBranchRoute({
            definition: commissionSettlementsDefinition,
            commissionPath: APP_PATHS.commission,
            listElement: withModuleAccess(
              'commission-settlements',
              <LazyModuleElement moduleId={commissionSettlementsDefinition.id} />,
            ),
            detailElement: withModuleAccess(
              'commission-settlements',
              <LazyModuleDetailElement
                moduleId={commissionSettlementsDefinition.id}
                definition={commissionSettlementsDefinition}
              />,
            ),
            stubRoute: false,
          }),
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

export const createAppRouter = () => {
  return createBrowserRouter(appRoutes);
};
