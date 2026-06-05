import { z } from 'zod';

import { defineScreenQueryConfig } from '@shared/query/screen-query-config';

import type {
  WorkScheduleScope,
  WorkShiftSourceType,
  WorkShiftSubjectKind,
} from '@modules/work-schedule/types/work-schedule.types';

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

const workShiftStatusSchema = z.enum(['ACTIVE', 'CANCELLED', 'ARCHIVED']).optional();
const workPatternStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional();
const holidayCalendarStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional();
const monthlyRosterStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED']).optional();
const monthlyRosterTargetTypeSchema = z.enum(['ORG_UNIT', 'TALENT_GROUP']).optional();
const rosterMonthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/)
  .optional();
const subjectKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP']).optional();
const workShiftSourceTypeSchema = z.enum(['MANUAL', 'ROSTER_GENERATED']).optional();
const workScheduleScopeSchema = z.enum(['self', 'team', 'department', 'global']).optional();
const monthlyRosterScopeSchema = z.enum(['department', 'global']).optional();
const workShiftSortBySchema = z.enum(['shiftStartAt', 'shiftCode', 'createdAt']).optional();

const baseWorkShiftQueryShape = {
  status: workShiftStatusSchema,
  subjectKind: subjectKindSchema,
  subjectEmploymentProfileId: idSchema.optional(),
  subjectTalentId: idSchema.optional(),
  subjectTalentGroupId: idSchema.optional(),
  windowStartAt: timestampSchema,
  windowEndAt: timestampSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sortBy: workShiftSortBySchema,
  sortDirection: sortDirectionSchema,
  scope: workScheduleScopeSchema,
};

const workShiftFlatListSchema = z.object({
  ...baseWorkShiftQueryShape,
  containsStudioResourceId: idSchema.optional(),
  sourceType: workShiftSourceTypeSchema,
  sourceRosterId: idSchema.optional(),
  sourceDepartmentOrgUnitId: idSchema.optional(),
  sourceRosterMonth: rosterMonthSchema,
  search: searchSchema,
});

const workShiftBySubjectSchema = z.object({
  view: z.literal('by-subject').optional(),
  ...baseWorkShiftQueryShape,
});

const workShiftByResourceSchema = z.object({
  view: z.literal('by-resource').optional(),
  studioResourceId: idSchema.optional(),
  status: workShiftStatusSchema,
  windowStartAt: timestampSchema,
  windowEndAt: timestampSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  sortBy: workShiftSortBySchema,
  sortDirection: sortDirectionSchema,
  scope: workScheduleScopeSchema,
});

const workPatternListSchema = z.object({
  status: workPatternStatusSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
});

const holidayCalendarListSchema = z.object({
  status: holidayCalendarStatusSchema,
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
});

const monthlyRosterListSchema = z.object({
  status: monthlyRosterStatusSchema,
  rosterMonth: rosterMonthSchema,
  targetType: monthlyRosterTargetTypeSchema,
  targetOrgUnitId: idSchema.optional(),
  targetTalentGroupId: idSchema.optional(),
  departmentOrgUnitId: idSchema.optional(),
  workPatternId: idSchema.optional(),
  holidayCalendarId: idSchema.optional(),
  limit: limitSchema,
  cursor: cursorSchema,
  search: searchSchema,
  scope: monthlyRosterScopeSchema,
});

type WorkShiftSubjectQueryFields = {
  subjectKind?: WorkShiftSubjectKind;
  subjectEmploymentProfileId?: string;
  subjectTalentId?: string;
  subjectTalentGroupId?: string;
  scope?: WorkScheduleScope;
};

type WorkShiftSourceQueryFields = {
  sourceType?: WorkShiftSourceType;
  sourceRosterId?: string;
  sourceDepartmentOrgUnitId?: string;
  sourceRosterMonth?: string;
};

type SubjectIdKey = 'subjectEmploymentProfileId' | 'subjectTalentId' | 'subjectTalentGroupId';

const subjectIdKindMap: Record<SubjectIdKey, WorkShiftSubjectKind> = {
  subjectEmploymentProfileId: 'EMPLOYMENT_PROFILE',
  subjectTalentId: 'TALENT',
  subjectTalentGroupId: 'TALENT_GROUP',
};

