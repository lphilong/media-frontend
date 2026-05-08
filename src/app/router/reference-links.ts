import { APP_PATHS } from '@app/router/paths';
import {
  type QueryParamSchema,
  type QueryShape,
  type ScreenQueryConfig,
  commissionRulesByBeneficiaryQueryConfig,
  commissionRulesByContractQueryConfig,
  commissionSettlementsByBeneficiaryQueryConfig,
  commissionSettlementsByRevenueEntryQueryConfig,
  commissionSettlementsBySubjectTalentQueryConfig,
  commissionSettlementsFlatListQueryConfig,
  contractRegistryByLinkedEntityQueryConfig,
  contractRegistryByOwnerQueryConfig,
  employmentProfileFlatListQueryConfig,
  eventByAssignmentQueryConfig,
  eventByPlatformQueryConfig,
  eventByResourceQueryConfig,
  revenueLedgerByEventQueryConfig,
  revenueLedgerByPlatformQueryConfig,
  revenueLedgerByTalentQueryConfig,
  talentGroupByTalentQueryConfig,
  talentKpiByEventQueryConfig,
  talentKpiByPlatformQueryConfig,
  talentKpiByTalentQueryConfig,
  workShiftByResourceQueryConfig,
  workShiftBySubjectQueryConfig,
  getMissingRelatedIdentityKeys,
  sanitizeScreenQuery,
  serializeScreenQueryParams,
} from '@shared/query';

export type DetailReferenceEntity =
  | 'orgUnit'
  | 'user'
  | 'role'
  | 'employmentProfile'
  | 'talent'
  | 'talentGroup'
  | 'platformAccount'
  | 'studioResource'
  | 'workShift'
  | 'event'
  | 'contractRecord'
  | 'talentKpiRecord'
  | 'revenueEntry'
  | 'commissionRule'
  | 'commissionSettlement';

const DETAIL_PATH_BUILDERS: Record<DetailReferenceEntity, (entityId: string) => string> = {
  orgUnit: APP_PATHS.orgUnitDetail,
  user: APP_PATHS.userDetail,
  role: APP_PATHS.roleDetail,
  employmentProfile: APP_PATHS.employmentProfileDetail,
  talent: APP_PATHS.talentDetail,
  talentGroup: APP_PATHS.talentGroupDetail,
  platformAccount: APP_PATHS.platformAccountDetail,
  studioResource: APP_PATHS.studioResourceDetail,
  workShift: APP_PATHS.workShiftDetail,
  event: APP_PATHS.eventDetail,
  contractRecord: APP_PATHS.contractRecordDetail,
  talentKpiRecord: APP_PATHS.talentKpiRecordDetail,
  revenueEntry: APP_PATHS.revenueEntryDetail,
  commissionRule: APP_PATHS.commissionRuleDetail,
  commissionSettlement: APP_PATHS.commissionSettlementDetail,
};

const normalizeReferenceId = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const buildEntityDetailHref = (
  entity: DetailReferenceEntity,
  entityId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(entityId);
  if (!normalizedId) {
    return undefined;
  }

  return DETAIL_PATH_BUILDERS[entity](normalizedId);
};

const buildConfigOwnedRelatedHref = <TSchema extends QueryParamSchema>(
  basePath: string,
  query: QueryShape,
  config: ScreenQueryConfig<TSchema>,
): string | undefined => {
  const related = config.capabilities.related;
  if (!related) {
    return undefined;
  }

  const normalized = sanitizeScreenQuery(query, config);
  if (getMissingRelatedIdentityKeys(normalized, config).length > 0) {
    return undefined;
  }

  const params = serializeScreenQueryParams(normalized, config);
  if (params.get('view') !== related.view) {
    return undefined;
  }

  const serialized = params.toString();
  return serialized ? `${basePath}?${serialized}` : undefined;
};

const buildFixedRelatedHref = (basePath: string, params: Array<[string, string]>): string => {
  const serialized = new URLSearchParams(params).toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
};

