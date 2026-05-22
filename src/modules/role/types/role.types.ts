import type {
  ROLE_PERMISSION_LITERALS,
  roleAssignmentStateValues,
  roleDelegationBandValues,
  roleLifecycleActionValues,
  roleMaxDelegatableBandValues,
  roleStateValues,
} from '@modules/role/constants/role.constants';
import type { ReferenceSummary } from '@shared/formatting/reference-display';

export type RoleState = (typeof roleStateValues)[number];
export type RoleAssignmentState = (typeof roleAssignmentStateValues)[number];
export type RoleDelegationBand = (typeof roleDelegationBandValues)[number];
export type RoleMaxDelegatableBand = (typeof roleMaxDelegatableBandValues)[number];
export type RoleLifecycleAction = (typeof roleLifecycleActionValues)[number];
export type RolePermissionLiteral = (typeof ROLE_PERMISSION_LITERALS)[number];

export type JsonPlainValue = string | number | boolean | null | { [key: string]: JsonPlainValue };

export type RolePermission = {
  code: string;
};

export type RoleTemplateCode =
  | 'ADMIN_FULL'
  | 'HR_OPERATIONS'
  | 'TEAM_MANAGER'
  | 'PRODUCTION_OPS'
  | 'COMMERCIAL_FINANCE'
  | 'TALENT_STAFF_SELF'
  | 'VIEWER_AUDITOR';

export type RoleTemplateStatus = 'READY' | 'PREVIEW_ONLY' | 'REQUIRES_FUTURE_SCOPE';

export type RoleTemplateScopePlanEntry = {
  module: string;
  scopes: string[];
  status: RoleTemplateStatus;
  note: string;
};

export type RoleTemplateListItem = {
  code: RoleTemplateCode;
  version: string;
  name: string;
  description: string;
  category: string;
  permissionCount: number;
  permissions?: RolePermission[];
  scopePlan: RoleTemplateScopePlanEntry[];
  warnings: string[];
  implementationNotes: string[];
  status: RoleTemplateStatus;
};

export type RoleTemplatePreview = {
  template: RoleTemplateListItem & {
    permissions: RolePermission[];
  };
  permissions: RolePermission[];
  scopePlan: RoleTemplateScopePlanEntry[];
  warnings: string[];
  unsupportedScopeNotes: string[];
};

export type WorkScheduleAssignmentScope = 'self' | 'team' | 'department' | 'global';
export type GlobalAssignmentScope = 'global';

export type RoleAssignmentScopeGrants = {
  workSchedule?: WorkScheduleAssignmentScope[];
  eventAssignment?: GlobalAssignmentScope[];
  contractRegistry?: GlobalAssignmentScope[];
  talentKpi?: GlobalAssignmentScope[];
  revenueLedger?: GlobalAssignmentScope[];
  commission?: GlobalAssignmentScope[];
  dashboardLite?: GlobalAssignmentScope[];
};

export type RoleAssignmentRule = {
  id?: string;
  code: string;
  description?: string | null;
  state?: string | null;
  conditions?: Record<string, JsonPlainValue> | null;
};

export type RoleListItem = {
  id: string;
  code: string;
  name: string;
  state: RoleState;
  permissionsSummary?: string | number | null;
  assignmentCountSummary?: string | number | null;
  templateCode?: RoleTemplateCode | null;
  templateVersion?: string | null;
  templateAppliedAt?: number | string | null;
  updatedAt: number | string;
};

export type RoleDetailRecord = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  state: RoleState;
  permissions: RolePermission[];
  delegationBand: RoleDelegationBand;
  maxDelegatableBand: RoleMaxDelegatableBand;
  assignmentRules: RoleAssignmentRule[];
  templateCode?: RoleTemplateCode | null;
  templateVersion?: string | null;
  templateAppliedAt?: number | string | null;
  createdAt?: number | string;
  updatedAt: number | string;
  activatedAt?: number | string | null;
  archivedAt?: number | string | null;
};

export type RoleAssignmentItem = {
  assignmentId: string;
  roleId: string;
  userId: string;
  userRef?: ReferenceSummary | null;
  scopeGrants?: RoleAssignmentScopeGrants | null;
  state: RoleAssignmentState;
  effectiveAt: number | string;
  revokedAt?: number | string | null;
  reason?: string | null;
};

export type RolePermissionMatrix = {
  roleId: string;
  roleCode: string;
  roleState: RoleState;
  permissions: RolePermission[];
  delegationBand: RoleDelegationBand;
  maxDelegatableBand: RoleMaxDelegatableBand;
};

export type RoleListQuery = {
  state?: RoleState;
  limit?: number;
  cursor?: string;
  search?: string;
};

export type RoleAssignmentListQuery = {
  state?: RoleAssignmentState;
  limit?: number;
  cursor?: string;
};

export type RoleCreatePayload = {
  name: string;
  code?: string;
  description?: string | null;
  initialPermissions?: string[];
  initialDelegationBand?: RoleDelegationBand;
  initialMaxDelegatableBand?: RoleMaxDelegatableBand;
  initialAssignmentRules?: RoleAssignmentRule[];
};

export type RoleUpdatePayload = {
  name?: string;
  description?: string | null;
  delegationBand?: RoleDelegationBand;
  maxDelegatableBand?: RoleMaxDelegatableBand;
};

export type RoleLifecyclePayload = {
  reason?: string | null;
};

export type RolePermissionReplacementPayload = {
  permissions: string[];
};

export type RoleAssignmentRuleReplacementPayload = {
  rules: RoleAssignmentRule[];
};

export type RoleAssignToUserPayload = {
  userId: string;
  reason?: string | null;
  scopeGrants?: RoleAssignmentScopeGrants;
};

export type RoleCreateFromTemplatePayload = {
  templateCode: RoleTemplateCode;
  code?: string;
  name: string;
  description?: string | null;
};

export type RoleRevokeAssignmentPayload = {
  reason?: string | null;
};

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
