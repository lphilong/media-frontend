import { expect, test } from '@playwright/test';

type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
type UserActorKind = 'ADMIN' | 'STAFF';

type UserRecord = {
  id: string;
  accountStatus: UserStatus;
  actorKind: UserActorKind;
  authLinkage: {
    provider: 'auth0';
    subject: string;
  };
  contextAccess: {
    contexts: Array<{ context: 'ADMIN' }>;
  };
  profile: {
    displayName: string;
    email: string | null;
    phone: string | null;
  };
  preferences: {
    locale: string | null;
    timezone: string | null;
  };
  createdAt: number;
  updatedAt: number;
  activatedAt: number | null;
  disabledAt: number | null;
  archivedAt: number | null;
};

const toListItem = (record: UserRecord) => ({
  id: record.id,
  displayName: record.profile.displayName,
  email: record.profile.email,
  actorKind: record.actorKind,
  accountStatus: record.accountStatus,
  updatedAt: record.updatedAt,
});

test('IA-1 User critical flow: create pending user then activate', async ({ page }) => {
  let counter = 10;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const users: UserRecord[] = [
    {
      id: 'user-admin',
      accountStatus: 'ACTIVE',
      actorKind: 'ADMIN',
      authLinkage: { provider: 'auth0', subject: 'auth0|admin' },
      contextAccess: { contexts: [{ context: 'ADMIN' }] },
      profile: { displayName: 'Admin User', email: 'admin@example.test', phone: null },
      preferences: { locale: 'en', timezone: 'Asia/Saigon' },
      createdAt: now - 2_000,
      updatedAt: now - 1_000,
      activatedAt: now - 1_000,
      disabledAt: null,
      archivedAt: null,
    },
  ];

  await page.route('**/admin/users**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/users')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: users
            .filter((item) => item.accountStatus !== 'ARCHIVED')
            .sort(
              (left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
            )
            .map(toListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/users')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      expect(payload.scope).toBeUndefined();
      expect(payload.scopeGrants).toBeUndefined();
      expect(payload.roleIds).toBeUndefined();

      counter += 1;
      const record: UserRecord = {
        id: `user-${counter}`,
        accountStatus: 'PENDING',
        actorKind: payload.actorKind === 'ADMIN' ? 'ADMIN' : 'STAFF',
        authLinkage: { provider: 'auth0', subject: String(payload.authSubject ?? '') },
        contextAccess: { contexts: [{ context: 'ADMIN' }] },
        profile: {
          displayName: String(payload.displayName ?? `User ${counter}`),
          email: typeof payload.email === 'string' ? payload.email : null,
          phone: typeof payload.phone === 'string' ? payload.phone : null,
        },
        preferences: {
          locale: typeof payload.locale === 'string' ? payload.locale : null,
          timezone: typeof payload.timezone === 'string' ? payload.timezone : null,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        activatedAt: null,
        disabledAt: null,
        archivedAt: null,
      };
      users.push(record);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    const activateMatch = pathname.match(/\/admin\/users\/([^/]+)\/activate$/);
    if (method === 'POST' && activateMatch) {
      const record = users.find((item) => item.id === activateMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }

      record.accountStatus = 'ACTIVE';
      record.activatedAt = Date.now();
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/users');

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await page.getByRole('button', { name: 'Create user' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create user' }) })
    .first();

  await createSurface.getByLabel('Auth0 subject').fill('auth0|ia-e2e-user');
  await createSurface.getByLabel('Display name').fill('IA E2E User');
  await createSurface.getByLabel('Email').fill('ia-e2e-user@example.test');
  await createSurface.getByRole('button', { name: 'Create user' }).click();

  await expect(page.getByText('IA E2E User')).toBeVisible();

  const createdRow = page.locator('tr', { hasText: 'IA E2E User' });
  await createdRow.getByRole('button', { name: 'Activate' }).click();
  await page.getByTestId('confirm-dialog-confirm').click();

  await expect(createdRow.getByText('Active')).toBeVisible();
  await expect(page.getByRole('button', { name: /assign role/i })).toHaveCount(0);
  await expect(
    page.getByRole('table', { name: 'Users' }).getByText(/credential|token|password|session/i),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /credential|token|password|session/i }),
  ).toHaveCount(0);
});
