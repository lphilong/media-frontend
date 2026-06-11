import { http, HttpResponse } from 'msw';

import { resetWave5MockData, wave5Handlers } from '@test/msw/wave5-handlers';
import { resetWave6MockData, wave6Handlers } from '@test/msw/wave6-handlers';
import { resetWave7MockData, wave7Handlers } from '@test/msw/wave7-handlers';
import { resetWave8MockData, wave8Handlers } from '@test/msw/wave8-handlers';
import { resetWave9MockData, wave9Handlers } from '@test/msw/wave9-handlers';
import { kpiHandlers, resetKpiMockData } from '@test/msw/kpi-handlers';
import { resetWave4MockData, wave4Handlers } from '@test/msw/wave4-handlers';
import {
  generatedFixtureCode,
  providedOrGeneratedFixtureCode,
} from '@test/msw/generated-code-fixtures';
import {
  identityAccessHandlers,
  resetIdentityAccessMockData,
} from '@test/msw/identity-access-handlers';
import {
  managerWorkspaceHandlers,
  resetManagerWorkspaceMockData,
} from '@test/msw/manager-workspace-handlers';
import {
  peopleReadinessHandlers,
  resetPeopleReadinessMockData,
} from '@test/msw/people-readiness-handlers';
import { resetSelfServiceMockData, selfServiceHandlers } from '@test/msw/self-service-handlers';
import {
  employmentTermsHandlers,
  resetEmploymentTermsMockData,
} from '@test/msw/employment-terms-handlers';

type OrgUnitStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  displayName?: string;
  status?: string;
};

type OrgUnitRecord = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: OrgUnitStatus;
  parentOrgUnitId?: string | null;
  depth: number;
  displayOrder: number;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number;
  updatedAt: number;
};

type OrgUnitResponsibilityRole = 'DEPARTMENT_OWNER' | 'UNIT_MANAGER' | 'UNIT_OPERATOR';
type OrgUnitResponsibilityStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED';

type OrgUnitResponsibilityRecord = {
  id: string;
  orgUnitId: string;
  managerEmploymentProfileId: string;
  role: OrgUnitResponsibilityRole;
  status: OrgUnitResponsibilityStatus;
  includeDescendants: boolean;
  actionMask: string[];
  effectiveFrom: number;
  effectiveTo: number | null;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
};

const orgUnitResponsibilityRoles = ['DEPARTMENT_OWNER', 'UNIT_MANAGER', 'UNIT_OPERATOR'] as const;

const orgUnitResponsibilityUpdateFields = [
  'role',
  'includeDescendants',
  'effectiveFrom',
  'effectiveTo',
  'isPrimary',
] as const;

type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'ARCHIVED';
type ContractStatus = 'NONE' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

type EmploymentProfileRecord = {
  id: string;
  employeeCode: string;
  legalName: string;
  displayName: string;
  employmentKind: string;
  jobTitle: string;
  titleDescription?: string | null;
  externalRef?: string | null;
  orgUnitId: string;
  managerEmploymentProfileId?: string | null;
  recruiterEmploymentProfileId?: string | null;
  hrOwnerEmploymentProfileId?: string | null;
  onboardingOwnerEmploymentProfileId?: string | null;
  sourcedByEmploymentProfileId?: string | null;
  linkedUserId?: string | null;
  employmentStatus: EmploymentStatus;
  contractStatus: ContractStatus;
  employmentStartDate: number;
  employmentEndDate?: number | null;
  hiredAt?: number | null;
  onboardedAt?: number | null;
  createdAt: number;
  updatedAt: number;
};

