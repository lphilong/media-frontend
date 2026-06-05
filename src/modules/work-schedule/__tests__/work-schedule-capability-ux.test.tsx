import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
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

const publishText = (key: string, options?: Record<string, unknown>): string =>
  i18n.t(`work-schedule:monthlyRosters.publish.${key}`, options);

type CapabilityResponseParams = {
  id?: string;
  roles?: string[];
  type?: 'admin' | 'staff';
  permissions?: string[];
  workScheduleScopes?: Array<'self' | 'team' | 'department' | 'global'>;
  status?: number;
};

const mockCapabilities = ({
  id = 'capability-test-user',
  roles = ['role-capability-test'],
  type = 'admin',
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
          id,
          type,
          context: 'ADMIN',
          isActive: true,
          roles,
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

  it('hides Work Pattern actions when mutation permission is missing', async () => {
    mockCapabilities({ permissions: ['workSchedule.read'], workScheduleScopes: ['global'] });

    renderRoute('/work-schedule/patterns/pattern-draft');

    await screen.findByText('PATTERN_DRAFT');
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.edit'),
      }),
    ).not.toBeInTheDocument();
  });

  it('hides Holiday Calendar actions when mutation permission is missing', async () => {
    mockCapabilities({ permissions: ['workSchedule.read'], workScheduleScopes: ['global'] });

    renderRoute('/work-schedule/holiday-calendars/holiday-calendar-draft');

    await screen.findByText('VN_DRAFT');
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:holidayCalendars.actions.edit'),
      }),
    ).not.toBeInTheDocument();
  });

  it('hides Work Shift actions for missing permission while local status still wins', async () => {
    mockCapabilities({ permissions: ['workSchedule.read'], workScheduleScopes: ['global'] });

    renderRoute('/work-shifts/work-shift-001');

    await screen.findByText('SHIFT001');
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:actions.edit'),
      }),
    ).not.toBeInTheDocument();

    cleanup();
    mockCapabilities({
      permissions: ['workSchedule.read', 'workSchedule.update', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });
    renderRoute('/work-shifts/work-shift-archive');

    const archivedEdit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:actions.edit'),
    });
    expect(archivedEdit).toBeDisabled();
    expect(screen.getByText(i18n.t('work-schedule:detail.archivedReadOnly'))).toBeInTheDocument();
  });

  it('denies Team Work Shifts Admin route access even with stale mutation permissions', async () => {
    mockCapabilities({
      permissions: [
        'workSchedule.read',
        'workSchedule.create',
        'workSchedule.update',
        'workSchedule.manageLifecycle',
      ],
      workScheduleScopes: ['team'],
    });

    renderRoute('/work-schedule/team-shifts');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('SHIFT001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:actions.scheduleWorkShift'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:actions.cancel'),
      }),
    ).not.toBeInTheDocument();
  });

  it('denies TEAM_MANAGER raw Admin Team Work Shifts route without redirect', async () => {
    mockCapabilities({
      id: 'team-manager-user-1',
      roles: ['TEAM_MANAGER'],
      permissions: ['workSchedule.read'],
      workScheduleScopes: ['self', 'team'],
    });

    renderRoute('/work-schedule/team-shifts');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('SHIFT001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.requestChange'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.approve'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.reject'),
      }),
    ).not.toBeInTheDocument();
  });

  it('shows PRODUCTION_OPS approval queue with pending approve and reject affordances', async () => {
    mockCapabilities({
      id: 'production-ops-user-1',
      roles: ['PRODUCTION_OPS'],
      permissions: [
        'workSchedule.read',
        'workSchedule.create',
        'workSchedule.update',
        'workSchedule.manageLifecycle',
      ],
      workScheduleScopes: ['global'],
    });

    renderRoute('/work-schedule/global-ops');

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('work-schedule:surfaces.globalOps.title'),
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(i18n.t('work-schedule:requests.approvalQueue')),
    ).toBeInTheDocument();
    const approve = screen.getByRole('button', {
      name: i18n.t('work-schedule:requests.actions.approve'),
    });
    const reject = screen.getByRole('button', {
      name: i18n.t('work-schedule:requests.actions.reject'),
    });
    await waitFor(() => expect(approve).toBeEnabled());
    expect(reject).toBeEnabled();
  });

  it('shows only Admin/global WorkSchedule surfaces even when global Admin also has scoped grants', async () => {
    mockCapabilities({
      permissions: [
        'workSchedule.read',
        'workSchedule.create',
        'workSchedule.update',
        'workSchedule.manageLifecycle',
      ],
      workScheduleScopes: ['self', 'team', 'department', 'global'],
    });

    renderRoute('/work-schedule/global-ops');

    const navigation = await screen.findByRole('navigation', {
      name: i18n.t('work-schedule:rosterNav.label'),
    });
    expect(
      within(navigation).getByText(i18n.t('work-schedule:rosterNav.globalOps')),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByText(i18n.t('work-schedule:rosterNav.monthlyRosters')),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByText(i18n.t('work-schedule:rosterNav.workPatterns')),
    ).toBeInTheDocument();
    expect(
      within(navigation).getByText(i18n.t('work-schedule:rosterNav.holidayCalendars')),
    ).toBeInTheDocument();
    expect(
      within(navigation).queryByText(i18n.t('work-schedule:rosterNav.myShifts')),
    ).not.toBeInTheDocument();
    expect(
      within(navigation).queryByText(i18n.t('work-schedule:rosterNav.teamShifts')),
    ).not.toBeInTheDocument();
    expect(
      within(navigation).queryByText(i18n.t('work-schedule:rosterNav.departmentShifts')),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Global Ops Schedule')).not.toBeInTheDocument();
  });

  it('denies department-scoped HR from raw Admin Department Work Shifts route', async () => {
    mockCapabilities({
      id: 'hr-user-1',
      roles: ['HR_OPERATIONS'],
      permissions: ['workSchedule.read'],
      workScheduleScopes: ['department'],
    });

    renderRoute('/work-schedule/department-shifts');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('WSR-202605-000001')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.approve'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.reject'),
      }),
    ).not.toBeInTheDocument();
  });

  it('hides request mutation actions from VIEWER_AUDITOR', async () => {
    mockCapabilities({
      id: 'viewer-auditor-user-1',
      roles: ['VIEWER_AUDITOR'],
      permissions: ['workSchedule.read'],
      workScheduleScopes: ['global'],
    });

    renderRoute('/work-schedule/global-ops');

    expect(
      await screen.findByText(i18n.t('work-schedule:requests.approvalQueue')),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.requestChange'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.approve'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.reject'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.cancel'),
      }),
    ).not.toBeInTheDocument();
  });

  it('denies TALENT_STAFF_SELF from raw Admin My Work Shifts route', async () => {
    mockCapabilities({
      id: 'talent-staff-self-user-1',
      roles: ['TALENT_STAFF_SELF'],
      type: 'staff',
      permissions: ['workSchedule.read'],
      workScheduleScopes: ['self'],
    });

    renderRoute('/work-schedule/my-shifts');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.requestChange'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.approve'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.reject'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.cancel'),
      }),
    ).not.toBeInTheDocument();
  });

  it('keeps request approval actions visible but disabled for capable actors on invalid request status', async () => {
    mockCapabilities({
      id: 'production-ops-user-1',
      roles: ['PRODUCTION_OPS'],
      permissions: [
        'workSchedule.read',
        'workSchedule.create',
        'workSchedule.update',
        'workSchedule.manageLifecycle',
      ],
      workScheduleScopes: ['global'],
    });
    server.use(
      http.get('*/admin/work-schedule/requests', () =>
        HttpResponse.json({
          data: [
            {
              id: 'work-schedule-request-approved',
              requestCode: 'WSR-202605-009999',
              requestType: 'CREATE_SHIFT',
              status: 'APPROVED',
              targetKind: 'EMPLOYMENT_PROFILE_WORK_SHIFT',
              requestSource: 'TEAM_MANAGER',
              targetEmploymentProfileId: 'ep-002',
              targetEmploymentProfileRef: { id: 'ep-002', displayName: 'Managed Member' },
              targetWorkShiftId: null,
              targetWorkShiftRef: null,
              requestedByUserId: 'team-manager-user-1',
              requestedByEmploymentProfileId: 'ep-manager-001',
              reason: 'Already approved request',
              proposedStartAt: Date.parse('2026-05-25T09:00:00.000Z'),
              proposedEndAt: Date.parse('2026-05-25T11:00:00.000Z'),
              proposedTitle: 'Approved request',
              proposedStudioResourceIds: [],
              proposedDescription: null,
              proposedExternalRef: null,
              approvedByUserId: 'production-ops-user-1',
              approvedAt: Date.parse('2026-05-24T09:00:00.000Z'),
              approvalNote: null,
              rejectedByUserId: null,
              rejectedAt: null,
              rejectionReason: null,
              cancelledByUserId: null,
              cancelledAt: null,
              cancellationReason: null,
              appliedWorkShiftId: 'work-shift-approval-fixture',
              appliedWorkShiftRef: null,
              createdAt: Date.parse('2026-05-23T09:00:00.000Z'),
              updatedAt: Date.parse('2026-05-24T09:00:00.000Z'),
            },
          ],
          meta: undefined,
        }),
      ),
    );

    renderRoute('/work-schedule/global-ops');

    expect(await screen.findByText('WSR-202605-009999')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:requests.actions.approve'),
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:requests.actions.reject'),
      }),
    ).toBeDisabled();
  });

  it('hides Monthly Roster actions for missing permission while local status still wins', async () => {
    mockCapabilities({
      permissions: ['workSchedule.read', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });

    renderRoute('/work-schedule/rosters/roster-draft');

    await screen.findByText('ROSTER_DRAFT');
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.actions.editDraft'),
      }),
    ).not.toBeInTheDocument();

    cleanup();
    mockCapabilities({
      permissions: ['workSchedule.read', 'workSchedule.update', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });
    renderRoute('/work-schedule/rosters/roster-published');

    const publishedEdit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:monthlyRosters.actions.editDraft'),
    });
    expect(publishedEdit).toBeDisabled();
  });

  it('denies direct Work Shift detail without global authority', async () => {
    mockCapabilities({
      permissions: ['workSchedule.read', 'workSchedule.update', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['self'],
    });

    renderRoute('/work-shifts/work-shift-001?scope=team');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('SHIFT001')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:actions.edit'),
      }),
    ).not.toBeInTheDocument();

    cleanup();
    renderRoute('/work-shifts/work-shift-001');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('SHIFT001')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:actions.edit'),
      }),
    ).not.toBeInTheDocument();

    cleanup();
    mockCapabilities({
      permissions: ['workSchedule.read', 'workSchedule.update', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });
    renderRoute('/work-shifts/work-shift-001');

    const globalEdit = await screen.findByRole('button', {
      name: i18n.t('work-schedule:actions.edit'),
    });
    await waitFor(() => expect(globalEdit).toBeEnabled());
  });

  it('denies Monthly Roster route access without global authority', async () => {
    mockCapabilities({
      permissions: ['workSchedule.read', 'workSchedule.update', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['department'],
    });

    renderRoute('/work-schedule/rosters/roster-draft?scope=global');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('ROSTER_DRAFT')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:monthlyRosters.actions.editDraft'),
      }),
    ).not.toBeInTheDocument();

    cleanup();
    renderRoute('/work-schedule/rosters/roster-draft');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('ROSTER_DRAFT')).not.toBeInTheDocument();

    cleanup();
    mockCapabilities({
      permissions: ['workSchedule.read', 'workSchedule.update', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });
    renderRoute('/work-schedule/rosters/roster-draft');

    const globalEditDraft = await screen.findByRole('button', {
      name: i18n.t('work-schedule:monthlyRosters.actions.editDraft'),
    });
    await waitFor(() => expect(globalEditDraft).toBeEnabled());
  });

  it('hides Work Schedule actions when capability fetch fails', async () => {
    mockCapabilities({ status: 500 });

    renderRoute('/work-schedule/patterns/pattern-draft');

    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.edit'),
      }),
    ).not.toBeInTheDocument();
  });
});

