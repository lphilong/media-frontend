import { z } from 'zod';

import { defineScreenQueryConfig } from '@shared/query/screen-query-config';

import type { EventAssignmentKind } from '@modules/event-assignment/types/event-assignment.types';

const idSchema = z.string().trim().min(1);
const cursorSchema = z.string().trim().min(1).optional();
const searchSchema = z.string().trim().min(1).optional();

const preprocessBlankNumericQueryValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().length === 0 ? undefined : value;
};

const timestampSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce.number().int().nonnegative().optional(),
);

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

const eventStatusSchema = z
  .enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
  .optional();
const assignmentKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP']).optional();
const eventSortBySchema = z.enum(['eventStartAt', 'eventCode', 'createdAt']).optional();

const baseEventQueryShape = {
  status: eventStatusSchema,
  assignmentKind: assignmentKindSchema,
  assignmentEmploymentProfileId: idSchema.optional(),
  assignmentTalentId: idSchema.optional(),
  assignmentTalentGroupId: idSchema.optional(),
  windowStartAt: timestampSchema,
  windowEndAt: timestampSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sortBy: eventSortBySchema,
  sortDirection: sortDirectionSchema,
};

const eventFlatListSchema = z.object({
  ...baseEventQueryShape,
  containsStudioResourceId: idSchema.optional(),
  containsPlatformAccountId: idSchema.optional(),
  search: searchSchema,
});

const eventByAssignmentSchema = z.object({
  view: z.literal('by-assignment').optional(),
  ...baseEventQueryShape,
});

const eventByResourceSchema = z.object({
  view: z.literal('by-resource').optional(),
  studioResourceId: idSchema.optional(),
  status: eventStatusSchema,
  windowStartAt: timestampSchema,
  windowEndAt: timestampSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sortBy: eventSortBySchema,
  sortDirection: sortDirectionSchema,
});

const eventByPlatformSchema = z.object({
  view: z.literal('by-platform').optional(),
  platformAccountId: idSchema.optional(),
  status: eventStatusSchema,
  windowStartAt: timestampSchema,
  windowEndAt: timestampSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sortBy: eventSortBySchema,
  sortDirection: sortDirectionSchema,
});

type EventAssignmentQueryFields = {
  assignmentKind?: EventAssignmentKind;
  assignmentEmploymentProfileId?: string;
  assignmentTalentId?: string;
  assignmentTalentGroupId?: string;
};

type AssignmentIdKey =
  | 'assignmentEmploymentProfileId'
  | 'assignmentTalentId'
  | 'assignmentTalentGroupId';

const assignmentIdKindMap: Record<AssignmentIdKey, EventAssignmentKind> = {
  assignmentEmploymentProfileId: 'EMPLOYMENT_PROFILE',
  assignmentTalentId: 'TALENT',
  assignmentTalentGroupId: 'TALENT_GROUP',
};

const assignmentIdKeys: AssignmentIdKey[] = [
  'assignmentEmploymentProfileId',
  'assignmentTalentId',
  'assignmentTalentGroupId',
];

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

const normalizeAssignmentFilters = <TQuery extends EventAssignmentQueryFields>(
  query: TQuery,
): TQuery => {
  const presentAssignmentKeys = assignmentIdKeys.filter((key) => hasPresentValue(query[key]));

  if (presentAssignmentKeys.length === 0) {
    return query;
  }

  if (presentAssignmentKeys.length > 1) {
    return {
      ...query,
      assignmentEmploymentProfileId: undefined,
      assignmentTalentId: undefined,
      assignmentTalentGroupId: undefined,
    };
  }

  const assignmentIdKey = presentAssignmentKeys[0];
  const inferredKind = assignmentIdKindMap[assignmentIdKey];
  const assignmentKind = query.assignmentKind ?? inferredKind;

  if (assignmentKind !== inferredKind) {
    return {
      ...query,
      assignmentEmploymentProfileId: undefined,
      assignmentTalentId: undefined,
      assignmentTalentGroupId: undefined,
    };
  }

  return {
    ...query,
    assignmentKind,
    assignmentEmploymentProfileId:
      assignmentIdKey === 'assignmentEmploymentProfileId'
        ? query.assignmentEmploymentProfileId
        : undefined,
    assignmentTalentId:
      assignmentIdKey === 'assignmentTalentId' ? query.assignmentTalentId : undefined,
    assignmentTalentGroupId:
      assignmentIdKey === 'assignmentTalentGroupId' ? query.assignmentTalentGroupId : undefined,
  };
};

