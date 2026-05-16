import {
  buildEmploymentProfilesByOrgUnitHref,
  buildPlatformAccountsByOwnerOrgUnitHref,
  buildPlatformAccountsByOwnerTalentHref,
  buildPlatformAccountsByOwnerTalentGroupHref,
  buildTalentGroupsByTalentHref,
  buildWorkShiftsBySubjectEmploymentProfileHref,
  buildWorkShiftsBySubjectTalentHref,
  buildWorkShiftsBySubjectTalentGroupHref,
  buildWorkShiftsByStudioResourceHref,
  buildEventsByAssignmentEmploymentProfileHref,
  buildEventsByAssignmentTalentHref,
  buildEventsByAssignmentTalentGroupHref,
  buildEventsByPlatformAccountHref,
  buildEventsByStudioResourceHref,
  type RelatedListBuildRequest,
  buildCommissionRulesByBeneficiaryEmploymentProfileHref,
  buildCommissionRulesByBeneficiaryTalentHref,
  buildCommissionRulesByContractHref,
  buildCommissionSettlementsByBeneficiaryEmploymentProfileHref,
  buildCommissionSettlementsByBeneficiaryTalentHref,
  buildCommissionSettlementsByRevenueEntryHref,
  buildCommissionSettlementsBySourceRuleHref,
  buildCommissionSettlementsBySubjectTalentHref,
  buildContractRegistryByLinkedEmploymentProfileHref,
  buildContractRegistryByLinkedTalentHref,
  buildContractRegistryByOwnerHref,
  buildRelatedListHref,
  buildRevenueLedgerByEventHref,
  buildRevenueLedgerByPlatformHref,
  buildRevenueLedgerByTalentHref,
  buildTalentKpiByPlatformHref,
  buildTalentKpiByTalentHref,
  buildTalentKpiByEventHref,
} from '@app/router/reference-links';

const splitHref = (href: string): { path: string; params: URLSearchParams } => {
  const [path, query = ''] = href.split('?');

  return {
    path,
    params: new URLSearchParams(query),
  };
};

const assertHrefShape = (
  href: string | undefined,
  path: string,
  expectedParams: Record<string, string>,
): void => {
  expect(href).toBeDefined();
  const parsed = splitHref(href ?? '');
  expect(parsed.path).toBe(path);

  Object.entries(expectedParams).forEach(([key, value]) => {
    expect(parsed.params.get(key)).toBe(value);
  });
};

