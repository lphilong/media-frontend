import { expect, test } from '@playwright/test';

type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'ARCHIVED';
type ContractStatus = 'NONE' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

type EmploymentProfileRecord = {
  id: string;
  employeeCode: string;
  legalName: string;
  displayName: string;
  employmentKind: string;
  jobTitle: string;
  titleDescription: string | null;
  externalRef: string | null;
  orgUnitId: string;
  managerEmploymentProfileId: string | null;
  linkedUserId: string | null;
  employmentStatus: EmploymentStatus;
  contractStatus: ContractStatus;
  employmentStartDate: string;
  employmentEndDate: string | null;
  createdAt: number;
  updatedAt: number;
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
    managerEmploymentProfileId: record.managerEmploymentProfileId,
    linkedUserId: record.linkedUserId,
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
    titleDescription: record.titleDescription,
    externalRef: record.externalRef,
    orgUnitId: record.orgUnitId,
    managerEmploymentProfileId: record.managerEmploymentProfileId,
    linkedUserId: record.linkedUserId,
    employmentStatus: record.employmentStatus,
    contractStatus: record.contractStatus,
    employmentStartDate: record.employmentStartDate,
    employmentEndDate: record.employmentEndDate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const toDirectReportListItem = (record: EmploymentProfileRecord) => {
  return {
    id: record.id,
    employeeCode: record.employeeCode,
    displayName: record.displayName,
    employmentStatus: record.employmentStatus,
    contractStatus: record.contractStatus,
    orgUnitId: record.orgUnitId,
    managerEmploymentProfileId: record.managerEmploymentProfileId,
  };
};

test('wave 3 employment-profile critical flow: list to detail with direct reports', async ({
  page,
}) => {
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const profiles: EmploymentProfileRecord[] = [
    {
      id: 'ep-100',
      employeeCode: 'EP-000100',
      legalName: 'Alice Operator',
      displayName: 'Alice',
      employmentKind: 'FULL_TIME',
      jobTitle: 'Lead',
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
      updatedAt: now - 5_000,
    },
    {
      id: 'ep-200',
      employeeCode: 'EP-000200',
      legalName: 'Bao Specialist',
      displayName: 'Bao',
      employmentKind: 'FULL_TIME',
      jobTitle: 'Specialist',
      titleDescription: null,
      externalRef: null,
      orgUnitId: 'ou-sales',
      managerEmploymentProfileId: 'ep-100',
      linkedUserId: null,
      employmentStatus: 'ACTIVE',
      contractStatus: 'PENDING_SIGNATURE',
      employmentStartDate: '2025-01-01',
      employmentEndDate: null,
      createdAt: now - 4_000,
      updatedAt: now - 3_000,
    },
    {
      id: 'ep-201',
      employeeCode: 'EP-000201',
      legalName: 'Chau Specialist',
      displayName: 'Chau',
      employmentKind: 'PART_TIME',
      jobTitle: 'Coordinator',
      titleDescription: null,
      externalRef: null,
      orgUnitId: 'ou-sales',
      managerEmploymentProfileId: 'ep-100',
      linkedUserId: null,
      employmentStatus: 'ON_LEAVE',
      contractStatus: 'ACTIVE',
      employmentStartDate: '2025-02-01',
      employmentEndDate: null,
      createdAt: now - 3_500,
      updatedAt: now - 2_500,
    },
  ];

  await page.route('**/admin/employment-profiles**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (method !== 'GET') {
      await route.fallback();
      return;
    }

    if (pathname.endsWith('/admin/employment-profiles')) {
      const statusFilter = url.searchParams.get('employmentStatus');
      const data = profiles
        .filter((profile) => !statusFilter || profile.employmentStatus === statusFilter)
        .map(toEmploymentListItem);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      });
      return;
    }

    const directReportsMatch = pathname.match(
      /\/admin\/employment-profiles\/([^/]+)\/direct-reports$/,
    );
    if (directReportsMatch) {
      const managerId = directReportsMatch[1];
      const data = profiles
        .filter(
          (profile) =>
            profile.managerEmploymentProfileId === managerId &&
            profile.employmentStatus !== 'ARCHIVED',
        )
        .map(toDirectReportListItem);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/employment-profiles\/([^/]+)$/);
    if (detailMatch) {
      const profileId = detailMatch[1];
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toEmploymentDetail(profile) }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/employment-profiles?employmentStatus=ACTIVE');
  await expect(page.locator('tr', { hasText: 'EP-000100' })).toBeVisible();

  const targetRow = page.locator('tr', { hasText: 'EP-000100' });
  await targetRow.getByRole('button').first().click();

  await expect(page).toHaveURL(/\/employment-profiles\/ep-100$/);
  await expect(page.getByText('EP-000100')).toBeVisible();
  await expect(page.getByText('EP-000200')).toBeVisible();
  await expect(page.getByText('EP-000201')).toBeVisible();

  await expect(
    page.locator(
      'a[href="/work-shifts?view=by-subject&subjectKind=EMPLOYMENT_PROFILE&subjectEmploymentProfileId=ep-100"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      'a[href="/events?view=by-assignment&assignmentKind=EMPLOYMENT_PROFILE&assignmentEmploymentProfileId=ep-100"]',
    ),
  ).toBeVisible();
});
