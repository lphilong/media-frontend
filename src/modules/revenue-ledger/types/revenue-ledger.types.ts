export type RevenueEntryStatus = 'DRAFT' | 'FINALIZED' | 'RECONCILED' | 'VOIDED' | 'ARCHIVED';
export type RevenueKind = 'PLATFORM_LIVESTREAM' | 'PLATFORM_CONTENT' | 'EVENT_OPERATIONAL';
export type RevenueEntrySource = 'MANUAL' | 'PLATFORM_EARNING_BATCH';
export type RevenueLedgerSortBy = 'recognizedAt' | 'revenueEntryCode' | 'createdAt';
export type SortDirection = 'asc' | 'desc';
export type PlatformEarningBatchStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'VOIDED'
  | 'ARCHIVED';
export type PlatformEarningSourceType = 'TIKTOK_LIVESTREAM_DIAMOND';
export type PlatformEarningSourceUnit = 'DIAMOND';

export type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  status?: string;
};

export const revenueEntryStatusValues: RevenueEntryStatus[] = [
  'DRAFT',
  'FINALIZED',
  'RECONCILED',
  'VOIDED',
  'ARCHIVED',
];

export const revenueKindValues: RevenueKind[] = [
  'PLATFORM_LIVESTREAM',
  'PLATFORM_CONTENT',
  'EVENT_OPERATIONAL',
];

export const platformEarningBatchStatusValues: PlatformEarningBatchStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'VOIDED',
  'ARCHIVED',
];

export const platformEarningSourceTypeValues: PlatformEarningSourceType[] = [
  'TIKTOK_LIVESTREAM_DIAMOND',
];

export type RevenueSourceSummarySnapshot = {
  sourceKind: 'PLATFORM_EARNING_BATCH';
  sourceType: PlatformEarningSourceType;
  sourceBatchIds: string[];
  sourceSummaryRef: string;
  sourceLineCount: number;
  periodMonth: string;
  sourceDateFrom: number;
  sourceDateTo: number;
  platform: string;
  platformAccountId: string;
  talentGroupId: string | null;
  memberTalentIds: string[];
  memberEmploymentProfileIds: string[];
  eventIds: string[];
  sourceUnit: PlatformEarningSourceUnit;
  rawQuantityTotal: number;
  sourceFingerprint: string | null;
  approvedAt: number;
  approvedByActorId: string;
};

export type RevenueConversionSnapshot = {
  sourceUnit: PlatformEarningSourceUnit;
  rawQuantity: number;
  targetCurrency: string;
  appliedRate: number;
  rateType: string;
  rateEffectiveFrom: number | null;
  rateEffectiveTo: number | null;
  grossConvertedAmount: number;
  ruleRef: string | null;
  appliedByActorId: string;
  appliedAt: number;
  sourceNote: string | null;
};

export type RevenuePlatformCutSnapshot = {
  platformCutRate: number;
  companyShareRate: number;
  grossConvertedAmount: number;
  platformCutAmount: number;
  companyNetAmount: number;
  targetCurrency: string;
  ruleRef: string | null;
  appliedByActorId: string;
  appliedAt: number;
  sourceNote: string | null;
};

export type RevenueCommissionableBasisSnapshot = {
  basisType: 'COMPANY_NET';
  amount: number;
  currencyCode: string;
  appliedByActorId: string;
  appliedAt: number;
  sourceNote: string | null;
};

export type PlatformEarningBatch = {
  id: string;
  batchCode: string;
  platform: string;
  platformAccountId: string;
  talentGroupId: string | null;
  sourceType: PlatformEarningSourceType;
  sourceUnit: PlatformEarningSourceUnit;
  periodMonth: string;
  sourceDateFrom: number;
  sourceDateTo: number;
  status: PlatformEarningBatchStatus;
  sourceLineCount: number;
  rawQuantityTotal: number;
  conversionSnapshot: RevenueConversionSnapshot | null;
  platformCutSnapshot: RevenuePlatformCutSnapshot | null;
  companyNetAmount: number | null;
  commissionableBasisAmount: number | null;
  submittedByActorId: string | null;
  submittedAt: number | null;
  reviewedByActorId: string | null;
  reviewedAt: number | null;
  approvedByActorId: string | null;
  approvedAt: number | null;
  rejectedByActorId: string | null;
  rejectedAt: number | null;
  rejectionReason: string | null;
  voidedByActorId: string | null;
  voidedAt: number | null;
  voidReason: string | null;
  archivedByActorId: string | null;
  archivedAt: number | null;
  sourceFingerprint: string | null;
  revenueEntryId: string | null;
  revenueEntryCreatedByActorId: string | null;
  revenueEntryCreatedAt: number | null;
  createdByActorId: string;
  createdAt: number;
  updatedAt: number;
};

