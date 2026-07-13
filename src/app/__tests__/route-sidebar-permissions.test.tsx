import i18n from 'i18next';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import {
  getMockCurrentActorCapabilities,
  resetIdentityAccessMockData,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import { renderAppWithProviders } from '@test/render-app-route';

type MockCapabilities = Parameters<typeof setMockCurrentActorCapabilities>[0];

const makeCapabilities = (
  overrides: Partial<
    Pick<MockCapabilities, 'permissions' | 'roles' | 'scopeGrants' | 'type' | 'accountContexts'> &
      Pick<MockCapabilities, 'workspaceAvailability'>
  >,
): MockCapabilities => ({
  id: 'route-sidebar-permissions-user',
  type: overrides.type ?? 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: overrides.roles ?? [],
  permissions: overrides.permissions ?? [],
  scopeGrants: overrides.scopeGrants ?? {},
  accountContexts: overrides.accountContexts ?? ['ADMIN_CONSOLE'],
  ...(overrides.workspaceAvailability
    ? { workspaceAvailability: overrides.workspaceAvailability }
    : {}),
  generatedAt: '2026-05-24T00:00:00.000Z',
});

const renderRoute = async (path: string, capabilities: MockCapabilities): Promise<void> => {
  cleanup();
  await setLocale('en');
  setMockCurrentActorCapabilities(capabilities);

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

const workspaceWaitOptions = { timeout: 5000 };

describe('route and sidebar permission model', () => {
  afterEach(() => {
    cleanup();
    resetIdentityAccessMockData();
  });

  it('keeps MSW workspace availability fail-closed unless Account Context is explicit', () => {
    setMockCurrentActorCapabilities({
      id: 'admin-without-account-contexts',
      type: 'admin',
      context: 'ADMIN',
      isActive: true,
      roles: ['ADMIN_FULL'],
      permissions: ['dashboardLite.read'],
      scopeGrants: { dashboardLite: ['global'] },
      generatedAt: '2026-05-24T00:00:00.000Z',
    });
    expect(getMockCurrentActorCapabilities().accountContexts).toBeUndefined();
    expect(getMockCurrentActorCapabilities().workspaceAvailability).toBeUndefined();

    setMockCurrentActorCapabilities({
      id: 'staff-without-account-contexts',
      type: 'staff',
      context: 'ADMIN',
      isActive: true,
      roles: ['TALENT_STAFF_SELF'],
      permissions: ['workSchedule.read'],
      scopeGrants: { workSchedule: ['self'] },
      generatedAt: '2026-05-24T00:00:00.000Z',
    });
    expect(getMockCurrentActorCapabilities().accountContexts).toBeUndefined();
    expect(getMockCurrentActorCapabilities().workspaceAvailability).toBeUndefined();

    setMockCurrentActorCapabilities({
      id: 'manager-with-explicit-account-context',
      type: 'staff',
      context: 'ADMIN',
      isActive: true,
      roles: ['TEAM_MANAGER'],
      permissions: ['kpi.read'],
      scopeGrants: { kpi: ['managedGroup'] },
      accountContexts: ['MANAGER_CONSOLE'],
      generatedAt: '2026-05-24T00:00:00.000Z',
    });
    expect(getMockCurrentActorCapabilities().workspaceAvailability?.primaryWorkspace).toBe(
      'MANAGER_CONSOLE',
    );
  });

  it('preserves explicit backend-shaped workspace availability in MSW', () => {
    setMockCurrentActorCapabilities({
      id: 'explicit-workspace-user',
      type: 'admin',
      context: 'ADMIN',
      isActive: true,
      roles: ['ADMIN_FULL'],
      permissions: ['dashboardLite.read'],
      scopeGrants: { dashboardLite: ['global'] },
      workspaceAvailability: {
        primaryWorkspace: 'STAFF_CONSOLE',
        availableWorkspaces: [
          {
            context: 'STAFF_CONSOLE',
            available: true,
            source: 'ACCOUNT_CONTEXT',
            reasonCodes: ['ACCOUNT_CONTEXT_ACTIVE'],
            trace: [{ source: 'ACCOUNT_CONTEXT', context: 'STAFF_CONSOLE', matched: true }],
          },
          {
            context: 'MANAGER_CONSOLE',
            available: false,
            source: 'ACCOUNT_CONTEXT',
            reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
            trace: [{ source: 'ACCOUNT_CONTEXT', context: 'MANAGER_CONSOLE', matched: false }],
          },
          {
            context: 'ADMIN_CONSOLE',
            available: false,
            source: 'ACCOUNT_CONTEXT',
            reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
            trace: [{ source: 'ACCOUNT_CONTEXT', context: 'ADMIN_CONSOLE', matched: false }],
          },
        ],
        ownDataAvailable: true,
        managerResponsibilitiesAvailable: false,
        effectiveAccessTraceAvailable: true,
        sourceTrace: [
          {
            source: 'ACCOUNT_CONTEXT',
            accountContexts: ['STAFF_CONSOLE'],
            primaryWorkspace: 'STAFF_CONSOLE',
          },
        ],
      },
      generatedAt: '2026-05-24T00:00:00.000Z',
    });

    const capabilities = getMockCurrentActorCapabilities();
    expect(capabilities.accountContexts).toBeUndefined();
    expect(capabilities.workspaceAvailability?.primaryWorkspace).toBe('STAFF_CONSOLE');
    expect(capabilities.workspaceAvailability?.availableWorkspaces).toHaveLength(3);
  });

  it('uses backend primaryWorkspace for root landing across Admin, Manager, Staff, and no workspace', async () => {
    await renderRoute(
      '/',
      makeCapabilities({
        permissions: ['dashboardLite.read'],
        scopeGrants: { dashboardLite: ['global'] },
        accountContexts: ['ADMIN_CONSOLE'],
      }),
    );
    expect(await screen.findByTestId('admin-shell-main')).toBeInTheDocument();

    await renderRoute(
      '/',
      makeCapabilities({
        permissions: ['dashboardLite.read', 'kpi.read', 'kpi.readProgress'],
        scopeGrants: { dashboardLite: ['global'], kpi: ['managedGroup'] },
        accountContexts: ['ADMIN_CONSOLE', 'MANAGER_CONSOLE'],
        workspaceAvailability: {
          primaryWorkspace: 'MANAGER_CONSOLE',
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
              available: true,
              source: 'ACCOUNT_CONTEXT',
              reasonCodes: ['ACCOUNT_CONTEXT_ACTIVE'],
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
          managerResponsibilitiesAvailable: true,
          effectiveAccessTraceAvailable: true,
          sourceTrace: [],
        },
      }),
    );
    expect(
      await screen.findByTestId('manager-workspace-shell', {}, workspaceWaitOptions),
    ).toBeInTheDocument();

    await renderRoute(
      '/',
      makeCapabilities({
        permissions: ['dashboardLite.read', 'kpi.read', 'kpi.readProgress'],
        scopeGrants: { dashboardLite: ['global'], kpi: ['managedGroup'] },
        accountContexts: ['MANAGER_CONSOLE', 'ADMIN_CONSOLE'],
      }),
    );
    expect(await screen.findByTestId('admin-shell-main')).toBeInTheDocument();

    await renderRoute(
      '/',
      makeCapabilities({
        permissions: ['dashboardLite.read', 'kpi.read', 'kpi.readProgress'],
        scopeGrants: { dashboardLite: ['global'], kpi: ['managedGroup'] },
        accountContexts: ['MANAGER_CONSOLE'],
      }),
    );
    expect(
      await screen.findByTestId('manager-workspace-shell', {}, workspaceWaitOptions),
    ).toBeInTheDocument();

    await renderRoute(
      '/',
      makeCapabilities({
        type: 'staff',
        permissions: ['workSchedule.read'],
        scopeGrants: { workSchedule: ['self'] },
        accountContexts: ['STAFF_CONSOLE'],
      }),
    );
    expect(
      await screen.findByTestId('self-service-shell', {}, workspaceWaitOptions),
    ).toBeInTheDocument();

    await renderRoute(
      '/',
      makeCapabilities({
        type: 'staff',
        permissions: ['dashboardLite.read', 'workSchedule.read'],
        scopeGrants: { dashboardLite: ['global'], workSchedule: ['self'] },
        accountContexts: [],
      }),
    );
    expect(await screen.findByText('Chưa có chức năng được phân quyền')).toBeInTheDocument();
  });

  it('does not use actor type or permissions to grant workspace entry without backend availability', async () => {
    await renderRoute(
      '/dashboard',
      makeCapabilities({
        type: 'admin',
        permissions: ['dashboardLite.read'],
        scopeGrants: { dashboardLite: ['global'] },
        accountContexts: [],
      }),
    );
    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-dashboard')).not.toBeInTheDocument();

    await renderRoute(
      '/self-service',
      makeCapabilities({
        type: 'staff',
        permissions: ['workSchedule.read'],
        scopeGrants: { workSchedule: ['self'] },
        accountContexts: [],
      }),
    );
    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();

    await renderRoute(
      '/manager',
      makeCapabilities({
        type: 'staff',
        permissions: ['kpi.read', 'kpi.readProgress'],
        scopeGrants: { kpi: ['managedGroup'] },
        accountContexts: ['MANAGER_CONSOLE'],
      }),
    );
    expect(await screen.findByTestId('manager-workspace-shell')).toBeInTheDocument();
  });

  it('preserves admin root landing to the dashboard shell', async () => {
    await renderRoute(
      '/',
      makeCapabilities({
        roles: ['ADMIN_FULL'],
        permissions: ['dashboardLite.read'],
        scopeGrants: {
          dashboardLite: ['global'],
        },
      }),
    );

    expect(await screen.findByTestId('admin-shell-main')).toBeInTheDocument();
    expect(await screen.findByTestId('nav-link-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('self-service-shell')).not.toBeInTheDocument();
  });

  it('hides global-owned Admin WorkSchedule and Event modules from TEAM_MANAGER', async () => {
    await renderRoute(
      '/events',
      makeCapabilities({
        roles: ['TEAM_MANAGER'],
        permissions: [
          'workSchedule.read',
          'event.read',
          'talent.read',
          'talentGroup.read',
          'kpi.read',
          'kpi.readProgress',
        ],
        scopeGrants: {
          workSchedule: ['self', 'team'],
          eventAssignment: ['managedGroup'],
          kpi: ['managedGroup'],
        },
      }),
    );

    expect(await screen.findByTestId('nav-link-talents')).toBeInTheDocument();
    expect(await screen.findByTestId('nav-link-talent-groups')).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-events')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-work-shifts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-kpi')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-users')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-roles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-contract-registry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-revenue-ledger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-commission-rules')).not.toBeInTheDocument();
  });

  it('shows PRODUCTION_OPS Official Work Shifts from WorkSchedule nav', async () => {
    await renderRoute(
      '/work-shifts',
      makeCapabilities({
        roles: ['PRODUCTION_OPS'],
        permissions: [
          'event.read',
          'workSchedule.read',
          'workSchedule.create',
          'workSchedule.update',
          'workSchedule.manageLifecycle',
          'platformAccount.read',
          'studioResource.read',
        ],
        scopeGrants: {
          eventAssignment: ['global'],
          workSchedule: ['global'],
        },
      }),
    );

    expect(await screen.findByTestId('nav-link-work-shifts')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Official Work Shifts' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Global Ops Schedule')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('errors:permission.title'))).not.toBeInTheDocument();
  });

  it('shows Employment Terms under People & Organization as a real active route', async () => {
    await renderRoute(
      '/employment-terms',
      makeCapabilities({
        roles: ['HR_OPERATIONS'],
        permissions: ['orgUnit.read', 'employmentProfile.read', 'employmentTerms.read'],
        scopeGrants: {},
      }),
    );

    const orgUnits = await screen.findByTestId('nav-link-org-units');
    const employmentProfiles = await screen.findByTestId('nav-link-employment-profiles');
    const employmentTerms = await screen.findByTestId('nav-link-employment-terms');
    const peopleReadiness = await screen.findByTestId('nav-link-people-readiness');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Employment Terms / Salary' }),
    ).toBeInTheDocument();
    expect(employmentTerms).toHaveClass('text-accent');
    expect(
      orgUnits.compareDocumentPosition(employmentProfiles) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      employmentProfiles.compareDocumentPosition(employmentTerms) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      employmentTerms.compareDocumentPosition(peopleReadiness) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText('Labor Contract')).not.toBeInTheDocument();
  });

  it.each([
    [
      '/employment-terms',
      'employment-terms:page.title',
      ['orgUnit.read', 'employmentProfile.read', 'employmentTerms.read'],
      {},
    ],
    [
      '/employment-profiles/create',
      'employment-profile:createWorkflow.pageTitle',
      ['employmentProfile.read', 'employmentProfile.create'],
      {},
    ],
    [
      '/work-schedule/request-batches',
      'work-schedule:requestBatches.page.title',
      ['workSchedule.read', 'workSchedule.manageRequests'],
      { workSchedule: ['global'] },
    ],
    [
      '/work-schedule/availability-batches',
      'work-schedule:availabilityBatches.page.title',
      ['workSchedule.read', 'workSchedule.manageAvailability'],
      { workSchedule: ['global'] },
    ],
  ] as const)(
    'renders one shell-owned h1 for %s',
    async (path, titleKey, permissions, scopeGrants) => {
      await renderRoute(
        path,
        makeCapabilities({
          roles: ['ADMIN_FULL'],
          permissions: [...permissions],
          scopeGrants:
            'workSchedule' in scopeGrants ? { workSchedule: [...scopeGrants.workSchedule] } : {},
        }),
      );

      const title = i18n.t(titleKey);
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    },
  );

  it('groups key Admin modules under the UIX sidebar sections without changing access', async () => {
    await renderRoute(
      '/dashboard',
      makeCapabilities({
        roles: ['ADMIN_FULL'],
        permissions: [
          'dashboardLite.read',
          'user:view',
          'role:view',
          'orgUnit.read',
          'employmentProfile.read',
          'employmentTerms.read',
          'talent.read',
          'talentGroup.read',
          'platformAccount.read',
          'studioResource.read',
          'workSchedule.read',
          'event.read',
          'kpi.read',
          'contractRegistry.read',
          'revenueLedger.read',
          'commissionRule.read',
          'commissionSettlement.read',
        ],
        scopeGrants: {
          dashboardLite: ['global'],
          workSchedule: ['global'],
          eventAssignment: ['global'],
          kpi: ['global'],
          contractRegistry: ['global'],
          revenueLedger: ['global'],
          commission: ['global'],
        },
      }),
    );

    expect(await screen.findByText('Identity & Access')).toBeInTheDocument();
    expect(screen.getByText('People & Organization')).toBeInTheDocument();
    expect(screen.getByText('Talent & Operating Channels')).toBeInTheDocument();
    expect(screen.getByText('Work Schedule & Resources')).toBeInTheDocument();
    expect(screen.getAllByText('Events').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Commercial & Reconciliation')).toBeInTheDocument();

    const studioResources = await screen.findByTestId('nav-link-studio-resources');
    const workShifts = await screen.findByTestId('nav-link-work-shifts');
    const kpi = await screen.findByTestId('nav-link-kpi');
    const revenueLedger = await screen.findByTestId('nav-link-revenue-ledger');

    expect(screen.queryByTestId('nav-link-talent-kpi')).not.toBeInTheDocument();
    expect(
      studioResources.compareDocumentPosition(workShifts) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      kpi.compareDocumentPosition(revenueLedger) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('fails closed for HR department-only authority on raw Admin WorkSchedule routes', async () => {
    await renderRoute(
      '/work-schedule/department-shifts',
      makeCapabilities({
        roles: ['HR_OPERATIONS'],
        permissions: [
          'orgUnit.read',
          'employmentProfile.read',
          'talent.read',
          'talentGroup.read',
          'workSchedule.read',
          'studioResource.lookup',
        ],
        scopeGrants: {
          workSchedule: ['department'],
        },
      }),
    );

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-work-shifts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-studio-resources')).not.toBeInTheDocument();
  });

  it('canonicalizes TEAM_MANAGER managedGroup KPI direct route to Manager Workspace', async () => {
    await renderRoute(
      '/kpi',
      makeCapabilities({
        roles: ['TEAM_MANAGER'],
        permissions: ['kpi.read', 'kpi.readProgress'],
        scopeGrants: {
          kpi: ['managedGroup'],
        },
        accountContexts: ['MANAGER_CONSOLE'],
      }),
    );

    expect(await screen.findByTestId('manager-workspace-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-kpi')).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('errors:permission.title'))).not.toBeInTheDocument();
  });

  it('hides full Events from COMMERCIAL_FINANCE when only event.lookup is present', async () => {
    await renderRoute(
      '/contract-records',
      makeCapabilities({
        roles: ['COMMERCIAL_FINANCE'],
        permissions: [
          'orgUnit.lookup',
          'contractRegistry.read',
          'revenueLedger.read',
          'commissionRule.read',
          'commissionSettlement.read',
          'event.lookup',
          'talent.lookup',
          'platformAccount.lookup',
          'kpi.read',
          'kpi.readProgress',
        ],
        scopeGrants: {
          contractRegistry: ['global'],
          revenueLedger: ['global'],
          commission: ['global'],
          kpi: ['global'],
        },
      }),
    );

    expect(await screen.findByTestId('nav-link-contract-registry')).toBeInTheDocument();
    expect(await screen.findByTestId('nav-link-revenue-ledger')).toBeInTheDocument();
    expect(await screen.findByTestId('nav-link-commission-rules')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-events')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-org-units')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-talents')).not.toBeInTheDocument();
  });

  it('hides commercial modules when scope evidence is missing', async () => {
    await renderRoute(
      '/revenue-entries',
      makeCapabilities({
        roles: ['COMMERCIAL_FINANCE'],
        permissions: [
          'contractRegistry.read',
          'revenueLedger.read',
          'commissionRule.read',
          'commissionSettlement.read',
        ],
        scopeGrants: {},
      }),
    );

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-contract-registry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-revenue-ledger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-commission-rules')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-commission-settlements')).not.toBeInTheDocument();
  });

  it('shows No Access for direct lookup-only Event routes', async () => {
    await renderRoute(
      '/events',
      makeCapabilities({
        roles: ['COMMERCIAL_FINANCE'],
        permissions: ['event.lookup', 'contractRegistry.read'],
        scopeGrants: {
          contractRegistry: ['global'],
        },
      }),
    );

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('nav-link-events')).not.toBeInTheDocument();
    });
  });

  it('fails closed on raw Admin WorkSchedule routes for self-service-only staff', async () => {
    await renderRoute(
      '/work-shifts',
      makeCapabilities({
        roles: ['TALENT_STAFF_SELF'],
        permissions: [
          'workSchedule.read',
          'event.read',
          'employmentProfile.read',
          'talent.read',
          'kpi.readProgress',
        ],
        scopeGrants: {
          workSchedule: ['self'],
          kpi: ['self'],
        },
      }),
    );

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-work-shifts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-events')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-employment-profiles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-talents')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-kpi')).not.toBeInTheDocument();
  });

  it.each([
    [
      'manager-only actor',
      makeCapabilities({
        roles: ['TEAM_MANAGER'],
        permissions: ['workSchedule.read'],
        scopeGrants: { workSchedule: ['self', 'team'] },
      }),
    ],
    [
      'self-service-only actor',
      makeCapabilities({
        roles: ['TALENT_STAFF_SELF'],
        permissions: ['workSchedule.read'],
        scopeGrants: { workSchedule: ['self'] },
      }),
    ],
  ])('denies the raw Admin availability queue to a %s', async (_name, capabilities) => {
    await renderRoute('/work-schedule/availability-batches', capabilities);

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-work-shifts')).not.toBeInTheDocument();
  });
});
