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

describe('talent wave 4 surfaces', () => {
  it('renders filtered list rows for query-driven Talent routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talents?operationalStatus=SUSPENDED&search=Bao&hasLinkedEmploymentProfile=false');

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('TAL-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('BaoStar', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('Alice Nguyen')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('talent:table.talentOrigin'))).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('talent:table.linkedEmploymentProfileId')),
    ).not.toBeInTheDocument();
  });

  it('uses a manager selector for the relationship filter while preserving the internal id', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const router = renderRoute(
      '/talents?operationalStatus=ACTIVE&managerEmploymentProfileId=ep-001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent:page.title') }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(i18n.t('talent:filters.managerEmploymentProfileIdPlaceholder')),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.t('talent:filters.searchPlaceholder'))).toBeTruthy();
    expect(
      screen.getByRole('combobox', { name: i18n.t('talent:filters.operationalStatus') }),
    ).toHaveValue('ACTIVE');
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'talent:filters.managerEmploymentProfileId',
        )}`,
      }),
    ).toBeInTheDocument();

    await openMoreFilters(user);

    const picker = await findPicker('talent-filter-manager');
    expect(await within(picker).findAllByText(/EP-000001/)).not.toHaveLength(0);

    await user.click(await within(picker).findByRole('button', { name: /EP-000001/ }));
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).toBe('ep-001');
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).not.toBe('EP-000001');
    });

    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'talent:filters.managerEmploymentProfileId',
        )}`,
      }),
    );
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).toBeNull();
    });

    await user.click(await within(picker).findByRole('button', { name: /EP-000001/ }));
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).toBe('ep-001');
    });

    const field = picker.closest('fieldset');
    expect(field).not.toBeNull();
    if (!field) {
      return;
    }

    await user.click(within(field).getByRole('button', { name: i18n.t('common:actions.clear') }));
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).toBeNull();
    });

    await user.click(await within(picker).findByRole('button', { name: /EP-000001/ }));
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).toBe('ep-001');
    });

    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.clearAll') }));
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('operationalStatus')).toBeNull();
      expect(params.get('managerEmploymentProfileId')).toBeNull();
    });
  });

  it('renders detail sections and constrained related navigation links', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talents/talent-001');

    expect(await screen.findByText(i18n.t('talent:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('TAL-000001')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice Nguyen' })).toHaveAttribute(
      'href',
      '/employment-profiles/ep-001',
    );
    expect(screen.getByRole('link', { name: 'Bao Tran' })).toHaveAttribute(
      'href',
      '/employment-profiles/ep-002',
    );

    const relatedLinks = screen.getAllByRole('link', {
      name: i18n.t('talent:related.openFilteredList'),
    });
    expect(relatedLinks.length).toBeGreaterThan(0);
    expect(
      relatedLinks.some((link) =>
        link.getAttribute('href')?.includes('/talent-groups?view=by-talent&talentId=talent-001'),
      ),
    ).toBe(true);
  });

  it('keeps lifecycle/action gating aligned and opens detail-first mutation surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talents/talent-003');

    expect(await screen.findByText(i18n.t('talent:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('talent:actions.suspend') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('talent:actions.reactivate') })).toBeEnabled();
    expect(screen.getByRole('button', { name: i18n.t('talent:actions.archive') })).toBeEnabled();

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent:actions.updateCommercialParticipation'),
      }),
    );
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('talent:mutations.commercialParticipation.title'),
      }),
    ).toBeInTheDocument();
  });

  it('supports create and lifecycle transitions from list/detail surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talents');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('talent:actions.create'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('talent:mutations.create.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const createSurfaceScope = within(createSurface);
    expect(createSurfaceScope.queryByLabelText(i18n.t('talent:fields.talentCode'))).toBeNull();
    expect(
      createSurfaceScope.getByText(i18n.t('talent:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.stageName')),
      'Wave 4 Talent',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.legalName')),
      'Wave Four Talent',
    );
    await user.selectOptions(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.talentOrigin')),
      'INTERNAL',
    );
    await user.click(
      createSurfaceScope.getByRole('button', {
        name: i18n.t('talent:mutations.create.submit'),
      }),
    );

    expect(await screen.findByText('TAL-001001', {}, { timeout: 3000 })).toBeInTheDocument();

    const row = screen.getByText('TAL-001001').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', { name: i18n.t('talent:actions.deactivate') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('TAL-001001').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('talent:statuses.INACTIVE')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);
});
