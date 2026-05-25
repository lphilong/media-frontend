import { http, HttpResponse } from 'msw';

import {
  generatedFixtureCode,
  providedOrGeneratedFixtureCode,
} from '@test/msw/generated-code-fixtures';
import { getMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';

type TalentOperationalStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'ARCHIVED';
type TalentOrigin = 'INTERNAL' | 'EXTERNAL';
type TalentCommercialParticipationStatus = 'ELIGIBLE' | 'RESTRICTED' | 'BLOCKED';

type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  displayName?: string;
  status?: string;
};

type TalentRecord = {
  id: string;
  talentCode: string;
  displayName?: string;
  performanceAlias?: string | null;
  stageName: string;
  legalName: string;
  displayShortName: string | null;
  talentOrigin: TalentOrigin;
  operationalStatus: TalentOperationalStatus;
  managerEmploymentProfileId: string | null;
  linkedEmploymentProfileId: string | null;
  commercialParticipationStatus: TalentCommercialParticipationStatus;
  livestreamEligible: boolean;
  eventEligible: boolean;
  externalRef: string | null;
  profileSummary: string | null;
  createdAt: number;
  updatedAt: number;
};

type TalentGroupStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type TalentGroupMembershipStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED';
type TalentGroupManagerAssignmentStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED';
type TalentGroupManagerRole = 'OWNER' | 'MANAGER' | 'ASSISTANT';

