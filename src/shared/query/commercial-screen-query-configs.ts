import { z } from 'zod';

import { defineScreenQueryConfig } from '@shared/query/screen-query-config';

const idSchema = z.string().trim().min(1);
const cursorSchema = z.string().trim().min(1).optional();
const preprocessBlankNumericQueryValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().length === 0 ? undefined : value;
};

const limitSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce.number().int().min(1).max(100).optional(),
);
const searchSchema = z.string().trim().min(1).optional();
const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/)
  .optional();
const integerTimestampSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce.number().int().safe().optional(),
);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const utcMidnightTimestampSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce
    .number()
    .int()
    .safe()
    .refine((value) => value % MILLISECONDS_PER_DAY === 0)
    .optional(),
);

const isCanonicalDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() + 1 === month &&
    utcDate.getUTCDate() === day
  );
};

const contractDateSchema = z.string().trim().refine(isCanonicalDate).optional();

const sortDirectionSchema = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.enum(['asc', 'desc']),
  )
  .optional();

const contractHasFileReferenceSchema = z
  .preprocess((value) => {
    if (value === 'true' || value === true) {
      return true;
    }

    if (value === 'false' || value === false) {
      return false;
    }

    return value;
  }, z.boolean())
  .optional();

const revenueEntryStatusSchema = z
  .enum(['DRAFT', 'FINALIZED', 'RECONCILED', 'VOIDED', 'ARCHIVED'])
  .optional();
const contractStatusSchema = z
  .enum(['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'ARCHIVED'])
  .optional();
const commissionRuleStatusSchema = z.enum(['DRAFT', 'INACTIVE', 'ACTIVE', 'ARCHIVED']).optional();
const commissionSettlementStatusSchema = z
  .enum(['DRAFT', 'FINALIZED', 'VOIDED', 'ARCHIVED'])
  .optional();
const contractKindSchema = z.enum(['EMPLOYMENT', 'TALENT_SERVICE', 'TALENT_MANAGEMENT']).optional();
const linkedEntityKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT']).optional();
const confidentialityTierSchema = z.enum(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional();
const revenueKindSchema = z
  .enum(['PLATFORM_LIVESTREAM', 'PLATFORM_CONTENT', 'EVENT_OPERATIONAL'])
  .optional();
const entrySourceSchema = z.literal('MANUAL').optional();
const settlementKindSchema = z.literal('REVENUE_SHARE').optional();
const beneficiaryKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT']).optional();
const settlementKindSnapshotSchema = z.literal('REVENUE_SHARE').optional();

const dropSortDirectionWithoutSortBy = <TQuery extends { sortBy?: string; sortDirection?: string }>(
  query: TQuery,
): TQuery => {
  if (query.sortBy) {
    return query;
  }

  return {
    ...query,
    sortDirection: undefined,
  };
};

const sanitizeLinkedEntityFilters = <
  TQuery extends {
    linkedEntityKind?: 'EMPLOYMENT_PROFILE' | 'TALENT';
    linkedEmploymentProfileId?: string;
    linkedTalentId?: string;
  },
>(
  query: TQuery,
): TQuery => {
  const next = { ...query };

  if (next.linkedEntityKind === 'EMPLOYMENT_PROFILE') {
    next.linkedTalentId = undefined;
    return next;
  }

  if (next.linkedEntityKind === 'TALENT') {
    next.linkedEmploymentProfileId = undefined;
    return next;
  }

  if (next.linkedEmploymentProfileId && next.linkedTalentId) {
    next.linkedEmploymentProfileId = undefined;
    next.linkedTalentId = undefined;
  }

  return next;
};

const sanitizeStrictLinkedEntityFilters = <
  TQuery extends {
    linkedEntityKind?: 'EMPLOYMENT_PROFILE' | 'TALENT';
    linkedEmploymentProfileId?: string;
    linkedTalentId?: string;
  },
>(
  query: TQuery,
): TQuery => {
  const next = sanitizeLinkedEntityFilters(query);

  if (next.linkedEntityKind === 'EMPLOYMENT_PROFILE') {
    if (!next.linkedEmploymentProfileId) {
      return {
        ...next,
        linkedEntityKind: undefined,
      };
    }

    return next;
  }

  if (next.linkedEntityKind === 'TALENT') {
    if (!next.linkedTalentId) {
      return {
        ...next,
        linkedEntityKind: undefined,
      };
    }

    return next;
  }

  return {
    ...next,
    linkedEmploymentProfileId: undefined,
    linkedTalentId: undefined,
  };
};

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
    if (!next.beneficiaryEmploymentProfileId) {
      return {
        ...next,
        beneficiaryKind: undefined,
      };
    }

    return next;
  }

  if (next.beneficiaryKind === 'TALENT') {
    if (!next.beneficiaryTalentId) {
      return {
        ...next,
        beneficiaryKind: undefined,
      };
    }

    return next;
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
    if (!next.beneficiaryEmploymentProfileIdSnapshot) {
      return {
        ...next,
        beneficiaryKindSnapshot: undefined,
      };
    }

    return next;
  }

  if (next.beneficiaryKindSnapshot === 'TALENT') {
    if (!next.beneficiaryTalentIdSnapshot) {
      return {
        ...next,
        beneficiaryKindSnapshot: undefined,
      };
    }

    return next;
  }

  return {
    ...next,
    beneficiaryEmploymentProfileIdSnapshot: undefined,
    beneficiaryTalentIdSnapshot: undefined,
  };
};

type RelatedIdentityRule<TQuery extends Record<string, unknown>> = {
  when?: Partial<Record<Extract<keyof TQuery, string>, string | number | boolean | undefined>>;
  requiredKeys: readonly Extract<keyof TQuery, string>[];
};

const hasPresentValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
};

