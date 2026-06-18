import { http, HttpResponse } from 'msw';

import {
  generatedFixtureMonthCode,
  providedOrGeneratedFixtureCode,
} from '@test/msw/generated-code-fixtures';
import type {
  PlatformEarningBatch,
  PlatformEarningLine,
} from '@modules/revenue-ledger/types/revenue-ledger.types';

type TalentKpiStatus = 'DRAFT' | 'FINALIZED' | 'ARCHIVED';
type RevenueEntryStatus = 'DRAFT' | 'FINALIZED' | 'RECONCILED' | 'VOIDED' | 'ARCHIVED';
type RevenueKind = 'PLATFORM_LIVESTREAM' | 'PLATFORM_CONTENT' | 'EVENT_OPERATIONAL';
type MetricCode =
  | 'LIVESTREAM_HOURS'
  | 'REVENUE_ATTRIBUTED_AMOUNT'
  | 'LIVESTREAM_SESSION_COUNT'
  | 'CONTENT_PUBLISH_COUNT'
  | 'EVENT_APPEARANCE_COUNT'
  | 'ENGAGEMENT_COUNT'
  | 'FOLLOWER_DELTA';

type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  status?: string;
};

type TalentKpiMetricRecord = {
  id: string;
  metricCode: MetricCode;
  numericValue: number;
  createdAt: number;
  updatedAt: number;
};

type TalentKpiRecord = {
  id: string;
  kpiRecordCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  subjectTalentRef?: ReferenceSummary | null;
  attributionPlatformAccountRef?: ReferenceSummary | null;
  attributionEventRef?: ReferenceSummary | null;
  measurementSource: 'MANUAL';
  status: TalentKpiStatus;
  periodStartAt: number;
  periodEndAt: number;
  publishedAt?: number | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number;
  updatedAt: number;
};

