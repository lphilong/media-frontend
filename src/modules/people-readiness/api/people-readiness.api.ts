import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const PEOPLE_READINESS_CATEGORIES = [
  'ACCOUNT_LOGIN_READY',
  'EMPLOYMENT_PROFILE_LIFECYCLE',
  'ORGUNIT_PARTICIPATION',
  'TALENTGROUP_MEMBER_LINKAGE',
  'MANAGER_ASSIGNMENT_READY',
  'SELF_SERVICE_READY',
  'WORKSCHEDULE_READY',
  'KPI_READY',
  'EMPLOYMENT_TERMS_READY',
] as const;

export const PEOPLE_READINESS_SEVERITIES = ['BLOCKER', 'WARNING', 'INFO'] as const;

export const PEOPLE_READINESS_ISSUE_CODES = [
  'ACTIVE_USER_WITHOUT_EMPLOYMENT_PROFILE',
  'EMPLOYMENT_PROFILE_REQUIRES_LOGIN_BUT_MISSING_ACTIVE_USER',
  'EMPLOYMENT_PROFILE_LINKED_USER_INACTIVE',
  'EMPLOYMENT_PROFILE_NOT_ACTIVE_FOR_OPERATIONS',
  'EMPLOYMENT_PROFILE_MISSING_ORG_UNIT',
  'EMPLOYMENT_PROFILE_IN_INACTIVE_ORG_UNIT',
  'INTERNAL_TALENT_MISSING_EMPLOYMENT_PROFILE',
  'INTERNAL_TALENT_LINKED_PROFILE_NOT_ACTIVE',
  'EXTERNAL_TALENT_HAS_EMPLOYMENT_PROFILE_LINK',
  'TALENTGROUP_ACTIVE_MEMBER_MISSING_EMPLOYMENT_PROFILE',
  'TALENTGROUP_ACTIVE_MEMBER_LINKED_PROFILE_NOT_ACTIVE',
  'TALENTGROUP_ACTIVE_MEMBER_TALENT_NOT_ACTIVE',
  'TALENTGROUP_HAS_NO_OPERATIONAL_MEMBERS',
  'ORGUNIT_HAS_NO_ACTIVE_EMPLOYMENT_PROFILES',
  'ORGUNIT_MANAGER_ASSIGNMENT_MANAGER_NOT_PROFILE_READY',
  'ORGUNIT_MANAGER_ASSIGNMENT_MANAGER_NOT_LOGIN_READY',
  'TALENTGROUP_MANAGER_ASSIGNMENT_MANAGER_NOT_PROFILE_READY',
  'TALENTGROUP_MANAGER_ASSIGNMENT_MANAGER_NOT_LOGIN_READY',
  'SELF_SERVICE_PROFILE_NOT_ACTIVE',
  'ACTIVE_PROFILE_MISSING_EMPLOYMENT_TERMS',
  'EMPLOYMENT_TERMS_PENDING_APPROVAL',
  'EMPLOYMENT_TERMS_EXPIRED',
  'EMPLOYMENT_TERMS_MISSING_BASE_SALARY',
  'EMPLOYMENT_TERMS_OVERLAP',
] as const;

export const PEOPLE_READINESS_ENTITY_TYPES = [
  'USER',
  'EMPLOYMENT_PROFILE',
  'TALENT',
  'ORG_UNIT',
  'TALENT_GROUP',
  'TALENT_GROUP_MEMBER',
  'ORG_UNIT_MANAGER_ASSIGNMENT',
  'TALENT_GROUP_MANAGER_ASSIGNMENT',
] as const;

const peopleReadinessCategorySchema = z.enum(PEOPLE_READINESS_CATEGORIES);
const peopleReadinessSeveritySchema = z.enum(PEOPLE_READINESS_SEVERITIES);
const peopleReadinessIssueCodeSchema = z.enum(PEOPLE_READINESS_ISSUE_CODES);
const peopleReadinessEntityTypeSchema = z.enum(PEOPLE_READINESS_ENTITY_TYPES);

const safeEntitySummarySchema = z
  .object({
    entityType: peopleReadinessEntityTypeSchema,
    id: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    code: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    lifecycleStatus: z.string().trim().min(1).optional(),
    adminRepairTarget: z.string().trim().min(1).optional(),
  })
  .strict();

