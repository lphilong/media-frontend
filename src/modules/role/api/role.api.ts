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
  AccessAssignmentScopeGrant,
  AccessAssignmentRevokePayload,
  AccessAssignmentTargetsMetadata,
  AccessLifecycleStatusView,
  BreakGlassRequestPayload,
  BreakGlassStatusView,
  GovernanceStatusView,
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
  'OWNER_GOVERNANCE',
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

const governancePrincipalStatusSchema = z
  .object({
    principalId: z.string().trim().min(1),
    principalType: z.enum(['PRIMARY_OWNER', 'SUCCESSOR_OWNER']),
    status: z.enum(['PENDING', 'ACTIVE', 'SUPERSEDED', 'REVOKED']),
    effectiveAt: z.number().finite(),
    expiresAt: z.number().finite().nullable(),
    eligibleNow: z.boolean(),
    eligible: z.boolean(),
    eligibilityReasons: z.array(z.string()),
    canApproveSuccessor: z.boolean(),
    canActivateSuccessor: z.boolean(),
    ineligibilityReason: z.string().nullable(),
    nextAllowedAction: z.string().nullable(),
  })
  .strict();

const governanceQueuePageSchema = z
  .object({
    nextCursor: z.string().trim().min(1).nullable(),
    exhausted: z.boolean(),
  })
  .strict();

