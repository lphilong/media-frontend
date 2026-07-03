import { z } from 'zod';

import {
  roleAssignmentStateValues,
  roleDelegationBandValues,
  roleMaxDelegatableBandValues,
  roleStateValues,
} from '@modules/role/constants/role.constants';
import type {
  CursorPagedResponse,
  AccessAssignmentApplyResult,
  AccessAssignmentLifecycleListResult,
  AccessAssignmentLifecycleResult,
  AccessAssignmentPreviewResult,
  AccessAssignmentRequestPayload,
  AccessAssignmentRevokePayload,
  AccessAssignmentTargetsMetadata,
  RoleAssignmentRuleReplacementPayload,
  RoleCreateFromTemplatePayload,
  RoleCreatePayload,
  RoleDetailRecord,
  EffectiveAccessRecord,
  JsonPlainValue,
  RoleBundleListItem,
  RoleLifecycleAction,
  RoleLifecyclePayload,
  RoleListItem,
  RoleListQuery,
  RolePermissionMatrix,
  RolePermissionReplacementPayload,
  RoleTemplateListItem,
  RoleTemplatePreview,
  RoleUpdatePayload,
} from '@modules/role/types/role.types';
import { apiRequest } from '@shared/api';
import {
  accountContextSchema,
  workspaceAvailabilitySchema,
} from '@shared/auth/current-actor-capabilities';

const roleStateSchema = z.enum(roleStateValues);
const roleAssignmentStateSchema = z.enum(roleAssignmentStateValues);
const delegationBandSchema = z.enum(roleDelegationBandValues);
const maxDelegatableBandSchema = z.enum(roleMaxDelegatableBandValues);
const permissionSchema = z
  .object({
    code: z.string().trim().min(1),
  })
  .strict();

const activeRoleTemplateCodeSchema = z.enum([
  'OWNER_ADMIN',
  'ACCESS_ADMIN',
  'HR_OPERATIONS',
  'HR_TERMS_APPROVER',
  'PRODUCTION_OPS',
  'PLATFORM_CHANNEL_OPS',
  'CREATIVE_VISUAL_LEAD',
  'CONTENT_OPS',
  'TALENT_GROUP_MANAGER',
  'ORG_UNIT_MANAGER',
  'KPI_OPERATIONS',
  'COMMERCIAL_CONTRACT_OPS',
  'REVENUE_FINANCE_OPS',
  'REVENUE_APPROVER',
  'REVENUE_RECONCILER',
  'COMMISSION_OPS',
  'COMMISSION_APPROVER',
  'ATTENDANCE_OPS',
  'LEAVE_REVIEWER',
  'ATTENDANCE_APPROVER',
  'MONTHLY_CLOSE_OWNER',
  'PAYROLL_DRAFT_OPS',
  'PAYROLL_DRAFT_APPROVER',
  'VIEWER_AUDITOR',
  'STAFF_CONSOLE_USER',
]);

const legacyRoleTemplateCodeSchema = z.enum([
  'ADMIN_FULL',
  'TEAM_MANAGER',
  'COMMERCIAL_FINANCE',
  'TALENT_STAFF_SELF',
]);

const roleTemplateCodeSchema = z.union([
  activeRoleTemplateCodeSchema,
  legacyRoleTemplateCodeSchema,
]);

const roleTemplateStatusSchema = z.enum(['READY', 'PREVIEW_ONLY', 'REQUIRES_FUTURE_SCOPE']);

const assignabilityStatusValues = [
  'READY_ASSIGNABLE',
  'REQUIRES_SCOPE_SELECTION',
  'RESTRICTED_SENSITIVE',
  'FUTURE_READY_CONDITION',
  'SYSTEM_CONTROLLED',
  'READ_ONLY_AUDIT',
] as const;
const operatorFlowGroupValues = [
  'READY_TO_ASSIGN',
  'REQUIRES_SCOPE_SELECTION',
  'RESTRICTED_SENSITIVE',
  'FUTURE_READINESS',
  'SYSTEM_CONTROLLED',
  'READ_ONLY_AUDIT',
] as const;
const knownAssignabilityStatuses = new Set<string>(assignabilityStatusValues);
const knownOperatorFlowGroups = new Set<string>(operatorFlowGroupValues);

const assignabilityStatusSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && knownAssignabilityStatuses.has(value)
      ? value
      : 'SYSTEM_CONTROLLED',
  z.enum(assignabilityStatusValues),
);

const featureStatusSchema = z
  .enum(['SOURCE_BACKED', 'PARTIAL_SOURCE_BACKED', 'FUTURE_READY'])
  .default('SOURCE_BACKED');

const operatorFlowGroupSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && knownOperatorFlowGroups.has(value) ? value : 'SYSTEM_CONTROLLED',
  z.enum(operatorFlowGroupValues),
);

const catalogVisibilityMetadataSchema = {
  assignabilityStatus: assignabilityStatusSchema,
  featureStatus: featureStatusSchema,
  operatorFlowGroup: operatorFlowGroupSchema,
  sensitivityLevel: z.string().trim().min(1).default('STANDARD'),
  reviewPolicy: z.string().trim().min(1).default('NOT_REQUIRED'),
  accountContextLifecyclePolicy: z.string().trim().min(1).default('SYSTEM_DERIVED_PREVIEW_ONLY'),
  responsibilityPolicy: z.string().trim().min(1).default('NOT_REQUIRED'),
  scopeSelectorSupport: z.string().trim().min(1).default('SUPPORTED'),
  futureReadinessNote: z.string().nullable().default(null),
  legacyVisibility: z.string().trim().min(1).default('NORMAL_OPERATOR'),
};

const roleTemplateScopePlanEntrySchema = z
  .object({
    module: z.string().trim().min(1),
    scopes: z.array(z.string().trim().min(1)),
    status: roleTemplateStatusSchema,
    note: z.string().trim().min(1),
  })
  .strict();

const accessRiskSchema = z
  .object({
    isSensitive: z.boolean().default(false),
    isGlobalLike: z.boolean().default(false),
    isHighRisk: z.boolean().default(false),
    requiresReason: z.boolean().optional(),
    requiresReview: z.boolean().default(false),
    isBreakGlassLike: z.boolean().default(false),
    isPrivilegedAccessGovernance: z.boolean().optional(),
    maxReviewWindowDays: z.number().nullable().optional(),
    requiresExpiry: z.boolean().optional(),
    maxExpiryWindowDays: z.number().nullable().optional(),
    globalScopes: z.array(z.record(z.unknown())).optional(),
    sensitiveRoleCodes: z.array(z.string()).optional(),
    highRiskRoleCodes: z.array(z.string()).optional(),
    sensitivePermissions: z.array(z.string()).optional(),
    riskReasons: z.array(z.string()).optional(),
  })
  .catchall(z.unknown());

const accessRiskPreviewSchema = accessRiskSchema
  .extend({
    sensitiveOrGlobal: z.boolean().default(false),
    reasonRequired: z.boolean().optional(),
    reviewAt: z.union([z.number(), z.string()]).nullable().optional(),
    expiresAt: z.union([z.number(), z.string()]).nullable().optional(),
    lifecycleBlockers: z.array(z.record(z.unknown())).optional(),
    denyReasons: z.array(z.string()).optional(),
    reviewPolicy: z.string().optional(),
    approvalWorkflow: z.string().optional(),
  })
  .catchall(z.unknown());

const workScheduleScopeGrantSchema = z.enum(['self', 'team', 'department', 'global']);
const globalScopeGrantSchema = z.enum(['global']);
const eventAssignmentScopeGrantSchema = z.enum(['global', 'managedGroup']);
const kpiScopeGrantSchema = z.enum(['global', 'managedGroup', 'self']);

export const roleAssignmentScopeGrantsSchema = z
  .object({
    workSchedule: z.array(workScheduleScopeGrantSchema).optional(),
    eventAssignment: z.array(eventAssignmentScopeGrantSchema).optional(),
    contractRegistry: z.array(globalScopeGrantSchema).optional(),
    talentKpi: z.array(globalScopeGrantSchema).optional(),
    kpi: z.array(kpiScopeGrantSchema).optional(),
    revenueLedger: z.array(globalScopeGrantSchema).optional(),
    commission: z.array(globalScopeGrantSchema).optional(),
    dashboardLite: z.array(globalScopeGrantSchema).optional(),
  })
  .strict();

