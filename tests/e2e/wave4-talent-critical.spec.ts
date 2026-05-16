import { expect, test } from '@playwright/test';

type TalentOperationalStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'ARCHIVED';

type TalentRecord = {
  id: string;
  talentCode: string;
  stageName: string;
  legalName: string;
  displayShortName: string | null;
  talentOrigin: string;
  operationalStatus: TalentOperationalStatus;
  managerEmploymentProfileId: string | null;
  linkedEmploymentProfileId: string | null;
  commercialParticipationStatus: string;
  livestreamEligible: boolean;
  eventEligible: boolean;
  createdAt: number;
  updatedAt: number;
};

const toTalentListItem = (record: TalentRecord) => {
  return {
    id: record.id,
    talentCode: record.talentCode,
    stageName: record.stageName,
    legalName: record.legalName,
    displayShortName: record.displayShortName,
    talentOrigin: record.talentOrigin,
    operationalStatus: record.operationalStatus,
    managerEmploymentProfileId: record.managerEmploymentProfileId,
    linkedEmploymentProfileId: record.linkedEmploymentProfileId,
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
    externalRef: null,
    profileSummary: null,
  };
};

const generatedCode = (prefix: string, seed: number): string =>
  `${prefix}-${String(seed).padStart(6, '0')}`;

test('wave 4 talent critical flow: create then deactivate', async ({ page }) => {
  let counter = 10;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const talents: TalentRecord[] = [
    {
      id: 'talent-001',
      talentCode: 'TAL-000001',
      stageName: 'Mina',
      legalName: 'Minh An',
      displayShortName: 'Mina',
      talentOrigin: 'INTERNAL',
      operationalStatus: 'ACTIVE',
      managerEmploymentProfileId: 'ep-001',
      linkedEmploymentProfileId: 'ep-002',
      commercialParticipationStatus: 'ALLOWED',
      livestreamEligible: true,
      eventEligible: true,
      createdAt: now - 6_000,
      updatedAt: now - 5_000,
    },
  ];

  await page.route('**/admin/talents**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/talents')) {
      const data = talents
        .filter((item) => item.operationalStatus !== 'ARCHIVED')
        .map(toTalentListItem);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      });
      return;
    }

    if (method === 'POST' && url.pathname.endsWith('/admin/talents')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      expect(payload).not.toHaveProperty('talentCode');
      counter += 1;
      const nextRecord: TalentRecord = {
        id: `talent-${counter}`,
        talentCode: String(payload.talentCode ?? generatedCode('TAL', counter)),
        stageName: String(payload.stageName ?? `Talent ${counter}`),
        legalName: String(payload.legalName ?? `Talent Legal ${counter}`),
        displayShortName: null,
        talentOrigin: String(payload.talentOrigin ?? 'INTERNAL'),
        operationalStatus: 'ACTIVE',
        managerEmploymentProfileId: null,
        linkedEmploymentProfileId: null,
        commercialParticipationStatus: String(payload.commercialParticipationStatus ?? 'ALLOWED'),
        livestreamEligible: Boolean(payload.livestreamEligible),
        eventEligible: Boolean(payload.eventEligible),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      talents.push(nextRecord);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toTalentDetail(nextRecord) }),
      });
      return;
    }

    if (method === 'POST' && /\/admin\/talents\/[^/]+\/deactivate$/.test(url.pathname)) {
      const id = url.pathname.split('/').at(-2);
      const record = talents.find((item) => item.id === id);
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
        body: JSON.stringify({ data: toTalentDetail(record) }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/talents');

  await expect(page.getByRole('heading', { name: 'Talents' })).toBeVisible();
  await page.getByRole('button', { name: 'Create Talent' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create Talent' }) })
    .first();

  await expect(
    createSurface.getByText('Talent code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Stage Name').fill('Wave 4 Talent');
  await createSurface.getByLabel('Legal Name').fill('Wave 4 Legal');
  await createSurface.getByLabel('Talent Origin').selectOption('INTERNAL');
  await createSurface.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('TAL-000011')).toBeVisible();

  const createdRow = page.locator('tr', { hasText: 'TAL-000011' });
  await createdRow.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByTestId('confirm-dialog-confirm').click();

  await expect(createdRow.getByText(/inactive/i)).toBeVisible();
});
