import { http, HttpResponse } from 'msw';

type KpiSubjectType = 'TALENT' | 'TALENT_GROUP' | 'EMPLOYMENT_PROFILE' | 'ORG_UNIT';
type KpiStatus = 'DRAFT' | 'PUBLISHED' | 'FINALIZED' | 'ARCHIVED';
type KpiMetricCode =
  | 'REVENUE_VND'
  | 'CONTENT_OUTPUT_COUNT'
  | 'LIVE_HOURS'
  | 'EVENT_COMPLETION_COUNT'
  | 'ONBOARDED_TALENT_COUNT';
type KpiUnit = 'VND' | 'COUNT' | 'HOUR';

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
  groupId: string;
  memberTalentId: string;
  membershipId: string | null;
  allocationStatus: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  allocationStartDate: string;
  allocationEndDate: string | null;
  targetMetrics: Array<{ metricCode: KpiMetricCode; targetValue: number }>;
  snapshotMemberDisplayName: string | null;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  closedAt: number | null;
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
  archivedAt: number | null;
  archivedByActorId: string | null;
  createdAt: number;
  createdByActorId: string;
  updatedAt: number;
  updatedByActorId: string;
  externalRef: string | null;
};

type ActualEntry = {
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
  memberTalentId: string;
  metricCode: KpiMetricCode;
  actualDate: string;
  previousValue: number;
  correctedValue: number;
  reason: string;
  correctedByActorId: string;
  correctedAt: number;
  createdAt: number;
};

const now = Date.parse('2026-05-16T09:30:00.000Z');
const metricUnits: Record<KpiMetricCode, KpiUnit> = {
  REVENUE_VND: 'VND',
  CONTENT_OUTPUT_COUNT: 'COUNT',
  LIVE_HOURS: 'HOUR',
  EVENT_COMPLETION_COUNT: 'COUNT',
  ONBOARDED_TALENT_COUNT: 'COUNT',
};
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

