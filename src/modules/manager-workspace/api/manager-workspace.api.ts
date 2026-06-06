import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const MANAGER_WORKSPACE_CONTEXT_QUERY_KEY = ['manager-workspace', 'context'] as const;
const MANAGER_REQUEST_BATCHES_QUERY_KEY = ['manager-workspace', 'work-schedule', 'request-batches'] as const;

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

const requestTypeSchema = z.enum(['CREATE_SHIFT', 'RESCHEDULE_SHIFT', 'CANCEL_SHIFT']);
const requestBatchStatusSchema = z.enum([
  'PENDING',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);
const requestLineStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'FAILED_TO_APPLY',
]);
const requestScopeSummarySchema = z.enum(['ORG_UNIT', 'TALENT_GROUP', 'MIXED']);
const requestLineCountsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    failedToApply: z.number().int().nonnegative(),
  })
  .strict();

const referenceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
  })
  .strict();

const managerRequestBatchListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    batchCode: z.string().trim().min(1),
    status: requestBatchStatusSchema,
    periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    scopeSummary: requestScopeSummarySchema,
    note: z.string().nullable(),
    lineCounts: requestLineCountsSchema,
    clientToken: z.string().trim().min(1),
    submittedAt: z.number().int(),
    cancelledAt: z.number().int().nullable(),
    resolvedAt: z.number().int().nullable(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict();

const managerRequestBatchLineSchema = z
  .object({
    id: z.string().trim().min(1),
    lineNo: z.number().int().positive(),
    requestType: requestTypeSchema,
    status: requestLineStatusSchema,
    member: z
      .object({
        employmentProfileId: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        employeeCode: z.string().trim().min(1).optional(),
      })
      .strict(),
    workShiftId: z.string().nullable(),
    workShiftRef: referenceSummarySchema.nullable().optional(),
    requestedStartAt: z.number().int().nullable(),
    requestedEndAt: z.number().int().nullable(),
    timezone: z.literal('Asia/Ho_Chi_Minh'),
    title: z.string().nullable(),
    description: z.string().nullable(),
    externalRef: z.string().nullable(),
    reason: z.string().trim().min(1),
    approvalNote: z.string().nullable(),
    rejectionReason: z.string().nullable(),
    cancellationReason: z.string().nullable(),
    failureReason: z.string().nullable(),
    appliedWorkShiftId: z.string().nullable(),
    appliedWorkShiftRef: referenceSummarySchema.nullable().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    approvedAt: z.number().int().nullable(),
    rejectedAt: z.number().int().nullable(),
    cancelledAt: z.number().int().nullable(),
    failedAt: z.number().int().nullable(),
  })
  .strict();

const managerRequestBatchDetailSchema = managerRequestBatchListItemSchema
  .extend({
    lines: z.array(managerRequestBatchLineSchema),
  })
  .strict();

const managerRequestBatchListResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(managerRequestBatchListItemSchema),
        nextCursor: z.string().trim().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const managerRequestBatchDetailResponseSchema = z
  .object({
    data: managerRequestBatchDetailSchema,
  })
  .strict();

export type ManagerWorkScheduleRequestType = z.infer<typeof requestTypeSchema>;
export type ManagerRequestBatchListItem = z.infer<typeof managerRequestBatchListItemSchema>;
export type ManagerRequestBatchDetail = z.infer<typeof managerRequestBatchDetailSchema>;
export type ManagerRequestBatchLine = z.infer<typeof managerRequestBatchLineSchema>;
export type ManagerRequestBatchList = z.infer<typeof managerRequestBatchListResponseSchema>['data'];

export type ManagerSubmitRequestBatchLinePayload = {
  requestType: ManagerWorkScheduleRequestType;
  memberEmploymentProfileId: string;
  workShiftId?: string | null;
  requestedStartAt?: number | null;
  requestedEndAt?: number | null;
  timezone?: 'Asia/Ho_Chi_Minh' | null;
  title?: string | null;
  description?: string | null;
  externalRef?: string | null;
  reason: string;
};

export type ManagerSubmitRequestBatchPayload = {
  periodMonth: string;
  clientToken: string;
  note?: string | null;
  lines: ManagerSubmitRequestBatchLinePayload[];
};

export type ManagerCancelRequestPayload = {
  cancellationReason: string;
};

const sanitizeNullableText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

const sanitizeSubmitRequestBatchPayload = (
  payload: ManagerSubmitRequestBatchPayload,
): ManagerSubmitRequestBatchPayload => ({
  periodMonth: payload.periodMonth.trim(),
  clientToken: payload.clientToken.trim(),
  ...(payload.note !== undefined ? { note: sanitizeNullableText(payload.note) } : {}),
  lines: payload.lines.map((line) => ({
    requestType: line.requestType,
    memberEmploymentProfileId: line.memberEmploymentProfileId.trim(),
    ...(line.workShiftId !== undefined ? { workShiftId: sanitizeNullableText(line.workShiftId) } : {}),
    ...(line.requestedStartAt !== undefined ? { requestedStartAt: line.requestedStartAt } : {}),
    ...(line.requestedEndAt !== undefined ? { requestedEndAt: line.requestedEndAt } : {}),
    ...(line.timezone !== undefined ? { timezone: line.timezone } : {}),
    ...(line.title !== undefined ? { title: sanitizeNullableText(line.title) } : {}),
    ...(line.description !== undefined ? { description: sanitizeNullableText(line.description) } : {}),
    ...(line.externalRef !== undefined ? { externalRef: sanitizeNullableText(line.externalRef) } : {}),
    reason: line.reason.trim(),
  })),
});

export const fetchManagerRequestBatches = async (
  query: { status?: string; periodMonth?: string } = {},
): Promise<ManagerRequestBatchList> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/work-schedule/request-batches',
    params: Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
    ),
  });

  return managerRequestBatchListResponseSchema.parse(response).data;
};

