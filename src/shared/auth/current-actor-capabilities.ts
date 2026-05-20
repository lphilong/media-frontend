import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const CURRENT_ACTOR_CAPABILITIES_QUERY_KEY = ['current-actor-capabilities'] as const;

export const PERMISSIONS = {
  ROLE_UPDATE: 'role:update',
  ROLE_ACTIVATE: 'role:activate',
  ROLE_DEACTIVATE: 'role:deactivate',
  ROLE_ARCHIVE: 'role:archive',
  ROLE_PERMISSION_ASSIGN: 'role:permission:assign',
  ROLE_ASSIGNMENT_RULE_SET: 'role:assignment_rule:set',
  ROLE_ASSIGN_TO_USER: 'role:assign_to_user',
  ROLE_REVOKE_FROM_USER: 'role:revoke_from_user',
  USER_EDIT: 'user:edit',
  USER_ACTIVATE: 'user:activate',
  USER_DISABLE: 'user:disable',
  USER_ARCHIVE: 'user:archive',
  USER_AUTH_LINKAGE_SET: 'user:auth_linkage:set',
  REVENUE_LEDGER_UPDATE: 'revenueLedger.update',
  REVENUE_LEDGER_MANAGE_LIFECYCLE: 'revenueLedger.manageLifecycle',
  REVENUE_LEDGER_RECONCILE: 'revenueLedger.reconcile',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

const scopeGrantsSchema = z
  .object({
    workSchedule: z.array(z.enum(['self', 'team', 'department', 'global'])).optional(),
    eventAssignment: z.array(z.literal('global')).optional(),
    contractRegistry: z.array(z.literal('global')).optional(),
    talentKpi: z.array(z.literal('global')).optional(),
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

export const hasScopeGrant = (
  capabilities: CurrentActorCapabilities | undefined,
  module: ActorScopeGrantModule,
  value: ActorScopeGrantValue,
): boolean => {
  const grants = capabilities?.scopeGrants[module] as readonly string[] | undefined;
  return Boolean(grants?.includes(value));
};

export const canUseAction = (
  capabilities: CurrentActorCapabilities | undefined,
  requirement: ActionCapabilityRequirement,
): ActionCapabilityCheck => {
  if (!capabilities) {
    return { allowed: true };
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
    return { disabled: false };
  }

  const result = canUseAction(state.capabilities, requirement);
  if (result.allowed) {
    return { disabled: false };
  }

  return {
    disabled: true,
    disabledReason: copy[result.reason ?? 'missing-permission'],
  };
};

export const applyActionCapabilityHints = <TItem extends CapabilityAwareActionItem>(
  items: readonly TItem[],
  hints: Readonly<Record<string, ActionCapabilityHint | undefined>>,
): TItem[] =>
  items.map((item) => {
    if (item.disabled || item.disabledReason) {
      return item;
    }

    const hint = hints[item.id];
    if (!hint?.disabled) {
      return item;
    }

    return {
      ...item,
      disabled: true,
      disabledReason: hint.disabledReason,
    };
  });
