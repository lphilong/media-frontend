export type StudioResourceOperationalStatus = 'ACTIVE' | 'OUT_OF_SERVICE' | 'INACTIVE' | 'ARCHIVED';

export type StudioResourceRecord = {
  id: string;
  resourceCode: string;
  name: string;
  shortName?: string | null;
  resourceClass: string;
  operationalStatus: StudioResourceOperationalStatus;
  locationLabel?: string | null;
  maxOccupancy?: number | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type StudioResourceListItem = Omit<
  StudioResourceRecord,
  'description' | 'externalRef' | 'updatedAt'
>;

export type StudioResourceAvailabilityItem = {
  id: string;
  resourceCode: string;
  name: string;
  resourceClass: string;
  operationalStatus: StudioResourceOperationalStatus;
  maxOccupancy?: number | null;
};

export type StudioResourceListQuery = {
  resourceClass?: string;
  operationalStatus?: StudioResourceOperationalStatus;
  hasMaxOccupancy?: boolean;
  search?: string;
  sortBy?: 'resourceCode' | 'name' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
};

export type StudioResourceAvailabilityQuery = StudioResourceListQuery & {
  view?: 'availability';
};

export type StudioResourceCreatePayload = {
  resourceCode: string;
  name: string;
  resourceClass: string;
  shortName?: string | null;
  locationLabel?: string | null;
  description?: string | null;
  externalRef?: string | null;
  maxOccupancy?: number | null;
};

export type StudioResourceUpdatePayload = {
  name: string;
  shortName?: string | null;
  locationLabel?: string | null;
  description?: string | null;
  externalRef?: string | null;
  maxOccupancy?: number | null;
};

export type StudioResourceAvailabilityAction = 'out-of-service' | 'restore-to-active';
export type StudioResourceLifecycleAction = 'activate' | 'deactivate' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
