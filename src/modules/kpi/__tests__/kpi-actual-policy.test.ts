import { describe, expect, it } from 'vitest';

import {
  memberActualVisibility,
  presentActualPolicy,
  resolveActualDeadlineStage,
} from '../presentation/kpi-actual-policy';

describe('KPI actual policy presentation', () => {
  it('shows policy-driven source, lifecycle, capture, aggregation, review, and evidence state', () => {
    expect(
      presentActualPolicy({
        source: 'IMPORTED_SOURCE',
        lifecycle: 'UNDER_REVIEW',
        captureMode: 'IMPORTED_SOURCE',
        aggregationMethod: 'WEIGHTED',
        reviewMode: 'OPS_REVIEW',
        evidenceMode: 'SOURCE_CONTROLLED',
      }),
    ).toMatchObject({
      sourceLabel: 'IMPORTED SOURCE',
      lifecycleLabel: 'UNDER REVIEW',
      captureLabel: 'IMPORTED SOURCE',
      aggregationLabel: 'WEIGHTED',
      reviewLabel: 'OPS REVIEW',
      evidenceLabel: 'SOURCE CONTROLLED',
      canManualEntry: false,
      warnsAgainstSourceImplication: true,
    });
  });

  it('renders exact D+1, D+2, late review, and period-lock boundaries', () => {
    const base = { actualDate: '2026-06-10', periodMonth: '2026-06' };
    expect(
      resolveActualDeadlineStage({ ...base, now: Date.parse('2026-06-11T05:00:00.000Z') }),
    ).toBe('DIRECT_ENTRY');
    expect(
      resolveActualDeadlineStage({ ...base, now: Date.parse('2026-06-11T05:00:00.001Z') }),
    ).toBe('ORDINARY_CORRECTION');
    expect(
      resolveActualDeadlineStage({ ...base, now: Date.parse('2026-06-12T11:00:00.001Z') }),
    ).toBe('LATE_CORRECTION_REVIEW_REQUIRED');
    expect(
      resolveActualDeadlineStage({ ...base, now: Date.parse('2026-07-03T11:00:00.001Z') }),
    ).toBe('LOCKED');
  });

  it('never exposes peer actuals, evidence, or ranking to members', () => {
    expect(
      memberActualVisibility({
        ownRecord: true,
        publishedTarget: true,
        lifecycle: 'ACCEPTED',
        approvedGroupAggregate: true,
      }),
    ).toEqual({
      showPersonalProgress: true,
      showGroupAggregate: true,
      showPeerDetail: false,
      showEvidence: false,
      showRanking: false,
    });
  });

  it('does not imply Revenue, Attendance, or Payroll ownership', () => {
    const labels = presentActualPolicy({
      source: 'DERIVED',
      captureMode: 'DERIVED',
      aggregationMethod: 'SUM',
      reviewMode: 'NONE',
      evidenceMode: 'SOURCE_CONTROLLED',
    });
    expect(JSON.stringify(labels)).not.toMatch(/Revenue|Attendance|Payroll/u);
  });
});
