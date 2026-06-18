import { z } from 'zod';

import type {
  CursorPagedResponse,
  CreateRevenueEntryFromPlatformEarningPayload,
  PlatformEarningApprovePayload,
  PlatformEarningBatch,
  PlatformEarningBatchQuery,
  PlatformEarningLine,
  PlatformEarningLineQuery,
  PlatformEarningReasonPayload,
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
const entrySourceSchema = z.enum(['MANUAL', 'PLATFORM_EARNING_BATCH']);
const platformEarningBatchStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'VOIDED',
  'ARCHIVED',
]);
const platformEarningSourceTypeSchema = z.literal('TIKTOK_LIVESTREAM_DIAMOND');
const platformEarningSourceUnitSchema = z.literal('DIAMOND');
const timestampSchema = z.union([z.number(), z.string()]);
const referenceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    handle: z.string().trim().min(1).optional(),
    platform: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
  })
  .strict();

const sourceSummarySnapshotSchema = z
  .object({
    sourceKind: z.literal('PLATFORM_EARNING_BATCH'),
    sourceType: platformEarningSourceTypeSchema,
    sourceBatchIds: z.array(z.string().trim().min(1)),
    sourceSummaryRef: z.string().trim().min(1),
    sourceLineCount: z.number().int().nonnegative(),
    periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    sourceDateFrom: z.number().int(),
    sourceDateTo: z.number().int(),
    platform: z.string().trim().min(1),
    platformAccountId: z.string().trim().min(1),
    talentGroupId: z.string().nullable(),
    memberTalentIds: z.array(z.string().trim().min(1)),
    memberEmploymentProfileIds: z.array(z.string().trim().min(1)),
    eventIds: z.array(z.string().trim().min(1)),
    sourceUnit: platformEarningSourceUnitSchema,
    rawQuantityTotal: z.number(),
    sourceFingerprint: z.string().nullable(),
    approvedAt: z.number().int(),
    approvedByActorId: z.string(),
  })
  .strict();

const conversionSnapshotSchema = z
  .object({
    sourceUnit: platformEarningSourceUnitSchema,
    rawQuantity: z.number(),
    targetCurrency: z.string().regex(/^[A-Z]{3}$/),
    appliedRate: z.number(),
    rateType: z.string().trim().min(1),
    rateEffectiveFrom: z.number().int().nullable(),
    rateEffectiveTo: z.number().int().nullable(),
    grossConvertedAmount: z.number(),
    ruleRef: z.string().nullable(),
    appliedByActorId: z.string().trim().min(1),
    appliedAt: z.number().int(),
    sourceNote: z.string().nullable(),
  })
  .strict();

const platformCutSnapshotSchema = z
  .object({
    platformCutRate: z.number(),
    companyShareRate: z.number(),
    grossConvertedAmount: z.number(),
    platformCutAmount: z.number(),
    companyNetAmount: z.number(),
    targetCurrency: z.string().regex(/^[A-Z]{3}$/),
    ruleRef: z.string().nullable(),
    appliedByActorId: z.string().trim().min(1),
    appliedAt: z.number().int(),
    sourceNote: z.string().nullable(),
  })
  .strict();

