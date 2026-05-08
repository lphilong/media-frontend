import { z } from 'zod';

import type {
  CommissionRuleCreatePayload,
  CommissionRuleDraftCorePayload,
  CommissionRuleLifecycleAction,
  CommissionRuleListItem,
  CommissionRuleRecord,
  CommissionRulesByBeneficiaryQuery,
  CommissionRulesByContractQuery,
  CommissionRulesFlatListQuery,
  CommissionSettlementCreatePayload,
  CommissionSettlementDraftCorePayload,
  CommissionSettlementLifecycleAction,
  CommissionSettlementLineItem,
  CommissionSettlementListItem,
  CommissionSettlementRecord,
  CommissionSettlementRevenueEntriesPayload,
  CommissionSettlementsByBeneficiaryQuery,
  CommissionSettlementsByRevenueEntryQuery,
  CommissionSettlementsBySubjectTalentQuery,
  CommissionSettlementsFlatListQuery,
  CursorPagedResponse,
} from '@modules/commission/types/commission.types';
import { apiRequest } from '@shared/api';

const ruleStatusSchema = z.enum(['DRAFT', 'INACTIVE', 'ACTIVE', 'ARCHIVED']);
const settlementStatusSchema = z.enum(['DRAFT', 'FINALIZED', 'VOIDED', 'ARCHIVED']);
const settlementKindSchema = z.literal('REVENUE_SHARE');
const beneficiaryKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT']);
const settlementBasisSchema = z.literal('RECOGNIZED_GROSS_REVENUE');
const revenueKindSchema = z.enum(['PLATFORM_LIVESTREAM', 'PLATFORM_CONTENT', 'EVENT_OPERATIONAL']);
const timestampSchema = z.union([z.number(), z.string()]);

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const ruleListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    ruleCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    settlementKind: settlementKindSchema,
    beneficiaryKind: beneficiaryKindSchema,
    beneficiaryEmploymentProfileId: z.string().nullable().optional(),
    beneficiaryTalentId: z.string().nullable().optional(),
    sourceContractRecordId: z.string().trim().min(1),
    ratePercent: z.number(),
    status: ruleStatusSchema,
    effectiveStartDate: timestampSchema,
    effectiveEndDate: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
  })
  .strict();

const ruleDetailSchema = ruleListItemSchema
  .extend({
    settlementBasis: settlementBasisSchema,
    appliesToRevenueKinds: z.array(revenueKindSchema),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    updatedAt: timestampSchema,
  })
  .strict();

const settlementListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    settlementCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    sourceRuleId: z.string().trim().min(1),
    settlementKindSnapshot: settlementKindSchema,
    beneficiaryKindSnapshot: beneficiaryKindSchema,
    beneficiaryEmploymentProfileIdSnapshot: z.string().nullable().optional(),
    beneficiaryTalentIdSnapshot: z.string().nullable().optional(),
    subjectTalentId: z.string().trim().min(1),
    settlementCurrencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    grossRevenueAmount: z.number(),
    settlementAmount: z.number(),
    status: settlementStatusSchema,
    settlementPeriodStartAt: timestampSchema,
    settlementPeriodEndAt: timestampSchema,
    finalizedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
  })
  .strict();

