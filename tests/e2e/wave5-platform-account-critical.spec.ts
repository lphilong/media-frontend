import { expect, test } from '@playwright/test';

type PlatformAccountStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type OwnerKind = 'ORG_UNIT' | 'TALENT' | 'TALENT_GROUP';

type PlatformAccountRecord = {
  id: string;
  accountCode: string;
  platform: string;
  platformSurfaceType: string;
  displayName: string;
  handle: string | null;
  externalPlatformId: string | null;
  profileUrl: string | null;
  ownerKind: OwnerKind;
  ownerOrgUnitId: string | null;
  ownerTalentId: string | null;
  ownerTalentGroupId: string | null;
  operationalStatus: PlatformAccountStatus;
  livestreamEnabled: boolean;
  contentPublishingEnabled: boolean;
  monetizationEnabled: boolean;
  createdAt: number;
  updatedAt: number;
};

const toListItem = (record: PlatformAccountRecord) => ({ ...record });
const toDetail = (record: PlatformAccountRecord) => ({
  ...record,
  description: null,
  externalRef: null,
});

const generatedCode = (prefix: string, seed: number): string =>
  `${prefix}-${String(seed).padStart(6, '0')}`;

test('wave 5 platform-account critical flow: create then deactivate', async ({ page }) => {
  let counter = 20;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const platformAccounts: PlatformAccountRecord[] = [
    {
      id: 'platform-001',
      accountCode: 'PA-000001',
      platform: 'YOUTUBE',
      platformSurfaceType: 'LIVESTREAM',
      displayName: 'Mina Live',
      handle: '@mina',
      externalPlatformId: null,
      profileUrl: null,
      ownerKind: 'TALENT',
      ownerOrgUnitId: null,
      ownerTalentId: 'talent-001',
      ownerTalentGroupId: null,
      operationalStatus: 'ACTIVE',
      livestreamEnabled: true,
      contentPublishingEnabled: true,
      monetizationEnabled: true,
      createdAt: now - 6_000,
      updatedAt: now - 5_000,
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
              id: 'talent-001',
              talentCode: 'TAL-000001',
              stageName: 'Mina',
              legalName: 'Minh An',
              displayShortName: 'Mina',
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

  await page.route('**/admin/platform-accounts**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/platform-accounts')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: platformAccounts
            .filter((item) => item.operationalStatus !== 'ARCHIVED')
            .map(toListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/platform-accounts')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      expect(payload).not.toHaveProperty('accountCode');
      counter += 1;
      const nextRecord: PlatformAccountRecord = {
        id: `platform-${counter}`,
        accountCode: String(payload.accountCode ?? generatedCode('PA', counter)),
        platform: String(payload.platform ?? 'YOUTUBE'),
        platformSurfaceType: String(payload.platformSurfaceType ?? 'LIVESTREAM'),
        displayName: String(payload.displayName ?? `Platform ${counter}`),
        handle: payload.handle === null ? null : String(payload.handle ?? ''),
        externalPlatformId: null,
        profileUrl: null,
        ownerKind: String(payload.ownerKind ?? 'ORG_UNIT') as OwnerKind,
        ownerOrgUnitId: typeof payload.ownerOrgUnitId === 'string' ? payload.ownerOrgUnitId : null,
        ownerTalentId: typeof payload.ownerTalentId === 'string' ? payload.ownerTalentId : null,
        ownerTalentGroupId:
          typeof payload.ownerTalentGroupId === 'string' ? payload.ownerTalentGroupId : null,
        operationalStatus: 'ACTIVE',
        livestreamEnabled: Boolean(payload.livestreamEnabled),
        contentPublishingEnabled: Boolean(payload.contentPublishingEnabled),
        monetizationEnabled: Boolean(payload.monetizationEnabled),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      platformAccounts.push(nextRecord);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(nextRecord) }),
      });
      return;
    }

    const deactivateMatch = pathname.match(/\/admin\/platform-accounts\/([^/]+)\/deactivate$/);
    if (method === 'POST' && deactivateMatch) {
      const record = platformAccounts.find((item) => item.id === deactivateMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }

      record.operationalStatus = 'INACTIVE';
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(record) }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/platform-accounts');

  await expect(page.getByRole('heading', { name: 'Platform Accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create platform account' }) })
    .first();

  await expect(
    createSurface.getByText('Account code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Platform', { exact: true }).fill('YOUTUBE');
  await createSurface.getByLabel('Surface type').fill('LIVESTREAM');
  await createSurface.getByLabel('Display name').fill('Wave 5 Platform');
  await createSurface.getByLabel('Owner kind').selectOption('TALENT');
  await createSurface
    .locator('[data-picker-id="platform-account-owner-talent"]')
    .getByText('TAL-000001')
    .click();
  await createSurface.getByLabel('Handle').fill('@wave5');
  await createSurface.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('PA-000021')).toBeVisible();

  const createdRow = page.locator('tr', { hasText: 'PA-000021' });
  await createdRow.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByTestId('confirm-dialog-confirm').click();

  await expect(createdRow.getByText(/inactive/i)).toBeVisible();
});
