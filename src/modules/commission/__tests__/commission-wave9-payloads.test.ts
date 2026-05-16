import {
  canActivateCommissionRule,
  canArchiveCommissionRule,
  canArchiveCommissionSettlement,
  canDeactivateCommissionRule,
  canEditCommissionRuleDraftCore,
  canEditCommissionSettlementDraftCore,
  canFinalizeCommissionSettlement,
  canReplaceCommissionSettlementRevenueEntries,
  canVoidCommissionSettlement,
} from '@modules/commission/actions/commission-action-rail';
import {
  commissionZeroBody,
  sanitizeCommissionRuleCreatePayload,
  sanitizeCommissionRuleDraftCorePayload,
  sanitizeCommissionSettlementCreatePayload,
  sanitizeCommissionSettlementDraftCorePayload,
  sanitizeCommissionSettlementRevenueEntriesPayload,
} from '@modules/commission/api/commission.api';
import {
  parseCommissionRuleCreateForTest,
  parseCommissionRuleDraftCoreForTest,
  parseCommissionSettlementCreateForTest,
  parseCommissionSettlementDraftCoreForTest,
  parseCommissionSettlementRevenueEntriesForTest,
  validateCommissionRuleCreateForTest,
  validateCommissionRuleDraftCoreForTest,
} from '@modules/commission/forms/commission-mutation-forms';

const utcMidnight = 1735689600000;
const nextUtcMidnight = 1735776000000;
type RuleCreateFormValues = Parameters<typeof parseCommissionRuleCreateForTest>[0];
type RuleDraftCoreFormValues = Parameters<typeof parseCommissionRuleDraftCoreForTest>[0];

const createRuleValues = (overrides: Partial<RuleCreateFormValues> = {}): RuleCreateFormValues => ({
  title: 'Validated rule',
  settlementKind: 'REVENUE_SHARE' as const,
  beneficiaryKind: 'TALENT' as const,
  beneficiaryEmploymentProfileId: '',
  beneficiaryTalentId: 'talent-001',
  sourceContractRecordId: 'contract-record-001',
  settlementBasis: 'RECOGNIZED_GROSS_REVENUE' as const,
  ratePercent: '12.5',
  appliesToRevenueKinds: {
    PLATFORM_LIVESTREAM: true,
    PLATFORM_CONTENT: false,
    EVENT_OPERATIONAL: false,
  },
  effectiveStartDate: String(utcMidnight),
  effectiveEndDate: '',
  description: '',
  externalRef: '',
  ...overrides,
});

const draftRuleValues = (
  overrides: Partial<RuleDraftCoreFormValues> = {},
): RuleDraftCoreFormValues => ({
  title: 'Validated rule',
  ratePercent: '12.5',
  appliesToRevenueKinds: {
    PLATFORM_LIVESTREAM: true,
    PLATFORM_CONTENT: false,
    EVENT_OPERATIONAL: false,
  },
  effectiveStartDate: String(utcMidnight),
  effectiveEndDate: '',
  description: '',
  externalRef: '',
  ...overrides,
});

const expectEffectiveEndDateRejected = (
  result: ReturnType<typeof validateCommissionRuleCreateForTest>,
) => {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('effectiveEndDate');
  }
};

const expectDraftEffectiveEndDateRejected = (
  result: ReturnType<typeof validateCommissionRuleDraftCoreForTest>,
) => {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('effectiveEndDate');
  }
};