export const roleTemplateSchema = z
  .object({
    code: activeRoleTemplateCodeSchema,
    version: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string(),
    category: z.string().trim().min(1),
    permissionCount: z.number().int().nonnegative(),
    permissions: z.array(permissionSchema).optional(),
    recommendedAccountContext: accountContextSchema,
    recommendedScopeGrants: roleAssignmentScopeGrantsSchema,
    scopePlan: z.array(roleTemplateScopePlanEntrySchema),
    warnings: z.array(z.string()),
    implementationNotes: z.array(z.string()),
    status: roleTemplateStatusSchema,
    isSensitive: z.boolean().default(false),
    isGlobalLike: z.boolean().default(false),
    isHighRisk: z.boolean().default(false),
    requiresReview: z.boolean().default(false),
    isBreakGlassLike: z.boolean().default(false),
    accessRisk: accessRiskSchema.nullable().optional(),
    ...catalogVisibilityMetadataSchema,
  })
  .strict();

const roleTemplatePreviewSchema = z
  .object({
    template: roleTemplateSchema.extend({
      permissions: z.array(permissionSchema),
    }),
    permissions: z.array(permissionSchema),
    scopePlan: z.array(roleTemplateScopePlanEntrySchema),
    warnings: z.array(z.string()),
    unsupportedScopeNotes: z.array(z.string()),
  })
  .strict();

const jsonPlainValueSchema: z.ZodType<JsonPlainValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(jsonPlainValueSchema)]),
);

const assignmentRuleSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    conditions: z.record(jsonPlainValueSchema).nullable().optional(),
  })
  .strict();

const roleListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    state: roleStateSchema,
    permissionsSummary: z.union([z.string(), z.number()]).nullable().optional(),
    assignmentCountSummary: z.union([z.string(), z.number()]).nullable().optional(),
    templateCode: roleTemplateCodeSchema.nullable().optional(),
    templateVersion: z.string().nullable().optional(),
    templateAppliedAt: z.union([z.number(), z.string()]).nullable().optional(),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const roleDetailSchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    state: roleStateSchema,
    permissions: z.array(permissionSchema),
    delegationBand: delegationBandSchema,
    maxDelegatableBand: maxDelegatableBandSchema,
    assignmentRules: z.array(assignmentRuleSchema),
    templateCode: roleTemplateCodeSchema.nullable().optional(),
    templateVersion: z.string().nullable().optional(),
    templateAppliedAt: z.union([z.number(), z.string()]).nullable().optional(),
    createdAt: z.union([z.number(), z.string()]).optional(),
    updatedAt: z.union([z.number(), z.string()]),
    activatedAt: z.union([z.number(), z.string()]).nullable().optional(),
    archivedAt: z.union([z.number(), z.string()]).nullable().optional(),
  })
  .strict();

