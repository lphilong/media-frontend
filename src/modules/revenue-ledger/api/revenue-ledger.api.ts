import { z } from 'zod';

import type {
  CursorPagedResponse,
  RevenueEntryByEventItem,
  RevenueEntryByPlatformItem,
  RevenueEntryByTalentItem,
  RevenueEntryCreatePayload,
  RevenueEntryDraftCorePayload,
  RevenueEntryListItem,
  RevenueEntryReconcilePayload,
  RevenueEntryRecord,
  RevenueLedgerByEventQuery,
  RevenueLedgerByPlatformQuery,
  RevenueLedgerByTalentQuery,
  RevenueLedgerFlatListQuery,
  RevenueLedgerLifecycleAction,
} from '@modules/revenue-ledger/types/revenue-ledger.types';
import { apiRequest } from '@shared/api';

const statusSchema = z.enum(['DRAFT', 'FINALIZED', 'RECONCILED', 'VOIDED', 'ARCHIVED']);
const revenueKindSchema = z.enum(['PLATFORM_LIVESTREAM', 'PLATFORM_CONTENT', 'EVENT_OPERATIONAL']);
const entrySourceSchema = z.literal('MANUAL');
const timestampSchema = z.union([z.number(), z.string()]);

const listItemSchema = z
  .object({
    id: z.string().trim().min(1),
    revenueEntryCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    subjectTalentId: z.string().trim().min(1),
    attributionPlatformAccountId: z.string().nullable().optional(),
    attributionEventId: z.string().nullable().optional(),
    revenueKind: revenueKindSchema,
    entrySource: entrySourceSchema,
    status: statusSchema,
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    recognizedAmount: z.number(),
    recognizedAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

const detailSchema = listItemSchema
  .extend({
    finalizedAt: timestampSchema.nullable().optional(),
    reconciledAt: timestampSchema.nullable().optional(),
    voidedAt: timestampSchema.nullable().optional(),
    reconciliationReference: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    updatedAt: timestampSchema,
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

const sanitizeFlatListQuery = (
  query: RevenueLedgerFlatListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  subjectTalentId: query.subjectTalentId,
  attributionPlatformAccountId: query.attributionPlatformAccountId,
  attributionEventId: query.attributionEventId,
  revenueKind: query.revenueKind,
  entrySource: query.entrySource,
  currencyCode: query.currencyCode,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByTalentQuery = (
  query: RevenueLedgerByTalentQuery,
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
  query: RevenueLedgerByPlatformQuery,
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
  query: RevenueLedgerByEventQuery,
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

export const sanitizeRevenueEntryCreatePayload = (
  payload: RevenueEntryCreatePayload,
): RevenueEntryCreatePayload => ({
  revenueEntryCode: payload.revenueEntryCode,
  title: payload.title,
  subjectTalentId: payload.subjectTalentId,
  attributionPlatformAccountId: payload.attributionPlatformAccountId ?? null,
  attributionEventId: payload.attributionEventId ?? null,
  revenueKind: payload.revenueKind,
  entrySource: payload.entrySource,
  currencyCode: payload.currencyCode,
  recognizedAmount: payload.recognizedAmount,
  recognizedAt: payload.recognizedAt,
  description: payload.description ?? null,
  externalRef: payload.externalRef ?? null,
});

export const sanitizeRevenueEntryDraftCorePayload = (
  payload: RevenueEntryDraftCorePayload,
): RevenueEntryDraftCorePayload => {
  const sanitized: RevenueEntryDraftCorePayload = {};

  if (payload.title !== undefined) sanitized.title = payload.title;
  if (payload.description !== undefined) sanitized.description = payload.description;
  if (payload.externalRef !== undefined) sanitized.externalRef = payload.externalRef;
  if (payload.subjectTalentId !== undefined) sanitized.subjectTalentId = payload.subjectTalentId;
  if (payload.attributionPlatformAccountId !== undefined) {
    sanitized.attributionPlatformAccountId = payload.attributionPlatformAccountId;
  }
  if (payload.attributionEventId !== undefined) {
    sanitized.attributionEventId = payload.attributionEventId;
  }
  if (payload.revenueKind !== undefined) sanitized.revenueKind = payload.revenueKind;
  if (payload.currencyCode !== undefined) sanitized.currencyCode = payload.currencyCode;
  if (payload.recognizedAmount !== undefined) {
    sanitized.recognizedAmount = payload.recognizedAmount;
  }
  if (payload.recognizedAt !== undefined) sanitized.recognizedAt = payload.recognizedAt;

  return sanitized;
};

export const sanitizeRevenueEntryReconcilePayload = (
  payload?: RevenueEntryReconcilePayload,
): RevenueEntryReconcilePayload | Record<string, never> => {
  const reference = payload?.reconciliationReference?.trim();
  return reference ? { reconciliationReference: reference } : {};
};

export const fetchRevenueEntries = async (
  query: RevenueLedgerFlatListQuery,
): Promise<CursorPagedResponse<RevenueEntryListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/revenue-entries',
    params: sanitizeFlatListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchRevenueEntriesByTalent = async (
  query: RevenueLedgerByTalentQuery,
): Promise<CursorPagedResponse<RevenueEntryByTalentItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/revenue-entries/by-talent',
    params: sanitizeByTalentQuery(query),
  });

  return byTalentResponseSchema.parse(response);
};

export const fetchRevenueEntriesByPlatform = async (
  query: RevenueLedgerByPlatformQuery,
): Promise<CursorPagedResponse<RevenueEntryByPlatformItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/revenue-entries/by-platform',
    params: sanitizeByPlatformQuery(query),
  });

  return byPlatformResponseSchema.parse(response);
};

export const fetchRevenueEntriesByEvent = async (
  query: RevenueLedgerByEventQuery,
): Promise<CursorPagedResponse<RevenueEntryByEventItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/revenue-entries/by-event',
    params: sanitizeByEventQuery(query),
  });

  return byEventResponseSchema.parse(response);
};

export const fetchRevenueEntryDetail = async (
  revenueEntryId: string,
): Promise<RevenueEntryRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/revenue-entries/${encodeURIComponent(revenueEntryId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const createRevenueEntry = async (
  payload: RevenueEntryCreatePayload,
): Promise<RevenueEntryRecord> => {
  const response = await apiRequest<unknown, RevenueEntryCreatePayload>({
    method: 'POST',
    url: '/admin/revenue-entries',
    data: sanitizeRevenueEntryCreatePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const updateRevenueEntryDraftCore = async (
  revenueEntryId: string,
  payload: RevenueEntryDraftCorePayload,
): Promise<RevenueEntryRecord> => {
  const response = await apiRequest<unknown, RevenueEntryDraftCorePayload>({
    method: 'PATCH',
    url: `/admin/revenue-entries/${encodeURIComponent(revenueEntryId)}/draft-core`,
    data: sanitizeRevenueEntryDraftCorePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const reconcileRevenueEntry = async (
  revenueEntryId: string,
  payload?: RevenueEntryReconcilePayload,
): Promise<RevenueEntryRecord> => {
  const response = await apiRequest<unknown, RevenueEntryReconcilePayload | Record<string, never>>({
    method: 'POST',
    url: `/admin/revenue-entries/${encodeURIComponent(revenueEntryId)}/reconcile`,
    data: sanitizeRevenueEntryReconcilePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const performRevenueEntryLifecycleAction = async (
  revenueEntryId: string,
  action: Exclude<RevenueLedgerLifecycleAction, 'reconcile'>,
): Promise<RevenueEntryRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/revenue-entries/${encodeURIComponent(revenueEntryId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};
