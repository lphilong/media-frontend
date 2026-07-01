import { z } from 'zod';

import { apiRequest } from '@shared/api';

const overviewMetricsSchema = z
  .object({
    todayEventCount: z.number(),
    draftRevenueEntryCount: z.number(),
    draftSettlementCount: z.number(),
    activeCommissionRuleCount: z.number(),
    expiringContractCount30d: z.number(),
  })
  .strict();

const operationsMetricsSchema = z
  .object({
    todayEventCount: z.number(),
    next7DayEventCount: z.number(),
  })
  .strict();

const commercialMetricsSchema = z
  .object({
    draftRevenueEntryCount: z.number(),
    finalizedRevenueAmount30d: z.number(),
    reconciledRevenueAmount30d: z.number(),
    draftSettlementCount: z.number(),
    finalizedSettlementAmount30d: z.number(),
    activeCommissionRuleCount: z.number(),
  })
  .strict();

const attentionMetricsSchema = z
  .object({
    staleRevenueDraftCount: z.number(),
    staleSettlementDraftCount: z.number(),
    expiringContractCount30d: z.number(),
  })
  .strict();

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const timestampWindowSchema = z
  .object({
    startAtInclusive: z.number(),
    endAtExclusive: z.number(),
  })
  .strict();

const dashboardLiteWindowsSchema = z
  .object({
    businessTimeZone: z.string(),
    today: timestampWindowSchema,
    next7Days: timestampWindowSchema,
    trailing30Days: timestampWindowSchema,
    staleDrafts: z
      .object({
        olderThanAtExclusive: z.number(),
      })
      .strict(),
    contractExpiry30Days: z
      .object({
        startDateInclusive: dateOnlySchema,
        endDateInclusive: dateOnlySchema,
      })
      .strict(),
  })
  .strict();

export const dashboardLiteSnapshotSchema = z
  .object({
    generatedAt: z.union([z.number(), z.string()]),
    businessDate: z.union([z.number(), z.string()]),
    windows: dashboardLiteWindowsSchema,
    overview: overviewMetricsSchema,
    operations: operationsMetricsSchema,
    commercial: commercialMetricsSchema,
    attention: attentionMetricsSchema,
  })
  .strict();

const dashboardLiteSnapshotResponseSchema = z
  .object({
    data: dashboardLiteSnapshotSchema,
  })
  .strict();

export type DashboardLiteSnapshot = z.infer<typeof dashboardLiteSnapshotSchema>;

export const fetchDashboardLiteSnapshot = async (): Promise<DashboardLiteSnapshot> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/dashboard-lite/snapshot',
  });

  return dashboardLiteSnapshotResponseSchema.parse(response).data;
};
