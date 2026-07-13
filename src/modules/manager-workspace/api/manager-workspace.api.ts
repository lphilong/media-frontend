import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';
import { classifyManagerEventError } from '@modules/manager-workspace/manager-event-error';

export const MANAGER_WORKSPACE_CONTEXT_QUERY_KEY = ['manager-workspace', 'context'] as const;
const MANAGER_REQUEST_BATCHES_QUERY_KEY = [
  'manager-workspace',
  'work-schedule',
  'request-batches',
] as const;
const MANAGER_AVAILABILITY_BATCHES_QUERY_KEY = [
  'manager-workspace',
  'work-schedule',
  'availability-batches',
] as const;
const MANAGER_AVAILABILITY_MEMBERS_QUERY_KEY = [
  'manager-workspace',
  'work-schedule',
  'availability-members',
] as const;
const MANAGER_EVENTS_QUERY_KEY = ['manager-workspace', 'events'] as const;
const MANAGER_REVENUE_QUERY_KEY = ['manager-workspace', 'revenue-source'] as const;

const retryManagerEventsQuery = (failureCount: number, error: unknown): boolean =>
  classifyManagerEventError(error).retryable && failureCount < 1;

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
      reason: z.enum([
        'NO_MANAGED_SCOPE_ASSIGNED',
        'NO_MANAGER_RESPONSIBILITY_ASSIGNED',
        'NO_STRUCTURED_SCOPE_ASSIGNED',
        'MISSING_WORK_SCHEDULE_READ_CAPABILITY',
      ]),
    })
    .strict(),
]);

const eventsModuleSchema = z.union([
  z.object({ visible: z.literal(true) }).strict(),
  z
    .object({
      visible: z.literal(false),
      reason: z.enum([
        'NO_MANAGED_SCOPE_ASSIGNED',
        'NO_MANAGER_RESPONSIBILITY_ASSIGNED',
        'NO_STRUCTURED_SCOPE_ASSIGNED',
        'MISSING_EVENT_READ_CAPABILITY',
      ]),
    })
    .strict(),
]);

const revenueSourceModuleSchema = z.union([
  z.object({ visible: z.literal(true) }).strict(),
  z
    .object({
      visible: z.literal(false),
      reason: z.enum([
        'NO_MANAGED_SCOPE_ASSIGNED',
        'NO_MANAGER_RESPONSIBILITY_ASSIGNED',
        'NO_STRUCTURED_SCOPE_ASSIGNED',
        'MISSING_TALENT_GROUP_PREREQUISITE',
        'MISSING_REVENUE_SOURCE_SUBMIT_CAPABILITY',
      ]),
    })
    .strict(),
]);

const eventStatusSchema = z.enum([
  'DRAFT',
  'PLANNED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);
const studioBookingStatusSchema = z.enum(['HELD', 'CONFIRMED', 'RELEASED', 'CANCELLED']);
const completionEvidenceRefTypeSchema = z.enum([
  'URL',
  'PLATFORM_REFERENCE',
  'EXTERNAL_REFERENCE',
  'INTERNAL_REFERENCE',
]);
const timestampSchema = z.union([z.number(), z.string()]);
const managerEventReferenceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    displayName: z.string().optional(),
    status: z.string().trim().min(1).optional(),
  })
  .strict();

const completionEvidenceRefSchema = z
  .object({
    type: completionEvidenceRefTypeSchema,
    label: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    referenceId: z.string().nullable().optional(),
  })
  .strict();

const completionEvidenceSchema = z
  .object({
    completedAt: timestampSchema.nullable().optional(),
    completedByActorId: z.string().nullable().optional(),
    evidenceNote: z.string().nullable().optional(),
    evidenceRefs: z.array(completionEvidenceRefSchema),
  })
  .strict();

const managerEventSchema = z
  .object({
    id: z.string().trim().min(1),
    eventCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    status: eventStatusSchema,
    eventStartAt: timestampSchema,
    eventEndAt: timestampSchema,
    owner: managerEventReferenceSummarySchema.nullable(),
    participants: z.array(managerEventReferenceSummarySchema),
    completionEvidence: completionEvidenceSchema.nullable().optional(),
    studioBookings: z.array(
      z
        .object({
          id: z.string().trim().min(1),
          status: studioBookingStatusSchema,
          bookingStartAt: timestampSchema,
          bookingEndAt: timestampSchema,
          resource: managerEventReferenceSummarySchema.nullable(),
        })
        .strict(),
    ),
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
        workShifts: workShiftsModuleSchema,
        events: eventsModuleSchema,
        revenueSource: revenueSourceModuleSchema,
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
export type ManagerEventSummary = z.infer<typeof managerEventSchema>;

const managerPlatformEarningStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'VOIDED',
  'ARCHIVED',
]);

