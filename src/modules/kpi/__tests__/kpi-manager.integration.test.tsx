import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PERMISSIONS } from '@shared/auth/current-actor-capabilities';
import { expectNoRawAccountContextCodes, expectNoRawIdsInNormalUi } from '@test/assertions';
import { createActorCapabilities } from '@test/factories/access';
import { setupLocale } from '@test/locale-time';
import {
  managerWorkspaceOrgUnitOnlyContext,
  setMockManagerWorkspaceContext,
} from '@test/msw/manager-workspace-handlers';
import { setupMswScenario } from '@test/msw-scenario';
import { renderRouteWithAccess } from '@test/render-app-route';

const lazyRouteContentWait = { timeout: 10000 };

const managerKpiCapabilities = () =>
  createActorCapabilities({
    id: 'kpi-manager',
    accountContexts: ['MANAGER_CONSOLE'],
    permissions: [PERMISSIONS.KPI_READ, PERMISSIONS.KPI_READ_PROGRESS, PERMISSIONS.KPI_ENTER_ACTUAL],
    scopeGrants: { kpi: ['managedGroup'] },
  });

describe('KPI Manager integration replacement coverage', () => {
  let restoreLocale: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    restoreLocale = await setupLocale('en');
    setupMswScenario({ capabilities: managerKpiCapabilities() });
    setMockManagerWorkspaceContext(managerWorkspaceOrgUnitOnlyContext());
  });

  afterEach(async () => {
    await restoreLocale?.();
  });

  it('renders Manager KPI inside assigned-scope workspace without Admin shell or Admin KPI tabs', async () => {
    renderRouteWithAccess('/kpi', { capabilities: managerKpiCapabilities() });

    expect(
      await screen.findByTestId('manager-workspace-shell', {}, lazyRouteContentWait),
    ).toBeInTheDocument();
    expect(await screen.findByTestId('manager-panel-kpi', {}, lazyRouteContentWait)).toBeInTheDocument();
    expect(screen.getByTestId('manager-module-kpi')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'KPI Management' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create KPI plan' })).not.toBeInTheDocument();
    expectNoRawAccountContextCodes();
  });

  it('keeps Manager KPI tabs limited to assigned OrgUnit scope supported by context', async () => {
    const user = userEvent.setup();

    renderRouteWithAccess('/kpi', { capabilities: managerKpiCapabilities() });

    expect(await screen.findByTestId('manager-kpi-tab-unit', {}, lazyRouteContentWait)).toBeInTheDocument();
    expect(screen.queryByTestId('manager-kpi-tab-talentGroup')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('manager-kpi-tab-unit'));
    const table = await screen.findByRole('table', { name: /KPI/i }, lazyRouteContentWait);
    expect(within(table).queryByText('ADMIN_CONSOLE')).not.toBeInTheDocument();
    expect(within(table).queryByText('managerEmploymentProfileId')).not.toBeInTheDocument();
  });

  it('opens Manager KPI detail as read-oriented assigned-scope context without raw member IDs', async () => {
    renderRouteWithAccess('/kpi/plans/kpi-plan-org-unit', {
      capabilities: managerKpiCapabilities(),
    });

    expect(await screen.findByTestId('manager-kpi-detail', {}, lazyRouteContentWait)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Operations Unit KPI|KPI/u })).toBeInTheDocument();
    expect(screen.getAllByText('Assigned scope')).not.toHaveLength(0);
    expectNoRawIdsInNormalUi(document.body, ['employment-profile-ops-001', 'talent-001']);
    expect(screen.queryByRole('button', { name: /Finalize|Archive|Create revenue/i })).not.toBeInTheDocument();
  });
});