const sanitizeWindowRange = <
  TQuery extends Record<string, unknown>,
  TStartKey extends Extract<keyof TQuery, string>,
  TEndKey extends Extract<keyof TQuery, string>,
>(
  query: TQuery,
  startKey: TStartKey,
  endKey: TEndKey,
): TQuery => {
  const start = query[startKey];
  const end = query[endKey];

  if (typeof start === 'number' && typeof end === 'number' && end <= start) {
    return {
      ...query,
      [startKey]: undefined,
      [endKey]: undefined,
    };
  }

  const startString = typeof start === 'string' ? (start as string) : undefined;
  const endString = typeof end === 'string' ? (end as string) : undefined;

  if (startString && endString && endString <= startString) {
    return {
      ...query,
      [startKey]: undefined,
      [endKey]: undefined,
    };
  }

  return query;
};

const ruleMatches = <TQuery extends Record<string, unknown>>(
  query: TQuery,
  rule: RelatedIdentityRule<TQuery>,
): boolean => {
  if (!rule.when) {
    return true;
  }

  return Object.entries(rule.when).every(([key, expectedValue]) => {
    return query[key as keyof TQuery] === expectedValue;
  });
};

const resolveRequiredIdentityKeys = <TQuery extends Record<string, unknown>>(
  query: TQuery,
  rules: readonly RelatedIdentityRule<TQuery>[],
): Extract<keyof TQuery, string>[] => {
  const required = new Set<Extract<keyof TQuery, string>>();

  rules.forEach((rule) => {
    if (!ruleMatches(query, rule)) {
      return;
    }

    rule.requiredKeys.forEach((key) => {
      required.add(key);
    });
  });

  return Array.from(required);
};

const enforceRelatedIdentityContract = <TQuery extends { view?: string }>(
  query: TQuery,
  relatedView: string,
  rules: readonly RelatedIdentityRule<TQuery>[],
): TQuery => {
  const next = { ...query };

  if (next.view !== relatedView) {
    return {
      ...next,
      view: undefined,
    };
  }

  const requiredKeys = resolveRequiredIdentityKeys(next, rules);
  const hasAllRequiredKeys = requiredKeys.every((key) => hasPresentValue(next[key]));

  if (hasAllRequiredKeys) {
    return next;
  }

  const cleared: Record<string, unknown> = {
    ...next,
    view: undefined,
  };
  requiredKeys.forEach((key) => {
    cleared[key] = undefined;
  });

  return cleared as TQuery;
};

const revenueFlatSortSchema = z.enum(['recognizedAt', 'createdAt', 'revenueEntryCode']).optional();
const revenueRelatedSortSchema = z.enum(['recognizedAt']).optional();
const contractSortSchema = z.enum(['effectiveStartDate', 'contractCode', 'createdAt']).optional();
const commissionRuleSortSchema = z
  .enum(['ruleCode', 'title', 'effectiveStartDate', 'createdAt'])
  .optional();
const commissionSettlementSortSchema = z
  .enum(['settlementPeriodStartAt', 'settlementCode', 'createdAt', 'finalizedAt'])
  .optional();

