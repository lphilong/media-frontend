import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';
import { createRole, createRoleFromTemplate } from '@modules/role/api/role.api';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

describe('role IA-1 surfaces', () => {
  it('renders the constrained Role list and ignores unsupported scope-shaped query keys', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles?state=ACTIVE&search=Admin&scope=global&scopeGrants=admin&sortBy=name');

    expect(
      await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('ADMIN', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('role:states.ACTIVE')).length).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t('common:pagination.cursorDisclosure'))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('common:pagination.goToPage'))).not.toBeInTheDocument();
    expect(screen.getByText('Admin role')).toBeInTheDocument();
    expect(screen.queryByText('Archived role')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|password|session/i)).not.toBeInTheDocument();
  });

  it('renders the AUTH-4B Role tabs under a single Vai trò sidebar entry', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/roles');

    expect(
      await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: i18n.t('role:tabs.templates') }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('nav-link-roles')).toHaveLength(1));
    expect(screen.queryByTestId('nav-link-role-templates')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-role-bundles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-role-assignments')).not.toBeInTheDocument();

    expect(screen.getByRole('tab', { name: i18n.t('role:tabs.bundles') })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: i18n.t('role:tabs.assignments') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: i18n.t('role:tabs.userAccess') }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/role:view/u)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: i18n.t('role:tabs.bundles') }));
    expect(await screen.findByText('ADMIN_OPERATIONS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: i18n.t('role:tabs.assignments') }));
    expect(await screen.findByText(i18n.t('role:assignmentTab.unavailableTitle')))
      .toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:mutations.assignToUser.submit') }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: i18n.t('role:tabs.userAccess') }));
    expect(await screen.findByText(i18n.t('role:userAccess.emptyTitle'))).toBeInTheDocument();
  });

  it('renders Role detail, permission matrix, and Role-owned assignments only', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles/role-admin?state=ACTIVE&scope=global');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('Admin role')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:detail.permissionMatrixTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:templates.basedOnTemplate'))).toBeInTheDocument();
    expect(screen.getByText(/Admin Full \(ADMIN_FULL\)/)).toBeInTheDocument();
    expect(screen.getByText(/Work Schedule: Self, Team/)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard Lite: Global/)).toBeInTheDocument();
    expect(screen.getAllByText(/Quản trị vai trò/u).length).toBeGreaterThan(0);
    expect(screen.queryByText(/role:view/u)).not.toBeInTheDocument();
    expect(screen.queryByText('assignment-1')).not.toBeInTheDocument();

    const userLink = await screen.findByRole(
      'link',
      { name: /Admin User/u },
      { timeout: 3000 },
    );
    expect(userLink).toHaveAttribute('href', '/users/user-admin');
    expect(screen.queryByText('user-admin')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.revokeAssignment') }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set auth0 linkage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /user lifecycle/i })).not.toBeInTheDocument();
  });

  it('hides Role actions when permissions are missing', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: ['role:view', 'role:assignment:view'],
            scopeGrants: {},
            accountContexts: ['ADMIN_CONSOLE'],
            workspaceAvailability: {
              primaryWorkspace: 'ADMIN_CONSOLE',
              availableWorkspaces: [
                {
                  context: 'STAFF_CONSOLE',
                  available: false,
                  source: 'ACCOUNT_CONTEXT',
                  reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
                  trace: [],
                },
                {
                  context: 'MANAGER_CONSOLE',
                  available: false,
                  source: 'ACCOUNT_CONTEXT',
                  reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
                  trace: [],
                },
                {
                  context: 'ADMIN_CONSOLE',
                  available: true,
                  source: 'ACCOUNT_CONTEXT',
                  reasonCodes: ['ACCOUNT_CONTEXT_ACTIVE'],
                  trace: [],
                },
              ],
              ownDataAvailable: false,
              managerResponsibilitiesAvailable: false,
              effectiveAccessTraceAvailable: true,
              sourceTrace: [],
            },
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/roles/role-admin');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    const assignmentRow = (await screen.findByRole('link', { name: /Admin User/u })).closest('tr');

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: i18n.t('role:actions.edit') }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.replacePermissions') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.replaceAssignmentRules') }),
    ).not.toBeInTheDocument();

    expect(assignmentRow).not.toBeNull();
    if (!assignmentRow) {
      return;
    }
    expect(
      within(assignmentRow).queryByRole('button', {
        name: i18n.t('role:actions.revokeAssignment'),
      }),
    ).not.toBeInTheDocument();
  });

  it('does not expose Role detail as the primary assignment or revoke workflow', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles/role-admin');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Admin User/u })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.revokeAssignment') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: i18n.t('role:mutations.assignToUser.title') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: i18n.t('role:mutations.revokeAssignment.title') }),
    ).not.toBeInTheDocument();
  });

  it('shows Custom fallback when template metadata is absent', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles/role-draft');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('Operations role')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:templates.custom'))).toBeInTheDocument();
  });

  it('keeps archived roles immutable and excludes scope, rename, and User mutation controls', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles/role-archived');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:detail.archivedReadOnly'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.edit') })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('role:actions.edit') }),
    ).toHaveAccessibleDescription(i18n.t('common:capabilities.invalidStatus'));
    expect(
      screen.getByRole('button', { name: i18n.t('role:actions.replacePermissions') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('role:actions.replaceAssignmentRules') }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.activate') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.deactivate') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.archive') })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set auth0 linkage/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|password|session/i)).not.toBeInTheDocument();
  });
});

describe('role MSW create code behavior', () => {
  it('rejects duplicate manual Role code on create using backend-like normalization', async () => {
    await expect(
      createRole({
        name: 'Duplicate admin code',
        code: ' admin ',
        description: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ROLE_CONFLICT',
      message: 'Role code already exists: ADMIN',
    });
  });

  it('rejects duplicate manual Role code on create-from-template', async () => {
    await expect(
      createRoleFromTemplate({
        templateCode: 'TEAM_MANAGER',
        name: 'Duplicate template code',
        code: 'ops',
        description: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ROLE_CONFLICT',
      message: 'Role code already exists: OPS',
    });
  });

  it('generates unique MSW Role codes when code is omitted', async () => {
    const custom = await createRole({
      name: 'Generated custom role',
      description: null,
    });
    const templated = await createRoleFromTemplate({
      templateCode: 'VIEWER_AUDITOR',
      name: 'Generated template role',
      description: null,
    });

    expect(custom.code).toMatch(/^ROLE-\d{6}$/u);
    expect(templated.code).toMatch(/^ROLE-\d{6}$/u);
    expect(templated.code).not.toBe(custom.code);
  });
});