const managerPlatformEarningMemberSchema = z
  .object({
    employmentProfileId: z.string().trim().min(1),
    talentId: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    employeeCode: z.string().trim().min(1).optional(),
    talentGroupId: z.string().trim().min(1),
  })
  .strict();

const managerPlatformEarningScopeSchema = z
  .object({
    talentGroups: z.array(
      z
        .object({
          talentGroupId: z.string().trim().min(1),
          members: z.array(managerPlatformEarningMemberSchema),
        })
        .strict(),
    ),
    platformAccounts: z.array(
      z
        .object({
          id: z.string().trim().min(1),
          accountCode: z.string().trim().min(1),
          displayName: z.string().trim().min(1),
          platform: z.string().trim().min(1),
          handle: z.string().nullable(),
          ownerTalentGroupId: z.string().trim().min(1),
        })
        .strict(),
    ),
  })
  .strict();

const managerPlatformEarningBatchSchema = z
  .object({
    id: z.string().trim().min(1),
    batchCode: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    platformAccountId: z.string().trim().min(1),
    talentGroupId: z.string().trim().min(1),
    sourceType: z.literal('TIKTOK_LIVESTREAM_DIAMOND'),
    sourceUnit: z.literal('DIAMOND'),
    periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    sourceDateFrom: z.number().int(),
    sourceDateTo: z.number().int(),
    status: managerPlatformEarningStatusSchema,
    sourceLineCount: z.number().int().nonnegative(),
    rawQuantityTotal: z.number(),
    submittedAt: z.number().int().nullable(),
    rejectedAt: z.number().int().nullable(),
    rejectionReason: z.string().nullable(),
    voidedAt: z.number().int().nullable(),
    voidReason: z.string().nullable(),
    approvedAt: z.number().int().nullable(),
    revenueEntryLinked: z.boolean(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict();

const managerPlatformEarningLineSchema = z
  .object({
    id: z.string().trim().min(1),
    batchId: z.string().trim().min(1),
    sourceDate: z.number().int(),
    memberEmploymentProfileId: z.string().trim().min(1),
    memberTalentId: z.string().trim().min(1),
    rawQuantity: z.number(),
    externalSourceRef: z.string().nullable(),
    notes: z.string().nullable(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict();

const managerPlatformEarningScopeResponseSchema = z
  .object({ data: managerPlatformEarningScopeSchema })
  .strict();
const managerPlatformEarningBatchListResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(managerPlatformEarningBatchSchema),
        nextCursor: z
          .union([z.string().trim().min(1), z.null()])
          .optional()
          .transform((value) => value ?? undefined),
      })
      .strict(),
  })
  .strict();
const managerPlatformEarningBatchResponseSchema = z
  .object({ data: managerPlatformEarningBatchSchema })
  .strict();
const managerPlatformEarningLineListResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(managerPlatformEarningLineSchema),
        nextCursor: z
          .union([z.string().trim().min(1), z.null()])
          .optional()
          .transform((value) => value ?? undefined),
      })
      .strict(),
  })
  .strict();
const managerPlatformEarningLineResponseSchema = z
  .object({ data: managerPlatformEarningLineSchema })
  .strict();

export type ManagerPlatformEarningStatus = z.infer<typeof managerPlatformEarningStatusSchema>;
export type ManagerPlatformEarningScope = z.infer<typeof managerPlatformEarningScopeSchema>;
export type ManagerPlatformEarningBatch = z.infer<typeof managerPlatformEarningBatchSchema>;
export type ManagerPlatformEarningLine = z.infer<typeof managerPlatformEarningLineSchema>;
export type ManagerPlatformEarningBatchList = z.infer<
  typeof managerPlatformEarningBatchListResponseSchema
>['data'];

export type ManagerPlatformEarningBatchPayload = {
  platform: string;
  platformAccountId: string;
  talentGroupId: string;
  sourceType: 'TIKTOK_LIVESTREAM_DIAMOND';
  periodMonth: string;
  sourceDateFrom: number;
  sourceDateTo: number;
};

export type ManagerPlatformEarningLinePayload = {
  sourceDate?: number;
  memberTalentId?: string;
  memberEmploymentProfileId?: string;
  rawQuantity?: number;
  externalSourceRef?: string | null;
  notes?: string | null;
};

