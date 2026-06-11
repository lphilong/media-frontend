import i18n from 'i18next';
import { screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { RouteErrorPage } from '@app/router/system-pages';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

const BrokenRoute = (): JSX.Element => {
  throw new Error('Failed to fetch dynamically imported module');
};

describe('route error element', () => {
  it('renders a friendly reload affordance for route module failures', async () => {
    await setLocale(DEFAULT_LOCALE);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      { path: '/', element: <BrokenRoute />, errorElement: <RouteErrorPage /> },
    ]);
    renderAppWithProviders(<RouterProvider router={router} />);

    expect(await screen.findByText(i18n.t('errors:unexpected.title'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('common:actions.reload') }),
    ).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
