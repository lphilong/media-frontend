import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  Gem,
  LayoutDashboard,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_PATHS } from '@app/router/paths';
import { formatKpiNumber } from '@modules/kpi/formatting/kpi-formatting';
import { useKpiPlanDetail, useKpiPlans } from '@modules/kpi/hooks/use-kpi';
import { ManagerAvailabilityPanel } from '@modules/manager-workspace/components/ManagerAvailabilityPanel';
import { ManagerWorkActionNeeded } from '@modules/manager-workspace/components/ManagerWorkActionNeeded';
import {
  KpiOrgUnitOperationsSection,
  type KpiOrgUnitOperationsActionPolicy,
} from '@modules/kpi/pages/KpiDetailPage';
import type { KpiPlanDetail, KpiPlanListItem, KpiSubjectType } from '@modules/kpi/types/kpi.types';
import {
  useManagerWorkspaceContext,
  useCancelManagerRequestBatchMutation,
  useCancelManagerRequestLineMutation,
  useManagerEventDetail,
  useManagerEvents,
  useAddManagerPlatformEarningLineMutation,
  useCreateManagerPlatformEarningBatchMutation,
  useManagerPlatformEarningBatchDetail,
  useManagerPlatformEarningBatches,
  useManagerPlatformEarningLines,
  useManagerPlatformEarningScope,
  useManagerRequestBatchDetail,
  useManagerRequestBatches,
  useManagerWorkShifts,
  useSubmitManagerPlatformEarningBatchMutation,
  useUpdateManagerPlatformEarningLineMutation,
  type ManagerEventSummary,
  type ManagerPlatformEarningLine,
  useSubmitManagerRequestBatchMutation,
  type ManagerRequestBatchLine,
  type ManagerSubmitRequestBatchLinePayload,
  type ManagerWorkShiftList,
  type ManagerWorkScheduleRequestType,
  type ManagerWorkspaceContext,
  type ManagerWorkspaceOrgUnitScope,
} from '@modules/manager-workspace/api/manager-workspace.api';
import {
  EmptyState,
  ErrorState,
  DetailBackLink,
  LoadingState,
  StatusBadge,
  useMutationFeedback,
} from '@shared/components/primitives';
import type { NormalizedApiError } from '@shared/api';
import { LocaleSwitcher, SessionArea } from '@shared/components/shell';
import {
  WorkspaceHeader,
  WorkspaceModuleSwitcher,
  WorkspacePanel,
  WorkspaceReadinessCard,
  WorkspaceShell,
  type WorkspaceModuleItem,
} from '@shared/components/workspace';
import {
  formatDecimal,
  formatUtcMidnightDateLike,
  formatVietnamTimestamp,
  formatVietnamMonthLabel,
  parseUtcMidnightDateInputValue,
  readReferenceDisplay,
} from '@shared/formatting/formatters';

type KpiTabId = 'unit' | 'talentGroup';

type ManagerWorkspaceModuleId =
  | 'overview'
  | 'kpi'
  | 'work'
  | 'revenue'
  | 'events'
  | 'groups'
  | 'members';

type ManagerWorkspaceModuleConfig = {
  id: ManagerWorkspaceModuleId;
  icon: typeof LayoutDashboard;
};

const managerWorkspaceModules: ManagerWorkspaceModuleConfig[] = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'kpi', icon: BarChart3 },
  { id: 'work', icon: CalendarDays },
  { id: 'revenue', icon: Gem },
  { id: 'events', icon: CalendarDays },
  { id: 'groups', icon: Building2 },
  { id: 'members', icon: UserRound },
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

const batchStatusTone = {
  PENDING: 'warning',
  PARTIALLY_APPROVED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
  FAILED_TO_APPLY: 'danger',
} as const;

const revenueBatchStatusTone = {
  DRAFT: 'muted',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  VOIDED: 'muted',
  ARCHIVED: 'muted',
} as const;

const getSubjectName = (plan: KpiPlanListItem, fallback: string): string =>
  plan.subjectRef?.name ?? plan.subjectRef?.displayName ?? plan.subjectRef?.code ?? fallback;

const getRouteModule = (pathname: string): ManagerWorkspaceModuleId =>
  pathname.startsWith(APP_PATHS.managerKpi)
    ? 'kpi'
    : pathname.startsWith(APP_PATHS.managerWorkShifts)
      ? 'work'
      : pathname.startsWith(APP_PATHS.managerRevenueSource)
        ? 'revenue'
        : pathname.startsWith(APP_PATHS.managerEvents)
          ? 'events'
          : 'overview';

const isManagerKpiDetailPath = (pathname: string): boolean =>
  pathname.startsWith(`${APP_PATHS.managerKpi}/plans/`);

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

const disabledManagerModuleIds: ReadonlySet<ManagerWorkspaceModuleId> = new Set([
  'groups',
  'members',
]);

type ManagerModuleStatusKey = 'actionable' | 'readOnly' | 'unavailable';

const hasManagerAssignedScope = (context: ManagerWorkspaceContext): boolean =>
  !context.readiness.reasons.includes('NO_MANAGED_SCOPE_ASSIGNED') &&
  (context.scopes.orgUnits.length > 0 || context.scopes.talentGroups.length > 0);

const getManagerKpiStatusKey = (context: ManagerWorkspaceContext): ManagerModuleStatusKey => {
  if (!context.modules.kpi.visible || !hasManagerAssignedScope(context)) {
    return 'unavailable';
  }

  const hasKpiMutation = context.scopes.orgUnits.some(
    (scope) =>
      scope.role === 'UNIT_MANAGER' &&
      scope.includeDescendants === false &&
      (scope.capabilities.kpi.manageAllocation ||
        scope.capabilities.kpi.enterActual ||
        scope.capabilities.kpi.correctActual),
  );

  return hasKpiMutation ? 'actionable' : 'readOnly';
};

const getManagerWorkStatusKey = (context: ManagerWorkspaceContext): ManagerModuleStatusKey =>
  context.modules.workShifts.visible && hasManagerAssignedScope(context)
    ? 'actionable'
    : 'unavailable';

const getManagerEventsStatusKey = (context: ManagerWorkspaceContext): ManagerModuleStatusKey =>
  context.modules.events.visible && hasManagerAssignedScope(context) ? 'readOnly' : 'unavailable';

const getManagerRevenueStatusKey = (context: ManagerWorkspaceContext): ManagerModuleStatusKey =>
  context.modules.revenueSource.visible && context.scopes.talentGroups.length > 0
    ? 'actionable'
    : 'unavailable';

const getManagerOverviewStatusKey = (context: ManagerWorkspaceContext): ManagerModuleStatusKey => {
  const hasActionableModule =
    getManagerKpiStatusKey(context) === 'actionable' ||
    getManagerWorkStatusKey(context) === 'actionable';

  if (hasManagerAssignedScope(context) && hasActionableModule) {
    return 'actionable';
  }

  return context.readiness.canUseManagerWorkspace ? 'readOnly' : 'unavailable';
};

const buildManagerWorkspaceModuleItems = (
  context: ManagerWorkspaceContext,
  t: (key: string) => string,
): Array<WorkspaceModuleItem<ManagerWorkspaceModuleId>> => {
  const kpiStatusKey = getManagerKpiStatusKey(context);
  const workStatusKey = getManagerWorkStatusKey(context);
  const eventStatusKey = getManagerEventsStatusKey(context);
  const revenueStatusKey = getManagerRevenueStatusKey(context);

  return managerWorkspaceModules.map((module) => {
    const isKpiDisabled = module.id === 'kpi' && !context.modules.kpi.visible;
    const isWorkDisabled = module.id === 'work' && !context.modules.workShifts.visible;
    const isEventsDisabled = module.id === 'events' && !context.modules.events.visible;
    const isRevenueDisabled = module.id === 'revenue' && !context.modules.revenueSource.visible;
    const isUnsupported = disabledManagerModuleIds.has(module.id);
    const disabledReason =
      isUnsupported || isKpiDisabled || isWorkDisabled || isEventsDisabled || isRevenueDisabled
        ? t(`manager-workspace:modules.${module.id}.disabledReason`)
        : undefined;

    return {
      id: module.id,
      icon: module.icon,
      label: t(`manager-workspace:modules.${module.id}.title`),
      description: t(`manager-workspace:modules.${module.id}.summary`),
      statusLabel: t(
        `manager-workspace:status.${
          isUnsupported || isKpiDisabled || isWorkDisabled || isEventsDisabled || isRevenueDisabled
            ? 'unavailable'
            : module.id === 'kpi'
              ? kpiStatusKey
              : module.id === 'work'
                ? workStatusKey
                : module.id === 'revenue'
                  ? revenueStatusKey
                  : module.id === 'events'
                    ? eventStatusKey
                    : 'readOnly'
        }`,
      ),
      statusTone:
        isUnsupported || isKpiDisabled || isWorkDisabled || isEventsDisabled || isRevenueDisabled
          ? 'warning'
          : (module.id === 'work' && workStatusKey === 'actionable') ||
              (module.id === 'kpi' && kpiStatusKey === 'actionable') ||
              (module.id === 'revenue' && revenueStatusKey === 'actionable')
            ? 'success'
            : 'neutral',
      disabled:
        isUnsupported || isKpiDisabled || isWorkDisabled || isEventsDisabled || isRevenueDisabled,
      disabledReason,
    };
  });
};

