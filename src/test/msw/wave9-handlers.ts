import { http, HttpResponse } from 'msw';

import {
  generatedFixtureCode,
  generatedFixtureMonthCode,
  providedOrGeneratedFixtureCode,
} from '@test/msw/generated-code-fixtures';

type CommissionRuleStatus = 'DRAFT' | 'INACTIVE' | 'ACTIVE' | 'ARCHIVED';
type CommissionSettlementStatus = 'DRAFT' | 'FINALIZED' | 'VOIDED' | 'ARCHIVED';
type CommissionBeneficiaryKind = 'EMPLOYMENT_PROFILE' | 'TALENT';
type RevenueKind = 'PLATFORM_LIVESTREAM' | 'PLATFORM_CONTENT' | 'EVENT_OPERATIONAL';

type CommissionRuleRecord = {
  id: string;
  ruleCode: string;
  title: string;
  settlementKind: 'REVENUE_SHARE';
  beneficiaryKind: CommissionBeneficiaryKind;
  beneficiaryEmploymentProfileId: string | null;
  beneficiaryTalentId: string | null;
  sourceContractRecordId: string;
  settlementBasis: 'RECOGNIZED_GROSS_REVENUE';
  ratePercent: number;
  appliesToRevenueKinds: RevenueKind[];
  status: CommissionRuleStatus;
  effectiveStartDate: number;
  effectiveEndDate: number | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type CommissionSettlementRecord = {
  id: string;
  settlementCode: string;
  title: string;
  sourceRuleId: string;
  sourceContractRecordIdSnapshot: string | null;
  settlementKindSnapshot: 'REVENUE_SHARE';
  beneficiaryKindSnapshot: CommissionBeneficiaryKind;
  beneficiaryEmploymentProfileIdSnapshot: string | null;
  beneficiaryTalentIdSnapshot: string | null;
  subjectTalentId: string;
  settlementBasisSnapshot: 'RECOGNIZED_GROSS_REVENUE';
  ratePercentSnapshot: number;
  revenueEntryIds: string[];
  settlementPeriodStartAt: number;
  settlementPeriodEndAt: number;
  settlementCurrencyCode: string;
  grossRevenueAmount: number;
  settlementAmount: number;
  status: CommissionSettlementStatus;
  finalizedAt: number | null;
  voidedAt: number | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type CommissionSettlementLineRecord = {
  id: string;
  revenueEntryId: string;
  revenueEntryCodeSnapshot: string;
  revenueKindSnapshot: RevenueKind;
  revenueCurrencyCodeSnapshot: string;
  revenueRecognizedAmountSnapshot: number;
  revenueRecognizedAtSnapshot: number;
  lineSettlementAmount: number;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const revenueKinds: RevenueKind[] = [
  'PLATFORM_LIVESTREAM',
  'PLATFORM_CONTENT',
  'EVENT_OPERATIONAL',
];

const initialRules: CommissionRuleRecord[] = [
  {
    id: 'commission-rule-001',
    ruleCode: 'CRULE-000001',
    title: 'April livestream revenue share',
    settlementKind: 'REVENUE_SHARE',
    beneficiaryKind: 'TALENT',
    beneficiaryEmploymentProfileId: null,
    beneficiaryTalentId: 'talent-001',
    sourceContractRecordId: 'contract-record-001',
    settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
    ratePercent: 12.5,
    appliesToRevenueKinds: ['PLATFORM_LIVESTREAM'],
    status: 'DRAFT',
    effectiveStartDate: now,
    effectiveEndDate: null,
    description: 'Draft rule for April revenue share',
    externalRef: 'RULE-EXT-1',
    createdAt: now - 10_000,
    updatedAt: now - 9_000,
  },
  {
    id: 'commission-rule-active',
    ruleCode: 'CRULE-000002',
    title: 'Active content revenue share',
    settlementKind: 'REVENUE_SHARE',
    beneficiaryKind: 'TALENT',
    beneficiaryEmploymentProfileId: null,
    beneficiaryTalentId: 'talent-002',
    sourceContractRecordId: 'contract-record-001',
    settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
    ratePercent: 10,
    appliesToRevenueKinds: ['PLATFORM_CONTENT'],
    status: 'ACTIVE',
    effectiveStartDate: now - millisecondsPerDay,
    effectiveEndDate: null,
    description: null,
    externalRef: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
  },
  {
    id: 'commission-rule-archived',
    ruleCode: 'CRULE-999999',
    title: 'Archived rule',
    settlementKind: 'REVENUE_SHARE',
    beneficiaryKind: 'TALENT',
    beneficiaryEmploymentProfileId: null,
    beneficiaryTalentId: 'talent-001',
    sourceContractRecordId: 'contract-record-002',
    settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
    ratePercent: 8,
    appliesToRevenueKinds: ['EVENT_OPERATIONAL'],
    status: 'ARCHIVED',
    effectiveStartDate: now - 2 * millisecondsPerDay,
    effectiveEndDate: now - millisecondsPerDay,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
  },
];

const initialSettlements: CommissionSettlementRecord[] = [
  {
    id: 'commission-settlement-001',
    settlementCode: 'CS-202604-000001',
    title: 'April livestream settlement',
    sourceRuleId: 'commission-rule-001',
    sourceContractRecordIdSnapshot: 'contract-record-001',
    settlementKindSnapshot: 'REVENUE_SHARE',
    beneficiaryKindSnapshot: 'TALENT',
    beneficiaryEmploymentProfileIdSnapshot: null,
    beneficiaryTalentIdSnapshot: 'talent-001',
    subjectTalentId: 'talent-001',
    settlementBasisSnapshot: 'RECOGNIZED_GROSS_REVENUE',
    ratePercentSnapshot: 12.5,
    revenueEntryIds: ['revenue-entry-001'],
    settlementPeriodStartAt: now - millisecondsPerDay,
    settlementPeriodEndAt: now,
    settlementCurrencyCode: 'VND',
    grossRevenueAmount: 1250000,
    settlementAmount: 156250,
    status: 'DRAFT',
    finalizedAt: null,
    voidedAt: null,
    description: 'Draft settlement',
    externalRef: 'SET-EXT-1',
    createdAt: now - 10_000,
    updatedAt: now - 9_000,
  },
  {
    id: 'commission-settlement-finalized',
    settlementCode: 'CS-202604-000002',
    title: 'Finalized settlement',
    sourceRuleId: 'commission-rule-active',
    sourceContractRecordIdSnapshot: 'contract-record-001',
    settlementKindSnapshot: 'REVENUE_SHARE',
    beneficiaryKindSnapshot: 'TALENT',
    beneficiaryEmploymentProfileIdSnapshot: null,
    beneficiaryTalentIdSnapshot: 'talent-002',
    subjectTalentId: 'talent-002',
    settlementBasisSnapshot: 'RECOGNIZED_GROSS_REVENUE',
    ratePercentSnapshot: 10,
    revenueEntryIds: ['revenue-entry-finalized'],
    settlementPeriodStartAt: now - 2 * millisecondsPerDay,
    settlementPeriodEndAt: now - millisecondsPerDay,
    settlementCurrencyCode: 'USD',
    grossRevenueAmount: 200,
    settlementAmount: 20,
    status: 'FINALIZED',
    finalizedAt: now - 5_000,
    voidedAt: null,
    description: null,
    externalRef: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
  },
  {
    id: 'commission-settlement-archived',
    settlementCode: 'CS-202604-999999',
    title: 'Archived settlement',
    sourceRuleId: 'commission-rule-001',
    sourceContractRecordIdSnapshot: 'contract-record-001',
    settlementKindSnapshot: 'REVENUE_SHARE',
    beneficiaryKindSnapshot: 'TALENT',
    beneficiaryEmploymentProfileIdSnapshot: null,
    beneficiaryTalentIdSnapshot: 'talent-001',
    subjectTalentId: 'talent-001',
    settlementBasisSnapshot: 'RECOGNIZED_GROSS_REVENUE',
    ratePercentSnapshot: 12.5,
    revenueEntryIds: ['revenue-entry-archived'],
    settlementPeriodStartAt: now - 3 * millisecondsPerDay,
    settlementPeriodEndAt: now - 2 * millisecondsPerDay,
    settlementCurrencyCode: 'VND',
    grossRevenueAmount: 1000,
    settlementAmount: 125,
    status: 'ARCHIVED',
    finalizedAt: null,
    voidedAt: null,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
  },
];

const initialLines: Record<string, CommissionSettlementLineRecord[]> = {
  'commission-settlement-001': [
    {
      id: 'commission-line-001',
      revenueEntryId: 'revenue-entry-001',
      revenueEntryCodeSnapshot: 'REV-202604-000001',
      revenueKindSnapshot: 'PLATFORM_LIVESTREAM',
      revenueCurrencyCodeSnapshot: 'VND',
      revenueRecognizedAmountSnapshot: 1250000,
      revenueRecognizedAtSnapshot: now - 60_000,
      lineSettlementAmount: 156250,
    },
  ],
  'commission-settlement-finalized': [
    {
      id: 'commission-line-002',
      revenueEntryId: 'revenue-entry-finalized',
      revenueEntryCodeSnapshot: 'REV-202604-000002',
      revenueKindSnapshot: 'PLATFORM_CONTENT',
      revenueCurrencyCodeSnapshot: 'USD',
      revenueRecognizedAmountSnapshot: 200,
      revenueRecognizedAtSnapshot: now - 90_000,
      lineSettlementAmount: 20,
    },
  ],
  'commission-settlement-archived': [],
};

let ruleSeed = 100;
let settlementSeed = 100;
let rules: CommissionRuleRecord[] = [];
let settlements: CommissionSettlementRecord[] = [];
let settlementLines: Record<string, CommissionSettlementLineRecord[]> = {};

const cloneRules = (): CommissionRuleRecord[] => initialRules.map((record) => ({ ...record }));
const cloneSettlements = (): CommissionSettlementRecord[] =>
  initialSettlements.map((record) => ({ ...record, revenueEntryIds: [...record.revenueEntryIds] }));
const cloneLines = (): Record<string, CommissionSettlementLineRecord[]> =>
  Object.fromEntries(
    Object.entries(initialLines).map(([settlementId, lines]) => [
      settlementId,
      lines.map((line) => ({ ...line })),
    ]),
  );

export const resetWave9MockData = (): void => {
  ruleSeed = 100;
  settlementSeed = 100;
  rules = cloneRules();
  settlements = cloneSettlements();
  settlementLines = cloneLines();
};

resetWave9MockData();

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
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return {};
  }

  try {
    const body = (await request.json()) as unknown;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    return {};
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

const isUtcMidnightTimestamp = (value: unknown): value is number => {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value % millisecondsPerDay === 0
  );
};

const isIntegerTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

const isNullableText = (value: unknown): boolean => {
  return value === null || typeof value === 'string' || value === undefined;
};

const isRatePercent = (value: unknown): value is number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100) {
    return false;
  }

  return /^\d+(\.\d{1,4})?$/.test(String(value));
};

