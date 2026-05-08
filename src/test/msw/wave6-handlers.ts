import { http, HttpResponse } from 'msw';

type WorkShiftSubjectKind = 'EMPLOYMENT_PROFILE' | 'TALENT' | 'TALENT_GROUP';
type WorkShiftStatus = 'ACTIVE' | 'CANCELLED' | 'ARCHIVED';
type WorkPatternStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type WorkPatternWeekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type HolidayCalendarStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type HolidayCalendarEntryType = 'HOLIDAY' | 'COMPANY_OFF_DAY' | 'CUSTOM_OFF_DAY';
type HolidayCalendarEntryStatus = 'ACTIVE' | 'REMOVED';
type MonthlyRosterStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED' | 'ARCHIVED';
type MonthlyRosterScope = 'department' | 'global';
type RosterExceptionType = 'WORKING_TO_OFF' | 'CHANGE_TIME' | 'ADD_SPECIAL_SHIFT';
type MonthlyRosterPreviewRowKind =
  | 'STANDARD'
  | 'WORKING_TO_OFF'
  | 'CHANGE_TIME'
  | 'ADD_SPECIAL_SHIFT'
  | 'HOLIDAY_SUPPRESSED';
type WorkScheduleScope = 'self' | 'team' | 'department' | 'global';
type EventAssignmentKind = 'EMPLOYMENT_PROFILE' | 'TALENT' | 'TALENT_GROUP';
type EventStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

type WorkShiftRecord = {
  id: string;
  shiftCode: string;
  title: string;
  subjectKind: WorkShiftSubjectKind;
  subjectEmploymentProfileId: string | null;
  subjectTalentId: string | null;
  subjectTalentGroupId: string | null;
  studioResourceIds: string[];
  status: WorkShiftStatus;
  shiftStartAt: number;
  shiftEndAt: number;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
  sourceType?: 'MANUAL' | 'ROSTER_GENERATED' | null;
  sourceRosterId?: string | null;
  sourcePatternId?: string | null;
  sourceExceptionId?: string | null;
  sourceGenerationRunId?: string | null;
  sourceRosterMonth?: string | null;
  sourceDepartmentOrgUnitId?: string | null;
  sourceRosterLocalDate?: string | null;
  sourceRosterSlotKey?: string | null;
};

