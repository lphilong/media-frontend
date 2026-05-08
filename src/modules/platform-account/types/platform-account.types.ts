export type PlatformAccountOperationalStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type PlatformAccountOwnerKind = 'ORG_UNIT' | 'TALENT' | 'TALENT_GROUP';

export type PlatformAccountRecord = {
  id: string;
  accountCode: string;
  platform: string;
  platformSurfaceType: string;
  displayName: string;
  handle?: string | null;
  externalPlatformId?: string | null;
  profileUrl?: string | null;
  ownerKind: PlatformAccountOwnerKind;
  ownerOrgUnitId?: string | null;
  ownerTalentId?: string | null;
  ownerTalentGroupId?: string | null;
  operationalStatus: PlatformAccountOperationalStatus;
  livestreamEnabled: boolean;
  contentPublishingEnabled: boolean;
  monetizationEnabled: boolean;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type PlatformAccountListQuery = {
  platform?: string;
  platformSurfaceType?: string;
  operationalStatus?: PlatformAccountOperationalStatus;
  ownerKind?: PlatformAccountOwnerKind;
  ownerOrgUnitId?: string;
  ownerTalentId?: string;
  ownerTalentGroupId?: string;
  livestreamEnabled?: boolean;
  contentPublishingEnabled?: boolean;
  monetizationEnabled?: boolean;
  search?: string;
  sortBy?: 'accountCode' | 'displayName' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
};

export type PlatformAccountCreatePayload = {
  accountCode: string;
  platform: string;
  platformSurfaceType: string;
  displayName: string;
  ownerKind: PlatformAccountOwnerKind;
  ownerOrgUnitId?: string | null;
  ownerTalentId?: string | null;
  ownerTalentGroupId?: string | null;
  livestreamEnabled: boolean;
  contentPublishingEnabled: boolean;
  monetizationEnabled: boolean;
  handle?: string | null;
  externalPlatformId?: string | null;
  profileUrl?: string | null;
  description?: string | null;
  externalRef?: string | null;
};

export type PlatformAccountUpdatePayload = {
  displayName: string;
  handle?: string | null;
  externalPlatformId?: string | null;
  profileUrl?: string | null;
  description?: string | null;
  externalRef?: string | null;
};

export type PlatformAccountOwnershipTransferPayload = {
  ownerKind: PlatformAccountOwnerKind;
  ownerOrgUnitId?: string | null;
  ownerTalentId?: string | null;
  ownerTalentGroupId?: string | null;
};

export type PlatformAccountCapabilitiesPayload = {
  livestreamEnabled: boolean;
  contentPublishingEnabled: boolean;
  monetizationEnabled: boolean;
};

export type PlatformAccountLifecycleAction = 'activate' | 'deactivate' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