const getDisabledModulePanelCopy = (
  moduleId: ManagerWorkspaceModuleId,
  t: (key: string) => string,
): { title: string; message: string; badgeLabel: string } => ({
  title: t(`manager-workspace:modules.${moduleId}.title`),
  message: t(`manager-workspace:modules.${moduleId}.readinessMessage`),
  badgeLabel: t('manager-workspace:status.unavailable'),
});

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
                  to={APP_PATHS.managerKpiPlanDetail(plan.id)}
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

type ManagerWorkTab = 'published' | 'requests' | 'availability';
type DraftRequestLine = ManagerSubmitRequestBatchLinePayload & {
  localId: string;
  startLocal: string;
  endLocal: string;
};

const requestTypeOptions: readonly ManagerWorkScheduleRequestType[] = [
  'CREATE_SHIFT',
  'RESCHEDULE_SHIFT',
  'CANCEL_SHIFT',
];

const getHcmMonth = (timestamp = Date.now()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(timestamp));
  return `${parts.find((part) => part.type === 'year')?.value}-${
    parts.find((part) => part.type === 'month')?.value
  }`;
};

const getAllowedRequestMonths = (): string[] => {
  const [yearText, monthText] = getHcmMonth().split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return [0, 1, 2].map((offset) => {
    const monthIndex = month - 1 + offset;
    const nextYear = year + Math.floor(monthIndex / 12);
    const nextMonth = (monthIndex % 12) + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  });
};

const hcmLocalToTimestamp = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(`${value}:00+07:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const timestampToDateTimeLocal = (value: number): string => {
  const date = new Date(value + 7 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
};

const createDraftLine = (
  requestType: ManagerWorkScheduleRequestType,
  memberEmploymentProfileId: string,
  workShiftId?: string,
): DraftRequestLine => ({
  localId: `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  requestType,
  memberEmploymentProfileId,
  ...(workShiftId ? { workShiftId } : {}),
  requestedStartAt: null,
  requestedEndAt: null,
  timezone: 'Asia/Ho_Chi_Minh',
  title: requestType === 'CREATE_SHIFT' ? 'Schedule change request' : null,
  reason: '',
  startLocal: '',
  endLocal: '',
});

const formatManagerRequestTimestamp = (value: number | null, timezone = 'Asia/Ho_Chi_Minh') =>
  value === null
    ? '-'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(value);

const lineDecisionText = (line: ManagerRequestBatchLine): string | null =>
  line.failureReason ??
  line.rejectionReason ??
  line.cancellationReason ??
  line.approvalNote ??
  null;

const canViewPlanForManagerContext = (
  context: ManagerWorkspaceContext,
  plan: KpiPlanDetail,
): boolean => {
  if (plan.subjectType === 'ORG_UNIT') {
    return (
      context.modules.kpi.unitKpiVisible &&
      context.scopes.orgUnits.some((scope) => scope.orgUnitId === plan.subjectId)
    );
  }

  if (plan.subjectType === 'TALENT_GROUP') {
    return (
      context.modules.kpi.talentGroupKpiVisible &&
      context.scopes.talentGroups.some((scope) => scope.talentGroupId === plan.subjectId)
    );
  }

  return false;
};

const findOrgUnitScopeForPlan = (
  context: ManagerWorkspaceContext,
  plan: KpiPlanDetail,
): ManagerWorkspaceOrgUnitScope | undefined => {
  if (plan.subjectType !== 'ORG_UNIT') {
    return undefined;
  }

  return context.scopes.orgUnits.find((scope) => scope.orgUnitId === plan.subjectId);
};

const createOrgUnitOperationsPolicy = (
  scope: ManagerWorkspaceOrgUnitScope | undefined,
  plan: KpiPlanDetail,
  disabledReason: string,
): KpiOrgUnitOperationsActionPolicy => {
  const canWriteDirectUnit =
    plan.status === 'PUBLISHED' &&
    Boolean(scope) &&
    scope?.role === 'UNIT_MANAGER' &&
    scope.includeDescendants === false;
  const kpiCapabilities = scope?.capabilities.kpi;

  return {
    canDraftAllocation: canWriteDirectUnit && Boolean(kpiCapabilities?.manageAllocation),
    canSubmitAllocation: canWriteDirectUnit && Boolean(kpiCapabilities?.manageAllocation),
    canEnterActual: canWriteDirectUnit && Boolean(kpiCapabilities?.enterActual),
    canCorrectActual: canWriteDirectUnit && Boolean(kpiCapabilities?.correctActual),
    canReviewAllocation: false,
    disabledReason,
  };
};

