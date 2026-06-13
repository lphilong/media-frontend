import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const CURRENT_ACTOR_CAPABILITIES_QUERY_KEY = ['current-actor-capabilities'] as const;

export const PERMISSIONS = {
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  ROLE_LIST: 'role:list',
  ROLE_VIEW: 'role:view',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_ACTIVATE: 'role:activate',
  ROLE_DEACTIVATE: 'role:deactivate',
  ROLE_ARCHIVE: 'role:archive',
  ROLE_PERMISSION_ASSIGN: 'role:permission:assign',
  ROLE_ASSIGNMENT_RULE_SET: 'role:assignment_rule:set',
  ROLE_ASSIGN_TO_USER: 'role:assign_to_user',
  ROLE_REVOKE_FROM_USER: 'role:revoke_from_user',
  USER_PROVISION_ACCOUNT: 'user:provision_account',
  USER_EDIT: 'user:edit',
  USER_ACTIVATE: 'user:activate',
  USER_DISABLE: 'user:disable',
  USER_ARCHIVE: 'user:archive',
  USER_AUTH_LINKAGE_SET: 'user:auth_linkage:set',
  USER_AUTH_LINKAGE_UNLINK: 'user:auth_linkage:unlink',
  USER_PASSWORD_SETUP_SEND: 'user:password_setup:send',
  USER_ACTOR_KIND_UPDATE: 'user:actor_kind:update',
  ORG_UNIT_READ: 'orgUnit.read',
  ORG_UNIT_CREATE: 'orgUnit.create',
  ORG_UNIT_UPDATE: 'orgUnit.update',
  ORG_UNIT_LOOKUP: 'orgUnit.lookup',
  ORG_UNIT_MANAGE_HIERARCHY: 'orgUnit.manageHierarchy',
  ORG_UNIT_MANAGE_LIFECYCLE: 'orgUnit.manageLifecycle',
  EMPLOYMENT_PROFILE_READ: 'employmentProfile.read',
  EMPLOYMENT_TERMS_READ: 'employmentTerms.read',
  EMPLOYMENT_TERMS_READ_SENSITIVE: 'employmentTerms.readSensitive',
  EMPLOYMENT_TERMS_MANAGE_DRAFT: 'employmentTerms.manageDraft',
  EMPLOYMENT_TERMS_APPROVE: 'employmentTerms.approve',
  EMPLOYMENT_PROFILE_CREATE: 'employmentProfile.create',
  EMPLOYMENT_PROFILE_UPDATE: 'employmentProfile.update',
  EMPLOYMENT_PROFILE_LOOKUP: 'employmentProfile.lookup',
  EMPLOYMENT_PROFILE_MANAGE_ORG_ASSIGNMENT: 'employmentProfile.manageOrgAssignment',
  EMPLOYMENT_PROFILE_MANAGE_MANAGER_ASSIGNMENT: 'employmentProfile.manageManagerAssignment',
  EMPLOYMENT_PROFILE_MANAGE_USER_LINKAGE: 'employmentProfile.manageUserLinkage',
  EMPLOYMENT_PROFILE_MANAGE_LIFECYCLE: 'employmentProfile.manageLifecycle',
  TALENT_READ: 'talent.read',
  TALENT_CREATE: 'talent.create',
  TALENT_UPDATE: 'talent.update',
  TALENT_LOOKUP: 'talent.lookup',
  TALENT_MANAGE_MANAGER: 'talent.manageManager',
  TALENT_MANAGE_EMPLOYMENT_LINK: 'talent.manageEmploymentLink',
  TALENT_MANAGE_COMMERCIAL_PARTICIPATION: 'talent.manageCommercialParticipation',
  TALENT_MANAGE_LIFECYCLE: 'talent.manageLifecycle',
  TALENT_GROUP_READ: 'talentGroup.read',
  TALENT_GROUP_CREATE: 'talentGroup.create',
  TALENT_GROUP_UPDATE: 'talentGroup.update',
  TALENT_GROUP_LOOKUP: 'talentGroup.lookup',
  TALENT_GROUP_MANAGE_MEMBERSHIP: 'talentGroup.manageMembership',
  TALENT_GROUP_MANAGE_LIFECYCLE: 'talentGroup.manageLifecycle',
  PLATFORM_ACCOUNT_READ: 'platformAccount.read',
  PLATFORM_ACCOUNT_CREATE: 'platformAccount.create',
  PLATFORM_ACCOUNT_UPDATE: 'platformAccount.update',
  PLATFORM_ACCOUNT_LOOKUP: 'platformAccount.lookup',
  PLATFORM_ACCOUNT_MANAGE_OWNERSHIP: 'platformAccount.manageOwnership',
  PLATFORM_ACCOUNT_MANAGE_CAPABILITIES: 'platformAccount.manageCapabilities',
  PLATFORM_ACCOUNT_MANAGE_LIFECYCLE: 'platformAccount.manageLifecycle',
  STUDIO_RESOURCE_READ: 'studioResource.read',
  STUDIO_RESOURCE_CREATE: 'studioResource.create',
  STUDIO_RESOURCE_UPDATE: 'studioResource.update',
  STUDIO_RESOURCE_LOOKUP: 'studioResource.lookup',
  STUDIO_RESOURCE_MANAGE_AVAILABILITY: 'studioResource.manageAvailability',
  STUDIO_RESOURCE_MANAGE_LIFECYCLE: 'studioResource.manageLifecycle',
  EVENT_READ: 'event.read',
  EVENT_CREATE: 'event.create',
  EVENT_UPDATE: 'event.update',
  EVENT_LOOKUP: 'event.lookup',
  EVENT_MANAGE_ASSIGNMENTS: 'event.manageAssignments',
  EVENT_MANAGE_LIFECYCLE: 'event.manageLifecycle',
  WORK_SCHEDULE_READ: 'workSchedule.read',
  WORK_SCHEDULE_CREATE: 'workSchedule.create',
  WORK_SCHEDULE_UPDATE: 'workSchedule.update',
  WORK_SCHEDULE_MANAGE_LIFECYCLE: 'workSchedule.manageLifecycle',
  CONTRACT_REGISTRY_READ: 'contractRegistry.read',
  CONTRACT_REGISTRY_CREATE: 'contractRegistry.create',
  CONTRACT_REGISTRY_UPDATE: 'contractRegistry.update',
  CONTRACT_REGISTRY_LOOKUP: 'contractRegistry.lookup',
  CONTRACT_REGISTRY_MANAGE_OWNER: 'contractRegistry.manageOwner',
  CONTRACT_REGISTRY_MANAGE_FILE_REFERENCE: 'contractRegistry.manageFileReference',
  CONTRACT_REGISTRY_MANAGE_LIFECYCLE: 'contractRegistry.manageLifecycle',
  CONTRACT_OBLIGATION_READ: 'contractObligation.read',
  CONTRACT_OBLIGATION_MANAGE_DRAFT: 'contractObligation.manageDraft',
  CONTRACT_OBLIGATION_DELIVER: 'contractObligation.deliver',
  CONTRACT_OBLIGATION_REVIEW: 'contractObligation.review',
  CONTRACT_OBLIGATION_MANAGE_LIFECYCLE: 'contractObligation.manageLifecycle',
  CONTRACT_OBLIGATION_EVENT_EVIDENCE_LINK_READ: 'contractObligation.eventEvidenceLink.read',
  CONTRACT_OBLIGATION_EVENT_EVIDENCE_LINK: 'contractObligation.eventEvidenceLink.link',
  CONTRACT_OBLIGATION_EVENT_EVIDENCE_REMOVE: 'contractObligation.eventEvidenceLink.remove',
  TALENT_KPI_READ: 'talentKpi.read',
  TALENT_KPI_CREATE: 'talentKpi.create',
  TALENT_KPI_UPDATE: 'talentKpi.update',
  TALENT_KPI_MANAGE_METRICS: 'talentKpi.manageMetrics',
  TALENT_KPI_MANAGE_LIFECYCLE: 'talentKpi.manageLifecycle',
  KPI_READ: 'kpi.read',
  KPI_CREATE_PLAN: 'kpi.createPlan',
  KPI_UPDATE_DRAFT: 'kpi.updateDraft',
  KPI_PUBLISH: 'kpi.publish',
  KPI_MANAGE_ALLOCATION: 'kpi.manageAllocation',
  KPI_ARCHIVE: 'kpi.archive',
  KPI_ENTER_ACTUAL: 'kpi.enterActual',
  KPI_CORRECT_ACTUAL: 'kpi.correctActual',
  KPI_READ_PROGRESS: 'kpi.readProgress',
  KPI_FINALIZE: 'kpi.finalize',
  REVENUE_LEDGER_READ: 'revenueLedger.read',
  REVENUE_LEDGER_CREATE: 'revenueLedger.create',
  REVENUE_LEDGER_UPDATE: 'revenueLedger.update',
  REVENUE_LEDGER_LOOKUP: 'revenueLedger.lookup',
  REVENUE_LEDGER_MANAGE_LIFECYCLE: 'revenueLedger.manageLifecycle',
  REVENUE_LEDGER_RECONCILE: 'revenueLedger.reconcile',
  COMMISSION_RULE_READ: 'commissionRule.read',
  COMMISSION_RULE_CREATE: 'commissionRule.create',
  COMMISSION_RULE_UPDATE: 'commissionRule.update',
  COMMISSION_RULE_LOOKUP: 'commissionRule.lookup',
  COMMISSION_RULE_MANAGE_LIFECYCLE: 'commissionRule.manageLifecycle',
  COMMISSION_SETTLEMENT_READ: 'commissionSettlement.read',
  COMMISSION_SETTLEMENT_CREATE: 'commissionSettlement.create',
  COMMISSION_SETTLEMENT_UPDATE: 'commissionSettlement.update',
  COMMISSION_SETTLEMENT_MANAGE_LIFECYCLE: 'commissionSettlement.manageLifecycle',
  DASHBOARD_LITE_READ: 'dashboardLite.read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

const scopeGrantsSchema = z
  .object({
    workSchedule: z.array(z.enum(['self', 'team', 'department', 'global'])).optional(),
    eventAssignment: z.array(z.enum(['global', 'managedGroup'])).optional(),
    contractRegistry: z.array(z.literal('global')).optional(),
    talentKpi: z.array(z.literal('global')).optional(),
    kpi: z.array(z.enum(['global', 'managedGroup', 'self'])).optional(),
    revenueLedger: z.array(z.literal('global')).optional(),
    commission: z.array(z.literal('global')).optional(),
    dashboardLite: z.array(z.literal('global')).optional(),
  })
  .strict();

export const currentActorCapabilitiesSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.enum(['admin', 'staff', 'customer', 'public', 'system']),
    context: z.literal('ADMIN'),
    isActive: z.boolean(),
    roles: z.array(z.string().trim().min(1)).optional(),
    permissions: z.array(z.string().trim().min(1)),
    scopeGrants: scopeGrantsSchema,
    generatedAt: z.string().trim().min(1).optional(),
  })
  .strict();

