export const EMPLOYMENT_TERMS_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SUPERSEDED',
  'CANCELLED',
] as const;

export type EmploymentTermsStatus = (typeof EMPLOYMENT_TERMS_STATUSES)[number];
export type EmploymentTermsPayFrequency = 'MONTHLY';

export const EMPLOYMENT_TERMS_ADMIN_READINESS_FILTERS = [
  'CURRENT_EFFECTIVE',
  'PENDING_APPROVAL',
  'EXPIRED',
  'MISSING_BASE_SALARY',
  'OVERLAPPING',
  'PAYROLL_SOURCE_ELIGIBLE',
  'PAYROLL_SOURCE_INELIGIBLE',
] as const;

export type EmploymentTermsAdminReadinessFilter =
  (typeof EMPLOYMENT_TERMS_ADMIN_READINESS_FILTERS)[number];

export const EMPLOYMENT_PROFILE_EMPLOYMENT_STATUSES = [
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'TERMINATED',
  'ARCHIVED',
] as const;

export type EmploymentProfileEmploymentStatus =
  (typeof EMPLOYMENT_PROFILE_EMPLOYMENT_STATUSES)[number];

type EmploymentTermsAllowanceCommon = {
  type: string;
  label: string;
  currencyCode: string;
  payrollEligible: boolean;
  effectiveFrom: number | null;
  effectiveTo: number | null;
  sourceNote: string | null;
};

export type EmploymentTermsSensitiveAllowance = EmploymentTermsAllowanceCommon & {
  amount: number;
};

export type EmploymentTermsRedactedAllowance = EmploymentTermsAllowanceCommon & {
  amount?: never;
};

export type EmploymentTermsAllowance =
  | EmploymentTermsSensitiveAllowance
  | EmploymentTermsRedactedAllowance;

type EmploymentTermsRecordCommon = {
  id: string;
  termsCode: string;
  employmentProfileId: string;
  status: EmploymentTermsStatus;
  effectiveFrom: number;
  effectiveTo: number | null;
  currencyCode: string;
  payFrequency: EmploymentTermsPayFrequency;
  payrollEligible: boolean;
  sourceNote: string | null;
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
  approvedAt: number | null;
  cancelledAt: number | null;
  supersedesTermsId: string | null;
  supersededByTermsId: string | null;
  version: number;
};

export type EmploymentTermsSensitiveRecord = EmploymentTermsRecordCommon & {
  baseSalaryAmount: number;
  allowances: EmploymentTermsSensitiveAllowance[];
  sensitiveAmountsRedacted: false;
};

export type EmploymentTermsRedactedRecord = EmploymentTermsRecordCommon & {
  baseSalaryAmount?: never;
  allowances: EmploymentTermsRedactedAllowance[];
  sensitiveAmountsRedacted: true;
};

export type EmploymentTermsRecord = EmploymentTermsSensitiveRecord | EmploymentTermsRedactedRecord;

export type EmploymentTermsReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  displayName?: string;
  status?: string;
};

export type EmploymentTermsAdminProfileSummary = {
  id: string;
  employeeCode: string;
  displayName: string;
  legalName: string;
  employmentStatus: EmploymentProfileEmploymentStatus;
  orgUnitId: string;
  orgUnitRef: EmploymentTermsReferenceSummary | null;
  linkedUserRef?: EmploymentTermsReferenceSummary | null;
};

export type EmploymentTermsAdminDerivedFlags = {
  isCurrentEffective: boolean;
  isExpired: boolean;
  isPendingApproval: boolean;
  hasMissingBaseSalary: boolean;
  hasOverlapForProfile: boolean;
  payrollSourceEligibility: 'ELIGIBLE' | 'INELIGIBLE';
};

export type EmploymentTermsAdminListItem = EmploymentTermsRecord &
  EmploymentTermsAdminDerivedFlags & {
    employmentProfile: EmploymentTermsAdminProfileSummary;
  };

export type EmploymentTermsAdminFilters = {
  employmentProfileId?: string;
  orgUnitId?: string;
  employmentStatus?: EmploymentProfileEmploymentStatus;
  status?: EmploymentTermsStatus;
  payrollEligible?: boolean;
  effectiveOn?: string;
  expiringBefore?: string;
  readiness?: EmploymentTermsAdminReadinessFilter;
  search?: string;
  cursor?: string;
  limit?: number;
};

export type EmploymentTermsAdminAppliedFilters = {
  employmentProfileId?: string;
  orgUnitId?: string;
  employmentStatus?: EmploymentProfileEmploymentStatus;
  status?: EmploymentTermsStatus;
  payrollEligible?: boolean;
  effectiveOn: number;
  expiringBefore?: number;
  readiness?: EmploymentTermsAdminReadinessFilter;
  search?: string;
};

export type EmploymentTermsAdminListResponse = {
  items: EmploymentTermsAdminListItem[];
  nextCursor: string | null;
  appliedFilters: EmploymentTermsAdminAppliedFilters;
};

export type EmploymentTermsAllowancePayload = {
  type: string;
  label: string;
  amount: number;
  currencyCode: string;
  payrollEligible: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceNote: string | null;
};

export type EmploymentTermsPayload = {
  effectiveFrom: string;
  effectiveTo: string | null;
  baseSalaryAmount: number;
  currencyCode: string;
  payFrequency: EmploymentTermsPayFrequency;
  allowances: EmploymentTermsAllowancePayload[];
  payrollEligible: boolean;
  sourceNote: string | null;
};
