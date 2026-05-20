import type { ReferenceSummary } from '@shared/formatting/reference-display';

export type WorkShiftSubjectKind = 'EMPLOYMENT_PROFILE' | 'TALENT' | 'TALENT_GROUP';
export type WorkShiftStatus = 'ACTIVE' | 'CANCELLED' | 'ARCHIVED';
export type WorkScheduleScope = 'self' | 'team' | 'department' | 'global';
export type WorkPatternStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type WorkPatternWeekdayToken = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type WorkPatternLifecycleAction = 'activate' | 'archive';
export type HolidayCalendarStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type HolidayCalendarScopeType = 'GLOBAL';
export type HolidayCalendarEntryType = 'HOLIDAY' | 'COMPANY_OFF_DAY' | 'CUSTOM_OFF_DAY';
export type HolidayCalendarEntryStatus = 'ACTIVE' | 'REMOVED';
export type HolidayCalendarLifecycleAction = 'activate' | 'archive';
export type MonthlyRosterStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED' | 'ARCHIVED';
export type MonthlyRosterScope = 'department' | 'global';
export type RosterExceptionType = 'WORKING_TO_OFF' | 'CHANGE_TIME' | 'ADD_SPECIAL_SHIFT';
export type RosterExceptionStatus = 'ACTIVE' | 'REMOVED';
export type MonthlyRosterPreviewRowKind =
  | 'STANDARD'
  | 'WORKING_TO_OFF'
  | 'CHANGE_TIME'
  | 'ADD_SPECIAL_SHIFT'
  | 'HOLIDAY_SUPPRESSED';
export type MonthlyRosterPreviewConflictKind = 'SUBJECT_OVERLAP' | 'CANDIDATE_SUBJECT_OVERLAP';
export type WorkShiftSourceType = 'MANUAL' | 'ROSTER_GENERATED';

export const ROSTER_EXCEPTION_TYPES: readonly RosterExceptionType[] = [
  'WORKING_TO_OFF',
  'CHANGE_TIME',
  'ADD_SPECIAL_SHIFT',
];

export const WORK_PATTERN_TIMEZONE = 'Asia/Ho_Chi_Minh' as const;
export const HOLIDAY_CALENDAR_TIMEZONE = 'Asia/Ho_Chi_Minh' as const;
export const MONTHLY_ROSTER_TIMEZONE = 'Asia/Ho_Chi_Minh' as const;

export const WORK_PATTERN_WEEKDAYS: readonly WorkPatternWeekdayToken[] = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
];

export type WorkShiftRecord = {
  id: string;
  shiftCode: string;
  title: string;
  subjectKind: WorkShiftSubjectKind;
  subjectEmploymentProfileId?: string | null;
  subjectTalentId?: string | null;
  subjectTalentGroupId?: string | null;
  subjectRef?: ReferenceSummary | null;
  studioResourceIds: string[];
  studioResourceRefs?: ReferenceSummary[];
  status: WorkShiftStatus;
  shiftStartAt: number | string;
  shiftEndAt: number | string;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
  sourceType?: WorkShiftSourceType | null;
  sourceRosterId?: string | null;
  sourceRosterRef?: ReferenceSummary | null;
  sourcePatternId?: string | null;
  sourcePatternRef?: ReferenceSummary | null;
  sourceExceptionId?: string | null;
  sourceGenerationRunId?: string | null;
  sourceRosterMonth?: string | null;
  sourceDepartmentOrgUnitId?: string | null;
  sourceDepartmentOrgUnitRef?: ReferenceSummary | null;
  sourceRosterLocalDate?: string | null;
  sourceRosterSlotKey?: string | null;
};

export type WorkShiftListItem = Omit<
  WorkShiftRecord,
  | 'studioResourceIds'
  | 'description'
  | 'externalRef'
  | 'updatedAt'
  | 'sourcePatternId'
  | 'sourceExceptionId'
  | 'sourceGenerationRunId'
  | 'sourceDepartmentOrgUnitId'
>;

