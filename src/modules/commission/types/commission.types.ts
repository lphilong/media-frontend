export type CommissionRuleStatus = 'DRAFT' | 'INACTIVE' | 'ACTIVE' | 'ARCHIVED';
export type CommissionSettlementStatus = 'DRAFT' | 'FINALIZED' | 'VOIDED' | 'ARCHIVED';
export type CommissionBeneficiaryKind = 'EMPLOYMENT_PROFILE' | 'TALENT';
export type CommissionSettlementKind = 'REVENUE_SHARE';
export type CommissionSettlementBasis = 'RECOGNIZED_GROSS_REVENUE';
export type CommissionRevenueKind =
  | 'PLATFORM_LIVESTREAM'
  | 'PLATFORM_CONTENT'
  | 'EVENT_OPERATIONAL';
export type CommissionRuleSortBy = 'ruleCode' | 'title' | 'effectiveStartDate' | 'createdAt';
export type CommissionSettlementSortBy =
  | 'settlementPeriodStartAt'
  | 'settlementCode'
  | 'createdAt'
  | 'finalizedAt';
export type SortDirection = 'asc' | 'desc';

export const commissionRuleStatusValues: CommissionRuleStatus[] = [
  'DRAFT',
  'INACTIVE',
  'ACTIVE',
  'ARCHIVED',
];

export const commissionSettlementStatusValues: CommissionSettlementStatus[] = [
  'DRAFT',
  'FINALIZED',
  'VOIDED',
  'ARCHIVED',
];

export const commissionBeneficiaryKindValues: CommissionBeneficiaryKind[] = [
  'EMPLOYMENT_PROFILE',
  'TALENT',
];

export const commissionRevenueKindValues: CommissionRevenueKind[] = [
  'PLATFORM_LIVESTREAM',
  'PLATFORM_CONTENT',
  'EVENT_OPERATIONAL',
];

export const commissionSettlementKindValues: CommissionSettlementKind[] = ['REVENUE_SHARE'];
export const commissionSettlementBasisValues: CommissionSettlementBasis[] = [
  'RECOGNIZED_GROSS_REVENUE',
];

export type CommissionRuleRecord = {
  id: string;
  ruleCode: string;
  title: string;
  settlementKind: CommissionSettlementKind;
  beneficiaryKind: CommissionBeneficiaryKind;
  beneficiaryEmploymentProfileId?: string | null;
  beneficiaryTalentId?: string | null;
  sourceContractRecordId: string;
  settlementBasis: CommissionSettlementBasis;
  ratePercent: number;
  appliesToRevenueKinds: CommissionRevenueKind[];
  status: CommissionRuleStatus;
  effectiveStartDate: number | string;
  effectiveEndDate?: number | string | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type CommissionRuleListItem = Pick<
  CommissionRuleRecord,
  | 'id'
  | 'ruleCode'
  | 'title'
  | 'settlementKind'
  | 'beneficiaryKind'
  | 'beneficiaryEmploymentProfileId'
  | 'beneficiaryTalentId'
  | 'sourceContractRecordId'
  | 'ratePercent'
  | 'status'
  | 'effectiveStartDate'
  | 'effectiveEndDate'
  | 'createdAt'
>;

export type CommissionSettlementRecord = {
  id: string;
  settlementCode: string;
  title: string;
  sourceRuleId: string;
  sourceContractRecordIdSnapshot?: string | null;
  settlementKindSnapshot: CommissionSettlementKind;
  beneficiaryKindSnapshot: CommissionBeneficiaryKind;
  beneficiaryEmploymentProfileIdSnapshot?: string | null;
  beneficiaryTalentIdSnapshot?: string | null;
  subjectTalentId: string;
  settlementBasisSnapshot: CommissionSettlementBasis;
  ratePercentSnapshot: number;
  revenueEntryIds: string[];
  settlementPeriodStartAt: number | string;
  settlementPeriodEndAt: number | string;
  settlementCurrencyCode: string;
  grossRevenueAmount: number;
  settlementAmount: number;
  status: CommissionSettlementStatus;
  finalizedAt?: number | string | null;
  voidedAt?: number | string | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type CommissionSettlementListItem = Pick<
  CommissionSettlementRecord,
  | 'id'
  | 'settlementCode'
  | 'title'
  | 'sourceRuleId'
  | 'settlementKindSnapshot'
  | 'beneficiaryKindSnapshot'
  | 'beneficiaryEmploymentProfileIdSnapshot'
  | 'beneficiaryTalentIdSnapshot'
  | 'subjectTalentId'
  | 'settlementCurrencyCode'
  | 'grossRevenueAmount'
  | 'settlementAmount'
  | 'status'
  | 'settlementPeriodStartAt'
  | 'settlementPeriodEndAt'
  | 'finalizedAt'
  | 'createdAt'
>;

export type CommissionSettlementLineItem = {
  id: string;
  revenueEntryId: string;
  revenueEntryCodeSnapshot: string;
  revenueKindSnapshot: CommissionRevenueKind;
  revenueCurrencyCodeSnapshot: string;
  revenueRecognizedAmountSnapshot: number;
  revenueRecognizedAtSnapshot: number | string;
  lineSettlementAmount: number;
};

export type CommissionRulesFlatListQuery = {
  status?: CommissionRuleStatus;
  settlementKind?: CommissionSettlementKind;
  beneficiaryKind?: CommissionBeneficiaryKind;
  beneficiaryEmploymentProfileId?: string;
  beneficiaryTalentId?: string;
  sourceContractRecordId?: string;
  appliesToRevenueKind?: CommissionRevenueKind;
  windowStartDate?: number;
  windowEndDate?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: CommissionRuleSortBy;
  sortDirection?: SortDirection;
};

export type CommissionRulesByBeneficiaryQuery = Pick<
  CommissionRulesFlatListQuery,
  | 'beneficiaryKind'
  | 'beneficiaryEmploymentProfileId'
  | 'beneficiaryTalentId'
  | 'status'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-beneficiary';
};

export type CommissionRulesByContractQuery = Pick<
  CommissionRulesFlatListQuery,
  'sourceContractRecordId' | 'status' | 'limit' | 'cursor' | 'sortBy' | 'sortDirection'
> & {
  view?: 'by-contract';
};

export type CommissionSettlementsFlatListQuery = {
  status?: CommissionSettlementStatus;
  settlementKindSnapshot?: CommissionSettlementKind;
  beneficiaryKindSnapshot?: CommissionBeneficiaryKind;
  beneficiaryEmploymentProfileIdSnapshot?: string;
  beneficiaryTalentIdSnapshot?: string;
  subjectTalentId?: string;
  sourceRuleId?: string;
  containsRevenueEntryId?: string;
  settlementCurrencyCode?: string;
  windowStartAt?: number;
  windowEndAt?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: CommissionSettlementSortBy;
  sortDirection?: SortDirection;
};

export type CommissionSettlementsByBeneficiaryQuery = Pick<
  CommissionSettlementsFlatListQuery,
  | 'beneficiaryKindSnapshot'
  | 'beneficiaryEmploymentProfileIdSnapshot'
  | 'beneficiaryTalentIdSnapshot'
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-beneficiary';
};

