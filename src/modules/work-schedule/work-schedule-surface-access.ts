import { APP_PATHS } from '@app/router/paths';
import {
  hasScopeGrant,
  PERMISSIONS,
  type CurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';

import type { WorkScheduleScope } from './types/work-schedule.types';

export type WorkScheduleSurfaceId =
  | 'my-shifts'
  | 'team-shifts'
  | 'department-shifts'
  | 'global-ops'
  | 'request-batches'
  | 'monthly-rosters'
  | 'work-patterns'
  | 'holiday-calendars';

export type WorkScheduleShiftSurfaceId = Extract<
  WorkScheduleSurfaceId,
  'my-shifts' | 'team-shifts' | 'department-shifts' | 'global-ops'
>;

export type WorkScheduleSurfaceDefinition = {
  id: WorkScheduleSurfaceId;
  path: string;
  scope?: WorkScheduleScope;
  labelKey: string;
  showInAdminNavigation?: boolean;
};

export const workScheduleSurfaceDefinitions: readonly WorkScheduleSurfaceDefinition[] = [
  {
    id: 'my-shifts',
    path: APP_PATHS.workScheduleMyShifts,
    scope: 'self',
    labelKey: 'work-schedule:rosterNav.myShifts',
  },
  {
    id: 'team-shifts',
    path: APP_PATHS.workScheduleTeamShifts,
    scope: 'team',
    labelKey: 'work-schedule:rosterNav.teamShifts',
  },
  {
    id: 'department-shifts',
    path: APP_PATHS.workScheduleDepartmentShifts,
    scope: 'department',
    labelKey: 'work-schedule:rosterNav.departmentShifts',
  },
  {
    id: 'global-ops',
    path: APP_PATHS.workScheduleGlobalOps,
    scope: 'global',
    labelKey: 'work-schedule:rosterNav.globalOps',
    showInAdminNavigation: true,
  },
  {
    id: 'request-batches',
    path: APP_PATHS.workScheduleRequestBatches,
    scope: 'global',
    labelKey: 'work-schedule:rosterNav.requestBatches',
    showInAdminNavigation: true,
  },
  {
    id: 'monthly-rosters',
    path: APP_PATHS.monthlyRosters,
    scope: 'global',
    labelKey: 'work-schedule:rosterNav.monthlyRosters',
    showInAdminNavigation: true,
  },
  {
    id: 'work-patterns',
    path: APP_PATHS.workPatterns,
    scope: 'global',
    labelKey: 'work-schedule:rosterNav.workPatterns',
    showInAdminNavigation: true,
  },
  {
    id: 'holiday-calendars',
    path: APP_PATHS.holidayCalendars,
    scope: 'global',
    labelKey: 'work-schedule:rosterNav.holidayCalendars',
    showInAdminNavigation: true,
  },
] as const;

export const canAccessWorkScheduleSurface = (
  capabilities: CurrentActorCapabilities | undefined,
  surfaceId: WorkScheduleSurfaceId,
): boolean => {
  if (!capabilities?.permissions.includes(PERMISSIONS.WORK_SCHEDULE_READ)) {
    return false;
  }

  switch (surfaceId) {
    case 'my-shifts':
    case 'team-shifts':
    case 'department-shifts':
      return false;
    case 'global-ops':
      return hasScopeGrant(capabilities, 'workSchedule', 'global');
    case 'request-batches':
      return hasScopeGrant(capabilities, 'workSchedule', 'global');
    case 'monthly-rosters':
      return hasScopeGrant(capabilities, 'workSchedule', 'global');
    case 'work-patterns':
      return hasScopeGrant(capabilities, 'workSchedule', 'global');
    case 'holiday-calendars':
      return hasScopeGrant(capabilities, 'workSchedule', 'global');
    default:
      return false;
  }
};

export const resolveDefaultWorkScheduleSurfacePath = (
  capabilities: CurrentActorCapabilities | undefined,
): string | null => {
  const priority: readonly WorkScheduleSurfaceId[] = [
    'global-ops',
    'request-batches',
    'monthly-rosters',
    'work-patterns',
    'holiday-calendars',
  ];
  const surfaceId = priority.find((candidate) =>
    canAccessWorkScheduleSurface(capabilities, candidate),
  );
  const surface = workScheduleSurfaceDefinitions.find((candidate) => candidate.id === surfaceId);
  return surface?.path ?? null;
};

export const getWorkScheduleSurfaceForPath = (
  pathname: string,
): WorkScheduleSurfaceDefinition | undefined =>
  workScheduleSurfaceDefinitions.find((surface) => surface.path === pathname);
