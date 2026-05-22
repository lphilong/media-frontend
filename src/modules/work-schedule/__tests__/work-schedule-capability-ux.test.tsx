import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { MonthlyRosterPublishReview } from '@modules/work-schedule/components/MonthlyRosterPublishReview';
import type {
  MonthlyRosterPreview,
  MonthlyRosterPublishResult,
  MonthlyRosterRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
  return router;
};

const commonCapabilityText = (key: string): string => i18n.t(`common:capabilities.${key}`);
const publishText = (key: string, options?: Record<string, unknown>): string =>
  i18n.t(`work-schedule:monthlyRosters.publish.${key}`, options);

type CapabilityResponseParams = {
  permissions?: string[];
  workScheduleScopes?: Array<'self' | 'team' | 'department' | 'global'>;
  status?: number;
};

const mockCapabilities = ({
  permissions = [],
  workScheduleScopes = [],
  status,
}: CapabilityResponseParams): void => {
  server.use(
    http.get('*/admin/me/capabilities', () => {
      if (status) {
        return HttpResponse.json({ message: 'Capability check failed' }, { status });
      }

      return HttpResponse.json({
        data: {
          id: 'capability-test-user',
          type: 'admin',
          context: 'ADMIN',
          isActive: true,
          roles: ['role-capability-test'],
          permissions,
          scopeGrants: {
            workSchedule: workScheduleScopes,
          },
          generatedAt: '2026-05-21T00:00:00.000Z',
        },
      });
    }),
  );
};

describe('work schedule capability UX hints', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('uses permission-only hints for Work Pattern actions', async () => {
    mockCapabilities({ permissions: [], workScheduleScopes: ['global'] });

    renderRoute('/work-schedule/patterns/pattern-draft');

    const edit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:patterns.actions.edit'),
    });
    await waitFor(() => expect(edit).toBeDisabled());
    expect(screen.getAllByText(commonCapabilityText('missingPermission')).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(commonCapabilityText('missingScope'))).not.toBeInTheDocument();
  });

  it('uses permission-only hints for Holiday Calendar actions', async () => {
    mockCapabilities({ permissions: [], workScheduleScopes: ['global'] });

    renderRoute('/work-schedule/holiday-calendars/holiday-calendar-draft');

    await screen.findByText('VN_DRAFT');
    const editButtons = await screen.findAllByRole('button', {
      name: i18n.t('work-schedule:holidayCalendars.actions.edit'),
    });
    const edit = editButtons.find(
      (button) => button.getAttribute('title') === commonCapabilityText('missingPermission'),
    );
    if (!edit) {
      throw new Error('Holiday Calendar action rail edit button was not found');
    }
    await waitFor(() => expect(edit).toBeDisabled());
    expect(screen.getAllByText(commonCapabilityText('missingPermission')).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(commonCapabilityText('missingScope'))).not.toBeInTheDocument();
  });

  it('disables Work Shift actions for missing permission while local status still wins', async () => {
    mockCapabilities({ permissions: [], workScheduleScopes: ['global'] });

    renderRoute('/work-shifts/work-shift-001');

    const edit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:actions.edit'),
    });
    await waitFor(() => expect(edit).toBeDisabled());
    expect(screen.getAllByText(commonCapabilityText('missingPermission')).length).toBeGreaterThan(
      0,
    );

    cleanup();
    renderRoute('/work-shifts/work-shift-archive');

    const archivedEdit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:actions.edit'),
    });
    expect(archivedEdit).toBeDisabled();
    expect(screen.getByText(i18n.t('work-schedule:detail.archivedReadOnly'))).toBeInTheDocument();
    expect(screen.queryByText(commonCapabilityText('missingPermission'))).not.toBeInTheDocument();
  });

  it('disables Monthly Roster actions for missing permission while local status still wins', async () => {
    mockCapabilities({
      permissions: ['workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });

    renderRoute('/work-schedule/rosters/roster-draft');

    const editDraft = await screen.findByRole('button', {
      name: i18n.t('work-schedule:monthlyRosters.actions.editDraft'),
    });
    await waitFor(() => expect(editDraft).toBeDisabled());
    expect(screen.getAllByText(commonCapabilityText('missingPermission')).length).toBeGreaterThan(
      0,
    );

    cleanup();
    renderRoute('/work-schedule/rosters/roster-published');

    const publishedEdit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:monthlyRosters.actions.editDraft'),
    });
    expect(publishedEdit).toBeDisabled();
    expect(screen.queryByText(commonCapabilityText('missingPermission'))).not.toBeInTheDocument();
  });

  it('scope-disables only when an explicit Work Shift requested scope is present', async () => {
    mockCapabilities({
      permissions: ['workSchedule.update', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['self'],
    });

    renderRoute('/work-shifts/work-shift-001?scope=team');

    const scopedEdit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:actions.edit'),
    });
    await waitFor(() => expect(scopedEdit).toBeDisabled());
    expect(screen.getAllByText(commonCapabilityText('missingScope')).length).toBeGreaterThan(0);

    cleanup();
    renderRoute('/work-shifts/work-shift-001');

    const unscopedEdit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:actions.edit'),
    });
    await waitFor(() => expect(unscopedEdit).toBeEnabled());
    expect(screen.queryByText(commonCapabilityText('missingScope'))).not.toBeInTheDocument();
  });

  it('scope-disables Monthly Roster actions only from explicit roster requested scope', async () => {
    mockCapabilities({
      permissions: ['workSchedule.update', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['department'],
    });

    renderRoute('/work-schedule/rosters/roster-draft?scope=global');

    const editDraft = await screen.findByRole('button', {
      name: i18n.t('work-schedule:monthlyRosters.actions.editDraft'),
    });
    await waitFor(() => expect(editDraft).toBeDisabled());
    expect(screen.getAllByText(commonCapabilityText('missingScope')).length).toBeGreaterThan(0);

    cleanup();
    renderRoute('/work-schedule/rosters/roster-draft');

    const unscopedEditDraft = await screen.findByRole('button', {
      name: i18n.t('work-schedule:monthlyRosters.actions.editDraft'),
    });
    await waitFor(() => expect(unscopedEditDraft).toBeEnabled());
  });

  it('keeps capability fetch failure non-fatal for Work Schedule actions', async () => {
    mockCapabilities({ status: 500 });

    renderRoute('/work-schedule/patterns/pattern-draft');

    const edit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:patterns.actions.edit'),
    });
    await waitFor(() => expect(edit).toBeEnabled());
  });
});

