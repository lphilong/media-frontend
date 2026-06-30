import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  applyAccessAssignment,
  assignRoleToUser,
  createRole,
  createRoleFromTemplate,
  fetchAccessAssignmentTargets,
  fetchEffectiveAccess,
  fetchRoleBundles,
  fetchRoleAssignments,
  fetchRoleDetail,
  fetchRolePermissionMatrix,
  fetchRoleTemplates,
  fetchRoles,
  performRoleLifecycleAction,
  previewAccessAssignment,
  previewRoleTemplate,
  replaceRoleAssignmentRules,
  replaceRolePermissions,
  revokeRoleAssignment,
  updateRole,
} from '@modules/role/api/role.api';
import type {
  RoleAssignmentListQuery,
  AccessAssignmentRequestPayload,
  RoleAssignmentRuleReplacementPayload,
  RoleAssignToUserPayload,
  RoleCreateFromTemplatePayload,
  RoleCreatePayload,
  RoleLifecycleAction,
  RoleLifecyclePayload,
  RoleListQuery,
  RolePermissionReplacementPayload,
  RoleRevokeAssignmentPayload,
  RoleUpdatePayload,
} from '@modules/role/types/role.types';
import {
  roleAssignmentListQueryConfig,
  roleFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

const ROLE_QUERY_ROOT = ['role'] as const;
const USER_QUERY_ROOT = ['user'] as const;

const toListQueryToken = (query: RoleListQuery): string =>
  serializeScreenQueryParams(query, roleFlatListQueryConfig).toString();

const toAssignmentListQueryToken = (query: RoleAssignmentListQuery): string =>
  serializeScreenQueryParams(query, roleAssignmentListQueryConfig).toString();

export const roleQueryKeys = {
  all: (): readonly ['role'] => ROLE_QUERY_ROOT,
  list: (query: RoleListQuery) => ['role', 'list', toListQueryToken(query)] as const,
  detail: (roleId: string) => ['role', 'detail', roleId] as const,
  templates: () => ['role', 'templates'] as const,
  bundles: () => ['role', 'bundles'] as const,
  accessAssignmentTargets: () => ['role', 'access-assignment-targets'] as const,
  effectiveAccess: (userId: string) => ['role', 'effective-access', userId] as const,
  templatePreview: (templateCode: string) => ['role', 'template-preview', templateCode] as const,
  assignments: (roleId: string, query: RoleAssignmentListQuery) =>
    ['role', 'assignments', roleId, toAssignmentListQueryToken(query)] as const,
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
    queryKey: userId ? roleQueryKeys.effectiveAccess(userId) : [...ROLE_QUERY_ROOT, 'effective-access'],
    queryFn: () => fetchEffectiveAccess(userId ?? ''),
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

export const useRoleAssignments = (roleId: string | undefined, query: RoleAssignmentListQuery) => {
  return useQuery({
    queryKey: roleId
      ? roleQueryKeys.assignments(roleId, query)
      : [...ROLE_QUERY_ROOT, 'assignments'],
    queryFn: () => fetchRoleAssignments(roleId ?? '', query),
    enabled: Boolean(roleId),
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

export const useCreateRoleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RoleCreatePayload) => createRole(payload),
    onSuccess: async () => {
      await invalidateRoleLaneQueries(queryClient);
    },
  });
};

export const useCreateRoleFromTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RoleCreateFromTemplatePayload) => createRoleFromTemplate(payload),
    onSuccess: async () => {
      await invalidateRoleLaneQueries(queryClient);
    },
  });
};

export const useUpdateRoleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: RoleUpdatePayload }) =>
      updateRole(roleId, payload),
    onSuccess: async () => {
      await invalidateRoleLaneQueries(queryClient);
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
    onSuccess: async () => {
      await invalidateRoleLaneQueries(queryClient);
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
      await invalidateRoleLaneQueries(queryClient);
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
      await invalidateRoleLaneQueries(queryClient);
    },
  });
};

export const useRoleAssignToUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, payload }: { roleId: string; payload: RoleAssignToUserPayload }) =>
      assignRoleToUser(roleId, payload),
    onSuccess: async () => {
      await invalidateRoleLaneQueries(queryClient);
    },
  });
};

export const useRoleRevokeAssignmentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      roleId,
      assignmentId,
      payload,
    }: {
      roleId: string;
      assignmentId: string;
      payload: RoleRevokeAssignmentPayload;
    }) => revokeRoleAssignment(roleId, assignmentId, payload),
    onSuccess: async () => {
      await invalidateRoleLaneQueries(queryClient);
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
    },
  });
};