const buildContractRegistryByLinkedEntityHref = (
  linkedEntityKind: 'EMPLOYMENT_PROFILE' | 'TALENT',
  idKey: 'linkedEmploymentProfileId' | 'linkedTalentId',
  relatedId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(relatedId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.contractRecords,
    {
      view: 'by-linked-entity',
      linkedEntityKind,
      [idKey]: normalizedId,
    },
    contractRegistryByLinkedEntityQueryConfig,
  );
};

export const buildContractRegistryByLinkedEmploymentProfileHref = (
  linkedEmploymentProfileId?: string | null,
): string | undefined => {
  return buildContractRegistryByLinkedEntityHref(
    'EMPLOYMENT_PROFILE',
    'linkedEmploymentProfileId',
    linkedEmploymentProfileId,
  );
};

export const buildContractRegistryByLinkedTalentHref = (
  linkedTalentId?: string | null,
): string | undefined => {
  return buildContractRegistryByLinkedEntityHref('TALENT', 'linkedTalentId', linkedTalentId);
};

export const buildContractRegistryByOwnerHref = (
  ownerEmploymentProfileId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(ownerEmploymentProfileId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.contractRecords,
    {
      view: 'by-owner',
      ownerEmploymentProfileId: normalizedId,
    },
    contractRegistryByOwnerQueryConfig,
  );
};

export const buildEmploymentProfilesByOrgUnitHref = (
  orgUnitId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(orgUnitId);
  if (!normalizedId) {
    return undefined;
  }

  const normalizedQuery = sanitizeScreenQuery(
    {
      orgUnitId: normalizedId,
    },
    employmentProfileFlatListQueryConfig,
  );
  const params = serializeScreenQueryParams(normalizedQuery, employmentProfileFlatListQueryConfig);
  const serialized = params.toString();
  return serialized
    ? `${APP_PATHS.employmentProfiles}?${serialized}`
    : APP_PATHS.employmentProfiles;
};

export const buildPlatformAccountsByOwnerOrgUnitHref = (
  ownerOrgUnitId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(ownerOrgUnitId);
  if (!normalizedId) {
    return undefined;
  }

  return buildFixedRelatedHref(APP_PATHS.platformAccounts, [
    ['ownerKind', 'ORG_UNIT'],
    ['ownerOrgUnitId', normalizedId],
  ]);
};

export const buildPlatformAccountsByOwnerTalentHref = (
  ownerTalentId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(ownerTalentId);
  if (!normalizedId) {
    return undefined;
  }

  return buildFixedRelatedHref(APP_PATHS.platformAccounts, [
    ['ownerKind', 'TALENT'],
    ['ownerTalentId', normalizedId],
  ]);
};

export const buildPlatformAccountsByOwnerTalentGroupHref = (
  ownerTalentGroupId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(ownerTalentGroupId);
  if (!normalizedId) {
    return undefined;
  }

  return buildFixedRelatedHref(APP_PATHS.platformAccounts, [
    ['ownerKind', 'TALENT_GROUP'],
    ['ownerTalentGroupId', normalizedId],
  ]);
};

export const buildWorkShiftsBySubjectEmploymentProfileHref = (
  subjectEmploymentProfileId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(subjectEmploymentProfileId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.workShifts,
    {
      view: 'by-subject',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectEmploymentProfileId: normalizedId,
    },
    workShiftBySubjectQueryConfig,
  );
};

export const buildWorkShiftsBySubjectTalentHref = (
  subjectTalentId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(subjectTalentId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.workShifts,
    {
      view: 'by-subject',
      subjectKind: 'TALENT',
      subjectTalentId: normalizedId,
    },
    workShiftBySubjectQueryConfig,
  );
};

export const buildWorkShiftsBySubjectTalentGroupHref = (
  subjectTalentGroupId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(subjectTalentGroupId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.workShifts,
    {
      view: 'by-subject',
      subjectKind: 'TALENT_GROUP',
      subjectTalentGroupId: normalizedId,
    },
    workShiftBySubjectQueryConfig,
  );
};

