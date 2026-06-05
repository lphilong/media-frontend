import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, vi } from 'vitest';

import { appRoutes } from '@app/router/router';
import { parseKpiAllocationDraftPayloadForTest } from '@modules/kpi/api/kpi.api';
import { parseManagerWorkspaceContextForTest } from '@modules/manager-workspace/api/manager-workspace.api';
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
  resetManagerWorkspaceMockData,
  setMockManagerWorkspaceContext,
} from '@test/msw/manager-workspace-handlers';
import { readLastKpiAllocationDraftPayload, resetKpiMockData } from '@test/msw/kpi-handlers';
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

    expect(await screen.findByTestId('manager-workspace-shell')).toBeInTheDocument();
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
    expect(await screen.findByTestId('manager-kpi-tab-unit')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
  });

  it('redirects manager-only Admin KPI detail entry to the Manager KPI detail route', async () => {
    await renderRoute('/kpi/plans/kpi-plan-org-unit', () => {
      setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
    });

    expect(await screen.findByTestId('manager-kpi-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operations unit KPI' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
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

    await userEvent.click(within(operations).getByRole('button', { name: 'Load grid' }));
    const anActual = await within(operations).findByLabelText('An Nguyen Revenue VND actual');
    await userEvent.clear(anActual);
    await userEvent.type(anActual, '0');
    await userEvent.click(within(operations).getByRole('button', { name: 'Save changed cells' }));
    expect(await screen.findByText('Actual cells saved.')).toBeInTheDocument();

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
