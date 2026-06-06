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

const pt = (key: string, options?: Record<string, unknown>): string =>
  i18n.t(`work-schedule:monthlyRosters.preview.${key}`, options);

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

  it('renders member summaries by default, day details on demand, and collapsed fingerprint metadata', async () => {
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
    expect(screen.getByText(pt('copy.summaryFirst'))).toBeInTheDocument();
    expect(await screen.findByText(pt('summary.includedMembers'))).toBeInTheDocument();
    expect(screen.getAllByText(pt('summary.suppressed')).length).toBeGreaterThan(0);
    expect(screen.getByText(pt('issueSummary.title'))).toBeInTheDocument();

    const summaryTable = await screen.findByRole('table', { name: pt('memberTable.caption') });
    expect(within(summaryTable).getByText('Alice Nguyen')).toBeInTheDocument();
    expect(within(summaryTable).getByText('Binh Tran')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: pt('table.caption') })).not.toBeInTheDocument();

    await user.click(
      within(summaryTable).getAllByRole('button', { name: pt('actions.showDetails') })[0],
    );
    const detailTable = screen.getByRole('table', {
      name: pt('detail.memberCaption', { member: 'Alice Nguyen' }),
    });
    expect(within(detailTable).getByText(pt('rowKinds.STANDARD'))).toBeInTheDocument();
    expect(within(detailTable).getByText(pt('rowKinds.HOLIDAY_SUPPRESSED'))).toBeInTheDocument();

    const computedHash = 'computed-roster-draft-1';
    expect(screen.getAllByTitle(computedHash)).toHaveLength(2);
    for (const fingerprint of screen.getAllByTitle(computedHash)) {
      expect(fingerprint).not.toBeVisible();
    }
    await user.click(screen.getByText(pt('admin.title')));
    for (const fingerprint of screen.getAllByTitle(computedHash)) {
      expect(fingerprint).toBeVisible();
    }
    expect(screen.getAllByText(pt('freshness.generatedReady')).length).toBeGreaterThan(0);

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

  it('maps WORKING_TO_OFF and CHANGE_TIME preview rows through roster exception availability refs', async () => {
    const user = userEvent.setup();
    const sourceFields = {
      monthlyRosterId: 'roster-draft',
      subjectEmploymentProfileId: 'ep-001',
      status: 'ACTIVE' as const,
      title: null,
      workingMinutes: null,
      breakMinutes: null,
      studioResourceIds: [],
      reason: null,
      sourceNote: null,
      sourceAvailabilityBatchId: 'availability-batch-source',
      sourceAvailabilityType: 'UNAVAILABLE_FULL_DAY' as const,
      sourceAvailabilityTaxonomyCode: 'AUTHORIZED_LEAVE' as const,
      sourceAppliedAt: Date.parse('2026-05-01T00:00:00.000Z'),
      sourceApplyNote: 'Applied for preview source mapping',
      description: null,
      externalRef: null,
      removedAt: null,
      createdAt: Date.parse('2026-05-01T00:00:00.000Z'),
      updatedAt: Date.parse('2026-05-01T00:00:00.000Z'),
    };
    server.use(
      http.get('*/admin/work-schedule/rosters/roster-draft', () =>
        HttpResponse.json({
          data: baseRosterDetail({
            exceptionCount: 2,
            exceptions: [
              {
                ...sourceFields,
                rosterExceptionId: 'roster-exception-001',
                exceptionType: 'WORKING_TO_OFF',
                exceptionDate: '2026-05-12',
                startLocalTime: null,
                endLocalTime: null,
                sourceAvailabilityLineId: 'availability-line-off',
              },
              {
                ...sourceFields,
                rosterExceptionId: 'roster-exception-change',
                exceptionType: 'CHANGE_TIME',
                exceptionDate: '2026-05-13',
                startLocalTime: '10:00',
                endLocalTime: '19:00',
                sourceAvailabilityLineId: 'availability-line-time',
                sourceAvailabilityType: 'PREFERRED_TIME',
                sourceAvailabilityTaxonomyCode: 'SHIFT_CHANGE',
              },
            ],
          }),
        }),
      ),
    );

    renderRoute('/work-schedule/rosters/roster-draft?scope=global');

    expect(await screen.findByText(pt('copy.summaryFirst'))).toBeInTheDocument();
    const summaryTable = await screen.findByRole('table', { name: pt('memberTable.caption') });
    expect(
      screen.queryByRole('table', {
        name: pt('detail.memberCaption', { member: 'Alice Nguyen' }),
      }),
    ).not.toBeInTheDocument();
    const aliceRow = within(summaryTable).getByText('Alice Nguyen').closest('tr');
    expect(aliceRow).not.toBeNull();
    if (!aliceRow) {
      return;
    }
    await user.click(within(aliceRow).getByRole('button', { name: pt('actions.showDetails') }));

    const detailTable = screen.getByRole('table', {
      name: pt('detail.memberCaption', { member: 'Alice Nguyen' }),
    });
    expect(within(detailTable).getByText(/availability-line-off/)).toBeInTheDocument();
    expect(within(detailTable).getByText(/availability-line-time/)).toBeInTheDocument();
    expect(within(detailTable).getByText('roster-exception-001')).toBeInTheDocument();
    expect(within(detailTable).getByText('roster-exception-change')).toBeInTheDocument();
  });

  it('filters member summaries by issues, exceptions, and employee search', async () => {
    const user = userEvent.setup();
    renderRoute('/work-schedule/rosters/roster-draft?scope=global');

    const table = await screen.findByRole('table', { name: pt('memberTable.caption') });
    expect(within(table).getByText('Alice Nguyen')).toBeInTheDocument();
    expect(within(table).getByText('Binh Tran')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: pt('filters.issues') }));
    expect(within(table).getByText('Alice Nguyen')).toBeInTheDocument();
    expect(within(table).getByText('Binh Tran')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: pt('filters.exceptions') }));
    expect(within(table).getByText('Binh Tran')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: pt('filters.all') }));
    await user.type(screen.getByLabelText(pt('filters.employeeSearch')), 'ep-002');
    expect(within(table).queryByText('Alice Nguyen')).not.toBeInTheDocument();
    expect(within(table).getByText('Binh Tran')).toBeInTheDocument();
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
  targetType: 'ORG_UNIT',
  targetMode: 'EXACT_ONLY',
  targetOrgUnitId: 'ou-sales',
  targetTalentGroupId: null,
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
