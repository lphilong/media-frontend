import { http, HttpResponse } from 'msw';

import type {
  PeopleReadinessIssue,
  PeopleReadinessIssueList,
  PeopleReadinessSummary,
} from '@modules/people-readiness/api/people-readiness.api';

const generatedAt = Date.parse('2026-06-07T02:00:00.000Z');

const initialIssues: PeopleReadinessIssue[] = [
  {
    id: 'EMPLOYMENT_PROFILE_MISSING_ORG_UNIT:EMPLOYMENT_PROFILE:ep-no-org',
    issueCode: 'EMPLOYMENT_PROFILE_MISSING_ORG_UNIT',
    category: 'ORGUNIT_PARTICIPATION',
    severity: 'BLOCKER',
    primaryEntityType: 'EMPLOYMENT_PROFILE',
    primaryEntity: {
      entityType: 'EMPLOYMENT_PROFILE',
      id: 'ep-no-org',
      displayName: 'No Org Person',
      code: 'EP-NO-ORG',
      lifecycleStatus: 'ACTIVE',
      adminRepairTarget: '/employment-profiles/ep-no-org',
    },
    relatedEntities: [],
    summary: 'EmploymentProfile has no OrgUnit assignment.',
    repairTarget: {
      targetType: 'EMPLOYMENT_PROFILE',
      targetId: 'ep-no-org',
      suggestedSurface: '/employment-profiles/ep-no-org',
      suggestedAction: 'Review EmploymentProfile readiness',
    },
    generatedAt,
    isBlockingForNewOperations: true,
    metadata: {
      unsafePhone: '0900000000',
      salaryAmount: 1000000,
    },
  },
  {
    id: 'SELF_SERVICE_PROFILE_NOT_ACTIVE:EMPLOYMENT_PROFILE:ep-inactive',
    issueCode: 'SELF_SERVICE_PROFILE_NOT_ACTIVE',
    category: 'SELF_SERVICE_READY',
    severity: 'BLOCKER',
    primaryEntityType: 'EMPLOYMENT_PROFILE',
    primaryEntity: {
      entityType: 'EMPLOYMENT_PROFILE',
      id: 'ep-inactive',
      displayName: 'Inactive Person',
      code: 'EP-INACTIVE',
      lifecycleStatus: 'SUSPENDED',
      adminRepairTarget: '/employment-profiles/ep-inactive',
    },
    relatedEntities: [
      {
        entityType: 'USER',
        id: 'user-disabled',
        displayName: 'Disabled Account',
        status: 'DISABLED',
        adminRepairTarget: '/users/user-disabled',
      },
    ],
    summary: 'Linked EmploymentProfile is not active for Self-Service readiness.',
    repairTarget: {
      targetType: 'EMPLOYMENT_PROFILE',
      targetId: 'ep-inactive',
      suggestedSurface: '/employment-profiles/ep-inactive',
      suggestedAction: 'Review EmploymentProfile readiness',
    },
    generatedAt,
    isBlockingForNewOperations: true,
  },
  {
    id: 'ORGUNIT_MANAGER_ASSIGNMENT_MANAGER_NOT_LOGIN_READY:ORG_UNIT_MANAGER_ASSIGNMENT:ou-assignment',
    issueCode: 'ORGUNIT_MANAGER_ASSIGNMENT_MANAGER_NOT_LOGIN_READY',
    category: 'MANAGER_ASSIGNMENT_READY',
    severity: 'BLOCKER',
    primaryEntityType: 'ORG_UNIT_MANAGER_ASSIGNMENT',
    primaryEntity: {
      entityType: 'ORG_UNIT_MANAGER_ASSIGNMENT',
      id: 'ou-assignment',
      displayName: 'UNIT_MANAGER assignment',
      status: 'ACTIVE',
    },
    relatedEntities: [
      {
        entityType: 'ORG_UNIT',
        id: 'ou-ready',
        displayName: 'Ready Unit',
        code: 'OU-READY',
        status: 'ACTIVE',
        adminRepairTarget: '/org-units/ou-ready',
      },
      {
        entityType: 'EMPLOYMENT_PROFILE',
        id: 'ep-manager-no-login',
        displayName: 'Manager No Login',
        code: 'EP-MANAGER',
        lifecycleStatus: 'ACTIVE',
        adminRepairTarget: '/employment-profiles/ep-manager-no-login',
      },
    ],
    summary: 'Active/effective manager assignment manager lacks an active linked account.',
    repairTarget: {
      targetType: 'EMPLOYMENT_PROFILE',
      targetId: 'ep-manager-no-login',
      suggestedSurface: '/employment-profiles/ep-manager-no-login',
      suggestedAction: 'Review manager account linkage',
    },
    generatedAt,
    isBlockingForNewOperations: true,
  },
  {
    id: 'ACTIVE_USER_WITHOUT_EMPLOYMENT_PROFILE:USER:user-orphan',
    issueCode: 'ACTIVE_USER_WITHOUT_EMPLOYMENT_PROFILE',
    category: 'ACCOUNT_LOGIN_READY',
    severity: 'WARNING',
    primaryEntityType: 'USER',
    primaryEntity: {
      entityType: 'USER',
      id: 'user-orphan',
      displayName: 'Orphan Account',
      status: 'ACTIVE',
      adminRepairTarget: '/users/user-orphan',
    },
    relatedEntities: [],
    summary: 'Active account has no non-archived linked EmploymentProfile.',
    repairTarget: {
      targetType: 'USER',
      targetId: 'user-orphan',
      suggestedSurface: '/users/user-orphan',
      suggestedAction: 'Review account and EmploymentProfile linkage',
    },
    generatedAt,
    isBlockingForNewOperations: false,
  },
  {
    id: 'TALENTGROUP_HAS_NO_OPERATIONAL_MEMBERS:TALENT_GROUP:tg-broken',
    issueCode: 'TALENTGROUP_HAS_NO_OPERATIONAL_MEMBERS',
    category: 'TALENTGROUP_MEMBER_LINKAGE',
    severity: 'WARNING',
    primaryEntityType: 'TALENT_GROUP',
    primaryEntity: {
      entityType: 'TALENT_GROUP',
      id: 'tg-broken',
      displayName: 'Broken Group',
      code: 'TG-BROKEN',
      status: 'ACTIVE',
      adminRepairTarget: '/talent-groups/tg-broken',
    },
    relatedEntities: [],
    summary: 'Active TalentGroup has no active operational EmploymentProfile members.',
    repairTarget: {
      targetType: 'TALENT_GROUP',
      targetId: 'tg-broken',
      suggestedSurface: '/talent-groups/tg-broken',
      suggestedAction: 'Review TalentGroup membership and links',
    },
    generatedAt,
    isBlockingForNewOperations: true,
  },
];

