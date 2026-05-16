import {
  commissionRulesByBeneficiaryQueryConfig,
  commissionRulesByContractQueryConfig,
  commissionRulesFlatListQueryConfig,
  commissionSettlementsByBeneficiaryQueryConfig,
  commissionSettlementsByRevenueEntryQueryConfig,
  commissionSettlementsBySubjectTalentQueryConfig,
  commissionSettlementsFlatListQueryConfig,
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

  it('keeps blank settlement timestamp values absent instead of coercing them to zero', () => {
    const serialized = serializeParsed(
      'windowStartAt=&windowEndAt=%20&limit=%20',
      commissionSettlementsFlatListQueryConfig,
    );

    expect(serialized.get('windowStartAt')).toBeNull();
    expect(serialized.get('windowEndAt')).toBeNull();
    expect(serialized.get('limit')).toBeNull();
  });
});
