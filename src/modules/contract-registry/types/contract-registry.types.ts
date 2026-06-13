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
  obligationAcceptanceImplemented: boolean;
  eventEvidenceLinkImplemented: boolean;
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

export type ContractObligationType = 'DELIVERABLE' | 'SERVICE_MILESTONE' | 'REPORTING' | 'OTHER';
export type ContractObligationStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'DELIVERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ARCHIVED';
export type ContractObligationEvidencePolicy = 'OPTIONAL' | 'REQUIRED';
export type ContractEvidenceRefType =
  | 'URL'
  | 'PLATFORM_REFERENCE'
  | 'EXTERNAL_REFERENCE'
  | 'INTERNAL_REFERENCE';

export const CONTRACT_OBLIGATION_TITLE_MAX_LENGTH = 240;
export const CONTRACT_OBLIGATION_DESCRIPTION_MAX_LENGTH = 4_000;
export const CONTRACT_OBLIGATION_DELIVERY_NOTE_MAX_LENGTH = 2_000;
export const CONTRACT_OBLIGATION_REASON_MAX_LENGTH = 1_000;
export const CONTRACT_OBLIGATION_EVIDENCE_REF_MAX_COUNT = 20;
export const CONTRACT_OBLIGATION_EVIDENCE_REF_LABEL_MAX_LENGTH = 160;
export const CONTRACT_OBLIGATION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH = 512;
export const CONTRACT_OBLIGATION_EVIDENCE_REF_URL_MAX_LENGTH = 2_048;
export const CONTRACT_OBLIGATION_EVENT_EVIDENCE_REASON_MAX_LENGTH = 1_000;

export type ContractObligationEvidenceRef = {
  type: ContractEvidenceRefType;
  label: string;
  url: string | null;
  referenceId: string | null;
};

export type ContractObligationStatusTransition = {
  fromStatus: ContractObligationStatus | null;
  toStatus: ContractObligationStatus;
  actorId: string;
  occurredAt: number | string;
  reason: string | null;
};

export type ContractObligationBoundaryMetadata = {
  activeSupportedCommercialLegalContractRequired: true;
  legacyEmploymentContractAllowed: false;
  unsupportedContractKindAllowed: false;
  responsibleOwnerGrantsAuthority: false;
  eventEvidenceLinkImplemented: true;
  eventCompletionMutatesObligation: false;
  acceptanceCreatesRevenue: false;
  acceptanceCreatesCommission: false;
  acceptanceCreatesPayroll: false;
  acceptanceCreatesPayment: false;
  acceptanceCreatesTaxOrAccounting: false;
  fileStorageImplemented: false;
};

export type ContractObligation = {
  id: string;
  code: string;
  contractRecordId: string;
  obligationType: ContractObligationType;
  title: string;
  description: string | null;
  dueDate: number | string | null;
  responsibleOwnerEmploymentProfileId: string;
  evidencePolicy: ContractObligationEvidencePolicy;
  status: ContractObligationStatus;
  latestDeliveryNote: string | null;
  latestEvidenceRefs: ContractObligationEvidenceRef[];
  latestEventEvidenceLinkIds: string[];
  latestDeliveredByActorId: string | null;
  latestDeliveredAt: number | string | null;
  latestReviewedByActorId: string | null;
  latestReviewedAt: number | string | null;
  acceptedByActorId: string | null;
  acceptedAt: number | string | null;
  rejectedByActorId: string | null;
  rejectedAt: number | string | null;
  rejectionReason: string | null;
  statusHistory: ContractObligationStatusTransition[];
  createdByActorId: string;
  createdAt: number | string;
  updatedByActorId: string;
  updatedAt: number | string;
  boundaryMetadata: ContractObligationBoundaryMetadata;
};

export type ContractObligationPayload = {
  obligationType: ContractObligationType;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  responsibleOwnerEmploymentProfileId: string;
  evidencePolicy: ContractObligationEvidencePolicy;
};

export type ContractObligationReasonPayload = {
  reason: string;
};

export type ContractObligationArchivePayload = {
  reason?: string | null;
};

export type ContractObligationAcceptPayload = {
  reviewNote?: string | null;
};

export type ContractObligationDeliverPayload = {
  deliveryNote?: string | null;
  evidenceRefs?: ContractObligationEvidenceRef[];
  eventEvidenceLinkIds?: string[];
};

export type ContractObligationEventEvidenceLinkStatus = 'ACTIVE' | 'REMOVED';

export type ContractObligationEventEvidenceSnapshot = {
  eventId: string;
  eventCode: string;
  eventTitle: string;
  eventStatus: string;
  eventUpdatedAt: number | string;
  eventCompletedAt: number | string;
  eventCompletedByActorId: string;
  completionEvidenceNote: string;
  completionEvidenceRefs: ContractObligationEvidenceRef[];
};

export type ContractObligationEventEvidenceLinkAction = {
  action: 'LINKED' | 'REMOVED';
  actorId: string;
  occurredAt: number | string;
  reason: string;
};

export type ContractObligationEventEvidenceLinkBoundaryMetadata = {
  linkTarget: 'CONTRACT_OBLIGATION';
  supportingEvidenceOnly: true;
  historicalSnapshot: true;
  linkMutatesEvent: false;
  linkMutatesObligationStatus: false;
  deliveryRemainsExplicit: true;
  acceptanceCreated: false;
  revenueCreated: false;
  commissionCreated: false;
  payrollCreated: false;
  paymentCreated: false;
  taxOrAccountingCreated: false;
  fileStorageCreated: false;
  inferredEventContractMatching: false;
};

export type ContractObligationEventEvidenceLink = {
  id: string;
  contractObligationId: string;
  contractRecordId: string;
  eventId: string;
  status: ContractObligationEventEvidenceLinkStatus;
  linkedByActorId: string;
  linkedAt: number | string;
  linkReason: string;
  removedByActorId: string | null;
  removedAt: number | string | null;
  removeReason: string | null;
  snapshot: ContractObligationEventEvidenceSnapshot;
  actionHistory: ContractObligationEventEvidenceLinkAction[];
  createdByActorId: string;
  createdAt: number | string;
  updatedByActorId: string;
  updatedAt: number | string;
  boundaryMetadata: ContractObligationEventEvidenceLinkBoundaryMetadata;
};

export type ContractObligationEventEvidenceLinkPayload = {
  eventId: string;
  linkReason: string;
};

export type ContractObligationEventEvidenceRemovePayload = {
  removeReason: string;
};

export type ContractObligationLifecycleAction =
  | 'open'
  | 'deliver'
  | 'accept'
  | 'reject'
  | 'reopen'
  | 'cancel'
  | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