const governanceStatusResponseSchema = z
  .object({
    data: z
      .object({
        generatedAt: z.number().finite(),
        policy: z
          .object({
            version: z.string().trim().min(1),
            timeZone: z.literal('Asia/Ho_Chi_Minh'),
            effectiveAtRequired: z.literal(true),
            expiresAtRequired: z.literal(true),
          })
          .strict(),
        primaryOwner: governancePrincipalStatusSchema.nullable(),
        successors: z.array(governancePrincipalStatusSchema),
        actions: z
          .object({
            canProposeSuccessor: z.boolean(),
            proposalIneligibilityReason: z.string().nullable(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const breakGlassApprovalSchema = z
  .object({
    approverUserId: z.string().trim().min(1),
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().trim().min(1),
    decidedAt: z.number().finite(),
  })
  .strict();

const breakGlassRequestSchema = z
  .object({
    requestId: z.string().trim().min(1),
    idempotencyKey: z.string().trim().min(1),
    payloadFingerprint: z.string().trim().min(1),
    targetUserId: z.string().trim().min(1),
    permissions: z.array(z.string().trim().min(1)).min(1),
    structuredScopeGrants: z.array(accessAssignmentScopeGrantSchema).min(1),
    scopeFingerprint: z.string().trim().min(1),
    urgency: z.enum(['URGENT', 'NON_URGENT']),
    incidentReferenceId: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    requesterUserId: z.string().trim().min(1),
    requestedAt: z.number().finite(),
    requestedDurationMs: z.number().positive(),
    approvals: z.array(breakGlassApprovalSchema),
    status: z.enum([
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'ACTIVATED',
      'EXPIRED',
      'REVIEWED',
    ]),
    canApprove: z.boolean(),
    canReject: z.boolean(),
    requiredApprovals: z.number().int().nonnegative(),
    completedApprovals: z.number().int().nonnegative(),
    remainingApprovals: z.number().int().nonnegative(),
    ineligibilityReason: z.string().nullable(),
    nextAllowedAction: z.string().nullable(),
  })
  .strict();

const breakGlassActivationSchema = z
  .object({
    activationId: z.string().trim().min(1),
    requestId: z.string().trim().min(1),
    targetUserId: z.string().trim().min(1),
    permissions: z.array(z.string().trim().min(1)).min(1),
    structuredScopeGrants: z.array(accessAssignmentScopeGrantSchema).min(1),
    scopeFingerprint: z.string().trim().min(1),
    incidentReferenceId: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    activatorUserId: z.string().trim().min(1),
    activatedAt: z.number().finite(),
    expiresAt: z.number().finite(),
    endedAt: z.number().finite().nullable().optional(),
    endedByUserId: z.string().nullable().optional(),
    endReason: z.string().nullable().optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'REVIEWED']),
    stepUpState: z.enum(['SATISFIED', 'NOT_SATISFIED', 'NOT_SUPPORTED']),
    independentReviewDeadline: z
      .object({
        calendarVersion: z.string().trim().min(1),
        timeZone: z.literal('Asia/Ho_Chi_Minh'),
        dueAt: z.number().finite(),
      })
      .strict(),
    independentReviewState: z.enum(['PENDING', 'OVERDUE', 'COMPLETED']),
    independentReviewCategory: z.literal('POST_USE_REVIEW'),
    overdueSince: z.number().finite().nullable(),
    completedAt: z.number().finite().nullable(),
    wasOverdue: z.boolean(),
    reviewerUserId: z.string().nullable(),
    reviewResult: z.enum(['APPROVED_USE', 'MISUSE_FOUND']).nullable(),
    reviewedAt: z.number().finite().nullable(),
    auditCorrelationId: z.string().trim().min(1),
    currentlyEffective: z.boolean(),
    remainingMs: z.number().nonnegative(),
    canReview: z.boolean(),
    canEnd: z.boolean(),
    endIneligibilityReason: z.string().nullable(),
    ineligibilityReason: z.string().nullable(),
    nextAllowedAction: z.string().nullable(),
  })
  .strict();

const breakGlassStatusResponseSchema = z
  .object({
    data: z
      .object({
        generatedAt: z.number().finite(),
        policy: z
          .object({
            version: z.string().trim().min(1),
            defaultDurationMs: z.number().positive(),
            maximumDurationMs: z.number().positive(),
          })
          .strict(),
        pagination: z
          .object({
            pageSize: z.number().int().positive(),
            requests: governanceQueuePageSchema,
            activations: governanceQueuePageSchema,
          })
          .strict(),
        availablePermissions: z.array(z.string().trim().min(1)),
        availableScopeTypes: z.array(accessAssignmentScopeTypeSchema),
        primaryOwner: z.object({ eligible: z.boolean(), isCurrentActor: z.boolean() }).strict(),
        requestEligibility: z
          .object({
            canRequestNonUrgent: z.boolean(),
            canRequestUrgent: z.boolean(),
            nonUrgentIneligibilityReason: z.string().nullable(),
            urgentIneligibilityReason: z.string().nullable(),
          })
          .strict(),
        requests: z.array(breakGlassRequestSchema),
        activations: z.array(breakGlassActivationSchema),
        nextAuthorityTransitionAt: z.number().finite().nullable(),
      })
      .strict(),
  })
  .strict();

const lifecycleActionEligibilitySchema = {
  canApprove: z.boolean(),
  canReject: z.boolean(),
  ineligibilityReason: z.string().nullable(),
  nextAllowedAction: z.string().nullable(),
};

const accessLifecycleStatusResponseSchema = z
  .object({
    data: z
      .object({
        generatedAt: z.number().finite(),
        availableScopeTypes: z.array(accessAssignmentScopeTypeSchema),
        policy: z
          .object({
            version: z.string().trim().min(1),
            timeZone: z.literal('Asia/Ho_Chi_Minh'),
            grace: z
              .object({
                automaticExtensionMs: z.number().positive(),
                maximumAbsoluteExtensionMs: z.number().positive(),
              })
              .strict(),
          })
          .strict(),
        pagination: z
          .object({
            pageSize: z.number().int().positive(),
            reviewCycles: governanceQueuePageSchema,
            graceExceptions: governanceQueuePageSchema,
            successorRequests: governanceQueuePageSchema,
          })
          .strict(),
        reviewCycles: z.array(
          z
            .object({
              cycleId: z.string().trim().min(1),
              assignmentId: z.string().trim().min(1),
              targetUserId: z.string().trim().min(1),
              riskTier: z.enum(['HIGH', 'LOW']),
              reviewDeadline: z.number().finite(),
              automaticGraceEndsAt: z.number().finite().nullable(),
              maximumGraceEndsAt: z.number().finite().nullable(),
              state: z.literal('PENDING'),
              requiredApprovals: z.number().int().positive(),
              completedApprovals: z.number().int().nonnegative(),
              remainingApprovals: z.number().int().nonnegative(),
              ...lifecycleActionEligibilitySchema,
              canRequestGrace: z.boolean(),
            })
            .strict(),
        ),
        graceExceptions: z.array(
          z
            .object({
              exceptionId: z.string().trim().min(1),
              cycleId: z.string().trim().min(1),
              targetUserId: z.string().trim().min(1),
              requestedAt: z.number().finite(),
              requestedExpiresAt: z.number().finite(),
              state: z.literal('PENDING'),
              ...lifecycleActionEligibilitySchema,
            })
            .strict(),
        ),
        successorRequests: z.array(
          z
            .object({
              requestId: z.string().trim().min(1),
              action: z.enum(['RENEWAL', 'REPLACEMENT', 'RESTORATION']),
              predecessorAssignmentId: z.string().trim().min(1),
              targetUserId: z.string().trim().min(1),
              requestedAt: z.number().finite(),
              state: z.literal('PENDING'),
              riskTier: z.enum(['HIGH', 'LOW']),
              effectiveAt: z.number().finite(),
              expiresAt: z.number().finite(),
              reviewAt: z.number().finite(),
              requiredApprovals: z.number().int().positive(),
              completedApprovals: z.number().int().nonnegative(),
              remainingApprovals: z.number().int().nonnegative(),
              ...lifecycleActionEligibilitySchema,
            })
            .strict(),
        ),
        requestableAssignments: z.array(
          z
            .object({
              assignmentId: z.string().trim().min(1),
              targetUserId: z.string().trim().min(1),
              roleId: z.string().trim().min(1),
              roleCode: z.string().nullable(),
              structuredScopeGrants: z.array(accessAssignmentScopeGrantSchema).min(1),
              scopeFingerprint: z.string().trim().min(1),
              state: z.enum(['ACTIVE', 'SCHEDULED', 'SUSPENDED']),
              operationalState: z.string().trim().min(1).optional(),
              effectiveAt: z.number().finite(),
              expiresAt: z.number().finite().nullable(),
              reviewAt: z.number().finite().nullable(),
              riskTier: z.enum(['HIGH', 'LOW']),
              riskPolicyVersion: z.string().trim().min(1),
              reviewWindowMs: z.number().positive().nullable(),
              actionTiming: z
                .object({
                  renewalEffectiveAt: z.number().finite(),
                  replacementEffectiveAt: z.number().finite(),
                  restorationEffectiveAt: z.number().finite(),
                })
                .strict(),
              canRenew: z.boolean(),
              canReplace: z.boolean(),
              canRestore: z.boolean(),
              ineligibilityReasons: z
                .object({
                  renewal: z.string().nullable(),
                  replacement: z.string().nullable(),
                  restoration: z.string().nullable(),
                })
                .strict(),
            })
            .strict(),
        ),
      })
      .strict(),
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
          templateCode: roleTemplateCodeSchema.nullable().optional(),
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

export const fetchGovernanceStatus = async (): Promise<GovernanceStatusView> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/access-assignments/governance',
  });
  return governanceStatusResponseSchema.parse(response).data;
};

export const fetchAccessLifecycleStatus = async (
  targetUserId?: string,
): Promise<AccessLifecycleStatusView> => {
  return fetchAccessLifecyclePage({ targetUserId });
};

export const fetchAccessLifecyclePage = async (input: {
  targetUserId?: string;
  queue?: 'review' | 'grace' | 'successor';
  cursor?: string;
}): Promise<AccessLifecycleStatusView> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/access-assignments/lifecycle',
    params: input,
  });
  return accessLifecycleStatusResponseSchema.parse(response).data;
};

export const decideAccessLifecycleReview = async (input: {
  cycleId: string;
  decision: 'APPROVED' | 'REJECTED';
  reason: string;
  nextReviewAt?: number;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/access-assignments/lifecycle/reviews/${encodeURIComponent(input.cycleId)}/decision`,
    data: {
      decision: input.decision,
      reason: input.reason,
      ...(input.nextReviewAt ? { nextReviewAt: input.nextReviewAt } : {}),
    },
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const requestAccessLifecycleGrace = async (input: {
  cycleId: string;
  requestedExpiresAt: number;
  reason: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: '/admin/access-assignments/lifecycle/grace-exceptions',
    data: input,
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const decideAccessLifecycleGrace = async (input: {
  exceptionId: string;
  decision: 'APPROVED' | 'REJECTED';
  reason: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/access-assignments/lifecycle/grace-exceptions/${encodeURIComponent(input.exceptionId)}/decision`,
    data: { decision: input.decision, reason: input.reason },
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const requestAccessLifecycleSuccessor = async (input: {
  action: 'RENEWAL' | 'REPLACEMENT' | 'RESTORATION';
  predecessorAssignmentId: string;
  roleId?: string;
  structuredScopeGrants?: AccessAssignmentScopeGrant[];
  effectiveAt?: number;
  expiresAt: number;
  reviewAt?: number;
  reason: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: '/admin/access-assignments/lifecycle/successors',
    data: input,
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const decideAccessLifecycleSuccessor = async (input: {
  requestId: string;
  decision: 'APPROVED' | 'REJECTED';
  reason: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/access-assignments/lifecycle/successors/${encodeURIComponent(input.requestId)}/decision`,
    data: { decision: input.decision, reason: input.reason },
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const proposeGovernanceSuccessor = async (input: {
  targetUserId: string;
  effectiveAt: number;
  expiresAt: number;
  reason: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: '/admin/access-assignments/governance/successors',
    data: input,
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const decideGovernanceSuccessor = async (input: {
  principalId: string;
  decision: 'APPROVED' | 'REJECTED';
  reason: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/access-assignments/governance/successors/${encodeURIComponent(input.principalId)}/decision`,
    data: {
      decision: input.decision,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    },
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const activateGovernanceSuccessor = async (input: {
  principalId: string;
  reason: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/access-assignments/governance/successors/${encodeURIComponent(input.principalId)}/activate`,
    data: { reason: input.reason, idempotencyKey: input.idempotencyKey },
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const fetchBreakGlassStatus = async (): Promise<BreakGlassStatusView> =>
  fetchBreakGlassPage({});

export const fetchBreakGlassPage = async (input: {
  queue?: 'approval' | 'independentReview';
  cursor?: string;
}): Promise<BreakGlassStatusView> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/access-assignments/break-glass',
    params: input,
  });
  return breakGlassStatusResponseSchema.parse(response).data;
};

export const createBreakGlassRequest = async (
  payload: BreakGlassRequestPayload,
): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown, BreakGlassRequestPayload>({
    method: 'POST',
    url: '/admin/access-assignments/break-glass',
    data: payload,
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const decideBreakGlassRequest = async (input: {
  requestId: string;
  decision: 'APPROVED' | 'REJECTED';
  reason: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/access-assignments/break-glass/${encodeURIComponent(input.requestId)}/decision`,
    data: { decision: input.decision, reason: input.reason },
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const reviewBreakGlassActivation = async (input: {
  activationId: string;
  result: 'APPROVED_USE' | 'MISUSE_FOUND';
  reason: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/access-assignments/break-glass/activations/${encodeURIComponent(input.activationId)}/review`,
    data: { result: input.result, reason: input.reason },
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
};

export const endBreakGlassActivation = async (input: {
  activationId: string;
  reason: string;
}): Promise<Record<string, unknown>> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/access-assignments/break-glass/activations/${encodeURIComponent(input.activationId)}/end`,
    data: { reason: input.reason },
  });
  return z
    .object({ data: z.record(z.unknown()) })
    .strict()
    .parse(response).data;
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