const basePlan = (overrides: Partial<KpiPlan>): KpiPlan => ({
  id: 'kpi-plan-draft',
  planCode: 'KPI-202605-000001',
  title: 'May creator KPI',
  description: null,
  subjectType: 'TALENT_GROUP',
  subjectId: 'group-001',
  subjectRef: { id: 'group-001', code: 'TG-001', name: 'Creator Team', status: 'ACTIVE' },
  status: 'DRAFT',
  currencyCode: 'VND',
  periodMonth: '2026-05',
  periodStartAt: Date.UTC(2026, 4, 1),
  periodEndAt: Date.UTC(2026, 5, 1) - 1,
  timezone: 'Asia/Ho_Chi_Minh',
  actualPolicySnapshot: null,
  publishedAt: null,
  publishedByActorId: null,
  finalizedAt: null,
  finalizedByActorId: null,
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

const initialAllocations: Record<string, KpiAllocation[]> = Object.fromEntries(
  initialPlans.map((plan) => [
    plan.id,
    [
      {
        id: `${plan.id}-alloc-1`,
        kpiPlanId: plan.id,
        groupId: 'group-001',
        memberTalentId: 'talent-001',
        membershipId: null,
        allocationStatus: plan.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
        allocationStartDate: '01-05-2026',
        allocationEndDate: null,
        targetMetrics: [
          { metricCode: 'REVENUE_VND', targetValue: 600000 },
          { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 6 },
        ],
        snapshotMemberDisplayName: 'Luna Park',
        createdAt: now,
        updatedAt: now,
        publishedAt: plan.publishedAt,
        closedAt: null,
      },
      {
        id: `${plan.id}-alloc-2`,
        kpiPlanId: plan.id,
        groupId: 'group-001',
        memberTalentId: 'talent-002',
        membershipId: null,
        allocationStatus: plan.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
        allocationStartDate: '01-05-2026',
        allocationEndDate: null,
        targetMetrics: [
          { metricCode: 'REVENUE_VND', targetValue: 400000 },
          { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 4 },
        ],
        snapshotMemberDisplayName: 'Minh Tran',
        createdAt: now,
        updatedAt: now,
        publishedAt: plan.publishedAt,
        closedAt: null,
      },
    ],
  ]),
);

let planSeed = 100;
let actualSeed = 100;
let correctionSeed = 100;
let plans: KpiPlan[] = [];
let targets: Record<string, KpiTargetMetric[]> = {};
let allocations: Record<string, KpiAllocation[]> = {};
let actualEntries: ActualEntry[] = [];
let corrections: ActualCorrection[] = [];

export const resetKpiMockData = (): void => {
  planSeed = 100;
  actualSeed = 100;
  correctionSeed = 100;
  plans = initialPlans.map((plan) => ({ ...plan, subjectRef: plan.subjectRef ? { ...plan.subjectRef } : null }));
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
      memberTalentId: 'talent-001',
      metricCode: 'REVENUE_VND',
      actualDate: '16-05-2026',
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
      memberTalentId: 'talent-002',
      metricCode: 'REVENUE_VND',
      actualDate: '16-05-2026',
      actualValue: 200000,
      effectiveValue: 250000,
      editCount: 2,
      correctionCount: 1,
      latestCorrectionId: 'correction-001',
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
      memberTalentId: 'talent-002',
      metricCode: 'REVENUE_VND',
      actualDate: '16-05-2026',
      previousValue: 200000,
      correctedValue: 250000,
      reason: 'Backend approved adjustment',
      correctedByActorId: 'user-admin',
      correctedAt: now,
      createdAt: now,
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

const toDetail = (plan: KpiPlan) => ({
  ...plan,
  targetMetrics: targets[plan.id] ?? [],
  allocations: allocations[plan.id] ?? [],
});

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
      (targets[plan.id] ?? []).some((metric) => metric.metricCode === url.searchParams.get('metricCode')),
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

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const validateMetricPayload = (items: unknown): items is Array<{ metricCode: KpiMetricCode; targetValue: number }> =>
  Array.isArray(items) &&
  items.length > 0 &&
  items.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      ['REVENUE_VND', 'CONTENT_OUTPUT_COUNT', 'LIVE_HOURS', 'EVENT_COMPLETION_COUNT', 'ONBOARDED_TALENT_COUNT'].includes(
        String((item as Record<string, unknown>).metricCode),
      ) &&
      isNumber((item as Record<string, unknown>).targetValue),
  );

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

const toActualGrid = (plan: KpiPlan, actualDate: string) => ({
  kpiPlanId: plan.id,
  planCode: plan.planCode,
  status: plan.status,
  subjectType: plan.subjectType,
  subjectId: plan.subjectId,
  actualDate,
  policy: {
    timezone: 'Asia/Ho_Chi_Minh',
    entryOpenLocalTime: '06:00',
    entryLockLocalTime: '23:00',
    maxDirectEditsPerEntry: 2,
    correctionAllowedUntil: 'PLAN_FINALIZED',
  },
  editability: {
    isDirectEditOpen: plan.status === 'PUBLISHED',
    isPlanFinalized: plan.status === 'FINALIZED',
    disabledReason: plan.status === 'FINALIZED' ? 'Đã chốt' : null,
  },
  targetMetrics: (targets[plan.id] ?? []).map((metric) => ({
    metricCode: metric.metricCode,
    targetValue: metric.targetValue,
    unit: metric.unit,
  })),
  rows: (allocations[plan.id] ?? []).map((allocation) => ({
    allocationId: allocation.id,
    memberTalentId: allocation.memberTalentId,
    memberDisplayName: allocation.snapshotMemberDisplayName,
    allocationStatus: allocation.allocationStatus,
    metrics: (targets[plan.id] ?? []).map((metric) => {
      const entry = readEntry(plan.id, allocation.id, metric.metricCode, actualDate);
      const locked = entry ? entry.editCount >= 2 || plan.status === 'FINALIZED' : false;
      return {
        metricCode: metric.metricCode,
        targetValue: metric.targetValue,
        actualEntryId: entry?.id ?? null,
        actualValue: entry?.actualValue ?? null,
        effectiveValue: entry?.effectiveValue ?? 0,
        hasEntry: Boolean(entry),
        editCount: entry?.editCount ?? 0,
        correctionCount: entry?.correctionCount ?? 0,
        latestCorrectionId: entry?.latestCorrectionId ?? null,
        canDirectEdit: Boolean(entry) && !locked,
        requiresCorrection: Boolean(entry) && locked,
        disabledReason: locked ? 'Đã khóa' : null,
      };
    }),
  })),
});

export const kpiHandlers = [
  http.get('*/admin/kpi/plans', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, allowedListQueryKeys);
    if (unsupported) return unsupported;
    return HttpResponse.json({ data: filterPlans(request) });
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
      'allocations',
      'externalRef',
    ]);
    if (unsupported) return unsupported;
    if (!validateMetricPayload(body.targetMetrics)) {
      return HttpResponse.json({ message: 'Invalid target metrics' }, { status: 422 });
    }
    planSeed += 1;
    const id = `kpi-plan-${planSeed}`;
    const plan = basePlan({
      id,
      planCode: `KPI-202605-${String(planSeed).padStart(6, '0')}`,
      title: String(body.title),
      description: (body.description as string | null | undefined) ?? null,
      subjectType: body.subjectType as KpiSubjectType,
      subjectId: String(body.subjectId),
      periodMonth: String(body.periodMonth),
      periodStartAt: Number(body.periodStartAt),
      periodEndAt: Number(body.periodEndAt),
      timezone: String(body.timezone ?? 'Asia/Ho_Chi_Minh'),
      externalRef: (body.externalRef as string | null | undefined) ?? null,
    });
    plans.push(plan);
    targets[id] = toTargetMetrics(id, body.targetMetrics);
    allocations[id] = Array.isArray(body.allocations)
      ? body.allocations.map((item, index) => {
          const allocation = item as Record<string, unknown>;
          return {
            id: `${id}-alloc-${index + 1}`,
            kpiPlanId: id,
            groupId: plan.subjectId,
            memberTalentId: String(allocation.memberTalentId),
            membershipId: (allocation.membershipId as string | null | undefined) ?? null,
            allocationStatus: 'DRAFT',
            allocationStartDate: String(allocation.allocationStartDate),
            allocationEndDate: (allocation.allocationEndDate as string | null | undefined) ?? null,
            targetMetrics: allocation.targetMetrics as Array<{ metricCode: KpiMetricCode; targetValue: number }>,
            snapshotMemberDisplayName:
              (allocation.snapshotMemberDisplayName as string | null | undefined) ?? null,
            createdAt: now,
            updatedAt: now,
            publishedAt: null,
            closedAt: null,
          };
        })
      : [];
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
        groupTotals: [{ metricCode: 'REVENUE_VND', targetValue: 1000000, actualValue: 1250000, progressPercent: 125 }],
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
          { metricCode: 'REVENUE_VND', targetValue: 1000000, actualValue: 1250000, progressPercent: 125 },
          { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 10, actualValue: 8, progressPercent: 80 },
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
  http.get('*/admin/kpi/plans/:kpiPlanId/actuals', ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const actualDate = new URL(request.url).searchParams.get('actualDate');
    if (!actualDate || !/^\d{2}-\d{2}-\d{4}$/.test(actualDate)) {
      return HttpResponse.json({ message: 'Invalid actualDate' }, { status: 422 });
    }
    return HttpResponse.json({ data: toActualGrid(plan, actualDate) });
  }),
  http.put('*/admin/kpi/plans/:kpiPlanId/allocations', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['allocations']);
    if (unsupported) return unsupported;
    return HttpResponse.json({ data: toDetail(plan) });
  }),
  http.put('*/admin/kpi/plans/:kpiPlanId/target-metrics', async ({ params, request }) => {
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['targetMetrics']);
    if (unsupported) return unsupported;
    if (!validateMetricPayload(body.targetMetrics)) {
      return HttpResponse.json({ message: 'Invalid target metrics' }, { status: 422 });
    }
    targets[plan.id] = toTargetMetrics(plan.id, body.targetMetrics);
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
  http.post('*/admin/kpi/plans/:kpiPlanId/:action', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, []);
    if (unsupported) return unsupported;
    const plan = readPlan(String(params.kpiPlanId));
    if (!plan) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    const action = String(params.action);
    if (action === 'publish') {
      plan.status = 'PUBLISHED';
      plan.publishedAt = now;
    } else if (action === 'finalize') {
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
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['allocationId', 'metricCode', 'actualDate', 'actualValue']);
    if (unsupported) return unsupported;
    const existing = readEntry(
      String(params.kpiPlanId),
      String(body.allocationId),
      body.metricCode as KpiMetricCode,
      String(body.actualDate),
    );
    if (existing) {
      if (existing.actualValue === Number(body.actualValue)) {
        return HttpResponse.json({ data: existing });
      }
      return HttpResponse.json({ message: 'Duplicate actual with different value' }, { status: 409 });
    }
    actualSeed += 1;
    const allocation = (allocations[String(params.kpiPlanId)] ?? []).find(
      (item) => item.id === String(body.allocationId),
    );
    const entry: ActualEntry = {
      id: `actual-${actualSeed}`,
      kpiPlanId: String(params.kpiPlanId),
      allocationId: String(body.allocationId),
      memberTalentId: allocation?.memberTalentId ?? 'talent-unknown',
      metricCode: body.metricCode as KpiMetricCode,
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
    return HttpResponse.json({ data: entry });
  }),
  http.patch('*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['actualValue']);
    if (unsupported) return unsupported;
    const entry = actualEntries.find((item) => item.id === String(params.actualEntryId));
    if (!entry) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    entry.actualValue = Number(body.actualValue);
    entry.effectiveValue = Number(body.actualValue);
    entry.editCount += 1;
    return HttpResponse.json({ data: entry });
  }),
  http.get('*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId/corrections', ({ params }) => {
    return HttpResponse.json({
      data: corrections.filter(
        (item) =>
          item.kpiPlanId === String(params.kpiPlanId) &&
          item.actualEntryId === String(params.actualEntryId),
      ),
    });
  }),
  http.post('*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId/corrections', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['correctedValue', 'reason']);
    if (unsupported) return unsupported;
    if (!String(body.reason ?? '').trim()) {
      return HttpResponse.json({ message: 'Reason required' }, { status: 422 });
    }
    const entry = actualEntries.find((item) => item.id === String(params.actualEntryId));
    if (!entry) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    correctionSeed += 1;
    const correction: ActualCorrection = {
      id: `correction-${correctionSeed}`,
      actualEntryId: entry.id,
      kpiPlanId: String(params.kpiPlanId),
      allocationId: entry.allocationId,
      memberTalentId: entry.memberTalentId,
      metricCode: entry.metricCode,
      actualDate: entry.actualDate,
      previousValue: entry.effectiveValue,
      correctedValue: Number(body.correctedValue),
      reason: String(body.reason),
      correctedByActorId: 'user-admin',
      correctedAt: now,
      createdAt: now,
    };
    corrections.push(correction);
    entry.effectiveValue = correction.correctedValue;
    entry.correctionCount += 1;
    entry.latestCorrectionId = correction.id;
    return HttpResponse.json({ data: { actualEntry: entry, correction } });
  }),
];
