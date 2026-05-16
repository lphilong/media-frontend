import { expect, test } from '@playwright/test';

type StudioResourceStatus = 'ACTIVE' | 'OUT_OF_SERVICE' | 'INACTIVE' | 'ARCHIVED';

type StudioResourceRecord = {
  id: string;
  resourceCode: string;
  name: string;
  shortName: string | null;
  resourceClass: string;
  operationalStatus: StudioResourceStatus;
  locationLabel: string | null;
  maxOccupancy: number | null;
  createdAt: number;
  updatedAt: number;
};

const toListItem = (record: StudioResourceRecord) => ({
  id: record.id,
  resourceCode: record.resourceCode,
  name: record.name,
  shortName: record.shortName,
  resourceClass: record.resourceClass,
  operationalStatus: record.operationalStatus,
  locationLabel: record.locationLabel,
  maxOccupancy: record.maxOccupancy,
  createdAt: record.createdAt,
});

const toDetail = (record: StudioResourceRecord) => ({
  ...toListItem(record),
  description: null,
  externalRef: null,
  updatedAt: record.updatedAt,
});

const generatedCode = (prefix: string, seed: number): string =>
  `${prefix}-${String(seed).padStart(6, '0')}`;

test('wave 5 studio-resource critical flow: create then mark out of service', async ({ page }) => {
  let counter = 40;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const studioResources: StudioResourceRecord[] = [
    {
      id: 'studio-001',
      resourceCode: 'SR-000001',
      name: 'Main Studio',
      shortName: 'Main',
      resourceClass: 'SPACE',
      operationalStatus: 'ACTIVE',
      locationLabel: 'Room A',
      maxOccupancy: 12,
      createdAt: now - 6_000,
      updatedAt: now - 5_000,
    },
  ];

  await page.route('**/admin/studio-resources**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/studio-resources')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: studioResources
            .filter((item) => item.operationalStatus !== 'ARCHIVED')
            .map(toListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/studio-resources')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      expect(payload).not.toHaveProperty('resourceCode');
      counter += 1;
      const nextRecord: StudioResourceRecord = {
        id: `studio-${counter}`,
        resourceCode: String(payload.resourceCode ?? generatedCode('SR', counter)),
        name: String(payload.name ?? `Studio ${counter}`),
        shortName: typeof payload.shortName === 'string' ? payload.shortName : null,
        resourceClass: String(payload.resourceClass ?? 'SPACE'),
        operationalStatus: 'ACTIVE',
        locationLabel: typeof payload.locationLabel === 'string' ? payload.locationLabel : null,
        maxOccupancy: typeof payload.maxOccupancy === 'number' ? payload.maxOccupancy : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      studioResources.push(nextRecord);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(nextRecord) }),
      });
      return;
    }

    const outOfServiceMatch = pathname.match(/\/admin\/studio-resources\/([^/]+)\/out-of-service$/);
    if (method === 'POST' && outOfServiceMatch) {
      const record = studioResources.find((item) => item.id === outOfServiceMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }

      record.operationalStatus = 'OUT_OF_SERVICE';
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(record) }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/studio-resources\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const record = studioResources.find((item) => item.id === detailMatch[1]);
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
        body: JSON.stringify({ data: toDetail(record) }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/studio-resources');

  await expect(page.getByRole('heading', { name: 'Studio Resources' })).toBeVisible();
  await page.getByRole('button', { name: 'Create resource' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create studio resource' }) })
    .first();

  await expect(
    createSurface.getByText('Resource code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Name', { exact: true }).fill('Wave 5 Studio');
  await createSurface.getByLabel('Max occupancy').fill('8');
  await createSurface.getByRole('button', { name: 'Create resource' }).click();

  await expect(page.getByText('SR-000041')).toBeVisible();

  const createdRow = page.locator('tr', { hasText: 'SR-000041' });
  await createdRow.getByRole('button', { name: 'Open' }).click();

  await expect(page).toHaveURL(/\/studio-resources\/studio-\d+$/);
  await page.getByRole('button', { name: 'Mark out of service' }).click();
  await page.getByTestId('confirm-dialog-confirm').click();

  const statusField = page.locator('dl div', {
    has: page.locator('dt', { hasText: /^Status$/ }),
  });
  await expect(statusField).toContainText('Out of service');
});
