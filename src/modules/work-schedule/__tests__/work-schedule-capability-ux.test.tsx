import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { parseApplyAvailabilityLinesToMonthlyRosterResponseForTest } from '@modules/work-schedule/api/work-schedule.api';
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
          accountContexts: ['ADMIN_CONSOLE'],
          workspaceAvailability: {
            primaryWorkspace: 'ADMIN_CONSOLE',
            availableWorkspaces: [
              {
                context: 'STAFF_CONSOLE',
                available: false,
                source: 'ACCOUNT_CONTEXT',
                reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
                trace: [],
              },
              {
                context: 'MANAGER_CONSOLE',
                available: false,
                source: 'ACCOUNT_CONTEXT',
                reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
                trace: [],
              },
              {
                context: 'ADMIN_CONSOLE',
                available: true,
                source: 'ACCOUNT_CONTEXT',
                reasonCodes: ['ACCOUNT_CONTEXT_ACTIVE'],
                trace: [],
              },
            ],
            ownDataAvailable: false,
            managerResponsibilitiesAvailable: false,
            effectiveAccessTraceAvailable: true,
            sourceTrace: [],
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

    await screen.findByText('PATTERN_DRAFT', {}, { timeout: 3000 });
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:patterns.actions.edit'),
      }),
    ).not.toBeInTheDocument();
  });

  it('hides Holiday Calendar actions when mutation permission is missing', async () => {
    mockCapabilities({ permissions: ['workSchedule.read'], workScheduleScopes: ['global'] });

    renderRoute('/work-schedule/holiday-calendars/holiday-calendar-draft');

    await screen.findByText('VN_DRAFT', {}, { timeout: 3000 });
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

  it('counts pending lines from partially approved Admin batches and keeps card CTAs navigation-only', async () => {
    const user = userEvent.setup();
    let mutationCalls = 0;
    mockCapabilities({
      id: 'production-ops-user-1',
      roles: ['PRODUCTION_OPS'],
      permissions: ['workSchedule.read', 'workSchedule.create', 'workSchedule.update'],
      workScheduleScopes: ['global'],
    });
    server.use(
      http.post('*/admin/work-schedule/*', () => {
        mutationCalls += 1;
        return HttpResponse.json(
          { message: 'Action Needed cards must not mutate' },
          { status: 500 },
        );
      }),
      http.get('*/admin/work-schedule/request-batches', () =>
        HttpResponse.json({
          data: [
            {
              id: 'partial-request-batch',
              batchCode: 'WSB-PARTIAL',
              submittedByEmploymentProfileId: 'ep-manager',
              periodMonth: '2026-06',
              scopeSummary: 'ORG_UNIT',
              status: 'PARTIALLY_APPROVED',
              note: null,
              lineCounts: {
                total: 5,
                pending: 3,
                approved: 2,
                rejected: 0,
                cancelled: 0,
                failedToApply: 0,
              },
              clientToken: 'partial-request-token',
              submittedAt: 1,
              cancelledAt: null,
              resolvedAt: null,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
      ),
      http.get('*/admin/work-schedule/availability-batches', () =>
        HttpResponse.json({
          data: {
            items: [
              {
                id: 'partial-availability-batch',
                availabilityBatchCode: 'AVB-PARTIAL',
                status: 'PARTIALLY_APPROVED',
                periodMonth: '2026-06',
                targetType: 'ORG_UNIT',
                targetMode: 'EXACT_ONLY',
                targetOrgUnitId: 'org-content',
                targetTalentGroupId: null,
                note: null,
                lineCounts: { total: 4, pending: 2, approved: 2, rejected: 0, cancelled: 0 },
                clientToken: 'partial-availability-token',
                submittedAt: 1,
                cancelledAt: null,
                resolvedAt: null,
                createdAt: 1,
                updatedAt: 1,
              },
            ],
          },
        }),
      ),
      http.get('*/admin/work-schedule/rosters', () => HttpResponse.json({ data: [] })),
    );

    const router = renderRoute('/work-schedule/global-ops');
    const actionNeeded = await screen.findByTestId('admin-work-action-needed');
    expect(
      await within(screen.getByTestId('admin-action-needed-requests')).findByText('3'),
    ).toBeInTheDocument();
    expect(
      await within(screen.getByTestId('admin-action-needed-availability')).findByText('2'),
    ).toBeInTheDocument();
    expect(
      within(actionNeeded).getByText(i18n.t('work-schedule:operational.admin.bounded')),
    ).toBeInTheDocument();
    expect(within(actionNeeded).queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:actions.scheduleWorkShift'),
      }),
    ).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('admin-action-needed-requests')).getByRole('link', {
        name: i18n.t('work-schedule:operational.admin.cards.requests.cta'),
      }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/work-schedule/request-batches'),
    );
    expect(mutationCalls).toBe(0);
  });

  it('accepts valid apply target fields and rejects unsupported apply response targets', () => {
    const validResponse = {
      data: {
        monthlyRosterId: 'roster-draft',
        rosterCode: 'ROSTER-DRAFT',
        rosterMonth: '2026-06',
        status: 'DRAFT',
        targetType: 'ORG_UNIT',
        targetMode: 'EXACT_ONLY',
        targetOrgUnitId: 'org-content',
        targetTalentGroupId: null,
        appliedCount: 1,
        advisoryOnlyCount: 0,
        skippedAlreadyAppliedCount: 0,
        failedCount: 0,
        results: [],
      },
    };

    expect(parseApplyAvailabilityLinesToMonthlyRosterResponseForTest(validResponse)).toMatchObject({
      targetType: 'ORG_UNIT',
      targetMode: 'EXACT_ONLY',
    });
    expect(() =>
      parseApplyAvailabilityLinesToMonthlyRosterResponseForTest({
        data: { ...validResponse.data, targetType: 'COMPANY' },
      }),
    ).toThrow();
    expect(() =>
      parseApplyAvailabilityLinesToMonthlyRosterResponseForTest({
        data: { ...validResponse.data, targetMode: 'INCLUDE_DESCENDANTS' },
      }),
    ).toThrow();
  });

  it('renders Admin request batch queue and approves selected pending lines', async () => {
    const user = userEvent.setup();
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

    renderRoute('/work-schedule/request-batches');

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('work-schedule:requestBatches.page.title'),
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('WSB-202606-000100')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('work-schedule:requestBatches.statuses.PENDING')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t('common:pagination.cursorDisclosure'))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('common:pagination.goToPage'))).not.toBeInTheDocument();
    expect(screen.queryByText(/Trang\s+\d+\s*\/\s*\d+/)).not.toBeInTheDocument();
    expect(
      (await screen.findAllByText(i18n.t('work-schedule:requestBatches.copy.failedToApply')))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText('Official WorkShift was no longer active at approval time.'),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'work-schedule:requestBatches.filters.status',
        )}`,
      }),
    );
    expect(screen.getByText(i18n.t('common:filters.noFiltersApplied'))).toBeInTheDocument();

    await user.click(
      await screen.findByRole('checkbox', {
        name: i18n.t('work-schedule:requestBatches.actions.selectLine', { lineNo: 1 }),
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:requestBatches.actions.approveSelected'),
      }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('heading', {
        name: i18n.t('work-schedule:requestBatches.dialogs.approve.title'),
      }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', {
        name: i18n.t('work-schedule:requestBatches.actions.approveSelected'),
      }),
    );

    expect(
      await screen.findByText(
        i18n.t('work-schedule:requestBatches.lineCounts.summary', {
          pending: 1,
          approved: 1,
          failedToApply: 2,
          total: 4,
        }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requests.actions.requestChange'),
      }),
    ).not.toBeInTheDocument();
  });

  it('cancels request approval confirmation without calling the decision endpoint', async () => {
    const user = userEvent.setup();
    let approveCalls = 0;
    mockCapabilities({
      id: 'production-ops-user-1',
      roles: ['PRODUCTION_OPS'],
      permissions: ['workSchedule.read', 'workSchedule.update'],
      workScheduleScopes: ['global'],
    });
    server.use(
      http.post('*/admin/work-schedule/request-batches/:batchId/approve-lines', () => {
        approveCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
    );

    renderRoute('/work-schedule/request-batches');

    await user.click(
      await screen.findByRole('checkbox', {
        name: i18n.t('work-schedule:requestBatches.actions.selectLine', { lineNo: 1 }),
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:requestBatches.actions.approveSelected'),
      }),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: i18n.t('common:actions.cancel'),
      }),
    );

    expect(approveCalls).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    ['reject', 'rejectSelected', 'reject-lines'],
    ['cancel', 'cancelSelected', 'cancel-lines'],
  ] as const)(
    'confirms and safely cancels Admin %s decisions before calling the endpoint',
    async (action, actionKey, endpoint) => {
      const user = userEvent.setup();
      let decisionCalls = 0;
      mockCapabilities({
        id: 'production-ops-user-1',
        roles: ['PRODUCTION_OPS'],
        permissions: ['workSchedule.read', 'workSchedule.update'],
        workScheduleScopes: ['global'],
      });
      server.use(
        http.post(`*/admin/work-schedule/request-batches/:batchId/${endpoint}`, () => {
          decisionCalls += 1;
          return HttpResponse.json({ data: {} });
        }),
      );

      renderRoute('/work-schedule/request-batches');

      await user.click(
        await screen.findByRole('checkbox', {
          name: i18n.t('work-schedule:requestBatches.actions.selectLine', { lineNo: 1 }),
        }),
      );
      await user.type(
        screen.getByLabelText(i18n.t('work-schedule:requestBatches.decisions.reason')),
        'Current operations no longer require this schedule change',
      );
      const actionButton = screen.getByRole('button', {
        name: i18n.t(`work-schedule:requestBatches.actions.${actionKey}`),
      });
      await user.click(actionButton);
      expect(
        within(screen.getByRole('dialog')).getByRole('heading', {
          name: i18n.t(`work-schedule:requestBatches.dialogs.${action}.title`),
        }),
      ).toBeInTheDocument();
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: i18n.t('common:actions.cancel'),
        }),
      );
      expect(decisionCalls).toBe(0);

      await user.click(actionButton);
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: i18n.t(`work-schedule:requestBatches.actions.${actionKey}`),
        }),
      );
      await waitFor(() => expect(decisionCalls).toBe(1));
    },
  );

  it('does not expose Admin request-batch decision controls to a Manager', async () => {
    mockCapabilities({
      id: 'manager-user-1',
      roles: ['TEAM_MANAGER'],
      permissions: ['workSchedule.read', 'workSchedule.update'],
      workScheduleScopes: ['team'],
    });

    renderRoute('/work-schedule/request-batches');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requestBatches.actions.approveSelected'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('work-schedule:requestBatches.actions.rejectSelected'),
      }),
    ).not.toBeInTheDocument();
  });

  it('renders Admin availability planning queue and applies selected approved lines', async () => {
    const user = userEvent.setup();
    let applyCalls = 0;
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
      http.get('*/admin/work-schedule/rosters', () =>
        HttpResponse.json({
          data: [
            {
              monthlyRosterId: 'roster-draft',
              rosterCode: 'ROSTER_DRAFT',
              rosterMonth: '2026-05',
              timezone: 'Asia/Ho_Chi_Minh',
              targetSubjectKind: 'EMPLOYMENT_PROFILE',
              targetOrgUnitMode: 'EXACT_ONLY',
              targetType: 'ORG_UNIT',
              targetMode: 'EXACT_ONLY',
              targetOrgUnitId: 'ou-sales',
              targetOrgUnitRef: {
                id: 'ou-sales',
                code: 'SALES',
                name: 'Sales',
                status: 'ACTIVE',
              },
              targetTalentGroupId: null,
              targetTalentGroupRef: null,
              targetRef: {
                id: 'ou-sales',
                code: 'SALES',
                name: 'Sales',
                status: 'ACTIVE',
              },
              departmentOrgUnitId: 'ou-sales',
              departmentOrgUnitRef: {
                id: 'ou-sales',
                code: 'SALES',
                name: 'Sales',
                status: 'ACTIVE',
              },
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
              exceptionCount: 1,
              description: 'Draft roster',
              externalRef: 'MR-DRAFT',
              archivedAt: null,
              createdAt: Date.parse('2026-04-20T00:00:00.000Z'),
              updatedAt: Date.parse('2026-04-21T00:00:00.000Z'),
            },
          ],
          meta: {},
        }),
      ),
      http.post(
        '*/admin/work-schedule/rosters/:monthlyRosterId/apply-availability-lines',
        async ({ request }) => {
          applyCalls += 1;
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toMatchObject({
            availabilityLineIds: ['admin-availability-line-approved'],
            scope: 'global',
          });
          return HttpResponse.json({
            data: {
              monthlyRosterId: 'roster-draft',
              rosterCode: 'ROSTER-202606-CONTENT',
              rosterMonth: '2026-05',
              status: 'DRAFT',
              targetType: 'ORG_UNIT',
              targetMode: 'EXACT_ONLY',
              targetOrgUnitId: 'ou-sales',
              targetTalentGroupId: null,
              appliedCount: 1,
              advisoryOnlyCount: 1,
              skippedAlreadyAppliedCount: 1,
              failedCount: 1,
              results: [
                {
                  availabilityLineId: 'admin-availability-line-approved',
                  outcome: 'APPLIED',
                  rosterExceptionId: 'roster-exception-created',
                  rosterExceptionIds: ['roster-exception-created'],
                  reason: 'Applied to draft roster exception',
                },
                {
                  availabilityLineId: 'admin-availability-line-advisory',
                  outcome: 'ADVISORY_ONLY',
                  rosterExceptionId: null,
                  rosterExceptionIds: [],
                  reason: 'Availability note is advisory only',
                },
                {
                  availabilityLineId: 'admin-availability-line-applied',
                  outcome: 'SKIPPED_ALREADY_APPLIED',
                  rosterExceptionId: 'roster-exception-001',
                  rosterExceptionIds: ['roster-exception-001'],
                  reason: 'Already applied',
                },
                {
                  availabilityLineId: 'missing-line',
                  outcome: 'FAILED',
                  rosterExceptionId: null,
                  rosterExceptionIds: [],
                  reason: 'Line not found',
                },
              ],
            },
          });
        },
      ),
    );

    renderRoute('/work-schedule/availability-batches');

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('work-schedule:availabilityBatches.page.title'),
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('AVB-202606-000100')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:availabilityBatches.copy.approvedNotChanged')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:availabilityBatches.copy.applyDraftOnly')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:availabilityBatches.copy.officialShiftBoundary')),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/\bbackend\b/i);
    expect(screen.getByText(i18n.t('common:pagination.cursorDisclosure'))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('common:pagination.goToPage'))).not.toBeInTheDocument();
    expect(screen.queryByText(/Trang\s+\d+\s*\/\s*\d+/)).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText(i18n.t('work-schedule:availabilityBatches.filters.status')),
      'PENDING',
    );
    expect(
      screen.getAllByText(i18n.t('work-schedule:availabilityBatches.statuses.PENDING')).length,
    ).toBeGreaterThan(0);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('common:filters.clearAll'),
      }),
    );
    expect(screen.getByText(i18n.t('common:filters.noFiltersApplied'))).toBeInTheDocument();
    expect(
      (
        await screen.findAllByText(
          i18n.t('work-schedule:availabilityBatches.policyStatuses.NOT_EVALUATED'),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await screen.findAllByText(
          i18n.t('work-schedule:availabilityBatches.applyStatuses.NOT_APPLIED'),
        )
      ).length,
    ).toBeGreaterThan(0);

    const approvedRow = (
      await screen.findByText(i18n.t('work-schedule:availabilityBatches.types.PREFERRED_TIME'))
    ).closest('tr');
    expect(approvedRow).not.toBeNull();
    if (!approvedRow) {
      return;
    }
    await user.click(within(approvedRow).getAllByRole('checkbox')[1]);
    expect(await screen.findByRole('option', { name: /ROSTER_DRAFT/ })).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText(i18n.t('work-schedule:availabilityBatches.apply.roster')),
      'roster-draft',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:availabilityBatches.actions.apply'),
      }),
    );

    await waitFor(() => expect(applyCalls).toBe(1));
    expect(
      await screen.findByText(
        new RegExp(
          `${i18n.t('work-schedule:availabilityBatches.apply.resultLine', {
            number: 1,
          })}: ${i18n.t('work-schedule:availabilityBatches.apply.outcomes.APPLIED')}`,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(
          `${i18n.t('work-schedule:availabilityBatches.apply.resultLine', {
            number: 2,
          })}: ${i18n.t('work-schedule:availabilityBatches.apply.outcomes.ADVISORY_ONLY')}`,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(
          `${i18n.t('work-schedule:availabilityBatches.apply.resultLine', {
            number: 3,
          })}: ${i18n.t(
            'work-schedule:availabilityBatches.apply.outcomes.SKIPPED_ALREADY_APPLIED',
          )}`,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(
          `${i18n.t('work-schedule:availabilityBatches.apply.resultLine', {
            number: 4,
          })}: ${i18n.t('work-schedule:availabilityBatches.apply.outcomes.FAILED')}`,
        ),
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ['reject', 'reject-lines', 'reject', true],
    ['cancel', 'cancel-lines', 'cancel', true],
  ] as const)(
    'confirms Admin availability %s and keeps dialog cancellation mutation-free',
    async (_action, endpoint, actionKey, requiresReason) => {
      const user = userEvent.setup();
      let endpointCalls = 0;
      server.use(
        http.post(
          `*/admin/work-schedule/availability-batches/:batchId/${endpoint}`,
          async ({ request }) => {
            endpointCalls += 1;
            const body = (await request.clone().json()) as Record<string, unknown>;
            expect(body.lineIds).toEqual(['admin-availability-line-pending']);
            if (actionKey === 'reject') {
              expect(body.rejectionReason).toBe('Admin decision reason');
            }
            if (actionKey === 'cancel') {
              expect(body.cancellationReason).toBe('Admin decision reason');
            }
            return undefined;
          },
        ),
      );
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

      renderRoute('/work-schedule/availability-batches');
      expect(await screen.findByText('AVB-202606-000100')).toBeInTheDocument();
      expect(
        (
          await screen.findAllByText(
            i18n.t('work-schedule:availabilityBatches.policyStatuses.NOT_EVALUATED'),
          )
        ).length,
      ).toBeGreaterThan(0);
      const reviewCheckbox = screen
        .getAllByRole('checkbox')
        .find((checkbox) => !checkbox.hasAttribute('disabled'));
      expect(reviewCheckbox).toBeDefined();
      if (!reviewCheckbox) {
        return;
      }
      await user.click(reviewCheckbox);
      const actionButton = screen.getByRole('button', {
        name: i18n.t(`work-schedule:availabilityBatches.actions.${actionKey}`),
      });

      if (requiresReason) {
        await user.click(actionButton);
        expect(
          await screen.findByText(
            i18n.t('work-schedule:availabilityBatches.validation.reasonRequired'),
          ),
        ).toBeInTheDocument();
        expect(endpointCalls).toBe(0);
        await user.type(
          screen.getByLabelText(i18n.t('work-schedule:availabilityBatches.review.reason')),
          'Admin decision reason',
        );
      }

      await user.click(actionButton);
      const dialog = await screen.findByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', {
          name: i18n.t('common:actions.cancel'),
        }),
      );
      expect(endpointCalls).toBe(0);

      await user.click(actionButton);
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: i18n.t(`work-schedule:availabilityBatches.actions.${actionKey}`),
        }),
      );
      await waitFor(() => expect(endpointCalls).toBe(1));
    },
  );

  it('shows availability-sourced monthly roster exceptions', async () => {
    mockCapabilities({
      id: 'production-ops-user-1',
      roles: ['PRODUCTION_OPS'],
      permissions: ['workSchedule.read', 'workSchedule.update'],
      workScheduleScopes: ['global'],
    });

    renderRoute('/work-schedule/rosters/roster-draft');

    expect(
      await screen.findByText(i18n.t('work-schedule:monthlyRosters.appliedAvailability.title')),
    ).toBeInTheDocument();
    expect(await screen.findByText('admin-availability-line-applied')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Khả dụng đã áp dụng');
    expect(document.body).not.toHaveTextContent(/\bbackend\b/i);
    expect(document.body).not.toHaveTextContent('UNAVAILABLE_FULL_DAY');
  });

  it('requires Admin reject and cancel reasons before calling selected-line decision endpoints', async () => {
    const user = userEvent.setup();
    let rejectCalls = 0;
    let cancelCalls = 0;
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
      http.post('*/admin/work-schedule/request-batches/:batchId/reject-lines', () => {
        rejectCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
      http.post('*/admin/work-schedule/request-batches/:batchId/cancel-lines', () => {
        cancelCalls += 1;
        return HttpResponse.json({ data: {} });
      }),
    );

    renderRoute('/work-schedule/request-batches');

    expect(await screen.findByText('WSB-202606-000100')).toBeInTheDocument();
    await user.click(
      await screen.findByRole('checkbox', {
        name: i18n.t('work-schedule:requestBatches.actions.selectLine', { lineNo: 1 }),
      }),
    );

    const rejectSelected = screen.getByRole('button', {
      name: i18n.t('work-schedule:requestBatches.actions.rejectSelected'),
    });
    const cancelSelected = screen.getByRole('button', {
      name: i18n.t('work-schedule:requestBatches.actions.cancelSelected'),
    });
    expect(rejectSelected).toBeDisabled();
    expect(cancelSelected).toBeDisabled();

    await user.click(rejectSelected);
    await user.click(cancelSelected);
    await waitFor(() => {
      expect(rejectCalls).toBe(0);
      expect(cancelCalls).toBe(0);
    });
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

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
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