const repairTargetSchema = z
  .object({
    targetType: peopleReadinessEntityTypeSchema,
    targetId: z.string().trim().min(1),
    suggestedSurface: z.string().trim().min(1),
    suggestedAction: z.string().trim().min(1).optional(),
  })
  .strict();

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const peopleReadinessIssueSchema = z
  .object({
    id: z.string().trim().min(1),
    issueCode: peopleReadinessIssueCodeSchema,
    category: peopleReadinessCategorySchema,
    severity: peopleReadinessSeveritySchema,
    primaryEntityType: peopleReadinessEntityTypeSchema,
    primaryEntity: safeEntitySummarySchema,
    relatedEntities: z.array(safeEntitySummarySchema),
    summary: z.string().trim().min(1),
    repairTarget: repairTargetSchema,
    generatedAt: z.union([z.number(), z.string()]),
    isBlockingForNewOperations: z.boolean(),
    metadata: z.record(metadataValueSchema).optional(),
  })
  .strict();

const summarySchema = z
  .object({
    totalIssueCount: z.number().int().nonnegative(),
    countsByCategory: z.record(z.number().int().nonnegative()),
    countsBySeverity: z.record(z.number().int().nonnegative()),
    countsByIssueCode: z.record(z.number().int().nonnegative()),
    generatedAt: z.union([z.number(), z.string()]),
    dataCoverage: z
      .object({
        exactForSupportedIssueCodes: z.literal(true),
        coverageNotes: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

const appliedFiltersSchema = z
  .object({
    category: peopleReadinessCategorySchema.optional(),
    issueCode: peopleReadinessIssueCodeSchema.optional(),
    severity: peopleReadinessSeveritySchema.optional(),
    entityType: peopleReadinessEntityTypeSchema.optional(),
  })
  .strict();

const issueListSchema = z
  .object({
    items: z.array(peopleReadinessIssueSchema),
    nextCursor: z.string().trim().min(1).nullable(),
    totalCount: z.number().int().nonnegative(),
    generatedAt: z.union([z.number(), z.string()]),
    appliedFilters: appliedFiltersSchema,
  })
  .strict();

const summaryResponseSchema = z
  .object({
    data: summarySchema,
  })
  .strict();

const issueListResponseSchema = z
  .object({
    data: issueListSchema,
  })
  .strict();

export const parsePeopleReadinessIssueListResponse = (
  value: unknown,
): PeopleReadinessIssueList => issueListResponseSchema.parse(value).data;

export type PeopleReadinessCategory = z.infer<typeof peopleReadinessCategorySchema>;
export type PeopleReadinessSeverity = z.infer<typeof peopleReadinessSeveritySchema>;
export type PeopleReadinessIssueCode = z.infer<typeof peopleReadinessIssueCodeSchema>;
export type PeopleReadinessEntityType = z.infer<typeof peopleReadinessEntityTypeSchema>;
export type PeopleReadinessSafeEntitySummary = z.infer<typeof safeEntitySummarySchema>;
export type PeopleReadinessRepairTarget = z.infer<typeof repairTargetSchema>;
export type PeopleReadinessIssue = z.infer<typeof peopleReadinessIssueSchema>;
export type PeopleReadinessSummary = z.infer<typeof summarySchema>;
export type PeopleReadinessIssueList = z.infer<typeof issueListSchema>;

export type PeopleReadinessIssuesQuery = {
  category?: PeopleReadinessCategory;
  issueCode?: PeopleReadinessIssueCode;
  severity?: PeopleReadinessSeverity;
  entityType?: PeopleReadinessEntityType;
  cursor?: string;
  limit?: number;
};

const sanitizeIssueQuery = (
  query: PeopleReadinessIssuesQuery,
): Record<string, string | number | undefined> => ({
  category: query.category,
  issueCode: query.issueCode,
  severity: query.severity,
  entityType: query.entityType,
  cursor: query.cursor,
  limit: query.limit,
});

export const fetchPeopleReadinessSummary = async (): Promise<PeopleReadinessSummary> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/people-readiness/summary',
  });

  return summaryResponseSchema.parse(response).data;
};

export const fetchPeopleReadinessIssues = async (
  query: PeopleReadinessIssuesQuery,
): Promise<PeopleReadinessIssueList> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/people-readiness/issues',
    params: sanitizeIssueQuery(query),
  });

  return parsePeopleReadinessIssueListResponse(response);
};
