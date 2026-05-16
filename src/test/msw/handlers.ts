import { http, HttpResponse } from 'msw';

import { resetWave5MockData, wave5Handlers } from '@test/msw/wave5-handlers';
import { resetWave6MockData, wave6Handlers } from '@test/msw/wave6-handlers';
import { resetWave7MockData, wave7Handlers } from '@test/msw/wave7-handlers';
import { resetWave8MockData, wave8Handlers } from '@test/msw/wave8-handlers';
import { resetWave9MockData, wave9Handlers } from '@test/msw/wave9-handlers';
import { resetWave4MockData, wave4Handlers } from '@test/msw/wave4-handlers';
import {
  generatedFixtureCode,
  providedOrGeneratedFixtureCode,
} from '@test/msw/generated-code-fixtures';
import {
  identityAccessHandlers,
  resetIdentityAccessMockData,
} from '@test/msw/identity-access-handlers';

type OrgUnitStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

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
  linkedUserId?: string | null;
  employmentStatus: EmploymentStatus;
  contractStatus: ContractStatus;
  employmentStartDate: string;
  employmentEndDate?: string | null;
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
    linkedUserId: 'user-alice',
    employmentStatus: 'ACTIVE',
    contractStatus: 'ACTIVE',
    employmentStartDate: '2024-01-01',
    employmentEndDate: null,
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
    employmentStartDate: '2024-03-01',
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
    employmentStartDate: '2023-10-01',
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
    employmentStartDate: '2022-11-01',
    employmentEndDate: '2025-12-31',
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
    employmentStartDate: '2020-01-01',
    employmentEndDate: '2021-12-31',
    createdAt: now - 2_000,
    updatedAt: now - 1_500,
  },
];

const cloneOrgUnits = (): OrgUnitRecord[] => initialOrgUnits.map((record) => ({ ...record }));

const cloneEmploymentProfiles = (): EmploymentProfileRecord[] =>
  initialEmploymentProfiles.map((record) => ({ ...record }));

let orgUnits: OrgUnitRecord[] = cloneOrgUnits();
let employmentProfiles: EmploymentProfileRecord[] = cloneEmploymentProfiles();

export const resetMockData = (): void => {
  orgUnitSeed = initialOrgUnitSeed;
  employmentSeed = initialEmploymentSeed;
  orgUnits = cloneOrgUnits();
  employmentProfiles = cloneEmploymentProfiles();
  resetWave4MockData();
  resetWave5MockData();
  resetWave6MockData();
  resetWave7MockData();
  resetWave8MockData();
  resetWave9MockData();
  resetIdentityAccessMockData();
};

const readOrgUnit = (orgUnitId: string): OrgUnitRecord | undefined =>
  orgUnits.find((item) => item.id === orgUnitId);

const readEmploymentProfile = (employmentProfileId: string): EmploymentProfileRecord | undefined =>
  employmentProfiles.find((item) => item.id === employmentProfileId);

const toOrgUnitListItem = (record: OrgUnitRecord) => {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    type: record.type,
    status: record.status,
    parentOrgUnitId: record.parentOrgUnitId ?? null,
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

const toEmploymentListItem = (record: EmploymentProfileRecord) => {
  return {
    id: record.id,
    employeeCode: record.employeeCode,
    legalName: record.legalName,
    displayName: record.displayName,
    employmentKind: record.employmentKind,
    jobTitle: record.jobTitle,
    orgUnitId: record.orgUnitId,
    managerEmploymentProfileId: record.managerEmploymentProfileId ?? null,
    linkedUserId: record.linkedUserId ?? null,
    employmentStatus: record.employmentStatus,
    contractStatus: record.contractStatus,
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
    managerEmploymentProfileId: record.managerEmploymentProfileId ?? null,
    linkedUserId: record.linkedUserId ?? null,
    employmentStatus: record.employmentStatus,
    contractStatus: record.contractStatus,
    employmentStartDate: record.employmentStartDate,
    employmentEndDate: record.employmentEndDate ?? null,
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
    managerEmploymentProfileId: record.managerEmploymentProfileId ?? null,
  };
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
  http.get('*/admin/dashboard-lite/snapshot', () => {
    return HttpResponse.json({
      data: {
        generatedAt: '2026-04-22T00:00:00.000Z',
        businessDate: '2026-04-22',
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
      linkedUserId: typeof body.linkedUserId === 'string' ? body.linkedUserId : null,
      employmentStatus: 'ACTIVE',
      contractStatus:
        (body.contractStatus as ContractStatus | undefined) ?? ('NONE' as ContractStatus),
      employmentStartDate: String(body.employmentStartDate ?? '2026-01-01'),
      employmentEndDate: null,
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
      if (typeof body.employmentEndDate === 'string') {
        profile.employmentEndDate = body.employmentEndDate;
      }
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
  ...identityAccessHandlers,
];