type WorkPatternRecord = {
  workPatternId: string;
  patternCode: string;
  name: string;
  status: WorkPatternStatus;
  timezone: 'Asia/Ho_Chi_Minh';
  startLocalTime: string;
  endLocalTime: string;
  workingMinutes: number;
  breakMinutes: number;
  workingDays: WorkPatternWeekday[];
  description: string | null;
  externalRef: string | null;
  activatedAt: number | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type HolidayCalendarEntryRecord = {
  holidayCalendarEntryId: string;
  date: string;
  entryType: HolidayCalendarEntryType;
  name: string;
  status: HolidayCalendarEntryStatus;
  description: string | null;
  externalRef: string | null;
  removedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type HolidayCalendarRecord = {
  holidayCalendarId: string;
  calendarCode: string;
  name: string;
  scopeType: 'GLOBAL';
  timezone: 'Asia/Ho_Chi_Minh';
  status: HolidayCalendarStatus;
  entries: HolidayCalendarEntryRecord[];
  description: string | null;
  externalRef: string | null;
  activatedAt: number | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type RosterExceptionRecord = {
  rosterExceptionId: string;
  monthlyRosterId: string;
  exceptionType: RosterExceptionType;
  exceptionDate: string;
  subjectEmploymentProfileId: string;
  status: 'ACTIVE' | 'REMOVED';
  title: string | null;
  startLocalTime: string | null;
  endLocalTime: string | null;
  workingMinutes: number | null;
  breakMinutes: number | null;
  studioResourceIds: string[];
  reason: string | null;
  sourceNote: string | null;
  description: string | null;
  externalRef: string | null;
  removedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type MonthlyRosterPreviewConflictRecord = {
  conflictKind: 'SUBJECT_OVERLAP' | 'CANDIDATE_SUBJECT_OVERLAP';
  workShiftId: string | null;
  relatedPreviewRowId: string | null;
  shiftCode: string | null;
  title: string | null;
  status: 'ACTIVE' | null;
  shiftStartAt: number;
  shiftEndAt: number;
  sourceType: 'MANUAL' | 'ROSTER_GENERATED' | null;
  sourceRosterId: string | null;
  sourceRosterMonth: string | null;
  sourceRosterLocalDate: string | null;
  sourceRosterSlotKey: string | null;
};

type MonthlyRosterPreviewRowRecord = {
  previewRowId: string;
  monthlyRosterId: string;
  rosterMonth: string;
  departmentOrgUnitId: string;
  subjectEmploymentProfileId: string;
  localDate: string;
  rowKind: MonthlyRosterPreviewRowKind;
  sourceExceptionId: string | null;
  sourceRosterSlotKey: string | null;
  startLocalTime: string | null;
  endLocalTime: string | null;
  shiftStartAt: number | null;
  shiftEndAt: number | null;
  workingMinutes: number | null;
  breakMinutes: number | null;
  holidayCalendarEntryId: string | null;
  holidayName: string | null;
  holidayEntryType: HolidayCalendarEntryType | null;
  isCandidateShift: boolean;
  isSuppressed: boolean;
  conflicts: MonthlyRosterPreviewConflictRecord[];
  warnings: string[];
  blockers: string[];
};

type MonthlyRosterRecord = {
  monthlyRosterId: string;
  rosterCode: string;
  rosterMonth: string;
  timezone: 'Asia/Ho_Chi_Minh';
  targetSubjectKind: 'EMPLOYMENT_PROFILE';
  targetOrgUnitMode: 'EXACT_ONLY';
  departmentOrgUnitId: string;
  workPatternId: string;
  holidayCalendarId: string;
  status: MonthlyRosterStatus;
  draftVersion: number;
  exceptionCount: number;
  description: string | null;
  externalRef: string | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
  previewHash: string | null;
  lastPreviewedAt: number | null;
  publishedAt: number | null;
  publishedByUserId: string | null;
  publishGenerationRunId: string | null;
  exceptions: RosterExceptionRecord[];
};

type EventRecord = {
  id: string;
  eventCode: string;
  title: string;
  studioResourceIds: string[];
  platformAccountIds: string[];
  status: EventStatus;
  eventStartAt: number;
  eventEndAt: number;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type EventAssignmentRecord = {
  id: string;
  eventId: string;
  assignmentKind: EventAssignmentKind;
  assignmentEmploymentProfileId: string | null;
  assignmentTalentId: string | null;
  assignmentTalentGroupId: string | null;
  assignmentStatus: 'ACTIVE';
  createdAt: number;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const futureStart = Date.parse('2026-05-12T09:00:00.000Z');
const futureEnd = Date.parse('2026-05-12T12:00:00.000Z');
const historicalStart = Date.parse('2026-03-12T09:00:00.000Z');
const historicalEnd = Date.parse('2026-03-12T12:00:00.000Z');
const initialWorkShiftSeed = 600;
const initialWorkPatternSeed = 700;
const initialHolidayCalendarSeed = 710;
const initialHolidayCalendarEntrySeed = 720;
const initialMonthlyRosterSeed = 730;
const initialEventSeed = 800;
const initialAssignmentSeed = 900;

let workShiftSeed = initialWorkShiftSeed;
let workPatternSeed = initialWorkPatternSeed;
let holidayCalendarSeed = initialHolidayCalendarSeed;
let holidayCalendarEntrySeed = initialHolidayCalendarEntrySeed;
let monthlyRosterSeed = initialMonthlyRosterSeed;
let eventSeed = initialEventSeed;
let assignmentSeed = initialAssignmentSeed;

const initialWorkShifts: WorkShiftRecord[] = [
  {
    id: 'work-shift-001',
    shiftCode: 'SHIFT001',
    title: 'Main studio morning shift',
    subjectKind: 'EMPLOYMENT_PROFILE',
    subjectEmploymentProfileId: 'ep-001',
    subjectTalentId: null,
    subjectTalentGroupId: null,
    studioResourceIds: ['studio-001'],
    status: 'ACTIVE',
    shiftStartAt: futureStart,
    shiftEndAt: futureEnd,
    description: 'Core operations shift',
    externalRef: 'WS-001',
    createdAt: now - 8_000,
    updatedAt: now - 7_500,
  },
  {
    id: 'work-shift-002',
    shiftCode: 'SHIFT002',
    title: 'Talent support shift',
    subjectKind: 'TALENT',
    subjectEmploymentProfileId: null,
    subjectTalentId: 'talent-001',
    subjectTalentGroupId: null,
    studioResourceIds: ['studio-002'],
    status: 'ACTIVE',
    shiftStartAt: futureStart + 100_000,
    shiftEndAt: futureEnd + 100_000,
    description: null,
    externalRef: null,
    createdAt: now - 7_000,
    updatedAt: now - 6_500,
  },
  {
    id: 'work-shift-cancelled',
    shiftCode: 'SHIFT010',
    title: 'Cancelled work shift',
    subjectKind: 'EMPLOYMENT_PROFILE',
    subjectEmploymentProfileId: 'ep-002',
    subjectTalentId: null,
    subjectTalentGroupId: null,
    studioResourceIds: [],
    status: 'CANCELLED',
    shiftStartAt: futureStart + 200_000,
    shiftEndAt: futureEnd + 200_000,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_500,
  },
  {
    id: 'work-shift-historical',
    shiftCode: 'SHIFT020',
    title: 'Historical active work shift',
    subjectKind: 'EMPLOYMENT_PROFILE',
    subjectEmploymentProfileId: 'ep-003',
    subjectTalentId: null,
    subjectTalentGroupId: null,
    studioResourceIds: ['studio-001'],
    status: 'ACTIVE',
    shiftStartAt: historicalStart,
    shiftEndAt: historicalEnd,
    description: null,
    externalRef: null,
    createdAt: now - 5_000,
    updatedAt: now - 4_500,
  },
  {
    id: 'work-shift-archive',
    shiftCode: 'SHIFT999',
    title: 'Archived work shift',
    subjectKind: 'EMPLOYMENT_PROFILE',
    subjectEmploymentProfileId: 'ep-archive',
    subjectTalentId: null,
    subjectTalentGroupId: null,
    studioResourceIds: [],
    status: 'ARCHIVED',
    shiftStartAt: historicalStart - 100_000,
    shiftEndAt: historicalEnd - 100_000,
    description: 'Archived shift',
    externalRef: null,
    createdAt: now - 4_000,
    updatedAt: now - 3_500,
  },
];

const initialWorkPatterns: WorkPatternRecord[] = [
  {
    workPatternId: 'pattern-draft',
    patternCode: 'PATTERN_DRAFT',
    name: 'Standard office',
    status: 'DRAFT',
    timezone: 'Asia/Ho_Chi_Minh',
    startLocalTime: '08:00',
    endLocalTime: '17:00',
    workingMinutes: 480,
    breakMinutes: 60,
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    description: 'Draft roster pattern',
    externalRef: 'PAT-DRAFT',
    activatedAt: null,
    archivedAt: null,
    createdAt: now - 9_000,
    updatedAt: now - 8_500,
  },
  {
    workPatternId: 'pattern-active',
    patternCode: 'PATTERN_ACTIVE',
    name: 'Active operations',
    status: 'ACTIVE',
    timezone: 'Asia/Ho_Chi_Minh',
    startLocalTime: '09:00',
    endLocalTime: '18:00',
    workingMinutes: 480,
    breakMinutes: 60,
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    description: null,
    externalRef: null,
    activatedAt: now - 7_000,
    archivedAt: null,
    createdAt: now - 8_000,
    updatedAt: now - 6_500,
  },
  {
    workPatternId: 'pattern-archived',
    patternCode: 'PATTERN_ARCHIVED',
    name: 'Archived pattern',
    status: 'ARCHIVED',
    timezone: 'Asia/Ho_Chi_Minh',
    startLocalTime: '07:00',
    endLocalTime: '15:30',
    workingMinutes: 450,
    breakMinutes: 60,
    workingDays: ['MON', 'WED', 'FRI'],
    description: null,
    externalRef: null,
    activatedAt: now - 7_000,
    archivedAt: now - 5_000,
    createdAt: now - 7_500,
    updatedAt: now - 5_000,
  },
];

const initialHolidayCalendars: HolidayCalendarRecord[] = [
  {
    holidayCalendarId: 'holiday-calendar-draft',
    calendarCode: 'VN_DRAFT',
    name: 'Vietnam draft calendar',
    scopeType: 'GLOBAL',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'DRAFT',
    entries: [
      {
        holidayCalendarEntryId: 'holiday-entry-001',
        date: '2026-01-01',
        entryType: 'HOLIDAY',
        name: 'New year',
        status: 'ACTIVE',
        description: 'National holiday',
        externalRef: 'VN-NEW-YEAR',
        removedAt: null,
        createdAt: now - 7_000,
        updatedAt: now - 6_800,
      },
      {
        holidayCalendarEntryId: 'holiday-entry-removed',
        date: '2026-02-01',
        entryType: 'COMPANY_OFF_DAY',
        name: 'Removed company day',
        status: 'REMOVED',
        description: null,
        externalRef: null,
        removedAt: now - 6_000,
        createdAt: now - 6_500,
        updatedAt: now - 6_000,
      },
    ],
    description: 'Draft global calendar',
    externalRef: 'HC-DRAFT',
    activatedAt: null,
    archivedAt: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
  },
  {
    holidayCalendarId: 'holiday-calendar-active',
    calendarCode: 'VN_ACTIVE',
    name: 'Vietnam active calendar',
    scopeType: 'GLOBAL',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'ACTIVE',
    entries: [],
    description: null,
    externalRef: null,
    activatedAt: now - 6_000,
    archivedAt: null,
    createdAt: now - 7_000,
    updatedAt: now - 5_000,
  },
  {
    holidayCalendarId: 'holiday-calendar-archived',
    calendarCode: 'VN_ARCHIVED',
    name: 'Archived holiday calendar',
    scopeType: 'GLOBAL',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'ARCHIVED',
    entries: [],
    description: null,
    externalRef: null,
    activatedAt: now - 6_000,
    archivedAt: now - 4_000,
    createdAt: now - 6_500,
    updatedAt: now - 4_000,
  },
];

const initialMonthlyRosters: MonthlyRosterRecord[] = [
  {
    monthlyRosterId: 'roster-draft',
    rosterCode: 'ROSTER_DRAFT',
    rosterMonth: '2026-05',
    timezone: 'Asia/Ho_Chi_Minh',
    targetSubjectKind: 'EMPLOYMENT_PROFILE',
    targetOrgUnitMode: 'EXACT_ONLY',
    departmentOrgUnitId: 'ou-sales',
    workPatternId: 'pattern-active',
    holidayCalendarId: 'holiday-calendar-active',
    status: 'DRAFT',
    draftVersion: 1,
    exceptionCount: 1,
    description: 'Draft roster',
    externalRef: 'MR-DRAFT',
    archivedAt: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
    previewHash: null,
    lastPreviewedAt: null,
    publishedAt: null,
    publishedByUserId: null,
    publishGenerationRunId: null,
    exceptions: [
      {
        rosterExceptionId: 'roster-exception-001',
        monthlyRosterId: 'roster-draft',
        exceptionType: 'WORKING_TO_OFF',
        exceptionDate: '2026-05-12',
        subjectEmploymentProfileId: 'ep-001',
        status: 'ACTIVE',
        title: 'Planned day off',
        startLocalTime: null,
        endLocalTime: null,
        workingMinutes: null,
        breakMinutes: null,
        studioResourceIds: [],
        reason: null,
        sourceNote: null,
        description: null,
        externalRef: null,
        removedAt: null,
        createdAt: now - 7_500,
        updatedAt: now - 7_200,
      },
    ],
  },
  {
    monthlyRosterId: 'roster-published',
    rosterCode: 'ROSTER_PUBLISHED',
    rosterMonth: '2026-04',
    timezone: 'Asia/Ho_Chi_Minh',
    targetSubjectKind: 'EMPLOYMENT_PROFILE',
    targetOrgUnitMode: 'EXACT_ONLY',
    departmentOrgUnitId: 'ou-sales',
    workPatternId: 'pattern-active',
    holidayCalendarId: 'holiday-calendar-active',
    status: 'PUBLISHED',
    draftVersion: 2,
    exceptionCount: 0,
    description: null,
    externalRef: null,
    archivedAt: null,
    createdAt: now - 9_000,
    updatedAt: now - 5_000,
    previewHash: 'preview-hash-001',
    lastPreviewedAt: now - 5_500,
    publishedAt: now - 5_000,
    publishedByUserId: 'user-alice',
    publishGenerationRunId: 'generation-run-001',
    exceptions: [],
  },
];

const initialEvents: EventRecord[] = [
  {
    id: 'event-001',
    eventCode: 'EVT001',
    title: 'Launch livestream',
    studioResourceIds: ['studio-001'],
    platformAccountIds: ['platform-001'],
    status: 'SCHEDULED',
    eventStartAt: futureStart + 400_000,
    eventEndAt: futureEnd + 400_000,
    description: 'Primary launch event',
    externalRef: 'EVENT-001',
    createdAt: now - 8_000,
    updatedAt: now - 7_500,
  },
  {
    id: 'event-progress',
    eventCode: 'EVT002',
    title: 'Live event in progress',
    studioResourceIds: ['studio-002'],
    platformAccountIds: ['platform-001'],
    status: 'IN_PROGRESS',
    eventStartAt: futureStart + 500_000,
    eventEndAt: futureEnd + 500_000,
    description: null,
    externalRef: null,
    createdAt: now - 7_000,
    updatedAt: now - 6_500,
  },
  {
    id: 'event-completed',
    eventCode: 'EVT003',
    title: 'Completed event',
    studioResourceIds: [],
    platformAccountIds: ['platform-003'],
    status: 'COMPLETED',
    eventStartAt: historicalStart,
    eventEndAt: historicalEnd,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_500,
  },
  {
    id: 'event-empty',
    eventCode: 'EVT004',
    title: 'Scheduled event without assignments',
    studioResourceIds: [],
    platformAccountIds: [],
    status: 'SCHEDULED',
    eventStartAt: futureStart + 600_000,
    eventEndAt: futureEnd + 600_000,
    description: null,
    externalRef: null,
    createdAt: now - 5_000,
    updatedAt: now - 4_500,
  },
  {
    id: 'event-archive',
    eventCode: 'EVT999',
    title: 'Archived event',
    studioResourceIds: [],
    platformAccountIds: [],
    status: 'ARCHIVED',
    eventStartAt: historicalStart - 100_000,
    eventEndAt: historicalEnd - 100_000,
    description: 'Archived event',
    externalRef: null,
    createdAt: now - 4_000,
    updatedAt: now - 3_500,
  },
];

const initialAssignments: EventAssignmentRecord[] = [
  {
    id: 'assignment-001',
    eventId: 'event-001',
    assignmentKind: 'EMPLOYMENT_PROFILE',
    assignmentEmploymentProfileId: 'ep-001',
    assignmentTalentId: null,
    assignmentTalentGroupId: null,
    assignmentStatus: 'ACTIVE',
    createdAt: now - 7_000,
  },
  {
    id: 'assignment-001b',
    eventId: 'event-001',
    assignmentKind: 'TALENT',
    assignmentEmploymentProfileId: null,
    assignmentTalentId: 'talent-002',
    assignmentTalentGroupId: null,
    assignmentStatus: 'ACTIVE',
    createdAt: now - 6_800,
  },
  {
    id: 'assignment-002',
    eventId: 'event-progress',
    assignmentKind: 'TALENT',
    assignmentEmploymentProfileId: null,
    assignmentTalentId: 'talent-001',
    assignmentTalentGroupId: null,
    assignmentStatus: 'ACTIVE',
    createdAt: now - 6_000,
  },
  {
    id: 'assignment-003',
    eventId: 'event-completed',
    assignmentKind: 'TALENT_GROUP',
    assignmentEmploymentProfileId: null,
    assignmentTalentId: null,
    assignmentTalentGroupId: 'group-001',
    assignmentStatus: 'ACTIVE',
    createdAt: now - 5_000,
  },
];

let workShifts = initialWorkShifts.map((record) => ({ ...record }));
let workPatterns = initialWorkPatterns.map((record) => ({ ...record }));
let holidayCalendars = initialHolidayCalendars.map((record) => ({
  ...record,
  entries: record.entries.map((entry) => ({ ...entry })),
}));
let monthlyRosters = initialMonthlyRosters.map((record) => ({
  ...record,
  exceptions: record.exceptions.map((exception) => ({ ...exception })),
}));
let events = initialEvents.map((record) => ({ ...record }));
let assignments = initialAssignments.map((record) => ({ ...record }));

export const resetWave6MockData = (): void => {
  workShiftSeed = initialWorkShiftSeed;
  workPatternSeed = initialWorkPatternSeed;
  holidayCalendarSeed = initialHolidayCalendarSeed;
  holidayCalendarEntrySeed = initialHolidayCalendarEntrySeed;
  monthlyRosterSeed = initialMonthlyRosterSeed;
  eventSeed = initialEventSeed;
  assignmentSeed = initialAssignmentSeed;
  workShifts = initialWorkShifts.map((record) => ({ ...record }));
  workPatterns = initialWorkPatterns.map((record) => ({ ...record }));
  holidayCalendars = initialHolidayCalendars.map((record) => ({
    ...record,
    entries: record.entries.map((entry) => ({ ...entry })),
  }));
  monthlyRosters = initialMonthlyRosters.map((record) => ({
    ...record,
    exceptions: record.exceptions.map((exception) => ({ ...exception })),
  }));
  events = initialEvents.map((record) => ({ ...record }));
  assignments = initialAssignments.map((record) => ({ ...record }));
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const toPrefixMatch = (value: string | null | undefined, search: string): boolean => {
  if (!value) {
    return false;
  }

  return normalizeText(value).startsWith(normalizeText(search));
};

const parsePositiveInt = (value: string | null | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

const paginate = <TData>(
  items: TData[],
  searchParams: URLSearchParams,
): { data: TData[]; meta?: { nextCursor?: string } } => {
  const limitParam = parsePositiveInt(searchParams.get('limit'));
  const limit = Math.min(limitParam ?? 20, 100);
  const cursorParam = parsePositiveInt(searchParams.get('cursor'));
  const cursor = cursorParam ?? 0;
  const start = Math.min(cursor, items.length);
  const end = Math.min(start + limit, items.length);
  const data = items.slice(start, end);
  const nextCursor = end < items.length ? String(end) : undefined;

  return {
    data,
    meta: nextCursor ? { nextCursor } : undefined,
  };
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  const body = (await request.json()) as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
};

const toNullableText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  if (value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    return undefined;
  }

  return value.map((item) => item.trim());
};

const hasOnlyKeys = (body: Record<string, unknown>, allowedKeys: string[]): boolean => {
  return Object.keys(body).every((key) => allowedKeys.includes(key));
};

const rejectUnsupportedBody = (body: Record<string, unknown>, allowedKeys: string[]) => {
  if (
    hasOnlyKeys(body, allowedKeys) &&
    body.scope === undefined &&
    body.scopeGrants === undefined
  ) {
    return undefined;
  }

  return HttpResponse.json({ message: 'errors:validation.unsupportedPayload' }, { status: 422 });
};

const rejectUnsupportedQuery = (searchParams: URLSearchParams, allowedKeys: string[]) => {
  for (const key of searchParams.keys()) {
    if (!allowedKeys.includes(key)) {
      return HttpResponse.json({ message: 'errors:validation.unsupportedQuery' }, { status: 400 });
    }
  }

  return undefined;
};

const rejectEventScopeLeakage = (request: Request, body?: Record<string, unknown>) => {
  const url = new URL(request.url);
  if (
    url.searchParams.has('scope') ||
    url.searchParams.has('scopeGrants') ||
    body?.scope !== undefined ||
    body?.scopeGrants !== undefined
  ) {
    return HttpResponse.json({ message: 'event-assignment:validation.noScope' }, { status: 422 });
  }

  return undefined;
};

const isWorkScope = (value: string | null): value is WorkScheduleScope => {
  return value === 'self' || value === 'team' || value === 'department' || value === 'global';
};

const rejectInvalidWorkScope = (searchParams: URLSearchParams) => {
  const scope = searchParams.get('scope');
  if (!scope || isWorkScope(scope)) {
    return undefined;
  }

  return HttpResponse.json({ message: 'work-schedule:validation.invalidScope' }, { status: 422 });
};

const rejectInvalidScopedWorkSubjectMutation = (
  searchParams: URLSearchParams,
  subjectKind: WorkShiftSubjectKind,
) => {
  const scope = searchParams.get('scope');
  if (
    (scope === 'self' || scope === 'team' || scope === 'department') &&
    subjectKind !== 'EMPLOYMENT_PROFILE'
  ) {
    return HttpResponse.json(
      { message: 'work-schedule:validation.nonGlobalEmploymentProfileOnly' },
      { status: 422 },
    );
  }

  return undefined;
};

const isSubjectKind = (value: unknown): value is WorkShiftSubjectKind =>
  value === 'EMPLOYMENT_PROFILE' || value === 'TALENT' || value === 'TALENT_GROUP';

const isAssignmentKind = (value: unknown): value is EventAssignmentKind =>
  value === 'EMPLOYMENT_PROFILE' || value === 'TALENT' || value === 'TALENT_GROUP';

const readWorkSubjectInput = (
  body: Record<string, unknown>,
  kindKey: 'subjectKind' | 'newSubjectKind',
):
  | {
      subjectKind: WorkShiftSubjectKind;
      subjectEmploymentProfileId: string | null;
      subjectTalentId: string | null;
      subjectTalentGroupId: string | null;
    }
  | undefined => {
  const subjectKind = body[kindKey];
  if (!isSubjectKind(subjectKind)) {
    return undefined;
  }

  const prefix = kindKey === 'newSubjectKind' ? 'newSubject' : 'subject';
  const keys = {
    EMPLOYMENT_PROFILE: `${prefix}EmploymentProfileId`,
    TALENT: `${prefix}TalentId`,
    TALENT_GROUP: `${prefix}TalentGroupId`,
  } as const;
  const expectedKey = keys[subjectKind];
  const expectedValue = toNullableText(body[expectedKey]);
  const providedKeys = Object.values(keys).filter((key) => toNullableText(body[key]));

  if (!expectedValue || providedKeys.length !== 1) {
    return undefined;
  }

  return {
    subjectKind,
    subjectEmploymentProfileId: subjectKind === 'EMPLOYMENT_PROFILE' ? expectedValue : null,
    subjectTalentId: subjectKind === 'TALENT' ? expectedValue : null,
    subjectTalentGroupId: subjectKind === 'TALENT_GROUP' ? expectedValue : null,
  };
};

const readAssignmentInput = (
  value: unknown,
): Omit<EventAssignmentRecord, 'id' | 'eventId' | 'assignmentStatus' | 'createdAt'> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const body = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(body, [
      'assignmentKind',
      'assignmentEmploymentProfileId',
      'assignmentTalentId',
      'assignmentTalentGroupId',
    ])
  ) {
    return undefined;
  }

  const assignmentKind = body.assignmentKind;
  if (!isAssignmentKind(assignmentKind)) {
    return undefined;
  }

  const keyMap = {
    EMPLOYMENT_PROFILE: 'assignmentEmploymentProfileId',
    TALENT: 'assignmentTalentId',
    TALENT_GROUP: 'assignmentTalentGroupId',
  } as const;
  const expectedKey = keyMap[assignmentKind];
  const expectedValue = toNullableText(body[expectedKey]);
  const providedKeys = Object.values(keyMap).filter((key) => toNullableText(body[key]));

  if (!expectedValue || providedKeys.length !== 1) {
    return undefined;
  }

  return {
    assignmentKind,
    assignmentEmploymentProfileId: assignmentKind === 'EMPLOYMENT_PROFILE' ? expectedValue : null,
    assignmentTalentId: assignmentKind === 'TALENT' ? expectedValue : null,
    assignmentTalentGroupId: assignmentKind === 'TALENT_GROUP' ? expectedValue : null,
  };
};

const readAssignmentInputs = (
  value: unknown,
): ReturnType<typeof readAssignmentInput>[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed = value.map(readAssignmentInput);
  if (parsed.some((item) => !item)) {
    return undefined;
  }

  return parsed;
};

const readWorkShift = (workShiftId: string): WorkShiftRecord | undefined =>
  workShifts.find((item) => item.id === workShiftId);

const readWorkPattern = (workPatternId: string): WorkPatternRecord | undefined =>
  workPatterns.find((item) => item.workPatternId === workPatternId);

const readHolidayCalendar = (holidayCalendarId: string): HolidayCalendarRecord | undefined =>
  holidayCalendars.find((item) => item.holidayCalendarId === holidayCalendarId);

const readMonthlyRoster = (monthlyRosterId: string): MonthlyRosterRecord | undefined =>
  monthlyRosters.find((item) => item.monthlyRosterId === monthlyRosterId);

const readEvent = (eventId: string): EventRecord | undefined =>
  events.find((item) => item.id === eventId);

const calculatePatternEndLocalTime = (
  startLocalTime: string,
  workingMinutes: number,
  breakMinutes: number,
): string | undefined => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startLocalTime);
  if (!match) {
    return undefined;
  }

  const totalMinutes = Number(match[1]) * 60 + Number(match[2]) + workingMinutes + breakMinutes;
  if (totalMinutes >= 24 * 60) {
    return undefined;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const isWorkPatternStatus = (value: string | null): value is WorkPatternStatus =>
  value === 'DRAFT' || value === 'ACTIVE' || value === 'ARCHIVED';

const isHolidayCalendarStatus = (value: string | null): value is HolidayCalendarStatus =>
  value === 'DRAFT' || value === 'ACTIVE' || value === 'ARCHIVED';

const isHolidayCalendarEntryType = (value: unknown): value is HolidayCalendarEntryType =>
  value === 'HOLIDAY' || value === 'COMPANY_OFF_DAY' || value === 'CUSTOM_OFF_DAY';

const isMonthlyRosterStatus = (value: string | null): value is MonthlyRosterStatus =>
  value === 'DRAFT' || value === 'PUBLISHED' || value === 'LOCKED' || value === 'ARCHIVED';

const isMonthlyRosterScope = (value: unknown): value is MonthlyRosterScope =>
  value === 'department' || value === 'global';

const isRosterExceptionType = (value: unknown): value is RosterExceptionType =>
  value === 'WORKING_TO_OFF' || value === 'CHANGE_TIME' || value === 'ADD_SPECIAL_SHIFT';

const isWorkPatternWeekday = (value: unknown): value is WorkPatternWeekday =>
  value === 'MON' ||
  value === 'TUE' ||
  value === 'WED' ||
  value === 'THU' ||
  value === 'FRI' ||
  value === 'SAT' ||
  value === 'SUN';

const readPatternWeekdays = (value: unknown): WorkPatternWeekday[] | undefined => {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isWorkPatternWeekday)) {
    return undefined;
  }

  return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].filter((day) =>
    value.includes(day as WorkPatternWeekday),
  ) as WorkPatternWeekday[];
};

const toWorkShiftListItem = (record: WorkShiftRecord) => ({
  id: record.id,
  shiftCode: record.shiftCode,
  title: record.title,
  subjectKind: record.subjectKind,
  subjectEmploymentProfileId: record.subjectEmploymentProfileId,
  subjectTalentId: record.subjectTalentId,
  subjectTalentGroupId: record.subjectTalentGroupId,
  status: record.status,
  shiftStartAt: record.shiftStartAt,
  shiftEndAt: record.shiftEndAt,
  createdAt: record.createdAt,
  sourceType: record.sourceType ?? 'MANUAL',
  sourceRosterId: record.sourceRosterId ?? null,
  sourceRosterMonth: record.sourceRosterMonth ?? null,
  sourceRosterLocalDate: record.sourceRosterLocalDate ?? null,
  sourceRosterSlotKey: record.sourceRosterSlotKey ?? null,
});

const toWorkShiftBySubjectItem = (record: WorkShiftRecord) => ({
  id: record.id,
  shiftCode: record.shiftCode,
  title: record.title,
  subjectKind: record.subjectKind,
  status: record.status,
  shiftStartAt: record.shiftStartAt,
  shiftEndAt: record.shiftEndAt,
});

const toWorkShiftByResourceItem = (record: WorkShiftRecord) => ({
  id: record.id,
  shiftCode: record.shiftCode,
  title: record.title,
  status: record.status,
  shiftStartAt: record.shiftStartAt,
  shiftEndAt: record.shiftEndAt,
});

const toWorkShiftDetail = (record: WorkShiftRecord) => ({
  ...toWorkShiftListItem(record),
  studioResourceIds: record.studioResourceIds,
  description: record.description,
  externalRef: record.externalRef,
  updatedAt: record.updatedAt,
  sourcePatternId: record.sourcePatternId ?? null,
  sourceExceptionId: record.sourceExceptionId ?? null,
  sourceGenerationRunId: record.sourceGenerationRunId ?? null,
  sourceDepartmentOrgUnitId: record.sourceDepartmentOrgUnitId ?? null,
});

const toEventListItem = (record: EventRecord) => ({
  id: record.id,
  eventCode: record.eventCode,
  title: record.title,
  status: record.status,
  eventStartAt: record.eventStartAt,
  eventEndAt: record.eventEndAt,
  createdAt: record.createdAt,
});

const toEventRelatedItem = (record: EventRecord) => ({
  id: record.id,
  eventCode: record.eventCode,
  title: record.title,
  status: record.status,
  eventStartAt: record.eventStartAt,
  eventEndAt: record.eventEndAt,
});

const toEventDetail = (record: EventRecord) => ({
  ...toEventListItem(record),
  studioResourceIds: record.studioResourceIds,
  platformAccountIds: record.platformAccountIds,
  description: record.description,
  externalRef: record.externalRef,
  updatedAt: record.updatedAt,
});

const sortWorkShifts = (
  records: WorkShiftRecord[],
  sortBy: string | null,
  sortDirection: string | null,
): WorkShiftRecord[] => {
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...records].sort((left, right) => {
    const readValue = (record: WorkShiftRecord): string | number => {
      switch (sortBy) {
        case 'createdAt':
          return record.createdAt;
        case 'shiftCode':
          return record.shiftCode;
        case 'shiftStartAt':
        default:
          return record.shiftStartAt;
      }
    };
    const leftValue = readValue(left);
    const rightValue = readValue(right);
    if (leftValue < rightValue) {
      return -1 * direction;
    }
    if (leftValue > rightValue) {
      return 1 * direction;
    }
    return left.id.localeCompare(right.id);
  });
};

const sortEvents = (
  records: EventRecord[],
  sortBy: string | null,
  sortDirection: string | null,
): EventRecord[] => {
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...records].sort((left, right) => {
    const readValue = (record: EventRecord): string | number => {
      switch (sortBy) {
        case 'createdAt':
          return record.createdAt;
        case 'eventCode':
          return record.eventCode;
        case 'eventStartAt':
        default:
          return record.eventStartAt;
      }
    };
    const leftValue = readValue(left);
    const rightValue = readValue(right);
    if (leftValue < rightValue) {
      return -1 * direction;
    }
    if (leftValue > rightValue) {
      return 1 * direction;
    }
    return left.id.localeCompare(right.id);
  });
};