describe('monthly roster publish capability UX', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('keeps local readiness disabled reason ahead of capability disabled reason', async () => {
    mockCapabilities({ permissions: [], workScheduleScopes: ['global'] });
    mockRosterPreview(basePreview({ currentPreviewHash: 'old-hash' }));

    renderAppWithProviders(
      <MonthlyRosterPublishReview roster={baseRosterDetail()} scope="global" />,
    );

    expect(
      (await screen.findAllByText(publishText('disabledReasons.stale'))).length,
    ).toBeGreaterThan(0);
    const publishButton = screen.getByRole('button', {
      name: publishText('actions.openConfirmation'),
    });
    expect(publishButton).toBeDisabled();
    await waitFor(() =>
      expect(screen.queryByText(commonCapabilityText('missingPermission'))).not.toBeInTheDocument(),
    );
  });

  it('disables publish for missing permission only when locally publishable', async () => {
    mockCapabilities({ permissions: [], workScheduleScopes: ['global'] });
    mockRosterPreview(basePreview());

    renderAppWithProviders(
      <MonthlyRosterPublishReview roster={baseRosterDetail()} scope="global" />,
    );

    const publishButton = await screen.findByRole('button', {
      name: publishText('actions.openConfirmation'),
    });
    await waitFor(() => expect(publishButton).toBeDisabled());
    expect(screen.getByText(commonCapabilityText('missingPermission'))).toBeInTheDocument();
  });

  it('continues to publish with expectedPreviewHash from computedPreviewHash', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    mockCapabilities({
      permissions: ['workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });
    mockRosterPreview(
      basePreview({ currentPreviewHash: 'hash-computed', computedPreviewHash: 'hash-computed' }),
      async (request) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: basePublishResult({ computedPreviewHash: 'hash-computed' }),
        });
      },
    );

    renderAppWithProviders(
      <MonthlyRosterPublishReview roster={baseRosterDetail()} scope="global" />,
    );

    await user.click(
      await screen.findByRole('button', { name: publishText('actions.openConfirmation') }),
    );
    await user.click(screen.getByRole('button', { name: publishText('actions.confirm') }));

    await waitFor(() =>
      expect(capturedBody).toEqual({
        expectedPreviewHash: 'hash-computed',
        scope: 'global',
      }),
    );
  });
});