const isUniqueRevenueKindSet = (value: unknown): value is RevenueKind[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const seen = new Set<string>();
  return value.every((item) => {
    if (!revenueKinds.includes(item as RevenueKind) || seen.has(String(item))) {
      return false;
    }
    seen.add(String(item));
    return true;
  });
};

const isUniqueIdSet = (value: unknown): value is string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const seen = new Set<string>();
  return value.every((item) => {
    if (typeof item !== 'string' || item.trim().length === 0 || seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
};

const hasValidBeneficiary = (body: Record<string, unknown>): boolean => {
  if (body.beneficiaryKind === 'EMPLOYMENT_PROFILE') {
    return (
      typeof body.beneficiaryEmploymentProfileId === 'string' &&
      body.beneficiaryEmploymentProfileId.trim().length > 0 &&
      body.beneficiaryTalentId === undefined
    );
  }

  if (body.beneficiaryKind === 'TALENT') {
    return (
      typeof body.beneficiaryTalentId === 'string' &&
      body.beneficiaryTalentId.trim().length > 0 &&
      body.beneficiaryEmploymentProfileId === undefined
    );
  }

  return false;
};

const validRuleCreatePayload = (body: Record<string, unknown>): boolean => {
  if (body.settlementKind !== 'REVENUE_SHARE' || body.beneficiaryKind !== 'TALENT') {
    return false;
  }

  if (body.settlementBasis !== 'RECOGNIZED_GROSS_REVENUE' || !hasValidBeneficiary(body)) {
    return false;
  }

  const effectiveEndDate = body.effectiveEndDate;
  return (
    (body.ruleCode === undefined ||
      (typeof body.ruleCode === 'string' && body.ruleCode.trim().length > 0)) &&
    typeof body.title === 'string' &&
    typeof body.sourceContractRecordId === 'string' &&
    isRatePercent(body.ratePercent) &&
    isUniqueRevenueKindSet(body.appliesToRevenueKinds) &&
    isUtcMidnightTimestamp(body.effectiveStartDate) &&
    (effectiveEndDate === null || isUtcMidnightTimestamp(effectiveEndDate)) &&
    (effectiveEndDate === null ||
      (typeof effectiveEndDate === 'number' &&
        effectiveEndDate >= Number(body.effectiveStartDate))) &&
    isNullableText(body.description) &&
    isNullableText(body.externalRef)
  );
};

const validRuleDraftCorePayload = (body: Record<string, unknown>): boolean => {
  if (body.title !== undefined && typeof body.title !== 'string') return false;
  if (body.ratePercent !== undefined && !isRatePercent(body.ratePercent)) return false;
  if (
    body.appliesToRevenueKinds !== undefined &&
    !isUniqueRevenueKindSet(body.appliesToRevenueKinds)
  ) {
    return false;
  }
  if (body.effectiveStartDate !== undefined && !isUtcMidnightTimestamp(body.effectiveStartDate)) {
    return false;
  }
  if (
    body.effectiveEndDate !== undefined &&
    body.effectiveEndDate !== null &&
    !isUtcMidnightTimestamp(body.effectiveEndDate)
  ) {
    return false;
  }
  if (!isNullableText(body.description) || !isNullableText(body.externalRef)) return false;
  if (
    typeof body.effectiveStartDate === 'number' &&
    typeof body.effectiveEndDate === 'number' &&
    body.effectiveEndDate < body.effectiveStartDate
  ) {
    return false;
  }

  return true;
};

const validSettlementCreatePayload = (body: Record<string, unknown>): boolean => {
  return (
    (body.settlementCode === undefined ||
      (typeof body.settlementCode === 'string' && body.settlementCode.trim().length > 0)) &&
    typeof body.title === 'string' &&
    typeof body.sourceRuleId === 'string' &&
    isIntegerTimestamp(body.settlementPeriodStartAt) &&
    isIntegerTimestamp(body.settlementPeriodEndAt) &&
    Number(body.settlementPeriodEndAt) > Number(body.settlementPeriodStartAt) &&
    isUniqueIdSet(body.revenueEntryIds) &&
    isNullableText(body.description) &&
    isNullableText(body.externalRef)
  );
};

const validSettlementDraftCorePayload = (body: Record<string, unknown>): boolean => {
  if (body.title !== undefined && typeof body.title !== 'string') return false;
  if (
    body.settlementPeriodStartAt !== undefined &&
    !isIntegerTimestamp(body.settlementPeriodStartAt)
  ) {
    return false;
  }
  if (body.settlementPeriodEndAt !== undefined && !isIntegerTimestamp(body.settlementPeriodEndAt)) {
    return false;
  }
  if (!isNullableText(body.description) || !isNullableText(body.externalRef)) return false;
  if (
    typeof body.settlementPeriodStartAt === 'number' &&
    typeof body.settlementPeriodEndAt === 'number' &&
    body.settlementPeriodEndAt <= body.settlementPeriodStartAt
  ) {
    return false;
  }

  return true;
};

const readNumberParam = (searchParams: URLSearchParams, key: string): number | undefined => {
  const value = searchParams.get(key);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const matchesSearch = (code: string, title: string, search: string): boolean => {
  const normalized = search.trim().toLowerCase();
  return (
    code.trim().toLowerCase() === normalized || title.trim().toLowerCase().startsWith(normalized)
  );
};

const filterRules = (records: CommissionRuleRecord[], searchParams: URLSearchParams) => {
  let rows = [...records];
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const windowStartDate = readNumberParam(searchParams, 'windowStartDate');
  const windowEndDate = readNumberParam(searchParams, 'windowEndDate');

  rows = status
    ? rows.filter((item) => item.status === status)
    : rows.filter((item) => item.status !== 'ARCHIVED');
  if (search) rows = rows.filter((item) => matchesSearch(item.ruleCode, item.title, search));
  if (searchParams.get('settlementKind'))
    rows = rows.filter((item) => item.settlementKind === searchParams.get('settlementKind'));
  if (searchParams.get('beneficiaryKind'))
    rows = rows.filter((item) => item.beneficiaryKind === searchParams.get('beneficiaryKind'));
  if (searchParams.get('beneficiaryEmploymentProfileId')) {
    rows = rows.filter(
      (item) =>
        item.beneficiaryEmploymentProfileId === searchParams.get('beneficiaryEmploymentProfileId'),
    );
  }
  if (searchParams.get('beneficiaryTalentId')) {
    rows = rows.filter(
      (item) => item.beneficiaryTalentId === searchParams.get('beneficiaryTalentId'),
    );
  }
  if (searchParams.get('sourceContractRecordId')) {
    rows = rows.filter(
      (item) => item.sourceContractRecordId === searchParams.get('sourceContractRecordId'),
    );
  }
  if (searchParams.get('appliesToRevenueKind')) {
    rows = rows.filter((item) =>
      item.appliesToRevenueKinds.includes(searchParams.get('appliesToRevenueKind') as RevenueKind),
    );
  }
  if (windowStartDate !== undefined) {
    rows = rows.filter(
      (item) => (item.effectiveEndDate ?? Number.POSITIVE_INFINITY) >= windowStartDate,
    );
  }
  if (windowEndDate !== undefined) {
    rows = rows.filter((item) => item.effectiveStartDate <= windowEndDate);
  }

  return rows.sort(
    (left, right) =>
      left.effectiveStartDate - right.effectiveStartDate || left.id.localeCompare(right.id),
  );
};

const filterSettlements = (
  records: CommissionSettlementRecord[],
  searchParams: URLSearchParams,
) => {
  let rows = [...records];
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const windowStartAt = readNumberParam(searchParams, 'windowStartAt');
  const windowEndAt = readNumberParam(searchParams, 'windowEndAt');

  rows = status
    ? rows.filter((item) => item.status === status)
    : rows.filter((item) => item.status !== 'ARCHIVED');
  if (search) rows = rows.filter((item) => matchesSearch(item.settlementCode, item.title, search));
  if (searchParams.get('settlementKindSnapshot')) {
    rows = rows.filter(
      (item) => item.settlementKindSnapshot === searchParams.get('settlementKindSnapshot'),
    );
  }
  if (searchParams.get('beneficiaryKindSnapshot')) {
    rows = rows.filter(
      (item) => item.beneficiaryKindSnapshot === searchParams.get('beneficiaryKindSnapshot'),
    );
  }
  if (searchParams.get('beneficiaryEmploymentProfileIdSnapshot')) {
    rows = rows.filter(
      (item) =>
        item.beneficiaryEmploymentProfileIdSnapshot ===
        searchParams.get('beneficiaryEmploymentProfileIdSnapshot'),
    );
  }
  if (searchParams.get('beneficiaryTalentIdSnapshot')) {
    rows = rows.filter(
      (item) =>
        item.beneficiaryTalentIdSnapshot === searchParams.get('beneficiaryTalentIdSnapshot'),
    );
  }
  if (searchParams.get('subjectTalentId'))
    rows = rows.filter((item) => item.subjectTalentId === searchParams.get('subjectTalentId'));
  if (searchParams.get('sourceRuleId'))
    rows = rows.filter((item) => item.sourceRuleId === searchParams.get('sourceRuleId'));
  if (searchParams.get('containsRevenueEntryId')) {
    rows = rows.filter((item) =>
      item.revenueEntryIds.includes(String(searchParams.get('containsRevenueEntryId'))),
    );
  }
  if (searchParams.get('revenueEntryId')) {
    rows = rows.filter((item) =>
      item.revenueEntryIds.includes(String(searchParams.get('revenueEntryId'))),
    );
  }
  if (searchParams.get('settlementCurrencyCode')) {
    rows = rows.filter(
      (item) => item.settlementCurrencyCode === searchParams.get('settlementCurrencyCode'),
    );
  }
  if (windowStartAt !== undefined) {
    rows = rows.filter((item) => item.settlementPeriodEndAt > windowStartAt);
  }
  if (windowEndAt !== undefined) {
    rows = rows.filter((item) => item.settlementPeriodStartAt < windowEndAt);
  }

  return rows.sort(
    (left, right) =>
      left.settlementPeriodStartAt - right.settlementPeriodStartAt ||
      left.id.localeCompare(right.id),
  );
};

const toRuleListItem = (record: CommissionRuleRecord) => ({
  id: record.id,
  ruleCode: record.ruleCode,
  title: record.title,
  settlementKind: record.settlementKind,
  beneficiaryKind: record.beneficiaryKind,
  beneficiaryEmploymentProfileId: record.beneficiaryEmploymentProfileId,
  beneficiaryTalentId: record.beneficiaryTalentId,
  sourceContractRecordId: record.sourceContractRecordId,
  ratePercent: record.ratePercent,
  status: record.status,
  effectiveStartDate: record.effectiveStartDate,
  effectiveEndDate: record.effectiveEndDate,
  createdAt: record.createdAt,
});

const toSettlementListItem = (record: CommissionSettlementRecord) => ({
  id: record.id,
  settlementCode: record.settlementCode,
  title: record.title,
  sourceRuleId: record.sourceRuleId,
  settlementKindSnapshot: record.settlementKindSnapshot,
  beneficiaryKindSnapshot: record.beneficiaryKindSnapshot,
  beneficiaryEmploymentProfileIdSnapshot: record.beneficiaryEmploymentProfileIdSnapshot,
  beneficiaryTalentIdSnapshot: record.beneficiaryTalentIdSnapshot,
  subjectTalentId: record.subjectTalentId,
  settlementCurrencyCode: record.settlementCurrencyCode,
  grossRevenueAmount: record.grossRevenueAmount,
  settlementAmount: record.settlementAmount,
  status: record.status,
  settlementPeriodStartAt: record.settlementPeriodStartAt,
  settlementPeriodEndAt: record.settlementPeriodEndAt,
  finalizedAt: record.finalizedAt,
  createdAt: record.createdAt,
});

const readRule = (id: string): CommissionRuleRecord | undefined =>
  rules.find((item) => item.id === id);

const readSettlement = (id: string): CommissionSettlementRecord | undefined =>
  settlements.find((item) => item.id === id);

const rulesFlatKeys = [
  'status',
  'settlementKind',
  'beneficiaryKind',
  'beneficiaryEmploymentProfileId',
  'beneficiaryTalentId',
  'sourceContractRecordId',
  'appliesToRevenueKind',
  'windowStartDate',
  'windowEndDate',
  'limit',
  'cursor',
  'search',
  'sortBy',
  'sortDirection',
] as const;
const rulesByBeneficiaryKeys = [
  'beneficiaryKind',
  'beneficiaryEmploymentProfileId',
  'beneficiaryTalentId',
  'status',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
] as const;
const rulesByContractKeys = [
  'sourceContractRecordId',
  'status',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
] as const;
const settlementsFlatKeys = [
  'status',
  'settlementKindSnapshot',
  'beneficiaryKindSnapshot',
  'beneficiaryEmploymentProfileIdSnapshot',
  'beneficiaryTalentIdSnapshot',
  'subjectTalentId',
  'sourceRuleId',
  'containsRevenueEntryId',
  'settlementCurrencyCode',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'search',
  'sortBy',
  'sortDirection',
] as const;
const settlementsByBeneficiaryKeys = [
  'beneficiaryKindSnapshot',
  'beneficiaryEmploymentProfileIdSnapshot',
  'beneficiaryTalentIdSnapshot',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
] as const;
const settlementsBySubjectTalentKeys = [
  'subjectTalentId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
] as const;
const settlementsByRevenueEntryKeys = [
  'revenueEntryId',
  'status',
  'windowStartAt',
  'windowEndAt',
  'limit',
  'cursor',
  'sortBy',
  'sortDirection',
] as const;

export const wave9Handlers = [
  http.get('*/admin/commission/rules', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, rulesFlatKeys);
    if (unsupported) return unsupported;
    return HttpResponse.json(
      paginate(filterRules(rules, url.searchParams).map(toRuleListItem), url.searchParams),
    );
  }),
  http.get('*/admin/commission/rules/by-beneficiary', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, rulesByBeneficiaryKeys);
    if (unsupported) return unsupported;
    const kind = url.searchParams.get('beneficiaryKind');
    if (kind === 'EMPLOYMENT_PROFILE' && !url.searchParams.get('beneficiaryEmploymentProfileId')) {
      return HttpResponse.json({ message: 'Missing beneficiary identity' }, { status: 422 });
    }
    if (kind === 'TALENT' && !url.searchParams.get('beneficiaryTalentId')) {
      return HttpResponse.json({ message: 'Missing beneficiary identity' }, { status: 422 });
    }
    if (!kind) return HttpResponse.json({ message: 'Missing beneficiary kind' }, { status: 422 });
    return HttpResponse.json(
      paginate(filterRules(rules, url.searchParams).map(toRuleListItem), url.searchParams),
    );
  }),
  http.get('*/admin/commission/rules/by-contract', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, rulesByContractKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('sourceContractRecordId')) {
      return HttpResponse.json({ message: 'Missing sourceContractRecordId' }, { status: 422 });
    }
    return HttpResponse.json(
      paginate(filterRules(rules, url.searchParams).map(toRuleListItem), url.searchParams),
    );
  }),
  http.post('*/admin/commission/rules', async ({ request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'ruleCode',
      'title',
      'settlementKind',
      'beneficiaryKind',
      'beneficiaryEmploymentProfileId',
      'beneficiaryTalentId',
      'sourceContractRecordId',
      'settlementBasis',
      'ratePercent',
      'appliesToRevenueKinds',
      'effectiveStartDate',
      'effectiveEndDate',
      'description',
      'externalRef',
    ]);
    if (unsupported) return unsupported;
    if (!validRuleCreatePayload(body)) {
      return HttpResponse.json({ message: 'Invalid commission rule payload' }, { status: 422 });
    }

    ruleSeed += 1;
    const record: CommissionRuleRecord = {
      id: `commission-rule-${ruleSeed}`,
      ruleCode: providedOrGeneratedFixtureCode(
        body.ruleCode,
        generatedFixtureCode('CRULE', ruleSeed),
      ),
      title: String(body.title),
      settlementKind: 'REVENUE_SHARE',
      beneficiaryKind: 'TALENT',
      beneficiaryEmploymentProfileId: null,
      beneficiaryTalentId: String(body.beneficiaryTalentId),
      sourceContractRecordId: String(body.sourceContractRecordId),
      settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
      ratePercent: Number(body.ratePercent),
      appliesToRevenueKinds: [...(body.appliesToRevenueKinds as RevenueKind[])],
      status: 'DRAFT',
      effectiveStartDate: Number(body.effectiveStartDate),
      effectiveEndDate:
        typeof body.effectiveEndDate === 'number' ? Number(body.effectiveEndDate) : null,
      description: (body.description as string | null | undefined) ?? null,
      externalRef: (body.externalRef as string | null | undefined) ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    rules.unshift(record);
    return HttpResponse.json({ data: record });
  }),
  http.get('*/admin/commission/rules/:commissionRuleId', ({ params }) => {
    const record = readRule(String(params.commissionRuleId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({ data: record });
  }),
  http.patch(
    '*/admin/commission/rules/:commissionRuleId/draft-core',
    async ({ params, request }) => {
      const record = readRule(String(params.commissionRuleId));
      if (!record)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (record.status !== 'DRAFT' && record.status !== 'INACTIVE') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, [
        'title',
        'ratePercent',
        'appliesToRevenueKinds',
        'effectiveStartDate',
        'effectiveEndDate',
        'description',
        'externalRef',
      ]);
      if (unsupported) return unsupported;
      if (!validRuleDraftCorePayload(body)) {
        return HttpResponse.json({ message: 'Invalid commission rule payload' }, { status: 422 });
      }
      Object.assign(record, body, { updatedAt: Date.now() });
      return HttpResponse.json({ data: record });
    },
  ),
  http.post('*/admin/commission/rules/:commissionRuleId/:action', async ({ params, request }) => {
    const action = String(params.action) as 'activate' | 'deactivate' | 'archive';
    if (!['activate', 'deactivate', 'archive'].includes(action)) {
      return HttpResponse.json({ message: 'Unsupported action' }, { status: 404 });
    }
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, []);
    if (unsupported) return unsupported;
    const record = readRule(String(params.commissionRuleId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    if (action === 'activate' && !['DRAFT', 'INACTIVE'].includes(record.status)) {
      return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
    }
    if (action === 'deactivate' && record.status !== 'ACTIVE') {
      return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
    }
    if (action === 'archive' && !['DRAFT', 'INACTIVE'].includes(record.status)) {
      return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
    }
    record.status =
      action === 'activate' ? 'ACTIVE' : action === 'deactivate' ? 'INACTIVE' : 'ARCHIVED';
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: record });
  }),

  http.get('*/admin/commission/settlements', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, settlementsFlatKeys);
    if (unsupported) return unsupported;
    return HttpResponse.json(
      paginate(
        filterSettlements(settlements, url.searchParams).map(toSettlementListItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/commission/settlements/by-beneficiary', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, settlementsByBeneficiaryKeys);
    if (unsupported) return unsupported;
    const kind = url.searchParams.get('beneficiaryKindSnapshot');
    if (
      kind === 'EMPLOYMENT_PROFILE' &&
      !url.searchParams.get('beneficiaryEmploymentProfileIdSnapshot')
    ) {
      return HttpResponse.json({ message: 'Missing beneficiary identity' }, { status: 422 });
    }
    if (kind === 'TALENT' && !url.searchParams.get('beneficiaryTalentIdSnapshot')) {
      return HttpResponse.json({ message: 'Missing beneficiary identity' }, { status: 422 });
    }
    if (!kind) return HttpResponse.json({ message: 'Missing beneficiary kind' }, { status: 422 });
    return HttpResponse.json(
      paginate(
        filterSettlements(settlements, url.searchParams).map(toSettlementListItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/commission/settlements/by-subject-talent', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, settlementsBySubjectTalentKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('subjectTalentId')) {
      return HttpResponse.json({ message: 'Missing subjectTalentId' }, { status: 422 });
    }
    return HttpResponse.json(
      paginate(
        filterSettlements(settlements, url.searchParams).map(toSettlementListItem),
        url.searchParams,
      ),
    );
  }),
  http.get('*/admin/commission/settlements/by-revenue-entry', ({ request }) => {
    const url = new URL(request.url);
    const unsupported = rejectUnsupportedQuery(url.searchParams, settlementsByRevenueEntryKeys);
    if (unsupported) return unsupported;
    if (!url.searchParams.get('revenueEntryId')) {
      return HttpResponse.json({ message: 'Missing revenueEntryId' }, { status: 422 });
    }
    return HttpResponse.json(
      paginate(
        filterSettlements(settlements, url.searchParams).map(toSettlementListItem),
        url.searchParams,
      ),
    );
  }),
  http.post('*/admin/commission/settlements', async ({ request }) => {
    const body = await parseJsonBody(request);
    const unsupported = rejectUnsupportedBody(body, [
      'settlementCode',
      'title',
      'sourceRuleId',
      'settlementPeriodStartAt',
      'settlementPeriodEndAt',
      'revenueEntryIds',
      'description',
      'externalRef',
    ]);
    if (unsupported) return unsupported;
    if (!validSettlementCreatePayload(body)) {
      return HttpResponse.json(
        { message: 'Invalid commission settlement payload' },
        { status: 422 },
      );
    }

    settlementSeed += 1;
    const sourceRule = readRule(String(body.sourceRuleId));
    const grossRevenueAmount = 1000000;
    const ratePercent = sourceRule?.ratePercent ?? 10;
    const record: CommissionSettlementRecord = {
      id: `commission-settlement-${settlementSeed}`,
      settlementCode: providedOrGeneratedFixtureCode(
        body.settlementCode,
        generatedFixtureMonthCode('CS', body.settlementPeriodStartAt, settlementSeed),
      ),
      title: String(body.title),
      sourceRuleId: String(body.sourceRuleId),
      sourceContractRecordIdSnapshot: sourceRule?.sourceContractRecordId ?? 'contract-record-001',
      settlementKindSnapshot: 'REVENUE_SHARE',
      beneficiaryKindSnapshot: sourceRule?.beneficiaryKind ?? 'TALENT',
      beneficiaryEmploymentProfileIdSnapshot: sourceRule?.beneficiaryEmploymentProfileId ?? null,
      beneficiaryTalentIdSnapshot: sourceRule?.beneficiaryTalentId ?? 'talent-001',
      subjectTalentId: sourceRule?.beneficiaryTalentId ?? 'talent-001',
      settlementBasisSnapshot: 'RECOGNIZED_GROSS_REVENUE',
      ratePercentSnapshot: ratePercent,
      revenueEntryIds: [...(body.revenueEntryIds as string[])],
      settlementPeriodStartAt: Number(body.settlementPeriodStartAt),
      settlementPeriodEndAt: Number(body.settlementPeriodEndAt),
      settlementCurrencyCode: 'VND',
      grossRevenueAmount,
      settlementAmount: (grossRevenueAmount * ratePercent) / 100,
      status: 'DRAFT',
      finalizedAt: null,
      voidedAt: null,
      description: (body.description as string | null | undefined) ?? null,
      externalRef: (body.externalRef as string | null | undefined) ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    settlements.unshift(record);
    settlementLines[record.id] = record.revenueEntryIds.map((revenueEntryId, index) => ({
      id: `${record.id}-line-${index + 1}`,
      revenueEntryId,
      revenueEntryCodeSnapshot: revenueEntryId.toUpperCase().replace(/-/g, '_'),
      revenueKindSnapshot: 'PLATFORM_LIVESTREAM',
      revenueCurrencyCodeSnapshot: 'VND',
      revenueRecognizedAmountSnapshot: grossRevenueAmount / record.revenueEntryIds.length,
      revenueRecognizedAtSnapshot: Date.now(),
      lineSettlementAmount: record.settlementAmount / record.revenueEntryIds.length,
    }));
    return HttpResponse.json({ data: record });
  }),
  http.get('*/admin/commission/settlements/:commissionSettlementId/lines', ({ params }) => {
    const record = readSettlement(String(params.commissionSettlementId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({ data: settlementLines[record.id] ?? [] });
  }),
  http.patch('*/admin/commission/settlements/:commissionSettlementId/lines/:lineId', async () => {
    return HttpResponse.json({ message: 'Settlement lines are read-only' }, { status: 405 });
  }),
  http.get('*/admin/commission/settlements/:commissionSettlementId', ({ params }) => {
    const record = readSettlement(String(params.commissionSettlementId));
    if (!record) return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    return HttpResponse.json({ data: record });
  }),
  http.patch(
    '*/admin/commission/settlements/:commissionSettlementId/draft-core',
    async ({ params, request }) => {
      const record = readSettlement(String(params.commissionSettlementId));
      if (!record)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (record.status !== 'DRAFT') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, [
        'title',
        'settlementPeriodStartAt',
        'settlementPeriodEndAt',
        'description',
        'externalRef',
      ]);
      if (unsupported) return unsupported;
      if (!validSettlementDraftCorePayload(body)) {
        return HttpResponse.json(
          { message: 'Invalid commission settlement payload' },
          { status: 422 },
        );
      }
      Object.assign(record, body, { updatedAt: Date.now() });
      return HttpResponse.json({ data: record });
    },
  ),
  http.post(
    '*/admin/commission/settlements/:commissionSettlementId/revenue-entries',
    async ({ params, request }) => {
      const record = readSettlement(String(params.commissionSettlementId));
      if (!record)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (record.status !== 'DRAFT') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, ['revenueEntryIds']);
      if (unsupported) return unsupported;
      if (!isUniqueIdSet(body.revenueEntryIds)) {
        return HttpResponse.json({ message: 'Invalid revenue-entry replacement' }, { status: 422 });
      }
      record.revenueEntryIds = [...(body.revenueEntryIds as string[])];
      record.updatedAt = Date.now();
      settlementLines[record.id] = record.revenueEntryIds.map((revenueEntryId, index) => ({
        id: `${record.id}-line-${index + 1}`,
        revenueEntryId,
        revenueEntryCodeSnapshot: revenueEntryId.toUpperCase().replace(/-/g, '_'),
        revenueKindSnapshot: 'PLATFORM_LIVESTREAM',
        revenueCurrencyCodeSnapshot: record.settlementCurrencyCode,
        revenueRecognizedAmountSnapshot: record.grossRevenueAmount / record.revenueEntryIds.length,
        revenueRecognizedAtSnapshot: Date.now(),
        lineSettlementAmount: record.settlementAmount / record.revenueEntryIds.length,
      }));
      return HttpResponse.json({ data: record });
    },
  ),
  http.post(
    '*/admin/commission/settlements/:commissionSettlementId/:action',
    async ({ params, request }) => {
      const action = String(params.action) as 'finalize' | 'void' | 'archive';
      if (!['finalize', 'void', 'archive'].includes(action)) {
        return HttpResponse.json({ message: 'Unsupported action' }, { status: 404 });
      }
      const body = await parseJsonBody(request);
      const unsupported = rejectUnsupportedBody(body, []);
      if (unsupported) return unsupported;
      const record = readSettlement(String(params.commissionSettlementId));
      if (!record)
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      if (action === 'finalize' && record.status !== 'DRAFT') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      if (action === 'void' && record.status !== 'FINALIZED') {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      if (action === 'archive' && !['DRAFT', 'VOIDED'].includes(record.status)) {
        return HttpResponse.json({ message: 'Invalid lifecycle transition' }, { status: 409 });
      }
      if (action === 'finalize') {
        record.status = 'FINALIZED';
        record.finalizedAt = Date.now();
      } else if (action === 'void') {
        record.status = 'VOIDED';
        record.voidedAt = Date.now();
      } else {
        record.status = 'ARCHIVED';
      }
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),
];