export const parseManagerEventForTest = (value: unknown): ManagerEventSummary =>
  managerEventSchema.parse(value);

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

const managerEventsResponseSchema = z
  .object({ data: z.object({ items: z.array(managerEventSchema) }).strict() })
  .strict();
const managerEventDetailResponseSchema = z.object({ data: managerEventSchema }).strict();

export const fetchManagerEvents = async (): Promise<ManagerEventSummary[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/events',
  });

  return managerEventsResponseSchema.parse(response).data.items;
};

export const fetchManagerEventDetail = async (eventId: string): Promise<ManagerEventSummary> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/manager-workspace/events/${encodeURIComponent(eventId)}`,
  });

  return managerEventDetailResponseSchema.parse(response).data;
};

export const useManagerEvents = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: MANAGER_EVENTS_QUERY_KEY,
    queryFn: fetchManagerEvents,
    enabled: options?.enabled ?? true,
    retry: retryManagerEventsQuery,
    retryDelay: 100,
  });

export const useManagerEventDetail = (eventId?: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: eventId
      ? [...MANAGER_EVENTS_QUERY_KEY, eventId]
      : [...MANAGER_EVENTS_QUERY_KEY, 'detail'],
    queryFn: () => fetchManagerEventDetail(eventId ?? ''),
    enabled: Boolean(eventId) && (options?.enabled ?? true),
    retry: retryManagerEventsQuery,
    retryDelay: 100,
  });

export const fetchManagerPlatformEarningScope = async (): Promise<ManagerPlatformEarningScope> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/revenue/platform-earning-scope',
  });

  return managerPlatformEarningScopeResponseSchema.parse(response).data;
};

export const fetchManagerPlatformEarningBatches = async (
  query: { talentGroupId?: string; status?: ManagerPlatformEarningStatus; cursor?: string } = {},
): Promise<ManagerPlatformEarningBatchList> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/revenue/platform-earning-batches',
    params: Object.fromEntries(
      Object.entries({ ...query, limit: 20 }).filter(
        ([, value]) => value !== undefined && value !== '',
      ),
    ),
  });

  return managerPlatformEarningBatchListResponseSchema.parse(response).data;
};

export const fetchManagerPlatformEarningBatchDetail = async (
  batchId: string,
): Promise<ManagerPlatformEarningBatch> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/manager-workspace/revenue/platform-earning-batches/${encodeURIComponent(batchId)}`,
  });

  return managerPlatformEarningBatchResponseSchema.parse(response).data;
};

export const fetchManagerPlatformEarningLines = async (
  batchId: string,
): Promise<ManagerPlatformEarningLine[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/manager-workspace/revenue/platform-earning-batches/${encodeURIComponent(
      batchId,
    )}/source-lines`,
    params: { limit: 50 },
  });

  return managerPlatformEarningLineListResponseSchema.parse(response).data.items;
};

export const createManagerPlatformEarningBatch = async (
  payload: ManagerPlatformEarningBatchPayload,
): Promise<ManagerPlatformEarningBatch> => {
  const response = await apiRequest<unknown, ManagerPlatformEarningBatchPayload>({
    method: 'POST',
    url: '/admin/manager-workspace/revenue/platform-earning-batches',
    data: payload,
  });

  return managerPlatformEarningBatchResponseSchema.parse(response).data;
};

export const addManagerPlatformEarningLine = async (
  batchId: string,
  payload: Required<
    Pick<
      ManagerPlatformEarningLinePayload,
      'sourceDate' | 'memberTalentId' | 'memberEmploymentProfileId' | 'rawQuantity'
    >
  > &
    Pick<ManagerPlatformEarningLinePayload, 'externalSourceRef' | 'notes'>,
): Promise<ManagerPlatformEarningLine> => {
  const response = await apiRequest<unknown, typeof payload>({
    method: 'POST',
    url: `/admin/manager-workspace/revenue/platform-earning-batches/${encodeURIComponent(
      batchId,
    )}/source-lines`,
    data: payload,
  });

  return managerPlatformEarningLineResponseSchema.parse(response).data;
};

export const updateManagerPlatformEarningLine = async (
  batchId: string,
  lineId: string,
  payload: ManagerPlatformEarningLinePayload,
): Promise<ManagerPlatformEarningLine> => {
  const response = await apiRequest<unknown, ManagerPlatformEarningLinePayload>({
    method: 'PATCH',
    url: `/admin/manager-workspace/revenue/platform-earning-batches/${encodeURIComponent(
      batchId,
    )}/source-lines/${encodeURIComponent(lineId)}`,
    data: Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as ManagerPlatformEarningLinePayload,
  });

  return managerPlatformEarningLineResponseSchema.parse(response).data;
};

export const submitManagerPlatformEarningBatch = async (
  batchId: string,
): Promise<ManagerPlatformEarningBatch> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/manager-workspace/revenue/platform-earning-batches/${encodeURIComponent(
      batchId,
    )}/submit`,
    data: {},
  });

  return managerPlatformEarningBatchResponseSchema.parse(response).data;
};

