import { z } from 'zod';

import type {
  CursorPagedResponse,
  TalentKpiByEventItem,
  TalentKpiByEventQuery,
  TalentKpiByPlatformItem,
  TalentKpiByPlatformQuery,
  TalentKpiByTalentItem,
  TalentKpiByTalentQuery,
  TalentKpiCreatePayload,
  TalentKpiDraftCorePayload,
  TalentKpiFlatListQuery,
  TalentKpiLifecycleAction,
  TalentKpiListItem,
  TalentKpiMetric,
  TalentKpiMetricsReplacementPayload,
  TalentKpiRecord,
} from '@modules/talent-kpi/types/talent-kpi.types';
import { apiRequest } from '@shared/api';

const statusSchema = z.enum(['DRAFT', 'FINALIZED', 'ARCHIVED']);
const measurementSourceSchema = z.literal('MANUAL');
const metricCodeSchema = z.enum([
  'LIVESTREAM_HOURS',
  'REVENUE_ATTRIBUTED_AMOUNT',
  'LIVESTREAM_SESSION_COUNT',
  'CONTENT_PUBLISH_COUNT',
  'EVENT_APPEARANCE_COUNT',
  'ENGAGEMENT_COUNT',
  'FOLLOWER_DELTA',
]);
const timestampSchema = z.union([z.number(), z.string()]);

const listItemSchema = z
  .object({
    id: z.string().trim().min(1),
    kpiRecordCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    subjectTalentId: z.string().trim().min(1),
    attributionPlatformAccountId: z.string().nullable().optional(),
    attributionEventId: z.string().nullable().optional(),
    measurementSource: measurementSourceSchema,
    status: statusSchema,
    periodStartAt: timestampSchema,
    periodEndAt: timestampSchema,
    publishedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
  })
  .strict();

const detailSchema = listItemSchema
  .extend({
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    updatedAt: timestampSchema,
  })
  .strict();

const metricSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    metricCode: metricCodeSchema,
    numericValue: z.number(),
    createdAt: timestampSchema.optional(),
    updatedAt: timestampSchema.optional(),
  })
  .strict();

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const listResponseSchema = z
  .object({ data: z.array(listItemSchema), meta: cursorMetaSchema })
  .strict();
const byTalentResponseSchema = z
  .object({ data: z.array(listItemSchema), meta: cursorMetaSchema })
  .strict();
const byPlatformResponseSchema = z
  .object({ data: z.array(listItemSchema), meta: cursorMetaSchema })
  .strict();
const byEventResponseSchema = z
  .object({ data: z.array(listItemSchema), meta: cursorMetaSchema })
  .strict();
const detailResponseSchema = z.object({ data: detailSchema }).strict();
const metricsResponseSchema = z.object({ data: z.array(metricSchema) }).strict();

