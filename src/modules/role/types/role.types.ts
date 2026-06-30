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

export type ActiveRoleTemplateCode =
  | 'OWNER_ADMIN'
  | 'ACCESS_ADMIN'
  | 'HR_OPERATIONS'
  | 'HR_TERMS_APPROVER'
  | 'PRODUCTION_OPS'
  | 'PLATFORM_CHANNEL_OPS'
  | 'CREATIVE_VISUAL_LEAD'
  | 'CONTENT_OPS'
  | 'TALENT_GROUP_MANAGER'
  | 'ORG_UNIT_MANAGER'
  | 'KPI_OPERATIONS'
  | 'COMMERCIAL_CONTRACT_OPS'
  | 'REVENUE_FINANCE_OPS'
  | 'REVENUE_APPROVER'
  | 'REVENUE_RECONCILER'
  | 'COMMISSION_OPS'
  | 'COMMISSION_APPROVER'
  | 'ATTENDANCE_OPS'
  | 'LEAVE_REVIEWER'
  | 'ATTENDANCE_APPROVER'
  | 'MONTHLY_CLOSE_OWNER'
  | 'PAYROLL_DRAFT_OPS'
  | 'PAYROLL_DRAFT_APPROVER'
  | 'VIEWER_AUDITOR'
  | 'STAFF_CONSOLE_USER';

export type LegacyRoleTemplateCode =
  | 'ADMIN_FULL'
  | 'TEAM_MANAGER'
  | 'COMMERCIAL_FINANCE'
  | 'TALENT_STAFF_SELF';

export type RoleTemplateCode = ActiveRoleTemplateCode | LegacyRoleTemplateCode;

export type RoleTemplateStatus = 'READY' | 'PREVIEW_ONLY' | 'REQUIRES_FUTURE_SCOPE';
export type RoleBundleStatus = 'ACTIVE' | 'INACTIVE';
export type RecommendedAccountContext = 'STAFF_CONSOLE' | 'MANAGER_CONSOLE' | 'ADMIN_CONSOLE';

export type RoleTemplateScopePlanEntry = {
  module: string;
  scopes: string[];
  status: RoleTemplateStatus;
  note: string;
};

export type RoleTemplateListItem = {
  code: ActiveRoleTemplateCode;
  version: string;
  name: string;
  description: string;
  category: string;
  permissionCount: number;
  permissions?: RolePermission[];
  recommendedAccountContext: RecommendedAccountContext;
  recommendedScopeGrants: RoleAssignmentScopeGrants;
  scopePlan: RoleTemplateScopePlanEntry[];
  warnings: string[];
  implementationNotes: string[];
  status: RoleTemplateStatus;
};

export type RoleBundleListItem = {
  code: string;
  name: string;
  description: string;
  businessPurpose: string;
  status: RoleBundleStatus;
  version: string;
  childRoles: string[];
  recommendedAccountContext: RecommendedAccountContext;
  recommendedScopes: string[];
  sensitiveWarning: string | null;
  sensitive: boolean;
  createdAt: string;
  updatedAt: string;
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
export type EventAssignmentScope = 'global' | 'managedGroup';
export type KpiAssignmentScope = 'global' | 'managedGroup' | 'self';

export type RoleAssignmentScopeGrants = {
  workSchedule?: WorkScheduleAssignmentScope[];
  eventAssignment?: EventAssignmentScope[];
  contractRegistry?: GlobalAssignmentScope[];
  talentKpi?: GlobalAssignmentScope[];
  kpi?: KpiAssignmentScope[];
  revenueLedger?: GlobalAssignmentScope[];
  commission?: GlobalAssignmentScope[];
  dashboardLite?: GlobalAssignmentScope[];
};

export type RoleAssignmentScopeModule = keyof RoleAssignmentScopeGrants;

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
  roleRef?: ReferenceSummary | null;
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

export type EffectiveAccessWorkspaceAvailability = {
  primaryWorkspace: RecommendedAccountContext | null;
  availableWorkspaces: Array<{
    context: RecommendedAccountContext;
    available: boolean;
    source: 'ACCOUNT_CONTEXT';
    reasonCodes: string[];
    trace: Array<Record<string, unknown>>;
  }>;
  ownDataAvailable: boolean;
  managerResponsibilitiesAvailable: boolean;
  effectiveAccessTraceAvailable: boolean;
  sourceTrace: Array<Record<string, unknown>>;
};

export type EffectiveAccessRoleAssignment = {
  assignmentId: string;
  roleId: string;
  roleCode: string | null;
  roleName: string | null;
  permissions: string[];
  legacyScopeGrants: RoleAssignmentScopeGrants | null;
  structuredScopeGrants: Array<Record<string, unknown>>;
  scopeFingerprint: string;
  reason: string | null;
  assignedBy: string | null;
  assignedAt: number | string;
  effectiveAt: number | string | null;
  expiresAt: number | string | null;
  reviewAt: number | string | null;
  origin: 'DIRECT' | 'BUNDLE' | 'LEGACY';
  bundleOrigin: Record<string, unknown> | null;
  sensitiveOrGlobal: boolean;
};

export type EffectiveAccessRecord = {
  readOnly: boolean;
  sourceTruth: boolean;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    accountStatus: string;
  };
  accountContextSignals: {
    canonicalAccountContextImplemented: boolean;
    canonicalSource: 'ACCOUNT_CONTEXT';
    accountContexts: RecommendedAccountContext[];
    legacyActorKind?: string;
    compatibilityContexts: string[];
    grantsAuthorityByItself: boolean;
  };
  workspaceAvailability: EffectiveAccessWorkspaceAvailability;
  activeRoleAssignments: EffectiveAccessRoleAssignment[];
  roles: Array<{ id: string; code: string; name: string }>;
  permissions: string[];
  permissionSourceTrace: Array<Record<string, unknown>>;
  businessResponsibilitySupport: {
    status: string;
    claims: Array<Record<string, unknown>>;
    note: string;
  };
  generatedAt: string;
};