const currentActorCapabilitiesResponseSchema = z
  .object({
    data: currentActorCapabilitiesSchema,
  })
  .strict();

export type CurrentActorCapabilities = z.infer<typeof currentActorCapabilitiesSchema>;
export type ActorScopeGrantModule = keyof CurrentActorCapabilities['scopeGrants'];
export type ActorScopeGrantValue = NonNullable<
  CurrentActorCapabilities['scopeGrants'][ActorScopeGrantModule]
>[number];

export type CapabilityMissingReason = 'loading' | 'missing-permission' | 'missing-scope';

export type ActionCapabilityRequirement = {
  permission: PermissionCode;
  scope?: {
    module: ActorScopeGrantModule;
    value: ActorScopeGrantValue;
  };
};

export type ActionCapabilityCheck = {
  allowed: boolean;
  reason?: CapabilityMissingReason;
};

export type ActionCapabilityHint = {
  disabled: boolean;
  disabledReason?: string;
  hidden?: boolean;
};

export type CapabilityAwareActionItem = {
  id: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
};

export type CapabilityQueryState = {
  capabilities?: CurrentActorCapabilities;
  isLoading: boolean;
  isError?: boolean;
};

export const fetchCurrentActorCapabilities = async (): Promise<CurrentActorCapabilities> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/me/capabilities',
  });

  return currentActorCapabilitiesResponseSchema.parse(response).data;
};

