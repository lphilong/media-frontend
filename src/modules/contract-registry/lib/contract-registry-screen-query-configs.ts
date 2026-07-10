import { z } from 'zod';

import { defineScreenQueryConfig } from '@shared/query/screen-query-config';
import {
  booleanQuerySchema,
  canonicalDateSchema,
  cursorSchema,
  dropSortDirectionWithoutSortBy,
  enforceRelatedIdentityContract,
  idSchema,
  limitSchema,
  type RelatedIdentityRule,
  sanitizeWindowRange,
  searchSchema,
  sortDirectionSchema,
} from '@shared/query/screen-query-normalization';

const contractStatusSchema = z
  .enum(['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'ARCHIVED'])
  .optional();
const contractKindSchema = z.enum(['EMPLOYMENT', 'TALENT_SERVICE', 'TALENT_MANAGEMENT']).optional();
const linkedEntityKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT']).optional();
const confidentialityTierSchema = z.enum(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional();
const contractSortSchema = z.enum(['effectiveStartDate', 'contractCode', 'createdAt']).optional();

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
    return next.linkedEmploymentProfileId ? next : { ...next, linkedEntityKind: undefined };
  }

  if (next.linkedEntityKind === 'TALENT') {
    return next.linkedTalentId ? next : { ...next, linkedEntityKind: undefined };
  }

  return {
    ...next,
    linkedEmploymentProfileId: undefined,
    linkedTalentId: undefined,
  };
};

const contractFlatListSchema = z.object({
  status: contractStatusSchema,
  contractKind: contractKindSchema,
  linkedEntityKind: linkedEntityKindSchema,
  linkedEmploymentProfileId: idSchema.optional(),
  linkedTalentId: idSchema.optional(),
  ownerEmploymentProfileId: idSchema.optional(),
  confidentialityTier: confidentialityTierSchema,
  hasFileReference: booleanQuerySchema,
  windowStartDate: canonicalDateSchema,
  windowEndDate: canonicalDateSchema,
  effectiveEndDateFrom: canonicalDateSchema,
  effectiveEndDateTo: canonicalDateSchema,
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
  windowStartDate: canonicalDateSchema,
  windowEndDate: canonicalDateSchema,
  sortBy: contractSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const contractByOwnerSchema = z.object({
  view: z.literal('by-owner').optional(),
  ownerEmploymentProfileId: idSchema.optional(),
  status: contractStatusSchema,
  windowStartDate: canonicalDateSchema,
  windowEndDate: canonicalDateSchema,
  sortBy: contractSortSchema,
  sortDirection: sortDirectionSchema,
  limit: limitSchema,
  cursor: cursorSchema,
});

const contractByLinkedEntityIdentityRules: readonly RelatedIdentityRule<
  z.infer<typeof contractByLinkedEntitySchema>
>[] = [
  { requiredKeys: ['linkedEntityKind'] },
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
>[] = [{ requiredKeys: ['ownerEmploymentProfileId'] }];

export const contractRegistryFlatListQueryConfig = defineScreenQueryConfig({
  id: 'contract-registry.flat-list',
  schema: contractFlatListSchema,
  cursorKey: 'cursor',
  normalize: (query) =>
    dropSortDirectionWithoutSortBy(
      sanitizeWindowRange(
        sanitizeWindowRange(
          sanitizeLinkedEntityFilters({ ...query }),
          'effectiveEndDateFrom',
          'effectiveEndDateTo',
        ),
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
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeStrictLinkedEntityFilters(
          sanitizeWindowRange({ ...query }, 'windowStartDate', 'windowEndDate'),
        ),
      ),
      'by-linked-entity',
      contractByLinkedEntityIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: { view: 'by-linked-entity', identityRules: contractByLinkedEntityIdentityRules },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
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
  normalize: (query) =>
    enforceRelatedIdentityContract(
      dropSortDirectionWithoutSortBy(
        sanitizeWindowRange({ ...query }, 'windowStartDate', 'windowEndDate'),
      ),
      'by-owner',
      contractByOwnerIdentityRules,
    ),
  capabilities: {
    surface: 'related-list',
    related: { view: 'by-owner', identityRules: contractByOwnerIdentityRules },
    search: { supported: false },
    cursor: { supported: true, key: 'cursor' },
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

export const contractRegistryScreenQueryConfigs = {
  flatList: contractRegistryFlatListQueryConfig,
  byLinkedEntity: contractRegistryByLinkedEntityQueryConfig,
  byOwner: contractRegistryByOwnerQueryConfig,
} as const;
