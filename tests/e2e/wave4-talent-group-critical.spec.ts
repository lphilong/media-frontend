import { expect, test } from '@playwright/test';

type TalentGroupStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type MembershipStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED';

type TalentGroupRecord = {
  id: string;
  groupCode: string;
  name: string;
  shortName: string | null;
  status: TalentGroupStatus;
  displayOrder: number;
  createdAt: number;
  updatedAt: number;
};

type MembershipRecord = {
  id: string;
  groupId: string;
  talentId: string;
  membershipStatus: MembershipStatus;
  lineupOrder: number;
  joinedAt: number;
  leftAt: number | null;
  createdAt: number;
  updatedAt: number;
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
    description: null,
    externalRef: null,
  };
};

const toMembershipItem = (record: MembershipRecord) => {
  return {
    id: record.id,
    groupId: record.groupId,
    talentId: record.talentId,
    membershipStatus: record.membershipStatus,
    lineupOrder: record.lineupOrder,
    joinedAt: record.joinedAt,
    leftAt: record.leftAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

test('wave 4 talent-group critical flow: detail roster and membership lifecycle', async ({
  page,
}) => {
  let membershipCounter = 50;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const groups: TalentGroupRecord[] = [
    {
      id: 'group-001',
      groupCode: 'TG-000001',
      name: 'A Team',
      shortName: 'ATeam',
      status: 'ACTIVE',
      displayOrder: 1,
      createdAt: now - 8_000,
      updatedAt: now - 7_000,
    },
  ];
  const memberships: MembershipRecord[] = [
    {
      id: 'membership-001',
      groupId: 'group-001',
      talentId: 'talent-001',
      membershipStatus: 'ACTIVE',
      lineupOrder: 1,
      joinedAt: now - 9_000,
      leftAt: null,
      createdAt: now - 9_000,
      updatedAt: now - 8_000,
    },
  ];

  await page.route('**/admin/talents**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/talents')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'talent-010',
              talentCode: 'TAL-000010',
              stageName: 'Talent Ten',
              legalName: 'Talent Ten Legal',
              displayShortName: 'Talent Ten',
              talentOrigin: 'INTERNAL',
              operationalStatus: 'ACTIVE',
              managerEmploymentProfileId: null,
              linkedEmploymentProfileId: null,
              commercialParticipationStatus: 'ALLOWED',
              livestreamEligible: true,
              eventEligible: true,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/admin/talent-groups**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/talent-groups')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: groups.map(toGroupListItem) }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/talent-groups\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const groupId = detailMatch[1];
      const record = groups.find((item) => item.id === groupId);
      if (!record) {
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
        body: JSON.stringify({ data: toGroupDetail(record) }),
      });
      return;
    }

    const membersMatch = pathname.match(/\/admin\/talent-groups\/([^/]+)\/members$/);
    if (method === 'GET' && membersMatch) {
      const groupId = membersMatch[1];
      const rows = memberships
        .filter((item) => item.groupId === groupId && item.membershipStatus !== 'REMOVED')
        .sort((a, b) => a.lineupOrder - b.lineupOrder)
        .map(toMembershipItem);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: rows }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/talent-groups/group-001/members')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      membershipCounter += 1;
      const record: MembershipRecord = {
        id: `membership-${membershipCounter}`,
        groupId: 'group-001',
        talentId: String(payload.talentId ?? `talent-${membershipCounter}`),
        membershipStatus: 'ACTIVE',
        lineupOrder: Number(payload.lineupOrder ?? 2),
        joinedAt: Date.now(),
        leftAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      memberships.push(record);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toMembershipItem(record) }),
      });
      return;
    }

    const deactivateMatch = pathname.match(/\/admin\/talent-groups\/members\/([^/]+)\/deactivate$/);
    if (method === 'POST' && deactivateMatch) {
      const membershipId = deactivateMatch[1];
      const record = memberships.find((item) => item.id === membershipId);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }

      record.membershipStatus = 'INACTIVE';
      record.leftAt = Date.now();
      record.updatedAt = Date.now();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toMembershipItem(record) }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/talent-groups');

  await expect(page.getByRole('heading', { name: 'Talent Groups' })).toBeVisible();
  const row = page.locator('tr', { hasText: 'TG-000001' });
  await row.getByRole('button', { name: 'Open' }).click();

  await expect(page).toHaveURL(/\/talent-groups\/group-001$/);
  await expect(page.getByText('talent-001')).toBeVisible();

  await page.getByRole('button', { name: 'Add Member' }).click();
  const addMemberSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Add Member' }) })
    .first();
  await addMemberSurface
    .locator('[data-picker-id="talent-group-member-talent"]')
    .getByText('TAL-000010')
    .click();
  await addMemberSurface.getByLabel('Lineup Order').fill('2');
  await addMemberSurface.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('talent-010')).toBeVisible();

  const addedMemberRow = page.locator('tr', { hasText: 'talent-010' });
  await addedMemberRow.getByRole('button', { name: 'Deactivate Member' }).click();
  await page.getByTestId('confirm-dialog-confirm').click();

  await expect(addedMemberRow.getByText(/inactive/i)).toBeVisible();
});
