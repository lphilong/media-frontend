import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { APP_PATHS } from '@app/router/paths';
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

const dashboardSnapshot = (
  todayEventCount: number,
  generatedAt = '2026-04-22T00:00:00.000Z',
  businessTimeZone = 'UTC',
) => {
  return {
    data: {
      generatedAt,
      businessDate: '2026-04-22',
      windows: {
        businessTimeZone,
        today: {
          startAtInclusive: 1_777_507_200_000,
          endAtExclusive: 1_777_593_600_000,
        },
        next7Days: {
          startAtInclusive: 1_777_507_200_000,
          endAtExclusive: 1_778_112_000_000,
        },
        trailing30Days: {
          startAtInclusive: 1_774_963_200_000,
          endAtExclusive: 1_777_555_200_000,
        },
        staleDrafts: {
          olderThanAtExclusive: 1_776_950_400_000,
        },
        contractExpiry30Days: {
          startDateInclusive: '2026-04-22',
          endDateInclusive: '2026-05-22',
        },
      },
      overview: {
        todayEventCount,
        draftRevenueEntryCount: 5,
        draftSettlementCount: 2,
        activeCommissionRuleCount: 7,
        expiringContractCount30d: 3,
      },
      operations: {
        todayEventCount,
        next7DayEventCount: 39,
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
        staleRevenueDraftCount: 2,
        staleSettlementDraftCount: 1,
        expiringContractCount30d: 3,
      },
    },
  };
};

const findDashboardSection = async (name: string): Promise<HTMLElement> => {
  const heading = await screen.findByRole('heading', { name });
  const section = heading.closest('section');

  if (!section) {
    throw new Error(`Dashboard section ${name} was not rendered`);
  }

  return section;
};

const findMetricLink = (label: string): HTMLElement => {
  return screen.getByRole('link', { name: new RegExp(label) });
};

const readMetricHref = (label: string): string => {
  const href = findMetricLink(label).getAttribute('href');

  if (!href) {
    throw new Error(`Metric link ${label} has no href`);
  }

  return href;
};

const expectMetricLinkQuery = (
  label: string,
  path: string,
  expectedParams: Record<string, string | number>,
) => {
  const href = readMetricHref(label);
  const [actualPath, query = ''] = href.split('?');
  const params = new URLSearchParams(query);

  expect(actualPath).toBe(path);
  expect(Array.from(params.keys()).sort()).toEqual(Object.keys(expectedParams).sort());

  Object.entries(expectedParams).forEach(([key, value]) => {
    expect(params.get(key)).toBe(String(value));
  });
};

