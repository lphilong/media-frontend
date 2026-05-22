import { z } from 'zod';

import {
  roleAssignmentStateValues,
  roleDelegationBandValues,
  roleMaxDelegatableBandValues,
  roleStateValues,
} from '@modules/role/constants/role.constants';
import type {
  CursorPagedResponse,
  RoleAssignToUserPayload,
  RoleAssignmentItem,
  RoleAssignmentListQuery,
  RoleAssignmentRuleReplacementPayload,
  RoleAssignmentScopeGrants,
  RoleCreateFromTemplatePayload,
  RoleCreatePayload,
  RoleDetailRecord,
  JsonPlainValue,
  RoleLifecycleAction,
  RoleLifecyclePayload,
  RoleListItem,
  RoleListQuery,
  RolePermissionMatrix,
  RolePermissionReplacementPayload,
  RoleRevokeAssignmentPayload,
  RoleTemplateListItem,
  RoleTemplatePreview,
  RoleUpdatePayload,
} from '@modules/role/types/role.types';
import { apiRequest } from '@shared/api';

const roleStateSchema = z.enum(roleStateValues);
const roleAssignmentStateSchema = z.enum(roleAssignmentStateValues);
const delegationBandSchema = z.enum(roleDelegationBandValues);
const maxDelegatableBandSchema = z.enum(roleMaxDelegatableBandValues);
const referenceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    handle: z.string().trim().min(1).optional(),
    platform: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
  })
  .strict();

const permissionSchema = z
  .object({
    code: z.string().trim().min(1),
  })
  .strict();

const roleTemplateCodeSchema = z.enum([
  'ADMIN_FULL',
  'HR_OPERATIONS',
  'TEAM_MANAGER',
  'PRODUCTION_OPS',
  'COMMERCIAL_FINANCE',
  'TALENT_STAFF_SELF',
  'VIEWER_AUDITOR',
]);

const roleTemplateStatusSchema = z.enum(['READY', 'PREVIEW_ONLY', 'REQUIRES_FUTURE_SCOPE']);

const roleTemplateScopePlanEntrySchema = z
  .object({
    module: z.string().trim().min(1),
    scopes: z.array(z.string().trim().min(1)),
    status: roleTemplateStatusSchema,
    note: z.string().trim().min(1),
  })
  .strict();

