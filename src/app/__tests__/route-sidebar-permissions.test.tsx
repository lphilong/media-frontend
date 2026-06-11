import i18n from 'i18next';
import { act, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import { renderAppWithProviders } from '@test/render-app-route';

type MockCapabilities = Parameters<typeof setMockCurrentActorCapabilities>[0];

const makeCapabilities = (
  overrides: Partial<Pick<MockCapabilities, 'permissions' | 'roles' | 'scopeGrants'>>,
): MockCapabilities => ({
  id: 'route-sidebar-permissions-user',
  type: 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: overrides.roles ?? [],
  permissions: overrides.permissions ?? [],
  scopeGrants: overrides.scopeGrants ?? {},
  generatedAt: '2026-05-24T00:00:00.000Z',
});

const renderRoute = async (path: string, capabilities: MockCapabilities): Promise<void> => {
  await setLocale('en');
  setMockCurrentActorCapabilities(capabilities);

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

describe('route and sidebar permission model', () => {
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
    expect(await screen.findByRole('heading', { name: 'Official Work Shifts' })).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { level: 1, name: 'Employment Terms / Salary' }))
      .toBeInTheDocument();
    expect(employmentTerms).toHaveClass('text-accent');
    expect(orgUnits.compareDocumentPosition(employmentProfiles) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(
      employmentProfiles.compareDocumentPosition(employmentTerms) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      employmentTerms.compareDocumentPosition(peopleReadiness) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText('Labor Contract')).not.toBeInTheDocument();
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