export const useManagerPlatformEarningScope = (enabled: boolean) =>
  useQuery({
    queryKey: [...MANAGER_REVENUE_QUERY_KEY, 'scope'],
    queryFn: fetchManagerPlatformEarningScope,
    enabled,
    retry: false,
  });

export const useManagerPlatformEarningBatches = (
  query: { talentGroupId?: string; status?: ManagerPlatformEarningStatus; cursor?: string },
  enabled: boolean,
) =>
  useQuery({
    queryKey: [
      ...MANAGER_REVENUE_QUERY_KEY,
      'batches',
      query.talentGroupId ?? 'none',
      query.status ?? 'all',
      query.cursor ?? 'first',
    ],
    queryFn: () => fetchManagerPlatformEarningBatches(query),
    enabled,
    retry: false,
  });

export const useManagerPlatformEarningBatchDetail = (
  batchId: string | undefined,
  enabled: boolean,
) =>
  useQuery({
    queryKey: [...MANAGER_REVENUE_QUERY_KEY, 'batch', batchId ?? 'none'],
    queryFn: () => fetchManagerPlatformEarningBatchDetail(batchId ?? ''),
    enabled: Boolean(batchId) && enabled,
    retry: false,
  });

export const useManagerPlatformEarningLines = (batchId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: [...MANAGER_REVENUE_QUERY_KEY, 'lines', batchId ?? 'none'],
    queryFn: () => fetchManagerPlatformEarningLines(batchId ?? ''),
    enabled: Boolean(batchId) && enabled,
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

export const fetchManagerWorkShifts = async (
  month?: string,
  cursor?: string,
): Promise<ManagerWorkShiftList> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/work-schedule/work-shifts',
    params: Object.fromEntries(
      Object.entries({ month, cursor }).filter(([, value]) => Boolean(value)),
    ),
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

export const useManagerWorkShiftPages = (month: string | undefined, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ['manager-workspace', 'work-shifts', 'pages', month ?? 'current'],
    queryFn: ({ pageParam }) => fetchManagerWorkShifts(month, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
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

const availabilityBatchStatusSchema = z.enum([
  'PENDING',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);
const availabilityLineStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
const availabilityTypeSchema = z.enum([
  'UNAVAILABLE_FULL_DAY',
  'PREFERRED_TIME',
  'OTHER_AVAILABILITY_NOTE',
]);
const availabilityTaxonomyCodeSchema = z.enum([
  'SICK_LEAVE',
  'AUTHORIZED_LEAVE',
  'SHIFT_CHANGE',
  'OTHER',
]);
const availabilityApplyStatusSchema = z.enum(['NOT_APPLIED', 'ADVISORY_ONLY', 'APPLIED']);
const availabilityPolicyEvaluationStatusSchema = z.literal('NOT_EVALUATED');
const availabilityLineCountsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  })
  .strict();
const availabilityTargetSummarySchema = referenceSummarySchema.nullable().optional();
const managerAvailabilityMemberSchema = z
  .object({
    employmentProfileId: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    employeeCode: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
  })
  .strict();

const managerAvailabilityBatchListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    availabilityBatchCode: z.string().trim().min(1),
    status: availabilityBatchStatusSchema,
    periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    targetType: z.enum(['ORG_UNIT', 'TALENT_GROUP']),
    targetMode: z.literal('EXACT_ONLY'),
    targetOrgUnitId: z.string().nullable(),
    targetTalentGroupId: z.string().nullable(),
    target: availabilityTargetSummarySchema,
    note: z.string().nullable(),
    lineCounts: availabilityLineCountsSchema,
    clientToken: z.string().trim().min(1),
    submittedAt: z.number().int(),
    cancelledAt: z.number().int().nullable(),
    resolvedAt: z.number().int().nullable(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict();

const managerAvailabilityBatchLineSchema = z
  .object({
    id: z.string().trim().min(1),
    batchId: z.string().trim().min(1).optional(),
    lineNo: z.number().int().positive(),
    member: managerAvailabilityMemberSchema,
    availabilityType: availabilityTypeSchema,
    taxonomyCode: availabilityTaxonomyCodeSchema,
    availabilityDate: z.string().nullable(),
    dateRangeStart: z.string().nullable(),
    dateRangeEnd: z.string().nullable(),
    preferredStartLocalTime: z.string().nullable(),
    preferredEndLocalTime: z.string().nullable(),
    reason: z.string().trim().min(1),
    status: availabilityLineStatusSchema,
    applyStatus: availabilityApplyStatusSchema,
    policyEvaluationStatus: availabilityPolicyEvaluationStatusSchema,
    appliedRosterId: z.string().nullable(),
    appliedRosterExceptionId: z.string().nullable(),
    appliedRosterExceptionIds: z.array(z.string()),
    appliedAt: z.number().int().nullable(),
    adminDecisionNote: z.string().nullable(),
    rejectionReason: z.string().nullable(),
    cancellationReason: z.string().nullable(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    approvedAt: z.number().int().nullable(),
    rejectedAt: z.number().int().nullable(),
    cancelledAt: z.number().int().nullable(),
  })
  .strict();

const managerAvailabilityBatchDetailSchema = managerAvailabilityBatchListItemSchema
  .extend({
    lines: z.array(managerAvailabilityBatchLineSchema),
  })
  .strict();

const managerAvailabilityBatchListResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(managerAvailabilityBatchListItemSchema),
        nextCursor: z.string().trim().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const managerAvailabilityBatchDetailResponseSchema = z
  .object({
    data: managerAvailabilityBatchDetailSchema,
  })
  .strict();

const managerAvailabilityTargetMembersSchema = z
  .object({
    target: z
      .object({
        targetType: z.enum(['ORG_UNIT', 'TALENT_GROUP']),
        targetId: z.string().trim().min(1),
        targetMode: z.literal('EXACT_ONLY'),
        name: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        code: z.string().trim().min(1).optional(),
      })
      .strict(),
    members: z.array(
      z
        .object({
          employmentProfileId: z.string().trim().min(1),
          displayName: z.string().trim().min(1),
          employeeCode: z.string().trim().min(1).optional(),
        })
        .strict(),
    ),
    totalMembers: z.number().int().nonnegative(),
  })
  .strict();

const managerAvailabilityTargetMembersResponseSchema = z
  .object({
    data: managerAvailabilityTargetMembersSchema,
  })
  .strict();

export type ManagerWorkScheduleRequestType = z.infer<typeof requestTypeSchema>;
export type ManagerWorkScheduleAvailabilityType = z.infer<typeof availabilityTypeSchema>;
export type ManagerWorkScheduleAvailabilityTaxonomyCode = z.infer<
  typeof availabilityTaxonomyCodeSchema
>;
export type ManagerRequestBatchListItem = z.infer<typeof managerRequestBatchListItemSchema>;
export type ManagerRequestBatchDetail = z.infer<typeof managerRequestBatchDetailSchema>;
export type ManagerRequestBatchLine = z.infer<typeof managerRequestBatchLineSchema>;
export type ManagerRequestBatchList = z.infer<typeof managerRequestBatchListResponseSchema>['data'];
export type ManagerAvailabilityBatchListItem = z.infer<
  typeof managerAvailabilityBatchListItemSchema
>;
export type ManagerAvailabilityBatchDetail = z.infer<typeof managerAvailabilityBatchDetailSchema>;
export type ManagerAvailabilityBatchLine = z.infer<typeof managerAvailabilityBatchLineSchema>;
export type ManagerAvailabilityBatchList = z.infer<
  typeof managerAvailabilityBatchListResponseSchema
>['data'];
export type ManagerAvailabilityTargetMembers = z.infer<
  typeof managerAvailabilityTargetMembersSchema
>;

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

export type ManagerSubmitAvailabilityBatchLinePayload = {
  memberEmploymentProfileId: string;
  availabilityType: ManagerWorkScheduleAvailabilityType;
  taxonomyCode: ManagerWorkScheduleAvailabilityTaxonomyCode;
  availabilityDate?: string | null;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  preferredStartLocalTime?: string | null;
  preferredEndLocalTime?: string | null;
  reason: string;
};

export type ManagerSubmitAvailabilityBatchPayload = {
  periodMonth: string;
  targetType: 'ORG_UNIT' | 'TALENT_GROUP';
  targetMode: 'EXACT_ONLY';
  targetOrgUnitId?: string | null;
  targetTalentGroupId?: string | null;
  clientToken: string;
  idempotencyKey?: string | null;
  note?: string | null;
  lines: ManagerSubmitAvailabilityBatchLinePayload[];
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
    ...(line.workShiftId !== undefined
      ? { workShiftId: sanitizeNullableText(line.workShiftId) }
      : {}),
    ...(line.requestedStartAt !== undefined ? { requestedStartAt: line.requestedStartAt } : {}),
    ...(line.requestedEndAt !== undefined ? { requestedEndAt: line.requestedEndAt } : {}),
    ...(line.timezone !== undefined ? { timezone: line.timezone } : {}),
    ...(line.title !== undefined ? { title: sanitizeNullableText(line.title) } : {}),
    ...(line.description !== undefined
      ? { description: sanitizeNullableText(line.description) }
      : {}),
    ...(line.externalRef !== undefined
      ? { externalRef: sanitizeNullableText(line.externalRef) }
      : {}),
    reason: line.reason.trim(),
  })),
});

