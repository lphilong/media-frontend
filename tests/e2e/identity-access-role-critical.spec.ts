import { expect, test } from '@playwright/test';

type RoleState = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type RoleAssignmentState = 'ACTIVE' | 'REVOKED';
type DelegationBand = 'LIMITED' | 'PRIVILEGED' | 'FOUNDATION';
type MaxDelegatableBand = 'NONE' | 'LIMITED' | 'PRIVILEGED';

type RoleRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  state: RoleState;
  permissions: Array<{ code: string }>;
  delegationBand: DelegationBand;
  maxDelegatableBand: MaxDelegatableBand;
  assignmentRules: Array<Record<string, unknown>>;
  createdAt: number;
  updatedAt: number;
  activatedAt: number | null;
  archivedAt: number | null;
};

type RoleAssignmentRecord = {
  assignmentId: string;
  roleId: string;
  userId: string;
  state: RoleAssignmentState;
  effectiveAt: number;
  revokedAt: number | null;
  reason: string | null;
};

const toListItem = (record: RoleRecord, assignments: RoleAssignmentRecord[]) => ({
  id: record.id,
  code: record.code,
  name: record.name,
  state: record.state,
  permissionsSummary: String(record.permissions.length),
  assignmentCountSummary: String(
    assignments.filter((item) => item.roleId === record.id && item.state === 'ACTIVE').length,
  ),
  updatedAt: record.updatedAt,
});

test('IA-1 Role critical flow: create, activate, then assign to user', async ({ page }) => {
  let roleCounter = 20;
  let assignmentCounter = 5;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const roles: RoleRecord[] = [
    {
      id: 'role-admin',
      code: 'ADMIN',
      name: 'Admin role',
      description: 'Admin permission template',
      state: 'ACTIVE',
      permissions: [{ code: 'role:view' }],
      delegationBand: 'PRIVILEGED',
      maxDelegatableBand: 'LIMITED',
      assignmentRules: [],
      createdAt: now - 2_000,
      updatedAt: now - 1_000,
      activatedAt: now - 1_000,
      archivedAt: null,
    },
  ];
  const assignments: RoleAssignmentRecord[] = [];

  await page.route('**/admin/users**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/users')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'user-admin',
              displayName: 'Admin User',
              email: 'admin@example.com',
              actorKind: 'ADMIN',
              accountStatus: 'ACTIVE',
              updatedAt: now,
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/admin/roles**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/roles')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: roles
            .filter((item) => item.state !== 'ARCHIVED')
            .sort(
              (left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
            )
            .map((record) => toListItem(record, assignments)),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/roles')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      expect(payload.scope).toBeUndefined();
      expect(payload.scopeGrants).toBeUndefined();

      roleCounter += 1;
      const role: RoleRecord = {
        id: `role-${roleCounter}`,
        code: String(payload.code ?? `ROLE${roleCounter}`).toUpperCase(),
        name: String(payload.name ?? `Role ${roleCounter}`),
        description:
          typeof payload.description === 'string' || payload.description === null
            ? payload.description
            : null,
        state: 'DRAFT',
        permissions: Array.isArray(payload.initialPermissions)
          ? payload.initialPermissions.map((code) => ({ code: String(code) }))
          : [],
        delegationBand:
          payload.initialDelegationBand === 'PRIVILEGED' ||
          payload.initialDelegationBand === 'FOUNDATION'
            ? payload.initialDelegationBand
            : 'LIMITED',
        maxDelegatableBand:
          payload.initialMaxDelegatableBand === 'LIMITED' ||
          payload.initialMaxDelegatableBand === 'PRIVILEGED'
            ? payload.initialMaxDelegatableBand
            : 'NONE',
        assignmentRules: Array.isArray(payload.initialAssignmentRules)
          ? (payload.initialAssignmentRules as Array<Record<string, unknown>>)
          : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        activatedAt: null,
        archivedAt: null,
      };
      roles.push(role);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: role }),
      });
      return;
    }

    const assignmentListMatch = pathname.match(/\/admin\/roles\/([^/]+)\/assignments$/);
    if (method === 'GET' && assignmentListMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: assignments.filter((item) => item.roleId === assignmentListMatch[1]),
        }),
      });
      return;
    }

    if (method === 'POST' && assignmentListMatch) {
      const role = roles.find((item) => item.id === assignmentListMatch[1]);
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      expect(payload.effectiveAt).toBeUndefined();
      expect(payload.scope).toBeUndefined();
      expect(payload.scopeGrants).toBeUndefined();

      if (!role || role.state !== 'ACTIVE') {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'role:validation.required' }),
        });
        return;
      }

      assignmentCounter += 1;
      const assignment: RoleAssignmentRecord = {
        assignmentId: `assignment-${assignmentCounter}`,
        roleId: role.id,
        userId: String(payload.userId ?? ''),
        state: 'ACTIVE',
        effectiveAt: Date.now(),
        revokedAt: null,
        reason: typeof payload.reason === 'string' ? payload.reason : null,
      };
      assignments.push(assignment);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: assignment }),
      });
      return;
    }

    const permissionMatrixMatch = pathname.match(/\/admin\/roles\/([^/]+)\/permission-matrix$/);
    if (method === 'GET' && permissionMatrixMatch) {
      const role = roles.find((item) => item.id === permissionMatrixMatch[1]);
      if (!role) {
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
        body: JSON.stringify({
          data: {
            roleId: role.id,
            roleCode: role.code,
            roleState: role.state,
            permissions: role.permissions,
            delegationBand: role.delegationBand,
            maxDelegatableBand: role.maxDelegatableBand,
          },
        }),
      });
      return;
    }

    const activateMatch = pathname.match(/\/admin\/roles\/([^/]+)\/activate$/);
    if (method === 'POST' && activateMatch) {
      const role = roles.find((item) => item.id === activateMatch[1]);
      if (!role) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }

      role.state = 'ACTIVE';
      role.activatedAt = Date.now();
      role.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: role }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/roles\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const role = roles.find((item) => item.id === detailMatch[1]);
      if (!role) {
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
        body: JSON.stringify({ data: role }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/roles');

  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible();
  await page.getByRole('button', { name: 'Create role' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create role' }) })
    .first();

  await createSurface.getByLabel('Name').fill('IA E2E Role');
  await createSurface.getByLabel('Code').fill('iae2e');
  await createSurface.getByLabel('Permissions').fill('role:view user:view');
  await createSurface.getByRole('button', { name: 'Create role' }).click();

  await expect(page.getByText('IAE2E')).toBeVisible();

  const createdRow = page.locator('tr', { hasText: 'IAE2E' });
  await createdRow.getByRole('button', { name: 'Activate' }).click();
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(createdRow.getByText('Active')).toBeVisible();

  await createdRow.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByText('Role actions')).toBeVisible();
  await page.getByRole('button', { name: 'Assign to user' }).click();

  const assignSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Assign role to user' }) })
    .first();
  await assignSurface
    .locator('[data-picker-id="role-assignment-user"]')
    .getByText('Admin User')
    .click();
  await assignSurface.getByRole('button', { name: 'Assign role' }).click();

  await expect(page.getByText('assignment-6')).toBeVisible();
  await expect(page.getByRole('button', { name: /grant scope/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /set auth0 linkage/i })).toHaveCount(0);
});
