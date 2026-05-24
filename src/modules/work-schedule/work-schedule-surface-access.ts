import { APP_PATHS } from '@app/router/paths';
import {
  hasAnyPermission,
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
  },
  {
    id: 'monthly-rosters',
    path: APP_PATHS.monthlyRosters,
    scope: 'department',
    labelKey: 'work-schedule:rosterNav.monthlyRosters',
  },
  {
    id: 'work-patterns',
    path: APP_PATHS.workPatterns,
    scope: 'global',
    labelKey: 'work-schedule:rosterNav.workPatterns',
  },
  {
    id: 'holiday-calendars',
    path: APP_PATHS.holidayCalendars,
    scope: 'global',
    labelKey: 'work-schedule:rosterNav.holidayCalendars',
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
      return hasScopeGrant(capabilities, 'workSchedule', 'self');
    case 'team-shifts':
      return hasScopeGrant(capabilities, 'workSchedule', 'team');
    case 'department-shifts':
      return hasScopeGrant(capabilities, 'workSchedule', 'department');
    case 'global-ops':
      return hasScopeGrant(capabilities, 'workSchedule', 'global');
    case 'monthly-rosters':
      return (
        hasScopeGrant(capabilities, 'workSchedule', 'department') ||
        hasScopeGrant(capabilities, 'workSchedule', 'global')
      );
    case 'work-patterns':
      return (
        hasScopeGrant(capabilities, 'workSchedule', 'global') &&
        hasAnyPermission(capabilities, [
          PERMISSIONS.WORK_SCHEDULE_CREATE,
          PERMISSIONS.WORK_SCHEDULE_UPDATE,
          PERMISSIONS.WORK_SCHEDULE_MANAGE_LIFECYCLE,
        ])
      );
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
    'department-shifts',
    'team-shifts',
    'my-shifts',
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
