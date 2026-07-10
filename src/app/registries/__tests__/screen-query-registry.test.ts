import {
  commissionRulesByBeneficiaryQueryConfig,
  commissionRulesByContractQueryConfig,
  commissionRulesFlatListQueryConfig,
  commissionSettlementsByBeneficiaryQueryConfig,
  commissionSettlementsByRevenueEntryQueryConfig,
  commissionSettlementsBySubjectTalentQueryConfig,
  commissionSettlementsFlatListQueryConfig,
  contractRegistryByLinkedEntityQueryConfig,
  contractRegistryByOwnerQueryConfig,
  contractRegistryFlatListQueryConfig,
  mergeScreenQueryParams,
  employmentProfileDirectReportsQueryConfig,
  employmentProfileFlatListQueryConfig,
  orgUnitFlatListQueryConfig,
  parseScreenQueryParams,
  revenueLedgerByEventQueryConfig,
  revenueLedgerByPlatformQueryConfig,
  revenueLedgerByTalentQueryConfig,
  revenueLedgerFlatListQueryConfig,
  serializeScreenQueryParams,
  talentFlatListQueryConfig,
  talentGroupByTalentQueryConfig,
  talentGroupFlatListQueryConfig,
  type QueryParamSchema,
  type QueryShape,
  type ScreenQueryConfig,
} from '@app/registries/screen-query-registry';
import * as sharedQuery from '@app/registries/screen-query-registry';
import {
  workShiftByResourceQueryConfig,
  workShiftFlatListQueryConfig,
} from '@modules/work-schedule';

