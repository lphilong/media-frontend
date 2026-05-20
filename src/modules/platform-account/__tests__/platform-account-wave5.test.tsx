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

  return router;
};

const findPicker = async (pickerId: string): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(
      screen
        .getAllByTestId('picker-surface')
        .some((surface) => surface.getAttribute('data-picker-id') === pickerId),
    ).toBe(true);
  });
  const picker = screen
    .getAllByTestId('picker-surface')
    .find((surface) => surface.getAttribute('data-picker-id') === pickerId);
  if (!picker) {
    throw new Error(`Picker not found: ${pickerId}`);
  }
  return picker;
};

const openMoreFilters = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(
    screen.getByRole('button', {
      name: new RegExp(i18n.t('common:filters.moreFilters')),
    }),
  );
  expect(
    await screen.findByRole('heading', { name: i18n.t('common:filters.moreFilters') }),
  ).toBeInTheDocument();
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
    expect(screen.getAllByText('Mina').length).toBeGreaterThan(0);
    expect(screen.queryByText('Archived Platform')).not.toBeInTheDocument();
  });

  it('uses an owner selector for owner relationship filters while preserving owner id keys', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const router = renderRoute(
      '/platform-accounts?operationalStatus=ACTIVE&ownerTalentId=talent-001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('platform-account:page.title') }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(i18n.t('platform-account:filters.ownerIdPlaceholder')),
    ).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(i18n.t('platform-account:filters.searchPlaceholder')),
    ).toBeTruthy();
    expect(
      screen.getByRole('combobox', { name: i18n.t('platform-account:filters.operationalStatus') }),
    ).toHaveValue('ACTIVE');
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'platform-account:filters.ownerKind',
        )}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'platform-account:filters.ownerId',
        )}`,
      }),
    ).toBeInTheDocument();

    await openMoreFilters(user);

    expect(
      screen.getByRole('combobox', { name: i18n.t('platform-account:filters.ownerKind') }),
    ).toHaveValue('TALENT');

    const picker = await findPicker('platform-account-filter-owner-talent');
    expect(await within(picker).findAllByText(/TAL-000001/)).not.toHaveLength(0);

    await user.click(await within(picker).findByRole('button', { name: /TAL-000001/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('ownerTalentId')).toBe(
        'talent-001',
      );
      expect(new URLSearchParams(router.state.location.search).get('ownerTalentId')).not.toBe(
        'TAL-000001',
      );
    });

    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'platform-account:filters.ownerId',
        )}`,
      }),
    );
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('ownerTalentId')).toBeNull();
      expect(params.get('ownerKind')).toBe('TALENT');
    });

    await user.click(await within(picker).findByRole('button', { name: /TAL-000001/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('ownerTalentId')).toBe(
        'talent-001',
      );
    });

    const field = picker.closest('fieldset');
    expect(field).not.toBeNull();
    if (!field) {
      return;
    }

    await user.click(within(field).getByRole('button', { name: i18n.t('common:actions.clear') }));
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('ownerTalentId')).toBeNull();
      expect(params.get('ownerKind')).toBe('TALENT');
    });

    await user.click(await within(picker).findByRole('button', { name: /TAL-000001/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('ownerTalentId')).toBe(
        'talent-001',
      );
    });

    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.clearAll') }));
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('operationalStatus')).toBeNull();
      expect(params.get('ownerKind')).toBeNull();
      expect(params.get('ownerTalentId')).toBeNull();
    });
  });

  it('renders detail sections and constrained related navigation links', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/platform-accounts/platform-001');

    expect(
      await screen.findByText(i18n.t('platform-account:actionRail.title')),
    ).toBeInTheDocument();
    expect(screen.getByText('PA-000001')).toBeInTheDocument();
    expect(screen.getByText('@mina')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mina' })).toHaveAttribute(
      'href',
      '/talents/talent-001',
    );

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
    await user.selectOptions(
      createSurfaceScope.getByLabelText(i18n.t('platform-account:fields.platform')),
      'YOUTUBE',
    );
    await user.selectOptions(
      createSurfaceScope.getByLabelText(i18n.t('platform-account:fields.platformSurfaceType')),
      'ACCOUNT',
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
      'wave5',
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
