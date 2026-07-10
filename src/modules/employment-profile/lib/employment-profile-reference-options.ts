import { z } from 'zod';

import { fetchEmploymentProfiles } from '@modules/employment-profile/api/employment-profile.api';
import type {
  EmploymentProfileListItem,
  EmploymentStatus,
} from '@modules/employment-profile/types/employment-profile.types';
import type { UserListItem } from '@modules/user/types/user.types';
import { apiRequest } from '@shared/api';
import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
} from '@shared/components/reference/reference-lookup.api';

const OPTION_LIMIT = 20;

const referenceUserListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    email: z.string().nullable().optional(),
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

const toEmploymentProfileLookupOption = (item: ReferenceLookupItem): ReferenceOption => ({
  id: item.id,
  label: item.label,
  description: item.secondaryLabel,
  secondaryLabel: item.secondaryLabel,
  code: item.code,
  type: item.type,
  status: item.status,
  state: item.state,
  href: `/employment-profiles/${item.id}`,
});

const toUserOption = (item: UserListItem): ReferenceOption => ({
  id: item.id,
  label: item.displayName,
  description: item.email ?? undefined,
  status: item.accountStatus,
  href: `/users/${item.id}`,
});

const toEmploymentProfileOption = (item: EmploymentProfileListItem): ReferenceOption => ({
  id: item.id,
  label: item.displayName,
  description: item.jobTitle,
  status: item.employmentStatus,
  meta: {
    employeeCode: item.employeeCode,
    employmentStatus: item.employmentStatus,
  },
  href: `/employment-profiles/${item.id}`,
});

const toAccessAssignmentLinkedUserOption = (item: EmploymentProfileListItem): ReferenceOption => {
  const linkedUserId = item.linkedUserId ?? '';
  const linkedUserStatus = item.linkedUserRef?.status;
  const disabled =
    !linkedUserId ||
    !['ACTIVE', 'ON_LEAVE'].includes(item.employmentStatus) ||
    (linkedUserStatus !== undefined && linkedUserStatus !== 'ACTIVE');

  return {
    id: linkedUserId || item.id,
    label:
      compactDescription([
        item.displayName,
        item.linkedUserRef?.name,
        item.linkedUserRef?.displayName,
      ]) ?? item.displayName,
    description: compactDescription([
      item.jobTitle,
      item.orgUnitRef?.name ?? item.orgUnitRef?.displayName ?? item.orgUnitRef?.code,
    ]),
    status: item.employmentStatus,
    href: `/employment-profiles/${item.id}`,
    disabled,
    meta: {
      employmentProfileId: item.id,
      employeeCode: item.employeeCode,
      employmentStatus: item.employmentStatus,
      linkedUserStatus,
    },
  };
};

export const loadEmploymentProfileReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('employment-profiles', {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map(toEmploymentProfileLookupOption);
};

export const loadEmploymentProfileReferenceOptionById = async (
  employmentProfileId: string,
): Promise<ReferenceOption> => {
  const items = await fetchReferenceLookupOptions('employment-profiles', {
    ids: [employmentProfileId],
    limit: 1,
  });
  const option = items
    .map(toEmploymentProfileLookupOption)
    .find((candidate) => candidate.id === employmentProfileId);

  return (
    option ?? {
      id: employmentProfileId,
      label: employmentProfileId,
      href: `/employment-profiles/${employmentProfileId}`,
    }
  );
};

export const loadAccessAssignmentLinkedUserOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const statuses: Array<Extract<EmploymentStatus, 'ACTIVE' | 'ON_LEAVE'>> = ['ACTIVE', 'ON_LEAVE'];
  const result = await Promise.all(
    statuses.map((employmentStatus) =>
      fetchEmploymentProfiles({
        search: search || undefined,
        employmentStatus,
        hasLinkedUser: true,
        limit: OPTION_LIMIT,
      }).then((response) => response.data),
    ),
  );

  const seen = new Set<string>();
  return result
    .flat()
    .filter((item) => {
      const linkedUserId = item.linkedUserId ?? '';
      if (!linkedUserId || seen.has(linkedUserId)) {
        return false;
      }
      seen.add(linkedUserId);
      return true;
    })
    .slice(0, OPTION_LIMIT)
    .map(toAccessAssignmentLinkedUserOption);
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
