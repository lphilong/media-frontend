import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const renderDashboardRoute = async () => {
  await setLocale('en');
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/dashboard'],
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

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />, { queryClient });
  });
};

const dashboardSnapshot = (todayEventCount: number) => ({
  data: {
    generatedAt: '2026-04-22T00:00:00.000Z',
    businessDate: '2026-04-22',
    overview: {
      todayEventCount,
      draftTalentKpiCount: 4,
      draftRevenueEntryCount: 5,
      draftSettlementCount: 2,
      activeCommissionRuleCount: 7,
      expiringContractCount30d: 3,
    },
    operations: {
      todayEventCount,
      next7DayEventCount: 39,
      draftTalentKpiCount: 4,
      finalizedTalentKpiCount30d: 24,
    },
    commercial: {
      draftRevenueEntryCount: 5,
      finalizedRevenueAmount30d: 2024.5,
      reconciledRevenueAmount30d: 1999.25,
      draftSettlementCount: 2,
      finalizedSettlementAmount30d: 905.4,
      activeCommissionRuleCount: 7,
    },
    attention: {
      staleTalentKpiDraftCount: 1,
      staleRevenueDraftCount: 2,
      staleSettlementDraftCount: 1,
      expiringContractCount30d: 3,
    },
  },
});

describe('Dashboard Lite Wave 10 hardening', () => {
  it.each([401, 403])(
    'renders a dedicated denied state for backend canonical %i failures',
    async (status) => {
      server.use(
        http.get('*/admin/dashboard-lite/snapshot', () =>
          HttpResponse.json(
            {
              error: {
                code: status === 401 ? 'UNAUTHORIZED' : 'DASHBOARD_SCOPE_DENIED',
                message: 'Dashboard scope denied',
              },
              meta: {
                requestId: `req-dashboard-denied-${status}`,
              },
            },
            { status },
          ),
        ),
      );

      await renderDashboardRoute();

      expect(
        await screen.findByText(i18n.t('errors:permission.title'), {}, { timeout: 3000 }),
      ).toBeInTheDocument();
      expect(screen.getByText(i18n.t('errors:permission.message'))).toBeInTheDocument();
    },
  );

  it('renders a dedicated not-found state for backend 404 failures', async () => {
    server.use(
      http.get('*/admin/dashboard-lite/snapshot', () =>
        HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 }),
      ),
    );

    await renderDashboardRoute();

    expect(await screen.findByText(i18n.t('errors:notFound.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('errors:notFound.message'))).toBeInTheDocument();
  });

  it('keeps generic dashboard failures retryable', async () => {
    server.use(
      http.get('*/admin/dashboard-lite/snapshot', () =>
        HttpResponse.json({ code: 'DASHBOARD_UNAVAILABLE' }, { status: 500 }),
      ),
    );

    await renderDashboardRoute();

    expect(
      await screen.findByText(i18n.t('dashboard-lite:states.loadErrorTitle')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('common:actions.retry') }),
    ).toBeInTheDocument();
  });

  it('preserves success rendering and refresh behavior', async () => {
    let requestCount = 0;
    server.use(
      http.get('*/admin/dashboard-lite/snapshot', () => {
        requestCount += 1;
        return HttpResponse.json(dashboardSnapshot(requestCount === 1 ? 12 : 13));
      }),
    );

    await renderDashboardRoute();

    expect((await screen.findAllByText('12')).length).toBeGreaterThan(0);
    const actionRegion = screen.getByTestId('page-action-region');
    await userEvent.click(
      within(actionRegion).getByRole('button', { name: i18n.t('common:actions.refresh') }),
    );

    expect((await screen.findAllByText('13')).length).toBeGreaterThan(0);
  });
});
