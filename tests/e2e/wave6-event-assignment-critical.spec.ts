import { expect, test } from '@playwright/test';

type EventStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
type AssignmentKind = 'EMPLOYMENT_PROFILE' | 'TALENT' | 'TALENT_GROUP';

type EventRecord = {
  id: string;
  eventCode: string;
  title: string;
  studioResourceIds: string[];
  platformAccountIds: string[];
  status: EventStatus;
  eventStartAt: number;
  eventEndAt: number;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type AssignmentRecord = {
  id: string;
  eventId: string;
  assignmentKind: AssignmentKind;
  assignmentEmploymentProfileId: string | null;
  assignmentTalentId: string | null;
  assignmentTalentGroupId: string | null;
  assignmentStatus: 'ACTIVE';
  createdAt: number;
};

const toListItem = (record: EventRecord) => ({
  id: record.id,
  eventCode: record.eventCode,
  title: record.title,
  status: record.status,
  eventStartAt: record.eventStartAt,
  eventEndAt: record.eventEndAt,
  createdAt: record.createdAt,
});

const toDetail = (record: EventRecord) => ({
  ...toListItem(record),
  studioResourceIds: record.studioResourceIds,
  platformAccountIds: record.platformAccountIds,
  description: record.description,
  externalRef: record.externalRef,
  updatedAt: record.updatedAt,
});

const generatedMonthCode = (prefix: string, timestamp: number, seed: number): string => {
  const date = new Date(timestamp);
  const month = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${month}-${String(seed).padStart(6, '0')}`;
};

test('wave 6 event-assignment critical flow: create, verify roster, then start event', async ({
  page,
}) => {
  let eventCounter = 80;
  let assignmentCounter = 90;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const events: EventRecord[] = [
    {
      id: 'event-001',
      eventCode: 'EVT-203003-000001',
      title: 'Launch livestream',
      studioResourceIds: ['studio-001'],
      platformAccountIds: ['platform-001'],
      status: 'SCHEDULED',
      eventStartAt: 1_900_000_000_000,
      eventEndAt: 1_900_003_600_000,
      description: null,
      externalRef: null,
      createdAt: now - 6_000,
      updatedAt: now - 5_000,
    },
  ];
  const assignments: AssignmentRecord[] = [
    {
      id: 'assignment-001',
      eventId: 'event-001',
      assignmentKind: 'EMPLOYMENT_PROFILE',
      assignmentEmploymentProfileId: 'ep-001',
      assignmentTalentId: null,
      assignmentTalentGroupId: null,
      assignmentStatus: 'ACTIVE',
      createdAt: now - 4_000,
    },
  ];

  await page.route('**/admin/employment-profiles**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/employment-profiles')) {
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
              jobTitle: 'Producer',
              orgUnitId: 'org-001',
              employmentStatus: 'ACTIVE',
              contractStatus: 'ACTIVE',
              createdAt: now,
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/admin/studio-resources**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/studio-resources')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'studio-001',
              resourceCode: 'SR-000001',
              name: 'Main Studio',
              resourceClass: 'STUDIO',
              operationalStatus: 'ACTIVE',
              locationLabel: 'District 1',
              createdAt: now,
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

  await page.route('**/admin/events**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/events')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: events.filter((item) => item.status !== 'ARCHIVED').map(toListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/events')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      eventCounter += 1;
      const nextEvent: EventRecord = {
        id: `event-${eventCounter}`,
        eventCode: String(
          payload.eventCode ??
            generatedMonthCode(
              'EVT',
              Number(payload.eventStartAt ?? 1_900_000_000_000),
              eventCounter,
            ),
        ),
        title: String(payload.title ?? `Event ${eventCounter}`),
        studioResourceIds: Array.isArray(payload.studioResourceIds)
          ? payload.studioResourceIds.map(String)
          : [],
        platformAccountIds: Array.isArray(payload.platformAccountIds)
          ? payload.platformAccountIds.map(String)
          : [],
        status: 'SCHEDULED',
        eventStartAt: Number(payload.eventStartAt ?? 1_900_000_000_000),
        eventEndAt: Number(payload.eventEndAt ?? 1_900_003_600_000),
        description: typeof payload.description === 'string' ? payload.description : null,
        externalRef: typeof payload.externalRef === 'string' ? payload.externalRef : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      events.unshift(nextEvent);

      const input = (Array.isArray(payload.assignments) ? payload.assignments[0] : {}) as Record<
        string,
        unknown
      >;
      assignmentCounter += 1;
      assignments.push({
        id: `assignment-${assignmentCounter}`,
        eventId: nextEvent.id,
        assignmentKind: String(input.assignmentKind ?? 'EMPLOYMENT_PROFILE') as AssignmentKind,
        assignmentEmploymentProfileId:
          typeof input.assignmentEmploymentProfileId === 'string'
            ? input.assignmentEmploymentProfileId
            : null,
        assignmentTalentId:
          typeof input.assignmentTalentId === 'string' ? input.assignmentTalentId : null,
        assignmentTalentGroupId:
          typeof input.assignmentTalentGroupId === 'string' ? input.assignmentTalentGroupId : null,
        assignmentStatus: 'ACTIVE',
        createdAt: Date.now(),
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(nextEvent) }),
      });
      return;
    }

    const assignmentsMatch = pathname.match(/\/admin\/events\/([^/]+)\/assignments$/);
    if (method === 'GET' && assignmentsMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: assignments.filter((assignment) => assignment.eventId === assignmentsMatch[1]),
        }),
      });
      return;
    }

    const startMatch = pathname.match(/\/admin\/events\/([^/]+)\/start$/);
    if (method === 'POST' && startMatch) {
      const record = events.find((item) => item.id === startMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }

      record.status = 'IN_PROGRESS';
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(record) }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/events\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const record = events.find((item) => item.id === detailMatch[1]);
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

  await page.goto('/events');
  await page.locator('select').first().selectOption('en');

  await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
  await page.getByRole('button', { name: 'Create event' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create event' }) })
    .first();

  await expect(createSurface.getByLabel('Event code')).toHaveCount(0);
  await expect(
    createSurface.getByText('Event code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Title').fill('Wave 6 event');
  await createSurface
    .locator('[data-picker-id="event-assignment-assignmentId"]')
    .getByRole('button', { name: /Alice/ })
    .click();
  await createSurface.getByLabel('Event start UTC').fill('1900000000000');
  await createSurface.getByLabel('Event end UTC').fill('1900003600000');
  await createSurface.getByRole('button', { name: 'Add studio resource' }).click();
  await createSurface
    .locator('[data-picker-id="event-studio-resource-0"]')
    .getByRole('button', { name: /Main Studio/ })
    .click();
  await createSurface.getByRole('button', { name: 'Add platform account' }).click();
  await createSurface
    .locator('[data-picker-id="event-platform-account-0"]')
    .getByRole('button', { name: /Mina Live/ })
    .click();
  await createSurface.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('EVT-203003-000081')).toBeVisible();

  const createdRow = page.locator('tr', { hasText: 'EVT-203003-000081' });
  await createdRow.getByRole('button', { name: 'Open detail' }).click();

  await expect(page).toHaveURL(/\/events\/event-\d+$/);
  await expect(page.getByText('Active assignments')).toBeVisible();
  await expect(page.getByText('ep-001')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByTestId('confirm-dialog-confirm').click();

  await expect(page.getByText('In progress')).toBeVisible();
});