describe('reference link builders', () => {
  it('builds expected URLs for every public typed related-link builder variant', () => {
    const cases = [
      {
        href: buildEmploymentProfilesByOrgUnitHref('org-01'),
        path: '/employment-profiles',
        params: {
          orgUnitId: 'org-01',
        },
      },
      {
        href: buildPlatformAccountsByOwnerOrgUnitHref('org-01'),
        path: '/platform-accounts',
        params: {
          ownerKind: 'ORG_UNIT',
          ownerOrgUnitId: 'org-01',
        },
      },
      {
        href: buildPlatformAccountsByOwnerTalentHref('talent-01'),
        path: '/platform-accounts',
        params: {
          ownerKind: 'TALENT',
          ownerTalentId: 'talent-01',
        },
      },
      {
        href: buildPlatformAccountsByOwnerTalentGroupHref('group-01'),
        path: '/platform-accounts',
        params: {
          ownerKind: 'TALENT_GROUP',
          ownerTalentGroupId: 'group-01',
        },
      },
      {
        href: buildTalentGroupsByTalentHref('talent-01'),
        path: '/talent-groups',
        params: {
          view: 'by-talent',
          talentId: 'talent-01',
        },
      },
      {
        href: buildWorkShiftsBySubjectEmploymentProfileHref('ep-01'),
        path: '/work-shifts',
        params: {
          view: 'by-subject',
          subjectKind: 'EMPLOYMENT_PROFILE',
          subjectEmploymentProfileId: 'ep-01',
        },
      },
      {
        href: buildWorkShiftsBySubjectTalentHref('talent-01'),
        path: '/work-shifts',
        params: {
          view: 'by-subject',
          subjectKind: 'TALENT',
          subjectTalentId: 'talent-01',
        },
      },
      {
        href: buildWorkShiftsBySubjectTalentGroupHref('group-01'),
        path: '/work-shifts',
        params: {
          view: 'by-subject',
          subjectKind: 'TALENT_GROUP',
          subjectTalentGroupId: 'group-01',
        },
      },
      {
        href: buildWorkShiftsByStudioResourceHref('studio-01'),
        path: '/work-shifts',
        params: {
          view: 'by-resource',
          studioResourceId: 'studio-01',
        },
      },
      {
        href: buildEventsByAssignmentEmploymentProfileHref('ep-01'),
        path: '/events',
        params: {
          view: 'by-assignment',
          assignmentKind: 'EMPLOYMENT_PROFILE',
          assignmentEmploymentProfileId: 'ep-01',
        },
      },
      {
        href: buildEventsByAssignmentTalentHref('talent-01'),
        path: '/events',
        params: {
          view: 'by-assignment',
          assignmentKind: 'TALENT',
          assignmentTalentId: 'talent-01',
        },
      },
      {
        href: buildEventsByAssignmentTalentGroupHref('group-01'),
        path: '/events',
        params: {
          view: 'by-assignment',
          assignmentKind: 'TALENT_GROUP',
          assignmentTalentGroupId: 'group-01',
        },
      },
      {
        href: buildEventsByStudioResourceHref('studio-01'),
        path: '/events',
        params: {
          view: 'by-resource',
          studioResourceId: 'studio-01',
        },
      },
      {
        href: buildEventsByPlatformAccountHref('platform-01'),
        path: '/events',
        params: {
          view: 'by-platform',
          platformAccountId: 'platform-01',
        },
      },
      {
        href: buildContractRegistryByLinkedEmploymentProfileHref('ep-01'),
        path: '/contract-records',
        params: {
          view: 'by-linked-entity',
          linkedEntityKind: 'EMPLOYMENT_PROFILE',
          linkedEmploymentProfileId: 'ep-01',
        },
      },
      {
        href: buildContractRegistryByLinkedTalentHref('talent-01'),
        path: '/contract-records',
        params: {
          view: 'by-linked-entity',
          linkedEntityKind: 'TALENT',
          linkedTalentId: 'talent-01',
        },
      },
      {
        href: buildContractRegistryByOwnerHref('owner-01'),
        path: '/contract-records',
        params: {
          view: 'by-owner',
          ownerEmploymentProfileId: 'owner-01',
        },
      },
      {
        href: buildCommissionRulesByBeneficiaryEmploymentProfileHref('ep-01'),
        path: '/commission/rules',
        params: {
          view: 'by-beneficiary',
          beneficiaryKind: 'EMPLOYMENT_PROFILE',
          beneficiaryEmploymentProfileId: 'ep-01',
        },
      },
      {
        href: buildCommissionRulesByBeneficiaryTalentHref('talent-01'),
        path: '/commission/rules',
        params: {
          view: 'by-beneficiary',
          beneficiaryKind: 'TALENT',
          beneficiaryTalentId: 'talent-01',
        },
      },
      {
        href: buildCommissionRulesByContractHref('contract-01'),
        path: '/commission/rules',
        params: {
          view: 'by-contract',
          sourceContractRecordId: 'contract-01',
        },
      },
      {
        href: buildCommissionSettlementsByBeneficiaryEmploymentProfileHref('ep-01'),
        path: '/commission/settlements',
        params: {
          view: 'by-beneficiary',
          beneficiaryKindSnapshot: 'EMPLOYMENT_PROFILE',
          beneficiaryEmploymentProfileIdSnapshot: 'ep-01',
        },
      },
      {
        href: buildCommissionSettlementsByBeneficiaryTalentHref('talent-01'),
        path: '/commission/settlements',
        params: {
          view: 'by-beneficiary',
          beneficiaryKindSnapshot: 'TALENT',
          beneficiaryTalentIdSnapshot: 'talent-01',
        },
      },
      {
        href: buildCommissionSettlementsBySubjectTalentHref('talent-01'),
        path: '/commission/settlements',
        params: {
          view: 'by-subject-talent',
          subjectTalentId: 'talent-01',
        },
      },
      {
        href: buildCommissionSettlementsByRevenueEntryHref('revenue-01'),
        path: '/commission/settlements',
        params: {
          view: 'by-revenue-entry',
          revenueEntryId: 'revenue-01',
        },
      },
      {
        href: buildCommissionSettlementsBySourceRuleHref('rule-01'),
        path: '/commission/settlements',
        params: {
          sourceRuleId: 'rule-01',
        },
      },
      {
        href: buildRevenueLedgerByTalentHref('talent-01'),
        path: '/revenue-entries',
        params: {
          view: 'by-talent',
          subjectTalentId: 'talent-01',
        },
      },
      {
        href: buildRevenueLedgerByPlatformHref('platform-01'),
        path: '/revenue-entries',
        params: {
          view: 'by-platform',
          attributionPlatformAccountId: 'platform-01',
        },
      },
      {
        href: buildRevenueLedgerByEventHref('event-01'),
        path: '/revenue-entries',
        params: {
          view: 'by-event',
          attributionEventId: 'event-01',
        },
      },
      {
        href: buildTalentKpiByTalentHref('talent-01'),
        path: '/talent-kpi-records',
        params: {
          view: 'by-talent',
          subjectTalentId: 'talent-01',
        },
      },
      {
        href: buildTalentKpiByPlatformHref('platform-01'),
        path: '/talent-kpi-records',
        params: {
          view: 'by-platform',
          attributionPlatformAccountId: 'platform-01',
        },
      },
      {
        href: buildTalentKpiByEventHref('event-01'),
        path: '/talent-kpi-records',
        params: {
          view: 'by-event',
          attributionEventId: 'event-01',
        },
      },
    ] as const;

    cases.forEach((testCase) => {
      assertHrefShape(testCase.href, testCase.path, testCase.params);
    });
  });

  it('buildRelatedListHref covers all public related-list builder kinds', () => {
    const cases: Array<{
      request: RelatedListBuildRequest;
      path: string;
      params: Record<string, string>;
    }> = [
      {
        request: {
          kind: 'employmentProfile.byOrgUnit',
          orgUnitId: 'org-01',
        },
        path: '/employment-profiles',
        params: {
          orgUnitId: 'org-01',
        },
      },
      {
        request: {
          kind: 'platformAccount.byOwnerOrgUnit',
          ownerOrgUnitId: 'org-01',
        },
        path: '/platform-accounts',
        params: {
          ownerKind: 'ORG_UNIT',
          ownerOrgUnitId: 'org-01',
        },
      },
      {
        request: {
          kind: 'platformAccount.byOwnerTalent',
          ownerTalentId: 'talent-01',
        },
        path: '/platform-accounts',
        params: {
          ownerKind: 'TALENT',
          ownerTalentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'platformAccount.byOwnerTalentGroup',
          ownerTalentGroupId: 'group-01',
        },
        path: '/platform-accounts',
        params: {
          ownerKind: 'TALENT_GROUP',
          ownerTalentGroupId: 'group-01',
        },
      },
      {
        request: {
          kind: 'talentGroup.byTalent',
          talentId: 'talent-01',
        },
        path: '/talent-groups',
        params: {
          view: 'by-talent',
          talentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'workShift.bySubjectEmploymentProfile',
          subjectEmploymentProfileId: 'ep-01',
        },
        path: '/work-shifts',
        params: {
          view: 'by-subject',
          subjectKind: 'EMPLOYMENT_PROFILE',
          subjectEmploymentProfileId: 'ep-01',
        },
      },
      {
        request: {
          kind: 'workShift.bySubjectTalent',
          subjectTalentId: 'talent-01',
        },
        path: '/work-shifts',
        params: {
          view: 'by-subject',
          subjectKind: 'TALENT',
          subjectTalentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'workShift.bySubjectTalentGroup',
          subjectTalentGroupId: 'group-01',
        },
        path: '/work-shifts',
        params: {
          view: 'by-subject',
          subjectKind: 'TALENT_GROUP',
          subjectTalentGroupId: 'group-01',
        },
      },
      {
        request: {
          kind: 'workShift.byStudioResource',
          studioResourceId: 'studio-01',
        },
        path: '/work-shifts',
        params: {
          view: 'by-resource',
          studioResourceId: 'studio-01',
        },
      },
      {
        request: {
          kind: 'event.byAssignmentEmploymentProfile',
          assignmentEmploymentProfileId: 'ep-01',
        },
        path: '/events',
        params: {
          view: 'by-assignment',
          assignmentKind: 'EMPLOYMENT_PROFILE',
          assignmentEmploymentProfileId: 'ep-01',
        },
      },
      {
        request: {
          kind: 'event.byAssignmentTalent',
          assignmentTalentId: 'talent-01',
        },
        path: '/events',
        params: {
          view: 'by-assignment',
          assignmentKind: 'TALENT',
          assignmentTalentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'event.byAssignmentTalentGroup',
          assignmentTalentGroupId: 'group-01',
        },
        path: '/events',
        params: {
          view: 'by-assignment',
          assignmentKind: 'TALENT_GROUP',
          assignmentTalentGroupId: 'group-01',
        },
      },
      {
        request: {
          kind: 'event.byStudioResource',
          studioResourceId: 'studio-01',
        },
        path: '/events',
        params: {
          view: 'by-resource',
          studioResourceId: 'studio-01',
        },
      },
      {
        request: {
          kind: 'event.byPlatformAccount',
          platformAccountId: 'platform-01',
        },
        path: '/events',
        params: {
          view: 'by-platform',
          platformAccountId: 'platform-01',
        },
      },
      {
        request: {
          kind: 'contractRegistry.byLinkedEmploymentProfile',
          linkedEmploymentProfileId: 'ep-01',
        },
        path: '/contract-records',
        params: {
          view: 'by-linked-entity',
          linkedEntityKind: 'EMPLOYMENT_PROFILE',
          linkedEmploymentProfileId: 'ep-01',
        },
      },
      {
        request: {
          kind: 'contractRegistry.byLinkedTalent',
          linkedTalentId: 'talent-01',
        },
        path: '/contract-records',
        params: {
          view: 'by-linked-entity',
          linkedEntityKind: 'TALENT',
          linkedTalentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'contractRegistry.byOwner',
          ownerEmploymentProfileId: 'owner-01',
        },
        path: '/contract-records',
        params: {
          view: 'by-owner',
          ownerEmploymentProfileId: 'owner-01',
        },
      },
      {
        request: {
          kind: 'commissionRules.byBeneficiaryEmploymentProfile',
          beneficiaryEmploymentProfileId: 'ep-01',
        },
        path: '/commission/rules',
        params: {
          view: 'by-beneficiary',
          beneficiaryKind: 'EMPLOYMENT_PROFILE',
          beneficiaryEmploymentProfileId: 'ep-01',
        },
      },
      {
        request: {
          kind: 'commissionRules.byBeneficiaryTalent',
          beneficiaryTalentId: 'talent-01',
        },
        path: '/commission/rules',
        params: {
          view: 'by-beneficiary',
          beneficiaryKind: 'TALENT',
          beneficiaryTalentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'commissionRules.byContract',
          sourceContractRecordId: 'contract-01',
        },
        path: '/commission/rules',
        params: {
          view: 'by-contract',
          sourceContractRecordId: 'contract-01',
        },
      },
      {
        request: {
          kind: 'commissionSettlements.byBeneficiaryEmploymentProfile',
          beneficiaryEmploymentProfileIdSnapshot: 'ep-01',
        },
        path: '/commission/settlements',
        params: {
          view: 'by-beneficiary',
          beneficiaryKindSnapshot: 'EMPLOYMENT_PROFILE',
          beneficiaryEmploymentProfileIdSnapshot: 'ep-01',
        },
      },
      {
        request: {
          kind: 'commissionSettlements.byBeneficiaryTalent',
          beneficiaryTalentIdSnapshot: 'talent-01',
        },
        path: '/commission/settlements',
        params: {
          view: 'by-beneficiary',
          beneficiaryKindSnapshot: 'TALENT',
          beneficiaryTalentIdSnapshot: 'talent-01',
        },
      },
      {
        request: {
          kind: 'commissionSettlements.bySubjectTalent',
          subjectTalentId: 'talent-01',
        },
        path: '/commission/settlements',
        params: {
          view: 'by-subject-talent',
          subjectTalentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'commissionSettlements.byRevenueEntry',
          revenueEntryId: 'revenue-01',
        },
        path: '/commission/settlements',
        params: {
          view: 'by-revenue-entry',
          revenueEntryId: 'revenue-01',
        },
      },
      {
        request: {
          kind: 'commissionSettlements.bySourceRule',
          sourceRuleId: 'rule-01',
        },
        path: '/commission/settlements',
        params: {
          sourceRuleId: 'rule-01',
        },
      },
      {
        request: {
          kind: 'revenueLedger.byTalent',
          subjectTalentId: 'talent-01',
        },
        path: '/revenue-entries',
        params: {
          view: 'by-talent',
          subjectTalentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'revenueLedger.byPlatform',
          attributionPlatformAccountId: 'platform-01',
        },
        path: '/revenue-entries',
        params: {
          view: 'by-platform',
          attributionPlatformAccountId: 'platform-01',
        },
      },
      {
        request: {
          kind: 'revenueLedger.byEvent',
          attributionEventId: 'event-01',
        },
        path: '/revenue-entries',
        params: {
          view: 'by-event',
          attributionEventId: 'event-01',
        },
      },
      {
        request: {
          kind: 'talentKpi.byTalent',
          subjectTalentId: 'talent-01',
        },
        path: '/talent-kpi-records',
        params: {
          view: 'by-talent',
          subjectTalentId: 'talent-01',
        },
      },
      {
        request: {
          kind: 'talentKpi.byPlatform',
          attributionPlatformAccountId: 'platform-01',
        },
        path: '/talent-kpi-records',
        params: {
          view: 'by-platform',
          attributionPlatformAccountId: 'platform-01',
        },
      },
      {
        request: {
          kind: 'talentKpi.byEvent',
          attributionEventId: 'event-01',
        },
        path: '/talent-kpi-records',
        params: {
          view: 'by-event',
          attributionEventId: 'event-01',
        },
      },
    ];

    cases.forEach((testCase) => {
      const href = buildRelatedListHref(testCase.request);
      assertHrefShape(href, testCase.path, testCase.params);
    });
  });

  it('returns no href for invalid or missing typed builder input', () => {
    expect(buildEmploymentProfilesByOrgUnitHref('')).toBeUndefined();
    expect(buildPlatformAccountsByOwnerOrgUnitHref('  ')).toBeUndefined();
    expect(buildPlatformAccountsByOwnerTalentHref('')).toBeUndefined();
    expect(buildPlatformAccountsByOwnerTalentGroupHref('')).toBeUndefined();
    expect(buildTalentGroupsByTalentHref('')).toBeUndefined();
    expect(buildWorkShiftsBySubjectEmploymentProfileHref(null)).toBeUndefined();
    expect(buildWorkShiftsBySubjectTalentHref('')).toBeUndefined();
    expect(buildWorkShiftsBySubjectTalentGroupHref('')).toBeUndefined();
    expect(buildWorkShiftsByStudioResourceHref('')).toBeUndefined();
    expect(buildEventsByAssignmentEmploymentProfileHref('')).toBeUndefined();
    expect(buildEventsByAssignmentTalentHref('')).toBeUndefined();
    expect(buildEventsByAssignmentTalentGroupHref('')).toBeUndefined();
    expect(buildEventsByStudioResourceHref('')).toBeUndefined();
    expect(buildEventsByPlatformAccountHref('')).toBeUndefined();
    expect(buildContractRegistryByLinkedEmploymentProfileHref('')).toBeUndefined();
    expect(buildContractRegistryByLinkedTalentHref('')).toBeUndefined();
    expect(buildContractRegistryByOwnerHref('   ')).toBeUndefined();
    expect(buildCommissionRulesByBeneficiaryEmploymentProfileHref('')).toBeUndefined();
    expect(buildCommissionRulesByBeneficiaryTalentHref('')).toBeUndefined();
    expect(buildCommissionRulesByContractHref('   ')).toBeUndefined();
    expect(buildCommissionSettlementsByBeneficiaryEmploymentProfileHref('')).toBeUndefined();
    expect(buildCommissionSettlementsByBeneficiaryTalentHref('')).toBeUndefined();
    expect(buildCommissionSettlementsBySubjectTalentHref(null)).toBeUndefined();
    expect(buildCommissionSettlementsByRevenueEntryHref('')).toBeUndefined();
    expect(buildCommissionSettlementsBySourceRuleHref('')).toBeUndefined();
    expect(buildRevenueLedgerByTalentHref(null)).toBeUndefined();
    expect(buildRevenueLedgerByPlatformHref('')).toBeUndefined();
    expect(buildRevenueLedgerByEventHref('')).toBeUndefined();
    expect(buildTalentKpiByTalentHref('')).toBeUndefined();
    expect(buildTalentKpiByPlatformHref('')).toBeUndefined();
    expect(buildTalentKpiByEventHref('')).toBeUndefined();
  });

  it('returns no href for every kind when required related identity is missing', () => {
    const missingIdentityKinds: RelatedListBuildRequest['kind'][] = [
      'employmentProfile.byOrgUnit',
      'platformAccount.byOwnerOrgUnit',
      'platformAccount.byOwnerTalent',
      'platformAccount.byOwnerTalentGroup',
      'talentGroup.byTalent',
      'workShift.bySubjectEmploymentProfile',
      'workShift.bySubjectTalent',
      'workShift.bySubjectTalentGroup',
      'workShift.byStudioResource',
      'event.byAssignmentEmploymentProfile',
      'event.byAssignmentTalent',
      'event.byAssignmentTalentGroup',
      'event.byStudioResource',
      'event.byPlatformAccount',
      'contractRegistry.byLinkedEmploymentProfile',
      'contractRegistry.byLinkedTalent',
      'contractRegistry.byOwner',
      'commissionRules.byContract',
      'commissionRules.byBeneficiaryEmploymentProfile',
      'commissionRules.byBeneficiaryTalent',
      'commissionSettlements.byBeneficiaryEmploymentProfile',
      'commissionSettlements.byBeneficiaryTalent',
      'commissionSettlements.bySubjectTalent',
      'commissionSettlements.byRevenueEntry',
      'commissionSettlements.bySourceRule',
      'revenueLedger.byTalent',
      'revenueLedger.byPlatform',
      'revenueLedger.byEvent',
      'talentKpi.byTalent',
      'talentKpi.byPlatform',
      'talentKpi.byEvent',
    ];

    missingIdentityKinds.forEach((kind) => {
      const href = buildRelatedListHref({ kind } as RelatedListBuildRequest);
      expect(href).toBeUndefined();
    });
  });

  it('does not emit unsupported key combinations or ad hoc query keys', () => {
    const href = buildRelatedListHref({
      kind: 'contractRegistry.byLinkedTalent',
      linkedEntityKind: 'EMPLOYMENT_PROFILE',
      linkedEmploymentProfileId: 'ep-01',
      linkedTalentId: 'talent-01',
      subjectTalentId: 'talent-01',
      search: 'should-not-pass',
      unexpected: 'value',
    } as unknown as RelatedListBuildRequest);

    expect(href).toBeDefined();
    const parsed = splitHref(href ?? '');
    expect(parsed.params.get('view')).toBe('by-linked-entity');
    expect(parsed.params.get('linkedEntityKind')).toBe('TALENT');
    expect(parsed.params.get('linkedTalentId')).toBe('talent-01');
    expect(parsed.params.get('linkedEmploymentProfileId')).toBeNull();
    expect(parsed.params.get('subjectTalentId')).toBeNull();
    expect(parsed.params.get('search')).toBeNull();
    expect(parsed.params.get('unexpected')).toBeNull();
  });

  it('returns no href for unsupported related-navigation requests', () => {
    const href = buildRelatedListHref({
      kind: 'unsupported.related.navigation',
      id: 'record-01',
    } as unknown as RelatedListBuildRequest);

    expect(href).toBeUndefined();
  });
});
