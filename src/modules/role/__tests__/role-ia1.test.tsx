import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

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
    expect(screen.getAllByText(/role:view/).length).toBeGreaterThan(0);
    expect(await screen.findByText('assignment-1', {}, { timeout: 3000 })).toBeInTheDocument();

    const userLink = screen.getByRole('link', { name: 'user-admin' });
    expect(userLink).toHaveAttribute('href', '/users/user-admin');
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set auth0 linkage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /user lifecycle/i })).not.toBeInTheDocument();
  });

  it('supports Role-owned assignment revocation from the assignment list', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/roles/role-admin');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    const assignmentRow = (await screen.findByText('assignment-1')).closest('tr');
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
        const refreshedRow = screen.getByText('assignment-1').closest('tr');
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

  it('keeps archived roles immutable and excludes scope, rename, and User mutation controls', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles/role-archived');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:detail.archivedReadOnly'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.edit') })).toBeDisabled();
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
