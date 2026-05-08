import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { fetchMonthlyRosterPreview } from '@modules/work-schedule/api/work-schedule.api';
import type { MonthlyRosterRecord } from '@modules/work-schedule/types/work-schedule.types';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

const pt = (key: string): string => i18n.t(`work-schedule:monthlyRosters.preview.${key}`);

describe('monthly roster slice D preview', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('parses backend-shaped preview responses at the API seam', async () => {
    const preview = await fetchMonthlyRosterPreview('roster-draft', 'global');

    expect(preview.monthlyRosterId).toBe('roster-draft');
    expect(preview.draftVersion).toBeGreaterThan(0);
    expect(preview.computedPreviewHash).toMatch(/^computed-roster-draft/);
    expect(preview.summary.totalEligibleProfiles).toBe(2);
    expect(preview.rows.map((row) => row.rowKind)).toEqual(
      expect.arrayContaining([
        'STANDARD',
        'HOLIDAY_SUPPRESSED',
        'WORKING_TO_OFF',
        'CHANGE_TIME',
        'ADD_SPECIAL_SHIFT',
      ]),
    );
  });

  it('renders summary, rows, conflicts, blockers, and collapsed admin metadata without publish behavior', async () => {
    const user = userEvent.setup();
    let publishCalls = 0;
    let generatedCalls = 0;
    let approvalCalls = 0;
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-draft/publish', () => {
        publishCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
      http.post('*/admin/work-shifts/generated', () => {
        generatedCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
      http.post('*/admin/work-schedule/roster-change-requests', () => {
        approvalCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
    );

    renderRoute('/work-schedule/rosters/roster-draft?scope=global');

    expect(await screen.findByText('ROSTER_DRAFT', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(pt('copy.readOnly'))).toBeInTheDocument();
    expect(screen.getAllByText(pt('copy.noPublish')).length).toBeGreaterThan(0);
    expect(await screen.findByText(pt('summary.eligibleProfiles'))).toBeInTheDocument();
    expect(screen.getAllByText(pt('summary.standardCandidates')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt('summary.suppressed')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt('summary.blockers')).length).toBeGreaterThan(0);

    const table = await screen.findByRole('table', { name: pt('table.caption') });
    expect(within(table).getByText(pt('rowKinds.STANDARD'))).toBeInTheDocument();
    expect(within(table).getByText(pt('rowKinds.HOLIDAY_SUPPRESSED'))).toBeInTheDocument();
    expect(within(table).getByText(pt('rowKinds.WORKING_TO_OFF'))).toBeInTheDocument();
    expect(within(table).getByText(pt('rowKinds.CHANGE_TIME'))).toBeInTheDocument();
    expect(within(table).getAllByText(pt('rowKinds.ADD_SPECIAL_SHIFT')).length).toBeGreaterThan(0);
    expect(screen.getByText(pt('conflicts.kinds.SUBJECT_OVERLAP'))).toBeInTheDocument();
    expect(
      screen.getAllByText(pt('conflicts.kinds.CANDIDATE_SUBJECT_OVERLAP')).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(pt('conflicts.blocker')).length).toBeGreaterThan(0);

    const computedHash = 'computed-roster-draft-1';
    expect(screen.getByText(computedHash)).not.toBeVisible();
    await user.click(screen.getByText(pt('admin.title')));
    expect(screen.getByText(computedHash)).toBeVisible();
    expect(screen.getAllByText(pt('freshness.notPreviewed')).length).toBeGreaterThan(0);

    expect(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.publish.actions.openConfirmation'),
      }),
    ).toBeDisabled();
    expect(screen.queryByText(/approval|change request/i)).not.toBeInTheDocument();
    expect(publishCalls).toBe(0);
    expect(generatedCalls).toBe(0);
    expect(approvalCalls).toBe(0);
  });

  it('filters preview rows locally by conflict, exception, employee, and date range', async () => {
    const user = userEvent.setup();
    renderRoute('/work-schedule/rosters/roster-draft?scope=global');

    const table = await screen.findByRole('table', { name: pt('table.caption') });
    expect(within(table).getByText(pt('rows.reason.standard'))).toBeInTheDocument();

    await user.click(screen.getByLabelText(pt('filters.conflictOnly')));
    expect(within(table).queryByText(pt('rows.reason.standard'))).not.toBeInTheDocument();
    expect(within(table).getAllByText(pt('rowKinds.ADD_SPECIAL_SHIFT')).length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText(pt('filters.conflictOnly')));
    await user.click(screen.getByLabelText(pt('filters.exceptionOnly')));
    expect(within(table).queryByText(pt('rowKinds.STANDARD'))).not.toBeInTheDocument();
    expect(within(table).getByText(pt('rowKinds.WORKING_TO_OFF'))).toBeInTheDocument();

    await user.click(screen.getByLabelText(pt('filters.exceptionOnly')));
    await user.type(screen.getByLabelText(pt('filters.employeeSearch')), 'ep-002');
    expect(within(table).queryByText('ep-001')).not.toBeInTheDocument();
    expect(within(table).getAllByText('ep-002').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText(pt('filters.dateStart')), '2026-05-21');
    expect(screen.getByText(pt('states.emptyRows'))).toBeInTheDocument();
  });

  it('renders preview denial and validation blocker states cleanly', async () => {
    server.use(
      http.get('*/admin/work-schedule/rosters/forbidden-preview', () =>
        HttpResponse.json({ data: baseRosterDetail({ monthlyRosterId: 'forbidden-preview' }) }),
      ),
      http.get('*/admin/work-schedule/rosters/forbidden-preview/preview', () =>
        HttpResponse.json(
          { error: { code: 'PERMISSION_DENIED', message: 'errors:permission.message' } },
          { status: 403 },
        ),
      ),
      http.get('*/admin/work-schedule/rosters/blocker-preview', () =>
        HttpResponse.json({ data: baseRosterDetail({ monthlyRosterId: 'blocker-preview' }) }),
      ),
      http.get('*/admin/work-schedule/rosters/blocker-preview/preview', () =>
        HttpResponse.json(
          { message: 'work-schedule:monthlyRosters.preview.states.loadErrorMessage' },
          { status: 422 },
        ),
      ),
    );

    renderRoute('/work-schedule/rosters/forbidden-preview');
    expect(await screen.findByText('ROSTER_DRAFT', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(
      (await screen.findAllByText(i18n.t('errors:permission.title'), {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);

    cleanup();
    renderRoute('/work-schedule/rosters/blocker-preview');
    expect(
      (await screen.findAllByText(pt('states.loadErrorTitle'), {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(pt('states.loadErrorMessage')).length).toBeGreaterThan(0);
  });

  it('shows archived rosters as preview-unavailable without calling preview', async () => {
    let previewCalls = 0;
    server.use(
      http.get('*/admin/work-schedule/rosters/archived-roster', () =>
        HttpResponse.json({
          data: baseRosterDetail({ monthlyRosterId: 'archived-roster', status: 'ARCHIVED' }),
        }),
      ),
      http.get('*/admin/work-schedule/rosters/archived-roster/preview', () => {
        previewCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
    );

    renderRoute('/work-schedule/rosters/archived-roster');

    expect(
      await screen.findByText(pt('states.archivedUnavailable'), {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(previewCalls).toBe(0));
  });
});

const baseRosterDetail = (overrides: Partial<MonthlyRosterRecord> = {}): MonthlyRosterRecord => ({
  monthlyRosterId: 'roster-draft',
  rosterCode: 'ROSTER_DRAFT',
  rosterMonth: '2026-05',
  timezone: 'Asia/Ho_Chi_Minh',
  targetSubjectKind: 'EMPLOYMENT_PROFILE',
  targetOrgUnitMode: 'EXACT_ONLY',
  departmentOrgUnitId: 'ou-sales',
  workPatternId: 'pattern-active',
  holidayCalendarId: 'holiday-calendar-active',
  status: 'DRAFT',
  draftVersion: 1,
  exceptionCount: 0,
  description: 'Draft roster',
  externalRef: 'MR-DRAFT',
  archivedAt: null,
  createdAt: Date.parse('2026-04-20T00:00:00.000Z'),
  updatedAt: Date.parse('2026-04-21T00:00:00.000Z'),
  previewHash: null,
  lastPreviewedAt: null,
  publishedAt: null,
  publishedByUserId: null,
  publishGenerationRunId: null,
  exceptions: [],
  ...overrides,
});
