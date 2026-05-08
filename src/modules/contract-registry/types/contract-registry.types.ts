export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'ARCHIVED';

export type ContractKind = 'EMPLOYMENT' | 'TALENT_SERVICE' | 'TALENT_MANAGEMENT';
export type ContractLinkedEntityKind = 'EMPLOYMENT_PROFILE' | 'TALENT';
export type ContractConfidentialityTier = 'STANDARD' | 'CONFIDENTIAL' | 'RESTRICTED';
export type ContractSortBy = 'effectiveStartDate' | 'contractCode' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export type ContractRecord = {
  id: string;
  contractCode: string;
  title: string;
  contractKind: ContractKind;
  linkedEntityKind: ContractLinkedEntityKind;
  linkedEmploymentProfileId?: string | null;
  linkedTalentId?: string | null;
  ownerEmploymentProfileId: string;
  confidentialityTier: ContractConfidentialityTier;
  status: ContractStatus;
  effectiveStartDate: number | string;
  effectiveEndDate?: number | string | null;
  fileReferenceId?: string | null;
  fileDisplayName?: string | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type ContractListItem = Pick<
  ContractRecord,
  | 'id'
  | 'contractCode'
  | 'title'
  | 'contractKind'
  | 'linkedEntityKind'
  | 'linkedEmploymentProfileId'
  | 'linkedTalentId'
  | 'ownerEmploymentProfileId'
  | 'confidentialityTier'
  | 'status'
  | 'effectiveStartDate'
  | 'effectiveEndDate'
  | 'createdAt'
>;

export type ContractByLinkedEntityItem = Pick<
  ContractRecord,
  | 'id'
  | 'contractCode'
  | 'title'
  | 'contractKind'
  | 'linkedEntityKind'
  | 'linkedEmploymentProfileId'
  | 'linkedTalentId'
  | 'status'
  | 'effectiveStartDate'
  | 'effectiveEndDate'
>;

export type ContractByOwnerItem = Pick<
  ContractRecord,
  | 'id'
  | 'contractCode'
  | 'title'
  | 'contractKind'
  | 'ownerEmploymentProfileId'
  | 'confidentialityTier'
  | 'status'
  | 'effectiveStartDate'
  | 'effectiveEndDate'
>;

export type ContractFlatListQuery = {
  status?: ContractStatus;
  contractKind?: ContractKind;
  linkedEntityKind?: ContractLinkedEntityKind;
  linkedEmploymentProfileId?: string;
  linkedTalentId?: string;
  ownerEmploymentProfileId?: string;
  confidentialityTier?: ContractConfidentialityTier;
  hasFileReference?: boolean;
  windowStartDate?: string;
  windowEndDate?: string;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: ContractSortBy;
  sortDirection?: SortDirection;
};

export type ContractByLinkedEntityQuery = Pick<
  ContractFlatListQuery,
  | 'linkedEntityKind'
  | 'linkedEmploymentProfileId'
  | 'linkedTalentId'
  | 'status'
  | 'windowStartDate'
  | 'windowEndDate'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-linked-entity';
};

export type ContractByOwnerQuery = Pick<
  ContractFlatListQuery,
  | 'ownerEmploymentProfileId'
  | 'status'
  | 'windowStartDate'
  | 'windowEndDate'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-owner';
};

export type ContractCreatePayload = {
  contractCode: string;
  title: string;
  contractKind: ContractKind;
  linkedEntityKind: ContractLinkedEntityKind;
  linkedEmploymentProfileId?: string;
  linkedTalentId?: string;
  ownerEmploymentProfileId: string;
  confidentialityTier: ContractConfidentialityTier;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  fileReferenceId?: string;
  fileDisplayName?: string;
  description?: string | null;
  externalRef?: string | null;
};

export type ContractDraftCorePayload = {
  title?: string;
  linkedEntityKind?: ContractLinkedEntityKind;
  linkedEmploymentProfileId?: string | null;
  linkedTalentId?: string | null;
  confidentialityTier?: ContractConfidentialityTier;
  effectiveStartDate?: string;
  effectiveEndDate?: string | null;
  description?: string | null;
  externalRef?: string | null;
};

export type ContractAssignOwnerPayload = {
  newOwnerEmploymentProfileId: string;
};

export type ContractFileReferencePayload = {
  newFileReferenceId: string | null;
  newFileDisplayName: string | null;
};

export type ContractExpirePayload = {
  expiryDate: string;
};

export type ContractTerminatePayload = {
  terminationDate: string;
};

export type ContractLifecycleAction =
  | 'mark-pending-signature'
  | 'reopen-draft'
  | 'activate'
  | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