const permissionMatrixSchema = z
  .object({
    roleId: z.string().trim().min(1),
    roleCode: z.string().trim().min(1),
    roleState: roleStateSchema,
    permissions: z.array(permissionSchema),
    delegationBand: delegationBandSchema,
    maxDelegatableBand: maxDelegatableBandSchema,
  })
  .strict();

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const listResponseSchema = z
  .object({
    data: z.array(roleListItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: roleDetailSchema,
  })
  .strict();

const permissionMatrixResponseSchema = z
  .object({
    data: permissionMatrixSchema,
  })
  .strict();

const roleTemplateListResponseSchema = z
  .object({
    data: z.array(roleTemplateSchema),
  })
  .strict();

const roleTemplatePreviewResponseSchema = z
  .object({
    data: roleTemplatePreviewSchema,
  })
  .strict();

const roleBundleSchema = z
  .object({
    code: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string(),
    businessPurpose: z.string(),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    version: z.string().trim().min(1),
    childRoles: z.array(z.string().trim().min(1)),
    recommendedAccountContext: accountContextSchema,
    recommendedScopes: z.array(z.string().trim().min(1)),
    sensitiveWarning: z.string().nullable(),
    sensitive: z.boolean(),
    isSensitive: z.boolean().default(false),
    isGlobalLike: z.boolean().default(false),
    isHighRisk: z.boolean().default(false),
    requiresReview: z.boolean().default(false),
    isBreakGlassLike: z.boolean().default(false),
    accessRisk: accessRiskSchema.nullable().optional(),
    ...catalogVisibilityMetadataSchema,
    createdAt: z.string().trim().min(1),
    updatedAt: z.string().trim().min(1),
  })
  .strict();

const roleBundleListResponseSchema = z
  .object({
    data: z.array(roleBundleSchema),
  })
  .strict();

const accessAssignmentScopeTypeSchema = z.enum([
  'self',
  'global',
  'managedTalentGroup',
  'managedOrgUnit',
  'assignedPlatformAccount',
  'financeGlobal',
  'financePeriod',
  'contractPortfolio',
  'assignedEvent',
  'assignedStudioResource',
  'payrollPeriod',
  'attendancePeriodOrg',
]);

const accessAssignmentScopeGrantSchema = z
  .object({
    scopeType: accessAssignmentScopeTypeSchema,
    targetId: z.string().trim().min(1).optional(),
    targetKey: z.string().trim().min(1).optional(),
    periodKey: z.string().trim().min(1).optional(),
  })
  .strict();

const accessAssignmentTargetOptionSchema = z
  .object({
    assignmentKind: z.enum(['ROLE', 'ROLE_TEMPLATE', 'BUNDLE']),
    id: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1),
    version: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
    childRoles: z.array(z.string().trim().min(1)).optional(),
    recommendedAccountContext: accountContextSchema.optional(),
    requiredScopeTypes: z.array(z.string().trim().min(1)).default([]),
    requiresResponsibility: z.boolean().default(false),
    requiredResponsibilityType: z
      .union([z.string().trim().min(1), z.array(z.string().trim().min(1))])
      .nullable()
      .optional(),
    sensitiveLevel: z.string().trim().min(1).optional(),
    legacyAssignable: z.boolean(),
    ...catalogVisibilityMetadataSchema,
    recommendedPickerMode: z.string().trim().min(1).optional(),
  })
  .strict();

const accessAssignmentTargetsMetadataSchema = z
  .object({
    readOnly: z.boolean(),
    unrestrictedUserListReturned: z.boolean(),
    searchFirstUserPickerRequired: z.boolean(),
    eligibleUsersReturned: z.boolean(),
    userListReturned: z.boolean(),
    frontendSettableFields: z.array(z.string()),
    frontendSettableAuthorityFields: z.array(z.string()),
    backendOwnedAuthorityFields: z.array(z.string()),
    assignmentTargets: z.array(accessAssignmentTargetOptionSchema),
    previewRemainsAuthoritative: z.boolean(),
  })
  .strict();

const accessAssignmentTargetsResponseSchema = z
  .object({
    data: accessAssignmentTargetsMetadataSchema,
  })
  .strict();

const accessAssignmentIssueSchema = z
  .object({
    severity: z.string().optional(),
    code: z.string().trim().min(1),
    summary: z.string().optional(),
  })
  .catchall(z.unknown());

const accessAssignmentPreviewSchema = z
  .object({
    previewOnly: z.boolean().optional(),
    canApply: z.boolean(),
    blockers: z.array(accessAssignmentIssueSchema).default([]),
    warnings: z.array(accessAssignmentIssueSchema).default([]),
    targetUser: z.record(z.unknown()).optional(),
    assignmentTarget: z.record(z.unknown()).optional(),
    requestedScope: z.array(accessAssignmentScopeGrantSchema).optional(),
    normalizedScope: z.array(accessAssignmentScopeGrantSchema).optional(),
    scopeFingerprint: z.string().optional(),
    reasonRequirement: z.record(z.unknown()).optional(),
    lifecyclePreview: z.record(z.unknown()).optional(),
    currentEffectiveAccess: z.record(z.unknown()).nullable().optional(),
    proposedEffectiveAccess: z.record(z.unknown()).nullable().optional(),
    effectiveAccessDelta: z
      .object({
        addedPermissions: z.array(z.string()).optional(),
        removedPermissions: z.array(z.string()).optional(),
        unchangedPermissions: z.array(z.string()).optional(),
      })
      .catchall(z.unknown())
      .optional(),
    proposedAssignments: z.array(z.record(z.unknown())).optional(),
    bundleExpansion: z.record(z.unknown()).nullable().optional(),
    accountContextRequirement: z.record(z.unknown()).nullable().optional(),
    consoleEntitlementPreview: z.record(z.unknown()).nullable().optional(),
    responsibilityRequirements: z.array(z.record(z.unknown())).optional(),
    sensitiveAccess: accessRiskPreviewSchema.nullable().optional(),
    duplicateConflicts: z.array(z.record(z.unknown())).optional(),
    legacyRoleStatus: z.record(z.unknown()).nullable().optional(),
    selfAssignmentStatus: z.record(z.unknown()).nullable().optional(),
    previewCompleteness: z.record(z.unknown()).nullable().optional(),
    sourceTrace: z.record(z.unknown()).nullable().optional(),
  })
  .catchall(z.unknown());

