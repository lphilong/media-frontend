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
    expect(screen.getByText('Admin role')).toBeInTheDocument();
    expect(screen.queryByText('Archived role')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|password|session/i)).not.toBeInTheDocument();
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
    expect(screen.getAllByText(/role:view/).length).toBeGreaterThan(0);
    expect(screen.queryByText('assignment-1')).not.toBeInTheDocument();

    const userLink = await screen.findByRole(
      'link',
      { name: /admin@example.test/ },
      { timeout: 3000 },
    );
    expect(userLink).toHaveAttribute('href', '/users/user-admin');
    expect(screen.queryByText('user-admin')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set auth0 linkage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /user lifecycle/i })).not.toBeInTheDocument();
  });

  it('shows capability reasons for Role actions when permissions are missing', async () => {
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
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/roles/role-admin');

    const edit = await screen.findByRole('button', { name: i18n.t('role:actions.edit') });
    const assign = screen.getByRole('button', { name: i18n.t('role:actions.assignToUser') });
    const assignmentRow = (await screen.findByRole('link', { name: /admin@example.test/ })).closest(
      'tr',
    );

    expect(edit).toBeDisabled();
    await waitFor(() =>
      expect(edit).toHaveAccessibleDescription(i18n.t('common:capabilities.missingPermission')),
    );
    expect(assign).toBeDisabled();
    expect(assign).toHaveAccessibleDescription(i18n.t('common:capabilities.missingPermission'));
    expect(assignmentRow).not.toBeNull();
    if (!assignmentRow) {
      return;
    }
    expect(
      within(assignmentRow).getByRole('button', {
        name: i18n.t('role:actions.revokeAssignment'),
      }),
    ).toHaveAccessibleDescription(i18n.t('common:capabilities.missingPermission'));
  });

  it('supports Role-owned assignment revocation from the assignment list', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/roles/role-admin');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    const assignmentRow = (await screen.findByRole('link', { name: /admin@example.test/ })).closest(
      'tr',
    );
    expect(assignmentRow).not.toBeNull();
    if (!assignmentRow) {
      return;
    }

    await user.click(
      within(assignmentRow).getByRole('button', {
        name: i18n.t('role:actions.revokeAssignment'),
      }),
    );

    const revokeHeading = await screen.findByRole('heading', {
      name: i18n.t('role:mutations.revokeAssignment.title'),
    });
    const revokeSurface = revokeHeading.closest('section');
    expect(revokeSurface).not.toBeNull();
    if (!revokeSurface) {
      return;
    }

    await user.type(within(revokeSurface).getByLabelText(i18n.t('role:fields.reason')), 'IA test');
    await user.click(
      within(revokeSurface).getByRole('button', {
        name: i18n.t('role:mutations.revokeAssignment.submit'),
      }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByRole('link', { name: /admin@example.test/ }).closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }

        expect(
          within(refreshedRow).getByText(i18n.t('role:assignmentStates.REVOKED')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);

  it('shows recommended scope grants and applies KPI scope values on assignment', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/roles/role-admin');

    await user.click(
      await screen.findByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    );

    expect(screen.getByText(i18n.t('role:scopePicker.recommendedScopes'))).toBeInTheDocument();
    expect(screen.getAllByText(/kpi\.global/u).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('kpi.global')).not.toBeChecked();

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('role:scopePicker.applyRecommendedScopes'),
      }),
    );

    expect(screen.getByLabelText('kpi.global')).toBeChecked();
  });

  it('warns and disables assignment when role and user actor kind mismatch', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/roles/role-admin');

    await user.click(
      await screen.findByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    );
    await user.type(screen.getByPlaceholderText(i18n.t('role:placeholders.userSearch')), 'Staff');
    await user.click(screen.getByRole('button', { name: i18n.t('common:actions.search') }));
    await user.click(await screen.findByRole('button', { name: /Staff User/u }));

    expect(
      await screen.findByText(i18n.t('role:validation.adminRoleRequiresAdminActor')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('role:mutations.assignToUser.submit') }),
    ).toBeDisabled();
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
      screen.getByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).toBeDisabled();
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
