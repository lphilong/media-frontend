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

describe('user IA-1 surfaces', () => {
  it('renders the constrained User list and ignores unsupported scope-shaped query keys', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/users?state=PENDING&actorKind=STAFF&scope=global&scopeGrants=admin');

    expect(
      await screen.findByRole('heading', { name: i18n.t('user:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Staff User', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('staff@example.test')).toBeInTheDocument();
    expect(screen.queryByText('Archived User')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /link employment profile/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|password|session/i)).not.toBeInTheDocument();
  });

  it('renders detail data from the User detail route and keeps forbidden mutation ownership absent', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/users/user-admin');

    expect(await screen.findByText(i18n.t('user:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('auth0|admin')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('user:detail.boundaryNotice'))).toBeInTheDocument();

    expect(screen.getByRole('button', { name: i18n.t('user:actions.edit') })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: i18n.t('user:actions.setAuthLinkage') }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.disable') })).toBeEnabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.archive') })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /employment profile/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|password|session/i)).not.toBeInTheDocument();
  });

  it('supports create and lifecycle transition flows without User-owned Role assignment UI', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/users');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('user:actions.create'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('user:mutations.create.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const createSurfaceScope = within(createSurface);
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('user:fields.authSubject')),
      'auth0|ia-user',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('user:fields.displayName')),
      'IA User',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('user:fields.email')),
      'ia-user@example.test',
    );
    await user.click(
      createSurfaceScope.getByRole('button', {
        name: i18n.t('user:mutations.create.submit'),
      }),
    );

    expect(await screen.findByText('IA User', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();

    const row = screen.getByText('IA User').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(within(row).getByRole('button', { name: i18n.t('user:actions.activate') }));
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('IA User').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }

        expect(within(refreshedRow).getByText(i18n.t('user:statuses.ACTIVE'))).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);

  it('keeps User create and identity/access filters inspectable when the list request fails', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/users', () =>
        HttpResponse.json({ message: 'errors:transport.generic' }, { status: 500 }),
      ),
    );

    renderRoute('/users?state=PENDING&actorKind=STAFF&search=staff');

    expect(await screen.findByText(i18n.t('user:states.loadErrorTitle'))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.t('user:filters.searchPlaceholder'))).toHaveValue(
      'staff',
    );
    expect(screen.getByRole('combobox', { name: i18n.t('user:filters.state') })).toHaveValue(
      'PENDING',
    );
    expect(screen.getByRole('combobox', { name: i18n.t('user:filters.actorKind') })).toHaveValue(
      'STAFF',
    );

    await user.click(screen.getByRole('button', { name: i18n.t('user:actions.create') }));

    expect(
      await screen.findByRole('heading', { name: i18n.t('user:mutations.create.title') }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();
  });

  it('keeps archived users read-only and hides unsupported admin surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/users/user-archived');

    expect(await screen.findByText(i18n.t('user:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('user:detail.archivedReadOnly'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.edit') })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('user:actions.setAuthLinkage') }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.activate') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.disable') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.archive') })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /employment profile/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|password|session/i)).not.toBeInTheDocument();
  });
});
