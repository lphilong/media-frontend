import { expect, test } from '@playwright/test';

type TalentKpiStatus = 'DRAFT' | 'FINALIZED' | 'ARCHIVED';

type TalentKpiRecord = {
  id: string;
  kpiRecordCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId: string | null;
  attributionEventId: string | null;
  measurementSource: 'MANUAL';
  status: TalentKpiStatus;
  periodStartAt: number;
  periodEndAt: number;
  publishedAt: number | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type TalentKpiMetric = {
  id: string;
  metricCode: 'ENGAGEMENT_COUNT';
  numericValue: number;
  createdAt: number;
  updatedAt: number;
};

const toListItem = (record: TalentKpiRecord) => ({
  id: record.id,
  kpiRecordCode: record.kpiRecordCode,
  title: record.title,
  subjectTalentId: record.subjectTalentId,
  attributionPlatformAccountId: record.attributionPlatformAccountId,
  attributionEventId: record.attributionEventId,
  measurementSource: record.measurementSource,
  status: record.status,
  periodStartAt: record.periodStartAt,
  periodEndAt: record.periodEndAt,
  publishedAt: record.publishedAt,
  createdAt: record.createdAt,
});

const generatedMonthCode = (prefix: string, timestamp: number, seed: number): string => {
  const date = new Date(timestamp);
  const month = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${month}-${String(seed).padStart(6, '0')}`;
};

test('wave 8 Talent KPI critical flow: create, open detail, verify metrics, finalize', async ({
  page,
}) => {
  let kpiCounter = 80;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const records: TalentKpiRecord[] = [];
  const metricsByRecord = new Map<string, TalentKpiMetric[]>();

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

  await page.route('**/admin/talent-kpi-records**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/talent-kpi-records')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: records.filter((item) => item.status !== 'ARCHIVED').map(toListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/talent-kpi-records')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      kpiCounter += 1;
      const id = `talent-kpi-record-${kpiCounter}`;
      const nextRecord: TalentKpiRecord = {
        id,
        kpiRecordCode: String(
          payload.kpiRecordCode ??
            generatedMonthCode('KPI', Number(payload.periodStartAt ?? now - 1000), kpiCounter),
        ),
        title: String(payload.title ?? `KPI ${kpiCounter}`),
        subjectTalentId: String(payload.subjectTalentId ?? 'talent-001'),
        attributionPlatformAccountId:
          typeof payload.attributionPlatformAccountId === 'string'
            ? payload.attributionPlatformAccountId
            : null,
        attributionEventId:
          typeof payload.attributionEventId === 'string' ? payload.attributionEventId : null,
        measurementSource: 'MANUAL',
        status: 'DRAFT',
        periodStartAt: Number(payload.periodStartAt ?? now - 1000),
        periodEndAt: Number(payload.periodEndAt ?? now),
        publishedAt: null,
        description: typeof payload.description === 'string' ? payload.description : null,
        externalRef: typeof payload.externalRef === 'string' ? payload.externalRef : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      records.unshift(nextRecord);
      metricsByRecord.set(id, [
        {
          id: `${id}-metric-1`,
          metricCode: 'ENGAGEMENT_COUNT',
          numericValue: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: nextRecord }),
      });
      return;
    }

    const metricsMatch = pathname.match(/\/admin\/talent-kpi-records\/([^/]+)\/metrics$/);
    if (method === 'GET' && metricsMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: metricsByRecord.get(metricsMatch[1]) ?? [] }),
      });
      return;
    }

    const finalizeMatch = pathname.match(/\/admin\/talent-kpi-records\/([^/]+)\/finalize$/);
    if (method === 'POST' && finalizeMatch) {
      const record = records.find((item) => item.id === finalizeMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }
      record.status = 'FINALIZED';
      record.publishedAt = Date.now();
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/talent-kpi-records\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const record = records.find((item) => item.id === detailMatch[1]);
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

  await page.goto('/talent-kpi-records');
  await expect(page.getByRole('heading', { name: 'Talent KPI' })).toBeVisible();
  await page.getByRole('button', { name: 'Create KPI record' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create KPI record' }) })
    .first();

  await expect(createSurface.getByLabel('KPI record code')).toHaveCount(0);
  await expect(
    createSurface.getByText('KPI record code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Title').fill('Wave 8 KPI');
  await createSurface
    .locator('[data-picker-id="talent-kpi-subject-talent"]')
    .getByRole('button', { name: /Mina/ })
    .click();
  await createSurface.getByLabel('Period start timestamp').fill(String(now - 1000));
  await createSurface.getByLabel('Period end timestamp').fill(String(now));
  await createSurface.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('KPI-202604-000081')).toBeVisible();
  await page
    .locator('tr', { hasText: 'KPI-202604-000081' })
    .getByRole('button', { name: 'Open' })
    .click();

  await expect(page).toHaveURL(/\/talent-kpi-records\/talent-kpi-record-\d+$/);
  await expect(page.getByText('Engagement count')).toBeVisible();
  await page.getByRole('button', { name: 'Finalize' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText('Finalized').first()).toBeVisible();
});
