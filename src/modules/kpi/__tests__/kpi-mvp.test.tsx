import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appRoutes } from '@app/router/router';
import {
  parseKpiDate,
  parseKpiHoursInput,
  parseKpiMetricInput,
  parseKpiMoneyInput,
} from '@modules/kpi/formatting/kpi-formatting';
import { createKpiActionCapabilityHint } from '@modules/kpi/capability-hints';
import {
  approveKpiAllocation,
  createKpiCorrection,
  createKpiOrgUnitActual,
  createKpiOrgUnitCorrection,
  createKpiPlan,
  fetchKpiActualDailyGrid,
  fetchKpiActualWorkspacePlans,
  fetchKpiCorrectionHistory,
  fetchKpiOrgUnitActualGrid,
  fetchKpiOrgUnitAllocations,
  fetchKpiOrgUnitCorrectionHistory,
  fetchKpiOrgUnitFinalResult,
  fetchKpiOrgUnitManagedMembers,
  fetchKpiOrgUnitProgress,
  fetchKpiPlanDetail,
  fetchKpiPlans,
  fetchKpiManagedMembers,
  fetchMyKpiProgress,
  parseKpiAllocationDraftPayloadForTest,
  parseKpiAllocationListResponseForTest,
  parseKpiActualDailyGridResponseForTest,
  parseKpiActualWorkspacePlanListResponseForTest,
  parseKpiActualWorkspacePlanDetailResponseForTest,
  parseKpiCorrectionListResponseForTest,
  parseKpiCorrectionMutationResponseForTest,
  parseKpiOrgUnitActualGridResponseForTest,
  parseKpiOrgUnitAllocationListResponseForTest,
  parseKpiOrgUnitManagedMemberListResponseForTest,
  parseKpiOrgUnitProgressResponseForTest,
  parseKpiPlanListResponseForTest,
  parseKpiPlanDetailResponseForTest,
  markKpiActualExcuse,
  markKpiOrgUnitActualExcuse,
  performKpiLifecycleAction,
  publishKpiAllocation,
  rejectKpiAllocation,
  replaceKpiAllocations,
  replaceKpiTargetMetrics,
  sanitizeKpiCreatePlanPayload,
  submitKpiAllocationDraft,
  unmarkKpiActualExcuse,
  unmarkKpiOrgUnitActualExcuse,
  upsertKpiAllocationDraft,
} from '@modules/kpi/api/kpi.api';
import type { CurrentActorCapabilities } from '@shared/auth/current-actor-capabilities';
import { setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const may2026PeriodStartAt = Date.UTC(2026, 4, 1, -7, 0, 0, 0);
const may2026PeriodEndAt = Date.UTC(2026, 5, 1, -7, 0, 0, 0) - 1;
const june2026PeriodStartAt = Date.UTC(2026, 5, 1, -7, 0, 0, 0);
const june2026PeriodEndAt = Date.UTC(2026, 6, 1, -7, 0, 0, 0) - 1;

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return renderAppWithProviders(<RouterProvider router={router} />);
};

const lazyRouteContentWait = { timeout: 5_000 };

const waitForKpiList = async () => {
  await screen.findByRole('heading', { name: 'KPI plans' }, lazyRouteContentWait);
};

const waitForPublishedKpiDetail = async () => {
  await screen.findByRole('heading', { name: 'Published team KPI' }, lazyRouteContentWait);
};

const waitForEnabledButton = async (name: string): Promise<HTMLElement> => {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
};

const selectAdminWorkspaceTab = async (name: string): Promise<void> => {
  await userEvent.click(await screen.findByRole('tab', { name }));
};

const openProgressActualsTab = async (): Promise<void> => {
  await selectAdminWorkspaceTab('Progress & Actuals');
  await screen.findByRole('heading', { name: 'Actual Workspace' });
};

const openPublishedWorkspacePlan = async (): Promise<void> => {
  await openProgressActualsTab();
  const workspaceRow = (await screen.findByText('KPI-202605-000002')).closest('tr');
  expect(workspaceRow).not.toBeNull();
  await userEvent.click(within(workspaceRow!).getByRole('button', { name: 'View detail' }));
  await screen.findByText('kpi-plan-published-alloc-1');
};

const openPublishedActualGrid = async (): Promise<void> => {
  vi.setSystemTime(new Date('2026-05-16T09:00:00+07:00'));
  await openPublishedWorkspacePlan();
  const actualDate = screen.getByLabelText('Actual date');
  await userEvent.clear(actualDate);
  await userEvent.type(actualDate, '16-05-2026');
  await userEvent.click(screen.getByRole('button', { name: 'Load grid' }));
  await screen.findByLabelText('Luna Park Revenue VND actual');
};

