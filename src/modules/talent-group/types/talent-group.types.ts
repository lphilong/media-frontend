import type { ReferenceSummary } from '@shared/formatting/reference-display';

export type TalentGroupStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type TalentGroupMembershipStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED';
export type TalentGroupManagerAssignmentStatus = 'ACTIVE' | 'INACTIVE' | 'REMOVED';
export type TalentGroupManagerRole = 'OWNER' | 'MANAGER' | 'ASSISTANT';

export type TalentGroupRecord = {
  id: string;
  groupCode: string;
  name: string;
  shortName?: string | null;
  status: TalentGroupStatus;
  displayOrder: number;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type TalentGroupMemberRecord = {
  id: string;
  groupId: string;
  talentId: string;
  talentRef?: ReferenceSummary | null;
  membershipStatus: TalentGroupMembershipStatus;
  lineupOrder: number;
  joinedAt: number | string;
  leftAt?: number | string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type TalentGroupManagerAssignmentRecord = {
  id: string;
  groupId: string;
  managerEmploymentProfileId: string;
  role: TalentGroupManagerRole;
  effectiveFrom: number | string;
  effectiveTo?: number | string | null;
  status: TalentGroupManagerAssignmentStatus;
  isPrimary: boolean;
  createdAt: number | string;
  updatedAt: number | string;
  groupRef: ReferenceSummary;
  managerRef: ReferenceSummary;
  managerHasLinkedAdminUser: boolean;
};

export type TalentGroupByTalentListItem = {
  id: string;
  groupId: string;
  groupCode: string;
  name: string;
  shortName?: string | null;
  status: TalentGroupStatus;
  displayOrder: number;
  membershipId: string;
  talentId: string;
  talentRef?: ReferenceSummary | null;
  membershipStatus: TalentGroupMembershipStatus;
  lineupOrder: number;
  joinedAt: number | string;
  createdAt: number | string;
  updatedAt: number | string;
};

export type TalentGroupFlatListQuery = {
  status?: TalentGroupStatus;
  containsTalentId?: string;
  search?: string;
  sortBy?: 'groupCode' | 'name' | 'createdAt' | 'displayOrder';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
};

export type TalentGroupByTalentQuery = {
  view?: 'by-talent';
  talentId?: string;
  status?: TalentGroupStatus;
  sortBy?: 'groupCode' | 'name' | 'createdAt' | 'displayOrder';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
};

export type TalentGroupMembersQuery = {
  limit?: number;
  cursor?: string;
};

export type TalentGroupCreatePayload = {
  groupCode?: string;
  name: string;
  displayOrder: number;
  shortName?: string | null;
  description?: string | null;
  externalRef?: string | null;
};

export type TalentGroupUpdatePayload = {
  name?: string;
  shortName?: string | null;
  description?: string | null;
  displayOrder?: number;
  externalRef?: string | null;
};

export type TalentGroupAddMemberPayload = {
  talentId: string;
  lineupOrder: number;
};

export type TalentGroupUpdateLineupPayload = {
  newLineupOrder: number;
};

export type TalentGroupAssignManagerPayload = {
  managerEmploymentProfileId: string;
  reason?: string | null;
};

export type TalentGroupRevokeManagerPayload = {
  reason?: string | null;
};

export type TalentGroupLifecycleAction = 'activate' | 'deactivate' | 'archive';
export type TalentGroupMembershipLifecycleAction = 'deactivate' | 'reactivate' | 'remove';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
