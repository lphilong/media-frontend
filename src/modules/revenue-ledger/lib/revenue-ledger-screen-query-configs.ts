import { z } from 'zod';

import { defineScreenQueryConfig } from '@shared/query/screen-query-config';
import {
  cursorSchema,
  dropSortDirectionWithoutSortBy,
  enforceRelatedIdentityContract,
  hasPresentValue,
  idSchema,
  integerTimestampSchema,
  limitSchema,
  type RelatedIdentityRule,
  sanitizeWindowRange,
  searchSchema,
  sortDirectionSchema,
} from '@shared/query/screen-query-normalization';

const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/)
  .optional();
const revenueEntryStatusSchema = z
  .enum(['DRAFT', 'FINALIZED', 'RECONCILED', 'VOIDED', 'ARCHIVED'])
  .optional();
const revenueKindSchema = z
  .enum(['PLATFORM_LIVESTREAM', 'PLATFORM_CONTENT', 'EVENT_OPERATIONAL'])
  .optional();
const entrySourceSchema = z.literal('MANUAL').optional();
const revenueFlatSortSchema = z.enum(['recognizedAt', 'createdAt', 'revenueEntryCode']).optional();
const revenueRelatedSortSchema = z.enum(['recognizedAt']).optional();

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
    search: { supported: true, key: 'search' },
    cursor: { supported: true, key: 'cursor' },
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
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-talent',
      revenueByTalentIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: { view: 'by-talent', identityRules: revenueByTalentIdentityRules },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
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
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-platform',
      revenueByPlatformIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: { view: 'by-platform', identityRules: revenueByPlatformIdentityRules },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
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
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartAt', 'windowEndAt'),
      ),
      'by-event',
      revenueByEventIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: { view: 'by-event', identityRules: revenueByEventIdentityRules },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
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

export const revenueLedgerScreenQueryConfigs = {
  flatList: revenueLedgerFlatListQueryConfig,
  byTalent: revenueLedgerByTalentQueryConfig,
  byPlatform: revenueLedgerByPlatformQueryConfig,
  byEvent: revenueLedgerByEventQueryConfig,
} as const;