const settlementDetailSchema = settlementListItemSchema
  .extend({
    sourceContractRecordIdSnapshot: z.string().nullable().optional(),
    settlementBasisSnapshot: settlementBasisSchema,
    ratePercentSnapshot: z.number(),
    revenueEntryIds: z.array(z.string().trim().min(1)),
    voidedAt: timestampSchema.nullable().optional(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    updatedAt: timestampSchema,
  })
  .strict();

const settlementLineSchema = z
  .object({
    id: z.string().trim().min(1),
    revenueEntryId: z.string().trim().min(1),
    revenueEntryCodeSnapshot: z.string().trim().min(1),
    revenueKindSnapshot: revenueKindSchema,
    revenueCurrencyCodeSnapshot: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    revenueRecognizedAmountSnapshot: z.number(),
    revenueRecognizedAtSnapshot: timestampSchema,
    lineSettlementAmount: z.number(),
  })
  .strict();

const ruleListResponseSchema = z
  .object({ data: z.array(ruleListItemSchema), meta: cursorMetaSchema })
  .strict();
const ruleDetailResponseSchema = z.object({ data: ruleDetailSchema }).strict();
const settlementListResponseSchema = z
  .object({ data: z.array(settlementListItemSchema), meta: cursorMetaSchema })
  .strict();
const settlementDetailResponseSchema = z.object({ data: settlementDetailSchema }).strict();
const settlementLinesResponseSchema = z.object({ data: z.array(settlementLineSchema) }).strict();

const sanitizeRulesFlatQuery = (
  query: CommissionRulesFlatListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  settlementKind: query.settlementKind,
  beneficiaryKind: query.beneficiaryKind,
  beneficiaryEmploymentProfileId: query.beneficiaryEmploymentProfileId,
  beneficiaryTalentId: query.beneficiaryTalentId,
  sourceContractRecordId: query.sourceContractRecordId,
  appliesToRevenueKind: query.appliesToRevenueKind,
  windowStartDate: query.windowStartDate,
  windowEndDate: query.windowEndDate,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeRulesByBeneficiaryQuery = (
  query: CommissionRulesByBeneficiaryQuery,
): Record<string, string | number | undefined> => ({
  beneficiaryKind: query.beneficiaryKind,
  beneficiaryEmploymentProfileId: query.beneficiaryEmploymentProfileId,
  beneficiaryTalentId: query.beneficiaryTalentId,
  status: query.status,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeRulesByContractQuery = (
  query: CommissionRulesByContractQuery,
): Record<string, string | number | undefined> => ({
  sourceContractRecordId: query.sourceContractRecordId,
  status: query.status,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeSettlementsFlatQuery = (
  query: CommissionSettlementsFlatListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  settlementKindSnapshot: query.settlementKindSnapshot,
  beneficiaryKindSnapshot: query.beneficiaryKindSnapshot,
  beneficiaryEmploymentProfileIdSnapshot: query.beneficiaryEmploymentProfileIdSnapshot,
  beneficiaryTalentIdSnapshot: query.beneficiaryTalentIdSnapshot,
  subjectTalentId: query.subjectTalentId,
  sourceRuleId: query.sourceRuleId,
  containsRevenueEntryId: query.containsRevenueEntryId,
  settlementCurrencyCode: query.settlementCurrencyCode,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeSettlementsByBeneficiaryQuery = (
  query: CommissionSettlementsByBeneficiaryQuery,
): Record<string, string | number | undefined> => ({
  beneficiaryKindSnapshot: query.beneficiaryKindSnapshot,
  beneficiaryEmploymentProfileIdSnapshot: query.beneficiaryEmploymentProfileIdSnapshot,
  beneficiaryTalentIdSnapshot: query.beneficiaryTalentIdSnapshot,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeSettlementsBySubjectTalentQuery = (
  query: CommissionSettlementsBySubjectTalentQuery,
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

const sanitizeSettlementsByRevenueEntryQuery = (
  query: CommissionSettlementsByRevenueEntryQuery,
): Record<string, string | number | undefined> => ({
  revenueEntryId: query.revenueEntryId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

export const sanitizeCommissionRuleCreatePayload = (
  payload: CommissionRuleCreatePayload,
): CommissionRuleCreatePayload => {
  const sanitized: CommissionRuleCreatePayload = {
    ruleCode: payload.ruleCode,
    title: payload.title,
    settlementKind: payload.settlementKind,
    beneficiaryKind: payload.beneficiaryKind,
    sourceContractRecordId: payload.sourceContractRecordId,
    settlementBasis: payload.settlementBasis,
    ratePercent: payload.ratePercent,
    appliesToRevenueKinds: payload.appliesToRevenueKinds,
    effectiveStartDate: payload.effectiveStartDate,
    effectiveEndDate: payload.effectiveEndDate ?? null,
    description: payload.description ?? null,
    externalRef: payload.externalRef ?? null,
  };

  if (payload.beneficiaryKind === 'EMPLOYMENT_PROFILE' && payload.beneficiaryEmploymentProfileId) {
    sanitized.beneficiaryEmploymentProfileId = payload.beneficiaryEmploymentProfileId;
  }

  if (payload.beneficiaryKind === 'TALENT' && payload.beneficiaryTalentId) {
    sanitized.beneficiaryTalentId = payload.beneficiaryTalentId;
  }

  return sanitized;
};

export const sanitizeCommissionRuleDraftCorePayload = (
  payload: CommissionRuleDraftCorePayload,
): CommissionRuleDraftCorePayload => {
  const sanitized: CommissionRuleDraftCorePayload = {};

  if (payload.title !== undefined) sanitized.title = payload.title;
  if (payload.ratePercent !== undefined) sanitized.ratePercent = payload.ratePercent;
  if (payload.appliesToRevenueKinds !== undefined) {
    sanitized.appliesToRevenueKinds = payload.appliesToRevenueKinds;
  }
  if (payload.effectiveStartDate !== undefined) {
    sanitized.effectiveStartDate = payload.effectiveStartDate;
  }
  if (payload.effectiveEndDate !== undefined) sanitized.effectiveEndDate = payload.effectiveEndDate;
  if (payload.description !== undefined) sanitized.description = payload.description;
  if (payload.externalRef !== undefined) sanitized.externalRef = payload.externalRef;

  return sanitized;
};

export const sanitizeCommissionSettlementCreatePayload = (
  payload: CommissionSettlementCreatePayload,
): CommissionSettlementCreatePayload => ({
  settlementCode: payload.settlementCode,
  title: payload.title,
  sourceRuleId: payload.sourceRuleId,
  settlementPeriodStartAt: payload.settlementPeriodStartAt,
  settlementPeriodEndAt: payload.settlementPeriodEndAt,
  revenueEntryIds: payload.revenueEntryIds,
  description: payload.description ?? null,
  externalRef: payload.externalRef ?? null,
});

export const sanitizeCommissionSettlementDraftCorePayload = (
  payload: CommissionSettlementDraftCorePayload,
): CommissionSettlementDraftCorePayload => {
  const sanitized: CommissionSettlementDraftCorePayload = {};

  if (payload.title !== undefined) sanitized.title = payload.title;
  if (payload.settlementPeriodStartAt !== undefined) {
    sanitized.settlementPeriodStartAt = payload.settlementPeriodStartAt;
  }
  if (payload.settlementPeriodEndAt !== undefined) {
    sanitized.settlementPeriodEndAt = payload.settlementPeriodEndAt;
  }
  if (payload.description !== undefined) sanitized.description = payload.description;
  if (payload.externalRef !== undefined) sanitized.externalRef = payload.externalRef;

  return sanitized;
};

export const sanitizeCommissionSettlementRevenueEntriesPayload = (
  payload: CommissionSettlementRevenueEntriesPayload,
): CommissionSettlementRevenueEntriesPayload => ({
  revenueEntryIds: payload.revenueEntryIds,
});

export const commissionZeroBody = (): Record<string, never> => ({});

export const fetchCommissionRules = async (
  query: CommissionRulesFlatListQuery,
): Promise<CursorPagedResponse<CommissionRuleListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/commission/rules',
    params: sanitizeRulesFlatQuery(query),
  });

  return ruleListResponseSchema.parse(response);
};

export const fetchCommissionRulesByBeneficiary = async (
  query: CommissionRulesByBeneficiaryQuery,
): Promise<CursorPagedResponse<CommissionRuleListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/commission/rules/by-beneficiary',
    params: sanitizeRulesByBeneficiaryQuery(query),
  });

  return ruleListResponseSchema.parse(response);
};

export const fetchCommissionRulesByContract = async (
  query: CommissionRulesByContractQuery,
): Promise<CursorPagedResponse<CommissionRuleListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/commission/rules/by-contract',
    params: sanitizeRulesByContractQuery(query),
  });

  return ruleListResponseSchema.parse(response);
};

export const fetchCommissionRuleDetail = async (
  commissionRuleId: string,
): Promise<CommissionRuleRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/commission/rules/${encodeURIComponent(commissionRuleId)}`,
  });

  return ruleDetailResponseSchema.parse(response).data;
};

export const createCommissionRule = async (
  payload: CommissionRuleCreatePayload,
): Promise<CommissionRuleRecord> => {
  const response = await apiRequest<unknown, CommissionRuleCreatePayload>({
    method: 'POST',
    url: '/admin/commission/rules',
    data: sanitizeCommissionRuleCreatePayload(payload),
  });

  return ruleDetailResponseSchema.parse(response).data;
};

export const updateCommissionRuleDraftCore = async (
  commissionRuleId: string,
  payload: CommissionRuleDraftCorePayload,
): Promise<CommissionRuleRecord> => {
  const response = await apiRequest<unknown, CommissionRuleDraftCorePayload>({
    method: 'PATCH',
    url: `/admin/commission/rules/${encodeURIComponent(commissionRuleId)}/draft-core`,
    data: sanitizeCommissionRuleDraftCorePayload(payload),
  });

  return ruleDetailResponseSchema.parse(response).data;
};

export const performCommissionRuleLifecycleAction = async (
  commissionRuleId: string,
  action: CommissionRuleLifecycleAction,
): Promise<CommissionRuleRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/commission/rules/${encodeURIComponent(commissionRuleId)}/${action}`,
    data: commissionZeroBody(),
  });

  return ruleDetailResponseSchema.parse(response).data;
};

