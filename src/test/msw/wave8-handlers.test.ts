import {
  managerWorkspaceTalentGroupOnlyContext,
  resetManagerWorkspaceMockData,
  setMockManagerPlatformAccountEligible,
  setMockManagerWorkspaceContext,
} from './manager-workspace-handlers';
import { resetWave8MockData } from './wave8-handlers';

const requestJson = async (
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; payload: unknown }> => {
  const response = await fetch(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    status: response.status,
    payload: await response.json(),
  };
};

export {};

describe('wave 8 MSW commercial guards', () => {
  it('rejects Talent KPI scope leakage and invalid metric replacement payloads', async () => {
    const scopeLeak = await fetch(
      'http://localhost/admin/talent-kpi-records?scope=global&status=DRAFT',
    );
    expect(scopeLeak.status).toBe(422);

    const invalidMetrics = await requestJson(
      '/admin/talent-kpi-records/talent-kpi-record-001/metrics',
      {
        metrics: [
          { metricCode: 'ENGAGEMENT_COUNT', numericValue: 1 },
          { metricCode: 'ENGAGEMENT_COUNT', numericValue: 2 },
        ],
      },
    );
    expect(invalidMetrics.status).toBe(422);
  });

  it('rejects Revenue Ledger scope leakage and unsafe narrow sort combinations', async () => {
    const bodyLeak = await requestJson('/admin/revenue-entries/revenue-entry-001/finalize', {
      scope: 'global',
    });
    expect(bodyLeak.status).toBe(422);

    const unsafeSort = await fetch(
      'http://localhost/admin/revenue-entries?sortBy=createdAt&status=DRAFT',
    );
    expect(unsafeSort.status).toBe(422);

    const relatedUnsafeSort = await fetch(
      'http://localhost/admin/revenue-entries/by-talent?subjectTalentId=talent-001&sortBy=createdAt',
    );
    expect(relatedUnsafeSort.status).toBe(422);
  });

  it('enforces Revenue Ledger lifecycle transitions and void blocker path', async () => {
    const invalidReconcile = await requestJson(
      '/admin/revenue-entries/revenue-entry-001/reconcile',
    );
    expect(invalidReconcile.status).toBe(409);

    const blockedVoid = await requestJson('/admin/revenue-entries/revenue-entry-blocked/void');
    expect(blockedVoid.status).toBe(409);
    expect(blockedVoid.payload).toMatchObject({
      message: 'Finalized commission settlement blocks void',
    });

    const finalize = await requestJson('/admin/revenue-entries/revenue-entry-001/finalize');
    expect(finalize.status).toBe(200);
    const reconcile = await requestJson('/admin/revenue-entries/revenue-entry-001/reconcile', {
      reconciliationReference: 'BANK-1',
    });
    expect(reconcile.status).toBe(200);
    expect(reconcile.payload).toMatchObject({
      data: {
        status: 'RECONCILED',
        reconciliationReference: 'BANK-1',
      },
    });
  });

  it('mirrors Platform Earning cursor, lifecycle gates, subject guard, and duplicate entry conflict', async () => {
    resetWave8MockData();

    const list = await fetch(
      'http://localhost/admin/revenue-ledger/platform-earning-batches?limit=100',
    );
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({ meta: { nextCursor: null } });

    const missingSubject = await requestJson(
      '/admin/revenue-ledger/platform-earning-batches/platform-batch-approved/create-revenue-entry',
      {},
    );
    expect(missingSubject.status).toBe(422);

    const created = await requestJson(
      '/admin/revenue-ledger/platform-earning-batches/platform-batch-approved/create-revenue-entry',
      { subjectTalentId: 'talent-002' },
    );
    expect(created.status).toBe(200);

    const duplicate = await requestJson(
      '/admin/revenue-ledger/platform-earning-batches/platform-batch-approved/create-revenue-entry',
      { subjectTalentId: 'talent-002' },
    );
    expect(duplicate.status).toBe(409);

    const archiveApproved = await requestJson(
      '/admin/revenue-ledger/platform-earning-batches/platform-batch-approved/archive',
    );
    expect(archiveApproved.status).toBe(200);

    resetWave8MockData();
    const submitDraft = await requestJson(
      '/admin/revenue-ledger/platform-earning-batches/platform-batch-draft/submit',
    );
    expect(submitDraft.status).toBe(200);
    const rejectSubmitted = await requestJson(
      '/admin/revenue-ledger/platform-earning-batches/platform-batch-draft/reject',
      { reason: 'Source mismatch' },
    );
    expect(rejectSubmitted.status).toBe(200);
    const voidRejected = await requestJson(
      '/admin/revenue-ledger/platform-earning-batches/platform-batch-draft/void',
      { reason: 'Rejected batches cannot be voided' },
    );
    expect(voidRejected.status).toBe(409);
  });

  it('mirrors Manager Workspace revenue fail-closed platform eligibility and null cursor', async () => {
    resetManagerWorkspaceMockData();
    setMockManagerWorkspaceContext(managerWorkspaceTalentGroupOnlyContext());

    const list = await fetch(
      'http://localhost/admin/manager-workspace/revenue/platform-earning-batches?limit=100',
    );
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({ data: { nextCursor: null } });

    setMockManagerPlatformAccountEligible(false);
    const detail = await fetch(
      'http://localhost/admin/manager-workspace/revenue/platform-earning-batches/manager-platform-batch-001',
    );
    expect(detail.status).toBe(403);

    const submit = await requestJson(
      '/admin/manager-workspace/revenue/platform-earning-batches/manager-platform-batch-001/submit',
    );
    expect(submit.status).toBe(403);
  });
});