export const fetchManagerRequestBatchDetail = async (
  batchId: string,
): Promise<ManagerRequestBatchDetail> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/manager-workspace/work-schedule/request-batches/${encodeURIComponent(batchId)}`,
  });

  return managerRequestBatchDetailResponseSchema.parse(response).data;
};

export const submitManagerRequestBatch = async (
  payload: ManagerSubmitRequestBatchPayload,
): Promise<ManagerRequestBatchDetail> => {
  const response = await apiRequest<unknown, ManagerSubmitRequestBatchPayload>({
    method: 'POST',
    url: '/admin/manager-workspace/work-schedule/request-batches',
    data: sanitizeSubmitRequestBatchPayload(payload),
  });

  return managerRequestBatchDetailResponseSchema.parse(response).data;
};

export const cancelManagerRequestBatch = async (
  batchId: string,
  payload: ManagerCancelRequestPayload,
): Promise<ManagerRequestBatchDetail> => {
  const response = await apiRequest<unknown, ManagerCancelRequestPayload>({
    method: 'POST',
    url: `/admin/manager-workspace/work-schedule/request-batches/${encodeURIComponent(batchId)}/cancel`,
    data: { cancellationReason: payload.cancellationReason.trim() },
  });

  return managerRequestBatchDetailResponseSchema.parse(response).data;
};

export const cancelManagerRequestLine = async (
  batchId: string,
  lineId: string,
  payload: ManagerCancelRequestPayload,
): Promise<ManagerRequestBatchDetail> => {
  const response = await apiRequest<unknown, ManagerCancelRequestPayload>({
    method: 'POST',
    url: `/admin/manager-workspace/work-schedule/request-batches/${encodeURIComponent(
      batchId,
    )}/lines/${encodeURIComponent(lineId)}/cancel`,
    data: { cancellationReason: payload.cancellationReason.trim() },
  });

  return managerRequestBatchDetailResponseSchema.parse(response).data;
};

export const useManagerRequestBatches = (
  query: { status?: string; periodMonth?: string },
  enabled: boolean,
) =>
  useQuery({
    queryKey: [...MANAGER_REQUEST_BATCHES_QUERY_KEY, query.status ?? 'all', query.periodMonth ?? 'all'],
    queryFn: () => fetchManagerRequestBatches(query),
    enabled,
    retry: false,
  });

export const useManagerRequestBatchDetail = (batchId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: [...MANAGER_REQUEST_BATCHES_QUERY_KEY, 'detail', batchId ?? 'none'],
    queryFn: () => fetchManagerRequestBatchDetail(batchId ?? ''),
    enabled: Boolean(batchId) && enabled,
    retry: false,
  });

const invalidateManagerRequestBatches = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: MANAGER_REQUEST_BATCHES_QUERY_KEY });
};

export const useSubmitManagerRequestBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }: { payload: ManagerSubmitRequestBatchPayload }) =>
      submitManagerRequestBatch(payload),
    onSuccess: async () => {
      await invalidateManagerRequestBatches(queryClient);
    },
  });
};

export const useCancelManagerRequestBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: ManagerCancelRequestPayload;
    }) => cancelManagerRequestBatch(batchId, payload),
    onSuccess: async () => {
      await invalidateManagerRequestBatches(queryClient);
    },
  });
};

export const useCancelManagerRequestLineMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      lineId,
      payload,
    }: {
      batchId: string;
      lineId: string;
      payload: ManagerCancelRequestPayload;
    }) => cancelManagerRequestLine(batchId, lineId, payload),
    onSuccess: async () => {
      await invalidateManagerRequestBatches(queryClient);
    },
  });
};

export const parseManagerWorkspaceContextForTest = (response: unknown): ManagerWorkspaceContext =>
  managerWorkspaceContextResponseSchema.parse(response).data;

export const parseManagerWorkShiftListForTest = (response: unknown): ManagerWorkShiftList =>
  managerWorkShiftListResponseSchema.parse(response).data;
