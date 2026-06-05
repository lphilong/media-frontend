import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { publishMonthlyRoster } from '@modules/work-schedule/api/work-schedule.api';
import type {
  MonthlyRosterPreview,
  MonthlyRosterPublishResult,
  MonthlyRosterRecord,
  WorkShiftListItem,
  WorkShiftRecord,
} from '@modules/work-schedule/types/work-schedule.types';
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
  i18n.t(`work-schedule:monthlyRosters.publish.${key}`, options);
const gt = (key: string): string => i18n.t(`work-schedule:monthlyRosters.generated.${key}`);
const st = (key: string): string => i18n.t(`work-schedule:sourceDetail.${key}`);

describe('monthly roster slice E publish and generated Work Shift linkage', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('publishes a current clean DRAFT preview with expectedPreviewHash and no unsupported body fields', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    let detailCalls = 0;
    let previewCalls = 0;
    server.use(
      http.get('*/admin/work-schedule/rosters/roster-clean', () => {
        detailCalls += 1;
        return HttpResponse.json({
          data: baseRosterDetail({ monthlyRosterId: 'roster-clean', previewHash: 'hash-clean' }),
        });
      }),
      http.get('*/admin/work-schedule/rosters/roster-clean/preview', () => {
        previewCalls += 1;
        return HttpResponse.json({
          data: basePreview({
            monthlyRosterId: 'roster-clean',
            currentPreviewHash: 'hash-clean',
            computedPreviewHash: 'hash-clean',
          }),
        });
      }),
      http.post('*/admin/work-schedule/rosters/roster-clean/publish', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: basePublishResult({
            monthlyRosterId: 'roster-clean',
            generatedWorkShiftIds: ['generated-work-shift-001'],
          }),
        });
      }),
    );

    renderRoute('/work-schedule/rosters/roster-clean?scope=global');

    expect(await screen.findByText('ROSTER_DRAFT', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(pt('copy.createShifts'))).toBeInTheDocument();
    expect(screen.getByText(pt('copy.reviewPreview'))).toBeInTheDocument();
    expect(screen.getByText(pt('copy.noUndo'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: pt('actions.openConfirmation') }));
    expect(screen.getByRole('heading', { name: pt('confirmation.title') })).toBeInTheDocument();
    expect(screen.getAllByText('2026-05').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ou-sales/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('pattern-active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('holiday-calendar-active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(pt('confirmation.issueCount', { conflicts: 0, blockers: 0 })).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(i18n.t('work-schedule:monthlyRosters.preview.freshness.generatedReady'))
        .length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: pt('actions.confirm') }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toEqual({
      expectedPreviewHash: 'hash-clean',
      scope: 'global',
    });
    expect(capturedBody).not.toHaveProperty('rows');
    expect(capturedBody).not.toHaveProperty('shiftCode');
    expect(capturedBody).not.toHaveProperty('sourceType');
    expect(capturedBody).not.toHaveProperty('sourceRosterId');
    expect(capturedBody).not.toHaveProperty('approvalStatus');
    expect(capturedBody).not.toHaveProperty('changeRequestId');
    expect(await screen.findByText(pt('feedback.successTitle'))).toBeInTheDocument();
    expect(screen.getByText(gt('title'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: gt('actions.openList') })).toHaveAttribute(
      'href',
      '/work-shifts?sourceType=ROSTER_GENERATED&sourceRosterId=roster-clean&scope=global',
    );
    await waitFor(() => {
      expect(detailCalls).toBeGreaterThan(1);
      expect(previewCalls).toBeGreaterThan(1);
    });
  });

  it('calls the publish API seam with expectedPreviewHash only from supported payload fields', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/admin/work-schedule/rosters/roster-api/publish', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: basePublishResult({ monthlyRosterId: 'roster-api' }),
        });
      }),
    );

    const result = await publishMonthlyRoster('roster-api', {
      expectedPreviewHash: 'hash-api',
      idempotencyKey: 'idem-001',
      note: 'Reviewed preview',
      scope: 'department',
    });

    expect(result.monthlyRosterId).toBe('roster-api');
    expect(capturedBody).toEqual({
      expectedPreviewHash: 'hash-api',
      idempotencyKey: 'idem-001',
      note: 'Reviewed preview',
      scope: 'department',
    });
    expect(capturedBody).not.toHaveProperty('rows');
    expect(capturedBody).not.toHaveProperty('generatedWorkShiftIds');
    expect(capturedBody).not.toHaveProperty('shiftCode');
    expect(capturedBody).not.toHaveProperty('sourceGenerationRunId');
    expect(capturedBody).not.toHaveProperty('approvalFields');
  });

  it.each([
    ['loading preview', 'loading', 'loading'],
    ['failed preview', HttpResponse.json({ message: 'Preview failed' }, { status: 422 }), 'error'],
    [
      'stale preview hash',
      basePreview({ currentPreviewHash: 'old-hash', computedPreviewHash: 'hash-clean' }),
      'stale',
    ],
    [
      'preview conflicts',
      basePreview({
        currentPreviewHash: 'hash-clean',
        computedPreviewHash: 'hash-clean',
        summary: { ...basePreview().summary, totalConflicts: 1 },
        rows: [
          {
            ...basePreview().rows[0],
            conflicts: [basePreviewConflict()],
          },
        ],
      }),
      'conflicts',
    ],
    [
      'preview blockers',
      basePreview({
        currentPreviewHash: 'hash-clean',
        computedPreviewHash: 'hash-clean',
        rows: [
          {
            ...basePreview().rows[0],
            blockers: ['SUBJECT_OVERLAP'],
          },
        ],
      }),
      'blockers',
    ],
  ] as const)(
    'disables publish when %s blocks readiness',
    async (_name, previewResponse, reasonKey) => {
      server.use(
        http.get('*/admin/work-schedule/rosters/roster-blocked', () =>
          HttpResponse.json({
            data: baseRosterDetail({
              monthlyRosterId: 'roster-blocked',
              previewHash: 'hash-clean',
            }),
          }),
        ),
        http.get('*/admin/work-schedule/rosters/roster-blocked/preview', () => {
          if (previewResponse === 'loading') {
            return delay(200).then(() =>
              HttpResponse.json({
                data: basePreview({
                  monthlyRosterId: 'roster-blocked',
                  currentPreviewHash: 'hash-clean',
                  computedPreviewHash: 'hash-clean',
                }),
              }),
            );
          }

          if (previewResponse instanceof Response) {
            return previewResponse;
          }

          return HttpResponse.json({
            data: {
              ...previewResponse,
              monthlyRosterId: 'roster-blocked',
              rows: previewResponse.rows.map((row) => ({
                ...row,
                monthlyRosterId: 'roster-blocked',
              })),
            },
          });
        }),
      );

      renderRoute('/work-schedule/rosters/roster-blocked');

      const publishButton = await screen.findByRole(
        'button',
        { name: pt('actions.openConfirmation') },
        { timeout: 5000 },
      );
      expect(publishButton).toBeDisabled();
      expect(
        (await screen.findAllByText(pt(`disabledReasons.${reasonKey}`), {}, { timeout: 5000 }))
          .length,
      ).toBeGreaterThan(0);
    },
  );

  it('allows first publish from a freshly computed preview when no stored fingerprint exists', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.get('*/admin/work-schedule/rosters/roster-first-publish', () =>
        HttpResponse.json({
          data: baseRosterDetail({
            monthlyRosterId: 'roster-first-publish',
            previewHash: null,
          }),
        }),
      ),
      http.get('*/admin/work-schedule/rosters/roster-first-publish/preview', () =>
        HttpResponse.json({
          data: basePreview({
            monthlyRosterId: 'roster-first-publish',
            currentPreviewHash: null,
            computedPreviewHash: 'fresh-computed-hash',
          }),
        }),
      ),
      http.post(
        '*/admin/work-schedule/rosters/roster-first-publish/publish',
        async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            data: basePublishResult({ monthlyRosterId: 'roster-first-publish' }),
          });
        },
      ),
    );

    renderRoute('/work-schedule/rosters/roster-first-publish?scope=global');

    const reviewButton = await screen.findByRole(
      'button',
      { name: pt('actions.openConfirmation') },
      { timeout: 5000 },
    );
    await waitFor(() => expect(reviewButton).toBeEnabled());
    expect(screen.queryByText(/save preview|preview has not been saved/i)).not.toBeInTheDocument();

    await user.click(reviewButton);
    await user.click(screen.getByRole('button', { name: pt('actions.confirm') }));
    await waitFor(() =>
      expect(capturedBody).toEqual({
        expectedPreviewHash: 'fresh-computed-hash',
        scope: 'global',
      }),
    );
  });

  it.each([
    ['PUBLISHED', 'alreadyPublished'],
    ['ARCHIVED', 'unavailable'],
  ] as const)(
    'keeps %s rosters read-only with a disabled publish action',
    async (status, stateKey) => {
      server.use(
        http.get('*/admin/work-schedule/rosters/roster-read-only', () =>
          HttpResponse.json({
            data: baseRosterDetail({
              monthlyRosterId: 'roster-read-only',
              status,
              publishedAt: status === 'PUBLISHED' ? Date.parse('2026-05-31T00:00:00.000Z') : null,
              publishedByUserId: status === 'PUBLISHED' ? 'admin-001' : null,
              publishGenerationRunId: status === 'PUBLISHED' ? 'generation-run-001' : null,
            }),
          }),
        ),
      );

      renderRoute('/work-schedule/rosters/roster-read-only');

      expect(
        await screen.findByText(pt(`states.${stateKey}`), {}, { timeout: 5000 }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: pt('actions.openConfirmation') })).toBeDisabled();
    },
  );

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [422, 'stalePreview'],
    [409, 'conflict'],
  ] as const)('renders publish HTTP %s errors cleanly', async (status, errorKey) => {
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/work-schedule/rosters/roster-error', () =>
        HttpResponse.json({
          data: baseRosterDetail({ monthlyRosterId: 'roster-error', previewHash: 'hash-clean' }),
        }),
      ),
      http.get('*/admin/work-schedule/rosters/roster-error/preview', () =>
        HttpResponse.json({
          data: basePreview({
            monthlyRosterId: 'roster-error',
            currentPreviewHash: 'hash-clean',
            computedPreviewHash: 'hash-clean',
          }),
        }),
      ),
      http.post('*/admin/work-schedule/rosters/roster-error/publish', () =>
        HttpResponse.json(
          {
            message:
              status === 422
                ? 'expectedPreviewHash does not match current preview hash'
                : 'Publish denied',
          },
          { status },
        ),
      ),
    );

    renderRoute('/work-schedule/rosters/roster-error');

    await user.click(
      await screen.findByRole(
        'button',
        { name: pt('actions.openConfirmation') },
        { timeout: 5000 },
      ),
    );
    await user.click(screen.getByRole('button', { name: pt('actions.confirm') }));

    expect(await screen.findByText(pt('errors.title'))).toBeInTheDocument();
    expect(screen.getByText(pt(`errors.${errorKey}`))).toBeInTheDocument();

    cleanup();
  });

  it('renders Manual and Generated from monthly roster sources in Work Shift list and detail', async () => {
    const user = userEvent.setup();
    let capturedListSearch = '';
    server.use(
      http.get('*/admin/work-shifts', ({ request }) => {
        capturedListSearch = new URL(request.url).search;
        return HttpResponse.json({
          data: [generatedWorkShiftListItem(), manualWorkShiftListItem()],
          meta: undefined,
        });
      }),
      http.get('*/admin/work-shifts/generated-work-shift-001', () =>
        HttpResponse.json({ data: generatedWorkShiftDetail() }),
      ),
      http.get('*/admin/work-shifts/manual-work-shift-001', () =>
        HttpResponse.json({ data: manualWorkShiftDetail() }),
      ),
    );

    renderRoute('/work-shifts?sourceRosterId=roster-clean&unsupportedFilter=1');

    expect(await screen.findByText('SHIFT-MANUAL')).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('work-schedule:sourceLabels.ROSTER_GENERATED')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t('work-schedule:sourceLabels.MANUAL'))).toBeInTheDocument();
    expect(capturedListSearch).toContain('sourceType=ROSTER_GENERATED');
    expect(capturedListSearch).toContain('sourceRosterId=roster-clean');
    expect(capturedListSearch).not.toContain('unsupportedFilter');

    cleanup();
    renderRoute('/work-shifts/generated-work-shift-001');

    expect(await screen.findByRole('heading', { name: st('title') })).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('work-schedule:sourceLabels.ROSTER_GENERATED')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'roster-clean' })).toHaveAttribute(
      'href',
      '/work-schedule/rosters/roster-clean',
    );
    expect(screen.getByRole('link', { name: 'pattern-active' })).toHaveAttribute(
      'href',
      '/work-schedule/patterns/pattern-active',
    );
    expect(screen.getByText('roster-exception-001')).not.toBeVisible();
    await user.click(screen.getByText(st('adminMetadata')));
    expect(screen.getByText('roster-exception-001')).toBeVisible();

    cleanup();
    renderRoute('/work-shifts/manual-work-shift-001');

    expect(
      await screen.findByText(i18n.t('work-schedule:sourceLabels.MANUAL')),
    ).toBeInTheDocument();
    expect(screen.queryByText('source-generation-run-001')).not.toBeInTheDocument();
  });

  it('keeps source metadata out of manual Work Shift create forms', async () => {
    const user = userEvent.setup();
    renderRoute('/work-shifts');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('work-schedule:actions.scheduleWorkShift'),
      }),
    );
    expect(
      screen.queryByRole('button', { name: /admin|technical|kỹ thuật|ky thuat/i }),
    ).not.toBeInTheDocument();

    const createHeading = await screen.findByRole('heading', {
      name: i18n.t('work-schedule:task.title'),
    });
    const createSurface = createHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    expect(within(createSurface).queryByLabelText(st('fields.sourceType'))).not.toBeInTheDocument();
    expect(
      within(createSurface).queryByLabelText(st('fields.sourceRosterId')),
    ).not.toBeInTheDocument();
    expect(
      within(createSurface).queryByLabelText(st('fields.sourceGenerationRunId')),
    ).not.toBeInTheDocument();
  });
});

