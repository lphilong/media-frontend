import { z } from 'zod';

import { apiRequest } from '@shared/api';

const overviewMetricsSchema = z
  .object({
    todayEventCount: z.number(),
    draftTalentKpiCount: z.number(),
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
    draftTalentKpiCount: z.number(),
    finalizedTalentKpiCount30d: z.number(),
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
    staleTalentKpiDraftCount: z.number(),
    staleRevenueDraftCount: z.number(),
    staleSettlementDraftCount: z.number(),
    expiringContractCount30d: z.number(),
  })
  .strict();

export const dashboardLiteSnapshotSchema = z
  .object({
    generatedAt: z.union([z.number(), z.string()]),
    businessDate: z.union([z.number(), z.string()]),
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
