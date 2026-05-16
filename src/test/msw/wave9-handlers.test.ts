const requestJson = async (
  path: string,
  body?: Record<string, unknown>,
  method = 'POST',
): Promise<{ status: number; payload: unknown }> => {
  const response = await fetch(`http://localhost${path}`, {
    method,
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

describe('wave 9 MSW commission guards', () => {
  it('rejects Commission Rule scope leakage, related search, and invalid timestamp shapes', async () => {
    const scopeLeak = await fetch(
      'http://localhost/admin/commission/rules?scope=global&status=DRAFT',
    );
    expect(scopeLeak.status).toBe(422);

    const relatedSearch = await fetch(
      'http://localhost/admin/commission/rules/by-contract?sourceContractRecordId=contract-record-001&search=nope',
    );
    expect(relatedSearch.status).toBe(422);

    const invalidTimestamp = await requestJson('/admin/commission/rules', {
      ruleCode: 'CRULE-000900',
      title: 'Invalid timestamp',
      settlementKind: 'REVENUE_SHARE',
      beneficiaryKind: 'TALENT',
      beneficiaryTalentId: 'talent-001',
      sourceContractRecordId: 'contract-record-001',
      settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
      ratePercent: 10,
      appliesToRevenueKinds: ['PLATFORM_LIVESTREAM'],
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      description: null,
      externalRef: null,
    });
    expect(invalidTimestamp.status).toBe(422);
  });

  it('rejects invalid Rule beneficiary combinations and lifecycle drift', async () => {
    const invalidBeneficiary = await requestJson('/admin/commission/rules', {
      ruleCode: 'CRULE-000901',
      title: 'Invalid beneficiary',
      settlementKind: 'REVENUE_SHARE',
      beneficiaryKind: 'EMPLOYMENT_PROFILE',
      beneficiaryEmploymentProfileId: 'ep-001',
      sourceContractRecordId: 'contract-record-001',
      settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
      ratePercent: 10,
      appliesToRevenueKinds: ['PLATFORM_LIVESTREAM'],
      effectiveStartDate: 1735689600000,
      effectiveEndDate: null,
      description: null,
      externalRef: null,
    });
    expect(invalidBeneficiary.status).toBe(422);

    const lifecycleBodyLeak = await requestJson(
      '/admin/commission/rules/commission-rule-001/activate',
      { scope: 'global' },
    );
    expect(lifecycleBodyLeak.status).toBe(422);

    const invalidTransition = await requestJson(
      '/admin/commission/rules/commission-rule-001/deactivate',
    );
    expect(invalidTransition.status).toBe(409);
  });

  it('rejects Settlement scope leakage, unsupported query keys, and derived authoring', async () => {
    const scopeLeak = await fetch(
      'http://localhost/admin/commission/settlements?scope=global&status=DRAFT',
    );
    expect(scopeLeak.status).toBe(422);

    const contractLeak = await fetch(
      'http://localhost/admin/commission/settlements?sourceContractRecordId=contract-record-001',
    );
    expect(contractLeak.status).toBe(422);

    const derivedAuthoring = await requestJson('/admin/commission/settlements', {
      settlementCode: 'CS-197001-000900',
      title: 'Invalid derived fields',
      sourceRuleId: 'commission-rule-001',
      settlementPeriodStartAt: 1000,
      settlementPeriodEndAt: 2000,
      revenueEntryIds: ['revenue-entry-001'],
      grossRevenueAmount: 100,
      settlementAmount: 10,
    });
    expect(derivedAuthoring.status).toBe(422);
  });

  it('enforces Settlement revenue-entry full replacement and read-only lines', async () => {
    const invalidReplacement = await requestJson(
      '/admin/commission/settlements/commission-settlement-001/revenue-entries',
      {
        addRevenueEntryIds: ['revenue-entry-002'],
      },
    );
    expect(invalidReplacement.status).toBe(422);

    const emptyReplacement = await requestJson(
      '/admin/commission/settlements/commission-settlement-001/revenue-entries',
      {
        revenueEntryIds: [],
      },
    );
    expect(emptyReplacement.status).toBe(422);

    const linePatch = await requestJson(
      '/admin/commission/settlements/commission-settlement-001/lines/commission-line-001',
      {
        lineSettlementAmount: 1,
      },
      'PATCH',
    );
    expect(linePatch.status).toBe(405);

    const validReplacement = await requestJson(
      '/admin/commission/settlements/commission-settlement-001/revenue-entries',
      {
        revenueEntryIds: ['revenue-entry-001', 'revenue-entry-002'],
      },
    );
    expect(validReplacement.status).toBe(200);
    expect(validReplacement.payload).toMatchObject({
      data: {
        revenueEntryIds: ['revenue-entry-001', 'revenue-entry-002'],
      },
    });
  });

  it('enforces Settlement lifecycle transitions and zero-body payloads', async () => {
    const lifecycleBodyLeak = await requestJson(
      '/admin/commission/settlements/commission-settlement-001/finalize',
      { scope: 'global' },
    );
    expect(lifecycleBodyLeak.status).toBe(422);

    const invalidVoid = await requestJson(
      '/admin/commission/settlements/commission-settlement-001/void',
    );
    expect(invalidVoid.status).toBe(409);

    const finalize = await requestJson(
      '/admin/commission/settlements/commission-settlement-001/finalize',
    );
    expect(finalize.status).toBe(200);
    expect(finalize.payload).toMatchObject({
      data: {
        status: 'FINALIZED',
      },
    });

    const voidSettlement = await requestJson(
      '/admin/commission/settlements/commission-settlement-001/void',
    );
    expect(voidSettlement.status).toBe(200);
    expect(voidSettlement.payload).toMatchObject({
      data: {
        status: 'VOIDED',
      },
    });
  });
});