const contractStatusTransitionMap: Record<ContractStatus, ContractStatus[]> = {
  NONE: ['PENDING_SIGNATURE', 'ACTIVE'],
  PENDING_SIGNATURE: ['NONE', 'ACTIVE'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
};

const canTransitionContractStatus = (
  profile: EmploymentProfileRecord,
  nextStatus: ContractStatus,
): boolean => {
  const allowedStatuses = contractStatusTransitionMap[profile.contractStatus] ?? [];
  if (!allowedStatuses.includes(nextStatus)) {
    return false;
  }

  if (nextStatus !== 'TERMINATED') {
    return true;
  }

  return profile.employmentStatus === 'TERMINATED' || profile.employmentStatus === 'ARCHIVED';
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const toTokenMatch = (value: string, search: string): boolean => {
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

const parseBooleanParam = (value: string | null): boolean | undefined => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
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

const initialOrgUnitSeed = 100;
const initialEmploymentSeed = 100;

let orgUnitSeed = initialOrgUnitSeed;
let employmentSeed = initialEmploymentSeed;

const now = Date.parse('2026-04-22T00:00:00.000Z');

const parseCanonicalDateToUtcMidnight = <TFallback extends number | null>(
  value: unknown,
  fallback: TFallback,
): number | TFallback => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return fallback;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const date = new Date(utcMidnight);

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? utcMidnight
    : fallback;
};

const parseRequiredResponsibilityDate = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const date = new Date(utcMidnight);

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? utcMidnight
    : null;
};

const responsibilityRangesOverlap = (
  leftFrom: number,
  leftTo: number | null,
  rightFrom: number,
  rightTo: number | null,
): boolean => {
  const normalizedLeftTo = leftTo ?? Number.MAX_SAFE_INTEGER;
  const normalizedRightTo = rightTo ?? Number.MAX_SAFE_INTEGER;
  return leftFrom <= normalizedRightTo && rightFrom <= normalizedLeftTo;
};

const initialOrgUnits: OrgUnitRecord[] = [
  {
    id: 'ou-root',
    code: 'OU-000001',
    name: 'Head Office',
    type: 'DEPARTMENT',
    status: 'ACTIVE',
    parentOrgUnitId: null,
    depth: 0,
    displayOrder: 1,
    description: 'Main organization root',
    externalRef: null,
    createdAt: now - 10_000,
    updatedAt: now - 9_000,
  },
  {
    id: 'ou-sales',
    code: 'OU-000002',
    name: 'Sales',
    type: 'TEAM',
    status: 'ACTIVE',
    parentOrgUnitId: 'ou-root',
    depth: 1,
    displayOrder: 2,
    description: null,
    externalRef: 'ORG-SALES',
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
  },
  {
    id: 'ou-ops',
    code: 'OU-000003',
    name: 'Operations',
    type: 'TEAM',
    status: 'INACTIVE',
    parentOrgUnitId: 'ou-root',
    depth: 1,
    displayOrder: 3,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
  },
  {
    id: 'ou-archive',
    code: 'OU-999999',
    name: 'Archive Team',
    type: 'TEAM',
    status: 'ARCHIVED',
    parentOrgUnitId: 'ou-root',
    depth: 1,
    displayOrder: 4,
    description: null,
    externalRef: null,
    createdAt: now - 4_000,
    updatedAt: now - 3_000,
  },
];

const initialEmploymentProfiles: EmploymentProfileRecord[] = [
  {
    id: 'ep-001',
    employeeCode: 'EP-000001',
    legalName: 'Alice Nguyen',
    displayName: 'Alice',
    employmentKind: 'FULL_TIME',
    jobTitle: 'Director',
    titleDescription: null,
    externalRef: null,
    orgUnitId: 'ou-sales',
    managerEmploymentProfileId: null,
    recruiterEmploymentProfileId: 'ep-002',
    hrOwnerEmploymentProfileId: 'ep-003',
    onboardingOwnerEmploymentProfileId: 'ep-002',
    sourcedByEmploymentProfileId: null,
    linkedUserId: 'user-alice',
    employmentStatus: 'ACTIVE',
    contractStatus: 'ACTIVE',
    employmentStartDate: Date.UTC(2024, 0, 1),
    employmentEndDate: null,
    hiredAt: Date.UTC(2024, 0, 1),
    onboardedAt: Date.UTC(2024, 0, 8),
    createdAt: now - 6_000,
    updatedAt: now - 5_500,
  },
  {
    id: 'ep-002',
    employeeCode: 'EP-000002',
    legalName: 'Bao Tran',
    displayName: 'Bao',
    employmentKind: 'FULL_TIME',
    jobTitle: 'Specialist',
    titleDescription: null,
    externalRef: null,
    orgUnitId: 'ou-sales',
    managerEmploymentProfileId: 'ep-001',
    linkedUserId: null,
    employmentStatus: 'ON_LEAVE',
    contractStatus: 'PENDING_SIGNATURE',
    employmentStartDate: Date.UTC(2024, 2, 1),
    employmentEndDate: null,
    createdAt: now - 5_000,
    updatedAt: now - 4_500,
  },
  {
    id: 'ep-003',
    employeeCode: 'EP-000003',
    legalName: 'Chau Le',
    displayName: 'Chau',
    employmentKind: 'CONTRACTOR',
    jobTitle: 'Producer',
    titleDescription: null,
    externalRef: null,
    orgUnitId: 'ou-ops',
    managerEmploymentProfileId: 'ep-001',
    linkedUserId: 'user-chau',
    employmentStatus: 'SUSPENDED',
    contractStatus: 'ACTIVE',
    employmentStartDate: Date.UTC(2023, 9, 1),
    employmentEndDate: null,
    createdAt: now - 4_000,
    updatedAt: now - 3_500,
  },
  {
    id: 'ep-004',
    employeeCode: 'EP-000004',
    legalName: 'Dung Pham',
    displayName: 'Dung',
    employmentKind: 'PART_TIME',
    jobTitle: 'Coordinator',
    titleDescription: null,
    externalRef: null,
    orgUnitId: 'ou-ops',
    managerEmploymentProfileId: 'ep-001',
    linkedUserId: null,
    employmentStatus: 'TERMINATED',
    contractStatus: 'TERMINATED',
    employmentStartDate: Date.UTC(2022, 10, 1),
    employmentEndDate: Date.UTC(2025, 11, 31),
    createdAt: now - 3_000,
    updatedAt: now - 2_500,
  },
  {
    id: 'ep-archive',
    employeeCode: 'EP-999999',
    legalName: 'Archived User',
    displayName: 'Archived',
    employmentKind: 'CONTRACTOR',
    jobTitle: 'Former Staff',
    titleDescription: null,
    externalRef: null,
    orgUnitId: 'ou-sales',
    managerEmploymentProfileId: null,
    linkedUserId: null,
    employmentStatus: 'ARCHIVED',
    contractStatus: 'TERMINATED',
    employmentStartDate: Date.UTC(2020, 0, 1),
    employmentEndDate: Date.UTC(2021, 11, 31),
    createdAt: now - 2_000,
    updatedAt: now - 1_500,
  },
];

const initialOrgUnitResponsibilities: OrgUnitResponsibilityRecord[] = [
  {
    id: 'ou-responsibility-owner',
    orgUnitId: 'ou-root',
    managerEmploymentProfileId: 'ep-001',
    role: 'DEPARTMENT_OWNER',
    status: 'ACTIVE',
    includeDescendants: true,
    actionMask: [],
    effectiveFrom: Date.UTC(2026, 0, 1),
    effectiveTo: null,
    isPrimary: true,
    createdAt: now - 2_000,
    updatedAt: now - 2_000,
  },
  {
    id: 'ou-responsibility-manager',
    orgUnitId: 'ou-root',
    managerEmploymentProfileId: 'ep-002',
    role: 'UNIT_MANAGER',
    status: 'ACTIVE',
    includeDescendants: false,
    actionMask: [],
    effectiveFrom: Date.UTC(2026, 0, 1),
    effectiveTo: null,
    isPrimary: false,
    createdAt: now - 1_900,
    updatedAt: now - 1_900,
  },
  {
    id: 'ou-responsibility-operator',
    orgUnitId: 'ou-root',
    managerEmploymentProfileId: 'ep-003',
    role: 'UNIT_OPERATOR',
    status: 'INACTIVE',
    includeDescendants: false,
    actionMask: [],
    effectiveFrom: Date.UTC(2026, 0, 1),
    effectiveTo: Date.UTC(2026, 1, 1),
    isPrimary: false,
    createdAt: now - 1_800,
    updatedAt: now - 1_700,
  },
];

const cloneOrgUnits = (): OrgUnitRecord[] => initialOrgUnits.map((record) => ({ ...record }));

const cloneEmploymentProfiles = (): EmploymentProfileRecord[] =>
  initialEmploymentProfiles.map((record) => ({ ...record }));

const cloneOrgUnitResponsibilities = (): OrgUnitResponsibilityRecord[] =>
  initialOrgUnitResponsibilities.map((record) => ({
    ...record,
    actionMask: [...record.actionMask],
  }));

let orgUnits: OrgUnitRecord[] = cloneOrgUnits();
let employmentProfiles: EmploymentProfileRecord[] = cloneEmploymentProfiles();
let orgUnitResponsibilities: OrgUnitResponsibilityRecord[] = cloneOrgUnitResponsibilities();

const userRefs = new Map<string, ReferenceSummary>([
  [
    'user-alice',
    { id: 'user-alice', displayName: 'Alice User', name: 'alice@example.test', status: 'ACTIVE' },
  ],
  [
    'user-chau',
    { id: 'user-chau', displayName: 'Chau User', name: 'chau@example.test', status: 'ACTIVE' },
  ],
]);

export const resetMockData = (): void => {
  orgUnitSeed = initialOrgUnitSeed;
  employmentSeed = initialEmploymentSeed;
  orgUnits = cloneOrgUnits();
  employmentProfiles = cloneEmploymentProfiles();
  orgUnitResponsibilities = cloneOrgUnitResponsibilities();
  resetWave4MockData();
  resetWave5MockData();
  resetWave6MockData();
  resetWave7MockData();
  resetWave8MockData();
  resetWave9MockData();
  resetKpiMockData();
  resetIdentityAccessMockData();
  resetSelfServiceMockData();
  resetManagerWorkspaceMockData();
  resetPeopleReadinessMockData();
  resetEmploymentTermsMockData();
};

const readOrgUnit = (orgUnitId: string): OrgUnitRecord | undefined =>
  orgUnits.find((item) => item.id === orgUnitId);

const readEmploymentProfile = (employmentProfileId: string): EmploymentProfileRecord | undefined =>
  employmentProfiles.find((item) => item.id === employmentProfileId);

const toOrgUnitRef = (orgUnitId?: string | null): ReferenceSummary | null => {
  const record = orgUnitId ? readOrgUnit(orgUnitId) : undefined;
  return record
    ? { id: record.id, code: record.code, name: record.name, status: record.status }
    : null;
};

const toEmploymentProfileRef = (employmentProfileId?: string | null): ReferenceSummary | null => {
  const record = employmentProfileId ? readEmploymentProfile(employmentProfileId) : undefined;
  return record
    ? {
        id: record.id,
        code: record.employeeCode,
        displayName: record.displayName,
        name: record.legalName,
        title: record.jobTitle,
        status: record.employmentStatus,
      }
    : null;
};

const toUserRef = (userId?: string | null): ReferenceSummary | null =>
  userId ? (userRefs.get(userId) ?? null) : null;

const toOrgUnitListItem = (record: OrgUnitRecord) => {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    type: record.type,
    status: record.status,
    parentOrgUnitId: record.parentOrgUnitId ?? null,
    parentOrgUnitRef: toOrgUnitRef(record.parentOrgUnitId),
    depth: record.depth,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt,
  };
};

