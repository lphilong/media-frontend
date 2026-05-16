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

describe('platform-account wave 5 surfaces', () => {
  it('renders query-driven list rows and drops archived rows by default', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/platform-accounts?platform=YOUTUBE&search=Mina&scope=global');

    expect(
      await screen.findByRole('heading', { name: i18n.t('platform-account:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('PA-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Mina Live')).toBeInTheDocument();
    expect(screen.queryByText('Archived Platform')).not.toBeInTheDocument();
  });

  it('renders detail sections and constrained related navigation links', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/platform-accounts/platform-001');

    expect(
      await screen.findByText(i18n.t('platform-account:actionRail.title')),
    ).toBeInTheDocument();
    expect(screen.getByText('PA-000001')).toBeInTheDocument();
    expect(screen.getByText('@mina')).toBeInTheDocument();

    const relatedLinks = screen.getAllByRole('link', {
      name: i18n.t('platform-account:related.openFilteredList'),
    });
    expect(
      relatedLinks.some((link) =>
        link
          .getAttribute('href')
          ?.includes('/events?view=by-platform&platformAccountId=platform-001'),
      ),
    ).toBe(true);
  });

  it('keeps lifecycle gating and archived read-only behavior visible from detail', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/platform-accounts/platform-archive');

    expect(
      await screen.findByText(i18n.t('platform-account:actionRail.title')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('platform-account:detail.archivedReadOnly')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('platform-account:actions.edit') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('platform-account:actions.transferOwnership') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('platform-account:actions.updateCapabilities') }),
    ).toBeDisabled();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token/i)).not.toBeInTheDocument();
  });

  it('supports create and list lifecycle transitions without delete or credential controls', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/platform-accounts');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('platform-account:actions.create'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('platform-account:mutations.create.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token/i)).not.toBeInTheDocument();

    const createSurfaceScope = within(createSurface);
    expect(
      createSurfaceScope.queryByLabelText(i18n.t('platform-account:fields.accountCode')),
    ).toBeNull();
    expect(
      createSurfaceScope.getByText(i18n.t('platform-account:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('platform-account:fields.platform')),
      'YOUTUBE',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('platform-account:fields.platformSurfaceType')),
      'LIVESTREAM',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('platform-account:fields.displayName')),
      'Wave 5 Platform',
    );
    await user.selectOptions(
      createSurfaceScope.getByLabelText(i18n.t('platform-account:fields.ownerKind')),
      'TALENT',
    );
    const ownerPicker = createSurface.querySelector(
      '[data-picker-id="platform-account-owner-talent"]',
    );
    expect(ownerPicker).not.toBeNull();
    if (!ownerPicker) {
      return;
    }
    await user.click(
      await within(ownerPicker as HTMLElement).findByRole('button', { name: /TAL-000001/ }),
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('platform-account:fields.handle')),
      '@wave5',
    );
    await user.click(
      createSurfaceScope.getByRole('button', {
        name: i18n.t('platform-account:mutations.create.submit'),
      }),
    );

    expect(await screen.findByText('PA-000501', {}, { timeout: 3000 })).toBeInTheDocument();

    const row = screen.getByText('PA-000501').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', { name: i18n.t('platform-account:actions.deactivate') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('PA-000501').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('platform-account:statuses.INACTIVE')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);
});
