export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'ARCHIVED';

export type EmploymentContractStatus =
  | 'NONE'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED';

export type EmploymentProfileRecord = {
  id: string;
  employeeCode: string;
  legalName: string;
  displayName: string;
  employmentKind: string;
  jobTitle: string;
  titleDescription?: string | null;
  externalRef?: string | null;
  orgUnitId: string;
  managerEmploymentProfileId?: string | null;
  linkedUserId?: string | null;
  employmentStatus: EmploymentStatus;
  contractStatus: EmploymentContractStatus;
  employmentStartDate: string;
  employmentEndDate?: string | null;
  createdAt: number | string;
  updatedAt?: number | string;
};

export type EmploymentProfileListItem = Omit<
  EmploymentProfileRecord,
  'titleDescription' | 'externalRef' | 'employmentStartDate' | 'employmentEndDate' | 'updatedAt'
>;

export type EmploymentProfileDirectReport = {
  id: string;
  employeeCode: string;
  displayName: string;
  employmentStatus: EmploymentStatus;
  contractStatus: EmploymentContractStatus;
  orgUnitId: string;
  managerEmploymentProfileId?: string | null;
};

export type EmploymentProfileListQuery = {
  employmentStatus?: EmploymentStatus;
  contractStatus?: EmploymentContractStatus;
  employmentKind?: string;
  orgUnitId?: string;
  managerEmploymentProfileId?: string;
  hasLinkedUser?: boolean;
  search?: string;
  sortBy?: 'employeeCode' | 'displayName' | 'legalName' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
};

export type EmploymentProfileDirectReportsQuery = {
  sortBy?: 'employeeCode' | 'displayName';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
};

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};

export type EmploymentProfileCreatePayload = {
  employeeCode: string;
  legalName: string;
  displayName: string;
  employmentKind: string;
  jobTitle: string;
  orgUnitId: string;
  contractStatus: EmploymentContractStatus;
  employmentStartDate: string;
  managerEmploymentProfileId?: string | null;
  linkedUserId?: string | null;
  externalRef?: string | null;
  titleDescription?: string | null;
};

export type EmploymentProfileUpdatePayload = {
  legalName?: string;
  displayName?: string;
  employmentKind?: string;
  jobTitle?: string;
  externalRef?: string | null;
  titleDescription?: string | null;
};

export type EmploymentProfileOrgUnitAssignmentPayload = {
  newOrgUnitId: string;
};

export type EmploymentProfileManagerAssignmentPayload = {
  newManagerEmploymentProfileId: string | null;
};

export type EmploymentProfileUserLinkPayload = {
  linkedUserId: string;
};

export type EmploymentProfileContractStatusPayload = {
  newContractStatus: EmploymentContractStatus;
};

export type EmploymentProfileTerminatePayload = {
  employmentEndDate: string;
};

export type EmploymentProfileLifecycleAction =
  | 'place-on-leave'
  | 'return-from-leave'
  | 'suspend'
  | 'reactivate'
  | 'archive';
