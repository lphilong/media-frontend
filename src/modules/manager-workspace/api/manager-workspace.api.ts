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

const workShiftsModuleSchema = z.union([
  z.object({ visible: z.literal(true) }).strict(),
  z
    .object({
      visible: z.literal(false),
      reason: z.enum(['NO_MANAGED_SCOPE_ASSIGNED', 'MISSING_WORK_SCHEDULE_READ_CAPABILITY']),
    })
    .strict(),
]);

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
        workShifts: workShiftsModuleSchema,
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

const managerWorkShiftSchema = z
  .object({
    workShiftId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    status: z.literal('ACTIVE'),
    shiftStartAt: z.number().int(),
    shiftEndAt: z.number().int(),
    timezone: z.literal('Asia/Ho_Chi_Minh'),
    sourceType: z.enum(['MANUAL', 'ROSTER_GENERATED']),
    sourceRosterMonth: z.string().trim().min(1).nullable(),
    member: z
      .object({
        employmentProfileId: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        employeeCode: z.string().trim().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const managerWorkShiftListResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(managerWorkShiftSchema),
        meta: z
          .object({
            month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
            timezone: z.literal('Asia/Ho_Chi_Minh'),
            managedMemberCount: z.number().int().nonnegative(),
            representedMemberCount: z.number().int().nonnegative(),
            returnedShiftCount: z.number().int().nonnegative(),
            nextCursor: z.string().trim().min(1).optional(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type ManagerWorkShiftList = z.infer<typeof managerWorkShiftListResponseSchema>['data'];

export const fetchManagerWorkShifts = async (month?: string): Promise<ManagerWorkShiftList> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/work-schedule/work-shifts',
    params: month ? { month } : undefined,
  });

  return managerWorkShiftListResponseSchema.parse(response).data;
};

export const useManagerWorkShifts = (month: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['manager-workspace', 'work-shifts', month ?? 'current'],
    queryFn: () => fetchManagerWorkShifts(month),
    enabled,
    retry: false,
  });

export const parseManagerWorkspaceContextForTest = (response: unknown): ManagerWorkspaceContext =>
  managerWorkspaceContextResponseSchema.parse(response).data;

export const parseManagerWorkShiftListForTest = (response: unknown): ManagerWorkShiftList =>
  managerWorkShiftListResponseSchema.parse(response).data;
