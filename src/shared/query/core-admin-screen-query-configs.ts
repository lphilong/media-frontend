import { z } from 'zod';

import {
  talentCommercialParticipationStatusValues,
  talentOriginValues,
} from '@modules/talent/types/talent.types';
import { defineScreenQueryConfig } from '@shared/query/screen-query-config';

const idSchema = z.string().trim().min(1);
const cursorSchema = z.string().trim().min(1).optional();
const searchSchema = z.string().trim().min(1).optional();

const preprocessBlankNumericQueryValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().length === 0 ? undefined : value;
};

const limitSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce.number().int().min(1).max(100).optional(),
);

const sortDirectionSchema = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.enum(['asc', 'desc']),
  )
  .optional();

const booleanQuerySchema = z
  .preprocess((value) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  }, z.boolean())
  .optional();

const enumTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]*$/)
  .optional();

const dropSortDirectionWithoutSortBy = <TQuery extends { sortBy?: string; sortDirection?: string }>(
  query: TQuery,
): TQuery => {
  if (query.sortBy) {
    return query;
  }

  return {
    ...query,
    sortDirection: undefined,
  };
};

const hasPresentValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
};

const enforceRelatedIdentityContract = <TQuery extends { view?: string }>(
  query: TQuery,
  relatedView: string,
  requiredKeys: readonly (keyof TQuery & string)[],
): TQuery => {
  const next = {
    ...query,
    view: relatedView,
  };

  const hasAllRequiredKeys = requiredKeys.every((key) => hasPresentValue(next[key]));
  if (hasAllRequiredKeys) {
    return next;
  }

  const cleared: Record<string, unknown> = {
    ...next,
    view: undefined,
  };
  requiredKeys.forEach((key) => {
    cleared[key] = undefined;
  });

  return cleared as TQuery;
};

const orgUnitStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional();
const orgUnitSortSchema = z.enum(['code', 'name', 'createdAt', 'displayOrder']).optional();

const orgUnitFlatListSchema = z.object({
  status: orgUnitStatusSchema,
  type: enumTokenSchema,
  parentOrgUnitId: idSchema.optional(),
  rootOnly: booleanQuerySchema,
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
  sortBy: orgUnitSortSchema,
  sortDirection: sortDirectionSchema,
});

const sanitizeOrgUnitFlatFilters = <
  TQuery extends {
    rootOnly?: boolean;
    parentOrgUnitId?: string;
  },
>(
  query: TQuery,
): TQuery => {
  if (!query.rootOnly) {
    return query;
  }

  return {
    ...query,
    parentOrgUnitId: undefined,
  };
};

const employmentStatusSchema = z
  .enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ARCHIVED'])
  .optional();
