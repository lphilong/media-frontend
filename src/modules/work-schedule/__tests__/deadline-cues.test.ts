import { describe, expect, it } from 'vitest';

import { getWorkScheduleDeadlineCue } from '@modules/work-schedule/operational/deadline-cues';

describe('WorkSchedule deadline cues', () => {
  it('computes the D0 - 7 availability cutoff without enforcing an action', () => {
    expect(
      getWorkScheduleDeadlineCue({
        targetMonth: '2026-07',
        cueType: 'AVAILABILITY_CUTOFF',
        currentDate: '2026-06-21',
      }),
    ).toMatchObject({
      label: 'DUE_SOON',
      dueDate: '2026-06-24',
      daysUntilDue: 3,
    });
  });

  it('computes the D0 - 2 publish target as overdue after the target', () => {
    expect(
      getWorkScheduleDeadlineCue({
        targetMonth: '2026-07',
        cueType: 'PUBLISH_TARGET',
        currentDate: '2026-06-30',
      }),
    ).toMatchObject({
      label: 'OVERDUE',
      dueDate: '2026-06-29',
      daysUntilDue: -1,
    });
  });

  it('computes the D0 - 1 freeze reminder and returns not applicable for invalid months', () => {
    expect(
      getWorkScheduleDeadlineCue({
        targetMonth: '2026-07',
        cueType: 'FREEZE_REMINDER',
        currentDate: '2026-06-20',
      }),
    ).toMatchObject({
      label: 'ON_TRACK',
      dueDate: '2026-06-30',
      daysUntilDue: 10,
    });

    expect(
      getWorkScheduleDeadlineCue({
        targetMonth: '07/2026',
        cueType: 'PUBLISH_TARGET',
        currentDate: '2026-06-20',
      }),
    ).toMatchObject({
      label: 'NOT_APPLICABLE',
      dueDate: null,
    });
  });
});