const enforceByAssignmentIdentity = <TQuery extends EventAssignmentQueryFields & { view?: string }>(
  query: TQuery,
): TQuery => {
  const normalized = normalizeAssignmentFilters({ ...query, view: 'by-assignment' });
  const expectedKey =
    normalized.assignmentKind === 'EMPLOYMENT_PROFILE'
      ? 'assignmentEmploymentProfileId'
      : normalized.assignmentKind === 'TALENT'
        ? 'assignmentTalentId'
        : normalized.assignmentKind === 'TALENT_GROUP'
          ? 'assignmentTalentGroupId'
          : undefined;

  if (!expectedKey || !hasPresentValue(normalized[expectedKey])) {
    return {
      ...normalized,
      view: undefined,
      assignmentKind: undefined,
      assignmentEmploymentProfileId: undefined,
      assignmentTalentId: undefined,
      assignmentTalentGroupId: undefined,
    };
  }

  return normalized;
};

const enforceRequiredId = <TQuery extends { view?: string }>(
  query: TQuery,
  view: string,
  key: keyof TQuery & string,
): TQuery => {
  const next = {
    ...query,
    view,
  };

  if (hasPresentValue(next[key])) {
    return next;
  }

  return {
    ...next,
    view: undefined,
    [key]: undefined,
  };
};

export const eventFlatListQueryConfig = defineScreenQueryConfig({
  id: 'event-assignment.flat-list',
  schema: eventFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => dropSortDirectionWithoutSortBy(normalizeAssignmentFilters({ ...query })),
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
      allowedSortFields: ['eventStartAt', 'eventCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'status',
      'assignmentKind',
      'assignmentEmploymentProfileId',
      'assignmentTalentId',
      'assignmentTalentGroupId',
      'containsStudioResourceId',
      'containsPlatformAccountId',
      'windowStartAt',
      'windowEndAt',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const eventByAssignmentQueryConfig = defineScreenQueryConfig({
  id: 'event-assignment.by-assignment',
  schema: eventByAssignmentSchema,
  cursorKey: 'cursor',
  normalize: (query) => dropSortDirectionWithoutSortBy(enforceByAssignmentIdentity({ ...query })),
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-assignment',
      identityRules: [
        {
          when: {
            assignmentKind: 'EMPLOYMENT_PROFILE',
          },
          requiredKeys: ['assignmentEmploymentProfileId'],
        },
        {
          when: {
            assignmentKind: 'TALENT',
          },
          requiredKeys: ['assignmentTalentId'],
        },
        {
          when: {
            assignmentKind: 'TALENT_GROUP',
          },
          requiredKeys: ['assignmentTalentGroupId'],
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
      allowedSortFields: ['eventStartAt', 'eventCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'assignmentKind',
      'assignmentEmploymentProfileId',
      'assignmentTalentId',
      'assignmentTalentGroupId',
      'status',
      'windowStartAt',
      'windowEndAt',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const eventByResourceQueryConfig = defineScreenQueryConfig({
  id: 'event-assignment.by-resource',
  schema: eventByResourceSchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    dropSortDirectionWithoutSortBy(
      enforceRequiredId({ ...query }, 'by-resource', 'studioResourceId'),
    ),
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-resource',
      identityRules: [
        {
          requiredKeys: ['studioResourceId'],
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
      allowedSortFields: ['eventStartAt', 'eventCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['studioResourceId', 'status', 'windowStartAt', 'windowEndAt'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const eventByPlatformQueryConfig = defineScreenQueryConfig({
  id: 'event-assignment.by-platform',
  schema: eventByPlatformSchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    dropSortDirectionWithoutSortBy(
      enforceRequiredId({ ...query }, 'by-platform', 'platformAccountId'),
    ),
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-platform',
      identityRules: [
        {
          requiredKeys: ['platformAccountId'],
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
      allowedSortFields: ['eventStartAt', 'eventCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['platformAccountId', 'status', 'windowStartAt', 'windowEndAt'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});
