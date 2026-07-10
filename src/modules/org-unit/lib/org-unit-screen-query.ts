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