export type WorkShiftBySubjectItem = Pick<
  WorkShiftRecord,
  'id' | 'shiftCode' | 'title' | 'subjectKind' | 'status' | 'shiftStartAt' | 'shiftEndAt'
>;

export type WorkShiftByResourceItem = Pick<
  WorkShiftRecord,
  'id' | 'shiftCode' | 'title' | 'status' | 'shiftStartAt' | 'shiftEndAt'
>;

export type WorkShiftListQuery = {
  status?: WorkShiftStatus;
  subjectKind?: WorkShiftSubjectKind;
  subjectEmploymentProfileId?: string;
  subjectTalentId?: string;
  subjectTalentGroupId?: string;
  containsStudioResourceId?: string;
  sourceType?: WorkShiftSourceType;
  sourceRosterId?: string;
  sourceDepartmentOrgUnitId?: string;
  sourceRosterMonth?: string;
  windowStartAt?: number;
  windowEndAt?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: 'shiftStartAt' | 'shiftCode' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  scope?: WorkScheduleScope;
};

export type WorkShiftBySubjectQuery = Omit<
  WorkShiftListQuery,
  'containsStudioResourceId' | 'search'
> & {
  view?: 'by-subject';
};

export type WorkShiftByResourceQuery = Pick<
  WorkShiftListQuery,
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
  | 'scope'
> & {
  view?: 'by-resource';
  studioResourceId?: string;
};

export type WorkShiftCreatePayload = {
  shiftCode?: string | null;
  title: string;
  subjectKind: WorkShiftSubjectKind;
  subjectEmploymentProfileId?: string | null;
  subjectTalentId?: string | null;
  subjectTalentGroupId?: string | null;
  shiftStartAt: number;
  shiftEndAt: number;
  studioResourceIds?: string[];
  description?: string | null;
  externalRef?: string | null;
};

export type WorkShiftUpdatePayload = {
  title: string;
  description?: string | null;
  externalRef?: string | null;
};

export type WorkShiftReschedulePayload = {
  newShiftStartAt: number;
  newShiftEndAt: number;
};

export type WorkShiftReassignSubjectPayload = {
  newSubjectKind: WorkShiftSubjectKind;
  newSubjectEmploymentProfileId?: string | null;
  newSubjectTalentId?: string | null;
  newSubjectTalentGroupId?: string | null;
};

export type WorkShiftReplaceResourcesPayload = {
  newStudioResourceIds: string[];
};

export type WorkShiftLifecycleAction = 'cancel' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};

