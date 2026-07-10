import { z } from 'zod';

import { defineScreenQueryConfig } from '@shared/query/screen-query-config';
import {
  cursorSchema,
  dropSortDirectionWithoutSortBy,
  enforceRelatedIdentityContract,
  idSchema,
  integerTimestampSchema,
  limitSchema,
  type RelatedIdentityRule,
  sanitizeWindowRange,
  searchSchema,
  sortDirectionSchema,
  utcMidnightTimestampSchema,
} from '@shared/query/screen-query-normalization';

const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/)
  .optional();
const commissionRuleStatusSchema = z.enum(['DRAFT', 'INACTIVE', 'ACTIVE', 'ARCHIVED']).optional();
const commissionSettlementStatusSchema = z
  .enum(['DRAFT', 'FINALIZED', 'VOIDED', 'ARCHIVED'])
  .optional();
const revenueKindSchema = z
  .enum(['PLATFORM_LIVESTREAM', 'PLATFORM_CONTENT', 'EVENT_OPERATIONAL'])
  .optional();
const settlementKindSchema = z.literal('REVENUE_SHARE').optional();
const beneficiaryKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT']).optional();
const settlementKindSnapshotSchema = z.literal('REVENUE_SHARE').optional();
const commissionRuleSortSchema = z
  .enum(['ruleCode', 'title', 'effectiveStartDate', 'createdAt'])
  .optional();
const commissionSettlementSortSchema = z
  .enum(['settlementPeriodStartAt', 'settlementCode', 'createdAt', 'finalizedAt'])
  .optional();

const sanitizeBeneficiaryFilters = <
  TQuery extends {
    beneficiaryKind?: 'EMPLOYMENT_PROFILE' | 'TALENT';
    beneficiaryEmploymentProfileId?: string;
    beneficiaryTalentId?: string;
  },
>(
  query: TQuery,
): TQuery => {
  const next = { ...query };

  if (next.beneficiaryKind === 'EMPLOYMENT_PROFILE') {
    next.beneficiaryTalentId = undefined;
    return next;
  }

  if (next.beneficiaryKind === 'TALENT') {
    next.beneficiaryEmploymentProfileId = undefined;
    return next;
  }

  if (next.beneficiaryEmploymentProfileId && next.beneficiaryTalentId) {
    next.beneficiaryEmploymentProfileId = undefined;
    next.beneficiaryTalentId = undefined;
  }

  return next;
};

const sanitizeStrictBeneficiaryFilters = <
  TQuery extends {
    beneficiaryKind?: 'EMPLOYMENT_PROFILE' | 'TALENT';
    beneficiaryEmploymentProfileId?: string;
    beneficiaryTalentId?: string;
  },
>(
  query: TQuery,
): TQuery => {
  const next = sanitizeBeneficiaryFilters(query);

  if (next.beneficiaryKind === 'EMPLOYMENT_PROFILE') {
    return next.beneficiaryEmploymentProfileId ? next : { ...next, beneficiaryKind: undefined };
  }

  if (next.beneficiaryKind === 'TALENT') {
    return next.beneficiaryTalentId ? next : { ...next, beneficiaryKind: undefined };
  }

  return {
    ...next,
    beneficiaryEmploymentProfileId: undefined,
    beneficiaryTalentId: undefined,
  };
};

const sanitizeBeneficiarySnapshotFilters = <
  TQuery extends {
    beneficiaryKindSnapshot?: 'EMPLOYMENT_PROFILE' | 'TALENT';
    beneficiaryEmploymentProfileIdSnapshot?: string;
    beneficiaryTalentIdSnapshot?: string;
  },
