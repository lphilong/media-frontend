export type OrgUnitStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type OrgUnitRecord = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: OrgUnitStatus;
  parentOrgUnitId?: string | null;
  depth: number;
  displayOrder: number;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt?: number | string;
  hierarchy?: {
    id: string;
    parentOrgUnitId?: string | null;
    depth: number;
    ancestorChain: string[];
  };
};

export type OrgUnitChildRecord = Pick<
  OrgUnitRecord,
  'id' | 'code' | 'name' | 'type' | 'status' | 'parentOrgUnitId' | 'depth' | 'displayOrder'
>;

export type OrgUnitListQuery = {
  status?: OrgUnitStatus;
  type?: string;
  parentOrgUnitId?: string;
  rootOnly?: boolean;
  search?: string;
  sortBy?: 'code' | 'name' | 'createdAt' | 'displayOrder';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
};

export type OrgUnitCreatePayload = {
  code: string;
  name: string;
  type: string;
  displayOrder: number;
  parentOrgUnitId?: string;
  description?: string | null;
  externalRef?: string | null;
};

export type OrgUnitUpdatePayload = {
  name?: string;
  displayOrder?: number;
  description?: string | null;
  externalRef?: string | null;
};

export type OrgUnitMovePayload = {
  newParentOrgUnitId: string | null;
};

export type OrgUnitLifecycleAction = 'activate' | 'deactivate' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
