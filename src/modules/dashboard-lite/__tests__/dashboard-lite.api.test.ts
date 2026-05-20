import { describe, expect, it } from 'vitest';

import { dashboardLiteSnapshotSchema } from '@modules/dashboard-lite/api/dashboard-lite.api';

const snapshot = {
  generatedAt: 1_777_555_200_000,
  businessDate: '2026-04-22',
  windows: {
    businessTimeZone: 'UTC',
    today: {
      startAtInclusive: 1_777_507_200_000,
      endAtExclusive: 1_777_593_600_000,
    },
    next7Days: {
      startAtInclusive: 1_777_507_200_000,
      endAtExclusive: 1_778_112_000_000,
    },
    trailing30Days: {
      startAtInclusive: 1_774_963_200_000,
      endAtExclusive: 1_777_555_200_000,
    },
    staleDrafts: {
      olderThanAtExclusive: 1_776_950_400_000,
    },
    contractExpiry30Days: {
      startDateInclusive: '2026-04-22',
      endDateInclusive: '2026-05-22',
    },
  },
  overview: {
    todayEventCount: 12,
    draftTalentKpiCount: 4,
    draftRevenueEntryCount: 5,
    draftSettlementCount: 2,
    activeCommissionRuleCount: 7,
    expiringContractCount30d: 3,
  },
  operations: {
    todayEventCount: 12,
    next7DayEventCount: 39,
    draftTalentKpiCount: 4,
    finalizedTalentKpiCount30d: 24,
  },
  commercial: {
    draftRevenueEntryCount: 5,
    finalizedRevenueAmount30d: 2024.5,
    reconciledRevenueAmount30d: 1999.25,
    draftSettlementCount: 2,
    finalizedSettlementAmount30d: 905.4,
    activeCommissionRuleCount: 7,
  },
  attention: {
    staleTalentKpiDraftCount: 1,
    staleRevenueDraftCount: 2,
    staleSettlementDraftCount: 1,
    expiringContractCount30d: 3,
  },
};

describe('dashboardLiteSnapshotSchema', () => {
  it('accepts required backend-owned window metadata', () => {
    expect(dashboardLiteSnapshotSchema.parse(snapshot).windows).toEqual(snapshot.windows);
  });

  it('requires strict date-only contract expiry metadata', () => {
    expect(() =>
      dashboardLiteSnapshotSchema.parse({
        ...snapshot,
        windows: {
          ...snapshot.windows,
          contractExpiry30Days: {
            startDateInclusive: '2026-04-22T00:00:00.000Z',
            endDateInclusive: '2026-05-22',
          },
        },
      }),
    ).toThrow();
  });
});