const commissionableBasisSnapshotSchema = z
  .object({
    basisType: z.literal('COMPANY_NET'),
    amount: z.number(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    appliedByActorId: z.string().trim().min(1),
    appliedAt: z.number().int(),
    sourceNote: z.string().nullable(),
  })
  .strict();

const listItemSchema = z
  .object({
    id: z.string().trim().min(1),
    revenueEntryCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    subjectTalentId: z.string().trim().min(1),
    attributionPlatformAccountId: z.string().nullable().optional(),
    attributionTalentGroupId: z.string().nullable().optional(),
    attributionEmploymentProfileId: z.string().nullable().optional(),
    attributionEventId: z.string().nullable().optional(),
    subjectTalentRef: referenceSummarySchema.nullable().optional(),
    attributionPlatformAccountRef: referenceSummarySchema.nullable().optional(),
    attributionEventRef: referenceSummarySchema.nullable().optional(),
    revenueKind: revenueKindSchema,
    entrySource: entrySourceSchema,
    sourceBatchIds: z.array(z.string().trim().min(1)).optional(),
    sourceSummaryRef: z.string().nullable().optional(),
    sourceLineCount: z.number().int().nonnegative().nullable().optional(),
    sourceSummarySnapshot: sourceSummarySnapshotSchema.nullable().optional(),
    conversionSnapshot: conversionSnapshotSchema.nullable().optional(),
    platformCutSnapshot: platformCutSnapshotSchema.nullable().optional(),
    commissionableBasisSnapshot: commissionableBasisSnapshotSchema.nullable().optional(),
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

const byTalentItemSchema = z
  .object({
    id: z.string().trim().min(1),
    revenueEntryCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    subjectTalentId: z.string().trim().min(1),
    revenueKind: revenueKindSchema,
    status: statusSchema,
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    recognizedAmount: z.number(),
    recognizedAt: timestampSchema,
  })
  .strict();

const byPlatformItemSchema = z
  .object({
    id: z.string().trim().min(1),
    revenueEntryCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    subjectTalentId: z.string().trim().min(1),
    attributionPlatformAccountId: z.string().trim().min(1),
    revenueKind: revenueKindSchema,
    status: statusSchema,
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    recognizedAmount: z.number(),
    recognizedAt: timestampSchema,
  })
  .strict();

const byEventItemSchema = z
  .object({
    id: z.string().trim().min(1),
    revenueEntryCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    subjectTalentId: z.string().trim().min(1),
    attributionEventId: z.string().trim().min(1),
    revenueKind: revenueKindSchema,
    status: statusSchema,
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    recognizedAmount: z.number(),
    recognizedAt: timestampSchema,
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
    nextCursor: z
      .union([z.string().trim().min(1), z.null()])
      .optional()
      .transform((value) => value ?? undefined),
  })
  .strict()
  .optional();

const listResponseSchema = z
  .object({ data: z.array(listItemSchema), meta: cursorMetaSchema })
  .strict();
const byTalentResponseSchema = z
  .object({ data: z.array(byTalentItemSchema), meta: cursorMetaSchema })
  .strict();
const byPlatformResponseSchema = z
  .object({ data: z.array(byPlatformItemSchema), meta: cursorMetaSchema })
  .strict();
const byEventResponseSchema = z
  .object({ data: z.array(byEventItemSchema), meta: cursorMetaSchema })
  .strict();
const detailResponseSchema = z.object({ data: detailSchema }).strict();

const platformEarningBatchSchema = z
  .object({
    id: z.string().trim().min(1),
    batchCode: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    platformAccountId: z.string().trim().min(1),
    talentGroupId: z.string().nullable(),
    sourceType: platformEarningSourceTypeSchema,
    sourceUnit: platformEarningSourceUnitSchema,
    periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    sourceDateFrom: z.number().int(),
    sourceDateTo: z.number().int(),
    status: platformEarningBatchStatusSchema,
    sourceLineCount: z.number().int().nonnegative(),
    rawQuantityTotal: z.number(),
    conversionSnapshot: conversionSnapshotSchema.nullable(),
    platformCutSnapshot: platformCutSnapshotSchema.nullable(),
    companyNetAmount: z.number().nullable(),
    commissionableBasisAmount: z.number().nullable(),
    submittedByActorId: z.string().nullable(),
    submittedAt: z.number().int().nullable(),
    reviewedByActorId: z.string().nullable(),
    reviewedAt: z.number().int().nullable(),
    approvedByActorId: z.string().nullable(),
    approvedAt: z.number().int().nullable(),
    rejectedByActorId: z.string().nullable(),
    rejectedAt: z.number().int().nullable(),
    rejectionReason: z.string().nullable(),
    voidedByActorId: z.string().nullable(),
    voidedAt: z.number().int().nullable(),
    voidReason: z.string().nullable(),
    archivedByActorId: z.string().nullable(),
    archivedAt: z.number().int().nullable(),
    sourceFingerprint: z.string().nullable(),
    revenueEntryId: z.string().nullable(),
    revenueEntryCreatedByActorId: z.string().nullable(),
    revenueEntryCreatedAt: z.number().int().nullable(),
    createdByActorId: z.string().trim().min(1),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict();

const platformEarningLineSchema = z
  .object({
    id: z.string().trim().min(1),
    batchId: z.string().trim().min(1),
    batchStatus: platformEarningBatchStatusSchema,
    sourceDate: z.number().int(),
    periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    platform: z.string().trim().min(1),
    platformAccountId: z.string().trim().min(1),
    talentGroupId: z.string().nullable(),
    memberTalentId: z.string().nullable(),
    memberEmploymentProfileId: z.string().nullable(),
    eventId: z.string().nullable(),
    sourceType: platformEarningSourceTypeSchema,
    sourceUnit: platformEarningSourceUnitSchema,
    rawQuantity: z.number(),
    externalSourceRef: z.string().nullable(),
    notes: z.string().nullable(),
    duplicateDetectionKey: z.string().trim().min(1),
    correctionOfLineId: z.string().nullable(),
    replacementLineId: z.string().nullable(),
    enteredByActorId: z.string().trim().min(1),
    enteredAt: z.number().int(),
    submittedByActorId: z.string().nullable(),
    submittedAt: z.number().int().nullable(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict();

const platformEarningBatchListResponseSchema = z
  .object({ data: z.array(platformEarningBatchSchema), meta: cursorMetaSchema })
  .strict();
const platformEarningLineListResponseSchema = z
  .object({ data: z.array(platformEarningLineSchema), meta: cursorMetaSchema })
  .strict();
const platformEarningBatchResponseSchema = z.object({ data: platformEarningBatchSchema }).strict();

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
  createdBeforeAt: query.createdBeforeAt,
  finalizedFromAt: query.finalizedFromAt,
  finalizedToAt: query.finalizedToAt,
  reconciledFromAt: query.reconciledFromAt,
  reconciledToAt: query.reconciledToAt,
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

const sanitizePlatformEarningBatchQuery = (
  query: PlatformEarningBatchQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  platform: query.platform,
  platformAccountId: query.platformAccountId,
  talentGroupId: query.talentGroupId,
  sourceType: query.sourceType,
  periodMonth: query.periodMonth,
  createdBeforeAt: query.createdBeforeAt,
  limit: query.limit,
  cursor: query.cursor,
});

const sanitizePlatformEarningLineQuery = (
  query: PlatformEarningLineQuery,
): Record<string, string | number | undefined> => ({
  batchId: query.batchId,
  status: query.status,
  platform: query.platform,
  platformAccountId: query.platformAccountId,
  talentGroupId: query.talentGroupId,
  memberTalentId: query.memberTalentId,
  periodMonth: query.periodMonth,
  limit: query.limit,
  cursor: query.cursor,
});

export const sanitizeRevenueEntryCreatePayload = (
  payload: RevenueEntryCreatePayload,
): RevenueEntryCreatePayload => {
  const sanitized: RevenueEntryCreatePayload = {
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
  };

  if (payload.revenueEntryCode !== undefined) {
    sanitized.revenueEntryCode = payload.revenueEntryCode;
  }

  return sanitized;
};

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

export const fetchPlatformEarningBatches = async (
  query: PlatformEarningBatchQuery,
): Promise<CursorPagedResponse<PlatformEarningBatch>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/revenue-ledger/platform-earning-batches',
    params: sanitizePlatformEarningBatchQuery(query),
  });

  return platformEarningBatchListResponseSchema.parse(response);
};

export const fetchPlatformEarningBatchDetail = async (
  batchId: string,
): Promise<PlatformEarningBatch> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/revenue-ledger/platform-earning-batches/${encodeURIComponent(batchId)}`,
  });

  return platformEarningBatchResponseSchema.parse(response).data;
};

export const fetchPlatformEarningLines = async (
  query: PlatformEarningLineQuery,
): Promise<CursorPagedResponse<PlatformEarningLine>> => {
  const batchId = query.batchId?.trim();
  if (!batchId) {
    return { data: [] };
  }
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/revenue-ledger/platform-earning-batches/${encodeURIComponent(
      batchId,
    )}/source-lines`,
    params: sanitizePlatformEarningLineQuery({ ...query, batchId: undefined }),
  });

  return platformEarningLineListResponseSchema.parse(response);
};

export const performPlatformEarningLifecycleAction = async (
  batchId: string,
  action: 'submit' | 'start-review' | 'archive',
): Promise<PlatformEarningBatch> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/revenue-ledger/platform-earning-batches/${encodeURIComponent(batchId)}/${action}`,
    data: {},
  });

  return platformEarningBatchResponseSchema.parse(response).data;
};

export const approvePlatformEarningBatch = async (
  batchId: string,
  payload: PlatformEarningApprovePayload,
): Promise<PlatformEarningBatch> => {
  const response = await apiRequest<unknown, PlatformEarningApprovePayload>({
    method: 'POST',
    url: `/admin/revenue-ledger/platform-earning-batches/${encodeURIComponent(batchId)}/approve`,
    data: payload,
  });

  return platformEarningBatchResponseSchema.parse(response).data;
};

export const rejectPlatformEarningBatch = async (
  batchId: string,
  payload: PlatformEarningReasonPayload,
): Promise<PlatformEarningBatch> => {
  const response = await apiRequest<unknown, PlatformEarningReasonPayload>({
    method: 'POST',
    url: `/admin/revenue-ledger/platform-earning-batches/${encodeURIComponent(batchId)}/reject`,
    data: payload,
  });

  return platformEarningBatchResponseSchema.parse(response).data;
};

export const voidPlatformEarningBatch = async (
  batchId: string,
  payload: PlatformEarningReasonPayload,
): Promise<PlatformEarningBatch> => {
  const response = await apiRequest<unknown, PlatformEarningReasonPayload>({
    method: 'POST',
    url: `/admin/revenue-ledger/platform-earning-batches/${encodeURIComponent(batchId)}/void`,
    data: payload,
  });

  return platformEarningBatchResponseSchema.parse(response).data;
};

export const createRevenueEntryFromPlatformEarningBatch = async (
  batchId: string,
  payload: CreateRevenueEntryFromPlatformEarningPayload,
): Promise<RevenueEntryRecord> => {
  const response = await apiRequest<unknown, CreateRevenueEntryFromPlatformEarningPayload>({
    method: 'POST',
    url: `/admin/revenue-ledger/platform-earning-batches/${encodeURIComponent(
      batchId,
    )}/create-revenue-entry`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const parsePlatformEarningBatchListForTest = (response: unknown) =>
  platformEarningBatchListResponseSchema.parse(response);

export const parseRevenueEntryDetailForTest = (response: unknown) =>
  detailResponseSchema.parse(response).data;
