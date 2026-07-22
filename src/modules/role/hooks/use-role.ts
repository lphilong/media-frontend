import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import {
  applyAccessAssignment,
  activateGovernanceSuccessor,
  createBreakGlassRequest,
  createRole,
  createRoleFromTemplate,
  decideAccessLifecycleGrace,
  decideAccessLifecycleReview,
  decideAccessLifecycleSuccessor,
  decideGovernanceSuccessor,
  fetchAccessAssignmentsForUser,
  fetchAccessLifecycleStatus,
  fetchAccessLifecyclePage,
  fetchAccessAssignmentTargets,
  fetchBreakGlassStatus,
  fetchBreakGlassPage,
  fetchGovernanceStatus,
  fetchEffectiveAccess,
  fetchRoleBundles,
  fetchRoleDetail,
  fetchRolePermissionMatrix,
  fetchRoleTemplates,
  fetchRoles,
  performRoleLifecycleAction,
  previewAccessAssignment,
  previewRoleTemplate,
  proposeGovernanceSuccessor,
  replaceRoleAssignmentRules,
  replaceRolePermissions,
  requestAccessLifecycleGrace,
  requestAccessLifecycleSuccessor,
  decideBreakGlassRequest,
  endBreakGlassActivation,
  reviewBreakGlassActivation,
  revokeAccessAssignment,
  updateRole,
} from '@modules/role/api/role.api';
import type {
  AccessAssignmentRevokePayload,
  AccessAssignmentRequestPayload,
  AccessLifecycleStatusView,
  BreakGlassStatusView,
  BreakGlassRequestPayload,
  RoleAssignmentRuleReplacementPayload,
  RoleCreateFromTemplatePayload,
  RoleCreatePayload,
  RoleLifecycleAction,
  RoleLifecyclePayload,
  RoleListQuery,
  RolePermissionReplacementPayload,
  RoleUpdatePayload,
} from '@modules/role/types/role.types';
import { roleFlatListQueryConfig } from '@modules/role';
import {
  CURRENT_ACTOR_CAPABILITIES_QUERY_KEY,
  type CurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';

const ROLE_QUERY_ROOT = ['role'] as const;
const USER_QUERY_ROOT = ['user'] as const;

const AUTHORITY_DEPENDENT_PROTECTED_QUERY_ROOTS = new Set<string>([
  'commission',
  'contract-registry',
  'dashboard-lite',
  'employment-profile',
  'employment-terms',
  'event-assignment',
  'kpi',
  'manager-workspace',
  'org-unit',
  'people-readiness',
  'platform-account',
  'responsibility',
  'revenue-ledger',
  'role',
  'self-service',
  'studio-resource',
  'talent',
  'talent-group',
  'user',
  'work-schedule',
]);

export type AuthorityReductionQueryClassification =
  | 'CURRENT_ACTOR_CAPABILITY'
  | 'PROTECTED_AUTHORITY_DEPENDENT'
  | 'RETAIN_UNCLASSIFIED';

export const classifyAuthorityReductionQuery = (
  queryKey: QueryKey,
): AuthorityReductionQueryClassification => {
  if (
    queryKey.length === CURRENT_ACTOR_CAPABILITIES_QUERY_KEY.length &&
    queryKey.every((part, index) => part === CURRENT_ACTOR_CAPABILITIES_QUERY_KEY[index])
  ) {
    return 'CURRENT_ACTOR_CAPABILITY';
  }

  const queryRoot = queryKey[0];
  return typeof queryRoot === 'string' && AUTHORITY_DEPENDENT_PROTECTED_QUERY_ROOTS.has(queryRoot)
    ? 'PROTECTED_AUTHORITY_DEPENDENT'
    : 'RETAIN_UNCLASSIFIED';
};

const toListQueryToken = (query: RoleListQuery): string =>
  serializeScreenQueryParams(query, roleFlatListQueryConfig).toString();

export const roleQueryKeys = {
  all: (): readonly ['role'] => ROLE_QUERY_ROOT,
  list: (query: RoleListQuery) => ['role', 'list', toListQueryToken(query)] as const,
  detail: (roleId: string) => ['role', 'detail', roleId] as const,
  templates: () => ['role', 'templates'] as const,
  bundles: () => ['role', 'bundles'] as const,
  accessAssignmentTargets: () => ['role', 'access-assignment-targets'] as const,
  accessAssignmentsForUser: (userId: string) => ['role', 'access-assignments', userId] as const,
  accessLifecycle: (userId?: string) => ['role', 'access-lifecycle', userId ?? 'all'] as const,
  effectiveAccess: (userId: string) => ['role', 'effective-access', userId] as const,
  governance: () => ['role', 'access-governance'] as const,
  breakGlass: () => ['role', 'break-glass'] as const,
  templatePreview: (templateCode: string) => ['role', 'template-preview', templateCode] as const,
  permissionMatrix: (roleId: string) => ['role', 'permission-matrix', roleId] as const,
};

export const useRoleList = (query: RoleListQuery, enabled = true) => {
  return useQuery({
    queryKey: roleQueryKeys.list(query),
    queryFn: () => fetchRoles(query),
    enabled,
  });
};

export const useRoleDetail = (roleId?: string) => {
  return useQuery({
    queryKey: roleId ? roleQueryKeys.detail(roleId) : [...ROLE_QUERY_ROOT, 'detail'],
    queryFn: () => fetchRoleDetail(roleId ?? ''),
    enabled: Boolean(roleId),
  });
};

export const useRoleTemplates = () => {
  return useQuery({
    queryKey: roleQueryKeys.templates(),
    queryFn: fetchRoleTemplates,
  });
};

export const useRoleBundles = () => {
  return useQuery({
    queryKey: roleQueryKeys.bundles(),
    queryFn: fetchRoleBundles,
  });
};

export const useAccessAssignmentTargets = () => {
  return useQuery({
    queryKey: roleQueryKeys.accessAssignmentTargets(),
    queryFn: fetchAccessAssignmentTargets,
  });
};

export const useEffectiveAccess = (userId?: string) => {
  return useQuery({
    queryKey: userId
      ? roleQueryKeys.effectiveAccess(userId)
      : [...ROLE_QUERY_ROOT, 'effective-access'],
    queryFn: () => fetchEffectiveAccess(userId ?? ''),
    enabled: Boolean(userId),
  });
};

export const useAccessAssignmentsForUser = (userId?: string) => {
  return useQuery({
    queryKey: userId
      ? roleQueryKeys.accessAssignmentsForUser(userId)
      : [...ROLE_QUERY_ROOT, 'access-assignments'],
    queryFn: () => fetchAccessAssignmentsForUser(userId ?? ''),
    enabled: Boolean(userId),
  });
};

export const useAccessGovernance = (enabled = true) =>
  useQuery({
    queryKey: roleQueryKeys.governance(),
    queryFn: fetchGovernanceStatus,
    enabled,
  });

export const useAccessLifecycleStatus = (targetUserId?: string, enabled = true) =>
  useQuery({
    queryKey: roleQueryKeys.accessLifecycle(targetUserId),
    queryFn: () => fetchAccessLifecycleStatus(targetUserId),
    enabled,
  });

export const useAccessLifecycleQueueLoadMore = (targetUserId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { queue: 'review' | 'grace' | 'successor'; cursor: string }) =>
      fetchAccessLifecyclePage({ targetUserId, ...input }),
    onSuccess: (next, input) => {
      queryClient.setQueryData<AccessLifecycleStatusView>(
        roleQueryKeys.accessLifecycle(targetUserId),
        (current) => (current ? mergeLifecycleQueue(current, next, input.queue) : next),
      );
    },
  });
};

