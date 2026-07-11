import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PERMISSIONS } from '@shared/auth/current-actor-capabilities';
import { parseKpiPlanDetailResponseForTest } from '@modules/kpi/api/kpi.api';
import { createActorCapabilities } from '@test/factories/access';
import { setupLocale } from '@test/locale-time';
import { setupMswScenario } from '@test/msw-scenario';
import { server } from '@test/msw/server';
import { renderRouteWithAccess } from '@test/render-app-route';

const adminCapabilities = () =>
  createActorCapabilities({
    id: 'kpi-security-admin',
    accountContexts: ['ADMIN_CONSOLE'],
    permissions: [
      PERMISSIONS.KPI_READ,
      PERMISSIONS.KPI_READ_PROGRESS,
      PERMISSIONS.KPI_ENTER_ACTUAL,
      PERMISSIONS.KPI_CORRECT_ACTUAL,
      PERMISSIONS.KPI_FINALIZE,
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

describe('KPI money-boundary and security regression coverage', () => {
  let restoreLocale: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    restoreLocale = await setupLocale('en');
    setupMswScenario({ capabilities: adminCapabilities() });
  });

  afterEach(async () => {
    await restoreLocale?.();
  });

  it('states KPI actual non-effects without exposing downstream money actions on Actual Workspace', async () => {
    const user = userEvent.setup();

    renderRouteWithAccess('/kpi', { capabilities: adminCapabilities() });

    await waitForKpiPlanList();
    await user.click(await findTabByText([/Progress & Actuals/u]));

    expect(await screen.findByText(/KPI actuals do not automatically decide/u)).toBeInTheDocument();

    for (const unsafeAction of [
      /create revenue/i,
      /approve revenue/i,
      /create commission/i,
      /create payroll/i,
      /pay out/i,
      /tax/i,
      /accounting/i,
    ]) {
      expect(screen.queryByRole('button', { name: unsafeAction })).not.toBeInTheDocument();
    }
  }, 20000);

  it('saving KPI actuals does not call Revenue, Commission, Payroll, payment, tax, or accounting endpoints', async () => {
    const user = userEvent.setup();
    const downstreamCalls: string[] = [];

    server.use(
      http.all('*/admin/revenue-ledger/*', ({ request }) => {
        downstreamCalls.push(new URL(request.url).pathname);
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/commission/*', ({ request }) => {
        downstreamCalls.push(new URL(request.url).pathname);
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/payroll*', ({ request }) => {
        downstreamCalls.push(new URL(request.url).pathname);
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/payments*', ({ request }) => {
        downstreamCalls.push(new URL(request.url).pathname);
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/tax*', ({ request }) => {
        downstreamCalls.push(new URL(request.url).pathname);
        return HttpResponse.json({ data: [] });
      }),
      http.all('*/admin/accounting*', ({ request }) => {
        downstreamCalls.push(new URL(request.url).pathname);
        return HttpResponse.json({ data: [] });
      }),
    );

    renderRouteWithAccess('/kpi?subjectType=ORG_UNIT', { capabilities: adminCapabilities() });

    await waitForKpiPlanList();
    await user.click(await findTabByText([/Progress & Actuals/u]));
    const row = (await screen.findByText('KPI-202606-ORG-001')).closest('tr');
    expect(row).not.toBeNull();
    await user.click(within(row!).getByRole('button', { name: /View detail/u }));

    const actualDate = await screen.findByLabelText(/Actual date/u);
    await user.clear(actualDate);
    await user.type(actualDate, '2026-06-15');
    await user.click(screen.getByRole('button', { name: 'Load grid' }));
    const actualInput = await screen.findByLabelText(
      /Actual value for An Nguyen Operational revenue KPI/u,
    );
    await user.clear(actualInput);
    await user.type(actualInput, '1000');
    await user.click(screen.getByRole('button', { name: /Save changed cells/u }));

    await waitFor(() => expect(downstreamCalls).toHaveLength(0));
  }, 20000);

  it('rejects downstream finance fields in finalized KPI result schema', () => {
    const plan = {
      id: 'kpi-plan-finalized',
      planCode: 'KPI-202606-ORG-001',
      title: 'Finalized KPI',
      description: null,
      subjectType: 'ORG_UNIT',
      subjectId: 'org-unit-ops',
      subjectRef: null,
      status: 'FINALIZED',
      currencyCode: 'VND',
      periodMonth: '2026-06',
      periodStartAt: 1,
      periodEndAt: 2,
      timezone: 'Asia/Ho_Chi_Minh',
      actualPolicySnapshot: null,
      publishedAt: 1,
      publishedByActorId: 'user-admin',
      finalizedAt: 2,
      finalizedByActorId: 'user-admin',
      archivedAt: null,
      archivedByActorId: null,
      createdAt: 1,
      createdByActorId: 'user-admin',
      updatedAt: 2,
      updatedByActorId: 'user-admin',
      externalRef: null,
      finalResult: {
        snapshotVersion: 1,
        planId: 'kpi-plan-finalized',
        planCode: 'KPI-202606-ORG-001',
        periodMonth: '2026-06',
        subjectType: 'ORG_UNIT',
        subjectId: 'org-unit-ops',
        finalizedAt: 2,
        revenue: {
          metricCode: 'REVENUE_VND',
          planTargetValue: 100,
          operationalTargetValue: 100,
          actualValue: 50,
          achievementPercent: 50,
          targetMismatch: false,
          revenueEntryId: 'revenue-entry-secret',
        },
        allocationCoverage: {
          publishedAllocationCount: 1,
          totalAllocationCount: 1,
          isAllExistingAllocationsPublished: true,
        },
        actualEntryStatusSummary: {
          expectedEntryCount: 1,
          enteredEntryCount: 1,
          enteredZeroCount: 0,
          pendingEntryCount: 0,
          overdueEntryCount: 0,
          excusedEntryCount: 0,
          notRequiredEntryCount: 0,
          notDueEntryCount: 0,
        },
        supportingMetrics: [],
        members: [],
      },
      targetMetrics: [],
      allocations: [],
    };

    expect(() => parseKpiPlanDetailResponseForTest({ data: plan })).toThrow();
  });
});
