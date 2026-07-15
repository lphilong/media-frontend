import { beforeEach, describe, expect, it } from 'vitest';

import en from '@locales/en/manager-workspace.json';
import vi from '@locales/vi/manager-workspace.json';
import zh from '@locales/zh/manager-workspace.json';
import {
  fetchManagerAvailabilityBatches,
  fetchManagerAvailabilityBatchDetail,
  fetchManagerRequestBatches,
  fetchManagerRequestBatchDetail,
  fetchManagerWorkShifts,
  fetchManagerWeeklySchedule,
  parseManagerAvailabilityBatchDetailForTest,
  parseManagerRequestBatchDetailForTest,
  parseManagerWeeklyScheduleForTest,
} from '@modules/manager-workspace/api/manager-workspace.api';
import {
  availabilityApplyStatusLabelKey,
  availabilityPolicyLabelKey,
  availabilityStatusLabelKey,
  availabilityTaxonomyLabelKey,
  availabilityTypeLabelKey,
  requestLineStatusLabelKey,
  requestTypeLabelKey,
} from '@modules/manager-workspace/manager-scheduling.model';
import {
  managerWorkspaceWorkEnabledContext,
  resetManagerWorkspaceMockData,
  setMockManagerSchedulingAuthority,
  setMockManagerSchedulingPageSize,
  setMockManagerWorkspaceContext,
} from '@test/msw/manager-workspace-handlers';

describe('Manager scheduling API and presentation contracts', () => {
  beforeEach(() => {
    resetManagerWorkspaceMockData();
    setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
  });

  it.each([{ accountContext: false }, { responsibility: false }, { structuredScope: false }])(
    'MSW scheduling endpoints fail closed for missing authority: %o',
    async (authority) => {
      setMockManagerSchedulingAuthority(authority);
      await expect(fetchManagerWorkShifts()).rejects.toBeDefined();
      await expect(
        fetchManagerWeeklySchedule({
          scopeType: 'ORG_UNIT',
          scopeId: 'org-unit-001',
          weekStart: '2026-07-13',
        }),
      ).rejects.toBeDefined();
      await expect(fetchManagerAvailabilityBatches()).rejects.toBeDefined();
      await expect(fetchManagerRequestBatches()).rejects.toBeDefined();
    },
  );

  it('continues assigned shift reads with the opaque next cursor', async () => {
    setMockManagerSchedulingPageSize(1);
    const first = await fetchManagerWorkShifts();
    expect(first.items).toHaveLength(1);
    expect(first.meta.nextCursor).toBe('1');

    const second = await fetchManagerWorkShifts(undefined, first.meta.nextCursor);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.workShiftId).not.toBe(first.items[0]?.workShiftId);
    expect(second.meta.nextCursor).toBeUndefined();
  });

  it('groups a strict seven-day weekly schedule without Attendance or Payroll fields', async () => {
    const result = await fetchManagerWeeklySchedule({
      scopeType: 'ORG_UNIT',
      scopeId: 'org-unit-001',
      weekStart: '2026-07-13',
      status: 'READY',
      conflict: 'WITHOUT_CONFLICT',
      request: 'WITHOUT_REQUEST',
    });
    expect(result.days).toHaveLength(7);
    expect(result.scope).toEqual({ type: 'ORG_UNIT', id: 'org-unit-001' });
    expect(result.summary.indicatorCompleteness).toBe('COMPLETE');
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/attendance|payroll/);
    expect(() =>
      parseManagerWeeklyScheduleForTest({
        data: { ...result, payrollTotal: 100 },
      }),
    ).toThrow();
  });

  it('strictly rejects unsafe request and availability detail DTO additions', async () => {
    const requestList = await fetchManagerRequestBatches();
    const availabilityList = await fetchManagerAvailabilityBatches();
    const request = await fetchManagerRequestBatchDetail(requestList.items[0]!.id);
    const availability = await fetchManagerAvailabilityBatchDetail(availabilityList.items[0]!.id);

    expect(() =>
      parseManagerRequestBatchDetailForTest({ data: { ...request, rawGrant: 'unsafe' } }),
    ).toThrow();
    expect(() =>
      parseManagerAvailabilityBatchDetailForTest({
        data: { ...availability, responsibilityAssignmentId: 'unsafe' },
      }),
    ).toThrow();
  });

  it('maps touched scheduling values to aligned EN, VI, and ZH business labels', () => {
    const keyPaths = [
      requestTypeLabelKey('RESCHEDULE_SHIFT'),
      requestLineStatusLabelKey('FAILED_TO_APPLY'),
      availabilityTypeLabelKey('PREFERRED_TIME'),
      availabilityTaxonomyLabelKey('SHIFT_CHANGE'),
      availabilityStatusLabelKey('PENDING'),
      availabilityApplyStatusLabelKey('ADVISORY_ONLY'),
      availabilityPolicyLabelKey('NOT_EVALUATED'),
    ].map((key) => key.replace('manager-workspace:', '').split('.'));

    for (const locale of [en, vi, zh]) {
      for (const path of keyPaths) {
        const value = path.reduce<unknown>(
          (current, segment) =>
            typeof current === 'object' && current !== null
              ? (current as Record<string, unknown>)[segment]
              : undefined,
          locale,
        );
        expect(typeof value).toBe('string');
        expect(value).not.toBe(path.at(-1));
      }
    }
  });
});