export const buildWorkShiftsByStudioResourceHref = (
  studioResourceId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(studioResourceId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.workShifts,
    {
      view: 'by-resource',
      studioResourceId: normalizedId,
    },
    workShiftByResourceQueryConfig,
  );
};

export const buildEventsByAssignmentEmploymentProfileHref = (
  assignmentEmploymentProfileId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(assignmentEmploymentProfileId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.events,
    {
      view: 'by-assignment',
      assignmentKind: 'EMPLOYMENT_PROFILE',
      assignmentEmploymentProfileId: normalizedId,
    },
    eventByAssignmentQueryConfig,
  );
};

export const buildEventsByAssignmentTalentHref = (
  assignmentTalentId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(assignmentTalentId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.events,
    {
      view: 'by-assignment',
      assignmentKind: 'TALENT',
      assignmentTalentId: normalizedId,
    },
    eventByAssignmentQueryConfig,
  );
};

export const buildEventsByAssignmentTalentGroupHref = (
  assignmentTalentGroupId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(assignmentTalentGroupId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.events,
    {
      view: 'by-assignment',
      assignmentKind: 'TALENT_GROUP',
      assignmentTalentGroupId: normalizedId,
    },
    eventByAssignmentQueryConfig,
  );
};

export const buildEventsByStudioResourceHref = (
  studioResourceId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(studioResourceId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.events,
    {
      view: 'by-resource',
      studioResourceId: normalizedId,
    },
    eventByResourceQueryConfig,
  );
};

export const buildEventsByPlatformAccountHref = (
  platformAccountId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(platformAccountId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.events,
    {
      view: 'by-platform',
      platformAccountId: normalizedId,
    },
    eventByPlatformQueryConfig,
  );
};

export const buildTalentGroupsByTalentHref = (talentId?: string | null): string | undefined => {
  const normalizedId = normalizeReferenceId(talentId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.talentGroups,
    {
      view: 'by-talent',
      talentId: normalizedId,
    },
    talentGroupByTalentQueryConfig,
  );
};

const buildCommissionRulesByBeneficiaryHref = (
  beneficiaryKind: 'EMPLOYMENT_PROFILE' | 'TALENT',
  idKey: 'beneficiaryEmploymentProfileId' | 'beneficiaryTalentId',
  beneficiaryId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(beneficiaryId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.commissionRules,
    {
      view: 'by-beneficiary',
      beneficiaryKind,
      [idKey]: normalizedId,
    },
    commissionRulesByBeneficiaryQueryConfig,
  );
};

export const buildCommissionRulesByBeneficiaryEmploymentProfileHref = (
  beneficiaryEmploymentProfileId?: string | null,
): string | undefined => {
  return buildCommissionRulesByBeneficiaryHref(
    'EMPLOYMENT_PROFILE',
    'beneficiaryEmploymentProfileId',
    beneficiaryEmploymentProfileId,
  );
};

export const buildCommissionRulesByBeneficiaryTalentHref = (
  beneficiaryTalentId?: string | null,
): string | undefined => {
  return buildCommissionRulesByBeneficiaryHref(
    'TALENT',
    'beneficiaryTalentId',
    beneficiaryTalentId,
  );
};

export const buildCommissionRulesByContractHref = (
  sourceContractRecordId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(sourceContractRecordId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.commissionRules,
    {
      view: 'by-contract',
      sourceContractRecordId: normalizedId,
    },
    commissionRulesByContractQueryConfig,
  );
};

const buildCommissionSettlementsByBeneficiaryHref = (
  beneficiaryKindSnapshot: 'EMPLOYMENT_PROFILE' | 'TALENT',
  idKey: 'beneficiaryEmploymentProfileIdSnapshot' | 'beneficiaryTalentIdSnapshot',
  beneficiaryId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(beneficiaryId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.commissionSettlements,
    {
      view: 'by-beneficiary',
      beneficiaryKindSnapshot,
      [idKey]: normalizedId,
    },
    commissionSettlementsByBeneficiaryQueryConfig,
  );
};

