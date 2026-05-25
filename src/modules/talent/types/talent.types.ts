import type { ReferenceSummary } from '@shared/formatting/reference-display';

export type TalentOperationalStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'ARCHIVED';
export const talentOriginValues = ['INTERNAL', 'EXTERNAL'] as const;
export type TalentOrigin = (typeof talentOriginValues)[number];
export const talentCommercialParticipationStatusValues = [
  'ELIGIBLE',
  'RESTRICTED',
  'BLOCKED',
] as const;
export type TalentCommercialParticipationStatus =
  (typeof talentCommercialParticipationStatusValues)[number];

export type TalentRecord = {
  id: string;
  talentCode: string;
  displayName: string;
  performanceAlias?: string | null;
  stageName: string;
  legalName: string;
  displayShortName?: string | null;
  talentOrigin: TalentOrigin;
  operationalStatus: TalentOperationalStatus;
  managerEmploymentProfileId?: string | null;
  managerEmploymentProfileRef?: ReferenceSummary | null;
  linkedEmploymentProfileId?: string | null;
  linkedEmploymentProfileRef?: ReferenceSummary | null;
  commercialParticipationStatus: TalentCommercialParticipationStatus;
  livestreamEligible: boolean;
  eventEligible: boolean;
  externalRef?: string | null;
  profileSummary?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type TalentListQuery = {
  operationalStatus?: TalentOperationalStatus;
  talentOrigin?: TalentOrigin;
  managerEmploymentProfileId?: string;
  hasLinkedEmploymentProfile?: boolean;
  commercialParticipationStatus?: TalentCommercialParticipationStatus;
  livestreamEligible?: boolean;
  eventEligible?: boolean;
  search?: string;
  sortBy?: 'talentCode' | 'stageName' | 'legalName' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
};

export type TalentCreatePayload = {
  talentCode?: string;
  stageName?: string | null;
  legalName?: string | null;
  talentOrigin: TalentOrigin;
  commercialParticipationStatus: TalentCommercialParticipationStatus;
  livestreamEligible: boolean;
  eventEligible: boolean;
  managerEmploymentProfileId?: string | null;
  linkedEmploymentProfileId?: string | null;
  displayShortName?: string | null;
  externalRef?: string | null;
  profileSummary?: string | null;
};

export type TalentUpdatePayload = {
  stageName?: string | null;
  legalName?: string;
  displayShortName?: string | null;
  externalRef?: string | null;
  profileSummary?: string | null;
};

export type TalentManagerAssignmentPayload = {
  newManagerEmploymentProfileId: string | null;
};

export type TalentEmploymentProfileLinkPayload = {
  linkedEmploymentProfileId: string;
};

export type TalentCommercialParticipationPayload = {
  newCommercialParticipationStatus: TalentCommercialParticipationStatus;
  livestreamEligible: boolean;
  eventEligible: boolean;
};

export type TalentLifecycleAction = 'suspend' | 'reactivate' | 'deactivate' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
