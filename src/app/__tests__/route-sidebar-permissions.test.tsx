import i18n from 'i18next';
import { act, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
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
  await setLocale(DEFAULT_LOCALE);
  setMockCurrentActorCapabilities(capabilities);

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

describe('route and sidebar permission model', () => {
  it('shows TEAM_MANAGER scoped modules and hides admin-only and finance modules', async () => {
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
          workSchedule: ['self', 'team', 'department'],
          eventAssignment: ['managedGroup'],
          kpi: ['managedGroup'],
        },
      }),
    );

    expect(await screen.findByTestId('nav-link-events')).toBeInTheDocument();
    expect(await screen.findByTestId('nav-link-kpi')).toBeInTheDocument();
    expect(await screen.findByTestId('nav-link-talents')).toBeInTheDocument();
    expect(await screen.findByTestId('nav-link-talent-groups')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('errors:permission.title'))).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-users')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-roles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-contract-registry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-revenue-ledger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-commission-rules')).not.toBeInTheDocument();
  });

  it('shows PRODUCTION_OPS Global Ops Schedule from legacy WorkSchedule nav', async () => {
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
    expect(await screen.findByRole('heading', { name: 'Global Ops Schedule' })).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('errors:permission.title'))).not.toBeInTheDocument();
  });

  it('lets HR see department schedules without full Studio Resource navigation', async () => {
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

    expect(await screen.findByTestId('nav-link-work-shifts')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Department Work Shifts' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-studio-resources')).not.toBeInTheDocument();
  });

  it('allows TEAM_MANAGER managedGroup KPI direct route without No Access', async () => {
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

    expect(await screen.findByTestId('nav-link-kpi')).toBeInTheDocument();
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

  it('does not show unsupported admin modules to self-service-only staff', async () => {
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

    expect(await screen.findByTestId('nav-link-work-shifts')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-events')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-employment-profiles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-talents')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-kpi')).not.toBeInTheDocument();
  });
});