export const fetchCommissionSettlements = async (
  query: CommissionSettlementsFlatListQuery,
): Promise<CursorPagedResponse<CommissionSettlementListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/commission/settlements',
    params: sanitizeSettlementsFlatQuery(query),
  });

  return settlementListResponseSchema.parse(response);
};

export const fetchCommissionSettlementsByBeneficiary = async (
  query: CommissionSettlementsByBeneficiaryQuery,
): Promise<CursorPagedResponse<CommissionSettlementListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/commission/settlements/by-beneficiary',
    params: sanitizeSettlementsByBeneficiaryQuery(query),
  });

  return settlementListResponseSchema.parse(response);
};

export const fetchCommissionSettlementsBySubjectTalent = async (
  query: CommissionSettlementsBySubjectTalentQuery,
): Promise<CursorPagedResponse<CommissionSettlementListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/commission/settlements/by-subject-talent',
    params: sanitizeSettlementsBySubjectTalentQuery(query),
  });

  return settlementListResponseSchema.parse(response);
};

export const fetchCommissionSettlementsByRevenueEntry = async (
  query: CommissionSettlementsByRevenueEntryQuery,
): Promise<CursorPagedResponse<CommissionSettlementListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/commission/settlements/by-revenue-entry',
    params: sanitizeSettlementsByRevenueEntryQuery(query),
  });

  return settlementListResponseSchema.parse(response);
};

