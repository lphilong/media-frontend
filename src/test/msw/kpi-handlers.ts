import { http, HttpResponse } from 'msw';

type KpiSubjectType = 'TALENT' | 'TALENT_GROUP' | 'EMPLOYMENT_PROFILE' | 'ORG_UNIT';
type KpiStatus = 'DRAFT' | 'PUBLISHED' | 'FINALIZED' | 'ARCHIVED';
type KpiMetricCode =
  | 'REVENUE_VND'
  | 'CONTENT_OUTPUT_COUNT'
  | 'LIVE_HOURS'
  | 'EVENT_COMPLETION_COUNT'
  | 'ONBOARDED_TALENT_COUNT'
  | 'TIKTOK_DIAMOND';
type KpiUnit = 'VND' | 'COUNT' | 'HOUR';
type KpiDailyActualStatus =
  | 'NOT_DUE'
  | 'DUE_OPEN'
  | 'OVERDUE'
  | 'ENTERED'
  | 'ENTERED_ZERO'
  | 'EXCUSED'
  | 'NOT_REQUIRED'
  | 'BLOCKED_BY_PLAN_STATUS'
  | 'BLOCKED_BY_ALLOCATION_STATUS';
type KpiActualExcuseStatus = 'EXCUSED' | 'NOT_REQUIRED';
type KpiActualExcuseReasonCode =
  | 'MEMBER_LEAVE'
  | 'SCHEDULED_OFF'
  | 'HOLIDAY_OR_CLOSURE'
  | 'NO_OPERATION_REQUIRED'
  | 'DATA_SOURCE_UNAVAILABLE'
  | 'OTHER';

type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  displayName?: string;
  status?: string;
};

type KpiTargetMetric = {
  id: string;
  kpiPlanId: string;
  metricCode: KpiMetricCode;
  targetValue: number;
  unit: KpiUnit;
  rollupMethod: 'SUM';
  actualSource: 'MANUAL';
  createdAt: number;
  updatedAt: number;
};

type KpiAllocation = {
  id: string;
  kpiPlanId: string;
  groupId: string | null;
  memberEmploymentProfileId: string | null;
  memberTalentId: string | null;
  membershipId: string | null;
  allocationStatus:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'PUBLISHED'
    | 'REJECTED'
    | 'ACTIVE'
    | 'CLOSED'
    | 'CANCELLED';
  allocationStartDate: string;
  allocationEndDate: string | null;
  targetMetrics: Array<{ metricCode: KpiMetricCode; targetValue: number }>;
  snapshotMemberDisplayName: string | null;
  note: string | null;
  createdAt: number;
  createdByActorId: string | null;
  updatedAt: number;
  updatedByActorId: string | null;
  submittedAt: number | null;
  submittedByActorId: string | null;
  approvedAt: number | null;
  approvedByActorId: string | null;
  approvalNote: string | null;
  rejectedAt: number | null;
  rejectedByActorId: string | null;
  rejectionReason: string | null;
  publishedAt: number | null;
  publishedByActorId: string | null;
  closedAt: number | null;
};

type ManagedMember = {
  employmentProfileId: string;
  employeeCode: string | null;
  displayName: string;
  talentId: string;
  talentCode: string | null;
  groupId: string;
};

type KpiPlan = {
  id: string;
  planCode: string;
  title: string;
  description: string | null;
  subjectType: KpiSubjectType;
  subjectId: string;
  subjectRef?: ReferenceSummary | null;
  status: KpiStatus;
  currencyCode: 'VND';
  periodMonth: string;
  periodStartAt: number;
  periodEndAt: number;
  timezone: string;
  actualPolicySnapshot: null;
  publishedAt: number | null;
  publishedByActorId: string | null;
  finalizedAt: number | null;
  finalizedByActorId: string | null;
  finalResult?: KpiFinalResultSnapshot | null;
  archivedAt: number | null;
  archivedByActorId: string | null;
  createdAt: number;
  createdByActorId: string;
  updatedAt: number;
  updatedByActorId: string;
  externalRef: string | null;
};

type KpiFinalResultSnapshot = {
  snapshotVersion: 1;
  planId: string;
  planCode: string;
  periodMonth: string;
  subjectType: KpiSubjectType;
  subjectId: string;
  finalizedAt: number;
  revenue: {
    metricCode: 'REVENUE_VND';
    planTargetValue: number | null;
    operationalTargetValue: number;
    actualValue: number;
    achievementPercent: number | null;
    targetMismatch: boolean;
  };
  allocationCoverage: {
    publishedAllocationCount: number;
    totalAllocationCount: number;
    isAllExistingAllocationsPublished: boolean;
  };
  actualEntryStatusSummary: {
    expectedEntryCount: number;
    enteredEntryCount: number;
    enteredZeroCount: number;
    pendingEntryCount: number;
    overdueEntryCount: number;
    excusedEntryCount: number;
    notRequiredEntryCount: number;
    notDueEntryCount: number;
  };
  supportingMetrics: Array<{
    metricCode: KpiMetricCode;
    targetValue: number;
    actualValue: number;
    achievementPercent: number | null;
  }>;
  members: Array<{
    allocationId: string;
    memberDisplayName: string | null;
    allocationStatus: 'PUBLISHED';
    revenue: {
      metricCode: 'REVENUE_VND';
      targetValue: number;
      actualValue: number;
      achievementPercent: number | null;
    };
    supportingMetrics: Array<{
      metricCode: KpiMetricCode;
      targetValue: number;
      actualValue: number;
      achievementPercent: number | null;
    }>;
    actualEntryStatusSummary: {
      expectedEntryCount: number;
      enteredEntryCount: number;
      enteredZeroCount: number;
      pendingEntryCount: number;
      overdueEntryCount: number;
      excusedEntryCount: number;
      notRequiredEntryCount: number;
      notDueEntryCount: number;
    };
  }>;
};

type KpiAllocationWorkflowSummary = {
  total: number;
  byStatus: {
    draft: number;
    pendingApproval: number;
    approved: number;
    published: number;
    rejected: number;
    active: number;
    closed: number;
    cancelled: number;
  };
  hasDraft: boolean;
  hasPendingApproval: boolean;
  hasApproved: boolean;
  hasPublished: boolean;
  hasRejected: boolean;
  hasLegacyActive: boolean;
  officialPublishedCount: number;
};

type KpiListPlan = Omit<KpiPlan, 'finalResult'> & {
  allocationWorkflowSummary: KpiAllocationWorkflowSummary;
};

type ActualEntry = {
  id: string;
  kpiPlanId: string;
  allocationId: string;
  memberEmploymentProfileId: string | null;
  memberTalentId: string | null;
  metricCode: KpiMetricCode;
  actualDate: string;
  actualValue: number;
  effectiveValue: number;
  editCount: number;
  correctionCount: number;
  latestCorrectionId: string | null;
  createdAt: number;
  createdByActorId: string;
  updatedAt: number;
  updatedByActorId: string;
  lastEditedAt: number | null;
  lastEditedByActorId: string | null;
};

type ActualCorrection = {
  id: string;
  actualEntryId: string;
  kpiPlanId: string;
  allocationId: string;
  metricCode: KpiMetricCode;
  actualDate: string;
  previousValue: number;
  correctedValue: number;
  reason: string;
  correctedAt: number;
  createdAt: number;
};

type ActualExcuse = {
  id: string;
  kpiPlanId: string;
  allocationId: string;
  metricCode: KpiMetricCode;
  actualDate: string;
  status: KpiActualExcuseStatus;
  reasonCode: KpiActualExcuseReasonCode;
  reasonText: string;
  createdAt: number;
  createdByActorId: string;
  updatedAt: number;
  updatedByActorId: string;
  deletedAt: number | null;
  deletedByActorId: string | null;
};

const now = Date.parse('2026-05-16T09:30:00.000Z');
const allocationContractDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const may2026PeriodStartAt = Date.UTC(2026, 4, 1, -7, 0, 0, 0);
const may2026PeriodEndAt = Date.UTC(2026, 5, 1, -7, 0, 0, 0) - 1;
const metricUnits: Record<KpiMetricCode, KpiUnit> = {
  REVENUE_VND: 'VND',
  CONTENT_OUTPUT_COUNT: 'COUNT',
  LIVE_HOURS: 'HOUR',
  EVENT_COMPLETION_COUNT: 'COUNT',
  ONBOARDED_TALENT_COUNT: 'COUNT',
  TIKTOK_DIAMOND: 'COUNT',
};
const metricCodes = Object.keys(metricUnits) as KpiMetricCode[];
const integerTargetMetricCodes = new Set<KpiMetricCode>([
  'REVENUE_VND',
  'CONTENT_OUTPUT_COUNT',
  'EVENT_COMPLETION_COUNT',
  'ONBOARDED_TALENT_COUNT',
  'TIKTOK_DIAMOND',
]);
const subjectTypes: KpiSubjectType[] = ['TALENT', 'TALENT_GROUP', 'EMPLOYMENT_PROFILE', 'ORG_UNIT'];
const createSubjectTypes: KpiSubjectType[] = ['TALENT_GROUP', 'ORG_UNIT'];
const createMetricCodesBySubjectType: Record<KpiSubjectType, ReadonlySet<KpiMetricCode>> = {
  TALENT: new Set(),
  EMPLOYMENT_PROFILE: new Set(),
  TALENT_GROUP: new Set(['REVENUE_VND', 'TIKTOK_DIAMOND']),
  ORG_UNIT: new Set(['REVENUE_VND']),
};
const planStatuses: KpiStatus[] = ['DRAFT', 'PUBLISHED', 'FINALIZED', 'ARCHIVED'];
const allocationStatuses: KpiAllocation['allocationStatus'][] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ACTIVE',
  'CLOSED',
  'CANCELLED',
];
const actualExcuseStatuses: KpiActualExcuseStatus[] = ['EXCUSED', 'NOT_REQUIRED'];
const actualExcuseReasonCodes: KpiActualExcuseReasonCode[] = [
  'MEMBER_LEAVE',
  'SCHEDULED_OFF',
  'HOLIDAY_OR_CLOSURE',
  'NO_OPERATION_REQUIRED',
  'DATA_SOURCE_UNAVAILABLE',
  'OTHER',
];
const allowedListQueryKeys = [
  'subjectType',
  'subjectId',
  'groupId',
  'periodMonth',
  'status',
  'metricCode',
  'search',
  'limit',
  'sortBy',
  'sortDirection',
] as const;
const allowedActualWorkspaceListQueryKeys = [
  'subjectType',
  'periodMonth',
  'groupId',
  'subjectId',
  'search',
  'limit',
  'sortBy',
  'sortDirection',
  'cursor',
  'allocationCoverage',
  'hasOverdueActuals',
  'hasPendingActuals',
] as const;
const allowedAllocationListQueryKeys = ['status', 'kpiPlanId', 'groupId', 'limit'] as const;
const allowedManagedMemberQueryKeys = ['search', 'limit'] as const;
const allowedSortByValues = ['periodMonth', 'planCode', 'createdAt'];
const allowedSortDirections = ['ASC', 'DESC'];
const maxListLimit = 100;
const currentKpiCreateMonth = '2026-06';
const managedMembers: ManagedMember[] = [
  {
    employmentProfileId: 'employment-profile-001',
    employeeCode: 'EP-000001',
    displayName: 'Luna Park',
    talentId: 'talent-001',
    talentCode: 'TAL-000001',
    groupId: 'group-001',
  },
  {
    employmentProfileId: 'employment-profile-002',
    employeeCode: 'EP-000002',
    displayName: 'Minh Tran',
    talentId: 'talent-002',
    talentCode: 'TAL-000002',
    groupId: 'group-001',
  },
];
const orgUnitManagedMembers = [
  {
    employmentProfileId: 'employment-profile-ops-001',
    employeeCode: 'EP-OPS-001',
    displayName: 'An Nguyen',
    orgUnitId: 'org-unit-001',
  },
  {
    employmentProfileId: 'employment-profile-ops-002',
    employeeCode: 'EP-OPS-002',
    displayName: 'Bao Le',
    orgUnitId: 'org-unit-001',
  },
  {
    employmentProfileId: 'ep-manager',
    employeeCode: 'EP-MGR-001',
    displayName: 'Mina Manager',
    orgUnitId: 'org-unit-001',
  },
];

const subjectRefFor = (subjectType: KpiSubjectType, subjectId: string): ReferenceSummary | null => {
  if (subjectType === 'ORG_UNIT') {
    return { id: subjectId, code: 'OU-001', name: 'Operations Unit', status: 'ACTIVE' };
  }
  if (subjectType === 'TALENT_GROUP') {
    return { id: subjectId, code: 'TG-001', name: 'Creator Team', status: 'ACTIVE' };
  }
  return null;
};

const basePlan = (overrides: Partial<KpiPlan>): KpiPlan => ({
  id: 'kpi-plan-draft',
  planCode: 'KPI-202605-000001',
  title: 'May creator KPI',
  description: null,
  subjectType: 'TALENT_GROUP',
  subjectId: 'group-001',
  subjectRef: subjectRefFor(
    overrides.subjectType ?? 'TALENT_GROUP',
    overrides.subjectId ?? 'group-001',
  ),
  status: 'DRAFT',
  currencyCode: 'VND',
  periodMonth: '2026-05',
  periodStartAt: may2026PeriodStartAt,
  periodEndAt: may2026PeriodEndAt,
  timezone: 'Asia/Ho_Chi_Minh',
  actualPolicySnapshot: null,
  publishedAt: null,
  publishedByActorId: null,
  finalizedAt: null,
  finalizedByActorId: null,
  finalResult: null,
  archivedAt: null,
  archivedByActorId: null,
  createdAt: now - 100_000,
  createdByActorId: 'user-admin',
  updatedAt: now - 90_000,
  updatedByActorId: 'user-admin',
  externalRef: null,
  ...overrides,
});