const baseRosterDetail = (overrides: Partial<MonthlyRosterRecord> = {}): MonthlyRosterRecord => ({
  monthlyRosterId: 'roster-clean',
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

const basePreviewConflict = () => ({
  conflictKind: 'SUBJECT_OVERLAP' as const,
  workShiftId: 'work-shift-001',
  relatedPreviewRowId: null,
  shiftCode: 'SHIFT001',
  title: 'Existing shift',
  status: 'ACTIVE' as const,
  shiftStartAt: Date.parse('2026-05-04T02:00:00.000Z'),
  shiftEndAt: Date.parse('2026-05-04T10:00:00.000Z'),
  sourceType: 'MANUAL' as const,
  sourceRosterId: null,
  sourceRosterMonth: null,
  sourceRosterLocalDate: null,
  sourceRosterSlotKey: null,
});

const basePreview = (overrides: Partial<MonthlyRosterPreview> = {}): MonthlyRosterPreview => ({
  monthlyRosterId: 'roster-clean',
  rosterMonth: '2026-05',
  timezone: 'Asia/Ho_Chi_Minh',
  targetType: 'ORG_UNIT',
  targetMode: 'EXACT_ONLY',
  targetOrgUnitId: 'ou-sales',
  targetTalentGroupId: null,
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
    {
      subjectEmploymentProfileId: 'ep-002',
      employmentStatus: 'ACTIVE',
      departmentOrgUnitId: 'ou-sales',
    },
  ],
  excludedMembers: [],
  rows: [
    {
      previewRowId: 'preview-row-001',
      monthlyRosterId: 'roster-clean',
      rosterMonth: '2026-05',
      targetType: 'ORG_UNIT',
      targetMode: 'EXACT_ONLY',
      targetOrgUnitId: 'ou-sales',
      targetTalentGroupId: null,
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
    {
      previewRowId: 'preview-row-002',
      monthlyRosterId: 'roster-clean',
      rosterMonth: '2026-05',
      targetType: 'ORG_UNIT',
      targetMode: 'EXACT_ONLY',
      targetOrgUnitId: 'ou-sales',
      targetTalentGroupId: null,
      departmentOrgUnitId: 'ou-sales',
      subjectEmploymentProfileId: 'ep-002',
      localDate: '2026-05-05',
      rowKind: 'STANDARD',
      sourceExceptionId: null,
      sourceRosterSlotKey: 'TUE-0900',
      startLocalTime: '09:00',
      endLocalTime: '17:00',
      shiftStartAt: Date.parse('2026-05-05T02:00:00.000Z'),
      shiftEndAt: Date.parse('2026-05-05T10:00:00.000Z'),
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
    totalEligibleProfiles: 2,
    includedMemberCount: 2,
    excludedMemberCount: 0,
    totalStandardCandidateShifts: 2,
    totalHolidaySuppressions: 0,
    totalWorkingToOff: 0,
    totalChangeTime: 0,
    totalAddSpecialShift: 0,
    totalCandidateShiftsAfterExceptions: 2,
    totalConflicts: 0,
  },
  warnings: [],
  ...overrides,
});

const basePublishResult = (
  overrides: Partial<MonthlyRosterPublishResult> = {},
): MonthlyRosterPublishResult => ({
  monthlyRosterId: 'roster-clean',
  status: 'PUBLISHED',
  sourceGenerationRunId: 'source-generation-run-001',
  publishedAt: Date.parse('2026-05-31T00:00:00.000Z'),
  publishedByUserId: 'admin-001',
  generatedWorkShiftCount: 2,
  skippedWorkingToOffCount: 0,
  holidaySuppressedCount: 0,
  changeTimeCount: 0,
  addSpecialShiftCount: 0,
  conflictCount: 0,
  computedPreviewHash: 'hash-clean',
  generatedWorkShiftIds: [],
  ...overrides,
});

const manualWorkShiftListItem = (): WorkShiftListItem => ({
  id: 'manual-work-shift-001',
  shiftCode: 'SHIFT-MANUAL',
  title: 'Manual shift',
  subjectKind: 'EMPLOYMENT_PROFILE',
  subjectEmploymentProfileId: 'ep-001',
  subjectTalentId: null,
  subjectTalentGroupId: null,
  status: 'ACTIVE',
  shiftStartAt: Date.parse('2026-05-04T02:00:00.000Z'),
  shiftEndAt: Date.parse('2026-05-04T10:00:00.000Z'),
  createdAt: Date.parse('2026-04-20T00:00:00.000Z'),
  sourceType: 'MANUAL',
  sourceRosterId: null,
  sourceRosterMonth: null,
  sourceRosterLocalDate: null,
  sourceRosterSlotKey: null,
});

const generatedWorkShiftListItem = (): WorkShiftListItem => ({
  ...manualWorkShiftListItem(),
  id: 'generated-work-shift-001',
  shiftCode: 'GEN-001',
  title: 'Generated roster shift',
  sourceType: 'ROSTER_GENERATED',
  sourceRosterId: 'roster-clean',
  sourceRosterMonth: '2026-05',
  sourceRosterLocalDate: '2026-05-04',
  sourceRosterSlotKey: 'MON-0900',
});

const manualWorkShiftDetail = (): WorkShiftRecord => ({
  ...manualWorkShiftListItem(),
  studioResourceIds: ['studio-001'],
  description: null,
  externalRef: null,
  updatedAt: Date.parse('2026-04-20T00:00:00.000Z'),
  sourcePatternId: null,
  sourceExceptionId: null,
  sourceGenerationRunId: null,
  sourceDepartmentOrgUnitId: null,
});

const generatedWorkShiftDetail = (): WorkShiftRecord => ({
  ...generatedWorkShiftListItem(),
  studioResourceIds: ['studio-001'],
  description: null,
  externalRef: null,
  updatedAt: Date.parse('2026-04-20T00:00:00.000Z'),
  sourcePatternId: 'pattern-active',
  sourceExceptionId: 'roster-exception-001',
  sourceGenerationRunId: 'source-generation-run-001',
  sourceDepartmentOrgUnitId: 'ou-sales',
});