const filterWorkShiftRows = (records: WorkShiftRecord[], searchParams: URLSearchParams) => {
  let rows = [...records];
  const status = searchParams.get('status');
  if (!status) {
    rows = rows.filter((item) => item.status !== 'ARCHIVED');
  } else {
    rows = rows.filter((item) => item.status === status);
  }

  const subjectKind = searchParams.get('subjectKind');
  const subjectEmploymentProfileId = searchParams.get('subjectEmploymentProfileId');
  const subjectTalentId = searchParams.get('subjectTalentId');
  const subjectTalentGroupId = searchParams.get('subjectTalentGroupId');
  const containsStudioResourceId = searchParams.get('containsStudioResourceId');
  const studioResourceId = searchParams.get('studioResourceId');
  const sourceType = searchParams.get('sourceType');
  const sourceRosterId = searchParams.get('sourceRosterId');
  const sourceDepartmentOrgUnitId = searchParams.get('sourceDepartmentOrgUnitId');
  const sourceRosterMonth = searchParams.get('sourceRosterMonth');
  const windowStartAt = parsePositiveInt(searchParams.get('windowStartAt'));
  const windowEndAt = parsePositiveInt(searchParams.get('windowEndAt'));
  const search = searchParams.get('search');

  if (subjectKind) {
    rows = rows.filter((item) => item.subjectKind === subjectKind);
  }
  if (subjectEmploymentProfileId) {
    rows = rows.filter((item) => item.subjectEmploymentProfileId === subjectEmploymentProfileId);
  }
  if (subjectTalentId) {
    rows = rows.filter((item) => item.subjectTalentId === subjectTalentId);
  }
  if (subjectTalentGroupId) {
    rows = rows.filter((item) => item.subjectTalentGroupId === subjectTalentGroupId);
  }
  if (containsStudioResourceId) {
    rows = rows.filter((item) => item.studioResourceIds.includes(containsStudioResourceId));
  }
  if (studioResourceId) {
    rows = rows.filter((item) => item.studioResourceIds.includes(studioResourceId));
  }
  if (sourceType) {
    rows = rows.filter((item) => (item.sourceType ?? 'MANUAL') === sourceType);
  }
  if (sourceRosterId) {
    rows = rows.filter((item) => item.sourceRosterId === sourceRosterId);
  }
  if (sourceDepartmentOrgUnitId) {
    rows = rows.filter((item) => item.sourceDepartmentOrgUnitId === sourceDepartmentOrgUnitId);
  }
  if (sourceRosterMonth) {
    rows = rows.filter((item) => item.sourceRosterMonth === sourceRosterMonth);
  }
  if (windowStartAt !== undefined) {
    rows = rows.filter((item) => item.shiftStartAt >= windowStartAt);
  }
  if (windowEndAt !== undefined) {
    rows = rows.filter((item) => item.shiftEndAt <= windowEndAt);
  }
  if (search) {
    rows = rows.filter(
      (item) => toPrefixMatch(item.shiftCode, search) || toPrefixMatch(item.title, search),
    );
  }

  return sortWorkShifts(rows, searchParams.get('sortBy'), searchParams.get('sortDirection'));
};

