import {
  createActionCapabilityHint,
  type ActionCapabilityHint,
  type CapabilityMissingReason,
  type CapabilityQueryState,
  type PermissionCode,
} from '@shared/auth/current-actor-capabilities';

import type { MonthlyRosterScope, WorkScheduleScope } from './types/work-schedule.types';

type WorkScheduleRequestedScope = WorkScheduleScope | MonthlyRosterScope;

type CreateWorkScheduleCapabilityHintParams = {
  state: CapabilityQueryState;
  permission: PermissionCode;
  requestedScope?: WorkScheduleRequestedScope;
  copy: Record<CapabilityMissingReason, string>;
};

export const createWorkScheduleCapabilityHint = ({
  state,
  permission,
  requestedScope,
  copy,
}: CreateWorkScheduleCapabilityHintParams): ActionCapabilityHint =>
  createActionCapabilityHint(
    state,
    {
      permission,
      ...(requestedScope
        ? { scope: { module: 'workSchedule' as const, value: requestedScope } }
        : {}),
    },
    copy,
  );