const initialPlans = [
  basePlan({}),
  basePlan({
    id: 'kpi-plan-published',
    planCode: 'KPI-202605-000002',
    title: 'Published team KPI',
    status: 'PUBLISHED',
    publishedAt: now - 50_000,
    publishedByActorId: 'user-admin',
  }),
  basePlan({
    id: 'kpi-plan-finalized',
    planCode: 'KPI-202604-000003',
    title: 'Finalized team KPI',
    periodMonth: '2026-04',
    status: 'FINALIZED',
    publishedAt: now - 80_000,
    finalizedAt: now - 40_000,
    finalizedByActorId: 'user-admin',
    finalResult: {
      snapshotVersion: 1,
      planId: 'kpi-plan-finalized',
      planCode: 'KPI-202604-000003',
      periodMonth: '2026-04',
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
      finalizedAt: now - 40_000,
      revenue: {
        metricCode: 'REVENUE_VND',
        planTargetValue: 1000000,
        operationalTargetValue: 1000000,
        actualValue: 850000,
        achievementPercent: 85,
        targetMismatch: false,
      },
      allocationCoverage: {
        publishedAllocationCount: 2,
        totalAllocationCount: 2,
        isAllExistingAllocationsPublished: true,
      },
      actualEntryStatusSummary: {
        expectedEntryCount: 120,
        enteredEntryCount: 116,
        enteredZeroCount: 1,
        pendingEntryCount: 0,
        overdueEntryCount: 2,
        excusedEntryCount: 1,
        notRequiredEntryCount: 1,
        notDueEntryCount: 0,
      },
      supportingMetrics: [
        {
          metricCode: 'CONTENT_OUTPUT_COUNT',
          targetValue: 10,
          actualValue: 8,
          achievementPercent: 80,
        },
        {
          metricCode: 'TIKTOK_DIAMOND',
          targetValue: 1000,
          actualValue: 840,
          achievementPercent: 84,
        },
      ],
      members: [
        {
          allocationId: 'kpi-plan-finalized-alloc-1',
          memberDisplayName: 'Luna Park',
          allocationStatus: 'PUBLISHED',
          revenue: {
            metricCode: 'REVENUE_VND',
            targetValue: 600000,
            actualValue: 550000,
            achievementPercent: 91.67,
          },
          supportingMetrics: [
            {
              metricCode: 'CONTENT_OUTPUT_COUNT',
              targetValue: 6,
              actualValue: 5,
              achievementPercent: 83.33,
            },
            {
              metricCode: 'TIKTOK_DIAMOND',
              targetValue: 600,
              actualValue: 540,
              achievementPercent: 90,
            },
          ],
          actualEntryStatusSummary: {
            expectedEntryCount: 60,
            enteredEntryCount: 58,
            enteredZeroCount: 0,
            pendingEntryCount: 0,
            overdueEntryCount: 1,
            excusedEntryCount: 1,
            notRequiredEntryCount: 0,
            notDueEntryCount: 0,
          },
        },
        {
          allocationId: 'kpi-plan-finalized-alloc-2',
          memberDisplayName: 'Minh Tran',
          allocationStatus: 'PUBLISHED',
          revenue: {
            metricCode: 'REVENUE_VND',
            targetValue: 400000,
            actualValue: 300000,
            achievementPercent: 75,
          },
          supportingMetrics: [
            {
              metricCode: 'CONTENT_OUTPUT_COUNT',
              targetValue: 4,
              actualValue: 3,
              achievementPercent: 75,
            },
            {
              metricCode: 'TIKTOK_DIAMOND',
              targetValue: 400,
              actualValue: 300,
              achievementPercent: 75,
            },
          ],
          actualEntryStatusSummary: {
            expectedEntryCount: 60,
            enteredEntryCount: 58,
            enteredZeroCount: 1,
            pendingEntryCount: 0,
            overdueEntryCount: 1,
            excusedEntryCount: 0,
            notRequiredEntryCount: 1,
            notDueEntryCount: 0,
          },
        },
      ],
    },
  }),
  basePlan({
    id: 'kpi-plan-finalized-no-snapshot',
    planCode: 'KPI-202603-000004',
    title: 'Finalized KPI without snapshot',
    periodMonth: '2026-03',
    status: 'FINALIZED',
    publishedAt: now - 90_000,
    finalizedAt: now - 45_000,
    finalizedByActorId: 'user-admin',
    finalResult: null,
  }),
  basePlan({
    id: 'kpi-plan-legacy-active',
    planCode: 'KPI-202605-000004',
    title: 'Legacy workflow KPI',
    status: 'PUBLISHED',
    publishedAt: now - 60_000,
    publishedByActorId: 'user-admin',
  }),
  basePlan({
    id: 'kpi-plan-rejected',
    planCode: 'KPI-202605-000005',
    title: 'Rejected allocation KPI',
    status: 'PUBLISHED',
    publishedAt: now - 65_000,
    publishedByActorId: 'user-admin',
  }),
  basePlan({
    id: 'kpi-plan-status-overdue-only',
    planCode: 'KPI-202605-STATUS-OVERDUE',
    title: 'Status fixture overdue only',
    status: 'PUBLISHED',
  }),
  basePlan({
    id: 'kpi-plan-status-due-open-only',
    planCode: 'KPI-202605-STATUS-DUE-OPEN',
    title: 'Status fixture due open only',
    status: 'PUBLISHED',
  }),
  basePlan({
    id: 'kpi-plan-status-both',
    planCode: 'KPI-202605-STATUS-BOTH',
    title: 'Status fixture both',
    status: 'PUBLISHED',
  }),
  basePlan({
    id: 'kpi-plan-status-neither',
    planCode: 'KPI-202605-STATUS-NEITHER',
    title: 'Status fixture neither',
    status: 'PUBLISHED',
  }),
  basePlan({
    id: 'kpi-plan-status-entered-zero',
    planCode: 'KPI-202605-STATUS-ENTERED-ZERO',
    title: 'Status fixture entered zero only',
    status: 'PUBLISHED',
  }),
  basePlan({
    id: 'kpi-plan-status-excused-not-required',
    planCode: 'KPI-202605-STATUS-EXCUSED',
    title: 'Status fixture excused and not required',
    status: 'PUBLISHED',
  }),
  basePlan({
    id: 'kpi-plan-status-not-due',
    planCode: 'KPI-202605-STATUS-NOT-DUE',
    title: 'Status fixture not due only',
    status: 'PUBLISHED',
  }),
  basePlan({
    id: 'kpi-plan-org-unit',
    planCode: 'KPI-202606-ORG-001',
    title: 'Operations unit KPI',
    subjectType: 'ORG_UNIT',
    subjectId: 'org-unit-001',
    periodMonth: '2026-06',
    status: 'PUBLISHED',
    publishedAt: now - 30_000,
    publishedByActorId: 'user-admin',
  }),
  basePlan({
    id: 'kpi-plan-org-unit-draft-allocation',
    planCode: 'KPI-202606-ORG-003',
    title: 'Operations unit draft allocation KPI',
    subjectType: 'ORG_UNIT',
    subjectId: 'org-unit-001',
    periodMonth: '2026-06',
    status: 'PUBLISHED',
    publishedAt: now - 30_000,
    publishedByActorId: 'user-admin',
  }),
  basePlan({
    id: 'kpi-plan-org-unit-finalized',
    planCode: 'KPI-202606-ORG-002',
    title: 'Finalized operations unit KPI',
    subjectType: 'ORG_UNIT',
    subjectId: 'org-unit-001',
    periodMonth: '2026-06',
    status: 'FINALIZED',
    publishedAt: now - 35_000,
    publishedByActorId: 'user-admin',
    finalizedAt: now - 20_000,
    finalizedByActorId: 'user-admin',
  }),
];

