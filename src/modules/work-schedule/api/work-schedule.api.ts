import { z } from 'zod';

import {
  HOLIDAY_CALENDAR_TIMEZONE,
  MONTHLY_ROSTER_TIMEZONE,
  WORK_PATTERN_TIMEZONE,
} from '@modules/work-schedule/types/work-schedule.types';
import type {
  CursorPagedResponse,
  HolidayCalendarCreatePayload,
  HolidayCalendarEntryPayload,
  HolidayCalendarLifecycleAction,
  HolidayCalendarListQuery,
  HolidayCalendarRecord,
  HolidayCalendarUpdatePayload,
  MonthlyRosterCreatePayload,
  MonthlyRosterListItem,
  MonthlyRosterListQuery,
  MonthlyRosterPublishPayload,
  MonthlyRosterPublishResult,
  MonthlyRosterPreview,
  MonthlyRosterRecord,
  MonthlyRosterScope,
  MonthlyRosterUpdatePayload,
  RosterExceptionPayload,
  WorkPatternCreatePayload,
  WorkPatternLifecycleAction,
  WorkPatternListQuery,
  WorkPatternRecord,
  WorkPatternUpdatePayload,
  WorkScheduleScope,
  WorkShiftByResourceItem,
  WorkShiftByResourceQuery,
  WorkShiftBySubjectItem,
  WorkShiftBySubjectQuery,
  WorkShiftCreatePayload,
  WorkShiftLifecycleAction,
  WorkShiftListItem,
  WorkShiftListQuery,
  WorkShiftReassignSubjectPayload,
  WorkShiftRecord,
  WorkShiftReplaceResourcesPayload,
  WorkShiftReschedulePayload,
  WorkShiftUpdatePayload,
} from '@modules/work-schedule/types/work-schedule.types';
import { apiRequest } from '@shared/api';

const subjectKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP']);
const statusSchema = z.enum(['ACTIVE', 'CANCELLED', 'ARCHIVED']);
const workPatternStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const workPatternWeekdaySchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
const holidayCalendarStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const holidayCalendarEntryTypeSchema = z.enum(['HOLIDAY', 'COMPANY_OFF_DAY', 'CUSTOM_OFF_DAY']);
const holidayCalendarEntryStatusSchema = z.enum(['ACTIVE', 'REMOVED']);
const monthlyRosterStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED']);
const rosterExceptionTypeSchema = z.enum(['WORKING_TO_OFF', 'CHANGE_TIME', 'ADD_SPECIAL_SHIFT']);
const monthlyRosterPreviewRowKindSchema = z.enum([
  'STANDARD',
  'WORKING_TO_OFF',
  'CHANGE_TIME',
  'ADD_SPECIAL_SHIFT',
  'HOLIDAY_SUPPRESSED',
]);
const monthlyRosterPreviewConflictKindSchema = z.enum([
  'SUBJECT_OVERLAP',
  'CANDIDATE_SUBJECT_OVERLAP',
]);
const workShiftSourceTypeSchema = z.enum(['MANUAL', 'ROSTER_GENERATED']);
const timestampSchema = z.union([z.number(), z.string()]);

const workShiftListSourceShape = {
  sourceType: workShiftSourceTypeSchema.nullable().optional(),
  sourceRosterId: z.string().nullable().optional(),
  sourceRosterMonth: z.string().nullable().optional(),
  sourceRosterLocalDate: z.string().nullable().optional(),
  sourceRosterSlotKey: z.string().nullable().optional(),
};

const listItemSchema = z
  .object({
    id: z.string().trim().min(1),
    shiftCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    subjectKind: subjectKindSchema,
    subjectEmploymentProfileId: z.string().nullable().optional(),
    subjectTalentId: z.string().nullable().optional(),
    subjectTalentGroupId: z.string().nullable().optional(),
    status: statusSchema,
    shiftStartAt: timestampSchema,
    shiftEndAt: timestampSchema,
    createdAt: timestampSchema,
    ...workShiftListSourceShape,
  })
  .strict();

const bySubjectItemSchema = z
  .object({
    id: z.string().trim().min(1),
    shiftCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    subjectKind: subjectKindSchema,
    status: statusSchema,
    shiftStartAt: timestampSchema,
    shiftEndAt: timestampSchema,
  })
  .strict();

const byResourceItemSchema = z
  .object({
    id: z.string().trim().min(1),
    shiftCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    status: statusSchema,
    shiftStartAt: timestampSchema,
    shiftEndAt: timestampSchema,
  })
  .strict();

