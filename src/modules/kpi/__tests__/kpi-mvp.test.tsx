import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, beforeEach } from 'vitest';
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
  createKpiPlan,
  fetchKpiActualDailyGrid,
  fetchKpiPlans,
  fetchKpiManagedMembers,
  fetchMyKpiProgress,
  parseKpiAllocationDraftPayloadForTest,
  parseKpiAllocationListResponseForTest,
  parseKpiPlanListResponseForTest,
  performKpiLifecycleAction,
  publishKpiAllocation,
  rejectKpiAllocation,
  replaceKpiAllocations,
  replaceKpiTargetMetrics,
  submitKpiAllocationDraft,
  upsertKpiAllocationDraft,
} from '@modules/kpi/api/kpi.api';
import type { CurrentActorCapabilities } from '@shared/auth/current-actor-capabilities';
import { setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const may2026PeriodStartAt = Date.UTC(2026, 4, 1, -7, 0, 0, 0);
const may2026PeriodEndAt = Date.UTC(2026, 5, 1, -7, 0, 0, 0) - 1;

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

const mswJson = (method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown) =>
  fetch(`http://localhost${path}`, {
    method,
    headers: data === undefined ? undefined : { 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });

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
  beforeEach(async () => {
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
    expect(within(row!).getByLabelText('Allocation workflow')).toBeInTheDocument();
    expect(within(row!).getByText('Official published')).toBeInTheDocument();
    expect(within(row!).getAllByText('2').length).toBeGreaterThan(0);
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
    expect(within(mixedRow!).getByText('Draft')).toBeInTheDocument();
    expect(within(mixedRow!).getByText('Pending approval')).toBeInTheDocument();
    expect(within(mixedRow!).getAllByText('Published').length).toBeGreaterThan(0);
    expect(within(mixedRow!).getByText('Legacy active')).toBeInTheDocument();
    expect(within(mixedRow!).getByText('Official published')).toBeInTheDocument();
    expect(within(mixedRow!).getAllByText('3').length).toBeGreaterThan(0);
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
    await userEvent.click(await waitForEnabledButton('Create draft plan'));
    await waitFor(() => expect(body).toBeDefined());
    expect((body?.targetMetrics as Array<{ targetValue: number }>)[0].targetValue).toBe(1000000);
    expect(typeof (body?.targetMetrics as Array<{ targetValue: number }>)[0].targetValue).toBe(
      'number',
    );
    expect(
      (body?.allocations as Array<{ allocationStartDate: string }>)[0].allocationStartDate,
    ).toBe('2026-05-01');
    expect(
      (body?.allocations as Array<{ allocationStartDate: string }>)[0].allocationStartDate,
    ).not.toBe('01-05-2026');
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
    await screen.findByText('Actual entry');
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

  it('shows allocation totals/difference and blocks publish UI on mismatch', async () => {
    renderRoute('/kpi');
    await waitForKpiList();
    await userEvent.click(await waitForEnabledButton('Create KPI plan'));
    expect(screen.getByText('Allocated total')).toBeInTheDocument();
    const lunaRevenue = screen.getByLabelText('Luna Park Revenue VND');
    await userEvent.clear(lunaRevenue);
    await userEvent.type(lunaRevenue, '500.000');
    expect(
      screen.getByText('Allocation total must equal plan target before publish.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create draft plan' })).toBeDisabled();
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

  it('shows finalize confirmation and calls finalize API', async () => {
    renderRoute('/kpi/plans/kpi-plan-published');
    await waitForPublishedKpiDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Finalize' }));
    expect(await screen.findByTestId('confirm-dialog')).toHaveTextContent('payroll/reporting');
    await userEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(await screen.findByText('KPI lifecycle updated.')).toBeInTheDocument();
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
    let captured = new URL('http://example.test');
    server.use(
      http.get('*/admin/kpi/plans/:kpiPlanId/actuals', ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ data: makeActualGrid() });
      }),
    );
    renderRoute('/kpi');
    await screen.findByText('Actual entry');
    await waitFor(() => expect(captured.searchParams.get('actualDate')).toBe('16-05-2026'));
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
    await screen.findByText('Actual entry');
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
    await screen.findByText('Actual entry');
    const minhRevenue = await screen.findByLabelText('Minh Tran Revenue VND actual');
    await userEvent.clear(minhRevenue);
    await userEvent.type(minhRevenue, '300.000');
    await userEvent.click(await waitForEnabledButton('Save changed cells'));
    expect(await screen.findByRole('dialog', { name: 'Edit actual' })).toBeInTheDocument();
    expect(await screen.findByText('Correction history')).toBeInTheDocument();
  });

  it('shows duplicate POST conflict message', async () => {
    server.use(
      http.post('*/admin/kpi/plans/:kpiPlanId/actuals', () =>
        HttpResponse.json({ message: 'Duplicate actual with different value' }, { status: 409 }),
      ),
    );
    renderRoute('/kpi');
    await screen.findByText('Actual entry');
    const lunaContent = await screen.findByLabelText('Luna Park Content output count actual');
    await userEvent.clear(lunaContent);
    await userEvent.type(lunaContent, '3');
    await userEvent.click(await waitForEnabledButton('Save changed cells'));
    expect(await screen.findByText(/already exists with a different value/i)).toBeInTheDocument();
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
    await screen.findByText('Actual entry');
    const correctionButtons = await screen.findAllByRole('button', { name: 'Correction' });
    await waitFor(() => expect(correctionButtons.at(-1)).toBeEnabled());
    await userEvent.click(correctionButtons.at(-1)!);
    await userEvent.click(await waitForEnabledButton('Submit correction'));
    expect(await screen.findByText('Correction reason is required.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Correction reason'), 'Payroll correction');
    const corrected = screen.getByLabelText('Corrected value');
    await userEvent.clear(corrected);
    await userEvent.type(corrected, '300.000');
    await userEvent.click(await waitForEnabledButton('Submit correction'));
    await waitFor(() => expect(body?.correctedValue).toBe(300000));
    expect(typeof body?.correctedValue).toBe('number');
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
      periodMonth: '2026-05',
      periodStartAt: may2026PeriodStartAt,
      periodEndAt: may2026PeriodEndAt,
      targetMetrics: [
        { metricCode: 'REVENUE_VND', targetValue: 1000 },
        { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 10 },
        { metricCode: 'LIVE_HOURS', targetValue: 1.25 },
      ],
      allocations: [
        {
          memberTalentId: 'talent-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [
            { metricCode: 'REVENUE_VND', targetValue: 1000 },
            { metricCode: 'CONTENT_OUTPUT_COUNT', targetValue: 10 },
            { metricCode: 'LIVE_HOURS', targetValue: 1.25 },
          ],
        },
      ],
    });
    await performKpiLifecycleAction(plan.id, 'publish');

    const baseAllocation = {
      employmentProfileId: 'employment-profile-001',
      allocationStartDate: '2026-05-01',
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

  it('MSW rejects invalid create-plan nested allocation payloads', async () => {
    const basePayload = {
      title: 'Invalid create plan',
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
      periodMonth: '2026-05',
      periodStartAt: may2026PeriodStartAt,
      periodEndAt: may2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
    };

    for (const allocations of [
      [
        {
          memberTalentId: 'talent-001',
          allocationStartDate: '01-05-2026',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
        },
      ],
      [
        {
          memberTalentId: 'talent-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000, extra: true }],
        },
      ],
      [
        {
          memberTalentId: 'talent-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
          targetKind: 'TALENT',
        },
      ],
    ]) {
      const response = await mswJson('POST', '/admin/kpi/plans', { ...basePayload, allocations });
      expect(response.status).toBe(400);
    }
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

  it('MSW rejects allocation publish when allocation totals do not match plan targets', async () => {
    const plan = await createKpiPlan({
      title: 'Mismatched allocation total plan',
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
      periodMonth: '2026-05',
      periodStartAt: may2026PeriodStartAt,
      periodEndAt: may2026PeriodEndAt,
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 1000 }],
      allocations: [
        {
          memberTalentId: 'talent-001',
          allocationStartDate: '2026-05-01',
          targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 900 }],
        },
      ],
    });
    await performKpiLifecycleAction(plan.id, 'publish');
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
  });

  it('frontend KPI Zod rejects backend-invalid target metric semantics', async () => {
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
    await screen.findByText('Actual entry');

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
    await screen.findByText('Actual entry');

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
  memberTalentId: 'talent-002',
  metricCode: 'REVENUE_VND',
  actualDate: '16-05-2026',
  previousValue: 250000,
  correctedValue: value,
  reason: 'Payroll correction',
  correctedByActorId: 'user-admin',
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
    entryOpenLocalTime: '06:00',
    entryLockLocalTime: '23:00',
    maxDirectEditsPerEntry: 2,
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
          editCount: 0,
          correctionCount: 0,
          latestCorrectionId: null,
          canDirectEdit: false,
          requiresCorrection: false,
          disabledReason: null,
        },
      ],
    },
  ],
});