const toOrgUnitChildItem = (record: OrgUnitRecord) => {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    type: record.type,
    status: record.status,
    parentOrgUnitId: record.parentOrgUnitId ?? null,
    parentOrgUnitRef: toOrgUnitRef(record.parentOrgUnitId),
    depth: record.depth,
    displayOrder: record.displayOrder,
  };
};

const toOrgUnitDetail = (record: OrgUnitRecord) => {
  const ancestorChain: string[] = [];
  let currentParentId = record.parentOrgUnitId;
  while (currentParentId) {
    ancestorChain.unshift(currentParentId);
    currentParentId = readOrgUnit(currentParentId)?.parentOrgUnitId;
  }

  return {
    id: record.id,
    code: record.code,
    name: record.name,
    type: record.type,
    status: record.status,
    parentOrgUnitId: record.parentOrgUnitId ?? null,
    parentOrgUnitRef: toOrgUnitRef(record.parentOrgUnitId),
    depth: record.depth,
    description: record.description ?? null,
    externalRef: record.externalRef ?? null,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hierarchy: {
      id: record.id,
      parentOrgUnitId: record.parentOrgUnitId ?? null,
      depth: record.depth,
      ancestorChain,
    },
  };
};

const toOrgUnitResponsibilityDetail = (record: OrgUnitResponsibilityRecord) => {
  return {
    id: record.id,
    orgUnitId: record.orgUnitId,
    managerEmploymentProfileId: record.managerEmploymentProfileId,
    role: record.role,
    status: record.status,
    includeDescendants: record.includeDescendants,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo,
    isPrimary: record.isPrimary,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    orgUnitRef: toOrgUnitRef(record.orgUnitId),
    managerRef: toEmploymentProfileRef(record.managerEmploymentProfileId),
  };
};

const toEmploymentListItem = (record: EmploymentProfileRecord) => {
  return {
    id: record.id,
    employeeCode: record.employeeCode,
    legalName: record.legalName,
    displayName: record.displayName,
    employmentKind: record.employmentKind,
    jobTitle: record.jobTitle,
    orgUnitId: record.orgUnitId,
    orgUnitRef: toOrgUnitRef(record.orgUnitId),
    managerEmploymentProfileId: record.managerEmploymentProfileId ?? null,
    managerEmploymentProfileRef: toEmploymentProfileRef(record.managerEmploymentProfileId),
    recruiterEmploymentProfileId: record.recruiterEmploymentProfileId ?? null,
    recruiterEmploymentProfileRef: toEmploymentProfileRef(record.recruiterEmploymentProfileId),
    hrOwnerEmploymentProfileId: record.hrOwnerEmploymentProfileId ?? null,
    hrOwnerEmploymentProfileRef: toEmploymentProfileRef(record.hrOwnerEmploymentProfileId),
    onboardingOwnerEmploymentProfileId: record.onboardingOwnerEmploymentProfileId ?? null,
    onboardingOwnerEmploymentProfileRef: toEmploymentProfileRef(
      record.onboardingOwnerEmploymentProfileId,
    ),
    sourcedByEmploymentProfileId: record.sourcedByEmploymentProfileId ?? null,
    sourcedByEmploymentProfileRef: toEmploymentProfileRef(record.sourcedByEmploymentProfileId),
    linkedUserId: record.linkedUserId ?? null,
    linkedUserRef: toUserRef(record.linkedUserId),
    employmentStatus: record.employmentStatus,
    contractStatus: record.contractStatus,
    hiredAt: record.hiredAt ?? null,
    onboardedAt: record.onboardedAt ?? null,
    createdAt: record.createdAt,
  };
};

