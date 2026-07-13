import { beforeEach, describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@shared/auth/current-actor-capabilities';
import { createActorCapabilities } from '@test/factories/access';
import { setupMswScenario } from '@test/msw-scenario';

const adminCapabilities = () =>
  createActorCapabilities({
    id: 'kpi-msw-admin',
    accountContexts: ['ADMIN_CONSOLE'],
    permissions: [PERMISSIONS.KPI_READ, PERMISSIONS.KPI_READ_PROGRESS],
    scopeGrants: { kpi: ['global'] },
  });

const requestJson = async (path: string): Promise<{ status: number; body: unknown }> => {
  const response = await fetch(`http://localhost${path}`);
  return { status: response.status, body: await response.json() };
};

describe('KPI MSW test-double coverage', () => {
  beforeEach(() => {
    setupMswScenario({ capabilities: adminCapabilities() });
  });

  it('paginates Actual Workspace with opaque cursor behavior as a test double', async () => {
    const first = await requestJson('/admin/kpi/actual-workspace/plans?limit=1&sortBy=planCode');
    expect(first.status).toBe(200);
    const firstBody = first.body as {
      data: Array<{ planId: string }>;
      meta?: { nextCursor?: string };
    };
    expect(firstBody.data).toHaveLength(1);
    expect(firstBody.meta?.nextCursor).toEqual(expect.any(String));

    const second = await requestJson(
      `/admin/kpi/actual-workspace/plans?limit=1&sortBy=planCode&cursor=${encodeURIComponent(
        firstBody.meta?.nextCursor ?? '',
      )}`,
    );
    expect(second.status).toBe(200);
    const secondBody = second.body as { data: Array<{ planId: string }> };
    expect(secondBody.data).toHaveLength(1);
    expect(secondBody.data[0]?.planId).not.toBe(firstBody.data[0]?.planId);
  });

  it('rejects unsupported Actual Workspace query fields instead of silently accepting drift', async () => {
    const response = await requestJson(
      '/admin/kpi/actual-workspace/plans?limit=1&payrollPeriod=2026-06',
    );

    expect(response.status).toBe(422);
    expect(JSON.stringify(response.body)).toMatch(/Unsupported query key: payrollPeriod/);
  });

  it('keeps retired Talent KPI handlers fail-closed as test-double behavior only', async () => {
    const response = await requestJson('/admin/talent-kpi-records?status=DRAFT');

    expect(response.status).toBe(410);
    expect(JSON.stringify(response.body)).toMatch(/Talent KPI has been retired/);
  });
});
