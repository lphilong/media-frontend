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

const talentGroupStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional();
const talentGroupSortSchema = z.enum(['groupCode', 'name', 'createdAt', 'displayOrder']).optional();

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