const toEmploymentDetail = (record: EmploymentProfileRecord) => {
  return {
    id: record.id,
    employeeCode: record.employeeCode,
    legalName: record.legalName,
    displayName: record.displayName,
    employmentKind: record.employmentKind,
    jobTitle: record.jobTitle,
    titleDescription: record.titleDescription ?? null,
    externalRef: record.externalRef ?? null,
    orgUnitId: record.orgUnitId,
    orgUnitRef: toOrgUnitRef(record.orgUnitId),
    managerEmploymentProfileId: record.managerEmploymentProfileId ?? null,
    managerEmploymentProfileRef: toEmploymentProfileRef(record.managerEmploymentProfileId),
    recruiterEmploymentProfileId: record.recruiterEmploymentProfileId ?? null,
    recruiterEmploymentProfileRef: toEmploymentProfileRef(record.recruiterEmploymentProfileId),
    hrOwnerEmploymentProfileId: record.hrOwnerEmploymentProfileId ?? null,
    hrOwnerEmploymentProfileRef: toEmploymentProfileRef(record.hrOwnerEmploymentProfileId),
    onboardingOwnerEmploymentProfileId: record.onboardingOwnerEmploymentProfileId ?? null,
    onboardingOwnerEmploymentProfileRef: toEmploymentProfileRef(
      record.onboardingOwnerEmploymentProfileId,
    ),
    sourcedByEmploymentProfileId: record.sourcedByEmploymentProfileId ?? null,
    sourcedByEmploymentProfileRef: toEmploymentProfileRef(record.sourcedByEmploymentProfileId),
    linkedUserId: record.linkedUserId ?? null,
    linkedUserRef: toUserRef(record.linkedUserId),
    employmentStatus: record.employmentStatus,
    contractStatus: record.contractStatus,
    employmentStartDate: record.employmentStartDate,
    employmentEndDate: record.employmentEndDate ?? null,
    hiredAt: record.hiredAt ?? null,
    onboardedAt: record.onboardedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const toDirectReportItem = (record: EmploymentProfileRecord) => {
  return {
    id: record.id,
    employeeCode: record.employeeCode,
    displayName: record.displayName,
    employmentStatus: record.employmentStatus,
    contractStatus: record.contractStatus,
    orgUnitId: record.orgUnitId,
    orgUnitRef: toOrgUnitRef(record.orgUnitId),
    managerEmploymentProfileId: record.managerEmploymentProfileId ?? null,
    managerEmploymentProfileRef: toEmploymentProfileRef(record.managerEmploymentProfileId),
  };
};

type ReferenceLookupItem = {
  id: string;
  label: string;
  secondaryLabel?: string;
  code?: string;
  status?: string;
  state?: string;
  type?: string;
};

const staticReferenceLookups: Record<string, ReferenceLookupItem[]> = {
  'talent-groups': [
    {
      id: 'group-001',
      label: 'Creators A',
      secondaryLabel: 'CRE-A',
      code: 'TG-000001',
      status: 'ACTIVE',
    },
  ],
  'platform-accounts': [
    {
      id: 'platform-001',
      label: 'Mina Live',
      secondaryLabel: 'YOUTUBE',
      code: 'PA-000001',
      status: 'ACTIVE',
      type: 'CHANNEL',
    },
  ],
  'studio-resources': [
    {
      id: 'studio-001',
      label: 'Main Studio',
      secondaryLabel: 'Hanoi',
      code: 'SR-000001',
      status: 'ACTIVE',
      type: 'ROOM',
    },
    {
      id: 'studio-002',
      label: 'Podcast Booth',
      secondaryLabel: 'Hanoi',
      code: 'SR-000002',
      status: 'ACTIVE',
      type: 'ROOM',
    },
  ],
  events: [
    {
      id: 'event-001',
      label: 'Launch Livestream',
      code: 'EV-000001',
      status: 'SCHEDULED',
    },
  ],
  'contract-records': [
    {
      id: 'contract-record-001',
      label: 'Mina Talent Service',
      secondaryLabel: 'TALENT',
      code: 'CR-000001',
      status: 'ACTIVE',
      type: 'TALENT_SERVICE',
    },
  ],
  'revenue-entries': [
    {
      id: 'revenue-entry-001',
      label: 'May YouTube Revenue',
      secondaryLabel: 'VND',
      code: 'REV-000001',
      status: 'DRAFT',
      type: 'PLATFORM_LIVESTREAM',
    },
  ],
  'commission-rules': [
    {
      id: 'commission-rule-001',
      label: 'Mina revenue share',
      secondaryLabel: 'TALENT',
      code: 'COMR-000001',
      status: 'ACTIVE',
      type: 'REVENUE_SHARE',
    },
  ],
};

const toReferenceLookupItems = (resource: string): ReferenceLookupItem[] => {
  if (resource === 'org-units') {
    return orgUnits
      .filter((item) => item.status !== 'ARCHIVED')
      .map((item) => ({
        id: item.id,
        label: item.name,
        code: item.code,
        status: item.status,
        type: item.type,
      }));
  }

  if (resource === 'employment-profiles') {
    return employmentProfiles
      .filter((item) => item.employmentStatus !== 'ARCHIVED')
      .map((item) => ({
        id: item.id,
        label: item.displayName || item.legalName,
        secondaryLabel: item.jobTitle,
        code: item.employeeCode,
        status: item.employmentStatus,
        state: item.contractStatus,
      }));
  }

  if (resource === 'talents') {
    return [
      {
        id: 'talent-001',
        label: 'Mina',
        secondaryLabel: 'Mina Nguyen',
        code: 'TAL-000001',
        status: 'ACTIVE',
      },
    ];
  }

  return staticReferenceLookups[resource] ?? [];
};

const filterLookupItems = (
  items: ReferenceLookupItem[],
  searchParams: URLSearchParams,
): ReferenceLookupItem[] => {
  const search = searchParams.get('search');
  const ids = searchParams
    .get('ids')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const limit = Math.min(parsePositiveInt(searchParams.get('limit')) ?? 20, 50);
  const normalizedSearch = search ? normalizeText(search) : '';
  const idFiltered = ids && ids.length > 0 ? items.filter((item) => ids.includes(item.id)) : items;
  const filtered = normalizedSearch
    ? idFiltered.filter((item) =>
        [item.label, item.secondaryLabel, item.code, item.status, item.state, item.type].some(
          (value) => value && normalizeText(value).includes(normalizedSearch),
        ),
      )
    : idFiltered;

  return filtered.slice(0, limit);
};

const sortOrgUnits = (
  records: OrgUnitRecord[],
  sortBy: string | null,
  sortDirection: string | null,
): OrgUnitRecord[] => {
  const sorted = [...records];
  const directionMultiplier = sortDirection === 'desc' ? -1 : 1;

  const readValue = (record: OrgUnitRecord): string | number => {
    switch (sortBy) {
      case 'code':
        return record.code;
      case 'name':
        return record.name;
      case 'createdAt':
        return record.createdAt;
      case 'displayOrder':
        return record.displayOrder;
      default:
        return `${record.displayOrder}-${record.name}-${record.id}`;
    }
  };

  sorted.sort((left, right) => {
    const leftValue = readValue(left);
    const rightValue = readValue(right);
    if (leftValue < rightValue) {
      return -1 * directionMultiplier;
    }
    if (leftValue > rightValue) {
      return 1 * directionMultiplier;
    }
    return left.id.localeCompare(right.id);
  });

  return sorted;
};

const sortEmploymentProfiles = (
  records: EmploymentProfileRecord[],
  sortBy: string | null,
  sortDirection: string | null,
): EmploymentProfileRecord[] => {
  const sorted = [...records];
  const directionMultiplier = sortDirection === 'desc' ? -1 : 1;

  const readValue = (record: EmploymentProfileRecord): string | number => {
    switch (sortBy) {
      case 'employeeCode':
        return record.employeeCode;
      case 'displayName':
        return record.displayName;
      case 'legalName':
        return record.legalName;
      case 'createdAt':
        return record.createdAt;
      default:
        return record.employeeCode;
    }
  };

  sorted.sort((left, right) => {
    const leftValue = readValue(left);
    const rightValue = readValue(right);
    if (leftValue < rightValue) {
      return -1 * directionMultiplier;
    }
    if (leftValue > rightValue) {
      return 1 * directionMultiplier;
    }
    return left.id.localeCompare(right.id);
  });

  return sorted;
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  const body = (await request.json()) as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
};

export const handlers = [
  http.get('*/health', () => {
    return HttpResponse.json({ ok: true });
  }),
  http.get('*/admin/reference/:resource', ({ params, request }) => {
    const resource = String(params.resource);
    const url = new URL(request.url);

    return HttpResponse.json({
      data: {
        items: filterLookupItems(toReferenceLookupItems(resource), url.searchParams),
      },
    });
  }),
  http.get('*/admin/dashboard-lite/snapshot', () => {
    return HttpResponse.json({
      data: {
        generatedAt: '2026-04-22T00:00:00.000Z',
        businessDate: '2026-04-22',
        windows: {
          businessTimeZone: 'UTC',
          today: {
            startAtInclusive: Date.UTC(2026, 3, 22, 0, 0, 0, 0),
            endAtExclusive: Date.UTC(2026, 3, 23, 0, 0, 0, 0),
          },
          next7Days: {
            startAtInclusive: Date.UTC(2026, 3, 22, 0, 0, 0, 0),
            endAtExclusive: Date.UTC(2026, 3, 29, 0, 0, 0, 0),
          },
          trailing30Days: {
            startAtInclusive: Date.UTC(2026, 2, 23, 0, 0, 0, 0),
            endAtExclusive: Date.UTC(2026, 3, 22, 0, 0, 0, 0),
          },
          staleDrafts: {
            olderThanAtExclusive: Date.UTC(2026, 3, 15, 0, 0, 0, 0),
          },
          contractExpiry30Days: {
            startDateInclusive: '2026-04-22',
            endDateInclusive: '2026-05-22',
          },
        },
        overview: {
          todayEventCount: 12,
          draftTalentKpiCount: 4,
          draftRevenueEntryCount: 5,
          draftSettlementCount: 2,
          activeCommissionRuleCount: 7,
          expiringContractCount30d: 3,
        },
        operations: {
          todayEventCount: 12,
          next7DayEventCount: 39,
          draftTalentKpiCount: 4,
          finalizedTalentKpiCount30d: 24,
        },
        commercial: {
          draftRevenueEntryCount: 5,
          finalizedRevenueAmount30d: 2024.5,
          reconciledRevenueAmount30d: 1999.25,
          draftSettlementCount: 2,
          finalizedSettlementAmount30d: 905.4,
          activeCommissionRuleCount: 7,
        },
        attention: {
          staleTalentKpiDraftCount: 1,
          staleRevenueDraftCount: 2,
          staleSettlementDraftCount: 1,
          expiringContractCount30d: 3,
        },
      },
    });
  }),
  http.get('*/admin/org-units', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const parentOrgUnitId = searchParams.get('parentOrgUnitId');
    const rootOnly = parseBooleanParam(searchParams.get('rootOnly'));
    const search = searchParams.get('search');

    let rows = [...orgUnits];

    if (!status) {
      rows = rows.filter((item) => item.status !== 'ARCHIVED');
    } else {
      rows = rows.filter((item) => item.status === status);
    }

    if (type) {
      rows = rows.filter((item) => item.type === type);
    }

    if (parentOrgUnitId) {
      rows = rows.filter((item) => item.parentOrgUnitId === parentOrgUnitId);
    }

    if (rootOnly === true) {
      rows = rows.filter((item) => !item.parentOrgUnitId);
    }

    if (search) {
      rows = rows.filter(
        (item) => toTokenMatch(item.code, search) || toTokenMatch(item.name, search),
      );
    }

    rows = sortOrgUnits(rows, searchParams.get('sortBy'), searchParams.get('sortDirection'));
    const paged = paginate(rows.map(toOrgUnitListItem), searchParams);

    return HttpResponse.json(paged);
  }),
  http.post('*/admin/org-units', async ({ request }) => {
    const body = await parseJsonBody(request);
    orgUnitSeed += 1;
    const id = `ou-${orgUnitSeed}`;
    const parentOrgUnitId =
      typeof body.parentOrgUnitId === 'string' && body.parentOrgUnitId.trim().length > 0
        ? body.parentOrgUnitId
        : null;
    const parent = parentOrgUnitId ? readOrgUnit(parentOrgUnitId) : undefined;

    const nextRecord: OrgUnitRecord = {
      id,
      code: providedOrGeneratedFixtureCode(body.code, generatedFixtureCode('OU', orgUnitSeed)),
      name: String(body.name ?? `Org Unit ${orgUnitSeed}`),
      type: String(body.type ?? 'TEAM'),
      status: 'ACTIVE',
      parentOrgUnitId,
      depth: parent ? parent.depth + 1 : 0,
      displayOrder: Number(body.displayOrder ?? 0),
      description: (body.description as string | null | undefined) ?? null,
      externalRef: (body.externalRef as string | null | undefined) ?? null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    orgUnits.push(nextRecord);

    return HttpResponse.json({
      data: toOrgUnitDetail(nextRecord),
    });
  }),
  http.get('*/admin/org-units/:orgUnitId/children', ({ params, request }) => {
    const orgUnitId = String(params.orgUnitId);
    const url = new URL(request.url);
    const rows = orgUnits
      .filter((item) => item.parentOrgUnitId === orgUnitId)
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder || left.name.localeCompare(right.name),
      );
    const paged = paginate(rows.map(toOrgUnitChildItem), url.searchParams);

    return HttpResponse.json(paged);
  }),
  http.get('*/admin/org-units/:orgUnitId/responsibilities', ({ params }) => {
    const orgUnitId = String(params.orgUnitId);
    const orgUnit = readOrgUnit(orgUnitId);
    if (!orgUnit) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({
      data: orgUnitResponsibilities
        .filter((item) => item.orgUnitId === orgUnitId)
        .map(toOrgUnitResponsibilityDetail),
    });
  }),
  http.post('*/admin/org-units/:orgUnitId/responsibilities', async ({ params, request }) => {
    const orgUnitId = String(params.orgUnitId);
    const orgUnit = readOrgUnit(orgUnitId);
    if (!orgUnit) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (orgUnit.status !== 'ACTIVE') {
      return HttpResponse.json({ message: 'org-unit:validation.inactiveOrgUnit' }, { status: 409 });
    }

    const body = await parseJsonBody(request);
    const managerEmploymentProfileId =
      typeof body.managerEmploymentProfileId === 'string'
        ? body.managerEmploymentProfileId.trim()
        : '';
    const manager = readEmploymentProfile(managerEmploymentProfileId);
    if (!manager || !['ACTIVE', 'ON_LEAVE'].includes(manager.employmentStatus)) {
      return HttpResponse.json(
        { message: 'org-unit:validation.managerEmploymentProfileInvalid' },
        { status: 422 },
      );
    }

    const role = String(body.role ?? '') as OrgUnitResponsibilityRole;
    if (!orgUnitResponsibilityRoles.includes(role)) {
      return HttpResponse.json({ message: 'org-unit:validation.invalidRole' }, { status: 422 });
    }

    const effectiveFrom = parseCanonicalDateToUtcMidnight(body.effectiveFrom, Date.now());
    const effectiveTo = parseCanonicalDateToUtcMidnight(body.effectiveTo, null);
    if (effectiveTo !== null && effectiveTo < effectiveFrom) {
      return HttpResponse.json(
        { message: 'org-unit:validation.invalidEffectiveRange' },
        { status: 422 },
      );
    }

    const duplicate = orgUnitResponsibilities.some(
      (item) =>
        item.orgUnitId === orgUnitId &&
        item.managerEmploymentProfileId === managerEmploymentProfileId &&
        item.role === role &&
        item.status === 'ACTIVE',
    );
    if (duplicate) {
      return HttpResponse.json(
        { message: 'org-unit:validation.duplicateResponsibility' },
        { status: 409 },
      );
    }

    const nextRecord: OrgUnitResponsibilityRecord = {
      id: `ou-responsibility-${orgUnitResponsibilities.length + 1}`,
      orgUnitId,
      managerEmploymentProfileId,
      role,
      status: 'ACTIVE',
      includeDescendants: Boolean(body.includeDescendants),
      actionMask: [],
      effectiveFrom,
      effectiveTo,
      isPrimary: Boolean(body.isPrimary),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    orgUnitResponsibilities.push(nextRecord);

    return HttpResponse.json({ data: toOrgUnitResponsibilityDetail(nextRecord) });
  }),
  http.patch(
    '*/admin/org-units/:orgUnitId/responsibilities/:assignmentId',
    async ({ params, request }) => {
      const orgUnitId = String(params.orgUnitId);
      const assignment = orgUnitResponsibilities.find(
        (item) => item.id === String(params.assignmentId) && item.orgUnitId === orgUnitId,
      );
      if (!assignment) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (assignment.status !== 'ACTIVE') {
        return HttpResponse.json(
          { message: 'org-unit:validation.inactiveResponsibility' },
          { status: 409 },
        );
      }

      const body = await parseJsonBody(request);
      const unexpectedFields = Object.keys(body).filter(
        (field) =>
          !orgUnitResponsibilityUpdateFields.includes(
            field as (typeof orgUnitResponsibilityUpdateFields)[number],
          ),
      );
      if (unexpectedFields.length > 0) {
        return HttpResponse.json(
          { message: 'org-unit:validation.unsupportedResponsibilityField' },
          { status: 422 },
        );
      }

      const role = body.role ? (String(body.role) as OrgUnitResponsibilityRole) : assignment.role;
      if (!orgUnitResponsibilityRoles.includes(role)) {
        return HttpResponse.json({ message: 'org-unit:validation.invalidRole' }, { status: 422 });
      }

      const effectiveFrom =
        body.effectiveFrom === undefined
          ? assignment.effectiveFrom
          : parseRequiredResponsibilityDate(body.effectiveFrom);
      const effectiveTo =
        body.effectiveTo === undefined
          ? assignment.effectiveTo
          : body.effectiveTo === null
            ? null
            : parseRequiredResponsibilityDate(body.effectiveTo);
      if (
        effectiveFrom === null ||
        (body.effectiveTo !== undefined && body.effectiveTo !== null && effectiveTo === null)
      ) {
        return HttpResponse.json(
          { message: 'org-unit:validation.invalidEffectiveRange' },
          { status: 422 },
        );
      }
      if (effectiveTo !== null && effectiveTo < effectiveFrom) {
        return HttpResponse.json(
          { message: 'org-unit:validation.invalidEffectiveRange' },
          { status: 422 },
        );
      }

      const duplicate = orgUnitResponsibilities.some(
        (item) =>
          item.id !== assignment.id &&
          item.orgUnitId === orgUnitId &&
          item.managerEmploymentProfileId === assignment.managerEmploymentProfileId &&
          item.role === role &&
          item.status === 'ACTIVE' &&
          responsibilityRangesOverlap(
            item.effectiveFrom,
            item.effectiveTo,
            effectiveFrom,
            effectiveTo,
          ),
      );
      if (duplicate) {
        return HttpResponse.json(
          { message: 'org-unit:validation.duplicateResponsibility' },
          { status: 409 },
        );
      }

      assignment.role = role;
      assignment.effectiveFrom = effectiveFrom;
      assignment.effectiveTo = effectiveTo;
      if (typeof body.includeDescendants === 'boolean') {
        assignment.includeDescendants = body.includeDescendants;
      }
      if (typeof body.isPrimary === 'boolean') {
        assignment.isPrimary = body.isPrimary;
      }
      assignment.updatedAt = Date.now();

      return HttpResponse.json({ data: toOrgUnitResponsibilityDetail(assignment) });
    },
  ),
  http.delete('*/admin/org-units/:orgUnitId/responsibilities/:assignmentId', ({ params }) => {
    const orgUnitId = String(params.orgUnitId);
    const assignment = orgUnitResponsibilities.find(
      (item) => item.id === String(params.assignmentId) && item.orgUnitId === orgUnitId,
    );
    if (!assignment) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    assignment.status = 'INACTIVE';
    assignment.effectiveTo = Date.now();
    assignment.updatedAt = Date.now();

    return HttpResponse.json({ data: toOrgUnitResponsibilityDetail(assignment) });
  }),
  http.get('*/admin/org-units/:orgUnitId', ({ params }) => {
    const orgUnit = readOrgUnit(String(params.orgUnitId));
    if (!orgUnit) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({
      data: toOrgUnitDetail(orgUnit),
    });
  }),
  http.patch('*/admin/org-units/:orgUnitId', async ({ params, request }) => {
    const orgUnit = readOrgUnit(String(params.orgUnitId));
    if (!orgUnit) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    orgUnit.name = body.name ? String(body.name) : orgUnit.name;
    orgUnit.displayOrder =
      typeof body.displayOrder === 'number' || typeof body.displayOrder === 'string'
        ? Number(body.displayOrder)
        : orgUnit.displayOrder;
    orgUnit.description = (body.description as string | null | undefined) ?? orgUnit.description;
    orgUnit.externalRef = (body.externalRef as string | null | undefined) ?? orgUnit.externalRef;
    orgUnit.updatedAt = Date.now();

    return HttpResponse.json({
      data: toOrgUnitDetail(orgUnit),
    });
  }),
  http.post('*/admin/org-units/:orgUnitId/move', async ({ params, request }) => {
    const orgUnit = readOrgUnit(String(params.orgUnitId));
    if (!orgUnit) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    const newParentOrgUnitId =
      typeof body.newParentOrgUnitId === 'string' && body.newParentOrgUnitId.trim().length > 0
        ? body.newParentOrgUnitId
        : null;

    const newParent = newParentOrgUnitId ? readOrgUnit(newParentOrgUnitId) : undefined;
    orgUnit.parentOrgUnitId = newParentOrgUnitId;
    orgUnit.depth = newParent ? newParent.depth + 1 : 0;
    orgUnit.updatedAt = Date.now();

    return HttpResponse.json({
      data: toOrgUnitDetail(orgUnit),
    });
  }),
  http.post('*/admin/org-units/:orgUnitId/activate', ({ params }) => {
    const orgUnit = readOrgUnit(String(params.orgUnitId));
    if (!orgUnit) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    orgUnit.status = 'ACTIVE';
    orgUnit.updatedAt = Date.now();

    return HttpResponse.json({
      data: toOrgUnitDetail(orgUnit),
    });
  }),
  http.post('*/admin/org-units/:orgUnitId/deactivate', ({ params }) => {
    const orgUnit = readOrgUnit(String(params.orgUnitId));
    if (!orgUnit) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    orgUnit.status = 'INACTIVE';
    orgUnit.updatedAt = Date.now();

    return HttpResponse.json({
      data: toOrgUnitDetail(orgUnit),
    });
  }),
  http.post('*/admin/org-units/:orgUnitId/archive', ({ params }) => {
    const orgUnit = readOrgUnit(String(params.orgUnitId));
    if (!orgUnit) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    orgUnit.status = 'ARCHIVED';
    orgUnit.updatedAt = Date.now();

    return HttpResponse.json({
      data: toOrgUnitDetail(orgUnit),
    });
  }),
  http.get('*/admin/employment-profiles', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const employmentStatus = searchParams.get('employmentStatus');
    const contractStatus = searchParams.get('contractStatus');
    const employmentKind = searchParams.get('employmentKind');
    const orgUnitId = searchParams.get('orgUnitId');
    const managerEmploymentProfileId = searchParams.get('managerEmploymentProfileId');
    const hasLinkedUser = parseBooleanParam(searchParams.get('hasLinkedUser'));
    const search = searchParams.get('search');

    let rows = [...employmentProfiles];

    if (!employmentStatus) {
      rows = rows.filter((item) => item.employmentStatus !== 'ARCHIVED');
    } else {
      rows = rows.filter((item) => item.employmentStatus === employmentStatus);
    }

    if (contractStatus) {
      rows = rows.filter((item) => item.contractStatus === contractStatus);
    }

    if (employmentKind) {
      rows = rows.filter((item) => item.employmentKind === employmentKind);
    }

    if (orgUnitId) {
      rows = rows.filter((item) => item.orgUnitId === orgUnitId);
    }

    if (managerEmploymentProfileId) {
      rows = rows.filter((item) => item.managerEmploymentProfileId === managerEmploymentProfileId);
    }

    if (hasLinkedUser !== undefined) {
      rows = rows.filter((item) => {
        const linked = Boolean(item.linkedUserId);
        return hasLinkedUser ? linked : !linked;
      });
    }

    if (search) {
      rows = rows.filter(
        (item) =>
          toTokenMatch(item.employeeCode, search) ||
          toTokenMatch(item.legalName, search) ||
          toTokenMatch(item.displayName, search),
      );
    }

    rows = sortEmploymentProfiles(
      rows,
      searchParams.get('sortBy'),
      searchParams.get('sortDirection'),
    );
    const paged = paginate(rows.map(toEmploymentListItem), searchParams);

    return HttpResponse.json(paged);
  }),
  http.post('*/admin/employment-profiles', async ({ request }) => {
    const body = await parseJsonBody(request);
    employmentSeed += 1;
    const id = `ep-${employmentSeed}`;

    const nextRecord: EmploymentProfileRecord = {
      id,
      employeeCode: providedOrGeneratedFixtureCode(
        body.employeeCode,
        generatedFixtureCode('EP', employmentSeed),
      ),
      legalName: String(body.legalName ?? `Employee ${employmentSeed}`),
      displayName: String(body.displayName ?? `Employee ${employmentSeed}`),
      employmentKind: String(body.employmentKind ?? 'FULL_TIME'),
      jobTitle: String(body.jobTitle ?? 'Staff'),
      titleDescription: (body.titleDescription as string | null | undefined) ?? null,
      externalRef: (body.externalRef as string | null | undefined) ?? null,
      orgUnitId: String(body.orgUnitId ?? 'ou-root'),
      managerEmploymentProfileId:
        typeof body.managerEmploymentProfileId === 'string'
          ? body.managerEmploymentProfileId
          : null,
      recruiterEmploymentProfileId:
        typeof body.recruiterEmploymentProfileId === 'string'
          ? body.recruiterEmploymentProfileId
          : null,
      hrOwnerEmploymentProfileId:
        typeof body.hrOwnerEmploymentProfileId === 'string'
          ? body.hrOwnerEmploymentProfileId
          : null,
      onboardingOwnerEmploymentProfileId:
        typeof body.onboardingOwnerEmploymentProfileId === 'string'
          ? body.onboardingOwnerEmploymentProfileId
          : null,
      sourcedByEmploymentProfileId:
        typeof body.sourcedByEmploymentProfileId === 'string'
          ? body.sourcedByEmploymentProfileId
          : null,
      linkedUserId: typeof body.linkedUserId === 'string' ? body.linkedUserId : null,
      employmentStatus: 'ACTIVE',
      contractStatus:
        (body.contractStatus as ContractStatus | undefined) ?? ('NONE' as ContractStatus),
      employmentStartDate: parseCanonicalDateToUtcMidnight(
        body.employmentStartDate,
        Date.UTC(2026, 0, 1),
      ),
      employmentEndDate: null,
      hiredAt: parseCanonicalDateToUtcMidnight(body.hiredAt, null),
      onboardedAt: parseCanonicalDateToUtcMidnight(body.onboardedAt, null),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    employmentProfiles.push(nextRecord);

    return HttpResponse.json({
      data: toEmploymentDetail(nextRecord),
    });
  }),
  http.get(
    '*/admin/employment-profiles/:employmentProfileId/direct-reports',
    ({ params, request }) => {
      const employmentProfileId = String(params.employmentProfileId);
      const url = new URL(request.url);
      const sortBy = url.searchParams.get('sortBy');
      const sortDirection = url.searchParams.get('sortDirection');
      const directionMultiplier = sortDirection === 'desc' ? -1 : 1;

      const rows = employmentProfiles
        .filter(
          (item) =>
            item.managerEmploymentProfileId === employmentProfileId &&
            item.employmentStatus !== 'ARCHIVED',
        )
        .sort((left, right) => {
          const leftValue = sortBy === 'displayName' ? left.displayName : left.employeeCode;
          const rightValue = sortBy === 'displayName' ? right.displayName : right.employeeCode;
          if (leftValue < rightValue) {
            return -1 * directionMultiplier;
          }
          if (leftValue > rightValue) {
            return 1 * directionMultiplier;
          }
          return left.id.localeCompare(right.id);
        });

      const paged = paginate(rows.map(toDirectReportItem), url.searchParams);
      return HttpResponse.json(paged);
    },
  ),
  http.get('*/admin/employment-profiles/:employmentProfileId', ({ params }) => {
    const profile = readEmploymentProfile(String(params.employmentProfileId));
    if (!profile) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({
      data: toEmploymentDetail(profile),
    });
  }),
  http.patch('*/admin/employment-profiles/:employmentProfileId', async ({ params, request }) => {
    const profile = readEmploymentProfile(String(params.employmentProfileId));
    if (!profile) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    profile.legalName = body.legalName ? String(body.legalName) : profile.legalName;
    profile.displayName = body.displayName ? String(body.displayName) : profile.displayName;
    profile.employmentKind = body.employmentKind
      ? String(body.employmentKind)
      : profile.employmentKind;
    profile.jobTitle = body.jobTitle ? String(body.jobTitle) : profile.jobTitle;
    profile.externalRef = (body.externalRef as string | null | undefined) ?? profile.externalRef;
    profile.titleDescription =
      (body.titleDescription as string | null | undefined) ?? profile.titleDescription;
    if ('recruiterEmploymentProfileId' in body) {
      profile.recruiterEmploymentProfileId =
        typeof body.recruiterEmploymentProfileId === 'string'
          ? body.recruiterEmploymentProfileId
          : null;
    }
    if ('hrOwnerEmploymentProfileId' in body) {
      profile.hrOwnerEmploymentProfileId =
        typeof body.hrOwnerEmploymentProfileId === 'string'
          ? body.hrOwnerEmploymentProfileId
          : null;
    }
    if ('onboardingOwnerEmploymentProfileId' in body) {
      profile.onboardingOwnerEmploymentProfileId =
        typeof body.onboardingOwnerEmploymentProfileId === 'string'
          ? body.onboardingOwnerEmploymentProfileId
          : null;
    }
    if ('sourcedByEmploymentProfileId' in body) {
      profile.sourcedByEmploymentProfileId =
        typeof body.sourcedByEmploymentProfileId === 'string'
          ? body.sourcedByEmploymentProfileId
          : null;
    }
    if ('hiredAt' in body) {
      profile.hiredAt = parseCanonicalDateToUtcMidnight(body.hiredAt, null);
    }
    if ('onboardedAt' in body) {
      profile.onboardedAt = parseCanonicalDateToUtcMidnight(body.onboardedAt, null);
    }
    profile.updatedAt = Date.now();

    return HttpResponse.json({
      data: toEmploymentDetail(profile),
    });
  }),
  http.post(
    '*/admin/employment-profiles/:employmentProfileId/org-unit-assignment',
    async ({ params, request }) => {
      const profile = readEmploymentProfile(String(params.employmentProfileId));
      if (!profile) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }

      const body = await parseJsonBody(request);
      if (typeof body.newOrgUnitId === 'string') {
        profile.orgUnitId = body.newOrgUnitId;
      }
      profile.updatedAt = Date.now();

      return HttpResponse.json({
        data: toEmploymentDetail(profile),
      });
    },
  ),
  http.post(
    '*/admin/employment-profiles/:employmentProfileId/manager-assignment',
    async ({ params, request }) => {
      const profile = readEmploymentProfile(String(params.employmentProfileId));
      if (!profile) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }

      const body = await parseJsonBody(request);
      if (
        body.newManagerEmploymentProfileId === null ||
        body.newManagerEmploymentProfileId === ''
      ) {
        profile.managerEmploymentProfileId = null;
      } else if (typeof body.newManagerEmploymentProfileId === 'string') {
        profile.managerEmploymentProfileId = body.newManagerEmploymentProfileId;
      }
      profile.updatedAt = Date.now();

      return HttpResponse.json({
        data: toEmploymentDetail(profile),
      });
    },
  ),
  http.post(
    '*/admin/employment-profiles/:employmentProfileId/user-link',
    async ({ params, request }) => {
      const profile = readEmploymentProfile(String(params.employmentProfileId));
      if (!profile) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }

      const body = await parseJsonBody(request);
      if (typeof body.linkedUserId === 'string') {
        profile.linkedUserId = body.linkedUserId;
      }
      profile.updatedAt = Date.now();

      return HttpResponse.json({
        data: toEmploymentDetail(profile),
      });
    },
  ),
  http.post('*/admin/employment-profiles/:employmentProfileId/user-unlink', ({ params }) => {
    const profile = readEmploymentProfile(String(params.employmentProfileId));
    if (!profile) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    profile.linkedUserId = null;
    profile.updatedAt = Date.now();

    return HttpResponse.json({
      data: toEmploymentDetail(profile),
    });
  }),
  http.post(
    '*/admin/employment-profiles/:employmentProfileId/contract-status',
    async ({ params, request }) => {
      const profile = readEmploymentProfile(String(params.employmentProfileId));
      if (!profile) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }

      const body = await parseJsonBody(request);
      if (typeof body.newContractStatus === 'string') {
        const nextStatus = body.newContractStatus as ContractStatus;
        if (!canTransitionContractStatus(profile, nextStatus)) {
          return HttpResponse.json(
            {
              message: 'employment-profile:validation.contractStatusTransitionNotAllowed',
            },
            { status: 422 },
          );
        }
        profile.contractStatus = nextStatus;
      }
      profile.updatedAt = Date.now();

      return HttpResponse.json({
        data: toEmploymentDetail(profile),
      });
    },
  ),
  http.post('*/admin/employment-profiles/:employmentProfileId/place-on-leave', ({ params }) => {
    const profile = readEmploymentProfile(String(params.employmentProfileId));
    if (!profile) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    profile.employmentStatus = 'ON_LEAVE';
    profile.updatedAt = Date.now();
    return HttpResponse.json({ data: toEmploymentDetail(profile) });
  }),
  http.post('*/admin/employment-profiles/:employmentProfileId/return-from-leave', ({ params }) => {
    const profile = readEmploymentProfile(String(params.employmentProfileId));
    if (!profile) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    profile.employmentStatus = 'ACTIVE';
    profile.updatedAt = Date.now();
    return HttpResponse.json({ data: toEmploymentDetail(profile) });
  }),
  http.post('*/admin/employment-profiles/:employmentProfileId/suspend', ({ params }) => {
    const profile = readEmploymentProfile(String(params.employmentProfileId));
    if (!profile) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    profile.employmentStatus = 'SUSPENDED';
    profile.updatedAt = Date.now();
    return HttpResponse.json({ data: toEmploymentDetail(profile) });
  }),
  http.post('*/admin/employment-profiles/:employmentProfileId/reactivate', ({ params }) => {
    const profile = readEmploymentProfile(String(params.employmentProfileId));
    if (!profile) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    profile.employmentStatus = 'ACTIVE';
    profile.updatedAt = Date.now();
    return HttpResponse.json({ data: toEmploymentDetail(profile) });
  }),
  http.post(
    '*/admin/employment-profiles/:employmentProfileId/terminate',
    async ({ params, request }) => {
      const profile = readEmploymentProfile(String(params.employmentProfileId));
      if (!profile) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }

      const body = await parseJsonBody(request);
      profile.employmentEndDate = parseCanonicalDateToUtcMidnight(
        body.employmentEndDate,
        Date.UTC(2026, 0, 1),
      );
      profile.employmentStatus = 'TERMINATED';
      profile.updatedAt = Date.now();
      return HttpResponse.json({ data: toEmploymentDetail(profile) });
    },
  ),
  http.post('*/admin/employment-profiles/:employmentProfileId/archive', ({ params }) => {
    const profile = readEmploymentProfile(String(params.employmentProfileId));
    if (!profile) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    profile.employmentStatus = 'ARCHIVED';
    profile.updatedAt = Date.now();
    return HttpResponse.json({ data: toEmploymentDetail(profile) });
  }),
  ...wave4Handlers,
  ...wave5Handlers,
  ...wave6Handlers,
  ...wave7Handlers,
  ...wave8Handlers,
  ...wave9Handlers,
  ...kpiHandlers,
  ...identityAccessHandlers,
  ...selfServiceHandlers,
  ...managerWorkspaceHandlers,
  ...peopleReadinessHandlers,
  ...employmentTermsHandlers,
];
