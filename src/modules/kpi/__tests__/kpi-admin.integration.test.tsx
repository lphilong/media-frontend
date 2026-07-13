import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PERMISSIONS } from '@shared/auth/current-actor-capabilities';
import { expectNoRawIdsInNormalUi } from '@test/assertions';
import { createActorCapabilities } from '@test/factories/access';
import { installFakeTime, setupLocale } from '@test/locale-time';
import { setupMswScenario } from '@test/msw-scenario';
import { renderRouteWithAccess } from '@test/render-app-route';

const adminKpiCapabilities = () =>
  createActorCapabilities({
    id: 'kpi-admin',
    accountContexts: ['ADMIN_CONSOLE'],
    permissions: [
      PERMISSIONS.KPI_READ,
      PERMISSIONS.KPI_READ_PROGRESS,
      PERMISSIONS.KPI_CREATE_PLAN,
      PERMISSIONS.KPI_ENTER_ACTUAL,
      PERMISSIONS.KPI_CORRECT_ACTUAL,
      PERMISSIONS.KPI_MANAGE_ALLOCATION,
    ],
    scopeGrants: { kpi: ['global'] },
  });

const findTabByText = async (patterns: readonly RegExp[]): Promise<HTMLElement> => {
  const tabs = await screen.findAllByRole('tab', {}, { timeout: 10000 });
  const tab = tabs.find((candidate) =>
    patterns.some((pattern) => pattern.test(candidate.textContent ?? '')),
  );
  expect(tab).toBeDefined();
  return tab!;
};

const waitForKpiPlanList = async (): Promise<void> => {
  await screen.findAllByText(/KPI-202605-000001|KPI-202606-ORG-001/u, {}, { timeout: 10000 });
};

describe('KPI Admin integration replacement coverage', () => {
  let restoreLocale: (() => Promise<void>) | undefined;
  let restoreTime: (() => void) | undefined;

  beforeEach(async () => {
    restoreLocale = await setupLocale('en');
    restoreTime = installFakeTime('2026-06-15T09:00:00+07:00');
    setupMswScenario({ capabilities: adminKpiCapabilities() });
  });

  afterEach(async () => {
    restoreTime?.();
    await restoreLocale?.();
  });

  it('renders Admin KPI as the global planning surface without reviving Talent KPI navigation', async () => {
    renderRouteWithAccess('/kpi', { capabilities: adminKpiCapabilities() });

    await waitForKpiPlanList();
    expect(screen.getByRole('tab', { name: 'KPI Management', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create KPI plan/u })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Talent KPI/iu })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'My KPI' })).not.toBeInTheDocument();
  }, 20000);

  it('keeps Admin actual workspace bounded, cursor-based, and explicit about KPI non-effects', async () => {
    const user = userEvent.setup();

    renderRouteWithAccess('/kpi?subjectType=ORG_UNIT&periodMonth=2026-06', {
      capabilities: adminKpiCapabilities(),
    });

    await waitForKpiPlanList();
    await user.click(await findTabByText([/Progress & Actuals/u]));

    expect(await screen.findByRole('heading', { name: /Actual Workspace/u })).toBeInTheDocument();
    expect(screen.getByText(/KPI actuals do not automatically decide/u)).toBeInTheDocument();
    expect(screen.getByText(/opaque cursor with a backend limit of 50/u)).toBeInTheDocument();

    const appliedFilters = screen.getByRole('region', { name: 'Applied filters' });
    expect(within(appliedFilters).getByText(/Subject type:/u)).toBeInTheDocument();
    expect(within(appliedFilters).getByText(/Org Unit/u)).toBeInTheDocument();
    expect(within(appliedFilters).getByText('06-2026')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /go to page/i })).not.toBeInTheDocument();
  }, 20000);

  it('opens an ORG_UNIT actual detail without exposing raw subject or member IDs in normal UI', async () => {
    const user = userEvent.setup();

    renderRouteWithAccess('/kpi?subjectType=ORG_UNIT', { capabilities: adminKpiCapabilities() });

    await waitForKpiPlanList();
    await user.click(await findTabByText([/Progress & Actuals/u]));

    const row = (await screen.findByText('KPI-202606-ORG-001')).closest('tr');
    expect(row).not.toBeNull();
    await user.click(within(row!).getByRole('button', { name: /View detail/u }));

    expect(await screen.findByText('An Nguyen')).toBeInTheDocument();
    expect(screen.getByText(/Org Unit - Operations Unit - 06-2026/u)).toBeInTheDocument();
    expectNoRawIdsInNormalUi(document.body, ['employment-profile-ops-001', 'talent-001']);
  }, 20000);

  it('keeps Admin workspace tabs isolated between planning, approval, and actuals', async () => {
    const user = userEvent.setup();

    renderRouteWithAccess('/kpi', { capabilities: adminKpiCapabilities() });

    await waitForKpiPlanList();
    expect(screen.queryByRole('heading', { name: /Actual Workspace/u })).not.toBeInTheDocument();

    await user.click(await findTabByText([/Approval Queue/u]));
    expect(
      await screen.findByRole('heading', { name: /KPI Allocation approval queue/u }),
    ).toBeInTheDocument();
    expect(screen.queryByText('KPI-202605-000001')).not.toBeInTheDocument();

    await user.click(await findTabByText([/Progress & Actuals/u]));
    expect(await screen.findByRole('heading', { name: /Actual Workspace/u })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /KPI Allocation approval queue/u }),
    ).not.toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText('Talent KPI')).not.toBeInTheDocument());
  });
});
