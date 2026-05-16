import { expect, test } from '@playwright/test';

type RevenueEntryStatus = 'DRAFT' | 'FINALIZED' | 'RECONCILED' | 'VOIDED' | 'ARCHIVED';

type RevenueEntryRecord = {
  id: string;
  revenueEntryCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId: string | null;
  attributionEventId: string | null;
  revenueKind: 'PLATFORM_LIVESTREAM';
  entrySource: 'MANUAL';
  status: RevenueEntryStatus;
  currencyCode: string;
  recognizedAmount: number;
  recognizedAt: number;
  finalizedAt: number | null;
  reconciledAt: number | null;
  voidedAt: number | null;
  reconciliationReference: string | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

const toListItem = (record: RevenueEntryRecord) => ({
  id: record.id,
  revenueEntryCode: record.revenueEntryCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  attributionPlatformAccountId: record.attributionPlatformAccountId,
  attributionEventId: record.attributionEventId,
  revenueKind: record.revenueKind,
  entrySource: record.entrySource,
  status: record.status,
  currencyCode: record.currencyCode,
  recognizedAmount: record.recognizedAmount,
  recognizedAt: record.recognizedAt,
  createdAt: record.createdAt,
});

const generatedMonthCode = (prefix: string, timestamp: number, seed: number): string => {
  const date = new Date(timestamp);
  const month = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${month}-${String(seed).padStart(6, '0')}`;
};

test('wave 8 Revenue Ledger critical flow: create, open detail, finalize', async ({ page }) => {
  let revenueCounter = 80;
  const recognizedAt = Date.now() - 86_400_000;
  const entries: RevenueEntryRecord[] = [];

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
              legalName: 'Mina Le',
              displayShortName: 'Mina',
              talentOrigin: 'EXTERNAL',
              operationalStatus: 'ACTIVE',
              commercialParticipationStatus: 'ALLOWED',
              livestreamEligible: true,
              eventEligible: true,
              createdAt: recognizedAt,
              updatedAt: recognizedAt,
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

    if (method === 'GET' && url.pathname.endsWith('/admin/platform-accounts')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'platform-001',
              accountCode: 'PA-000001',
              platform: 'TIKTOK',
              platformSurfaceType: 'LIVE',
              displayName: 'Mina Live',
              ownerKind: 'TALENT',
              ownerOrgUnitId: null,
              ownerTalentId: 'talent-001',
              ownerTalentGroupId: null,
              operationalStatus: 'ACTIVE',
              livestreamEnabled: true,
              contentPublishingEnabled: true,
              monetizationEnabled: true,
              createdAt: recognizedAt,
              updatedAt: recognizedAt,
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/admin/revenue-entries**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/revenue-entries')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: entries.filter((item) => item.status !== 'ARCHIVED').map(toListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/revenue-entries')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      revenueCounter += 1;
      const nextEntry: RevenueEntryRecord = {
        id: `revenue-entry-${revenueCounter}`,
        revenueEntryCode: String(
          payload.revenueEntryCode ??
            generatedMonthCode('REV', Number(payload.recognizedAt ?? recognizedAt), revenueCounter),
        ),
        title: String(payload.title ?? `Revenue ${revenueCounter}`),
        subjectTalentId: String(payload.subjectTalentId ?? 'talent-001'),
        attributionPlatformAccountId:
          typeof payload.attributionPlatformAccountId === 'string'
            ? payload.attributionPlatformAccountId
            : null,
        attributionEventId:
          typeof payload.attributionEventId === 'string' ? payload.attributionEventId : null,
        revenueKind: 'PLATFORM_LIVESTREAM',
        entrySource: 'MANUAL',
        status: 'DRAFT',
        currencyCode: String(payload.currencyCode ?? 'VND'),
        recognizedAmount: Number(payload.recognizedAmount ?? 1),
        recognizedAt: Number(payload.recognizedAt ?? recognizedAt),
        finalizedAt: null,
        reconciledAt: null,
        voidedAt: null,
        reconciliationReference: null,
        description: typeof payload.description === 'string' ? payload.description : null,
        externalRef: typeof payload.externalRef === 'string' ? payload.externalRef : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      entries.unshift(nextEntry);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: nextEntry }),
      });
      return;
    }

    const finalizeMatch = pathname.match(/\/admin\/revenue-entries\/([^/]+)\/finalize$/);
    if (method === 'POST' && finalizeMatch) {
      const record = entries.find((item) => item.id === finalizeMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }
      record.status = 'FINALIZED';
      record.finalizedAt = Date.now();
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/revenue-entries\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const record = entries.find((item) => item.id === detailMatch[1]);
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
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/revenue-entries');
  await expect(page.getByRole('heading', { name: 'Revenue Ledger' })).toBeVisible();
  await page.getByRole('button', { name: 'Create revenue entry' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create revenue entry' }) })
    .first();

  await expect(createSurface.getByLabel('Revenue entry code')).toHaveCount(0);
  await expect(
    createSurface.getByText('Revenue entry code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Title').fill('Wave 8 revenue');
  await createSurface
    .locator('[data-picker-id="revenue-ledger-subject-talent"]')
    .getByRole('button', { name: /Mina/ })
    .click();
  await createSurface
    .locator('[data-picker-id="revenue-ledger-platform-account"]')
    .getByRole('button', { name: /Mina Live/ })
    .click();
  await createSurface.getByLabel('Recognized amount').fill('12.34');
  await createSurface.getByLabel('Recognized at').fill(String(recognizedAt));
  await createSurface.getByRole('button', { name: 'Create' }).click();

  const createdRevenueCode = generatedMonthCode('REV', recognizedAt, 81);
  await expect(page.getByText(createdRevenueCode)).toBeVisible();
  await page
    .locator('tr', { hasText: createdRevenueCode })
    .getByRole('button', { name: 'Open' })
    .click();

  await expect(page).toHaveURL(/\/revenue-entries\/revenue-entry-\d+$/);
  await expect(page.getByText('Revenue Ledger actions')).toBeVisible();
  await page.getByRole('button', { name: 'Finalize' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText('Finalized').first()).toBeVisible();
});