let issues = [...initialIssues];

export const peopleReadinessRequestLog: string[] = [];

const countBy = <TKey extends string>(
  rows: readonly PeopleReadinessIssue[],
  readKey: (issue: PeopleReadinessIssue) => TKey,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  rows.forEach((issue) => {
    const key = readKey(issue);
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
};

const buildSummary = (): PeopleReadinessSummary => ({
  totalIssueCount: issues.length,
  countsByCategory: countBy(issues, (issue) => issue.category),
  countsBySeverity: countBy(issues, (issue) => issue.severity),
  countsByIssueCode: countBy(issues, (issue) => issue.issueCode),
  generatedAt,
  dataCoverage: {
    exactForSupportedIssueCodes: true,
    coverageNotes: ['MSW fixture mirrors the accepted B1 People Readiness DTO shape.'],
  },
});

const parseLimit = (value: string | null): number => {
  const parsed = Number(value ?? 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 100 ? parsed : 10;
};

const parseCursor = (value: string | null): number => {
  if (!value) {
    return 0;
  }
  return value === 'opaque-cursor-2' ? 2 : 0;
};

const encodeCursor = (offset: number): string | null => (offset < issues.length ? `opaque-cursor-${offset}` : null);

const filterIssues = (url: URL): PeopleReadinessIssue[] => {
  const category = url.searchParams.get('category');
  const issueCode = url.searchParams.get('issueCode');
  const severity = url.searchParams.get('severity');
  const entityType = url.searchParams.get('entityType');

  return issues.filter(
    (issue) =>
      (!category || issue.category === category) &&
      (!issueCode || issue.issueCode === issueCode) &&
      (!severity || issue.severity === severity) &&
      (!entityType || issue.primaryEntityType === entityType),
  );
};

export const resetPeopleReadinessMockData = (): void => {
  issues = [...initialIssues];
  peopleReadinessRequestLog.length = 0;
};

export const setPeopleReadinessIssues = (nextIssues: PeopleReadinessIssue[]): void => {
  issues = [...nextIssues];
};

export const peopleReadinessHandlers = [
  http.get('*/admin/people-readiness/summary', ({ request }) => {
    peopleReadinessRequestLog.push(request.url);
    return HttpResponse.json({ data: buildSummary() });
  }),
  http.get('*/admin/people-readiness/issues', ({ request }) => {
    peopleReadinessRequestLog.push(request.url);
    const url = new URL(request.url);
    const rows = filterIssues(url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const offset = parseCursor(url.searchParams.get('cursor'));
    const items = rows.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const result: PeopleReadinessIssueList = {
      items,
      nextCursor: nextOffset < rows.length ? encodeCursor(nextOffset) : null,
      totalCount: rows.length,
      generatedAt,
      appliedFilters: {
        ...(url.searchParams.get('category')
          ? { category: url.searchParams.get('category') as never }
          : {}),
        ...(url.searchParams.get('issueCode')
          ? { issueCode: url.searchParams.get('issueCode') as never }
          : {}),
        ...(url.searchParams.get('severity')
          ? { severity: url.searchParams.get('severity') as never }
          : {}),
        ...(url.searchParams.get('entityType')
          ? { entityType: url.searchParams.get('entityType') as never }
          : {}),
      },
    };
    return HttpResponse.json({ data: result });
  }),
];