describe('Dashboard Lite hardening', () => {
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

  it('renders Last updated from generatedAt using the backend business timezone', async () => {
    server.use(
      http.get('*/admin/dashboard-lite/snapshot', () =>
        HttpResponse.json(dashboardSnapshot(12, '2026-05-18T19:04:00.000Z', 'Asia/Ho_Chi_Minh')),
      ),
    );

    await renderDashboardRoute();

    expect(await screen.findByText('Last updated')).toBeInTheDocument();
    expect(screen.getByText('02:04 19-05-2026')).toBeInTheDocument();
    expect(screen.getByText('22-04-2026')).toBeInTheDocument();
    expect(screen.getByText('Auto-refreshes every 10 minutes.')).toBeInTheDocument();
  });

  it('shows inline refreshing state while refetching existing dashboard data', async () => {
    let requestCount = 0;
    let resolveRefresh: (() => void) | undefined;

    server.use(
      http.get('*/admin/dashboard-lite/snapshot', async () => {
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.json(dashboardSnapshot(12));
        }

        await new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        });

        return HttpResponse.json(dashboardSnapshot(14));
      }),
    );

    await renderDashboardRoute();

    expect((await screen.findAllByText('12')).length).toBeGreaterThan(0);
    const actionRegion = screen.getByTestId('page-action-region');
    await userEvent.click(
      within(actionRegion).getByRole('button', { name: i18n.t('common:actions.refresh') }),
    );

    expect((await screen.findAllByText('Refreshing…')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);

    await act(async () => {
      resolveRefresh?.();
    });

    expect((await screen.findAllByText('14')).length).toBeGreaterThan(0);
  });

  it('keeps previous dashboard content visible when a background refresh fails', async () => {
    let requestCount = 0;
    server.use(
      http.get('*/admin/dashboard-lite/snapshot', () => {
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.json(dashboardSnapshot(12));
        }

        return HttpResponse.json({ code: 'DASHBOARD_UNAVAILABLE' }, { status: 500 });
      }),
    );

    await renderDashboardRoute();

    expect((await screen.findAllByText('12')).length).toBeGreaterThan(0);
    const actionRegion = screen.getByTestId('page-action-region');
    await userEvent.click(
      within(actionRegion).getByRole('button', { name: i18n.t('common:actions.refresh') }),
    );

    expect(
      await screen.findByText(
        'Could not refresh dashboard. Showing the last loaded data.',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(
      screen.queryByText(i18n.t('dashboard-lite:states.loadErrorTitle')),
    ).not.toBeInTheDocument();
  });

  it('renders Dashboard Lite Batch 2B groups with source-backed metric placement', async () => {
    server.use(
      http.get('*/admin/dashboard-lite/snapshot', () => HttpResponse.json(dashboardSnapshot(12))),
    );

    await renderDashboardRoute();

    const needsReview = await findDashboardSection('Needs review');
    expect(within(needsReview).getByText('Items that may require follow-up.')).toBeInTheDocument();
    expect(within(needsReview).getByText('Stale revenue drafts')).toBeInTheDocument();
    expect(within(needsReview).getByText('Stale settlement drafts')).toBeInTheDocument();
    expect(within(needsReview).getByText('Contracts ending soon')).toBeInTheDocument();

    const workInProgress = await findDashboardSection('Work in progress');
    expect(
      within(workInProgress).getByText('Saved records that are not finalized yet.'),
    ).toBeInTheDocument();
    expect(within(workInProgress).getByText('Draft revenue entries')).toBeInTheDocument();
    expect(within(workInProgress).getByText('Draft settlements')).toBeInTheDocument();

    const finalizedResults = await findDashboardSection('Finalized results');
    expect(
      within(finalizedResults).getByText(
        'Completed records and active figures in the current reporting window.',
      ),
    ).toBeInTheDocument();
    expect(within(finalizedResults).getByText('Finalized revenue')).toBeInTheDocument();
    expect(within(finalizedResults).getByText('Reconciled revenue')).toBeInTheDocument();
    expect(within(finalizedResults).getByText('Finalized settlements')).toBeInTheDocument();
    expect(within(finalizedResults).getByText('Active commission rules')).toBeInTheDocument();

    const upcomingDates = await findDashboardSection('Upcoming dates');
    expect(
      within(upcomingDates).getByText('Events and contracts near the current business date.'),
    ).toBeInTheDocument();
    expect(within(upcomingDates).getByText('Events today')).toBeInTheDocument();
    expect(within(upcomingDates).getByText('Events in next 7 days')).toBeInTheDocument();
  });

  it('renders severity badges and section navigation without hiding sections', async () => {
    server.use(
      http.get('*/admin/dashboard-lite/snapshot', () => HttpResponse.json(dashboardSnapshot(12))),
    );

    await renderDashboardRoute();

    const sectionNav = await screen.findByRole('navigation', { name: 'Dashboard sections' });
    expect(within(sectionNav).getByRole('link', { name: 'Needs review' })).toHaveAttribute(
      'href',
      '#dashboard-needs-review',
    );
    expect(within(sectionNav).getByRole('link', { name: 'Work in progress' })).toHaveAttribute(
      'href',
      '#dashboard-work-in-progress',
    );
    expect(within(sectionNav).getByRole('link', { name: 'Finalized results' })).toHaveAttribute(
      'href',
      '#dashboard-finalized-results',
    );
    expect(within(sectionNav).getByRole('link', { name: 'Upcoming dates' })).toHaveAttribute(
      'href',
      '#dashboard-upcoming-dates',
    );

    const needsReview = await findDashboardSection('Needs review');
    const workInProgress = await findDashboardSection('Work in progress');
    const finalizedResults = await findDashboardSection('Finalized results');
    const upcomingDates = await findDashboardSection('Upcoming dates');

    expect(needsReview).toHaveAttribute('id', 'dashboard-needs-review');
    expect(workInProgress).toHaveAttribute('id', 'dashboard-work-in-progress');
    expect(finalizedResults).toHaveAttribute('id', 'dashboard-finalized-results');
    expect(upcomingDates).toHaveAttribute('id', 'dashboard-upcoming-dates');

    expect(within(needsReview).getAllByText('Needs review').length).toBeGreaterThan(1);
    expect(within(workInProgress).getAllByText('Pending').length).toBeGreaterThan(1);
    expect(within(finalizedResults).getAllByText('Finalized').length).toBeGreaterThan(1);
    expect(within(finalizedResults).getByText('Active')).toBeInTheDocument();
    expect(within(upcomingDates).getAllByText('Upcoming').length).toBeGreaterThan(1);

    expect(findMetricLink('Stale revenue drafts')).toHaveClass('border-rose-200');
    expect(findMetricLink('Draft revenue entries')).toHaveClass('border-amber-200');
    expect(findMetricLink('Finalized revenue')).toHaveClass('border-emerald-200');
    expect(findMetricLink('Events today')).toHaveClass('border-sky-200');

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('renders each metric once and applies exact Dashboard Lite links from backend window metadata', async () => {
    const response = dashboardSnapshot(12);
    const { windows } = response.data;

    server.use(http.get('*/admin/dashboard-lite/snapshot', () => HttpResponse.json(response)));

    await renderDashboardRoute();
    await screen.findByText('Stale revenue drafts');

    const metricLabels = [
      'Stale revenue drafts',
      'Stale settlement drafts',
      'Contracts ending soon',
      'Finalized revenue',
      'Reconciled revenue',
      'Finalized settlements',
      'Events today',
      'Events in next 7 days',
      'Draft revenue entries',
      'Draft settlements',
      'Active commission rules',
    ] as const;

    for (const label of metricLabels) {
      expect(screen.getAllByText(label)).toHaveLength(1);
    }

    expectMetricLinkQuery('Contracts ending soon', APP_PATHS.contractRecords, {
      status: 'ACTIVE',
      effectiveEndDateFrom: windows.contractExpiry30Days.startDateInclusive,
      effectiveEndDateTo: windows.contractExpiry30Days.endDateInclusive,
    });

    expectMetricLinkQuery('Events today', APP_PATHS.events, {
      statusGroup: 'ACTIVE',
      eventOverlapStartAt: windows.today.startAtInclusive,
      eventOverlapEndAt: windows.today.endAtExclusive,
    });

    expectMetricLinkQuery('Events in next 7 days', APP_PATHS.events, {
      statusGroup: 'ACTIVE',
      eventStartFromAt: windows.next7Days.startAtInclusive,
      eventStartToAt: windows.next7Days.endAtExclusive,
    });

    expectMetricLinkQuery('Stale revenue drafts', APP_PATHS.revenueEntries, {
      status: 'DRAFT',
      createdBeforeAt: windows.staleDrafts.olderThanAtExclusive,
    });

    expectMetricLinkQuery('Finalized revenue', APP_PATHS.revenueEntries, {
      status: 'FINALIZED',
      finalizedFromAt: windows.trailing30Days.startAtInclusive,
      finalizedToAt: windows.trailing30Days.endAtExclusive,
    });

    expectMetricLinkQuery('Reconciled revenue', APP_PATHS.revenueEntries, {
      status: 'RECONCILED',
      reconciledFromAt: windows.trailing30Days.startAtInclusive,
      reconciledToAt: windows.trailing30Days.endAtExclusive,
    });

    expectMetricLinkQuery('Stale settlement drafts', APP_PATHS.commissionSettlements, {
      status: 'DRAFT',
      createdBeforeAt: windows.staleDrafts.olderThanAtExclusive,
    });

    expectMetricLinkQuery('Finalized settlements', APP_PATHS.commissionSettlements, {
      status: 'FINALIZED',
      finalizedFromAt: windows.trailing30Days.startAtInclusive,
      finalizedToAt: windows.trailing30Days.endAtExclusive,
    });

    const expectedStatusLinks = [
      ['Draft revenue entries', `${APP_PATHS.revenueEntries}?status=DRAFT`],
      ['Draft settlements', `${APP_PATHS.commissionSettlements}?status=DRAFT`],
      ['Active commission rules', `${APP_PATHS.commissionRules}?status=ACTIVE`],
    ] as const;

    for (const [label, expectedPath] of expectedStatusLinks) {
      const link = screen.getByRole('link', { name: new RegExp(label) });
      expect(link).toHaveAttribute('href', expectedPath);
    }

    expect(
      new URLSearchParams(readMetricHref('Draft revenue entries').split('?')[1]).has(
        'createdBeforeAt',
      ),
    ).toBe(false);
    expect(
      new URLSearchParams(readMetricHref('Draft settlements').split('?')[1]).has('createdBeforeAt'),
    ).toBe(false);
    expect(
      Array.from(new URLSearchParams(readMetricHref('Active commission rules').split('?')[1])),
    ).toEqual([['status', 'ACTIVE']]);

    expect(screen.queryByText('startAtInclusive')).not.toBeInTheDocument();
    expect(screen.queryByText('endAtExclusive')).not.toBeInTheDocument();
    expect(screen.queryByText('olderThanAtExclusive')).not.toBeInTheDocument();
    expect(screen.queryByText('contractExpiry30Days')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Operations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Commercial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Attention' })).not.toBeInTheDocument();
  });

  it('renders helper text for key Batch 2B cards', async () => {
    server.use(
      http.get('*/admin/dashboard-lite/snapshot', () => HttpResponse.json(dashboardSnapshot(12))),
    );

    await renderDashboardRoute();
    await screen.findByText('Contracts ending soon');

    expect(
      screen.getByText('Active contracts ending within the next 30 days.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Revenue finalized in the dashboard reporting window.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Events scheduled for the current business date.')).toBeInTheDocument();
  });
});
