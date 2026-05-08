import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
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

describe('Revenue Ledger Wave 8 query mode selection', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it.each([
    ['subjectTalentId', '/revenue-entries?subjectTalentId=talent-001', 'REV001'],
    [
      'attributionPlatformAccountId',
      '/revenue-entries?attributionPlatformAccountId=platform-001',
      'REV001',
    ],
    ['attributionEventId', '/revenue-entries?attributionEventId=event-001', 'REV002'],
  ])('keeps flat %s identity filters in flat-list mode', async (_label, path, expectedCode) => {
    renderRoute(path);

    expect(
      await screen.findByRole('heading', { name: i18n.t('revenue-ledger:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText(expectedCode, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(i18n.t('revenue-ledger:filters.searchPlaceholder')),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('revenue-ledger:relatedModes.by-talent')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('revenue-ledger:relatedModes.by-platform')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('revenue-ledger:relatedModes.by-event')),
    ).not.toBeInTheDocument();
  });

  it('allows flat identity filters to coexist with flat-list search', async () => {
    renderRoute('/revenue-entries?subjectTalentId=talent-001&search=REV001');

    expect(await screen.findByText('REV001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(i18n.t('revenue-ledger:filters.searchPlaceholder')),
    ).toHaveValue('REV001');
    expect(
      screen.queryByText(i18n.t('revenue-ledger:relatedModes.by-talent')),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['by-talent', '/revenue-entries?view=by-talent&subjectTalentId=talent-001&search=REV001'],
    [
      'by-platform',
      '/revenue-entries?view=by-platform&attributionPlatformAccountId=platform-001&search=REV001',
    ],
    ['by-event', '/revenue-entries?view=by-event&attributionEventId=event-001&search=REV001'],
  ])('uses explicit %s related mode without related search', async (mode, path) => {
    renderRoute(path);

    expect(
      await screen.findByText(i18n.t(`revenue-ledger:relatedModes.${mode}`), {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(i18n.t('revenue-ledger:filters.searchPlaceholder')),
    ).not.toBeInTheDocument();
  });

  it('keeps Revenue Ledger create, search, and narrow sort controls available during list failure', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/revenue-entries', () =>
        HttpResponse.json({ message: 'errors:transport.generic' }, { status: 500 }),
      ),
    );

    renderRoute('/revenue-entries?search=REV001&sortBy=recognizedAt&sortDirection=desc');

    expect(
      await screen.findByText(i18n.t('revenue-ledger:states.loadErrorTitle')),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(i18n.t('revenue-ledger:filters.searchPlaceholder')),
    ).toHaveValue('REV001');
    expect(screen.getByLabelText(i18n.t('common:labels.sort'))).toHaveValue('recognizedAt');

    await user.click(screen.getByRole('button', { name: i18n.t('revenue-ledger:actions.create') }));

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('revenue-ledger:mutations.create.title'),
      }),
    ).toBeInTheDocument();
  });
});