export const buildCommissionSettlementsByBeneficiaryEmploymentProfileHref = (
  beneficiaryEmploymentProfileIdSnapshot?: string | null,
): string | undefined => {
  return buildCommissionSettlementsByBeneficiaryHref(
    'EMPLOYMENT_PROFILE',
    'beneficiaryEmploymentProfileIdSnapshot',
    beneficiaryEmploymentProfileIdSnapshot,
  );
};

export const buildCommissionSettlementsByBeneficiaryTalentHref = (
  beneficiaryTalentIdSnapshot?: string | null,
): string | undefined => {
  return buildCommissionSettlementsByBeneficiaryHref(
    'TALENT',
    'beneficiaryTalentIdSnapshot',
    beneficiaryTalentIdSnapshot,
  );
};

export const buildCommissionSettlementsBySubjectTalentHref = (
  subjectTalentId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(subjectTalentId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.commissionSettlements,
    {
      view: 'by-subject-talent',
      subjectTalentId: normalizedId,
    },
    commissionSettlementsBySubjectTalentQueryConfig,
  );
};

export const buildCommissionSettlementsByRevenueEntryHref = (
  revenueEntryId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(revenueEntryId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.commissionSettlements,
    {
      view: 'by-revenue-entry',
      revenueEntryId: normalizedId,
    },
    commissionSettlementsByRevenueEntryQueryConfig,
  );
};

export const buildCommissionSettlementsBySourceRuleHref = (
  sourceRuleId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(sourceRuleId);
  if (!normalizedId) {
    return undefined;
  }

  const normalizedQuery = sanitizeScreenQuery(
    {
      sourceRuleId: normalizedId,
    },
    commissionSettlementsFlatListQueryConfig,
  );
  const params = serializeScreenQueryParams(
    normalizedQuery,
    commissionSettlementsFlatListQueryConfig,
  );
  const serialized = params.toString();
  return serialized
    ? `${APP_PATHS.commissionSettlements}?${serialized}`
    : APP_PATHS.commissionSettlements;
};

export const buildRevenueLedgerByTalentHref = (
  subjectTalentId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(subjectTalentId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.revenueEntries,
    {
      view: 'by-talent',
      subjectTalentId: normalizedId,
    },
    revenueLedgerByTalentQueryConfig,
  );
};

export const buildRevenueLedgerByPlatformHref = (
  attributionPlatformAccountId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(attributionPlatformAccountId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.revenueEntries,
    {
      view: 'by-platform',
      attributionPlatformAccountId: normalizedId,
    },
    revenueLedgerByPlatformQueryConfig,
  );
};

export const buildRevenueLedgerByEventHref = (
  attributionEventId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(attributionEventId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.revenueEntries,
    {
      view: 'by-event',
      attributionEventId: normalizedId,
    },
    revenueLedgerByEventQueryConfig,
  );
};

export const buildTalentKpiByTalentHref = (subjectTalentId?: string | null): string | undefined => {
  const normalizedId = normalizeReferenceId(subjectTalentId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.talentKpiRecords,
    {
      view: 'by-talent',
      subjectTalentId: normalizedId,
    },
    talentKpiByTalentQueryConfig,
  );
};

export const buildTalentKpiByPlatformHref = (
  attributionPlatformAccountId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(attributionPlatformAccountId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.talentKpiRecords,
    {
      view: 'by-platform',
      attributionPlatformAccountId: normalizedId,
    },
    talentKpiByPlatformQueryConfig,
  );
};

export const buildTalentKpiByEventHref = (
  attributionEventId?: string | null,
): string | undefined => {
  const normalizedId = normalizeReferenceId(attributionEventId);
  if (!normalizedId) {
    return undefined;
  }

  return buildConfigOwnedRelatedHref(
    APP_PATHS.talentKpiRecords,
    {
      view: 'by-event',
      attributionEventId: normalizedId,
    },
    talentKpiByEventQueryConfig,
  );
};