describe('shared query seam hardening', () => {
  it('drops unsupported params and related-route search during parse/build', () => {
    const parsed = parseScreenQueryParams(
      new URLSearchParams(
        'view=by-talent&subjectTalentId=talent-01&search=leak&unexpected=value&sortBy=recognizedAt',
      ),
      revenueLedgerByTalentQueryConfig,
    );
    const serialized = serializeScreenQueryParams(parsed, revenueLedgerByTalentQueryConfig);

    expect(serialized.get('view')).toBe('by-talent');
    expect(serialized.get('subjectTalentId')).toBe('talent-01');
    expect(serialized.get('sortBy')).toBe('recognizedAt');
    expect(serialized.get('search')).toBeNull();
    expect(serialized.get('unexpected')).toBeNull();
  });

  it('enforces Org Unit flat-list filters and drops conflicting root/parent combinations', () => {
    const serialized = serializeScreenQueryParams(
      {
        rootOnly: true,
        parentOrgUnitId: 'ou-root',
        status: 'ACTIVE',
        sortDirection: 'desc',
      },
      orgUnitFlatListQueryConfig,
    );

    expect(serialized.get('rootOnly')).toBe('true');
    expect(serialized.get('parentOrgUnitId')).toBeNull();
    expect(serialized.get('status')).toBe('ACTIVE');
    expect(serialized.get('sortDirection')).toBeNull();
  });

  it('enforces Employment Profile flat-list query booleans and enum constraints', () => {
    const parsed = parseScreenQueryParams(
      new URLSearchParams(
        'employmentStatus=ACTIVE&contractStatus=ACTIVE&hasLinkedUser=true&unsupported=value',
      ),
      employmentProfileFlatListQueryConfig,
    );
    const serialized = serializeScreenQueryParams(parsed, employmentProfileFlatListQueryConfig);

    expect(serialized.get('employmentStatus')).toBe('ACTIVE');
    expect(serialized.get('contractStatus')).toBe('ACTIVE');
    expect(serialized.get('hasLinkedUser')).toBe('true');
    expect(serialized.get('unsupported')).toBeNull();
  });

  it('enforces Talent flat-list query booleans, exact enum filters, and supported sort keys', () => {
    const parsed = parseScreenQueryParams(
      new URLSearchParams(
        'operationalStatus=ACTIVE&talentOrigin=INTERNAL&commercialParticipationStatus=ELIGIBLE&hasLinkedEmploymentProfile=true&livestreamEligible=false&eventEligible=true&sortBy=stageName&unsupported=value',
      ),
      talentFlatListQueryConfig,
    );
    const invalidSerialized = serializeScreenQueryParams(
      {
        talentOrigin: 'PARTNER',
        commercialParticipationStatus: 'PENDING_REVIEW',
      },
      talentFlatListQueryConfig,
    );
    const serialized = serializeScreenQueryParams(parsed, talentFlatListQueryConfig);

    expect(serialized.get('operationalStatus')).toBe('ACTIVE');
    expect(serialized.get('talentOrigin')).toBe('INTERNAL');
    expect(serialized.get('commercialParticipationStatus')).toBe('ELIGIBLE');
    expect(serialized.get('hasLinkedEmploymentProfile')).toBe('true');
    expect(serialized.get('livestreamEligible')).toBe('false');
    expect(serialized.get('eventEligible')).toBe('true');
    expect(serialized.get('sortBy')).toBe('stageName');
    expect(serialized.get('unsupported')).toBeNull();
    expect(invalidSerialized.get('talentOrigin')).toBeNull();
    expect(invalidSerialized.get('commercialParticipationStatus')).toBeNull();
  });

  it('enforces Talent Group flat-list and by-talent related query restrictions', () => {
    const flatSerialized = serializeScreenQueryParams(
      {
        status: 'INACTIVE',
        containsTalentId: 'talent-01',
        search: 'alpha',
        sortBy: 'displayOrder',
      },
      talentGroupFlatListQueryConfig,
    );
    const relatedSerialized = serializeScreenQueryParams(
      {
        view: 'by-talent',
        talentId: 'talent-01',
        status: 'ACTIVE',
        search: 'not-allowed',
        sortBy: 'name',
      },
      talentGroupByTalentQueryConfig,
    );
    const relatedMissingIdentity = serializeScreenQueryParams(
      {
        view: 'by-talent',
      },
      talentGroupByTalentQueryConfig,
    );

    expect(flatSerialized.get('status')).toBe('INACTIVE');
    expect(flatSerialized.get('containsTalentId')).toBe('talent-01');
    expect(flatSerialized.get('search')).toBe('alpha');
    expect(flatSerialized.get('sortBy')).toBe('displayOrder');
    expect(relatedSerialized.get('view')).toBe('by-talent');
    expect(relatedSerialized.get('talentId')).toBe('talent-01');
    expect(relatedSerialized.get('status')).toBe('ACTIVE');
    expect(relatedSerialized.get('search')).toBeNull();
    expect(relatedSerialized.get('sortBy')).toBe('name');
    expect(relatedMissingIdentity.get('view')).toBeNull();
    expect(relatedMissingIdentity.get('talentId')).toBeNull();
  });

  it('keeps Employment Profile direct-reports query fail-closed with no search support', () => {
    const serialized = serializeScreenQueryParams(
      {
        view: 'direct-reports',
        search: 'leak',
        sortBy: 'displayName',
        sortDirection: 'desc',
      },
      employmentProfileDirectReportsQueryConfig,
    );

    expect(serialized.get('view')).toBe('direct-reports');
    expect(serialized.get('sortBy')).toBe('displayName');
    expect(serialized.get('sortDirection')).toBe('desc');
    expect(serialized.get('search')).toBeNull();
  });

  it('fails closed on invalid enum and format values for commercial query filters', () => {
    const parsedRules = parseScreenQueryParams(
      new URLSearchParams(
        'status=BROKEN&settlementKind=UNSUPPORTED&appliesToRevenueKind=UNKNOWN&sortBy=invalid&sortDirection=sideways&search=rule',
      ),
      commissionRulesFlatListQueryConfig,
    );
    const serializedRules = serializeScreenQueryParams(
      parsedRules,
      commissionRulesFlatListQueryConfig,
    );
    const invalidRevenue = serializeScreenQueryParams(
      {
        revenueKind: 'UNKNOWN_KIND',
        entrySource: 'AUTO',
        currencyCode: 'usd',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const validRevenue = serializeScreenQueryParams(
      {
        revenueKind: 'EVENT_OPERATIONAL',
        entrySource: 'MANUAL',
        currencyCode: 'USD',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const invalidContract = serializeScreenQueryParams(
      {
        contractKind: 'UNKNOWN_KIND',
        confidentialityTier: 'STANDARD',
      },
      contractRegistryFlatListQueryConfig,
    );
    const validContract = serializeScreenQueryParams(
      {
        contractKind: 'TALENT_SERVICE',
        confidentialityTier: 'INTERNAL',
      },
      contractRegistryFlatListQueryConfig,
    );
    const invalidSettlement = serializeScreenQueryParams(
      {
        settlementKindSnapshot: 'UNSUPPORTED',
        settlementCurrencyCode: 'vnd',
      },
      commissionSettlementsFlatListQueryConfig,
    );

    expect(serializedRules.get('search')).toBe('rule');
    expect(serializedRules.get('status')).toBeNull();
    expect(serializedRules.get('settlementKind')).toBeNull();
    expect(serializedRules.get('appliesToRevenueKind')).toBeNull();
    expect(serializedRules.get('sortBy')).toBeNull();
    expect(serializedRules.get('sortDirection')).toBeNull();
    expect(invalidRevenue.get('revenueKind')).toBeNull();
    expect(invalidRevenue.get('entrySource')).toBeNull();
    expect(invalidRevenue.get('currencyCode')).toBeNull();
    expect(validRevenue.get('revenueKind')).toBe('EVENT_OPERATIONAL');
    expect(validRevenue.get('entrySource')).toBe('MANUAL');
    expect(validRevenue.get('currencyCode')).toBe('USD');
    expect(invalidContract.get('contractKind')).toBeNull();
    expect(invalidContract.get('confidentialityTier')).toBeNull();
    expect(validContract.get('contractKind')).toBe('TALENT_SERVICE');
    expect(validContract.get('confidentialityTier')).toBe('INTERNAL');
    expect(invalidSettlement.get('settlementKindSnapshot')).toBeNull();
    expect(invalidSettlement.get('settlementCurrencyCode')).toBeNull();
  });

  it('keeps target timestamp URL params serialized as raw milliseconds for display-only chip formatting', () => {
    const revenueLedger = serializeScreenQueryParams(
      {
        createdBeforeAt: 1780000000000,
        finalizedFromAt: 1770000000000,
        finalizedToAt: 1780000000000,
        reconciledFromAt: 1770000000000,
        reconciledToAt: 1780000000000,
      },
      revenueLedgerFlatListQueryConfig,
    );
    const commissionSettlements = serializeScreenQueryParams(
      {
        createdBeforeAt: 1780000000000,
        finalizedFromAt: 1770000000000,
        finalizedToAt: 1780000000000,
      },
      commissionSettlementsFlatListQueryConfig,
    );

    expect(revenueLedger.get('createdBeforeAt')).toBe('1780000000000');
    expect(revenueLedger.get('finalizedFromAt')).toBe('1770000000000');
    expect(revenueLedger.get('finalizedToAt')).toBe('1780000000000');
    expect(revenueLedger.get('reconciledFromAt')).toBe('1770000000000');
    expect(revenueLedger.get('reconciledToAt')).toBe('1780000000000');
    expect(commissionSettlements.get('createdBeforeAt')).toBe('1780000000000');
    expect(commissionSettlements.get('finalizedFromAt')).toBe('1770000000000');
    expect(commissionSettlements.get('finalizedToAt')).toBe('1780000000000');
  });

  it('accepts Batch 2E-B Revenue Ledger target timestamp filters and treats them as query-shape filters', () => {
    const current = serializeScreenQueryParams(
      {
        status: 'RECONCILED',
        createdBeforeAt: 1000,
        finalizedFromAt: 2000,
        finalizedToAt: 3000,
        reconciledFromAt: 4000,
        reconciledToAt: 5000,
        windowStartAt: 6000,
        windowEndAt: 7000,
        cursor: 'opaque',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const next = mergeScreenQueryParams(
      current,
      { reconciledToAt: 6000 },
      revenueLedgerFlatListQueryConfig,
      { resetCursorOnChange: true },
    );
    const invalid = serializeScreenQueryParams(
      {
        finalizedFromAt: 3000,
        finalizedToAt: 2000,
        reconciledFromAt: 5000,
        reconciledToAt: 5000,
      },
      revenueLedgerFlatListQueryConfig,
    );

    expect(current.get('status')).toBe('RECONCILED');
    expect(current.get('createdBeforeAt')).toBe('1000');
    expect(current.get('finalizedFromAt')).toBe('2000');
    expect(current.get('finalizedToAt')).toBe('3000');
    expect(current.get('reconciledFromAt')).toBe('4000');
    expect(current.get('reconciledToAt')).toBe('5000');
    expect(current.get('windowStartAt')).toBe('6000');
    expect(current.get('windowEndAt')).toBe('7000');
    expect(next.get('reconciledToAt')).toBe('6000');
    expect(next.get('cursor')).toBeNull();
    expect(invalid.get('finalizedFromAt')).toBeNull();
    expect(invalid.get('finalizedToAt')).toBeNull();
    expect(invalid.get('reconciledFromAt')).toBeNull();
    expect(invalid.get('reconciledToAt')).toBeNull();
  });

  it('accepts Batch 2E-B Commission Settlement target timestamp filters without changing rule queries', () => {
    const settlements = serializeScreenQueryParams(
      parseScreenQueryParams(
        new URLSearchParams(
          'status=FINALIZED&createdBeforeAt=1000&finalizedFromAt=2000&finalizedToAt=3000&windowStartAt=4000&windowEndAt=5000',
        ),
        commissionSettlementsFlatListQueryConfig,
      ),
      commissionSettlementsFlatListQueryConfig,
    );
    const rules = serializeScreenQueryParams(
      {
        status: 'ACTIVE',
        createdBeforeAt: 1000,
        finalizedFromAt: 2000,
        finalizedToAt: 3000,
      },
      commissionRulesFlatListQueryConfig,
    );

    expect(settlements.get('status')).toBe('FINALIZED');
    expect(settlements.get('createdBeforeAt')).toBe('1000');
    expect(settlements.get('finalizedFromAt')).toBe('2000');
    expect(settlements.get('finalizedToAt')).toBe('3000');
    expect(settlements.get('windowStartAt')).toBe('4000');
    expect(settlements.get('windowEndAt')).toBe('5000');
    expect(rules.get('status')).toBe('ACTIVE');
    expect(rules.get('createdBeforeAt')).toBeNull();
    expect(rules.get('finalizedFromAt')).toBeNull();
    expect(rules.get('finalizedToAt')).toBeNull();
  });

  it('keeps Wave 8 flat identity filters flat unless an explicit related view is present', () => {
    const revenueSubject = serializeScreenQueryParams(
      {
        subjectTalentId: 'talent-01',
        search: 'REV001',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const revenueSubjectThroughRelated = serializeScreenQueryParams(
      {
        subjectTalentId: 'talent-01',
        search: 'REV001',
      },
      revenueLedgerByTalentQueryConfig,
    );
    const revenuePlatformThroughRelated = serializeScreenQueryParams(
      {
        attributionPlatformAccountId: 'platform-01',
      },
      revenueLedgerByPlatformQueryConfig,
    );
    const revenueEventThroughRelated = serializeScreenQueryParams(
      {
        attributionEventId: 'event-01',
      },
      revenueLedgerByEventQueryConfig,
    );
    const explicitRevenueRelated = serializeScreenQueryParams(
      {
        view: 'by-platform',
        attributionPlatformAccountId: 'platform-01',
        search: 'not-supported',
      },
      revenueLedgerByPlatformQueryConfig,
    );

    expect(revenueSubject.get('view')).toBeNull();
    expect(revenueSubject.get('subjectTalentId')).toBe('talent-01');
    expect(revenueSubject.get('search')).toBe('REV001');
    expect(revenueSubjectThroughRelated.get('view')).toBeNull();
    expect(revenuePlatformThroughRelated.get('view')).toBeNull();
    expect(revenueEventThroughRelated.get('view')).toBeNull();
    expect(explicitRevenueRelated.get('view')).toBe('by-platform');
    expect(explicitRevenueRelated.get('attributionPlatformAccountId')).toBe('platform-01');
    expect(explicitRevenueRelated.get('search')).toBeNull();
  });

  it('resets cursor when effective query shape changes', () => {
    const current = serializeScreenQueryParams(
      {
        search: 'revenue',
        cursor: 'opaque-cursor',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const next = mergeScreenQueryParams(
      current,
      {
        search: 'settlement',
      },
      revenueLedgerFlatListQueryConfig,
      {
        resetCursorOnChange: true,
      },
    );

    expect(next.get('search')).toBe('settlement');
    expect(next.get('cursor')).toBeNull();
  });

  it('keeps cursor when only cursor changes', () => {
    const current = serializeScreenQueryParams(
      {
        search: 'revenue',
        cursor: 'opaque-cursor',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const next = mergeScreenQueryParams(
      current,
      {
        cursor: 'opaque-next',
      },
      revenueLedgerFlatListQueryConfig,
      {
        resetCursorOnChange: true,
      },
    );

    expect(next.get('search')).toBe('revenue');
    expect(next.get('cursor')).toBe('opaque-next');
  });

  it('rejects invalid Contract Registry date filters and invalid date windows', () => {
    const invalidDateFormat = serializeScreenQueryParams(
      {
        windowStartDate: '2026-02-30',
        windowEndDate: '2026-03-05',
      },
      contractRegistryFlatListQueryConfig,
    );
    const invalidDateWindow = serializeScreenQueryParams(
      {
        windowStartDate: '2026-03-10',
        windowEndDate: '2026-03-01',
        effectiveEndDateFrom: '2026-05-01',
        effectiveEndDateTo: '2026-05-31',
      },
      contractRegistryFlatListQueryConfig,
    );
    const invalidEffectiveEndDateWindow = serializeScreenQueryParams(
      {
        effectiveEndDateFrom: '2026-06-01',
        effectiveEndDateTo: '2026-05-01',
      },
      contractRegistryFlatListQueryConfig,
    );

    expect(invalidDateFormat.get('windowStartDate')).toBeNull();
    expect(invalidDateFormat.get('windowEndDate')).toBe('2026-03-05');
    expect(invalidDateWindow.get('windowStartDate')).toBeNull();
    expect(invalidDateWindow.get('windowEndDate')).toBeNull();
    expect(invalidDateWindow.get('effectiveEndDateFrom')).toBe('2026-05-01');
    expect(invalidDateWindow.get('effectiveEndDateTo')).toBe('2026-05-31');
    expect(invalidEffectiveEndDateWindow.get('effectiveEndDateFrom')).toBeNull();
    expect(invalidEffectiveEndDateWindow.get('effectiveEndDateTo')).toBeNull();
  });

  it('rejects invalid timestamp windows and invalid UTC-midnight rule windows', () => {
    const invalidRevenueWindow = serializeScreenQueryParams(
      {
        windowStartAt: 1000,
        windowEndAt: 1000,
      },
      revenueLedgerFlatListQueryConfig,
    );
    const invalidUtcMidnight = serializeScreenQueryParams(
      {
        windowStartDate: 1735689600001,
        windowEndDate: 1735776000000,
      },
      commissionRulesFlatListQueryConfig,
    );
    const invalidUtcWindow = serializeScreenQueryParams(
      {
        windowStartDate: 1735776000000,
        windowEndDate: 1735689600000,
      },
      commissionRulesFlatListQueryConfig,
    );

    expect(invalidRevenueWindow.get('windowStartAt')).toBeNull();
    expect(invalidRevenueWindow.get('windowEndAt')).toBeNull();
    expect(invalidUtcMidnight.get('windowStartDate')).toBeNull();
    expect(invalidUtcMidnight.get('windowEndDate')).toBe('1735776000000');
    expect(invalidUtcWindow.get('windowStartDate')).toBeNull();
    expect(invalidUtcWindow.get('windowEndDate')).toBeNull();
  });

  it('treats blank numeric and timestamp query values as absent before coercion', () => {
    const parsedRevenue = parseScreenQueryParams(
      new URLSearchParams('windowStartAt=&windowEndAt=%20%20%20&limit=%20%20'),
      revenueLedgerFlatListQueryConfig,
    );
    const revenueSerialized = serializeScreenQueryParams(
      parsedRevenue,
      revenueLedgerFlatListQueryConfig,
    );
    const parsedRuleWindow = parseScreenQueryParams(
      new URLSearchParams('windowStartDate=&windowEndDate=%20'),
      commissionRulesFlatListQueryConfig,
    );
    const ruleWindowSerialized = serializeScreenQueryParams(
      parsedRuleWindow,
      commissionRulesFlatListQueryConfig,
    );
    const invalidNumericValues = serializeScreenQueryParams(
      {
        windowStartAt: 'not-a-number',
        windowEndAt: 'NaN',
        limit: 'fifty',
      },
      revenueLedgerFlatListQueryConfig,
    );

    expect(revenueSerialized.get('windowStartAt')).toBeNull();
    expect(revenueSerialized.get('windowEndAt')).toBeNull();
    expect(revenueSerialized.get('limit')).toBeNull();
    expect(ruleWindowSerialized.get('windowStartDate')).toBeNull();
    expect(ruleWindowSerialized.get('windowEndDate')).toBeNull();
    expect(invalidNumericValues.get('windowStartAt')).toBeNull();
    expect(invalidNumericValues.get('windowEndAt')).toBeNull();
    expect(invalidNumericValues.get('limit')).toBeNull();
  });

  it('enforces Revenue Ledger flat-list narrow sort rules', () => {
    const allowedSort = serializeScreenQueryParams(
      {
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const blockedSort = serializeScreenQueryParams(
      {
        sortBy: 'createdAt',
        sortDirection: 'desc',
        search: 'draft',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const blockedByExplicitStatus = serializeScreenQueryParams(
      {
        sortBy: 'revenueEntryCode',
        sortDirection: 'asc',
        status: 'DRAFT',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const blockedByAttribution = serializeScreenQueryParams(
      {
        sortBy: 'createdAt',
        subjectTalentId: 'talent-01',
      },
      revenueLedgerFlatListQueryConfig,
    );
    const blockedByWindow = serializeScreenQueryParams(
      {
        sortBy: 'revenueEntryCode',
        windowStartAt: 1000,
        windowEndAt: 2000,
      },
      revenueLedgerFlatListQueryConfig,
    );
    const blockedByZeroWindowStart = serializeScreenQueryParams(
      {
        sortBy: 'createdAt',
        windowStartAt: 0,
      },
      revenueLedgerFlatListQueryConfig,
    );
    const blockedByZeroWindowEnd = serializeScreenQueryParams(
      {
        sortBy: 'revenueEntryCode',
        windowEndAt: 0,
      },
      revenueLedgerFlatListQueryConfig,
    );

    expect(allowedSort.get('sortBy')).toBe('createdAt');
    expect(allowedSort.get('sortDirection')).toBe('desc');
    expect(blockedSort.get('sortBy')).toBe('recognizedAt');
    expect(blockedSort.get('sortDirection')).toBe('desc');
    expect(blockedSort.get('search')).toBe('draft');
    expect(blockedByExplicitStatus.get('status')).toBe('DRAFT');
    expect(blockedByExplicitStatus.get('sortBy')).toBe('recognizedAt');
    expect(blockedByExplicitStatus.get('sortDirection')).toBe('asc');
    expect(blockedByAttribution.get('sortBy')).toBe('recognizedAt');
    expect(blockedByWindow.get('sortBy')).toBe('recognizedAt');
    expect(blockedByZeroWindowStart.get('windowStartAt')).toBe('0');
    expect(blockedByZeroWindowStart.get('sortBy')).toBe('recognizedAt');
    expect(blockedByZeroWindowEnd.get('windowEndAt')).toBe('0');
    expect(blockedByZeroWindowEnd.get('sortBy')).toBe('recognizedAt');
  });

  it('enforces Revenue Ledger related-route restrictions', () => {
    const relatedQuery = serializeScreenQueryParams(
      {
        view: 'by-event',
        attributionEventId: 'event-01',
        search: 'not-supported',
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
      revenueLedgerByEventQueryConfig,
    );

    expect(relatedQuery.get('view')).toBe('by-event');
    expect(relatedQuery.get('attributionEventId')).toBe('event-01');
    expect(relatedQuery.get('search')).toBeNull();
    expect(relatedQuery.get('sortBy')).toBeNull();
    expect(relatedQuery.get('sortDirection')).toBeNull();
  });

  it('keeps commercial global-only query configs from parsing or emitting scope fields', () => {
    const expectNoScope = <TSchema extends QueryParamSchema>(
      config: ScreenQueryConfig<TSchema>,
      validQuery: QueryShape,
    ) => {
      const parsed = parseScreenQueryParams(
        new URLSearchParams('scope=global&scopeGrants=x'),
        config,
      );
      const serialized = serializeScreenQueryParams(
        {
          ...validQuery,
          scope: 'global',
          scopeGrants: 'x',
        },
        config,
      );

      expect(parsed).not.toHaveProperty('scope');
      expect(parsed).not.toHaveProperty('scopeGrants');
      expect(serialized.get('scope')).toBeNull();
      expect(serialized.get('scopeGrants')).toBeNull();
    };

    expectNoScope(revenueLedgerFlatListQueryConfig, { status: 'DRAFT' });
    expectNoScope(revenueLedgerByTalentQueryConfig, {
      view: 'by-talent',
      subjectTalentId: 'talent-01',
    });
    expectNoScope(revenueLedgerByPlatformQueryConfig, {
      view: 'by-platform',
      attributionPlatformAccountId: 'platform-01',
    });
    expectNoScope(revenueLedgerByEventQueryConfig, {
      view: 'by-event',
      attributionEventId: 'event-01',
    });
    expectNoScope(commissionRulesFlatListQueryConfig, { status: 'DRAFT' });
    expectNoScope(commissionRulesByBeneficiaryQueryConfig, {
      view: 'by-beneficiary',
      beneficiaryKind: 'TALENT',
      beneficiaryTalentId: 'talent-01',
    });
    expectNoScope(commissionRulesByContractQueryConfig, {
      view: 'by-contract',
      sourceContractRecordId: 'contract-01',
    });
    expectNoScope(commissionSettlementsFlatListQueryConfig, { status: 'DRAFT' });
    expectNoScope(commissionSettlementsByBeneficiaryQueryConfig, {
      view: 'by-beneficiary',
      beneficiaryKindSnapshot: 'EMPLOYMENT_PROFILE',
      beneficiaryEmploymentProfileIdSnapshot: 'ep-01',
    });
    expectNoScope(commissionSettlementsBySubjectTalentQueryConfig, {
      view: 'by-subject-talent',
      subjectTalentId: 'talent-01',
    });
    expectNoScope(commissionSettlementsByRevenueEntryQueryConfig, {
      view: 'by-revenue-entry',
      revenueEntryId: 'revenue-01',
    });
    expectNoScope(contractRegistryFlatListQueryConfig, { status: 'DRAFT' });
    expectNoScope(contractRegistryByLinkedEntityQueryConfig, {
      view: 'by-linked-entity',
      linkedEntityKind: 'TALENT',
      linkedTalentId: 'talent-01',
    });
    expectNoScope(contractRegistryByOwnerQueryConfig, {
      view: 'by-owner',
      ownerEmploymentProfileId: 'ep-01',
    });
  });

  it('preserves Work Schedule as the only valid frontend scope query behavior', () => {
    const flat = serializeScreenQueryParams(
      {
        subjectKind: 'EMPLOYMENT_PROFILE',
        subjectEmploymentProfileId: 'ep-01',
        scope: 'team',
      },
      workShiftFlatListQueryConfig,
    );
    const byResource = serializeScreenQueryParams(
      {
        view: 'by-resource',
        studioResourceId: 'studio-01',
        scope: 'global',
      },
      workShiftByResourceQueryConfig,
    );

    expect(flat.get('scope')).toBe('team');
    expect(byResource.get('scope')).toBe('global');
  });

  it('enforces Contract Registry linked-entity filter matching', () => {
    const flat = serializeScreenQueryParams(
      {
        linkedEntityKind: 'EMPLOYMENT_PROFILE',
        linkedEmploymentProfileId: 'ep-01',
        linkedTalentId: 'talent-01',
      },
      contractRegistryFlatListQueryConfig,
    );
    const relatedInvalid = serializeScreenQueryParams(
      {
        view: 'by-linked-entity',
        linkedEntityKind: 'EMPLOYMENT_PROFILE',
        linkedTalentId: 'talent-01',
      },
      contractRegistryByLinkedEntityQueryConfig,
    );

    expect(flat.get('linkedEntityKind')).toBe('EMPLOYMENT_PROFILE');
    expect(flat.get('linkedEmploymentProfileId')).toBe('ep-01');
    expect(flat.get('linkedTalentId')).toBeNull();
    expect(relatedInvalid.get('view')).toBeNull();
    expect(relatedInvalid.get('linkedEntityKind')).toBeNull();
    expect(relatedInvalid.get('linkedEmploymentProfileId')).toBeNull();
    expect(relatedInvalid.get('linkedTalentId')).toBeNull();
  });

  it('enforces Commission beneficiary matching rules across rule and settlement routes', () => {
    const rulesInvalid = serializeScreenQueryParams(
      {
        view: 'by-beneficiary',
        beneficiaryKind: 'TALENT',
        beneficiaryEmploymentProfileId: 'ep-01',
      },
      commissionRulesByBeneficiaryQueryConfig,
    );
    const settlementsInvalid = serializeScreenQueryParams(
      {
        view: 'by-beneficiary',
        beneficiaryKindSnapshot: 'EMPLOYMENT_PROFILE',
        beneficiaryTalentIdSnapshot: 'talent-01',
      },
      commissionSettlementsByBeneficiaryQueryConfig,
    );

    expect(rulesInvalid.get('view')).toBeNull();
    expect(rulesInvalid.get('beneficiaryKind')).toBeNull();
    expect(rulesInvalid.get('beneficiaryEmploymentProfileId')).toBeNull();
    expect(rulesInvalid.get('beneficiaryTalentId')).toBeNull();
    expect(settlementsInvalid.get('view')).toBeNull();
    expect(settlementsInvalid.get('beneficiaryKindSnapshot')).toBeNull();
    expect(settlementsInvalid.get('beneficiaryEmploymentProfileIdSnapshot')).toBeNull();
    expect(settlementsInvalid.get('beneficiaryTalentIdSnapshot')).toBeNull();
  });

  it('drops related views when required target identities are missing', () => {
    const missingTarget = serializeScreenQueryParams(
      {
        view: 'by-talent',
      },
      revenueLedgerByTalentQueryConfig,
    );

    expect(missingTarget.get('view')).toBeNull();
    expect(missingTarget.get('subjectTalentId')).toBeNull();
  });

  it('drops unsupported keys from related-route builders by schema', () => {
    const query = serializeScreenQueryParams(
      {
        view: 'by-contract',
        sourceContractRecordId: 'contract-01',
        search: 'no-search-on-related',
      },
      commissionRulesByContractQueryConfig,
    );

    expect(query.get('view')).toBe('by-contract');
    expect(query.get('sourceContractRecordId')).toBe('contract-01');
    expect(query.get('search')).toBeNull();
  });

  it('does not expose a generic screen href builder in the shared query barrel', () => {
    expect((sharedQuery as Record<string, unknown>).buildScreenHref).toBeUndefined();
  });
});
