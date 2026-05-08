import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  renderAppWithProviders(<RouterProvider router={router} />, { queryClient });
};

describe('org unit wave 3 surfaces', () => {
  it('renders list rows for query-driven Org Unit routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/org-units?status=INACTIVE&search=OPS');

    expect(
      await screen.findByRole('heading', { name: i18n.t('org-unit:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('OPS', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('Operations', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders detail hierarchy and detail-first action surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/org-units/ou-root');

    expect(await screen.findByText(i18n.t('org-unit:actionRail.title'))).toBeInTheDocument();

    const activateButton = screen.getByRole('button', {
      name: i18n.t('org-unit:actions.activate'),
    });
    const deactivateButton = screen.getByRole('button', {
      name: i18n.t('org-unit:actions.deactivate'),
    });
    expect(activateButton).toBeDisabled();
    expect(deactivateButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: i18n.t('org-unit:actions.move') }));
    expect(await screen.findByText(i18n.t('org-unit:mutations.move.title'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('org-unit:fields.newParentOrgUnitId'))).toBeInTheDocument();
  });

  it('supports create and lifecycle mutation flows from list/detail surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/org-units');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('org-unit:actions.create'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('org-unit:mutations.create.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const createSurfaceScope = within(createSurface);
    await user.type(createSurfaceScope.getByLabelText(i18n.t('org-unit:fields.code')), 'WAVE3ORG');
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('org-unit:fields.name')),
      'Wave 3 Org',
    );
    await user.type(createSurfaceScope.getByLabelText(i18n.t('org-unit:fields.type')), 'TEAM');
    const displayOrderInput = createSurfaceScope.getByLabelText(
      i18n.t('org-unit:fields.displayOrder'),
    );
    await user.clear(displayOrderInput);
    await user.type(displayOrderInput, '17');
    await user.click(
      createSurfaceScope.getByRole('button', { name: i18n.t('org-unit:mutations.create.submit') }),
    );

    expect(await screen.findByText('WAVE3ORG', {}, { timeout: 3000 })).toBeInTheDocument();

    const row = screen.getByText('WAVE3ORG').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', { name: i18n.t('org-unit:actions.deactivate') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('WAVE3ORG').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }

        expect(within(refreshedRow).getByText(/inactive/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('keeps Org Unit create and query controls inspectable when the list request fails', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/org-units', () =>
        HttpResponse.json({ message: 'errors:transport.generic' }, { status: 500 }),
      ),
    );

    renderRoute('/org-units?status=INACTIVE&search=OPS');

    expect(await screen.findByText(i18n.t('org-unit:states.loadErrorTitle'))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.t('org-unit:filters.searchPlaceholder'))).toHaveValue(
      'OPS',
    );
    expect(screen.getByRole('combobox', { name: i18n.t('org-unit:filters.status') })).toHaveValue(
      'INACTIVE',
    );

    await user.click(screen.getByRole('button', { name: i18n.t('org-unit:actions.create') }));

    expect(
      await screen.findByRole('heading', { name: i18n.t('org-unit:mutations.create.title') }),
    ).toBeInTheDocument();
  });
});