const subjectIdKeys: SubjectIdKey[] = [
  'subjectEmploymentProfileId',
  'subjectTalentId',
  'subjectTalentGroupId',
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

const normalizeSubjectFilters = <TQuery extends WorkShiftSubjectQueryFields>(
  query: TQuery,
): TQuery => {
  const presentSubjectKeys = subjectIdKeys.filter((key) => hasPresentValue(query[key]));

  if (presentSubjectKeys.length === 0) {
    return normalizeScopeForSubjectKind(query);
  }

  if (presentSubjectKeys.length > 1) {
    return normalizeScopeForSubjectKind({
      ...query,
      subjectEmploymentProfileId: undefined,
      subjectTalentId: undefined,
      subjectTalentGroupId: undefined,
    });
  }

  const subjectIdKey = presentSubjectKeys[0];
  const inferredKind = subjectIdKindMap[subjectIdKey];
  const subjectKind = query.subjectKind ?? inferredKind;

  if (subjectKind !== inferredKind) {
    return normalizeScopeForSubjectKind({
      ...query,
      subjectEmploymentProfileId: undefined,
      subjectTalentId: undefined,
      subjectTalentGroupId: undefined,
    });
  }

  return normalizeScopeForSubjectKind({
    ...query,
    subjectKind,
    subjectEmploymentProfileId:
      subjectIdKey === 'subjectEmploymentProfileId' ? query.subjectEmploymentProfileId : undefined,
    subjectTalentId: subjectIdKey === 'subjectTalentId' ? query.subjectTalentId : undefined,
    subjectTalentGroupId:
      subjectIdKey === 'subjectTalentGroupId' ? query.subjectTalentGroupId : undefined,
  });
};

const normalizeScopeForSubjectKind = <TQuery extends WorkShiftSubjectQueryFields>(
  query: TQuery,
): TQuery => {
  if (
    query.scope &&
    query.scope !== 'global' &&
    (query.subjectKind === 'TALENT' || query.subjectKind === 'TALENT_GROUP')
  ) {
    return {
      ...query,
      scope: undefined,
    };
  }

  return query;
};

const normalizeSourceFilters = <TQuery extends WorkShiftSourceQueryFields>(
  query: TQuery,
): TQuery => {
  if (query.sourceType === 'ROSTER_GENERATED') {
    return query;
  }

  if (query.sourceType === 'MANUAL') {
    return {
      ...query,
      sourceRosterId: undefined,
      sourceDepartmentOrgUnitId: undefined,
      sourceRosterMonth: undefined,
    };
  }

  if (
    hasPresentValue(query.sourceRosterId) ||
    hasPresentValue(query.sourceDepartmentOrgUnitId) ||
    hasPresentValue(query.sourceRosterMonth)
  ) {
    return {
      ...query,
      sourceType: 'ROSTER_GENERATED',
    };
  }

  return query;
};

const enforceBySubjectIdentity = <TQuery extends WorkShiftSubjectQueryFields & { view?: string }>(
  query: TQuery,
): TQuery => {
  const normalized = normalizeSubjectFilters({ ...query, view: 'by-subject' });
  const expectedKey =
    normalized.subjectKind === 'EMPLOYMENT_PROFILE'
      ? 'subjectEmploymentProfileId'
      : normalized.subjectKind === 'TALENT'
        ? 'subjectTalentId'
        : normalized.subjectKind === 'TALENT_GROUP'
          ? 'subjectTalentGroupId'
          : undefined;

  if (!expectedKey || !hasPresentValue(normalized[expectedKey])) {
    return {
      ...normalized,
      view: undefined,
      subjectKind: undefined,
      subjectEmploymentProfileId: undefined,
      subjectTalentId: undefined,
      subjectTalentGroupId: undefined,
      scope: undefined,
    };
  }

  return normalized;
};

const enforceByResourceIdentity = <TQuery extends { view?: string; studioResourceId?: string }>(
  query: TQuery,
): TQuery => {
  const next = {
    ...query,
    view: 'by-resource',
  };

  if (hasPresentValue(next.studioResourceId)) {
    return next;
  }

  return {
    ...next,
    view: undefined,
    studioResourceId: undefined,
  };
};

export const workShiftFlatListQueryConfig = defineScreenQueryConfig({
  id: 'work-schedule.flat-list',
  schema: workShiftFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    dropSortDirectionWithoutSortBy(normalizeSourceFilters(normalizeSubjectFilters({ ...query }))),
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
      allowedSortFields: ['shiftStartAt', 'shiftCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'status',
      'subjectKind',
      'subjectEmploymentProfileId',
      'subjectTalentId',
      'subjectTalentGroupId',
      'containsStudioResourceId',
      'sourceType',
      'sourceRosterId',
      'sourceDepartmentOrgUnitId',
      'sourceRosterMonth',
      'windowStartAt',
      'windowEndAt',
      'scope',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const workShiftBySubjectQueryConfig = defineScreenQueryConfig({
  id: 'work-schedule.by-subject',
  schema: workShiftBySubjectSchema,
  cursorKey: 'cursor',
  normalize: (query) => dropSortDirectionWithoutSortBy(enforceBySubjectIdentity({ ...query })),
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-subject',
      identityRules: [
        {
          when: {
            subjectKind: 'EMPLOYMENT_PROFILE',
          },
          requiredKeys: ['subjectEmploymentProfileId'],
        },
        {
          when: {
            subjectKind: 'TALENT',
          },
          requiredKeys: ['subjectTalentId'],
        },
        {
          when: {
            subjectKind: 'TALENT_GROUP',
          },
          requiredKeys: ['subjectTalentGroupId'],
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
      allowedSortFields: ['shiftStartAt', 'shiftCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'subjectKind',
      'subjectEmploymentProfileId',
      'subjectTalentId',
      'subjectTalentGroupId',
      'status',
      'windowStartAt',
      'windowEndAt',
      'scope',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const workShiftByResourceQueryConfig = defineScreenQueryConfig({
  id: 'work-schedule.by-resource',
  schema: workShiftByResourceSchema,
  cursorKey: 'cursor',
  normalize: (query) => dropSortDirectionWithoutSortBy(enforceByResourceIdentity({ ...query })),
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
      allowedSortFields: ['shiftStartAt', 'shiftCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['studioResourceId', 'status', 'windowStartAt', 'windowEndAt', 'scope'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const workPatternListQueryConfig = defineScreenQueryConfig({
  id: 'work-schedule.patterns.flat-list',
  schema: workPatternListSchema,
  cursorKey: 'cursor',
  normalize: (query) => ({ ...query }),
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
      supported: false,
      allowedSortFields: [],
      allowedSortDirections: [],
    },
    allowedFilterKeys: ['status'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const holidayCalendarListQueryConfig = defineScreenQueryConfig({
  id: 'work-schedule.holiday-calendars.flat-list',
  schema: holidayCalendarListSchema,
  cursorKey: 'cursor',
  normalize: (query) => ({ ...query }),
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
      supported: false,
      allowedSortFields: [],
      allowedSortDirections: [],
    },
    allowedFilterKeys: ['status'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const monthlyRosterListQueryConfig = defineScreenQueryConfig({
  id: 'work-schedule.monthly-rosters.flat-list',
  schema: monthlyRosterListSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    const normalized = { ...query };

    if (normalized.targetType === 'ORG_UNIT') {
      normalized.targetTalentGroupId = undefined;
      normalized.departmentOrgUnitId = undefined;
      return normalized;
    }

    if (normalized.targetType === 'TALENT_GROUP') {
      normalized.targetOrgUnitId = undefined;
      normalized.departmentOrgUnitId = undefined;
      return normalized;
    }

    if (normalized.targetOrgUnitId && !normalized.targetTalentGroupId) {
      normalized.targetType = 'ORG_UNIT';
      normalized.departmentOrgUnitId = undefined;
      return normalized;
    }

    if (normalized.targetTalentGroupId && !normalized.targetOrgUnitId) {
      normalized.targetType = 'TALENT_GROUP';
      normalized.departmentOrgUnitId = undefined;
      return normalized;
    }

    if (normalized.departmentOrgUnitId) {
      normalized.targetType = 'ORG_UNIT';
      normalized.targetOrgUnitId = normalized.departmentOrgUnitId;
      normalized.targetTalentGroupId = undefined;
      normalized.departmentOrgUnitId = undefined;
      return normalized;
    }

    normalized.targetOrgUnitId = undefined;
    normalized.targetTalentGroupId = undefined;
    normalized.departmentOrgUnitId = undefined;
    return normalized;
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
      supported: false,
      allowedSortFields: [],
      allowedSortDirections: [],
    },
    allowedFilterKeys: [
      'status',
      'rosterMonth',
      'targetType',
      'targetOrgUnitId',
      'targetTalentGroupId',
      'departmentOrgUnitId',
      'workPatternId',
      'holidayCalendarId',
      'scope',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const parseWorkScheduleScope = (
  searchParams: URLSearchParams,
): WorkScheduleScope | undefined => {
  const parsed = workScheduleScopeSchema.safeParse(searchParams.get('scope') ?? undefined);
  return parsed.success ? parsed.data : undefined;
};