const detailSchema = listItemSchema
  .extend({
    studioResourceIds: z.array(z.string()),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    updatedAt: timestampSchema,
    sourcePatternId: z.string().nullable().optional(),
    sourceExceptionId: z.string().nullable().optional(),
    sourceGenerationRunId: z.string().nullable().optional(),
    sourceDepartmentOrgUnitId: z.string().nullable().optional(),
  })
  .strict();

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const listResponseSchema = z
  .object({
    data: z.array(listItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const bySubjectResponseSchema = z
  .object({
    data: z.array(bySubjectItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const byResourceResponseSchema = z
  .object({
    data: z.array(byResourceItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: detailSchema,
  })
  .strict();

const workPatternSchema = z
  .object({
    workPatternId: z.string().trim().min(1),
    patternCode: z.string().trim().min(1),
    name: z.string().trim().min(1),
    status: workPatternStatusSchema,
    timezone: z.literal(WORK_PATTERN_TIMEZONE),
    startLocalTime: z.string().trim().min(1),
    endLocalTime: z.string().trim().min(1),
    workingMinutes: z.number().int().nonnegative(),
    breakMinutes: z.number().int().nonnegative(),
    workingDays: z.array(workPatternWeekdaySchema),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    activatedAt: timestampSchema.nullable().optional(),
    archivedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const workPatternListResponseSchema = z
  .object({
    data: z.array(workPatternSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const workPatternDetailResponseSchema = z
  .object({
    data: workPatternSchema,
  })
  .strict();

const holidayCalendarEntrySchema = z
  .object({
    holidayCalendarEntryId: z.string().trim().min(1),
    date: z.string().trim().min(1),
    entryType: holidayCalendarEntryTypeSchema,
    name: z.string().trim().min(1),
    status: holidayCalendarEntryStatusSchema,
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    removedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const holidayCalendarSchema = z
  .object({
    holidayCalendarId: z.string().trim().min(1),
    calendarCode: z.string().trim().min(1),
    name: z.string().trim().min(1),
    scopeType: z.literal('GLOBAL'),
    timezone: z.literal(HOLIDAY_CALENDAR_TIMEZONE),
    status: holidayCalendarStatusSchema,
    entries: z.array(holidayCalendarEntrySchema),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    activatedAt: timestampSchema.nullable().optional(),
    archivedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const holidayCalendarListResponseSchema = z
  .object({
    data: z.array(holidayCalendarSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const holidayCalendarDetailResponseSchema = z
  .object({
    data: holidayCalendarSchema,
  })
  .strict();

const rosterExceptionSchema = z
  .object({
    rosterExceptionId: z.string().trim().min(1),
    monthlyRosterId: z.string().trim().min(1),
    exceptionType: rosterExceptionTypeSchema,
    exceptionDate: z.string().trim().min(1),
    subjectEmploymentProfileId: z.string().trim().min(1),
    status: z.enum(['ACTIVE', 'REMOVED']),
    title: z.string().nullable().optional(),
    startLocalTime: z.string().nullable().optional(),
    endLocalTime: z.string().nullable().optional(),
    workingMinutes: z.number().int().nullable().optional(),
    breakMinutes: z.number().int().nullable().optional(),
    studioResourceIds: z.array(z.string()).optional(),
    reason: z.string().nullable().optional(),
    sourceNote: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    removedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const monthlyRosterListItemSchema = z
  .object({
    monthlyRosterId: z.string().trim().min(1),
    rosterCode: z.string().trim().min(1),
    rosterMonth: z.string().trim().min(1),
    timezone: z.literal(MONTHLY_ROSTER_TIMEZONE),
    targetSubjectKind: z.literal('EMPLOYMENT_PROFILE'),
    targetOrgUnitMode: z.literal('EXACT_ONLY'),
    departmentOrgUnitId: z.string().trim().min(1),
    workPatternId: z.string().trim().min(1),
    holidayCalendarId: z.string().trim().min(1),
    status: monthlyRosterStatusSchema,
    draftVersion: z.number().int().optional(),
    exceptionCount: z.number().int().nonnegative().optional(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    archivedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const monthlyRosterDetailSchema = monthlyRosterListItemSchema
  .extend({
    previewHash: z.string().nullable().optional(),
    lastPreviewedAt: timestampSchema.nullable().optional(),
    publishedAt: timestampSchema.nullable().optional(),
    publishedByUserId: z.string().nullable().optional(),
    publishGenerationRunId: z.string().nullable().optional(),
    exceptions: z.array(rosterExceptionSchema).optional(),
  })
  .strict();

const monthlyRosterListResponseSchema = z
  .object({
    data: z.array(monthlyRosterListItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const monthlyRosterDetailResponseSchema = z
  .object({
    data: monthlyRosterDetailSchema,
  })
  .strict();

const monthlyRosterPreviewConflictSchema = z
  .object({
    conflictKind: monthlyRosterPreviewConflictKindSchema,
    workShiftId: z.string().nullable(),
    relatedPreviewRowId: z.string().nullable(),
    shiftCode: z.string().nullable(),
    title: z.string().nullable(),
    status: z.literal('ACTIVE').nullable(),
    shiftStartAt: timestampSchema,
    shiftEndAt: timestampSchema,
    sourceType: workShiftSourceTypeSchema.nullable(),
    sourceRosterId: z.string().nullable(),
    sourceRosterMonth: z.string().nullable(),
    sourceRosterLocalDate: z.string().nullable(),
    sourceRosterSlotKey: z.string().nullable(),
  })
  .strict();

const monthlyRosterPreviewRowSchema = z
  .object({
    previewRowId: z.string().trim().min(1),
    monthlyRosterId: z.string().trim().min(1),
    rosterMonth: z.string().trim().min(1),
    departmentOrgUnitId: z.string().trim().min(1),
    subjectEmploymentProfileId: z.string().trim().min(1),
    localDate: z.string().trim().min(1),
    rowKind: monthlyRosterPreviewRowKindSchema,
    sourceExceptionId: z.string().nullable(),
    sourceRosterSlotKey: z.string().nullable(),
    startLocalTime: z.string().nullable(),
    endLocalTime: z.string().nullable(),
    shiftStartAt: timestampSchema.nullable(),
    shiftEndAt: timestampSchema.nullable(),
    workingMinutes: z.number().int().nullable(),
    breakMinutes: z.number().int().nullable(),
    holidayCalendarEntryId: z.string().nullable(),
    holidayName: z.string().nullable(),
    holidayEntryType: holidayCalendarEntryTypeSchema.nullable(),
    isCandidateShift: z.boolean(),
    isSuppressed: z.boolean(),
    conflicts: z.array(monthlyRosterPreviewConflictSchema),
    warnings: z.array(z.string()),
    blockers: z.array(z.string()),
  })
  .strict();

const monthlyRosterPreviewSummarySchema = z
  .object({
    totalEligibleProfiles: z.number().int().nonnegative(),
    totalStandardCandidateShifts: z.number().int().nonnegative(),
    totalHolidaySuppressions: z.number().int().nonnegative(),
    totalWorkingToOff: z.number().int().nonnegative(),
    totalChangeTime: z.number().int().nonnegative(),
    totalAddSpecialShift: z.number().int().nonnegative(),
    totalCandidateShiftsAfterExceptions: z.number().int().nonnegative(),
    totalConflicts: z.number().int().nonnegative(),
  })
  .strict();

const monthlyRosterPreviewResponseSchema = z
  .object({
    data: z
      .object({
        monthlyRosterId: z.string().trim().min(1),
        rosterMonth: z.string().trim().min(1),
        timezone: z.literal(MONTHLY_ROSTER_TIMEZONE),
        departmentOrgUnitId: z.string().trim().min(1),
        workPatternId: z.string().trim().min(1),
        holidayCalendarId: z.string().trim().min(1),
        rosterStatus: monthlyRosterStatusSchema,
        draftVersion: z.number().int(),
        currentPreviewHash: z.string().nullable(),
        computedPreviewHash: z.string().trim().min(1),
        eligibleProfiles: z.array(
          z
            .object({
              subjectEmploymentProfileId: z.string().trim().min(1),
              employmentStatus: z.literal('ACTIVE'),
              departmentOrgUnitId: z.string().trim().min(1),
            })
            .strict(),
        ),
        rows: z.array(monthlyRosterPreviewRowSchema),
        summary: monthlyRosterPreviewSummarySchema,
      })
      .strict(),
  })
  .strict();

const monthlyRosterPublishResultSchema = z
  .object({
    monthlyRosterId: z.string().trim().min(1),
    status: monthlyRosterStatusSchema,
    sourceGenerationRunId: z.string().trim().min(1).nullable(),
    publishedAt: timestampSchema.nullable(),
    publishedByUserId: z.string().nullable(),
    generatedWorkShiftCount: z.number().int().nonnegative(),
    skippedWorkingToOffCount: z.number().int().nonnegative(),
    holidaySuppressedCount: z.number().int().nonnegative(),
    changeTimeCount: z.number().int().nonnegative(),
    addSpecialShiftCount: z.number().int().nonnegative(),
    conflictCount: z.number().int().nonnegative(),
    computedPreviewHash: z.string().trim().min(1).nullable(),
    generatedWorkShiftIds: z.array(z.string()).optional(),
  })
  .strict();

const monthlyRosterPublishResponseSchema = z
  .object({
    data: monthlyRosterPublishResultSchema,
  })
  .strict();

const sanitizeFlatListQuery = (
  query: WorkShiftListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  subjectKind: query.subjectKind,
  subjectEmploymentProfileId: query.subjectEmploymentProfileId,
  subjectTalentId: query.subjectTalentId,
  subjectTalentGroupId: query.subjectTalentGroupId,
  containsStudioResourceId: query.containsStudioResourceId,
  sourceType: query.sourceType,
  sourceRosterId: query.sourceRosterId,
  sourceDepartmentOrgUnitId: query.sourceDepartmentOrgUnitId,
  sourceRosterMonth: query.sourceRosterMonth,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
  scope: query.scope,
});

const sanitizeBySubjectQuery = (
  query: WorkShiftBySubjectQuery,
): Record<string, string | number | undefined> => ({
  subjectKind: query.subjectKind,
  subjectEmploymentProfileId: query.subjectEmploymentProfileId,
  subjectTalentId: query.subjectTalentId,
  subjectTalentGroupId: query.subjectTalentGroupId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
  scope: query.scope,
});

const sanitizeByResourceQuery = (
  query: WorkShiftByResourceQuery,
): Record<string, string | number | undefined> => ({
  studioResourceId: query.studioResourceId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
  scope: query.scope,
});

const sanitizeWorkPatternListQuery = (
  query: WorkPatternListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
});

const sanitizeHolidayCalendarListQuery = (
  query: HolidayCalendarListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
});

const sanitizeMonthlyRosterListQuery = (
  query: MonthlyRosterListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  rosterMonth: query.rosterMonth,
  departmentOrgUnitId: query.departmentOrgUnitId,
  workPatternId: query.workPatternId,
  holidayCalendarId: query.holidayCalendarId,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
  scope: query.scope,
});

const rosterScopeParams = (
  scope?: MonthlyRosterScope,
): Record<string, MonthlyRosterScope | undefined> | undefined => {
  return scope ? { scope } : undefined;
};

const scopeParams = (
  scope?: WorkScheduleScope,
): Record<string, WorkScheduleScope | undefined> | undefined => {
  return scope ? { scope } : undefined;
};

const subjectIdPayload = (payload: WorkShiftCreatePayload) => {
  if (payload.subjectKind === 'EMPLOYMENT_PROFILE') {
    return { subjectEmploymentProfileId: payload.subjectEmploymentProfileId };
  }

  if (payload.subjectKind === 'TALENT') {
    return { subjectTalentId: payload.subjectTalentId };
  }

  return { subjectTalentGroupId: payload.subjectTalentGroupId };
};

const reassignSubjectIdPayload = (payload: WorkShiftReassignSubjectPayload) => {
  if (payload.newSubjectKind === 'EMPLOYMENT_PROFILE') {
    return { newSubjectEmploymentProfileId: payload.newSubjectEmploymentProfileId };
  }

  if (payload.newSubjectKind === 'TALENT') {
    return { newSubjectTalentId: payload.newSubjectTalentId };
  }

  return { newSubjectTalentGroupId: payload.newSubjectTalentGroupId };
};

const sanitizeCreatePayload = (payload: WorkShiftCreatePayload): WorkShiftCreatePayload => ({
  ...(payload.shiftCode?.trim() ? { shiftCode: payload.shiftCode.trim() } : {}),
  title: payload.title,
  subjectKind: payload.subjectKind,
  ...subjectIdPayload(payload),
  shiftStartAt: payload.shiftStartAt,
  shiftEndAt: payload.shiftEndAt,
  studioResourceIds: payload.studioResourceIds,
  description: payload.description,
  externalRef: payload.externalRef,
});

const sanitizeReassignPayload = (
  payload: WorkShiftReassignSubjectPayload,
): WorkShiftReassignSubjectPayload => ({
  newSubjectKind: payload.newSubjectKind,
  ...reassignSubjectIdPayload(payload),
});

const sanitizeNullableText = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const sanitizeWorkPatternCreatePayload = (
  payload: WorkPatternCreatePayload,
): WorkPatternCreatePayload => ({
  ...(payload.patternCode?.trim() ? { patternCode: payload.patternCode.trim() } : {}),
  name: payload.name.trim(),
  timezone: WORK_PATTERN_TIMEZONE,
  startLocalTime: payload.startLocalTime,
  workingMinutes: payload.workingMinutes,
  breakMinutes: payload.breakMinutes,
  workingDays: payload.workingDays,
  description: sanitizeNullableText(payload.description),
  externalRef: sanitizeNullableText(payload.externalRef),
});

const sanitizeWorkPatternUpdatePayload = (
  payload: WorkPatternUpdatePayload,
): WorkPatternUpdatePayload => ({
  ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
  ...(payload.timezone !== undefined ? { timezone: WORK_PATTERN_TIMEZONE } : {}),
  ...(payload.startLocalTime !== undefined ? { startLocalTime: payload.startLocalTime } : {}),
  ...(payload.workingMinutes !== undefined ? { workingMinutes: payload.workingMinutes } : {}),
  ...(payload.breakMinutes !== undefined ? { breakMinutes: payload.breakMinutes } : {}),
  ...(payload.workingDays !== undefined ? { workingDays: payload.workingDays } : {}),
  ...(payload.description !== undefined
    ? { description: sanitizeNullableText(payload.description) }
    : {}),
  ...(payload.externalRef !== undefined
    ? { externalRef: sanitizeNullableText(payload.externalRef) }
    : {}),
});

const sanitizeHolidayCalendarCreatePayload = (
  payload: HolidayCalendarCreatePayload,
): HolidayCalendarCreatePayload => ({
  ...(payload.calendarCode?.trim() ? { calendarCode: payload.calendarCode.trim() } : {}),
  name: payload.name.trim(),
  scopeType: 'GLOBAL',
  timezone: HOLIDAY_CALENDAR_TIMEZONE,
  description: sanitizeNullableText(payload.description),
  externalRef: sanitizeNullableText(payload.externalRef),
});

const sanitizeHolidayCalendarUpdatePayload = (
  payload: HolidayCalendarUpdatePayload,
): HolidayCalendarUpdatePayload => ({
  name: payload.name.trim(),
  description: sanitizeNullableText(payload.description),
  externalRef: sanitizeNullableText(payload.externalRef),
});

const sanitizeHolidayCalendarEntryPayload = (
  payload: HolidayCalendarEntryPayload,
): HolidayCalendarEntryPayload => ({
  date: payload.date.trim(),
  entryType: payload.entryType,
  name: payload.name.trim(),
  description: sanitizeNullableText(payload.description),
  externalRef: sanitizeNullableText(payload.externalRef),
});

const sanitizeMonthlyRosterCreatePayload = (
  payload: MonthlyRosterCreatePayload,
): MonthlyRosterCreatePayload => ({
  ...(payload.rosterCode?.trim() ? { rosterCode: payload.rosterCode.trim() } : {}),
  rosterMonth: payload.rosterMonth.trim(),
  timezone: MONTHLY_ROSTER_TIMEZONE,
  departmentOrgUnitId: payload.departmentOrgUnitId.trim(),
  workPatternId: payload.workPatternId.trim(),
  holidayCalendarId: payload.holidayCalendarId.trim(),
  description: sanitizeNullableText(payload.description),
  externalRef: sanitizeNullableText(payload.externalRef),
  ...(payload.scope ? { scope: payload.scope } : {}),
});

const sanitizeMonthlyRosterUpdatePayload = (
  payload: MonthlyRosterUpdatePayload,
): MonthlyRosterUpdatePayload => ({
  ...(payload.rosterMonth !== undefined ? { rosterMonth: payload.rosterMonth.trim() } : {}),
  ...(payload.timezone !== undefined ? { timezone: MONTHLY_ROSTER_TIMEZONE } : {}),
  ...(payload.departmentOrgUnitId !== undefined
    ? { departmentOrgUnitId: payload.departmentOrgUnitId.trim() }
    : {}),
  ...(payload.workPatternId !== undefined ? { workPatternId: payload.workPatternId.trim() } : {}),
  ...(payload.holidayCalendarId !== undefined
    ? { holidayCalendarId: payload.holidayCalendarId.trim() }
    : {}),
  ...(payload.description !== undefined
    ? { description: sanitizeNullableText(payload.description) }
    : {}),
  ...(payload.externalRef !== undefined
    ? { externalRef: sanitizeNullableText(payload.externalRef) }
    : {}),
  ...(payload.scope !== undefined ? { scope: payload.scope } : {}),
});

const sanitizeRosterExceptionPayload = (
  payload: RosterExceptionPayload,
): RosterExceptionPayload => {
  const common = {
    exceptionType: payload.exceptionType,
    exceptionDate: payload.exceptionDate.trim(),
    subjectEmploymentProfileId: payload.subjectEmploymentProfileId.trim(),
    ...(payload.reason !== undefined ? { reason: sanitizeNullableText(payload.reason) } : {}),
    ...(payload.sourceNote !== undefined
      ? { sourceNote: sanitizeNullableText(payload.sourceNote) }
      : {}),
    ...(payload.description !== undefined
      ? { description: sanitizeNullableText(payload.description) }
      : {}),
    ...(payload.externalRef !== undefined
      ? { externalRef: sanitizeNullableText(payload.externalRef) }
      : {}),
    ...(payload.scope !== undefined ? { scope: payload.scope } : {}),
  };

  if (payload.exceptionType === 'WORKING_TO_OFF') {
    return common;
  }

  if (payload.exceptionType === 'CHANGE_TIME') {
    return {
      ...common,
      startLocalTime: payload.startLocalTime?.trim() ?? '',
    };
  }

  return {
    ...common,
    title: payload.title?.trim() ?? '',
    startLocalTime: payload.startLocalTime?.trim() ?? '',
    workingMinutes: payload.workingMinutes,
    breakMinutes: payload.breakMinutes,
    studioResourceIds: payload.studioResourceIds ?? [],
  };
};

const sanitizeMonthlyRosterPublishPayload = (
  payload: MonthlyRosterPublishPayload,
): MonthlyRosterPublishPayload => ({
  expectedPreviewHash: payload.expectedPreviewHash.trim(),
  ...(payload.idempotencyKey !== undefined
    ? { idempotencyKey: sanitizeNullableText(payload.idempotencyKey) }
    : {}),
  ...(payload.note !== undefined ? { note: sanitizeNullableText(payload.note) } : {}),
  ...(payload.scope !== undefined ? { scope: payload.scope } : {}),
});

export const fetchWorkShifts = async (
  query: WorkShiftListQuery,
): Promise<CursorPagedResponse<WorkShiftListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/work-shifts',
    params: sanitizeFlatListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchWorkShiftsBySubject = async (
  query: WorkShiftBySubjectQuery,
): Promise<CursorPagedResponse<WorkShiftBySubjectItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/work-shifts/by-subject',
    params: sanitizeBySubjectQuery(query),
  });

  return bySubjectResponseSchema.parse(response);
};

export const fetchWorkShiftsByResource = async (
  query: WorkShiftByResourceQuery,
): Promise<CursorPagedResponse<WorkShiftByResourceItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/work-shifts/by-resource',
    params: sanitizeByResourceQuery(query),
  });

  return byResourceResponseSchema.parse(response);
};

export const fetchWorkShiftDetail = async (
  workShiftId: string,
  scope?: WorkScheduleScope,
): Promise<WorkShiftRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/work-shifts/${encodeURIComponent(workShiftId)}`,
    params: scopeParams(scope),
  });

  return detailResponseSchema.parse(response).data;
};

export const createWorkShift = async (
  payload: WorkShiftCreatePayload,
  scope?: WorkScheduleScope,
): Promise<WorkShiftRecord> => {
  const response = await apiRequest<unknown, WorkShiftCreatePayload>({
    method: 'POST',
    url: '/admin/work-shifts',
    params: scopeParams(scope),
    data: sanitizeCreatePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const updateWorkShift = async (
  workShiftId: string,
  payload: WorkShiftUpdatePayload,
  scope?: WorkScheduleScope,
): Promise<WorkShiftRecord> => {
  const response = await apiRequest<unknown, WorkShiftUpdatePayload>({
    method: 'PATCH',
    url: `/admin/work-shifts/${encodeURIComponent(workShiftId)}`,
    params: scopeParams(scope),
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const rescheduleWorkShift = async (
  workShiftId: string,
  payload: WorkShiftReschedulePayload,
  scope?: WorkScheduleScope,
): Promise<WorkShiftRecord> => {
  const response = await apiRequest<unknown, WorkShiftReschedulePayload>({
    method: 'POST',
    url: `/admin/work-shifts/${encodeURIComponent(workShiftId)}/reschedule`,
    params: scopeParams(scope),
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const reassignWorkShiftSubject = async (
  workShiftId: string,
  payload: WorkShiftReassignSubjectPayload,
  scope?: WorkScheduleScope,
): Promise<WorkShiftRecord> => {
  const response = await apiRequest<unknown, WorkShiftReassignSubjectPayload>({
    method: 'POST',
    url: `/admin/work-shifts/${encodeURIComponent(workShiftId)}/reassign-subject`,
    params: scopeParams(scope),
    data: sanitizeReassignPayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const replaceWorkShiftResources = async (
  workShiftId: string,
  payload: WorkShiftReplaceResourcesPayload,
  scope?: WorkScheduleScope,
): Promise<WorkShiftRecord> => {
  const response = await apiRequest<unknown, WorkShiftReplaceResourcesPayload>({
    method: 'POST',
    url: `/admin/work-shifts/${encodeURIComponent(workShiftId)}/resources`,
    params: scopeParams(scope),
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const performWorkShiftLifecycleAction = async (
  workShiftId: string,
  action: WorkShiftLifecycleAction,
  scope?: WorkScheduleScope,
): Promise<WorkShiftRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/work-shifts/${encodeURIComponent(workShiftId)}/${action}`,
    params: scopeParams(scope),
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};

export const publishMonthlyRoster = async (
  monthlyRosterId: string,
  payload: MonthlyRosterPublishPayload,
): Promise<MonthlyRosterPublishResult> => {
  const response = await apiRequest<unknown, MonthlyRosterPublishPayload>({
    method: 'POST',
    url: `/admin/work-schedule/rosters/${encodeURIComponent(monthlyRosterId)}/publish`,
    data: sanitizeMonthlyRosterPublishPayload(payload),
  });

  return monthlyRosterPublishResponseSchema.parse(response).data;
};

export const fetchWorkPatterns = async (
  query: WorkPatternListQuery,
): Promise<CursorPagedResponse<WorkPatternRecord>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/work-schedule/patterns',
    params: sanitizeWorkPatternListQuery(query),
  });

  return workPatternListResponseSchema.parse(response);
};

export const fetchWorkPatternDetail = async (workPatternId: string): Promise<WorkPatternRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/work-schedule/patterns/${encodeURIComponent(workPatternId)}`,
  });

  return workPatternDetailResponseSchema.parse(response).data;
};

export const createWorkPattern = async (
  payload: WorkPatternCreatePayload,
): Promise<WorkPatternRecord> => {
  const response = await apiRequest<unknown, WorkPatternCreatePayload>({
    method: 'POST',
    url: '/admin/work-schedule/patterns',
    data: sanitizeWorkPatternCreatePayload(payload),
  });

  return workPatternDetailResponseSchema.parse(response).data;
};

export const updateWorkPattern = async (
  workPatternId: string,
  payload: WorkPatternUpdatePayload,
): Promise<WorkPatternRecord> => {
  const response = await apiRequest<unknown, WorkPatternUpdatePayload>({
    method: 'PATCH',
    url: `/admin/work-schedule/patterns/${encodeURIComponent(workPatternId)}`,
    data: sanitizeWorkPatternUpdatePayload(payload),
  });

  return workPatternDetailResponseSchema.parse(response).data;
};

export const performWorkPatternLifecycleAction = async (
  workPatternId: string,
  action: WorkPatternLifecycleAction,
): Promise<WorkPatternRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/work-schedule/patterns/${encodeURIComponent(workPatternId)}/${action}`,
    data: {},
  });

  return workPatternDetailResponseSchema.parse(response).data;
};

export const fetchHolidayCalendars = async (
  query: HolidayCalendarListQuery,
): Promise<CursorPagedResponse<HolidayCalendarRecord>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/work-schedule/holiday-calendars',
    params: sanitizeHolidayCalendarListQuery(query),
  });

  return holidayCalendarListResponseSchema.parse(response);
};

export const fetchHolidayCalendarDetail = async (
  holidayCalendarId: string,
): Promise<HolidayCalendarRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/work-schedule/holiday-calendars/${encodeURIComponent(holidayCalendarId)}`,
  });

  return holidayCalendarDetailResponseSchema.parse(response).data;
};

export const createHolidayCalendar = async (
  payload: HolidayCalendarCreatePayload,
): Promise<HolidayCalendarRecord> => {
  const response = await apiRequest<unknown, HolidayCalendarCreatePayload>({
    method: 'POST',
    url: '/admin/work-schedule/holiday-calendars',
    data: sanitizeHolidayCalendarCreatePayload(payload),
  });

  return holidayCalendarDetailResponseSchema.parse(response).data;
};

export const updateHolidayCalendar = async (
  holidayCalendarId: string,
  payload: HolidayCalendarUpdatePayload,
): Promise<HolidayCalendarRecord> => {
  const response = await apiRequest<unknown, HolidayCalendarUpdatePayload>({
    method: 'PATCH',
    url: `/admin/work-schedule/holiday-calendars/${encodeURIComponent(holidayCalendarId)}`,
    data: sanitizeHolidayCalendarUpdatePayload(payload),
  });

  return holidayCalendarDetailResponseSchema.parse(response).data;
};

export const performHolidayCalendarLifecycleAction = async (
  holidayCalendarId: string,
  action: HolidayCalendarLifecycleAction,
): Promise<HolidayCalendarRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/work-schedule/holiday-calendars/${encodeURIComponent(holidayCalendarId)}/${action}`,
    data: {},
  });

  return holidayCalendarDetailResponseSchema.parse(response).data;
};

export const addHolidayCalendarEntry = async (
  holidayCalendarId: string,
  payload: HolidayCalendarEntryPayload,
): Promise<HolidayCalendarRecord> => {
  const response = await apiRequest<unknown, HolidayCalendarEntryPayload>({
    method: 'POST',
    url: `/admin/work-schedule/holiday-calendars/${encodeURIComponent(holidayCalendarId)}/entries`,
    data: sanitizeHolidayCalendarEntryPayload(payload),
  });

  return holidayCalendarDetailResponseSchema.parse(response).data;
};

export const updateHolidayCalendarEntry = async (
  holidayCalendarId: string,
  holidayCalendarEntryId: string,
  payload: HolidayCalendarEntryPayload,
): Promise<HolidayCalendarRecord> => {
  const response = await apiRequest<unknown, HolidayCalendarEntryPayload>({
    method: 'PATCH',
    url: `/admin/work-schedule/holiday-calendars/${encodeURIComponent(
      holidayCalendarId,
    )}/entries/${encodeURIComponent(holidayCalendarEntryId)}`,
    data: sanitizeHolidayCalendarEntryPayload(payload),
  });

  return holidayCalendarDetailResponseSchema.parse(response).data;
};

export const removeHolidayCalendarEntry = async (
  holidayCalendarId: string,
  holidayCalendarEntryId: string,
): Promise<HolidayCalendarRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/work-schedule/holiday-calendars/${encodeURIComponent(
      holidayCalendarId,
    )}/entries/${encodeURIComponent(holidayCalendarEntryId)}/remove`,
    data: {},
  });

  return holidayCalendarDetailResponseSchema.parse(response).data;
};

export const fetchMonthlyRosters = async (
  query: MonthlyRosterListQuery,
): Promise<CursorPagedResponse<MonthlyRosterListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/work-schedule/rosters',
    params: sanitizeMonthlyRosterListQuery(query),
  });

  return monthlyRosterListResponseSchema.parse(response);
};

export const fetchMonthlyRosterDetail = async (
  monthlyRosterId: string,
  scope?: MonthlyRosterScope,
): Promise<MonthlyRosterRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/work-schedule/rosters/${encodeURIComponent(monthlyRosterId)}`,
    params: rosterScopeParams(scope),
  });

  return monthlyRosterDetailResponseSchema.parse(response).data;
};

export const fetchMonthlyRosterPreview = async (
  monthlyRosterId: string,
  scope?: MonthlyRosterScope,
): Promise<MonthlyRosterPreview> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/work-schedule/rosters/${encodeURIComponent(monthlyRosterId)}/preview`,
    params: rosterScopeParams(scope),
  });

  return monthlyRosterPreviewResponseSchema.parse(response).data;
};

export const createMonthlyRosterDraft = async (
  payload: MonthlyRosterCreatePayload,
): Promise<MonthlyRosterRecord> => {
  const response = await apiRequest<unknown, MonthlyRosterCreatePayload>({
    method: 'POST',
    url: '/admin/work-schedule/rosters',
    data: sanitizeMonthlyRosterCreatePayload(payload),
  });

  return monthlyRosterDetailResponseSchema.parse(response).data;
};

export const updateMonthlyRosterDraft = async (
  monthlyRosterId: string,
  payload: MonthlyRosterUpdatePayload,
): Promise<MonthlyRosterRecord> => {
  const response = await apiRequest<unknown, MonthlyRosterUpdatePayload>({
    method: 'PATCH',
    url: `/admin/work-schedule/rosters/${encodeURIComponent(monthlyRosterId)}`,
    data: sanitizeMonthlyRosterUpdatePayload(payload),
  });

  return monthlyRosterDetailResponseSchema.parse(response).data;
};

export const archiveMonthlyRoster = async (
  monthlyRosterId: string,
  scope?: MonthlyRosterScope,
): Promise<MonthlyRosterRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/work-schedule/rosters/${encodeURIComponent(monthlyRosterId)}/archive`,
    data: scope ? { scope } : {},
  });

  return monthlyRosterDetailResponseSchema.parse(response).data;
};

