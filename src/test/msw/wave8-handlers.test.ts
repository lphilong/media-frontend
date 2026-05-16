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
});