const revenueFlatListSchema = z.object({
  status: revenueEntryStatusSchema,
  subjectTalentId: idSchema.optional(),
  attributionPlatformAccountId: idSchema.optional(),
  attributionEventId: idSchema.optional(),
  revenueKind: revenueKindSchema,
  entrySource: entrySourceSchema,
  currencyCode: currencyCodeSchema,
  windowStartAt: integerTimestampSchema,
  windowEndAt: integerTimestampSchema,
  createdBeforeAt: integerTimestampSchema,
  finalizedFromAt: integerTimestampSchema,
  finalizedToAt: integerTimestampSchema,
  reconciledFromAt: integerTimestampSchema,
  reconciledToAt: integerTimestampSchema,
  search: searchSchema,
  sortBy: revenueFlatSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const revenueRelatedSchemaBase = z.object({
  status: revenueEntryStatusSchema,
  windowStartAt: integerTimestampSchema,
  windowEndAt: integerTimestampSchema,
  sortBy: revenueRelatedSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const contractFlatListSchema = z.object({
  status: contractStatusSchema,
  contractKind: contractKindSchema,
  linkedEntityKind: linkedEntityKindSchema,
  linkedEmploymentProfileId: idSchema.optional(),
  linkedTalentId: idSchema.optional(),
  ownerEmploymentProfileId: idSchema.optional(),
  confidentialityTier: confidentialityTierSchema,
  hasFileReference: contractHasFileReferenceSchema,
  windowStartDate: contractDateSchema,
  windowEndDate: contractDateSchema,
  effectiveEndDateFrom: contractDateSchema,
  effectiveEndDateTo: contractDateSchema,
  search: searchSchema,
  sortBy: contractSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const contractByLinkedEntitySchema = z.object({
  view: z.literal('by-linked-entity').optional(),
  linkedEntityKind: linkedEntityKindSchema,
  linkedEmploymentProfileId: idSchema.optional(),
  linkedTalentId: idSchema.optional(),
  status: contractStatusSchema,
  windowStartDate: contractDateSchema,
  windowEndDate: contractDateSchema,
  sortBy: contractSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const contractByOwnerSchema = z.object({
  view: z.literal('by-owner').optional(),
  ownerEmploymentProfileId: idSchema.optional(),
  status: contractStatusSchema,
  windowStartDate: contractDateSchema,
  windowEndDate: contractDateSchema,
  sortBy: contractSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

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

const revenueByTalentSchema = revenueRelatedSchemaBase.extend({
  view: z.literal('by-talent').optional(),
  subjectTalentId: idSchema.optional(),
});

const revenueByPlatformSchema = revenueRelatedSchemaBase.extend({
  view: z.literal('by-platform').optional(),
  attributionPlatformAccountId: idSchema.optional(),
});

const revenueByEventSchema = revenueRelatedSchemaBase.extend({
  view: z.literal('by-event').optional(),
  attributionEventId: idSchema.optional(),
});

const contractByLinkedEntityIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof contractByLinkedEntitySchema>
>[] = [
  {
    requiredKeys: ['linkedEntityKind'],
  },
  {
    when: { linkedEntityKind: 'EMPLOYMENT_PROFILE' },
    requiredKeys: ['linkedEmploymentProfileId'],
  },
  {
    when: { linkedEntityKind: 'TALENT' },
    requiredKeys: ['linkedTalentId'],
  },
];

const contractByOwnerIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof contractByOwnerSchema>
>[] = [
  {
    requiredKeys: ['ownerEmploymentProfileId'],
  },
];

const commissionRuleByBeneficiaryIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionRuleByBeneficiarySchema>
>[] = [
  {
    requiredKeys: ['beneficiaryKind'],
  },
  {
    when: { beneficiaryKind: 'EMPLOYMENT_PROFILE' },
    requiredKeys: ['beneficiaryEmploymentProfileId'],
  },
  {
    when: { beneficiaryKind: 'TALENT' },
    requiredKeys: ['beneficiaryTalentId'],
  },
];

const commissionRuleByContractIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionRuleByContractSchema>
>[] = [
  {
    requiredKeys: ['sourceContractRecordId'],
  },
];

const commissionSettlementByBeneficiaryIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionSettlementByBeneficiarySchema>
>[] = [
  {
    requiredKeys: ['beneficiaryKindSnapshot'],
  },
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
>[] = [
  {
    requiredKeys: ['subjectTalentId'],
  },
];

const commissionSettlementByRevenueEntryIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof commissionSettlementByRevenueEntrySchema>
>[] = [
  {
    requiredKeys: ['revenueEntryId'],
  },
];

const revenueByTalentIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof revenueByTalentSchema>
>[] = [{ requiredKeys: ['subjectTalentId'] }];

const revenueByPlatformIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof revenueByPlatformSchema>
>[] = [{ requiredKeys: ['attributionPlatformAccountId'] }];

const revenueByEventIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof revenueByEventSchema>
>[] = [{ requiredKeys: ['attributionEventId'] }];

export const revenueLedgerFlatListQueryConfig = defineScreenQueryConfig({
  id: 'revenue-ledger.flat-list',
  schema: revenueFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    const next = dropSortDirectionWithoutSortBy(
      sanitizeWindowRange(
        sanitizeWindowRange({ ...query }, 'finalizedFromAt', 'finalizedToAt'),
        'windowStartAt',
        'windowEndAt',
      ),
    );
    const normalized = sanitizeWindowRange(next, 'reconciledFromAt', 'reconciledToAt');
    const hasNarrowSortBlocker = Boolean(
      hasPresentValue(normalized.subjectTalentId) ||
      hasPresentValue(normalized.attributionPlatformAccountId) ||
      hasPresentValue(normalized.attributionEventId) ||
      hasPresentValue(normalized.revenueKind) ||
      hasPresentValue(normalized.entrySource) ||
      hasPresentValue(normalized.currencyCode) ||
      hasPresentValue(normalized.windowStartAt) ||
      hasPresentValue(normalized.windowEndAt) ||
      hasPresentValue(normalized.createdBeforeAt) ||
      hasPresentValue(normalized.finalizedFromAt) ||
      hasPresentValue(normalized.finalizedToAt) ||
      hasPresentValue(normalized.reconciledFromAt) ||
      hasPresentValue(normalized.reconciledToAt) ||
      hasPresentValue(normalized.search),
    );
    const hasExplicitStatus = normalized.status !== undefined;
    const usesNarrowSort =
      normalized.sortBy === 'createdAt' || normalized.sortBy === 'revenueEntryCode';

    if (usesNarrowSort && (hasNarrowSortBlocker || hasExplicitStatus)) {
      return {
        ...normalized,
        sortBy: 'recognizedAt' as const,
      };
    }

    return normalized;
  },
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['recognizedAt', 'createdAt', 'revenueEntryCode'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'status',
      'subjectTalentId',
      'attributionPlatformAccountId',
      'attributionEventId',
      'revenueKind',
      'entrySource',
      'currencyCode',
      'windowStartAt',
      'windowEndAt',
      'createdBeforeAt',
      'finalizedFromAt',
      'finalizedToAt',
      'reconciledFromAt',
      'reconciledToAt',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const revenueLedgerByTalentQueryConfig = defineScreenQueryConfig({
  id: 'revenue-ledger.by-talent',
  schema: revenueByTalentSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-talent',
      revenueByTalentIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-talent',
      identityRules: revenueByTalentIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['recognizedAt'],
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

export const revenueLedgerByPlatformQueryConfig = defineScreenQueryConfig({
  id: 'revenue-ledger.by-platform',
  schema: revenueByPlatformSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-platform',
      revenueByPlatformIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-platform',
      identityRules: revenueByPlatformIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['recognizedAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['attributionPlatformAccountId', 'status', 'windowStartAt', 'windowEndAt'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const revenueLedgerByEventQueryConfig = defineScreenQueryConfig({
  id: 'revenue-ledger.by-event',
  schema: revenueByEventSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-event',
      revenueByEventIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-event',
      identityRules: revenueByEventIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['recognizedAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['attributionEventId', 'status', 'windowStartAt', 'windowEndAt'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const contractRegistryFlatListQueryConfig = defineScreenQueryConfig({
  id: 'contract-registry.flat-list',
  schema: contractFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return dropSortDirectionWithoutSortBy(
      sanitizeWindowRange(
        sanitizeWindowRange(
          sanitizeLinkedEntityFilters({ ...query }),
          'effectiveEndDateFrom',
          'effectiveEndDateTo',
        ),
        'windowStartDate',
        'windowEndDate',
      ),
    );
  },
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['effectiveStartDate', 'contractCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'status',
      'contractKind',
      'linkedEntityKind',
      'linkedEmploymentProfileId',
      'linkedTalentId',
      'ownerEmploymentProfileId',
      'confidentialityTier',
      'hasFileReference',
      'windowStartDate',
      'windowEndDate',
      'effectiveEndDateFrom',
      'effectiveEndDateTo',
    ],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const contractRegistryByLinkedEntityQueryConfig = defineScreenQueryConfig({
  id: 'contract-registry.by-linked-entity',
  schema: contractByLinkedEntitySchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeStrictLinkedEntityFilters(
          sanitizeWindowRange({ ...query }, 'windowStartDate', 'windowEndDate'),
        ),
      ),
      'by-linked-entity',
      contractByLinkedEntityIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-linked-entity',
      identityRules: contractByLinkedEntityIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['effectiveStartDate', 'contractCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: [
      'linkedEntityKind',
      'linkedEmploymentProfileId',
      'linkedTalentId',
      'status',
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

export const contractRegistryByOwnerQueryConfig = defineScreenQueryConfig({
  id: 'contract-registry.by-owner',
  schema: contractByOwnerSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartDate', 'windowEndDate'),
      ),
      'by-owner',
      contractByOwnerIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-owner',
      identityRules: contractByOwnerIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: true,
      sortByKey: 'sortBy',
      sortDirectionKey: 'sortDirection',
      allowedSortFields: ['effectiveStartDate', 'contractCode', 'createdAt'],
      allowedSortDirections: ['asc', 'desc'],
    },
    allowedFilterKeys: ['ownerEmploymentProfileId', 'status', 'windowStartDate', 'windowEndDate'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'status',
      archivedValue: 'ARCHIVED',
    },
  },
});

export const commissionRulesFlatListQueryConfig = defineScreenQueryConfig({
  id: 'commission-rules.flat-list',
  schema: commissionRuleFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) => {
    return dropSortDirectionWithoutSortBy(
      sanitizeWindowRange(
        sanitizeBeneficiaryFilters({ ...query }),
        'windowStartDate',
        'windowEndDate',
      ),
    );
  },
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
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
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(sanitizeStrictBeneficiaryFilters({ ...query })),
      'by-beneficiary',
      commissionRuleByBeneficiaryIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-beneficiary',
      identityRules: commissionRuleByBeneficiaryIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
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
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy({ ...query }),
      'by-contract',
      commissionRuleByContractIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-contract',
      identityRules: commissionRuleByContractIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
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
  normalize: (query) => {
    return dropSortDirectionWithoutSortBy(
      sanitizeWindowRange(
        sanitizeWindowRange(
          sanitizeBeneficiarySnapshotFilters({ ...query }),
          'finalizedFromAt',
          'finalizedToAt',
        ),
        'windowStartAt',
        'windowEndAt',
      ),
    );
  },
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
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
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeStrictBeneficiarySnapshotFilters(
          sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
        ),
      ),
      'by-beneficiary',
      commissionSettlementByBeneficiaryIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-beneficiary',
      identityRules: commissionSettlementByBeneficiaryIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
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
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-subject-talent',
      commissionSettlementBySubjectTalentIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-subject-talent',
      identityRules: commissionSettlementBySubjectTalentIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
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
  normalize: (query) => {
    return enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-revenue-entry',
      commissionSettlementByRevenueEntryIdentityRules,
    );
  },
  capabilities: {
    surface: 'related-list',
    related: {
      view: 'by-revenue-entry',
      identityRules: commissionSettlementByRevenueEntryIdentityRules,
    },
    search: {
      supported: false,
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
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

export const commercialScreenQueryConfigs = {
  revenueLedger: {
    flatList: revenueLedgerFlatListQueryConfig,
    byTalent: revenueLedgerByTalentQueryConfig,
    byPlatform: revenueLedgerByPlatformQueryConfig,
    byEvent: revenueLedgerByEventQueryConfig,
  },
  contractRegistry: {
    flatList: contractRegistryFlatListQueryConfig,
    byLinkedEntity: contractRegistryByLinkedEntityQueryConfig,
    byOwner: contractRegistryByOwnerQueryConfig,
  },
  commissionRules: {
    flatList: commissionRulesFlatListQueryConfig,
    byBeneficiary: commissionRulesByBeneficiaryQueryConfig,
    byContract: commissionRulesByContractQueryConfig,
  },
  commissionSettlements: {
    flatList: commissionSettlementsFlatListQueryConfig,
    byBeneficiary: commissionSettlementsByBeneficiaryQueryConfig,
    bySubjectTalent: commissionSettlementsBySubjectTalentQueryConfig,
    byRevenueEntry: commissionSettlementsByRevenueEntryQueryConfig,
  },
} as const;