export type RelatedListBuildRequest =
  | {
      kind: 'employmentProfile.byOrgUnit';
      orgUnitId?: string | null;
    }
  | {
      kind: 'platformAccount.byOwnerOrgUnit';
      ownerOrgUnitId?: string | null;
    }
  | {
      kind: 'platformAccount.byOwnerTalent';
      ownerTalentId?: string | null;
    }
  | {
      kind: 'platformAccount.byOwnerTalentGroup';
      ownerTalentGroupId?: string | null;
    }
  | {
      kind: 'talentGroup.byTalent';
      talentId?: string | null;
    }
  | {
      kind: 'workShift.bySubjectEmploymentProfile';
      subjectEmploymentProfileId?: string | null;
    }
  | {
      kind: 'workShift.bySubjectTalent';
      subjectTalentId?: string | null;
    }
  | {
      kind: 'workShift.bySubjectTalentGroup';
      subjectTalentGroupId?: string | null;
    }
  | {
      kind: 'workShift.byStudioResource';
      studioResourceId?: string | null;
    }
  | {
      kind: 'event.byAssignmentEmploymentProfile';
      assignmentEmploymentProfileId?: string | null;
    }
  | {
      kind: 'event.byAssignmentTalent';
      assignmentTalentId?: string | null;
    }
  | {
      kind: 'event.byAssignmentTalentGroup';
      assignmentTalentGroupId?: string | null;
    }
  | {
      kind: 'event.byStudioResource';
      studioResourceId?: string | null;
    }
  | {
      kind: 'event.byPlatformAccount';
      platformAccountId?: string | null;
    }
  | {
      kind: 'contractRegistry.byLinkedEmploymentProfile';
      linkedEmploymentProfileId?: string | null;
    }
  | { kind: 'contractRegistry.byLinkedTalent'; linkedTalentId?: string | null }
  | { kind: 'contractRegistry.byOwner'; ownerEmploymentProfileId?: string | null }
  | { kind: 'commissionRules.byContract'; sourceContractRecordId?: string | null }
  | {
      kind: 'commissionRules.byBeneficiaryEmploymentProfile';
      beneficiaryEmploymentProfileId?: string | null;
    }
  | { kind: 'commissionRules.byBeneficiaryTalent'; beneficiaryTalentId?: string | null }
  | {
      kind: 'commissionSettlements.byBeneficiaryEmploymentProfile';
      beneficiaryEmploymentProfileIdSnapshot?: string | null;
    }
  | {
      kind: 'commissionSettlements.byBeneficiaryTalent';
      beneficiaryTalentIdSnapshot?: string | null;
    }
  | { kind: 'commissionSettlements.bySubjectTalent'; subjectTalentId?: string | null }
  | { kind: 'commissionSettlements.byRevenueEntry'; revenueEntryId?: string | null }
  | { kind: 'commissionSettlements.bySourceRule'; sourceRuleId?: string | null }
  | { kind: 'revenueLedger.byTalent'; subjectTalentId?: string | null }
  | { kind: 'revenueLedger.byPlatform'; attributionPlatformAccountId?: string | null }
  | { kind: 'revenueLedger.byEvent'; attributionEventId?: string | null }
  | { kind: 'talentKpi.byTalent'; subjectTalentId?: string | null }
  | { kind: 'talentKpi.byPlatform'; attributionPlatformAccountId?: string | null }
  | { kind: 'talentKpi.byEvent'; attributionEventId?: string | null };

const assertNever = (value: never): undefined => {
  void value;
  return undefined;
};