const sanitizeSubmitAvailabilityBatchPayload = (
  payload: ManagerSubmitAvailabilityBatchPayload,
): ManagerSubmitAvailabilityBatchPayload => ({
  periodMonth: payload.periodMonth.trim(),
  targetType: payload.targetType,
  targetMode: 'EXACT_ONLY',
  ...(payload.targetOrgUnitId !== undefined
    ? { targetOrgUnitId: sanitizeNullableText(payload.targetOrgUnitId) }
    : {}),
  ...(payload.targetTalentGroupId !== undefined
    ? { targetTalentGroupId: sanitizeNullableText(payload.targetTalentGroupId) }
    : {}),
  clientToken: payload.clientToken.trim(),
  ...(payload.idempotencyKey !== undefined
    ? { idempotencyKey: sanitizeNullableText(payload.idempotencyKey) }
    : {}),
  ...(payload.note !== undefined ? { note: sanitizeNullableText(payload.note) } : {}),
  lines: payload.lines.map((line) => ({
    memberEmploymentProfileId: line.memberEmploymentProfileId.trim(),
    availabilityType: line.availabilityType,
    taxonomyCode: line.taxonomyCode,
    ...(line.availabilityDate !== undefined
      ? { availabilityDate: sanitizeNullableText(line.availabilityDate) }
      : {}),
    ...(line.dateRangeStart !== undefined
      ? { dateRangeStart: sanitizeNullableText(line.dateRangeStart) }
      : {}),
    ...(line.dateRangeEnd !== undefined
      ? { dateRangeEnd: sanitizeNullableText(line.dateRangeEnd) }
      : {}),
    ...(line.preferredStartLocalTime !== undefined
      ? { preferredStartLocalTime: sanitizeNullableText(line.preferredStartLocalTime) }
      : {}),
    ...(line.preferredEndLocalTime !== undefined
      ? { preferredEndLocalTime: sanitizeNullableText(line.preferredEndLocalTime) }
      : {}),
    reason: line.reason.trim(),
  })),
});