>(
  query: TQuery,
): TQuery => {
  const next = { ...query };

  if (next.beneficiaryKindSnapshot === 'EMPLOYMENT_PROFILE') {
    next.beneficiaryTalentIdSnapshot = undefined;
    return next;
  }

  if (next.beneficiaryKindSnapshot === 'TALENT') {
    next.beneficiaryEmploymentProfileIdSnapshot = undefined;
    return next;
  }

  if (next.beneficiaryEmploymentProfileIdSnapshot && next.beneficiaryTalentIdSnapshot) {
    next.beneficiaryEmploymentProfileIdSnapshot = undefined;
    next.beneficiaryTalentIdSnapshot = undefined;
  }

  return next;
};

const sanitizeStrictBeneficiarySnapshotFilters = <
  TQuery extends {
    beneficiaryKindSnapshot?: 'EMPLOYMENT_PROFILE' | 'TALENT';
    beneficiaryEmploymentProfileIdSnapshot?: string;
    beneficiaryTalentIdSnapshot?: string;
  },
>(
  query: TQuery,
): TQuery => {
  const next = sanitizeBeneficiarySnapshotFilters(query);

  if (next.beneficiaryKindSnapshot === 'EMPLOYMENT_PROFILE') {
    return next.beneficiaryEmploymentProfileIdSnapshot
      ? next
      : { ...next, beneficiaryKindSnapshot: undefined };
  }

  if (next.beneficiaryKindSnapshot === 'TALENT') {
    return next.beneficiaryTalentIdSnapshot
      ? next
      : { ...next, beneficiaryKindSnapshot: undefined };
  }

  return {
    ...next,
    beneficiaryEmploymentProfileIdSnapshot: undefined,
    beneficiaryTalentIdSnapshot: undefined,
  };
};