describe('commission Wave 9 payload contracts', () => {
  it('shapes Commission Rule create payloads with exact fields and UTC-midnight timestamps', () => {
    const payload = parseCommissionRuleCreateForTest({
      title: 'Wave 9 rule',
      settlementKind: 'REVENUE_SHARE',
      beneficiaryKind: 'TALENT',
      beneficiaryEmploymentProfileId: '',
      beneficiaryTalentId: 'talent-001',
      sourceContractRecordId: 'contract-record-001',
      settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
      ratePercent: '12.3456',
      appliesToRevenueKinds: {
        PLATFORM_LIVESTREAM: true,
        PLATFORM_CONTENT: false,
        EVENT_OPERATIONAL: false,
      },
      effectiveStartDate: String(utcMidnight),
      effectiveEndDate: '',
      description: '',
      externalRef: '',
    });
    const sanitized = sanitizeCommissionRuleCreatePayload({
      ...payload,
      beneficiaryEmploymentProfileId: 'ep-leak',
      scope: 'global',
      scopeGrants: ['x'],
      fixedAmount: 100,
    } as typeof payload & Record<string, unknown>);

    expect(sanitized).toEqual({
      title: 'Wave 9 rule',
      settlementKind: 'REVENUE_SHARE',
      beneficiaryKind: 'TALENT',
      beneficiaryTalentId: 'talent-001',
      sourceContractRecordId: 'contract-record-001',
      settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
      ratePercent: 12.3456,
      appliesToRevenueKinds: ['PLATFORM_LIVESTREAM'],
      effectiveStartDate: utcMidnight,
      effectiveEndDate: null,
      description: null,
      externalRef: null,
    });
    expect(sanitized).not.toHaveProperty('ruleCode');
    expect(JSON.stringify(sanitized)).not.toContain('scope');
    expect(JSON.stringify(sanitized)).not.toContain('fixedAmount');
  });

  it('shapes Commission Rule draft-core payloads without lifecycle, contract, or scope drift', () => {
    const payload = parseCommissionRuleDraftCoreForTest({
      title: 'Edited rule',
      ratePercent: '9.5',
      appliesToRevenueKinds: {
        PLATFORM_LIVESTREAM: true,
        PLATFORM_CONTENT: true,
        EVENT_OPERATIONAL: false,
      },
      effectiveStartDate: String(utcMidnight),
      effectiveEndDate: String(nextUtcMidnight),
      description: 'Edited',
      externalRef: '',
    });
    const sanitized = sanitizeCommissionRuleDraftCorePayload({
      ...payload,
      sourceContractRecordId: 'contract-leak',
      beneficiaryTalentId: 'talent-leak',
      scope: 'global',
    } as typeof payload & Record<string, unknown>);

    expect(sanitized).toEqual({
      title: 'Edited rule',
      ratePercent: 9.5,
      appliesToRevenueKinds: ['PLATFORM_LIVESTREAM', 'PLATFORM_CONTENT'],
      effectiveStartDate: utcMidnight,
      effectiveEndDate: nextUtcMidnight,
      description: 'Edited',
      externalRef: null,
    });
    expect(JSON.stringify(sanitized)).not.toContain('sourceContractRecordId');
    expect(JSON.stringify(sanitized)).not.toContain('beneficiaryTalentId');
    expect(JSON.stringify(sanitized)).not.toContain('scope');
  });

  it('uses zero-body lifecycle payloads for Rule actions', () => {
    expect(commissionZeroBody()).toEqual({});
    expect(canActivateCommissionRule('DRAFT')).toBe(true);
    expect(canActivateCommissionRule('INACTIVE')).toBe(true);
    expect(canActivateCommissionRule('ACTIVE')).toBe(false);
    expect(canDeactivateCommissionRule('ACTIVE')).toBe(true);
    expect(canArchiveCommissionRule('DRAFT')).toBe(true);
    expect(canArchiveCommissionRule('ACTIVE')).toBe(false);
    expect(canEditCommissionRuleDraftCore('ARCHIVED')).toBe(false);
  });

  it('validates optional Rule effectiveEndDate consistently for create and draft-core edit', () => {
    expect(
      parseCommissionRuleCreateForTest(
        createRuleValues({ effectiveEndDate: String(nextUtcMidnight) }),
      ).effectiveEndDate,
    ).toBe(nextUtcMidnight);
    expect(
      parseCommissionRuleDraftCoreForTest(
        draftRuleValues({ effectiveEndDate: String(nextUtcMidnight) }),
      ).effectiveEndDate,
    ).toBe(nextUtcMidnight);
    expect(parseCommissionRuleCreateForTest(createRuleValues()).effectiveEndDate).toBeNull();
    expect(parseCommissionRuleDraftCoreForTest(draftRuleValues()).effectiveEndDate).toBeNull();

    expectEffectiveEndDateRejected(
      validateCommissionRuleCreateForTest({
        ...createRuleValues(),
        effectiveEndDate: String(nextUtcMidnight + 1),
      }),
    );
    expectDraftEffectiveEndDateRejected(
      validateCommissionRuleDraftCoreForTest({
        ...draftRuleValues(),
        effectiveEndDate: String(nextUtcMidnight + 1),
      }),
    );

    ['not-a-timestamp', '1735776000000.5', 'NaN', 'Infinity', '0x1941f297c00'].forEach(
      (effectiveEndDate) => {
        expectEffectiveEndDateRejected(
          validateCommissionRuleCreateForTest({
            ...createRuleValues(),
            effectiveEndDate,
          }),
        );
        expectDraftEffectiveEndDateRejected(
          validateCommissionRuleDraftCoreForTest({
            ...draftRuleValues(),
            effectiveEndDate,
          }),
        );
      },
    );
  });

  it('shapes Commission Settlement create payloads without derived totals, snapshots, or scope', () => {
    const payload = parseCommissionSettlementCreateForTest({
      title: 'Wave 9 settlement',
      sourceRuleId: 'commission-rule-001',
      settlementPeriodStartAt: '1000',
      settlementPeriodEndAt: '2000',
      revenueEntryIds: [{ revenueEntryId: 'revenue-entry-001' }],
      description: '',
      externalRef: 'SET-EXT',
    });
    const sanitized = sanitizeCommissionSettlementCreatePayload({
      ...payload,
      settlementAmount: 1,
      grossRevenueAmount: 1,
      settlementCurrencyCode: 'USD',
      lines: [],
      scope: 'global',
    } as typeof payload & Record<string, unknown>);

    expect(sanitized).toEqual({
      title: 'Wave 9 settlement',
      sourceRuleId: 'commission-rule-001',
      settlementPeriodStartAt: 1000,
      settlementPeriodEndAt: 2000,
      revenueEntryIds: ['revenue-entry-001'],
      description: null,
      externalRef: 'SET-EXT',
    });
    expect(sanitized).not.toHaveProperty('settlementCode');
    expect(JSON.stringify(sanitized)).not.toContain('settlementAmount');
    expect(JSON.stringify(sanitized)).not.toContain('grossRevenueAmount');
    expect(JSON.stringify(sanitized)).not.toContain('scope');
  });

  it('shapes Settlement draft-core and revenue-entry full replacement payloads only', () => {
    const draftPayload = sanitizeCommissionSettlementDraftCorePayload({
      ...parseCommissionSettlementDraftCoreForTest({
        title: 'Edited settlement',
        settlementPeriodStartAt: '1000',
        settlementPeriodEndAt: '2000',
        description: '',
        externalRef: '',
      }),
      revenueEntryIds: ['revenue-entry-leak'],
      settlementAmount: 100,
    } as Record<string, unknown>);
    const replacementPayload = sanitizeCommissionSettlementRevenueEntriesPayload(
      parseCommissionSettlementRevenueEntriesForTest({
        revenueEntryIds: [
          { revenueEntryId: 'revenue-entry-001' },
          { revenueEntryId: 'revenue-entry-002' },
        ],
      }),
    );

    expect(draftPayload).toEqual({
      title: 'Edited settlement',
      settlementPeriodStartAt: 1000,
      settlementPeriodEndAt: 2000,
      description: null,
      externalRef: null,
    });
    expect(replacementPayload).toEqual({
      revenueEntryIds: ['revenue-entry-001', 'revenue-entry-002'],
    });
    expect(JSON.stringify(draftPayload)).not.toContain('revenueEntryIds');
    expect(JSON.stringify(draftPayload)).not.toContain('settlementAmount');
    expect(JSON.stringify(replacementPayload)).not.toContain('add');
    expect(JSON.stringify(replacementPayload)).not.toContain('remove');
    expect(JSON.stringify(replacementPayload)).not.toContain('line');
  });

  it('gates Settlement detail actions by status without reopen, unvoid, or unfinalize paths', () => {
    expect(canEditCommissionSettlementDraftCore('DRAFT')).toBe(true);
    expect(canReplaceCommissionSettlementRevenueEntries('DRAFT')).toBe(true);
    expect(canFinalizeCommissionSettlement('DRAFT')).toBe(true);
    expect(canVoidCommissionSettlement('FINALIZED')).toBe(true);
    expect(canArchiveCommissionSettlement('DRAFT')).toBe(true);
    expect(canArchiveCommissionSettlement('VOIDED')).toBe(true);
    expect(canFinalizeCommissionSettlement('FINALIZED')).toBe(false);
    expect(canVoidCommissionSettlement('DRAFT')).toBe(false);
    expect(canArchiveCommissionSettlement('FINALIZED')).toBe(false);
    expect(canEditCommissionSettlementDraftCore('ARCHIVED')).toBe(false);
  });
});
