import { describe, expect, it } from 'vitest';

import {
  parseKpiActualWorkspacePlanDetailResponseForTest,
  parseKpiActualWorkspacePlanListResponseForTest,
  parseKpiOrgUnitActualGridResponseForTest,
  parseKpiPlanDetailResponseForTest,
} from '@modules/kpi/api/kpi.api';

const statusSummary = {
  expectedEntryCount: 2,
  enteredEntryCount: 1,
  enteredZeroCount: 0,
  pendingEntryCount: 1,
  overdueEntryCount: 0,
  excusedEntryCount: 0,
  notRequiredEntryCount: 0,
  notDueEntryCount: 0,
};

const allocationCoverage = {
  publishedAllocationCount: 1,
  totalAllocationCount: 1,
  isAllExistingAllocationsPublished: true,
};

const actionHints = { canReadActualGrid: true, canEnterActual: true };
const missingSignal = { count: 0, semantics: 'CALENDAR_DAY_METRIC_SLOT_LIMITED' as const };

const actualWorkspaceSummary = {
  planId: 'kpi-plan-contract',
  planCode: 'KPI-202606-ORG-001',
  title: 'Operations KPI',
  periodMonth: '2026-06',
  subjectType: 'ORG_UNIT' as const,
  subjectId: 'org-unit-ops',
  subjectRef: { id: 'org-unit-ops', code: 'OU-OPS', name: 'Operations', status: 'ACTIVE' },
  planStatus: 'PUBLISHED' as const,
  revenue: {
    metricCode: 'REVENUE_VND' as const,
    operationalTargetValue: 1_000_000,
    planTargetValue: 1_000_000,
    actualValue: 750_000,
    achievementPercent: 75,
    targetSource: 'ALLOCATED' as const,
    targetMismatch: false,
  },
  allocationCoverage,
  supportingMetrics: [],
  missingSignal,
  actualEntryStatusSummary: statusSummary,
  closing: { periodState: 'CURRENT' as const },
  actionHints,
};

const finalResult = {
  snapshotVersion: 1 as const,
  planId: 'kpi-plan-contract',
  planCode: 'KPI-202606-ORG-001',
  periodMonth: '2026-06',
  subjectType: 'ORG_UNIT' as const,
  subjectId: 'org-unit-ops',
  finalizedAt: 1,
  revenue: {
    metricCode: 'REVENUE_VND' as const,
    planTargetValue: 1_000_000,
    operationalTargetValue: 1_000_000,
    actualValue: 750_000,
    achievementPercent: 75,
    targetMismatch: false,
  },
  allocationCoverage,
  actualEntryStatusSummary: statusSummary,
  supportingMetrics: [],
  members: [
    {
      allocationId: 'allocation-contract',
      memberDisplayName: 'An Nguyen',
      allocationStatus: 'PUBLISHED' as const,
      revenue: {
        metricCode: 'REVENUE_VND' as const,
        targetValue: 1_000_000,
        actualValue: 750_000,
        achievementPercent: 75,
      },
      supportingMetrics: [],
      actualEntryStatusSummary: statusSummary,
    },
  ],
};

const planBase = {
  id: 'kpi-plan-contract',
  planCode: 'KPI-202606-ORG-001',
  title: 'Operations KPI',
  description: null,
  subjectType: 'ORG_UNIT' as const,
  subjectId: 'org-unit-ops',
  subjectRef: { id: 'org-unit-ops', code: 'OU-OPS', name: 'Operations', status: 'ACTIVE' },
  status: 'FINALIZED' as const,
  currencyCode: 'VND' as const,
  periodMonth: '2026-06',
  periodStartAt: 1,
  periodEndAt: 2,
  timezone: 'Asia/Ho_Chi_Minh',
  actualPolicySnapshot: null,
  publishedAt: 1,
  publishedByActorId: 'user-admin',
  finalizedAt: 2,
  finalizedByActorId: 'user-admin',
  archivedAt: null,
  archivedByActorId: null,
  createdAt: 1,
  createdByActorId: 'user-admin',
  updatedAt: 2,
  updatedByActorId: 'user-admin',
  externalRef: null,
};

describe('KPI API schema contract', () => {
  it('accepts Actual Workspace cursor metadata without inventing a total page count', () => {
    const parsed = parseKpiActualWorkspacePlanListResponseForTest({
      data: [actualWorkspaceSummary],
      meta: { nextCursor: 'cursor-2' },
    });

    expect(parsed.meta?.nextCursor).toBe('cursor-2');
    expect(parsed).not.toHaveProperty('totalPages');
  });

  it('rejects Actual Workspace total-count and raw member identity fields', () => {
    expect(() =>
      parseKpiActualWorkspacePlanListResponseForTest({
        data: [actualWorkspaceSummary],
        meta: { nextCursor: 'cursor-2', totalPages: 7 },
      }),
    ).toThrow();

    expect(() =>
      parseKpiActualWorkspacePlanDetailResponseForTest({
        data: {
          ...actualWorkspaceSummary,
          members: [
            {
              allocationId: 'allocation-contract',
              allocationStatus: 'PUBLISHED',
              memberDisplayName: 'An Nguyen',
              memberEmploymentProfileId: 'employment-profile-secret',
              revenue: {
                metricCode: 'REVENUE_VND',
                targetValue: 1_000_000,
                actualValue: 750_000,
                achievementPercent: 75,
              },
              supportingMetrics: [],
              missingSignal,
              actualEntryStatusSummary: statusSummary,
              actionHints,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('keeps finalized KPI snapshots operational by rejecting payroll and payment fields', () => {
    expect(
      parseKpiPlanDetailResponseForTest({
        data: {
          ...planBase,
          finalResult,
          targetMetrics: [],
          allocations: [],
        },
      }).finalResult?.revenue.actualValue,
    ).toBe(750_000);

    expect(() =>
      parseKpiPlanDetailResponseForTest({
        data: {
          ...planBase,
          finalResult: {
            ...finalResult,
            payrollAmount: 750_000,
            paymentStatus: 'PAID',
          },
          targetMetrics: [],
          allocations: [],
        },
      }),
    ).toThrow();
  });

  it('parses ORG_UNIT actual grids as EmploymentProfile-scoped rows, not Talent-only rows', () => {
    const parsed = parseKpiOrgUnitActualGridResponseForTest({
      data: {
        kpiPlanId: 'kpi-plan-contract',
        planCode: 'KPI-202606-ORG-001',
        status: 'PUBLISHED',
        subjectType: 'ORG_UNIT',
        subjectId: 'org-unit-ops',
        actualDate: '2026-06-15',
        policy: {
          timezone: 'Asia/Ho_Chi_Minh',
          entryOpenLocalTime: '00:00',
          entryLockLocalTime: '10:00',
          maxDirectEditsPerEntry: 3,
          correctionAllowedUntil: 'PLAN_FINALIZED',
        },
        editability: {
          isDirectEditOpen: true,
          isPlanFinalized: false,
          disabledReason: null,
        },
        targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1_000_000, unit: 'VND' }],
        rows: [
          {
            allocationId: 'allocation-contract',
            memberEmploymentProfileId: 'employment-profile-ops',
            memberTalentId: null,
            memberDisplayName: 'An Nguyen',
            allocationStatus: 'PUBLISHED',
            metrics: [],
          },
        ],
      },
    });

    expect(parsed.rows[0]?.memberEmploymentProfileId).toBe('employment-profile-ops');
    expect(parsed.rows[0]?.memberTalentId).toBeNull();
  });
});
