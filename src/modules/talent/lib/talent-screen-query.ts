import { z } from 'zod';

import {
  talentCommercialParticipationStatusValues,
  talentOriginValues,
} from '@modules/talent/types/talent.types';
import { defineScreenQueryConfig } from '@shared/query/screen-query-config';

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

const talentOperationalStatusSchema = z
  .enum(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'])
  .optional();
const talentOriginSchema = z.enum(talentOriginValues).optional();
const talentCommercialParticipationStatusSchema = z
  .enum(talentCommercialParticipationStatusValues)
  .optional();
const talentSortSchema = z.enum(['talentCode', 'stageName', 'legalName', 'createdAt']).optional();

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