type TalentGroupRecord = {
  id: string;
  groupCode: string;
  name: string;
  shortName: string | null;
  status: TalentGroupStatus;
  displayOrder: number;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type TalentGroupMembershipRecord = {
  id: string;
  groupId: string;
  talentId: string;
  membershipStatus: TalentGroupMembershipStatus;
  lineupOrder: number;
  joinedAt: number;
  leftAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type TalentGroupManagerAssignmentRecord = {
  id: string;
  groupId: string;
  managerEmploymentProfileId: string;
  role: TalentGroupManagerRole;
  effectiveFrom: number;
  effectiveTo: number | null;
  status: TalentGroupManagerAssignmentStatus;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const initialTalentSeed = 1000;
const initialGroupSeed = 1000;
const initialMembershipSeed = 2000;
const initialManagerAssignmentSeed = 3000;

let talentSeed = initialTalentSeed;
let groupSeed = initialGroupSeed;
let membershipSeed = initialMembershipSeed;
let managerAssignmentSeed = initialManagerAssignmentSeed;

const initialTalents: TalentRecord[] = [
  {
    id: 'talent-001',
    talentCode: 'TAL-000001',
    stageName: 'Mina Performance Alias',
    legalName: 'Stale Internal Legal',
    displayShortName: 'Stale Internal Short',
    talentOrigin: 'INTERNAL',
    operationalStatus: 'ACTIVE',
    managerEmploymentProfileId: 'ep-001',
    linkedEmploymentProfileId: 'ep-002',
    commercialParticipationStatus: 'ELIGIBLE',
    livestreamEligible: true,
    eventEligible: true,
    externalRef: null,
    profileSummary: 'Core flagship talent',
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
  },
  {
    id: 'talent-002',
    talentCode: 'TAL-000002',
    stageName: 'BaoStar',
    legalName: 'Bao Tran',
    displayShortName: null,
    talentOrigin: 'EXTERNAL',
    operationalStatus: 'SUSPENDED',
    managerEmploymentProfileId: 'ep-001',
    linkedEmploymentProfileId: null,
    commercialParticipationStatus: 'BLOCKED',
    livestreamEligible: false,
    eventEligible: false,
    externalRef: 'TAL-BAO',
    profileSummary: null,
    createdAt: now - 5_000,
    updatedAt: now - 4_000,
  },
  {
    id: 'talent-003',
    talentCode: 'TAL-000003',
    stageName: 'ChauLive',
    legalName: 'Stale Internal Chau Legal',
    displayShortName: 'Stale Internal Chau Short',
    talentOrigin: 'INTERNAL',
    operationalStatus: 'INACTIVE',
    managerEmploymentProfileId: null,
    linkedEmploymentProfileId: 'ep-003',
    commercialParticipationStatus: 'RESTRICTED',
    livestreamEligible: true,
    eventEligible: false,
    externalRef: null,
    profileSummary: 'Inactive reserve talent',
    createdAt: now - 4_000,
    updatedAt: now - 3_000,
  },
  {
    id: 'talent-archive',
    talentCode: 'TAL-999999',
    stageName: 'ArchiveTalent',
    legalName: 'Archived Talent',
    displayShortName: null,
    talentOrigin: 'EXTERNAL',
    operationalStatus: 'ARCHIVED',
    managerEmploymentProfileId: null,
    linkedEmploymentProfileId: null,
    commercialParticipationStatus: 'BLOCKED',
    livestreamEligible: false,
    eventEligible: false,
    externalRef: null,
    profileSummary: null,
    createdAt: now - 2_000,
    updatedAt: now - 1_000,
  },
];

const initialTalentGroups: TalentGroupRecord[] = [
  {
    id: 'group-001',
    groupCode: 'TG-000001',
    name: 'A Team',
    shortName: 'ATeam',
    status: 'ACTIVE',
    displayOrder: 1,
    description: 'Primary talent group',
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
  },
  {
    id: 'group-002',
    groupCode: 'TG-000002',
    name: 'B Team',
    shortName: null,
    status: 'INACTIVE',
    displayOrder: 2,
    description: null,
    externalRef: 'GRP-B',
    createdAt: now - 5_000,
    updatedAt: now - 4_000,
  },
  {
    id: 'group-archive',
    groupCode: 'TG-999999',
    name: 'Archived Group',
    shortName: null,
    status: 'ARCHIVED',
    displayOrder: 3,
    description: null,
    externalRef: null,
    createdAt: now - 2_000,
    updatedAt: now - 1_000,
  },
];

const initialMemberships: TalentGroupMembershipRecord[] = [
  {
    id: 'membership-001',
    groupId: 'group-001',
    talentId: 'talent-001',
    membershipStatus: 'ACTIVE',
    lineupOrder: 1,
    joinedAt: now - 8_000,
    leftAt: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_500,
  },
  {
    id: 'membership-002',
    groupId: 'group-001',
    talentId: 'talent-002',
    membershipStatus: 'INACTIVE',
    lineupOrder: 2,
    joinedAt: now - 7_000,
    leftAt: now - 6_000,
    createdAt: now - 7_000,
    updatedAt: now - 6_000,
  },
  {
    id: 'membership-003',
    groupId: 'group-002',
    talentId: 'talent-003',
    membershipStatus: 'ACTIVE',
    lineupOrder: 1,
    joinedAt: now - 6_500,
    leftAt: null,
    createdAt: now - 6_500,
    updatedAt: now - 6_000,
  },
  {
    id: 'membership-removed-001',
    groupId: 'group-001',
    talentId: 'talent-003',
    membershipStatus: 'REMOVED',
    lineupOrder: 3,
    joinedAt: now - 10_000,
    leftAt: now - 9_000,
    createdAt: now - 10_000,
    updatedAt: now - 9_000,
  },
  {
    id: 'membership-archive-001',
    groupId: 'group-archive',
    talentId: 'talent-001',
    membershipStatus: 'ACTIVE',
    lineupOrder: 1,
    joinedAt: now - 4_500,
    leftAt: null,
    createdAt: now - 4_500,
    updatedAt: now - 4_000,
  },
];

const initialManagerAssignments: TalentGroupManagerAssignmentRecord[] = [
  {
    id: 'manager-assignment-001',
    groupId: 'group-001',
    managerEmploymentProfileId: 'ep-001',
    role: 'MANAGER',
    effectiveFrom: now - 4_000,
    effectiveTo: null,
    status: 'ACTIVE',
    isPrimary: true,
    createdAt: now - 4_000,
    updatedAt: now - 4_000,
  },
];

let talents: TalentRecord[] = initialTalents.map((record) => ({ ...record }));
let talentGroups: TalentGroupRecord[] = initialTalentGroups.map((record) => ({ ...record }));
let memberships: TalentGroupMembershipRecord[] = initialMemberships.map((record) => ({
  ...record,
}));
let managerAssignments: TalentGroupManagerAssignmentRecord[] = initialManagerAssignments.map(
  (record) => ({ ...record }),
);

const normalizeText = (value: string): string => value.trim().toLowerCase();
const toPrefixMatch = (value: string, search: string): boolean =>
  normalizeText(value).startsWith(normalizeText(search));

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

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  const body = (await request.json()) as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
};

const readTalent = (talentId: string): TalentRecord | undefined =>
  talents.find((item) => item.id === talentId);
const readGroup = (groupId: string): TalentGroupRecord | undefined =>
  talentGroups.find((item) => item.id === groupId);
const readMembership = (membershipId: string): TalentGroupMembershipRecord | undefined =>
  memberships.find((item) => item.id === membershipId);
const readManagerAssignment = (
  assignmentId: string,
): TalentGroupManagerAssignmentRecord | undefined =>
  managerAssignments.find((item) => item.id === assignmentId);

const actorEmploymentProfileIds = new Map<string, string>([['user-team-manager', 'ep-001']]);

const getManagedGroupScopeIds = (): Set<string> | null => {
  const capabilities = getMockCurrentActorCapabilities();
  const kpiScopes = capabilities.scopeGrants.kpi ?? [];

  if (kpiScopes.includes('global') || !kpiScopes.includes('managedGroup')) {
    return null;
  }

  const employmentProfileId = actorEmploymentProfileIds.get(capabilities.id);
  if (!employmentProfileId) {
    return new Set();
  }

  return new Set(
    managerAssignments
      .filter(
        (assignment) =>
          assignment.managerEmploymentProfileId === employmentProfileId &&
          assignment.status === 'ACTIVE' &&
          assignment.effectiveFrom <= Date.now() &&
          (assignment.effectiveTo === null || assignment.effectiveTo >= Date.now()),
      )
      .map((assignment) => assignment.groupId),
  );
};

const denyUnmanagedGroup = (groupId: string): Response | null => {
  const managedGroupIds = getManagedGroupScopeIds();
  if (managedGroupIds === null || managedGroupIds.has(groupId)) {
    return null;
  }

  return HttpResponse.json({ message: 'errors:forbidden.message' }, { status: 403 });
};

const hasActiveManagedTalentMembership = (talentId: string): boolean => {
  const managedGroupIds = getManagedGroupScopeIds();
  if (managedGroupIds === null) {
    return true;
  }

  return memberships.some(
    (membership) =>
      membership.talentId === talentId &&
      membership.membershipStatus === 'ACTIVE' &&
      managedGroupIds.has(membership.groupId),
  );
};

const employmentProfileRefs = new Map<string, ReferenceSummary>([
  [
    'ep-001',
    {
      id: 'ep-001',
      code: 'EP-000001',
      displayName: 'Alice',
      name: 'Alice Nguyen',
      status: 'ACTIVE',
    },
  ],
  [
    'ep-002',
    { id: 'ep-002', code: 'EP-000002', displayName: 'Bao', name: 'Bao Tran', status: 'ON_LEAVE' },
  ],
  [
    'ep-003',
    { id: 'ep-003', code: 'EP-000003', displayName: 'Chau', name: 'Chau Le', status: 'SUSPENDED' },
  ],
]);

const toEmploymentProfileRef = (employmentProfileId: string | null): ReferenceSummary | null =>
  employmentProfileId ? (employmentProfileRefs.get(employmentProfileId) ?? null) : null;

const toGroupRef = (groupId: string): ReferenceSummary | null => {
  const group = readGroup(groupId);
  return group
    ? { id: group.id, code: group.groupCode, name: group.name, status: group.status }
    : null;
};

const toTalentRef = (talentId: string): ReferenceSummary | null => {
  const talent = readTalent(talentId);
  const displayName = readTalentDisplayName(talent);
  return talent
    ? {
        id: talent.id,
        code: talent.talentCode,
        name: displayName,
        displayName,
        status: talent.operationalStatus,
      }
    : null;
};

const readTalentDisplayName = (talent: TalentRecord | undefined): string => {
  if (!talent) {
    return '';
  }

  if (talent.talentOrigin === 'INTERNAL') {
    return (
      toEmploymentProfileRef(talent.linkedEmploymentProfileId)?.displayName ?? talent.talentCode
    );
  }

  return talent.displayName ?? talent.displayShortName ?? talent.stageName;
};

const readTalentPerformanceAlias = (talent: TalentRecord): string | null => {
  const displayName = readTalentDisplayName(talent);
  if (talent.talentOrigin === 'INTERNAL') {
    return talent.stageName && talent.stageName !== displayName ? talent.stageName : null;
  }

  return talent.stageName;
};

const toTalentListItem = (record: TalentRecord) => {
  return {
    id: record.id,
    talentCode: record.talentCode,
    displayName: readTalentDisplayName(record),
    performanceAlias: readTalentPerformanceAlias(record),
    stageName: record.stageName,
    legalName: record.legalName,
    displayShortName: record.displayShortName,
    talentOrigin: record.talentOrigin,
    operationalStatus: record.operationalStatus,
    managerEmploymentProfileId: record.managerEmploymentProfileId,
    managerEmploymentProfileRef: toEmploymentProfileRef(record.managerEmploymentProfileId),
    linkedEmploymentProfileId: record.linkedEmploymentProfileId,
    linkedEmploymentProfileRef: toEmploymentProfileRef(record.linkedEmploymentProfileId),
    commercialParticipationStatus: record.commercialParticipationStatus,
    livestreamEligible: record.livestreamEligible,
    eventEligible: record.eventEligible,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const toTalentDetail = (record: TalentRecord) => {
  return {
    ...toTalentListItem(record),
    externalRef: record.externalRef,
    profileSummary: record.profileSummary,
  };
};

const toGroupListItem = (record: TalentGroupRecord) => {
  return {
    id: record.id,
    groupCode: record.groupCode,
    name: record.name,
    shortName: record.shortName,
    status: record.status,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const toGroupDetail = (record: TalentGroupRecord) => {
  return {
    ...toGroupListItem(record),
    description: record.description,
    externalRef: record.externalRef,
  };
};

const toMembershipItem = (record: TalentGroupMembershipRecord) => {
  return {
    id: record.id,
    groupId: record.groupId,
    talentId: record.talentId,
    talentRef: toTalentRef(record.talentId),
    membershipStatus: record.membershipStatus,
    lineupOrder: record.lineupOrder,
    joinedAt: record.joinedAt,
    leftAt: record.leftAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const toManagerAssignmentItem = (record: TalentGroupManagerAssignmentRecord) => ({
  id: record.id,
  groupId: record.groupId,
  managerEmploymentProfileId: record.managerEmploymentProfileId,
  role: record.role,
  effectiveFrom: record.effectiveFrom,
  effectiveTo: record.effectiveTo,
  status: record.status,
  isPrimary: record.isPrimary,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  groupRef: toGroupRef(record.groupId),
  managerRef: toEmploymentProfileRef(record.managerEmploymentProfileId),
  managerHasLinkedAdminUser: record.managerEmploymentProfileId === 'ep-001',
});

const toByTalentItem = (group: TalentGroupRecord, membership: TalentGroupMembershipRecord) => {
  return {
    groupId: group.id,
    id: group.id,
    groupCode: group.groupCode,
    name: group.name,
    shortName: group.shortName,
    status: group.status,
    displayOrder: group.displayOrder,
    membershipId: membership.id,
    talentId: membership.talentId,
    talentRef: toTalentRef(membership.talentId),
    membershipStatus: membership.membershipStatus,
    lineupOrder: membership.lineupOrder,
    joinedAt: membership.joinedAt,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};

const sortTalents = (
  records: TalentRecord[],
  sortBy: string | null,
  sortDirection: string | null,
): TalentRecord[] => {
  const sorted = [...records];
  const directionMultiplier = sortDirection === 'desc' ? -1 : 1;

  const readValue = (record: TalentRecord): string | number => {
    switch (sortBy) {
      case 'talentCode':
        return record.talentCode;
      case 'stageName':
        return record.stageName;
      case 'legalName':
        return record.legalName;
      case 'createdAt':
        return record.createdAt;
      default:
        return record.talentCode;
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

const sortTalentGroups = <
  TRecord extends Pick<TalentGroupRecord, 'groupCode' | 'name' | 'displayOrder' | 'createdAt'> & {
    id: string;
  },
>(
  records: TRecord[],
  sortBy: string | null,
  sortDirection: string | null,
): TRecord[] => {
  const sorted = [...records];
  const directionMultiplier = sortDirection === 'desc' ? -1 : 1;

  const readValue = (record: TRecord): string | number => {
    switch (sortBy) {
      case 'groupCode':
        return record.groupCode;
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

const assertBlockedCommercialCombination = (
  commercialParticipationStatus: TalentCommercialParticipationStatus,
  livestreamEligible: boolean,
  eventEligible: boolean,
): boolean => {
  if (commercialParticipationStatus !== 'BLOCKED') {
    return false;
  }

  return livestreamEligible || eventEligible;
};

const isTalentOrigin = (value: unknown): value is TalentOrigin => {
  return value === 'INTERNAL' || value === 'EXTERNAL';
};

const isTalentCommercialParticipationStatus = (
  value: unknown,
): value is TalentCommercialParticipationStatus => {
  return value === 'ELIGIBLE' || value === 'RESTRICTED' || value === 'BLOCKED';
};

const cloneTalents = (): TalentRecord[] => initialTalents.map((record) => ({ ...record }));
const cloneGroups = (): TalentGroupRecord[] => initialTalentGroups.map((record) => ({ ...record }));
const cloneMemberships = (): TalentGroupMembershipRecord[] =>
  initialMemberships.map((record) => ({ ...record }));
const cloneManagerAssignments = (): TalentGroupManagerAssignmentRecord[] =>
  initialManagerAssignments.map((record) => ({ ...record }));

export const resetWave4MockData = (): void => {
  talentSeed = initialTalentSeed;
  groupSeed = initialGroupSeed;
  membershipSeed = initialMembershipSeed;
  managerAssignmentSeed = initialManagerAssignmentSeed;
  talents = cloneTalents();
  talentGroups = cloneGroups();
  memberships = cloneMemberships();
  managerAssignments = cloneManagerAssignments();
};

export const wave4Handlers = [
  http.get('*/admin/talents', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const operationalStatus = searchParams.get('operationalStatus');
    const talentOrigin = searchParams.get('talentOrigin');
    const managerEmploymentProfileId = searchParams.get('managerEmploymentProfileId');
    const hasLinkedEmploymentProfile = parseBooleanParam(
      searchParams.get('hasLinkedEmploymentProfile'),
    );
    const commercialParticipationStatus = searchParams.get('commercialParticipationStatus');
    const livestreamEligible = parseBooleanParam(searchParams.get('livestreamEligible'));
    const eventEligible = parseBooleanParam(searchParams.get('eventEligible'));
    const search = searchParams.get('search');

    let rows = [...talents];
    const managedGroupIds = getManagedGroupScopeIds();

    if (!operationalStatus) {
      rows = rows.filter((item) => item.operationalStatus !== 'ARCHIVED');
    } else {
      rows = rows.filter((item) => item.operationalStatus === operationalStatus);
    }

    if (managedGroupIds !== null) {
      const activeManagedTalentIds = new Set(
        memberships
          .filter(
            (membership) =>
              membership.membershipStatus === 'ACTIVE' && managedGroupIds.has(membership.groupId),
          )
          .map((membership) => membership.talentId),
      );
      rows = rows.filter((item) => activeManagedTalentIds.has(item.id));
    }

    if (talentOrigin) {
      rows = rows.filter((item) => item.talentOrigin === talentOrigin);
    }

    if (managerEmploymentProfileId) {
      rows = rows.filter((item) => item.managerEmploymentProfileId === managerEmploymentProfileId);
    }

    if (hasLinkedEmploymentProfile !== undefined) {
      rows = rows.filter((item) => {
        const linked = Boolean(item.linkedEmploymentProfileId);
        return hasLinkedEmploymentProfile ? linked : !linked;
      });
    }

    if (commercialParticipationStatus) {
      rows = rows.filter(
        (item) => item.commercialParticipationStatus === commercialParticipationStatus,
      );
    }

    if (livestreamEligible !== undefined) {
      rows = rows.filter((item) => item.livestreamEligible === livestreamEligible);
    }

    if (eventEligible !== undefined) {
      rows = rows.filter((item) => item.eventEligible === eventEligible);
    }

    if (search) {
      rows = rows.filter(
        (item) =>
          toPrefixMatch(item.talentCode, search) ||
          toPrefixMatch(item.stageName, search) ||
          toPrefixMatch(item.legalName, search) ||
          (item.displayShortName ? toPrefixMatch(item.displayShortName, search) : false),
      );
    }

    rows = sortTalents(rows, searchParams.get('sortBy'), searchParams.get('sortDirection'));
    const paged = paginate(rows.map(toTalentListItem), searchParams);
    return HttpResponse.json(paged);
  }),

  http.post('*/admin/talents', async ({ request }) => {
    const body = await parseJsonBody(request);
    const talentOrigin = body.talentOrigin ?? 'INTERNAL';
    const commercialParticipationStatus = body.commercialParticipationStatus ?? 'ELIGIBLE';
    const livestreamEligible = Boolean(body.livestreamEligible);
    const eventEligible = Boolean(body.eventEligible);

    if (
      !isTalentOrigin(talentOrigin) ||
      !isTalentCommercialParticipationStatus(commercialParticipationStatus)
    ) {
      return HttpResponse.json(
        {
          message: 'talent:validation.invalidToken',
        },
        { status: 422 },
      );
    }

    if (
      assertBlockedCommercialCombination(
        commercialParticipationStatus,
        livestreamEligible,
        eventEligible,
      )
    ) {
      return HttpResponse.json(
        {
          message: 'talent:validation.blockedCommercialStatus',
        },
        { status: 422 },
      );
    }

    const linkedEmploymentProfileId =
      body.linkedEmploymentProfileId === null || body.linkedEmploymentProfileId === undefined
        ? null
        : String(body.linkedEmploymentProfileId);
    if (talentOrigin === 'INTERNAL' && !linkedEmploymentProfileId) {
      return HttpResponse.json({ message: 'talent:validation.required' }, { status: 422 });
    }
    if (talentOrigin === 'EXTERNAL' && linkedEmploymentProfileId) {
      return HttpResponse.json(
        { message: 'talent:validation.invalidEmploymentLinkage' },
        { status: 422 },
      );
    }
    if (talentOrigin === 'EXTERNAL' && (!body.stageName || !body.legalName)) {
      return HttpResponse.json({ message: 'talent:validation.required' }, { status: 422 });
    }

    talentSeed += 1;
    const linkedRef = toEmploymentProfileRef(linkedEmploymentProfileId);
    const stageName =
      typeof body.stageName === 'string' && body.stageName.trim().length > 0
        ? body.stageName
        : (linkedRef?.displayName ?? `Talent ${talentSeed}`);
    const nextRecord: TalentRecord = {
      id: `talent-${talentSeed}`,
      talentCode: providedOrGeneratedFixtureCode(
        body.talentCode,
        generatedFixtureCode('TAL', talentSeed),
      ),
      stageName,
      legalName: String(body.legalName ?? linkedRef?.name ?? `Talent Legal ${talentSeed}`),
      displayShortName:
        body.displayShortName === null || body.displayShortName === undefined
          ? null
          : String(body.displayShortName),
      talentOrigin,
      operationalStatus: 'ACTIVE',
      managerEmploymentProfileId:
        body.managerEmploymentProfileId === null || body.managerEmploymentProfileId === undefined
          ? null
          : String(body.managerEmploymentProfileId),
      linkedEmploymentProfileId,
      commercialParticipationStatus,
      livestreamEligible,
      eventEligible,
      externalRef:
        body.externalRef === null || body.externalRef === undefined
          ? null
          : String(body.externalRef),
      profileSummary:
        body.profileSummary === null || body.profileSummary === undefined
          ? null
          : String(body.profileSummary),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    talents.push(nextRecord);

    return HttpResponse.json({
      data: toTalentDetail(nextRecord),
    });
  }),

  http.get('*/admin/talents/:talentId', ({ params }) => {
    const talentId = String(params.talentId);
    if (!hasActiveManagedTalentMembership(talentId)) {
      return HttpResponse.json({ message: 'errors:forbidden.message' }, { status: 403 });
    }

    const talent = readTalent(talentId);
    if (!talent) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({
      data: toTalentDetail(talent),
    });
  }),

  http.patch('*/admin/talents/:talentId', async ({ params, request }) => {
    const talent = readTalent(String(params.talentId));
    if (!talent) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    if ('stageName' in body) {
      talent.stageName =
        body.stageName === null || body.stageName === ''
          ? (toEmploymentProfileRef(talent.linkedEmploymentProfileId)?.displayName ??
            talent.stageName)
          : String(body.stageName);
    }
    if (typeof body.legalName === 'string' && talent.talentOrigin === 'EXTERNAL') {
      talent.legalName = body.legalName;
    }
    if ('displayShortName' in body && talent.talentOrigin === 'EXTERNAL') {
      talent.displayShortName =
        body.displayShortName === null ? null : String(body.displayShortName);
    }
    if ('externalRef' in body) {
      talent.externalRef = body.externalRef === null ? null : String(body.externalRef);
    }
    if ('profileSummary' in body) {
      talent.profileSummary = body.profileSummary === null ? null : String(body.profileSummary);
    }
    talent.updatedAt = Date.now();

    return HttpResponse.json({
      data: toTalentDetail(talent),
    });
  }),

  http.post('*/admin/talents/:talentId/manager-assignment', async ({ params, request }) => {
    const talent = readTalent(String(params.talentId));
    if (!talent) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    if (
      body.newManagerEmploymentProfileId === null ||
      body.newManagerEmploymentProfileId === '' ||
      body.newManagerEmploymentProfileId === undefined
    ) {
      talent.managerEmploymentProfileId = null;
    } else {
      talent.managerEmploymentProfileId = String(body.newManagerEmploymentProfileId);
    }
    talent.updatedAt = Date.now();

    return HttpResponse.json({
      data: toTalentDetail(talent),
    });
  }),

  http.post('*/admin/talents/:talentId/employment-profile-link', async ({ params, request }) => {
    const talent = readTalent(String(params.talentId));
    if (!talent) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    const linkedEmploymentProfileId = body.linkedEmploymentProfileId;
    if (typeof linkedEmploymentProfileId !== 'string' || linkedEmploymentProfileId.length === 0) {
      return HttpResponse.json(
        {
          message: 'talent:validation.required',
        },
        { status: 422 },
      );
    }

    talent.linkedEmploymentProfileId = linkedEmploymentProfileId;
    talent.updatedAt = Date.now();

    return HttpResponse.json({
      data: toTalentDetail(talent),
    });
  }),

  http.post(
    '*/admin/talents/:talentId/commercial-participation-status',
    async ({ params, request }) => {
      const talent = readTalent(String(params.talentId));
      if (!talent) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }

      const body = await parseJsonBody(request);
      const nextStatus = body.newCommercialParticipationStatus;
      const livestreamEligible = Boolean(body.livestreamEligible);
      const eventEligible = Boolean(body.eventEligible);

      if (!isTalentCommercialParticipationStatus(nextStatus)) {
        return HttpResponse.json(
          {
            message: 'talent:validation.invalidToken',
          },
          { status: 422 },
        );
      }

      if (assertBlockedCommercialCombination(nextStatus, livestreamEligible, eventEligible)) {
        return HttpResponse.json(
          {
            message: 'talent:validation.blockedCommercialStatus',
          },
          { status: 422 },
        );
      }

      talent.commercialParticipationStatus = nextStatus;
      talent.livestreamEligible = livestreamEligible;
      talent.eventEligible = eventEligible;
      talent.updatedAt = Date.now();

      return HttpResponse.json({
        data: toTalentDetail(talent),
      });
    },
  ),

  http.post('*/admin/talents/:talentId/suspend', ({ params }) => {
    const talent = readTalent(String(params.talentId));
    if (!talent) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (talent.operationalStatus !== 'ACTIVE') {
      return HttpResponse.json({ message: 'talent:validation.lifecycleInvalid' }, { status: 422 });
    }
    talent.operationalStatus = 'SUSPENDED';
    talent.updatedAt = Date.now();

    return HttpResponse.json({
      data: toTalentDetail(talent),
    });
  }),

  http.post('*/admin/talents/:talentId/reactivate', ({ params }) => {
    const talent = readTalent(String(params.talentId));
    if (!talent) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (talent.operationalStatus !== 'SUSPENDED' && talent.operationalStatus !== 'INACTIVE') {
      return HttpResponse.json({ message: 'talent:validation.lifecycleInvalid' }, { status: 422 });
    }
    talent.operationalStatus = 'ACTIVE';
    talent.updatedAt = Date.now();

    return HttpResponse.json({
      data: toTalentDetail(talent),
    });
  }),

  http.post('*/admin/talents/:talentId/deactivate', ({ params }) => {
    const talent = readTalent(String(params.talentId));
    if (!talent) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (talent.operationalStatus !== 'ACTIVE' && talent.operationalStatus !== 'SUSPENDED') {
      return HttpResponse.json({ message: 'talent:validation.lifecycleInvalid' }, { status: 422 });
    }
    talent.operationalStatus = 'INACTIVE';
    talent.updatedAt = Date.now();

    return HttpResponse.json({
      data: toTalentDetail(talent),
    });
  }),

  http.post('*/admin/talents/:talentId/archive', ({ params }) => {
    const talent = readTalent(String(params.talentId));
    if (!talent) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (talent.operationalStatus !== 'INACTIVE') {
      return HttpResponse.json({ message: 'talent:validation.lifecycleInvalid' }, { status: 422 });
    }
    talent.operationalStatus = 'ARCHIVED';
    talent.updatedAt = Date.now();

    return HttpResponse.json({
      data: toTalentDetail(talent),
    });
  }),

  http.get('*/admin/talent-groups', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const status = searchParams.get('status');
    const containsTalentId = searchParams.get('containsTalentId');
    const search = searchParams.get('search');

    let rows = [...talentGroups];
    const managedGroupIds = getManagedGroupScopeIds();

    if (!status) {
      rows = rows.filter((item) => item.status !== 'ARCHIVED');
    } else {
      rows = rows.filter((item) => item.status === status);
    }

    if (managedGroupIds !== null) {
      rows = rows.filter((item) => managedGroupIds.has(item.id));
    }

    if (containsTalentId) {
      const relatedGroupIds = new Set(
        memberships
          .filter(
            (membership) =>
              membership.talentId === containsTalentId && membership.membershipStatus !== 'REMOVED',
          )
          .map((membership) => membership.groupId),
      );
      rows = rows.filter((group) => relatedGroupIds.has(group.id));
    }

    if (search) {
      rows = rows.filter(
        (group) =>
          toPrefixMatch(group.groupCode, search) ||
          toPrefixMatch(group.name, search) ||
          (group.shortName ? toPrefixMatch(group.shortName, search) : false),
      );
    }

    rows = sortTalentGroups(rows, searchParams.get('sortBy'), searchParams.get('sortDirection'));
    const paged = paginate(rows.map(toGroupListItem), searchParams);
    return HttpResponse.json(paged);
  }),

  http.get('*/admin/talent-groups/by-talent/:talentId', ({ params, request }) => {
    const talentId = String(params.talentId);
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const status = searchParams.get('status');

    let rows = memberships
      .filter(
        (membership) =>
          membership.talentId === talentId && membership.membershipStatus !== 'REMOVED',
      )
      .map((membership) => {
        const group = readGroup(membership.groupId);
        return group ? toByTalentItem(group, membership) : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const managedGroupIds = getManagedGroupScopeIds();

    if (managedGroupIds !== null) {
      rows = rows.filter((item) => managedGroupIds.has(item.groupId));
    }

    if (status) {
      rows = rows.filter((item) => item.status === status);
    }

    rows = sortTalentGroups(rows, searchParams.get('sortBy'), searchParams.get('sortDirection'));
    const paged = paginate(rows, searchParams);
    return HttpResponse.json(paged);
  }),

  http.post('*/admin/talent-groups', async ({ request }) => {
    const body = await parseJsonBody(request);
    groupSeed += 1;

    const nextRecord: TalentGroupRecord = {
      id: `group-${groupSeed}`,
      groupCode: providedOrGeneratedFixtureCode(
        body.groupCode,
        generatedFixtureCode('TG', groupSeed),
      ),
      name: String(body.name ?? `Group ${groupSeed}`),
      shortName:
        body.shortName === null || body.shortName === undefined ? null : String(body.shortName),
      status: 'ACTIVE',
      displayOrder:
        typeof body.displayOrder === 'number' || typeof body.displayOrder === 'string'
          ? Number(body.displayOrder)
          : 0,
      description:
        body.description === null || body.description === undefined
          ? null
          : String(body.description),
      externalRef:
        body.externalRef === null || body.externalRef === undefined
          ? null
          : String(body.externalRef),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    talentGroups.push(nextRecord);

    return HttpResponse.json({
      data: toGroupDetail(nextRecord),
    });
  }),

  http.get('*/admin/talent-groups/:groupId', ({ params }) => {
    const groupId = String(params.groupId);
    const denied = denyUnmanagedGroup(groupId);
    if (denied) {
      return denied;
    }

    const group = readGroup(groupId);
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({
      data: toGroupDetail(group),
    });
  }),

  http.get('*/admin/talent-groups/:groupId/members', ({ params, request }) => {
    const groupId = String(params.groupId);
    const denied = denyUnmanagedGroup(groupId);
    if (denied) {
      return denied;
    }

    const group = readGroup(groupId);
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const url = new URL(request.url);
    const rows = memberships
      .filter(
        (membership) =>
          membership.groupId === group.id && membership.membershipStatus !== 'REMOVED',
      )
      .sort(
        (left, right) => left.lineupOrder - right.lineupOrder || left.id.localeCompare(right.id),
      )
      .map(toMembershipItem);

    const paged = paginate(rows, url.searchParams);
    return HttpResponse.json(paged);
  }),

  http.get('*/admin/talent-groups/:groupId/manager-assignments', ({ params }) => {
    const groupId = String(params.groupId);
    const denied = denyUnmanagedGroup(groupId);
    if (denied) {
      return denied;
    }

    const group = readGroup(groupId);
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const rows = managerAssignments
      .filter((assignment) => assignment.groupId === group.id && assignment.status === 'ACTIVE')
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
      .map(toManagerAssignmentItem);

    return HttpResponse.json({ data: rows });
  }),

  http.patch('*/admin/talent-groups/:groupId', async ({ params, request }) => {
    const group = readGroup(String(params.groupId));
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    if (typeof body.name === 'string') {
      group.name = body.name;
    }
    if ('shortName' in body) {
      group.shortName = body.shortName === null ? null : String(body.shortName);
    }
    if ('description' in body) {
      group.description = body.description === null ? null : String(body.description);
    }
    if ('displayOrder' in body) {
      group.displayOrder = Number(body.displayOrder);
    }
    if ('externalRef' in body) {
      group.externalRef = body.externalRef === null ? null : String(body.externalRef);
    }
    group.updatedAt = Date.now();

    return HttpResponse.json({
      data: toGroupDetail(group),
    });
  }),

  http.post('*/admin/talent-groups/:groupId/activate', ({ params }) => {
    const group = readGroup(String(params.groupId));
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (group.status !== 'INACTIVE') {
      return HttpResponse.json(
        { message: 'talent-group:validation.lifecycleInvalid' },
        { status: 422 },
      );
    }
    group.status = 'ACTIVE';
    group.updatedAt = Date.now();

    return HttpResponse.json({
      data: toGroupDetail(group),
    });
  }),

  http.post('*/admin/talent-groups/:groupId/deactivate', ({ params }) => {
    const group = readGroup(String(params.groupId));
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (group.status !== 'ACTIVE') {
      return HttpResponse.json(
        { message: 'talent-group:validation.lifecycleInvalid' },
        { status: 422 },
      );
    }
    group.status = 'INACTIVE';
    group.updatedAt = Date.now();

    return HttpResponse.json({
      data: toGroupDetail(group),
    });
  }),

  http.post('*/admin/talent-groups/:groupId/archive', ({ params }) => {
    const group = readGroup(String(params.groupId));
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (group.status !== 'INACTIVE') {
      return HttpResponse.json(
        { message: 'talent-group:validation.lifecycleInvalid' },
        { status: 422 },
      );
    }
    group.status = 'ARCHIVED';
    group.updatedAt = Date.now();

    return HttpResponse.json({
      data: toGroupDetail(group),
    });
  }),

  http.post('*/admin/talent-groups/:groupId/members', async ({ params, request }) => {
    const group = readGroup(String(params.groupId));
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (group.status !== 'ACTIVE') {
      return HttpResponse.json(
        { message: 'talent-group:validation.groupMustBeActive' },
        { status: 422 },
      );
    }

    const body = await parseJsonBody(request);
    const talentId = String(body.talentId ?? '');
    const lineupOrder = Number(body.lineupOrder);
    if (!talentId || !Number.isInteger(lineupOrder) || lineupOrder < 0) {
      return HttpResponse.json({ message: 'talent-group:validation.required' }, { status: 422 });
    }

    const sameGroupMemberships = memberships.filter(
      (membership) => membership.groupId === group.id && membership.membershipStatus !== 'REMOVED',
    );
    if (sameGroupMemberships.some((membership) => membership.talentId === talentId)) {
      return HttpResponse.json(
        { message: 'talent-group:validation.duplicateMembership' },
        { status: 422 },
      );
    }
    if (sameGroupMemberships.some((membership) => membership.lineupOrder === lineupOrder)) {
      return HttpResponse.json(
        { message: 'talent-group:validation.duplicateLineupOrder' },
        { status: 422 },
      );
    }

    membershipSeed += 1;
    const nextMembership: TalentGroupMembershipRecord = {
      id: `membership-${membershipSeed}`,
      groupId: group.id,
      talentId,
      membershipStatus: 'ACTIVE',
      lineupOrder,
      joinedAt: Date.now(),
      leftAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    memberships.push(nextMembership);

    return HttpResponse.json({
      data: toMembershipItem(nextMembership),
    });
  }),

  http.post('*/admin/talent-groups/:groupId/manager-assignments', async ({ params, request }) => {
    const group = readGroup(String(params.groupId));
    if (!group) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (group.status !== 'ACTIVE') {
      return HttpResponse.json(
        { message: 'talent-group:validation.groupMustBeActive' },
        { status: 422 },
      );
    }

    const body = await parseJsonBody(request);
    const managerEmploymentProfileId = String(body.managerEmploymentProfileId ?? '');
    const managerRef = toEmploymentProfileRef(managerEmploymentProfileId);
    if (!managerRef || managerRef.status !== 'ACTIVE') {
      return HttpResponse.json(
        { message: 'talent-group:validation.managerEmploymentProfileInvalid' },
        { status: 422 },
      );
    }
    if (
      managerAssignments.some(
        (assignment) =>
          assignment.groupId === group.id &&
          assignment.managerEmploymentProfileId === managerEmploymentProfileId &&
          assignment.status === 'ACTIVE',
      )
    ) {
      return HttpResponse.json(
        { message: 'talent-group:validation.managerAssignmentDuplicate' },
        { status: 409 },
      );
    }

    managerAssignmentSeed += 1;
    const nextAssignment: TalentGroupManagerAssignmentRecord = {
      id: `manager-assignment-${managerAssignmentSeed}`,
      groupId: group.id,
      managerEmploymentProfileId,
      role: 'MANAGER',
      effectiveFrom: Date.now(),
      effectiveTo: null,
      status: 'ACTIVE',
      isPrimary: !managerAssignments.some(
        (assignment) => assignment.groupId === group.id && assignment.status === 'ACTIVE',
      ),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    managerAssignments.push(nextAssignment);

    return HttpResponse.json({ data: toManagerAssignmentItem(nextAssignment) });
  }),

  http.post(
    '*/admin/talent-groups/:groupId/manager-assignments/:assignmentId/revoke',
    ({ params }) => {
      const group = readGroup(String(params.groupId));
      const assignment = readManagerAssignment(String(params.assignmentId));
      if (!group || !assignment || assignment.groupId !== group.id) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (assignment.status !== 'ACTIVE') {
        return HttpResponse.json(
          { message: 'talent-group:validation.managerAssignmentInactive' },
          { status: 422 },
        );
      }
      assignment.status = 'INACTIVE';
      assignment.effectiveTo = Date.now();
      assignment.updatedAt = Date.now();

      return HttpResponse.json({ data: toManagerAssignmentItem(assignment) });
    },
  ),

  http.patch('*/admin/talent-groups/members/:membershipId/lineup', async ({ params, request }) => {
    const membership = readMembership(String(params.membershipId));
    if (!membership) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (membership.membershipStatus === 'REMOVED') {
      return HttpResponse.json(
        { message: 'talent-group:validation.membershipRemoved' },
        { status: 422 },
      );
    }

    const group = readGroup(membership.groupId);
    if (!group || group.status === 'ARCHIVED') {
      return HttpResponse.json(
        { message: 'talent-group:validation.groupArchived' },
        { status: 422 },
      );
    }

    const body = await parseJsonBody(request);
    const nextLineupOrder = Number(body.newLineupOrder);
    if (!Number.isInteger(nextLineupOrder) || nextLineupOrder < 0) {
      return HttpResponse.json(
        { message: 'talent-group:validation.invalidLineupOrder' },
        { status: 422 },
      );
    }

    const hasDuplicate = memberships.some(
      (item) =>
        item.groupId === membership.groupId &&
        item.id !== membership.id &&
        item.membershipStatus !== 'REMOVED' &&
        item.lineupOrder === nextLineupOrder,
    );
    if (hasDuplicate) {
      return HttpResponse.json(
        { message: 'talent-group:validation.duplicateLineupOrder' },
        { status: 422 },
      );
    }

    membership.lineupOrder = nextLineupOrder;
    membership.updatedAt = Date.now();

    return HttpResponse.json({
      data: toMembershipItem(membership),
    });
  }),

  http.post('*/admin/talent-groups/members/:membershipId/deactivate', ({ params }) => {
    const membership = readMembership(String(params.membershipId));
    if (!membership) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (membership.membershipStatus !== 'ACTIVE') {
      return HttpResponse.json(
        { message: 'talent-group:validation.membershipLifecycleInvalid' },
        { status: 422 },
      );
    }

    membership.membershipStatus = 'INACTIVE';
    membership.leftAt = Date.now();
    membership.updatedAt = Date.now();

    return HttpResponse.json({
      data: toMembershipItem(membership),
    });
  }),

  http.post('*/admin/talent-groups/members/:membershipId/reactivate', ({ params }) => {
    const membership = readMembership(String(params.membershipId));
    if (!membership) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (membership.membershipStatus !== 'INACTIVE') {
      return HttpResponse.json(
        { message: 'talent-group:validation.membershipLifecycleInvalid' },
        { status: 422 },
      );
    }

    membership.membershipStatus = 'ACTIVE';
    membership.leftAt = null;
    membership.updatedAt = Date.now();

    return HttpResponse.json({
      data: toMembershipItem(membership),
    });
  }),

  http.post('*/admin/talent-groups/members/:membershipId/remove', ({ params }) => {
    const membership = readMembership(String(params.membershipId));
    if (!membership) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (membership.membershipStatus === 'REMOVED') {
      return HttpResponse.json(
        { message: 'talent-group:validation.membershipLifecycleInvalid' },
        { status: 422 },
      );
    }

    membership.membershipStatus = 'REMOVED';
    membership.leftAt = Date.now();
    membership.updatedAt = Date.now();

    return HttpResponse.json({
      data: toMembershipItem(membership),
    });
  }),
];