const filterWorkPatternRows = (records: WorkPatternRecord[], searchParams: URLSearchParams) => {
  let rows = [...records].sort(
    (left, right) =>
      left.createdAt - right.createdAt || left.workPatternId.localeCompare(right.workPatternId),
  );
  const status = searchParams.get('status');

  if (!status) {
    rows = rows.filter((item) => item.status !== 'ARCHIVED');
  } else if (isWorkPatternStatus(status)) {
    rows = rows.filter((item) => item.status === status);
  }

  const search = searchParams.get('search');
  if (search) {
    rows = rows.filter(
      (item) => toPrefixMatch(item.patternCode, search) || toPrefixMatch(item.name, search),
    );
  }

  return rows;
};

const filterHolidayCalendarRows = (
  records: HolidayCalendarRecord[],
  searchParams: URLSearchParams,
) => {
  let rows = [...records].sort(
    (left, right) =>
      left.createdAt - right.createdAt ||
      left.holidayCalendarId.localeCompare(right.holidayCalendarId),
  );
  const status = searchParams.get('status');

  if (!status) {
    rows = rows.filter((item) => item.status !== 'ARCHIVED');
  } else if (isHolidayCalendarStatus(status)) {
    rows = rows.filter((item) => item.status === status);
  }

  const search = searchParams.get('search');
  if (search) {
    rows = rows.filter(
      (item) => toPrefixMatch(item.calendarCode, search) || toPrefixMatch(item.name, search),
    );
  }

  return rows;
};

const filterMonthlyRosterRows = (records: MonthlyRosterRecord[], searchParams: URLSearchParams) => {
  let rows = [...records].sort(
    (left, right) =>
      left.createdAt - right.createdAt || left.monthlyRosterId.localeCompare(right.monthlyRosterId),
  );
  const status = searchParams.get('status');

  if (!status) {
    rows = rows.filter((item) => item.status !== 'ARCHIVED');
  } else if (isMonthlyRosterStatus(status)) {
    rows = rows.filter((item) => item.status === status);
  }

  const rosterMonth = searchParams.get('rosterMonth');
  const departmentOrgUnitId = searchParams.get('departmentOrgUnitId');
  const workPatternId = searchParams.get('workPatternId');
  const holidayCalendarId = searchParams.get('holidayCalendarId');
  const search = searchParams.get('search');

  if (rosterMonth) {
    rows = rows.filter((item) => item.rosterMonth === rosterMonth);
  }
  if (departmentOrgUnitId) {
    rows = rows.filter((item) => item.departmentOrgUnitId === departmentOrgUnitId);
  }
  if (workPatternId) {
    rows = rows.filter((item) => item.workPatternId === workPatternId);
  }
  if (holidayCalendarId) {
    rows = rows.filter((item) => item.holidayCalendarId === holidayCalendarId);
  }
  if (search) {
    rows = rows.filter((item) => toPrefixMatch(item.rosterCode, search));
  }

  return rows;
};

