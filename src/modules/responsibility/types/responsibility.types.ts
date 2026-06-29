import type { ReferenceSummary } from '@shared/formatting/formatters';

export type ResponsibilitySubjectType =
  | 'TALENT_GROUP'
  | 'ORG_UNIT'
  | 'TALENT'
  | 'EMPLOYMENT_PROFILE';

export type ResponsibilityType =
  | 'TALENT_GROUP_MANAGER'
  | 'ORG_UNIT_MANAGER'
  | 'TALENT_DIRECT_MANAGER'
  | 'EMPLOYMENT_REPORTING_MANAGER';

export type ResponsibilityStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export type ResponsibilityAssignment = {
  id: string;
  subjectType: ResponsibilitySubjectType;
  subjectId: string;
  responsibleEmploymentProfileId: string;
  responsibilityType: ResponsibilityType;
  responsibilityRole: string | null;
  includeDescendants: boolean | null;
  actionMask: string[];
  isPrimary: boolean;
  status: ResponsibilityStatus;
  effectiveAt: number | string;
  expiresAt: number | string | null;
  revokedAt: number | string | null;
  reason: string | null;
  createdBy: string;
  createdAt: number | string;
  updatedBy: string;
  updatedAt: number | string;
  revokedBy: string | null;
  revokedReason: string | null;
  reviewNeeded: boolean;
  reviewReason: string | null;
  subjectRef: ReferenceSummary | null;
  responsibleEmploymentProfileRef: ReferenceSummary | null;
};

export type ResponsibilityListQuery = {
  responsibleEmploymentProfileId?: string;
  subjectType?: ResponsibilitySubjectType;
  subjectId?: string;
  responsibilityType?: ResponsibilityType;
  status?: ResponsibilityStatus;
  active?: boolean;
  limit?: number;
};

export type CreateResponsibilityPayload = {
  subjectType: ResponsibilitySubjectType;
  subjectId: string;
  responsibleEmploymentProfileId: string;
  responsibilityType: ResponsibilityType;
  responsibilityRole?: string | null;
  includeDescendants?: boolean | null;
  isPrimary?: boolean;
  effectiveAt?: string | number | null;
  expiresAt?: string | number | null;
  reason?: string | null;
};

export type ResponsibilitySummary = {
  items: ResponsibilityAssignment[];
  inherited: ResponsibilityAssignment[];
};
