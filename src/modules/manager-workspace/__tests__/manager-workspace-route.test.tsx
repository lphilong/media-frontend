import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { appRoutes } from '@app/router/router';
import { parseManagerWorkspaceContextForTest } from '@modules/manager-workspace/api/manager-workspace.api';
import { setLocale } from '@shared/i18n/i18n';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import {
  managerWorkspaceDualContext,
  managerWorkspaceNoAssignmentsContext,
  managerWorkspaceNoProfileContext,
  managerWorkspaceOrgUnitOnlyContext,
  managerWorkspaceTalentGroupOnlyContext,
  resetManagerWorkspaceMockData,
  setMockManagerWorkspaceContext,
} from '@test/msw/manager-workspace-handlers';
import { resetKpiMockData } from '@test/msw/kpi-handlers';
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

const renderRoute = async (path: string, setup?: () => void): Promise<void> => {
  cleanup();
  await setLocale('en');
  resetKpiMockData();
  resetManagerWorkspaceMockData();
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

    expect(await screen.findByTestId('manager-workspace-shell')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Manager Workspace' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
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
