import i18n from 'i18next';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import {
  fetchTalentKpiRecordsByEvent,
  fetchTalentKpiRecordsByPlatform,
  fetchTalentKpiRecordsByTalent,
} from '@modules/talent-kpi/api/talent-kpi.api';
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
    ['subjectTalentId', '/talent-kpi-records?subjectTalentId=talent-001', 'KPI-202604-000001'],
    [
      'attributionPlatformAccountId',
      '/talent-kpi-records?attributionPlatformAccountId=platform-001',
      'KPI-202604-000001',
    ],
    ['attributionEventId', '/talent-kpi-records?attributionEventId=event-001', 'KPI-202604-000001'],
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
    renderRoute('/talent-kpi-records?subjectTalentId=talent-001&search=KPI-202604-000001');

    expect(await screen.findByText('KPI-202604-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.t('talent-kpi:filters.searchPlaceholder'))).toHaveValue(
      'KPI-202604-000001',
    );
    expect(screen.queryByText(i18n.t('talent-kpi:relatedModes.by-talent'))).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expect(
      screen.getAllByText(i18n.t('talent-kpi:filters.subjectTalentId')).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'talent-kpi:filters.subjectTalentId',
        )}`,
      }),
    );
    expect(
      screen.queryByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'talent-kpi:filters.subjectTalentId',
        )}`,
      }),
    ).not.toBeInTheDocument();
  });

  it('clears stale Talent KPI selected reference labels when the option becomes unavailable', async () => {
    const user = userEvent.setup();
    renderRoute('/talent-kpi-records?subjectTalentId=talent-001');

    expect(await screen.findByText('KPI-202604-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));

    const appliedFilters = screen.getByLabelText(i18n.t('common:filters.appliedFilters'));
    await waitFor(() => expect(appliedFilters).toHaveTextContent('Mina - TAL-000001'));

    await user.type(
      screen.getByPlaceholderText(i18n.t('talent-kpi:filters.subjectTalentIdPlaceholder')),
      'missing-reference',
    );

    await waitFor(() => {
      expect(appliedFilters).toHaveTextContent('Luna Park');
      expect(appliedFilters).not.toHaveTextContent('Mina - TAL-000001');
    });
  });

  it('keeps target timestamp filters hidden but active through the flat-list URL', async () => {
    renderRoute(
      '/talent-kpi-records?status=FINALIZED&createdBeforeAt=1780000000000&publishedFromAt=1770000000000&publishedToAt=1780000000000',
    );

    expect(await screen.findByText('KPI-202604-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Created before:')).toBeInTheDocument();
    expect(screen.getByText('Published from:')).toBeInTheDocument();
    expect(screen.getByText('Published until:')).toBeInTheDocument();
    expect(screen.getAllByText(/20:26 28-05-2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/02:40 02-02-2026/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/1770000000000|1780000000000/)).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Created before' })).not.toBeInTheDocument();
  });

  it.each([
    [
      'by-talent',
      '/talent-kpi-records?view=by-talent&subjectTalentId=talent-001&search=KPI-202604-000001',
    ],
    [
      'by-platform',
      '/talent-kpi-records?view=by-platform&attributionPlatformAccountId=platform-001&search=KPI-202604-000001',
    ],
    [
      'by-event',
      '/talent-kpi-records?view=by-event&attributionEventId=event-001&search=KPI-202604-000001',
    ],
  ])('uses explicit %s related mode without related search', async (mode, path) => {
    renderRoute(path);

    expect(
      await screen.findByText(i18n.t(`talent-kpi:relatedModes.${mode}`), {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(i18n.t('talent-kpi:filters.searchPlaceholder')),
    ).not.toBeInTheDocument();
  });

  it('parses Talent KPI related endpoints with reduced backend shapes', async () => {
    const byTalent = await fetchTalentKpiRecordsByTalent({
      subjectTalentId: 'talent-001',
      limit: 1,
    });
    const byPlatform = await fetchTalentKpiRecordsByPlatform({
      attributionPlatformAccountId: 'platform-001',
      limit: 1,
    });
    const byEvent = await fetchTalentKpiRecordsByEvent({
      attributionEventId: 'event-001',
      limit: 10,
    });

    expect(byTalent.data[0]).toMatchObject({
      id: 'talent-kpi-record-001',
      kpiRecordCode: 'KPI-202604-000001',
      subjectTalentId: 'talent-001',
      measurementSource: 'MANUAL',
      publishedAt: null,
    });
    expect(byTalent.data[0]).not.toHaveProperty('createdAt');
    expect(byTalent.data[0]).not.toHaveProperty('subjectTalentRef');

    expect(byPlatform.data[0]).toMatchObject({
      id: 'talent-kpi-record-001',
      attributionPlatformAccountId: 'platform-001',
      status: 'DRAFT',
    });
    expect(byPlatform.data[0]).not.toHaveProperty('createdAt');
    expect(byPlatform.data[0]).not.toHaveProperty('measurementSource');

    const byEventRecord = byEvent.data.find((record) => record.id === 'talent-kpi-record-001');
    expect(byEventRecord).toMatchObject({
      id: 'talent-kpi-record-001',
      attributionEventId: 'event-001',
      status: 'DRAFT',
    });
    expect(byEventRecord).not.toHaveProperty('createdAt');
    expect(byEventRecord).not.toHaveProperty('publishedAt');
  });

  it('renders readable KPI attribution refs in list and detail without raw IDs', async () => {
    renderRoute('/talent-kpi-records');

    expect((await screen.findAllByText('Luna Park')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Luna TikTok').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Spring Live Show').length).toBeGreaterThan(0);
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(screen.queryByText('platform-001')).not.toBeInTheDocument();
    expect(screen.queryByText('event-001')).not.toBeInTheDocument();

    renderRoute('/talent-kpi-records/talent-kpi-record-001');

    expect(await screen.findByText(i18n.t('talent-kpi:actionRail.title'))).toBeInTheDocument();
    expect(screen.getAllByText('Luna Park').length).toBeGreaterThan(0);
    expect(screen.getAllByText('07:00 21-04-2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('07:00 22-04-2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Luna TikTok').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Spring Live Show').length).toBeGreaterThan(0);
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(screen.queryByText('platform-001')).not.toBeInTheDocument();
    expect(screen.queryByText('event-001')).not.toBeInTheDocument();
  });
});
