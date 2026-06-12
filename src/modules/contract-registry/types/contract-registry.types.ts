import type { ReferenceSummary } from '@shared/formatting/reference-display';

export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'ARCHIVED';

export type ContractKind = 'EMPLOYMENT' | 'TALENT_SERVICE' | 'TALENT_MANAGEMENT';
export type CommercialLegalContractKind = 'TALENT_SERVICE' | 'TALENT_MANAGEMENT';
export type ContractReadKind = ContractKind | (string & {});
export type ContractLinkedEntityKind = 'EMPLOYMENT_PROFILE' | 'TALENT';
export type ContractConfidentialityTier = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type ContractSortBy = 'effectiveStartDate' | 'contractCode' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export type ContractBoundaryMetadata = {
  semanticBoundary: 'COMMERCIAL_LEGAL' | 'LEGACY_EMPLOYMENT' | 'UNSUPPORTED';
  kindClassification:
    | 'COMMERCIAL_LEGAL_SUPPORTED'
    | 'LEGACY_EMPLOYMENT_DEPRECATED'
    | 'UNSUPPORTED_CONTRACT_KIND';
  commercialLegalRegistry: boolean;
  commercialChainContextEligible: boolean;
  directRevenueSourceEligible: false;
  directCommissionSourceEligible: false;
  payrollSourceEligible: false;
  obligationAcceptanceImplemented: false;
  eventEvidenceLinkImplemented: false;
};

export type ContractRecord = {
  id: string;
  contractCode: string;
  title: string;
  contractKind: ContractReadKind;
  linkedEntityKind: ContractLinkedEntityKind;
  linkedEmploymentProfileId?: string | null;
  linkedTalentId?: string | null;
  ownerEmploymentProfileId: string;
  linkedEmploymentProfileRef?: ReferenceSummary | null;
  linkedTalentRef?: ReferenceSummary | null;
  ownerEmploymentProfileRef?: ReferenceSummary | null;
  confidentialityTier: ContractConfidentialityTier;
  status: ContractStatus;
  effectiveStartDate: number | string;
  effectiveEndDate?: number | string | null;
  fileReferenceId?: string | null;
  fileDisplayName?: string | null;
  description?: string | null;
  externalRef?: string | null;
  boundaryMetadata: ContractBoundaryMetadata;
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
  | 'linkedEmploymentProfileRef'
  | 'linkedTalentRef'
  | 'ownerEmploymentProfileRef'
  | 'confidentialityTier'
  | 'status'
  | 'effectiveStartDate'
  | 'effectiveEndDate'
  | 'boundaryMetadata'
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
  | 'linkedEmploymentProfileRef'
  | 'linkedTalentRef'
  | 'status'
  | 'effectiveStartDate'
  | 'effectiveEndDate'
  | 'boundaryMetadata'
>;

export type ContractByOwnerItem = Pick<
  ContractRecord,
  | 'id'
  | 'contractCode'
  | 'title'
  | 'contractKind'
  | 'ownerEmploymentProfileId'
  | 'ownerEmploymentProfileRef'
  | 'confidentialityTier'
  | 'status'
  | 'effectiveStartDate'
  | 'effectiveEndDate'
  | 'boundaryMetadata'
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
  effectiveEndDateFrom?: string;
  effectiveEndDateTo?: string;
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
  contractCode?: string;
  title: string;
  contractKind: CommercialLegalContractKind;
  linkedEntityKind: 'TALENT';
  linkedTalentId: string;
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