const mswJson = (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
) =>
  fetch(`http://localhost${path}`, {
    method,
    headers: data === undefined ? undefined : { 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });

const readMswJson = async <T,>(response: Response): Promise<T> => response.json() as Promise<T>;

type KpiCapabilityMockParams = {
  permissions?: string[];
  scopeGrants?: CurrentActorCapabilities['scopeGrants'];
  status?: number;
};

const mockKpiCapabilities = ({
  permissions = [],
  scopeGrants = { kpi: ['global'] },
  status,
}: KpiCapabilityMockParams): void => {
  server.use(
    http.get('*/admin/me/capabilities', () => {
      if (status) {
        return HttpResponse.json({ message: 'Capability check failed' }, { status });
      }

      return HttpResponse.json({
        data: makeCapabilities({ permissions, scopeGrants }),
      });
    }),
  );
};

const kpiCapabilityCopy = {
  loading: 'Checking permissions.',
  unavailable: 'KPI permissions could not be verified. Try again.',
  'missing-permission': 'You do not have permission to perform this action.',
  'missing-scope': 'Your role assignment does not include the required scope.',
};

describe('KPI MVP UX', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T00:00:00+07:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    vi.setSystemTime(new Date('2026-06-15T00:00:00+07:00'));
    await setLocale('en');
  });

  it('shows KPI in sidebar instead of visible Talent KPI', async () => {
    renderRoute('/dashboard');
    expect(await screen.findByRole('link', { name: 'KPI' })).toHaveAttribute('href', '/kpi');
    expect(screen.queryByRole('link', { name: 'Talent KPI' })).not.toBeInTheDocument();
  });

  it('renders the KPI route list page', async () => {
    renderRoute('/kpi');
    await waitForKpiList();
    expect(screen.getByRole('heading', { name: 'KPI plans' })).toBeInTheDocument();
  });

  it('TEAM_MANAGER with managedGroup scope renders KPI without access denied', async () => {
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.readProgress', 'kpi.enterActual', 'kpi.correctActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });

    renderRoute('/kpi');
    await waitForKpiList();

    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: 'My Group KPI', selected: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Approval Queue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Progress & Actuals' })).not.toBeInTheDocument();
  });

  it('TEAM_MANAGER empty managed KPI list shows empty state, not access denied', async () => {
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.readProgress', 'kpi.enterActual', 'kpi.correctActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });
    server.use(http.get('*/admin/kpi/plans', () => HttpResponse.json({ data: [] })));

    renderRoute('/kpi');
    await waitForKpiList();

    expect(
      await screen.findByText('No KPI plans for your managed groups yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
  });

  it('TEAM_MANAGER My Group KPI requests published TalentGroup plans and renders no draft or Talent plans', async () => {
    let captured = new URL('http://example.test');
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.readProgress', 'kpi.enterActual', 'kpi.correctActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });
    server.use(
      http.get('*/admin/kpi/plans', ({ request }) => {
        captured = new URL(request.url);
        const rows = [
          makeListPlan('kpi-plan-managed', 'Managed group KPI', 'group-001', {
            allocationWorkflowSummary: makeAllocationWorkflowSummary({
              byStatus: { published: 2 },
            }),
          }),
          makeListPlan('kpi-plan-draft-managed', 'Draft managed group KPI', 'group-001', {
            status: 'DRAFT',
          }),
          makeListPlan('kpi-plan-talent', 'Talent KPI', 'talent-001', {
            subjectType: 'TALENT',
          }),
        ];
        return HttpResponse.json({
          data: rows.filter(
            (plan) =>
              plan.status === captured.searchParams.get('status') &&
              plan.subjectType === captured.searchParams.get('subjectType'),
          ),
        });
      }),
    );

    renderRoute('/kpi?status=DRAFT&subjectType=TALENT&subjectId=talent-001');
    await waitForKpiList();

    await waitFor(() => {
      expect(captured.searchParams.get('status')).toBe('PUBLISHED');
      expect(captured.searchParams.get('subjectType')).toBe('TALENT_GROUP');
    });
    expect(captured.searchParams.get('subjectId')).toBeNull();
    expect(await screen.findByText('Managed group KPI')).toBeInTheDocument();
    expect(screen.queryByText('Draft managed group KPI')).not.toBeInTheDocument();
    expect(screen.queryByText('Talent KPI')).not.toBeInTheDocument();
    expect(screen.getAllByText('Plan status').length).toBeGreaterThan(0);
    const row = screen.getByText('Managed group KPI').closest('tr');
    expect(row).not.toBeNull();
    const workflow = within(row!).getByLabelText('Allocation workflow');
    expect(workflow).toBeInTheDocument();
    expect(within(workflow).getByText('Official published')).toBeInTheDocument();
    expect(within(workflow).queryByText('Published')).not.toBeInTheDocument();
    expect(within(workflow).getByText('2')).toBeInTheDocument();
  });

  it('admin global actor still loads the global KPI list endpoint and can see draft plans', async () => {
    const urls: string[] = [];
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.createPlan', 'kpi.enterActual', 'kpi.correctActual'],
      scopeGrants: { kpi: ['global'] },
    });
    server.use(
      http.get('*/admin/kpi/plans', ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({
          data: [
            makeListPlan('kpi-plan-admin-draft', 'Admin draft KPI', 'group-001', {
              status: 'DRAFT',
              allocationWorkflowSummary: makeAllocationWorkflowSummary(),
            }),
          ],
        });
      }),
    );

    renderRoute('/kpi');
    await waitForKpiList();

    await waitFor(() =>
      expect(urls.some((url) => new URL(url).pathname === '/admin/kpi/plans')).toBe(true),
    );
    expect(screen.getByRole('tab', { name: 'KPI Management', selected: true })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'My Group KPI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'My KPI' })).not.toBeInTheDocument();
    expect(await screen.findByText('Admin draft KPI')).toBeInTheDocument();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    const row = screen.getByText('Admin draft KPI').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('No allocations')).toBeInTheDocument();
  });

  it('admin workspace tabs isolate plans, approval queue, and progress actuals', async () => {
    renderRoute('/kpi');
    await waitForKpiList();

    expect(screen.getByRole('tab', { name: 'Plans', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'KPI plans' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'KPI Allocation approval queue' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Actual Workspace' })).not.toBeInTheDocument();

    await selectAdminWorkspaceTab('Approval Queue');
    expect(
      await screen.findByRole('heading', { name: 'KPI Allocation approval queue' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'KPI plans' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Actual Workspace' })).not.toBeInTheDocument();

    await selectAdminWorkspaceTab('Progress & Actuals');
    expect(await screen.findByRole('heading', { name: 'Actual Workspace' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'KPI Allocation approval queue' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'KPI plans' })).not.toBeInTheDocument();

    await selectAdminWorkspaceTab('Plans');
    expect(await screen.findByRole('heading', { name: 'KPI plans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create KPI plan' })).toBeInTheDocument();
  });

  it('renders the backend Actual Workspace revenue-first list without a progress bar', async () => {
    renderRoute('/kpi');
    await openProgressActualsTab();

    const row = (await screen.findByText('KPI-202605-000002')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('Creator Team')).toBeInTheDocument();
    expect(within(row!).getByText('05-2026')).toBeInTheDocument();
    expect(within(row!).getByText('1.000.000 VND')).toBeInTheDocument();
    expect(within(row!).getByText('750.000 VND')).toBeInTheDocument();
    expect(within(row!).getByText('75%')).toBeInTheDocument();
    expect(within(row!).getByText('2/2')).toBeInTheDocument();
    expect(within(row!).getByText(/limited calendar-day signal/i)).toBeInTheDocument();
    expect(within(row!).getByText(/Content output count: 8\/10 \(80%\)/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Revenue actual' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Achievement %' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sort direction' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /revenue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /achievement/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /operational target/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /missing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /coverage sort/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/D 00:00 through D\+1 10:00 Asia\/Ho_Chi_Minh, inclusive/i),
    ).toBeInTheDocument();

    await userEvent.click(within(row!).getByRole('button', { name: 'View detail' }));
    expect(await screen.findByText('Luna Park')).toBeInTheDocument();
    expect(await screen.findByText('kpi-plan-published-alloc-1')).toBeInTheDocument();
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(screen.queryByText('employment-profile-001')).not.toBeInTheDocument();
  });

  it('shows finalized result snapshot and null-snapshot fallback in Actual Workspace detail', async () => {
    renderRoute('/kpi');
    await openProgressActualsTab();

    const finalizedRow = (await screen.findByText('KPI-202604-000003')).closest('tr');
    expect(finalizedRow).not.toBeNull();
    await userEvent.click(within(finalizedRow!).getByRole('button', { name: 'View detail' }));
    expect(await screen.findByRole('heading', { name: 'Finalized result' })).toBeInTheDocument();
    expect(screen.getByText('Captured when the KPI was finalized.')).toBeInTheDocument();
    expect(screen.getByText('850.000 VND')).toBeInTheDocument();

    const noSnapshotRow = (await screen.findByText('KPI-202603-000004')).closest('tr');
    expect(noSnapshotRow).not.toBeNull();
    await userEvent.click(within(noSnapshotRow!).getByRole('button', { name: 'View detail' }));
    expect(
      await screen.findByText('Final result snapshot is not available for this finalized plan.'),
    ).toBeInTheDocument();
  });

  it('shows Load more, appends Actual Workspace cursor pages, and hides it after the last page', async () => {
    installActualWorkspacePagedUiHandler();

    renderRoute('/kpi');
    await openProgressActualsTab();

    expect(await screen.findByRole('button', { name: 'Load more' })).toBeInTheDocument();
    expect(screen.queryByText('KPI-202605-000004')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('KPI-202605-000004')).toBeInTheDocument();
    expect(screen.getAllByText('KPI-202605-000002')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('KPI-202604-000003')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText('KPI-202605-000002')).toHaveLength(1);
  });

  it('resets Actual Workspace loaded pages when search changes', async () => {
    installActualWorkspacePagedUiHandler();

    renderRoute('/kpi');
    await openProgressActualsTab();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('KPI-202605-000004')).toBeInTheDocument();

    const search = screen.getByRole('textbox', { name: 'Search' });
    await userEvent.clear(search);
    await userEvent.type(search, 'Finalized');

    expect(await screen.findByText('KPI-202604-000003')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('KPI-202605-000004')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('maps Actual Workspace allocation coverage filter to backend query values', async () => {
    const captured: URL[] = [];
    const { members, ...completeRow } = makeActualWorkspaceDetail();
    void members;
    const incompleteRow = {
      ...completeRow,
      planId: 'kpi-plan-incomplete-ui',
      planCode: 'KPI-202605-000006',
      title: 'Incomplete allocation coverage KPI',
      allocationCoverage: {
        publishedAllocationCount: 1,
        totalAllocationCount: 2,
        isAllExistingAllocationsPublished: false,
      },
    };
    server.use(
      http.get('*/admin/kpi/actual-workspace/plans', ({ request }) => {
        const url = new URL(request.url);
        captured.push(url);
        const coverage = url.searchParams.get('allocationCoverage');
        return HttpResponse.json({
          data: coverage === 'incomplete' ? [incompleteRow] : [completeRow],
        });
      }),
    );

    renderRoute('/kpi');
    await openProgressActualsTab();

    expect(await screen.findByText('KPI-202605-000002')).toBeInTheDocument();
    await waitFor(() => expect(captured.at(-1)?.searchParams.get('allocationCoverage')).toBeNull());

    await userEvent.selectOptions(
      screen.getByRole('combobox', {
        name: 'Allocation workflow coverage',
      }),
      'complete',
    );
    await waitFor(() =>
      expect(captured.at(-1)?.searchParams.get('allocationCoverage')).toBe('complete'),
    );
    expect(await screen.findByText('KPI-202605-000002')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole('combobox', {
        name: 'Allocation workflow coverage',
      }),
      'incomplete',
    );
    await waitFor(() =>
      expect(captured.at(-1)?.searchParams.get('allocationCoverage')).toBe('incomplete'),
    );
    expect(await screen.findByText('KPI-202605-000006')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.queryByText('KPI-202605-000002')).not.toBeInTheDocument();
  });

  it('resets Actual Workspace loaded pages when allocation coverage changes', async () => {
    installActualWorkspacePagedUiHandler();

    renderRoute('/kpi');
    await openProgressActualsTab();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('KPI-202605-000004')).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Allocation workflow coverage' }),
      'complete',
    );

    expect(await screen.findByText('KPI-202605-000002')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('KPI-202605-000004')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('maps Actual Workspace status filters to backend booleans and omits All values', async () => {
    const captured: URL[] = [];
    server.use(
      http.get('*/admin/kpi/actual-workspace/plans', ({ request }) => {
        captured.push(new URL(request.url));
        return HttpResponse.json({ data: [] });
      }),
    );

    renderRoute('/kpi');
    await openProgressActualsTab();

    const overdue = screen.getByRole('combobox', { name: 'Overdue actuals' });
    const dueOpen = screen.getByRole('combobox', { name: 'Due-open actuals' });
    expect(overdue).toBeInTheDocument();
    expect(dueOpen).toBeInTheDocument();
    await waitFor(() => expect(captured.at(-1)?.searchParams.get('hasOverdueActuals')).toBeNull());

    await userEvent.selectOptions(overdue, 'true');
    await waitFor(() =>
      expect(captured.at(-1)?.searchParams.get('hasOverdueActuals')).toBe('true'),
    );
    await userEvent.selectOptions(overdue, 'false');
    await waitFor(() =>
      expect(captured.at(-1)?.searchParams.get('hasOverdueActuals')).toBe('false'),
    );
    await userEvent.selectOptions(overdue, '');
    expect(overdue).toHaveValue('');

    await userEvent.selectOptions(dueOpen, 'true');
    await waitFor(() =>
      expect(captured.at(-1)?.searchParams.get('hasPendingActuals')).toBe('true'),
    );
    await userEvent.selectOptions(dueOpen, 'false');
    await waitFor(() =>
      expect(captured.at(-1)?.searchParams.get('hasPendingActuals')).toBe('false'),
    );
    await userEvent.selectOptions(dueOpen, '');
    expect(dueOpen).toHaveValue('');
  });

  it('resets Actual Workspace pages, detail, grid, and drafts when a status filter changes', async () => {
    const captured: URL[] = [];
    installActualWorkspacePagedUiHandler(captured);

    renderRoute('/kpi');
    await openProgressActualsTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('KPI-202605-000004')).toBeInTheDocument();

    const workspaceRow = (await screen.findByText('KPI-202605-000002')).closest('tr');
    expect(workspaceRow).not.toBeNull();
    await userEvent.click(within(workspaceRow!).getByRole('button', { name: 'View detail' }));
    expect(await screen.findByText('kpi-plan-published-alloc-1')).toBeInTheDocument();
    const actualDate = screen.getByLabelText('Actual date');
    await userEvent.clear(actualDate);
    await userEvent.type(actualDate, '16-05-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load grid' }));
    const draft = await screen.findByLabelText('Luna Park Content output count actual');
    await userEvent.clear(draft);
    await userEvent.type(draft, '3');

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Due-open actuals' }),
      'true',
    );

    await waitFor(() =>
      expect(captured.at(-1)?.searchParams.get('hasPendingActuals')).toBe('true'),
    );
    expect(captured.at(-1)?.searchParams.get('cursor')).toBeNull();
    await waitFor(() => expect(screen.queryByText('KPI-202605-000004')).not.toBeInTheDocument());
    expect(screen.queryByText('kpi-plan-published-alloc-1')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Luna Park Content output count actual'),
    ).not.toBeInTheDocument();
  });

  it('keeps Load more opaque cursor passthrough with Actual Workspace status filters', async () => {
    const captured: URL[] = [];
    installActualWorkspacePagedUiHandler(captured);

    renderRoute('/kpi');
    await openProgressActualsTab();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Due-open actuals' }),
      'true',
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(captured.at(-1)?.searchParams.get('cursor')).toBe('cursor-1'));
    expect(captured.at(-1)?.searchParams.get('hasPendingActuals')).toBe('true');
  });

  it('maps Actual Workspace derived sort controls, resets state, and keeps Load more', async () => {
    const captured: URL[] = [];
    installActualWorkspacePagedUiHandler(captured);

    renderRoute('/kpi');
    await openProgressActualsTab();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('KPI-202605-000004')).toBeInTheDocument();

    const workspaceRow = (await screen.findByText('KPI-202605-000002')).closest('tr');
    expect(workspaceRow).not.toBeNull();
    await userEvent.click(within(workspaceRow!).getByRole('button', { name: 'View detail' }));
    expect(await screen.findByText('kpi-plan-published-alloc-1')).toBeInTheDocument();
    const actualDate = screen.getByLabelText('Actual date');
    await userEvent.clear(actualDate);
    await userEvent.type(actualDate, '16-05-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load grid' }));
    await screen.findByLabelText('Luna Park Revenue VND actual');

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Sort by' }),
      'revenueActual',
    );
    await waitFor(() => {
      const latest = captured.at(-1);
      expect(latest?.searchParams.get('sortBy')).toBe('revenueActual');
      expect(latest?.searchParams.get('cursor')).toBeNull();
    });
    await waitFor(() => expect(screen.queryByText('KPI-202605-000004')).not.toBeInTheDocument());
    expect(screen.queryByText('kpi-plan-published-alloc-1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Luna Park Revenue VND actual')).not.toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Sort by' }),
      'achievementPercent',
    );
    await waitFor(() =>
      expect(captured.at(-1)?.searchParams.get('sortBy')).toBe('achievementPercent'),
    );

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort direction' }), 'ASC');
    await waitFor(() => expect(captured.at(-1)?.searchParams.get('sortDirection')).toBe('ASC'));

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(captured.at(-1)?.searchParams.get('cursor')).toBeTruthy());
    expect(screen.getAllByText('KPI-202605-000002')).toHaveLength(1);
  });

  it('uses the backend Actual Workspace list endpoint and validates supported sort input', async () => {
    expect((await fetchKpiActualWorkspacePlans({ limit: 10 })).data[0].planCode).toBeDefined();
    expect(
      (await fetchKpiActualWorkspacePlans({ sortBy: 'revenueActual', limit: 10 })).data[0].planCode,
    ).toBeDefined();
    expect(
      (await fetchKpiActualWorkspacePlans({ sortBy: 'achievementPercent', limit: 10 })).data[0]
        .planCode,
    ).toBeDefined();
    await expect(
      fetchKpiActualWorkspacePlans({ sortBy: 'achievement' as never }),
    ).rejects.toThrow();
    await expect(
      fetchKpiActualWorkspacePlans({ sortBy: 'operationalTarget' as never }),
    ).rejects.toThrow();
    await expect(fetchKpiActualWorkspacePlans({ revenueActualMin: 1 } as never)).rejects.toThrow();
    await expect(fetchKpiActualWorkspacePlans({ achievementMax: 100 } as never)).rejects.toThrow();
    await expect(
      fetchKpiActualWorkspacePlans({ actualEntryStatus: 'OVERDUE' } as never),
    ).rejects.toThrow();
    await expect(fetchKpiActualWorkspacePlans({ overdueCountMin: 1 } as never)).rejects.toThrow();
    await expect(fetchKpiActualWorkspacePlans({ pendingCountMin: 1 } as never)).rejects.toThrow();
    await expect(
      fetchKpiActualWorkspacePlans({ sortBy: 'actualEntryStatus' as never }),
    ).rejects.toThrow();
  });

  it('serializes Actual Workspace status booleans and omits undefined values', async () => {
    const captured: URL[] = [];
    server.use(
      http.get('*/admin/kpi/actual-workspace/plans', ({ request }) => {
        captured.push(new URL(request.url));
        return HttpResponse.json({ data: [] });
      }),
    );

    await fetchKpiActualWorkspacePlans({
      hasOverdueActuals: true,
      hasPendingActuals: false,
    });
    expect(captured.at(-1)?.searchParams.get('hasOverdueActuals')).toBe('true');
    expect(captured.at(-1)?.searchParams.get('hasPendingActuals')).toBe('false');

    await fetchKpiActualWorkspacePlans({
      hasOverdueActuals: false,
      hasPendingActuals: true,
    });
    expect(captured.at(-1)?.searchParams.get('hasOverdueActuals')).toBe('false');
    expect(captured.at(-1)?.searchParams.get('hasPendingActuals')).toBe('true');

    await fetchKpiActualWorkspacePlans({
      hasOverdueActuals: undefined,
      hasPendingActuals: undefined,
    });
    expect(captured.at(-1)?.searchParams.get('hasOverdueActuals')).toBeNull();
    expect(captured.at(-1)?.searchParams.get('hasPendingActuals')).toBeNull();
  });

  it('accepts Actual Workspace meta.nextCursor and cursor query fields', async () => {
    const { members, ...summary } = makeActualWorkspaceDetail();
    void members;
    expect(
      parseKpiActualWorkspacePlanListResponseForTest({
        data: [summary],
        meta: { nextCursor: 'opaque-cursor' },
      }).meta?.nextCursor,
    ).toBe('opaque-cursor');

    const first = await fetchKpiActualWorkspacePlans({ limit: 1 });
    expect(first.meta?.nextCursor).toBeDefined();
    const next = await fetchKpiActualWorkspacePlans({
      limit: 1,
      cursor: first.meta?.nextCursor,
    });
    expect(next.data[0].planId).not.toBe(first.data[0].planId);
  });

  it('accepts complete and incomplete allocation-row coverage filters and rejects unsupported coverage', async () => {
    const complete = await fetchKpiActualWorkspacePlans({ allocationCoverage: 'complete' });
    expect(complete.data.length).toBeGreaterThan(0);
    expect(
      complete.data.every(
        (plan) =>
          plan.allocationCoverage.totalAllocationCount > 0 &&
          plan.allocationCoverage.publishedAllocationCount ===
            plan.allocationCoverage.totalAllocationCount,
      ),
    ).toBe(true);

    const incomplete = await fetchKpiActualWorkspacePlans({ allocationCoverage: 'incomplete' });
    expect(incomplete.data.length).toBeGreaterThan(0);
    expect(
      incomplete.data.every(
        (plan) =>
          plan.allocationCoverage.totalAllocationCount === 0 ||
          plan.allocationCoverage.publishedAllocationCount <
            plan.allocationCoverage.totalAllocationCount,
      ),
    ).toBe(true);

    await expect(
      fetchKpiActualWorkspacePlans({ allocationCoverage: 'activeMemberComplete' as never }),
    ).rejects.toThrow();
  });

  it('MSW paginates Actual Workspace by periodMonth cursor without duplicate rows', async () => {
    const firstResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?limit=2&sortBy=periodMonth&sortDirection=DESC',
    );
    expect(firstResponse.status).toBe(200);
    const first =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(firstResponse);
    expect(first.meta?.nextCursor).toBeDefined();

    const nextResponse = await mswJson(
      'GET',
      `/admin/kpi/actual-workspace/plans?limit=2&sortBy=periodMonth&sortDirection=DESC&cursor=${encodeURIComponent(
        first.meta?.nextCursor ?? '',
      )}`,
    );
    expect(nextResponse.status).toBe(200);
    const next =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(nextResponse);
    const firstPlanIds = new Set(first.data.map((plan) => plan.planId));
    expect(next.data.some((plan) => firstPlanIds.has(plan.planId))).toBe(false);
  });

  it('MSW paginates Actual Workspace by planCode cursor and rejects invalid cursor shape', async () => {
    const firstResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?limit=2&sortBy=planCode&sortDirection=ASC',
    );
    expect(firstResponse.status).toBe(200);
    const first =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(firstResponse);
    expect(first.meta?.nextCursor).toBeDefined();

    const nextResponse = await mswJson(
      'GET',
      `/admin/kpi/actual-workspace/plans?limit=2&sortBy=planCode&sortDirection=ASC&cursor=${encodeURIComponent(
        first.meta?.nextCursor ?? '',
      )}`,
    );
    expect(nextResponse.status).toBe(200);
    const next =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(nextResponse);
    expect(next.data[0].planCode).not.toBe(first.data[0].planCode);

    const malformedResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?cursor=not-a-valid-cursor',
    );
    expect(malformedResponse.status).toBe(400);

    const mismatchedResponse = await mswJson(
      'GET',
      `/admin/kpi/actual-workspace/plans?limit=2&sortBy=planCode&sortDirection=DESC&cursor=${encodeURIComponent(
        first.meta?.nextCursor ?? '',
      )}`,
    );
    expect(mismatchedResponse.status).toBe(400);
  });

  it('MSW sorts Actual Workspace revenueActual before cursor pagination', async () => {
    const ascResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?sortBy=revenueActual&sortDirection=ASC&limit=10',
    );
    expect(ascResponse.status).toBe(200);
    const asc =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(ascResponse);
    expect(asc.data.map((plan) => plan.revenue.actualValue)).toEqual(
      [...asc.data.map((plan) => plan.revenue.actualValue)].sort((left, right) => left - right),
    );

    const descResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?sortBy=revenueActual&sortDirection=DESC&limit=10',
    );
    expect(descResponse.status).toBe(200);
    const desc =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(descResponse);
    expect(desc.data.map((plan) => plan.revenue.actualValue)).toEqual(
      [...desc.data.map((plan) => plan.revenue.actualValue)].sort((left, right) => right - left),
    );

    const firstResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?sortBy=revenueActual&sortDirection=DESC&limit=2',
    );
    expect(firstResponse.status).toBe(200);
    const first =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(firstResponse);
    expect(first.meta?.nextCursor).toBeDefined();
    const nextResponse = await mswJson(
      'GET',
      `/admin/kpi/actual-workspace/plans?sortBy=revenueActual&sortDirection=DESC&limit=2&cursor=${encodeURIComponent(
        first.meta?.nextCursor ?? '',
      )}`,
    );
    expect(nextResponse.status).toBe(200);
    const next =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(nextResponse);
    const firstPlanIds = new Set(first.data.map((plan) => plan.planId));
    expect(next.data.some((plan) => firstPlanIds.has(plan.planId))).toBe(false);
  });

  it('MSW sorts Actual Workspace achievementPercent with nulls last before cursor pagination', async () => {
    const ascResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?sortBy=achievementPercent&sortDirection=ASC&limit=10',
    );
    expect(ascResponse.status).toBe(200);
    const asc =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(ascResponse);
    const ascValues = asc.data.map((plan) => plan.revenue.achievementPercent);
    const ascNonNull = ascValues.filter((value): value is number => value !== null);
    expect(ascNonNull).toEqual([...ascNonNull].sort((left, right) => left - right));
    expect(ascValues.slice(ascNonNull.length)).toEqual(
      Array(ascValues.length - ascNonNull.length).fill(null),
    );
    const ascNullPlanIds = asc.data
      .filter((plan) => plan.revenue.achievementPercent === null)
      .map((plan) => plan.planId);
    expect(ascNullPlanIds).toEqual([...ascNullPlanIds].sort());

    const descResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?sortBy=achievementPercent&sortDirection=DESC&limit=10',
    );
    expect(descResponse.status).toBe(200);
    const desc =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(descResponse);
    const descValues = desc.data.map((plan) => plan.revenue.achievementPercent);
    const descNonNull = descValues.filter((value): value is number => value !== null);
    expect(descNonNull).toEqual([...descNonNull].sort((left, right) => right - left));
    expect(descValues.slice(descNonNull.length)).toEqual(
      Array(descValues.length - descNonNull.length).fill(null),
    );

    const firstResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?sortBy=achievementPercent&sortDirection=ASC&limit=2',
    );
    expect(firstResponse.status).toBe(200);
    const first =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(firstResponse);
    expect(first.meta?.nextCursor).toBeDefined();
    const nextResponse = await mswJson(
      'GET',
      `/admin/kpi/actual-workspace/plans?sortBy=achievementPercent&sortDirection=ASC&limit=2&cursor=${encodeURIComponent(
        first.meta?.nextCursor ?? '',
      )}`,
    );
    expect(nextResponse.status).toBe(200);
    const next =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(nextResponse);
    const firstPlanIds = new Set(first.data.map((plan) => plan.planId));
    expect(next.data.some((plan) => firstPlanIds.has(plan.planId))).toBe(false);

    const mismatchedResponse = await mswJson(
      'GET',
      `/admin/kpi/actual-workspace/plans?sortBy=revenueActual&sortDirection=ASC&limit=2&cursor=${encodeURIComponent(
        first.meta?.nextCursor ?? '',
      )}`,
    );
    expect(mismatchedResponse.status).toBe(400);
  });

  it('MSW rejects unsupported Actual Workspace derived query fields', async () => {
    const operationalTargetSort = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?sortBy=operationalTarget',
    );
    expect(operationalTargetSort.status).toBe(400);

    const revenueRange = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?revenueActualMin=1',
    );
    expect(revenueRange.status).toBe(422);

    const achievementRange = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?achievementMax=100',
    );
    expect(achievementRange.status).toBe(422);

    const targetMismatch = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?targetMismatch=true',
    );
    expect(targetMismatch.status).toBe(422);
  });

  it('MSW applies Actual Workspace group and plan search before pagination', async () => {
    const groupCodeResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?search=TG-001&limit=1',
    );
    expect(groupCodeResponse.status).toBe(200);
    const groupCode =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(
        groupCodeResponse,
      );
    expect(groupCode.data[0].subjectRef?.code).toBe('TG-001');

    const groupNameResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?search=Creator%20Team&limit=1',
    );
    expect(groupNameResponse.status).toBe(200);
    const groupName =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(
        groupNameResponse,
      );
    expect(groupName.data[0].subjectRef?.name).toBe('Creator Team');

    const planCodeResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?search=KPI-202604-000003&limit=1',
    );
    expect(planCodeResponse.status).toBe(200);
    const planCode =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(planCodeResponse);
    expect(planCode.data).toHaveLength(1);
    expect(planCode.data[0].planCode).toBe('KPI-202604-000003');

    const planTitleResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?search=Finalized%20team&limit=1',
    );
    expect(planTitleResponse.status).toBe(200);
    const planTitle =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(
        planTitleResponse,
      );
    expect(planTitle.data[0].title).toBe('Finalized team KPI');
  });

  it('MSW filters Actual Workspace allocationCoverage before pagination', async () => {
    const completeResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?allocationCoverage=complete&limit=1',
    );
    expect(completeResponse.status).toBe(200);
    const complete =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(completeResponse);
    expect(complete.data).toHaveLength(1);
    expect(complete.data[0].allocationCoverage.totalAllocationCount).toBeGreaterThan(0);
    expect(complete.data[0].allocationCoverage.publishedAllocationCount).toBe(
      complete.data[0].allocationCoverage.totalAllocationCount,
    );

    const incompleteResponse = await mswJson(
      'GET',
      '/admin/kpi/actual-workspace/plans?allocationCoverage=incomplete&limit=1',
    );
    expect(incompleteResponse.status).toBe(200);
    const incomplete =
      await readMswJson<Awaited<ReturnType<typeof fetchKpiActualWorkspacePlans>>>(
        incompleteResponse,
      );
    expect(incomplete.data).toHaveLength(1);
    expect(
      incomplete.data[0].allocationCoverage.totalAllocationCount === 0 ||
        incomplete.data[0].allocationCoverage.publishedAllocationCount <
          incomplete.data[0].allocationCoverage.totalAllocationCount,
    ).toBe(true);
    expect(incomplete.meta?.nextCursor).toBeDefined();
  });

  it('MSW filters Actual Workspace status booleans before pagination with AND semantics', async () => {
    const both = await fetchKpiActualWorkspacePlans({
      search: 'Status fixture',
      hasOverdueActuals: true,
      hasPendingActuals: true,
      limit: 100,
    });
    expect(both.data.map((plan) => plan.planId)).toEqual(['kpi-plan-status-both']);

    const neither = await fetchKpiActualWorkspacePlans({
      search: 'Status fixture',
      hasOverdueActuals: false,
      hasPendingActuals: false,
      limit: 100,
    });
    expect(neither.data.map((plan) => plan.planId).sort()).toEqual([
      'kpi-plan-status-entered-zero',
      'kpi-plan-status-excused-not-required',
      'kpi-plan-status-neither',
      'kpi-plan-status-not-due',
    ]);

    const first = await fetchKpiActualWorkspacePlans({
      search: 'Status fixture',
      hasPendingActuals: true,
      limit: 1,
      sortBy: 'planCode',
      sortDirection: 'ASC',
    });
    expect(first.data).toHaveLength(1);
    expect(first.data[0].actualEntryStatusSummary.pendingEntryCount).toBeGreaterThan(0);
    expect(first.meta?.nextCursor).toBeDefined();
    const next = await fetchKpiActualWorkspacePlans({
      search: 'Status fixture',
      hasPendingActuals: true,
      limit: 1,
      sortBy: 'planCode',
      sortDirection: 'ASC',
      cursor: first.meta?.nextCursor,
    });
    expect(next.data).toHaveLength(1);
    expect(next.data[0].actualEntryStatusSummary.pendingEntryCount).toBeGreaterThan(0);
    expect(next.data[0].planId).not.toBe(first.data[0].planId);
  });

  it('MSW combines Actual Workspace status filters with search, coverage, and derived sorts', async () => {
    for (const sortBy of ['revenueActual', 'achievementPercent'] as const) {
      const result = await fetchKpiActualWorkspacePlans({
        search: 'Status fixture',
        allocationCoverage: 'complete',
        hasPendingActuals: true,
        sortBy,
        sortDirection: 'ASC',
        limit: 100,
      });
      expect(result.data.map((plan) => plan.planId).sort()).toEqual([
        'kpi-plan-status-both',
        'kpi-plan-status-due-open-only',
      ]);
      expect(
        result.data.every(
          (plan) =>
            plan.actualEntryStatusSummary.pendingEntryCount > 0 &&
            plan.allocationCoverage.isAllExistingAllocationsPublished,
        ),
      ).toBe(true);
    }
  });

  it('MSW rejects invalid Actual Workspace status booleans, deferred fields, and cursor mismatch', async () => {
    for (const value of ['', '1', 'yes']) {
      expect(
        (
          await mswJson(
            'GET',
            `/admin/kpi/actual-workspace/plans?hasOverdueActuals=${encodeURIComponent(value)}`,
          )
        ).status,
      ).toBe(400);
    }
    for (const field of ['actualEntryStatus', 'overdueCountMin', 'pendingCountMin']) {
      expect((await mswJson('GET', `/admin/kpi/actual-workspace/plans?${field}=1`)).status).toBe(
        422,
      );
    }
    expect(
      (await mswJson('GET', '/admin/kpi/actual-workspace/plans?sortBy=actualEntryStatus')).status,
    ).toBe(400);

    const first = await fetchKpiActualWorkspacePlans({
      search: 'Status fixture',
      hasPendingActuals: true,
      limit: 1,
    });
    expect(first.meta?.nextCursor).toBeDefined();
    const mismatch = await mswJson(
      'GET',
      `/admin/kpi/actual-workspace/plans?search=Status%20fixture&hasPendingActuals=false&limit=1&cursor=${encodeURIComponent(
        first.meta?.nextCursor ?? '',
      )}`,
    );
    expect(mismatch.status).toBe(400);
  });

  it('approval queue defaults to actionable status-filtered rows and exposes history views', async () => {
    const capturedStatuses: Array<string | null> = [];
    server.use(
      http.get('*/admin/kpi/allocations', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        capturedStatuses.push(status);
        const rows = {
          PENDING_APPROVAL: [makeAllocation('kpi-plan-pending-queue', 'PENDING_APPROVAL')],
          APPROVED: [makeAllocation('kpi-plan-approved-queue', 'APPROVED')],
          PUBLISHED: [makeAllocation('kpi-plan-published-queue', 'PUBLISHED')],
          REJECTED: [makeAllocation('kpi-plan-rejected-queue', 'REJECTED')],
          DRAFT: [makeAllocation('kpi-plan-draft-queue', 'DRAFT')],
        };
        return HttpResponse.json({
          data: rows[status as keyof typeof rows] ?? [],
        });
      }),
    );

    renderRoute('/kpi');
    await waitForKpiList();
    await selectAdminWorkspaceTab('Approval Queue');

    expect(
      await screen.findByRole('tab', { name: 'Action needed', selected: true }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(capturedStatuses).toContain('PENDING_APPROVAL');
      expect(capturedStatuses).toContain('APPROVED');
    });
    expect(await screen.findByText('kpi-plan-pending-queue')).toBeInTheDocument();
    expect(await screen.findByText('kpi-plan-approved-queue')).toBeInTheDocument();
    expect(screen.queryByText('kpi-plan-published-queue')).not.toBeInTheDocument();
    expect(screen.queryByText('kpi-plan-rejected-queue')).not.toBeInTheDocument();
    expect(screen.queryByText('kpi-plan-draft-queue')).not.toBeInTheDocument();

    await selectAdminWorkspaceTab('Published');
    expect(await screen.findByText('kpi-plan-published-queue')).toBeInTheDocument();
    expect(screen.queryByText('kpi-plan-pending-queue')).not.toBeInTheDocument();

    await selectAdminWorkspaceTab('Rejected');
    expect(await screen.findByText('kpi-plan-rejected-queue')).toBeInTheDocument();
    expect(screen.queryByText('kpi-plan-approved-queue')).not.toBeInTheDocument();
  });

  it('renders allocation workflow summaries from backend list rows', async () => {
    server.use(
      http.get('*/admin/kpi/plans', () =>
        HttpResponse.json({
          data: [
            makeListPlan('kpi-plan-zero', 'No allocation KPI', 'group-001', {
              status: 'DRAFT',
              allocationWorkflowSummary: makeAllocationWorkflowSummary(),
            }),
            makeListPlan('kpi-plan-mixed', 'Backend mixed workflow KPI', 'group-001', {
              allocationWorkflowSummary: makeAllocationWorkflowSummary({
                byStatus: {
                  draft: 2,
                  pendingApproval: 1,
                  published: 3,
                  active: 1,
                },
              }),
            }),
          ],
        }),
      ),
    );

    renderRoute('/kpi');
    await waitForKpiList();

    const zeroRow = (await screen.findByText('No allocation KPI')).closest('tr');
    expect(zeroRow).not.toBeNull();
    expect(within(zeroRow!).getByText('No allocations')).toBeInTheDocument();

    const mixedRow = screen.getByText('Backend mixed workflow KPI').closest('tr');
    expect(mixedRow).not.toBeNull();
    const mixedWorkflow = within(mixedRow!).getByLabelText('Allocation workflow');
    expect(within(mixedWorkflow).getByText('Draft')).toBeInTheDocument();
    expect(within(mixedWorkflow).getByText('Pending approval')).toBeInTheDocument();
    expect(within(mixedWorkflow).queryByText('Published')).not.toBeInTheDocument();
    expect(within(mixedWorkflow).getByText('Legacy active')).toBeInTheDocument();
    expect(within(mixedWorkflow).getByText('Official published')).toBeInTheDocument();
    expect(within(mixedWorkflow).getByText('3')).toBeInTheDocument();
    expect(within(mixedRow!).queryByText('Mixed')).not.toBeInTheDocument();
  });

  it('does not infer allocation workflow from plan title text', async () => {
    server.use(
      http.get('*/admin/kpi/plans', () =>
        HttpResponse.json({
          data: [
            makeListPlan(
              'kpi-plan-title-says-pending',
              'Title says Pending Approval but backend says legacy active',
              'group-001',
              {
                allocationWorkflowSummary: makeAllocationWorkflowSummary({
                  byStatus: { active: 1 },
                }),
              },
            ),
          ],
        }),
      ),
    );

    renderRoute('/kpi');
    await waitForKpiList();

    const row = (
      await screen.findByText('Title says Pending Approval but backend says legacy active')
    ).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('Legacy active')).toBeInTheDocument();
    expect(within(row!).queryByText('Pending approval')).not.toBeInTheDocument();
    expect(within(row!).queryByText('Official published')).not.toBeInTheDocument();
  });

  it('sends backend search query from list search', async () => {
    const urls: string[] = [];
    server.use(
      http.get('*/admin/kpi/plans', ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ data: [] });
      }),
    );
    renderRoute('/kpi');
    await waitForKpiList();
    await userEvent.type(screen.getByPlaceholderText('Search plan code or title'), 'Published');
    await waitFor(() => expect(urls.some((url) => url.includes('search=Published'))).toBe(true));
  });

  it('sends list filters as backend params', async () => {
    let captured = new URL('http://example.test');
    server.use(
      http.get('*/admin/kpi/plans', ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ data: [] });
      }),
    );
    renderRoute(
      '/kpi?subjectType=TALENT_GROUP&status=PUBLISHED&periodMonth=2026-05&metricCode=REVENUE_VND&subjectId=group-001',
    );
    await waitForKpiList();
    expect(captured.searchParams.get('subjectType')).toBe('TALENT_GROUP');
    expect(captured.searchParams.get('status')).toBe('PUBLISHED');
    expect(captured.searchParams.get('periodMonth')).toBe('2026-05');
    expect(captured.searchParams.get('metricCode')).toBe('REVENUE_VND');
    expect(captured.searchParams.get('subjectId')).toBe('group-001');
  });

  it('uses native month controls for monthly KPI cycles', async () => {
    const { container } = renderRoute('/kpi?periodMonth=2026-05');
    await waitForKpiList();
    expect(container.querySelector('input[type="month"][value="2026-05"]')).toBeInTheDocument();
  });

  it('displays KPI plan periodMonth as MM-YYYY while preserving query format', async () => {
    let captured = new URL('http://example.test');
    server.use(
      http.get('*/admin/kpi/plans', ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({
          data: [makeListPlan('kpi-plan-period-display', 'Period display KPI', 'group-001')],
        });
      }),
    );

    renderRoute('/kpi?periodMonth=2026-05');
    await waitForKpiList();

    const row = (await screen.findByText('Period display KPI')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('05-2026')).toBeInTheDocument();
    expect(within(row!).queryByText('2026-05')).not.toBeInTheDocument();
    expect(captured.searchParams.get('periodMonth')).toBe('2026-05');
  });

  it('create plan form parses money display input to a numeric API value', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('*/admin/kpi/plans', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            id: 'kpi-plan-created',
            planCode: 'KPI-202605-000101',
            title: 'Created',
            description: null,
            subjectType: 'TALENT_GROUP',
            subjectId: 'group-001',
            subjectRef: null,
            status: 'DRAFT',
            currencyCode: 'VND',
            periodMonth: '2026-05',
            periodStartAt: may2026PeriodStartAt,
            periodEndAt: may2026PeriodEndAt,
            timezone: 'Asia/Ho_Chi_Minh',
            actualPolicySnapshot: null,
            publishedAt: null,
            publishedByActorId: null,
            finalizedAt: null,
            finalizedByActorId: null,
            archivedAt: null,
            archivedByActorId: null,
            createdAt: 1,
            createdByActorId: 'user-admin',
            updatedAt: 1,
            updatedByActorId: 'user-admin',
            externalRef: null,
            targetMetrics: [],
            allocations: [],
          },
        });
      }),
    );
    renderRoute('/kpi');
    await waitForKpiList();
    await userEvent.click(await waitForEnabledButton('Create KPI plan'));
    const createSection = screen
      .getByRole('heading', { name: 'Create draft KPI plan' })
      .closest('section');
    expect(createSection).not.toBeNull();
    expect(within(createSection!).getByRole('combobox', { name: 'Subject type' })).toHaveValue(
      'TALENT_GROUP',
    );
    expect(
      within(createSection!).queryByRole('option', { name: 'Talent' }),
    ).not.toBeInTheDocument();
    expect(within(createSection!).queryByText('Allocations')).not.toBeInTheDocument();
    await userEvent.click(
      await within(createSection!).findByRole('button', { name: /Creators A - TG-000001/ }),
    );
    await userEvent.click(await waitForEnabledButton('Create draft plan'));
    await waitFor(() => expect(body).toBeDefined());
    expect(body?.subjectType).toBe('TALENT_GROUP');
    expect(body).not.toHaveProperty('allocations');
    expect((body?.targetMetrics as Array<{ targetValue: number }>)[0].targetValue).toBe(1000000);
    expect(typeof (body?.targetMetrics as Array<{ targetValue: number }>)[0].targetValue).toBe(
      'number',
    );
  });

  it('Admin create filters metrics by subject type and creates an ORG_UNIT plan without raw IDs', async () => {
    renderRoute('/kpi');
    await waitForKpiList();
    await userEvent.click(await waitForEnabledButton('Create KPI plan'));
    const createSection = screen
      .getByRole('heading', { name: 'Create draft KPI plan' })
      .closest('section');
    expect(createSection).not.toBeNull();

    const metricSelect = within(createSection!).getByRole('combobox', { name: 'Metric' });
    expect(within(metricSelect).getByRole('option', { name: 'Revenue VND' })).toBeInTheDocument();
    expect(
      within(metricSelect).getByRole('option', { name: 'TikTok Diamond' }),
    ).toBeInTheDocument();

    await userEvent.selectOptions(
      within(createSection!).getByRole('combobox', { name: 'Subject type' }),
      'ORG_UNIT',
    );
    expect(within(createSection!).getAllByText('Company operational unit').length).toBeGreaterThan(
      0,
    );
    expect(within(metricSelect).getAllByRole('option')).toHaveLength(1);
    expect(
      within(metricSelect).queryByRole('option', { name: 'TikTok Diamond' }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      await within(createSection!).findByRole('button', { name: /Head Office - OU-000001/ }),
    );
    await userEvent.click(await waitForEnabledButton('Create draft plan'));
    expect(await screen.findByText('KPI plan created.')).toBeInTheDocument();
    expect((await screen.findAllByText('Operations Unit')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Org Unit')).length).toBeGreaterThan(0);
    expect(screen.queryByText('org-unit-001')).not.toBeInTheDocument();
  });

  it('rejects malformed money before calling create API', async () => {
    let called = false;
    server.use(
      http.post('*/admin/kpi/plans', () => {
        called = true;
        return HttpResponse.json({ data: {} });
      }),
    );
    renderRoute('/kpi');
    await waitForKpiList();
    await userEvent.click(await waitForEnabledButton('Create KPI plan'));
    const money = screen.getByLabelText('Revenue VND Target');
    await userEvent.clear(money);
    await userEvent.type(money, '1.00.000');
    await userEvent.click(await waitForEnabledButton('Create draft plan'));
    expect(await screen.findByText('Enter a valid numeric metric value.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('accepts DD-MM-YYYY and rejects YYYY-MM-DD dates', () => {
    expect(parseKpiDate('16-05-2026')).toBe('16-05-2026');
    expect(parseKpiDate('2026-05-16')).toBeUndefined();
    expect(parseKpiDate('16/05/2026')).toBeUndefined();
    expect(parseKpiDate('6-5-2026')).toBeUndefined();
  });

  it('actual entry UI rejects YYYY-MM-DD before saving', async () => {
    renderRoute('/kpi');
    await openPublishedWorkspacePlan();
    const actualDate = screen.getByLabelText('Actual date');
    await userEvent.clear(actualDate);
    await userEvent.type(actualDate, '2026-05-16');
    expect(await screen.findByText(/Do not use YYYY-MM-DD/i)).toBeInTheDocument();
  });

  it('enforces count integer and LIVE_HOURS max two decimals', () => {
    expect(parseKpiMetricInput('CONTENT_OUTPUT_COUNT', '10')).toBe(10);
    expect(parseKpiMetricInput('CONTENT_OUTPUT_COUNT', '10.5')).toBeUndefined();
    expect(parseKpiHoursInput('1,5')).toBe(1.5);
    expect(parseKpiHoursInput('1.55')).toBe(1.55);
    expect(parseKpiHoursInput('1.555')).toBeUndefined();
  });

  it('create plan form blocks past periodMonth before calling create API', async () => {
    let called = false;
    server.use(
      http.post('*/admin/kpi/plans', () => {
        called = true;
        return HttpResponse.json({ data: {} });
      }),
    );
    renderRoute('/kpi');
    await waitForKpiList();
    await userEvent.click(await waitForEnabledButton('Create KPI plan'));
    const month = screen.getAllByLabelText('Period month').find((element) => {
      const input = element as HTMLInputElement;
      return input.type === 'month' && Boolean(input.min);
    }) as HTMLInputElement;
    await userEvent.clear(month);
    await userEvent.type(month, '2026-05');
    await userEvent.click(await waitForEnabledButton('Create draft plan'));
    expect(
      await screen.findByText('Choose the current month or a future month.'),
    ).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('hides draft edit controls for a published plan', async () => {
    renderRoute('/kpi/plans/kpi-plan-published');
    await waitForPublishedKpiDetail();
    expect(screen.queryByRole('button', { name: 'Update draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace metrics' })).not.toBeInTheDocument();
  });

  it('shows explicit lifecycle copy when a published plan is not finalized yet', async () => {
    renderRoute('/kpi/plans/kpi-plan-published');
    await waitForPublishedKpiDetail();
    expect(screen.getByText('Plan status')).toBeInTheDocument();
    expect(screen.getByText('Plan published at')).toBeInTheDocument();
    expect(screen.getByText('Plan finalized at')).toBeInTheDocument();
    expect(screen.getByText('Not finalized yet')).toBeInTheDocument();
  });

  it('shows the backend-owned finalized result snapshot on KPI detail without raw IDs or finance copy', async () => {
    renderRoute('/kpi/plans/kpi-plan-finalized');

    expect(
      await screen.findByRole('heading', { name: 'Finalized team KPI' }, lazyRouteContentWait),
    ).toBeInTheDocument();
    const finalResult = screen.getByLabelText('Finalized result');
    expect(
      within(finalResult).getByRole('heading', { name: 'Finalized result' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Captured when the KPI was finalized.')).toBeInTheDocument();
    expect(screen.getByText(/Read-only after finalization/)).toBeInTheDocument();
    expect(screen.getAllByText('Luna Park').length).toBeGreaterThan(0);
    expect(screen.getByText('850.000 VND')).toBeInTheDocument();
    expect(within(finalResult).getByText(/TikTok Diamond/)).toBeInTheDocument();
    expect(within(finalResult).queryByText(/840 VND/)).not.toBeInTheDocument();
    expect(within(finalResult).queryByText('user-admin')).not.toBeInTheDocument();
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(screen.queryByText('employment-profile-001')).not.toBeInTheDocument();
    expect(
      within(finalResult).queryByText(/final score|payroll|payout|settlement/i),
    ).not.toBeInTheDocument();
  });

  it('shows safe fallback copy for a finalized KPI detail without a snapshot', async () => {
    renderRoute('/kpi/plans/kpi-plan-finalized-no-snapshot');

    expect(
      await screen.findByRole('heading', { name: 'Finalized KPI without snapshot' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Final result snapshot is not available for this finalized plan.'),
    ).toBeInTheDocument();
  });

  it('TEAM_MANAGER sees allocation draft and submit controls disabled until KPI plan is published', async () => {
    let managedMemberLookupCalled = false;
    let progressLookupCalled = false;
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.readProgress', 'kpi.enterActual', 'kpi.correctActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });
    server.use(
      http.get('*/admin/kpi/plans/kpi-plan-draft/managed-members', () => {
        managedMemberLookupCalled = true;
        return HttpResponse.json(
          { message: 'KPI_PERMISSION_SCOPE_ERROR: Permission or scope denied' },
          { status: 403 },
        );
      }),
      http.get('*/admin/kpi/plans/kpi-plan-draft/progress', () => {
        progressLookupCalled = true;
        return HttpResponse.json(
          { message: 'KPI_PERMISSION_SCOPE_ERROR: KPI progress read scope denied' },
          { status: 403 },
        );
      }),
    );

    renderRoute('/kpi/plans/kpi-plan-draft');
    await screen.findByText('May creator KPI');

    expect(
      await screen.findByText('Publish the KPI plan before drafting allocations.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Save Allocation Draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit Allocation' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add member' })).toBeDisabled();
    for (const searchButton of screen.getAllByRole('button', { name: 'Search' })) {
      expect(searchButton).toBeDisabled();
    }
    expect(screen.queryByText(/Could not load Managed member options/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/KPI_PERMISSION_SCOPE_ERROR/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/KPI progress read scope denied/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Progress is unavailable for this plan or actor.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Published-only')).toBeInTheDocument();
    expect(screen.getByText('Published allocations only')).toBeInTheDocument();
    expect(
      screen.getByText('Allocation does not affect official progress until published'),
    ).toBeInTheDocument();
    expect(managedMemberLookupCalled).toBe(false);
    expect(progressLookupCalled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Approve Allocation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish Allocation' })).not.toBeInTheDocument();
  });

  it('TEAM_MANAGER saves allocation draft with employment profile targets only on a published KPI plan', async () => {
    let body: Record<string, unknown> | undefined;
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.enterActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });
    server.use(
      http.get('*/admin/kpi/plans/kpi-plan-published-draft-allocation', () =>
        HttpResponse.json({
          data: makeDetailWithAllocation(
            'kpi-plan-published-draft-allocation',
            'PUBLISHED',
            'DRAFT',
          ),
        }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-published-draft-allocation/progress', () =>
        HttpResponse.json({ data: makeProgress('kpi-plan-published-draft-allocation', []) }),
      ),
      http.put(
        '*/admin/kpi/plans/kpi-plan-published-draft-allocation/allocation-draft',
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            data: makeDetailWithAllocation(
              'kpi-plan-published-draft-allocation',
              'PUBLISHED',
              'DRAFT',
            ),
          });
        },
      ),
    );

    renderRoute('/kpi/plans/kpi-plan-published-draft-allocation');
    await waitForPublishedKpiDetail();
    expect(screen.getByText('Plan status')).toBeInTheDocument();
    expect(screen.getAllByText('Published').length).toBeGreaterThan(0);
    expect(screen.getByText('Allocation status')).toBeInTheDocument();
    expect(screen.getByText('Allocation Draft')).toBeInTheDocument();
    expect(
      screen.queryByText('Publish the KPI plan before drafting allocations.'),
    ).not.toBeInTheDocument();
    await userEvent.click(await waitForEnabledButton('Save Allocation Draft'));

    await waitFor(() => expect(body).toBeDefined());
    const parsed = parseKpiAllocationDraftPayloadForTest(body);
    expect(parsed.allocations[0]).toHaveProperty('employmentProfileId');
    expect(parsed.allocations[0]).not.toHaveProperty('memberTalentId');
    expect(parsed.allocations[0]?.allocationStartDate).toBe('2026-05-01');
    expect(parsed.allocations[0]?.allocationStartDate).not.toBe('');
  });

  it('TEAM_MANAGER default allocation draft date uses periodMonth for local period timestamps', async () => {
    let body: Record<string, unknown> | undefined;
    const planId = 'kpi-plan-local-period-empty-allocation';
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.enterActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });
    server.use(
      http.get(`*/admin/kpi/plans/${planId}`, () =>
        HttpResponse.json({
          data: {
            ...makeDetail(planId, 'PUBLISHED'),
            periodMonth: '2026-05',
            periodStartAt: may2026PeriodStartAt,
            periodEndAt: may2026PeriodEndAt,
            allocations: [],
          },
        }),
      ),
      http.get(`*/admin/kpi/plans/${planId}/progress`, () =>
        HttpResponse.json({ data: makeProgress(planId, []) }),
      ),
      http.get(`*/admin/kpi/plans/${planId}/managed-members`, () =>
        HttpResponse.json({
          data: [
            {
              employmentProfileId: 'employment-profile-001',
              employeeCode: 'EMP-001',
              displayName: 'Luna Park',
              talentId: 'talent-luna',
              talentCode: 'LUNA',
              groupId: 'group-001',
            },
          ],
        }),
      ),
      http.put(`*/admin/kpi/plans/${planId}/allocation-draft`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: makeDetailWithAllocation(planId, 'PUBLISHED', 'DRAFT'),
        });
      }),
    );

    const { container } = renderRoute(`/kpi/plans/${planId}`);
    await waitForPublishedKpiDetail();
    const picker = await waitFor(() => {
      const element = container.querySelector('[data-picker-id="kpi-managed-member-0"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await userEvent.click(within(picker).getByRole('button', { name: 'Search' }));
    await userEvent.click(await within(picker).findByRole('button', { name: /Luna Park/ }));
    await userEvent.click(await waitForEnabledButton('Save Allocation Draft'));

    await waitFor(() => expect(body).toBeDefined());
    const parsed = parseKpiAllocationDraftPayloadForTest(body);
    expect(parsed.allocations[0]?.allocationStartDate).toBe('2026-05-01');
    expect(parsed.allocations[0]?.allocationStartDate).not.toBe('2026-04-30');
  });

  it('TEAM_MANAGER allocation picker uses the scoped managed-member endpoint', async () => {
    let managedMemberLookupCalled = false;
    let genericEmploymentProfileLookupCalled = false;
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.enterActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });
    server.use(
      http.get('*/admin/kpi/plans/kpi-plan-published-draft-allocation', () =>
        HttpResponse.json({
          data: makeDetailWithAllocation(
            'kpi-plan-published-draft-allocation',
            'PUBLISHED',
            'DRAFT',
          ),
        }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-published-draft-allocation/progress', () =>
        HttpResponse.json({ data: makeProgress('kpi-plan-published-draft-allocation', []) }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-published-draft-allocation/managed-members', () => {
        managedMemberLookupCalled = true;
        return HttpResponse.json({
          data: [
            {
              employmentProfileId: 'employment-profile-001',
              employeeCode: 'EMP-001',
              displayName: 'Luna Park',
              talentId: 'talent-luna',
              talentCode: 'LUNA',
              groupId: 'group-001',
            },
          ],
        });
      }),
      http.get('*/admin/reference/employment-profiles', () => {
        genericEmploymentProfileLookupCalled = true;
        return HttpResponse.json({ data: { items: [] } });
      }),
    );

    const { container } = renderRoute('/kpi/plans/kpi-plan-published-draft-allocation');
    await waitForPublishedKpiDetail();
    const picker = await waitFor(() => {
      const element = container.querySelector('[data-picker-id="kpi-managed-member-0"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await userEvent.click(within(picker as HTMLElement).getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(managedMemberLookupCalled).toBe(true));
    expect(genericEmploymentProfileLookupCalled).toBe(false);
  });

  it('managed-member API returns only safe picker fields', async () => {
    const members = await fetchKpiManagedMembers('kpi-plan-published', {
      search: 'Luna',
      limit: 10,
    });

    expect(members).toEqual([
      {
        employmentProfileId: 'employment-profile-001',
        employeeCode: 'EP-000001',
        displayName: 'Luna Park',
        talentId: 'talent-001',
        talentCode: 'TAL-000001',
        groupId: 'group-001',
      },
    ]);
    expect(Object.keys(members[0]).sort()).toEqual([
      'displayName',
      'employeeCode',
      'employmentProfileId',
      'groupId',
      'talentCode',
      'talentId',
    ]);
  });

  it('TEAM_MANAGER submits allocation draft on a published KPI plan', async () => {
    let called = false;
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.enterActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });
    server.use(
      http.get('*/admin/kpi/plans/kpi-plan-published-submittable-allocation', () =>
        HttpResponse.json({
          data: makeDetailWithAllocation(
            'kpi-plan-published-submittable-allocation',
            'PUBLISHED',
            'DRAFT',
          ),
        }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-published-submittable-allocation/progress', () =>
        HttpResponse.json({ data: makeProgress('kpi-plan-published-submittable-allocation', []) }),
      ),
      http.post(
        '*/admin/kpi/plans/kpi-plan-published-submittable-allocation/allocation-submit',
        () => {
          called = true;
          return HttpResponse.json({
            data: makeDetailWithAllocation(
              'kpi-plan-published-submittable-allocation',
              'PUBLISHED',
              'PENDING_APPROVAL',
            ),
          });
        },
      ),
    );

    renderRoute('/kpi/plans/kpi-plan-published-submittable-allocation');
    await waitForPublishedKpiDetail();
    await userEvent.click(await waitForEnabledButton('Submit Allocation'));

    await waitFor(() => expect(called).toBe(true));
  });

  it('ADMIN_FULL sees allocation approval queue and status-gated approval actions', async () => {
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.manageAllocation', 'kpi.publish'],
      scopeGrants: { kpi: ['global'] },
    });
    server.use(
      http.get('*/admin/kpi/plans/kpi-plan-approval', () =>
        HttpResponse.json({
          data: makeDetailWithAllocation('kpi-plan-approval', 'PUBLISHED', 'PENDING_APPROVAL'),
        }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-approval/progress', () =>
        HttpResponse.json({ data: makeProgress('kpi-plan-approval', []) }),
      ),
    );

    const queueView = renderRoute('/kpi');
    await waitForKpiList();
    await selectAdminWorkspaceTab('Approval Queue');
    expect(
      await screen.findByRole('heading', { name: 'KPI Allocation approval queue' }),
    ).toBeInTheDocument();
    queueView.unmount();

    renderRoute('/kpi/plans/kpi-plan-approval');
    await waitForPublishedKpiDetail();
    expect(await screen.findByRole('button', { name: 'Approve Allocation' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reject Allocation' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publish Allocation' })).toBeDisabled();
  });

  it('ADMIN_FULL sees publish enabled only for approved allocation', async () => {
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.manageAllocation', 'kpi.publish'],
      scopeGrants: { kpi: ['global'] },
    });
    server.use(
      http.get('*/admin/kpi/plans/kpi-plan-approved', () =>
        HttpResponse.json({
          data: makeDetailWithAllocation('kpi-plan-approved', 'PUBLISHED', 'APPROVED'),
        }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-approved/progress', () =>
        HttpResponse.json({ data: makeProgress('kpi-plan-approved', []) }),
      ),
    );

    renderRoute('/kpi/plans/kpi-plan-approved');
    await waitForPublishedKpiDetail();
    expect(await screen.findByRole('button', { name: 'Publish Allocation' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Approve Allocation' })).toBeDisabled();
  });

  it.each([
    ['HR_OPERATIONS', ['kpi.read'], { kpi: ['global'] }],
    ['PRODUCTION_OPS', ['kpi.read'], { kpi: ['managedGroup'] }],
    ['COMMERCIAL_FINANCE', ['kpi.read', 'kpi.readProgress'], { kpi: ['global'] }],
    ['VIEWER_AUDITOR', ['kpi.read'], { kpi: ['global'] }],
    ['TALENT_STAFF_SELF', ['kpi.readProgress'], { kpi: ['self'] }],
  ] as Array<[string, string[], CurrentActorCapabilities['scopeGrants']]>)(
    '%s does not see allocation draft, submit, approve, or publish',
    async (_role, permissions, scopeGrants) => {
      mockKpiCapabilities({ permissions, scopeGrants });

      renderRoute('/kpi/plans/kpi-plan-draft');
      await waitFor(() =>
        expect(
          screen.queryByText('May creator KPI') ?? screen.queryByText('Access denied'),
        ).toBeInTheDocument(),
      );

      expect(
        screen.queryByRole('button', { name: 'Save Allocation Draft' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Submit Allocation' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Approve Allocation' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Publish Allocation' })).not.toBeInTheDocument();
    },
  );

  it('shows PUBLISHED allocation as official and ACTIVE as legacy nonofficial', async () => {
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.manageAllocation', 'kpi.publish'],
      scopeGrants: { kpi: ['global'] },
    });
    server.use(
      http.get('*/admin/kpi/plans/kpi-plan-official', () =>
        HttpResponse.json({
          data: makeDetailWithAllocation('kpi-plan-official', 'PUBLISHED', 'PUBLISHED'),
        }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-official/progress', () =>
        HttpResponse.json({ data: makeProgress('kpi-plan-official', []) }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-active', () =>
        HttpResponse.json({
          data: makeDetailWithAllocation('kpi-plan-active', 'PUBLISHED', 'ACTIVE'),
        }),
      ),
      http.get('*/admin/kpi/plans/kpi-plan-active/progress', () =>
        HttpResponse.json({ data: makeProgress('kpi-plan-active', []) }),
      ),
    );

    const officialView = renderRoute('/kpi/plans/kpi-plan-official');
    expect(await screen.findByText('Published allocation is official.')).toBeInTheDocument();
    officialView.unmount();

    renderRoute('/kpi/plans/kpi-plan-active');
    expect(await screen.findByText('Legacy active allocation')).toBeInTheDocument();
    expect(screen.queryByText('Published allocation is official.')).not.toBeInTheDocument();
    expect(
      screen.getByText('Allocation does not affect official progress until published'),
    ).toBeInTheDocument();
  });

  it('shows publish confirmation and calls publish API', async () => {
    let called = false;
    server.use(
      http.post('*/admin/kpi/plans/kpi-plan-draft/publish', async () => {
        called = true;
        return HttpResponse.json({ data: makeDetail('kpi-plan-draft', 'PUBLISHED') });
      }),
    );
    renderRoute('/kpi/plans/kpi-plan-draft');
    await screen.findByText('May creator KPI');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByTestId('confirm-dialog')).toHaveTextContent(
      'Targets and allocations will be locked',
    );
    await userEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(called).toBe(true));
  });

  it('publishes an ORG_UNIT plan from Admin detail and displays subject type without raw IDs', async () => {
    const plan = await createKpiPlan({
      title: 'Operations launch KPI',
      subjectType: 'ORG_UNIT',
      subjectId: 'org-unit-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 2000000 }],
    });

    renderRoute(`/kpi/plans/${plan.id}`);
    expect(
      await screen.findByRole('heading', { name: 'Operations launch KPI' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Org Unit - Operations Unit - 2026-06/)).toBeInTheDocument();
    expect(screen.queryByText('org-unit-001')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await userEvent.click(await screen.findByTestId('confirm-dialog-confirm'));
    expect(await screen.findByText('KPI lifecycle updated.')).toBeInTheDocument();
    expect((await fetchKpiPlanDetail(plan.id)).status).toBe('PUBLISHED');
  });

  it('renders ORG_UNIT manager operations with EmploymentProfile members and no raw member IDs', async () => {
    let finalResultReads = 0;
    server.use(
      http.get('*/admin/kpi/plans/:kpiPlanId/org-unit-final-result', () => {
        finalResultReads += 1;
        return HttpResponse.json(
          { message: 'Non-finalized ORG_UNIT detail must not call finalResult' },
          { status: 500 },
        );
      }),
    );

    renderRoute('/kpi/plans/kpi-plan-org-unit');

    expect(await screen.findByRole('heading', { name: 'Operations unit KPI' })).toBeInTheDocument();
    const operations = await screen.findByTestId('org-unit-operations');
    expect(screen.getByText('Org Unit operations')).toBeInTheDocument();
    expect(within(operations).getByText('Operations Unit')).toBeInTheDocument();
    expect(within(operations).getAllByText('An Nguyen').length).toBeGreaterThan(0);
    expect(within(operations).getAllByText('Bao Le').length).toBeGreaterThan(0);
    expect(within(operations).getByText('EP-OPS-001')).toBeInTheDocument();
    expect(within(operations).getByText('EP-OPS-002')).toBeInTheDocument();
    expect(within(operations).getByText('Managed write actions available')).toBeInTheDocument();
    expect(screen.queryByText('employment-profile-ops-001')).not.toBeInTheDocument();
    expect(screen.queryByText('employment-profile-ops-002')).not.toBeInTheDocument();
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(screen.queryByText('org-unit-001')).not.toBeInTheDocument();
    expect(within(operations).getByText('Not finalized yet')).toBeInTheDocument();
    expect(
      within(operations).queryByRole('heading', { name: 'Finalized result' }),
    ).not.toBeInTheDocument();
    expect(finalResultReads).toBe(0);

    await userEvent.click(within(operations).getByRole('button', { name: 'Load grid' }));
    expect(
      await within(operations).findByLabelText('An Nguyen Revenue VND actual'),
    ).toBeInTheDocument();
    expect(within(operations).getAllByText('Due open').length).toBeGreaterThan(0);
    expect(finalResultReads).toBe(0);
  });

  it('saves ORG_UNIT allocation draft through scoped managed members without showing raw IDs', async () => {
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.readProgress', 'kpi.enterActual'],
      scopeGrants: { kpi: ['managedGroup'] },
    });
    const plan = await createKpiPlan({
      title: 'Org Unit allocation draft KPI',
      subjectType: 'ORG_UNIT',
      subjectId: 'org-unit-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 2000000 }],
    });
    await performKpiLifecycleAction(plan.id, 'publish');

    renderRoute(`/kpi/plans/${plan.id}`);

    const operations = await screen.findByTestId('org-unit-operations');
    expect(
      await within(operations).findByText('No Org Unit allocations are published for this plan.'),
    ).toBeInTheDocument();
    await userEvent.selectOptions(
      await within(operations).findByRole('combobox', { name: 'Managed member 1' }),
      'employment-profile-ops-001',
    );
    const targetInput = await within(operations).findByLabelText('An Nguyen Revenue VND');
    await userEvent.clear(targetInput);
    await userEvent.type(targetInput, '2.000.000');
    await userEvent.click(
      within(operations).getByRole('button', { name: 'Save Allocation Draft' }),
    );

    expect(await screen.findByText('Allocation draft saved.')).toBeInTheDocument();
    const allocations = await fetchKpiOrgUnitAllocations(plan.id);
    expect(allocations[0]).toMatchObject({
      memberEmploymentProfileId: 'employment-profile-ops-001',
      memberTalentId: null,
      groupId: null,
      allocationStatus: 'DRAFT',
    });
    expect(allocations[0]?.targetMetrics[0]?.targetValue).toBe(2000000);
    expect(within(operations).getAllByText(/An Nguyen/).length).toBeGreaterThan(0);
    expect(screen.queryByText('employment-profile-ops-001')).not.toBeInTheDocument();
    expect(screen.queryByText('org-unit-001')).not.toBeInTheDocument();
  });

  it('enters zero and updates ORG_UNIT actual through the manager grid', async () => {
    renderRoute('/kpi/plans/kpi-plan-org-unit');

    const operations = await screen.findByTestId('org-unit-operations');
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

  it('marks and unmarks ORG_UNIT exceptions while blocking actual and correction actions', async () => {
    renderRoute('/kpi/plans/kpi-plan-org-unit');

    const operations = await screen.findByTestId('org-unit-operations');
    await userEvent.click(within(operations).getByRole('button', { name: 'Load grid' }));

    const baoActual = await within(operations).findByLabelText('Bao Le Revenue VND actual');
    const baoRow = baoActual.closest('tr');
    expect(baoRow).not.toBeNull();
    await userEvent.click(within(baoRow!).getByRole('button', { name: 'Mark excused' }));
    await userEvent.selectOptions(within(baoRow!).getByRole('combobox'), 'MEMBER_LEAVE');
    await userEvent.type(within(baoRow!).getByLabelText('Reason text'), 'Approved leave');
    await userEvent.click(within(baoRow!).getByRole('button', { name: 'Submit excuse' }));
    expect(await screen.findByText('Exception marked.')).toBeInTheDocument();
    expect(await within(operations).findByText('Excused')).toBeInTheDocument();
    expect(within(baoRow!).getByLabelText('Bao Le Revenue VND actual')).toBeDisabled();
    expect(within(baoRow!).queryByRole('button', { name: 'Correction' })).not.toBeInTheDocument();

    await userEvent.click(within(baoRow!).getByRole('button', { name: 'Unmark excuse' }));
    expect(await screen.findByText('Exception removed.')).toBeInTheDocument();
  });

  it('hides ORG_UNIT correction while direct edit is still eligible', async () => {
    await createKpiOrgUnitActual({
      kpiPlanId: 'kpi-plan-org-unit',
      allocationId: 'kpi-plan-org-unit-alloc-1',
      metricCode: 'REVENUE_VND',
      actualDate: '15-06-2026',
      actualValue: 100000,
    });

    renderRoute('/kpi/plans/kpi-plan-org-unit');

    const operations = await screen.findByTestId('org-unit-operations');
    await userEvent.click(within(operations).getByRole('button', { name: 'Load grid' }));

    const anActual = await within(operations).findByLabelText('An Nguyen Revenue VND actual');
    expect(anActual).not.toBeDisabled();
    expect(within(anActual.closest('tr')!).queryByRole('button', { name: 'Correction' })).toBeNull();
  });

  it('creates ORG_UNIT correction history without exposing raw correction IDs', async () => {
    await createKpiOrgUnitActual({
      kpiPlanId: 'kpi-plan-org-unit',
      allocationId: 'kpi-plan-org-unit-alloc-1',
      metricCode: 'REVENUE_VND',
      actualDate: '15-06-2026',
      actualValue: 100000,
    });
    vi.setSystemTime(new Date('2026-06-16T10:00:01+07:00'));

    renderRoute('/kpi/plans/kpi-plan-org-unit');

    const operations = await screen.findByTestId('org-unit-operations');
    const actualDate = within(operations).getByLabelText('Actual date');
    await userEvent.clear(actualDate);
    await userEvent.type(actualDate, '15-06-2026');
    await userEvent.click(within(operations).getByRole('button', { name: 'Load grid' }));

    const correctedAnActual = await within(operations).findByLabelText(
      'An Nguyen Revenue VND actual',
    );
    const anRow = correctedAnActual.closest('tr');
    expect(anRow).not.toBeNull();
    await userEvent.click(within(anRow!).getByRole('button', { name: 'Correction' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit actual' });
    await userEvent.clear(within(dialog).getByLabelText('Corrected value'));
    await userEvent.type(within(dialog).getByLabelText('Corrected value'), '120.000');
    await userEvent.type(
      within(dialog).getByLabelText('Correction reason'),
      'Operational correction',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit correction' }));
    expect(await screen.findByText('Correction submitted.')).toBeInTheDocument();
    expect(await within(dialog).findByText(/Operational correction/)).toBeInTheDocument();
    expect(screen.queryByText('org-unit-correction')).not.toBeInTheDocument();
  });

  it('keeps ORG_UNIT write actions hidden for read-only managed actors', async () => {
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.readProgress'],
      scopeGrants: { kpi: ['managedGroup'] },
    });

    renderRoute('/kpi/plans/kpi-plan-org-unit');

    const operations = await screen.findByTestId('org-unit-operations');
    expect(
      within(operations).getByText('Read-only for this actor or plan state'),
    ).toBeInTheDocument();
    await userEvent.click(within(operations).getByRole('button', { name: 'Load grid' }));
    expect(await within(operations).findByLabelText('An Nguyen Revenue VND actual')).toBeDisabled();
    expect(
      within(operations).queryByRole('button', { name: 'Save changed cells' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Save Allocation Draft' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Submit Allocation' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Approve Allocation' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Publish Allocation' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Mark excused' }),
    ).not.toBeInTheDocument();
    expect(
      within(operations).queryByRole('button', { name: 'Mark not required' }),
    ).not.toBeInTheDocument();
  });

  it('renders ORG_UNIT operational finalResult from the route without Diamond or payout copy', async () => {
    renderRoute('/kpi/plans/kpi-plan-org-unit-finalized');

    const operations = await screen.findByTestId('org-unit-operations');
    expect(within(operations).getByText('Operational final result')).toBeInTheDocument();
    expect(
      await within(operations).findByRole('heading', { name: 'Finalized result' }),
    ).toBeInTheDocument();
    expect(within(operations).getAllByText('An Nguyen').length).toBeGreaterThan(0);
    expect(within(operations).getAllByText('2.000.000 VND').length).toBeGreaterThan(0);
    expect(screen.queryByText('employment-profile-ops-001')).not.toBeInTheDocument();
    expect(within(operations).queryByText('TIKTOK_DIAMOND')).not.toBeInTheDocument();
    expect(within(operations).queryByText(/payroll/i)).not.toBeInTheDocument();
    expect(within(operations).queryByText(/commission/i)).not.toBeInTheDocument();
    expect(within(operations).queryByText(/payout/i)).not.toBeInTheDocument();
  });

  it('shows finalize confirmation and calls finalize API', async () => {
    renderRoute('/kpi/plans/kpi-plan-published');
    await waitForPublishedKpiDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Finalize' }));
    expect(await screen.findByTestId('confirm-dialog')).toHaveTextContent(
      'Finalizing locks actuals and corrections.',
    );
    await userEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(await screen.findByText('KPI lifecycle updated.')).toBeInTheDocument();

    const finalized = await fetchKpiPlanDetail('kpi-plan-published');
    expect(finalized.status).toBe('FINALIZED');
    expect(finalized.finalResult).toMatchObject({
      snapshotVersion: 1,
      planId: 'kpi-plan-published',
      planCode: 'KPI-202605-000002',
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
    });
    const serializedFinalResult = JSON.stringify(finalized.finalResult);
    for (const forbidden of [
      'finalizedByActorId',
      'memberTalentId',
      'memberEmploymentProfileId',
      'finalScore',
      'payroll',
      'payout',
      'settlement',
    ]) {
      expect(serializedFinalResult).not.toContain(forbidden);
    }

    const listed = await fetchKpiPlans({});
    const finalizedListItem = listed.find((plan) => plan.id === 'kpi-plan-published');
    expect(finalizedListItem?.status).toBe('FINALIZED');
    expect(finalizedListItem).not.toHaveProperty('finalResult');
  });

  it('shows archive confirmation and calls archive API', async () => {
    renderRoute('/kpi/plans/kpi-plan-published');
    await waitForPublishedKpiDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByTestId('confirm-dialog')).toHaveTextContent('Archive this KPI plan?');
    await userEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(await screen.findByText('KPI lifecycle updated.')).toBeInTheDocument();
  });

  it('loads actual grid endpoint and sends actualDate as DD-MM-YYYY', async () => {
    const captured: URL[] = [];
    server.use(
      http.get('*/admin/kpi/plans/:kpiPlanId/actuals', ({ request }) => {
        captured.push(new URL(request.url));
        return HttpResponse.json({ data: makeActualGrid() });
      }),
    );
    renderRoute('/kpi');
    await openProgressActualsTab();
    expect(captured).toHaveLength(0);
    expect(screen.queryByDisplayValue('kpi-plan-published')).not.toBeInTheDocument();
    const workspaceRow = (await screen.findByText('KPI-202605-000002')).closest('tr');
    expect(workspaceRow).not.toBeNull();
    await userEvent.click(within(workspaceRow!).getByRole('button', { name: 'View detail' }));
    await screen.findByText('kpi-plan-published-alloc-1');
    expect(captured).toHaveLength(0);
    expect(screen.getByLabelText('Actual date')).not.toHaveValue('16-05-2026');
    await userEvent.clear(screen.getByLabelText('Actual date'));
    await userEvent.type(screen.getByLabelText('Actual date'), '16-05-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load grid' }));
    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0].searchParams.get('actualDate')).toBe('16-05-2026');
  });

  it('displays backend daily actual statuses, safe excuse reasons, and gated excuse actions', async () => {
    server.use(
      http.get('*/admin/kpi/plans/:kpiPlanId/actuals', () =>
        HttpResponse.json({ data: makeActualStatusGrid() }),
      ),
    );

    renderRoute('/kpi');
    await openPublishedActualGrid();

    expect(await screen.findAllByText('Due open')).not.toHaveLength(0);
    expect(screen.getAllByText('Overdue')).not.toHaveLength(0);
    expect(screen.getAllByText('Entered')).not.toHaveLength(0);
    expect(screen.getAllByText('Entered zero')).not.toHaveLength(0);
    expect(screen.getAllByText('Not due')).not.toHaveLength(0);
    expect(screen.getAllByText('Excused')).not.toHaveLength(0);
    expect(screen.getAllByText('Not required')).not.toHaveLength(0);
    expect(screen.getByText(/Member leave: Approved leave/i)).toBeInTheDocument();
    expect(screen.getByText(/No operation required: No stream scheduled/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Mark excused' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Mark not required' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Unmark excuse' })).toHaveLength(2);
    const limitedSignals = screen.getAllByText(/limited calendar-day signal/i);
    expect(limitedSignals).not.toHaveLength(0);
    limitedSignals.forEach((signal) => expect(signal.textContent).not.toMatch(/overdue/i));
  });

  it('marks and unmarks actual excuses through MSW and blocks actual entry while active', async () => {
    renderRoute('/kpi');
    await openPublishedActualGrid();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Mark excused' }))[0]);
    await userEvent.click(await waitForEnabledButton('Submit excuse'));
    expect(
      await screen.findByText(/reason code and reason text are required/i),
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Reason code'), 'MEMBER_LEAVE');
    await userEvent.type(screen.getByLabelText('Reason text'), 'Approved leave');
    await userEvent.click(await waitForEnabledButton('Submit excuse'));
    expect(await screen.findByText(/Member leave: Approved leave/i)).toBeInTheDocument();

    const lunaContent = await screen.findByLabelText('Luna Park Content output count actual');
    await userEvent.clear(lunaContent);
    await userEvent.type(lunaContent, '3');
    await userEvent.click(await waitForEnabledButton('Save changed cells'));
    expect(await screen.findByText(/active excuse/i)).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Unmark excuse' }));
    await waitFor(() =>
      expect(screen.queryByText(/Member leave: Approved leave/i)).not.toBeInTheDocument(),
    );
    expect(await screen.findAllByText('Due open')).not.toHaveLength(0);
  }, 10_000);

  it('uses neutral member copy across the actual grid, aria label, and correction panel', async () => {
    const grid = makeActualGrid();
    server.use(
      http.get('*/admin/kpi/plans/:kpiPlanId/actuals', () =>
        HttpResponse.json({
          data: {
            ...grid,
            rows: [
              {
                ...grid.rows[0],
                memberTalentId: 'talent-private',
                memberDisplayName: null,
                metrics: [
                  {
                    ...grid.rows[0].metrics[0],
                    actualEntryId: 'actual-locked',
                    actualValue: 250000,
                    effectiveValue: 250000,
                    hasEntry: true,
                    editCount: 3,
                    correctionCount: 1,
                    canDirectEdit: false,
                    requiresCorrection: true,
                    disabledReason: 'DIRECT_EDIT_LIMIT_EXCEEDED',
                  },
                ],
              },
            ],
          },
        }),
      ),
    );
    renderRoute('/kpi');
    await openPublishedWorkspacePlan();
    const actualDate = screen.getByLabelText('Actual date');
    await userEvent.clear(actualDate);
    await userEvent.type(actualDate, '16-05-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load grid' }));
    expect(await screen.findByLabelText('Unnamed member Revenue VND actual')).toBeInTheDocument();
    expect(screen.getByText('Unnamed member')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('talent-private');
    expect(screen.queryByLabelText(/talent-private/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Correction' }));
    expect(await screen.findByRole('dialog', { name: 'Edit actual' })).toHaveTextContent(
      'Unnamed member',
    );
    expect(screen.getByRole('dialog', { name: 'Edit actual' })).not.toHaveTextContent(
      'talent-private',
    );
  });

  it('MSW enforces the HCM direct-entry window for grid, create, and direct update', async () => {
    const createPayload = {
      allocationId: 'kpi-plan-published-alloc-1',
      metricCode: 'CONTENT_OUTPUT_COUNT',
      actualDate: '16-05-2026',
      actualValue: 3,
    };

    vi.setSystemTime(new Date('2026-05-15T23:59:59+07:00'));
    expect(
      (await fetchKpiActualDailyGrid('kpi-plan-published', '16-05-2026')).editability,
    ).toMatchObject({ isDirectEditOpen: false, disabledReason: 'DIRECT_EDIT_WINDOW_CLOSED' });
    expect(
      (await mswJson('POST', '/admin/kpi/plans/kpi-plan-published/actuals', createPayload)).status,
    ).toBe(409);

    vi.setSystemTime(new Date('2026-05-16T00:00:00+07:00'));
    expect(
      (await fetchKpiActualDailyGrid('kpi-plan-published', '16-05-2026')).editability,
    ).toMatchObject({ isDirectEditOpen: true, disabledReason: null });
    expect(
      (await mswJson('POST', '/admin/kpi/plans/kpi-plan-published/actuals', createPayload)).ok,
    ).toBe(true);

    vi.setSystemTime(new Date('2026-05-17T10:00:00+07:00'));
    expect(
      (await fetchKpiActualDailyGrid('kpi-plan-published', '16-05-2026')).editability,
    ).toMatchObject({ isDirectEditOpen: true, disabledReason: null });
    expect(
      (
        await mswJson('PATCH', '/admin/kpi/plans/kpi-plan-published/actuals/actual-editable', {
          actualValue: 510000,
        })
      ).ok,
    ).toBe(true);

    vi.setSystemTime(new Date('2026-05-17T10:00:01+07:00'));
    expect(
      (await fetchKpiActualDailyGrid('kpi-plan-published', '16-05-2026')).editability,
    ).toMatchObject({ isDirectEditOpen: false, disabledReason: 'DIRECT_EDIT_WINDOW_CLOSED' });
    expect(
      (
        await mswJson('PATCH', '/admin/kpi/plans/kpi-plan-published/actuals/actual-editable', {
          actualValue: 520000,
        })
      ).status,
    ).toBe(409);
    expect(
      (await mswJson('POST', '/admin/kpi/plans/kpi-plan-published/actuals', createPayload)).status,
    ).toBe(409);

    vi.setSystemTime(new Date('2026-06-01T10:00:00+07:00'));
    expect(
      (await fetchKpiActualDailyGrid('kpi-plan-published', '31-05-2026')).editability,
    ).toMatchObject({ isDirectEditOpen: true, disabledReason: null });
  });

  it('MSW mirrors actual excuse validation, conflicts, and unmark restore', async () => {
    vi.setSystemTime(new Date('2026-05-16T09:00:00+07:00'));
    const basePayload = {
      allocationId: 'kpi-plan-published-alloc-1',
      metricCode: 'CONTENT_OUTPUT_COUNT' as const,
      actualDate: '16-05-2026',
      status: 'EXCUSED' as const,
      reasonCode: 'MEMBER_LEAVE' as const,
      reasonText: 'Approved leave',
    };

    expect(
      (
        await mswJson('POST', '/admin/kpi/plans/kpi-plan-published/actual-excuses', {
          ...basePayload,
          unexpected: true,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await mswJson('POST', '/admin/kpi/plans/kpi-plan-published/actual-excuses', {
          ...basePayload,
          reasonText: '',
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await mswJson('POST', '/admin/kpi/plans/kpi-plan-published/actual-excuses', {
          ...basePayload,
          status: 'WAIVED',
        })
      ).status,
    ).toBe(422);
    await expect(
      markKpiActualExcuse({
        ...basePayload,
        kpiPlanId: 'kpi-plan-published',
        metricCode: 'REVENUE_VND',
      }),
    ).rejects.toThrow(/actual entry already exists/i);

    await markKpiActualExcuse({ ...basePayload, kpiPlanId: 'kpi-plan-published' });
    const excusedGrid = await fetchKpiActualDailyGrid('kpi-plan-published', '16-05-2026');
    const excusedCell = excusedGrid.rows[0].metrics.find(
      (metric) => metric.metricCode === 'CONTENT_OUTPUT_COUNT',
    );
    expect(excusedCell).toMatchObject({
      dailyActualStatus: 'EXCUSED',
      canUnmarkExcused: true,
      actualExcuse: { reasonCode: 'MEMBER_LEAVE' },
    });
    expect(
      (
        await mswJson('POST', '/admin/kpi/plans/kpi-plan-published/actuals', {
          allocationId: 'kpi-plan-published-alloc-1',
          metricCode: 'CONTENT_OUTPUT_COUNT',
          actualDate: '16-05-2026',
          actualValue: 3,
        })
      ).status,
    ).toBe(409);

    await unmarkKpiActualExcuse({
      kpiPlanId: 'kpi-plan-published',
      excuseId: excusedCell?.actualExcuse?.id ?? '',
    });
    const restoredGrid = await fetchKpiActualDailyGrid('kpi-plan-published', '16-05-2026');
    expect(
      restoredGrid.rows[0].metrics.find((metric) => metric.metricCode === 'CONTENT_OUTPUT_COUNT'),
    ).toMatchObject({
      dailyActualStatus: 'DUE_OPEN',
      actualExcuse: null,
      canMarkExcused: true,
    });
  });

  it('uses POST for missing actual cells and PATCH for existing editable cells', async () => {
    let posted = false;
    let patched = false;
    server.use(
      http.post('*/admin/kpi/plans/:kpiPlanId/actuals', () => {
        posted = true;
        return HttpResponse.json({
          data: makeActualEntry('actual-new', 'CONTENT_OUTPUT_COUNT', 3),
        });
      }),
      http.patch('*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId', () => {
        patched = true;
        return HttpResponse.json({
          data: makeActualEntry('actual-editable', 'REVENUE_VND', 510000),
        });
      }),
    );
    renderRoute('/kpi');
    await openPublishedActualGrid();
    const lunaRevenue = await screen.findByLabelText('Luna Park Revenue VND actual');
    await userEvent.clear(lunaRevenue);
    await userEvent.type(lunaRevenue, '510.000');
    const lunaContent = await screen.findByLabelText('Luna Park Content output count actual');
    await userEvent.clear(lunaContent);
    await userEvent.type(lunaContent, '3');
    await userEvent.click(await waitForEnabledButton('Save changed cells'));
    await waitFor(() => expect(posted && patched).toBe(true));
  });

  it('opens correction modal for locked cells and renders history', async () => {
    renderRoute('/kpi');
    await openPublishedActualGrid();
    const minhRevenue = await screen.findByLabelText('Minh Tran Revenue VND actual');
    await userEvent.clear(minhRevenue);
    await userEvent.type(minhRevenue, '300.000');
    await userEvent.click(await waitForEnabledButton('Save changed cells'));
    expect(await screen.findByRole('dialog', { name: 'Edit actual' })).toBeInTheDocument();
    expect(await screen.findByText('Correction history')).toBeInTheDocument();
    expect(await screen.findByText(/Backend approved adjustment/)).toBeInTheDocument();
    expect(screen.queryByText('user-admin')).not.toBeInTheDocument();
    expect(screen.queryByText('talent-002')).not.toBeInTheDocument();
  });

  it('shows duplicate POST conflict message', async () => {
    server.use(
      http.post('*/admin/kpi/plans/:kpiPlanId/actuals', () =>
        HttpResponse.json({ message: 'Duplicate actual with different value' }, { status: 409 }),
      ),
    );
    renderRoute('/kpi');
    await openPublishedActualGrid();
    const lunaContent = await screen.findByLabelText('Luna Park Content output count actual');
    await userEvent.clear(lunaContent);
    await userEvent.type(lunaContent, '3');
    await userEvent.click(await waitForEnabledButton('Save changed cells'));
    expect(await screen.findByText(/duplicate actual with different value/i)).toBeInTheDocument();
  });

  it('requires correction reason and sends numeric corrected value', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(
        '*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId/corrections',
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            data: {
              actualEntry: makeActualEntry('actual-locked', 'REVENUE_VND', 300000),
              correction: makeCorrection(300000),
            },
          });
        },
      ),
    );
    renderRoute('/kpi');
    await openPublishedActualGrid();
    const correctionButtons = await screen.findAllByRole('button', { name: 'Correction' });
    await waitFor(() => expect(correctionButtons.at(-1)).toBeEnabled());
    await userEvent.click(correctionButtons.at(-1)!);
    await userEvent.click(await waitForEnabledButton('Submit correction'));
    expect(await screen.findByText('Correction reason is required.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Correction reason'), 'Operational correction');
    const corrected = screen.getByLabelText('Corrected value');
    await userEvent.clear(corrected);
    await userEvent.type(corrected, '300.000');
    await userEvent.click(await waitForEnabledButton('Submit correction'));
    await waitFor(() => expect(body?.correctedValue).toBe(300000));
    expect(typeof body?.correctedValue).toBe('number');
  }, 10_000);

  it('shows safe direct-edit window copy when correction is submitted before cutoff', async () => {
    renderRoute('/kpi');
    await openPublishedActualGrid();

    const correctionButtons = await screen.findAllByRole('button', { name: 'Correction' });
    await userEvent.click(correctionButtons.at(-1)!);
    await userEvent.type(screen.getByLabelText('Correction reason'), 'Operational correction');
    const corrected = screen.getByLabelText('Corrected value');
    await userEvent.clear(corrected);
    await userEvent.type(corrected, '300.000');
    await userEvent.click(await waitForEnabledButton('Submit correction'));

    expect(await screen.findByText(/Use direct edit before the daily cutoff/i)).toBeInTheDocument();
  });

  it('MSW rejects correction at exact D+1 10:00 HCM and allows post-cutoff correction', async () => {
    vi.setSystemTime(new Date('2026-05-17T10:00:00+07:00'));
    await expect(
      createKpiCorrection({
        kpiPlanId: 'kpi-plan-published',
        actualEntryId: 'actual-locked',
        correctedValue: 300000,
        reason: 'At cutoff',
      }),
    ).rejects.toThrow(/direct edit/i);

    vi.setSystemTime(new Date('2026-05-17T10:00:01+07:00'));
    const result = await createKpiCorrection({
      kpiPlanId: 'kpi-plan-published',
      actualEntryId: 'actual-locked',
      correctedValue: 300000,
      reason: 'After cutoff',
    });

    expect(result.actualEntry.actualValue).toBe(200000);
    expect(result.actualEntry.effectiveValue).toBe(300000);
    expect(result.actualEntry.correctionCount).toBe(2);
    expect(result.correction.previousValue).toBe(250000);
    expect(result.correction.correctedValue).toBe(300000);
    expect('correctedByActorId' in result.correction).toBe(false);
    expect('memberTalentId' in result.correction).toBe(false);
  });

  it('MSW allows repeated post-cutoff corrections and returns safe history DTOs', async () => {
    vi.setSystemTime(new Date('2026-05-17T10:00:01+07:00'));

    await createKpiCorrection({
      kpiPlanId: 'kpi-plan-published',
      actualEntryId: 'actual-locked',
      correctedValue: 300000,
      reason: 'First correction',
    });
    const second = await createKpiCorrection({
      kpiPlanId: 'kpi-plan-published',
      actualEntryId: 'actual-locked',
      correctedValue: 350000,
      reason: 'Second correction',
    });
    const history = await fetchKpiCorrectionHistory('kpi-plan-published', 'actual-locked');

    expect(second.correction.previousValue).toBe(300000);
    expect(second.actualEntry.effectiveValue).toBe(350000);
    expect(second.actualEntry.correctionCount).toBe(3);
    expect(history).toHaveLength(3);
    expect(history.every((item) => !('correctedByActorId' in item))).toBe(true);
    expect(history.every((item) => !('memberTalentId' in item))).toBe(true);
  });

  it('MSW blocks active EXCUSED and NOT_REQUIRED correction until unmarked', async () => {
    vi.setSystemTime(new Date('2026-05-17T10:00:01+07:00'));

    await expect(
      createKpiCorrection({
        kpiPlanId: 'kpi-plan-published',
        actualEntryId: 'actual-excused-conflict',
        correctedValue: 6,
        reason: 'Excused correction',
      }),
    ).rejects.toThrow(/unmark/i);
    await expect(
      createKpiCorrection({
        kpiPlanId: 'kpi-plan-published',
        actualEntryId: 'actual-not-required-conflict',
        correctedValue: 6,
        reason: 'Not required correction',
      }),
    ).rejects.toThrow(/unmark/i);

    await unmarkKpiActualExcuse({
      kpiPlanId: 'kpi-plan-published',
      excuseId: 'actual-excuse-correction-conflict',
    });
    const result = await createKpiCorrection({
      kpiPlanId: 'kpi-plan-published',
      actualEntryId: 'actual-excused-conflict',
      correctedValue: 6,
      reason: 'After unmark',
    });
    expect(result.actualEntry.effectiveValue).toBe(6);
  });

  it('MSW blocks correction and allocation approve/reject after FINALIZED', async () => {
    vi.setSystemTime(new Date('2026-05-17T10:00:01+07:00'));

    await expect(
      createKpiCorrection({
        kpiPlanId: 'kpi-plan-finalized',
        actualEntryId: 'actual-finalized',
        correctedValue: 120000,
        reason: 'Finalized correction',
      }),
    ).rejects.toThrow(/read-only/i);
    await expect(approveKpiAllocation('kpi-plan-finalized', null)).rejects.toThrow(/read-only/i);
    await expect(rejectKpiAllocation('kpi-plan-finalized', 'Cannot approve')).rejects.toThrow(
      /read-only/i,
    );
  });

  it('displays progress over 100 percent', async () => {
    renderRoute('/kpi/plans/kpi-plan-published');
    expect(await screen.findByText('125%')).toBeInTheDocument();
  });

  it('does not expose My KPI as an admin KPI tab', async () => {
    renderRoute('/kpi');
    await waitForKpiList();
    expect(screen.queryByRole('tab', { name: 'My KPI' })).not.toBeInTheDocument();
  });

  it('self-progress API returns no member rows for talent self view', async () => {
    const progress = await fetchMyKpiProgress('kpi-plan-published');
    expect(progress.memberProgress).toEqual([]);
    expect(progress.groupTotals[0].progressPercent).toBe(125);
  });

  it('MSW rejects allocation publish when the allocation predecessor state is not approved', async () => {
    await expect(publishKpiAllocation('kpi-plan-published')).rejects.toThrow();
  });

  it('MSW rejects allocation submit when the allocation predecessor state is not draft', async () => {
    await expect(submitKpiAllocationDraft('kpi-plan-published')).rejects.toThrow();
  });

  it('MSW rejects allocation approve when the allocation predecessor state is not pending approval', async () => {
    await expect(approveKpiAllocation('kpi-plan-published')).rejects.toThrow();
  });

  it('MSW rejects allocation reject when the allocation predecessor state is not pending approval', async () => {
    await expect(rejectKpiAllocation('kpi-plan-published', 'Needs changes')).rejects.toThrow();
  });

  it('MSW rejects invalid nested allocation draft rows and metrics', async () => {
    const plan = await createKpiPlan({
      title: 'Strict allocation draft plan',
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
    });
    await performKpiLifecycleAction(plan.id, 'publish');

    const baseAllocation = {
      employmentProfileId: 'employment-profile-001',
      allocationStartDate: '2026-06-01',
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
    };
    const invalidPayloads = [
      { allocations: [{ ...baseAllocation, scopeGrants: { kpi: ['global'] } }] },
      {
        allocations: [
          {
            ...baseAllocation,
            targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000, extra: true }],
          },
        ],
      },
      { allocations: [baseAllocation, baseAllocation] },
      {
        allocations: [
          {
            ...baseAllocation,
            targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: -1 }],
          },
        ],
      },
      {
        allocations: [
          {
            ...baseAllocation,
            targetMetrics: [{ metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 1.5 }],
          },
        ],
      },
      {
        allocations: [
          {
            ...baseAllocation,
            targetMetrics: [{ metricCode: 'LIVE_HOURS', targetValue: 1.234 }],
          },
        ],
      },
    ];

    for (const payload of invalidPayloads) {
      const response = await mswJson(
        'PUT',
        `/admin/kpi/plans/${plan.id}/allocation-draft`,
        payload,
      );
      expect(response.ok).toBe(false);
      expect([400, 409]).toContain(response.status);
    }
  });

  it('MSW rejects create-plan allocations, TALENT subject create, and past periodMonth', async () => {
    const basePayload = {
      title: 'Invalid create plan',
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
    };

    const allocationResponse = await mswJson('POST', '/admin/kpi/plans', {
      ...basePayload,
      allocations: [],
    });
    expect(allocationResponse.status).toBe(422);

    const talentResponse = await mswJson('POST', '/admin/kpi/plans', {
      ...basePayload,
      subjectType: 'TALENT',
      subjectId: 'talent-001',
    });
    expect(talentResponse.status).toBe(400);

    const pastResponse = await mswJson('POST', '/admin/kpi/plans', {
      ...basePayload,
      periodMonth: '2026-05',
      periodStartAt: may2026PeriodStartAt,
      periodEndAt: may2026PeriodEndAt,
    });
    expect(pastResponse.status).toBe(400);
  });

  it('MSW validates replace allocations and replace target metrics payloads', async () => {
    const invalidTarget = await mswJson('PUT', '/admin/kpi/plans/kpi-plan-draft/target-metrics', {
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000, extra: true }],
    });
    expect(invalidTarget.status).toBe(400);

    const invalidAllocation = await mswJson('PUT', '/admin/kpi/plans/kpi-plan-draft/allocations', {
      allocations: [
        {
          memberTalentId: 'talent-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 100.5 }],
        },
      ],
    });
    expect(invalidAllocation.status).toBe(400);
  });

  it('MSW mirrors TikTok Diamond as TALENT_GROUP count metric and rejects ORG_UNIT Diamond', async () => {
    const diamondPlan = await createKpiPlan({
      title: 'Diamond target plan',
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'TIKTOK_DIAMOND', targetValue: 1000 }],
    });
    expect(diamondPlan.targetMetrics[0]).toMatchObject({
      metricCode: 'TIKTOK_DIAMOND',
      targetValue: 1000,
      unit: 'COUNT',
    });

    await expect(
      replaceKpiTargetMetrics(diamondPlan.id, [
        { metricCode: 'TIKTOK_DIAMOND', targetValue: 1000.5 },
      ]),
    ).rejects.toThrow();

    const orgUnitDiamond = await mswJson('POST', '/admin/kpi/plans', {
      title: 'Org Diamond plan',
      subjectType: 'ORG_UNIT',
      subjectId: 'org-unit-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'TIKTOK_DIAMOND', targetValue: 1000 }],
    });
    expect(orgUnitDiamond.status).toBe(400);

    const orgUnitRevenue = await createKpiPlan({
      title: 'Org Unit revenue plan',
      subjectType: 'ORG_UNIT',
      subjectId: 'org-unit-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 2000000 }],
    });
    expect(orgUnitRevenue.subjectType).toBe('ORG_UNIT');
    expect(orgUnitRevenue.targetMetrics).toHaveLength(1);
    expect(orgUnitRevenue.targetMetrics[0]).toMatchObject({
      metricCode: 'REVENUE_VND',
      unit: 'VND',
    });
    await performKpiLifecycleAction(orgUnitRevenue.id, 'publish');
    expect((await fetchKpiPlanDetail(orgUnitRevenue.id)).status).toBe('PUBLISHED');
  });

  it('MSW returns ORG_UNIT contract-safe route shapes and keeps legacy allocations TalentGroup-only', async () => {
    const orgAllocations = await fetchKpiOrgUnitAllocations('kpi-plan-org-unit');
    expect(orgAllocations[0]).toMatchObject({
      memberEmploymentProfileId: 'employment-profile-ops-001',
      memberTalentId: null,
      groupId: null,
    });
    expect(JSON.stringify(orgAllocations)).not.toContain('membershipId');

    const legacyAllocations = await parseKpiAllocationListResponseForTest(
      await readMswJson(await mswJson('GET', '/admin/kpi/allocations')),
    );
    expect(
      legacyAllocations.every((allocation) => allocation.groupId && allocation.memberTalentId),
    ).toBe(true);
    expect(
      legacyAllocations.some((allocation) => allocation.kpiPlanId === 'kpi-plan-org-unit'),
    ).toBe(false);

    const members = await fetchKpiOrgUnitManagedMembers('kpi-plan-org-unit');
    expect(members[0]).toMatchObject({
      employmentProfileId: 'employment-profile-ops-001',
      displayName: 'An Nguyen',
      orgUnitId: 'org-unit-001',
    });
    expect(JSON.stringify(members)).not.toContain('talentId');

    const progress = await fetchKpiOrgUnitProgress('kpi-plan-org-unit');
    expect(progress.memberProgress[0]).toMatchObject({
      memberEmploymentProfileId: 'employment-profile-ops-001',
      memberTalentId: null,
    });

    const grid = await fetchKpiOrgUnitActualGrid('kpi-plan-org-unit', '01-06-2026');
    expect(grid.subjectType).toBe('ORG_UNIT');
    expect(grid.rows[0]).toMatchObject({
      memberEmploymentProfileId: 'employment-profile-ops-001',
      memberTalentId: null,
    });

    const actual = await createKpiOrgUnitActual({
      kpiPlanId: 'kpi-plan-org-unit',
      allocationId: 'kpi-plan-org-unit-alloc-1',
      metricCode: 'REVENUE_VND',
      actualDate: '01-06-2026',
      actualValue: 500000,
    });
    expect(actual.memberEmploymentProfileId).toBe('employment-profile-ops-001');
    const correction = await createKpiOrgUnitCorrection({
      kpiPlanId: 'kpi-plan-org-unit',
      actualEntryId: actual.id,
      correctedValue: 550000,
      reason: 'Ops correction',
    });
    expect(correction.actualEntry.memberEmploymentProfileId).toBe('employment-profile-ops-001');
    expect(await fetchKpiOrgUnitCorrectionHistory('kpi-plan-org-unit', actual.id)).toHaveLength(1);

    await markKpiOrgUnitActualExcuse({
      kpiPlanId: 'kpi-plan-org-unit',
      allocationId: 'kpi-plan-org-unit-alloc-1',
      metricCode: 'REVENUE_VND',
      actualDate: '02-06-2026',
      status: 'EXCUSED',
      reasonCode: 'OTHER',
      reasonText: 'Contract test',
    });
    const excusedGrid = await fetchKpiOrgUnitActualGrid('kpi-plan-org-unit', '02-06-2026');
    const excuseId = excusedGrid.rows[0]?.metrics[0]?.actualExcuse?.id;
    expect(excuseId).toBeTruthy();
    await unmarkKpiOrgUnitActualExcuse({
      kpiPlanId: 'kpi-plan-org-unit',
      excuseId: excuseId ?? '',
    });

    await expect(fetchKpiOrgUnitFinalResult('kpi-plan-org-unit')).rejects.toThrow(/FINALIZED/);
    await expect(fetchKpiOrgUnitFinalResult('kpi-plan-published')).rejects.toThrow(/ORG_UNIT/);

    const finalResult = await fetchKpiOrgUnitFinalResult('kpi-plan-org-unit-finalized');
    expect(finalResult.subjectType).toBe('ORG_UNIT');
    expect(finalResult.status).toBe('FINALIZED');
    expect(finalResult.finalResult?.members[0]?.memberDisplayName).toBe('An Nguyen');
    expect(finalResult.allocations).toHaveLength(0);
  });

  it('MSW supports ORG_UNIT allocation draft lifecycle without leaking into legacy allocations', async () => {
    const plan = await createKpiPlan({
      title: 'Org Unit allocation lifecycle plan',
      subjectType: 'ORG_UNIT',
      subjectId: 'org-unit-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 2000000 }],
    });
    await performKpiLifecycleAction(plan.id, 'publish');
    await upsertKpiAllocationDraft(plan.id, [
      {
        employmentProfileId: 'employment-profile-ops-001',
        allocationStartDate: '2026-06-01',
        allocationEndDate: null,
        targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 2000000 }],
        note: 'Scoped Org Unit allocation',
      },
    ]);
    expect((await fetchKpiOrgUnitAllocations(plan.id))[0]).toMatchObject({
      allocationStatus: 'DRAFT',
      memberEmploymentProfileId: 'employment-profile-ops-001',
      memberTalentId: null,
      groupId: null,
    });

    await submitKpiAllocationDraft(plan.id);
    expect((await fetchKpiOrgUnitAllocations(plan.id))[0]?.allocationStatus).toBe(
      'PENDING_APPROVAL',
    );
    await approveKpiAllocation(plan.id, 'Approved');
    expect((await fetchKpiOrgUnitAllocations(plan.id))[0]?.allocationStatus).toBe('APPROVED');
    await publishKpiAllocation(plan.id);
    expect((await fetchKpiOrgUnitAllocations(plan.id))[0]?.allocationStatus).toBe('PUBLISHED');

    const legacyAllocations = await parseKpiAllocationListResponseForTest(
      await readMswJson(await mswJson('GET', `/admin/kpi/allocations?kpiPlanId=${plan.id}`)),
    );
    expect(legacyAllocations).toHaveLength(0);
    const invalidPlan = await createKpiPlan({
      title: 'Org Unit invalid allocation plan',
      subjectType: 'ORG_UNIT',
      subjectId: 'org-unit-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 2000000 }],
    });
    await performKpiLifecycleAction(invalidPlan.id, 'publish');
    await expect(
      upsertKpiAllocationDraft(invalidPlan.id, [
        {
          employmentProfileId: 'employment-profile-001',
          allocationStartDate: '2026-06-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 2000000 }],
        },
      ]),
    ).rejects.toThrow(/active managed member/);
  });

  it('MSW rejects allocation publish when allocation totals do not match plan targets', async () => {
    const plan = await createKpiPlan({
      title: 'Mismatched allocation total plan',
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
      periodMonth: '2026-06',
      periodStartAt: june2026PeriodStartAt,
      periodEndAt: june2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
    });
    await performKpiLifecycleAction(plan.id, 'publish');
    await upsertKpiAllocationDraft(plan.id, [
      {
        employmentProfileId: 'employment-profile-001',
        allocationStartDate: '2026-06-01',
        targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 900 }],
      },
    ]);
    await submitKpiAllocationDraft(plan.id);
    await approveKpiAllocation(plan.id);

    await expect(publishKpiAllocation(plan.id)).rejects.toThrow();
  });

  it('MSW rejects invalid KPI query values and actual dates', async () => {
    await expect(fetchKpiPlans({ status: 'BROKEN' } as never)).rejects.toThrow();
    await expect(fetchKpiPlans({ periodMonth: '2026-13' } as never)).rejects.toThrow();
    await expect(fetchKpiPlans({ limit: 101 })).rejects.toThrow();
    await expect(fetchKpiActualDailyGrid('kpi-plan-published', '31-02-2026')).rejects.toThrow();
    await expect(fetchKpiActualDailyGrid('kpi-plan-published', '01-06-2026')).rejects.toThrow();
    expect((await fetchKpiActualDailyGrid('kpi-plan-published', '16-05-2026')).policy).toEqual({
      timezone: 'Asia/Ho_Chi_Minh',
      entryOpenLocalTime: '00:00',
      entryLockLocalTime: '10:00',
      maxDirectEditsPerEntry: 3,
      correctionAllowedUntil: 'PLAN_FINALIZED',
    });
  });

  it('frontend KPI Zod rejects backend-invalid target metric semantics', async () => {
    expect(
      sanitizeKpiCreatePlanPayload({
        title: 'Diamond create',
        subjectType: 'TALENT_GROUP',
        subjectId: 'group-001',
        periodMonth: '2026-06',
        periodStartAt: june2026PeriodStartAt,
        periodEndAt: june2026PeriodEndAt,
        targetMetrics: [{ metricCode: 'TIKTOK_DIAMOND', targetValue: 1000 }],
      }).targetMetrics[0]?.metricCode,
    ).toBe('TIKTOK_DIAMOND');
    expect(
      sanitizeKpiCreatePlanPayload({
        title: 'Org revenue create',
        subjectType: 'ORG_UNIT',
        subjectId: 'org-unit-001',
        periodMonth: '2026-06',
        periodStartAt: june2026PeriodStartAt,
        periodEndAt: june2026PeriodEndAt,
        targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
      }).subjectType,
    ).toBe('ORG_UNIT');
    expect(() =>
      sanitizeKpiCreatePlanPayload({
        title: 'Org Diamond create',
        subjectType: 'ORG_UNIT',
        subjectId: 'org-unit-001',
        periodMonth: '2026-06',
        periodStartAt: june2026PeriodStartAt,
        periodEndAt: june2026PeriodEndAt,
        targetMetrics: [{ metricCode: 'TIKTOK_DIAMOND', targetValue: 1000 }],
      }),
    ).toThrow();
    expect(() =>
      sanitizeKpiCreatePlanPayload({
        title: 'Unknown metric create',
        subjectType: 'TALENT_GROUP',
        subjectId: 'group-001',
        periodMonth: '2026-06',
        periodStartAt: june2026PeriodStartAt,
        periodEndAt: june2026PeriodEndAt,
        targetMetrics: [{ metricCode: 'UNKNOWN_METRIC', targetValue: 1000 }],
      } as never),
    ).toThrow();
    expect(() =>
      sanitizeKpiCreatePlanPayload({
        title: 'Talent create',
        subjectType: 'TALENT',
        subjectId: 'talent-001',
        periodMonth: '2026-06',
        periodStartAt: june2026PeriodStartAt,
        periodEndAt: june2026PeriodEndAt,
        targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
      } as never),
    ).toThrow();
    expect(() =>
      sanitizeKpiCreatePlanPayload({
        title: 'Allocation create',
        subjectType: 'TALENT_GROUP',
        subjectId: 'group-001',
        periodMonth: '2026-06',
        periodStartAt: june2026PeriodStartAt,
        periodEndAt: june2026PeriodEndAt,
        targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
        allocations: [],
      } as never),
    ).toThrow();
    expect(() =>
      sanitizeKpiCreatePlanPayload({
        title: 'Past create',
        subjectType: 'TALENT_GROUP',
        subjectId: 'group-001',
        periodMonth: '2026-05',
        periodStartAt: may2026PeriodStartAt,
        periodEndAt: may2026PeriodEndAt,
        targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
      }),
    ).toThrow();
    await expect(
      replaceKpiTargetMetrics('kpi-plan-draft', [{ metricCode: 'REVENUE_VND', targetValue: -1 }]),
    ).rejects.toThrow();
    await expect(
      replaceKpiTargetMetrics('kpi-plan-draft', [
        { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 1.5 },
      ]),
    ).rejects.toThrow();
    await expect(
      replaceKpiTargetMetrics('kpi-plan-draft', [{ metricCode: 'LIVE_HOURS', targetValue: 1.234 }]),
    ).rejects.toThrow();
    await expect(
      replaceKpiTargetMetrics('kpi-plan-draft', [
        { metricCode: 'REVENUE_VND', targetValue: 1000 },
        { metricCode: 'REVENUE_VND', targetValue: 1000 },
      ]),
    ).rejects.toThrow();
    await expect(
      replaceKpiAllocations('kpi-plan-draft', [
        {
          memberTalentId: 'talent-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
        },
        {
          memberTalentId: 'talent-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
        },
      ]),
    ).rejects.toThrow();
    await expect(
      upsertKpiAllocationDraft('kpi-plan-published', [
        {
          employmentProfileId: 'employment-profile-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
        },
        {
          employmentProfileId: 'employment-profile-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
        },
      ]),
    ).rejects.toThrow();
  });

  it('hides global KPI lifecycle action when global KPI scope is missing', async () => {
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: ['kpi.read', 'kpi.finalize'],
            scopeGrants: { kpi: ['managedGroup'] },
          },
        }),
      ),
    );
    renderRoute('/kpi/plans/kpi-plan-published');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Finalize' })).not.toBeInTheDocument(),
    );
  });

  it('fails closed without create action when capability data is unavailable', async () => {
    let called = false;
    mockKpiCapabilities({ status: 500 });
    server.use(
      http.post('*/admin/kpi/plans', () => {
        called = true;
        return HttpResponse.json({ data: makeDetail('kpi-plan-denied', 'DRAFT') });
      }),
    );

    renderRoute('/kpi');
    await screen.findByText('Access denied');
    expect(screen.queryByRole('button', { name: 'Create KPI plan' })).not.toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('hides create action without kpi.createPlan', async () => {
    let called = false;
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.enterActual', 'kpi.correctActual'],
      scopeGrants: { kpi: ['global'] },
    });
    server.use(
      http.post('*/admin/kpi/plans', () => {
        called = true;
        return HttpResponse.json({ data: makeDetail('kpi-plan-denied', 'DRAFT') });
      }),
    );

    renderRoute('/kpi');
    await waitForKpiList();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Create KPI plan' })).not.toBeInTheDocument(),
    );
    expect(called).toBe(false);
  });

  it('hides actual save and does not POST or PATCH without kpi.enterActual', async () => {
    let posted = false;
    let patched = false;
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.createPlan', 'kpi.correctActual'],
      scopeGrants: { kpi: ['global'] },
    });
    server.use(
      http.post('*/admin/kpi/plans/:kpiPlanId/actuals', () => {
        posted = true;
        return HttpResponse.json({
          data: makeActualEntry('actual-new', 'CONTENT_OUTPUT_COUNT', 3),
        });
      }),
      http.patch('*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId', () => {
        patched = true;
        return HttpResponse.json({
          data: makeActualEntry('actual-editable', 'REVENUE_VND', 510000),
        });
      }),
    );

    renderRoute('/kpi');
    await openPublishedActualGrid();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save changed cells' })).not.toBeInTheDocument(),
    );
    expect(posted).toBe(false);
    expect(patched).toBe(false);
  });

  it('hides correction action and does not call correction API without kpi.correctActual', async () => {
    let called = false;
    mockKpiCapabilities({
      permissions: ['kpi.read', 'kpi.createPlan', 'kpi.enterActual'],
      scopeGrants: { kpi: ['global'] },
    });
    server.use(
      http.post('*/admin/kpi/plans/:kpiPlanId/actuals/:actualEntryId/corrections', () => {
        called = true;
        return HttpResponse.json({
          data: {
            actualEntry: makeActualEntry('actual-locked', 'REVENUE_VND', 300000),
            correction: makeCorrection(300000),
          },
        });
      }),
    );

    renderRoute('/kpi');
    await openPublishedActualGrid();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Correction' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('dialog', { name: 'Edit actual' })).not.toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('KPI money actions fail closed on loading, error, missing data, missing permission, and missing scope', () => {
    expect(
      createKpiActionCapabilityHint(
        { capabilities: undefined, isLoading: true, isError: false },
        'createPlan',
        kpiCapabilityCopy,
      ),
    ).toEqual({ allowed: false, disabled: true, disabledReason: 'Checking permissions.' });
    expect(
      createKpiActionCapabilityHint(
        { capabilities: undefined, isLoading: false, isError: true },
        'enterActual',
        kpiCapabilityCopy,
      ),
    ).toEqual({
      allowed: false,
      disabled: true,
      disabledReason: 'KPI permissions could not be verified. Try again.',
    });
    expect(
      createKpiActionCapabilityHint(
        { capabilities: undefined, isLoading: false, isError: false },
        'correctActual',
        kpiCapabilityCopy,
      ),
    ).toEqual({
      allowed: false,
      disabled: true,
      disabledReason: 'KPI permissions could not be verified. Try again.',
    });
    expect(
      createKpiActionCapabilityHint(
        {
          capabilities: makeCapabilities({ permissions: [], scopeGrants: { kpi: ['global'] } }),
          isLoading: false,
          isError: false,
        },
        'createPlan',
        kpiCapabilityCopy,
      ),
    ).toEqual({
      allowed: false,
      disabled: true,
      disabledReason: 'You do not have permission to perform this action.',
      hidden: true,
    });
    expect(
      createKpiActionCapabilityHint(
        {
          capabilities: makeCapabilities({ permissions: ['kpi.enterActual'], scopeGrants: {} }),
          isLoading: false,
          isError: false,
        },
        'enterActual',
        kpiCapabilityCopy,
      ),
    ).toEqual({
      allowed: false,
      disabled: true,
      disabledReason: 'Your role assignment does not include the required scope.',
      hidden: true,
    });
  });

  it('enables KPI money actions when the required permission and scope are present', () => {
    expect(
      createKpiActionCapabilityHint(
        {
          capabilities: makeCapabilities({
            permissions: ['kpi.correctActual'],
            scopeGrants: { kpi: ['global'] },
          }),
          isLoading: false,
          isError: false,
        },
        'correctActual',
        kpiCapabilityCopy,
      ),
    ).toEqual({ allowed: true, disabled: false });
    expect(
      createKpiActionCapabilityHint(
        {
          capabilities: makeCapabilities({
            permissions: ['kpi.enterActual'],
            scopeGrants: { kpi: ['managedGroup'] },
          }),
          isLoading: false,
          isError: false,
        },
        'enterActual',
        kpiCapabilityCopy,
      ),
    ).toEqual({ allowed: true, disabled: false });
    expect(
      createKpiActionCapabilityHint(
        {
          capabilities: makeCapabilities({
            permissions: ['kpi.createPlan'],
            scopeGrants: { kpi: ['managedGroup'] },
          }),
          isLoading: false,
          isError: false,
        },
        'createPlan',
        kpiCapabilityCopy,
      ),
    ).toEqual({
      allowed: false,
      disabled: true,
      disabledReason: 'Your role assignment does not include the required scope.',
      hidden: true,
    });
    expect(
      createKpiActionCapabilityHint(
        {
          capabilities: makeCapabilities({
            permissions: ['kpi.enterActual'],
            scopeGrants: { kpi: ['self'] },
          }),
          isLoading: false,
          isError: false,
        },
        'enterActual',
        kpiCapabilityCopy,
      ),
    ).toEqual({
      allowed: false,
      disabled: true,
      disabledReason: 'Your role assignment does not include the required scope.',
      hidden: true,
    });
  });

  it('strict API schema accepts allocation workflow summary and rejects unexpected fields', () => {
    expect(
      parseKpiPlanListResponseForTest({
        data: [makeListPlan('kpi-plan-x', 'Strict summary KPI', 'group-001')],
      })[0].allocationWorkflowSummary.officialPublishedCount,
    ).toBe(1);
    expect(() =>
      parseKpiPlanListResponseForTest({
        data: [
          { ...makeListPlan('kpi-plan-x', 'Strict summary KPI', 'group-001'), unexpected: true },
        ],
      }),
    ).toThrow();
  });

  it('strict Actual Workspace detail schema rejects raw member identifiers', () => {
    const detail = makeActualWorkspaceDetail();
    expect(
      parseKpiActualWorkspacePlanDetailResponseForTest({ data: detail }).members[0],
    ).toMatchObject({
      allocationId: 'kpi-plan-published-alloc-1',
      memberDisplayName: 'Luna Park',
    });
    expect(() =>
      parseKpiActualWorkspacePlanDetailResponseForTest({
        data: {
          ...detail,
          members: [{ ...detail.members[0], memberTalentId: 'talent-001' }],
        },
      }),
    ).toThrow();
    expect(() =>
      parseKpiActualWorkspacePlanDetailResponseForTest({
        data: {
          ...detail,
          members: [{ ...detail.members[0], memberEmploymentProfileId: 'employment-profile-001' }],
        },
      }),
    ).toThrow();
  });

  it('strict finalized result schemas accept safe snapshots and reject forbidden fields', () => {
    const finalResult = makeFinalResultSnapshot();
    expect(
      parseKpiPlanDetailResponseForTest({
        data: { ...makeDetail('kpi-plan-finalized', 'FINALIZED'), finalResult },
      }).finalResult,
    ).toMatchObject({ snapshotVersion: 1, finalizedAt: 2 });
    expect(
      parseKpiActualWorkspacePlanDetailResponseForTest({
        data: { ...makeActualWorkspaceDetail(), planStatus: 'FINALIZED', finalResult },
      }).finalResult,
    ).toMatchObject({ snapshotVersion: 1, members: [{ memberDisplayName: 'Luna Park' }] });

    for (const forbidden of [
      'finalScore',
      'rank',
      'payroll',
      'payout',
      'settlement',
      'commission',
      'accounting',
      'tax',
      'ERP',
      'finalizedByActorId',
    ]) {
      expect(() =>
        parseKpiPlanDetailResponseForTest({
          data: {
            ...makeDetail('kpi-plan-finalized', 'FINALIZED'),
            finalResult: { ...finalResult, [forbidden]: 'forbidden' },
          },
        }),
      ).toThrow();
    }
    for (const forbidden of ['memberTalentId', 'memberEmploymentProfileId']) {
      expect(() =>
        parseKpiPlanDetailResponseForTest({
          data: {
            ...makeDetail('kpi-plan-finalized', 'FINALIZED'),
            finalResult: {
              ...finalResult,
              members: [{ ...finalResult.members[0], [forbidden]: 'forbidden' }],
            },
          },
        }),
      ).toThrow();
    }
  });

  it('strict correction DTO schema accepts backend-safe exposure and rejects raw IDs', () => {
    const correction = makeCorrection(300000);

    expect(parseKpiCorrectionListResponseForTest({ data: [correction] })[0]).toMatchObject({
      id: 'correction-test',
      actualEntryId: 'actual-locked',
      correctedValue: 300000,
      reason: 'Operational correction',
    });
    expect(
      parseKpiCorrectionMutationResponseForTest({
        data: {
          actualEntry: makeActualEntry('actual-locked', 'REVENUE_VND', 300000),
          correction,
        },
      }).correction.correctedValue,
    ).toBe(300000);
    expect(() =>
      parseKpiCorrectionListResponseForTest({
        data: [{ ...correction, correctedByActorId: 'user-admin' }],
      }),
    ).toThrow();
    expect(() =>
      parseKpiCorrectionListResponseForTest({
        data: [{ ...correction, memberTalentId: 'talent-002' }],
      }),
    ).toThrow();
    expect(() =>
      parseKpiCorrectionListResponseForTest({
        data: [{ ...correction, memberEmploymentProfileId: 'employment-profile-002' }],
      }),
    ).toThrow();
  });

  it('strict API schema accepts actual status and excuse DTOs and rejects invalid status values', () => {
    const grid = makeActualStatusGrid();
    expect(parseKpiActualDailyGridResponseForTest({ data: grid }).rows[1].metrics[0]).toMatchObject(
      {
        dailyActualStatus: 'EXCUSED',
        actualExcuse: {
          id: 'excuse-ui',
          reasonCode: 'MEMBER_LEAVE',
          reasonText: 'Approved leave',
        },
        canUnmarkExcused: true,
      },
    );
    expect(
      parseKpiActualWorkspacePlanListResponseForTest({
        data: [makeActualWorkspaceSummary()],
      }).data[0].actualEntryStatusSummary.excusedEntryCount,
    ).toBe(1);
    expect(() =>
      parseKpiActualDailyGridResponseForTest({
        data: {
          ...grid,
          rows: [
            {
              ...grid.rows[0],
              metrics: [{ ...grid.rows[0].metrics[0], dailyActualStatus: 'MISSING' }],
            },
          ],
        },
      }),
    ).toThrow();
    expect(() =>
      parseKpiActualDailyGridResponseForTest({
        data: {
          ...grid,
          rows: [
            {
              ...grid.rows[1],
              metrics: [
                {
                  ...grid.rows[1].metrics[0],
                  actualExcuse: {
                    id: 'invalid-excuse',
                    status: 'WAIVED',
                    reasonCode: 'MEMBER_LEAVE',
                    reasonText: 'Approved leave',
                    createdAt: 1,
                    createdByActorId: 'user-admin',
                    updatedAt: 1,
                    updatedByActorId: 'user-admin',
                  },
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('strict allocation draft payload rejects direct Talent and scope grants', () => {
    expect(() =>
      parseKpiAllocationDraftPayloadForTest({
        allocations: [
          {
            employmentProfileId: 'employment-profile-001',
            memberTalentId: 'talent-001',
            allocationStartDate: '2026-05-01',
            targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000000 }],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseKpiAllocationDraftPayloadForTest({
        allocations: [
          {
            employmentProfileId: 'employment-profile-001',
            allocationStartDate: '2026-05-01',
            targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000000 }],
            scopeGrants: { kpi: ['global'] },
          },
        ],
      }),
    ).toThrow();
  });

  it('strict allocation draft payload rejects empty or non-contract start dates', () => {
    for (const allocationStartDate of ['', '01-05-2026']) {
      expect(() =>
        parseKpiAllocationDraftPayloadForTest({
          allocations: [
            {
              employmentProfileId: 'employment-profile-001',
              allocationStartDate,
              targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000000 }],
            },
          ],
        }),
      ).toThrow();
    }
  });

  it('strict allocation list schema accepts approval audit fields and rejects unknown fields', () => {
    expect(
      parseKpiAllocationListResponseForTest({
        data: [makeAllocation('kpi-plan-approved', 'APPROVED')],
      })[0].allocationStatus,
    ).toBe('APPROVED');
    expect(() =>
      parseKpiAllocationListResponseForTest({
        data: [{ ...makeAllocation('kpi-plan-approved', 'APPROVED'), scopeGrants: {} }],
      }),
    ).toThrow();
  });

  it('strict ORG_UNIT schemas parse EmploymentProfile identity without Talent identity', () => {
    const { membershipId: _membershipId, ...baseOrgAllocation } = makeAllocation(
      'kpi-plan-org-unit-schema',
      'PUBLISHED',
    );
    void _membershipId;
    const orgAllocation = {
      ...baseOrgAllocation,
      groupId: null,
      memberEmploymentProfileId: 'employment-profile-ops-001',
      memberTalentId: null,
    };
    const parsedAllocation = parseKpiOrgUnitAllocationListResponseForTest({
      data: [orgAllocation],
    })[0];
    expect(parsedAllocation.memberEmploymentProfileId).toBe('employment-profile-ops-001');
    expect(parsedAllocation.memberTalentId).toBeNull();
    expect(() =>
      parseKpiAllocationListResponseForTest({
        data: [orgAllocation],
      }),
    ).toThrow();

    expect(
      parseKpiOrgUnitManagedMemberListResponseForTest({
        data: [
          {
            employmentProfileId: 'employment-profile-ops-001',
            employeeCode: 'EP-OPS-001',
            displayName: 'An Nguyen',
            orgUnitId: 'org-unit-001',
          },
        ],
      })[0],
    ).not.toHaveProperty('talentId');

    expect(
      parseKpiOrgUnitProgressResponseForTest({
        data: {
          ...makeProgress('kpi-plan-org-unit-schema', []),
          plan: {
            ...makeProgress('kpi-plan-org-unit-schema', []).plan,
            subjectType: 'ORG_UNIT',
            subjectId: 'org-unit-001',
          },
          memberProgress: [
            {
              allocationId: 'org-allocation-1',
              memberEmploymentProfileId: 'employment-profile-ops-001',
              memberTalentId: null,
              metricCode: 'REVENUE_VND',
              targetValue: 1000,
              actualValue: 100,
              progressPercent: 10,
              actualEntryCount: 1,
              missingEntryCount: 0,
            },
          ],
        },
      }).memberProgress[0].memberEmploymentProfileId,
    ).toBe('employment-profile-ops-001');

    expect(
      parseKpiOrgUnitActualGridResponseForTest({
        data: {
          ...makeActualGrid(),
          subjectType: 'ORG_UNIT',
          subjectId: 'org-unit-001',
          rows: [
            {
              ...makeActualGrid().rows[0],
              memberEmploymentProfileId: 'employment-profile-ops-001',
              memberTalentId: null,
            },
          ],
        },
      }).rows[0].memberEmploymentProfileId,
    ).toBe('employment-profile-ops-001');
  });

  it('money parser never returns formatted strings', () => {
    expect(parseKpiMoneyInput('1.000.000')).toBe(1000000);
    expect(parseKpiMoneyInput('1.00.000')).toBeUndefined();
  });
});

const makeCapabilities = (
  overrides: Partial<CurrentActorCapabilities> = {},
): CurrentActorCapabilities => ({
  id: 'kpi-capability-test-user',
  type: 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: ['role-kpi-capability-test'],
  permissions: ['kpi.createPlan', 'kpi.enterActual', 'kpi.correctActual'],
  scopeGrants: { kpi: ['global'] },
  generatedAt: '2026-05-22T00:00:00.000Z',
  ...overrides,
});

const makeDetail = (id: string, status: 'DRAFT' | 'PUBLISHED' | 'FINALIZED' | 'ARCHIVED') => ({
  id,
  planCode: 'KPI-202605-000002',
  title: 'Published team KPI',
  description: null,
  subjectType: 'TALENT_GROUP',
  subjectId: 'group-001',
  subjectRef: null,
  status,
  currencyCode: 'VND',
  periodMonth: '2026-05',
  periodStartAt: may2026PeriodStartAt,
  periodEndAt: may2026PeriodEndAt,
  timezone: 'Asia/Ho_Chi_Minh',
  actualPolicySnapshot: null,
  publishedAt: 1,
  publishedByActorId: 'user-admin',
  finalizedAt: status === 'FINALIZED' ? 2 : null,
  finalizedByActorId: status === 'FINALIZED' ? 'user-admin' : null,
  archivedAt: null,
  archivedByActorId: null,
  createdAt: 1,
  createdByActorId: 'user-admin',
  updatedAt: 1,
  updatedByActorId: 'user-admin',
  externalRef: null,
  targetMetrics: [
    {
      id: `${id}-metric-revenue`,
      kpiPlanId: id,
      metricCode: 'REVENUE_VND',
      targetValue: 1000000,
      unit: 'VND',
      rollupMethod: 'SUM',
      actualSource: 'MANUAL',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  allocations: [],
});

const makeDetailWithAllocation = (
  id: string,
  status: 'DRAFT' | 'PUBLISHED' | 'FINALIZED' | 'ARCHIVED',
  allocationStatus:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'PUBLISHED'
    | 'REJECTED'
    | 'ACTIVE'
    | 'CLOSED'
    | 'CANCELLED',
) => ({
  ...makeDetail(id, status),
  allocations: [makeAllocation(id, allocationStatus)],
});

const makeAllocation = (
  kpiPlanId: string,
  allocationStatus:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'PUBLISHED'
    | 'REJECTED'
    | 'ACTIVE'
    | 'CLOSED'
    | 'CANCELLED',
) => ({
  id: `${kpiPlanId}-alloc-1`,
  kpiPlanId,
  groupId: 'group-001',
  memberEmploymentProfileId: 'employment-profile-001',
  memberTalentId: 'talent-001',
  membershipId: null,
  allocationStatus,
  allocationStartDate: '2026-05-01',
  allocationEndDate: null,
  targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000000 }],
  snapshotMemberDisplayName: 'Luna Park',
  note: null,
  createdAt: 1,
  createdByActorId: 'manager-user',
  updatedAt: 1,
  updatedByActorId: 'manager-user',
  submittedAt: allocationStatus === 'DRAFT' ? null : 1,
  submittedByActorId: allocationStatus === 'DRAFT' ? null : 'manager-user',
  approvedAt: ['APPROVED', 'PUBLISHED'].includes(allocationStatus) ? 1 : null,
  approvedByActorId: ['APPROVED', 'PUBLISHED'].includes(allocationStatus) ? 'user-admin' : null,
  approvalNote: null,
  rejectedAt: allocationStatus === 'REJECTED' ? 1 : null,
  rejectedByActorId: allocationStatus === 'REJECTED' ? 'user-admin' : null,
  rejectionReason: allocationStatus === 'REJECTED' ? 'Needs revision' : null,
  publishedAt: allocationStatus === 'PUBLISHED' ? 1 : null,
  publishedByActorId: allocationStatus === 'PUBLISHED' ? 'user-admin' : null,
  closedAt: null,
});

const makeProgress = (id: string, memberProgress: unknown[]) => ({
  plan: {
    id,
    planCode: 'KPI-202605-000002',
    subjectType: 'TALENT_GROUP',
    subjectId: 'group-001',
    status: 'PUBLISHED',
    periodMonth: '2026-05',
    periodStartAt: may2026PeriodStartAt,
    periodEndAt: may2026PeriodEndAt,
    timezone: 'Asia/Ho_Chi_Minh',
  },
  periodElapsedPercent: 80,
  targetMetrics: [
    {
      id: `${id}-metric-revenue`,
      kpiPlanId: id,
      metricCode: 'REVENUE_VND',
      targetValue: 1000000,
      unit: 'VND',
      rollupMethod: 'SUM',
      actualSource: 'MANUAL',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  groupTotals: [
    { metricCode: 'REVENUE_VND', targetValue: 1000000, actualValue: 0, progressPercent: 0 },
  ],
  memberProgress,
});

type TestAllocationWorkflowSummary = {
  total: number;
  byStatus: {
    draft: number;
    pendingApproval: number;
    approved: number;
    published: number;
    rejected: number;
    active: number;
    closed: number;
    cancelled: number;
  };
  hasDraft: boolean;
  hasPendingApproval: boolean;
  hasApproved: boolean;
  hasPublished: boolean;
  hasRejected: boolean;
  hasLegacyActive: boolean;
  officialPublishedCount: number;
};

const makeAllocationWorkflowSummary = (
  overrides: {
    byStatus?: Partial<TestAllocationWorkflowSummary['byStatus']>;
  } = {},
): TestAllocationWorkflowSummary => {
  const byStatus = {
    draft: 0,
    pendingApproval: 0,
    approved: 0,
    published: 0,
    rejected: 0,
    active: 0,
    closed: 0,
    cancelled: 0,
    ...overrides.byStatus,
  };

  return {
    total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    byStatus,
    hasDraft: byStatus.draft > 0,
    hasPendingApproval: byStatus.pendingApproval > 0,
    hasApproved: byStatus.approved > 0,
    hasPublished: byStatus.published > 0,
    hasRejected: byStatus.rejected > 0,
    hasLegacyActive: byStatus.active > 0,
    officialPublishedCount: byStatus.published,
  };
};

const makeActualEntryStatusSummary = (
  overrides: Partial<{
    expectedEntryCount: number;
    enteredEntryCount: number;
    enteredZeroCount: number;
    pendingEntryCount: number;
    overdueEntryCount: number;
    excusedEntryCount: number;
    notRequiredEntryCount: number;
    notDueEntryCount: number;
  }> = {},
) => ({
  expectedEntryCount: 6,
  enteredEntryCount: 2,
  enteredZeroCount: 1,
  pendingEntryCount: 1,
  overdueEntryCount: 0,
  excusedEntryCount: 1,
  notRequiredEntryCount: 0,
  notDueEntryCount: 1,
  ...overrides,
});

const makeFinalResultSnapshot = () => ({
  snapshotVersion: 1,
  planId: 'kpi-plan-finalized',
  planCode: 'KPI-202604-000003',
  periodMonth: '2026-04',
  subjectType: 'TALENT_GROUP',
  subjectId: 'group-001',
  finalizedAt: 2,
  revenue: {
    metricCode: 'REVENUE_VND',
    planTargetValue: 1000000,
    operationalTargetValue: 1000000,
    actualValue: 850000,
    achievementPercent: 85,
    targetMismatch: false,
  },
  allocationCoverage: {
    publishedAllocationCount: 2,
    totalAllocationCount: 2,
    isAllExistingAllocationsPublished: true,
  },
  actualEntryStatusSummary: makeActualEntryStatusSummary(),
  supportingMetrics: [
    {
      metricCode: 'CONTENT_OUTPUT_COUNT',
      targetValue: 10,
      actualValue: 8,
      achievementPercent: 80,
    },
    {
      metricCode: 'TIKTOK_DIAMOND',
      targetValue: 1000,
      actualValue: 840,
      achievementPercent: 84,
    },
  ],
  members: [
    {
      allocationId: 'kpi-plan-finalized-alloc-1',
      memberDisplayName: 'Luna Park',
      allocationStatus: 'PUBLISHED',
      revenue: {
        metricCode: 'REVENUE_VND',
        targetValue: 600000,
        actualValue: 550000,
        achievementPercent: 91.67,
      },
      supportingMetrics: [
        {
          metricCode: 'CONTENT_OUTPUT_COUNT',
          targetValue: 6,
          actualValue: 5,
          achievementPercent: 83.33,
        },
        {
          metricCode: 'TIKTOK_DIAMOND',
          targetValue: 600,
          actualValue: 540,
          achievementPercent: 90,
        },
      ],
      actualEntryStatusSummary: makeActualEntryStatusSummary(),
    },
  ],
});

const makeListPlan = (
  id: string,
  title: string,
  subjectId: string,
  overrides: Partial<ReturnType<typeof makeDetail>> & {
    allocationWorkflowSummary?: TestAllocationWorkflowSummary;
  } = {},
) => {
  const { targetMetrics, allocations, ...plan } = {
    ...makeDetail(id, overrides.status ?? 'PUBLISHED'),
    ...overrides,
  };
  void targetMetrics;
  void allocations;
  return {
    ...plan,
    title,
    subjectId,
    allocationWorkflowSummary:
      overrides.allocationWorkflowSummary ??
      makeAllocationWorkflowSummary({ byStatus: { published: 1 } }),
  };
};

const makeActualWorkspaceDetail = () => ({
  planId: 'kpi-plan-published',
  planCode: 'KPI-202605-000002',
  title: 'Published team KPI',
  periodMonth: '2026-05',
  subjectType: 'TALENT_GROUP',
  subjectId: 'group-001',
  subjectRef: { id: 'group-001', code: 'TG-001', name: 'Creator Team', status: 'ACTIVE' },
  planStatus: 'PUBLISHED',
  revenue: {
    metricCode: 'REVENUE_VND',
    operationalTargetValue: 1000000,
    planTargetValue: 1000000,
    actualValue: 750000,
    achievementPercent: 75,
    targetSource: 'ALLOCATED',
    targetMismatch: false,
  },
  allocationCoverage: {
    publishedAllocationCount: 2,
    totalAllocationCount: 2,
    isAllExistingAllocationsPublished: true,
  },
  supportingMetrics: [
    {
      metricCode: 'CONTENT_OUTPUT_COUNT',
      targetValue: 10,
      actualValue: 8,
      achievementPercent: 80,
    },
    {
      metricCode: 'TIKTOK_DIAMOND',
      targetValue: 1000,
      actualValue: 840,
      achievementPercent: 84,
    },
  ],
  missingSignal: { count: 1, semantics: 'CALENDAR_DAY_METRIC_SLOT_LIMITED' },
  actualEntryStatusSummary: makeActualEntryStatusSummary(),
  closing: { periodState: 'CURRENT' },
  actionHints: { canReadActualGrid: true, canEnterActual: true },
  members: [
    {
      allocationId: 'kpi-plan-published-alloc-1',
      allocationStatus: 'PUBLISHED',
      memberDisplayName: 'Luna Park',
      revenue: {
        metricCode: 'REVENUE_VND',
        targetValue: 600000,
        actualValue: 500000,
        achievementPercent: 83.33,
      },
      supportingMetrics: [
        {
          metricCode: 'CONTENT_OUTPUT_COUNT',
          targetValue: 6,
          actualValue: 5,
          achievementPercent: 83.33,
        },
        {
          metricCode: 'TIKTOK_DIAMOND',
          targetValue: 600,
          actualValue: 540,
          achievementPercent: 90,
        },
      ],
      missingSignal: { count: 0, semantics: 'CALENDAR_DAY_METRIC_SLOT_LIMITED' },
      actualEntryStatusSummary: makeActualEntryStatusSummary({
        expectedEntryCount: 3,
        enteredEntryCount: 1,
        pendingEntryCount: 0,
        excusedEntryCount: 1,
        notDueEntryCount: 1,
      }),
      actionHints: { canReadActualGrid: true, canEnterActual: true },
    },
  ],
});

type ActualWorkspaceDetailFixture = ReturnType<typeof makeActualWorkspaceDetail>;
type ActualWorkspaceSummaryFixture = Omit<ActualWorkspaceDetailFixture, 'members'>;

const makeActualWorkspaceSummary = (
  overrides: Partial<ActualWorkspaceSummaryFixture> = {},
): ActualWorkspaceSummaryFixture => {
  const { members, ...summary } = makeActualWorkspaceDetail();
  void members;
  return {
    ...summary,
    ...overrides,
    revenue: {
      ...summary.revenue,
      ...overrides.revenue,
    },
    allocationCoverage: {
      ...summary.allocationCoverage,
      ...overrides.allocationCoverage,
    },
  };
};

const installActualWorkspacePagedUiHandler = (captured?: URL[]): void => {
  const rows = [
    makeActualWorkspaceSummary(),
    makeActualWorkspaceSummary({
      planId: 'kpi-plan-legacy-active',
      planCode: 'KPI-202605-000004',
      title: 'Legacy workflow KPI',
      allocationCoverage: {
        publishedAllocationCount: 1,
        totalAllocationCount: 2,
        isAllExistingAllocationsPublished: false,
      },
    }),
    makeActualWorkspaceSummary({
      planId: 'kpi-plan-finalized',
      planCode: 'KPI-202604-000003',
      title: 'Finalized team KPI',
      periodMonth: '2026-04',
      allocationCoverage: {
        publishedAllocationCount: 0,
        totalAllocationCount: 2,
        isAllExistingAllocationsPublished: false,
      },
    }),
  ];

  server.use(
    http.get('*/admin/kpi/actual-workspace/plans', ({ request }) => {
      const url = new URL(request.url);
      captured?.push(url);
      const search = url.searchParams.get('search')?.toLowerCase();
      const coverage = url.searchParams.get('allocationCoverage');
      const hasOverdueActuals = url.searchParams.get('hasOverdueActuals');
      const hasPendingActuals = url.searchParams.get('hasPendingActuals');
      const filtered = rows.filter((row) => {
        if (coverage === 'complete' && !row.allocationCoverage.isAllExistingAllocationsPublished) {
          return false;
        }
        if (coverage === 'incomplete' && row.allocationCoverage.isAllExistingAllocationsPublished) {
          return false;
        }
        if (
          hasOverdueActuals !== null &&
          row.actualEntryStatusSummary.overdueEntryCount > 0 !== (hasOverdueActuals === 'true')
        ) {
          return false;
        }
        if (
          hasPendingActuals !== null &&
          row.actualEntryStatusSummary.pendingEntryCount > 0 !== (hasPendingActuals === 'true')
        ) {
          return false;
        }
        if (!search) {
          return true;
        }
        return [row.planCode, row.title, row.subjectRef?.code, row.subjectRef?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search);
      });
      const cursor = url.searchParams.get('cursor');
      const pageIndex = cursor === 'cursor-2' ? 2 : cursor === 'cursor-1' ? 1 : 0;
      const pageRows = filtered.slice(pageIndex, pageIndex + 1);
      const nextCursor = pageIndex + 1 < filtered.length ? `cursor-${pageIndex + 1}` : undefined;
      return HttpResponse.json({
        data: pageRows,
        ...(nextCursor ? { meta: { nextCursor } } : {}),
      });
    }),
  );
};

const makeActualEntry = (id: string, metricCode: string, value: number) => ({
  id,
  kpiPlanId: 'kpi-plan-published',
  allocationId: 'kpi-plan-published-alloc-1',
  memberTalentId: 'talent-001',
  metricCode,
  actualDate: '16-05-2026',
  actualValue: value,
  effectiveValue: value,
  editCount: 1,
  correctionCount: 0,
  latestCorrectionId: null,
  createdAt: 1,
  createdByActorId: 'user-admin',
  updatedAt: 1,
  updatedByActorId: 'user-admin',
  lastEditedAt: 1,
  lastEditedByActorId: 'user-admin',
});

const makeCorrection = (value: number) => ({
  id: 'correction-test',
  actualEntryId: 'actual-locked',
  kpiPlanId: 'kpi-plan-published',
  allocationId: 'kpi-plan-published-alloc-2',
  metricCode: 'REVENUE_VND',
  actualDate: '16-05-2026',
  previousValue: 250000,
  correctedValue: value,
  reason: 'Operational correction',
  correctedAt: 1,
  createdAt: 1,
});

const makeActualGrid = () => ({
  kpiPlanId: 'kpi-plan-published',
  planCode: 'KPI-202605-000002',
  status: 'PUBLISHED',
  subjectType: 'TALENT_GROUP',
  subjectId: 'group-001',
  actualDate: '16-05-2026',
  policy: {
    timezone: 'Asia/Ho_Chi_Minh',
    entryOpenLocalTime: '00:00',
    entryLockLocalTime: '10:00',
    maxDirectEditsPerEntry: 3,
    correctionAllowedUntil: 'PLAN_FINALIZED',
  },
  editability: {
    isDirectEditOpen: true,
    isPlanFinalized: false,
    disabledReason: null,
  },
  targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000000, unit: 'VND' }],
  rows: [
    {
      allocationId: 'kpi-plan-published-alloc-1',
      memberTalentId: 'talent-001',
      memberDisplayName: 'Luna Park',
      allocationStatus: 'ACTIVE',
      metrics: [
        {
          metricCode: 'REVENUE_VND',
          targetValue: 600000,
          actualEntryId: null,
          actualValue: null,
          effectiveValue: 0,
          hasEntry: false,
          dailyActualStatus: 'DUE_OPEN',
          actualExcuse: null,
          editCount: 0,
          correctionCount: 0,
          latestCorrectionId: null,
          canDirectEdit: false,
          canMarkExcused: true,
          canUnmarkExcused: false,
          requiresCorrection: false,
          disabledReason: null,
        },
      ],
    },
  ],
});

const makeActualStatusGrid = () => {
  const grid = makeActualGrid();
  const targetMetrics = [
    { metricCode: 'REVENUE_VND', targetValue: 1000000, unit: 'VND' },
    { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 10, unit: 'COUNT' },
    { metricCode: 'LIVE_HOURS', targetValue: 20, unit: 'HOUR' },
    { metricCode: 'EVENT_COMPLETION_COUNT', targetValue: 4, unit: 'COUNT' },
    { metricCode: 'ONBOARDED_TALENT_COUNT', targetValue: 2, unit: 'COUNT' },
  ] as const;
  const baseCell = grid.rows[0].metrics[0];
  const excuseAudit = {
    createdAt: 1,
    createdByActorId: 'user-admin',
    updatedAt: 1,
    updatedByActorId: 'user-admin',
  };
  return {
    ...grid,
    targetMetrics,
    rows: [
      {
        ...grid.rows[0],
        metrics: [
          {
            ...baseCell,
            metricCode: 'REVENUE_VND',
            actualEntryId: 'actual-entered',
            actualValue: 100,
            effectiveValue: 100,
            hasEntry: true,
            dailyActualStatus: 'ENTERED',
            canMarkExcused: false,
          },
          {
            ...baseCell,
            metricCode: 'CONTENT_OUTPUT_COUNT',
            actualEntryId: 'actual-zero',
            actualValue: 0,
            effectiveValue: 0,
            hasEntry: true,
            dailyActualStatus: 'ENTERED_ZERO',
            canMarkExcused: false,
          },
          {
            ...baseCell,
            metricCode: 'LIVE_HOURS',
            dailyActualStatus: 'DUE_OPEN',
            canMarkExcused: true,
          },
          {
            ...baseCell,
            metricCode: 'EVENT_COMPLETION_COUNT',
            dailyActualStatus: 'OVERDUE',
            canMarkExcused: true,
          },
          {
            ...baseCell,
            metricCode: 'ONBOARDED_TALENT_COUNT',
            dailyActualStatus: 'NOT_DUE',
            canMarkExcused: true,
          },
        ],
      },
      {
        allocationId: 'kpi-plan-published-alloc-2',
        memberTalentId: 'talent-002',
        memberDisplayName: 'Minh Tran',
        allocationStatus: 'PUBLISHED',
        metrics: [
          {
            ...baseCell,
            metricCode: 'REVENUE_VND',
            dailyActualStatus: 'EXCUSED',
            actualExcuse: {
              id: 'excuse-ui',
              status: 'EXCUSED',
              reasonCode: 'MEMBER_LEAVE',
              reasonText: 'Approved leave',
              ...excuseAudit,
            },
            canMarkExcused: false,
            canUnmarkExcused: true,
          },
          {
            ...baseCell,
            metricCode: 'CONTENT_OUTPUT_COUNT',
            dailyActualStatus: 'NOT_REQUIRED',
            actualExcuse: {
              id: 'not-required-ui',
              status: 'NOT_REQUIRED',
              reasonCode: 'NO_OPERATION_REQUIRED',
              reasonText: 'No stream scheduled',
              ...excuseAudit,
            },
            canMarkExcused: false,
            canUnmarkExcused: true,
          },
        ],
      },
    ],
  };
};
