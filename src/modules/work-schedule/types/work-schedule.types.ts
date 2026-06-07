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
export type MonthlyRosterTargetType = 'ORG_UNIT' | 'TALENT_GROUP';
export type MonthlyRosterTargetMode = 'EXACT_ONLY';
export type MonthlyRosterMemberExclusionReasonCode =
  | 'MEMBERSHIP_INACTIVE'
  | 'TALENT_NOT_FOUND'
  | 'TALENT_INACTIVE'
  | 'MISSING_LINKED_EMPLOYMENT_PROFILE'
  | 'EMPLOYMENT_PROFILE_NOT_FOUND'
  | 'EMPLOYMENT_PROFILE_INACTIVE'
  | 'DUPLICATE_EMPLOYMENT_PROFILE';
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
export type WorkScheduleRequestType = 'CREATE_SHIFT' | 'RESCHEDULE_SHIFT' | 'CANCEL_SHIFT';
export type WorkScheduleRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type WorkScheduleRequestTargetKind = 'EMPLOYMENT_PROFILE_WORK_SHIFT';
export type WorkScheduleRequestSource = 'TEAM_MANAGER';
export type WorkScheduleRequestBatchStatus =
  | 'PENDING'
  | 'PARTIALLY_APPROVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';
export type WorkScheduleRequestBatchScopeSummary = 'ORG_UNIT' | 'TALENT_GROUP' | 'MIXED';
export type WorkScheduleRequestLineStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED_TO_APPLY';
export type WorkScheduleAvailabilityBatchStatus =
  | 'PENDING'
  | 'PARTIALLY_APPROVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';
export type WorkScheduleAvailabilityLineStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type WorkScheduleAvailabilityType =
  | 'UNAVAILABLE_FULL_DAY'
  | 'PREFERRED_TIME'
  | 'OTHER_AVAILABILITY_NOTE';
export type WorkScheduleAvailabilityTaxonomyCode =
  | 'SICK_LEAVE'
  | 'AUTHORIZED_LEAVE'
  | 'SHIFT_CHANGE'
  | 'OTHER';
export type WorkScheduleAvailabilityApplyStatus = 'NOT_APPLIED' | 'ADVISORY_ONLY' | 'APPLIED';
export type WorkScheduleAvailabilityPolicyEvaluationStatus = 'NOT_EVALUATED';
export type WorkScheduleAvailabilityApplyOutcome =
  | 'APPLIED'
  | 'ADVISORY_ONLY'
  | 'SKIPPED_ALREADY_APPLIED'
  | 'FAILED';

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
  sourceRosterTargetType?: MonthlyRosterTargetType | null;
  sourceRosterTargetId?: string | null;
  sourceRosterTargetMode?: MonthlyRosterTargetMode | null;
  sourceMemberIdentityType?: 'EMPLOYMENT_PROFILE' | null;
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
  subjectKind: 'EMPLOYMENT_PROFILE';
  subjectEmploymentProfileId?: string | null;
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

export type WorkScheduleRequestRecord = {
  id: string;
  requestCode: string;
  requestType: WorkScheduleRequestType;
  status: WorkScheduleRequestStatus;
  targetKind: WorkScheduleRequestTargetKind;
  requestSource: WorkScheduleRequestSource;
  targetEmploymentProfileId: string;
  targetEmploymentProfileRef?: ReferenceSummary | null;
  targetWorkShiftId?: string | null;
  targetWorkShiftRef?: ReferenceSummary | null;
  requestedByUserId: string;
  requestedByEmploymentProfileId?: string | null;
  reason: string;
  proposedStartAt?: number | string | null;
  proposedEndAt?: number | string | null;
  proposedTitle?: string | null;
  proposedStudioResourceIds: string[];
  proposedDescription?: string | null;
  proposedExternalRef?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: number | string | null;
  approvalNote?: string | null;
  rejectedByUserId?: string | null;
  rejectedAt?: number | string | null;
  rejectionReason?: string | null;
  cancelledByUserId?: string | null;
  cancelledAt?: number | string | null;
  cancellationReason?: string | null;
  appliedWorkShiftId?: string | null;
  appliedWorkShiftRef?: ReferenceSummary | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type WorkScheduleRequestListQuery = {
  status?: WorkScheduleRequestStatus;
  requestType?: WorkScheduleRequestType;
  targetEmploymentProfileId?: string;
  targetWorkShiftId?: string;
  requestedByUserId?: string;
  limit?: number;
  cursor?: string;
};

export type WorkScheduleRequestCreatePayload = {
  requestType: WorkScheduleRequestType;
  targetEmploymentProfileId: string;
  targetWorkShiftId?: string | null;
  reason: string;
  proposedStartAt?: number | null;
  proposedEndAt?: number | null;
  proposedTitle?: string | null;
  proposedStudioResourceIds?: string[];
  proposedDescription?: string | null;
  proposedExternalRef?: string | null;
};

export type WorkScheduleRequestApprovePayload = {
  approvalNote?: string | null;
};

export type WorkScheduleRequestRejectPayload = {
  rejectionReason: string;
};

export type WorkScheduleRequestCancelPayload = {
  cancellationReason?: string | null;
};

export type WorkScheduleRequestLineCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  failedToApply: number;
};