export const addRosterException = async (
  monthlyRosterId: string,
  payload: RosterExceptionPayload,
): Promise<MonthlyRosterRecord> => {
  const response = await apiRequest<unknown, RosterExceptionPayload>({
    method: 'POST',
    url: `/admin/work-schedule/rosters/${encodeURIComponent(monthlyRosterId)}/exceptions`,
    data: sanitizeRosterExceptionPayload(payload),
  });

  return monthlyRosterDetailResponseSchema.parse(response).data;
};

export const updateRosterException = async (
  monthlyRosterId: string,
  rosterExceptionId: string,
  payload: RosterExceptionPayload,
): Promise<MonthlyRosterRecord> => {
  const response = await apiRequest<unknown, RosterExceptionPayload>({
    method: 'PATCH',
    url: `/admin/work-schedule/rosters/${encodeURIComponent(
      monthlyRosterId,
    )}/exceptions/${encodeURIComponent(rosterExceptionId)}`,
    data: sanitizeRosterExceptionPayload(payload),
  });

  return monthlyRosterDetailResponseSchema.parse(response).data;
};

export const removeRosterException = async (
  monthlyRosterId: string,
  rosterExceptionId: string,
  scope?: MonthlyRosterScope,
): Promise<MonthlyRosterRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/work-schedule/rosters/${encodeURIComponent(
      monthlyRosterId,
    )}/exceptions/${encodeURIComponent(rosterExceptionId)}/remove`,
    data: scope ? { scope } : {},
  });

  return monthlyRosterDetailResponseSchema.parse(response).data;
};