export const fetchManagerRequestBatches = async (
  query: { status?: string; periodMonth?: string; cursor?: string } = {},
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

export const fetchManagerAvailabilityBatches = async (
  query: { status?: string; periodMonth?: string; cursor?: string } = {},
): Promise<ManagerAvailabilityBatchList> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/work-schedule/availability-batches',
    params: Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
    ),
  });

  return managerAvailabilityBatchListResponseSchema.parse(response).data;
};

export const fetchManagerAvailabilityTargetMembers = async (
  targetType: 'ORG_UNIT' | 'TALENT_GROUP',
  targetId: string,
): Promise<ManagerAvailabilityTargetMembers> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/manager-workspace/work-schedule/availability-members',
    params: { targetType, targetId },
  });

  return managerAvailabilityTargetMembersResponseSchema.parse(response).data;
};

export const fetchManagerAvailabilityBatchDetail = async (
  batchId: string,
): Promise<ManagerAvailabilityBatchDetail> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/manager-workspace/work-schedule/availability-batches/${encodeURIComponent(
      batchId,
    )}`,
  });

  return managerAvailabilityBatchDetailResponseSchema.parse(response).data;
};

export const submitManagerAvailabilityBatch = async (
  payload: ManagerSubmitAvailabilityBatchPayload,
): Promise<ManagerAvailabilityBatchDetail> => {
  const response = await apiRequest<unknown, ManagerSubmitAvailabilityBatchPayload>({
    method: 'POST',
    url: '/admin/manager-workspace/work-schedule/availability-batches',
    data: sanitizeSubmitAvailabilityBatchPayload(payload),
  });

  return managerAvailabilityBatchDetailResponseSchema.parse(response).data;
};

export const cancelManagerAvailabilityBatch = async (
  batchId: string,
  payload: ManagerCancelRequestPayload,
): Promise<ManagerAvailabilityBatchDetail> => {
  const response = await apiRequest<unknown, ManagerCancelRequestPayload>({
    method: 'POST',
    url: `/admin/manager-workspace/work-schedule/availability-batches/${encodeURIComponent(
      batchId,
    )}/cancel`,
    data: { cancellationReason: payload.cancellationReason.trim() },
  });

  return managerAvailabilityBatchDetailResponseSchema.parse(response).data;
};

export const cancelManagerAvailabilityLine = async (
  batchId: string,
  lineId: string,
  payload: ManagerCancelRequestPayload,
): Promise<ManagerAvailabilityBatchDetail> => {
  const response = await apiRequest<unknown, ManagerCancelRequestPayload>({
    method: 'POST',
    url: `/admin/manager-workspace/work-schedule/availability-batches/${encodeURIComponent(
      batchId,
    )}/lines/${encodeURIComponent(lineId)}/cancel`,
    data: { cancellationReason: payload.cancellationReason.trim() },
  });

  return managerAvailabilityBatchDetailResponseSchema.parse(response).data;
};

export const useManagerRequestBatches = (
  query: { status?: string; periodMonth?: string },
  enabled: boolean,
) =>
  useQuery({
    queryKey: [
      ...MANAGER_REQUEST_BATCHES_QUERY_KEY,
      query.status ?? 'all',
      query.periodMonth ?? 'all',
    ],
    queryFn: () => fetchManagerRequestBatches(query),
    enabled,
    retry: false,
  });

export const useManagerRequestBatchPages = (
  query: { status?: string; periodMonth?: string },
  enabled: boolean,
) =>
  useInfiniteQuery({
    queryKey: [
      ...MANAGER_REQUEST_BATCHES_QUERY_KEY,
      'pages',
      query.status ?? 'all',
      query.periodMonth ?? 'all',
    ],
    queryFn: ({ pageParam }) => fetchManagerRequestBatches({ ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
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

export const useManagerAvailabilityBatches = (
  query: { status?: string; periodMonth?: string },
  enabled: boolean,
) =>
  useQuery({
    queryKey: [
      ...MANAGER_AVAILABILITY_BATCHES_QUERY_KEY,
      query.status ?? 'all',
      query.periodMonth ?? 'all',
    ],
    queryFn: () => fetchManagerAvailabilityBatches(query),
    enabled,
    retry: false,
  });

export const useManagerAvailabilityBatchPages = (
  query: { status?: string; periodMonth?: string },
  enabled: boolean,
) =>
  useInfiniteQuery({
    queryKey: [
      ...MANAGER_AVAILABILITY_BATCHES_QUERY_KEY,
      'pages',
      query.status ?? 'all',
      query.periodMonth ?? 'all',
    ],
    queryFn: ({ pageParam }) => fetchManagerAvailabilityBatches({ ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    retry: false,
  });

export const useManagerAvailabilityTargetMembers = (
  targetType: 'ORG_UNIT' | 'TALENT_GROUP' | undefined,
  targetId: string | undefined,
  enabled: boolean,
) =>
  useQuery({
    queryKey: [...MANAGER_AVAILABILITY_MEMBERS_QUERY_KEY, targetType ?? 'none', targetId ?? 'none'],
    queryFn: () => fetchManagerAvailabilityTargetMembers(targetType!, targetId!),
    enabled: enabled && Boolean(targetType && targetId),
    retry: false,
  });

export const useManagerAvailabilityBatchDetail = (batchId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: [...MANAGER_AVAILABILITY_BATCHES_QUERY_KEY, 'detail', batchId ?? 'none'],
    queryFn: () => fetchManagerAvailabilityBatchDetail(batchId ?? ''),
    enabled: Boolean(batchId) && enabled,
    retry: false,
  });

const invalidateManagerRequestBatches = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: MANAGER_REQUEST_BATCHES_QUERY_KEY });
};

const invalidateManagerAvailabilityBatches = async (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  await queryClient.invalidateQueries({ queryKey: MANAGER_AVAILABILITY_BATCHES_QUERY_KEY });
};

const invalidateManagerRevenueSource = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: MANAGER_REVENUE_QUERY_KEY });
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
    mutationFn: ({ batchId, payload }: { batchId: string; payload: ManagerCancelRequestPayload }) =>
      cancelManagerRequestBatch(batchId, payload),
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

export const useSubmitManagerAvailabilityBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }: { payload: ManagerSubmitAvailabilityBatchPayload }) =>
      submitManagerAvailabilityBatch(payload),
    onSuccess: async () => {
      await invalidateManagerAvailabilityBatches(queryClient);
    },
  });
};

export const useCreateManagerPlatformEarningBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }: { payload: ManagerPlatformEarningBatchPayload }) =>
      createManagerPlatformEarningBatch(payload),
    onSuccess: async () => {
      await invalidateManagerRevenueSource(queryClient);
    },
  });
};

export const useAddManagerPlatformEarningLineMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: Required<
        Pick<
          ManagerPlatformEarningLinePayload,
          'sourceDate' | 'memberTalentId' | 'memberEmploymentProfileId' | 'rawQuantity'
        >
      > &
        Pick<ManagerPlatformEarningLinePayload, 'externalSourceRef' | 'notes'>;
    }) => addManagerPlatformEarningLine(batchId, payload),
    onSuccess: async () => {
      await invalidateManagerRevenueSource(queryClient);
    },
  });
};

export const useUpdateManagerPlatformEarningLineMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      lineId,
      payload,
    }: {
      batchId: string;
      lineId: string;
      payload: ManagerPlatformEarningLinePayload;
    }) => updateManagerPlatformEarningLine(batchId, lineId, payload),
    onSuccess: async () => {
      await invalidateManagerRevenueSource(queryClient);
    },
  });
};

export const useSubmitManagerPlatformEarningBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId }: { batchId: string }) => submitManagerPlatformEarningBatch(batchId),
    onSuccess: async () => {
      await invalidateManagerRevenueSource(queryClient);
    },
  });
};

export const useCancelManagerAvailabilityBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, payload }: { batchId: string; payload: ManagerCancelRequestPayload }) =>
      cancelManagerAvailabilityBatch(batchId, payload),
    onSuccess: async () => {
      await invalidateManagerAvailabilityBatches(queryClient);
    },
  });
};

export const useCancelManagerAvailabilityLineMutation = () => {
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
    }) => cancelManagerAvailabilityLine(batchId, lineId, payload),
    onSuccess: async () => {
      await invalidateManagerAvailabilityBatches(queryClient);
    },
  });
};

export const parseManagerWorkspaceContextForTest = (response: unknown): ManagerWorkspaceContext =>
  managerWorkspaceContextResponseSchema.parse(response).data;

export const parseManagerPlatformEarningBatchListForTest = (response: unknown) =>
  managerPlatformEarningBatchListResponseSchema.parse(response).data;

export const parseManagerWorkShiftListForTest = (response: unknown): ManagerWorkShiftList =>
  managerWorkShiftListResponseSchema.parse(response).data;

export const parseManagerAvailabilityBatchListForTest = (
  response: unknown,
): ManagerAvailabilityBatchList => managerAvailabilityBatchListResponseSchema.parse(response).data;

export const parseManagerAvailabilityBatchDetailForTest = (
  response: unknown,
): ManagerAvailabilityBatchDetail =>
  managerAvailabilityBatchDetailResponseSchema.parse(response).data;

export const parseManagerRequestBatchListForTest = (response: unknown): ManagerRequestBatchList =>
  managerRequestBatchListResponseSchema.parse(response).data;

export const parseManagerRequestBatchDetailForTest = (
  response: unknown,
): ManagerRequestBatchDetail => managerRequestBatchDetailResponseSchema.parse(response).data;

export const parseManagerAvailabilityTargetMembersForTest = (
  response: unknown,
): ManagerAvailabilityTargetMembers =>
  managerAvailabilityTargetMembersResponseSchema.parse(response).data;

export const parseManagerAvailabilityApplyStatusForTest = (value: unknown) =>
  availabilityApplyStatusSchema.parse(value);

export const parseManagerAvailabilityPolicyEvaluationStatusForTest = (value: unknown) =>
  availabilityPolicyEvaluationStatusSchema.parse(value);
