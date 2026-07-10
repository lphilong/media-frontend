import { describe, expect, it } from 'vitest';

import {
  getCurrentHcmMonthForKpiCreate,
  isPastKpiCreatePeriodMonth,
  parseKpiAllocationDraftPayloadForTest,
  sanitizeKpiCreatePlanPayload,
} from '@modules/kpi/api/kpi.api';
import {
  formatKpiDate,
  parseKpiDate,
  parseKpiHoursInput,
  parseKpiMetricInput,
  parseKpiMoneyInput,
} from '@modules/kpi/formatting/kpi-formatting';

describe('KPI payload and formatter unit coverage', () => {
  it('builds create-plan payloads only for accepted KPI create subjects and metric semantics', () => {
    const payload = sanitizeKpiCreatePlanPayload({
      title: 'Operations KPI',
      subjectType: 'ORG_UNIT',
      subjectId: 'org-unit-ops',
      periodMonth: '2026-07',
      periodStartAt: 1,
      periodEndAt: 2,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1_000_000 }],
    });

    expect(payload.subjectType).toBe('ORG_UNIT');
    expect(payload.targetMetrics).toEqual([{ metricCode: 'REVENUE_VND', targetValue: 1_000_000 }]);

    expect(() =>
      sanitizeKpiCreatePlanPayload({
        title: 'Unsupported Talent KPI parity',
        subjectType: 'TALENT',
        subjectId: 'talent-001',
        periodMonth: '2026-07',
        periodStartAt: 1,
        periodEndAt: 2,
        targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1_000_000 }],
      } as unknown as Parameters<typeof sanitizeKpiCreatePlanPayload>[0]),
    ).toThrow();

    expect(() =>
      sanitizeKpiCreatePlanPayload({
        title: 'Org Unit diamond metric',
        subjectType: 'ORG_UNIT',
        subjectId: 'org-unit-ops',
        periodMonth: '2026-07',
        periodStartAt: 1,
        periodEndAt: 2,
        targetMetrics: [{ metricCode: 'TIKTOK_DIAMOND', targetValue: 100 }],
      }),
    ).toThrow();
  });

  it('keeps monthly period logic in HCM month format without free-text dates', () => {
    const now = Date.parse('2026-06-15T00:00:00+07:00');

    expect(getCurrentHcmMonthForKpiCreate(now)).toBe('2026-06');
    expect(isPastKpiCreatePeriodMonth('2026-05', now)).toBe(true);
    expect(isPastKpiCreatePeriodMonth('2026-06', now)).toBe(false);
    expect(isPastKpiCreatePeriodMonth('2026-07', now)).toBe(false);
  });

  it('rejects allocation draft payloads that carry direct Talent IDs or authority fields', () => {
    expect(
      parseKpiAllocationDraftPayloadForTest({
        allocations: [
          {
            employmentProfileId: 'employment-profile-ops',
            allocationStartDate: '2026-06-01',
            targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1_000_000 }],
          },
        ],
      }).allocations[0]?.employmentProfileId,
    ).toBe('employment-profile-ops');

    expect(() =>
      parseKpiAllocationDraftPayloadForTest({
        allocations: [
          {
            employmentProfileId: 'employment-profile-ops',
            memberTalentId: 'talent-001',
            allocationStartDate: '2026-06-01',
            scopeGrants: { kpi: ['managedGroup'] },
            targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1_000_000 }],
          },
        ],
      }),
    ).toThrow();
  });

  it('parses KPI actual values as numbers and rejects formatted money as payload value', () => {
    expect(parseKpiMoneyInput('1.000.000')).toBe(1_000_000);
    expect(parseKpiMoneyInput('1.000.000 VND')).toBeUndefined();
    expect(parseKpiMetricInput('REVENUE_VND', '750.000')).toBe(750_000);
    expect(parseKpiMetricInput('CONTENT_OUTPUT_COUNT', '8')).toBe(8);
    expect(parseKpiMetricInput('CONTENT_OUTPUT_COUNT', '8,5')).toBeUndefined();
    expect(parseKpiHoursInput('2,25')).toBe(2.25);
  });

  it('accepts only API contract dates while displaying business dates as DD-MM-YYYY', () => {
    expect(parseKpiDate('2026-06-15')).toBe('2026-06-15');
    expect(formatKpiDate('2026-06-15')).toBe('15-06-2026');
    expect(parseKpiDate('15-06-2026')).toBeUndefined();
    expect(formatKpiDate('15-06-2026')).toBe('-');
  });
});