const accessAssignmentPreviewResponseSchema = z
  .object({
    data: accessAssignmentPreviewSchema,
  })
  .strict();

const accessAssignmentApplySchema = z
  .object({
    applied: z.boolean(),
    canApply: z.boolean(),
    applyStatus: z.string(),
    blockers: z.array(accessAssignmentIssueSchema).default([]),
    warnings: z.array(accessAssignmentIssueSchema).default([]),
    targetUser: z.record(z.unknown()).optional(),
    assignmentTarget: z.record(z.unknown()).optional(),
    normalizedScope: z.array(accessAssignmentScopeGrantSchema).optional(),
    scopeFingerprint: z.string().optional(),
    proposedAssignments: z.array(z.record(z.unknown())).optional(),
    appliedAssignments: z.array(z.record(z.unknown())).optional(),
    bundleExpansion: z.record(z.unknown()).nullable().optional(),
    accountContextResult: z.record(z.unknown()).nullable().optional(),
    consoleEntitlementResult: z.record(z.unknown()).nullable().optional(),
    responsibilityRequirements: z.array(z.record(z.unknown())).optional(),
    responsibilityOperationResult: z.record(z.unknown()).nullable().optional(),
    sensitiveAccess: accessRiskPreviewSchema.nullable().optional(),
    duplicateConflicts: z.array(z.record(z.unknown())).optional(),
    auditTrace: z.record(z.unknown()).nullable().optional(),
    sourceTrace: z.record(z.unknown()).nullable().optional(),
    effectiveAccessAfterApply: z.record(z.unknown()).optional(),
  })
  .catchall(z.unknown());

const accessAssignmentApplyResponseSchema = z
  .object({
    data: accessAssignmentApplySchema,
  })
  .strict();

