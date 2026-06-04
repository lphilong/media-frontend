import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const MANAGER_WORKSPACE_CONTEXT_QUERY_KEY = ['manager-workspace', 'context'] as const;

const referenceNameSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
  })
  .strict();

const kpiCapabilitiesSchema = z
  .object({
    read: z.boolean(),
    manageAllocation: z.boolean(),
    enterActual: z.boolean(),
    correctActual: z.boolean(),
    finalize: z.literal(false),
  })
  .strict();

const orgUnitScopeSchema = referenceNameSchema
  .extend({
    orgUnitId: z.string().trim().min(1),
    role: z.enum(['DEPARTMENT_OWNER', 'UNIT_MANAGER', 'UNIT_OPERATOR']),
    includeDescendants: z.boolean(),
    isPrimary: z.boolean().optional(),
    capabilities: z.object({ kpi: kpiCapabilitiesSchema }).strict(),
  })
  .strict();

const talentGroupScopeSchema = referenceNameSchema
  .extend({
    talentGroupId: z.string().trim().min(1),
    capabilities: z.object({ kpi: kpiCapabilitiesSchema }).strict(),
  })
  .strict();

const disabledModuleSchema = z
  .object({
    visible: z.literal(false),
    reason: z.literal('NOT_ENABLED_IN_MANAGER_WORKSPACE_YET'),
  })
  .strict();

export const managerWorkspaceContextSchema = z
  .object({
    actor: z
      .object({
        id: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
      })
      .strict(),
    employmentProfile: z
      .object({
        id: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        employeeCode: z.string().trim().min(1).optional(),
        employmentStatus: z.string().trim().min(1).optional(),
        orgUnitId: z.string().trim().min(1).optional(),
      })
      .strict()
      .nullable(),
    readiness: z
      .object({
        canUseManagerWorkspace: z.boolean(),
        reasons: z.array(z.string().trim().min(1)),
      })
      .strict(),
    scopes: z
      .object({
        orgUnits: z.array(orgUnitScopeSchema),
        talentGroups: z.array(talentGroupScopeSchema),
      })
      .strict(),
    modules: z
      .object({
        kpi: z
          .object({
            visible: z.boolean(),
            unitKpiVisible: z.boolean(),
            talentGroupKpiVisible: z.boolean(),
          })
          .strict(),
        workShifts: disabledModuleSchema,
        events: disabledModuleSchema,
        members: disabledModuleSchema,
      })
      .strict(),
  })
  .strict();

const managerWorkspaceContextResponseSchema = z
  .object({
    data: managerWorkspaceContextSchema,
  })
  .strict();

export type ManagerWorkspaceContext = z.infer<typeof managerWorkspaceContextSchema>;
export type ManagerWorkspaceOrgUnitScope = ManagerWorkspaceContext['scopes']['orgUnits'][number];
export type ManagerWorkspaceTalentGroupScope =
  ManagerWorkspaceContext['scopes']['talentGroups'][number];

export const fetchManagerWorkspaceContext = async (): Promise<ManagerWorkspaceContext> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/context',
  });

  return managerWorkspaceContextResponseSchema.parse(response).data;
};

export const useManagerWorkspaceContext = () =>
  useQuery({
    queryKey: MANAGER_WORKSPACE_CONTEXT_QUERY_KEY,
    queryFn: fetchManagerWorkspaceContext,
    retry: false,
  });

export const parseManagerWorkspaceContextForTest = (response: unknown): ManagerWorkspaceContext =>
  managerWorkspaceContextResponseSchema.parse(response).data;