export const useCurrentActorCapabilities = () =>
  useQuery({
    queryKey: CURRENT_ACTOR_CAPABILITIES_QUERY_KEY,
    queryFn: fetchCurrentActorCapabilities,
    retry: false,
  });

export const hasPermission = (
  capabilities: CurrentActorCapabilities | undefined,
  permission: PermissionCode,
): boolean => Boolean(capabilities?.permissions.includes(permission));

export const hasAnyPermission = (
  capabilities: CurrentActorCapabilities | undefined,
  permissions: readonly PermissionCode[],
): boolean => permissions.some((permission) => hasPermission(capabilities, permission));

export const hasAllPermissions = (
  capabilities: CurrentActorCapabilities | undefined,
  permissions: readonly PermissionCode[],
): boolean => permissions.every((permission) => hasPermission(capabilities, permission));

export const hasScopeGrant = (
  capabilities: CurrentActorCapabilities | undefined,
  module: ActorScopeGrantModule,
  value: ActorScopeGrantValue,
): boolean => {
  const grants = capabilities?.scopeGrants[module] as readonly string[] | undefined;
  return Boolean(grants?.includes(value));
};

export const hasAnyScopeGrant = (
  capabilities: CurrentActorCapabilities | undefined,
  module: ActorScopeGrantModule,
  values: readonly ActorScopeGrantValue[],
): boolean => values.some((value) => hasScopeGrant(capabilities, module, value));