export const useBreakGlassStatus = (enabled = true) =>
  useQuery({
    queryKey: roleQueryKeys.breakGlass(),
    queryFn: fetchBreakGlassStatus,
    enabled,
    refetchInterval: (query) => {
      const deadline = query.state.data?.nextAuthorityTransitionAt;
      return deadline ? Math.max(1_000, deadline - Date.now() + 250) : false;
    },
  });

export const useBreakGlassQueueLoadMore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { queue: 'approval' | 'independentReview'; cursor: string }) =>
      fetchBreakGlassPage(input),
    onSuccess: (next, input) => {
      queryClient.setQueryData<BreakGlassStatusView>(roleQueryKeys.breakGlass(), (current) =>
        current ? mergeBreakGlassQueue(current, next, input.queue) : next,
      );
    },
  });
};

export function mergeLifecycleQueue(
  current: AccessLifecycleStatusView,
  next: AccessLifecycleStatusView,
  queue: 'review' | 'grace' | 'successor',
): AccessLifecycleStatusView {
  if (queue === 'review') {
    return {
      ...current,
      reviewCycles: deduplicateBy(current.reviewCycles, next.reviewCycles, (item) => item.cycleId),
      pagination: { ...current.pagination, reviewCycles: next.pagination.reviewCycles },
    };
  }
  if (queue === 'grace') {
    return {
      ...current,
      graceExceptions: deduplicateBy(
        current.graceExceptions,
        next.graceExceptions,
        (item) => item.exceptionId,
      ),
      pagination: { ...current.pagination, graceExceptions: next.pagination.graceExceptions },
    };
  }
  return {
    ...current,
    successorRequests: deduplicateBy(
      current.successorRequests,
      next.successorRequests,
      (item) => item.requestId,
    ),
    pagination: { ...current.pagination, successorRequests: next.pagination.successorRequests },
  };
}

