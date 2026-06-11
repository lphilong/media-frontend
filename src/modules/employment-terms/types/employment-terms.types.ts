export const EMPLOYMENT_TERMS_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SUPERSEDED',
  'CANCELLED',
] as const;

export type EmploymentTermsStatus = (typeof EMPLOYMENT_TERMS_STATUSES)[number];
export type EmploymentTermsPayFrequency = 'MONTHLY';

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
