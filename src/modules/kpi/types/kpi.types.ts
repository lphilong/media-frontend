import type { ReferenceSummary } from '@shared/formatting/formatters';

export const kpiSubjectTypes = [
  'TALENT',
  'TALENT_GROUP',
  'EMPLOYMENT_PROFILE',
  'ORG_UNIT',
] as const;
export type KpiSubjectType = (typeof kpiSubjectTypes)[number];

export const kpiExecutableSubjectTypes = ['TALENT', 'TALENT_GROUP'] as const;
export type KpiExecutableSubjectType = (typeof kpiExecutableSubjectTypes)[number];

export const kpiMetricCodes = [
  'REVENUE_VND',
  'CONTENT_OUTPUT_COUNT',
  'LIVE_HOURS',
  'EVENT_COMPLETION_COUNT',
  'ONBOARDED_TALENT_COUNT',
] as const;
export type KpiMetricCode = (typeof kpiMetricCodes)[number];

export const kpiPlanStatuses = ['DRAFT', 'PUBLISHED', 'FINALIZED', 'ARCHIVED'] as const;
export type KpiPlanStatus = (typeof kpiPlanStatuses)[number];

export type KpiMetricUnit = 'VND' | 'COUNT' | 'HOUR';
export type KpiAllocationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'CLOSED'
  | 'CANCELLED';

export type KpiTargetMetricInput = {
  metricCode: KpiMetricCode;
  targetValue: number;
};

export type KpiAllocationInput = {
  memberTalentId: string;
  membershipId?: string | null;
  allocationStartDate: string;
  allocationEndDate?: string | null;
  targetMetrics: KpiTargetMetricInput[];
  snapshotMemberDisplayName?: string | null;
};

export type KpiAllocationDraftMemberInput = {
  employmentProfileId: string;
  allocationStartDate: string;
  allocationEndDate?: string | null;
  targetMetrics: KpiTargetMetricInput[];
  note?: string | null;
};

export type KpiManagedMemberPickerItem = {
  employmentProfileId: string;
  employeeCode: string | null;
  displayName: string;
  talentId: string;
  talentCode: string | null;
  groupId: string;
};

export type KpiAllocationQuery = {
  status?: KpiAllocationStatus;
  kpiPlanId?: string;
  groupId?: string;
  limit?: number;
};

export type KpiCreatePlanPayload = {
  title: string;
  description?: string | null;
  subjectType: KpiExecutableSubjectType;
  subjectId: string;
  currencyCode?: 'VND';
  periodMonth: string;
  periodStartAt: number;
  periodEndAt: number;
  timezone?: string;
  targetMetrics: KpiTargetMetricInput[];
  allocations?: KpiAllocationInput[];
  externalRef?: string | null;
};

export type KpiDraftCorePayload = Partial<
  Pick<
    KpiCreatePlanPayload,
    | 'title'
    | 'description'
    | 'currencyCode'
    | 'periodMonth'
    | 'periodStartAt'
    | 'periodEndAt'
    | 'timezone'
    | 'externalRef'
  >
>;

export type KpiPlanQuery = {
  subjectType?: KpiSubjectType;
  subjectId?: string;
  groupId?: string;
  periodMonth?: string;
  status?: KpiPlanStatus;
  metricCode?: KpiMetricCode;
  search?: string;
  limit?: number;
  sortBy?: 'periodMonth' | 'planCode' | 'createdAt';
  sortDirection?: 'ASC' | 'DESC';
};

export type KpiTargetMetric = {
  id: string;
  kpiPlanId: string;
  metricCode: KpiMetricCode;
  targetValue: number;
  unit: KpiMetricUnit;
  rollupMethod: 'SUM';
  actualSource: 'MANUAL';
  createdAt: number | string;
  updatedAt: number | string;
};

export type KpiAllocation = {
  id: string;
  kpiPlanId: string;
  groupId: string;
  memberEmploymentProfileId: string | null;
  memberTalentId: string;
  membershipId: string | null;
  allocationStatus: KpiAllocationStatus;
  allocationStartDate: string;
  allocationEndDate: string | null;
  targetMetrics: KpiTargetMetricInput[];
  snapshotMemberDisplayName: string | null;
  note: string | null;
  createdAt: number | string;
  createdByActorId: string | null;
  updatedAt: number | string;
  updatedByActorId: string | null;
  submittedAt: number | string | null;
  submittedByActorId: string | null;
  approvedAt: number | string | null;
  approvedByActorId: string | null;
  approvalNote: string | null;
  rejectedAt: number | string | null;
  rejectedByActorId: string | null;
  rejectionReason: string | null;
  publishedAt: number | string | null;
  publishedByActorId: string | null;
  closedAt: number | string | null;
};