export const hasEventAssignmentReadScope = (
  capabilities: CurrentActorCapabilities | undefined,
): boolean =>
  hasScopeGrant(capabilities, 'eventAssignment', 'global') ||
  hasScopeGrant(capabilities, 'eventAssignment', 'managedGroup');

export const canUseAction = (
  capabilities: CurrentActorCapabilities | undefined,
  requirement: ActionCapabilityRequirement,
): ActionCapabilityCheck => {
  if (!capabilities) {
    return { allowed: false, reason: 'missing-permission' };
  }

  if (!hasPermission(capabilities, requirement.permission)) {
    return { allowed: false, reason: 'missing-permission' };
  }

  if (
    requirement.scope &&
    !hasScopeGrant(capabilities, requirement.scope.module, requirement.scope.value)
  ) {
    return { allowed: false, reason: 'missing-scope' };
  }

  return { allowed: true };
};

export const canUseAnyAction = (
  capabilities: CurrentActorCapabilities | undefined,
  requirements: readonly ActionCapabilityRequirement[],
): ActionCapabilityCheck => {
  if (requirements.length === 0) {
    return { allowed: true };
  }

  const checks = requirements.map((requirement) => canUseAction(capabilities, requirement));
  const allowed = checks.find((check) => check.allowed);
  if (allowed) {
    return allowed;
  }

  return checks.find((check) => check.reason === 'missing-permission') ?? checks[0];
};

export const canShowAction = (
  capabilities: CurrentActorCapabilities | undefined,
  requirement: ActionCapabilityRequirement | readonly ActionCapabilityRequirement[],
): boolean => {
  const requirements = Array.isArray(requirement) ? requirement : [requirement];
  return canUseAnyAction(capabilities, requirements).allowed;
};

export const createActionCapabilityHint = (
  state: CapabilityQueryState,
  requirement: ActionCapabilityRequirement,
  copy: Record<CapabilityMissingReason, string>,
): ActionCapabilityHint => {
  if (state.isLoading && !state.capabilities) {
    return {
      disabled: true,
      disabledReason: copy.loading,
    };
  }

  if (state.isError || !state.capabilities) {
    return {
      disabled: true,
      disabledReason: copy['missing-permission'],
    };
  }

  const result = canUseAction(state.capabilities, requirement);
  if (result.allowed) {
    return { disabled: false };
  }

  return {
    disabled: true,
    disabledReason: copy[result.reason ?? 'missing-permission'],
    hidden: true,
  };
};

export const applyActionCapabilityHints = <TItem extends CapabilityAwareActionItem>(
  items: readonly TItem[],
  hints: Readonly<Record<string, ActionCapabilityHint | undefined>>,
): TItem[] =>
  items
    .map((item) => {
      const hint = hints[item.id];
      if (hint?.hidden) {
        return undefined;
      }

      if (item.disabled || item.disabledReason) {
        return item;
      }

      if (!hint?.disabled) {
        return item;
      }

      return {
        ...item,
        disabled: true,
        disabledReason: hint.disabledReason,
      };
    })
    .filter((item): item is TItem => Boolean(item));