const ManagerKpiDetail = ({ context }: { context: ManagerWorkspaceContext }): JSX.Element => {
  const { t } = useTranslation(['manager-workspace', 'kpi']);
  const { kpiPlanId } = useParams<{ kpiPlanId: string }>();
  const detailQuery = useKpiPlanDetail(context.modules.kpi.visible ? kpiPlanId : undefined);
  const plan = detailQuery.data;
  const subjectName = plan ? getSubjectName(plan, t('manager-workspace:values.notAvailable')) : '';
  const allocationStatusCounts = useMemo(() => {
    if (!plan) {
      return [];
    }

    const counts = new Map<string, number>();
    plan.allocations.forEach((allocation) => {
      counts.set(allocation.allocationStatus, (counts.get(allocation.allocationStatus) ?? 0) + 1);
    });

    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [plan]);

  if (!context.modules.kpi.visible) {
    return (
      <EmptyState
        title={t('manager-workspace:empty.kpiTitle')}
        message={t('manager-workspace:empty.kpiMessage')}
      />
    );
  }

  if (detailQuery.isLoading) {
    return <LoadingState lines={5} />;
  }

  if (detailQuery.isError) {
    return (
      <ErrorState
        title={t('manager-workspace:errors.kpiDetailTitle')}
        message={t('manager-workspace:errors.kpiDetailMessage')}
      />
    );
  }

  if (!plan || !canViewPlanForManagerContext(context, plan)) {
    return (
      <EmptyState
        title={t('manager-workspace:empty.kpiDetailUnavailableTitle')}
        message={t('manager-workspace:empty.kpiDetailUnavailableMessage')}
      />
    );
  }

  const orgUnitScope = findOrgUnitScopeForPlan(context, plan);
  const orgUnitOperationsPolicy = createOrgUnitOperationsPolicy(
    orgUnitScope,
    plan,
    t('manager-workspace:kpi.detail.readOnlyPosture'),
  );

  return (
    <div className="space-y-4" data-testid="manager-kpi-detail">
      <section className="space-y-4 rounded border border-border bg-panel p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <DetailBackLink
              to={APP_PATHS.managerKpi}
              label={t('manager-workspace:actions.backToKpi')}
            />
            <h2 className="mt-2 text-lg font-semibold text-text">{plan.title}</h2>
            <p className="font-mono text-xs text-muted">{plan.planCode}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={t(`kpi:subjectTypes.${plan.subjectType}`)}
              tone={plan.subjectType === 'ORG_UNIT' ? 'info' : 'success'}
              uppercase={false}
            />
            <StatusBadge
              label={t(`kpi:statuses.${plan.status}`)}
              status={plan.status}
              toneByStatus={statusTone}
            />
          </div>
        </div>

        <dl className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-border bg-bg px-3 py-2">
            <dt className="text-xs font-medium uppercase text-muted">
              {t('manager-workspace:kpi.detail.subject')}
            </dt>
            <dd className="mt-1 text-sm font-medium text-text">{subjectName}</dd>
          </div>
          <div className="rounded border border-border bg-bg px-3 py-2">
            <dt className="text-xs font-medium uppercase text-muted">
              {t('manager-workspace:kpi.fields.period')}
            </dt>
            <dd className="mt-1 text-sm font-medium text-text">{plan.periodMonth}</dd>
          </div>
          <div className="rounded border border-border bg-bg px-3 py-2">
            <dt className="text-xs font-medium uppercase text-muted">
              {t('manager-workspace:kpi.detail.timezone')}
            </dt>
            <dd className="mt-1 text-sm font-medium text-text">{plan.timezone}</dd>
          </div>
          <div className="rounded border border-border bg-bg px-3 py-2">
            <dt className="text-xs font-medium uppercase text-muted">
              {t('manager-workspace:kpi.detail.allocationCount')}
            </dt>
            <dd className="mt-1 text-sm font-medium text-text">{plan.allocations.length}</dd>
          </div>
        </dl>

        {plan.description ? (
          <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-text">
            <div className="text-xs font-medium uppercase text-muted">
              {t('manager-workspace:kpi.detail.description')}
            </div>
            <p className="mt-1">{plan.description}</p>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded border border-border">
          <table
            className="min-w-full text-left text-sm"
            aria-label={t('manager-workspace:kpi.detail.metricsTableLabel')}
          >
            <thead className="border-b border-border text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {t('manager-workspace:kpi.detail.metric')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('manager-workspace:kpi.detail.target')}
                </th>
                <th className="px-3 py-2 font-medium">{t('manager-workspace:kpi.detail.unit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plan.targetMetrics.map((metric) => (
                <tr key={metric.id} data-testid="manager-kpi-detail-metric-row">
                  <td className="px-3 py-3 font-medium text-text">
                    {t(`kpi:metricCodes.${metric.metricCode}`)}
                  </td>
                  <td className="px-3 py-3">
                    {formatKpiNumber(metric.metricCode, metric.targetValue)}
                  </td>
                  <td className="px-3 py-3">
                    {t(`manager-workspace:kpi.detail.units.${metric.unit}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded border border-border bg-bg px-3 py-2">
          <h3 className="text-sm font-semibold text-text">
            {t('manager-workspace:kpi.detail.allocationSummary')}
          </h3>
          {allocationStatusCounts.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {allocationStatusCounts.map(([status, count]) => (
                <StatusBadge
                  key={status}
                  label={`${t(`kpi:allocationStatuses.${status}`)}: ${count}`}
                  status={status}
                  toneByStatus={statusTone}
                  uppercase={false}
                />
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted">
              {t('manager-workspace:kpi.detail.noAllocations')}
            </p>
          )}
        </div>
      </section>

      {plan.subjectType === 'ORG_UNIT' ? (
        <KpiOrgUnitOperationsSection
          plan={plan}
          actionPolicy={orgUnitOperationsPolicy}
          excludedEmploymentProfileId={context.employmentProfile?.id}
        />
      ) : (
        <section className="rounded border border-border bg-panel p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-text">
            {t('manager-workspace:kpi.detail.talentGroupReadOnlyTitle')}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {t('manager-workspace:kpi.detail.talentGroupReadOnlyMessage')}
          </p>
        </section>
      )}
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
        <StatusBadge label={t('manager-workspace:status.scopeLabel')} tone="neutral" />
      </div>
      <p className="mb-4 rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
        {t('manager-workspace:kpi.boundary')}
      </p>

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

const ManagerWorkSlice = ({ context }: { context: ManagerWorkspaceContext }): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const [month, setMonth] = useState('');
  const [activeTab, setActiveTab] = useState<ManagerWorkTab>('published');
  const [periodMonth, setPeriodMonth] = useState(getHcmMonth());
  const [batchNote, setBatchNote] = useState('');
  const [draftLines, setDraftLines] = useState<DraftRequestLine[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>();
  const [cancelReason, setCancelReason] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const workShiftsQuery = useManagerWorkShifts(
    month || undefined,
    context.modules.workShifts.visible && activeTab !== 'availability',
  );
  const data = workShiftsQuery.data;
  const requestBatchesQuery = useManagerRequestBatches(
    { periodMonth: periodMonth || undefined },
    context.modules.workShifts.visible && activeTab === 'requests',
  );
  const selectedBatchIdOrFirst = selectedBatchId ?? requestBatchesQuery.data?.items[0]?.id;
  const requestBatchDetailQuery = useManagerRequestBatchDetail(
    selectedBatchIdOrFirst,
    context.modules.workShifts.visible && activeTab === 'requests',
  );
  const submitBatchMutation = useSubmitManagerRequestBatchMutation();
  const cancelBatchMutation = useCancelManagerRequestBatchMutation();
  const cancelLineMutation = useCancelManagerRequestLineMutation();
  const allowedMonths = useMemo(() => getAllowedRequestMonths(), []);
  const managedMembers = useMemo(() => {
    const members = new Map<string, ManagerWorkShiftList['items'][number]['member']>();
    data?.items.forEach((shift) => {
      members.set(shift.member.employmentProfileId, shift.member);
    });
    return [...members.values()];
  }, [data]);
  const activeShiftOptions = data?.items ?? [];

  if (!context.modules.workShifts.visible) {
    return (
      <EmptyState
        title={t('manager-workspace:empty.workReadinessTitle')}
        message={t('manager-workspace:empty.workReadinessMessage')}
      />
    );
  }

  const addLine = (requestType: ManagerWorkScheduleRequestType): void => {
    const firstMember = managedMembers[0];
    if (!firstMember || draftLines.length >= 50) {
      setValidationMessage(t('manager-workspace:requests.validation.maxLines'));
      return;
    }
    const firstShift = activeShiftOptions[0];
    const line = createDraftLine(
      requestType,
      firstMember.employmentProfileId,
      requestType === 'CREATE_SHIFT' ? undefined : firstShift?.workShiftId,
    );
    if (firstShift && requestType === 'RESCHEDULE_SHIFT') {
      line.startLocal = timestampToDateTimeLocal(firstShift.shiftStartAt);
      line.endLocal = timestampToDateTimeLocal(firstShift.shiftEndAt);
      line.requestedStartAt = firstShift.shiftStartAt;
      line.requestedEndAt = firstShift.shiftEndAt;
    }
    setDraftLines((current) => [...current, line]);
    setValidationMessage(null);
  };

  const updateLine = (localId: string, patch: Partial<DraftRequestLine>): void => {
    setDraftLines((current) =>
      current.map((line) => (line.localId === localId ? { ...line, ...patch } : line)),
    );
  };

  const validateDraft = (): string | null => {
    if (!allowedMonths.includes(periodMonth)) {
      return t('manager-workspace:requests.validation.periodWindow');
    }
    if (draftLines.length === 0) {
      return t('manager-workspace:requests.validation.noLines');
    }
    if (draftLines.length > 50) {
      return t('manager-workspace:requests.validation.maxLines');
    }
    const seen = new Set<string>();
    for (const line of draftLines) {
      const reasonLength = line.reason.trim().length;
      if (reasonLength < 10 || reasonLength > 1000) {
        return t('manager-workspace:requests.validation.reason');
      }
      if (line.requestType !== 'CREATE_SHIFT' && !line.workShiftId) {
        return t('manager-workspace:requests.validation.shiftRequired');
      }
      if (line.requestType !== 'CANCEL_SHIFT') {
        if (line.requestedStartAt === null || line.requestedEndAt === null) {
          return t('manager-workspace:requests.validation.windowRequired');
        }
        if ((line.requestedEndAt ?? 0) <= (line.requestedStartAt ?? 0)) {
          return t('manager-workspace:requests.validation.windowOrder');
        }
        if (getHcmMonth(line.requestedStartAt) !== periodMonth) {
          return t('manager-workspace:requests.validation.lineMonth');
        }
      }
      const fingerprint = [
        line.requestType,
        line.memberEmploymentProfileId,
        line.workShiftId ?? '',
        line.requestedStartAt ?? '',
        line.requestedEndAt ?? '',
      ].join('|');
      if (seen.has(fingerprint)) {
        return t('manager-workspace:requests.validation.duplicate');
      }
      seen.add(fingerprint);
    }
    return null;
  };

  const submitDraft = async (): Promise<void> => {
    const validation = validateDraft();
    setValidationMessage(validation);
    if (validation) {
      return;
    }
    const payloadLines = draftLines.map((line) => ({
      requestType: line.requestType,
      memberEmploymentProfileId: line.memberEmploymentProfileId,
      workShiftId: line.requestType === 'CREATE_SHIFT' ? null : (line.workShiftId ?? null),
      requestedStartAt: line.requestType === 'CANCEL_SHIFT' ? null : line.requestedStartAt,
      requestedEndAt: line.requestType === 'CANCEL_SHIFT' ? null : line.requestedEndAt,
      timezone: 'Asia/Ho_Chi_Minh' as const,
      title: line.requestType === 'CREATE_SHIFT' ? line.title : null,
      description: line.description ?? null,
      externalRef: line.externalRef ?? null,
      reason: line.reason,
    }));
    const batch = await submitBatchMutation.mutateAsync({
      payload: {
        periodMonth,
        clientToken: `manager-ui-${Date.now()}`,
        note: batchNote,
        lines: payloadLines,
      },
    });
    setSelectedBatchId(batch.id);
    setDraftLines([]);
    setBatchNote('');
  };

  return (
    <section
      className="space-y-4 rounded border border-border bg-panel p-4 shadow-sm"
      data-testid="manager-work-panel"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">{t('manager-workspace:work.title')}</h2>
          <p className="text-sm text-muted">{t('manager-workspace:work.summary')}</p>
        </div>
        <StatusBadge label={t('manager-workspace:work.scopeBadge')} tone="neutral" />
      </div>
      <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
        {t('manager-workspace:work.boundary')}
      </p>

      <div className="flex flex-wrap gap-2" role="tablist">
        {(['published', 'requests', 'availability'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium ${
              activeTab === tab
                ? 'border-text bg-text text-bg'
                : 'border-border bg-bg text-text hover:bg-panel'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'published' ? (
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            ) : tab === 'availability' ? (
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {t(`manager-workspace:work.tabs.${tab}`)}
          </button>
        ))}
      </div>

      <ManagerWorkActionNeeded
        periodMonth={periodMonth}
        enabled={context.modules.workShifts.visible}
        onSelectTab={setActiveTab}
      />

      {activeTab === 'published' ? (
        <label className="block max-w-xs text-sm font-medium text-text">
          {t('manager-workspace:work.month')}
          <input
            className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      ) : null}

      {activeTab !== 'availability' && workShiftsQuery.isLoading ? (
        <LoadingState lines={4} />
      ) : null}
      {activeTab !== 'availability' && workShiftsQuery.isError ? (
        <ErrorState
          title={t('manager-workspace:errors.workTitle')}
          message={t('manager-workspace:errors.workMessage')}
        />
      ) : null}

      {data && activeTab === 'published' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label={t('manager-workspace:work.shiftsShown')}
              value={data.meta.returnedShiftCount}
            />
            <SummaryCard
              label={t('manager-workspace:work.membersRepresented')}
              value={data.meta.representedMemberCount}
            />
            <SummaryCard label={t('manager-workspace:work.period')} value={data.meta.month} />
          </div>
          {data.items.length === 0 ? (
            <EmptyState
              title={t('manager-workspace:empty.workTitle')}
              message={
                data.meta.managedMemberCount === 0
                  ? t('manager-workspace:empty.workNoMembersMessage')
                  : t('manager-workspace:empty.workMessage')
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table
                className="min-w-full text-left text-sm"
                aria-label={t('manager-workspace:work.tableLabel')}
              >
                <thead className="border-b border-border text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t('manager-workspace:work.dateTime')}
                    </th>
                    <th className="px-3 py-2 font-medium">{t('manager-workspace:work.member')}</th>
                    <th className="px-3 py-2 font-medium">{t('manager-workspace:work.shift')}</th>
                    <th className="px-3 py-2 font-medium">{t('manager-workspace:work.source')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((shift) => (
                    <tr key={shift.workShiftId} data-testid="manager-work-shift-row">
                      <td className="px-3 py-3">
                        <div>
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: 'medium',
                            timeZone: shift.timezone,
                          }).format(shift.shiftStartAt)}
                        </div>
                        <div className="text-xs text-muted">
                          {new Intl.DateTimeFormat(undefined, {
                            timeStyle: 'short',
                            timeZone: shift.timezone,
                          }).format(shift.shiftStartAt)}
                          {' - '}
                          {new Intl.DateTimeFormat(undefined, {
                            timeStyle: 'short',
                            timeZone: shift.timezone,
                          }).format(shift.shiftEndAt)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-text">{shift.member.displayName}</div>
                        {shift.member.employeeCode ? (
                          <div className="font-mono text-xs text-muted">
                            {shift.member.employeeCode}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div>{shift.title}</div>
                        <StatusBadge label={t('manager-workspace:work.active')} tone="success" />
                      </td>
                      <td className="px-3 py-3">
                        {t(`manager-workspace:work.sourceTypes.${shift.sourceType}`)}
                        {shift.sourceRosterMonth ? (
                          <div className="text-xs text-muted">{shift.sourceRosterMonth}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted">{t('manager-workspace:work.draftNotice')}</p>
        </>
      ) : null}

      {data && activeTab === 'requests' ? (
        <div className="space-y-4" data-testid="manager-work-requests">
          <div className="rounded border border-border bg-bg p-3 text-sm text-muted">
            <p>{t('manager-workspace:requests.copy.approval')}</p>
            <p>{t('manager-workspace:requests.copy.draftRoster')}</p>
            <p>{t('manager-workspace:requests.copy.cancellation')}</p>
            <p>{t('manager-workspace:requests.copy.taxonomy')}</p>
          </div>

          {managedMembers.length === 0 ? (
            <EmptyState
              title={t('manager-workspace:requests.empty.noMembersTitle')}
              message={t('manager-workspace:requests.empty.noMembersMessage')}
            />
          ) : (
            <div className="space-y-4 rounded border border-border bg-bg p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-text">
                    {t('manager-workspace:requests.fields.periodMonth')}
                    <select
                      className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
                      value={periodMonth}
                      onChange={(event) => setPeriodMonth(event.target.value)}
                    >
                      {allowedMonths.map((allowedMonth) => (
                        <option key={allowedMonth} value={allowedMonth}>
                          {allowedMonth}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-text">
                    {t('manager-workspace:requests.fields.note')}
                    <input
                      className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
                      value={batchNote}
                      onChange={(event) => setBatchNote(event.target.value)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {requestTypeOptions.map((requestType) => (
                    <button
                      key={requestType}
                      type="button"
                      className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-medium text-text hover:bg-panel disabled:opacity-50"
                      disabled={
                        draftLines.length >= 50 ||
                        (requestType !== 'CREATE_SHIFT' && activeShiftOptions.length === 0)
                      }
                      onClick={() => addLine(requestType)}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {t(`manager-workspace:requests.actions.add.${requestType}`)}
                    </button>
                  ))}
                </div>
              </div>

              {draftLines.length > 0 ? (
                <div className="space-y-3">
                  {draftLines.map((line, index) => (
                    <div key={line.localId} className="rounded border border-border bg-panel p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-text">
                          {t('manager-workspace:requests.lineTitle', { lineNo: index + 1 })}
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center rounded border border-border p-2 text-text hover:bg-bg"
                          aria-label={t('manager-workspace:requests.actions.removeLine')}
                          onClick={() =>
                            setDraftLines((current) =>
                              current.filter((item) => item.localId !== line.localId),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="text-sm font-medium text-text">
                          {t('manager-workspace:requests.fields.type')}
                          <select
                            className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                            value={line.requestType}
                            onChange={(event) => {
                              const requestType = event.target
                                .value as ManagerWorkScheduleRequestType;
                              updateLine(line.localId, {
                                requestType,
                                workShiftId:
                                  requestType === 'CREATE_SHIFT'
                                    ? null
                                    : (activeShiftOptions[0]?.workShiftId ?? ''),
                              });
                            }}
                          >
                            {requestTypeOptions.map((requestType) => (
                              <option key={requestType} value={requestType}>
                                {t(`manager-workspace:requests.types.${requestType}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm font-medium text-text">
                          {t('manager-workspace:requests.fields.member')}
                          <select
                            className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                            value={line.memberEmploymentProfileId}
                            onChange={(event) =>
                              updateLine(line.localId, {
                                memberEmploymentProfileId: event.target.value,
                              })
                            }
                          >
                            {managedMembers.map((member) => (
                              <option
                                key={member.employmentProfileId}
                                value={member.employmentProfileId}
                              >
                                {member.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                        {line.requestType !== 'CREATE_SHIFT' ? (
                          <label className="text-sm font-medium text-text">
                            {t('manager-workspace:requests.fields.workShift')}
                            <select
                              className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                              value={line.workShiftId ?? ''}
                              onChange={(event) => {
                                const shift = activeShiftOptions.find(
                                  (item) => item.workShiftId === event.target.value,
                                );
                                updateLine(line.localId, {
                                  workShiftId: event.target.value,
                                  memberEmploymentProfileId:
                                    shift?.member.employmentProfileId ??
                                    line.memberEmploymentProfileId,
                                });
                              }}
                            >
                              {activeShiftOptions.map((shift) => (
                                <option key={shift.workShiftId} value={shift.workShiftId}>
                                  {shift.title} - {shift.member.displayName}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        {line.requestType === 'CREATE_SHIFT' ? (
                          <label className="text-sm font-medium text-text md:col-span-3">
                            {t('manager-workspace:requests.fields.title')}
                            <input
                              className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                              value={line.title ?? ''}
                              onChange={(event) =>
                                updateLine(line.localId, { title: event.target.value })
                              }
                            />
                          </label>
                        ) : null}
                        {line.requestType !== 'CANCEL_SHIFT' ? (
                          <>
                            <label className="text-sm font-medium text-text">
                              {t('manager-workspace:requests.fields.start')}
                              <input
                                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                                type="datetime-local"
                                value={line.startLocal}
                                onChange={(event) =>
                                  updateLine(line.localId, {
                                    startLocal: event.target.value,
                                    requestedStartAt: hcmLocalToTimestamp(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="text-sm font-medium text-text">
                              {t('manager-workspace:requests.fields.end')}
                              <input
                                className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                                type="datetime-local"
                                value={line.endLocal}
                                onChange={(event) =>
                                  updateLine(line.localId, {
                                    endLocal: event.target.value,
                                    requestedEndAt: hcmLocalToTimestamp(event.target.value),
                                  })
                                }
                              />
                            </label>
                          </>
                        ) : null}
                        <label className="text-sm font-medium text-text md:col-span-3">
                          {t('manager-workspace:requests.fields.reason')}
                          <textarea
                            className="mt-1 min-h-20 w-full rounded border border-border bg-bg px-3 py-2"
                            value={line.reason}
                            onChange={(event) =>
                              updateLine(line.localId, { reason: event.target.value })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {validationMessage ? (
                <p className="text-sm text-danger">{validationMessage}</p>
              ) : null}
              {submitBatchMutation.isError ? (
                <p className="text-sm text-danger">
                  {t('manager-workspace:requests.feedback.submitFailed')}
                </p>
              ) : null}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={draftLines.length === 0 || submitBatchMutation.isPending}
                onClick={() => void submitDraft()}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {t('manager-workspace:requests.actions.submit')}
              </button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text">
                {t('manager-workspace:requests.ownBatches')}
              </h3>
              {requestBatchesQuery.isLoading ? <LoadingState lines={3} /> : null}
              {requestBatchesQuery.data?.items.length === 0 ? (
                <EmptyState
                  title={t('manager-workspace:requests.empty.noBatchesTitle')}
                  message={t('manager-workspace:requests.empty.noBatchesMessage')}
                />
              ) : null}
              {requestBatchesQuery.data?.items.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  className={`w-full rounded border px-3 py-2 text-left ${
                    selectedBatchIdOrFirst === batch.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-bg hover:bg-panel'
                  }`}
                  onClick={() => setSelectedBatchId(batch.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted">{batch.batchCode}</span>
                    <StatusBadge
                      label={t(`manager-workspace:requests.statuses.${batch.status}`)}
                      status={batch.status}
                      toneByStatus={batchStatusTone}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {t('manager-workspace:requests.counts', batch.lineCounts)}
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-3 rounded border border-border bg-bg p-3">
              {requestBatchDetailQuery.isLoading ? <LoadingState lines={4} /> : null}
              {requestBatchDetailQuery.data ? (
                <>
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-semibold text-text">
                        {requestBatchDetailQuery.data.batchCode}
                      </h3>
                      <p className="text-sm text-muted">
                        {requestBatchDetailQuery.data.periodMonth}
                      </p>
                    </div>
                    <StatusBadge
                      label={t(
                        `manager-workspace:requests.statuses.${requestBatchDetailQuery.data.status}`,
                      )}
                      status={requestBatchDetailQuery.data.status}
                      toneByStatus={batchStatusTone}
                    />
                  </div>
                  {requestBatchDetailQuery.data.status === 'PENDING' ? (
                    <div className="flex flex-col gap-2 md:flex-row md:items-end">
                      <label className="flex-1 text-sm font-medium text-text">
                        {t('manager-workspace:requests.fields.cancellationReason')}
                        <input
                          className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
                          value={cancelReason}
                          onChange={(event) => setCancelReason(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="rounded border border-border px-3 py-2 text-sm font-medium text-text disabled:opacity-50"
                        disabled={cancelReason.trim().length < 10 || cancelBatchMutation.isPending}
                        onClick={() =>
                          void cancelBatchMutation.mutateAsync({
                            batchId: requestBatchDetailQuery.data.id,
                            payload: { cancellationReason: cancelReason },
                          })
                        }
                      >
                        {t('manager-workspace:requests.actions.cancelBatch')}
                      </button>
                    </div>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <tbody className="divide-y divide-border">
                        {requestBatchDetailQuery.data.lines.map((line) => (
                          <tr key={line.id} data-testid="manager-request-line">
                            <td className="px-3 py-3">
                              <div className="font-medium text-text">
                                {t(`manager-workspace:requests.types.${line.requestType}`)}
                              </div>
                              <div className="text-xs text-muted">{line.member.displayName}</div>
                              <div className="text-xs text-muted">
                                {formatManagerRequestTimestamp(
                                  line.requestedStartAt,
                                  line.timezone,
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge
                                label={t(`manager-workspace:requests.lineStatuses.${line.status}`)}
                                status={line.status}
                                toneByStatus={batchStatusTone}
                              />
                              {lineDecisionText(line) ? (
                                <div className="mt-1 text-xs text-muted">
                                  {lineDecisionText(line)}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {line.status === 'PENDING' ? (
                                <button
                                  type="button"
                                  className="rounded border border-border px-3 py-2 text-sm font-medium text-text disabled:opacity-50"
                                  disabled={
                                    cancelReason.trim().length < 10 || cancelLineMutation.isPending
                                  }
                                  onClick={() =>
                                    void cancelLineMutation.mutateAsync({
                                      batchId: requestBatchDetailQuery.data.id,
                                      lineId: line.id,
                                      payload: { cancellationReason: cancelReason },
                                    })
                                  }
                                >
                                  {t('manager-workspace:requests.actions.cancelLine')}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'availability' ? (
        <ManagerAvailabilityPanel context={context} allowedMonths={allowedMonths} />
      ) : null}
    </section>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: string | number }): JSX.Element => (
  <div className="rounded border border-border bg-bg px-3 py-2">
    <div className="text-xs font-medium uppercase text-muted">{label}</div>
    <div className="mt-1 text-lg font-semibold text-text">{value}</div>
  </div>
);

const ManagerWorkspaceOverview = ({
  context,
}: {
  context: ManagerWorkspaceContext;
}): JSX.Element => {
  const { t } = useTranslation(['manager-workspace', 'common']);
  const disabledModules: ManagerWorkspaceModuleId[] = ['events', 'groups', 'members'];
  const kpiStatusKey = getManagerKpiStatusKey(context);
  const overviewStatusKey = getManagerOverviewStatusKey(context);

  return (
    <div className="space-y-4" data-testid="manager-overview-panel">
      <div className="grid gap-4 lg:grid-cols-3">
        <section
          className="rounded border border-border bg-panel p-4 shadow-sm"
          data-testid="manager-overview-readiness-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text">
                {t('manager-workspace:overview.readinessTitle')}
              </h2>
              <p className="text-sm text-muted">
                {t('manager-workspace:overview.readinessSummary')}
              </p>
            </div>
            <StatusBadge
              label={t(`manager-workspace:status.${overviewStatusKey}`)}
              tone={
                overviewStatusKey === 'actionable'
                  ? 'success'
                  : overviewStatusKey === 'readOnly'
                    ? 'neutral'
                    : 'warning'
              }
              uppercase={false}
            />
          </div>
          {context.readiness.reasons.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {context.readiness.reasons.map((reason) => (
                <StatusBadge
                  key={reason}
                  label={t(`manager-workspace:readiness.${reason}`)}
                  tone="warning"
                  uppercase={false}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {t('manager-workspace:overview.readyMessage')}
            </p>
          )}
        </section>

        <section
          className="rounded border border-border bg-panel p-4 shadow-sm"
          data-testid="manager-overview-kpi-card"
        >
          <h2 className="text-lg font-semibold text-text">
            {t('manager-workspace:overview.kpiTitle')}
          </h2>
          <p className="text-sm text-muted">{t('manager-workspace:overview.kpiSummary')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label={t(`manager-workspace:status.${kpiStatusKey}`)}
              tone={
                kpiStatusKey === 'actionable'
                  ? 'success'
                  : kpiStatusKey === 'readOnly'
                    ? 'neutral'
                    : 'warning'
              }
              uppercase={false}
            />
            {context.modules.kpi.unitKpiVisible ? (
              <StatusBadge
                label={t('manager-workspace:kpi.tabs.unit')}
                tone="info"
                uppercase={false}
              />
            ) : null}
            {context.modules.kpi.talentGroupKpiVisible ? (
              <StatusBadge
                label={t('manager-workspace:kpi.tabs.talentGroup')}
                tone="info"
                uppercase={false}
              />
            ) : null}
          </div>
        </section>

        <section className="rounded border border-border bg-panel p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-text">
            {t('manager-workspace:overview.unsupportedTitle')}
          </h2>
          <p className="text-sm text-muted">{t('manager-workspace:overview.unsupportedSummary')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {disabledModules.map((moduleId) => (
              <StatusBadge
                key={moduleId}
                label={t(`manager-workspace:modules.${moduleId}.title`)}
                tone="warning"
                uppercase={false}
              />
            ))}
          </div>
        </section>
      </div>

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
    </div>
  );
};

const ManagerUnsupportedModulePanel = ({
  moduleId,
}: {
  moduleId: ManagerWorkspaceModuleId;
}): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const copy = getDisabledModulePanelCopy(moduleId, t);

  return (
    <WorkspaceReadinessCard
      title={copy.title}
      message={copy.message}
      badgeLabel={copy.badgeLabel}
    />
  );
};

const managerEventStatusTone = {
  DRAFT: 'muted',
  PLANNED: 'info',
  CONFIRMED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  ARCHIVED: 'muted',
} as const;

const managerBookingStatusTone = {
  HELD: 'warning',
  CONFIRMED: 'success',
  RELEASED: 'muted',
  CANCELLED: 'danger',
} as const;

const ManagerEventsSlice = ({ context }: { context: ManagerWorkspaceContext }): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId?: string }>();
  const canReadEvents = context.modules.events.visible && hasManagerAssignedScope(context);
  const listQuery = useManagerEvents({ enabled: canReadEvents });
  const detailQuery = useManagerEventDetail(eventId, {
    enabled: canReadEvents && Boolean(eventId),
  });
  const detail = detailQuery.data;

  if (!canReadEvents) {
    return (
      <WorkspaceReadinessCard
        title={t('manager-workspace:events.noScopeTitle')}
        message={t('manager-workspace:events.noScopeMessage')}
        badgeLabel={t('manager-workspace:status.readOnly')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <WorkspaceReadinessCard
        title={t('manager-workspace:events.title')}
        message={t('manager-workspace:events.boundaryHelper')}
        badgeLabel={t('manager-workspace:status.readOnly')}
      />
      {eventId ? (
        <div className="space-y-3">
          <DetailBackLink
            to={APP_PATHS.managerEvents}
            label={t('manager-workspace:events.backToList')}
          />
          {detailQuery.isLoading ? <LoadingState lines={5} /> : null}
          {detailQuery.isError ? (
            <ErrorState
              title={t('manager-workspace:events.notFoundTitle')}
              message={t('manager-workspace:events.notFoundMessage')}
            />
          ) : null}
          {detail ? <ManagerEventSummaryCard event={detail} /> : null}
        </div>
      ) : (
        <>
          {listQuery.isLoading ? <LoadingState lines={5} /> : null}
          {listQuery.isError ? (
            <ErrorState
              title={t('manager-workspace:events.loadErrorTitle')}
              message={t('manager-workspace:events.loadErrorMessage')}
              actionLabel={t('manager-workspace:actions.retry')}
              onRetry={() => void listQuery.refetch()}
            />
          ) : null}
          {listQuery.data?.length === 0 ? (
            <EmptyState
              title={t('manager-workspace:events.emptyTitle')}
              message={t('manager-workspace:events.emptyMessage')}
            />
          ) : null}
          <div className="grid grid-cols-1 gap-3">
            {(listQuery.data ?? []).map((event) => (
              <button
                key={event.id}
                type="button"
                className="rounded border border-border bg-panel p-4 text-left hover:border-accent"
                onClick={() => navigate(APP_PATHS.managerEventDetail(event.id))}
              >
                <ManagerEventSummaryBlock event={event} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ManagerEventSummaryBlock = ({ event }: { event: ManagerEventSummary }): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted">{event.eventCode}</span>
        <StatusBadge
          status={event.status}
          label={t(`manager-workspace:eventStatuses.${event.status}`)}
          toneByStatus={managerEventStatusTone}
        />
      </div>
      <div className="font-medium text-text">{event.title}</div>
      <div className="text-sm text-muted">
        {formatVietnamTimestamp(event.eventStartAt)} - {formatVietnamTimestamp(event.eventEndAt)}
      </div>
      <div className="text-sm text-muted">
        {t('manager-workspace:events.owner')}: {readReferenceDisplay(event.owner)}
      </div>
    </div>
  );
};

const ManagerEventSummaryCard = ({ event }: { event: ManagerEventSummary }): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);

  return (
    <div className="space-y-4">
      <div className="rounded border border-border bg-panel p-4">
        <ManagerEventSummaryBlock event={event} />
      </div>
      <div className="rounded border border-border bg-panel p-4">
        <h3 className="text-sm font-semibold text-text">
          {t('manager-workspace:events.participants')}
        </h3>
        <p className="mt-2 text-sm text-muted">
          {event.participants.length > 0
            ? event.participants.map((participant) => readReferenceDisplay(participant)).join(', ')
            : t('manager-workspace:values.notAvailable')}
        </p>
      </div>
      <div className="rounded border border-border bg-panel p-4">
        <h3 className="text-sm font-semibold text-text">
          {t('manager-workspace:events.completionTitle')}
        </h3>
        {event.completionEvidence ? (
          <div className="mt-2 space-y-2 text-sm text-muted">
            <p>
              {t('manager-workspace:events.completedAt')}:{' '}
              {event.completionEvidence.completedAt
                ? formatVietnamTimestamp(event.completionEvidence.completedAt)
                : t('manager-workspace:values.notAvailable')}
            </p>
            <p>
              {t('manager-workspace:events.completedBy')}:{' '}
              {event.completionEvidence.completedByActorId ??
                t('manager-workspace:values.notAvailable')}
            </p>
            <p>
              {t('manager-workspace:events.evidenceNote')}:{' '}
              {event.completionEvidence.evidenceNote ?? t('manager-workspace:values.notAvailable')}
            </p>
            {event.completionEvidence.evidenceRefs.length > 0 ? (
              <ul className="space-y-1">
                {event.completionEvidence.evidenceRefs.map((ref, index) => (
                  <li key={`${ref.type}-${index}`}>
                    {ref.label ?? t(`manager-workspace:evidenceRefTypes.${ref.type}`)}:{' '}
                    {ref.url ?? ref.referenceId ?? t('manager-workspace:values.notAvailable')}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {t('manager-workspace:events.noCompletionEvidence')}
          </p>
        )}
        <p className="mt-3 text-sm text-muted">
          {t('manager-workspace:events.completionBoundaryHelper')}
        </p>
      </div>
      <div className="rounded border border-border bg-panel p-4">
        <h3 className="text-sm font-semibold text-text">
          {t('manager-workspace:events.bookings')}
        </h3>
        {event.studioBookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('manager-workspace:events.noBookings')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t('manager-workspace:events.resource')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('manager-workspace:events.bookingStatus')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('manager-workspace:events.bookingWindow')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {event.studioBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-3 py-3">{readReferenceDisplay(booking.resource)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        status={booking.status}
                        label={t(`manager-workspace:bookingStatuses.${booking.status}`)}
                        toneByStatus={managerBookingStatusTone}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {formatVietnamTimestamp(booking.bookingStartAt)} -{' '}
                      {formatVietnamTimestamp(booking.bookingEndAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

type ManagerRevenueBatchFormValues = {
  talentGroupId: string;
  platformAccountId: string;
  periodMonth: string;
  sourceDateFrom: string;
  sourceDateTo: string;
};

type ManagerRevenueLineFormValues = {
  memberKey: string;
  sourceDate: string;
  rawQuantity: string;
  externalSourceRef: string;
  notes: string;
};

const ManagerRevenueSourceSlice = ({
  context,
}: {
  context: ManagerWorkspaceContext;
}): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const { notifyError, notifySuccess } = useMutationFeedback();
  const canUseRevenueSource =
    context.modules.revenueSource.visible && context.scopes.talentGroups.length > 0;
  const scopeQuery = useManagerPlatformEarningScope(canUseRevenueSource);
  const [selectedTalentGroupId, setSelectedTalentGroupId] = useState<string>();
  const [selectedBatchId, setSelectedBatchId] = useState<string>();
  const [editingLine, setEditingLine] = useState<ManagerPlatformEarningLine | null>(null);
  const activeTalentGroupId =
    selectedTalentGroupId ?? scopeQuery.data?.talentGroups[0]?.talentGroupId;
  const batchQuery = useManagerPlatformEarningBatches(
    { talentGroupId: activeTalentGroupId },
    canUseRevenueSource && Boolean(activeTalentGroupId),
  );
  const batchDetailQuery = useManagerPlatformEarningBatchDetail(
    selectedBatchId,
    canUseRevenueSource,
  );
  const linesQuery = useManagerPlatformEarningLines(selectedBatchId, canUseRevenueSource);
  const createBatchMutation = useCreateManagerPlatformEarningBatchMutation();
  const addLineMutation = useAddManagerPlatformEarningLineMutation();
  const updateLineMutation = useUpdateManagerPlatformEarningLineMutation();
  const submitBatchMutation = useSubmitManagerPlatformEarningBatchMutation();
  const batchForm = useForm<ManagerRevenueBatchFormValues>({
    defaultValues: {
      talentGroupId: '',
      platformAccountId: '',
      periodMonth: '',
      sourceDateFrom: '',
      sourceDateTo: '',
    },
  });
  const lineForm = useForm<ManagerRevenueLineFormValues>({
    defaultValues: {
      memberKey: '',
      sourceDate: '',
      rawQuantity: '',
      externalSourceRef: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (activeTalentGroupId) {
      batchForm.setValue('talentGroupId', activeTalentGroupId);
    }
  }, [activeTalentGroupId, batchForm]);

  useEffect(() => {
    if (!editingLine) {
      return;
    }
    lineForm.reset({
      memberKey: `${editingLine.memberEmploymentProfileId}|${editingLine.memberTalentId}`,
      sourceDate: new Date(editingLine.sourceDate).toISOString().slice(0, 10),
      rawQuantity: String(editingLine.rawQuantity),
      externalSourceRef: editingLine.externalSourceRef ?? '',
      notes: editingLine.notes ?? '',
    });
  }, [editingLine, lineForm]);

  if (!canUseRevenueSource) {
    return (
      <WorkspaceReadinessCard
        title={t('manager-workspace:revenue.noScopeTitle')}
        message={t('manager-workspace:revenue.noScopeMessage')}
        badgeLabel={t('manager-workspace:status.unavailable')}
      />
    );
  }

  const selectedBatch = batchDetailQuery.data;
  const activeAccounts =
    scopeQuery.data?.platformAccounts.filter(
      (account) => account.ownerTalentGroupId === activeTalentGroupId,
    ) ?? [];
  const activeMembers =
    scopeQuery.data?.talentGroups.find((group) => group.talentGroupId === activeTalentGroupId)
      ?.members ?? [];
  const canEditSelectedBatch = selectedBatch?.status === 'DRAFT';

  const submitBatchForm = batchForm.handleSubmit(async (values) => {
    const from = parseUtcMidnightDateInputValue(values.sourceDateFrom);
    const to = parseUtcMidnightDateInputValue(values.sourceDateTo);
    if (!from || !to || !values.platformAccountId || !values.talentGroupId || !values.periodMonth) {
      return;
    }
    const account = activeAccounts.find((item) => item.id === values.platformAccountId);
    if (!account) return;
    try {
      const batch = await createBatchMutation.mutateAsync({
        payload: {
          platform: account.platform,
          platformAccountId: account.id,
          talentGroupId: values.talentGroupId,
          sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
          periodMonth: values.periodMonth,
          sourceDateFrom: from,
          sourceDateTo: to,
        },
      });
      setSelectedBatchId(batch.id);
      notifySuccess('manager-workspace:revenue.feedback.batchCreated');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  });

  const submitLineForm = lineForm.handleSubmit(async (values) => {
    if (!selectedBatch || !canEditSelectedBatch) return;
    const sourceDate = parseUtcMidnightDateInputValue(values.sourceDate);
    const [memberEmploymentProfileId, memberTalentId] = values.memberKey.split('|');
    const rawQuantity = Number(values.rawQuantity);
    if (
      !sourceDate ||
      !memberEmploymentProfileId ||
      !memberTalentId ||
      !Number.isInteger(rawQuantity)
    ) {
      return;
    }
    try {
      if (editingLine) {
        await updateLineMutation.mutateAsync({
          batchId: selectedBatch.id,
          lineId: editingLine.id,
          payload: {
            sourceDate,
            memberEmploymentProfileId,
            memberTalentId,
            rawQuantity,
            externalSourceRef: values.externalSourceRef.trim() || null,
            notes: values.notes.trim() || null,
          },
        });
        setEditingLine(null);
      } else {
        await addLineMutation.mutateAsync({
          batchId: selectedBatch.id,
          payload: {
            sourceDate,
            memberEmploymentProfileId,
            memberTalentId,
            rawQuantity,
            externalSourceRef: values.externalSourceRef.trim() || null,
            notes: values.notes.trim() || null,
          },
        });
      }
      lineForm.reset({
        memberKey: '',
        sourceDate: '',
        rawQuantity: '',
        externalSourceRef: '',
        notes: '',
      });
      notifySuccess('manager-workspace:revenue.feedback.lineSaved');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  });

  const submitSelectedBatch = async (): Promise<void> => {
    if (!selectedBatch) return;
    try {
      await submitBatchMutation.mutateAsync({ batchId: selectedBatch.id });
      notifySuccess('manager-workspace:revenue.feedback.batchSubmitted');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  return (
    <div className="space-y-4" data-testid="manager-revenue-source-panel">
      <WorkspaceReadinessCard
        title={t('manager-workspace:revenue.title')}
        message={t('manager-workspace:revenue.boundaryHelper')}
        badgeLabel={t('manager-workspace:status.actionable')}
      />

      {scopeQuery.isLoading ? <LoadingState lines={4} /> : null}
      {scopeQuery.isError ? (
        <ErrorState
          title={t('manager-workspace:revenue.loadErrorTitle')}
          message={t('manager-workspace:revenue.loadErrorMessage')}
          actionLabel={t('manager-workspace:actions.retry')}
          onRetry={() => void scopeQuery.refetch()}
        />
      ) : null}

      {scopeQuery.data && activeAccounts.length === 0 ? (
        <EmptyState
          title={t('manager-workspace:revenue.noEligibleAccountTitle')}
          message={t('manager-workspace:revenue.noEligibleAccountMessage')}
        />
      ) : null}

      <form
        className="rounded border border-border bg-panel p-4"
        onSubmit={(event) => void submitBatchForm(event)}
      >
        <h2 className="text-base font-semibold text-text">
          {t('manager-workspace:revenue.createBatchTitle')}
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase text-muted">
              {t('manager-workspace:revenue.fields.talentGroup')}
            </span>
            <select
              className="rounded border border-border bg-bg px-2 py-1.5"
              {...batchForm.register('talentGroupId')}
              value={activeTalentGroupId ?? ''}
              onChange={(event) => {
                setSelectedTalentGroupId(event.target.value);
                batchForm.setValue('talentGroupId', event.target.value);
              }}
            >
              {(scopeQuery.data?.talentGroups ?? []).map((group) => (
                <option key={group.talentGroupId} value={group.talentGroupId}>
                  {context.scopes.talentGroups.find(
                    (scope) => scope.talentGroupId === group.talentGroupId,
                  )?.name ?? group.talentGroupId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase text-muted">
              {t('manager-workspace:revenue.fields.platformAccount')}
            </span>
            <select
              className="rounded border border-border bg-bg px-2 py-1.5"
              {...batchForm.register('platformAccountId')}
            >
              <option value="">{t('manager-workspace:values.notAvailable')}</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName}
                </option>
              ))}
            </select>
          </label>
          <input
            type="month"
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
            aria-label={t('manager-workspace:revenue.fields.periodMonth')}
            {...batchForm.register('periodMonth')}
          />
          <input
            type="date"
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
            aria-label={t('manager-workspace:revenue.fields.sourceDateFrom')}
            {...batchForm.register('sourceDateFrom')}
          />
          <input
            type="date"
            className="rounded border border-border bg-bg px-2 py-1.5 text-sm"
            aria-label={t('manager-workspace:revenue.fields.sourceDateTo')}
            {...batchForm.register('sourceDateTo')}
          />
        </div>
        <button
          type="submit"
          className="mt-3 inline-flex items-center gap-2 rounded border border-accent px-3 py-2 text-sm font-medium text-accent"
          disabled={createBatchMutation.isPending || activeAccounts.length === 0}
        >
          <Plus className="size-4" />
          {t('manager-workspace:revenue.actions.createBatch')}
        </button>
      </form>

      <section className="rounded border border-border bg-panel p-4">
        <h2 className="text-base font-semibold text-text">
          {t('manager-workspace:revenue.ownBatches')}
        </h2>
        <div className="mt-3 grid gap-3">
          {(batchQuery.data?.items ?? []).map((batch) => (
            <button
              key={batch.id}
              type="button"
              className="rounded border border-border bg-bg p-3 text-left hover:border-accent"
              onClick={() => setSelectedBatchId(batch.id)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-text">{batch.batchCode}</div>
                  <div className="text-sm text-muted">
                    {formatVietnamMonthLabel(batch.periodMonth)} ·{' '}
                    {formatDecimal(batch.rawQuantityTotal, 'vi-VN', 0)}
                  </div>
                </div>
                <StatusBadge
                  label={t(`manager-workspace:revenue.statuses.${batch.status}`)}
                  status={batch.status}
                  toneByStatus={revenueBatchStatusTone}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedBatch ? (
        <section className="space-y-4 rounded border border-border bg-panel p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">{selectedBatch.batchCode}</h2>
              <p className="text-sm text-muted">
                {formatUtcMidnightDateLike(selectedBatch.sourceDateFrom)} -{' '}
                {formatUtcMidnightDateLike(selectedBatch.sourceDateTo)}
              </p>
              {selectedBatch.rejectionReason ? (
                <p className="mt-1 text-sm text-danger">{selectedBatch.rejectionReason}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={t(`manager-workspace:revenue.statuses.${selectedBatch.status}`)}
                status={selectedBatch.status}
                toneByStatus={revenueBatchStatusTone}
              />
              {selectedBatch.status === 'DRAFT' ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded border border-accent px-3 py-2 text-sm font-medium text-accent"
                  disabled={selectedBatch.sourceLineCount < 1 || submitBatchMutation.isPending}
                  onClick={() => void submitSelectedBatch()}
                >
                  <Send className="size-4" />
                  {t('manager-workspace:revenue.actions.submitBatch')}
                </button>
              ) : null}
            </div>
          </div>

          {canEditSelectedBatch ? (
            <form
              className="grid gap-3 rounded border border-border bg-bg p-3 md:grid-cols-5"
              onSubmit={(event) => void submitLineForm(event)}
            >
              <select
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('manager-workspace:revenue.fields.member')}
                {...lineForm.register('memberKey')}
              >
                <option value="">{t('manager-workspace:values.notAvailable')}</option>
                {activeMembers.map((member) => (
                  <option
                    key={member.employmentProfileId}
                    value={`${member.employmentProfileId}|${member.talentId}`}
                  >
                    {member.displayName}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('manager-workspace:revenue.fields.sourceDate')}
                {...lineForm.register('sourceDate')}
              />
              <input
                type="number"
                min="1"
                step="1"
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('manager-workspace:revenue.fields.rawQuantity')}
                {...lineForm.register('rawQuantity')}
              />
              <input
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                aria-label={t('manager-workspace:revenue.fields.externalSourceRef')}
                {...lineForm.register('externalSourceRef')}
              />
              <button
                type="submit"
                className="rounded border border-accent px-3 py-1.5 text-sm text-accent"
              >
                {editingLine
                  ? t('manager-workspace:revenue.actions.updateLine')
                  : t('manager-workspace:revenue.actions.addLine')}
              </button>
            </form>
          ) : null}

          <div className="overflow-x-auto rounded border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t('manager-workspace:revenue.fields.sourceDate')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('manager-workspace:revenue.fields.member')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('manager-workspace:revenue.fields.rawQuantity')}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t('manager-workspace:revenue.fields.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(linesQuery.data ?? []).map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-3">{formatUtcMidnightDateLike(line.sourceDate)}</td>
                    <td className="px-3 py-3">
                      {activeMembers.find(
                        (member) => member.employmentProfileId === line.memberEmploymentProfileId,
                      )?.displayName ?? line.memberEmploymentProfileId}
                    </td>
                    <td className="px-3 py-3">{formatDecimal(line.rawQuantity, 'vi-VN', 0)}</td>
                    <td className="px-3 py-3">
                      {canEditSelectedBatch ? (
                        <button
                          type="button"
                          className="inline-flex rounded border border-border p-2"
                          aria-label={t('manager-workspace:revenue.actions.editLine')}
                          onClick={() => setEditingLine(line)}
                        >
                          <Pencil className="size-4" />
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export const ManagerWorkspacePage = (): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const location = useLocation();
  const navigate = useNavigate();
  const routeModule = getRouteModule(location.pathname);
  const isKpiDetail = isManagerKpiDetailPath(location.pathname);
  const [activeModule, setActiveModule] = useState<ManagerWorkspaceModuleId>(routeModule);
  const contextQuery = useManagerWorkspaceContext();
  const context = contextQuery.data;
  const moduleItems = useMemo(
    () => (context ? buildManagerWorkspaceModuleItems(context, t) : []),
    [context, t],
  );

  useEffect(() => {
    setActiveModule(routeModule);
  }, [routeModule]);

  const handleSelectModule = (moduleId: ManagerWorkspaceModuleId): void => {
    setActiveModule(moduleId);

    if (moduleId === 'overview') {
      navigate(APP_PATHS.manager);
      return;
    }

    if (moduleId === 'kpi') {
      navigate(APP_PATHS.managerKpi);
      return;
    }

    if (moduleId === 'work') {
      navigate(APP_PATHS.managerWorkShifts);
      return;
    }

    if (moduleId === 'revenue') {
      navigate(APP_PATHS.managerRevenueSource);
      return;
    }

    if (moduleId === 'events') {
      navigate(APP_PATHS.managerEvents);
    }
  };

  const profileSlot = context?.employmentProfile ? (
    <div className="flex flex-wrap justify-start gap-2 md:justify-end">
      <StatusBadge label={context.employmentProfile.displayName} tone="info" uppercase={false} />
      {context.employmentProfile.employeeCode ? (
        <StatusBadge
          label={t('manager-workspace:fields.profileCode', {
            code: context.employmentProfile.employeeCode,
          })}
          tone="neutral"
          uppercase={false}
        />
      ) : null}
      {context.employmentProfile.employmentStatus ? (
        <StatusBadge
          label={t(
            `manager-workspace:employmentStatus.${context.employmentProfile.employmentStatus}`,
          )}
          status={context.employmentProfile.employmentStatus}
          toneByStatus={statusTone}
          uppercase={false}
        />
      ) : null}
      <StatusBadge
        label={t('manager-workspace:status.scopeLabel')}
        tone="neutral"
        uppercase={false}
      />
    </div>
  ) : null;

  return (
    <WorkspaceShell
      testId="manager-workspace-shell"
      header={
        <WorkspaceHeader
          title={t('manager-workspace:title')}
          subtitle={t('manager-workspace:subtitle')}
          actions={
            <>
              <LocaleSwitcher />
              <SessionArea />
            </>
          }
          profile={profileSlot}
        />
      }
    >
      {contextQuery.isLoading ? <LoadingState lines={5} /> : null}
      {contextQuery.isError ? (
        <ErrorState
          title={t('manager-workspace:errors.contextTitle')}
          message={t('manager-workspace:errors.contextMessage')}
        />
      ) : null}

      {context ? (
        <>
          <WorkspaceModuleSwitcher
            items={moduleItems}
            activeId={activeModule}
            label={t('manager-workspace:nav.label')}
            selectedLabel={t('manager-workspace:status.selectedModule')}
            onSelect={handleSelectModule}
            getTestId={(moduleId) => `manager-module-${moduleId}`}
          />

          {activeModule === 'overview' ? (
            <WorkspacePanel testId="manager-panel-overview">
              <ManagerWorkspaceOverview context={context} />
            </WorkspacePanel>
          ) : null}
          {activeModule === 'kpi' && !isKpiDetail ? (
            <WorkspacePanel testId="manager-panel-kpi">
              <ManagerKpiSlice context={context} />
            </WorkspacePanel>
          ) : null}
          {activeModule === 'kpi' && isKpiDetail ? (
            <WorkspacePanel testId="manager-panel-kpi-detail">
              <ManagerKpiDetail context={context} />
            </WorkspacePanel>
          ) : null}
          {activeModule === 'work' ? (
            <WorkspacePanel testId="manager-panel-work">
              <ManagerWorkSlice context={context} />
            </WorkspacePanel>
          ) : null}
          {activeModule === 'revenue' ? (
            <WorkspacePanel testId="manager-panel-revenue">
              <ManagerRevenueSourceSlice context={context} />
            </WorkspacePanel>
          ) : null}
          {activeModule === 'events' ? (
            <WorkspacePanel testId="manager-panel-events">
              <ManagerEventsSlice context={context} />
            </WorkspacePanel>
          ) : null}
          {disabledManagerModuleIds.has(activeModule) ? (
            <WorkspacePanel testId={`manager-panel-${activeModule}`}>
              <ManagerUnsupportedModulePanel moduleId={activeModule} />
            </WorkspacePanel>
          ) : null}
        </>
      ) : null}
    </WorkspaceShell>
  );
};