const toMonthlyRosterListItem = (record: MonthlyRosterRecord) => ({
  monthlyRosterId: record.monthlyRosterId,
  rosterCode: record.rosterCode,
  rosterMonth: record.rosterMonth,
  timezone: record.timezone,
  targetSubjectKind: record.targetSubjectKind,
  targetOrgUnitMode: record.targetOrgUnitMode,
  departmentOrgUnitId: record.departmentOrgUnitId,
  workPatternId: record.workPatternId,
  holidayCalendarId: record.holidayCalendarId,
  status: record.status,
  draftVersion: record.draftVersion,
  exceptionCount: record.exceptionCount,
  description: record.description,
  externalRef: record.externalRef,
  archivedAt: record.archivedAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const previewTimestamp = (date: string, hour: number): number =>
  Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00.000+07:00`);

const createPreviewRow = (
  record: MonthlyRosterRecord,
  row: Partial<MonthlyRosterPreviewRowRecord> & {
    previewRowId: string;
    subjectEmploymentProfileId: string;
    localDate: string;
    rowKind: MonthlyRosterPreviewRowKind;
  },
): MonthlyRosterPreviewRowRecord => ({
  monthlyRosterId: record.monthlyRosterId,
  rosterMonth: record.rosterMonth,
  departmentOrgUnitId: record.departmentOrgUnitId,
  sourceExceptionId: null,
  sourceRosterSlotKey: row.rowKind === 'STANDARD' ? 'STANDARD' : null,
  startLocalTime: row.isSuppressed ? null : '09:00',
  endLocalTime: row.isSuppressed ? null : '18:00',
  shiftStartAt: row.isSuppressed ? null : previewTimestamp(row.localDate, 9),
  shiftEndAt: row.isSuppressed ? null : previewTimestamp(row.localDate, 18),
  workingMinutes: row.isSuppressed ? null : 480,
  breakMinutes: row.isSuppressed ? null : 60,
  holidayCalendarEntryId: null,
  holidayName: null,
  holidayEntryType: null,
  isCandidateShift: !row.isSuppressed,
  isSuppressed: row.isSuppressed ?? false,
  conflicts: [],
  warnings: [],
  blockers: [],
  ...row,
});

const createCandidateConflict = (
  row: MonthlyRosterPreviewRowRecord,
  relatedPreviewRowId: string,
): MonthlyRosterPreviewConflictRecord => ({
  conflictKind: 'CANDIDATE_SUBJECT_OVERLAP',
  workShiftId: null,
  relatedPreviewRowId,
  shiftCode: null,
  title: 'Overlapping preview candidate',
  status: null,
  shiftStartAt: row.shiftStartAt ?? previewTimestamp(row.localDate, 9),
  shiftEndAt: row.shiftEndAt ?? previewTimestamp(row.localDate, 18),
  sourceType: null,
  sourceRosterId: null,
  sourceRosterMonth: null,
  sourceRosterLocalDate: null,
  sourceRosterSlotKey: null,
});

const buildMonthlyRosterPreview = (record: MonthlyRosterRecord) => {
  const standardRow = createPreviewRow(record, {
    previewRowId: `${record.monthlyRosterId}:ep-001:2026-05-05:STANDARD`,
    subjectEmploymentProfileId: 'ep-001',
    localDate: '2026-05-05',
    rowKind: 'STANDARD',
  });
  const holidayRow = createPreviewRow(record, {
    previewRowId: `${record.monthlyRosterId}:ep-001:2026-05-01:HOLIDAY`,
    subjectEmploymentProfileId: 'ep-001',
    localDate: '2026-05-01',
    rowKind: 'HOLIDAY_SUPPRESSED',
    holidayCalendarEntryId: 'holiday-entry-001',
    holidayName: 'Company holiday',
    holidayEntryType: 'HOLIDAY',
    isCandidateShift: false,
    isSuppressed: true,
  });
  const offRow = createPreviewRow(record, {
    previewRowId: `${record.monthlyRosterId}:ep-001:2026-05-12:WORKING_TO_OFF`,
    subjectEmploymentProfileId: 'ep-001',
    localDate: '2026-05-12',
    rowKind: 'WORKING_TO_OFF',
    sourceExceptionId: 'roster-exception-001',
    isCandidateShift: false,
    isSuppressed: true,
  });
  const changeRow = createPreviewRow(record, {
    previewRowId: `${record.monthlyRosterId}:ep-001:2026-05-13:CHANGE_TIME`,
    subjectEmploymentProfileId: 'ep-001',
    localDate: '2026-05-13',
    rowKind: 'CHANGE_TIME',
    sourceExceptionId: 'roster-exception-change',
    startLocalTime: '10:00',
    endLocalTime: '19:00',
    shiftStartAt: previewTimestamp('2026-05-13', 10),
    shiftEndAt: previewTimestamp('2026-05-13', 19),
  });
  changeRow.conflicts = [
    {
      conflictKind: 'SUBJECT_OVERLAP',
      workShiftId: 'work-shift-001',
      relatedPreviewRowId: null,
      shiftCode: 'SHIFT001',
      title: 'Existing active shift',
      status: 'ACTIVE',
      shiftStartAt: previewTimestamp('2026-05-13', 11),
      shiftEndAt: previewTimestamp('2026-05-13', 12),
      sourceType: 'MANUAL',
      sourceRosterId: null,
      sourceRosterMonth: null,
      sourceRosterLocalDate: null,
      sourceRosterSlotKey: null,
    },
  ];
  changeRow.blockers = ['SUBJECT_OVERLAP'];

  const specialRow = createPreviewRow(record, {
    previewRowId: `${record.monthlyRosterId}:ep-002:2026-05-20:ADD_SPECIAL_SHIFT:1`,
    subjectEmploymentProfileId: 'ep-002',
    localDate: '2026-05-20',
    rowKind: 'ADD_SPECIAL_SHIFT',
    sourceExceptionId: 'roster-exception-special',
    sourceRosterSlotKey: 'ADD_SPECIAL_SHIFT:roster-exception-special',
    startLocalTime: '13:00',
    endLocalTime: '16:00',
    shiftStartAt: previewTimestamp('2026-05-20', 13),
    shiftEndAt: previewTimestamp('2026-05-20', 16),
    workingMinutes: 120,
    breakMinutes: 60,
  });
  const overlappingSpecialRow = createPreviewRow(record, {
    previewRowId: `${record.monthlyRosterId}:ep-002:2026-05-20:ADD_SPECIAL_SHIFT:2`,
    subjectEmploymentProfileId: 'ep-002',
    localDate: '2026-05-20',
    rowKind: 'ADD_SPECIAL_SHIFT',
    sourceExceptionId: 'roster-exception-special-2',
    sourceRosterSlotKey: 'ADD_SPECIAL_SHIFT:roster-exception-special-2',
    startLocalTime: '14:00',
    endLocalTime: '17:00',
    shiftStartAt: previewTimestamp('2026-05-20', 14),
    shiftEndAt: previewTimestamp('2026-05-20', 17),
    workingMinutes: 120,
    breakMinutes: 60,
  });
  specialRow.conflicts = [createCandidateConflict(specialRow, overlappingSpecialRow.previewRowId)];
  overlappingSpecialRow.conflicts = [
    createCandidateConflict(overlappingSpecialRow, specialRow.previewRowId),
  ];
  specialRow.blockers = ['SUBJECT_OVERLAP'];
  overlappingSpecialRow.blockers = ['SUBJECT_OVERLAP'];

  const rows = [standardRow, holidayRow, offRow, changeRow, specialRow, overlappingSpecialRow];

  return {
    monthlyRosterId: record.monthlyRosterId,
    rosterMonth: record.rosterMonth,
    timezone: record.timezone,
    departmentOrgUnitId: record.departmentOrgUnitId,
    workPatternId: record.workPatternId,
    holidayCalendarId: record.holidayCalendarId,
    rosterStatus: record.status,
    draftVersion: record.draftVersion,
    currentPreviewHash: record.previewHash,
    computedPreviewHash: `computed-${record.monthlyRosterId}-${record.draftVersion}`,
    eligibleProfiles: [
      {
        subjectEmploymentProfileId: 'ep-001',
        employmentStatus: 'ACTIVE',
        departmentOrgUnitId: record.departmentOrgUnitId,
      },
      {
        subjectEmploymentProfileId: 'ep-002',
        employmentStatus: 'ACTIVE',
        departmentOrgUnitId: record.departmentOrgUnitId,
      },
    ],
    rows,
    summary: {
      totalEligibleProfiles: 2,
      totalStandardCandidateShifts: 2,
      totalHolidaySuppressions: rows.filter((row) => row.rowKind === 'HOLIDAY_SUPPRESSED').length,
      totalWorkingToOff: rows.filter((row) => row.rowKind === 'WORKING_TO_OFF').length,
      totalChangeTime: rows.filter((row) => row.rowKind === 'CHANGE_TIME').length,
      totalAddSpecialShift: rows.filter((row) => row.rowKind === 'ADD_SPECIAL_SHIFT').length,
      totalCandidateShiftsAfterExceptions: rows.filter((row) => row.isCandidateShift).length,
      totalConflicts: rows.reduce((total, row) => total + row.conflicts.length, 0),
    },
  };
};

const rosterExceptionBodyKeys = [
  'exceptionType',
  'exceptionDate',
  'subjectEmploymentProfileId',
  'title',
  'startLocalTime',
  'workingMinutes',
  'breakMinutes',
  'studioResourceIds',
  'reason',
  'sourceNote',
  'description',
  'externalRef',
  'scope',
];

const validateRosterExceptionBody = (body: Record<string, unknown>) => {
  if (!hasOnlyKeys(body, rosterExceptionBodyKeys)) {
    return 'errors:validation.unsupportedPayload';
  }
  if (body.scope !== undefined && !isMonthlyRosterScope(body.scope)) {
    return 'work-schedule:rosters.validation.invalidScope';
  }
  if (!isRosterExceptionType(body.exceptionType)) {
    return 'work-schedule:monthlyRosters.exceptions.validation.invalidType';
  }
  if (!toNullableText(body.exceptionDate) || !toNullableText(body.subjectEmploymentProfileId)) {
    return 'work-schedule:monthlyRosters.exceptions.validation.required';
  }
  if (body.exceptionType === 'WORKING_TO_OFF') {
    const unsupported =
      body.title !== undefined ||
      body.startLocalTime !== undefined ||
      body.workingMinutes !== undefined ||
      body.breakMinutes !== undefined ||
      body.studioResourceIds !== undefined;
    return unsupported ? 'errors:validation.unsupportedPayload' : undefined;
  }
  if (body.exceptionType === 'CHANGE_TIME') {
    return toNullableText(body.startLocalTime)
      ? undefined
      : 'work-schedule:monthlyRosters.exceptions.validation.required';
  }
  return toNullableText(body.title) &&
    toNullableText(body.startLocalTime) &&
    Number.isInteger(body.workingMinutes) &&
    Number(body.workingMinutes) > 0 &&
    Number.isInteger(body.breakMinutes) &&
    Number(body.breakMinutes) >= 0
    ? undefined
    : 'work-schedule:monthlyRosters.exceptions.validation.required';
};

const upsertRosterExceptionFromBody = (
  record: MonthlyRosterRecord,
  body: Record<string, unknown>,
  rosterExceptionId: string,
  current?: RosterExceptionRecord,
): RosterExceptionRecord => {
  const now = Date.now();
  const exceptionType = body.exceptionType as RosterExceptionType;
  const exception: RosterExceptionRecord = {
    rosterExceptionId,
    monthlyRosterId: record.monthlyRosterId,
    exceptionType,
    exceptionDate: toNullableText(body.exceptionDate) ?? record.rosterMonth + '-01',
    subjectEmploymentProfileId: toNullableText(body.subjectEmploymentProfileId) ?? 'ep-001',
    status: 'ACTIVE',
    title: exceptionType === 'ADD_SPECIAL_SHIFT' ? toNullableText(body.title) : null,
    startLocalTime:
      exceptionType === 'CHANGE_TIME' || exceptionType === 'ADD_SPECIAL_SHIFT'
        ? toNullableText(body.startLocalTime)
        : null,
    endLocalTime:
      exceptionType === 'CHANGE_TIME' || exceptionType === 'ADD_SPECIAL_SHIFT' ? '18:00' : null,
    workingMinutes: exceptionType === 'ADD_SPECIAL_SHIFT' ? Number(body.workingMinutes) : null,
    breakMinutes: exceptionType === 'ADD_SPECIAL_SHIFT' ? Number(body.breakMinutes) : null,
    studioResourceIds:
      exceptionType === 'ADD_SPECIAL_SHIFT' ? (toStringArray(body.studioResourceIds) ?? []) : [],
    reason: toNullableText(body.reason),
    sourceNote: toNullableText(body.sourceNote),
    description: toNullableText(body.description),
    externalRef: toNullableText(body.externalRef),
    removedAt: null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };

  return exception;
};

const filterEventRows = (records: EventRecord[], searchParams: URLSearchParams) => {
  let rows = [...records];
  const status = searchParams.get('status');
  if (!status) {
    rows = rows.filter((item) => item.status !== 'ARCHIVED');
  } else {
    rows = rows.filter((item) => item.status === status);
  }

  const assignmentKind = searchParams.get('assignmentKind');
  const assignmentEmploymentProfileId = searchParams.get('assignmentEmploymentProfileId');
  const assignmentTalentId = searchParams.get('assignmentTalentId');
  const assignmentTalentGroupId = searchParams.get('assignmentTalentGroupId');
  const containsStudioResourceId = searchParams.get('containsStudioResourceId');
  const containsPlatformAccountId = searchParams.get('containsPlatformAccountId');
  const studioResourceId = searchParams.get('studioResourceId');
  const platformAccountId = searchParams.get('platformAccountId');
  const windowStartAt = parsePositiveInt(searchParams.get('windowStartAt'));
  const windowEndAt = parsePositiveInt(searchParams.get('windowEndAt'));
  const search = searchParams.get('search');

  if (
    assignmentKind ||
    assignmentEmploymentProfileId ||
    assignmentTalentId ||
    assignmentTalentGroupId
  ) {
    const eventIds = new Set(
      assignments
        .filter((assignment) => {
          if (assignmentKind && assignment.assignmentKind !== assignmentKind) {
            return false;
          }
          if (
            assignmentEmploymentProfileId &&
            assignment.assignmentEmploymentProfileId !== assignmentEmploymentProfileId
          ) {
            return false;
          }
          if (assignmentTalentId && assignment.assignmentTalentId !== assignmentTalentId) {
            return false;
          }
          if (
            assignmentTalentGroupId &&
            assignment.assignmentTalentGroupId !== assignmentTalentGroupId
          ) {
            return false;
          }
          return true;
        })
        .map((assignment) => assignment.eventId),
    );
    rows = rows.filter((item) => eventIds.has(item.id));
  }
  if (containsStudioResourceId) {
    rows = rows.filter((item) => item.studioResourceIds.includes(containsStudioResourceId));
  }
  if (studioResourceId) {
    rows = rows.filter((item) => item.studioResourceIds.includes(studioResourceId));
  }
  if (containsPlatformAccountId) {
    rows = rows.filter((item) => item.platformAccountIds.includes(containsPlatformAccountId));
  }
  if (platformAccountId) {
    rows = rows.filter((item) => item.platformAccountIds.includes(platformAccountId));
  }
  if (windowStartAt !== undefined) {
    rows = rows.filter((item) => item.eventStartAt >= windowStartAt);
  }
  if (windowEndAt !== undefined) {
    rows = rows.filter((item) => item.eventEndAt <= windowEndAt);
  }
  if (search) {
    rows = rows.filter(
      (item) =>
        normalizeText(item.eventCode) === normalizeText(search) ||
        toPrefixMatch(item.title, search),
    );
  }

  return sortEvents(rows, searchParams.get('sortBy'), searchParams.get('sortDirection'));
};

const createEventAssignments = (
  eventId: string,
  inputs: NonNullable<ReturnType<typeof readAssignmentInputs>>,
): void => {
  assignments = assignments.filter((assignment) => assignment.eventId !== eventId);
  inputs.forEach((input) => {
    assignmentSeed += 1;
    assignments.push({
      id: `assignment-${assignmentSeed}`,
      eventId,
      assignmentKind: input?.assignmentKind ?? 'EMPLOYMENT_PROFILE',
      assignmentEmploymentProfileId: input?.assignmentEmploymentProfileId ?? null,
      assignmentTalentId: input?.assignmentTalentId ?? null,
      assignmentTalentGroupId: input?.assignmentTalentGroupId ?? null,
      assignmentStatus: 'ACTIVE',
      createdAt: Date.now(),
    });
  });
};

const workFlatKeys = [
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
  'limit',
  'cursor',
  'search',
  'sortBy',
  'sortDirection',
  'scope',
];
const workBySubjectKeys = [
  'subjectKind',
  'subjectEmploymentProfileId',
  'subjectTalentId',
  'subjectTalentGroupId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
  'scope',
];
const workByResourceKeys = [
  'studioResourceId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
  'scope',
];
const workPatternListKeys = ['status', 'limit', 'cursor', 'search'];
const holidayCalendarListKeys = ['status', 'limit', 'cursor', 'search'];
const monthlyRosterListKeys = [
  'status',
  'rosterMonth',
  'departmentOrgUnitId',
  'workPatternId',
  'holidayCalendarId',
  'limit',
  'cursor',
  'search',
  'scope',
];
const eventFlatKeys = [
  'status',
  'assignmentKind',
  'assignmentEmploymentProfileId',
  'assignmentTalentId',
  'assignmentTalentGroupId',
  'containsStudioResourceId',
  'containsPlatformAccountId',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'search',
  'sortBy',
  'sortDirection',
];
const eventByAssignmentKeys = [
  'assignmentKind',
  'assignmentEmploymentProfileId',
  'assignmentTalentId',
  'assignmentTalentGroupId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
];
const eventByResourceKeys = [
  'studioResourceId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
];
const eventByPlatformKeys = [
  'platformAccountId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
];

export const wave6Handlers = [
  http.get('*/admin/work-schedule/holiday-calendars', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure = rejectUnsupportedQuery(url.searchParams, holidayCalendarListKeys);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterHolidayCalendarRows(holidayCalendars, url.searchParams);
    return HttpResponse.json(paginate(rows, url.searchParams));
  }),

  http.post('*/admin/work-schedule/holiday-calendars', async ({ request }) => {
    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, [
      'calendarCode',
      'name',
      'scopeType',
      'timezone',
      'description',
      'externalRef',
    ]);
    if (bodyFailure) {
      return bodyFailure;
    }

    const requestedCalendarCode = toNullableText(body.calendarCode);
    const name = toNullableText(body.name);
    if (!name || body.scopeType !== 'GLOBAL' || body.timezone !== 'Asia/Ho_Chi_Minh') {
      return HttpResponse.json(
        { message: 'work-schedule:holidayCalendars.validation.required' },
        { status: 422 },
      );
    }

    if (
      requestedCalendarCode &&
      holidayCalendars.some((item) => item.calendarCode === requestedCalendarCode)
    ) {
      return HttpResponse.json(
        { message: 'work-schedule:holidayCalendars.validation.duplicate' },
        { status: 409 },
      );
    }

    holidayCalendarSeed += 1;
    const calendarCode =
      requestedCalendarCode ?? `HC-${String(holidayCalendarSeed).padStart(6, '0')}`;
    const record: HolidayCalendarRecord = {
      holidayCalendarId: `holiday-calendar-${holidayCalendarSeed}`,
      calendarCode,
      name,
      scopeType: 'GLOBAL',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'DRAFT',
      entries: [],
      description: toNullableText(body.description),
      externalRef: toNullableText(body.externalRef),
      activatedAt: null,
      archivedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    holidayCalendars.unshift(record);
    return HttpResponse.json({ data: record });
  }),

  http.get('*/admin/work-schedule/holiday-calendars/:holidayCalendarId', ({ params }) => {
    const record = readHolidayCalendar(String(params.holidayCalendarId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    return HttpResponse.json({ data: record });
  }),

  http.patch(
    '*/admin/work-schedule/holiday-calendars/:holidayCalendarId',
    async ({ params, request }) => {
      const record = readHolidayCalendar(String(params.holidayCalendarId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status === 'ARCHIVED') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }

      const body = await parseJsonBody(request);
      const bodyFailure = rejectUnsupportedBody(body, ['name', 'description', 'externalRef']);
      if (bodyFailure) {
        return bodyFailure;
      }

      const name = toNullableText(body.name);
      if (!name) {
        return HttpResponse.json(
          { message: 'work-schedule:holidayCalendars.validation.required' },
          { status: 422 },
        );
      }
      record.name = name;
      record.description = toNullableText(body.description);
      record.externalRef = toNullableText(body.externalRef);
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),

  http.post('*/admin/work-schedule/holiday-calendars/:holidayCalendarId/activate', ({ params }) => {
    const record = readHolidayCalendar(String(params.holidayCalendarId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status !== 'DRAFT') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }
    record.status = 'ACTIVE';
    record.activatedAt = Date.now();
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: record });
  }),

  http.post('*/admin/work-schedule/holiday-calendars/:holidayCalendarId/archive', ({ params }) => {
    const record = readHolidayCalendar(String(params.holidayCalendarId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status === 'ARCHIVED') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }
    record.status = 'ARCHIVED';
    record.archivedAt = Date.now();
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: record });
  }),

  http.post(
    '*/admin/work-schedule/holiday-calendars/:holidayCalendarId/entries',
    async ({ params, request }) => {
      const record = readHolidayCalendar(String(params.holidayCalendarId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status === 'ARCHIVED') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }
      const body = await parseJsonBody(request);
      const bodyFailure = rejectUnsupportedBody(body, [
        'date',
        'entryType',
        'name',
        'description',
        'externalRef',
      ]);
      const date = toNullableText(body.date);
      const name = toNullableText(body.name);
      if (bodyFailure || !date || !name || !isHolidayCalendarEntryType(body.entryType)) {
        return (
          bodyFailure ??
          HttpResponse.json(
            { message: 'work-schedule:holidayCalendars.validation.required' },
            { status: 422 },
          )
        );
      }
      if (record.entries.some((entry) => entry.status === 'ACTIVE' && entry.date === date)) {
        return HttpResponse.json(
          { message: 'work-schedule:holidayCalendars.validation.duplicateDate' },
          { status: 409 },
        );
      }
      holidayCalendarEntrySeed += 1;
      record.entries.push({
        holidayCalendarEntryId: `holiday-entry-${holidayCalendarEntrySeed}`,
        date,
        entryType: body.entryType,
        name,
        status: 'ACTIVE',
        description: toNullableText(body.description),
        externalRef: toNullableText(body.externalRef),
        removedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),

  http.patch(
    '*/admin/work-schedule/holiday-calendars/:holidayCalendarId/entries/:holidayCalendarEntryId',
    async ({ params, request }) => {
      const record = readHolidayCalendar(String(params.holidayCalendarId));
      const entry = record?.entries.find(
        (item) => item.holidayCalendarEntryId === String(params.holidayCalendarEntryId),
      );
      if (!record || !entry) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status === 'ARCHIVED' || entry.status === 'REMOVED') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }
      const body = await parseJsonBody(request);
      const bodyFailure = rejectUnsupportedBody(body, [
        'date',
        'entryType',
        'name',
        'description',
        'externalRef',
      ]);
      const date = toNullableText(body.date);
      const name = toNullableText(body.name);
      if (bodyFailure || !date || !name || !isHolidayCalendarEntryType(body.entryType)) {
        return (
          bodyFailure ??
          HttpResponse.json(
            { message: 'work-schedule:holidayCalendars.validation.required' },
            { status: 422 },
          )
        );
      }
      if (
        record.entries.some(
          (item) =>
            item.holidayCalendarEntryId !== entry.holidayCalendarEntryId &&
            item.status === 'ACTIVE' &&
            item.date === date,
        )
      ) {
        return HttpResponse.json(
          { message: 'work-schedule:holidayCalendars.validation.duplicateDate' },
          { status: 409 },
        );
      }
      entry.date = date;
      entry.entryType = body.entryType;
      entry.name = name;
      entry.description = toNullableText(body.description);
      entry.externalRef = toNullableText(body.externalRef);
      entry.updatedAt = Date.now();
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),

  http.post(
    '*/admin/work-schedule/holiday-calendars/:holidayCalendarId/entries/:holidayCalendarEntryId/remove',
    ({ params }) => {
      const record = readHolidayCalendar(String(params.holidayCalendarId));
      const entry = record?.entries.find(
        (item) => item.holidayCalendarEntryId === String(params.holidayCalendarEntryId),
      );
      if (!record || !entry) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status === 'ARCHIVED' || entry.status !== 'ACTIVE') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }
      entry.status = 'REMOVED';
      entry.removedAt = Date.now();
      entry.updatedAt = Date.now();
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),

  http.get('*/admin/work-schedule/rosters', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure = rejectUnsupportedQuery(url.searchParams, monthlyRosterListKeys);
    if (queryFailure) {
      return queryFailure;
    }
    const scope = url.searchParams.get('scope');
    if (scope && !isMonthlyRosterScope(scope)) {
      return HttpResponse.json(
        { message: 'work-schedule:rosters.validation.invalidScope' },
        { status: 422 },
      );
    }
    const rows = filterMonthlyRosterRows(monthlyRosters, url.searchParams);
    return HttpResponse.json(paginate(rows.map(toMonthlyRosterListItem), url.searchParams));
  }),

  http.post('*/admin/work-schedule/rosters', async ({ request }) => {
    const body = await parseJsonBody(request);
    if (
      !hasOnlyKeys(body, [
        'rosterCode',
        'rosterMonth',
        'timezone',
        'departmentOrgUnitId',
        'workPatternId',
        'holidayCalendarId',
        'description',
        'externalRef',
        'scope',
      ])
    ) {
      return HttpResponse.json(
        { message: 'errors:validation.unsupportedPayload' },
        { status: 422 },
      );
    }
    if (body.scope !== undefined && !isMonthlyRosterScope(body.scope)) {
      return HttpResponse.json(
        { message: 'work-schedule:rosters.validation.invalidScope' },
        { status: 422 },
      );
    }
    const requestedRosterCode = toNullableText(body.rosterCode);
    const rosterMonth = toNullableText(body.rosterMonth);
    const departmentOrgUnitId = toNullableText(body.departmentOrgUnitId);
    const workPatternId = toNullableText(body.workPatternId);
    const holidayCalendarId = toNullableText(body.holidayCalendarId);
    if (
      !rosterMonth ||
      !departmentOrgUnitId ||
      !workPatternId ||
      !holidayCalendarId ||
      body.timezone !== 'Asia/Ho_Chi_Minh'
    ) {
      return HttpResponse.json(
        { message: 'work-schedule:rosters.validation.required' },
        { status: 422 },
      );
    }
    if (
      monthlyRosters.some(
        (item) =>
          item.departmentOrgUnitId === departmentOrgUnitId &&
          item.rosterMonth === rosterMonth &&
          item.status !== 'ARCHIVED',
      )
    ) {
      return HttpResponse.json(
        { message: 'work-schedule:rosters.validation.duplicateDepartmentMonth' },
        { status: 409 },
      );
    }
    monthlyRosterSeed += 1;
    const rosterCode =
      requestedRosterCode ??
      `MR-${rosterMonth.replace('-', '')}-${String(monthlyRosterSeed).padStart(6, '0')}`;
    const record: MonthlyRosterRecord = {
      monthlyRosterId: `roster-${monthlyRosterSeed}`,
      rosterCode,
      rosterMonth,
      timezone: 'Asia/Ho_Chi_Minh',
      targetSubjectKind: 'EMPLOYMENT_PROFILE',
      targetOrgUnitMode: 'EXACT_ONLY',
      departmentOrgUnitId,
      workPatternId,
      holidayCalendarId,
      status: 'DRAFT',
      draftVersion: 1,
      exceptionCount: 0,
      description: toNullableText(body.description),
      externalRef: toNullableText(body.externalRef),
      archivedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      previewHash: null,
      lastPreviewedAt: null,
      publishedAt: null,
      publishedByUserId: null,
      publishGenerationRunId: null,
      exceptions: [],
    };
    monthlyRosters.unshift(record);
    return HttpResponse.json({ data: record });
  }),

  http.get('*/admin/work-schedule/rosters/:monthlyRosterId/preview', ({ params, request }) => {
    const scope = new URL(request.url).searchParams.get('scope');
    if (scope && !isMonthlyRosterScope(scope)) {
      return HttpResponse.json(
        { message: 'work-schedule:rosters.validation.invalidScope' },
        { status: 422 },
      );
    }
    const record = readMonthlyRoster(String(params.monthlyRosterId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status === 'ARCHIVED') {
      return HttpResponse.json(
        { message: 'work-schedule:monthlyRosters.preview.states.archivedUnavailable' },
        { status: 422 },
      );
    }
    return HttpResponse.json({ data: buildMonthlyRosterPreview(record) });
  }),

  http.get('*/admin/work-schedule/rosters/:monthlyRosterId', ({ params, request }) => {
    const scope = new URL(request.url).searchParams.get('scope');
    if (scope && !isMonthlyRosterScope(scope)) {
      return HttpResponse.json(
        { message: 'work-schedule:rosters.validation.invalidScope' },
        { status: 422 },
      );
    }
    const record = readMonthlyRoster(String(params.monthlyRosterId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    return HttpResponse.json({ data: record });
  }),

  http.patch('*/admin/work-schedule/rosters/:monthlyRosterId', async ({ params, request }) => {
    const record = readMonthlyRoster(String(params.monthlyRosterId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status !== 'DRAFT') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }
    const body = await parseJsonBody(request);
    if (
      !hasOnlyKeys(body, [
        'rosterMonth',
        'timezone',
        'departmentOrgUnitId',
        'workPatternId',
        'holidayCalendarId',
        'description',
        'externalRef',
        'scope',
      ])
    ) {
      return HttpResponse.json(
        { message: 'errors:validation.unsupportedPayload' },
        { status: 422 },
      );
    }
    if (body.scope !== undefined && !isMonthlyRosterScope(body.scope)) {
      return HttpResponse.json(
        { message: 'work-schedule:rosters.validation.invalidScope' },
        { status: 422 },
      );
    }
    const structuralChange =
      body.rosterMonth !== undefined ||
      body.departmentOrgUnitId !== undefined ||
      body.workPatternId !== undefined ||
      body.holidayCalendarId !== undefined;
    if (structuralChange && record.exceptions.some((exception) => exception.status === 'ACTIVE')) {
      return HttpResponse.json(
        { message: 'work-schedule:rosters.validation.activeExceptionsStructuralLock' },
        { status: 409 },
      );
    }
    record.rosterMonth = toNullableText(body.rosterMonth) ?? record.rosterMonth;
    record.departmentOrgUnitId =
      toNullableText(body.departmentOrgUnitId) ?? record.departmentOrgUnitId;
    record.workPatternId = toNullableText(body.workPatternId) ?? record.workPatternId;
    record.holidayCalendarId = toNullableText(body.holidayCalendarId) ?? record.holidayCalendarId;
    record.description =
      body.description === undefined ? record.description : toNullableText(body.description);
    record.externalRef =
      body.externalRef === undefined ? record.externalRef : toNullableText(body.externalRef);
    record.draftVersion += 1;
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: record });
  }),

  http.post(
    '*/admin/work-schedule/rosters/:monthlyRosterId/archive',
    async ({ params, request }) => {
      const record = readMonthlyRoster(String(params.monthlyRosterId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status !== 'DRAFT') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }
      const body = await parseJsonBody(request);
      if (!hasOnlyKeys(body, ['scope'])) {
        return HttpResponse.json(
          { message: 'errors:validation.unsupportedPayload' },
          { status: 422 },
        );
      }
      if (body.scope !== undefined && !isMonthlyRosterScope(body.scope)) {
        return HttpResponse.json(
          { message: 'work-schedule:rosters.validation.invalidScope' },
          { status: 422 },
        );
      }
      record.status = 'ARCHIVED';
      record.archivedAt = Date.now();
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),

  http.post(
    '*/admin/work-schedule/rosters/:monthlyRosterId/publish',
    async ({ params, request }) => {
      const record = readMonthlyRoster(String(params.monthlyRosterId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }

      const body = await parseJsonBody(request);
      if (!hasOnlyKeys(body, ['expectedPreviewHash', 'idempotencyKey', 'note', 'scope'])) {
        return HttpResponse.json(
          { message: 'errors:validation.unsupportedPayload' },
          { status: 422 },
        );
      }
      if (body.scope !== undefined && !isMonthlyRosterScope(body.scope)) {
        return HttpResponse.json(
          { message: 'work-schedule:rosters.validation.invalidScope' },
          { status: 422 },
        );
      }

      if (record.status === 'PUBLISHED') {
        const generated = workShifts.filter(
          (item) =>
            item.sourceType === 'ROSTER_GENERATED' &&
            item.sourceRosterId === record.monthlyRosterId,
        );
        return HttpResponse.json({
          data: {
            monthlyRosterId: record.monthlyRosterId,
            status: record.status,
            sourceGenerationRunId: record.publishGenerationRunId,
            publishedAt: record.publishedAt,
            publishedByUserId: record.publishedByUserId,
            generatedWorkShiftCount: generated.length,
            skippedWorkingToOffCount: record.exceptions.filter(
              (item) => item.status === 'ACTIVE' && item.exceptionType === 'WORKING_TO_OFF',
            ).length,
            holidaySuppressedCount: 0,
            changeTimeCount: generated.filter((item) => item.sourceExceptionId).length,
            addSpecialShiftCount: generated.filter((item) =>
              item.sourceRosterSlotKey?.startsWith('ADD_SPECIAL_SHIFT:'),
            ).length,
            conflictCount: 0,
            computedPreviewHash: record.previewHash,
            generatedWorkShiftIds: generated.map((item) => item.id),
          },
        });
      }

      if (record.status !== 'DRAFT') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }

      const preview = buildMonthlyRosterPreview(record);
      const expectedPreviewHash = toNullableText(body.expectedPreviewHash);
      if (!expectedPreviewHash) {
        return HttpResponse.json(
          { message: 'expectedPreviewHash is required to publish a DRAFT Monthly Roster' },
          { status: 422 },
        );
      }
      if (expectedPreviewHash !== preview.computedPreviewHash) {
        return HttpResponse.json(
          { message: 'expectedPreviewHash does not match the current Monthly Roster preview' },
          { status: 409 },
        );
      }
      if (record.previewHash && record.previewHash !== preview.computedPreviewHash) {
        return HttpResponse.json(
          { message: 'Stored Monthly Roster previewHash is stale; re-preview before publish' },
          { status: 409 },
        );
      }
      const conflictCount = preview.summary.totalConflicts;
      const blockerCount = preview.rows.reduce((total, row) => total + row.blockers.length, 0);
      if (conflictCount > 0 || blockerCount > 0) {
        return HttpResponse.json(
          {
            message:
              'Monthly Roster publish is blocked because current preview has blockers or conflicts',
          },
          { status: 422 },
        );
      }

      const publishableRows = preview.rows.filter((row) => row.isCandidateShift);
      const sourceGenerationRunId = `generation-run-${record.monthlyRosterId}`;
      const generatedWorkShiftIds: string[] = [];
      for (const row of publishableRows) {
        workShiftSeed += 1;
        const workShift: WorkShiftRecord = {
          id: `work-shift-generated-${workShiftSeed}`,
          shiftCode: `SHIFT${workShiftSeed}`,
          title:
            row.rowKind === 'ADD_SPECIAL_SHIFT'
              ? 'Generated extra shift'
              : 'Generated roster shift',
          subjectKind: 'EMPLOYMENT_PROFILE',
          subjectEmploymentProfileId: row.subjectEmploymentProfileId,
          subjectTalentId: null,
          subjectTalentGroupId: null,
          studioResourceIds: [],
          status: 'ACTIVE',
          shiftStartAt: row.shiftStartAt ?? previewTimestamp(row.localDate, 9),
          shiftEndAt: row.shiftEndAt ?? previewTimestamp(row.localDate, 18),
          description: null,
          externalRef: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sourceType: 'ROSTER_GENERATED',
          sourceRosterId: record.monthlyRosterId,
          sourcePatternId: record.workPatternId,
          sourceExceptionId: row.sourceExceptionId,
          sourceGenerationRunId,
          sourceRosterMonth: record.rosterMonth,
          sourceDepartmentOrgUnitId: record.departmentOrgUnitId,
          sourceRosterLocalDate: row.localDate,
          sourceRosterSlotKey: row.sourceRosterSlotKey ?? 'STANDARD',
        };
        workShifts.unshift(workShift);
        generatedWorkShiftIds.push(workShift.id);
      }

      record.status = 'PUBLISHED';
      record.previewHash = preview.computedPreviewHash;
      record.lastPreviewedAt = Date.now();
      record.publishedAt = Date.now();
      record.publishedByUserId = 'user-admin';
      record.publishGenerationRunId = sourceGenerationRunId;
      record.updatedAt = Date.now();

      return HttpResponse.json({
        data: {
          monthlyRosterId: record.monthlyRosterId,
          status: record.status,
          sourceGenerationRunId,
          publishedAt: record.publishedAt,
          publishedByUserId: record.publishedByUserId,
          generatedWorkShiftCount: generatedWorkShiftIds.length,
          skippedWorkingToOffCount: preview.summary.totalWorkingToOff,
          holidaySuppressedCount: preview.summary.totalHolidaySuppressions,
          changeTimeCount: preview.summary.totalChangeTime,
          addSpecialShiftCount: preview.summary.totalAddSpecialShift,
          conflictCount: 0,
          computedPreviewHash: preview.computedPreviewHash,
          generatedWorkShiftIds,
        },
      });
    },
  ),

  http.post(
    '*/admin/work-schedule/rosters/:monthlyRosterId/exceptions',
    async ({ params, request }) => {
      const record = readMonthlyRoster(String(params.monthlyRosterId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status !== 'DRAFT') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }
      const body = await parseJsonBody(request);
      const validationError = validateRosterExceptionBody(body);
      if (validationError) {
        return HttpResponse.json({ message: validationError }, { status: 422 });
      }
      monthlyRosterSeed += 1;
      const exception = upsertRosterExceptionFromBody(
        record,
        body,
        `roster-exception-${monthlyRosterSeed}`,
      );
      record.exceptions.push(exception);
      record.exceptionCount = record.exceptions.filter((item) => item.status === 'ACTIVE').length;
      record.draftVersion += 1;
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),

  http.patch(
    '*/admin/work-schedule/rosters/:monthlyRosterId/exceptions/:rosterExceptionId',
    async ({ params, request }) => {
      const record = readMonthlyRoster(String(params.monthlyRosterId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status !== 'DRAFT') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }
      const index = record.exceptions.findIndex(
        (item) => item.rosterExceptionId === String(params.rosterExceptionId),
      );
      if (index < 0) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.exceptions[index].status !== 'ACTIVE') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }
      const body = await parseJsonBody(request);
      const validationError = validateRosterExceptionBody(body);
      if (validationError) {
        return HttpResponse.json({ message: validationError }, { status: 422 });
      }
      record.exceptions[index] = upsertRosterExceptionFromBody(
        record,
        body,
        String(params.rosterExceptionId),
        record.exceptions[index],
      );
      record.exceptionCount = record.exceptions.filter((item) => item.status === 'ACTIVE').length;
      record.draftVersion += 1;
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),

  http.post(
    '*/admin/work-schedule/rosters/:monthlyRosterId/exceptions/:rosterExceptionId/remove',
    async ({ params, request }) => {
      const record = readMonthlyRoster(String(params.monthlyRosterId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status !== 'DRAFT') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }
      const body = await parseJsonBody(request);
      if (!hasOnlyKeys(body, ['scope'])) {
        return HttpResponse.json(
          { message: 'errors:validation.unsupportedPayload' },
          { status: 422 },
        );
      }
      if (body.scope !== undefined && !isMonthlyRosterScope(body.scope)) {
        return HttpResponse.json(
          { message: 'work-schedule:rosters.validation.invalidScope' },
          { status: 422 },
        );
      }
      const exception = record.exceptions.find(
        (item) => item.rosterExceptionId === String(params.rosterExceptionId),
      );
      if (!exception) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      exception.status = 'REMOVED';
      exception.removedAt = Date.now();
      exception.updatedAt = Date.now();
      record.exceptionCount = record.exceptions.filter((item) => item.status === 'ACTIVE').length;
      record.draftVersion += 1;
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),

  http.get('*/admin/work-schedule/patterns', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure = rejectUnsupportedQuery(url.searchParams, workPatternListKeys);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterWorkPatternRows(workPatterns, url.searchParams);
    return HttpResponse.json(paginate(rows, url.searchParams));
  }),

  http.post('*/admin/work-schedule/patterns', async ({ request }) => {
    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, [
      'patternCode',
      'name',
      'timezone',
      'startLocalTime',
      'workingMinutes',
      'breakMinutes',
      'workingDays',
      'description',
      'externalRef',
    ]);
    if (bodyFailure) {
      return bodyFailure;
    }

    const workingMinutes = Number(body.workingMinutes);
    const breakMinutes = Number(body.breakMinutes);
    const workingDays = readPatternWeekdays(body.workingDays);
    const endLocalTime = calculatePatternEndLocalTime(
      String(body.startLocalTime ?? ''),
      workingMinutes,
      breakMinutes,
    );
    const requestedPatternCode = toNullableText(body.patternCode);
    const name = String(body.name ?? '').trim();

    if (
      !name ||
      body.timezone !== 'Asia/Ho_Chi_Minh' ||
      !Number.isInteger(workingMinutes) ||
      !Number.isInteger(breakMinutes) ||
      !workingDays ||
      !endLocalTime
    ) {
      return HttpResponse.json(
        { message: 'work-schedule:patterns.validation.required' },
        { status: 422 },
      );
    }

    if (
      requestedPatternCode &&
      workPatterns.some((item) => item.patternCode === requestedPatternCode)
    ) {
      return HttpResponse.json({ message: 'errors:conflict.message' }, { status: 409 });
    }

    workPatternSeed += 1;
    const patternCode = requestedPatternCode ?? `WP-${String(workPatternSeed).padStart(6, '0')}`;
    const record: WorkPatternRecord = {
      workPatternId: `pattern-${workPatternSeed}`,
      patternCode,
      name,
      status: 'DRAFT',
      timezone: 'Asia/Ho_Chi_Minh',
      startLocalTime: String(body.startLocalTime),
      endLocalTime,
      workingMinutes,
      breakMinutes,
      workingDays,
      description: toNullableText(body.description),
      externalRef: toNullableText(body.externalRef),
      activatedAt: null,
      archivedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    workPatterns.push(record);

    return HttpResponse.json({ data: record });
  }),

  http.get('*/admin/work-schedule/patterns/:workPatternId', ({ params, request }) => {
    const url = new URL(request.url);
    const queryFailure = rejectUnsupportedQuery(url.searchParams, []);
    if (queryFailure) {
      return queryFailure;
    }

    const record = readWorkPattern(String(params.workPatternId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({ data: record });
  }),

  http.patch('*/admin/work-schedule/patterns/:workPatternId', async ({ params, request }) => {
    const record = readWorkPattern(String(params.workPatternId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status === 'ARCHIVED') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, [
      'name',
      'timezone',
      'startLocalTime',
      'workingMinutes',
      'breakMinutes',
      'workingDays',
      'description',
      'externalRef',
    ]);
    if (bodyFailure) {
      return bodyFailure;
    }

    const structuralKeys = [
      'timezone',
      'startLocalTime',
      'workingMinutes',
      'breakMinutes',
      'workingDays',
    ];
    if (record.status === 'ACTIVE' && structuralKeys.some((key) => body[key] !== undefined)) {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return HttpResponse.json(
          { message: 'work-schedule:patterns.validation.required' },
          { status: 422 },
        );
      }
      record.name = name;
    }
    if (record.status === 'DRAFT' && body.startLocalTime !== undefined) {
      record.startLocalTime = String(body.startLocalTime);
    }
    if (record.status === 'DRAFT' && body.workingMinutes !== undefined) {
      record.workingMinutes = Number(body.workingMinutes);
    }
    if (record.status === 'DRAFT' && body.breakMinutes !== undefined) {
      record.breakMinutes = Number(body.breakMinutes);
    }
    if (record.status === 'DRAFT' && body.workingDays !== undefined) {
      const nextWorkingDays = readPatternWeekdays(body.workingDays);
      if (!nextWorkingDays) {
        return HttpResponse.json(
          { message: 'work-schedule:patterns.validation.workingDays' },
          { status: 422 },
        );
      }
      record.workingDays = nextWorkingDays;
    }
    const nextEndLocalTime = calculatePatternEndLocalTime(
      record.startLocalTime,
      record.workingMinutes,
      record.breakMinutes,
    );
    if (!nextEndLocalTime) {
      return HttpResponse.json(
        { message: 'work-schedule:patterns.validation.time' },
        { status: 422 },
      );
    }
    record.endLocalTime = nextEndLocalTime;
    record.description = toNullableText(body.description);
    record.externalRef = toNullableText(body.externalRef);
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: record });
  }),

  http.post(
    '*/admin/work-schedule/patterns/:workPatternId/activate',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const bodyFailure = rejectUnsupportedBody(body, []);
      if (bodyFailure) {
        return bodyFailure;
      }

      const record = readWorkPattern(String(params.workPatternId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status !== 'DRAFT') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }

      record.status = 'ACTIVE';
      record.activatedAt = Date.now();
      record.updatedAt = Date.now();

      return HttpResponse.json({ data: record });
    },
  ),

  http.post(
    '*/admin/work-schedule/patterns/:workPatternId/archive',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const bodyFailure = rejectUnsupportedBody(body, []);
      if (bodyFailure) {
        return bodyFailure;
      }

      const record = readWorkPattern(String(params.workPatternId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.status !== 'DRAFT' && record.status !== 'ACTIVE') {
        return HttpResponse.json(
          { message: 'errors:validation.invalidTransition' },
          { status: 422 },
        );
      }

      record.status = 'ARCHIVED';
      record.archivedAt = Date.now();
      record.updatedAt = Date.now();

      return HttpResponse.json({ data: record });
    },
  ),

  http.get('*/admin/work-shifts/by-subject', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, workBySubjectKeys) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterWorkShiftRows(workShifts, url.searchParams);
    return HttpResponse.json(paginate(rows.map(toWorkShiftBySubjectItem), url.searchParams));
  }),

  http.get('*/admin/work-shifts/by-resource', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, workByResourceKeys) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterWorkShiftRows(workShifts, url.searchParams);
    return HttpResponse.json(paginate(rows.map(toWorkShiftByResourceItem), url.searchParams));
  }),

  http.get('*/admin/work-shifts', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, workFlatKeys) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterWorkShiftRows(workShifts, url.searchParams);
    return HttpResponse.json(paginate(rows.map(toWorkShiftListItem), url.searchParams));
  }),

  http.post('*/admin/work-shifts', async ({ request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, ['scope']) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, [
      'shiftCode',
      'title',
      'subjectKind',
      'subjectEmploymentProfileId',
      'subjectTalentId',
      'subjectTalentGroupId',
      'shiftStartAt',
      'shiftEndAt',
      'studioResourceIds',
      'description',
      'externalRef',
    ]);
    if (bodyFailure) {
      return bodyFailure;
    }

    const subject = readWorkSubjectInput(body, 'subjectKind');
    const studioResourceIds =
      body.studioResourceIds === undefined ? [] : toStringArray(body.studioResourceIds);
    if (
      !subject ||
      !studioResourceIds ||
      typeof body.shiftStartAt !== 'number' ||
      typeof body.shiftEndAt !== 'number'
    ) {
      return HttpResponse.json({ message: 'work-schedule:validation.required' }, { status: 422 });
    }
    const scopeSubjectFailure = rejectInvalidScopedWorkSubjectMutation(
      url.searchParams,
      subject.subjectKind,
    );
    if (scopeSubjectFailure) {
      return scopeSubjectFailure;
    }

    workShiftSeed += 1;
    const shiftCode =
      toNullableText(body.shiftCode) ?? `WS-${String(workShiftSeed).padStart(6, '0')}`;
    const record: WorkShiftRecord = {
      id: `work-shift-${workShiftSeed}`,
      shiftCode,
      title: String(body.title),
      ...subject,
      studioResourceIds,
      status: 'ACTIVE',
      shiftStartAt: body.shiftStartAt,
      shiftEndAt: body.shiftEndAt,
      description: toNullableText(body.description),
      externalRef: toNullableText(body.externalRef),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceType: 'MANUAL',
      sourceRosterId: null,
      sourcePatternId: null,
      sourceExceptionId: null,
      sourceGenerationRunId: null,
      sourceRosterMonth: null,
      sourceDepartmentOrgUnitId: null,
      sourceRosterLocalDate: null,
      sourceRosterSlotKey: null,
    };
    workShifts.unshift(record);

    return HttpResponse.json({ data: toWorkShiftDetail(record) });
  }),

  http.get('*/admin/work-shifts/:workShiftId', ({ params, request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, ['scope']) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const record = readWorkShift(String(params.workShiftId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({ data: toWorkShiftDetail(record) });
  }),

  http.patch('*/admin/work-shifts/:workShiftId', async ({ params, request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, ['scope']) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const record = readWorkShift(String(params.workShiftId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status !== 'ACTIVE') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, ['title', 'description', 'externalRef']);
    if (bodyFailure) {
      return bodyFailure;
    }

    record.title = String(body.title ?? record.title);
    record.description = toNullableText(body.description);
    record.externalRef = toNullableText(body.externalRef);
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toWorkShiftDetail(record) });
  }),

  http.post('*/admin/work-shifts/:workShiftId/reschedule', async ({ params, request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, ['scope']) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const record = readWorkShift(String(params.workShiftId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status !== 'ACTIVE') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, ['newShiftStartAt', 'newShiftEndAt']);
    if (bodyFailure) {
      return bodyFailure;
    }
    if (typeof body.newShiftStartAt !== 'number' || typeof body.newShiftEndAt !== 'number') {
      return HttpResponse.json({ message: 'work-schedule:validation.required' }, { status: 422 });
    }

    record.shiftStartAt = body.newShiftStartAt;
    record.shiftEndAt = body.newShiftEndAt;
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toWorkShiftDetail(record) });
  }),

  http.post('*/admin/work-shifts/:workShiftId/reassign-subject', async ({ params, request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, ['scope']) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const record = readWorkShift(String(params.workShiftId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status !== 'ACTIVE') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, [
      'newSubjectKind',
      'newSubjectEmploymentProfileId',
      'newSubjectTalentId',
      'newSubjectTalentGroupId',
    ]);
    if (bodyFailure) {
      return bodyFailure;
    }

    const subject = readWorkSubjectInput(body, 'newSubjectKind');
    if (!subject) {
      return HttpResponse.json({ message: 'work-schedule:validation.required' }, { status: 422 });
    }
    const scopeSubjectFailure = rejectInvalidScopedWorkSubjectMutation(
      url.searchParams,
      subject.subjectKind,
    );
    if (scopeSubjectFailure) {
      return scopeSubjectFailure;
    }

    record.subjectKind = subject.subjectKind;
    record.subjectEmploymentProfileId = subject.subjectEmploymentProfileId;
    record.subjectTalentId = subject.subjectTalentId;
    record.subjectTalentGroupId = subject.subjectTalentGroupId;
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toWorkShiftDetail(record) });
  }),

  http.post('*/admin/work-shifts/:workShiftId/resources', async ({ params, request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, ['scope']) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const record = readWorkShift(String(params.workShiftId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status !== 'ACTIVE') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, ['newStudioResourceIds']);
    const resourceIds = toStringArray(body.newStudioResourceIds);
    if (bodyFailure || !resourceIds) {
      return (
        bodyFailure ??
        HttpResponse.json({ message: 'work-schedule:validation.required' }, { status: 422 })
      );
    }

    record.studioResourceIds = resourceIds;
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toWorkShiftDetail(record) });
  }),

  http.post('*/admin/work-shifts/:workShiftId/cancel', async ({ params, request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, ['scope']) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, []);
    if (bodyFailure) {
      return bodyFailure;
    }

    const record = readWorkShift(String(params.workShiftId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.status !== 'ACTIVE') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    record.status = 'CANCELLED';
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toWorkShiftDetail(record) });
  }),

  http.post('*/admin/work-shifts/:workShiftId/archive', async ({ params, request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectUnsupportedQuery(url.searchParams, ['scope']) ||
      rejectInvalidWorkScope(url.searchParams);
    if (queryFailure) {
      return queryFailure;
    }

    const body = await parseJsonBody(request);
    const bodyFailure = rejectUnsupportedBody(body, []);
    if (bodyFailure) {
      return bodyFailure;
    }

    const record = readWorkShift(String(params.workShiftId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (
      record.status !== 'CANCELLED' &&
      !(record.status === 'ACTIVE' && record.shiftEndAt < Date.now())
    ) {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    record.status = 'ARCHIVED';
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toWorkShiftDetail(record) });
  }),

  http.get('*/admin/events/by-assignment', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectEventScopeLeakage(request) ||
      rejectUnsupportedQuery(url.searchParams, eventByAssignmentKeys);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterEventRows(events, url.searchParams);
    return HttpResponse.json(paginate(rows.map(toEventRelatedItem), url.searchParams));
  }),

  http.get('*/admin/events/by-resource', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectEventScopeLeakage(request) ||
      rejectUnsupportedQuery(url.searchParams, eventByResourceKeys);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterEventRows(events, url.searchParams);
    return HttpResponse.json(paginate(rows.map(toEventRelatedItem), url.searchParams));
  }),

  http.get('*/admin/events/by-platform', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectEventScopeLeakage(request) ||
      rejectUnsupportedQuery(url.searchParams, eventByPlatformKeys);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterEventRows(events, url.searchParams);
    return HttpResponse.json(paginate(rows.map(toEventRelatedItem), url.searchParams));
  }),

  http.get('*/admin/events', ({ request }) => {
    const url = new URL(request.url);
    const queryFailure =
      rejectEventScopeLeakage(request) || rejectUnsupportedQuery(url.searchParams, eventFlatKeys);
    if (queryFailure) {
      return queryFailure;
    }

    const rows = filterEventRows(events, url.searchParams);
    return HttpResponse.json(paginate(rows.map(toEventListItem), url.searchParams));
  }),

  http.post('*/admin/events', async ({ request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    if (scopeFailure) {
      return scopeFailure;
    }
    const bodyFailure = rejectUnsupportedBody(body, [
      'eventCode',
      'title',
      'assignments',
      'eventStartAt',
      'eventEndAt',
      'studioResourceIds',
      'platformAccountIds',
      'description',
      'externalRef',
    ]);
    if (bodyFailure) {
      return bodyFailure;
    }

    const assignmentInputs = readAssignmentInputs(body.assignments);
    const studioResourceIds =
      body.studioResourceIds === undefined ? [] : toStringArray(body.studioResourceIds);
    const platformAccountIds =
      body.platformAccountIds === undefined ? [] : toStringArray(body.platformAccountIds);
    if (
      !assignmentInputs ||
      assignmentInputs.length === 0 ||
      !studioResourceIds ||
      !platformAccountIds ||
      typeof body.eventStartAt !== 'number' ||
      typeof body.eventEndAt !== 'number'
    ) {
      return HttpResponse.json(
        { message: 'event-assignment:validation.required' },
        { status: 422 },
      );
    }

    eventSeed += 1;
    const record: EventRecord = {
      id: `event-${eventSeed}`,
      eventCode: String(body.eventCode),
      title: String(body.title),
      studioResourceIds,
      platformAccountIds,
      status: 'SCHEDULED',
      eventStartAt: body.eventStartAt,
      eventEndAt: body.eventEndAt,
      description: toNullableText(body.description),
      externalRef: toNullableText(body.externalRef),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    events.unshift(record);
    createEventAssignments(record.id, assignmentInputs);

    return HttpResponse.json({ data: toEventDetail(record) });
  }),

  http.get('*/admin/events/:eventId/assignments', ({ params, request }) => {
    const queryFailure = rejectEventScopeLeakage(request);
    if (queryFailure) {
      return queryFailure;
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({
      data: assignments.filter(
        (assignment) => assignment.eventId === event.id && assignment.assignmentStatus === 'ACTIVE',
      ),
    });
  }),

  http.get('*/admin/events/:eventId', ({ params, request }) => {
    const queryFailure = rejectEventScopeLeakage(request);
    if (queryFailure) {
      return queryFailure;
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.patch('*/admin/events/:eventId', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    if (scopeFailure) {
      return scopeFailure;
    }
    const bodyFailure = rejectUnsupportedBody(body, ['title', 'description', 'externalRef']);
    if (bodyFailure) {
      return bodyFailure;
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (event.status !== 'SCHEDULED') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    event.title = String(body.title ?? event.title);
    event.description = toNullableText(body.description);
    event.externalRef = toNullableText(body.externalRef);
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.post('*/admin/events/:eventId/reschedule', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    if (scopeFailure) {
      return scopeFailure;
    }
    const bodyFailure = rejectUnsupportedBody(body, ['newEventStartAt', 'newEventEndAt']);
    if (bodyFailure) {
      return bodyFailure;
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (event.status !== 'SCHEDULED') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }
    if (typeof body.newEventStartAt !== 'number' || typeof body.newEventEndAt !== 'number') {
      return HttpResponse.json(
        { message: 'event-assignment:validation.required' },
        { status: 422 },
      );
    }

    event.eventStartAt = body.newEventStartAt;
    event.eventEndAt = body.newEventEndAt;
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.post('*/admin/events/:eventId/assignments', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    if (scopeFailure) {
      return scopeFailure;
    }
    const bodyFailure = rejectUnsupportedBody(body, ['replacementAssignments']);
    const assignmentInputs = readAssignmentInputs(body.replacementAssignments);
    if (bodyFailure || !assignmentInputs) {
      return (
        bodyFailure ??
        HttpResponse.json({ message: 'event-assignment:validation.required' }, { status: 422 })
      );
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (event.status !== 'SCHEDULED') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    createEventAssignments(event.id, assignmentInputs);
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.post('*/admin/events/:eventId/studio-resources', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    if (scopeFailure) {
      return scopeFailure;
    }
    const bodyFailure = rejectUnsupportedBody(body, ['newStudioResourceIds']);
    const resourceIds = toStringArray(body.newStudioResourceIds);
    if (bodyFailure || !resourceIds) {
      return (
        bodyFailure ??
        HttpResponse.json({ message: 'event-assignment:validation.required' }, { status: 422 })
      );
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (event.status !== 'SCHEDULED') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    event.studioResourceIds = resourceIds;
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.post('*/admin/events/:eventId/platform-accounts', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    if (scopeFailure) {
      return scopeFailure;
    }
    const bodyFailure = rejectUnsupportedBody(body, ['newPlatformAccountIds']);
    const platformAccountIds = toStringArray(body.newPlatformAccountIds);
    if (bodyFailure || !platformAccountIds) {
      return (
        bodyFailure ??
        HttpResponse.json({ message: 'event-assignment:validation.required' }, { status: 422 })
      );
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (event.status !== 'SCHEDULED') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    event.platformAccountIds = platformAccountIds;
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.post('*/admin/events/:eventId/start', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    const bodyFailure = rejectUnsupportedBody(body, []);
    if (scopeFailure || bodyFailure) {
      return scopeFailure ?? bodyFailure;
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    const activeAssignments = assignments.filter((assignment) => assignment.eventId === event.id);
    if (event.status !== 'SCHEDULED' || activeAssignments.length === 0) {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    event.status = 'IN_PROGRESS';
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.post('*/admin/events/:eventId/complete', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    const bodyFailure = rejectUnsupportedBody(body, []);
    if (scopeFailure || bodyFailure) {
      return scopeFailure ?? bodyFailure;
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (event.status !== 'IN_PROGRESS') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    event.status = 'COMPLETED';
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.post('*/admin/events/:eventId/cancel', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    const bodyFailure = rejectUnsupportedBody(body, []);
    if (scopeFailure || bodyFailure) {
      return scopeFailure ?? bodyFailure;
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (event.status !== 'SCHEDULED' && event.status !== 'IN_PROGRESS') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    event.status = 'CANCELLED';
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),

  http.post('*/admin/events/:eventId/archive', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const scopeFailure = rejectEventScopeLeakage(request, body);
    const bodyFailure = rejectUnsupportedBody(body, []);
    if (scopeFailure || bodyFailure) {
      return scopeFailure ?? bodyFailure;
    }

    const event = readEvent(String(params.eventId));
    if (!event) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    const canArchive =
      event.status === 'COMPLETED' ||
      event.status === 'CANCELLED' ||
      (event.status === 'SCHEDULED' && event.eventEndAt < Date.now());
    if (!canArchive || event.status === 'IN_PROGRESS' || event.status === 'ARCHIVED') {
      return HttpResponse.json({ message: 'errors:validation.invalidTransition' }, { status: 422 });
    }

    event.status = 'ARCHIVED';
    event.updatedAt = Date.now();

    return HttpResponse.json({ data: toEventDetail(event) });
  }),
];
