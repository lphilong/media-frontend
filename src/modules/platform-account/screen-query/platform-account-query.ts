import { z } from 'zod';

import { defineScreenQueryConfig } from '@shared/query/screen-query-config';

const idSchema = z.string().trim().min(1);
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

const ownerKindSchema = z.enum(['ORG_UNIT', 'TALENT', 'TALENT_GROUP']).optional();
const operationalStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional();
const sortBySchema = z.enum(['accountCode', 'displayName', 'createdAt']).optional();

const platformAccountFlatListSchema = z.object({
  platform: tokenSchema,
  platformSurfaceType: tokenSchema,
  operationalStatus: operationalStatusSchema,
  ownerKind: ownerKindSchema,
  ownerOrgUnitId: idSchema.optional(),
  ownerTalentId: idSchema.optional(),
  ownerTalentGroupId: idSchema.optional(),
  livestreamEnabled: booleanQuerySchema,
  contentPublishingEnabled: booleanQuerySchema,
  monetizationEnabled: booleanQuerySchema,
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
  sortBy: sortBySchema,
  sortDirection: sortDirectionSchema,
});

type PlatformAccountFlatQuery = z.infer<typeof platformAccountFlatListSchema>;
type OwnerIdKey = 'ownerOrgUnitId' | 'ownerTalentId' | 'ownerTalentGroupId';

const ownerIdKindMap: Record<OwnerIdKey, NonNullable<PlatformAccountFlatQuery['ownerKind']>> = {
  ownerOrgUnitId: 'ORG_UNIT',
  ownerTalentId: 'TALENT',
  ownerTalentGroupId: 'TALENT_GROUP',
};

const ownerIdKeys: OwnerIdKey[] = ['ownerOrgUnitId', 'ownerTalentId', 'ownerTalentGroupId'];

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

const normalizeOwnerFilters = (query: PlatformAccountFlatQuery): PlatformAccountFlatQuery => {
  const presentOwnerKeys = ownerIdKeys.filter((key) => Boolean(query[key]));

  if (presentOwnerKeys.length === 0) {
    return query;
  }

  if (presentOwnerKeys.length > 1) {
    return {
      ...query,
      ownerKind: undefined,
      ownerOrgUnitId: undefined,
      ownerTalentId: undefined,
      ownerTalentGroupId: undefined,
    };
  }

  const ownerIdKey = presentOwnerKeys[0];
  const inferredOwnerKind = ownerIdKindMap[ownerIdKey];

  return {
    ...query,
    ownerKind: inferredOwnerKind,
    ownerOrgUnitId: ownerIdKey === 'ownerOrgUnitId' ? query.ownerOrgUnitId : undefined,
    ownerTalentId: ownerIdKey === 'ownerTalentId' ? query.ownerTalentId : undefined,
    ownerTalentGroupId: ownerIdKey === 'ownerTalentGroupId' ? query.ownerTalentGroupId : undefined,
  };
};

export const platformAccountFlatListQueryConfig = defineScreenQueryConfig({
  id: 'platform-account.flat-list',
  schema: platformAccountFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => dropSortDirectionWithoutSortBy(normalizeOwnerFilters({ ...query })),
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
      allowedSortFields: ['accountCode', 'displayName', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'platform',
      'platformSurfaceType',
      'operationalStatus',
      'ownerKind',
      'ownerOrgUnitId',
      'ownerTalentId',
      'ownerTalentGroupId',
      'livestreamEnabled',
      'contentPublishingEnabled',
      'monetizationEnabled',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'operationalStatus',
      archivedValue: 'ARCHIVED',
    },
  },
});
