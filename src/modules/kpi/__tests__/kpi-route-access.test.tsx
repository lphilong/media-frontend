import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@shared/auth/current-actor-capabilities';
import {
  expectNoRawAccountContextCodes,
  expectPermissionDeniedBusinessCopy,
} from '@test/assertions';
import { createActorCapabilities, createFailClosedActorCapabilities } from '@test/factories/access';
import {
  managerWorkspaceOrgUnitOnlyContext,
  setMockManagerWorkspaceContext,
} from '@test/msw/manager-workspace-handlers';
import { setupMswScenario } from '@test/msw-scenario';
import { renderRouteWithAccess } from '@test/render-app-route';

const lazyRouteContentWait = { timeout: 10000 };
const permissionDeniedPattern = /access|permission|quy.n|ph.m vi/iu;
const kpiPlanCodePattern = /KPI-202605-000001|KPI-202606-ORG-001/u;

const adminCapabilities = () =>
  createActorCapabilities({
    accountContexts: ['ADMIN_CONSOLE'],
    permissions: [PERMISSIONS.KPI_READ],
    scopeGrants: { kpi: ['global'] },
  });

const managerCapabilities = () =>
  createActorCapabilities({
    accountContexts: ['MANAGER_CONSOLE'],
    permissions: [PERMISSIONS.KPI_READ, PERMISSIONS.KPI_READ_PROGRESS],
    scopeGrants: { kpi: ['managedGroup'] },
  });

const selfCapabilities = () =>
  createActorCapabilities({
    accountContexts: ['STAFF_CONSOLE'],
    permissions: [PERMISSIONS.KPI_READ_PROGRESS],
    scopeGrants: { kpi: ['self'] },
    type: 'staff',
  });

describe('KPI route and access replacement coverage', () => {
  it('fails closed on Admin KPI when capability data is absent', async () => {
    const capabilities = createFailClosedActorCapabilities();

    setupMswScenario({ capabilities });
    renderRouteWithAccess('/kpi', { capabilities });

    expect(await screen.findByTestId('admin-shell-main')).toBeInTheDocument();
    expect(screen.queryByText(kpiPlanCodePattern)).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
  }, 15000);

  it('allows Admin KPI only with Admin workspace, KPI read permission, and global KPI scope', async () => {
    const capabilities = adminCapabilities();

    setupMswScenario({ capabilities });
    renderRouteWithAccess('/kpi', { capabilities });

    expect(
      await screen.findAllByText(kpiPlanCodePattern, {}, lazyRouteContentWait),
    ).not.toHaveLength(0);
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expectNoRawAccountContextCodes();
  }, 15000);

  it('redirects manager-only Admin KPI entry to Manager KPI without exposing Admin KPI', async () => {
    const capabilities = managerCapabilities();

    setupMswScenario({ capabilities });
    setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());

    renderRouteWithAccess('/kpi', { capabilities });

    expect(
      await screen.findByTestId('manager-workspace-shell', {}, lazyRouteContentWait),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('manager-module-kpi', {}, lazyRouteContentWait),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(kpiPlanCodePattern)).not.toBeInTheDocument();
    expectNoRawAccountContextCodes();
  });

  it('does not let Self own-data KPI scope open Admin KPI routes', async () => {
    const capabilities = selfCapabilities();

    setupMswScenario({ capabilities });
    renderRouteWithAccess('/kpi', { capabilities });

    expect(await screen.findAllByText(permissionDeniedPattern)).not.toHaveLength(0);
    expect(screen.queryByText(kpiPlanCodePattern)).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-workspace-shell')).not.toBeInTheDocument();
    expectNoRawAccountContextCodes();
    expectPermissionDeniedBusinessCopy(document.body, permissionDeniedPattern);
  });
});