export type WorkPatternRecord = {
  workPatternId: string;
  patternCode: string;
  name: string;
  status: WorkPatternStatus;
  timezone: typeof WORK_PATTERN_TIMEZONE;
  startLocalTime: string;
  endLocalTime: string;
  workingMinutes: number;
  breakMinutes: number;
  workingDays: WorkPatternWeekdayToken[];
  description?: string | null;
  externalRef?: string | null;
  activatedAt?: number | string | null;
  archivedAt?: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type WorkPatternListQuery = {
  status?: WorkPatternStatus;
  limit?: number;
  cursor?: string;
  search?: string;
};

export type WorkPatternCreatePayload = {
  patternCode?: string | null;
  name: string;
  timezone: typeof WORK_PATTERN_TIMEZONE;
  startLocalTime: string;
  workingMinutes: number;
  breakMinutes: number;
  workingDays: WorkPatternWeekdayToken[];
  description?: string | null;
  externalRef?: string | null;
};

export type WorkPatternUpdatePayload = Partial<
  Pick<
    WorkPatternCreatePayload,
    | 'name'
    | 'timezone'
    | 'startLocalTime'
    | 'workingMinutes'
    | 'breakMinutes'
    | 'workingDays'
    | 'description'
    | 'externalRef'
  >
>;

export type HolidayCalendarEntryRecord = {
  holidayCalendarEntryId: string;
  date: string;
  entryType: HolidayCalendarEntryType;
  name: string;
  status: HolidayCalendarEntryStatus;
  description?: string | null;
  externalRef?: string | null;
  removedAt?: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type HolidayCalendarRecord = {
  holidayCalendarId: string;
  calendarCode: string;
  name: string;
  scopeType: HolidayCalendarScopeType;
  timezone: typeof HOLIDAY_CALENDAR_TIMEZONE;
  status: HolidayCalendarStatus;
  entries: HolidayCalendarEntryRecord[];
  description?: string | null;
  externalRef?: string | null;
  activatedAt?: number | string | null;
  archivedAt?: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type HolidayCalendarListQuery = {
  status?: HolidayCalendarStatus;
  limit?: number;
  cursor?: string;
  search?: string;
};

export type HolidayCalendarCreatePayload = {
  calendarCode?: string | null;
  name: string;
  scopeType: HolidayCalendarScopeType;
  timezone: typeof HOLIDAY_CALENDAR_TIMEZONE;
  description?: string | null;
  externalRef?: string | null;
};

export type HolidayCalendarUpdatePayload = {
  name: string;
  description?: string | null;
  externalRef?: string | null;
};

export type HolidayCalendarEntryPayload = {
  date: string;
  entryType: HolidayCalendarEntryType;
  name: string;
  description?: string | null;
  externalRef?: string | null;
};

export type RosterExceptionRecord = {
  rosterExceptionId: string;
  monthlyRosterId: string;
  exceptionType: RosterExceptionType;
  exceptionDate: string;
  subjectEmploymentProfileId: string;
  subjectEmploymentProfileRef?: ReferenceSummary | null;
  status: RosterExceptionStatus;
  title?: string | null;
  startLocalTime?: string | null;
  endLocalTime?: string | null;
  workingMinutes?: number | null;
  breakMinutes?: number | null;
  studioResourceIds?: string[];
  studioResourceRefs?: ReferenceSummary[];
  reason?: string | null;
  sourceNote?: string | null;
  description?: string | null;
  externalRef?: string | null;
  removedAt?: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type MonthlyRosterListItem = {
  monthlyRosterId: string;
  rosterCode: string;
  rosterMonth: string;
  timezone: typeof MONTHLY_ROSTER_TIMEZONE;
  targetSubjectKind: 'EMPLOYMENT_PROFILE';
  targetOrgUnitMode: 'EXACT_ONLY';
  departmentOrgUnitId: string;
  departmentOrgUnitRef?: ReferenceSummary | null;
  workPatternId: string;
  workPatternRef?: ReferenceSummary | null;
  holidayCalendarId: string;
  holidayCalendarRef?: ReferenceSummary | null;
  status: MonthlyRosterStatus;
  draftVersion?: number;
  exceptionCount?: number;
  description?: string | null;
  externalRef?: string | null;
  archivedAt?: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type MonthlyRosterRecord = MonthlyRosterListItem & {
  previewHash?: string | null;
  lastPreviewedAt?: number | string | null;
  publishedAt?: number | string | null;
  publishedByUserId?: string | null;
  publishGenerationRunId?: string | null;
  exceptions?: RosterExceptionRecord[];
};

export type MonthlyRosterListQuery = {
  status?: MonthlyRosterStatus;
  rosterMonth?: string;
  departmentOrgUnitId?: string;
  workPatternId?: string;
  holidayCalendarId?: string;
  limit?: number;
  cursor?: string;
  search?: string;
  scope?: MonthlyRosterScope;
};

export type MonthlyRosterCreatePayload = {
  rosterCode?: string | null;
  rosterMonth: string;
  timezone: typeof MONTHLY_ROSTER_TIMEZONE;
  departmentOrgUnitId: string;
  workPatternId: string;
  holidayCalendarId: string;
  description?: string | null;
  externalRef?: string | null;
  scope?: MonthlyRosterScope;
};

export type MonthlyRosterUpdatePayload = Partial<
  Pick<
    MonthlyRosterCreatePayload,
    | 'rosterMonth'
    | 'timezone'
    | 'departmentOrgUnitId'
    | 'workPatternId'
    | 'holidayCalendarId'
    | 'description'
    | 'externalRef'
    | 'scope'
  >
>;

export type RosterExceptionPayload = {
  exceptionType: RosterExceptionType;
  exceptionDate: string;
  subjectEmploymentProfileId: string;
  title?: string | null;
  startLocalTime?: string;
  workingMinutes?: number;
  breakMinutes?: number;
  studioResourceIds?: string[];
  reason?: string | null;
  sourceNote?: string | null;
  description?: string | null;
  externalRef?: string | null;
  scope?: MonthlyRosterScope;
};

export type MonthlyRosterPreviewEligibleProfile = {
  subjectEmploymentProfileId: string;
  subjectEmploymentProfileRef?: ReferenceSummary | null;
  employmentStatus: 'ACTIVE';
  departmentOrgUnitId: string;
  departmentOrgUnitRef?: ReferenceSummary | null;
};

export type MonthlyRosterPreviewConflict = {
  conflictKind: MonthlyRosterPreviewConflictKind;
  workShiftId: string | null;
  relatedPreviewRowId: string | null;
  shiftCode: string | null;
  title: string | null;
  status: 'ACTIVE' | null;
  shiftStartAt: number | string;
  shiftEndAt: number | string;
  sourceType: WorkShiftSourceType | null;
  sourceRosterId: string | null;
  sourceRosterMonth: string | null;
  sourceRosterLocalDate: string | null;
  sourceRosterSlotKey: string | null;
};

export type MonthlyRosterPreviewRow = {
  previewRowId: string;
  monthlyRosterId: string;
  rosterMonth: string;
  departmentOrgUnitId: string;
  departmentOrgUnitRef?: ReferenceSummary | null;
  subjectEmploymentProfileId: string;
  subjectEmploymentProfileRef?: ReferenceSummary | null;
  localDate: string;
  rowKind: MonthlyRosterPreviewRowKind;
  sourceExceptionId: string | null;
  sourceRosterSlotKey: string | null;
  startLocalTime: string | null;
  endLocalTime: string | null;
  shiftStartAt: number | string | null;
  shiftEndAt: number | string | null;
  workingMinutes: number | null;
  breakMinutes: number | null;
  holidayCalendarEntryId: string | null;
  holidayName: string | null;
  holidayEntryType: HolidayCalendarEntryType | null;
  isCandidateShift: boolean;
  isSuppressed: boolean;
  conflicts: MonthlyRosterPreviewConflict[];
  warnings: string[];
  blockers: string[];
};

export type MonthlyRosterPreviewSummary = {
  totalEligibleProfiles: number;
  totalStandardCandidateShifts: number;
  totalHolidaySuppressions: number;
  totalWorkingToOff: number;
  totalChangeTime: number;
  totalAddSpecialShift: number;
  totalCandidateShiftsAfterExceptions: number;
  totalConflicts: number;
};

export type MonthlyRosterPreview = {
  monthlyRosterId: string;
  rosterMonth: string;
  timezone: typeof MONTHLY_ROSTER_TIMEZONE;
  departmentOrgUnitId: string;
  departmentOrgUnitRef?: ReferenceSummary | null;
  workPatternId: string;
  workPatternRef?: ReferenceSummary | null;
  holidayCalendarId: string;
  holidayCalendarRef?: ReferenceSummary | null;
  rosterStatus: MonthlyRosterStatus;
  draftVersion: number;
  currentPreviewHash: string | null;
  computedPreviewHash: string;
  eligibleProfiles: MonthlyRosterPreviewEligibleProfile[];
  rows: MonthlyRosterPreviewRow[];
  summary: MonthlyRosterPreviewSummary;
};

export type MonthlyRosterPublishPayload = {
  expectedPreviewHash: string;
  idempotencyKey?: string | null;
  note?: string | null;
  scope?: MonthlyRosterScope;
};

export type MonthlyRosterPublishResult = {
  monthlyRosterId: string;
  status: MonthlyRosterStatus;
  sourceGenerationRunId: string | null;
  publishedAt: number | string | null;
  publishedByUserId: string | null;
  generatedWorkShiftCount: number;
  skippedWorkingToOffCount: number;
  holidaySuppressedCount: number;
  changeTimeCount: number;
  addSpecialShiftCount: number;
  conflictCount: number;
  computedPreviewHash: string | null;
  generatedWorkShiftIds?: string[];
};