const mockRosterPreview = (
  preview: MonthlyRosterPreview,
  publishHandler?: (request: Request) => Promise<Response> | Response,
): void => {
  server.use(
    http.get('*/admin/work-schedule/rosters/roster-capability/preview', () =>
      HttpResponse.json({ data: preview }),
    ),
    http.post('*/admin/work-schedule/rosters/roster-capability/publish', async ({ request }) => {
      if (publishHandler) {
        return publishHandler(request);
      }

      return HttpResponse.json({ data: basePublishResult() });
    }),
  );
};

const baseRosterDetail = (overrides: Partial<MonthlyRosterRecord> = {}): MonthlyRosterRecord => ({
  monthlyRosterId: 'roster-capability',
  rosterCode: 'ROSTER_CAPABILITY',
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
  externalRef: 'MR-CAPABILITY',
  archivedAt: null,
  createdAt: Date.parse('2026-04-20T00:00:00.000Z'),
  updatedAt: Date.parse('2026-04-21T00:00:00.000Z'),
  previewHash: 'hash-clean',
  lastPreviewedAt: Date.parse('2026-04-21T00:00:00.000Z'),
  publishedAt: null,
  publishedByUserId: null,
  publishGenerationRunId: null,
  exceptions: [],
  ...overrides,
});

const basePreview = (overrides: Partial<MonthlyRosterPreview> = {}): MonthlyRosterPreview => ({
  monthlyRosterId: 'roster-capability',
  rosterMonth: '2026-05',
  timezone: 'Asia/Ho_Chi_Minh',
  departmentOrgUnitId: 'ou-sales',
  workPatternId: 'pattern-active',
  holidayCalendarId: 'holiday-calendar-active',
  rosterStatus: 'DRAFT',
  draftVersion: 1,
  currentPreviewHash: 'hash-clean',
  computedPreviewHash: 'hash-clean',
  eligibleProfiles: [
    {
      subjectEmploymentProfileId: 'ep-001',
      employmentStatus: 'ACTIVE',
      departmentOrgUnitId: 'ou-sales',
    },
  ],
  rows: [
    {
      previewRowId: 'preview-row-001',
      monthlyRosterId: 'roster-capability',
      rosterMonth: '2026-05',
      departmentOrgUnitId: 'ou-sales',
      subjectEmploymentProfileId: 'ep-001',
      localDate: '2026-05-04',
      rowKind: 'STANDARD',
      sourceExceptionId: null,
      sourceRosterSlotKey: 'MON-0900',
      startLocalTime: '09:00',
      endLocalTime: '17:00',
      shiftStartAt: Date.parse('2026-05-04T02:00:00.000Z'),
      shiftEndAt: Date.parse('2026-05-04T10:00:00.000Z'),
      workingMinutes: 480,
      breakMinutes: 60,
      holidayCalendarEntryId: null,
      holidayName: null,
      holidayEntryType: null,
      isCandidateShift: true,
      isSuppressed: false,
      conflicts: [],
      warnings: [],
      blockers: [],
    },
  ],
  summary: {
    totalEligibleProfiles: 1,
    totalStandardCandidateShifts: 1,
    totalHolidaySuppressions: 0,
    totalWorkingToOff: 0,
    totalChangeTime: 0,
    totalAddSpecialShift: 0,
    totalCandidateShiftsAfterExceptions: 1,
    totalConflicts: 0,
  },
  ...overrides,
});

const basePublishResult = (
  overrides: Partial<MonthlyRosterPublishResult> = {},
): MonthlyRosterPublishResult => ({
  monthlyRosterId: 'roster-capability',
  status: 'PUBLISHED',
  sourceGenerationRunId: 'source-generation-run-001',
  publishedAt: Date.parse('2026-05-31T00:00:00.000Z'),
  publishedByUserId: 'admin-001',
  generatedWorkShiftCount: 1,
  skippedWorkingToOffCount: 0,
  holidaySuppressedCount: 0,
  changeTimeCount: 0,
  addSpecialShiftCount: 0,
  conflictCount: 0,
  computedPreviewHash: 'hash-clean',
  generatedWorkShiftIds: [],
  ...overrides,
});
