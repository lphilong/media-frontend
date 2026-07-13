import type { ManagerWorkspaceContext } from '@modules/manager-workspace/api/manager-workspace.api';

export type ManagerWorkspaceModuleId =
  | 'overview'
  | 'kpi'
  | 'work'
  | 'revenue'
  | 'events'
  | 'groups'
  | 'members';

export type ManagerCapabilityStatus =
  | 'AVAILABLE_READ_ONLY'
  | 'AVAILABLE_ACTIONABLE'
  | 'NOT_RELEASED'
  | 'UNAUTHORIZED'
  | 'MISSING_SCOPE'
  | 'MISSING_RESPONSIBILITY'
  | 'MISSING_PROFILE'
  | 'MISSING_PREREQUISITE_DATA'
  | 'LOAD_ERROR';

export type ManagerCapabilityStatusMap = Readonly<
  Record<ManagerWorkspaceModuleId, ManagerCapabilityStatus>
>;

const unavailableFromReason = (reason: string | undefined): ManagerCapabilityStatus => {
  if (reason === 'NO_MANAGER_RESPONSIBILITY_ASSIGNED') {
    return 'MISSING_RESPONSIBILITY';
  }
  if (reason === 'NO_STRUCTURED_SCOPE_ASSIGNED' || reason === 'NO_MANAGED_SCOPE_ASSIGNED') {
    return 'MISSING_SCOPE';
  }
  if (reason === 'MISSING_TALENT_GROUP_PREREQUISITE') {
    return 'MISSING_PREREQUISITE_DATA';
  }
  return 'UNAUTHORIZED';
};

const baseReadinessStatus = (context: ManagerWorkspaceContext): ManagerCapabilityStatus | null => {
  if (
    !context.employmentProfile ||
    context.readiness.reasons.includes('NO_LINKED_EMPLOYMENT_PROFILE')
  ) {
    return 'MISSING_PROFILE';
  }
  if (context.readiness.reasons.includes('MANAGER_CONSOLE_ACCOUNT_CONTEXT_MISSING')) {
    return 'UNAUTHORIZED';
  }
  if (context.readiness.reasons.includes('EMPLOYMENT_PROFILE_NOT_ACTIVE_OR_ON_LEAVE')) {
    return 'MISSING_PREREQUISITE_DATA';
  }
  return null;
};

const overviewStatus = (
  statuses: Pick<ManagerCapabilityStatusMap, 'kpi' | 'work' | 'revenue' | 'events'>,
): ManagerCapabilityStatus => {
  const values = Object.values(statuses);
  if (values.includes('AVAILABLE_ACTIONABLE')) return 'AVAILABLE_ACTIONABLE';
  if (values.includes('AVAILABLE_READ_ONLY')) return 'AVAILABLE_READ_ONLY';
  for (const status of [
    'MISSING_PROFILE',
    'MISSING_RESPONSIBILITY',
    'MISSING_SCOPE',
    'MISSING_PREREQUISITE_DATA',
    'UNAUTHORIZED',
  ] as const) {
    if (values.includes(status)) return status;
  }
  return 'UNAUTHORIZED';
};

export const deriveManagerCapabilityStatuses = (input: {
  context?: ManagerWorkspaceContext;
  loadError?: boolean;
}): ManagerCapabilityStatusMap => {
  if (input.loadError || !input.context) {
    return {
      overview: 'LOAD_ERROR',
      kpi: 'LOAD_ERROR',
      work: 'LOAD_ERROR',
      revenue: 'LOAD_ERROR',
      events: 'LOAD_ERROR',
      groups: 'NOT_RELEASED',
      members: 'NOT_RELEASED',
    };
  }

  const context = input.context;
  const baseStatus = baseReadinessStatus(context);
  const kpi = baseStatus
    ? baseStatus
    : context.modules.kpi.visible
      ? context.scopes.orgUnits.some(
          (scope) =>
            scope.role === 'UNIT_MANAGER' &&
            !scope.includeDescendants &&
            (scope.capabilities.kpi.manageAllocation ||
              scope.capabilities.kpi.enterActual ||
              scope.capabilities.kpi.correctActual),
        )
        ? 'AVAILABLE_ACTIONABLE'
        : 'AVAILABLE_READ_ONLY'
      : unavailableFromReason(context.readiness.reasons[0]);
  const work = baseStatus
    ? baseStatus
    : context.modules.workShifts.visible
      ? 'AVAILABLE_ACTIONABLE'
      : unavailableFromReason(context.modules.workShifts.reason);
  const revenue = baseStatus
    ? baseStatus
    : context.modules.revenueSource.visible
      ? 'AVAILABLE_ACTIONABLE'
      : unavailableFromReason(context.modules.revenueSource.reason);
  const events = baseStatus
    ? baseStatus
    : context.modules.events.visible
      ? 'AVAILABLE_READ_ONLY'
      : unavailableFromReason(context.modules.events.reason);

  return {
    overview: overviewStatus({ kpi, work, revenue, events }),
    kpi,
    work,
    revenue,
    events,
    groups: 'NOT_RELEASED',
    members: 'NOT_RELEASED',
  };
};

export const isManagerCapabilityAvailable = (status: ManagerCapabilityStatus): boolean =>
  status === 'AVAILABLE_READ_ONLY' || status === 'AVAILABLE_ACTIONABLE';
