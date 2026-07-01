import i18n from 'i18next';
import { screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

type RouteSmokeCase = {
  path: string;
  surface: 'dashboard' | 'list-stub' | 'detail-stub' | 'real-list' | 'real-detail';
  entityId?: string;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const routeSmokeMatrix: RouteSmokeCase[] = [
  { path: '/dashboard', surface: 'dashboard' },
  { path: '/users', surface: 'real-list' },
  { path: '/users/user-admin', surface: 'real-detail' },
  { path: '/roles', surface: 'real-list' },
  { path: '/roles/role-admin', surface: 'real-detail' },
  { path: '/org-units', surface: 'real-list' },
  { path: '/org-units/ou-root', surface: 'real-detail' },
  { path: '/employment-profiles', surface: 'real-list' },
  {
    path: '/employment-profiles/ep-001',
    surface: 'real-detail',
  },
  { path: '/talents', surface: 'real-list' },
  { path: '/talents/talent-001', surface: 'real-detail' },
  { path: '/talent-groups', surface: 'real-list' },
  { path: '/talent-groups/group-001', surface: 'real-detail' },
  { path: '/platform-accounts', surface: 'real-list' },
  {
    path: '/platform-accounts/platform-001',
    surface: 'real-detail',
  },
  { path: '/studio-resources', surface: 'real-list' },
  {
    path: '/studio-resources/studio-001',
    surface: 'real-detail',
  },
  { path: '/work-shifts', surface: 'real-list' },
  { path: '/work-shifts/work-shift-001', surface: 'real-detail' },
  { path: '/work-schedule/patterns', surface: 'real-list' },
  { path: '/work-schedule/patterns/pattern-draft', surface: 'real-detail' },
  { path: '/work-schedule/holiday-calendars', surface: 'real-list' },
  {
    path: '/work-schedule/holiday-calendars/holiday-calendar-draft',
    surface: 'real-detail',
  },
  { path: '/work-schedule/rosters', surface: 'real-list' },
  { path: '/work-schedule/rosters/roster-draft', surface: 'real-detail' },
  { path: '/events', surface: 'real-list' },
  { path: '/events/event-001', surface: 'real-detail' },
  { path: '/contract-records', surface: 'real-list' },
  {
    path: '/contract-records/contract-record-001',
    surface: 'real-detail',
    entityId: 'contract-record-001',
  },
  { path: '/revenue-entries', surface: 'real-list' },
  {
    path: '/revenue-entries/revenue-entry-001',
    surface: 'real-detail',
    entityId: 'revenue-entry-001',
  },
  { path: '/commission/rules', surface: 'real-list' },
  {
    path: '/commission/rules/commission-rule-001',
    surface: 'real-detail',
    entityId: 'commission-rule-001',
  },
  { path: '/commission/settlements', surface: 'real-list' },
  {
    path: '/commission/settlements/commission-settlement-001',
    surface: 'real-detail',
    entityId: 'commission-settlement-001',
  },
];

describe('app route matrix smoke', () => {
  it.each(routeSmokeMatrix)(
    'renders expected shell surface for $path',
    async ({ path, surface, entityId }) => {
      await setLocale(DEFAULT_LOCALE);

      const router = createMemoryRouter(appRoutes, {
        initialEntries: [path],
      });

      renderAppWithProviders(<RouterProvider router={router} />);

      expect(await screen.findByTestId('admin-shell-main')).toBeInTheDocument();
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();

      const pageActionRegion = screen.getByTestId('page-action-region');

      if (surface === 'dashboard') {
        await within(pageActionRegion).findByRole(
          'button',
          {
            name: new RegExp(
              `${escapeRegex(i18n.t('common:actions.refresh'))}|${escapeRegex(
                i18n.t('dashboard-lite:actions.refreshing'),
              )}`,
            ),
          },
          { timeout: 3000 },
        );
        return;
      }

      if (surface === 'real-list') {
        expect(pageActionRegion).not.toHaveTextContent(i18n.t('common:actions.stubAction'));
        return;
      }

      if (surface === 'real-detail') {
        expect(pageActionRegion).not.toHaveTextContent(i18n.t('common:actions.stubAction'));
        await screen.findByText(
          path.startsWith('/users')
            ? i18n.t('user:actionRail.title')
            : path.startsWith('/roles')
              ? i18n.t('role:actionRail.title')
              : path.startsWith('/org-units')
                ? i18n.t('org-unit:actionRail.title')
                : path.startsWith('/employment-profiles')
                  ? i18n.t('employment-profile:actionRail.title')
                  : path.startsWith('/talents')
                    ? i18n.t('talent:actionRail.title')
                    : path.startsWith('/talent-groups')
                      ? i18n.t('talent-group:actionRail.title')
                      : path.startsWith('/platform-accounts')
                        ? i18n.t('platform-account:actionRail.title')
                        : path.startsWith('/studio-resources')
                          ? i18n.t('studio-resource:actionRail.title')
                          : path.startsWith('/work-shifts')
                            ? i18n.t('work-schedule:actionRail.title')
                            : path.startsWith('/work-schedule/patterns')
                              ? i18n.t('work-schedule:patterns.actionRail.title')
                              : path.startsWith('/work-schedule/holiday-calendars')
                                ? i18n.t('work-schedule:holidayCalendars.actionRail.title')
                                : path.startsWith('/work-schedule/rosters')
                                  ? i18n.t('work-schedule:monthlyRosters.actionRail.title')
                                  : path.startsWith('/events')
                                    ? i18n.t('event-assignment:actionRail.title')
                                  : path.startsWith('/revenue-entries')
                                        ? i18n.t('revenue-ledger:actionRail.title')
                                        : path.startsWith('/commission/rules')
                                          ? i18n.t('commission:rules.actionRail.title')
                                          : path.startsWith('/commission/settlements')
                                            ? i18n.t('commission:settlements.actionRail.title')
                                            : i18n.t('contract-registry:actionRail.title'),
          {},
          { timeout: 3000 },
        );
        return;
      }

      expect(pageActionRegion).toHaveTextContent(i18n.t('common:actions.stubAction'));

      if (surface === 'detail-stub') {
        expect(await screen.findByText(i18n.t('common:labels.recordId'))).toBeInTheDocument();
        expect(screen.getByText(entityId ?? '')).toBeInTheDocument();
      }
    },
  );
});
