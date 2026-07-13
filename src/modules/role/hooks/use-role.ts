import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import {
  applyAccessAssignment,
  createRole,
  createRoleFromTemplate,
  fetchAccessAssignmentsForUser,
  fetchAccessAssignmentTargets,
  fetchEffectiveAccess,
  fetchRoleBundles,
  fetchRoleDetail,
  fetchRolePermissionMatrix,
  fetchRoleTemplates,
  fetchRoles,
  performRoleLifecycleAction,
  previewAccessAssignment,
  previewRoleTemplate,
  replaceRoleAssignmentRules,
  replaceRolePermissions,
  revokeAccessAssignment,
  updateRole,
} from '@modules/role/api/role.api';
import type {
  AccessAssignmentRevokePayload,
  AccessAssignmentRequestPayload,
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
  effectiveAccess: (userId: string) => ['role', 'effective-access', userId] as const,
  templatePreview: (templateCode: string) => ['role', 'template-preview', templateCode] as const,
  permissionMatrix: (roleId: string) => ['role', 'permission-matrix', roleId] as const,
};

export const useRoleList = (query: RoleListQuery) => {
  return useQuery({
    queryKey: roleQueryKeys.list(query),
    queryFn: () => fetchRoles(query),
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