const commissionRuleFlatListSchema = z.object({
  status: commissionRuleStatusSchema,
  settlementKind: settlementKindSchema,
  beneficiaryKind: beneficiaryKindSchema,
  beneficiaryEmploymentProfileId: idSchema.optional(),
  beneficiaryTalentId: idSchema.optional(),
  sourceContractRecordId: idSchema.optional(),
  appliesToRevenueKind: revenueKindSchema,
  windowStartDate: utcMidnightTimestampSchema,
  windowEndDate: utcMidnightTimestampSchema,
  search: searchSchema,
  sortBy: commissionRuleSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const commissionRuleByBeneficiarySchema = z.object({
  view: z.literal('by-beneficiary').optional(),
  beneficiaryKind: beneficiaryKindSchema,
  beneficiaryEmploymentProfileId: idSchema.optional(),
  beneficiaryTalentId: idSchema.optional(),
  status: commissionRuleStatusSchema,
  sortBy: commissionRuleSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const commissionRuleByContractSchema = z.object({
  view: z.literal('by-contract').optional(),
  sourceContractRecordId: idSchema.optional(),
  status: commissionRuleStatusSchema,
  sortBy: commissionRuleSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const commissionSettlementFlatListSchema = z.object({
  status: commissionSettlementStatusSchema,
  settlementKindSnapshot: settlementKindSnapshotSchema,
  beneficiaryKindSnapshot: beneficiaryKindSchema,
  beneficiaryEmploymentProfileIdSnapshot: idSchema.optional(),
  beneficiaryTalentIdSnapshot: idSchema.optional(),
  subjectTalentId: idSchema.optional(),
  sourceRuleId: idSchema.optional(),
  containsRevenueEntryId: idSchema.optional(),
  settlementCurrencyCode: currencyCodeSchema,
  windowStartAt: integerTimestampSchema,
  windowEndAt: integerTimestampSchema,
  createdBeforeAt: integerTimestampSchema,
  finalizedFromAt: integerTimestampSchema,
  finalizedToAt: integerTimestampSchema,
  search: searchSchema,
  sortBy: commissionSettlementSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const commissionSettlementByBeneficiarySchema = z.object({
  view: z.literal('by-beneficiary').optional(),
  beneficiaryKindSnapshot: beneficiaryKindSchema,
  beneficiaryEmploymentProfileIdSnapshot: idSchema.optional(),
  beneficiaryTalentIdSnapshot: idSchema.optional(),
  status: commissionSettlementStatusSchema,
  windowStartAt: integerTimestampSchema,
  windowEndAt: integerTimestampSchema,
  sortBy: commissionSettlementSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const commissionSettlementBySubjectTalentSchema = z.object({
  view: z.literal('by-subject-talent').optional(),
  subjectTalentId: idSchema.optional(),
  status: commissionSettlementStatusSchema,
  windowStartAt: integerTimestampSchema,
  windowEndAt: integerTimestampSchema,
  sortBy: commissionSettlementSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const commissionSettlementByRevenueEntrySchema = z.object({
  view: z.literal('by-revenue-entry').optional(),
  revenueEntryId: idSchema.optional(),
  status: commissionSettlementStatusSchema,
  windowStartAt: integerTimestampSchema,
  windowEndAt: integerTimestampSchema,
  sortBy: commissionSettlementSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const commissionRuleByBeneficiaryIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionRuleByBeneficiarySchema>
>[] = [
  { requiredKeys: ['beneficiaryKind'] },
  {
    when: { beneficiaryKind: 'EMPLOYMENT_PROFILE' },
    requiredKeys: ['beneficiaryEmploymentProfileId'],
  },
  { when: { beneficiaryKind: 'TALENT' }, requiredKeys: ['beneficiaryTalentId'] },
];

const commissionRuleByContractIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionRuleByContractSchema>
>[] = [{ requiredKeys: ['sourceContractRecordId'] }];

const commissionSettlementByBeneficiaryIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionSettlementByBeneficiarySchema>
>[] = [
  { requiredKeys: ['beneficiaryKindSnapshot'] },
  {
    when: { beneficiaryKindSnapshot: 'EMPLOYMENT_PROFILE' },
    requiredKeys: ['beneficiaryEmploymentProfileIdSnapshot'],
  },
  {
    when: { beneficiaryKindSnapshot: 'TALENT' },
    requiredKeys: ['beneficiaryTalentIdSnapshot'],
  },
];

const commissionSettlementBySubjectTalentIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionSettlementBySubjectTalentSchema>
>[] = [{ requiredKeys: ['subjectTalentId'] }];

const commissionSettlementByRevenueEntryIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionSettlementByRevenueEntrySchema>
>[] = [{ requiredKeys: ['revenueEntryId'] }];

export const commissionRulesFlatListQueryConfig = defineScreenQueryConfig({
  id: 'commission-rules.flat-list',
  schema: commissionRuleFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    dropSortDirectionWithoutSortBy(
      sanitizeWindowRange(
        sanitizeBeneficiaryFilters({ ...query }),
        'windowStartDate',
        'windowEndDate',
      ),
    ),
  capabilities: {
    surface: 'flat-list',
    search: { supported: true, key: 'search' },
    cursor: { supported: true, key: 'cursor' },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['ruleCode', 'title', 'effectiveStartDate', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'status',
      'settlementKind',
      'beneficiaryKind',
      'beneficiaryEmploymentProfileId',
      'beneficiaryTalentId',
      'sourceContractRecordId',
      'appliesToRevenueKind',
      'windowStartDate',
      'windowEndDate',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const commissionRulesByBeneficiaryQueryConfig = defineScreenQueryConfig({
  id: 'commission-rules.by-beneficiary',
  schema: commissionRuleByBeneficiarySchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(sanitizeStrictBeneficiaryFilters({ ...query })),
      'by-beneficiary',
      commissionRuleByBeneficiaryIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: { view: 'by-beneficiary', identityRules: commissionRuleByBeneficiaryIdentityRules },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['ruleCode', 'title', 'effectiveStartDate', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'beneficiaryKind',
      'beneficiaryEmploymentProfileId',
      'beneficiaryTalentId',
      'status',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const commissionRulesByContractQueryConfig = defineScreenQueryConfig({
  id: 'commission-rules.by-contract',
  schema: commissionRuleByContractSchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy({ ...query }),
      'by-contract',
      commissionRuleByContractIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: { view: 'by-contract', identityRules: commissionRuleByContractIdentityRules },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['ruleCode', 'title', 'effectiveStartDate', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['sourceContractRecordId', 'status'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const commissionSettlementsFlatListQueryConfig = defineScreenQueryConfig({
  id: 'commission-settlements.flat-list',
  schema: commissionSettlementFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    dropSortDirectionWithoutSortBy(
      sanitizeWindowRange(
        sanitizeWindowRange(
          sanitizeBeneficiarySnapshotFilters({ ...query }),
          'finalizedFromAt',
          'finalizedToAt',
        ),
        'windowStartAt',
        'windowEndAt',
      ),
    ),
  capabilities: {
    surface: 'flat-list',
    search: { supported: true, key: 'search' },
    cursor: { supported: true, key: 'cursor' },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['settlementPeriodStartAt', 'settlementCode', 'createdAt', 'finalizedAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'status',
      'settlementKindSnapshot',
      'beneficiaryKindSnapshot',
      'beneficiaryEmploymentProfileIdSnapshot',
      'beneficiaryTalentIdSnapshot',
      'subjectTalentId',
      'sourceRuleId',
      'containsRevenueEntryId',
      'settlementCurrencyCode',
      'windowStartAt',
      'windowEndAt',
      'createdBeforeAt',
      'finalizedFromAt',
      'finalizedToAt',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const commissionSettlementsByBeneficiaryQueryConfig = defineScreenQueryConfig({
  id: 'commission-settlements.by-beneficiary',
  schema: commissionSettlementByBeneficiarySchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeStrictBeneficiarySnapshotFilters(
          sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
        ),
      ),
      'by-beneficiary',
      commissionSettlementByBeneficiaryIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-beneficiary',
      identityRules: commissionSettlementByBeneficiaryIdentityRules,
    },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['settlementPeriodStartAt', 'settlementCode', 'createdAt', 'finalizedAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'beneficiaryKindSnapshot',
      'beneficiaryEmploymentProfileIdSnapshot',
      'beneficiaryTalentIdSnapshot',
      'status',
      'windowStartAt',
      'windowEndAt',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const commissionSettlementsBySubjectTalentQueryConfig = defineScreenQueryConfig({
  id: 'commission-settlements.by-subject-talent',
  schema: commissionSettlementBySubjectTalentSchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-subject-talent',
      commissionSettlementBySubjectTalentIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-subject-talent',
      identityRules: commissionSettlementBySubjectTalentIdentityRules,
    },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['settlementPeriodStartAt', 'settlementCode', 'createdAt', 'finalizedAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['subjectTalentId', 'status', 'windowStartAt', 'windowEndAt'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const commissionSettlementsByRevenueEntryQueryConfig = defineScreenQueryConfig({
  id: 'commission-settlements.by-revenue-entry',
  schema: commissionSettlementByRevenueEntrySchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-revenue-entry',
      commissionSettlementByRevenueEntryIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-revenue-entry',
      identityRules: commissionSettlementByRevenueEntryIdentityRules,
    },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['settlementPeriodStartAt', 'settlementCode', 'createdAt', 'finalizedAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['revenueEntryId', 'status', 'windowStartAt', 'windowEndAt'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const commissionRulesScreenQueryConfigs = {
  flatList: commissionRulesFlatListQueryConfig,
  byBeneficiary: commissionRulesByBeneficiaryQueryConfig,
  byContract: commissionRulesByContractQueryConfig,
} as const;

export const commissionSettlementsScreenQueryConfigs = {
  flatList: commissionSettlementsFlatListQueryConfig,
  byBeneficiary: commissionSettlementsByBeneficiaryQueryConfig,
  bySubjectTalent: commissionSettlementsBySubjectTalentQueryConfig,
  byRevenueEntry: commissionSettlementsByRevenueEntryQueryConfig,
} as const;

export const commissionScreenQueryConfigs = {
  rules: commissionRulesScreenQueryConfigs,
  settlements: commissionSettlementsScreenQueryConfigs,
} as const;
