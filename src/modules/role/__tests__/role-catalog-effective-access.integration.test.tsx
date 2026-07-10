import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import {
  findRolePicker,
  renderRoleRoute,
} from '@modules/role/__tests__/role-integration-test-helpers';
import { expectNoRawAccountContextCodes } from '@test/assertions';
import { server } from '@test/msw/server';

describe('Role catalog and effective-access integration', () => {
  it('renders the catalog-first surface without calling the legacy Role table', async () => {
    let legacyRoleListRequests = 0;
    server.use(
      http.get('*/admin/roles', () => {
        legacyRoleListRequests += 1;
        return HttpResponse.json({ message: 'Legacy Role table is unavailable' }, { status: 410 });
      }),
    );

    renderRoleRoute('/roles?state=ACTIVE&search=Admin&scope=global');

    expect(
      await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(i18n.t('role:templateCatalog.title'), {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(legacyRoleListRequests).toBe(0));
    for (const code of ['ADMIN_FULL', 'TEAM_MANAGER', 'COMMERCIAL_FINANCE', 'TALENT_STAFF_SELF']) {
      expect(document.body).not.toHaveTextContent(code);
    }
    expect(screen.queryByText(/credential|token|password|session/iu)).not.toBeInTheDocument();
  });

  it('keeps templates, bundles, assignment, and user access under one accessible Role tablist', async () => {
    const user = userEvent.setup();
    renderRoleRoute();

    const tabs = await screen.findByRole('tablist');
    for (const name of [
      i18n.t('role:tabs.templates'),
      i18n.t('role:tabs.bundles'),
      i18n.t('role:tabs.assignments'),
      i18n.t('role:tabs.userAccess'),
    ]) {
      expect(within(tabs).getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.getAllByTestId('nav-link-roles')).toHaveLength(1);
    expect(screen.queryByTestId('nav-link-role-templates')).not.toBeInTheDocument();
    expect(screen.queryByText(/role:view/u)).not.toBeInTheDocument();

    await user.click(within(tabs).getByRole('tab', { name: i18n.t('role:tabs.bundles') }));
    expect((await screen.findAllByText(i18n.t('role:bundles.childRoles'))).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expectNoRawAccountContextCodes();
  });

  it('shows effective access as read-only business information with technical values out of normal UI', async () => {
    const user = userEvent.setup();
    renderRoleRoute();
    await user.click(await screen.findByRole('tab', { name: i18n.t('role:tabs.userAccess') }));

    const picker = await findRolePicker('role-effective-access-user');
    await user.type(
      within(picker).getByPlaceholderText(i18n.t('role:placeholders.userSearch')),
      'Ad',
    );
    await user.click(await within(picker).findByText(/Admin User/u));

    expect(await screen.findByText(i18n.t('role:userAccess.scopeGrants'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.assignedBy'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.reason'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.responsibilityTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.lifecycleReadOnlyHere'))).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/unrecognized_keys|templateCode/u);
    expectNoRawAccountContextCodes();
  }, 15_000);
});