const employmentContractStatusSchema = z
  .enum(['NONE', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED'])
  .optional();
const employmentSortSchema = z
  .enum(['employeeCode', 'displayName', 'legalName', 'createdAt'])
  .optional();
const directReportsSortSchema = z.enum(['employeeCode', 'displayName']).optional();
const talentOperationalStatusSchema = z
  .enum(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'])
  .optional();
const talentOriginSchema = z.enum(talentOriginValues).optional();
const talentCommercialParticipationStatusSchema = z
  .enum(talentCommercialParticipationStatusValues)
  .optional();
const talentSortSchema = z.enum(['talentCode', 'stageName', 'legalName', 'createdAt']).optional();
const talentGroupStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional();
const talentGroupSortSchema = z.enum(['groupCode', 'name', 'createdAt', 'displayOrder']).optional();

const employmentProfileFlatListSchema = z.object({
  employmentStatus: employmentStatusSchema,
  contractStatus: employmentContractStatusSchema,
  employmentKind: enumTokenSchema,
  orgUnitId: idSchema.optional(),
  hasLinkedUser: booleanQuerySchema,
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
  sortBy: employmentSortSchema,
  sortDirection: sortDirectionSchema,
});

const employmentProfileDirectReportsSchema = z.object({
  view: z.literal('direct-reports').optional(),
  sortBy: directReportsSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const talentFlatListSchema = z.object({
  operationalStatus: talentOperationalStatusSchema,
  talentOrigin: talentOriginSchema,
  hasLinkedEmploymentProfile: booleanQuerySchema,
  commercialParticipationStatus: talentCommercialParticipationStatusSchema,
  livestreamEligible: booleanQuerySchema,
  eventEligible: booleanQuerySchema,
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
  sortBy: talentSortSchema,
  sortDirection: sortDirectionSchema,
});

const talentGroupFlatListSchema = z.object({
  status: talentGroupStatusSchema,
  containsTalentId: idSchema.optional(),
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
  sortBy: talentGroupSortSchema,
  sortDirection: sortDirectionSchema,
});

const talentGroupByTalentSchema = z.object({
  view: z.literal('by-talent').optional(),
  talentId: idSchema.optional(),
  status: talentGroupStatusSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sortBy: talentGroupSortSchema,
  sortDirection: sortDirectionSchema,
});

const talentGroupByTalentRequiredIdentityKeys: ReadonlyArray<'talentId'> = ['talentId'];

export const orgUnitFlatListQueryConfig = defineScreenQueryConfig({
  id: 'org-unit.flat-list',
  schema: orgUnitFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return dropSortDirectionWithoutSortBy(sanitizeOrgUnitFlatFilters({ ...query }));
  },
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['code', 'name', 'createdAt', 'displayOrder'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['status', 'type', 'parentOrgUnitId', 'rootOnly'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const employmentProfileFlatListQueryConfig = defineScreenQueryConfig({
  id: 'employment-profile.flat-list',
  schema: employmentProfileFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return dropSortDirectionWithoutSortBy({ ...query });
  },
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['employeeCode', 'displayName', 'legalName', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'employmentStatus',
      'contractStatus',
      'employmentKind',
      'orgUnitId',
      'hasLinkedUser',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'employmentStatus',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const employmentProfileDirectReportsQueryConfig = defineScreenQueryConfig({
  id: 'employment-profile.direct-reports',
  schema: employmentProfileDirectReportsSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return dropSortDirectionWithoutSortBy({
      ...query,
      view: query.view ?? 'direct-reports',
    });
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'direct-reports',
      identityRules: [],
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['employeeCode', 'displayName'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [],
  },
});

export const talentFlatListQueryConfig = defineScreenQueryConfig({
  id: 'talent.flat-list',
  schema: talentFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return dropSortDirectionWithoutSortBy({ ...query });
  },
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['talentCode', 'stageName', 'legalName', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'operationalStatus',
      'talentOrigin',
      'hasLinkedEmploymentProfile',
      'commercialParticipationStatus',
      'livestreamEligible',
      'eventEligible',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'operationalStatus',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const talentGroupFlatListQueryConfig = defineScreenQueryConfig({
  id: 'talent-group.flat-list',
  schema: talentGroupFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return dropSortDirectionWithoutSortBy({ ...query });
  },
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['groupCode', 'name', 'createdAt', 'displayOrder'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['status', 'containsTalentId'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const talentGroupByTalentQueryConfig = defineScreenQueryConfig({
  id: 'talent-group.by-talent',
  schema: talentGroupByTalentSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy({ ...query }),
      'by-talent',
      talentGroupByTalentRequiredIdentityKeys,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-talent',
      identityRules: [
        {
          requiredKeys: ['talentId'],
        },
      ],
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['groupCode', 'name', 'createdAt', 'displayOrder'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['talentId', 'status'],
  },
});

export const coreAdminScreenQueryConfigs = {
  orgUnit: {
    flatList: orgUnitFlatListQueryConfig,
  },
  employmentProfile: {
    flatList: employmentProfileFlatListQueryConfig,
    directReports: employmentProfileDirectReportsQueryConfig,
  },
  talent: {
    flatList: talentFlatListQueryConfig,
  },
  talentGroup: {
    flatList: talentGroupFlatListQueryConfig,
    byTalent: talentGroupByTalentQueryConfig,
  },
} as const;