type RevenueEntryRecord = {
  id: string;
  revenueEntryCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  subjectTalentRef?: ReferenceSummary | null;
  attributionPlatformAccountRef?: ReferenceSummary | null;
  attributionEventRef?: ReferenceSummary | null;
  revenueKind: RevenueKind;
  entrySource: 'MANUAL' | 'PLATFORM_EARNING_BATCH';
  status: RevenueEntryStatus;
  currencyCode: string;
  recognizedAmount: number;
  recognizedAt: number;
  finalizedAt?: number | null;
  reconciledAt?: number | null;
  voidedAt?: number | null;
  reconciliationReference?: string | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number;
  updatedAt: number;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const metricCodes: MetricCode[] = [
  'LIVESTREAM_HOURS',
  'REVENUE_ATTRIBUTED_AMOUNT',
  'LIVESTREAM_SESSION_COUNT',
  'CONTENT_PUBLISH_COUNT',
  'EVENT_APPEARANCE_COUNT',
  'ENGAGEMENT_COUNT',
  'FOLLOWER_DELTA',
];

const talentRefs = new Map<string, ReferenceSummary>([
  ['talent-001', { id: 'talent-001', code: 'TAL-001', name: 'Luna Park', status: 'ACTIVE' }],
  ['talent-002', { id: 'talent-002', code: 'TAL-002', name: 'Minh Tran', status: 'ACTIVE' }],
]);

const platformRefSummaries = new Map<string, ReferenceSummary>([
  [
    'platform-001',
    {
      id: 'platform-001',
      code: 'PA-001',
      displayName: 'Luna TikTok',
      handle: '@luna-live',
      platform: 'TIKTOK',
      status: 'ACTIVE',
    },
  ],
]);

const eventRefs = new Map<string, ReferenceSummary>([
  [
    'event-001',
    {
      id: 'event-001',
      code: 'EVT-001',
      title: 'Spring Live Show',
      status: 'PLANNED',
    },
  ],
]);

const initialTalentKpiRecords: TalentKpiRecord[] = [
  {
    id: 'talent-kpi-record-001',
    kpiRecordCode: 'KPI-202604-000001',
    title: 'April livestream performance',
    subjectTalentId: 'talent-001',
    attributionPlatformAccountId: 'platform-001',
    attributionEventId: 'event-001',
    measurementSource: 'MANUAL',
    status: 'DRAFT',
    periodStartAt: now - 86_400_000,
    periodEndAt: now,
    publishedAt: null,
    description: 'Draft KPI record',
    externalRef: 'KPI-EXT-1',
    createdAt: now - 10_000,
    updatedAt: now - 9_000,
  },
  {
    id: 'talent-kpi-record-finalized',
    kpiRecordCode: 'KPI-202604-000002',
    title: 'Finalized KPI record',
    subjectTalentId: 'talent-002',
    attributionPlatformAccountId: null,
    attributionEventId: 'event-001',
    measurementSource: 'MANUAL',
    status: 'FINALIZED',
    periodStartAt: now - 172_800_000,
    periodEndAt: now - 86_400_000,
    publishedAt: now - 80_000_000,
    description: null,
    externalRef: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
  },
  {
    id: 'talent-kpi-record-archived',
    kpiRecordCode: 'KPI-202604-999999',
    title: 'Archived KPI record',
    subjectTalentId: 'talent-001',
    attributionPlatformAccountId: 'platform-001',
    attributionEventId: null,
    measurementSource: 'MANUAL',
    status: 'ARCHIVED',
    periodStartAt: now - 259_200_000,
    periodEndAt: now - 172_800_000,
    publishedAt: null,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
  },
];

const initialTalentKpiMetrics: Record<string, TalentKpiMetricRecord[]> = {
  'talent-kpi-record-001': [
    {
      id: 'metric-001',
      metricCode: 'ENGAGEMENT_COUNT',
      numericValue: 120,
      createdAt: now - 10_000,
      updatedAt: now - 9_000,
    },
  ],
  'talent-kpi-record-finalized': [
    {
      id: 'metric-002',
      metricCode: 'LIVESTREAM_HOURS',
      numericValue: 12.5,
      createdAt: now - 8_000,
      updatedAt: now - 7_000,
    },
  ],
  'talent-kpi-record-archived': [
    {
      id: 'metric-999',
      metricCode: 'FOLLOWER_DELTA',
      numericValue: -5,
      createdAt: now - 6_000,
      updatedAt: now - 5_000,
    },
  ],
};

const initialRevenueEntries: RevenueEntryRecord[] = [
  {
    id: 'revenue-entry-001',
    revenueEntryCode: 'REV-202604-000001',
    title: 'April livestream revenue',
    subjectTalentId: 'talent-001',
    attributionPlatformAccountId: 'platform-001',
    attributionEventId: null,
    revenueKind: 'PLATFORM_LIVESTREAM',
    entrySource: 'MANUAL',
    status: 'DRAFT',
    currencyCode: 'VND',
    recognizedAmount: 1250000,
    recognizedAt: now - 60_000,
    finalizedAt: null,
    reconciledAt: null,
    voidedAt: null,
    reconciliationReference: null,
    description: 'Draft revenue entry',
    externalRef: 'REV-EXT-1',
    createdAt: now - 10_000,
    updatedAt: now - 9_000,
  },
  {
    id: 'revenue-entry-finalized',
    revenueEntryCode: 'REV-202604-000002',
    title: 'Finalized event revenue',
    subjectTalentId: 'talent-002',
    attributionPlatformAccountId: null,
    attributionEventId: 'event-001',
    revenueKind: 'EVENT_OPERATIONAL',
    entrySource: 'MANUAL',
    status: 'FINALIZED',
    currencyCode: 'USD',
    recognizedAmount: 240.5,
    recognizedAt: now - 120_000,
    finalizedAt: now - 100_000,
    reconciledAt: null,
    voidedAt: null,
    reconciliationReference: null,
    description: null,
    externalRef: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
  },
  {
    id: 'revenue-entry-blocked',
    revenueEntryCode: 'REV-202604-000003',
    title: 'Settlement blocked revenue',
    subjectTalentId: 'talent-001',
    attributionPlatformAccountId: 'platform-001',
    attributionEventId: null,
    revenueKind: 'PLATFORM_CONTENT',
    entrySource: 'MANUAL',
    status: 'FINALIZED',
    currencyCode: 'USD',
    recognizedAmount: 99,
    recognizedAt: now - 180_000,
    finalizedAt: now - 160_000,
    reconciledAt: null,
    voidedAt: null,
    reconciliationReference: null,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
  },
  {
    id: 'revenue-entry-archived',
    revenueEntryCode: 'REV-202604-999999',
    title: 'Archived revenue',
    subjectTalentId: 'talent-001',
    attributionPlatformAccountId: null,
    attributionEventId: null,
    revenueKind: 'PLATFORM_CONTENT',
    entrySource: 'MANUAL',
    status: 'ARCHIVED',
    currencyCode: 'VND',
    recognizedAmount: 1000,
    recognizedAt: now - 300_000,
    finalizedAt: null,
    reconciledAt: null,
    voidedAt: null,
    reconciliationReference: null,
    description: null,
    externalRef: null,
    createdAt: now - 4_000,
    updatedAt: now - 3_000,
  },
];

const initialPlatformEarningBatches: PlatformEarningBatch[] = [
  {
    id: 'platform-batch-approved',
    batchCode: 'PEB-202604-000001',
    platform: 'TIKTOK',
    platformAccountId: 'platform-001',
    talentGroupId: 'group-001',
    sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
    sourceUnit: 'DIAMOND',
    periodMonth: '2026-04',
    sourceDateFrom: Date.parse('2026-04-01T00:00:00.000Z'),
    sourceDateTo: Date.parse('2026-04-30T00:00:00.000Z'),
    status: 'APPROVED',
    sourceLineCount: 2,
    rawQuantityTotal: 2400,
    conversionSnapshot: {
      sourceUnit: 'DIAMOND',
      rawQuantity: 2400,
      targetCurrency: 'VND',
      appliedRate: 100,
      rateType: 'FINANCE_APPROVED',
      rateEffectiveFrom: null,
      rateEffectiveTo: null,
      grossConvertedAmount: 240000,
      ruleRef: 'fixture-conversion',
      appliedByActorId: 'finance-approver',
      appliedAt: now - 40_000,
      sourceNote: null,
    },
    platformCutSnapshot: {
      platformCutRate: 0.3,
      companyShareRate: 0.7,
      grossConvertedAmount: 240000,
      platformCutAmount: 72000,
      companyNetAmount: 168000,
      targetCurrency: 'VND',
      ruleRef: 'fixture-platform-cut',
      appliedByActorId: 'finance-approver',
      appliedAt: now - 40_000,
      sourceNote: null,
    },
    companyNetAmount: 168000,
    commissionableBasisAmount: 168000,
    submittedByActorId: 'manager-1',
    submittedAt: now - 50_000,
    reviewedByActorId: 'finance-reviewer',
    reviewedAt: now - 45_000,
    approvedByActorId: 'finance-approver',
    approvedAt: now - 40_000,
    rejectedByActorId: null,
    rejectedAt: null,
    rejectionReason: null,
    voidedByActorId: null,
    voidedAt: null,
    voidReason: null,
    archivedByActorId: null,
    archivedAt: null,
    sourceFingerprint: 'fixture-approved-fingerprint',
    revenueEntryId: null,
    revenueEntryCreatedByActorId: null,
    revenueEntryCreatedAt: null,
    createdByActorId: 'manager-1',
    createdAt: now - 60_000,
    updatedAt: now - 40_000,
  },
  {
    id: 'platform-batch-review',
    batchCode: 'PEB-202604-000002',
    platform: 'TIKTOK',
    platformAccountId: 'platform-001',
    talentGroupId: 'group-001',
    sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
    sourceUnit: 'DIAMOND',
    periodMonth: '2026-04',
    sourceDateFrom: Date.parse('2026-04-15T00:00:00.000Z'),
    sourceDateTo: Date.parse('2026-04-16T00:00:00.000Z'),
    status: 'UNDER_REVIEW',
    sourceLineCount: 1,
    rawQuantityTotal: 900,
    conversionSnapshot: null,
    platformCutSnapshot: null,
    companyNetAmount: null,
    commissionableBasisAmount: null,
    submittedByActorId: 'manager-1',
    submittedAt: now - 30_000,
    reviewedByActorId: 'finance-reviewer',
    reviewedAt: now - 25_000,
    approvedByActorId: null,
    approvedAt: null,
    rejectedByActorId: null,
    rejectedAt: null,
    rejectionReason: null,
    voidedByActorId: null,
    voidedAt: null,
    voidReason: null,
    archivedByActorId: null,
    archivedAt: null,
    sourceFingerprint: 'fixture-review-fingerprint',
    revenueEntryId: null,
    revenueEntryCreatedByActorId: null,
    revenueEntryCreatedAt: null,
    createdByActorId: 'manager-1',
    createdAt: now - 35_000,
    updatedAt: now - 25_000,
  },
  {
    id: 'platform-batch-draft',
    batchCode: 'PEB-202604-000003',
    platform: 'TIKTOK',
    platformAccountId: 'platform-001',
    talentGroupId: 'group-001',
    sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
    sourceUnit: 'DIAMOND',
    periodMonth: '2026-04',
    sourceDateFrom: Date.parse('2026-04-20T00:00:00.000Z'),
    sourceDateTo: Date.parse('2026-04-20T00:00:00.000Z'),
    status: 'DRAFT',
    sourceLineCount: 1,
    rawQuantityTotal: 500,
    conversionSnapshot: null,
    platformCutSnapshot: null,
    companyNetAmount: null,
    commissionableBasisAmount: null,
    submittedByActorId: null,
    submittedAt: null,
    reviewedByActorId: null,
    reviewedAt: null,
    approvedByActorId: null,
    approvedAt: null,
    rejectedByActorId: null,
    rejectedAt: null,
    rejectionReason: null,
    voidedByActorId: null,
    voidedAt: null,
    voidReason: null,
    archivedByActorId: null,
    archivedAt: null,
    sourceFingerprint: 'fixture-draft-fingerprint',
    revenueEntryId: null,
    revenueEntryCreatedByActorId: null,
    revenueEntryCreatedAt: null,
    createdByActorId: 'manager-1',
    createdAt: now - 20_000,
    updatedAt: now - 20_000,
  },
];

const initialPlatformEarningLines: Record<string, PlatformEarningLine[]> = {
  'platform-batch-approved': [
    {
      id: 'platform-line-approved-1',
      batchId: 'platform-batch-approved',
      batchStatus: 'APPROVED',
      sourceDate: Date.parse('2026-04-10T00:00:00.000Z'),
      periodMonth: '2026-04',
      platform: 'TIKTOK',
      platformAccountId: 'platform-001',
      talentGroupId: 'group-001',
      memberTalentId: 'talent-001',
      memberEmploymentProfileId: 'ep-group-member',
      eventId: null,
      sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
      sourceUnit: 'DIAMOND',
      rawQuantity: 1200,
      externalSourceRef: 'TT-APR-10',
      notes: null,
      duplicateDetectionKey: 'fixture-approved-1',
      correctionOfLineId: null,
      replacementLineId: null,
      enteredByActorId: 'manager-1',
      enteredAt: now - 60_000,
      submittedByActorId: 'manager-1',
      submittedAt: now - 50_000,
      createdAt: now - 60_000,
      updatedAt: now - 40_000,
    },
    {
      id: 'platform-line-approved-2',
      batchId: 'platform-batch-approved',
      batchStatus: 'APPROVED',
      sourceDate: Date.parse('2026-04-11T00:00:00.000Z'),
      periodMonth: '2026-04',
      platform: 'TIKTOK',
      platformAccountId: 'platform-001',
      talentGroupId: 'group-001',
      memberTalentId: 'talent-002',
      memberEmploymentProfileId: 'ep-group-member-2',
      eventId: null,
      sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
      sourceUnit: 'DIAMOND',
      rawQuantity: 1200,
      externalSourceRef: 'TT-APR-11',
      notes: null,
      duplicateDetectionKey: 'fixture-approved-2',
      correctionOfLineId: null,
      replacementLineId: null,
      enteredByActorId: 'manager-1',
      enteredAt: now - 60_000,
      submittedByActorId: 'manager-1',
      submittedAt: now - 50_000,
      createdAt: now - 60_000,
      updatedAt: now - 40_000,
    },
  ],
  'platform-batch-review': [
    {
      id: 'platform-line-review-1',
      batchId: 'platform-batch-review',
      batchStatus: 'UNDER_REVIEW',
      sourceDate: Date.parse('2026-04-15T00:00:00.000Z'),
      periodMonth: '2026-04',
      platform: 'TIKTOK',
      platformAccountId: 'platform-001',
      talentGroupId: 'group-001',
      memberTalentId: 'talent-001',
      memberEmploymentProfileId: 'ep-group-member',
      eventId: null,
      sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
      sourceUnit: 'DIAMOND',
      rawQuantity: 900,
      externalSourceRef: 'TT-APR-15',
      notes: null,
      duplicateDetectionKey: 'fixture-review-1',
      correctionOfLineId: null,
      replacementLineId: null,
      enteredByActorId: 'manager-1',
      enteredAt: now - 35_000,
      submittedByActorId: 'manager-1',
      submittedAt: now - 30_000,
      createdAt: now - 35_000,
      updatedAt: now - 25_000,
    },
  ],
  'platform-batch-draft': [
    {
      id: 'platform-line-draft-1',
      batchId: 'platform-batch-draft',
      batchStatus: 'DRAFT',
      sourceDate: Date.parse('2026-04-20T00:00:00.000Z'),
      periodMonth: '2026-04',
      platform: 'TIKTOK',
      platformAccountId: 'platform-001',
      talentGroupId: 'group-001',
      memberTalentId: 'talent-001',
      memberEmploymentProfileId: 'ep-group-member',
      eventId: null,
      sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
      sourceUnit: 'DIAMOND',
      rawQuantity: 500,
      externalSourceRef: 'TT-APR-20',
      notes: null,
      duplicateDetectionKey: 'fixture-draft-1',
      correctionOfLineId: null,
      replacementLineId: null,
      enteredByActorId: 'manager-1',
      enteredAt: now - 20_000,
      submittedByActorId: null,
      submittedAt: null,
      createdAt: now - 20_000,
      updatedAt: now - 20_000,
    },
  ],
};

let talentKpiSeed = 100;
let revenueSeed = 100;
let platformEarningRevenueSeed = 100;
let talentKpiRecords: TalentKpiRecord[] = [];
let talentKpiMetrics: Record<string, TalentKpiMetricRecord[]> = {};
let revenueEntries: RevenueEntryRecord[] = [];
let platformEarningBatches: PlatformEarningBatch[] = [];
let platformEarningLines: Record<string, PlatformEarningLine[]> = {};

const cloneTalentKpis = (): TalentKpiRecord[] =>
  initialTalentKpiRecords.map((record) => ({ ...record }));

const cloneTalentKpiMetrics = (): Record<string, TalentKpiMetricRecord[]> =>
  Object.fromEntries(
    Object.entries(initialTalentKpiMetrics).map(([id, metrics]) => [
      id,
      metrics.map((metric) => ({ ...metric })),
    ]),
  );

const cloneRevenueEntries = (): RevenueEntryRecord[] =>
  initialRevenueEntries.map((record) => ({ ...record }));

const clonePlatformEarningBatches = (): PlatformEarningBatch[] =>
  initialPlatformEarningBatches.map((record) => ({ ...record }));

const clonePlatformEarningLines = (): Record<string, PlatformEarningLine[]> =>
  Object.fromEntries(
    Object.entries(initialPlatformEarningLines).map(([id, lines]) => [
      id,
      lines.map((line) => ({ ...line })),
    ]),
  );

export const resetWave8MockData = (): void => {
  talentKpiSeed = 100;
  revenueSeed = 100;
  platformEarningRevenueSeed = 100;
  talentKpiRecords = cloneTalentKpis();
  talentKpiMetrics = cloneTalentKpiMetrics();
  revenueEntries = cloneRevenueEntries();
  platformEarningBatches = clonePlatformEarningBatches();
  platformEarningLines = clonePlatformEarningLines();
};

resetWave8MockData();

const parsePositiveInt = (value: string | null | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

const paginate = <TData>(
  items: TData[],
  searchParams: URLSearchParams,
): { data: TData[]; meta: { nextCursor: string | null } } => {
  const limitParam = parsePositiveInt(searchParams.get('limit'));
  const limit = Math.min(limitParam ?? 20, 100);
  const cursorParam = parsePositiveInt(searchParams.get('cursor'));
  const cursor = cursorParam ?? 0;
  const start = Math.min(cursor, items.length);
  const end = Math.min(start + limit, items.length);
  const data = items.slice(start, end);
  const nextCursor = end < items.length ? String(end) : null;

  return {
    data,
    meta: { nextCursor },
  };
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return {};
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {};
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
};

const rejectUnsupportedQuery = (
  searchParams: URLSearchParams,
  allowedKeys: readonly string[],
): Response | undefined => {
  const allowed = new Set(allowedKeys);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key)) {
      return HttpResponse.json({ message: `Unsupported query key: ${key}` }, { status: 422 });
    }
  }

  return undefined;
};

