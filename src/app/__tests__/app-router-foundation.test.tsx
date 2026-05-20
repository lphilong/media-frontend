import i18n from 'i18next';
import { act, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('app router foundation', () => {
  it('renders dashboard route inside admin shell', async () => {
    await setLocale(DEFAULT_LOCALE);

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/dashboard'],
    });

    await act(async () => {
      renderAppWithProviders(<RouterProvider router={router} />);
    });

    expect(
      await screen.findByRole(
        'heading',
        { name: i18n.t('dashboard-lite:page.title') },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    const actionRegion = await screen.findByTestId('page-action-region');
    await within(actionRegion).findByRole('button', {
      name: new RegExp(
        `${escapeRegex(i18n.t('common:actions.refresh'))}|${escapeRegex(i18n.t('dashboard-lite:actions.refreshing'))}`,
      ),
    });
    expect(actionRegion).toHaveTextContent(
      new RegExp(
        `${escapeRegex(i18n.t('common:actions.refresh'))}|${escapeRegex(i18n.t('dashboard-lite:actions.refreshing'))}`,
      ),
    );
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });

  it('renders Commission routes as real Wave 9 surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/commission/rules'],
    });

    renderAppWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByText('CRULE-000001', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('common:actions.stubAction'))).not.toBeInTheDocument();
  });
});
