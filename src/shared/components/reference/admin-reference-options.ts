import { z } from 'zod';

import { APP_PATHS } from '@app/router/paths';
import { fetchEmploymentProfiles } from '@modules/employment-profile/api/employment-profile.api';
import type {
  EmploymentProfileListItem,
  EmploymentStatus,
} from '@modules/employment-profile/types/employment-profile.types';
import type { PlatformAccountOwnerKind } from '@modules/platform-account/types/platform-account.types';
import { fetchUsers } from '@modules/user/api/user.api';
import type { UserListItem } from '@modules/user/types/user.types';
import { apiRequest } from '@shared/api';
import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
  type ReferenceLookupResource,
} from '@shared/components/reference/reference-lookup.api';

const OPTION_LIMIT = 20;

const referenceUserListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    email: z.string().nullable().optional(),
    actorKind: z.enum(['ADMIN', 'STAFF']),
    accountStatus: z.enum(['PENDING', 'ACTIVE', 'DISABLED', 'ARCHIVED']),
    authLinkage: z
      .object({
        status: z.enum(['LINKED', 'UNLINKED', 'PENDING']).optional(),
      })
      .strict()
      .optional(),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const referenceUserListResponseSchema = z
  .object({
    data: z.array(referenceUserListItemSchema),
    meta: z
      .object({
        nextCursor: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const compactDescription = (values: Array<string | null | undefined>): string | undefined => {
  const items = values.filter((value): value is string => Boolean(value));
  return items.length > 0 ? items.join(' - ') : undefined;
};

const toLookupOption = (
  item: ReferenceLookupItem,
  href: (id: string) => string,
): ReferenceOption => ({
  id: item.id,
  label: item.code ? `${item.label} - ${item.code}` : item.label,
  description: compactDescription([item.secondaryLabel, item.type, item.status, item.state]),
  href: href(item.id),
});

const loadLookupReferenceOptions = async (
  resource: ReferenceLookupResource,
  search: string,
  href: (id: string) => string,
): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions(resource, {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map((item) => toLookupOption(item, href));
};

const loadLookupReferenceOptionsByIds = async (
  resource: ReferenceLookupResource,
  ids: readonly string[],
  href: (id: string) => string,
): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions(resource, {
    ids,
    limit: Math.min(ids.length || 1, OPTION_LIMIT),
  });

  return items.map((item) => toLookupOption(item, href));
};

const toUserOption = (item: UserListItem): ReferenceOption => ({
  id: item.id,
  label: compactDescription([item.displayName, item.email]) ?? item.displayName,
  description: compactDescription([item.accountStatus, item.actorKind]),
  href: APP_PATHS.userDetail(item.id),
  meta: {
    actorKind: item.actorKind,
  },
});

const toEmploymentProfileOption = (item: EmploymentProfileListItem): ReferenceOption => ({
  id: item.id,
  label: compactDescription([item.displayName, item.employeeCode]) ?? item.displayName,
  description: compactDescription([item.jobTitle, item.employmentStatus]),
  href: APP_PATHS.employmentProfileDetail(item.id),
});

export const loadOrgUnitReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('org-units', search, APP_PATHS.orgUnitDetail);
};

export const loadEmploymentProfileReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions(
    'employment-profiles',
    search,
    APP_PATHS.employmentProfileDetail,
  );
};

export const loadTalentReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('talents', search, APP_PATHS.talentDetail);
};

export const loadTalentGroupReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('talent-groups', search, APP_PATHS.talentGroupDetail);
};

export const loadUserReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const response = await fetchUsers({
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return response.data.map(toUserOption);
};

const fetchUnlinkedUsersForReference = async (search: string): Promise<UserListItem[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/users',
    params: {
      search: search || undefined,
      hasEmploymentProfile: false,
      limit: OPTION_LIMIT,
    },
  });

  return referenceUserListResponseSchema.parse(response).data;
};

export const loadUnlinkedUserReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const users = await fetchUnlinkedUsersForReference(search);

  return users.map(toUserOption);
};

export const loadContextualEmploymentProfileReferenceOptions = async (
  search: string,
  query: {
    orgUnitId?: string;
    employmentStatuses?: readonly Extract<EmploymentStatus, 'ACTIVE' | 'ON_LEAVE'>[];
  },
): Promise<ReferenceOption[]> => {
  const statuses = query.employmentStatuses ?? ['ACTIVE', 'ON_LEAVE'];
  const result = await Promise.all(
    statuses.map((employmentStatus) =>
      fetchEmploymentProfiles({
        search: search || undefined,
        orgUnitId: query.orgUnitId,
        employmentStatus,
        limit: OPTION_LIMIT,
      }).then((response) => response.data),
    ),
  );

  const seen = new Set<string>();
  return result
    .flat()
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .slice(0, OPTION_LIMIT)
    .map(toEmploymentProfileOption);
};

export const loadPlatformAccountReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('platform-accounts', search, APP_PATHS.platformAccountDetail);
};

export const loadStudioResourceReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('studio-resources', search, APP_PATHS.studioResourceDetail);
};

export const loadStudioResourceReferenceOptionsByIds = async (
  ids: readonly string[],
): Promise<ReferenceOption[]> =>
  loadLookupReferenceOptionsByIds('studio-resources', ids, APP_PATHS.studioResourceDetail);

export const loadEventReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('events', search, APP_PATHS.eventDetail);
};

export const loadContractReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('contract-records', search, APP_PATHS.contractRecordDetail);
};

export const loadRevenueEntryReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('revenue-entries', search, APP_PATHS.revenueEntryDetail);
};

export const loadCommissionRuleReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  return loadLookupReferenceOptions('commission-rules', search, APP_PATHS.commissionRuleDetail);
};

export const loadPlatformOwnerReferenceOptions = (
  ownerKind: PlatformAccountOwnerKind,
  search: string,
): Promise<ReferenceOption[]> => {
  if (ownerKind === 'ORG_UNIT') {
    return loadOrgUnitReferenceOptions(search);
  }

  if (ownerKind === 'TALENT') {
    return loadTalentReferenceOptions(search);
  }

  return loadTalentGroupReferenceOptions(search);
};