const rejectUnsupportedBody = (
  body: Record<string, unknown>,
  allowedKeys: readonly string[],
): Response | undefined => {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      return HttpResponse.json({ message: `Unsupported body key: ${key}` }, { status: 422 });
    }
  }

  return undefined;
};

const matchesText = (value: string, search: string): boolean => {
  const normalizedValue = value.trim().toLowerCase();
  const normalizedSearch = search.trim().toLowerCase();
  return normalizedValue === normalizedSearch || normalizedValue.startsWith(normalizedSearch);
};

const readNumberParam = (searchParams: URLSearchParams, key: string): number | undefined => {
  const value = searchParams.get(key);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const metricValueValid = (metricCode: MetricCode, value: unknown): boolean => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }

  if (metricCode === 'LIVESTREAM_HOURS' || metricCode === 'REVENUE_ATTRIBUTED_AMOUNT') {
    return value >= 0 && /^\d+(\.\d{1,2})?$/.test(String(value));
  }

  if (
    metricCode === 'LIVESTREAM_SESSION_COUNT' ||
    metricCode === 'CONTENT_PUBLISH_COUNT' ||
    metricCode === 'EVENT_APPEARANCE_COUNT' ||
    metricCode === 'ENGAGEMENT_COUNT'
  ) {
    return Number.isInteger(value) && value >= 0;
  }

  return Number.isInteger(value);
};

