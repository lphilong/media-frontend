import { describe, expect, it } from 'vitest';

import {
  presentWorkScheduleApplication,
  workScheduleActorControls,
} from '../presentation/work-schedule-application';

describe('WorkSchedule application presentation', () => {
  it('reports success only after APPROVED_APPLIED readback', () => {
    expect(
      presentWorkScheduleApplication({
        finalState: 'APPROVED_APPLIED',
        appliedCount: 1,
        failedCount: 0,
        conflicts: [],
      }).reportsSuccess,
    ).toBe(true);
    expect(
      presentWorkScheduleApplication({
        finalState: 'APPLICATION_FAILED',
        appliedCount: 0,
        failedCount: 1,
        conflicts: [],
      }).reportsSuccess,
    ).toBe(false);
    expect(
      presentWorkScheduleApplication({
        finalState: 'APPLICATION_CONFLICT',
        appliedCount: 0,
        failedCount: 0,
        conflicts: ['overlap'],
      }).tone,
    ).toBe('warning');
  });

  it('keeps Manager submit-only and Staff personal official schedule read-only', () => {
    expect(workScheduleActorControls('MANAGER')).toEqual({
      canSubmit: true,
      canCancelOwnPending: true,
      canDecideApply: false,
      canPublish: false,
      canDirectEditWorkShift: false,
      isPersonalOfficialReadOnly: false,
    });
    expect(workScheduleActorControls('STAFF')).toEqual({
      canSubmit: false,
      canCancelOwnPending: false,
      canDecideApply: false,
      canPublish: false,
      canDirectEditWorkShift: false,
      isPersonalOfficialReadOnly: true,
    });
  });

  it('contains no Attendance, Payroll, leave approval, or worked-time effects', () => {
    const serialized = JSON.stringify(workScheduleActorControls('ADMIN_OPS'));
    expect(serialized).not.toMatch(/Attendance|Payroll|leave|workedTime/u);
  });
});