describe('monthly roster publish capability UX', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('keeps publish visible but disabled for capable actors when local readiness blocks it', async () => {
    mockCapabilities({
      permissions: ['workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });
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
  });

  it('hides publish for missing permission even when locally publishable', async () => {
    mockCapabilities({ permissions: [], workScheduleScopes: ['global'] });
    mockRosterPreview(basePreview());

    renderAppWithProviders(
      <MonthlyRosterPublishReview roster={baseRosterDetail()} scope="global" />,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: publishText('actions.openConfirmation'),
        }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(publishText('title'))).not.toBeInTheDocument();
  });

  it('shows PRODUCTION_OPS with global authority enabled publish for a valid draft roster', async () => {
    mockCapabilities({
      id: 'production-ops-user-1',
      roles: ['PRODUCTION_OPS'],
      permissions: ['workSchedule.read', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });
    mockRosterPreview(basePreview());

    renderAppWithProviders(
      <MonthlyRosterPublishReview roster={baseRosterDetail()} scope="global" />,
    );

    const publishButton = await screen.findByRole('button', {
      name: publishText('actions.openConfirmation'),
    });
    await waitFor(() => expect(publishButton).toBeEnabled());
  });

  it.each([
    [
      'HR_OPERATIONS department visibility',
      ['HR_OPERATIONS'],
      ['workSchedule.read'],
      ['department'],
    ],
    ['TEAM_MANAGER team visibility', ['TEAM_MANAGER'], ['workSchedule.read'], ['self', 'team']],
    ['VIEWER_AUDITOR read-only visibility', ['VIEWER_AUDITOR'], ['workSchedule.read'], ['global']],
    ['TALENT_STAFF_SELF self visibility', ['TALENT_STAFF_SELF'], ['workSchedule.read'], ['self']],
    [
      'stale mutation permission without global scope',
      ['role-capability-test'],
      ['workSchedule.read', 'workSchedule.manageLifecycle'],
      ['department'],
    ],
  ] as const)('hides publish for %s', async (_name, roles, permissions, workScheduleScopes) => {
    mockCapabilities({
      roles: [...roles],
      permissions: [...permissions],
      workScheduleScopes: [...workScheduleScopes],
    });
    mockRosterPreview(basePreview());

    renderAppWithProviders(
      <MonthlyRosterPublishReview roster={baseRosterDetail()} scope="department" />,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: publishText('actions.openConfirmation'),
        }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(publishText('title'))).not.toBeInTheDocument();
  });

  it('shows capable actors a disabled publish affordance for already published roster state', async () => {
    mockCapabilities({
      id: 'production-ops-user-1',
      roles: ['PRODUCTION_OPS'],
      permissions: ['workSchedule.read', 'workSchedule.manageLifecycle'],
      workScheduleScopes: ['global'],
    });
    mockRosterPreview(basePreview({ rosterStatus: 'PUBLISHED' }));

    renderAppWithProviders(
      <MonthlyRosterPublishReview
        roster={baseRosterDetail({
          status: 'PUBLISHED',
          publishedAt: Date.parse('2026-05-31T00:00:00.000Z'),
          publishedByUserId: 'production-ops-user-1',
          publishGenerationRunId: 'generation-run-001',
        })}
        scope="global"
      />,
    );

    expect(await screen.findByText(publishText('states.alreadyPublished'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: publishText('actions.openConfirmation'),
      }),
    ).toBeDisabled();
  });

  it('continues to publish with expectedPreviewHash from computedPreviewHash', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;
    mockCapabilities({
      roles: ['PRODUCTION_OPS'],
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
  targetType: 'ORG_UNIT',
  targetMode: 'EXACT_ONLY',
  targetOrgUnitId: 'ou-sales',
  targetOrgUnitRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
  targetTalentGroupId: null,
  targetTalentGroupRef: null,
  targetRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
  departmentOrgUnitId: 'ou-sales',
  departmentOrgUnitRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
  workPatternId: 'pattern-active',
  workPatternRef: {
    id: 'pattern-active',
    code: 'PATTERN_ACTIVE',
    name: 'Active operations',
    status: 'ACTIVE',
  },
  holidayCalendarId: 'holiday-calendar-active',
  holidayCalendarRef: {
    id: 'holiday-calendar-active',
    code: 'VN_ACTIVE',
    name: 'Vietnam active calendar',
    status: 'ACTIVE',
  },
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
  targetType: 'ORG_UNIT',
  targetMode: 'EXACT_ONLY',
  targetOrgUnitId: 'ou-sales',
  targetOrgUnitRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
  targetTalentGroupId: null,
  targetTalentGroupRef: null,
  targetRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
  departmentOrgUnitId: 'ou-sales',
  departmentOrgUnitRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
  workPatternId: 'pattern-active',
  workPatternRef: {
    id: 'pattern-active',
    code: 'PATTERN_ACTIVE',
    name: 'Active operations',
    status: 'ACTIVE',
  },
  holidayCalendarId: 'holiday-calendar-active',
  holidayCalendarRef: {
    id: 'holiday-calendar-active',
    code: 'VN_ACTIVE',
    name: 'Vietnam active calendar',
    status: 'ACTIVE',
  },
  rosterStatus: 'DRAFT',
  draftVersion: 1,
  currentPreviewHash: 'hash-clean',
  computedPreviewHash: 'hash-clean',
  eligibleProfiles: [
    {
      subjectEmploymentProfileId: 'ep-001',
      subjectEmploymentProfileRef: { id: 'ep-001', code: 'EP001', name: 'Employee One' },
      employmentStatus: 'ACTIVE',
      departmentOrgUnitId: 'ou-sales',
      departmentOrgUnitRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
    },
  ],
  excludedMembers: [],
  rows: [
    {
      previewRowId: 'preview-row-001',
      monthlyRosterId: 'roster-capability',
      rosterMonth: '2026-05',
      targetType: 'ORG_UNIT',
      targetMode: 'EXACT_ONLY',
      targetOrgUnitId: 'ou-sales',
      targetOrgUnitRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
      targetTalentGroupId: null,
      targetTalentGroupRef: null,
      targetRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
      departmentOrgUnitId: 'ou-sales',
      departmentOrgUnitRef: { id: 'ou-sales', code: 'SALES', name: 'Sales', status: 'ACTIVE' },
      subjectEmploymentProfileId: 'ep-001',
      subjectEmploymentProfileRef: { id: 'ep-001', code: 'EP001', name: 'Employee One' },
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
    includedMemberCount: 1,
    excludedMemberCount: 0,
    totalStandardCandidateShifts: 1,
    totalHolidaySuppressions: 0,
    totalWorkingToOff: 0,
    totalChangeTime: 0,
    totalAddSpecialShift: 0,
    totalCandidateShiftsAfterExceptions: 1,
    totalConflicts: 0,
  },
  warnings: [],
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