const sanitizeFlatListQuery = (
  query: TalentKpiFlatListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  subjectTalentId: query.subjectTalentId,
  attributionPlatformAccountId: query.attributionPlatformAccountId,
  attributionEventId: query.attributionEventId,
  measurementSource: query.measurementSource,
  containsMetricCode: query.containsMetricCode,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByTalentQuery = (
  query: TalentKpiByTalentQuery,
): Record<string, string | number | undefined> => ({
  subjectTalentId: query.subjectTalentId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByPlatformQuery = (
  query: TalentKpiByPlatformQuery,
): Record<string, string | number | undefined> => ({
  attributionPlatformAccountId: query.attributionPlatformAccountId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByEventQuery = (
  query: TalentKpiByEventQuery,
): Record<string, string | number | undefined> => ({
  attributionEventId: query.attributionEventId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeCreatePayload = (payload: TalentKpiCreatePayload): TalentKpiCreatePayload => {
  const sanitized: TalentKpiCreatePayload = {
    title: payload.title,
    subjectTalentId: payload.subjectTalentId,
    attributionPlatformAccountId: payload.attributionPlatformAccountId ?? null,
    attributionEventId: payload.attributionEventId ?? null,
    measurementSource: payload.measurementSource,
    periodStartAt: payload.periodStartAt,
    periodEndAt: payload.periodEndAt,
    metrics: payload.metrics.map((metric) => ({
      metricCode: metric.metricCode,
      numericValue: metric.numericValue,
    })),
    description: payload.description ?? null,
    externalRef: payload.externalRef ?? null,
  };

  if (payload.kpiRecordCode !== undefined) {
    sanitized.kpiRecordCode = payload.kpiRecordCode;
  }

  return sanitized;
};

const sanitizeDraftCorePayload = (
  payload: TalentKpiDraftCorePayload,
): TalentKpiDraftCorePayload => ({
  title: payload.title,
  subjectTalentId: payload.subjectTalentId,
  attributionPlatformAccountId: payload.attributionPlatformAccountId ?? null,
  attributionEventId: payload.attributionEventId ?? null,
  periodStartAt: payload.periodStartAt,
  periodEndAt: payload.periodEndAt,
  description: payload.description ?? null,
  externalRef: payload.externalRef ?? null,
});

const sanitizeMetricsPayload = (
  payload: TalentKpiMetricsReplacementPayload,
): TalentKpiMetricsReplacementPayload => ({
  metrics: payload.metrics.map((metric) => ({
    metricCode: metric.metricCode,
    numericValue: metric.numericValue,
  })),
});

export const fetchTalentKpiRecords = async (
  query: TalentKpiFlatListQuery,
): Promise<CursorPagedResponse<TalentKpiListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/talent-kpi-records',
    params: sanitizeFlatListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchTalentKpiRecordsByTalent = async (
  query: TalentKpiByTalentQuery,
): Promise<CursorPagedResponse<TalentKpiByTalentItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/talent-kpi-records/by-talent',
    params: sanitizeByTalentQuery(query),
  });

  return byTalentResponseSchema.parse(response);
};

export const fetchTalentKpiRecordsByPlatform = async (
  query: TalentKpiByPlatformQuery,
): Promise<CursorPagedResponse<TalentKpiByPlatformItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/talent-kpi-records/by-platform',
    params: sanitizeByPlatformQuery(query),
  });

  return byPlatformResponseSchema.parse(response);
};

export const fetchTalentKpiRecordsByEvent = async (
  query: TalentKpiByEventQuery,
): Promise<CursorPagedResponse<TalentKpiByEventItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/talent-kpi-records/by-event',
    params: sanitizeByEventQuery(query),
  });

  return byEventResponseSchema.parse(response);
};

export const fetchTalentKpiRecordDetail = async (
  talentKpiRecordId: string,
): Promise<TalentKpiRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/talent-kpi-records/${encodeURIComponent(talentKpiRecordId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const fetchTalentKpiMetrics = async (
  talentKpiRecordId: string,
): Promise<TalentKpiMetric[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/talent-kpi-records/${encodeURIComponent(talentKpiRecordId)}/metrics`,
  });

  return metricsResponseSchema.parse(response).data;
};

export const createTalentKpiRecord = async (
  payload: TalentKpiCreatePayload,
): Promise<TalentKpiRecord> => {
  const response = await apiRequest<unknown, TalentKpiCreatePayload>({
    method: 'POST',
    url: '/admin/talent-kpi-records',
    data: sanitizeCreatePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const updateTalentKpiDraftCore = async (
  talentKpiRecordId: string,
  payload: TalentKpiDraftCorePayload,
): Promise<TalentKpiRecord> => {
  const response = await apiRequest<unknown, TalentKpiDraftCorePayload>({
    method: 'PATCH',
    url: `/admin/talent-kpi-records/${encodeURIComponent(talentKpiRecordId)}/draft-core`,
    data: sanitizeDraftCorePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const replaceTalentKpiMetrics = async (
  talentKpiRecordId: string,
  payload: TalentKpiMetricsReplacementPayload,
): Promise<TalentKpiRecord> => {
  const response = await apiRequest<unknown, TalentKpiMetricsReplacementPayload>({
    method: 'POST',
    url: `/admin/talent-kpi-records/${encodeURIComponent(talentKpiRecordId)}/metrics`,
    data: sanitizeMetricsPayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const performTalentKpiLifecycleAction = async (
  talentKpiRecordId: string,
  action: TalentKpiLifecycleAction,
): Promise<TalentKpiRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/talent-kpi-records/${encodeURIComponent(talentKpiRecordId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};