const validMetricsPayload = (body: Record<string, unknown>): boolean => {
  if (!Array.isArray(body.metrics) || body.metrics.length === 0) {
    return false;
  }

  const seen = new Set<string>();
  return body.metrics.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    const metric = item as Record<string, unknown>;
    const metricCode = metric.metricCode as MetricCode;
    if (!metricCodes.includes(metricCode) || seen.has(metricCode)) {
      return false;
    }
    seen.add(metricCode);
    return metricValueValid(metricCode, metric.numericValue);
  });
};

const filterTalentKpis = (records: TalentKpiRecord[], searchParams: URLSearchParams) => {
  let rows = [...records];
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const windowStartAt = readNumberParam(searchParams, 'windowStartAt');
  const windowEndAt = readNumberParam(searchParams, 'windowEndAt');
  const createdBeforeAt = readNumberParam(searchParams, 'createdBeforeAt');
  const publishedFromAt = readNumberParam(searchParams, 'publishedFromAt');
  const publishedToAt = readNumberParam(searchParams, 'publishedToAt');
  const containsMetricCode = searchParams.get('containsMetricCode');

  rows = status
    ? rows.filter((item) => item.status === status)
    : rows.filter((item) => item.status !== 'ARCHIVED');
  if (search)
    rows = rows.filter(
      (item) => matchesText(item.kpiRecordCode, search) || matchesText(item.title, search),
    );
  if (searchParams.get('subjectTalentId'))
    rows = rows.filter((item) => item.subjectTalentId === searchParams.get('subjectTalentId'));
  if (searchParams.get('attributionPlatformAccountId'))
    rows = rows.filter(
      (item) =>
        item.attributionPlatformAccountId === searchParams.get('attributionPlatformAccountId'),
    );
  if (searchParams.get('attributionEventId'))
    rows = rows.filter(
      (item) => item.attributionEventId === searchParams.get('attributionEventId'),
    );
  if (searchParams.get('measurementSource'))
    rows = rows.filter((item) => item.measurementSource === searchParams.get('measurementSource'));
  if (windowStartAt !== undefined) rows = rows.filter((item) => item.periodEndAt > windowStartAt);
  if (windowEndAt !== undefined) rows = rows.filter((item) => item.periodStartAt < windowEndAt);
  if (createdBeforeAt !== undefined) rows = rows.filter((item) => item.createdAt < createdBeforeAt);
  if (publishedFromAt !== undefined) {
    rows = rows.filter((item) => item.publishedAt != null && item.publishedAt >= publishedFromAt);
  }
  if (publishedToAt !== undefined) {
    rows = rows.filter((item) => item.publishedAt != null && item.publishedAt < publishedToAt);
  }
  if (containsMetricCode) {
    rows = rows.filter((item) =>
      (talentKpiMetrics[item.id] ?? []).some((metric) => metric.metricCode === containsMetricCode),
    );
  }

  return rows.sort(
    (left, right) => left.periodStartAt - right.periodStartAt || left.id.localeCompare(right.id),
  );
};

const hasUnsafeRevenueNarrowSort = (searchParams: URLSearchParams): boolean => {
  const sortBy = searchParams.get('sortBy');
  if (sortBy !== 'createdAt' && sortBy !== 'revenueEntryCode') {
    return false;
  }

  return [
    'status',
    'subjectTalentId',
    'attributionPlatformAccountId',
    'attributionEventId',
    'revenueKind',
    'entrySource',
    'currencyCode',
    'windowStartAt',
    'windowEndAt',
    'createdBeforeAt',
    'finalizedFromAt',
    'finalizedToAt',
    'reconciledFromAt',
    'reconciledToAt',
    'search',
  ].some((key) => searchParams.has(key));
};

const filterRevenueEntries = (records: RevenueEntryRecord[], searchParams: URLSearchParams) => {
  let rows = [...records];
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const windowStartAt = readNumberParam(searchParams, 'windowStartAt');
  const windowEndAt = readNumberParam(searchParams, 'windowEndAt');
  const createdBeforeAt = readNumberParam(searchParams, 'createdBeforeAt');
  const finalizedFromAt = readNumberParam(searchParams, 'finalizedFromAt');
  const finalizedToAt = readNumberParam(searchParams, 'finalizedToAt');
  const reconciledFromAt = readNumberParam(searchParams, 'reconciledFromAt');
  const reconciledToAt = readNumberParam(searchParams, 'reconciledToAt');

  rows = status
    ? rows.filter((item) => item.status === status)
    : rows.filter((item) => item.status !== 'ARCHIVED');
  if (search)
    rows = rows.filter(
      (item) => matchesText(item.revenueEntryCode, search) || matchesText(item.title, search),
    );
  if (searchParams.get('subjectTalentId'))
    rows = rows.filter((item) => item.subjectTalentId === searchParams.get('subjectTalentId'));
  if (searchParams.get('attributionPlatformAccountId'))
    rows = rows.filter(
      (item) =>
        item.attributionPlatformAccountId === searchParams.get('attributionPlatformAccountId'),
    );
  if (searchParams.get('attributionEventId'))
    rows = rows.filter(
      (item) => item.attributionEventId === searchParams.get('attributionEventId'),
    );
  if (searchParams.get('revenueKind'))
    rows = rows.filter((item) => item.revenueKind === searchParams.get('revenueKind'));
  if (searchParams.get('entrySource'))
    rows = rows.filter((item) => item.entrySource === searchParams.get('entrySource'));
  if (searchParams.get('currencyCode'))
    rows = rows.filter((item) => item.currencyCode === searchParams.get('currencyCode'));
  if (windowStartAt !== undefined) rows = rows.filter((item) => item.recognizedAt >= windowStartAt);
  if (windowEndAt !== undefined) rows = rows.filter((item) => item.recognizedAt < windowEndAt);
  if (createdBeforeAt !== undefined) rows = rows.filter((item) => item.createdAt < createdBeforeAt);
  if (finalizedFromAt !== undefined) {
    rows = rows.filter((item) => item.finalizedAt != null && item.finalizedAt >= finalizedFromAt);
  }
  if (finalizedToAt !== undefined) {
    rows = rows.filter((item) => item.finalizedAt != null && item.finalizedAt < finalizedToAt);
  }
  if (reconciledFromAt !== undefined) {
    rows = rows.filter(
      (item) => item.reconciledAt != null && item.reconciledAt >= reconciledFromAt,
    );
  }
  if (reconciledToAt !== undefined) {
    rows = rows.filter((item) => item.reconciledAt != null && item.reconciledAt < reconciledToAt);
  }

  return rows.sort(
    (left, right) => left.recognizedAt - right.recognizedAt || left.id.localeCompare(right.id),
  );
};

const readTalentKpi = (id: string): TalentKpiRecord | undefined =>
  talentKpiRecords.find((item) => item.id === id);

const readRevenueEntry = (id: string): RevenueEntryRecord | undefined =>
  revenueEntries.find((item) => item.id === id);

const readPlatformEarningBatch = (id: string): PlatformEarningBatch | undefined =>
  platformEarningBatches.find((item) => item.id === id);

