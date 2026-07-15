import type { ApplyAvailabilityLinesToMonthlyRosterResult } from '../types/work-schedule.types';

export type WorkScheduleApplicationPresentation = {
  state:
    | 'APPROVED_APPLIED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'SOURCE_CHANGED'
    | 'APPLICATION_CONFLICT'
    | 'APPLICATION_FAILED';
  reportsSuccess: boolean;
  tone: 'success' | 'warning' | 'danger';
};

export function presentWorkScheduleApplication(
  result: Pick<
    ApplyAvailabilityLinesToMonthlyRosterResult,
    'finalState' | 'appliedCount' | 'failedCount' | 'conflicts'
  >,
): WorkScheduleApplicationPresentation {
  const state =
    result.finalState ??
    (result.failedCount > 0
      ? 'APPLICATION_FAILED'
      : result.appliedCount > 0
        ? 'APPROVED_APPLIED'
        : 'APPLICATION_CONFLICT');
  return {
    state,
    reportsSuccess: state === 'APPROVED_APPLIED' && result.failedCount === 0,
    tone:
      state === 'APPROVED_APPLIED'
        ? 'success'
        : state === 'SOURCE_CHANGED' || state === 'APPLICATION_CONFLICT'
          ? 'warning'
          : 'danger',
  };
}

export function workScheduleActorControls(actor: 'ADMIN_OPS' | 'MANAGER' | 'STAFF') {
  return {
    canSubmit: actor === 'ADMIN_OPS' || actor === 'MANAGER',
    canCancelOwnPending: actor === 'MANAGER',
    canDecideApply: actor === 'ADMIN_OPS',
    canPublish: actor === 'ADMIN_OPS',
    canDirectEditWorkShift: actor === 'ADMIN_OPS',
    isPersonalOfficialReadOnly: actor === 'STAFF',
  } as const;
}