export type CommissionSettlementsBySubjectTalentQuery = Pick<
  CommissionSettlementsFlatListQuery,
  | 'subjectTalentId'
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-subject-talent';
};

export type CommissionSettlementsByRevenueEntryQuery = Pick<
  CommissionSettlementsFlatListQuery,
  'status' | 'windowStartAt' | 'windowEndAt' | 'limit' | 'cursor' | 'sortBy' | 'sortDirection'
> & {
  view?: 'by-revenue-entry';
  revenueEntryId?: string;
};

export type CommissionRuleCreatePayload = {
  ruleCode?: string;
  title: string;
  settlementKind: CommissionSettlementKind;
  beneficiaryKind: CommissionBeneficiaryKind;
  beneficiaryEmploymentProfileId?: string;
  beneficiaryTalentId?: string;
  sourceContractRecordId: string;
  settlementBasis: CommissionSettlementBasis;
  ratePercent: number;
  appliesToRevenueKinds: CommissionRevenueKind[];
  effectiveStartDate: number;
  effectiveEndDate?: number | null;
  description?: string | null;
  externalRef?: string | null;
};

export type CommissionRuleDraftCorePayload = {
  title?: string;
  ratePercent?: number;
  appliesToRevenueKinds?: CommissionRevenueKind[];
  effectiveStartDate?: number;
  effectiveEndDate?: number | null;
  description?: string | null;
  externalRef?: string | null;
};

export type CommissionSettlementCreatePayload = {
  settlementCode?: string;
  title: string;
  sourceRuleId: string;
  settlementPeriodStartAt: number;
  settlementPeriodEndAt: number;
  revenueEntryIds: string[];
  description?: string | null;
  externalRef?: string | null;
};

export type CommissionSettlementDraftCorePayload = {
  title?: string;
  settlementPeriodStartAt?: number;
  settlementPeriodEndAt?: number;
  description?: string | null;
  externalRef?: string | null;
};

export type CommissionSettlementRevenueEntriesPayload = {
  revenueEntryIds: string[];
};

export type CommissionRuleLifecycleAction = 'activate' | 'deactivate' | 'archive';
export type CommissionSettlementLifecycleAction = 'finalize' | 'void' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