const filterPlatformEarningBatches = (
  records: PlatformEarningBatch[],
  searchParams: URLSearchParams,
) => {
  let rows = [...records];
  const status = searchParams.get('status');
  const periodMonth = searchParams.get('periodMonth');
  const platform = searchParams.get('platform');
  const platformAccountId = searchParams.get('platformAccountId');
  const talentGroupId = searchParams.get('talentGroupId');
  const sourceType = searchParams.get('sourceType');
  const createdBeforeAt = readNumberParam(searchParams, 'createdBeforeAt');

  if (status) rows = rows.filter((item) => item.status === status);
  if (periodMonth) rows = rows.filter((item) => item.periodMonth === periodMonth);
  if (platform) rows = rows.filter((item) => item.platform === platform);
  if (platformAccountId)
    rows = rows.filter((item) => item.platformAccountId === platformAccountId);
  if (talentGroupId) rows = rows.filter((item) => item.talentGroupId === talentGroupId);
  if (sourceType) rows = rows.filter((item) => item.sourceType === sourceType);
  if (createdBeforeAt !== undefined) rows = rows.filter((item) => item.createdAt < createdBeforeAt);

  return rows.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
};

const updatePlatformBatchLineStatuses = (batch: PlatformEarningBatch): void => {
  platformEarningLines[batch.id] = (platformEarningLines[batch.id] ?? []).map((line) => ({
    ...line,
    batchStatus: batch.status,
    updatedAt: batch.updatedAt,
  }));
};

const toTalentKpiListItem = (record: TalentKpiRecord) => ({
  id: record.id,
  kpiRecordCode: record.kpiRecordCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  attributionPlatformAccountId: record.attributionPlatformAccountId ?? null,
  attributionEventId: record.attributionEventId ?? null,
  subjectTalentRef: talentRefs.get(record.subjectTalentId) ?? null,
  attributionPlatformAccountRef: record.attributionPlatformAccountId
    ? (platformRefSummaries.get(record.attributionPlatformAccountId) ?? null)
    : null,
  attributionEventRef: record.attributionEventId
    ? (eventRefs.get(record.attributionEventId) ?? null)
    : null,
  measurementSource: record.measurementSource,
  status: record.status,
  periodStartAt: record.periodStartAt,
  periodEndAt: record.periodEndAt,
  publishedAt: record.publishedAt ?? null,
  createdAt: record.createdAt,
});

const toTalentKpiByTalentItem = (record: TalentKpiRecord) => ({
  id: record.id,
  kpiRecordCode: record.kpiRecordCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  status: record.status,
  measurementSource: record.measurementSource,
  periodStartAt: record.periodStartAt,
  periodEndAt: record.periodEndAt,
  publishedAt: record.publishedAt ?? null,
});

const toTalentKpiByPlatformItem = (record: TalentKpiRecord) => ({
  id: record.id,
  kpiRecordCode: record.kpiRecordCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  attributionPlatformAccountId: record.attributionPlatformAccountId,
  status: record.status,
  periodStartAt: record.periodStartAt,
  periodEndAt: record.periodEndAt,
});

const toTalentKpiByEventItem = (record: TalentKpiRecord) => ({
  id: record.id,
  kpiRecordCode: record.kpiRecordCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  attributionEventId: record.attributionEventId,
  status: record.status,
  periodStartAt: record.periodStartAt,
  periodEndAt: record.periodEndAt,
});

const toTalentKpiDetail = (record: TalentKpiRecord): TalentKpiRecord => ({
  ...record,
  subjectTalentRef: talentRefs.get(record.subjectTalentId) ?? null,
  attributionPlatformAccountRef: record.attributionPlatformAccountId
    ? (platformRefSummaries.get(record.attributionPlatformAccountId) ?? null)
    : null,
  attributionEventRef: record.attributionEventId
    ? (eventRefs.get(record.attributionEventId) ?? null)
    : null,
});

const toRevenueEntryListItem = (record: RevenueEntryRecord) => ({
  id: record.id,
  revenueEntryCode: record.revenueEntryCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  attributionPlatformAccountId: record.attributionPlatformAccountId ?? null,
  attributionEventId: record.attributionEventId ?? null,
  subjectTalentRef: talentRefs.get(record.subjectTalentId) ?? null,
  attributionPlatformAccountRef: record.attributionPlatformAccountId
    ? (platformRefSummaries.get(record.attributionPlatformAccountId) ?? null)
    : null,
  attributionEventRef: record.attributionEventId
    ? (eventRefs.get(record.attributionEventId) ?? null)
    : null,
  revenueKind: record.revenueKind,
  entrySource: record.entrySource,
  status: record.status,
  currencyCode: record.currencyCode,
  recognizedAmount: record.recognizedAmount,
  recognizedAt: record.recognizedAt,
  createdAt: record.createdAt,
});

const toRevenueEntryByTalentItem = (record: RevenueEntryRecord) => ({
  id: record.id,
  revenueEntryCode: record.revenueEntryCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  revenueKind: record.revenueKind,
  status: record.status,
  currencyCode: record.currencyCode,
  recognizedAmount: record.recognizedAmount,
  recognizedAt: record.recognizedAt,
});

const toRevenueEntryByPlatformItem = (record: RevenueEntryRecord) => ({
  id: record.id,
  revenueEntryCode: record.revenueEntryCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  attributionPlatformAccountId: record.attributionPlatformAccountId,
  revenueKind: record.revenueKind,
  status: record.status,
  currencyCode: record.currencyCode,
  recognizedAmount: record.recognizedAmount,
  recognizedAt: record.recognizedAt,
});

const toRevenueEntryByEventItem = (record: RevenueEntryRecord) => ({
  id: record.id,
  revenueEntryCode: record.revenueEntryCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  attributionEventId: record.attributionEventId,
  revenueKind: record.revenueKind,
  status: record.status,
  currencyCode: record.currencyCode,
  recognizedAmount: record.recognizedAmount,
  recognizedAt: record.recognizedAt,
});

const toRevenueEntryDetail = (record: RevenueEntryRecord): RevenueEntryRecord => ({
  ...record,
  subjectTalentRef: talentRefs.get(record.subjectTalentId) ?? null,
  attributionPlatformAccountRef: record.attributionPlatformAccountId
    ? (platformRefSummaries.get(record.attributionPlatformAccountId) ?? null)
    : null,
  attributionEventRef: record.attributionEventId
    ? (eventRefs.get(record.attributionEventId) ?? null)
    : null,
});

