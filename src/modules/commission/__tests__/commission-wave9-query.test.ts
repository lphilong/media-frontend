import {
  fetchCommissionRulesByBeneficiary,
  fetchCommissionRulesByContract,
  fetchCommissionSettlementsByBeneficiary,
  fetchCommissionSettlementsByRevenueEntry,
  fetchCommissionSettlementsBySubjectTalent,
} from '@modules/commission/api/commission.api';
import {
  commissionRulesByBeneficiaryQueryConfig,
  commissionRulesByContractQueryConfig,
  commissionRulesFlatListQueryConfig,
  commissionSettlementsByBeneficiaryQueryConfig,
  commissionSettlementsByRevenueEntryQueryConfig,
  commissionSettlementsBySubjectTalentQueryConfig,
  commissionSettlementsFlatListQueryConfig,
} from '@modules/commission';
import {
  parseScreenQueryParams,
  serializeScreenQueryParams,
  type QueryParamSchema,
  type ScreenQueryConfig,
} from '@shared/query';

const serializeParsed = <TSchema extends QueryParamSchema>(
  params: string,
  config: ScreenQueryConfig<TSchema>,
): URLSearchParams =>
  serializeScreenQueryParams(parseScreenQueryParams(new URLSearchParams(params), config), config);

describe('commission Wave 9 query contracts', () => {
  it('parses and builds the Commission Rule flat list without scope or unsupported keys', () => {
    const serialized = serializeParsed(
      [
        'status=DRAFT',
        'settlementKind=REVENUE_SHARE',
        'beneficiaryKind=TALENT',
        'beneficiaryTalentId=talent-001',
        'sourceContractRecordId=contract-record-001',
        'appliesToRevenueKind=PLATFORM_LIVESTREAM',
        'windowStartDate=1735689600000',
        'windowEndDate=1735776000000',
        'limit=25',
        'cursor=opaque',
        'search=CRULE-000001',
        'sortBy=effectiveStartDate',
        'sortDirection=desc',
        'scope=global',
        'scopeGrants=x',
        'unexpected=value',
      ].join('&'),
      commissionRulesFlatListQueryConfig,
    );

    expect(serialized.get('status')).toBe('DRAFT');
    expect(serialized.get('beneficiaryKind')).toBe('TALENT');
    expect(serialized.get('beneficiaryTalentId')).toBe('talent-001');
    expect(serialized.get('beneficiaryEmploymentProfileId')).toBeNull();
    expect(serialized.get('windowStartDate')).toBe('1735689600000');
    expect(serialized.get('windowEndDate')).toBe('1735776000000');
    expect(serialized.get('search')).toBe('CRULE-000001');
    expect(serialized.get('scope')).toBeNull();
    expect(serialized.get('scopeGrants')).toBeNull();
    expect(serialized.get('unexpected')).toBeNull();
  });

  it('keeps Commission Rule related list routes identity-bound and search-free', () => {
    const byBeneficiary = serializeParsed(
      'view=by-beneficiary&beneficiaryKind=TALENT&beneficiaryTalentId=talent-001&search=nope&scope=global&sortBy=ruleCode',
      commissionRulesByBeneficiaryQueryConfig,
    );
    const byContract = serializeParsed(
      'view=by-contract&sourceContractRecordId=contract-record-001&search=nope&sortBy=createdAt',
      commissionRulesByContractQueryConfig,
    );
    const invalidBeneficiary = serializeScreenQueryParams(
      {
        view: 'by-beneficiary',
        beneficiaryKind: 'EMPLOYMENT_PROFILE',
        beneficiaryTalentId: 'talent-001',
      },
      commissionRulesByBeneficiaryQueryConfig,
    );

    expect(byBeneficiary.get('view')).toBe('by-beneficiary');
    expect(byBeneficiary.get('beneficiaryKind')).toBe('TALENT');
    expect(byBeneficiary.get('beneficiaryTalentId')).toBe('talent-001');
    expect(byBeneficiary.get('search')).toBeNull();
    expect(byBeneficiary.get('scope')).toBeNull();
    expect(byContract.get('view')).toBe('by-contract');
    expect(byContract.get('sourceContractRecordId')).toBe('contract-record-001');
    expect(byContract.get('search')).toBeNull();
    expect(invalidBeneficiary.get('view')).toBeNull();
  });

  it('rejects non-midnight rule timestamps and treats blank timestamp values as absent', () => {
    const invalidMidnight = serializeScreenQueryParams(
      {
        windowStartDate: 1735689600001,
        windowEndDate: 1735776000000,
      },
      commissionRulesFlatListQueryConfig,
    );
    const blanks = serializeParsed(
      'windowStartDate=&windowEndDate=%20&limit=%20',
      commissionRulesFlatListQueryConfig,
    );

    expect(invalidMidnight.get('windowStartDate')).toBeNull();
    expect(invalidMidnight.get('windowEndDate')).toBe('1735776000000');
    expect(blanks.get('windowStartDate')).toBeNull();
    expect(blanks.get('windowEndDate')).toBeNull();
    expect(blanks.get('limit')).toBeNull();
  });

  it('parses and builds the Commission Settlement flat list without scope or derived query drift', () => {
    const serialized = serializeParsed(
      [
        'status=DRAFT',
        'settlementKindSnapshot=REVENUE_SHARE',
        'beneficiaryKindSnapshot=TALENT',
        'beneficiaryTalentIdSnapshot=talent-001',
        'subjectTalentId=talent-001',
        'sourceRuleId=commission-rule-001',
        'containsRevenueEntryId=revenue-entry-001',
        'settlementCurrencyCode=VND',
        'windowStartAt=1000',
        'windowEndAt=2000',
        'createdBeforeAt=3000',
        'finalizedFromAt=4000',
        'finalizedToAt=5000',
        'search=CS-202604-000001',
        'sortBy=finalizedAt',
        'sortDirection=asc',
        'scope=global',
        'scopeGrants=x',
        'sourceContractRecordId=unsupported',
      ].join('&'),
      commissionSettlementsFlatListQueryConfig,
    );

    expect(serialized.get('status')).toBe('DRAFT');
    expect(serialized.get('beneficiaryKindSnapshot')).toBe('TALENT');
    expect(serialized.get('beneficiaryTalentIdSnapshot')).toBe('talent-001');
    expect(serialized.get('containsRevenueEntryId')).toBe('revenue-entry-001');
    expect(serialized.get('settlementCurrencyCode')).toBe('VND');
    expect(serialized.get('windowStartAt')).toBe('1000');
    expect(serialized.get('createdBeforeAt')).toBe('3000');
    expect(serialized.get('finalizedFromAt')).toBe('4000');
    expect(serialized.get('finalizedToAt')).toBe('5000');
    expect(serialized.get('search')).toBe('CS-202604-000001');
    expect(serialized.get('scope')).toBeNull();
    expect(serialized.get('scopeGrants')).toBeNull();
    expect(serialized.get('sourceContractRecordId')).toBeNull();
  });

  it('keeps all Commission Settlement related list routes identity-bound and search-free', () => {
    const byBeneficiary = serializeParsed(
      'view=by-beneficiary&beneficiaryKindSnapshot=EMPLOYMENT_PROFILE&beneficiaryEmploymentProfileIdSnapshot=ep-001&search=nope',
      commissionSettlementsByBeneficiaryQueryConfig,
    );
    const bySubjectTalent = serializeParsed(
      'view=by-subject-talent&subjectTalentId=talent-001&search=nope&scope=global',
      commissionSettlementsBySubjectTalentQueryConfig,
    );
    const byRevenueEntry = serializeParsed(
      'view=by-revenue-entry&revenueEntryId=revenue-entry-001&search=nope',
      commissionSettlementsByRevenueEntryQueryConfig,
    );
    const invalidBeneficiary = serializeScreenQueryParams(
      {
        view: 'by-beneficiary',
        beneficiaryKindSnapshot: 'TALENT',
        beneficiaryEmploymentProfileIdSnapshot: 'ep-001',
      },
      commissionSettlementsByBeneficiaryQueryConfig,
    );

    expect(byBeneficiary.get('view')).toBe('by-beneficiary');
    expect(byBeneficiary.get('search')).toBeNull();
    expect(bySubjectTalent.get('view')).toBe('by-subject-talent');
    expect(bySubjectTalent.get('subjectTalentId')).toBe('talent-001');
    expect(bySubjectTalent.get('scope')).toBeNull();
    expect(byRevenueEntry.get('view')).toBe('by-revenue-entry');
    expect(byRevenueEntry.get('revenueEntryId')).toBe('revenue-entry-001');
    expect(invalidBeneficiary.get('view')).toBeNull();
  });

  it('parses Commission Rule related lists as rule list items', async () => {
    const byBeneficiary = await fetchCommissionRulesByBeneficiary({
      beneficiaryKind: 'TALENT',
      beneficiaryTalentId: 'talent-001',
      limit: 1,
    });
    const byContract = await fetchCommissionRulesByContract({
      sourceContractRecordId: 'contract-record-001',
      limit: 10,
    });

    const byContractRule = byContract.data.find((item) => item.id === 'commission-rule-001');

    for (const item of [byBeneficiary.data[0], byContractRule]) {
      expect(item).toMatchObject({
        id: 'commission-rule-001',
        ruleCode: 'CRULE-000001',
        sourceContractRecordId: 'contract-record-001',
        beneficiaryTalentId: 'talent-001',
        createdAt: 1776815990000,
      });
      expect(item?.sourceContractRecordRef?.id).toBe(item?.sourceContractRecordId);
      expect(item?.id).not.toBe(item?.ruleCode);
    }
  });

  it('parses by-beneficiary Settlement related lists as full list items', async () => {
    const byBeneficiary = await fetchCommissionSettlementsByBeneficiary({
      beneficiaryKindSnapshot: 'TALENT',
      beneficiaryTalentIdSnapshot: 'talent-001',
      limit: 1,
    });

    expect(byBeneficiary.data[0]).toMatchObject({
      id: 'commission-settlement-001',
      settlementCode: 'CS-202604-000001',
      sourceRuleId: 'commission-rule-001',
      revenueEntryIds: ['revenue-entry-001'],
      grossRevenueAmount: 1250000,
      finalizedAt: null,
      createdAt: 1776815990000,
    });
    expect(byBeneficiary.data[0]?.revenueEntryRefs?.map((ref) => ref.id)).toEqual(
      byBeneficiary.data[0]?.revenueEntryIds,
    );
    expect(byBeneficiary.data[0]?.id).not.toBe(byBeneficiary.data[0]?.settlementCode);
  });

  it('parses by-subject-talent and by-revenue-entry Settlement related lists as full list items', async () => {
    const bySubjectTalent = await fetchCommissionSettlementsBySubjectTalent({
      subjectTalentId: 'talent-001',
      limit: 1,
    });
    const byRevenueEntry = await fetchCommissionSettlementsByRevenueEntry({
      revenueEntryId: 'revenue-entry-001',
      limit: 1,
    });

    for (const item of [bySubjectTalent.data[0], byRevenueEntry.data[0]]) {
      expect(item).toMatchObject({
        id: 'commission-settlement-001',
        settlementCode: 'CS-202604-000001',
        title: 'April livestream settlement',
        sourceRuleId: 'commission-rule-001',
        settlementKindSnapshot: 'REVENUE_SHARE',
        beneficiaryKindSnapshot: 'TALENT',
        beneficiaryEmploymentProfileIdSnapshot: null,
        beneficiaryTalentIdSnapshot: 'talent-001',
        subjectTalentId: 'talent-001',
        revenueEntryIds: ['revenue-entry-001'],
        beneficiaryRef: {
          id: 'talent-001',
          code: 'TAL-001',
          name: 'Luna',
          status: 'ACTIVE',
        },
        sourceRuleRef: {
          id: 'commission-rule-001',
          code: 'CRULE-000001',
          title: 'April livestream revenue share',
          status: 'DRAFT',
        },
        revenueEntryRefs: [
          {
            id: 'revenue-entry-001',
            code: 'REV-202604-000001',
            title: 'April livestream revenue',
            status: 'FINALIZED',
          },
        ],
        settlementCurrencyCode: 'VND',
        grossRevenueAmount: 1250000,
        settlementAmount: 156250,
        status: 'DRAFT',
        settlementPeriodStartAt: 1776729600000,
        settlementPeriodEndAt: 1776816000000,
        finalizedAt: null,
        createdAt: 1776815990000,
      });
      expect(item?.revenueEntryRefs?.map((ref) => ref.id)).toEqual(item?.revenueEntryIds);
      expect(item).not.toHaveProperty('revenueEntryRef');
    }
  });

  it('keeps blank settlement timestamp values absent instead of coercing them to zero', () => {
    const serialized = serializeParsed(
      'windowStartAt=&windowEndAt=%20&limit=%20',
      commissionSettlementsFlatListQueryConfig,
    );

    expect(serialized.get('windowStartAt')).toBeNull();
    expect(serialized.get('windowEndAt')).toBeNull();
    expect(serialized.get('limit')).toBeNull();
  });

  it('does not allow Commission Rule queries to inherit settlement target filters', () => {
    const serialized = serializeScreenQueryParams(
      {
        status: 'ACTIVE',
        createdBeforeAt: 1000,
        finalizedFromAt: 2000,
        finalizedToAt: 3000,
      },
      commissionRulesFlatListQueryConfig,
    );

    expect(serialized.get('status')).toBe('ACTIVE');
    expect(serialized.get('createdBeforeAt')).toBeNull();
    expect(serialized.get('finalizedFromAt')).toBeNull();
    expect(serialized.get('finalizedToAt')).toBeNull();
  });
});
