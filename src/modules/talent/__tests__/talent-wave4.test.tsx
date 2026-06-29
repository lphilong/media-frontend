import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  resetIdentityAccessMockData,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import { renderAppWithProviders } from '@test/render-app-route';

afterEach(() => {
  resetIdentityAccessMockData();
});

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

describe('talent wave 4 surfaces', () => {
  it('does not grant Talent list access from management responsibility alone', async () => {
    await setLocale(DEFAULT_LOCALE);
    setMockCurrentActorCapabilities({
      id: 'user-team-manager',
      type: 'admin',
      context: 'ADMIN',
      isActive: true,
      roles: ['TEAM_MANAGER'],
      permissions: ['talent.read', 'talentGroup.read'],
      scopeGrants: {
        workSchedule: ['self', 'team'],
        kpi: ['managedGroup'],
      },
      generatedAt: '2026-05-20T00:00:00.000Z',
    });

    renderRoute('/talents');

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('TAL-000001')).not.toBeInTheDocument();
  });

  it('renders an error state for TEAM_MANAGER unmanaged Talent detail', async () => {
    await setLocale(DEFAULT_LOCALE);
    setMockCurrentActorCapabilities({
      id: 'user-team-manager',
      type: 'admin',
      context: 'ADMIN',
      isActive: true,
      roles: ['TEAM_MANAGER'],
      permissions: ['talent.read', 'talentGroup.read'],
      scopeGrants: {
        workSchedule: ['self', 'team'],
        kpi: ['managedGroup'],
      },
      generatedAt: '2026-05-20T00:00:00.000Z',
    });

    renderRoute('/talents/talent-003');

    expect(
      await screen.findByText(i18n.t('errors:permission.title'), {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('talent:actionRail.title'))).not.toBeInTheDocument();
  });

  it('renders filtered list rows for query-driven Talent routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talents?operationalStatus=SUSPENDED&search=Bao&hasLinkedEmploymentProfile=false');

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('TAL-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('BaoStar', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('managerEmploymentProfileId')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('talent:table.talentOrigin'))).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('talent:table.linkedEmploymentProfileId')),
    ).not.toBeInTheDocument();
  });

  it('drops the deprecated manager filter from query-driven Talent routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    const router = renderRoute(
      '/talents?operationalStatus=ACTIVE&managerEmploymentProfileId=ep-001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent:page.title') }),
    ).toBeInTheDocument();
    expect(
      await screen.findByPlaceholderText(i18n.t('talent:filters.searchPlaceholder')),
    ).toBeTruthy();
    expect(
      await screen.findByRole('combobox', { name: i18n.t('talent:filters.operationalStatus') }),
    ).toHaveValue('ACTIVE');
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).toBeNull();
    });
    expect(screen.queryByText('managerEmploymentProfileId')).not.toBeInTheDocument();
  });

  it('renders detail sections and constrained related navigation links', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talents/talent-001');

    expect(await screen.findByText(i18n.t('talent:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('TAL-000001')).toBeInTheDocument();
    expect(screen.getAllByText('Bao').length).toBeGreaterThan(0);
    expect(screen.getByText('Mina Performance Alias')).toBeInTheDocument();
    expect(screen.queryByText('Stale Internal Legal')).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Internal Short')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bao' })).toHaveAttribute(
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

  it('resets Talent create state after host close and reopens in one click', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talents');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('talent:actions.create'),
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: i18n.t('talent:mutations.create.title'),
    });

    await user.click(within(dialog).getByRole('button', { name: i18n.t('common:actions.close') }));

    const createTrigger = await screen.findByRole('button', {
      name: i18n.t('talent:actions.create'),
    });
    expect(
      screen.queryByRole('dialog', {
        name: i18n.t('talent:mutations.create.title'),
      }),
    ).not.toBeInTheDocument();

    await user.click(createTrigger);

    expect(
      await screen.findByRole('dialog', {
        name: i18n.t('talent:mutations.create.title'),
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
    expect(createSurface).toHaveAttribute('data-mutation-presentation', 'drawer');

    const createSurfaceScope = within(createSurface);
    expect(createSurfaceScope.queryByLabelText(i18n.t('talent:fields.talentCode'))).toBeNull();
    expect(
      createSurfaceScope.getByText(i18n.t('talent:generatedCode.description')),
    ).toBeInTheDocument();
    await user.selectOptions(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.talentOrigin')),
      'INTERNAL',
    );
    expect(
      createSurfaceScope.getByLabelText(i18n.t('talent:fields.performanceAlias')),
    ).toBeInTheDocument();
    expect(createSurfaceScope.queryByLabelText(i18n.t('talent:fields.stageName'))).toBeNull();
    expect(
      createSurfaceScope.getByText(i18n.t('talent:referenceHelp.performanceAlias')),
    ).toBeInTheDocument();
    const linkedPicker = await findPicker('talent-linked-employment-profile');
    await user.click(await within(linkedPicker).findByText(/EP-000003/));
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
