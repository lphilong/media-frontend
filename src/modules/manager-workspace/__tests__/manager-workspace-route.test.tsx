import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, vi } from 'vitest';

import { appRoutes } from '@app/router/router';
import { parseKpiAllocationDraftPayloadForTest } from '@modules/kpi/api/kpi.api';
import {
  parseManagerAvailabilityApplyStatusForTest,
  parseManagerAvailabilityPolicyEvaluationStatusForTest,
  parseManagerEventForTest,
  parseManagerWorkShiftListForTest,
  parseManagerWorkspaceContextForTest,
} from '@modules/manager-workspace/api/manager-workspace.api';
import {
  parseWorkScheduleAvailabilityApplyStatusForTest,
  parseWorkScheduleAvailabilityPolicyEvaluationStatusForTest,
} from '@modules/work-schedule/api/work-schedule.api';
import { setLocale } from '@shared/i18n/i18n';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import {
  managerWorkspaceDualContext,
  managerWorkspaceNoAssignmentsContext,
  managerWorkspaceNoProfileContext,
  managerWorkspaceOrgUnitDepartmentOwnerContext,
  managerWorkspaceOrgUnitNoKpiCapabilityContext,
  managerWorkspaceOrgUnitOperatorContext,
  managerWorkspaceOrgUnitOnlyContext,
  managerWorkspaceTalentGroupOnlyContext,
  managerWorkspaceWorkEnabledContext,
  resetManagerWorkspaceMockData,
  setMockManagerWorkShifts,
  setMockManagerWorkspaceContext,
} from '@test/msw/manager-workspace-handlers';
import {
  readLastKpiAllocationDraftPayload,
  readLastKpiOrgUnitActualGridDate,
  readLastKpiOrgUnitActualPayload,
  resetKpiMockData,
} from '@test/msw/kpi-handlers';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

const mockAuthAdapter = vi.hoisted(() => ({
  initialize: vi.fn(async () => ({
    isAuthenticated: true,
    session: {
      userName: 'Mina Manager',
      capabilityHints: [],
      expiresAt: Date.UTC(2026, 5, 4, 12, 0),
    },
  })),
  getAccessToken: vi.fn(async () => 'mock-access-token'),
  loginRedirect: vi.fn(async () => undefined),
  logoutRedirect: vi.fn(async () => undefined),
  handleCallback: vi.fn(async () => null),
}));

vi.mock('@shared/auth/auth-adapter', () => ({
  createAuthAdapter: () => mockAuthAdapter,
  isAuthConfigurationError: () => false,
}));

type MockCapabilities = Parameters<typeof setMockCurrentActorCapabilities>[0];

const managerCapabilities = (overrides: Partial<MockCapabilities> = {}): MockCapabilities => ({
  id: 'user-manager',
  type: 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: ['TEAM_MANAGER'],
  permissions: ['kpi.read', 'kpi.readProgress', 'kpi.enterActual', 'kpi.correctActual'],
  scopeGrants: {
    kpi: ['managedGroup'],
  },
  generatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
});

const staffCapabilities = (): MockCapabilities => ({
  id: 'user-staff',
  type: 'staff',
  context: 'ADMIN',
  isActive: true,
  roles: ['TALENT_STAFF_SELF'],
  permissions: [
    'workSchedule.read',
    'event.read',
    'talentKpi.read',
    'kpi.readProgress',
    'employmentProfile.read',
    'talent.read',
  ],
  scopeGrants: {
    workSchedule: ['self'],
    kpi: ['self'],
  },
  generatedAt: '2026-06-04T00:00:00.000Z',
});

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-15T00:00:00+07:00'));
});

afterAll(() => {
  vi.useRealTimers();
});

