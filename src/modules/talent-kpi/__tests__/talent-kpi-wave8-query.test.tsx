import i18n from 'i18next';
import { screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

describe('Talent KPI Wave 8 query mode selection', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it.each([
    ['subjectTalentId', '/talent-kpi-records?subjectTalentId=talent-001', 'KPI001'],
    [
      'attributionPlatformAccountId',
      '/talent-kpi-records?attributionPlatformAccountId=platform-001',
      'KPI001',
    ],
    ['attributionEventId', '/talent-kpi-records?attributionEventId=event-001', 'KPI001'],
  ])('keeps flat %s identity filters in flat-list mode', async (_label, path, expectedCode) => {
    renderRoute(path);

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent-kpi:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText(expectedCode, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(i18n.t('talent-kpi:filters.searchPlaceholder')),
    ).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('talent-kpi:relatedModes.by-talent'))).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('talent-kpi:relatedModes.by-platform')),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('talent-kpi:relatedModes.by-event'))).not.toBeInTheDocument();
  });

  it('allows flat identity filters to coexist with flat-list search', async () => {
    renderRoute('/talent-kpi-records?subjectTalentId=talent-001&search=KPI001');

    expect(await screen.findByText('KPI001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.t('talent-kpi:filters.searchPlaceholder'))).toHaveValue(
      'KPI001',
    );
    expect(screen.queryByText(i18n.t('talent-kpi:relatedModes.by-talent'))).not.toBeInTheDocument();
  });

  it.each([
    ['by-talent', '/talent-kpi-records?view=by-talent&subjectTalentId=talent-001&search=KPI001'],
    [
      'by-platform',
      '/talent-kpi-records?view=by-platform&attributionPlatformAccountId=platform-001&search=KPI001',
    ],
    ['by-event', '/talent-kpi-records?view=by-event&attributionEventId=event-001&search=KPI001'],
  ])('uses explicit %s related mode without related search', async (mode, path) => {
    renderRoute(path);

    expect(
      await screen.findByText(i18n.t(`talent-kpi:relatedModes.${mode}`), {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(i18n.t('talent-kpi:filters.searchPlaceholder')),
    ).not.toBeInTheDocument();
  });
});