const toMetricRecords = (
  talentKpiRecordId: string,
  metrics: Array<Record<string, unknown>>,
): TalentKpiMetricRecord[] =>
  metrics.map((metric, index) => ({
    id: `${talentKpiRecordId}-metric-${index + 1}`,
    metricCode: metric.metricCode as MetricCode,
    numericValue: Number(metric.numericValue),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

const talentKpiFlatKeys = [
  'status',
  'subjectTalentId',
  'attributionPlatformAccountId',
  'attributionEventId',
  'measurementSource',
  'containsMetricCode',
  'windowStartAt',
  'windowEndAt',
  'createdBeforeAt',
  'publishedFromAt',
  'publishedToAt',
  'limit',
  'cursor',
  'search',
  'sortBy',
  'sortDirection',
] as const;
const talentKpiByTalentKeys = [
  'subjectTalentId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
] as const;
const talentKpiByPlatformKeys = [
  'attributionPlatformAccountId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
] as const;
const talentKpiByEventKeys = [
  'attributionEventId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
] as const;
const revenueFlatKeys = [
  'status',
  'subjectTalentId',
  'attributionPlatformAccountId',
  'attributionEventId',
  'revenueKind',
  'entrySource',
  'currencyCode',
  'windowStartAt',
  'windowEndAt',
  'createdBeforeAt',
  'finalizedFromAt',
  'finalizedToAt',
  'reconciledFromAt',
  'reconciledToAt',
  'limit',
  'cursor',
  'search',
  'sortBy',
  'sortDirection',
] as const;
const revenueByTalentKeys = talentKpiByTalentKeys;
const revenueByPlatformKeys = talentKpiByPlatformKeys;
const revenueByEventKeys = talentKpiByEventKeys;
const platformEarningBatchKeys = [
  'status',
  'platform',
  'platformAccountId',
  'talentGroupId',
  'sourceType',
  'periodMonth',
  'createdBeforeAt',
  'limit',
  'cursor',
] as const;
const platformEarningLineKeys = [
  'batchId',
  'status',
  'platform',
  'platformAccountId',
  'talentGroupId',
  'memberTalentId',
  'periodMonth',
  'limit',
  'cursor',
] as const;

export const wave8Handlers = [
  http.get('*/admin/talent-kpi-records', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, talentKpiFlatKeys);
    if (unsupported) return unsupported;
    return HttpResponse.json(
      paginate(
        filterTalentKpis(talentKpiRecords, url.searchParams).map(toTalentKpiListItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/talent-kpi-records/by-talent', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, talentKpiByTalentKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('subjectTalentId'))
      return HttpResponse.json({ message: 'Missing subjectTalentId' }, { status: 422 });
    return HttpResponse.json(
      paginate(
        filterTalentKpis(talentKpiRecords, url.searchParams).map(toTalentKpiByTalentItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/talent-kpi-records/by-platform', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, talentKpiByPlatformKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('attributionPlatformAccountId'))
      return HttpResponse.json(
        { message: 'Missing attributionPlatformAccountId' },
        { status: 422 },
      );
    return HttpResponse.json(
      paginate(
        filterTalentKpis(talentKpiRecords, url.searchParams).map(toTalentKpiByPlatformItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/talent-kpi-records/by-event', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, talentKpiByEventKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('attributionEventId'))
      return HttpResponse.json({ message: 'Missing attributionEventId' }, { status: 422 });
    return HttpResponse.json(
      paginate(
        filterTalentKpis(talentKpiRecords, url.searchParams).map(toTalentKpiByEventItem),
        url.searchParams,
      ),
    );
  }),
  http.post('*/admin/talent-kpi-records', async ({ request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'kpiRecordCode',
      'title',
      'subjectTalentId',
      'attributionPlatformAccountId',
      'attributionEventId',
      'measurementSource',
      'periodStartAt',
      'periodEndAt',
      'metrics',
      'description',
      'externalRef',
    ]);
    if (unsupported) return unsupported;
    if (!validMetricsPayload(body))
      return HttpResponse.json({ message: 'Invalid metrics' }, { status: 422 });
    talentKpiSeed += 1;
    const id = `talent-kpi-record-${talentKpiSeed}`;
    const record: TalentKpiRecord = {
      id,
      kpiRecordCode: providedOrGeneratedFixtureCode(
        body.kpiRecordCode,
        generatedFixtureMonthCode('KPI', body.periodStartAt, talentKpiSeed),
      ),
      title: String(body.title),
      subjectTalentId: String(body.subjectTalentId),
      attributionPlatformAccountId:
        (body.attributionPlatformAccountId as string | null | undefined) ?? null,
      attributionEventId: (body.attributionEventId as string | null | undefined) ?? null,
      measurementSource: 'MANUAL',
      status: 'DRAFT',
      periodStartAt: Number(body.periodStartAt),
      periodEndAt: Number(body.periodEndAt),
      publishedAt: null,
      description: (body.description as string | null | undefined) ?? null,
      externalRef: (body.externalRef as string | null | undefined) ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    talentKpiRecords.push(record);
    talentKpiMetrics[id] = toMetricRecords(id, body.metrics as Array<Record<string, unknown>>);
    return HttpResponse.json({ data: toTalentKpiDetail(record) });
  }),
  http.get('*/admin/talent-kpi-records/:talentKpiRecordId/metrics', ({ params }) => {
    const record = readTalentKpi(String(params.talentKpiRecordId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({ data: talentKpiMetrics[record.id] ?? [] });
  }),
  http.get('*/admin/talent-kpi-records/:talentKpiRecordId', ({ params }) => {
    const record = readTalentKpi(String(params.talentKpiRecordId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({ data: toTalentKpiDetail(record) });
  }),
  http.patch(
    '*/admin/talent-kpi-records/:talentKpiRecordId/draft-core',
    async ({ params, request }) => {
      const record = readTalentKpi(String(params.talentKpiRecordId));
      if (!record)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (record.status !== 'DRAFT')
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, [
        'title',
        'subjectTalentId',
        'attributionPlatformAccountId',
        'attributionEventId',
        'periodStartAt',
        'periodEndAt',
        'description',
        'externalRef',
      ]);
      if (unsupported) return unsupported;
      Object.assign(record, body, { updatedAt: Date.now() });
      return HttpResponse.json({ data: toTalentKpiDetail(record) });
    },
  ),
  http.post(
    '*/admin/talent-kpi-records/:talentKpiRecordId/metrics',
    async ({ params, request }) => {
      const record = readTalentKpi(String(params.talentKpiRecordId));
      if (!record)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (record.status !== 'DRAFT')
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, ['metrics']);
      if (unsupported) return unsupported;
      if (!validMetricsPayload(body))
        return HttpResponse.json({ message: 'Invalid metrics' }, { status: 422 });
      talentKpiMetrics[record.id] = toMetricRecords(
        record.id,
        body.metrics as Array<Record<string, unknown>>,
      );
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: toTalentKpiDetail(record) });
    },
  ),
  http.post(
    '*/admin/talent-kpi-records/:talentKpiRecordId/finalize',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, []);
      if (unsupported) return unsupported;
      const record = readTalentKpi(String(params.talentKpiRecordId));
      if (!record)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (record.status !== 'DRAFT')
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      record.status = 'FINALIZED';
      record.publishedAt = Date.now();
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: toTalentKpiDetail(record) });
    },
  ),
  http.post(
    '*/admin/talent-kpi-records/:talentKpiRecordId/archive',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, []);
      if (unsupported) return unsupported;
      const record = readTalentKpi(String(params.talentKpiRecordId));
      if (!record)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (record.status !== 'DRAFT' && record.status !== 'FINALIZED')
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      record.status = 'ARCHIVED';
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: toTalentKpiDetail(record) });
    },
  ),

  http.get('*/admin/revenue-ledger/platform-earning-batches', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, platformEarningBatchKeys);
    if (unsupported) return unsupported;
    return HttpResponse.json(
      paginate(filterPlatformEarningBatches(platformEarningBatches, url.searchParams), url.searchParams),
    );
  }),
  http.get(
    '*/admin/revenue-ledger/platform-earning-batches/:batchId/source-lines',
    ({ params, request }) => {
      const url = new URL(request.url);
      const unsupported = rejectUnsupportedQuery(url.searchParams, platformEarningLineKeys);
      if (unsupported) return unsupported;
      const batch = readPlatformEarningBatch(String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      return HttpResponse.json(
        paginate(platformEarningLines[batch.id] ?? [], url.searchParams),
      );
    },
  ),
  http.post(
    '*/admin/revenue-ledger/platform-earning-batches/:batchId/submit',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, []);
      if (unsupported) return unsupported;
      const batch = readPlatformEarningBatch(String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (batch.status !== 'DRAFT') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      batch.status = 'SUBMITTED';
      batch.submittedAt = Date.now();
      batch.updatedAt = Date.now();
      updatePlatformBatchLineStatuses(batch);
      return HttpResponse.json({ data: batch });
    },
  ),
  http.post(
    '*/admin/revenue-ledger/platform-earning-batches/:batchId/start-review',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, []);
      if (unsupported) return unsupported;
      const batch = readPlatformEarningBatch(String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (batch.status !== 'SUBMITTED') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      batch.status = 'UNDER_REVIEW';
      batch.reviewedAt = Date.now();
      batch.updatedAt = Date.now();
      updatePlatformBatchLineStatuses(batch);
      return HttpResponse.json({ data: batch });
    },
  ),
  http.post(
    '*/admin/revenue-ledger/platform-earning-batches/:batchId/approve',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, [
        'targetCurrency',
        'appliedRate',
        'rateType',
        'rateEffectiveFrom',
        'rateEffectiveTo',
        'platformCutRate',
        'companyShareRate',
        'conversionRuleRef',
        'platformCutRuleRef',
        'sourceNote',
      ]);
      if (unsupported) return unsupported;
      const batch = readPlatformEarningBatch(String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (batch.status !== 'UNDER_REVIEW') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      const appliedRate = Number(body.appliedRate);
      const platformCutRate = Number(body.platformCutRate);
      const convertedGrossAmount = batch.rawQuantityTotal * appliedRate;
      const platformCutAmount = convertedGrossAmount * platformCutRate;
      const companyGrossShareAmount = convertedGrossAmount - platformCutAmount;
      batch.status = 'APPROVED';
      batch.approvedAt = Date.now();
      batch.updatedAt = Date.now();
      batch.conversionSnapshot = {
        sourceUnit: 'DIAMOND',
        rawQuantity: batch.rawQuantityTotal,
        targetCurrency: String(body.targetCurrency ?? 'VND'),
        appliedRate,
        rateType: String(body.rateType ?? 'FINANCE_APPROVED'),
        rateEffectiveFrom: (body.rateEffectiveFrom as number | null | undefined) ?? null,
        rateEffectiveTo: (body.rateEffectiveTo as number | null | undefined) ?? null,
        grossConvertedAmount: convertedGrossAmount,
        ruleRef: (body.conversionRuleRef as string | null | undefined) ?? null,
        appliedByActorId: 'finance-approver',
        appliedAt: batch.approvedAt,
        sourceNote: (body.sourceNote as string | null | undefined) ?? null,
      };
      batch.platformCutSnapshot = {
        platformCutRate,
        companyShareRate: 1 - platformCutRate,
        grossConvertedAmount: convertedGrossAmount,
        platformCutAmount,
        companyNetAmount: companyGrossShareAmount,
        targetCurrency: String(body.targetCurrency ?? 'VND'),
        ruleRef: (body.platformCutRuleRef as string | null | undefined) ?? null,
        appliedByActorId: 'finance-approver',
        appliedAt: batch.approvedAt,
        sourceNote: (body.sourceNote as string | null | undefined) ?? null,
      };
      batch.approvedByActorId = 'finance-approver';
      batch.companyNetAmount = companyGrossShareAmount;
      batch.commissionableBasisAmount = companyGrossShareAmount;
      updatePlatformBatchLineStatuses(batch);
      return HttpResponse.json({ data: batch });
    },
  ),
  http.post(
    '*/admin/revenue-ledger/platform-earning-batches/:batchId/reject',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, ['reason']);
      if (unsupported) return unsupported;
      const batch = readPlatformEarningBatch(String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (batch.status !== 'SUBMITTED' && batch.status !== 'UNDER_REVIEW') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      batch.status = 'REJECTED';
      batch.rejectedByActorId = 'finance-reviewer';
      batch.rejectedAt = Date.now();
      batch.rejectionReason = String(body.reason ?? 'Rejected by Finance');
      batch.updatedAt = Date.now();
      updatePlatformBatchLineStatuses(batch);
      return HttpResponse.json({ data: batch });
    },
  ),
  http.post(
    '*/admin/revenue-ledger/platform-earning-batches/:batchId/void',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, ['reason']);
      if (unsupported) return unsupported;
      const batch = readPlatformEarningBatch(String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (!['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(batch.status)) {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      batch.status = 'VOIDED';
      batch.voidedByActorId = 'finance-voider';
      batch.voidedAt = Date.now();
      batch.voidReason = String(body.reason ?? 'Voided by Finance');
      batch.updatedAt = Date.now();
      updatePlatformBatchLineStatuses(batch);
      return HttpResponse.json({ data: batch });
    },
  ),
  http.post(
    '*/admin/revenue-ledger/platform-earning-batches/:batchId/archive',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, []);
      if (unsupported) return unsupported;
      const batch = readPlatformEarningBatch(String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (!['REJECTED', 'VOIDED', 'APPROVED'].includes(batch.status)) {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      batch.status = 'ARCHIVED';
      batch.archivedByActorId = 'finance-reviewer';
      batch.archivedAt = Date.now();
      batch.updatedAt = Date.now();
      updatePlatformBatchLineStatuses(batch);
      return HttpResponse.json({ data: batch });
    },
  ),
  http.post(
    '*/admin/revenue-ledger/platform-earning-batches/:batchId/create-revenue-entry',
    async ({ params, request }) => {
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, [
        'revenueEntryCode',
        'title',
        'subjectTalentId',
        'recognizedAt',
        'description',
        'externalRef',
      ]);
      if (unsupported) return unsupported;
      const batch = readPlatformEarningBatch(String(params.batchId));
      if (!batch) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (batch.status !== 'APPROVED') {
        return HttpResponse.json({ message: 'Only approved batches can create revenue entry' }, { status: 409 });
      }
      if (batch.revenueEntryId) {
        return HttpResponse.json({ message: 'Revenue entry already exists for batch' }, { status: 409 });
      }
      const memberTalentIds = [
        ...new Set(
          (platformEarningLines[batch.id] ?? [])
            .map((line) => line.memberTalentId)
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      const requestedSubjectTalentId =
        typeof body.subjectTalentId === 'string' ? body.subjectTalentId.trim() : '';
      if (memberTalentIds.length !== 1 && !requestedSubjectTalentId) {
        return HttpResponse.json(
          { message: 'subjectTalentId is required for a multi-member batch' },
          { status: 422 },
        );
      }
      if (requestedSubjectTalentId && !memberTalentIds.includes(requestedSubjectTalentId)) {
        return HttpResponse.json(
          { message: 'subjectTalentId must belong to the approved batch' },
          { status: 422 },
        );
      }
      platformEarningRevenueSeed += 1;
      const id = `revenue-entry-platform-${platformEarningRevenueSeed}`;
      const record: RevenueEntryRecord = {
        id,
        revenueEntryCode: providedOrGeneratedFixtureCode(
          body.revenueEntryCode,
          generatedFixtureMonthCode('REV', body.recognizedAt ?? batch.approvedAt, platformEarningRevenueSeed),
        ),
        title: String(body.title ?? batch.batchCode),
        subjectTalentId: requestedSubjectTalentId || memberTalentIds[0],
        attributionPlatformAccountId: batch.platformAccountId,
        attributionEventId: null,
        revenueKind: 'PLATFORM_LIVESTREAM',
        entrySource: 'PLATFORM_EARNING_BATCH',
        status: 'DRAFT',
        currencyCode: batch.conversionSnapshot?.targetCurrency ?? 'VND',
        recognizedAmount: batch.companyNetAmount ?? 0,
        recognizedAt: Number(body.recognizedAt ?? batch.approvedAt ?? Date.now()),
        finalizedAt: null,
        reconciledAt: null,
        voidedAt: null,
        reconciliationReference: null,
        description: (body.description as string | null | undefined) ?? null,
        externalRef: (body.externalRef as string | null | undefined) ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      revenueEntries.push(record);
      batch.revenueEntryId = id;
      batch.revenueEntryCreatedByActorId = 'finance-creator';
      batch.revenueEntryCreatedAt = record.createdAt;
      batch.updatedAt = Date.now();
      return HttpResponse.json({ data: toRevenueEntryDetail(record) });
    },
  ),
  http.get('*/admin/revenue-ledger/platform-earning-batches/:batchId', ({ params }) => {
    const batch = readPlatformEarningBatch(String(params.batchId));
    if (!batch) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    return HttpResponse.json({ data: batch });
  }),

  http.get('*/admin/revenue-entries', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, revenueFlatKeys);
    if (unsupported) return unsupported;
    if (hasUnsafeRevenueNarrowSort(url.searchParams)) {
      return HttpResponse.json({ message: 'Invalid revenue sort combination' }, { status: 422 });
    }
    return HttpResponse.json(
      paginate(
        filterRevenueEntries(revenueEntries, url.searchParams).map(toRevenueEntryListItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/revenue-entries/by-talent', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, revenueByTalentKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('subjectTalentId'))
      return HttpResponse.json({ message: 'Missing subjectTalentId' }, { status: 422 });
    if (url.searchParams.get('sortBy') && url.searchParams.get('sortBy') !== 'recognizedAt')
      return HttpResponse.json({ message: 'Invalid related sort' }, { status: 422 });
    return HttpResponse.json(
      paginate(
        filterRevenueEntries(revenueEntries, url.searchParams).map(toRevenueEntryByTalentItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/revenue-entries/by-platform', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, revenueByPlatformKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('attributionPlatformAccountId'))
      return HttpResponse.json(
        { message: 'Missing attributionPlatformAccountId' },
        { status: 422 },
      );
    if (url.searchParams.get('sortBy') && url.searchParams.get('sortBy') !== 'recognizedAt')
      return HttpResponse.json({ message: 'Invalid related sort' }, { status: 422 });
    return HttpResponse.json(
      paginate(
        filterRevenueEntries(revenueEntries, url.searchParams).map(toRevenueEntryByPlatformItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/revenue-entries/by-event', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, revenueByEventKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('attributionEventId'))
      return HttpResponse.json({ message: 'Missing attributionEventId' }, { status: 422 });
    if (url.searchParams.get('sortBy') && url.searchParams.get('sortBy') !== 'recognizedAt')
      return HttpResponse.json({ message: 'Invalid related sort' }, { status: 422 });
    return HttpResponse.json(
      paginate(
        filterRevenueEntries(revenueEntries, url.searchParams).map(toRevenueEntryByEventItem),
        url.searchParams,
      ),
    );
  }),
  http.post('*/admin/revenue-entries', async ({ request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'revenueEntryCode',
      'title',
      'subjectTalentId',
      'attributionPlatformAccountId',
      'attributionEventId',
      'revenueKind',
      'entrySource',
      'currencyCode',
      'recognizedAmount',
      'recognizedAt',
      'description',
      'externalRef',
    ]);
    if (unsupported) return unsupported;
    revenueSeed += 1;
    const record: RevenueEntryRecord = {
      id: `revenue-entry-${revenueSeed}`,
      revenueEntryCode: providedOrGeneratedFixtureCode(
        body.revenueEntryCode,
        generatedFixtureMonthCode('REV', body.recognizedAt, revenueSeed),
      ),
      title: String(body.title),
      subjectTalentId: String(body.subjectTalentId),
      attributionPlatformAccountId:
        (body.attributionPlatformAccountId as string | null | undefined) ?? null,
      attributionEventId: (body.attributionEventId as string | null | undefined) ?? null,
      revenueKind: body.revenueKind as RevenueKind,
      entrySource: 'MANUAL',
      status: 'DRAFT',
      currencyCode: String(body.currencyCode),
      recognizedAmount: Number(body.recognizedAmount),
      recognizedAt: Number(body.recognizedAt),
      finalizedAt: null,
      reconciledAt: null,
      voidedAt: null,
      reconciliationReference: null,
      description: (body.description as string | null | undefined) ?? null,
      externalRef: (body.externalRef as string | null | undefined) ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    revenueEntries.push(record);
    return HttpResponse.json({ data: toRevenueEntryDetail(record) });
  }),
  http.get('*/admin/revenue-entries/:revenueEntryId', ({ params }) => {
    const record = readRevenueEntry(String(params.revenueEntryId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({ data: toRevenueEntryDetail(record) });
  }),
  http.patch('*/admin/revenue-entries/:revenueEntryId/draft-core', async ({ params, request }) => {
    const record = readRevenueEntry(String(params.revenueEntryId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (record.status !== 'DRAFT')
      return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'title',
      'description',
      'externalRef',
      'subjectTalentId',
      'attributionPlatformAccountId',
      'attributionEventId',
      'revenueKind',
      'currencyCode',
      'recognizedAmount',
      'recognizedAt',
    ]);
    if (unsupported) return unsupported;
    Object.assign(record, body, { updatedAt: Date.now() });
    return HttpResponse.json({ data: toRevenueEntryDetail(record) });
  }),
  http.post('*/admin/revenue-entries/:revenueEntryId/finalize', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, []);
    if (unsupported) return unsupported;
    const record = readRevenueEntry(String(params.revenueEntryId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (record.status !== 'DRAFT')
      return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
    record.status = 'FINALIZED';
    record.finalizedAt = Date.now();
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toRevenueEntryDetail(record) });
  }),
  http.post('*/admin/revenue-entries/:revenueEntryId/reconcile', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, ['reconciliationReference']);
    if (unsupported) return unsupported;
    const record = readRevenueEntry(String(params.revenueEntryId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (record.status !== 'FINALIZED')
      return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
    record.status = 'RECONCILED';
    record.reconciledAt = Date.now();
    record.reconciliationReference =
      (body.reconciliationReference as string | null | undefined) ?? null;
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toRevenueEntryDetail(record) });
  }),
  http.post('*/admin/revenue-entries/:revenueEntryId/void', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, []);
    if (unsupported) return unsupported;
    const record = readRevenueEntry(String(params.revenueEntryId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (record.id === 'revenue-entry-blocked')
      return HttpResponse.json(
        { message: 'Finalized commission settlement blocks void' },
        { status: 409 },
      );
    if (record.status !== 'FINALIZED')
      return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
    record.status = 'VOIDED';
    record.voidedAt = Date.now();
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toRevenueEntryDetail(record) });
  }),
  http.post('*/admin/revenue-entries/:revenueEntryId/archive', async ({ params, request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, []);
    if (unsupported) return unsupported;
    const record = readRevenueEntry(String(params.revenueEntryId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (!['DRAFT', 'RECONCILED', 'VOIDED'].includes(record.status))
      return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
    record.status = 'ARCHIVED';
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toRevenueEntryDetail(record) });
  }),
];
