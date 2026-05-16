import { expect, test } from '@playwright/test';

type WorkShiftStatus = 'ACTIVE' | 'CANCELLED' | 'ARCHIVED';
type WorkShiftSubjectKind = 'EMPLOYMENT_PROFILE' | 'TALENT' | 'TALENT_GROUP';

type WorkShiftRecord = {
  id: string;
  shiftCode: string;
  title: string;
  subjectKind: WorkShiftSubjectKind;
  subjectEmploymentProfileId: string | null;
  subjectTalentId: string | null;
  subjectTalentGroupId: string | null;
  studioResourceIds: string[];
  status: WorkShiftStatus;
  shiftStartAt: number;
  shiftEndAt: number;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

const toListItem = (record: WorkShiftRecord) => ({
  id: record.id,
  shiftCode: record.shiftCode,
  title: record.title,
  subjectKind: record.subjectKind,
  subjectEmploymentProfileId: record.subjectEmploymentProfileId,
  subjectTalentId: record.subjectTalentId,
  subjectTalentGroupId: record.subjectTalentGroupId,
  status: record.status,
  shiftStartAt: record.shiftStartAt,
  shiftEndAt: record.shiftEndAt,
  createdAt: record.createdAt,
});

const toDetail = (record: WorkShiftRecord) => ({
  ...toListItem(record),
  studioResourceIds: record.studioResourceIds,
  description: record.description,
  externalRef: record.externalRef,
  updatedAt: record.updatedAt,
});

test('wave 6 work schedule critical flow: create then cancel work shift', async ({ page }) => {
  let counter = 60;
  let createPayload: Record<string, unknown> | null = null;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const workShifts: WorkShiftRecord[] = [
    {
      id: 'work-shift-001',
      shiftCode: 'SHIFT001',
      title: 'Main studio morning shift',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectEmploymentProfileId: 'ep-001',
      subjectTalentId: null,
      subjectTalentGroupId: null,
      studioResourceIds: ['studio-001'],
      status: 'ACTIVE',
      shiftStartAt: 1_900_000_000_000,
      shiftEndAt: 1_900_003_600_000,
      description: null,
      externalRef: null,
      createdAt: now - 6_000,
      updatedAt: now - 5_000,
    },
  ];

  await page.route('**/admin/work-shifts**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/work-shifts')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: workShifts.filter((item) => item.status !== 'ARCHIVED').map(toListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/work-shifts')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      createPayload = payload;
      counter += 1;
      const nextRecord: WorkShiftRecord = {
        id: `work-shift-${counter}`,
        shiftCode: String(payload.shiftCode ?? `SHIFT${counter}`),
        title: String(payload.title ?? `Shift ${counter}`),
        subjectKind: String(payload.subjectKind ?? 'EMPLOYMENT_PROFILE') as WorkShiftSubjectKind,
        subjectEmploymentProfileId:
          typeof payload.subjectEmploymentProfileId === 'string'
            ? payload.subjectEmploymentProfileId
            : null,
        subjectTalentId:
          typeof payload.subjectTalentId === 'string' ? payload.subjectTalentId : null,
        subjectTalentGroupId:
          typeof payload.subjectTalentGroupId === 'string' ? payload.subjectTalentGroupId : null,
        studioResourceIds: Array.isArray(payload.studioResourceIds)
          ? payload.studioResourceIds.map(String)
          : [],
        status: 'ACTIVE',
        shiftStartAt: Number(payload.shiftStartAt ?? 1_900_000_000_000),
        shiftEndAt: Number(payload.shiftEndAt ?? 1_900_003_600_000),
        description: typeof payload.description === 'string' ? payload.description : null,
        externalRef: typeof payload.externalRef === 'string' ? payload.externalRef : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      workShifts.unshift(nextRecord);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(nextRecord) }),
      });
      return;
    }

    const cancelMatch = pathname.match(/\/admin\/work-shifts\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancelMatch) {
      const record = workShifts.find((item) => item.id === cancelMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }

      record.status = 'CANCELLED';
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(record) }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/work-shifts\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const record = workShifts.find((item) => item.id === detailMatch[1]);
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

  await page.route('**/admin/employment-profiles**', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'ep-001',
            employeeCode: 'EP-000001',
            legalName: 'Alice Nguyen',
            displayName: 'Alice',
            employmentKind: 'FULL_TIME',
            jobTitle: 'Operator',
            orgUnitId: 'ou-sales',
            managerEmploymentProfileId: null,
            linkedUserId: null,
            employmentStatus: 'ACTIVE',
            contractStatus: 'ACTIVE',
            createdAt: now,
          },
        ],
        meta: undefined,
      }),
    });
  });

  await page.route('**/admin/studio-resources**', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'studio-001',
            resourceCode: 'SR-000001',
            name: 'Main Studio',
            shortName: 'Main',
            resourceClass: 'SPACE',
            operationalStatus: 'ACTIVE',
            locationLabel: 'Room A',
            maxOccupancy: 12,
            createdAt: now,
          },
        ],
        meta: undefined,
      }),
    });
  });

  await page.goto('/work-shifts');
  await page.locator('select').first().selectOption('en');

  await expect(page.getByRole('heading', { name: 'Work Shifts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Admin create form' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Schedule work shift' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Schedule work shift' }) })
    .first();

  await createSurface.getByLabel('Title').fill('Wave 6 work shift');
  await page
    .locator('[data-picker-id="work-shift-subject-EMPLOYMENT_PROFILE"]')
    .getByText(/EP-000001/)
    .click();
  await createSurface.getByLabel('Start in Vietnam local time').fill('2026-05-03T08:30');
  await createSurface.getByLabel('End in Vietnam local time').fill('2026-05-03T10:00');
  await page
    .locator('[data-picker-id="work-shift-studio-resources"]')
    .getByText(/SR-000001/)
    .click();
  await createSurface.getByRole('button', { name: 'Review details' }).click();
  await createSurface.getByRole('button', { name: 'Submit work shift' }).click();

  expect(createPayload).not.toHaveProperty('shiftCode');
  expect(createPayload).toMatchObject({
    subjectKind: 'EMPLOYMENT_PROFILE',
    subjectEmploymentProfileId: 'ep-001',
    studioResourceIds: ['studio-001'],
  });
  await expect(page.getByText('Wave 6 work shift')).toBeVisible();
  await expect(page.getByText('SHIFT61')).toBeVisible();

  const createdRow = page.locator('tr', { hasText: 'Wave 6 work shift' });
  await createdRow.getByRole('button', { name: 'Open detail' }).click();

  await expect(page).toHaveURL(/\/work-shifts\/work-shift-\d+$/);
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await page.getByTestId('confirm-dialog-confirm').click();

  await expect(page.getByText('Cancelled')).toBeVisible();
});