export const fetchCommissionSettlementDetail = async (
  commissionSettlementId: string,
): Promise<CommissionSettlementRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/commission/settlements/${encodeURIComponent(commissionSettlementId)}`,
  });

  return settlementDetailResponseSchema.parse(response).data;
};

export const fetchCommissionSettlementLines = async (
  commissionSettlementId: string,
): Promise<CommissionSettlementLineItem[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/commission/settlements/${encodeURIComponent(commissionSettlementId)}/lines`,
  });

  return settlementLinesResponseSchema.parse(response).data;
};

export const createCommissionSettlement = async (
  payload: CommissionSettlementCreatePayload,
): Promise<CommissionSettlementRecord> => {
  const response = await apiRequest<unknown, CommissionSettlementCreatePayload>({
    method: 'POST',
    url: '/admin/commission/settlements',
    data: sanitizeCommissionSettlementCreatePayload(payload),
  });

  return settlementDetailResponseSchema.parse(response).data;
};

export const updateCommissionSettlementDraftCore = async (
  commissionSettlementId: string,
  payload: CommissionSettlementDraftCorePayload,
): Promise<CommissionSettlementRecord> => {
  const response = await apiRequest<unknown, CommissionSettlementDraftCorePayload>({
    method: 'PATCH',
    url: `/admin/commission/settlements/${encodeURIComponent(commissionSettlementId)}/draft-core`,
    data: sanitizeCommissionSettlementDraftCorePayload(payload),
  });

  return settlementDetailResponseSchema.parse(response).data;
};

export const replaceCommissionSettlementRevenueEntries = async (
  commissionSettlementId: string,
  payload: CommissionSettlementRevenueEntriesPayload,
): Promise<CommissionSettlementRecord> => {
  const response = await apiRequest<unknown, CommissionSettlementRevenueEntriesPayload>({
    method: 'POST',
    url: `/admin/commission/settlements/${encodeURIComponent(
      commissionSettlementId,
    )}/revenue-entries`,
    data: sanitizeCommissionSettlementRevenueEntriesPayload(payload),
  });

  return settlementDetailResponseSchema.parse(response).data;
};

export const performCommissionSettlementLifecycleAction = async (
  commissionSettlementId: string,
  action: CommissionSettlementLifecycleAction,
): Promise<CommissionSettlementRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/commission/settlements/${encodeURIComponent(commissionSettlementId)}/${action}`,
    data: commissionZeroBody(),
  });

  return settlementDetailResponseSchema.parse(response).data;
};