export type WorkScheduleRequestBatchListItem = {
  id: string;
  batchCode: string;
  submittedByEmploymentProfileId: string;
  submittedByEmploymentProfileRef?: ReferenceSummary | null;
  periodMonth: string;
  scopeSummary: WorkScheduleRequestBatchScopeSummary;
  status: WorkScheduleRequestBatchStatus;
  note: string | null;
  lineCounts: WorkScheduleRequestLineCounts;
  clientToken: string;
  submittedAt: number | string;
  cancelledAt: number | string | null;
  resolvedAt: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type WorkScheduleRequestBatchLine = {
  id: string;
  batchId: string;
  lineNo: number;
  requestType: WorkScheduleRequestType;
  memberEmploymentProfileId: string;
  memberEmploymentProfileRef?: ReferenceSummary | null;
  workShiftId: string | null;
  workShiftRef?: ReferenceSummary | null;
  requestedStartAt: number | string | null;
  requestedEndAt: number | string | null;
  timezone: 'Asia/Ho_Chi_Minh';
  title: string | null;
  description: string | null;
  externalRef: string | null;
  reason: string;
  status: WorkScheduleRequestLineStatus;
  approvalNote: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  failureReason: string | null;
  appliedWorkShiftId: string | null;
  appliedWorkShiftRef?: ReferenceSummary | null;
  createdAt: number | string;
  updatedAt: number | string;
  approvedAt: number | string | null;
  rejectedAt: number | string | null;
  cancelledAt: number | string | null;
  failedAt: number | string | null;
};

export type WorkScheduleRequestBatchDetail = WorkScheduleRequestBatchListItem & {
  lines: WorkScheduleRequestBatchLine[];
};

export type WorkScheduleRequestBatchListQuery = {
  status?: WorkScheduleRequestBatchStatus;
  periodMonth?: string;
  submittedByEmploymentProfileId?: string;
  limit?: number;
  cursor?: string;
};

export type WorkScheduleRequestBatchLineDecisionPayload = {
  lineIds: string[];
  approvalNote?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
};

export type WorkScheduleAvailabilityLineCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
};

export type WorkScheduleAvailabilitySafeEmploymentRef = {
  employmentProfileId: string;
  displayName: string;
  employeeCode?: string;
  status?: string;
};

export type WorkScheduleAvailabilityTargetSummary = {
  id: string;
  code?: string;
  name?: string;
  displayName?: string;
  status?: string;
} | null;