const renderRoute = async (path: string, setup?: () => void): Promise<void> => {
  cleanup();
  vi.setSystemTime(new Date('2026-06-15T00:00:00+07:00'));
  await setLocale('en');
  resetKpiMockData();
  resetManagerWorkspaceMockData();
  mockAuthAdapter.logoutRedirect.mockClear();
  setMockCurrentActorCapabilities(managerCapabilities());
  setup?.();

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

describe('/manager workspace route', () => {
  it('routes manager-capable actors from root into Manager Workspace outside Admin shell', async () => {
    await renderRoute('/');

    expect(
      await screen.findByTestId('manager-workspace-shell', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Manager Workspace' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
  });

  it('renders Manager Workspace locale and logout controls through existing shell seams', async () => {
    const user = userEvent.setup();
    await renderRoute('/manager');

    expect(await screen.findByTestId('manager-workspace-shell')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Locale' })).toBeInTheDocument();

    const logoutButton = screen.getByRole('button', { name: 'Logout' });
    expect(logoutButton).toBeInTheDocument();

    await user.click(logoutButton);

    expect(mockAuthAdapter.logoutRedirect).toHaveBeenCalledWith('/');
  });

  it('standardizes Manager identity, scope, module status, and disabled-module copy in Vietnamese', async () => {
    await renderRoute('/manager');

    await act(async () => {
      await setLocale('vi');
    });

    expect(await screen.findByRole('heading', { name: 'Không gian quản lý' })).toBeInTheDocument();
    expect(screen.getAllByText('Mina Manager').length).toBeGreaterThan(0);
    expect(screen.getByText('Hồ sơ nhân sự · EP-MGR-001')).toBeInTheDocument();
    expect(screen.getAllByText('Phạm vi được phân công').length).toBeGreaterThan(0);
    expect(screen.getByTestId('manager-module-overview')).toHaveTextContent('Chỉ đọc');
    expect(screen.getByTestId('manager-module-kpi')).toHaveTextContent('Có thể thao tác');
    expect(screen.getByTestId('manager-overview-readiness-card')).toHaveTextContent(
      'Có thể thao tác',
    );
    expect(screen.getByTestId('manager-overview-kpi-card')).toHaveTextContent('Có thể thao tác');
    expect(screen.getByTestId('manager-module-events')).toHaveTextContent('Chỉ đọc');
    expect(screen.getByTestId('manager-module-events')).not.toHaveTextContent('Có thể thao tác');
    for (const moduleId of ['groups', 'members']) {
      expect(screen.getByTestId(`manager-module-${moduleId}`)).toHaveTextContent(
        'Chưa mở trong workspace này',
      );
    }

    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('Cần hợp đồng');
    expect(bodyText).not.toContain('Admin/Ops công bố hoặc phân quyền');
    expect(bodyText).not.toContain('Dữ liệu sẽ hiển thị khi');
    expect(bodyText).not.toContain('Danh sach KPI quan ly');
    expect(bodyText).not.toContain('Kha dung');
    expect(bodyText).not.toContain('manager-workspace:');
  });

  it('keeps Manager KPI module and Overview statuses read-only for the same posture', async () => {
    await renderRoute('/manager', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitDepartmentOwnerContext());
    });

    expect(await screen.findByTestId('manager-module-kpi')).toHaveTextContent('Read-only');
    expect(screen.getByTestId('manager-overview-readiness-card')).toHaveTextContent('Read-only');
    expect(screen.getByTestId('manager-overview-kpi-card')).toHaveTextContent('Read-only');
    expect(screen.getByTestId('manager-module-kpi')).not.toHaveTextContent('Action available');
    expect(screen.getByTestId('manager-overview-readiness-card')).not.toHaveTextContent(
      'Action available',
    );
    expect(screen.getByTestId('manager-overview-kpi-card')).not.toHaveTextContent(
      'Action available',
    );
  });

  it('renders Staff-like Manager shell modules with Overview active by default', async () => {
    await renderRoute('/manager');

    expect(await screen.findByTestId('manager-workspace-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('manager-module-overview')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('manager-module-kpi')).toHaveAttribute('aria-selected', 'false');

    for (const moduleId of ['overview', 'kpi', 'work', 'events', 'groups', 'members']) {
      expect(screen.getByTestId(`manager-module-${moduleId}`)).toBeInTheDocument();
    }

    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveTextContent('Selected');
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveTextContent('Read-only');
    expect(screen.getByRole('tab', { name: /Managed Work/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Managed Events/ })).toHaveTextContent('Read-only');
    expect(screen.getByRole('tab', { name: /Managed Events/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Managed Groups/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Managed Members/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    expect(await screen.findByTestId('manager-panel-overview')).toBeInTheDocument();
    expect(await screen.findByTestId('manager-overview-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-panel-kpi')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-detail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
  });

  it('switches to Managed KPI as the only active full panel', async () => {
    const user = userEvent.setup();
    await renderRoute('/manager');

    await user.click(await screen.findByTestId('manager-module-kpi'));

    expect(await screen.findByTestId('manager-panel-kpi')).toBeInTheDocument();
    expect(await screen.findByTestId('manager-kpi-tab-unit')).toBeInTheDocument();
    expect(screen.getByTestId('manager-module-kpi')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('manager-module-overview')).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByTestId('manager-panel-overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Manager Profile')).not.toBeInTheDocument();
  });

  it('renders scoped Manager Events read-only without global Admin data calls', async () => {
    const user = userEvent.setup();
    let adminWorkShiftCalls = 0;
    let adminEventCalls = 0;
    let managerEventCalls = 0;
    let adminPeopleCalls = 0;
    let adminTalentGroupCalls = 0;

    server.use(
      http.get('*/admin/manager-workspace/events', () => {
        managerEventCalls += 1;
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'manager-event-test',
                eventCode: 'EVT-MANAGER-001',
                title: 'Scoped manager event',
                status: 'CONFIRMED',
                eventStartAt: Date.parse('2026-06-15T09:00:00+07:00'),
                eventEndAt: Date.parse('2026-06-15T12:00:00+07:00'),
                owner: { id: 'ep-owner', displayName: 'Event Owner' },
                participants: [{ id: 'ep-member', displayName: 'Scoped Member' }],
                completionEvidence: {
                  completedAt: Date.parse('2026-06-15T12:30:00+07:00'),
                  completedByActorId: 'admin-ops',
                  evidenceNote: 'Delivered manager-visible recap evidence.',
                  evidenceRefs: [
                    {
                      type: 'INTERNAL_REFERENCE',
                      label: 'Ops ticket',
                      referenceId: 'OPS-456',
                    },
                  ],
                },
                studioBookings: [],
              },
            ],
          },
        });
      }),
      http.get('*/admin/manager-workspace/events/manager-event-test', () =>
        HttpResponse.json({
          data: {
            id: 'manager-event-test',
            eventCode: 'EVT-MANAGER-001',
            title: 'Scoped manager event',
            status: 'COMPLETED',
            eventStartAt: Date.parse('2026-06-15T09:00:00+07:00'),
            eventEndAt: Date.parse('2026-06-15T12:00:00+07:00'),
            owner: { id: 'ep-owner', displayName: 'Event Owner' },
            participants: [{ id: 'ep-member', displayName: 'Scoped Member' }],
            completionEvidence: {
              completedAt: Date.parse('2026-06-15T12:30:00+07:00'),
              completedByActorId: 'admin-ops',
              evidenceNote: 'Delivered manager-visible recap evidence.',
              evidenceRefs: [
                {
                  type: 'INTERNAL_REFERENCE',
                  label: 'Ops ticket',
                  referenceId: 'OPS-456',
                },
              ],
            },
            studioBookings: [],
          },
        }),
      ),
      http.all('*/admin/work-shifts*', () => {
        adminWorkShiftCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/events*', () => {
        adminEventCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/employment-profiles*', () => {
        adminPeopleCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/talent-groups*', () => {
        adminTalentGroupCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/manager');

    await user.click(await screen.findByTestId('manager-module-work'));
    expect(await screen.findByTestId('manager-panel-work')).toBeInTheDocument();
    expect(await screen.findByText(/No effective managed WorkSchedule scope/)).toBeInTheDocument();
    expect(screen.queryByTestId('manager-panel-overview')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Work Schedule' })).not.toBeInTheDocument();

    await user.click(screen.getByTestId('manager-module-events'));
    expect(await screen.findByTestId('manager-panel-events')).toBeInTheDocument();
    expect(await screen.findByText('EVT-MANAGER-001')).toBeInTheDocument();
    expect(screen.getByTestId('manager-panel-events')).toHaveTextContent('Read-only');
    expect(screen.getByTestId('manager-panel-events')).not.toHaveTextContent('Action available');
    for (const action of ['Create', 'Confirm', 'Cancel', 'Complete', 'Archive']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument();
    }
    await user.click(screen.getByTestId('manager-module-groups'));
    expect(await screen.findByTestId('manager-panel-groups')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'This module is not currently available in Manager Workspace. Assigned scope summaries remain in Overview.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('manager-module-members'));
    expect(await screen.findByTestId('manager-panel-members')).toBeInTheDocument();
    expect(
      await screen.findByText('This module is not currently available in Manager Workspace.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'People Operations Hub' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(adminWorkShiftCalls).toBe(0);
      expect(adminEventCalls).toBe(0);
      expect(managerEventCalls).toBe(1);
      expect(adminPeopleCalls).toBe(0);
      expect(adminTalentGroupCalls).toBe(0);
    });
  });

  it('accepts Manager Event completion evidence at the read-only client boundary', () => {
    const event = parseManagerEventForTest({
      id: 'manager-event-test',
      eventCode: 'EVT-MANAGER-001',
      title: 'Scoped manager event',
      status: 'COMPLETED',
      eventStartAt: Date.parse('2026-06-15T09:00:00+07:00'),
      eventEndAt: Date.parse('2026-06-15T12:00:00+07:00'),
      owner: { id: 'ep-owner', displayName: 'Event Owner' },
      participants: [{ id: 'ep-member', displayName: 'Scoped Member' }],
      completionEvidence: {
        completedAt: Date.parse('2026-06-15T12:30:00+07:00'),
        completedByActorId: 'admin-ops',
        evidenceNote: 'Delivered manager-visible recap evidence.',
        evidenceRefs: [
          {
            type: 'INTERNAL_REFERENCE',
            label: 'Ops ticket',
            referenceId: 'OPS-456',
          },
        ],
      },
      studioBookings: [],
    });

    expect(event.completionEvidence?.evidenceNote).toBe(
      'Delivered manager-visible recap evidence.',
    );
    expect(event.completionEvidence?.evidenceRefs[0]?.referenceId).toBe('OPS-456');
  });

  it('does not replace Self-Service root routing for staff actors', async () => {
    await renderRoute('/', () => {
      setMockCurrentActorCapabilities(staffCapabilities());
    });

    expect(await screen.findByTestId('self-service-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
  });

  it('keeps dashboard actors on the existing Admin shell', async () => {
    await renderRoute('/', () => {
      setMockCurrentActorCapabilities(
        managerCapabilities({
          permissions: ['dashboardLite.read', 'kpi.read'],
          scopeGrants: {
            dashboardLite: ['global'],
            kpi: ['managedGroup'],
          },
        }),
      );
    });

    expect(await screen.findByTestId('admin-shell-main')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-kpi')).not.toBeInTheDocument();
  });

  it('redirects manager-only Admin KPI list entry to the Manager KPI workspace', async () => {
    await renderRoute('/kpi', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
    });

    expect(await screen.findByTestId('manager-workspace-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('manager-module-kpi')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByTestId('manager-kpi-tab-unit')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-panel-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
  });

  it('redirects manager-only Admin KPI detail entry to the Manager KPI detail route', async () => {
    await renderRoute('/kpi/plans/kpi-plan-org-unit', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
    });

    expect(await screen.findByTestId('manager-kpi-detail')).toBeInTheDocument();
    expect(await screen.findByTestId('manager-module-kpi')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Operations unit KPI' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
  });

  it('fails closed for manager-only raw Admin WorkSchedule and Event routes', async () => {
    const scopedOperationsCapabilities = managerCapabilities({
      permissions: [
        'workSchedule.read',
        'event.read',
        'kpi.read',
        'kpi.readProgress',
        'kpi.enterActual',
        'kpi.correctActual',
      ],
      scopeGrants: {
        workSchedule: ['self', 'team'],
        eventAssignment: ['managedGroup'],
        kpi: ['managedGroup'],
      },
    });

    await renderRoute('/work-shifts', () => {
      setMockCurrentActorCapabilities(scopedOperationsCapabilities);
    });

    expect(await screen.findByText(/Access denied|Permission denied/)).toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Work Schedule' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-work-shifts')).not.toBeInTheDocument();

    await renderRoute('/events/event-managed-scheduled', () => {
      setMockCurrentActorCapabilities(scopedOperationsCapabilities);
    });

    expect(await screen.findByText(/Access denied|Permission denied/)).toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expect(screen.queryByText('EVT-202605-000005')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-events')).not.toBeInTheDocument();
  });

  it('keeps Admin KPI route ownership for actors with global and managed KPI posture', async () => {
    await renderRoute('/kpi/plans/kpi-plan-org-unit', () => {
      setMockCurrentActorCapabilities(
        managerCapabilities({
          permissions: [
            'kpi.read',
            'kpi.readProgress',
            'kpi.enterActual',
            'kpi.correctActual',
            'kpi.manageAllocation',
          ],
          scopeGrants: {
            kpi: ['global', 'managedGroup'],
          },
        }),
      );
    });

    expect(await screen.findByTestId('admin-shell-main')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Operations unit KPI' })).toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
  });

  it('renders no-profile and no-assignment readiness without exposing KPI tabs', async () => {
    await renderRoute('/manager', () => {
      setMockManagerWorkspaceContext(managerWorkspaceNoProfileContext());
    });

    expect(await screen.findByText('No linked Employment Profile')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-tab-unit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-tab-talentGroup')).not.toBeInTheDocument();

    await renderRoute('/manager', () => {
      setMockManagerWorkspaceContext(managerWorkspaceNoAssignmentsContext());
    });

    expect(await screen.findByText('No managed scope assigned')).toBeInTheDocument();
    expect(await screen.findByText('No managed assignments')).toBeInTheDocument();
    expect(screen.getByTestId('manager-workspace-shell')).toBeInTheDocument();
    expect(screen.getByTestId('manager-overview-readiness-card')).toHaveTextContent('Read-only');
    expect(document.body).not.toHaveTextContent('Action available');

    await act(async () => {
      await setLocale('vi');
    });

    expect((await screen.findAllByText('Chưa có phạm vi được phân công')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByTestId('manager-overview-readiness-card')).toHaveTextContent('Chỉ đọc');
    expect(document.body).not.toHaveTextContent('Có thể thao tác');
  });

  it('shows a read-only no-scope posture for direct Manager Events routing', async () => {
    await renderRoute('/manager/events', () => {
      setMockManagerWorkspaceContext(managerWorkspaceNoAssignmentsContext());
    });

    expect(await screen.findByTestId('manager-panel-events')).toBeInTheDocument();
    expect(screen.getByTestId('manager-panel-events')).toHaveTextContent(
      'Managed Events read-only',
    );
    expect(screen.getByTestId('manager-panel-events')).toHaveTextContent(
      'No active Org Unit or Talent Group manager assignment',
    );
    expect(screen.getByTestId('manager-panel-events')).not.toHaveTextContent('Action available');
  });

  it('fails closed for out-of-scope Manager Event detail without leaking global data', async () => {
    let adminEventCalls = 0;
    server.use(
      http.all('*/admin/events*', () => {
        adminEventCalls += 1;
        return HttpResponse.json({ data: { title: 'Leaked global event' } });
      }),
    );

    await renderRoute('/manager/events/out-of-scope-event');

    expect(await screen.findByText('Event unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('This event is not visible through your assigned manager scope.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Leaked global event')).not.toBeInTheDocument();
    expect(adminEventCalls).toBe(0);
  });

  it('renders Unit KPI only for OrgUnit-only manager context and queries ORG_UNIT plans', async () => {
    const subjectTypes: Array<string | null> = [];
    server.use(
      http.get('*/admin/kpi/plans', ({ request }) => {
        subjectTypes.push(new URL(request.url).searchParams.get('subjectType'));
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/manager/kpi', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
    });

    expect(await screen.findByTestId('manager-kpi-tab-unit')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-tab-talentGroup')).not.toBeInTheDocument();
    expect(await screen.findByText('No published KPI plans')).toBeInTheDocument();
    await waitFor(() => {
      expect(subjectTypes).toEqual(['ORG_UNIT']);
    });
  });

  it('links Unit KPI Open to the Manager route and renders detail outside Admin shell', async () => {
    const user = userEvent.setup();
    await renderRoute('/manager/kpi', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
    });

    const row = (await screen.findByText('Operations unit KPI')).closest('tr');
    expect(row).not.toBeNull();

    const openLink = within(row as HTMLTableRowElement).getByRole('link', { name: 'Open' });
    expect(openLink).toHaveAttribute('href', '/manager/kpi/plans/kpi-plan-org-unit');
    expect(openLink).not.toHaveAttribute('href', '/kpi/plans/kpi-plan-org-unit');

    await user.click(openLink);

    expect(await screen.findByTestId('manager-kpi-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operations unit KPI' })).toBeInTheDocument();
    expect(screen.getByText('Org Unit')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
  });

  it('renders ORG_UNIT allocation, progress, actual operations, and hides global actions under Manager shell', async () => {
    await renderRoute('/manager/kpi/plans/kpi-plan-org-unit', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
      setMockCurrentActorCapabilities(
        managerCapabilities({
          permissions: [
            'kpi.read',
            'kpi.readProgress',
            'kpi.enterActual',
            'kpi.correctActual',
            'kpi.manageAllocation',
            'kpi.publish',
            'kpi.finalize',
          ],
          scopeGrants: {
            kpi: ['managedGroup', 'global'],
          },
        }),
      );
    });

    expect(await screen.findByTestId('manager-workspace-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();

    const operations = await screen.findByTestId('org-unit-operations');
    expect(within(operations).getByText('Org Unit allocations')).toBeInTheDocument();
    expect(within(operations).getByText('Progress and actuals')).toBeInTheDocument();
    expect(within(operations).getByText('Operational final result')).toBeInTheDocument();
    expect(
      await within(operations).findByText('Managed write actions available'),
    ).toBeInTheDocument();
    expect(await within(operations).findAllByText('Published Allocation')).not.toHaveLength(0);
    expect(
      within(operations).queryByText(
        'Progress and actual rows are available only after allocation rows are published.',
      ),
    ).not.toBeInTheDocument();

    expect(
      within(operations).queryByRole('button', { name: 'Approve Allocation' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Reject Allocation' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Publish Allocation' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();

    const actualDate = within(operations).getByLabelText('Actual date');
    expect(actualDate).toHaveAttribute('type', 'date');
    expect(actualDate).toHaveValue('2026-06-15');
    await userEvent.click(within(operations).getByRole('button', { name: 'Load grid' }));
    expect(readLastKpiOrgUnitActualGridDate()).toBe('2026-06-15');
    const anActual = await within(operations).findByLabelText('An Nguyen Revenue VND actual');
    await userEvent.clear(anActual);
    await userEvent.type(anActual, '0');
    await userEvent.click(within(operations).getByRole('button', { name: 'Save changed cells' }));
    expect(await screen.findByText('Actual cells saved.')).toBeInTheDocument();
    expect(readLastKpiOrgUnitActualPayload()).toMatchObject({
      actualDate: '2026-06-15',
      actualValue: 0,
    });

    const updatedAnActual = await within(operations).findByLabelText(
      'An Nguyen Revenue VND actual',
    );
    await userEvent.clear(updatedAnActual);
    await userEvent.type(updatedAnActual, '100.000');
    await userEvent.click(within(operations).getByRole('button', { name: 'Save changed cells' }));
    await waitFor(() =>
      expect(screen.getAllByText('Actual cells saved.').length).toBeGreaterThanOrEqual(2),
    );
  });

  it('allows UNIT_MANAGER allocation draft and submit where the ORG_UNIT fixture is draftable', async () => {
    await renderRoute('/manager/kpi/plans/kpi-plan-org-unit-draft-allocation', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
    });

    const operations = await screen.findByTestId('org-unit-operations');
    const backLink = screen.getByRole('link', { name: 'Back to managed KPI' });
    expect(backLink.querySelector('svg')).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/manager/kpi');
    expect(
      await within(operations).findByText(
        'Progress and actual rows are available only after allocation rows are published.',
      ),
    ).toBeInTheDocument();
    expect(
      await within(operations).findByRole('button', { name: 'Save Allocation Draft' }),
    ).toBeEnabled();
    expect(
      await within(operations).findByRole('button', { name: 'Submit Allocation' }),
    ).toBeEnabled();

    const targetInput = await within(operations).findByLabelText('An Nguyen Revenue VND');
    expect(targetInput).toHaveValue('1.000.000');
    const firstMemberSelect = within(operations).getByRole('combobox', {
      name: 'Managed member 1',
    });
    expect(firstMemberSelect).toHaveTextContent('An Nguyen - EP-OPS-001');
    expect(firstMemberSelect).toHaveTextContent('Bao Le - EP-OPS-002');
    expect(firstMemberSelect).not.toHaveTextContent('Mina Manager');

    await userEvent.click(within(operations).getByRole('button', { name: 'Add member' }));
    const secondMemberSelect = within(operations).getByRole('combobox', {
      name: 'Managed member 2',
    });
    await userEvent.selectOptions(secondMemberSelect, 'employment-profile-ops-002');
    const baoTargetInput = await within(operations).findByLabelText('Bao Le Revenue VND');
    await userEvent.clear(baoTargetInput);
    await userEvent.type(baoTargetInput, '1.000.000');
    await userEvent.click(within(operations).getByRole('button', { name: 'Remove member 1' }));
    expect(within(operations).queryByLabelText('An Nguyen Revenue VND')).not.toBeInTheDocument();

    await userEvent.click(
      within(operations).getByRole('button', { name: 'Save Allocation Draft' }),
    );
    expect(await screen.findByText('Allocation draft saved.')).toBeInTheDocument();
    await waitFor(() => expect(readLastKpiAllocationDraftPayload()).toBeDefined());
    const parsedDraft = parseKpiAllocationDraftPayloadForTest(readLastKpiAllocationDraftPayload());
    expect(parsedDraft.allocations).toHaveLength(1);
    expect(parsedDraft.allocations[0]).toMatchObject({
      employmentProfileId: 'employment-profile-ops-002',
    });
    expect(parsedDraft.allocations[0]?.targetMetrics[0]?.targetValue).toBe(1000000);

    await userEvent.click(within(operations).getByRole('button', { name: 'Submit Allocation' }));
    expect(await screen.findByText('Allocation submitted for approval.')).toBeInTheDocument();
    expect(await within(operations).findAllByText('Pending Approval')).not.toHaveLength(0);
  });

  it('renders Talent Group KPI only for TalentGroup-only manager context and queries Talent Group plans', async () => {
    const subjectTypes: Array<string | null> = [];
    server.use(
      http.get('*/admin/kpi/plans', ({ request }) => {
        subjectTypes.push(new URL(request.url).searchParams.get('subjectType'));
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/manager/kpi', () => {
      setMockManagerWorkspaceContext(managerWorkspaceTalentGroupOnlyContext());
    });

    expect(await screen.findByTestId('manager-kpi-tab-talentGroup')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-tab-unit')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(subjectTypes).toEqual(['TALENT_GROUP']);
    });
  });

  it('registers direct Manager Talent Group KPI detail outside Admin shell', async () => {
    await renderRoute('/manager/kpi/plans/kpi-plan-published', () => {
      setMockManagerWorkspaceContext(managerWorkspaceTalentGroupOnlyContext());
    });

    expect(await screen.findByTestId('manager-kpi-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Published team KPI' })).toBeInTheDocument();
    expect(screen.getByText('Talent Group')).toBeInTheDocument();
    expect(screen.getByText('Talent Group KPI is read-only here')).toBeInTheDocument();
    expect(screen.queryByTestId('org-unit-operations')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
  });

  it('does not expose fake KPI detail access without manager assignments', async () => {
    await renderRoute('/manager/kpi/plans/kpi-plan-org-unit', () => {
      setMockManagerWorkspaceContext(managerWorkspaceNoAssignmentsContext());
    });

    expect(await screen.findByText('No managed KPI')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-detail')).not.toBeInTheDocument();
    expect(screen.queryByText('Operations unit KPI')).not.toBeInTheDocument();
  });

  it('fails closed for direct unmanaged ORG_UNIT KPI detail route', async () => {
    await renderRoute('/manager/kpi/plans/kpi-plan-org-unit', () => {
      const context = managerWorkspaceOrgUnitOnlyContext();
      setMockManagerWorkspaceContext({
        ...context,
        scopes: {
          ...context.scopes,
          orgUnits: context.scopes.orgUnits.map((scope) => ({
            ...scope,
            orgUnitId: 'org-unit-unmanaged',
          })),
        },
      });
    });

    expect(await screen.findByText('KPI plan unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-detail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('org-unit-operations')).not.toBeInTheDocument();
  });

  it('does not show KPI operations for no-capability manager context', async () => {
    await renderRoute('/manager/kpi/plans/kpi-plan-org-unit', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitNoKpiCapabilityContext());
    });

    expect(await screen.findByText('No managed KPI')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-detail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('org-unit-operations')).not.toBeInTheDocument();
  });

  it.each([
    ['DEPARTMENT_OWNER', managerWorkspaceOrgUnitDepartmentOwnerContext],
    ['UNIT_OPERATOR', managerWorkspaceOrgUnitOperatorContext],
  ])('%s remains read-only for current ORG_UNIT KPI behavior', async (_role, contextFactory) => {
    await renderRoute('/manager/kpi/plans/kpi-plan-org-unit', () => {
      setMockManagerWorkspaceContext(contextFactory());
    });

    const operations = await screen.findByTestId('org-unit-operations');
    expect(
      within(operations).getByText('Read-only for this actor or plan state'),
    ).toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Save Allocation Draft' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Submit Allocation' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: /Remove member/ }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Save changed cells' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Mark excused' }),
    ).not.toBeInTheDocument();

    await userEvent.click(within(operations).getByRole('button', { name: 'Load grid' }));
    expect(await within(operations).findByLabelText('An Nguyen Revenue VND actual')).toBeDisabled();
  });

  it('renders finalized ORG_UNIT finalResult and keeps manager mutation UI absent', async () => {
    await renderRoute('/manager/kpi/plans/kpi-plan-org-unit-finalized', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
    });

    const operations = await screen.findByTestId('org-unit-operations');
    const finalResult = await within(operations).findByLabelText('Finalized result');
    expect(
      within(finalResult).getByRole('heading', { name: 'Finalized result' }),
    ).toBeInTheDocument();
    expect(within(finalResult).getAllByText(/Revenue actual/).length).toBeGreaterThan(0);
    expect(
      within(operations).queryByRole('button', { name: 'Save Allocation Draft' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Submit Allocation' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: /Remove member/ }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Save changed cells' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Mark excused' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument();
  });

  it('renders both KPI tabs for dual manager context without forcing Unit KPI to Talent Group', async () => {
    const user = userEvent.setup();
    const subjectTypes: Array<string | null> = [];
    server.use(
      http.get('*/admin/kpi/plans', ({ request }) => {
        subjectTypes.push(new URL(request.url).searchParams.get('subjectType'));
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/manager/kpi', () => {
      setMockManagerWorkspaceContext(managerWorkspaceDualContext());
    });

    expect(await screen.findByTestId('manager-kpi-tab-unit')).toBeInTheDocument();
    await user.click(screen.getByTestId('manager-kpi-tab-talentGroup'));

    await waitFor(() => {
      expect(subjectTypes).toEqual(['ORG_UNIT', 'TALENT_GROUP']);
    });
  });

  it('renders /manager/work-shifts with managed OrgUnit and TalentGroup published shifts only', async () => {
    let rawAdminWorkShiftCalls = 0;
    server.use(
      http.get('*/admin/work-shifts', () => {
        rawAdminWorkShiftCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
    });

    expect(await screen.findByTestId('manager-panel-work')).toBeInTheDocument();
    expect(await screen.findByText('Org Unit Member')).toBeInTheDocument();
    expect(await screen.findByText('Talent Group Member')).toBeInTheDocument();
    expect(screen.getAllByTestId('manager-work-shift-row')).toHaveLength(2);
    expect(
      screen.getByText('Draft rosters are not visible here until they are published.'),
    ).toBeInTheDocument();
    expect(rawAdminWorkShiftCalls).toBe(0);
    expect(
      screen.queryByRole('button', { name: /create|edit|cancel|request|approve/i }),
    ).not.toBeInTheDocument();
  });

  it('counts partial-batch Manager lines, discloses bounded results, and keeps card CTAs read-only', async () => {
    const user = userEvent.setup();
    let mutationCalls = 0;
    server.use(
      http.post('*/admin/manager-workspace/work-schedule/*', () => {
        mutationCalls += 1;
        return HttpResponse.json(
          { message: 'Action Needed cards must not mutate' },
          { status: 500 },
        );
      }),
      http.get('*/admin/manager-workspace/work-schedule/request-batches', () =>
        HttpResponse.json({
          data: {
            items: [
              {
                id: 'partial-manager-request',
                batchCode: 'WSB-MANAGER-PARTIAL',
                status: 'PARTIALLY_APPROVED',
                periodMonth: '2026-06',
                scopeSummary: 'ORG_UNIT',
                note: null,
                lineCounts: {
                  total: 7,
                  pending: 2,
                  approved: 2,
                  rejected: 1,
                  cancelled: 0,
                  failedToApply: 2,
                },
                clientToken: 'manager-partial-request',
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
      http.get('*/admin/manager-workspace/work-schedule/availability-batches', () =>
        HttpResponse.json({
          data: {
            items: [
              {
                id: 'partial-manager-availability',
                availabilityBatchCode: 'AVB-MANAGER-PARTIAL',
                status: 'PARTIALLY_APPROVED',
                periodMonth: '2026-06',
                targetType: 'ORG_UNIT',
                targetMode: 'EXACT_ONLY',
                targetOrgUnitId: 'org-content',
                targetTalentGroupId: null,
                note: null,
                lineCounts: { total: 4, pending: 2, approved: 1, rejected: 1, cancelled: 0 },
                clientToken: 'manager-partial-availability',
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
    );

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
    });

    const actionNeeded = await screen.findByTestId('manager-work-action-needed');
    expect(
      await within(screen.getByTestId('manager-action-needed-pendingRequests')).findByText('2'),
    ).toBeInTheDocument();
    expect(
      await within(screen.getByTestId('manager-action-needed-rejectedRequests')).findByText('3'),
    ).toBeInTheDocument();
    expect(
      await within(screen.getByTestId('manager-action-needed-pendingAvailability')).findByText('2'),
    ).toBeInTheDocument();
    expect(
      await within(screen.getByTestId('manager-action-needed-rejectedAvailability')).findByText(
        '1',
      ),
    ).toBeInTheDocument();
    expect(
      within(actionNeeded).getByText(
        'Counts show the loaded results for the selected month, not exact global totals.',
      ),
    ).toBeInTheDocument();
    expect(
      within(actionNeeded).queryByRole('button', { name: /approve|reject|apply/i }),
    ).not.toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('manager-action-needed-pendingAvailability')).getByRole('button', {
        name: 'View items',
      }),
    );

    expect(await screen.findByTestId('manager-work-availability')).toBeInTheDocument();
    expect(mutationCalls).toBe(0);
  });

  it('submits a manager request batch through Manager Workspace endpoints only', async () => {
    const user = userEvent.setup();
    let managerSubmitCalls = 0;
    let rawAdminBatchCalls = 0;
    server.use(
      http.post('*/admin/manager-workspace/work-schedule/request-batches', async ({ request }) => {
        managerSubmitCalls += 1;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toMatchObject({
          periodMonth: '2026-06',
        });
        expect(Array.isArray(body.lines)).toBe(true);
        return HttpResponse.json({
          data: {
            id: 'manager-batch-created',
            batchCode: 'WSB-CREATED',
            status: 'PENDING',
            periodMonth: '2026-06',
            scopeSummary: 'ORG_UNIT',
            note: null,
            lineCounts: {
              total: 1,
              pending: 1,
              approved: 0,
              rejected: 0,
              cancelled: 0,
              failedToApply: 0,
            },
            clientToken: 'manager-ui-test-token',
            submittedAt: Date.now(),
            cancelledAt: null,
            resolvedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lines: [],
          },
        });
      }),
      http.all('*/admin/work-schedule/request-batches*', () => {
        rawAdminBatchCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
    });

    await user.click(await screen.findByRole('tab', { name: 'Requests' }));
    await user.click(screen.getByRole('button', { name: 'Add create' }));
    await user.click(screen.getByRole('button', { name: 'Submit batch' }));

    expect(
      await screen.findByText('Each line reason must be 10-1000 characters.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Requested start'), {
      target: { value: '2026-06-20T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Requested end'), {
      target: { value: '2026-06-20T11:00' },
    });
    await user.type(screen.getByLabelText('Reason'), 'Need a special production support shift.');
    await user.click(screen.getByRole('button', { name: 'Submit batch' }));

    await waitFor(() => expect(managerSubmitCalls).toBe(1));
    expect(rawAdminBatchCalls).toBe(0);
    expect(screen.queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
  });

  it('submits manager availability through Manager Workspace endpoints only', async () => {
    const user = userEvent.setup();
    let managerSubmitCalls = 0;
    let managerMemberPickerCalls = 0;
    let rawAdminAvailabilityCalls = 0;
    server.use(
      http.get('*/admin/manager-workspace/work-schedule/availability-members', ({ request }) => {
        managerMemberPickerCalls += 1;
        const url = new URL(request.url);
        expect(url.searchParams.get('targetType')).toBe('ORG_UNIT');
        expect(url.searchParams.get('targetId')).toBe('org-unit-001');
        return HttpResponse.json({
          data: {
            target: {
              targetType: 'ORG_UNIT',
              targetId: 'org-unit-001',
              targetMode: 'EXACT_ONLY',
              name: 'Content Ops',
              displayName: 'Content Ops',
            },
            members: [
              {
                employmentProfileId: 'ep-pre-roster',
                displayName: 'Pre-roster Member',
                employeeCode: 'EP-PRE',
              },
            ],
            totalMembers: 1,
          },
        });
      }),
      http.post(
        '*/admin/manager-workspace/work-schedule/availability-batches',
        async ({ request }) => {
          managerSubmitCalls += 1;
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toMatchObject({
            periodMonth: '2026-06',
            targetType: 'ORG_UNIT',
            targetMode: 'EXACT_ONLY',
          });
          expect(Array.isArray(body.lines)).toBe(true);
          expect(body.lines).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ availabilityType: 'UNAVAILABLE_FULL_DAY' }),
              expect.objectContaining({
                availabilityType: 'PREFERRED_TIME',
                preferredStartLocalTime: '09:00',
                preferredEndLocalTime: '12:00',
              }),
              expect.objectContaining({ availabilityType: 'OTHER_AVAILABILITY_NOTE' }),
            ]),
          );
          expect(JSON.stringify(body)).not.toContain('UNAUTHORIZED_ABSENCE');
          expect(JSON.stringify(body)).not.toContain('EXTRA_SHIFT_AVAILABLE');
          return HttpResponse.json({
            data: {
              id: 'manager-availability-created',
              availabilityBatchCode: 'AVB-CREATED',
              status: 'PENDING',
              periodMonth: '2026-06',
              targetType: 'ORG_UNIT',
              targetMode: 'EXACT_ONLY',
              targetOrgUnitId: 'org-content',
              targetTalentGroupId: null,
              target: { id: 'org-content', name: 'Content Ops', displayName: 'Content Ops' },
              note: null,
              lineCounts: {
                total: 1,
                pending: 1,
                approved: 0,
                rejected: 0,
                cancelled: 0,
              },
              clientToken: 'manager-availability-ui-test-token',
              submittedAt: Date.now(),
              cancelledAt: null,
              resolvedAt: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              lines: [],
            },
          });
        },
      ),
      http.all('*/admin/work-schedule/availability-batches*', () => {
        rawAdminAvailabilityCalls += 1;
        return HttpResponse.json({ data: { items: [] } });
      }),
    );

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
      setMockManagerWorkShifts({
        items: [],
        meta: {
          month: '2026-06',
          timezone: 'Asia/Ho_Chi_Minh',
          managedMemberCount: 0,
          representedMemberCount: 0,
          returnedShiftCount: 0,
        },
      });
    });

    await user.click(await screen.findByRole('tab', { name: 'Availability' }));
    expect(await screen.findByTestId('manager-work-availability')).toBeInTheDocument();
    expect(screen.getByText(/pre-roster planning signal/i)).toBeInTheDocument();
    expect(screen.queryByText('UNAUTHORIZED_ABSENCE')).not.toBeInTheDocument();
    expect(screen.queryByText('EXTRA_SHIFT_AVAILABLE')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add availability line' }));
    await user.click(screen.getByRole('button', { name: 'Submit availability batch' }));
    expect(await screen.findByText('Reason is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Reason'), 'Unavailable for roster planning.');
    await user.click(screen.getByRole('button', { name: 'Add availability line' }));
    await user.selectOptions(screen.getAllByLabelText('Availability type')[1], 'PREFERRED_TIME');
    await user.type(screen.getAllByLabelText('Reason')[1], 'Prefers a morning planning window.');
    await user.type(screen.getByLabelText('Preferred start'), '09:00');
    await user.type(screen.getByLabelText('Preferred end'), '12:00');
    await user.click(screen.getByRole('button', { name: 'Add availability line' }));
    await user.selectOptions(
      screen.getAllByLabelText('Availability type')[2],
      'OTHER_AVAILABILITY_NOTE',
    );
    await user.type(screen.getAllByLabelText('Reason')[2], 'Advisory planning note.');
    await user.click(screen.getByRole('button', { name: 'Submit availability batch' }));

    await waitFor(() => expect(managerSubmitCalls).toBe(1));
    expect(managerMemberPickerCalls).toBeGreaterThan(0);
    expect(rawAdminAvailabilityCalls).toBe(0);
    expect(screen.queryByRole('button', { name: /approve|reject|apply/i })).not.toBeInTheDocument();
  });

  it('submits availability from default picker fixtures when no published WorkShifts exist', async () => {
    const user = userEvent.setup();

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
      setMockManagerWorkShifts({
        items: [],
        meta: {
          month: '2026-06',
          timezone: 'Asia/Ho_Chi_Minh',
          managedMemberCount: 1,
          representedMemberCount: 0,
          returnedShiftCount: 0,
        },
      });
    });

    await user.click(await screen.findByRole('tab', { name: 'Availability' }));
    await user.click(await screen.findByRole('button', { name: 'Add availability line' }));
    expect(screen.getByRole('option', { name: /Content Member One/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Reason'), 'Pre-roster availability without shifts.');
    await user.click(screen.getByRole('button', { name: 'Submit availability batch' }));

    expect((await screen.findAllByText('AVB-000002')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /approve|reject|apply/i })).not.toBeInTheDocument();
  });

  it('keeps Availability usable when the published-shift request fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/manager-workspace/work-schedule/work-shifts', () =>
        HttpResponse.json({ message: 'Published shifts unavailable' }, { status: 503 }),
      ),
    );

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
    });

    expect(
      await screen.findByText('Managed published shifts could not be loaded.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Availability' }));

    expect(await screen.findByTestId('manager-work-availability')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add availability line' })).toBeEnabled();
    expect(
      screen.queryByText('Managed published shifts could not be loaded.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve|reject|apply/i })).not.toBeInTheDocument();
  });

  it('cancels own pending availability line and batch only with a reason through Flow B endpoints', async () => {
    const user = userEvent.setup();
    let cancelLineCalls = 0;
    let cancelBatchCalls = 0;
    let rawAdminAvailabilityCalls = 0;
    server.use(
      http.post(
        '*/admin/manager-workspace/work-schedule/availability-batches/:batchId/lines/:lineId/cancel',
        () => {
          cancelLineCalls += 1;
          return undefined;
        },
      ),
      http.post(
        '*/admin/manager-workspace/work-schedule/availability-batches/:batchId/cancel',
        () => {
          cancelBatchCalls += 1;
          return undefined;
        },
      ),
      http.all('*/admin/work-schedule/availability-batches*', () => {
        rawAdminAvailabilityCalls += 1;
        return HttpResponse.json({ data: { items: [] } });
      }),
    );

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
    });
    await user.click(await screen.findByRole('tab', { name: 'Availability' }));
    expect((await screen.findAllByText('AVB-000001')).length).toBeGreaterThan(0);

    const cancelLine = screen
      .getAllByRole('button', { name: 'Cancel pending line' })
      .find((button) => !button.hasAttribute('disabled'));
    expect(cancelLine).toBeDefined();
    if (!cancelLine) {
      return;
    }
    await user.click(cancelLine);
    expect(await screen.findByText('Cancellation reason is required.')).toBeInTheDocument();
    expect(cancelLineCalls).toBe(0);

    const reason = screen.getByLabelText('Cancellation reason');
    await user.type(reason, 'Manager cancels this pending availability line.');
    await user.click(cancelLine);
    await waitFor(() => expect(cancelLineCalls).toBe(1));

    const cancelBatch = screen.getByRole('button', { name: 'Cancel pending batch' });
    await user.click(cancelBatch);
    expect(await screen.findByText('Cancellation reason is required.')).toBeInTheDocument();
    expect(cancelBatchCalls).toBe(0);
    await user.type(reason, 'Manager cancels remaining pending availability.');
    await user.click(cancelBatch);
    await waitFor(() => expect(cancelBatchCalls).toBe(1));

    expect(rawAdminAvailabilityCalls).toBe(0);
    expect(screen.queryByRole('button', { name: /approve|reject|apply/i })).not.toBeInTheDocument();
  });

  it('rejects unsupported availability apply and policy statuses', () => {
    for (const parseApplyStatus of [
      parseManagerAvailabilityApplyStatusForTest,
      parseWorkScheduleAvailabilityApplyStatusForTest,
    ]) {
      expect(() => parseApplyStatus('FUTURE_STATUS')).toThrow();
    }
    for (const parsePolicyStatus of [
      parseManagerAvailabilityPolicyEvaluationStatusForTest,
      parseWorkScheduleAvailabilityPolicyEvaluationStatusForTest,
    ]) {
      expect(() => parsePolicyStatus('EVALUATED')).toThrow();
    }
  });

  it('constrains availability members to the selected target and clears prior draft lines', async () => {
    const user = userEvent.setup();

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
    });

    await user.click(await screen.findByRole('tab', { name: 'Availability' }));
    await user.click(await screen.findByRole('button', { name: 'Add availability line' }));
    await screen.findByRole('option', { name: 'Content Member One (EP-CONTENT-1)' });
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Roster target'), 'TALENT_GROUP:group-001');

    await waitFor(() => expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add availability line' }));
    expect(
      await screen.findByRole('option', { name: 'Creator Member One (EP-CREATOR-1)' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Content Member One (EP-CONTENT-1)' }),
    ).not.toBeInTheDocument();
  });

  it('adds reschedule and cancel lines, removes a draft line, and submits through Manager endpoints only', async () => {
    const user = userEvent.setup();
    let rawAdminBatchCalls = 0;
    let capturedPayload: Record<string, unknown> | undefined;
    server.use(
      http.post('*/admin/manager-workspace/work-schedule/request-batches', async ({ request }) => {
        capturedPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            id: 'manager-batch-reschedule-cancel',
            batchCode: 'WSB-RESCHEDULE-CANCEL',
            status: 'PENDING',
            periodMonth: '2026-06',
            scopeSummary: 'ORG_UNIT',
            note: null,
            lineCounts: {
              total: 2,
              pending: 2,
              approved: 0,
              rejected: 0,
              cancelled: 0,
              failedToApply: 0,
            },
            clientToken: 'manager-ui-test-token',
            submittedAt: Date.now(),
            cancelledAt: null,
            resolvedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lines: [],
          },
        });
      }),
      http.all('*/admin/work-schedule/request-batches*', () => {
        rawAdminBatchCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
    });

    await user.click(await screen.findByRole('tab', { name: 'Requests' }));
    await user.click(screen.getByRole('button', { name: 'Add create' }));
    await user.click(screen.getByRole('button', { name: 'Add reschedule' }));
    await user.click(screen.getByRole('button', { name: 'Add cancel' }));

    expect(screen.getAllByRole('button', { name: 'Remove line' })).toHaveLength(3);
    await user.click(screen.getAllByRole('button', { name: 'Remove line' })[0]);
    expect(screen.getAllByRole('button', { name: 'Remove line' })).toHaveLength(2);

    const reasonFields = screen.getAllByLabelText('Reason');
    await user.type(reasonFields[0], 'Reschedule to align with production coverage.');
    await user.type(reasonFields[1], 'Cancel because production coverage is no longer needed.');
    await user.click(screen.getByRole('button', { name: 'Submit batch' }));

    await waitFor(() => expect(capturedPayload).toBeDefined());
    expect(capturedPayload).toMatchObject({ periodMonth: '2026-06' });
    const lines = capturedPayload?.lines as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.requestType)).toEqual(['RESCHEDULE_SHIFT', 'CANCEL_SHIFT']);
    expect(lines[0]).toMatchObject({
      memberEmploymentProfileId: 'ep-org-member',
      workShiftId: 'manager-shift-org',
    });
    expect(lines[1]).toMatchObject({
      memberEmploymentProfileId: 'ep-org-member',
      workShiftId: 'manager-shift-org',
      requestedStartAt: null,
      requestedEndAt: null,
      title: null,
    });
    expect(rawAdminBatchCalls).toBe(0);
    expect(screen.queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
  });

  it('cancels own pending request lines and batches with a manager cancellation reason only', async () => {
    const user = userEvent.setup();
    let rawAdminBatchCalls = 0;
    server.use(
      http.all('*/admin/work-schedule/request-batches*', () => {
        rawAdminBatchCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
    });

    await user.click(await screen.findByRole('tab', { name: 'Requests' }));
    expect((await screen.findAllByText('WSB-202606-000001')).length).toBeGreaterThan(0);

    const cancellationReason = screen.getByLabelText('Cancellation reason');
    const cancelLine = await screen.findAllByRole('button', { name: 'Cancel line' });
    expect(cancelLine[0]).toBeDisabled();
    await user.type(cancellationReason, 'Manager cancellation reason.');
    await user.click(cancelLine[0]);

    expect(await screen.findByText('Manager cancellation reason.')).toBeInTheDocument();

    const cancelBatch = await screen.findByRole('button', { name: 'Cancel batch' });
    await user.click(cancelBatch);

    expect(await screen.findAllByText('Cancelled')).not.toHaveLength(0);
    expect(rawAdminBatchCalls).toBe(0);
    expect(screen.queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
  });

  it('renders Managed Work empty state when no published shifts or eligible members exist', async () => {
    await renderRoute('/manager/work-shifts', () => {
      setMockManagerWorkspaceContext(managerWorkspaceWorkEnabledContext());
      setMockManagerWorkShifts({
        items: [],
        meta: {
          month: '2026-06',
          timezone: 'Asia/Ho_Chi_Minh',
          managedMemberCount: 0,
          representedMemberCount: 0,
          returnedShiftCount: 0,
        },
      });
    });

    expect(await screen.findByText(/no eligible active managed members/i)).toBeInTheDocument();
    expect(screen.queryByTestId('manager-work-shift-row')).not.toBeInTheDocument();
  });

  it('rejects unsafe manager WorkShift fields at the client boundary', () => {
    expect(() =>
      parseManagerWorkShiftListForTest({
        data: {
          items: [
            {
              workShiftId: 'shift-unsafe',
              title: 'Unsafe shift',
              status: 'ACTIVE',
              shiftStartAt: 1,
              shiftEndAt: 2,
              timezone: 'Asia/Ho_Chi_Minh',
              sourceType: 'MANUAL',
              sourceRosterMonth: null,
              userAuthId: 'user-secret',
              member: {
                employmentProfileId: 'ep-1',
                displayName: 'Safe member',
              },
            },
          ],
          meta: {
            month: '2026-06',
            timezone: 'Asia/Ho_Chi_Minh',
            managedMemberCount: 1,
            representedMemberCount: 1,
            returnedShiftCount: 1,
          },
        },
      }),
    ).toThrow();
  });

  it('rejects unsafe manager context fields at the client boundary', () => {
    expect(() =>
      parseManagerWorkspaceContextForTest({
        data: {
          ...managerWorkspaceDualContext(),
          roleAssignments: [{ roleId: 'role-team-manager' }],
        },
      }),
    ).toThrow();
  });
});