export type PlatformEarningLine = {
  id: string;
  batchId: string;
  batchStatus: PlatformEarningBatchStatus;
  sourceDate: number;
  periodMonth: string;
  platform: string;
  platformAccountId: string;
  talentGroupId: string | null;
  memberTalentId: string | null;
  memberEmploymentProfileId: string | null;
  eventId: string | null;
  sourceType: PlatformEarningSourceType;
  sourceUnit: PlatformEarningSourceUnit;
  rawQuantity: number;
  externalSourceRef: string | null;
  notes: string | null;
  duplicateDetectionKey: string;
  correctionOfLineId: string | null;
  replacementLineId: string | null;
  enteredByActorId: string;
  enteredAt: number;
  submittedByActorId: string | null;
  submittedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type PlatformEarningBatchQuery = {
  status?: PlatformEarningBatchStatus;
  platform?: string;
  platformAccountId?: string;
  talentGroupId?: string;
  sourceType?: PlatformEarningSourceType;
  periodMonth?: string;
  createdBeforeAt?: number;
  limit?: number;
  cursor?: string;
};

export type PlatformEarningLineQuery = {
  batchId?: string;
  status?: PlatformEarningBatchStatus;
  platform?: string;
  platformAccountId?: string;
  talentGroupId?: string;
  memberTalentId?: string;
  periodMonth?: string;
  limit?: number;
  cursor?: string;
};

export type PlatformEarningApprovePayload = {
  targetCurrency: string;
  appliedRate: number;
  rateType?: string | null;
  rateEffectiveFrom?: number | null;
  rateEffectiveTo?: number | null;
  platformCutRate: number;
  companyShareRate?: number | null;
  conversionRuleRef?: string | null;
  platformCutRuleRef?: string | null;
  sourceNote?: string | null;
};

export type PlatformEarningReasonPayload = {
  reason: string;
};

export type CreateRevenueEntryFromPlatformEarningPayload = {
  revenueEntryCode?: string | null;
  title?: string | null;
  subjectTalentId?: string | null;
  recognizedAt?: number | null;
  description?: string | null;
  externalRef?: string | null;
};

export type RevenueEntryRecord = {
  id: string;
  revenueEntryCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string | null;
  attributionTalentGroupId?: string | null;
  attributionEmploymentProfileId?: string | null;
  attributionEventId?: string | null;
  subjectTalentRef?: ReferenceSummary | null;
  attributionPlatformAccountRef?: ReferenceSummary | null;
  attributionEventRef?: ReferenceSummary | null;
  revenueKind: RevenueKind;
  entrySource: RevenueEntrySource;
  sourceBatchIds?: string[];
  sourceSummaryRef?: string | null;
  sourceLineCount?: number | null;
  sourceSummarySnapshot?: RevenueSourceSummarySnapshot | null;
  conversionSnapshot?: RevenueConversionSnapshot | null;
  platformCutSnapshot?: RevenuePlatformCutSnapshot | null;
  commissionableBasisSnapshot?: RevenueCommissionableBasisSnapshot | null;
  status: RevenueEntryStatus;
  currencyCode: string;
  recognizedAmount: number;
  recognizedAt: number | string;
  finalizedAt?: number | string | null;
  reconciledAt?: number | string | null;
  voidedAt?: number | string | null;
  reconciliationReference?: string | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type RevenueEntryListItem = Pick<
  RevenueEntryRecord,
  | 'id'
  | 'revenueEntryCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionPlatformAccountId'
  | 'attributionEventId'
  | 'subjectTalentRef'
  | 'attributionPlatformAccountRef'
  | 'attributionEventRef'
  | 'revenueKind'
  | 'entrySource'
  | 'status'
  | 'currencyCode'
  | 'recognizedAmount'
  | 'recognizedAt'
  | 'createdAt'
>;

export type RevenueEntryByTalentItem = Pick<
  RevenueEntryRecord,
  | 'id'
  | 'revenueEntryCode'
  | 'title'
  | 'subjectTalentId'
  | 'revenueKind'
  | 'status'
  | 'currencyCode'
  | 'recognizedAmount'
  | 'recognizedAt'
>;

export type RevenueEntryByPlatformItem = Pick<
  RevenueEntryRecord,
  | 'id'
  | 'revenueEntryCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionPlatformAccountId'
  | 'revenueKind'
  | 'status'
  | 'currencyCode'
  | 'recognizedAmount'
  | 'recognizedAt'
>;

export type RevenueEntryByEventItem = Pick<
  RevenueEntryRecord,
  | 'id'
  | 'revenueEntryCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionEventId'
  | 'revenueKind'
  | 'status'
  | 'currencyCode'
  | 'recognizedAmount'
  | 'recognizedAt'
>;

export type RevenueLedgerFlatListQuery = {
  status?: RevenueEntryStatus;
  subjectTalentId?: string;
  attributionPlatformAccountId?: string;
  attributionEventId?: string;
  revenueKind?: RevenueKind;
  entrySource?: RevenueEntrySource;
  currencyCode?: string;
  windowStartAt?: number;
  windowEndAt?: number;
  createdBeforeAt?: number;
  finalizedFromAt?: number;
  finalizedToAt?: number;
  reconciledFromAt?: number;
  reconciledToAt?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: RevenueLedgerSortBy;
  sortDirection?: SortDirection;
};

export type RevenueLedgerByTalentQuery = Pick<
  RevenueLedgerFlatListQuery,
  | 'subjectTalentId'
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-talent';
};

export type RevenueLedgerByPlatformQuery = Pick<
  RevenueLedgerFlatListQuery,
  | 'attributionPlatformAccountId'
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-platform';
};

export type RevenueLedgerByEventQuery = Pick<
  RevenueLedgerFlatListQuery,
  | 'attributionEventId'
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-event';
};

export type RevenueEntryCreatePayload = {
  revenueEntryCode?: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  revenueKind: RevenueKind;
  entrySource: RevenueEntrySource;
  currencyCode: string;
  recognizedAmount: number;
  recognizedAt: number;
  description?: string | null;
  externalRef?: string | null;
};

export type RevenueEntryDraftCorePayload = {
  title?: string;
  description?: string | null;
  externalRef?: string | null;
  subjectTalentId?: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  revenueKind?: RevenueKind;
  currencyCode?: string;
  recognizedAmount?: number;
  recognizedAt?: number;
};

export type RevenueEntryReconcilePayload = {
  reconciliationReference?: string | null;
};

export type RevenueLedgerLifecycleAction = 'finalize' | 'reconcile' | 'void' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
