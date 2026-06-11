import i18n from 'i18next';
import { Suspense } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { lazyRoute, loadRouteModuleWithRetry } from '@app/router/lazy-route';
import { RouteErrorPage } from '@app/router/system-pages';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { setMonitoringReporter } from '@shared/monitoring';
import { renderAppWithProviders } from '@test/render-app-route';

describe('lazy route resilience', () => {
  afterEach(() => {
    setMonitoringReporter(null);
  });

  it('retries a transient dynamic import failure once', async () => {
    const importer = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce('loaded');

    await expect(loadRouteModuleWithRetry(importer, { delayMs: 0 })).resolves.toBe('loaded');
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('does not retry failures that are unrelated to dynamic imports', async () => {
    const importer = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('Render failed'));

    await expect(loadRouteModuleWithRetry(importer, { delayMs: 0 })).rejects.toThrow(
      'Render failed',
    );
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('falls through to the route error UI and monitoring after the bounded retry', async () => {
    await setLocale(DEFAULT_LOCALE);
    const reporter = vi.fn();
    setMonitoringReporter(reporter);
    const importer = vi
      .fn<() => Promise<{ default: () => JSX.Element }>>()
      .mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
    const BrokenLazyRoute = lazyRoute(importer, { delayMs: 0 });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <Suspense fallback={<div>Loading</div>}>
            <BrokenLazyRoute />
          </Suspense>
        ),
        errorElement: <RouteErrorPage />,
      },
    ]);

    renderAppWithProviders(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('button', { name: i18n.t('common:actions.reload') }),
    ).toBeInTheDocument();
    await waitFor(() => expect(reporter).toHaveBeenCalledTimes(1));
    expect(importer).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});