const accessAssignmentAuditSummarySchema = z
  .object({
    assignmentId: z.string().trim().min(1).optional(),
    action: z.string().nullable().optional(),
    actorId: z.string().nullable().optional(),
    timestamp: z.union([z.number(), z.string()]).nullable().optional(),
    reason: z.string().nullable().optional(),
    oldStatus: z.string().nullable().optional(),
    newStatus: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

const accessAssignmentLifecycleItemSchema = z
  .object({
    assignmentId: z.string().trim().min(1),
    targetUserId: z.string().trim().min(1),
    roleId: z.string().trim().min(1),
    roleCode: z.string().nullable(),
    roleName: z.string().nullable(),
    roleTemplateCode: z.string().nullable().optional(),
    roleTemplateVersion: z.string().nullable().optional(),
    structuredScopeGrants: z.array(accessAssignmentScopeGrantSchema).default([]),
    scopeFingerprint: z.string(),
    status: roleAssignmentStateSchema,
    lifecycleState: roleAssignmentStateSchema,
    currentlyEffective: z.boolean(),
    inactiveReason: z.string().nullable().optional(),
    effectiveAt: z.union([z.number(), z.string()]).nullable(),
    expiresAt: z.union([z.number(), z.string()]).nullable().optional(),
    reviewAt: z.union([z.number(), z.string()]).nullable().optional(),
    assignedBy: z.string().nullable().optional(),
    assignedAt: z.union([z.number(), z.string()]).optional(),
    revokedAt: z.union([z.number(), z.string()]).nullable().optional(),
    revokedBy: z.string().nullable().optional(),
    revokeReason: z.string().nullable().optional(),
    origin: z.enum(['DIRECT', 'BUNDLE', 'LEGACY']),
    bundleOrigin: z.record(z.unknown()).nullable(),
    reason: z.string().nullable(),
    sensitiveOrGlobal: z.boolean().default(false),
    isSensitive: z.boolean().default(false),
    isGlobalLike: z.boolean().default(false),
    isHighRisk: z.boolean().default(false),
    requiresReview: z.boolean().default(false),
    isBreakGlassLike: z.boolean().default(false),
    accessRisk: accessRiskSchema.nullable().optional(),
    supportedActions: z.array(z.string()),
    auditSummary: accessAssignmentAuditSummarySchema.nullable().optional(),
  })
  .catchall(z.unknown());

const accessAssignmentLifecycleListSchema = z
  .object({
    readOnly: z.boolean(),
    sourceTruth: z.boolean(),
    targetUser: z
      .object({
        id: z.string().trim().min(1),
        displayName: z.string().nullable(),
        email: z.string().nullable(),
        accountStatus: z.string(),
      })
      .strict(),
    supportedLifecycleActions: z.array(z.string()),
    unsupportedLifecycleActions: z.array(z.string()),
    items: z.array(accessAssignmentLifecycleItemSchema),
    generatedAt: z.string().trim().min(1),
  })
  .strict();

const accessAssignmentLifecycleListResponseSchema = z
  .object({
    data: accessAssignmentLifecycleListSchema,
  })
  .strict();

const accessAssignmentLifecycleResultSchema = z
  .object({
    revoked: z.boolean(),
    lifecycleStatus: z.string(),
    blockers: z.array(accessAssignmentIssueSchema).default([]),
    warnings: z.array(accessAssignmentIssueSchema).default([]),
    assignment: accessAssignmentLifecycleItemSchema.nullable(),
    auditTrace: z.record(z.unknown()).nullable().optional(),
    sourceTrace: z.record(z.unknown()).nullable().optional(),
    effectiveAccessAfterLifecycle: z.record(z.unknown()).optional(),
  })
  .catchall(z.unknown());

const accessAssignmentLifecycleResponseSchema = z
  .object({
    data: accessAssignmentLifecycleResultSchema,
  })
  .strict();

const effectiveAccessAssignmentSchema = z
  .object({
    assignmentId: z.string().trim().min(1),
    roleId: z.string().trim().min(1),
    roleCode: z.string().nullable(),
    roleName: z.string().nullable(),
    templateCode: roleTemplateCodeSchema.nullable().optional(),
    permissions: z.array(z.string().trim().min(1)),
    legacyScopeGrants: roleAssignmentScopeGrantsSchema.nullable(),
    structuredScopeGrants: z.array(z.record(z.unknown())),
    scopeFingerprint: z.string(),
    reason: z.string().nullable(),
    assignedBy: z.string().nullable(),
    assignedAt: z.union([z.number(), z.string()]),
    effectiveAt: z.union([z.number(), z.string()]).nullable(),
    expiresAt: z.union([z.number(), z.string()]).nullable(),
    reviewAt: z.union([z.number(), z.string()]).nullable(),
    origin: z.enum(['DIRECT', 'BUNDLE', 'LEGACY']),
    bundleOrigin: z.record(z.unknown()).nullable(),
    sensitiveOrGlobal: z.boolean().default(false),
    isSensitive: z.boolean().default(false),
    isGlobalLike: z.boolean().default(false),
    isHighRisk: z.boolean().default(false),
    requiresReview: z.boolean().default(false),
    isBreakGlassLike: z.boolean().default(false),
    accessRisk: accessRiskSchema.nullable().optional(),
  })
  .catchall(z.unknown());

const effectiveAccessSchema = z
  .object({
    readOnly: z.boolean(),
    sourceTruth: z.boolean(),
    user: z
      .object({
        id: z.string().trim().min(1),
        displayName: z.string().nullable(),
        email: z.string().nullable(),
        accountStatus: z.string(),
      })
      .strict(),
    accountContextSignals: z
      .object({
        canonicalAccountContextImplemented: z.boolean(),
        canonicalSource: z.literal('ACCOUNT_CONTEXT'),
        accountContexts: z.array(accountContextSchema),
        legacyActorKind: z.string().optional(),
        compatibilityContexts: z.array(z.string()),
        grantsAuthorityByItself: z.boolean(),
      })
      .strict(),
    workspaceAvailability: workspaceAvailabilitySchema,
    activeRoleAssignments: z.array(effectiveAccessAssignmentSchema),
    roles: z.array(
      z
        .object({
          id: z.string().trim().min(1),
          code: z.string().trim().min(1),
          name: z.string().trim().min(1),
        })
        .strict(),
    ),
    permissions: z.array(z.string()),
    permissionSourceTrace: z.array(z.record(z.unknown())),
    businessResponsibilitySupport: z
      .object({
        status: z.string(),
        claims: z.array(z.record(z.unknown())),
        note: z.string(),
      })
      .strict(),
    generatedAt: z.string().trim().min(1),
  })
  .strict();

const effectiveAccessResponseSchema = z
  .object({
    data: effectiveAccessSchema,
  })
  .strict();

const sanitizeRoleListQuery = (
  query: RoleListQuery,
): Record<string, string | number | undefined> => ({
  state: query.state,
  cursor: query.cursor,
  limit: query.limit,
  search: query.search,
});

export const fetchRoles = async (
  query: RoleListQuery,
): Promise<CursorPagedResponse<RoleListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/roles',
    params: sanitizeRoleListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchRoleDetail = async (roleId: string): Promise<RoleDetailRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/roles/${encodeURIComponent(roleId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const createRole = async (payload: RoleCreatePayload): Promise<RoleDetailRecord> => {
  const response = await apiRequest<unknown, RoleCreatePayload>({
    method: 'POST',
    url: '/admin/roles',
    data: {
      name: payload.name,
      ...(payload.code ? { code: payload.code } : {}),
      description: payload.description,
      initialPermissions: payload.initialPermissions ?? [],
      initialDelegationBand: payload.initialDelegationBand ?? 'LIMITED',
      initialMaxDelegatableBand: payload.initialMaxDelegatableBand ?? 'NONE',
      initialAssignmentRules: payload.initialAssignmentRules ?? [],
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const fetchRoleTemplates = async (): Promise<RoleTemplateListItem[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/role-templates',
  });

  return roleTemplateListResponseSchema.parse(response).data;
};

export const fetchRoleBundles = async (): Promise<RoleBundleListItem[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/role-bundles',
  });

  return roleBundleListResponseSchema.parse(response).data;
};

export const fetchEffectiveAccess = async (userId: string): Promise<EffectiveAccessRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/effective-access/users/${encodeURIComponent(userId)}`,
  });

  return effectiveAccessResponseSchema.parse(response).data;
};

export const fetchAccessAssignmentTargets = async (): Promise<AccessAssignmentTargetsMetadata> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/access-assignments/targets',
  });

  return accessAssignmentTargetsResponseSchema.parse(response).data;
};

const sanitizeAccessAssignmentPayload = (
  payload: AccessAssignmentRequestPayload,
): AccessAssignmentRequestPayload => ({
  targetUserId: payload.targetUserId,
  assignmentTargetType: payload.assignmentTargetType,
  ...(payload.assignmentTargetId ? { assignmentTargetId: payload.assignmentTargetId } : {}),
  ...(payload.assignmentTargetCode ? { assignmentTargetCode: payload.assignmentTargetCode } : {}),
  ...(payload.bundleVersion ? { bundleVersion: payload.bundleVersion } : {}),
  structuredScopeGrants: payload.structuredScopeGrants,
  reason: payload.reason,
  ...(payload.effectiveAt ? { effectiveAt: payload.effectiveAt } : {}),
  ...(payload.expiresAt ? { expiresAt: payload.expiresAt } : {}),
  ...(payload.reviewAt ? { reviewAt: payload.reviewAt } : {}),
  ...(payload.sourceContext ? { sourceContext: payload.sourceContext } : {}),
});

export const previewAccessAssignment = async (
  payload: AccessAssignmentRequestPayload,
): Promise<AccessAssignmentPreviewResult> => {
  const response = await apiRequest<unknown, AccessAssignmentRequestPayload>({
    method: 'POST',
    url: '/admin/access-assignments/preview',
    data: sanitizeAccessAssignmentPayload(payload),
  });

  return accessAssignmentPreviewResponseSchema.parse(response).data;
};

export const applyAccessAssignment = async (
  payload: AccessAssignmentRequestPayload,
): Promise<AccessAssignmentApplyResult> => {
  const response = await apiRequest<unknown, AccessAssignmentRequestPayload>({
    method: 'POST',
    url: '/admin/access-assignments/apply',
    data: sanitizeAccessAssignmentPayload(payload),
  });

  return accessAssignmentApplyResponseSchema.parse(response).data;
};

export const fetchAccessAssignmentsForUser = async (
  targetUserId: string,
): Promise<AccessAssignmentLifecycleListResult> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/access-assignments',
    params: { targetUserId },
  });

  return accessAssignmentLifecycleListResponseSchema.parse(response).data;
};

export const revokeAccessAssignment = async (
  assignmentId: string,
  payload: AccessAssignmentRevokePayload,
): Promise<AccessAssignmentLifecycleResult> => {
  const response = await apiRequest<unknown, AccessAssignmentRevokePayload>({
    method: 'POST',
    url: `/admin/access-assignments/${encodeURIComponent(assignmentId)}/revoke`,
    data: {
      reason: payload.reason,
    },
  });

  return accessAssignmentLifecycleResponseSchema.parse(response).data;
};

export const previewRoleTemplate = async (templateCode: string): Promise<RoleTemplatePreview> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/role-templates/${encodeURIComponent(templateCode)}/preview`,
    data: {},
  });

  return roleTemplatePreviewResponseSchema.parse(response).data;
};

export const createRoleFromTemplate = async (
  payload: RoleCreateFromTemplatePayload,
): Promise<RoleDetailRecord> => {
  const response = await apiRequest<unknown, RoleCreateFromTemplatePayload>({
    method: 'POST',
    url: '/admin/roles/from-template',
    data: {
      templateCode: payload.templateCode,
      ...(payload.code ? { code: payload.code } : {}),
      name: payload.name,
      description: payload.description ?? null,
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const updateRole = async (
  roleId: string,
  payload: RoleUpdatePayload,
): Promise<RoleDetailRecord> => {
  const response = await apiRequest<unknown, RoleUpdatePayload>({
    method: 'PATCH',
    url: `/admin/roles/${encodeURIComponent(roleId)}`,
    data: {
      name: payload.name,
      description: payload.description,
      delegationBand: payload.delegationBand,
      maxDelegatableBand: payload.maxDelegatableBand,
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const performRoleLifecycleAction = async (
  roleId: string,
  action: RoleLifecycleAction,
  payload?: RoleLifecyclePayload,
): Promise<RoleDetailRecord> => {
  const response = await apiRequest<unknown, RoleLifecyclePayload>({
    method: 'POST',
    url: `/admin/roles/${encodeURIComponent(roleId)}/${action}`,
    data:
      action === 'activate'
        ? {}
        : {
            reason: payload?.reason ?? null,
          },
  });

  return detailResponseSchema.parse(response).data;
};

export const replaceRolePermissions = async (
  roleId: string,
  payload: RolePermissionReplacementPayload,
): Promise<RoleDetailRecord> => {
  const response = await apiRequest<unknown, RolePermissionReplacementPayload>({
    method: 'PUT',
    url: `/admin/roles/${encodeURIComponent(roleId)}/permissions`,
    data: {
      permissions: payload.permissions,
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const replaceRoleAssignmentRules = async (
  roleId: string,
  payload: RoleAssignmentRuleReplacementPayload,
): Promise<RoleDetailRecord> => {
  const response = await apiRequest<unknown, RoleAssignmentRuleReplacementPayload>({
    method: 'PUT',
    url: `/admin/roles/${encodeURIComponent(roleId)}/assignment-rules`,
    data: {
      rules: payload.rules,
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const fetchRolePermissionMatrix = async (roleId: string): Promise<RolePermissionMatrix> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/roles/${encodeURIComponent(roleId)}/permission-matrix`,
  });

  return permissionMatrixResponseSchema.parse(response).data;
};
