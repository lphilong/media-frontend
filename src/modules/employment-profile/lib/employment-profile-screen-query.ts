import { z } from 'zod';

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
