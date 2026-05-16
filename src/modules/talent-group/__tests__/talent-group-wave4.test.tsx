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

describe('talent-group wave 4 surfaces', () => {
  it('renders filtered flat-list rows for query-driven Talent Group routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talent-groups?status=INACTIVE&search=B%20Team');

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent-group:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('TG-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('B Team', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders by-talent related mode and excludes removed memberships', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talent-groups?view=by-talent&talentId=talent-003');

    expect(
      await screen.findByText(i18n.t('talent-group:related.byTalentModeLabel')),
    ).toBeInTheDocument();
    expect(await screen.findByText('TG-000002')).toBeInTheDocument();
    expect(screen.queryByText('TG-000001')).not.toBeInTheDocument();
  });

  it('renders detail roster/links and status gating for group lifecycle', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talent-groups/group-001');

    expect(await screen.findByText(i18n.t('talent-group:actionRail.title'))).toBeInTheDocument();
    expect(await screen.findByText('talent-001')).toBeInTheDocument();
    expect(screen.getByText('talent-002')).toBeInTheDocument();
    expect(screen.queryByText('talent-003')).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: i18n.t('talent-group:actions.activate') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('talent-group:actions.deactivate') }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: i18n.t('talent-group:actions.archive') }),
    ).toBeDisabled();

    const relatedLinks = screen.getAllByRole('link', {
      name: i18n.t('talent-group:related.openFilteredList'),
    });
    expect(relatedLinks.length).toBeGreaterThanOrEqual(3);
  });

  it('supports membership actions and detail-first mutation surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talent-groups/group-001');

    expect(await screen.findByText(i18n.t('talent-group:actionRail.title'))).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('talent-group:actions.addMember') }),
    );
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('talent-group:mutations.addMember.title'),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:actions.cancel') }));

    const activeMemberRow = screen.getByText('talent-001').closest('tr');
    expect(activeMemberRow).not.toBeNull();
    if (!activeMemberRow) {
      return;
    }

    await user.click(
      within(activeMemberRow).getByRole('button', {
        name: i18n.t('talent-group:actions.deactivateMember'),
      }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('talent-001').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('talent-group:membershipStatuses.INACTIVE')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);
});