export const roleTemplateSchema = z
  .object({
    code: roleTemplateCodeSchema,
    version: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string(),
    category: z.string().trim().min(1),
    permissionCount: z.number().int().nonnegative(),
    permissions: z.array(permissionSchema).optional(),
    scopePlan: z.array(roleTemplateScopePlanEntrySchema),
    warnings: z.array(z.string()),
    implementationNotes: z.array(z.string()),
    status: roleTemplateStatusSchema,
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

const workScheduleScopeGrantSchema = z.enum(['self', 'team', 'department', 'global']);
const globalScopeGrantSchema = z.enum(['global']);

export const roleAssignmentScopeGrantsSchema = z
  .object({
    workSchedule: z.array(workScheduleScopeGrantSchema).optional(),
    eventAssignment: z.array(globalScopeGrantSchema).optional(),
    contractRegistry: z.array(globalScopeGrantSchema).optional(),
    talentKpi: z.array(globalScopeGrantSchema).optional(),
    revenueLedger: z.array(globalScopeGrantSchema).optional(),
    commission: z.array(globalScopeGrantSchema).optional(),
    dashboardLite: z.array(globalScopeGrantSchema).optional(),
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

const assignmentItemSchema = z
  .object({
    assignmentId: z.string().trim().min(1),
    roleId: z.string().trim().min(1),
    userId: z.string().trim().min(1),
    userRef: referenceSummarySchema.nullable().optional(),
    scopeGrants: roleAssignmentScopeGrantsSchema.nullable().optional(),
    state: roleAssignmentStateSchema,
    effectiveAt: z.union([z.number(), z.string()]),
    revokedAt: z.union([z.number(), z.string()]).nullable().optional(),
    reason: z.string().nullable().optional(),
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

const assignmentListResponseSchema = z
  .object({
    data: z.array(assignmentItemSchema),
    meta: cursorMetaSchema,
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

const sanitizeRoleListQuery = (
  query: RoleListQuery,
): Record<string, string | number | undefined> => ({
  state: query.state,
  cursor: query.cursor,
  limit: query.limit,
  search: query.search,
});

const sanitizeAssignmentListQuery = (
  query: RoleAssignmentListQuery,
): Record<string, string | number | undefined> => ({
  state: query.state,
  cursor: query.cursor,
  limit: query.limit,
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

export const fetchRoleAssignments = async (
  roleId: string,
  query: RoleAssignmentListQuery,
): Promise<CursorPagedResponse<RoleAssignmentItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/roles/${encodeURIComponent(roleId)}/assignments`,
    params: sanitizeAssignmentListQuery(query),
  });

  return assignmentListResponseSchema.parse(response);
};

export const assignRoleToUser = async (
  roleId: string,
  payload: RoleAssignToUserPayload,
): Promise<RoleAssignmentItem> => {
  const scopeGrants = normalizeScopeGrantsForPayload(payload.scopeGrants);
  const response = await apiRequest<unknown, RoleAssignToUserPayload>({
    method: 'POST',
    url: `/admin/roles/${encodeURIComponent(roleId)}/assignments`,
    data: {
      userId: payload.userId,
      reason: payload.reason ?? null,
      ...(scopeGrants ? { scopeGrants } : {}),
    },
  });

  return z.object({ data: assignmentItemSchema }).strict().parse(response).data;
};

export const revokeRoleAssignment = async (
  roleId: string,
  assignmentId: string,
  payload: RoleRevokeAssignmentPayload,
): Promise<RoleAssignmentItem> => {
  const response = await apiRequest<unknown, RoleRevokeAssignmentPayload>({
    method: 'POST',
    url: `/admin/roles/${encodeURIComponent(roleId)}/assignments/${encodeURIComponent(
      assignmentId,
    )}/revoke`,
    data: {
      reason: payload.reason ?? null,
    },
  });

  return z.object({ data: assignmentItemSchema }).strict().parse(response).data;
};

export const fetchRolePermissionMatrix = async (roleId: string): Promise<RolePermissionMatrix> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/roles/${encodeURIComponent(roleId)}/permission-matrix`,
  });

  return permissionMatrixResponseSchema.parse(response).data;
};

const normalizeScopeGrantsForPayload = (
  scopeGrants: RoleAssignmentScopeGrants | undefined,
): RoleAssignmentScopeGrants | undefined => {
  if (!scopeGrants) {
    return undefined;
  }

  const parsed = roleAssignmentScopeGrantsSchema.parse(scopeGrants);
  const normalized: RoleAssignmentScopeGrants = {};

  if ((parsed.workSchedule?.length ?? 0) > 0) {
    normalized.workSchedule = parsed.workSchedule;
  }
  if ((parsed.eventAssignment?.length ?? 0) > 0) {
    normalized.eventAssignment = parsed.eventAssignment;
  }
  if ((parsed.contractRegistry?.length ?? 0) > 0) {
    normalized.contractRegistry = parsed.contractRegistry;
  }
  if ((parsed.talentKpi?.length ?? 0) > 0) {
    normalized.talentKpi = parsed.talentKpi;
  }
  if ((parsed.revenueLedger?.length ?? 0) > 0) {
    normalized.revenueLedger = parsed.revenueLedger;
  }
  if ((parsed.commission?.length ?? 0) > 0) {
    normalized.commission = parsed.commission;
  }
  if ((parsed.dashboardLite?.length ?? 0) > 0) {
    normalized.dashboardLite = parsed.dashboardLite;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};
