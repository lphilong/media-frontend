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

describe('employment profile wave 3 surfaces', () => {
  it('renders filtered list rows for query-driven Employment Profile routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/employment-profiles?employmentStatus=ON_LEAVE&search=Bao&hasLinkedUser=false');

    expect(
      await screen.findByRole('heading', { name: i18n.t('employment-profile:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('EMP002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('Bao', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders detail direct-reports and lifecycle gating', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/employment-profiles/ep-001');

    expect(
      await screen.findByText(i18n.t('employment-profile:actionRail.title')),
    ).toBeInTheDocument();
    expect(await screen.findByText('EMP002')).toBeInTheDocument();
    expect(screen.getByText('EMP003')).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.place-on-leave') }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.return-from-leave') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.reactivate') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.archive') }),
    ).toBeDisabled();
  });

  it('supports assignment, link/unlink, contract-status, and terminate surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/employment-profiles/ep-001');

    expect(
      await screen.findByText(i18n.t('employment-profile:actionRail.title')),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.assignOrgUnit') }),
    );
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('employment-profile:mutations.assignOrgUnit.title'),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:actions.cancel') }));

    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.assignManager') }),
    );
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('employment-profile:mutations.assignManager.title'),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:actions.cancel') }));

    const unlinkUserButton = screen.getByRole('button', {
      name: i18n.t('employment-profile:actions.unlinkUser'),
    });
    expect(unlinkUserButton).toBeEnabled();
    await user.click(unlinkUserButton);
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: i18n.t('employment-profile:actions.linkUser') }),
        ).toBeEnabled();
      },
      { timeout: 3000 },
    );

    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.linkUser') }),
    );
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.linkedUserId')),
      'user-relinked',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:mutations.linkUser.submit') }),
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: i18n.t('employment-profile:actions.unlinkUser') }),
        ).toBeEnabled();
      },
      { timeout: 3000 },
    );

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:actions.updateContractStatus'),
      }),
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t('employment-profile:fields.newContractStatus')),
      'EXPIRED',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.contractStatus.submit'),
      }),
    );

    expect(
      await screen.findByText(
        i18n.t('employment-profile:feedback.contractStatusUpdated'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.terminate') }),
    );
    const terminateSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('employment-profile:mutations.terminate.title'),
    });
    const terminateSurface = terminateSurfaceHeading.closest('section');
    expect(terminateSurface).not.toBeNull();
    if (!terminateSurface) {
      return;
    }

    const terminateSurfaceScope = within(terminateSurface);
    await user.type(
      terminateSurfaceScope.getByLabelText(i18n.t('employment-profile:fields.employmentEndDate')),
      '2026-04-22',
    );
    await user.click(
      terminateSurfaceScope.getByRole('button', {
        name: i18n.t('employment-profile:mutations.terminate.submit'),
      }),
    );

    await waitFor(
      () => {
        expect(
          screen.getAllByText(i18n.t('employment-profile:statuses.TERMINATED')).length,
        ).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  }, 15_000);

  it('keeps contract-status action fail-closed when no transition is supported', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/employment-profiles/ep-004');

    expect(
      await screen.findByText(i18n.t('employment-profile:actionRail.title')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:actions.updateContractStatus'),
      }),
    ).toBeDisabled();
  });
});