export function mergeBreakGlassQueue(
  current: BreakGlassStatusView,
  next: BreakGlassStatusView,
  queue: 'approval' | 'independentReview',
): BreakGlassStatusView {
  return queue === 'approval'
    ? {
        ...current,
        requests: deduplicateBy(current.requests, next.requests, (item) => item.requestId),
        pagination: { ...current.pagination, requests: next.pagination.requests },
      }
    : {
        ...current,
        activations: deduplicateBy(
          current.activations,
          next.activations,
          (item) => item.activationId,
        ),
        pagination: { ...current.pagination, activations: next.pagination.activations },
      };
}

function deduplicateBy<T>(
  current: readonly T[],
  next: readonly T[],
  identity: (item: T) => string,
): T[] {
  const seen = new Set(current.map(identity));
  return [...current, ...next.filter((item) => !seen.has(identity(item)))];
}

export const useRoleTemplatePreview = (templateCode?: string) => {
  return useQuery({
    queryKey: templateCode
      ? roleQueryKeys.templatePreview(templateCode)
      : [...ROLE_QUERY_ROOT, 'template-preview'],
    queryFn: () => previewRoleTemplate(templateCode ?? ''),
    enabled: Boolean(templateCode),
  });
};

export const useRolePermissionMatrix = (roleId?: string) => {
  return useQuery({
    queryKey: roleId
      ? roleQueryKeys.permissionMatrix(roleId)
      : [...ROLE_QUERY_ROOT, 'permission-matrix'],
    queryFn: () => fetchRolePermissionMatrix(roleId ?? ''),
    enabled: Boolean(roleId),
  });
};

const invalidateRoleLaneQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: ROLE_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: USER_QUERY_ROOT });
};

const currentActorId = (queryClient: ReturnType<typeof useQueryClient>): string | undefined =>
  queryClient.getQueryData<CurrentActorCapabilities>(CURRENT_ACTOR_CAPABILITIES_QUERY_KEY)?.id;

const invalidateCurrentActorCapabilities = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await queryClient.invalidateQueries({
    queryKey: CURRENT_ACTOR_CAPABILITIES_QUERY_KEY,
    exact: true,
  });
};

const clearProtectedQueryData = (queryClient: ReturnType<typeof useQueryClient>): void => {
  queryClient.removeQueries({
    predicate: (query) =>
      classifyAuthorityReductionQuery(query.queryKey) === 'PROTECTED_AUTHORITY_DEPENDENT',
  });
};

const invalidateRoleCatalogAndCurrentActor = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await invalidateRoleLaneQueries(queryClient);
  await invalidateCurrentActorCapabilities(queryClient);
};

export const useCreateRoleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RoleCreatePayload) => createRole(payload),
    onSuccess: async () => {
      await invalidateRoleCatalogAndCurrentActor(queryClient);
    },
  });
};

export const useCreateRoleFromTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RoleCreateFromTemplatePayload) => createRoleFromTemplate(payload),
    onSuccess: async () => {
      await invalidateRoleCatalogAndCurrentActor(queryClient);
    },
  });
};

export const useUpdateRoleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: RoleUpdatePayload }) =>
      updateRole(roleId, payload),
    onSuccess: async () => {
      await invalidateRoleCatalogAndCurrentActor(queryClient);
    },
  });
};

export const useRoleLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      action,
      payload,
    }: {
      roleId: string;
      action: RoleLifecycleAction;
      payload?: RoleLifecyclePayload;
    }) => performRoleLifecycleAction(roleId, action, payload),
    onSuccess: async (_result, variables) => {
      await invalidateRoleCatalogAndCurrentActor(queryClient);
      if (variables.action !== 'activate') {
        clearProtectedQueryData(queryClient);
      }
    },
  });
};

export const useRolePermissionReplacementMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      payload,
    }: {
      roleId: string;
      payload: RolePermissionReplacementPayload;
    }) => replaceRolePermissions(roleId, payload),
    onSuccess: async () => {
      await invalidateRoleCatalogAndCurrentActor(queryClient);
      clearProtectedQueryData(queryClient);
    },
  });
};

export const useRoleAssignmentRuleReplacementMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      payload,
    }: {
      roleId: string;
      payload: RoleAssignmentRuleReplacementPayload;
    }) => replaceRoleAssignmentRules(roleId, payload),
    onSuccess: async () => {
      await invalidateRoleCatalogAndCurrentActor(queryClient);
      clearProtectedQueryData(queryClient);
    },
  });
};

export const useAccessAssignmentRevokeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: AccessAssignmentRevokePayload;
    }) => revokeAccessAssignment(assignmentId, payload),
    onSuccess: async (result) => {
      await invalidateRoleLaneQueries(queryClient);
      const targetUserId = result.assignment?.targetUserId;
      if (targetUserId) {
        await queryClient.invalidateQueries({
          queryKey: roleQueryKeys.effectiveAccess(targetUserId),
        });
        await queryClient.invalidateQueries({
          queryKey: roleQueryKeys.accessAssignmentsForUser(targetUserId),
        });
      }
      const actorId = currentActorId(queryClient);
      if (!actorId || !targetUserId || actorId === targetUserId) {
        await invalidateCurrentActorCapabilities(queryClient);
        clearProtectedQueryData(queryClient);
      }
    },
  });
};

export const useAccessAssignmentPreviewMutation = () => {
  return useMutation({
    mutationFn: (payload: AccessAssignmentRequestPayload) => previewAccessAssignment(payload),
  });
};

export const useAccessAssignmentApplyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AccessAssignmentRequestPayload) => applyAccessAssignment(payload),
    onSuccess: async (_result, payload) => {
      await invalidateRoleLaneQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: roleQueryKeys.effectiveAccess(payload.targetUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: roleQueryKeys.accessAssignmentsForUser(payload.targetUserId),
      });
      const actorId = currentActorId(queryClient);
      if (!actorId || actorId === payload.targetUserId) {
        await invalidateCurrentActorCapabilities(queryClient);
      }
    },
  });
};

const invalidateBreakGlassAuthority = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: roleQueryKeys.breakGlass() });
  await invalidateCurrentActorCapabilities(queryClient);
  clearProtectedQueryData(queryClient);
};

export const useBreakGlassRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BreakGlassRequestPayload) => createBreakGlassRequest(payload),
    onSuccess: async () => invalidateBreakGlassAuthority(queryClient),
  });
};

export const useBreakGlassDecisionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decideBreakGlassRequest,
    onSuccess: async () => invalidateBreakGlassAuthority(queryClient),
  });
};

export const useBreakGlassReviewMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewBreakGlassActivation,
    onSuccess: async () => invalidateBreakGlassAuthority(queryClient),
  });
};

export const useBreakGlassEndMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: endBreakGlassActivation,
    onSuccess: async () => invalidateBreakGlassAuthority(queryClient),
  });
};

const invalidateAccessGovernance = async (
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: ['role', 'access-lifecycle'] });
  await queryClient.invalidateQueries({ queryKey: roleQueryKeys.governance() });
  await invalidateRoleLaneQueries(queryClient);
  await invalidateCurrentActorCapabilities(queryClient);
  clearProtectedQueryData(queryClient);
};

export const useAccessLifecycleReviewMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decideAccessLifecycleReview,
    onSuccess: async () => invalidateAccessGovernance(queryClient),
  });
};

export const useAccessLifecycleGraceRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestAccessLifecycleGrace,
    onSuccess: async () => invalidateAccessGovernance(queryClient),
  });
};

export const useAccessLifecycleGraceDecisionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decideAccessLifecycleGrace,
    onSuccess: async () => invalidateAccessGovernance(queryClient),
  });
};

export const useAccessLifecycleSuccessorRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestAccessLifecycleSuccessor,
    onSuccess: async () => invalidateAccessGovernance(queryClient),
  });
};

export const useAccessLifecycleSuccessorDecisionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decideAccessLifecycleSuccessor,
    onSuccess: async () => invalidateAccessGovernance(queryClient),
  });
};

export const useGovernanceSuccessorProposalMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: proposeGovernanceSuccessor,
    onSuccess: async () => invalidateAccessGovernance(queryClient),
  });
};

export const useGovernanceSuccessorDecisionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decideGovernanceSuccessor,
    onSuccess: async () => invalidateAccessGovernance(queryClient),
  });
};

export const useGovernanceSuccessorActivationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateGovernanceSuccessor,
    onSuccess: async () => invalidateAccessGovernance(queryClient),
  });
};