export type AccessAssignmentScopeType =
  | 'self'
  | 'global'
  | 'managedTalentGroup'
  | 'managedOrgUnit'
  | 'assignedPlatformAccount'
  | 'financeGlobal'
  | 'financePeriod'
  | 'contractPortfolio'
  | 'assignedEvent'
  | 'assignedStudioResource'
  | 'payrollPeriod'
  | 'attendancePeriodOrg';

export type AccessAssignmentScopeGrant = {
  scopeType: AccessAssignmentScopeType;
  targetId?: string;
  targetKey?: string;
  periodKey?: string;
};

export type AccessAssignmentTargetType = 'ROLE' | 'ROLE_TEMPLATE' | 'BUNDLE';

export type AccessAssignmentTargetOption = {
  assignmentKind: AccessAssignmentTargetType;
  id?: string;
  code: string;
  version?: string;
  name: string;
  childRoles?: string[];
  recommendedAccountContext?: RecommendedAccountContext;
  requiredScopeTypes: string[];
  requiresResponsibility: boolean;
  requiredResponsibilityType?: string | string[] | null;
  sensitiveLevel?: 'STANDARD' | 'HIGH_RISK' | string;
  legacyAssignable: boolean;
  recommendedPickerMode?: string;
};

export type AccessAssignmentTargetsMetadata = {
  readOnly: boolean;
  unrestrictedUserListReturned: boolean;
  searchFirstUserPickerRequired: boolean;
  eligibleUsersReturned: boolean;
  userListReturned: boolean;
  frontendSettableFields: string[];
  frontendSettableAuthorityFields: string[];
  backendOwnedAuthorityFields: string[];
  assignmentTargets: AccessAssignmentTargetOption[];
  previewRemainsAuthoritative: boolean;
};

export type AccessAssignmentRequestPayload = {
  targetUserId: string;
  assignmentTargetType: AccessAssignmentTargetType;
  assignmentTargetId?: string;
  assignmentTargetCode?: string;
  bundleVersion?: string;
  structuredScopeGrants: AccessAssignmentScopeGrant[];
  reason: string;
  sourceContext?: {
    talentGroupId?: string;
    orgUnitId?: string;
    platformAccountId?: string;
    eventId?: string;
    studioResourceId?: string;
    financePeriod?: string;
    payrollPeriod?: string;
    attendancePeriodOrgUnitId?: string;
  };
};

export type AccessAssignmentIssue = {
  severity?: 'BLOCKER' | 'WARNING' | string;
  code: string;
  summary?: string;
  [key: string]: unknown;
};

export type AccessAssignmentPreviewResult = {
  previewOnly?: boolean;
  canApply: boolean;
  blockers: AccessAssignmentIssue[];
  warnings: AccessAssignmentIssue[];
  targetUser?: Record<string, unknown>;
  assignmentTarget?: Record<string, unknown>;
  requestedScope?: AccessAssignmentScopeGrant[];
  normalizedScope?: AccessAssignmentScopeGrant[];
  scopeFingerprint?: string;
  reasonRequirement?: Record<string, unknown>;
  lifecyclePreview?: Record<string, unknown>;
  currentEffectiveAccess?: Record<string, unknown> | null;
  proposedEffectiveAccess?: Record<string, unknown> | null;
  effectiveAccessDelta?: {
    addedPermissions?: string[];
    removedPermissions?: string[];
    unchangedPermissions?: string[];
  };
  proposedAssignments?: Array<Record<string, unknown>>;
  bundleExpansion?: Record<string, unknown> | null;
  accountContextRequirement?: Record<string, unknown> | null;
  consoleEntitlementPreview?: Record<string, unknown> | null;
  responsibilityRequirements?: Array<Record<string, unknown>>;
  sensitiveAccess?: Record<string, unknown> | null;
  duplicateConflicts?: Array<Record<string, unknown>>;
  legacyRoleStatus?: Record<string, unknown> | null;
  selfAssignmentStatus?: Record<string, unknown> | null;
  previewCompleteness?: Record<string, unknown> | null;
  sourceTrace?: Record<string, unknown> | null;
};

export type AccessAssignmentApplyResult = {
  applied: boolean;
  canApply: boolean;
  applyStatus: 'APPLIED' | 'BLOCKED' | string;
  blockers: AccessAssignmentIssue[];
  warnings: AccessAssignmentIssue[];
  targetUser?: Record<string, unknown>;
  assignmentTarget?: Record<string, unknown>;
  normalizedScope?: AccessAssignmentScopeGrant[];
  scopeFingerprint?: string;
  proposedAssignments?: Array<Record<string, unknown>>;
  appliedAssignments?: Array<Record<string, unknown>>;
  bundleExpansion?: Record<string, unknown> | null;
  accountContextResult?: Record<string, unknown> | null;
  consoleEntitlementResult?: Record<string, unknown> | null;
  responsibilityRequirements?: Array<Record<string, unknown>>;
  sensitiveAccess?: Record<string, unknown> | null;
  duplicateConflicts?: Array<Record<string, unknown>>;
  auditTrace?: Record<string, unknown> | null;
  sourceTrace?: Record<string, unknown> | null;
  effectiveAccessAfterApply?: EffectiveAccessRecord | Record<string, unknown>;
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
  templateCode: ActiveRoleTemplateCode;
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