export const buildRelatedListHref = (request: RelatedListBuildRequest): string | undefined => {
  switch (request.kind) {
    case 'employmentProfile.byOrgUnit':
      return buildEmploymentProfilesByOrgUnitHref(request.orgUnitId);
    case 'platformAccount.byOwnerOrgUnit':
      return buildPlatformAccountsByOwnerOrgUnitHref(request.ownerOrgUnitId);
    case 'platformAccount.byOwnerTalent':
      return buildPlatformAccountsByOwnerTalentHref(request.ownerTalentId);
    case 'platformAccount.byOwnerTalentGroup':
      return buildPlatformAccountsByOwnerTalentGroupHref(request.ownerTalentGroupId);
    case 'talentGroup.byTalent':
      return buildTalentGroupsByTalentHref(request.talentId);
    case 'workShift.bySubjectEmploymentProfile':
      return buildWorkShiftsBySubjectEmploymentProfileHref(request.subjectEmploymentProfileId);
    case 'workShift.bySubjectTalent':
      return buildWorkShiftsBySubjectTalentHref(request.subjectTalentId);
    case 'workShift.bySubjectTalentGroup':
      return buildWorkShiftsBySubjectTalentGroupHref(request.subjectTalentGroupId);
    case 'workShift.byStudioResource':
      return buildWorkShiftsByStudioResourceHref(request.studioResourceId);
    case 'event.byAssignmentEmploymentProfile':
      return buildEventsByAssignmentEmploymentProfileHref(request.assignmentEmploymentProfileId);
    case 'event.byAssignmentTalent':
      return buildEventsByAssignmentTalentHref(request.assignmentTalentId);
    case 'event.byAssignmentTalentGroup':
      return buildEventsByAssignmentTalentGroupHref(request.assignmentTalentGroupId);
    case 'event.byStudioResource':
      return buildEventsByStudioResourceHref(request.studioResourceId);
    case 'event.byPlatformAccount':
      return buildEventsByPlatformAccountHref(request.platformAccountId);
    case 'contractRegistry.byLinkedEmploymentProfile':
      return buildContractRegistryByLinkedEmploymentProfileHref(request.linkedEmploymentProfileId);
    case 'contractRegistry.byLinkedTalent':
      return buildContractRegistryByLinkedTalentHref(request.linkedTalentId);
    case 'contractRegistry.byOwner':
      return buildContractRegistryByOwnerHref(request.ownerEmploymentProfileId);
    case 'commissionRules.byContract':
      return buildCommissionRulesByContractHref(request.sourceContractRecordId);
    case 'commissionRules.byBeneficiaryEmploymentProfile':
      return buildCommissionRulesByBeneficiaryEmploymentProfileHref(
        request.beneficiaryEmploymentProfileId,
      );
    case 'commissionRules.byBeneficiaryTalent':
      return buildCommissionRulesByBeneficiaryTalentHref(request.beneficiaryTalentId);
    case 'commissionSettlements.byBeneficiaryEmploymentProfile':
      return buildCommissionSettlementsByBeneficiaryEmploymentProfileHref(
        request.beneficiaryEmploymentProfileIdSnapshot,
      );
    case 'commissionSettlements.byBeneficiaryTalent':
      return buildCommissionSettlementsByBeneficiaryTalentHref(request.beneficiaryTalentIdSnapshot);
    case 'commissionSettlements.bySubjectTalent':
      return buildCommissionSettlementsBySubjectTalentHref(request.subjectTalentId);
    case 'commissionSettlements.byRevenueEntry':
      return buildCommissionSettlementsByRevenueEntryHref(request.revenueEntryId);
    case 'commissionSettlements.bySourceRule':
      return buildCommissionSettlementsBySourceRuleHref(request.sourceRuleId);
    case 'revenueLedger.byTalent':
      return buildRevenueLedgerByTalentHref(request.subjectTalentId);
    case 'revenueLedger.byPlatform':
      return buildRevenueLedgerByPlatformHref(request.attributionPlatformAccountId);
    case 'revenueLedger.byEvent':
      return buildRevenueLedgerByEventHref(request.attributionEventId);
    case 'talentKpi.byTalent':
      return buildTalentKpiByTalentHref(request.subjectTalentId);
    case 'talentKpi.byPlatform':
      return buildTalentKpiByPlatformHref(request.attributionPlatformAccountId);
    case 'talentKpi.byEvent':
      return buildTalentKpiByEventHref(request.attributionEventId);
    default:
      return assertNever(request);
  }
};