export type KpiPlanListItem = {
  id: string;
  planCode: string;
  title: string;
  description: string | null;
  subjectType: KpiSubjectType;
  subjectId: string;
  subjectRef?: ReferenceSummary | null;
  status: KpiPlanStatus;
  currencyCode: 'VND';
  periodMonth: string;
  periodStartAt: number | string;
  periodEndAt: number | string;
  timezone: string;
  actualPolicySnapshot?: unknown | null;
  publishedAt: number | string | null;
  publishedByActorId: string | null;
  finalizedAt: number | string | null;
  finalizedByActorId: string | null;
  archivedAt: number | string | null;
  archivedByActorId: string | null;
  createdAt: number | string;
  createdByActorId: string;
  updatedAt: number | string;
  updatedByActorId: string;
  externalRef: string | null;
};

export type KpiPlanDetail = KpiPlanListItem & {
  targetMetrics: KpiTargetMetric[];
  allocations: KpiAllocation[];
};

export type KpiActualGridMetricCell = {
  metricCode: KpiMetricCode;
  targetValue: number;
  actualEntryId: string | null;
  actualValue: number | null;
  effectiveValue: number;
  hasEntry: boolean;
  editCount: number;
  correctionCount: number;
  latestCorrectionId: string | null;
  canDirectEdit: boolean;
  requiresCorrection: boolean;
  disabledReason: string | null;
};

export type KpiActualGridRow = {
  allocationId: string;
  memberTalentId: string;
  memberDisplayName: string | null;
  allocationStatus: KpiAllocationStatus;
  metrics: KpiActualGridMetricCell[];
};

export type KpiActualDailyGrid = {
  kpiPlanId: string;
  planCode: string;
  status: KpiPlanStatus;
  subjectType: KpiSubjectType;
  subjectId: string;
  actualDate: string;
  policy: {
    timezone: 'Asia/Ho_Chi_Minh';
    entryOpenLocalTime: '06:00';
    entryLockLocalTime: '23:00';
    maxDirectEditsPerEntry: number;
    correctionAllowedUntil: 'PLAN_FINALIZED';
  };
  editability: {
    isDirectEditOpen: boolean;
    isPlanFinalized: boolean;
    disabledReason: string | null;
  };
  targetMetrics: Array<{ metricCode: KpiMetricCode; targetValue: number; unit: KpiMetricUnit }>;
  rows: KpiActualGridRow[];
};

export type KpiActualEntry = {
  id: string;
  kpiPlanId: string;
  allocationId: string;
  memberTalentId: string;
  metricCode: KpiMetricCode;
  actualDate: string;
  actualValue: number;
  effectiveValue: number;
  editCount: number;
  correctionCount: number;
  latestCorrectionId: string | null;
  createdAt: number | string;
  createdByActorId: string;
  updatedAt: number | string;
  updatedByActorId: string;
  lastEditedAt: number | string | null;
  lastEditedByActorId: string | null;
};

export type KpiActualCorrection = {
  id: string;
  actualEntryId: string;
  kpiPlanId: string;
  allocationId: string;
  memberTalentId: string;
  metricCode: KpiMetricCode;
  actualDate: string;
  previousValue: number;
  correctedValue: number;
  reason: string;
  correctedByActorId: string;
  correctedAt: number | string;
  createdAt: number | string;
};

export type KpiProgressView = {
  plan: Pick<
    KpiPlanListItem,
    | 'id'
    | 'planCode'
    | 'subjectType'
    | 'subjectId'
    | 'status'
    | 'periodMonth'
    | 'periodStartAt'
    | 'periodEndAt'
    | 'timezone'
  >;
  periodElapsedPercent: number;
  targetMetrics: KpiTargetMetric[];
  groupTotals: Array<{
    metricCode: KpiMetricCode;
    targetValue: number;
    actualValue: number;
    progressPercent: number | null;
  }>;
  memberProgress: Array<{
    allocationId: string;
    memberTalentId: string;
    metricCode: KpiMetricCode;
    targetValue: number;
    actualValue: number;
    progressPercent: number | null;
    actualEntryCount: number;
    missingEntryCount: number;
  }>;
};
