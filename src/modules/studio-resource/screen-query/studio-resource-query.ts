import { z } from 'zod';

import { defineScreenQueryConfig } from '@shared/query/screen-query-config';

const tokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]*$/)
  .optional();
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

const sortDirectionSchema = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.enum(['asc', 'desc']),
  )
  .optional();

const operationalStatusSchema = z
  .enum(['ACTIVE', 'OUT_OF_SERVICE', 'INACTIVE', 'ARCHIVED'])
  .optional();
const sortBySchema = z.enum(['resourceCode', 'name', 'createdAt']).optional();

const studioResourceFlatListSchema = z.object({
  resourceClass: tokenSchema,
  operationalStatus: operationalStatusSchema,
  hasMaxOccupancy: booleanQuerySchema,
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
  sortBy: sortBySchema,
  sortDirection: sortDirectionSchema,
});

const studioResourceAvailabilitySchema = studioResourceFlatListSchema.extend({
  view: z.literal('availability').optional(),
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

export const studioResourceFlatListQueryConfig = defineScreenQueryConfig({
  id: 'studio-resource.flat-list',
  schema: studioResourceFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => dropSortDirectionWithoutSortBy({ ...query }),
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
      allowedSortFields: ['resourceCode', 'name', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['resourceClass', 'operationalStatus', 'hasMaxOccupancy'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'operationalStatus',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const studioResourceAvailabilityQueryConfig = defineScreenQueryConfig({
  id: 'studio-resource.availability',
  schema: studioResourceAvailabilitySchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    dropSortDirectionWithoutSortBy({
      ...query,
      view: query.view ?? 'availability',
    }),
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'availability',
      identityRules: [],
    },
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
      allowedSortFields: ['resourceCode', 'name', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['resourceClass', 'operationalStatus', 'hasMaxOccupancy'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'operationalStatus',
      archivedValue: 'ARCHIVED',
    },
  },
});