export type WorkScheduleAvailabilityBatchListItem = {
  id: string;
  availabilityBatchCode: string;
  status: WorkScheduleAvailabilityBatchStatus;
  periodMonth: string;
  targetType: MonthlyRosterTargetType;
  targetMode: MonthlyRosterTargetMode;
  targetOrgUnitId: string | null;
  targetTalentGroupId: string | null;
  target?: WorkScheduleAvailabilityTargetSummary;
  submitter?: WorkScheduleAvailabilitySafeEmploymentRef;
  note: string | null;
  lineCounts: WorkScheduleAvailabilityLineCounts;
  clientToken: string;
  submittedAt: number | string;
  cancelledAt: number | string | null;
  resolvedAt: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type WorkScheduleAvailabilityLine = {
  id: string;
  batchId?: string;
  lineNo: number;
  member: WorkScheduleAvailabilitySafeEmploymentRef;
  availabilityType: WorkScheduleAvailabilityType;
  taxonomyCode: WorkScheduleAvailabilityTaxonomyCode;
  availabilityDate: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  preferredStartLocalTime: string | null;
  preferredEndLocalTime: string | null;
  reason: string;
  status: WorkScheduleAvailabilityLineStatus;
  applyStatus: WorkScheduleAvailabilityApplyStatus;
  policyEvaluationStatus: WorkScheduleAvailabilityPolicyEvaluationStatus;
  appliedRosterId: string | null;
  appliedRosterExceptionId: string | null;
  appliedRosterExceptionIds: string[];
  appliedAt: number | string | null;
  adminDecisionNote: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  createdAt: number | string;
  updatedAt: number | string;
  approvedAt: number | string | null;
  rejectedAt: number | string | null;
  cancelledAt: number | string | null;
};

export type WorkScheduleAvailabilityBatchDetail = WorkScheduleAvailabilityBatchListItem & {
  lines: WorkScheduleAvailabilityLine[];
};

export type WorkScheduleAvailabilityBatchListQuery = {
  status?: WorkScheduleAvailabilityBatchStatus;
  periodMonth?: string;
  targetType?: MonthlyRosterTargetType;
  targetOrgUnitId?: string;
  targetTalentGroupId?: string;
  submittedByEmploymentProfileId?: string;
  limit?: number;
  cursor?: string;
};

export type WorkScheduleAvailabilityBatchList = {
  items: WorkScheduleAvailabilityBatchListItem[];
  nextCursor?: string;
};

export type WorkScheduleAvailabilityLineDecisionPayload = {
  lineIds: string[];
  adminDecisionNote?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
};

export type ApplyAvailabilityLinesToMonthlyRosterPayload = {
  availabilityLineIds: string[];
  applyNote?: string | null;
  note?: string | null;
  scope?: MonthlyRosterScope;
};

export type ApplyAvailabilityLineResult = {
  availabilityLineId: string;
  outcome: WorkScheduleAvailabilityApplyOutcome;
  rosterExceptionId: string | null;
  rosterExceptionIds: string[];
  reason: string | null;
};

export type ApplyAvailabilityLinesToMonthlyRosterResult = {
  monthlyRosterId: string;
  rosterCode: string;
  rosterMonth: string;
  status: MonthlyRosterStatus;
  targetType: MonthlyRosterTargetType;
  targetMode: MonthlyRosterTargetMode;
  targetOrgUnitId: string | null;
  targetTalentGroupId: string | null;
  appliedCount: number;
  advisoryOnlyCount: number;
  skippedAlreadyAppliedCount: number;
  failedCount: number;
  results: ApplyAvailabilityLineResult[];
};

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
  sourceAvailabilityBatchId?: string | null;
  sourceAvailabilityLineId?: string | null;
  sourceAvailabilityType?: WorkScheduleAvailabilityType | null;
  sourceAvailabilityTaxonomyCode?: WorkScheduleAvailabilityTaxonomyCode | null;
  sourceAppliedAt?: number | string | null;
  sourceApplyNote?: string | null;
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
  targetType?: MonthlyRosterTargetType;
  targetMode?: MonthlyRosterTargetMode;
  targetOrgUnitId?: string | null;
  targetOrgUnitRef?: ReferenceSummary | null;
  targetTalentGroupId?: string | null;
  targetTalentGroupRef?: ReferenceSummary | null;
  targetRef?: ReferenceSummary | null;
  departmentOrgUnitId: string | null;
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
  targetType?: MonthlyRosterTargetType;
  targetOrgUnitId?: string;
  targetTalentGroupId?: string;
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
  targetType: MonthlyRosterTargetType;
  targetMode: MonthlyRosterTargetMode;
  targetOrgUnitId?: string | null;
  targetTalentGroupId?: string | null;
  departmentOrgUnitId?: string;
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
    | 'targetType'
    | 'targetMode'
    | 'targetOrgUnitId'
    | 'targetTalentGroupId'
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
  departmentOrgUnitId: string | null;
  departmentOrgUnitRef?: ReferenceSummary | null;
};

export type MonthlyRosterPreviewExcludedMember = {
  memberId: string;
  talentId: string | null;
  talentRef?: ReferenceSummary | null;
  linkedEmploymentProfileId: string | null;
  linkedEmploymentProfileRef?: ReferenceSummary | null;
  reasonCode: MonthlyRosterMemberExclusionReasonCode;
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
  targetType?: MonthlyRosterTargetType;
  targetMode?: MonthlyRosterTargetMode;
  targetOrgUnitId?: string | null;
  targetOrgUnitRef?: ReferenceSummary | null;
  targetTalentGroupId?: string | null;
  targetTalentGroupRef?: ReferenceSummary | null;
  targetRef?: ReferenceSummary | null;
  departmentOrgUnitId: string | null;
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
  includedMemberCount?: number;
  excludedMemberCount?: number;
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
  targetType?: MonthlyRosterTargetType;
  targetMode?: MonthlyRosterTargetMode;
  targetOrgUnitId?: string | null;
  targetOrgUnitRef?: ReferenceSummary | null;
  targetTalentGroupId?: string | null;
  targetTalentGroupRef?: ReferenceSummary | null;
  targetRef?: ReferenceSummary | null;
  departmentOrgUnitId: string | null;
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
  excludedMembers?: MonthlyRosterPreviewExcludedMember[];
  rows: MonthlyRosterPreviewRow[];
  summary: MonthlyRosterPreviewSummary;
  warnings?: string[];
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