const initialTargets: Record<string, KpiTargetMetric[]> = Object.fromEntries(
  initialPlans.map((plan) => [
    plan.id,
    [
      {
        id: `${plan.id}-metric-revenue`,
        kpiPlanId: plan.id,
        metricCode: 'REVENUE_VND',
        targetValue: 1000000,
        unit: 'VND',
        rollupMethod: 'SUM',
        actualSource: 'MANUAL',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${plan.id}-metric-content`,
        kpiPlanId: plan.id,
        metricCode: 'CONTENT_OUTPUT_COUNT',
        targetValue: 10,
        unit: 'COUNT',
        rollupMethod: 'SUM',
        actualSource: 'MANUAL',
        createdAt: now,
        updatedAt: now,
      },
    ],
  ]),
);
initialTargets['kpi-plan-org-unit'] = [
  {
    id: 'kpi-plan-org-unit-metric-revenue',
    kpiPlanId: 'kpi-plan-org-unit',
    metricCode: 'REVENUE_VND',
    targetValue: 2000000,
    unit: 'VND',
    rollupMethod: 'SUM',
    actualSource: 'MANUAL',
    createdAt: now,
    updatedAt: now,
  },
];
initialTargets['kpi-plan-org-unit-draft-allocation'] = [
  {
    id: 'kpi-plan-org-unit-draft-allocation-metric-revenue',
    kpiPlanId: 'kpi-plan-org-unit-draft-allocation',
    metricCode: 'REVENUE_VND',
    targetValue: 1000000,
    unit: 'VND',
    rollupMethod: 'SUM',
    actualSource: 'MANUAL',
    createdAt: now,
    updatedAt: now,
  },
];
initialTargets['kpi-plan-org-unit-finalized'] = [
  {
    id: 'kpi-plan-org-unit-finalized-metric-revenue',
    kpiPlanId: 'kpi-plan-org-unit-finalized',
    metricCode: 'REVENUE_VND',
    targetValue: 2000000,
    unit: 'VND',
    rollupMethod: 'SUM',
    actualSource: 'MANUAL',
    createdAt: now,
    updatedAt: now,
  },
];

const initialAllocations: Record<string, KpiAllocation[]> = Object.fromEntries(
  initialPlans.map((plan) => [
    plan.id,
    [
      {
        id: `${plan.id}-alloc-1`,
        kpiPlanId: plan.id,
        groupId: 'group-001',
        memberEmploymentProfileId: 'employment-profile-001',
        memberTalentId: 'talent-001',
        membershipId: null,
        allocationStatus: plan.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        allocationStartDate: '2026-05-01',
        allocationEndDate: null,
        targetMetrics: [
          { metricCode: 'REVENUE_VND', targetValue: 600000 },
          { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 6 },
        ],
        snapshotMemberDisplayName: 'Luna Park',
        note: null,
        createdAt: now,
        createdByActorId: 'user-admin',
        updatedAt: now,
        updatedByActorId: 'user-admin',
        submittedAt: plan.status === 'DRAFT' ? null : now - 45_000,
        submittedByActorId: plan.status === 'DRAFT' ? null : 'manager-user',
        approvedAt: plan.status === 'DRAFT' ? null : now - 40_000,
        approvedByActorId: plan.status === 'DRAFT' ? null : 'user-admin',
        approvalNote: null,
        rejectedAt: null,
        rejectedByActorId: null,
        rejectionReason: null,
        publishedAt: plan.publishedAt,
        publishedByActorId: plan.publishedByActorId,
        closedAt: null,
      },
      {
        id: `${plan.id}-alloc-2`,
        kpiPlanId: plan.id,
        groupId: 'group-001',
        memberEmploymentProfileId: 'employment-profile-002',
        memberTalentId: 'talent-002',
        membershipId: null,
        allocationStatus: plan.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        allocationStartDate: '2026-05-01',
        allocationEndDate: null,
        targetMetrics: [
          { metricCode: 'REVENUE_VND', targetValue: 400000 },
          { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 4 },
        ],
        snapshotMemberDisplayName: 'Minh Tran',
        note: null,
        createdAt: now,
        createdByActorId: 'user-admin',
        updatedAt: now,
        updatedByActorId: 'user-admin',
        submittedAt: plan.status === 'DRAFT' ? null : now - 45_000,
        submittedByActorId: plan.status === 'DRAFT' ? null : 'manager-user',
        approvedAt: plan.status === 'DRAFT' ? null : now - 40_000,
        approvedByActorId: plan.status === 'DRAFT' ? null : 'user-admin',
        approvalNote: null,
        rejectedAt: null,
        rejectedByActorId: null,
        rejectionReason: null,
        publishedAt: plan.publishedAt,
        publishedByActorId: plan.publishedByActorId,
        closedAt: null,
      },
    ],
  ]),
);

initialAllocations['kpi-plan-draft'] = [];
initialAllocations['kpi-plan-org-unit'] = [
  {
    id: 'kpi-plan-org-unit-alloc-1',
    kpiPlanId: 'kpi-plan-org-unit',
    groupId: null,
    memberEmploymentProfileId: 'employment-profile-ops-001',
    memberTalentId: null,
    membershipId: null,
    allocationStatus: 'PUBLISHED',
    allocationStartDate: '2026-06-01',
    allocationEndDate: null,
    targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000000 }],
    snapshotMemberDisplayName: 'An Nguyen',
    note: null,
    createdAt: now,
    createdByActorId: 'user-admin',
    updatedAt: now,
    updatedByActorId: 'user-admin',
    submittedAt: now - 45_000,
    submittedByActorId: 'manager-user',
    approvedAt: now - 40_000,
    approvedByActorId: 'user-admin',
    approvalNote: null,
    rejectedAt: null,
    rejectedByActorId: null,
    rejectionReason: null,
    publishedAt: now - 30_000,
    publishedByActorId: 'user-admin',
    closedAt: null,
  },
  {
    id: 'kpi-plan-org-unit-alloc-2',
    kpiPlanId: 'kpi-plan-org-unit',
    groupId: null,
    memberEmploymentProfileId: 'employment-profile-ops-002',
    memberTalentId: null,
    membershipId: null,
    allocationStatus: 'PUBLISHED',
    allocationStartDate: '2026-06-01',
    allocationEndDate: null,
    targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000000 }],
    snapshotMemberDisplayName: 'Bao Le',
    note: null,
    createdAt: now,
    createdByActorId: 'user-admin',
    updatedAt: now,
    updatedByActorId: 'user-admin',
    submittedAt: now - 45_000,
    submittedByActorId: 'manager-user',
    approvedAt: now - 40_000,
    approvedByActorId: 'user-admin',
    approvalNote: null,
    rejectedAt: null,
    rejectedByActorId: null,
    rejectionReason: null,
    publishedAt: now - 30_000,
    publishedByActorId: 'user-admin',
    closedAt: null,
  },
];
initialAllocations['kpi-plan-org-unit-draft-allocation'] = [
  {
    id: 'kpi-plan-org-unit-draft-allocation-alloc-1',
    kpiPlanId: 'kpi-plan-org-unit-draft-allocation',
    groupId: null,
    memberEmploymentProfileId: 'employment-profile-ops-001',
    memberTalentId: null,
    membershipId: null,
    allocationStatus: 'DRAFT',
    allocationStartDate: '2026-06-01',
    allocationEndDate: null,
    targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000000 }],
    snapshotMemberDisplayName: 'An Nguyen',
    note: null,
    createdAt: now,
    createdByActorId: 'manager-user',
    updatedAt: now,
    updatedByActorId: 'manager-user',
    submittedAt: null,
    submittedByActorId: null,
    approvedAt: null,
    approvedByActorId: null,
    approvalNote: null,
    rejectedAt: null,
    rejectedByActorId: null,
    rejectionReason: null,
    publishedAt: null,
    publishedByActorId: null,
    closedAt: null,
  },
];
initialAllocations['kpi-plan-org-unit-finalized'] = [
  {
    id: 'kpi-plan-org-unit-finalized-alloc-1',
    kpiPlanId: 'kpi-plan-org-unit-finalized',
    groupId: null,
    memberEmploymentProfileId: 'employment-profile-ops-001',
    memberTalentId: null,
    membershipId: null,
    allocationStatus: 'PUBLISHED',
    allocationStartDate: '2026-06-01',
    allocationEndDate: null,
    targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 2000000 }],
    snapshotMemberDisplayName: 'An Nguyen',
    note: null,
    createdAt: now,
    createdByActorId: 'user-admin',
    updatedAt: now,
    updatedByActorId: 'user-admin',
    submittedAt: now - 45_000,
    submittedByActorId: 'manager-user',
    approvedAt: now - 40_000,
    approvedByActorId: 'user-admin',
    approvalNote: null,
    rejectedAt: null,
    rejectedByActorId: null,
    rejectionReason: null,
    publishedAt: now - 35_000,
    publishedByActorId: 'user-admin',
    closedAt: null,
  },
];
initialAllocations['kpi-plan-finalized'] = (initialAllocations['kpi-plan-finalized'] ?? []).map(
  (allocation, index) => ({
    ...allocation,
    allocationStatus: index === 0 ? 'PENDING_APPROVAL' : 'APPROVED',
    submittedAt: now - 70_000,
    submittedByActorId: 'manager-user',
    approvedAt: index === 0 ? null : now - 60_000,
    approvedByActorId: index === 0 ? null : 'user-admin',
    publishedAt: null,
    publishedByActorId: null,
  }),
);
initialAllocations['kpi-plan-legacy-active'] = (
  initialAllocations['kpi-plan-legacy-active'] ?? []
).map((allocation, index) => ({
  ...allocation,
  allocationStatus: index === 0 ? 'ACTIVE' : 'PUBLISHED',
  publishedAt: index === 0 ? null : allocation.publishedAt,
  publishedByActorId: index === 0 ? null : allocation.publishedByActorId,
}));
initialAllocations['kpi-plan-rejected'] = (initialAllocations['kpi-plan-rejected'] ?? []).map(
  (allocation) => ({
    ...allocation,
    allocationStatus: 'REJECTED',
    rejectedAt: now - 55_000,
    rejectedByActorId: 'user-admin',
    rejectionReason: 'Needs revision',
    publishedAt: null,
    publishedByActorId: null,
  }),
);

let planSeed = 100;
let actualSeed = 100;
let correctionSeed = 100;
let excuseSeed = 100;
let plans: KpiPlan[] = [];
let targets: Record<string, KpiTargetMetric[]> = {};
let allocations: Record<string, KpiAllocation[]> = {};
let actualEntries: ActualEntry[] = [];
let corrections: ActualCorrection[] = [];
let actualExcuses: ActualExcuse[] = [];
let lastAllocationDraftPayload: Record<string, unknown> | undefined;
let lastOrgUnitActualGridDate: string | undefined;
let lastOrgUnitActualPayload: Record<string, unknown> | undefined;

export const readLastKpiAllocationDraftPayload = (): Record<string, unknown> | undefined =>
  lastAllocationDraftPayload;

export const readLastKpiOrgUnitActualGridDate = (): string | undefined => lastOrgUnitActualGridDate;

export const readLastKpiOrgUnitActualPayload = (): Record<string, unknown> | undefined =>
  lastOrgUnitActualPayload;

export const resetKpiMockData = (): void => {
  planSeed = 100;
  actualSeed = 100;
  correctionSeed = 100;
  excuseSeed = 100;
  lastAllocationDraftPayload = undefined;
  lastOrgUnitActualGridDate = undefined;
  lastOrgUnitActualPayload = undefined;
  plans = initialPlans.map((plan) => ({
    ...plan,
    subjectRef: plan.subjectRef ? { ...plan.subjectRef } : null,
  }));
  targets = Object.fromEntries(
    Object.entries(initialTargets).map(([id, items]) => [id, items.map((item) => ({ ...item }))]),
  );
  allocations = Object.fromEntries(
    Object.entries(initialAllocations).map(([id, items]) => [
      id,
      items.map((item) => ({
        ...item,
        targetMetrics: item.targetMetrics.map((metric) => ({ ...metric })),
      })),
    ]),
  );
  actualEntries = [
    {
      id: 'actual-editable',
      kpiPlanId: 'kpi-plan-published',
      allocationId: 'kpi-plan-published-alloc-1',
      memberEmploymentProfileId: 'employment-profile-001',
      memberTalentId: 'talent-001',
      metricCode: 'REVENUE_VND',
      actualDate: '2026-05-16',
      actualValue: 500000,
      effectiveValue: 500000,
      editCount: 0,
      correctionCount: 0,
      latestCorrectionId: null,
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      lastEditedAt: null,
      lastEditedByActorId: null,
    },
    {
      id: 'actual-locked',
      kpiPlanId: 'kpi-plan-published',
      allocationId: 'kpi-plan-published-alloc-2',
      memberEmploymentProfileId: 'employment-profile-002',
      memberTalentId: 'talent-002',
      metricCode: 'REVENUE_VND',
      actualDate: '2026-05-16',
      actualValue: 200000,
      effectiveValue: 250000,
      editCount: 3,
      correctionCount: 1,
      latestCorrectionId: 'correction-001',
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      lastEditedAt: now,
      lastEditedByActorId: 'user-admin',
    },
    {
      id: 'actual-excused-conflict',
      kpiPlanId: 'kpi-plan-published',
      allocationId: 'kpi-plan-published-alloc-1',
      memberEmploymentProfileId: 'employment-profile-001',
      memberTalentId: 'talent-001',
      metricCode: 'CONTENT_OUTPUT_COUNT',
      actualDate: '2026-05-15',
      actualValue: 5,
      effectiveValue: 5,
      editCount: 1,
      correctionCount: 0,
      latestCorrectionId: null,
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      lastEditedAt: now,
      lastEditedByActorId: 'user-admin',
    },
    {
      id: 'actual-not-required-conflict',
      kpiPlanId: 'kpi-plan-published',
      allocationId: 'kpi-plan-published-alloc-1',
      memberEmploymentProfileId: 'employment-profile-001',
      memberTalentId: 'talent-001',
      metricCode: 'CONTENT_OUTPUT_COUNT',
      actualDate: '2026-05-14',
      actualValue: 4,
      effectiveValue: 4,
      editCount: 1,
      correctionCount: 0,
      latestCorrectionId: null,
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      lastEditedAt: now,
      lastEditedByActorId: 'user-admin',
    },
    {
      id: 'actual-finalized',
      kpiPlanId: 'kpi-plan-finalized',
      allocationId: 'kpi-plan-finalized-alloc-1',
      memberEmploymentProfileId: 'employment-profile-001',
      memberTalentId: 'talent-001',
      metricCode: 'REVENUE_VND',
      actualDate: '2026-04-16',
      actualValue: 100000,
      effectiveValue: 100000,
      editCount: 1,
      correctionCount: 0,
      latestCorrectionId: null,
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      lastEditedAt: now,
      lastEditedByActorId: 'user-admin',
    },
  ];
  corrections = [
    {
      id: 'correction-001',
      actualEntryId: 'actual-locked',
      kpiPlanId: 'kpi-plan-published',
      allocationId: 'kpi-plan-published-alloc-2',
      metricCode: 'REVENUE_VND',
      actualDate: '2026-05-16',
      previousValue: 200000,
      correctedValue: 250000,
      reason: 'Backend approved adjustment',
      correctedAt: now,
      createdAt: now,
    },
  ];
  actualExcuses = [
    {
      id: 'actual-excuse-correction-conflict',
      kpiPlanId: 'kpi-plan-published',
      allocationId: 'kpi-plan-published-alloc-1',
      metricCode: 'CONTENT_OUTPUT_COUNT',
      actualDate: '2026-05-15',
      status: 'EXCUSED',
      reasonCode: 'MEMBER_LEAVE',
      reasonText: 'Approved leave',
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      deletedAt: null,
      deletedByActorId: null,
    },
    {
      id: 'actual-not-required-correction-conflict',
      kpiPlanId: 'kpi-plan-published',
      allocationId: 'kpi-plan-published-alloc-1',
      metricCode: 'CONTENT_OUTPUT_COUNT',
      actualDate: '2026-05-14',
      status: 'NOT_REQUIRED',
      reasonCode: 'NO_OPERATION_REQUIRED',
      reasonText: 'No operation required',
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      deletedAt: null,
      deletedByActorId: null,
    },
  ];
};

resetKpiMockData();

const rejectUnsupportedQuery = (searchParams: URLSearchParams, allowedKeys: readonly string[]) => {
  const allowed = new Set(allowedKeys);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key)) {
      return HttpResponse.json({ message: `Unsupported query key: ${key}` }, { status: 422 });
    }
  }
  return undefined;
};

const rejectUnsupportedBody = (body: Record<string, unknown>, allowedKeys: readonly string[]) => {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      return HttpResponse.json({ message: `Unsupported body key: ${key}` }, { status: 422 });
    }
  }
  return undefined;
};

const parseLimitQuery = (value: string | null) => {
  if (value == null || value === '') return 50;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > maxListLimit) {
    return null;
  }
  return numeric;
};

const validateListQuery = (searchParams: URLSearchParams) => {
  const subjectType = searchParams.get('subjectType');
  if (subjectType && !subjectTypes.includes(subjectType as KpiSubjectType)) {
    return validationError(`KPI subjectType is unsupported: ${subjectType}`);
  }
  const status = searchParams.get('status');
  if (status && !planStatuses.includes(status as KpiStatus)) {
    return validationError(`KPI status is unsupported: ${status}`);
  }
  const metricCode = searchParams.get('metricCode');
  if (metricCode && !metricCodes.includes(metricCode as KpiMetricCode)) {
    return validationError(`KPI metricCode is unsupported: ${metricCode}`);
  }
  const periodMonth = searchParams.get('periodMonth');
  if (periodMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
    return validationError('KPI periodMonth must use YYYY-MM format');
  }
  const limit = parseLimitQuery(searchParams.get('limit'));
  if (limit == null) {
    return validationError(`KPI limit must be an integer between 1 and ${maxListLimit}`);
  }
  const sortBy = searchParams.get('sortBy');
  if (sortBy && !allowedSortByValues.includes(sortBy)) {
    return validationError(`KPI sortBy is unsupported: ${sortBy}`);
  }
  const sortDirection = searchParams.get('sortDirection');
  if (sortDirection && !allowedSortDirections.includes(sortDirection.toUpperCase())) {
    return validationError(`KPI sortDirection is unsupported: ${sortDirection}`);
  }
  return undefined;
};

const validateAllocationListQuery = (searchParams: URLSearchParams) => {
  const status = searchParams.get('status');
  if (status && !allocationStatuses.includes(status as KpiAllocation['allocationStatus'])) {
    return validationError(`KPI allocationStatus is unsupported: ${status}`);
  }
  const limit = parseLimitQuery(searchParams.get('limit'));
  if (limit == null) {
    return validationError(`KPI limit must be an integer between 1 and ${maxListLimit}`);
  }
  return undefined;
};

const validateActualWorkspaceListQuery = (searchParams: URLSearchParams) => {
  const subjectType = searchParams.get('subjectType');
  if (subjectType && subjectType !== 'TALENT_GROUP' && subjectType !== 'ORG_UNIT') {
    return validationError(`KPI actual workspace subjectType is unsupported: ${subjectType}`);
  }
  const periodMonth = searchParams.get('periodMonth');
  if (periodMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
    return validationError('KPI periodMonth must use YYYY-MM format');
  }
  const limit = parseLimitQuery(searchParams.get('limit'));
  if (limit == null) {
    return validationError(`KPI limit must be an integer between 1 and ${maxListLimit}`);
  }
  const sortBy = searchParams.get('sortBy');
  if (
    sortBy &&
    !['periodMonth', 'planCode', 'revenueActual', 'achievementPercent'].includes(sortBy)
  ) {
    return validationError(`KPI actual workspace sortBy is unsupported: ${sortBy}`);
  }
  const sortDirection = searchParams.get('sortDirection');
  if (sortDirection && !allowedSortDirections.includes(sortDirection.toUpperCase())) {
    return validationError(`KPI sortDirection is unsupported: ${sortDirection}`);
  }
  const allocationCoverage = searchParams.get('allocationCoverage');
  if (
    allocationCoverage &&
    allocationCoverage !== 'complete' &&
    allocationCoverage !== 'incomplete'
  ) {
    return validationError(
      `KPI actual workspace allocationCoverage is unsupported: ${allocationCoverage}`,
    );
  }
  for (const key of ['hasOverdueActuals', 'hasPendingActuals'] as const) {
    if (searchParams.has(key) && !['true', 'false'].includes(searchParams.get(key) ?? '')) {
      return validationError(`KPI actual workspace ${key} must be true or false`);
    }
  }
  return undefined;
};

const validateManagedMemberQuery = (searchParams: URLSearchParams) => {
  const limit = parseLimitQuery(searchParams.get('limit'));
  if (limit == null) {
    return validationError(`KPI limit must be an integer between 1 and ${maxListLimit}`);
  }
  return undefined;
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return {};
  }
  const body = (await request.json()) as unknown;
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
};

const readPlan = (id: string) => plans.find((plan) => plan.id === id);

const requireAllocationStatus = (
  plan: KpiPlan,
  expectedStatus: KpiAllocation['allocationStatus'],
) => {
  const rows = allocations[plan.id] ?? [];
  if (
    rows.length === 0 ||
    rows.some((allocation) => allocation.allocationStatus !== expectedStatus)
  ) {
    return HttpResponse.json(
      { message: `KPI allocation requires status ${expectedStatus}` },
      { status: 409 },
    );
  }
  return undefined;
};

const validatePublishAllocationPreconditions = (plan: KpiPlan) => {
  const rows = allocations[plan.id] ?? [];
  if (rows.length === 0) {
    return HttpResponse.json(
      { message: 'KPI TALENT_GROUP publish requires allocation rows' },
      { status: 409 },
    );
  }
  const targetRows = targets[plan.id] ?? [];
  const totals = new Map<KpiMetricCode, number>();
  targetRows.forEach((metric) => totals.set(metric.metricCode, 0));
  for (const allocation of rows) {
    const memberIsActive =
      plan.subjectType === 'ORG_UNIT'
        ? orgUnitManagedMembers.some(
            (member) =>
              member.orgUnitId === plan.subjectId &&
              member.employmentProfileId === allocation.memberEmploymentProfileId,
          )
        : managedMembers.some(
            (member) =>
              member.groupId === plan.subjectId && member.talentId === allocation.memberTalentId,
          );
    if (!memberIsActive) {
      return HttpResponse.json(
        {
          message: `KPI allocation member must still be active at publish: ${
            allocation.memberEmploymentProfileId ?? allocation.memberTalentId
          }`,
        },
        { status: 409 },
      );
    }
    for (const metric of allocation.targetMetrics) {
      const metricValidation = validateMetricPayload([metric], {
        path: 'allocations[].targetMetrics',
        allowedMetricCodes: new Set(targetRows.map((target) => target.metricCode)),
      });
      if (!metricValidation.ok) {
        return validationError(metricValidation.message, metricValidation.status);
      }
      totals.set(metric.metricCode, (totals.get(metric.metricCode) ?? 0) + metric.targetValue);
    }
  }
  for (const target of targetRows) {
    const total = totals.get(target.metricCode) ?? 0;
    if (Math.abs(total - target.targetValue) > 0.000001) {
      return HttpResponse.json(
        {
          message: `KPI allocation total for ${target.metricCode} must equal plan target ${target.targetValue}; received ${total}`,
        },
        { status: 409 },
      );
    }
  }
  return undefined;
};

const toDetail = (plan: KpiPlan) => ({
  ...plan,
  targetMetrics: targets[plan.id] ?? [],
  allocations:
    plan.subjectType === 'TALENT_GROUP'
      ? (allocations[plan.id] ?? []).filter(
          (allocation) =>
            typeof allocation.groupId === 'string' && typeof allocation.memberTalentId === 'string',
        )
      : [],
});

const toAllocationWorkflowSummary = (rows: KpiAllocation[]): KpiAllocationWorkflowSummary => {
  const byStatus = {
    draft: rows.filter((allocation) => allocation.allocationStatus === 'DRAFT').length,
    pendingApproval: rows.filter((allocation) => allocation.allocationStatus === 'PENDING_APPROVAL')
      .length,
    approved: rows.filter((allocation) => allocation.allocationStatus === 'APPROVED').length,
    published: rows.filter((allocation) => allocation.allocationStatus === 'PUBLISHED').length,
    rejected: rows.filter((allocation) => allocation.allocationStatus === 'REJECTED').length,
    active: rows.filter((allocation) => allocation.allocationStatus === 'ACTIVE').length,
    closed: rows.filter((allocation) => allocation.allocationStatus === 'CLOSED').length,
    cancelled: rows.filter((allocation) => allocation.allocationStatus === 'CANCELLED').length,
  };

  return {
    total: rows.length,
    byStatus,
    hasDraft: byStatus.draft > 0,
    hasPendingApproval: byStatus.pendingApproval > 0,
    hasApproved: byStatus.approved > 0,
    hasPublished: byStatus.published > 0,
    hasRejected: byStatus.rejected > 0,
    hasLegacyActive: byStatus.active > 0,
    officialPublishedCount: byStatus.published,
  };
};

const toListPlan = (plan: KpiPlan): KpiListPlan => {
  const { finalResult, ...listPlan } = plan;
  void finalResult;
  return {
    ...listPlan,
    allocationWorkflowSummary: toAllocationWorkflowSummary(allocations[plan.id] ?? []),
  };
};

const toProgressPlan = (plan: KpiPlan) => ({
  id: plan.id,
  planCode: plan.planCode,
  subjectType: plan.subjectType,
  subjectId: plan.subjectId,
  status: plan.status,
  periodMonth: plan.periodMonth,
  periodStartAt: plan.periodStartAt,
  periodEndAt: plan.periodEndAt,
  timezone: plan.timezone,
});

const filterPlans = (request: Request) => {
  const url = new URL(request.url);
  let rows = [...plans];
  const search = url.searchParams.get('search');
  if (search) {
    rows = rows.filter(
      (plan) =>
        plan.planCode.toLowerCase().includes(search.toLowerCase()) ||
        plan.title.toLowerCase().includes(search.toLowerCase()),
    );
  }
  if (url.searchParams.get('subjectType')) {
    rows = rows.filter((plan) => plan.subjectType === url.searchParams.get('subjectType'));
  }
  if (url.searchParams.get('status')) {
    rows = rows.filter((plan) => plan.status === url.searchParams.get('status'));
  }
  if (url.searchParams.get('periodMonth')) {
    rows = rows.filter((plan) => plan.periodMonth === url.searchParams.get('periodMonth'));
  }
  if (url.searchParams.get('metricCode')) {
    rows = rows.filter((plan) =>
      (targets[plan.id] ?? []).some(
        (metric) => metric.metricCode === url.searchParams.get('metricCode'),
      ),
    );
  }
  if (url.searchParams.get('subjectId')) {
    rows = rows.filter((plan) => plan.subjectId === url.searchParams.get('subjectId'));
  }
  if (url.searchParams.get('groupId')) {
    rows = rows.filter((plan) => plan.subjectId === url.searchParams.get('groupId'));
  }
  return rows;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string; status?: number };
type MetricInput = { metricCode: KpiMetricCode; targetValue: number };
type PlanAllocationInput = {
  memberTalentId: string;
  membershipId: string | null;
  allocationStartDate: string;
  allocationEndDate: string | null;
  targetMetrics: MetricInput[];
  snapshotMemberDisplayName: string | null;
};
type DraftAllocationInput = {
  employmentProfileId: string;
  allocationStartDate: string;
  allocationEndDate: string | null;
  targetMetrics: MetricInput[];
  note: string | null;
};

const validationError = (message: string, status = 400) =>
  HttpResponse.json({ message }, { status });

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const rejectUnknownRecordKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): ValidationResult<Record<string, unknown>> => {
  const allowed = new Set(allowedKeys);
  const unsupported = Object.keys(value).find((key) => !allowed.has(key));
  if (unsupported) {
    return { ok: false, message: `Unsupported ${path} key: ${unsupported}` };
  }
  return { ok: true, value };
};

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const hasAtMostDecimalPlaces = (value: number, places: number): boolean =>
  Number.isInteger(Number((value * 10 ** places).toFixed(8)));

const parseContractDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !allocationContractDatePattern.test(value)) {
    return null;
  }
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
};

const parseActualDate = (
  value: unknown,
): { day: number; month: number; year: number; text: string } | null => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { day, month, year, text: value };
};

const actualDateInPlanPeriod = (plan: KpiPlan, actualDate: string): boolean => {
  const parsed = parseActualDate(actualDate);
  if (!parsed) return false;
  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}` === plan.periodMonth;
};

const hcmLocalDateTimeToUtcMs = (actualDate: string, localTime: string, dayOffset = 0): number => {
  const parsed = parseActualDate(actualDate);
  if (!parsed) return Number.NaN;
  const [hourText, minuteText] = localTime.split(':');
  return Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day + dayOffset,
    Number(hourText) - 7,
    Number(minuteText),
    0,
    0,
  );
};

const isDirectEditWindowOpen = (actualDate: string, currentTime = Date.now()): boolean => {
  const windowStart = hcmLocalDateTimeToUtcMs(actualDate, '00:00');
  const windowEnd = hcmLocalDateTimeToUtcMs(actualDate, '10:00', 1);
  return currentTime >= windowStart && currentTime <= windowEnd;
};

const directEditWindowClosed = () =>
  HttpResponse.json(
    { message: 'KPI actual direct edit window is closed; correction is required' },
    { status: 409 },
  );

const correctionDuringDirectEditWindow = () =>
  HttpResponse.json(
    {
      message:
        'KPI actual correction is allowed only after the direct edit window closes; use direct edit before cutoff',
    },
    { status: 409 },
  );

const finalizedKpiReadOnly = () =>
  HttpResponse.json({ message: 'Finalized KPI is read-only' }, { status: 409 });

const isPastCreatePeriodMonth = (periodMonth: string): boolean =>
  periodMonth < currentKpiCreateMonth;

const validateMetricPayload = (
  items: unknown,
  options: {
    path?: string;
    requireNonEmpty?: boolean;
    allowedMetricCodes?: ReadonlySet<KpiMetricCode>;
  } = {},
): ValidationResult<MetricInput[]> => {
  const path = options.path ?? 'targetMetrics';
  if (!Array.isArray(items)) {
    return { ok: false, message: `KPI ${path} must be an array` };
  }
  if (options.requireNonEmpty !== false && items.length === 0) {
    return { ok: false, message: `KPI ${path} requires at least one metric` };
  }

  const seen = new Set<KpiMetricCode>();
  const normalized: MetricInput[] = [];
  for (const [index, item] of items.entries()) {
    if (!isPlainRecord(item)) {
      return { ok: false, message: `KPI ${path}[${index}] must be an object` };
    }
    const keys = rejectUnknownRecordKeys(item, ['metricCode', 'targetValue'], `${path}[${index}]`);
    if (!keys.ok) return keys;

    const metricCode = item.metricCode;
    if (typeof metricCode !== 'string' || !metricCodes.includes(metricCode as KpiMetricCode)) {
      return { ok: false, message: `KPI metricCode is unsupported: ${String(metricCode)}` };
    }
    const normalizedCode = metricCode as KpiMetricCode;
    if (options.allowedMetricCodes && !options.allowedMetricCodes.has(normalizedCode)) {
      return {
        ok: false,
        message: `KPI allocation metricCode ${normalizedCode} is not in plan target metrics`,
      };
    }
    if (seen.has(normalizedCode)) {
      return { ok: false, message: `KPI ${path} duplicates metricCode ${normalizedCode}` };
    }
    seen.add(normalizedCode);

    const targetValue = item.targetValue;
    if (!isNumber(targetValue) || targetValue < 0) {
      return {
        ok: false,
        message: `KPI ${normalizedCode} requires a finite non-negative numeric target value`,
      };
    }
    if (integerTargetMetricCodes.has(normalizedCode) && !Number.isInteger(targetValue)) {
      return { ok: false, message: `${normalizedCode} requires an integer target value` };
    }
    if (normalizedCode === 'LIVE_HOURS' && !hasAtMostDecimalPlaces(targetValue, 2)) {
      return { ok: false, message: 'LIVE_HOURS supports at most 2 decimal places' };
    }
    normalized.push({ metricCode: normalizedCode, targetValue });
  }
  return { ok: true, value: normalized };
};

const validatePlanAllocationPayload = (
  items: unknown,
  planMetricCodes: ReadonlySet<KpiMetricCode>,
): ValidationResult<PlanAllocationInput[]> => {
  if (!Array.isArray(items)) {
    return { ok: false, message: 'KPI allocations must be an array' };
  }

  const seenMembers = new Set<string>();
  const normalized: PlanAllocationInput[] = [];
  for (const [index, item] of items.entries()) {
    if (!isPlainRecord(item)) {
      return { ok: false, message: `KPI allocations[${index}] must be an object` };
    }
    const keys = rejectUnknownRecordKeys(
      item,
      [
        'memberTalentId',
        'membershipId',
        'allocationStartDate',
        'allocationEndDate',
        'targetMetrics',
        'snapshotMemberDisplayName',
      ],
      `allocations[${index}]`,
    );
    if (!keys.ok) return keys;

    const memberTalentId =
      typeof item.memberTalentId === 'string' ? item.memberTalentId.trim() : '';
    if (!memberTalentId) {
      return { ok: false, message: `KPI allocations[${index}].memberTalentId is required` };
    }
    if (seenMembers.has(memberTalentId)) {
      return { ok: false, message: `KPI allocations duplicate memberTalentId ${memberTalentId}` };
    }
    seenMembers.add(memberTalentId);

    const allocationStartDate = parseContractDate(item.allocationStartDate);
    if (!allocationStartDate) {
      return {
        ok: false,
        message: `KPI allocations[${index}].allocationStartDate must use YYYY-MM-DD`,
      };
    }
    const allocationEndDate =
      item.allocationEndDate == null ? null : parseContractDate(item.allocationEndDate);
    if (item.allocationEndDate != null && !allocationEndDate) {
      return {
        ok: false,
        message: `KPI allocations[${index}].allocationEndDate must use YYYY-MM-DD`,
      };
    }
    const metrics = validateMetricPayload(item.targetMetrics, {
      path: `allocations[${index}].targetMetrics`,
      requireNonEmpty: false,
      allowedMetricCodes: planMetricCodes,
    });
    if (!metrics.ok) return metrics;

    normalized.push({
      memberTalentId,
      membershipId: (item.membershipId as string | null | undefined) ?? null,
      allocationStartDate,
      allocationEndDate,
      targetMetrics: metrics.value,
      snapshotMemberDisplayName:
        (item.snapshotMemberDisplayName as string | null | undefined) ?? null,
    });
  }
  return { ok: true, value: normalized };
};

const validateDraftAllocationPayload = (
  items: unknown,
  plan: KpiPlan,
): ValidationResult<DraftAllocationInput[]> => {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: 'Invalid allocation draft' };
  }

  const planMetricCodes = new Set((targets[plan.id] ?? []).map((metric) => metric.metricCode));
  const seenProfiles = new Set<string>();
  const normalized: DraftAllocationInput[] = [];
  for (const [index, item] of items.entries()) {
    if (!isPlainRecord(item)) {
      return { ok: false, message: `KPI allocations[${index}] must be an object` };
    }
    const keys = rejectUnknownRecordKeys(
      item,
      ['employmentProfileId', 'allocationStartDate', 'allocationEndDate', 'targetMetrics', 'note'],
      `allocations[${index}]`,
    );
    if (!keys.ok) return keys;

    const employmentProfileId =
      typeof item.employmentProfileId === 'string' ? item.employmentProfileId.trim() : '';
    if (!employmentProfileId) {
      return { ok: false, message: `KPI allocations[${index}].employmentProfileId is required` };
    }
    if (seenProfiles.has(employmentProfileId)) {
      return {
        ok: false,
        message: `KPI allocations duplicate employmentProfileId ${employmentProfileId}`,
      };
    }
    seenProfiles.add(employmentProfileId);
    if (plan.subjectType === 'ORG_UNIT' && employmentProfileId === 'ep-manager') {
      return {
        ok: false,
        message: 'KPI Org Unit allocation cannot include the current manager as a member',
        status: 409,
      };
    }
    const isActiveManagedMember =
      plan.subjectType === 'ORG_UNIT'
        ? orgUnitManagedMembers.some(
            (member) =>
              member.orgUnitId === plan.subjectId &&
              member.employmentProfileId === employmentProfileId,
          )
        : managedMembers.some(
            (member) =>
              member.groupId === plan.subjectId &&
              member.employmentProfileId === employmentProfileId,
          );
    if (!isActiveManagedMember) {
      return {
        ok: false,
        message: `KPI allocation employmentProfileId is not an active managed member: ${employmentProfileId}`,
        status: 409,
      };
    }

    const allocationStartDate = parseContractDate(item.allocationStartDate);
    if (!allocationStartDate) {
      return {
        ok: false,
        message: `KPI allocations[${index}].allocationStartDate must use YYYY-MM-DD`,
      };
    }
    const allocationEndDate =
      item.allocationEndDate == null ? null : parseContractDate(item.allocationEndDate);
    if (item.allocationEndDate != null && !allocationEndDate) {
      return {
        ok: false,
        message: `KPI allocations[${index}].allocationEndDate must use YYYY-MM-DD`,
      };
    }
    const metrics = validateMetricPayload(item.targetMetrics, {
      path: `allocations[${index}].targetMetrics`,
      requireNonEmpty: false,
      allowedMetricCodes: planMetricCodes,
    });
    if (!metrics.ok) return metrics;

    normalized.push({
      employmentProfileId,
      allocationStartDate,
      allocationEndDate,
      targetMetrics: metrics.value,
      note: (item.note as string | null | undefined) ?? null,
    });
  }
  return { ok: true, value: normalized };
};

const toTargetMetrics = (
  kpiPlanId: string,
  items: Array<{ metricCode: KpiMetricCode; targetValue: number }>,
): KpiTargetMetric[] =>
  items.map((item, index) => ({
    id: `${kpiPlanId}-metric-${index}`,
    kpiPlanId,
    metricCode: item.metricCode,
    targetValue: item.targetValue,
    unit: metricUnits[item.metricCode],
    rollupMethod: 'SUM',
    actualSource: 'MANUAL',
    createdAt: now,
    updatedAt: now,
  }));

const readEntry = (
  kpiPlanId: string,
  allocationId: string,
  metricCode: KpiMetricCode,
  actualDate: string,
) =>
  actualEntries.find(
    (entry) =>
      entry.kpiPlanId === kpiPlanId &&
      entry.allocationId === allocationId &&
      entry.metricCode === metricCode &&
      entry.actualDate === actualDate,
  );

const readActiveExcuse = (
  kpiPlanId: string,
  allocationId: string,
  metricCode: KpiMetricCode,
  actualDate: string,
) =>
  actualExcuses.find(
    (excuse) =>
      excuse.kpiPlanId === kpiPlanId &&
      excuse.allocationId === allocationId &&
      excuse.metricCode === metricCode &&
      excuse.actualDate === actualDate &&
      excuse.deletedAt === null,
  );

const exposeExcuse = (excuse: ActualExcuse) => ({
  id: excuse.id,
  status: excuse.status,
  reasonCode: excuse.reasonCode,
  reasonText: excuse.reasonText,
  createdAt: excuse.createdAt,
  createdByActorId: excuse.createdByActorId,
  updatedAt: excuse.updatedAt,
  updatedByActorId: excuse.updatedByActorId,
});

const exposeCorrection = (correction: ActualCorrection) => ({
  id: correction.id,
  actualEntryId: correction.actualEntryId,
  kpiPlanId: correction.kpiPlanId,
  allocationId: correction.allocationId,
  metricCode: correction.metricCode,
  actualDate: correction.actualDate,
  previousValue: correction.previousValue,
  correctedValue: correction.correctedValue,
  reason: correction.reason,
  correctedAt: correction.correctedAt,
  createdAt: correction.createdAt,
});

const getDailyActualStatus = ({
  plan,
  allocation,
  entry,
  excuse,
  actualDate,
  currentTime = Date.now(),
}: {
  plan: KpiPlan;
  allocation: KpiAllocation;
  entry?: ActualEntry;
  excuse?: ActualExcuse;
  actualDate: string;
  currentTime?: number;
}): KpiDailyActualStatus => {
  if (plan.status !== 'PUBLISHED') return 'BLOCKED_BY_PLAN_STATUS';
  if (allocation.allocationStatus !== 'PUBLISHED') return 'BLOCKED_BY_ALLOCATION_STATUS';
  if (excuse) return excuse.status;
  if (entry) return entry.effectiveValue === 0 ? 'ENTERED_ZERO' : 'ENTERED';
  if (hcmLocalDateTimeToUtcMs(actualDate, '00:00') > currentTime) return 'NOT_DUE';
  return currentTime <= hcmLocalDateTimeToUtcMs(actualDate, '10:00', 1) ? 'DUE_OPEN' : 'OVERDUE';
};

const emptyActualEntryStatusSummary = () => ({
  expectedEntryCount: 0,
  enteredEntryCount: 0,
  enteredZeroCount: 0,
  pendingEntryCount: 0,
  overdueEntryCount: 0,
  excusedEntryCount: 0,
  notRequiredEntryCount: 0,
  notDueEntryCount: 0,
});

const actualWorkspaceStatusSummaryFixtures: Record<
  string,
  ReturnType<typeof emptyActualEntryStatusSummary>
> = {
  'kpi-plan-status-overdue-only': {
    ...emptyActualEntryStatusSummary(),
    expectedEntryCount: 1,
    overdueEntryCount: 1,
  },
  'kpi-plan-status-due-open-only': {
    ...emptyActualEntryStatusSummary(),
    expectedEntryCount: 1,
    pendingEntryCount: 1,
  },
  'kpi-plan-status-both': {
    ...emptyActualEntryStatusSummary(),
    expectedEntryCount: 2,
    pendingEntryCount: 1,
    overdueEntryCount: 1,
  },
  'kpi-plan-status-neither': emptyActualEntryStatusSummary(),
  'kpi-plan-status-entered-zero': {
    ...emptyActualEntryStatusSummary(),
    expectedEntryCount: 1,
    enteredZeroCount: 1,
  },
  'kpi-plan-status-excused-not-required': {
    ...emptyActualEntryStatusSummary(),
    expectedEntryCount: 2,
    excusedEntryCount: 1,
    notRequiredEntryCount: 1,
  },
  'kpi-plan-status-not-due': {
    ...emptyActualEntryStatusSummary(),
    expectedEntryCount: 1,
    notDueEntryCount: 1,
  },
};

const statusSummaryForAllocations = (plan: KpiPlan, planAllocations: KpiAllocation[]) => {
  const fixture = actualWorkspaceStatusSummaryFixtures[plan.id];
  if (fixture) {
    return { ...fixture };
  }
  const summary = emptyActualEntryStatusSummary();
  const statusDate = plan.periodMonth === '2026-05' ? '2026-05-16' : '2026-04-16';
  const planTargets = targets[plan.id] ?? [];
  for (const allocation of planAllocations) {
    for (const metric of planTargets) {
      summary.expectedEntryCount += 1;
      const entry = readEntry(plan.id, allocation.id, metric.metricCode, statusDate);
      const excuse = readActiveExcuse(plan.id, allocation.id, metric.metricCode, statusDate);
      const status = getDailyActualStatus({
        plan,
        allocation,
        entry,
        excuse,
        actualDate: statusDate,
      });
      if (status === 'ENTERED') summary.enteredEntryCount += 1;
      if (status === 'ENTERED_ZERO') summary.enteredZeroCount += 1;
      if (status === 'DUE_OPEN') summary.pendingEntryCount += 1;
      if (status === 'OVERDUE') summary.overdueEntryCount += 1;
      if (status === 'EXCUSED') summary.excusedEntryCount += 1;
      if (status === 'NOT_REQUIRED') summary.notRequiredEntryCount += 1;
      if (status === 'NOT_DUE') summary.notDueEntryCount += 1;
    }
  }
  return summary;
};

const toActualGrid = (plan: KpiPlan, actualDate: string) => {
  const isPublished = plan.status === 'PUBLISHED';
  const isFinalized = plan.status === 'FINALIZED';
  const isWindowOpen = isDirectEditWindowOpen(actualDate);
  const isGridDirectEditOpen = isPublished && isWindowOpen;
  const gridDisabledReason = isFinalized
    ? 'PLAN_FINALIZED'
    : !isPublished
      ? 'PLAN_NOT_PUBLISHED'
      : isWindowOpen
        ? null
        : 'DIRECT_EDIT_WINDOW_CLOSED';
  return {
    kpiPlanId: plan.id,
    planCode: plan.planCode,
    status: plan.status,
    subjectType: plan.subjectType,
    subjectId: plan.subjectId,
    actualDate,
    policy: {
      timezone: 'Asia/Ho_Chi_Minh',
      entryOpenLocalTime: '00:00',
      entryLockLocalTime: '10:00',
      maxDirectEditsPerEntry: 3,
      correctionAllowedUntil: 'PLAN_FINALIZED',
    },
    editability: {
      isDirectEditOpen: isGridDirectEditOpen,
      isPlanFinalized: isFinalized,
      disabledReason: gridDisabledReason,
    },
    targetMetrics: (targets[plan.id] ?? []).map((metric) => ({
      metricCode: metric.metricCode,
      targetValue: metric.targetValue,
      unit: metric.unit,
    })),
    rows: (allocations[plan.id] ?? [])
      .filter((allocation) => allocation.allocationStatus === 'PUBLISHED')
      .map((allocation) => ({
        allocationId: allocation.id,
        memberTalentId: allocation.memberTalentId,
        memberDisplayName: allocation.snapshotMemberDisplayName,
        allocationStatus: allocation.allocationStatus,
        metrics: (targets[plan.id] ?? []).map((metric) => {
          const entry = readEntry(plan.id, allocation.id, metric.metricCode, actualDate);
          const excuse = readActiveExcuse(plan.id, allocation.id, metric.metricCode, actualDate);
          const locked = entry ? entry.editCount >= 3 || !isGridDirectEditOpen : false;
          const dailyActualStatus = getDailyActualStatus({
            plan,
            allocation,
            entry,
            excuse,
            actualDate,
          });
          const canMarkExcused =
            isPublished && allocation.allocationStatus === 'PUBLISHED' && !entry && !excuse;
          const canUnmarkExcused = isPublished && Boolean(excuse);
          return {
            metricCode: metric.metricCode,
            targetValue: metric.targetValue,
            actualEntryId: entry?.id ?? null,
            actualValue: entry?.actualValue ?? null,
            effectiveValue: entry?.effectiveValue ?? 0,
            hasEntry: Boolean(entry),
            dailyActualStatus,
            actualExcuse: excuse ? exposeExcuse(excuse) : null,
            editCount: entry?.editCount ?? 0,
            correctionCount: entry?.correctionCount ?? 0,
            latestCorrectionId: entry?.latestCorrectionId ?? null,
            canDirectEdit: Boolean(entry) && !locked,
            canMarkExcused,
            canUnmarkExcused,
            requiresCorrection: Boolean(entry) && locked,
            disabledReason: locked ? (gridDisabledReason ?? 'DIRECT_EDIT_LIMIT_EXCEEDED') : null,
          };
        }),
      })),
  };
};

const toOrgUnitAllocation = (allocation: KpiAllocation) => ({
  id: allocation.id,
  kpiPlanId: allocation.kpiPlanId,
  memberEmploymentProfileId: allocation.memberEmploymentProfileId ?? 'employment-profile-unknown',
  memberTalentId: allocation.memberTalentId,
  groupId: allocation.groupId,
  allocationStatus: allocation.allocationStatus,
  allocationStartDate: allocation.allocationStartDate,
  allocationEndDate: allocation.allocationEndDate,
  targetMetrics: allocation.targetMetrics.map((metric) => ({ ...metric })),
  snapshotMemberDisplayName: allocation.snapshotMemberDisplayName,
  note: allocation.note,
  createdAt: allocation.createdAt,
  createdByActorId: allocation.createdByActorId,
  updatedAt: allocation.updatedAt,
  updatedByActorId: allocation.updatedByActorId,
  submittedAt: allocation.submittedAt,
  submittedByActorId: allocation.submittedByActorId,
  approvedAt: allocation.approvedAt,
  approvedByActorId: allocation.approvedByActorId,
  approvalNote: allocation.approvalNote,
  rejectedAt: allocation.rejectedAt,
  rejectedByActorId: allocation.rejectedByActorId,
  rejectionReason: allocation.rejectionReason,
  publishedAt: allocation.publishedAt,
  publishedByActorId: allocation.publishedByActorId,
  closedAt: allocation.closedAt,
});

const toOrgUnitActualGrid = (plan: KpiPlan, actualDate: string) => {
  const grid = toActualGrid(plan, actualDate);
  return {
    ...grid,
    subjectType: 'ORG_UNIT' as const,
    rows: (allocations[plan.id] ?? [])
      .filter((allocation) => allocation.allocationStatus === 'PUBLISHED')
      .map((allocation) => {
        const row = grid.rows.find((item) => item.allocationId === allocation.id);
        return {
          allocationId: allocation.id,
          memberEmploymentProfileId:
            allocation.memberEmploymentProfileId ?? 'employment-profile-unknown',
          memberTalentId: allocation.memberTalentId,
          memberDisplayName: allocation.snapshotMemberDisplayName,
          allocationStatus: allocation.allocationStatus,
          metrics: row?.metrics ?? [],
        };
      }),
  };
};

const exposeOrgUnitActualEntry = (entry: ActualEntry) => {
  const allocation = (allocations[entry.kpiPlanId] ?? []).find(
    (item) => item.id === entry.allocationId,
  );
  return {
    ...entry,
    memberEmploymentProfileId:
      allocation?.memberEmploymentProfileId ?? 'employment-profile-unknown',
    memberTalentId: allocation?.memberTalentId ?? null,
  };
};

const exposeTalentGroupActualEntry = (entry: ActualEntry) => {
  const { memberEmploymentProfileId: _memberEmploymentProfileId, ...safeEntry } = entry;
  void _memberEmploymentProfileId;
  return {
    ...safeEntry,
    memberTalentId: safeEntry.memberTalentId ?? 'talent-unknown',
  };
};

type WorkspaceMemberActual = {
  values: Partial<Record<KpiMetricCode, number>>;
  missing: number;
};

const workspaceMemberActuals: Record<string, Record<string, WorkspaceMemberActual>> = {
  'kpi-plan-published': {
    'kpi-plan-published-alloc-1': {
      values: { REVENUE_VND: 500000, CONTENT_OUTPUT_COUNT: 5 },
      missing: 0,
    },
    'kpi-plan-published-alloc-2': {
      values: { REVENUE_VND: 250000, CONTENT_OUTPUT_COUNT: 3 },
      missing: 1,
    },
  },
};

const achievementPercent = (actualValue: number, targetValue: number): number | null =>
  targetValue === 0 ? null : Number(((actualValue / targetValue) * 100).toFixed(2));

const readWorkspaceActualValue = (
  actuals: WorkspaceMemberActual,
  metricCode: KpiMetricCode,
): number => actuals.values[metricCode] ?? 0;

const toActualWorkspaceMember = (allocation: KpiAllocation) => {
  const actuals = workspaceMemberActuals[allocation.kpiPlanId]?.[allocation.id] ?? {
    values: {},
    missing: 0,
  };
  const metricSummaries = allocation.targetMetrics.map((metric) => {
    const actualValue = readWorkspaceActualValue(actuals, metric.metricCode);
    return {
      metricCode: metric.metricCode,
      targetValue: metric.targetValue,
      actualValue,
      achievementPercent: achievementPercent(actualValue, metric.targetValue),
    };
  });
  const revenue = metricSummaries.find((metric) => metric.metricCode === 'REVENUE_VND');
  return {
    allocationId: allocation.id,
    allocationStatus: 'PUBLISHED' as const,
    memberDisplayName: allocation.snapshotMemberDisplayName,
    revenue: {
      metricCode: 'REVENUE_VND' as const,
      targetValue: revenue?.targetValue ?? 0,
      actualValue: revenue?.actualValue ?? 0,
      achievementPercent: revenue?.achievementPercent ?? null,
    },
    supportingMetrics: metricSummaries.filter((metric) => metric.metricCode !== 'REVENUE_VND'),
    missingSignal: {
      count: actuals.missing,
      semantics: 'CALENDAR_DAY_METRIC_SLOT_LIMITED' as const,
    },
    actualEntryStatusSummary: statusSummaryForAllocations(
      readPlan(allocation.kpiPlanId) ?? basePlan({ id: allocation.kpiPlanId }),
      [allocation],
    ),
    actionHints: {
      canReadActualGrid: true,
      canEnterActual: true,
    },
  };
};

const toActualWorkspaceSummary = (plan: KpiPlan) => {
  const planAllocations = allocations[plan.id] ?? [];
  const publishedAllocations = planAllocations.filter(
    (allocation) => allocation.allocationStatus === 'PUBLISHED',
  );
  const members = publishedAllocations.map(toActualWorkspaceMember);
  const operationalTargetValue = members.reduce(
    (sum, member) => sum + member.revenue.targetValue,
    0,
  );
  const actualValue = members.reduce((sum, member) => sum + member.revenue.actualValue, 0);
  const supportingMetricCodes = Array.from(
    new Set(
      members.flatMap((member) => member.supportingMetrics.map((metric) => metric.metricCode)),
    ),
  );
  const supportingMetrics = supportingMetricCodes.map((metricCode) => {
    const targetValue = members.reduce(
      (sum, member) =>
        sum +
        (member.supportingMetrics.find((metric) => metric.metricCode === metricCode)?.targetValue ??
          0),
      0,
    );
    const supportingActualValue = members.reduce(
      (sum, member) =>
        sum +
        (member.supportingMetrics.find((metric) => metric.metricCode === metricCode)?.actualValue ??
          0),
      0,
    );
    return {
      metricCode,
      targetValue,
      actualValue: supportingActualValue,
      achievementPercent: achievementPercent(supportingActualValue, targetValue),
    };
  });
  const planTargetValue =
    (targets[plan.id] ?? []).find((metric) => metric.metricCode === 'REVENUE_VND')?.targetValue ??
    null;
  return {
    planId: plan.id,
    planCode: plan.planCode,
    title: plan.title,
    periodMonth: plan.periodMonth,
    subjectType: plan.subjectType as Extract<KpiSubjectType, 'TALENT_GROUP' | 'ORG_UNIT'>,
    subjectId: plan.subjectId,
    subjectRef: plan.subjectRef ?? null,
    planStatus: plan.status,
    revenue: {
      metricCode: 'REVENUE_VND' as const,
      operationalTargetValue,
      planTargetValue,
      actualValue,
      achievementPercent: achievementPercent(actualValue, operationalTargetValue),
      targetSource: 'ALLOCATED' as const,
      targetMismatch: planTargetValue !== operationalTargetValue,
    },
    allocationCoverage: {
      publishedAllocationCount: publishedAllocations.length,
      totalAllocationCount: planAllocations.length,
      isAllExistingAllocationsPublished:
        planAllocations.length > 0 && publishedAllocations.length === planAllocations.length,
    },
    supportingMetrics,
    missingSignal: {
      count: members.reduce((sum, member) => sum + member.missingSignal.count, 0),
      semantics: 'CALENDAR_DAY_METRIC_SLOT_LIMITED' as const,
    },
    actualEntryStatusSummary: statusSummaryForAllocations(plan, publishedAllocations),
    closing: {
      periodState: plan.status === 'FINALIZED' ? ('CLOSED' as const) : ('CURRENT' as const),
    },
    actionHints: {
      canReadActualGrid: true,
      canEnterActual: plan.status === 'PUBLISHED',
    },
  };
};

const toFinalResultSnapshot = (plan: KpiPlan, finalizedAt: number): KpiFinalResultSnapshot => {
  const summary = toActualWorkspaceSummary(plan);
  const members = (allocations[plan.id] ?? [])
    .filter((allocation) => allocation.allocationStatus === 'PUBLISHED')
    .map(toActualWorkspaceMember);
  return {
    snapshotVersion: 1,
    planId: plan.id,
    planCode: plan.planCode,
    periodMonth: plan.periodMonth,
    subjectType: plan.subjectType,
    subjectId: plan.subjectId,
    finalizedAt,
    revenue: {
      metricCode: summary.revenue.metricCode,
      planTargetValue: summary.revenue.planTargetValue,
      operationalTargetValue: summary.revenue.operationalTargetValue,
      actualValue: summary.revenue.actualValue,
      achievementPercent: summary.revenue.achievementPercent,
      targetMismatch: summary.revenue.targetMismatch,
    },
    allocationCoverage: summary.allocationCoverage,
    actualEntryStatusSummary: summary.actualEntryStatusSummary,
    supportingMetrics: summary.supportingMetrics,
    members: members.map((member) => ({
      allocationId: member.allocationId,
      memberDisplayName: member.memberDisplayName,
      allocationStatus: member.allocationStatus,
      revenue: member.revenue,
      supportingMetrics: member.supportingMetrics,
      actualEntryStatusSummary: member.actualEntryStatusSummary,
    })),
  };
};

type ActualWorkspaceSortBy = 'periodMonth' | 'planCode' | 'revenueActual' | 'achievementPercent';
type ActualWorkspaceSortDirection = 'ASC' | 'DESC';
type ActualWorkspaceStatusFilters = {
  hasOverdueActuals: boolean | null;
  hasPendingActuals: boolean | null;
};
type ActualWorkspaceSummary = ReturnType<typeof toActualWorkspaceSummary>;
type ActualWorkspacePlanSortRow = {
  plan: KpiPlan;
  summary: ActualWorkspaceSummary;
};

type ActualWorkspaceCursorEnvelope = {
  v: 1;
  queryKey: {
    subjectType: string | null;
    periodMonth: string | null;
    groupId: string | null;
    subjectId: string | null;
    search: string | null;
    sortBy: ActualWorkspaceSortBy;
    sortDirection: ActualWorkspaceSortDirection;
    allocationCoverage: 'complete' | 'incomplete' | null;
    hasOverdueActuals: boolean | null;
    hasPendingActuals: boolean | null;
  };
  sortBy: ActualWorkspaceSortBy;
  sortDirection: ActualWorkspaceSortDirection;
  lastValue: string | number | null;
  lastPlanId: string;
};

const actualWorkspaceCursorErrorMessage = 'KPI actual workspace cursor is invalid';

const readActualWorkspaceSortBy = (searchParams: URLSearchParams): ActualWorkspaceSortBy => {
  const value = searchParams.get('sortBy');
  return value === 'periodMonth' ||
    value === 'planCode' ||
    value === 'revenueActual' ||
    value === 'achievementPercent'
    ? value
    : 'periodMonth';
};

const readActualWorkspaceSortDirection = (
  searchParams: URLSearchParams,
): ActualWorkspaceSortDirection =>
  searchParams.get('sortDirection')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

const readActualWorkspaceCoverageFilter = (
  searchParams: URLSearchParams,
): 'complete' | 'incomplete' | null => {
  const value = searchParams.get('allocationCoverage');
  return value === 'complete' || value === 'incomplete' ? value : null;
};

const readActualWorkspaceBooleanFilter = (
  searchParams: URLSearchParams,
  key: 'hasOverdueActuals' | 'hasPendingActuals',
): boolean | null => {
  const value = searchParams.get(key);
  return value === 'true' ? true : value === 'false' ? false : null;
};

const readActualWorkspaceStatusFilters = (
  searchParams: URLSearchParams,
): ActualWorkspaceStatusFilters => ({
  hasOverdueActuals: readActualWorkspaceBooleanFilter(searchParams, 'hasOverdueActuals'),
  hasPendingActuals: readActualWorkspaceBooleanFilter(searchParams, 'hasPendingActuals'),
});

const buildActualWorkspaceQueryKey = (
  searchParams: URLSearchParams,
): ActualWorkspaceCursorEnvelope['queryKey'] => ({
  subjectType: searchParams.get('subjectType') || null,
  periodMonth: searchParams.get('periodMonth') || null,
  groupId: searchParams.get('groupId') || null,
  subjectId: searchParams.get('subjectId') || null,
  search: searchParams.get('search') || null,
  sortBy: readActualWorkspaceSortBy(searchParams),
  sortDirection: readActualWorkspaceSortDirection(searchParams),
  allocationCoverage: readActualWorkspaceCoverageFilter(searchParams),
  ...readActualWorkspaceStatusFilters(searchParams),
});

const encodeActualWorkspaceCursor = (cursor: ActualWorkspaceCursorEnvelope): string =>
  btoa(JSON.stringify(cursor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const decodeActualWorkspaceCursor = (
  value: string,
  expectedQueryKey: ActualWorkspaceCursorEnvelope['queryKey'],
): ActualWorkspaceCursorEnvelope => {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
    const parsed = JSON.parse(atob(padded)) as Partial<ActualWorkspaceCursorEnvelope>;
    if (
      parsed.v !== 1 ||
      (parsed.sortBy !== 'periodMonth' &&
        parsed.sortBy !== 'planCode' &&
        parsed.sortBy !== 'revenueActual' &&
        parsed.sortBy !== 'achievementPercent') ||
      (parsed.sortDirection !== 'ASC' && parsed.sortDirection !== 'DESC') ||
      !(
        typeof parsed.lastValue === 'string' ||
        typeof parsed.lastValue === 'number' ||
        parsed.lastValue === null
      ) ||
      typeof parsed.lastPlanId !== 'string' ||
      JSON.stringify(parsed.queryKey) !== JSON.stringify(expectedQueryKey) ||
      parsed.sortBy !== expectedQueryKey.sortBy ||
      parsed.sortDirection !== expectedQueryKey.sortDirection
    ) {
      throw new Error(actualWorkspaceCursorErrorMessage);
    }
    return parsed as ActualWorkspaceCursorEnvelope;
  } catch {
    throw new Error(actualWorkspaceCursorErrorMessage);
  }
};

const matchesActualWorkspaceCoverage = (
  plan: KpiPlan,
  allocationCoverage: 'complete' | 'incomplete' | null,
): boolean => {
  if (!allocationCoverage) {
    return true;
  }
  const planAllocations = allocations[plan.id] ?? [];
  const publishedCount = planAllocations.filter(
    (allocation) => allocation.allocationStatus === 'PUBLISHED',
  ).length;
  const isComplete = planAllocations.length > 0 && publishedCount === planAllocations.length;
  return allocationCoverage === 'complete' ? isComplete : !isComplete;
};

const matchesActualWorkspaceStatusFilters = (
  summary: ActualWorkspaceSummary,
  filters: ActualWorkspaceStatusFilters,
): boolean =>
  (filters.hasOverdueActuals === null ||
    summary.actualEntryStatusSummary.overdueEntryCount > 0 === filters.hasOverdueActuals) &&
  (filters.hasPendingActuals === null ||
    summary.actualEntryStatusSummary.pendingEntryCount > 0 === filters.hasPendingActuals);

const compareActualWorkspacePlans = (
  left: ActualWorkspacePlanSortRow,
  right: ActualWorkspacePlanSortRow,
  sortBy: ActualWorkspaceSortBy,
  sortDirection: ActualWorkspaceSortDirection,
): number => {
  const direction = sortDirection === 'ASC' ? 1 : -1;
  if (sortBy === 'revenueActual') {
    return (
      direction * (left.summary.revenue.actualValue - right.summary.revenue.actualValue) ||
      left.plan.id.localeCompare(right.plan.id)
    );
  }
  if (sortBy === 'achievementPercent') {
    const leftValue = left.summary.revenue.achievementPercent;
    const rightValue = right.summary.revenue.achievementPercent;
    if (leftValue === null && rightValue !== null) return 1;
    if (leftValue !== null && rightValue === null) return -1;
    if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
      return direction * (leftValue - rightValue);
    }
    return left.plan.id.localeCompare(right.plan.id);
  }
  const leftValue = sortBy === 'planCode' ? left.plan.planCode : left.plan.periodMonth;
  const rightValue = sortBy === 'planCode' ? right.plan.planCode : right.plan.periodMonth;
  return (
    direction * leftValue.localeCompare(rightValue) ||
    direction * left.plan.id.localeCompare(right.plan.id)
  );
};

const actualWorkspaceCursorValue = (
  row: ActualWorkspacePlanSortRow,
  sortBy: ActualWorkspaceSortBy,
): string | number | null => {
  if (sortBy === 'planCode') return row.plan.planCode;
  if (sortBy === 'revenueActual') return row.summary.revenue.actualValue;
  if (sortBy === 'achievementPercent') return row.summary.revenue.achievementPercent;
  return row.plan.periodMonth;
};

const listActualWorkspacePlans = (request: Request) => {
  const url = new URL(request.url);
  const subjectType = url.searchParams.get('subjectType');
  const groupId = url.searchParams.get('groupId');
  const subjectId = url.searchParams.get('subjectId');
  const periodMonth = url.searchParams.get('periodMonth');
  const search = url.searchParams.get('search')?.toLowerCase();
  const sortBy = readActualWorkspaceSortBy(url.searchParams);
  const sortDirection = readActualWorkspaceSortDirection(url.searchParams);
  const allocationCoverage = readActualWorkspaceCoverageFilter(url.searchParams);
  const statusFilters = readActualWorkspaceStatusFilters(url.searchParams);
  return plans
    .filter((plan) => plan.subjectType === 'TALENT_GROUP' || plan.subjectType === 'ORG_UNIT')
    .filter((plan) => (!subjectType ? true : plan.subjectType === subjectType))
    .filter((plan) => {
      const publishedCount = (allocations[plan.id] ?? []).filter(
        (allocation) => allocation.allocationStatus === 'PUBLISHED',
      ).length;
      return plan.subjectType === 'TALENT_GROUP' || publishedCount > 0;
    })
    .filter((plan) => (!groupId ? true : plan.subjectId === groupId))
    .filter((plan) => (!subjectId ? true : plan.subjectId === subjectId))
    .filter((plan) => (!periodMonth ? true : plan.periodMonth === periodMonth))
    .filter((plan) => {
      if (!search) {
        return true;
      }
      const subjectRef = plan.subjectRef;
      return [
        plan.planCode,
        plan.title,
        subjectRef?.code,
        subjectRef?.name,
        subjectRef?.displayName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .filter((plan) => matchesActualWorkspaceCoverage(plan, allocationCoverage))
    .map((plan) => ({ plan, summary: toActualWorkspaceSummary(plan) }))
    .filter((row) => matchesActualWorkspaceStatusFilters(row.summary, statusFilters))
    .sort((left, right) => compareActualWorkspacePlans(left, right, sortBy, sortDirection));
};

const paginateActualWorkspacePlans = (
  rows: ActualWorkspacePlanSortRow[],
  searchParams: URLSearchParams,
): { rows: ActualWorkspacePlanSortRow[]; nextCursor?: string } => {
  const limit = parseLimitQuery(searchParams.get('limit')) ?? 50;
  const sortBy = readActualWorkspaceSortBy(searchParams);
  const sortDirection = readActualWorkspaceSortDirection(searchParams);
  const queryKey = buildActualWorkspaceQueryKey(searchParams);
  const cursorValue = searchParams.get('cursor');
  const startIndex =
    cursorValue === null
      ? 0
      : (() => {
          const cursor = decodeActualWorkspaceCursor(cursorValue, queryKey);
          const index = rows.findIndex((plan) => {
            const value = actualWorkspaceCursorValue(plan, sortBy);
            return value === cursor.lastValue && plan.plan.id === cursor.lastPlanId;
          });
          if (index < 0) {
            throw new Error(actualWorkspaceCursorErrorMessage);
          }
          return index + 1;
        })();
  const pageRows = rows.slice(startIndex, startIndex + limit);
  const lastRow = pageRows[pageRows.length - 1];
  return {
    rows: pageRows,
    nextCursor:
      lastRow && startIndex + pageRows.length < rows.length
        ? encodeActualWorkspaceCursor({
            v: 1,
            queryKey,
            sortBy,
            sortDirection,
            lastValue: actualWorkspaceCursorValue(lastRow, sortBy),
            lastPlanId: lastRow.plan.id,
          })
        : undefined,
  };
};

export const kpiHandlers = [
  http.get('*/admin/kpi/actual-workspace/plans', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(
      url.searchParams,
      allowedActualWorkspaceListQueryKeys,
    );
    if (unsupported) return unsupported;
    const invalid = validateActualWorkspaceListQuery(url.searchParams);
    if (invalid) return invalid;
    let page: ReturnType<typeof paginateActualWorkspacePlans>;
    try {
      page = paginateActualWorkspacePlans(listActualWorkspacePlans(request), url.searchParams);
    } catch {
      return validationError(actualWorkspaceCursorErrorMessage);
    }
    return HttpResponse.json({
      data: page.rows.map((row) => row.summary),
      ...(page.nextCursor ? { meta: { nextCursor: page.nextCursor } } : {}),
    });
  }),
  http.get('*/admin/kpi/actual-workspace/plans/:kpiPlanId', ({ params }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan || (plan.subjectType !== 'TALENT_GROUP' && plan.subjectType !== 'ORG_UNIT')) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (
      plan.subjectType === 'ORG_UNIT' &&
      !(allocations[plan.id] ?? []).some(
        (allocation) => allocation.allocationStatus === 'PUBLISHED',
      )
    ) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    return HttpResponse.json({
      data: {
        ...toActualWorkspaceSummary(plan),
        finalResult: plan.status === 'FINALIZED' ? (plan.finalResult ?? null) : null,
        members: (allocations[plan.id] ?? [])
          .filter((allocation) => allocation.allocationStatus === 'PUBLISHED')
          .map(toActualWorkspaceMember),
      },
    });
  }),
  http.get('*/admin/kpi/plans', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, allowedListQueryKeys);
    if (unsupported) return unsupported;
    const invalid = validateListQuery(url.searchParams);
    if (invalid) return invalid;
    const limit = parseLimitQuery(url.searchParams.get('limit')) ?? 50;
    return HttpResponse.json({ data: filterPlans(request).slice(0, limit).map(toListPlan) });
  }),
  http.get('*/admin/kpi/allocations', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, allowedAllocationListQueryKeys);
    if (unsupported) return unsupported;
    const invalid = validateAllocationListQuery(url.searchParams);
    if (invalid) return invalid;
    let rows = Object.values(allocations)
      .flat()
      .filter(
        (allocation) =>
          typeof allocation.groupId === 'string' &&
          typeof allocation.memberTalentId === 'string' &&
          readPlan(allocation.kpiPlanId)?.subjectType === 'TALENT_GROUP',
      );
    if (url.searchParams.get('status')) {
      rows = rows.filter(
        (allocation) => allocation.allocationStatus === url.searchParams.get('status'),
      );
    }
    if (url.searchParams.get('kpiPlanId')) {
      rows = rows.filter(
        (allocation) => allocation.kpiPlanId === url.searchParams.get('kpiPlanId'),
      );
    }
    if (url.searchParams.get('groupId')) {
      rows = rows.filter((allocation) => allocation.groupId === url.searchParams.get('groupId'));
    }
    const limit = parseLimitQuery(url.searchParams.get('limit')) ?? 50;
    return HttpResponse.json({ data: rows.slice(0, limit) });
  }),
  http.post('*/admin/kpi/plans', async ({ request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'title',
      'description',
      'subjectType',
      'subjectId',
      'currencyCode',
      'periodMonth',
      'periodStartAt',
      'periodEndAt',
      'timezone',
      'targetMetrics',
      'externalRef',
    ]);
    if (unsupported) return unsupported;
    if (!body.title || typeof body.title !== 'string') {
      return validationError('KPI title is required');
    }
    if (
      typeof body.subjectType !== 'string' ||
      !createSubjectTypes.includes(body.subjectType as KpiSubjectType)
    ) {
      return validationError(`KPI subjectType is unsupported: ${String(body.subjectType)}`);
    }
    if (!body.subjectId || typeof body.subjectId !== 'string') {
      return validationError('KPI subjectId is required');
    }
    if (body.currencyCode != null && body.currencyCode !== 'VND') {
      return validationError('KPI currencyCode supports only VND');
    }
    if (typeof body.periodMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.periodMonth)) {
      return validationError('KPI periodMonth must use YYYY-MM format');
    }
    if (isPastCreatePeriodMonth(body.periodMonth)) {
      return validationError(
        `KPI periodMonth ${body.periodMonth} is before the current HCM month ${currentKpiCreateMonth}`,
      );
    }
    if (!isNumber(body.periodStartAt) || !isNumber(body.periodEndAt)) {
      return validationError('KPI periodStartAt/periodEndAt must be numeric timestamps');
    }
    const subjectType = body.subjectType as KpiSubjectType;
    const targetValidation = validateMetricPayload(body.targetMetrics, {
      allowedMetricCodes: createMetricCodesBySubjectType[subjectType],
    });
    if (!targetValidation.ok) {
      return validationError(targetValidation.message, targetValidation.status);
    }
    planSeed += 1;
    const id = `kpi-plan-${planSeed}`;
    const plan = basePlan({
      id,
      planCode: `KPI-202605-${String(planSeed).padStart(6, '0')}`,
      title: String(body.title),
      description: (body.description as string | null | undefined) ?? null,
      subjectType,
      subjectId: String(body.subjectId),
      subjectRef: subjectRefFor(subjectType, String(body.subjectId)),
      periodMonth: String(body.periodMonth),
      periodStartAt: Number(body.periodStartAt),
      periodEndAt: Number(body.periodEndAt),
      timezone: String(body.timezone ?? 'Asia/Ho_Chi_Minh'),
      externalRef: (body.externalRef as string | null | undefined) ?? null,
    });
    plans.push(plan);
    targets[id] = toTargetMetrics(id, targetValidation.value);
    allocations[id] = [];
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.get('*/admin/kpi/my-progress', ({ request }) => {
    const plan = readPlan(new URL(request.url).searchParams.get('planId') ?? 'kpi-plan-published');
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({
      data: {
        plan: toProgressPlan(plan),
        periodElapsedPercent: 80,
        targetMetrics: targets[plan.id] ?? [],
        groupTotals: [
          {
            metricCode: 'REVENUE_VND',
            targetValue: 1000000,
            actualValue: 1250000,
            progressPercent: 125,
          },
        ],
        memberProgress: [],
      },
    });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId', ({ params }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/progress', ({ params }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({
      data: {
        plan: toProgressPlan(plan),
        periodElapsedPercent: 80,
        targetMetrics: targets[plan.id] ?? [],
        groupTotals: [
          {
            metricCode: 'REVENUE_VND',
            targetValue: 1000000,
            actualValue: 1250000,
            progressPercent: 125,
          },
          {
            metricCode: 'CONTENT_OUTPUT_COUNT',
            targetValue: 10,
            actualValue: 8,
            progressPercent: 80,
          },
        ],
        memberProgress: [
          {
            allocationId: `${plan.id}-alloc-1`,
            memberTalentId: 'talent-001',
            metricCode: 'REVENUE_VND',
            targetValue: 600000,
            actualValue: 700000,
            progressPercent: 116.67,
            actualEntryCount: 2,
            missingEntryCount: 0,
          },
          {
            allocationId: `${plan.id}-alloc-2`,
            memberTalentId: 'talent-002',
            metricCode: 'REVENUE_VND',
            targetValue: 400000,
            actualValue: 550000,
            progressPercent: 137.5,
            actualEntryCount: 1,
            missingEntryCount: 1,
          },
        ],
      },
    });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/managed-members', ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.status !== 'PUBLISHED' || plan.subjectType !== 'TALENT_GROUP') {
      return HttpResponse.json(
        { message: 'KPI allocation draft requires a PUBLISHED group KPI plan' },
        { status: 409 },
      );
    }
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, allowedManagedMemberQueryKeys);
    if (unsupported) return unsupported;
    const invalid = validateManagedMemberQuery(url.searchParams);
    if (invalid) return invalid;
    const search = url.searchParams.get('search')?.toLowerCase();
    const limit = parseLimitQuery(url.searchParams.get('limit')) ?? 20;
    const rows = managedMembers
      .filter((item) => item.groupId === plan.subjectId)
      .filter((item) =>
        search
          ? `${item.displayName} ${item.employeeCode ?? ''} ${item.talentCode ?? ''}`
              .toLowerCase()
              .includes(search)
          : true,
      )
      .slice(0, limit);
    return HttpResponse.json({ data: rows });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/org-unit-allocations', ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.subjectType !== 'ORG_UNIT') {
      return HttpResponse.json(
        { message: 'ORG_UNIT allocations require an ORG_UNIT KPI plan' },
        { status: 409 },
      );
    }
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, ['status', 'limit']);
    if (unsupported) return unsupported;
    const limit = parseLimitQuery(url.searchParams.get('limit')) ?? 50;
    let rows = allocations[plan.id] ?? [];
    if (url.searchParams.get('status')) {
      rows = rows.filter(
        (allocation) => allocation.allocationStatus === url.searchParams.get('status'),
      );
    }
    return HttpResponse.json({ data: rows.slice(0, limit).map(toOrgUnitAllocation) });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/org-unit-managed-members', ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.subjectType !== 'ORG_UNIT') {
      return HttpResponse.json(
        { message: 'ORG_UNIT managed members require an ORG_UNIT KPI plan' },
        { status: 409 },
      );
    }
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, allowedManagedMemberQueryKeys);
    if (unsupported) return unsupported;
    const invalid = validateManagedMemberQuery(url.searchParams);
    if (invalid) return invalid;
    const search = url.searchParams.get('search')?.toLowerCase();
    const limit = parseLimitQuery(url.searchParams.get('limit')) ?? 20;
    const rows = orgUnitManagedMembers
      .filter((item) => item.orgUnitId === plan.subjectId)
      .filter((item) =>
        search
          ? `${item.displayName} ${item.employeeCode ?? ''}`.toLowerCase().includes(search)
          : true,
      )
      .slice(0, limit);
    return HttpResponse.json({ data: rows });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/org-unit-progress', ({ params }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.subjectType !== 'ORG_UNIT') {
      return HttpResponse.json(
        { message: 'ORG_UNIT progress requires an ORG_UNIT KPI plan' },
        { status: 409 },
      );
    }
    const planAllocations = (allocations[plan.id] ?? []).filter(
      (allocation) => allocation.allocationStatus === 'PUBLISHED',
    );
    const actualDate = plan.periodMonth === '2026-06' ? '2026-06-15' : '2026-05-16';
    const memberProgress = planAllocations.map((allocation) => {
      const targetValue = allocation.targetMetrics[0]?.targetValue ?? 0;
      const entry = readEntry(plan.id, allocation.id, 'REVENUE_VND', actualDate);
      const actualValue = entry?.effectiveValue ?? 0;
      return {
        allocationId: allocation.id,
        memberEmploymentProfileId:
          allocation.memberEmploymentProfileId ?? 'employment-profile-unknown',
        memberTalentId: allocation.memberTalentId,
        metricCode: 'REVENUE_VND' as const,
        targetValue,
        actualValue,
        progressPercent: achievementPercent(actualValue, targetValue),
        actualEntryCount: entry ? 1 : 0,
        missingEntryCount: entry ? 0 : 1,
      };
    });
    const totalTargetValue = memberProgress.reduce((sum, item) => sum + item.targetValue, 0);
    const totalActualValue = memberProgress.reduce((sum, item) => sum + item.actualValue, 0);
    return HttpResponse.json({
      data: {
        plan: toProgressPlan(plan),
        periodElapsedPercent: 10,
        targetMetrics: targets[plan.id] ?? [],
        groupTotals: [
          {
            metricCode: 'REVENUE_VND',
            targetValue: totalTargetValue,
            actualValue: totalActualValue,
            progressPercent: achievementPercent(totalActualValue, totalTargetValue),
          },
        ],
        memberProgress,
      },
    });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/org-unit-actuals', ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.subjectType !== 'ORG_UNIT') {
      return HttpResponse.json(
        { message: 'ORG_UNIT actual grid requires an ORG_UNIT KPI plan' },
        { status: 409 },
      );
    }
    const actualDate = new URL(request.url).searchParams.get('actualDate');
    lastOrgUnitActualGridDate = actualDate ?? undefined;
    if (
      typeof actualDate !== 'string' ||
      !parseActualDate(actualDate) ||
      !actualDateInPlanPeriod(plan, actualDate)
    ) {
      return validationError('Invalid actualDate');
    }
    return HttpResponse.json({ data: toOrgUnitActualGrid(plan, actualDate) });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/org-unit-final-result', ({ params }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.subjectType !== 'ORG_UNIT') {
      return HttpResponse.json(
        { message: 'ORG_UNIT final result requires an ORG_UNIT KPI plan' },
        { status: 409 },
      );
    }
    if (plan.status !== 'FINALIZED') {
      return HttpResponse.json(
        { message: 'ORG_UNIT final result requires a FINALIZED KPI plan' },
        { status: 409 },
      );
    }
    if (plan.status === 'FINALIZED' && !plan.finalResult) {
      plan.finalResult = toFinalResultSnapshot(plan, now);
    }
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/actuals', ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const actualDate = new URL(request.url).searchParams.get('actualDate');
    if (
      typeof actualDate !== 'string' ||
      !parseActualDate(actualDate) ||
      !actualDateInPlanPeriod(plan, actualDate)
    ) {
      return validationError('Invalid actualDate');
    }
    return HttpResponse.json({ data: toActualGrid(plan, actualDate) });
  }),
  http.put('*/admin/kpi/plans/:kpiPlanId/allocation-draft', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.status !== 'PUBLISHED') {
      return HttpResponse.json(
        { message: 'KPI allocation draft requires a PUBLISHED KPI plan' },
        { status: 409 },
      );
    }
    if (
      (allocations[plan.id] ?? []).some((allocation) => allocation.allocationStatus !== 'DRAFT')
    ) {
      return HttpResponse.json(
        { message: 'KPI allocation draft can be edited only while all rows are DRAFT' },
        { status: 409 },
      );
    }
    const body = await parseJsonBody(request);
    lastAllocationDraftPayload = body;
    const unsupported = rejectUnsupportedBody(body, ['allocations']);
    if (unsupported) return unsupported;
    if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
      return HttpResponse.json({ message: 'Invalid allocation draft' }, { status: 422 });
    }
    const draftValidation = validateDraftAllocationPayload(body.allocations, plan);
    if (!draftValidation.ok) {
      return validationError(draftValidation.message, draftValidation.status);
    }
    allocations[plan.id] = draftValidation.value.map((allocation, index) => {
      const employmentProfileId = allocation.employmentProfileId;
      const talentGroupMember = managedMembers.find(
        (member) =>
          member.groupId === plan.subjectId && member.employmentProfileId === employmentProfileId,
      );
      const orgUnitMember = orgUnitManagedMembers.find(
        (member) =>
          member.orgUnitId === plan.subjectId && member.employmentProfileId === employmentProfileId,
      );
      return {
        id: `${plan.id}-alloc-${index + 1}`,
        kpiPlanId: plan.id,
        groupId: plan.subjectType === 'ORG_UNIT' ? null : plan.subjectId,
        memberEmploymentProfileId: employmentProfileId,
        memberTalentId:
          plan.subjectType === 'ORG_UNIT'
            ? null
            : (talentGroupMember?.talentId ??
              employmentProfileId.replace('employment-profile', 'talent')),
        membershipId: null,
        allocationStatus: 'DRAFT',
        allocationStartDate: allocation.allocationStartDate,
        allocationEndDate: allocation.allocationEndDate,
        targetMetrics: allocation.targetMetrics,
        snapshotMemberDisplayName:
          plan.subjectType === 'ORG_UNIT'
            ? (orgUnitMember?.displayName ?? null)
            : (talentGroupMember?.displayName ?? null),
        note: allocation.note,
        createdAt: now,
        createdByActorId: 'manager-user',
        updatedAt: now,
        updatedByActorId: 'manager-user',
        submittedAt: null,
        submittedByActorId: null,
        approvedAt: null,
        approvedByActorId: null,
        approvalNote: null,
        rejectedAt: null,
        rejectedByActorId: null,
        rejectionReason: null,
        publishedAt: null,
        publishedByActorId: null,
        closedAt: null,
      };
    });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.post('*/admin/kpi/plans/:kpiPlanId/allocation-submit', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.status !== 'PUBLISHED') {
      return HttpResponse.json(
        { message: 'KPI allocation draft requires a PUBLISHED KPI plan' },
        { status: 409 },
      );
    }
    const currentStatusError = requireAllocationStatus(plan, 'DRAFT');
    if (currentStatusError) return currentStatusError;
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, []);
    if (unsupported) return unsupported;
    if (
      plan.subjectType === 'ORG_UNIT' &&
      (allocations[plan.id] ?? []).some(
        (allocation) => allocation.memberEmploymentProfileId === 'ep-manager',
      )
    ) {
      return HttpResponse.json(
        { message: 'KPI Org Unit allocation cannot include the current manager as a member' },
        { status: 409 },
      );
    }
    (allocations[plan.id] ?? []).forEach((allocation) => {
      allocation.allocationStatus = 'PENDING_APPROVAL';
      allocation.submittedAt = now;
      allocation.submittedByActorId = 'manager-user';
      allocation.updatedAt = now;
      allocation.updatedByActorId = 'manager-user';
    });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.post('*/admin/kpi/plans/:kpiPlanId/allocation-approve', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['approvalNote']);
    if (unsupported) return unsupported;
    if (plan.status === 'FINALIZED') {
      return finalizedKpiReadOnly();
    }
    const currentStatusError = requireAllocationStatus(plan, 'PENDING_APPROVAL');
    if (currentStatusError) return currentStatusError;
    (allocations[plan.id] ?? []).forEach((allocation) => {
      allocation.allocationStatus = 'APPROVED';
      allocation.approvedAt = now;
      allocation.approvedByActorId = 'user-admin';
      allocation.approvalNote = (body.approvalNote as string | null | undefined) ?? null;
      allocation.updatedAt = now;
      allocation.updatedByActorId = 'user-admin';
    });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.post('*/admin/kpi/plans/:kpiPlanId/allocation-reject', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['rejectionReason']);
    if (unsupported) return unsupported;
    if (plan.status === 'FINALIZED') {
      return finalizedKpiReadOnly();
    }
    if (!String(body.rejectionReason ?? '').trim()) {
      return HttpResponse.json({ message: 'Reason required' }, { status: 422 });
    }
    const currentStatusError = requireAllocationStatus(plan, 'PENDING_APPROVAL');
    if (currentStatusError) return currentStatusError;
    (allocations[plan.id] ?? []).forEach((allocation) => {
      allocation.allocationStatus = 'REJECTED';
      allocation.rejectedAt = now;
      allocation.rejectedByActorId = 'user-admin';
      allocation.rejectionReason = String(body.rejectionReason);
      allocation.updatedAt = now;
      allocation.updatedByActorId = 'user-admin';
    });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.post('*/admin/kpi/plans/:kpiPlanId/allocation-publish', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, []);
    if (unsupported) return unsupported;
    const currentStatusError = requireAllocationStatus(plan, 'APPROVED');
    if (currentStatusError) return currentStatusError;
    const preconditionError = validatePublishAllocationPreconditions(plan);
    if (preconditionError) return preconditionError;
    (allocations[plan.id] ?? []).forEach((allocation) => {
      allocation.allocationStatus = 'PUBLISHED';
      allocation.publishedAt = now;
      allocation.publishedByActorId = 'user-admin';
      allocation.updatedAt = now;
      allocation.updatedByActorId = 'user-admin';
    });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.put('*/admin/kpi/plans/:kpiPlanId/allocations', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.status !== 'DRAFT') {
      return HttpResponse.json(
        { message: 'KPI allocations can be replaced only while plan is DRAFT' },
        { status: 409 },
      );
    }
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['allocations']);
    if (unsupported) return unsupported;
    const planMetricCodes = new Set((targets[plan.id] ?? []).map((metric) => metric.metricCode));
    const allocationValidation = validatePlanAllocationPayload(body.allocations, planMetricCodes);
    if (!allocationValidation.ok) {
      return validationError(allocationValidation.message, allocationValidation.status);
    }
    allocations[plan.id] = allocationValidation.value.map((allocation, index) => ({
      id: `${plan.id}-alloc-${index + 1}`,
      kpiPlanId: plan.id,
      groupId: plan.subjectId,
      memberEmploymentProfileId: null,
      memberTalentId: allocation.memberTalentId,
      membershipId: allocation.membershipId,
      allocationStatus: 'DRAFT',
      allocationStartDate: allocation.allocationStartDate,
      allocationEndDate: allocation.allocationEndDate,
      targetMetrics: allocation.targetMetrics,
      snapshotMemberDisplayName: allocation.snapshotMemberDisplayName,
      note: null,
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      submittedAt: null,
      submittedByActorId: null,
      approvedAt: null,
      approvedByActorId: null,
      approvalNote: null,
      rejectedAt: null,
      rejectedByActorId: null,
      rejectionReason: null,
      publishedAt: null,
      publishedByActorId: null,
      closedAt: null,
    }));
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.put('*/admin/kpi/plans/:kpiPlanId/target-metrics', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.status !== 'DRAFT') {
      return HttpResponse.json(
        { message: 'KPI target metrics can be replaced only while plan is DRAFT' },
        { status: 409 },
      );
    }
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['targetMetrics']);
    if (unsupported) return unsupported;
    const targetValidation = validateMetricPayload(body.targetMetrics, {
      allowedMetricCodes: createMetricCodesBySubjectType[plan.subjectType],
    });
    if (!targetValidation.ok) {
      return validationError(targetValidation.message, targetValidation.status);
    }
    targets[plan.id] = toTargetMetrics(plan.id, targetValidation.value);
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.patch('*/admin/kpi/plans/:kpiPlanId/draft-core', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'title',
      'description',
      'currencyCode',
      'periodMonth',
      'periodStartAt',
      'periodEndAt',
      'timezone',
      'externalRef',
    ]);
    if (unsupported) return unsupported;
    Object.assign(plan, body, { updatedAt: now });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.post('*/admin/kpi/plans/:kpiPlanId/actual-excuses', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'allocationId',
      'metricCode',
      'actualDate',
      'status',
      'reasonCode',
      'reasonText',
    ]);
    if (unsupported) return unsupported;
    if (!actualExcuseStatuses.includes(body.status as KpiActualExcuseStatus)) {
      return validationError(
        `KPI actual excuse status is unsupported: ${String(body.status)}`,
        422,
      );
    }
    if (!actualExcuseReasonCodes.includes(body.reasonCode as KpiActualExcuseReasonCode)) {
      return validationError(
        `KPI actual excuse reasonCode is unsupported: ${String(body.reasonCode)}`,
        422,
      );
    }
    if (!String(body.reasonText ?? '').trim()) {
      return validationError('KPI actual excuse reasonText is required', 422);
    }
    if (
      !parseActualDate(body.actualDate) ||
      !actualDateInPlanPeriod(plan, String(body.actualDate))
    ) {
      return validationError('Invalid actualDate');
    }
    if (plan.status !== 'PUBLISHED') {
      return HttpResponse.json(
        { message: 'KPI actual excuse requires a published plan' },
        { status: 409 },
      );
    }
    const metricCode = body.metricCode as KpiMetricCode;
    if (!metricCodes.includes(metricCode)) {
      return validationError(`KPI metricCode is unsupported: ${String(body.metricCode)}`);
    }
    const allocation = (allocations[plan.id] ?? []).find(
      (item) => item.id === String(body.allocationId),
    );
    if (!allocation || allocation.allocationStatus !== 'PUBLISHED') {
      return HttpResponse.json(
        { message: 'KPI actual excuse requires a published allocation' },
        { status: 409 },
      );
    }
    if (!allocation.targetMetrics.some((metric) => metric.metricCode === metricCode)) {
      return validationError(
        `KPI allocation metricCode ${metricCode} is not in allocation targets`,
      );
    }
    if (readEntry(plan.id, allocation.id, metricCode, String(body.actualDate))) {
      return HttpResponse.json(
        { message: 'KPI actual entry already exists for this slot' },
        { status: 409 },
      );
    }
    const existing = readActiveExcuse(plan.id, allocation.id, metricCode, String(body.actualDate));
    if (existing) {
      return HttpResponse.json({ data: toDetail(plan) });
    }
    excuseSeed += 1;
    actualExcuses.push({
      id: `actual-excuse-${excuseSeed}`,
      kpiPlanId: plan.id,
      allocationId: allocation.id,
      metricCode,
      actualDate: String(body.actualDate),
      status: body.status as KpiActualExcuseStatus,
      reasonCode: body.reasonCode as KpiActualExcuseReasonCode,
      reasonText: String(body.reasonText).trim(),
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      deletedAt: null,
      deletedByActorId: null,
    });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.delete(
    '*/admin/kpi/plans/:kpiPlanId/actual-excuses/:excuseId',
    async ({ params, request }) => {
      const plan = readPlan(String(params.kpiPlanId));
      if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, []);
      if (unsupported) return unsupported;
      const excuse = actualExcuses.find(
        (item) =>
          item.kpiPlanId === plan.id &&
          item.id === String(params.excuseId) &&
          item.deletedAt === null,
      );
      if (!excuse)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (plan.status !== 'PUBLISHED') {
        return HttpResponse.json(
          { message: 'KPI actual excuse requires a published plan' },
          { status: 409 },
        );
      }
      excuse.deletedAt = now;
      excuse.deletedByActorId = 'user-admin';
      excuse.updatedAt = now;
      excuse.updatedByActorId = 'user-admin';
      return HttpResponse.json({ data: toDetail(plan) });
    },
  ),
  http.post('*/admin/kpi/plans/:kpiPlanId/org-unit-actuals', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.subjectType !== 'ORG_UNIT') {
      return HttpResponse.json(
        { message: 'ORG_UNIT actual requires an ORG_UNIT KPI plan' },
        { status: 409 },
      );
    }
    const body = await parseJsonBody(request);
    lastOrgUnitActualPayload = body;
    const unsupported = rejectUnsupportedBody(body, [
      'allocationId',
      'metricCode',
      'actualDate',
      'actualValue',
    ]);
    if (unsupported) return unsupported;
    if (
      !parseActualDate(body.actualDate) ||
      !actualDateInPlanPeriod(plan, String(body.actualDate))
    ) {
      return validationError('Invalid actualDate');
    }
    const allocation = (allocations[plan.id] ?? []).find(
      (item) => item.id === String(body.allocationId),
    );
    if (!allocation || allocation.allocationStatus !== 'PUBLISHED') {
      return HttpResponse.json(
        { message: 'KPI actual requires a published allocation' },
        { status: 409 },
      );
    }
    const metricCode = body.metricCode as KpiMetricCode;
    if (metricCode !== 'REVENUE_VND') {
      return validationError(`KPI metricCode is unsupported for ORG_UNIT: ${String(metricCode)}`);
    }
    actualSeed += 1;
    const entry: ActualEntry = {
      id: `org-unit-actual-${actualSeed}`,
      kpiPlanId: plan.id,
      allocationId: allocation.id,
      memberEmploymentProfileId: allocation.memberEmploymentProfileId,
      memberTalentId: null,
      metricCode,
      actualDate: String(body.actualDate),
      actualValue: Number(body.actualValue),
      effectiveValue: Number(body.actualValue),
      editCount: 0,
      correctionCount: 0,
      latestCorrectionId: null,
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      lastEditedAt: null,
      lastEditedByActorId: null,
    };
    actualEntries.push(entry);
    return HttpResponse.json({ data: exposeOrgUnitActualEntry(entry) });
  }),
  http.patch(
    '*/admin/kpi/plans/:kpiPlanId/org-unit-actuals/:actualEntryId',
    async ({ params, request }) => {
      const plan = readPlan(String(params.kpiPlanId));
      if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, ['actualValue']);
      if (unsupported) return unsupported;
      const entry = actualEntries.find((item) => item.id === String(params.actualEntryId));
      if (!entry) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      entry.actualValue = Number(body.actualValue);
      entry.effectiveValue = Number(body.actualValue);
      entry.editCount += 1;
      return HttpResponse.json({ data: exposeOrgUnitActualEntry(entry) });
    },
  ),
  http.get(
    '*/admin/kpi/plans/:kpiPlanId/org-unit-actuals/:actualEntryId/corrections',
    ({ params }) =>
      HttpResponse.json({
        data: corrections
          .filter(
            (item) =>
              item.kpiPlanId === String(params.kpiPlanId) &&
              item.actualEntryId === String(params.actualEntryId),
          )
          .map(exposeCorrection),
      }),
  ),
  http.post(
    '*/admin/kpi/plans/:kpiPlanId/org-unit-actuals/:actualEntryId/corrections',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, ['correctedValue', 'reason']);
      if (unsupported) return unsupported;
      if (!String(body.reason ?? '').trim()) {
        return HttpResponse.json({ message: 'Reason required' }, { status: 422 });
      }
      const plan = readPlan(String(params.kpiPlanId));
      if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (plan.subjectType !== 'ORG_UNIT') {
        return HttpResponse.json(
          { message: 'ORG_UNIT correction requires an ORG_UNIT KPI plan' },
          { status: 409 },
        );
      }
      const entry = actualEntries.find((item) => item.id === String(params.actualEntryId));
      if (!entry) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (entry.kpiPlanId !== plan.id) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (plan.status === 'FINALIZED') {
        return finalizedKpiReadOnly();
      }
      if (plan.status !== 'PUBLISHED') {
        return HttpResponse.json(
          { message: 'KPI actual correction requires a published plan' },
          { status: 409 },
        );
      }
      const allocation = (allocations[plan.id] ?? []).find(
        (item) => item.id === entry.allocationId,
      );
      if (!allocation || allocation.allocationStatus !== 'PUBLISHED') {
        return HttpResponse.json(
          { message: 'KPI actual correction requires a published allocation' },
          { status: 409 },
        );
      }
      if (isDirectEditWindowOpen(entry.actualDate)) {
        return correctionDuringDirectEditWindow();
      }
      if (readActiveExcuse(plan.id, entry.allocationId, entry.metricCode, entry.actualDate)) {
        return HttpResponse.json(
          {
            message:
              'KPI actual slot has an active excuse or not-required mark; unmark it before correction',
          },
          { status: 409 },
        );
      }
      if (!isNumber(body.correctedValue) || body.correctedValue < 0) {
        return validationError(
          `KPI ${entry.metricCode} requires a finite non-negative numeric corrected value`,
        );
      }
      if (
        integerTargetMetricCodes.has(entry.metricCode) &&
        !Number.isInteger(body.correctedValue)
      ) {
        return validationError(`${entry.metricCode} requires an integer corrected value`);
      }
      correctionSeed += 1;
      const correction: ActualCorrection = {
        id: `org-unit-correction-${correctionSeed}`,
        actualEntryId: entry.id,
        kpiPlanId: String(params.kpiPlanId),
        allocationId: entry.allocationId,
        metricCode: entry.metricCode,
        actualDate: entry.actualDate,
        previousValue: entry.effectiveValue,
        correctedValue: Number(body.correctedValue),
        reason: String(body.reason).trim(),
        correctedAt: now,
        createdAt: now,
      };
      corrections.push(correction);
      entry.effectiveValue = correction.correctedValue;
      entry.correctionCount += 1;
      entry.latestCorrectionId = correction.id;
      return HttpResponse.json({
        data: {
          actualEntry: exposeOrgUnitActualEntry(entry),
          correction: exposeCorrection(correction),
        },
      });
    },
  ),
  http.post('*/admin/kpi/plans/:kpiPlanId/org-unit-actual-excuses', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.subjectType !== 'ORG_UNIT') {
      return HttpResponse.json(
        { message: 'ORG_UNIT actual excuse requires an ORG_UNIT KPI plan' },
        { status: 409 },
      );
    }
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'allocationId',
      'metricCode',
      'actualDate',
      'status',
      'reasonCode',
      'reasonText',
    ]);
    if (unsupported) return unsupported;
    excuseSeed += 1;
    actualExcuses.push({
      id: `org-unit-excuse-${excuseSeed}`,
      kpiPlanId: plan.id,
      allocationId: String(body.allocationId),
      metricCode: body.metricCode as KpiMetricCode,
      actualDate: String(body.actualDate),
      status: body.status as KpiActualExcuseStatus,
      reasonCode: body.reasonCode as KpiActualExcuseReasonCode,
      reasonText: String(body.reasonText).trim(),
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      deletedAt: null,
      deletedByActorId: null,
    });
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.delete(
    '*/admin/kpi/plans/:kpiPlanId/org-unit-actual-excuses/:excuseId',
    async ({ params, request }) => {
      const plan = readPlan(String(params.kpiPlanId));
      if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, []);
      if (unsupported) return unsupported;
      const excuse = actualExcuses.find((item) => item.id === String(params.excuseId));
      if (!excuse)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      excuse.deletedAt = now;
      excuse.deletedByActorId = 'user-admin';
      return HttpResponse.json({ data: toDetail(plan) });
    },
  ),
  http.post('*/admin/kpi/plans/:kpiPlanId/:action', async ({ params, request }) => {
    const action = String(params.action);
    if (action === 'actuals') return;
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, []);
    if (unsupported) return unsupported;
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (action === 'publish') {
      const allowedMetrics = createMetricCodesBySubjectType[plan.subjectType];
      const disallowedMetric = (targets[plan.id] ?? []).find(
        (metric) => !allowedMetrics.has(metric.metricCode),
      );
      if (disallowedMetric) {
        return validationError(
          `KPI metricCode ${disallowedMetric.metricCode} is unsupported for ${plan.subjectType}`,
        );
      }
      plan.status = 'PUBLISHED';
      plan.publishedAt = now;
    } else if (action === 'finalize') {
      plan.finalResult = toFinalResultSnapshot(plan, now);
      plan.status = 'FINALIZED';
      plan.finalizedAt = now;
    } else if (action === 'archive') {
      plan.status = 'ARCHIVED';
      plan.archivedAt = now;
    } else {
      return HttpResponse.json({ message: 'Unsupported action' }, { status: 404 });
    }
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.post('*/admin/kpi/plans/:kpiPlanId/actuals', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'allocationId',
      'metricCode',
      'actualDate',
      'actualValue',
    ]);
    if (unsupported) return unsupported;
    if (
      !parseActualDate(body.actualDate) ||
      !actualDateInPlanPeriod(plan, String(body.actualDate))
    ) {
      return validationError('Invalid actualDate');
    }
    if (plan.status !== 'PUBLISHED') {
      return HttpResponse.json(
        { message: 'KPI actual requires a published plan' },
        { status: 409 },
      );
    }
    if (!isDirectEditWindowOpen(String(body.actualDate))) {
      return directEditWindowClosed();
    }
    const metricCode = body.metricCode as KpiMetricCode;
    if (!metricCodes.includes(metricCode)) {
      return validationError(`KPI metricCode is unsupported: ${String(body.metricCode)}`);
    }
    if (!isNumber(body.actualValue) || body.actualValue < 0) {
      return validationError(
        `KPI ${metricCode} requires a finite non-negative numeric actual value`,
      );
    }
    if (integerTargetMetricCodes.has(metricCode) && !Number.isInteger(body.actualValue)) {
      return validationError(`${metricCode} requires an integer actual value`);
    }
    if (metricCode === 'LIVE_HOURS' && !hasAtMostDecimalPlaces(body.actualValue, 2)) {
      return validationError('LIVE_HOURS supports at most 2 decimal places');
    }
    const allocation = (allocations[String(params.kpiPlanId)] ?? []).find(
      (item) => item.id === String(body.allocationId),
    );
    if (!allocation || allocation.allocationStatus !== 'PUBLISHED') {
      return HttpResponse.json(
        { message: 'KPI actual requires a published allocation' },
        { status: 409 },
      );
    }
    if (!allocation.targetMetrics.some((metric) => metric.metricCode === metricCode)) {
      return validationError(
        `KPI allocation metricCode ${metricCode} is not in allocation targets`,
      );
    }
    if (
      readActiveExcuse(
        String(params.kpiPlanId),
        String(body.allocationId),
        metricCode,
        String(body.actualDate),
      )
    ) {
      return HttpResponse.json(
        { message: 'KPI actual slot has an active excuse; unmark it before entering actuals' },
        { status: 409 },
      );
    }
    const existing = readEntry(
      String(params.kpiPlanId),
      String(body.allocationId),
      metricCode,
      String(body.actualDate),
    );
    if (existing) {
      if (existing.actualValue === Number(body.actualValue)) {
        return HttpResponse.json({ data: exposeTalentGroupActualEntry(existing) });
      }
      return HttpResponse.json(
        { message: 'Duplicate actual with different value' },
        { status: 409 },
      );
    }
    actualSeed += 1;
    const entry: ActualEntry = {
      id: `actual-${actualSeed}`,
      kpiPlanId: String(params.kpiPlanId),
      allocationId: String(body.allocationId),
      memberEmploymentProfileId: allocation?.memberEmploymentProfileId ?? null,
      memberTalentId: allocation?.memberTalentId ?? 'talent-unknown',
      metricCode,
      actualDate: String(body.actualDate),
      actualValue: Number(body.actualValue),
      effectiveValue: Number(body.actualValue),
      editCount: 0,
      correctionCount: 0,
      latestCorrectionId: null,
      createdAt: now,
      createdByActorId: 'user-admin',
      updatedAt: now,
      updatedByActorId: 'user-admin',
      lastEditedAt: null,
      lastEditedByActorId: null,
    };
    actualEntries.push(entry);
    return HttpResponse.json({ data: exposeTalentGroupActualEntry(entry) });
  }),
  http.patch('*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['actualValue']);
    if (unsupported) return unsupported;
    const entry = actualEntries.find((item) => item.id === String(params.actualEntryId));
    if (!entry) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (plan.status !== 'PUBLISHED') {
      return HttpResponse.json(
        { message: 'KPI actual requires a published plan' },
        { status: 409 },
      );
    }
    if (readActiveExcuse(plan.id, entry.allocationId, entry.metricCode, entry.actualDate)) {
      return HttpResponse.json(
        { message: 'KPI actual slot has an active excuse; unmark it before entering actuals' },
        { status: 409 },
      );
    }
    if (!isDirectEditWindowOpen(entry.actualDate)) {
      return directEditWindowClosed();
    }
    if (entry.editCount >= 3) {
      return HttpResponse.json(
        { message: 'KPI actual direct edit limit exceeded; correction is required' },
        { status: 409 },
      );
    }
    entry.actualValue = Number(body.actualValue);
    entry.effectiveValue = Number(body.actualValue);
    entry.editCount += 1;
    return HttpResponse.json({ data: exposeTalentGroupActualEntry(entry) });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId/corrections', ({ params }) => {
    return HttpResponse.json({
      data: corrections
        .filter(
          (item) =>
            item.kpiPlanId === String(params.kpiPlanId) &&
            item.actualEntryId === String(params.actualEntryId),
        )
        .map(exposeCorrection),
    });
  }),
  http.post(
    '*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId/corrections',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, ['correctedValue', 'reason']);
      if (unsupported) return unsupported;
      if (!String(body.reason ?? '').trim()) {
        return HttpResponse.json({ message: 'Reason required' }, { status: 422 });
      }
      const entry = actualEntries.find((item) => item.id === String(params.actualEntryId));
      if (!entry) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (entry.kpiPlanId !== String(params.kpiPlanId)) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      const plan = readPlan(String(params.kpiPlanId));
      if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (plan.status === 'FINALIZED') {
        return finalizedKpiReadOnly();
      }
      if (plan.status !== 'PUBLISHED') {
        return HttpResponse.json(
          { message: 'KPI actual correction requires a published plan' },
          { status: 409 },
        );
      }
      const allocation = (allocations[plan.id] ?? []).find(
        (item) => item.id === entry.allocationId,
      );
      if (!allocation || allocation.allocationStatus !== 'PUBLISHED') {
        return HttpResponse.json(
          { message: 'KPI actual correction requires a published allocation' },
          { status: 409 },
        );
      }
      if (isDirectEditWindowOpen(entry.actualDate)) {
        return correctionDuringDirectEditWindow();
      }
      if (readActiveExcuse(plan.id, entry.allocationId, entry.metricCode, entry.actualDate)) {
        return HttpResponse.json(
          {
            message:
              'KPI actual slot has an active excuse or not-required mark; unmark it before correction',
          },
          { status: 409 },
        );
      }
      if (!isNumber(body.correctedValue) || body.correctedValue < 0) {
        return validationError(
          `KPI ${entry.metricCode} requires a finite non-negative numeric corrected value`,
        );
      }
      if (
        integerTargetMetricCodes.has(entry.metricCode) &&
        !Number.isInteger(body.correctedValue)
      ) {
        return validationError(`${entry.metricCode} requires an integer corrected value`);
      }
      if (entry.metricCode === 'LIVE_HOURS' && !hasAtMostDecimalPlaces(body.correctedValue, 2)) {
        return validationError('LIVE_HOURS supports at most 2 decimal places');
      }
      correctionSeed += 1;
      const correction: ActualCorrection = {
        id: `correction-${correctionSeed}`,
        actualEntryId: entry.id,
        kpiPlanId: String(params.kpiPlanId),
        allocationId: entry.allocationId,
        metricCode: entry.metricCode,
        actualDate: entry.actualDate,
        previousValue: entry.effectiveValue,
        correctedValue: Number(body.correctedValue),
        reason: String(body.reason).trim(),
        correctedAt: now,
        createdAt: now,
      };
      corrections.push(correction);
      entry.effectiveValue = correction.correctedValue;
      entry.correctionCount += 1;
      entry.latestCorrectionId = correction.id;
      return HttpResponse.json({
        data: {
          actualEntry: exposeTalentGroupActualEntry(entry),
          correction: exposeCorrection(correction),
        },
      });
    },
  ),
];
