import { z } from 'zod';

import type {
  KpiActualCorrection,
  KpiActualDailyGrid,
  KpiActualEntry,
  KpiAllocation,
  KpiAllocationDraftMemberInput,
  KpiAllocationInput,
  KpiAllocationQuery,
  KpiCreatePlanPayload,
  KpiDraftCorePayload,
  KpiManagedMemberPickerItem,
  KpiPlanDetail,
  KpiPlanQuery,
  KpiProgressView,
  KpiTargetMetricInput,
} from '@modules/kpi/types/kpi.types';
import { apiRequest } from '@shared/api';

const timestampSchema = z.union([z.number(), z.string()]);
const subjectTypeSchema = z.enum(['TALENT', 'TALENT_GROUP', 'EMPLOYMENT_PROFILE', 'ORG_UNIT']);
const executableSubjectTypeSchema = z.enum(['TALENT', 'TALENT_GROUP']);
const statusSchema = z.enum(['DRAFT', 'PUBLISHED', 'FINALIZED', 'ARCHIVED']);
const metricCodeSchema = z.enum([
  'REVENUE_VND',
  'CONTENT_OUTPUT_COUNT',
  'LIVE_HOURS',
  'EVENT_COMPLETION_COUNT',
  'ONBOARDED_TALENT_COUNT',
]);
const integerTargetMetricCodes = new Set<z.infer<typeof metricCodeSchema>>([
  'REVENUE_VND',
  'CONTENT_OUTPUT_COUNT',
  'EVENT_COMPLETION_COUNT',
  'ONBOARDED_TALENT_COUNT',
]);
const unitSchema = z.enum(['VND', 'COUNT', 'HOUR']);
const allocationStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ACTIVE',
  'CLOSED',
  'CANCELLED',
]);

const allocationWorkflowSummarySchema = z
  .object({
    total: z.number().int().nonnegative(),
    byStatus: z
      .object({
        draft: z.number().int().nonnegative(),
        pendingApproval: z.number().int().nonnegative(),
        approved: z.number().int().nonnegative(),
        published: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        active: z.number().int().nonnegative(),
        closed: z.number().int().nonnegative(),
        cancelled: z.number().int().nonnegative(),
      })
      .strict(),
    hasDraft: z.boolean(),
    hasPendingApproval: z.boolean(),
    hasApproved: z.boolean(),
    hasPublished: z.boolean(),
    hasRejected: z.boolean(),
    hasLegacyActive: z.boolean(),
    officialPublishedCount: z.number().int().nonnegative(),
  })
  .strict();

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

const hasAtMostDecimalPlaces = (value: number, places: number): boolean =>
  Number.isInteger(Number((value * 10 ** places).toFixed(8)));

const rejectDuplicateTargetMetricCodes = (
  items: KpiTargetMetricInput[],
  context: z.RefinementCtx,
): void => {
  const seen = new Set<KpiTargetMetricInput['metricCode']>();
  items.forEach((item, index) => {
    if (seen.has(item.metricCode)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'metricCode'],
        message: `Duplicate KPI target metric code: ${item.metricCode}`,
      });
    }
    seen.add(item.metricCode);
  });
};

const targetMetricInputSchema = z
  .object({
    metricCode: metricCodeSchema,
    targetValue: z.number().finite().nonnegative(),
  })
  .strict()
  .superRefine((metric, context) => {
    if (integerTargetMetricCodes.has(metric.metricCode) && !Number.isInteger(metric.targetValue)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetValue'],
        message: `${metric.metricCode} target value must be an integer.`,
      });
    }
    if (metric.metricCode === 'LIVE_HOURS' && !hasAtMostDecimalPlaces(metric.targetValue, 2)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetValue'],
        message: 'LIVE_HOURS target value supports at most two decimal places.',
      });
    }
  });

const targetMetricInputArraySchema = z
  .array(targetMetricInputSchema)
  .superRefine(rejectDuplicateTargetMetricCodes);

const requiredTargetMetricInputArraySchema = z
  .array(targetMetricInputSchema)
  .min(1)
  .superRefine(rejectDuplicateTargetMetricCodes);

const allocationContractDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/);

const allocationInputSchema = z
  .object({
    memberTalentId: z.string().trim().min(1),
    membershipId: z.string().trim().min(1).nullable().optional(),
    allocationStartDate: allocationContractDateSchema,
    allocationEndDate: allocationContractDateSchema.nullable().optional(),
    targetMetrics: targetMetricInputArraySchema,
    snapshotMemberDisplayName: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const allocationDraftMemberInputSchema = z
  .object({
    employmentProfileId: z.string().trim().min(1),
    allocationStartDate: allocationContractDateSchema,
    allocationEndDate: allocationContractDateSchema.nullable().optional(),
    targetMetrics: requiredTargetMetricInputArraySchema,
    note: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const targetMetricSchema = z
  .object({
    id: z.string().trim().min(1),
    kpiPlanId: z.string().trim().min(1),
    metricCode: metricCodeSchema,
    targetValue: z.number(),
    unit: unitSchema,
    rollupMethod: z.literal('SUM'),
    actualSource: z.literal('MANUAL'),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const allocationSchema = z
  .object({
    id: z.string().trim().min(1),
    kpiPlanId: z.string().trim().min(1),
    groupId: z.string().trim().min(1),
    memberEmploymentProfileId: z.string().nullable(),
    memberTalentId: z.string().trim().min(1),
    membershipId: z.string().nullable(),
    allocationStatus: allocationStatusSchema,
    allocationStartDate: z.string().trim().min(1),
    allocationEndDate: z.string().nullable(),
    targetMetrics: z.array(targetMetricInputSchema),
    snapshotMemberDisplayName: z.string().nullable(),
    note: z.string().nullable(),
    createdAt: timestampSchema,
    createdByActorId: z.string().nullable(),
    updatedAt: timestampSchema,
    updatedByActorId: z.string().nullable(),
    submittedAt: timestampSchema.nullable(),
    submittedByActorId: z.string().nullable(),
    approvedAt: timestampSchema.nullable(),
    approvedByActorId: z.string().nullable(),
    approvalNote: z.string().nullable(),
    rejectedAt: timestampSchema.nullable(),
    rejectedByActorId: z.string().nullable(),
    rejectionReason: z.string().nullable(),
    publishedAt: timestampSchema.nullable(),
    publishedByActorId: z.string().nullable(),
    closedAt: timestampSchema.nullable(),
  })
  .strict();

const planBaseSchema = z
  .object({
    id: z.string().trim().min(1),
    planCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().nullable(),
    subjectType: subjectTypeSchema,
    subjectId: z.string().trim().min(1),
    subjectRef: referenceSummarySchema.nullable().optional(),
    status: statusSchema,
    currencyCode: z.literal('VND'),
    periodMonth: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}$/),
    periodStartAt: timestampSchema,
    periodEndAt: timestampSchema,
    timezone: z.string().trim().min(1),
    actualPolicySnapshot: z.unknown().nullable(),
    publishedAt: timestampSchema.nullable(),
    publishedByActorId: z.string().nullable(),
    finalizedAt: timestampSchema.nullable(),
    finalizedByActorId: z.string().nullable(),
    archivedAt: timestampSchema.nullable(),
    archivedByActorId: z.string().nullable(),
    createdAt: timestampSchema,
    createdByActorId: z.string().trim().min(1),
    updatedAt: timestampSchema,
    updatedByActorId: z.string().trim().min(1),
    externalRef: z.string().nullable(),
  })
  .strict();

const planDetailSchema = planBaseSchema
  .extend({
    targetMetrics: z.array(targetMetricSchema),
    allocations: z.array(allocationSchema),
  })
  .strict();

const planListItemSchema = planBaseSchema.extend({
  allocationWorkflowSummary: allocationWorkflowSummarySchema,
});

const actualCellSchema = z
  .object({
    metricCode: metricCodeSchema,
    targetValue: z.number(),
    actualEntryId: z.string().nullable(),
    actualValue: z.number().nullable(),
    effectiveValue: z.number(),
    hasEntry: z.boolean(),
    editCount: z.number().int(),
    correctionCount: z.number().int(),
    latestCorrectionId: z.string().nullable(),
    canDirectEdit: z.boolean(),
    requiresCorrection: z.boolean(),
    disabledReason: z.string().nullable(),
  })
  .strict();

const actualGridSchema = z
  .object({
    kpiPlanId: z.string().trim().min(1),
    planCode: z.string().trim().min(1),
    status: statusSchema,
    subjectType: subjectTypeSchema,
    subjectId: z.string().trim().min(1),
    actualDate: z
      .string()
      .trim()
      .regex(/^\d{2}-\d{2}-\d{4}$/),
    policy: z
      .object({
        timezone: z.literal('Asia/Ho_Chi_Minh'),
        entryOpenLocalTime: z.literal('06:00'),
        entryLockLocalTime: z.literal('23:00'),
        maxDirectEditsPerEntry: z.number().int(),
        correctionAllowedUntil: z.literal('PLAN_FINALIZED'),
      })
      .strict(),
    editability: z
      .object({
        isDirectEditOpen: z.boolean(),
        isPlanFinalized: z.boolean(),
        disabledReason: z.string().nullable(),
      })
      .strict(),
    targetMetrics: z.array(
      z
        .object({
          metricCode: metricCodeSchema,
          targetValue: z.number(),
          unit: unitSchema,
        })
        .strict(),
    ),
    rows: z.array(
      z
        .object({
          allocationId: z.string().trim().min(1),
          memberTalentId: z.string().trim().min(1),
          memberDisplayName: z.string().nullable(),
          allocationStatus: allocationStatusSchema,
          metrics: z.array(actualCellSchema),
        })
        .strict(),
    ),
  })
  .strict();

const actualEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    kpiPlanId: z.string().trim().min(1),
    allocationId: z.string().trim().min(1),
    memberTalentId: z.string().trim().min(1),
    metricCode: metricCodeSchema,
    actualDate: z
      .string()
      .trim()
      .regex(/^\d{2}-\d{2}-\d{4}$/),
    actualValue: z.number(),
    effectiveValue: z.number(),
    editCount: z.number().int(),
    correctionCount: z.number().int(),
    latestCorrectionId: z.string().nullable(),
    createdAt: timestampSchema,
    createdByActorId: z.string().trim().min(1),
    updatedAt: timestampSchema,
    updatedByActorId: z.string().trim().min(1),
    lastEditedAt: timestampSchema.nullable(),
    lastEditedByActorId: z.string().nullable(),
  })
  .strict();

const correctionSchema = z
  .object({
    id: z.string().trim().min(1),
    actualEntryId: z.string().trim().min(1),
    kpiPlanId: z.string().trim().min(1),
    allocationId: z.string().trim().min(1),
    memberTalentId: z.string().trim().min(1),
    metricCode: metricCodeSchema,
    actualDate: z
      .string()
      .trim()
      .regex(/^\d{2}-\d{2}-\d{4}$/),
    previousValue: z.number(),
    correctedValue: z.number(),
    reason: z.string().trim().min(1),
    correctedByActorId: z.string().trim().min(1),
    correctedAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

const progressSchema = z
  .object({
    plan: planBaseSchema.pick({
      id: true,
      planCode: true,
      subjectType: true,
      subjectId: true,
      status: true,
      periodMonth: true,
      periodStartAt: true,
      periodEndAt: true,
      timezone: true,
    }),
    periodElapsedPercent: z.number(),
    targetMetrics: z.array(targetMetricSchema),
    groupTotals: z.array(
      z
        .object({
          metricCode: metricCodeSchema,
          targetValue: z.number(),
          actualValue: z.number(),
          progressPercent: z.number().nullable(),
        })
        .strict(),
    ),
    memberProgress: z.array(
      z
        .object({
          allocationId: z.string().trim().min(1),
          memberTalentId: z.string().trim().min(1),
          metricCode: metricCodeSchema,
          targetValue: z.number(),
          actualValue: z.number(),
          progressPercent: z.number().nullable(),
          actualEntryCount: z.number().int(),
          missingEntryCount: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();

const managedMemberSchema = z
  .object({
    employmentProfileId: z.string().trim().min(1),
    employeeCode: z.string().trim().min(1).nullable(),
    displayName: z.string().trim().min(1),
    talentId: z.string().trim().min(1),
    talentCode: z.string().trim().min(1).nullable(),
    groupId: z.string().trim().min(1),
  })
  .strict();

const listResponseSchema = z.object({ data: z.array(planListItemSchema) }).strict();
const detailResponseSchema = z.object({ data: planDetailSchema }).strict();
const allocationListResponseSchema = z.object({ data: z.array(allocationSchema) }).strict();
const actualGridResponseSchema = z.object({ data: actualGridSchema }).strict();
const actualEntryResponseSchema = z.object({ data: actualEntrySchema }).strict();
const correctionMutationResponseSchema = z
  .object({
    data: z
      .object({
        actualEntry: actualEntrySchema,
        correction: correctionSchema,
      })
      .strict(),
  })
  .strict();
const correctionListResponseSchema = z.object({ data: z.array(correctionSchema) }).strict();
const progressResponseSchema = z.object({ data: progressSchema }).strict();
const managedMemberListResponseSchema = z.object({ data: z.array(managedMemberSchema) }).strict();

const createPayloadSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    subjectType: executableSubjectTypeSchema,
    subjectId: z.string().trim().min(1),
    currencyCode: z.literal('VND').optional(),
    periodMonth: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}$/),
    periodStartAt: z.number(),
    periodEndAt: z.number(),
    timezone: z.string().trim().min(1).optional(),
    targetMetrics: requiredTargetMetricInputArraySchema,
    allocations: z
      .array(allocationInputSchema)
      .superRefine((items, context) => {
        const seen = new Set<string>();
        items.forEach((item, index) => {
          if (seen.has(item.memberTalentId)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'memberTalentId'],
              message: `Duplicate KPI allocation memberTalentId: ${item.memberTalentId}`,
            });
          }
          seen.add(item.memberTalentId);
        });
      })
      .optional(),
    externalRef: z.string().nullable().optional(),
  })
  .strict();

const draftCorePayloadSchema = createPayloadSchema
  .pick({
    title: true,
    description: true,
    currencyCode: true,
    periodMonth: true,
    periodStartAt: true,
    periodEndAt: true,
    timezone: true,
    externalRef: true,
  })
  .partial()
  .strict();

const sanitizeQuery = (query: KpiPlanQuery): Record<string, string | number | undefined> => ({
  subjectType: query.subjectType,
  subjectId: query.subjectId,
  groupId: query.groupId,
  periodMonth: query.periodMonth,
  status: query.status,
  metricCode: query.metricCode,
  search: query.search,
  limit: query.limit,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeAllocationQuery = (
  query: KpiAllocationQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  kpiPlanId: query.kpiPlanId,
  groupId: query.groupId,
  limit: query.limit,
});

export const sanitizeKpiCreatePlanPayload = (payload: KpiCreatePlanPayload): KpiCreatePlanPayload =>
  createPayloadSchema.parse(payload);

export const sanitizeKpiDraftCorePayload = (payload: KpiDraftCorePayload): KpiDraftCorePayload =>
  draftCorePayloadSchema.parse(payload);

export const fetchKpiPlans = async (query: KpiPlanQuery) => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/kpi/plans',
    params: sanitizeQuery(query),
  });
  return listResponseSchema.parse(response).data;
};

export const createKpiPlan = async (payload: KpiCreatePlanPayload): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, KpiCreatePlanPayload>({
    method: 'POST',
    url: '/admin/kpi/plans',
    data: sanitizeKpiCreatePlanPayload(payload),
  });
  return detailResponseSchema.parse(response).data;
};

export const fetchKpiPlanDetail = async (kpiPlanId: string): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}`,
  });
  return detailResponseSchema.parse(response).data;
};

export const updateKpiDraftCore = async (
  kpiPlanId: string,
  payload: KpiDraftCorePayload,
): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, KpiDraftCorePayload>({
    method: 'PATCH',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/draft-core`,
    data: sanitizeKpiDraftCorePayload(payload),
  });
  return detailResponseSchema.parse(response).data;
};

export const replaceKpiTargetMetrics = async (
  kpiPlanId: string,
  targetMetrics: KpiTargetMetricInput[],
): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, { targetMetrics: KpiTargetMetricInput[] }>({
    method: 'PUT',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/target-metrics`,
    data: z.object({ targetMetrics: requiredTargetMetricInputArraySchema }).strict().parse({
      targetMetrics,
    }),
  });
  return detailResponseSchema.parse(response).data;
};

export const replaceKpiAllocations = async (
  kpiPlanId: string,
  allocations: KpiAllocationInput[],
): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, { allocations: KpiAllocationInput[] }>({
    method: 'PUT',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/allocations`,
    data: z
      .object({
        allocations: z.array(allocationInputSchema).superRefine((items, context) => {
          const seen = new Set<string>();
          items.forEach((item, index) => {
            if (seen.has(item.memberTalentId)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index, 'memberTalentId'],
                message: `Duplicate KPI allocation memberTalentId: ${item.memberTalentId}`,
              });
            }
            seen.add(item.memberTalentId);
          });
        }),
      })
      .strict()
      .parse({ allocations }),
  });
  return detailResponseSchema.parse(response).data;
};

export const fetchKpiAllocations = async (
  query: KpiAllocationQuery = {},
): Promise<KpiAllocation[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/kpi/allocations',
    params: sanitizeAllocationQuery(query),
  });
  return allocationListResponseSchema.parse(response).data;
};

export const upsertKpiAllocationDraft = async (
  kpiPlanId: string,
  allocations: KpiAllocationDraftMemberInput[],
): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, { allocations: KpiAllocationDraftMemberInput[] }>({
    method: 'PUT',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/allocation-draft`,
    data: z
      .object({
        allocations: z
          .array(allocationDraftMemberInputSchema)
          .min(1)
          .superRefine((items, context) => {
            const seen = new Set<string>();
            items.forEach((item, index) => {
              if (seen.has(item.employmentProfileId)) {
                context.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: [index, 'employmentProfileId'],
                  message: `Duplicate KPI allocation employmentProfileId: ${item.employmentProfileId}`,
                });
              }
              seen.add(item.employmentProfileId);
            });
          }),
      })
      .strict()
      .parse({ allocations }),
  });
  return detailResponseSchema.parse(response).data;
};

export const submitKpiAllocationDraft = async (kpiPlanId: string): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, Record<string, never>>({
    method: 'POST',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/allocation-submit`,
    data: {},
  });
  return detailResponseSchema.parse(response).data;
};

export const approveKpiAllocation = async (
  kpiPlanId: string,
  approvalNote?: string | null,
): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, { approvalNote?: string | null }>({
    method: 'POST',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/allocation-approve`,
    data: z
      .object({ approvalNote: z.string().trim().min(1).nullable().optional() })
      .strict()
      .parse({ approvalNote: approvalNote?.trim() || null }),
  });
  return detailResponseSchema.parse(response).data;
};

export const rejectKpiAllocation = async (
  kpiPlanId: string,
  rejectionReason: string,
): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, { rejectionReason: string }>({
    method: 'POST',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/allocation-reject`,
    data: z
      .object({ rejectionReason: z.string().trim().min(1) })
      .strict()
      .parse({ rejectionReason }),
  });
  return detailResponseSchema.parse(response).data;
};

export const publishKpiAllocation = async (kpiPlanId: string): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, Record<string, never>>({
    method: 'POST',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/allocation-publish`,
    data: {},
  });
  return detailResponseSchema.parse(response).data;
};

export const performKpiLifecycleAction = async (
  kpiPlanId: string,
  action: 'publish' | 'archive' | 'finalize',
): Promise<KpiPlanDetail> => {
  const response = await apiRequest<unknown, Record<string, never>>({
    method: 'POST',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/${action}`,
    data: {},
  });
  return detailResponseSchema.parse(response).data;
};

export const fetchKpiProgress = async (kpiPlanId: string): Promise<KpiProgressView> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/progress`,
  });
  return progressResponseSchema.parse(response).data;
};

export const fetchKpiManagedMembers = async (
  kpiPlanId: string,
  query: { search?: string; limit?: number } = {},
): Promise<KpiManagedMemberPickerItem[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/managed-members`,
    params: {
      search: query.search || undefined,
      limit: query.limit,
    },
  });
  return managedMemberListResponseSchema.parse(response).data;
};

export const fetchMyKpiProgress = async (planId: string): Promise<KpiProgressView> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/kpi/my-progress',
    params: { planId },
  });
  return progressResponseSchema.parse(response).data;
};

export const fetchKpiActualDailyGrid = async (
  kpiPlanId: string,
  actualDate: string,
): Promise<KpiActualDailyGrid> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/actuals`,
    params: { actualDate },
  });
  return actualGridResponseSchema.parse(response).data;
};

export const createKpiActual = async (payload: {
  kpiPlanId: string;
  allocationId: string;
  metricCode: KpiTargetMetricInput['metricCode'];
  actualDate: string;
  actualValue: number;
}): Promise<KpiActualEntry> => {
  const data = {
    allocationId: payload.allocationId,
    metricCode: payload.metricCode,
    actualDate: payload.actualDate,
    actualValue: payload.actualValue,
  };
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/kpi/plans/${encodeURIComponent(payload.kpiPlanId)}/actuals`,
    data: z
      .object({
        allocationId: z.string().trim().min(1),
        metricCode: metricCodeSchema,
        actualDate: z
          .string()
          .trim()
          .regex(/^\d{2}-\d{2}-\d{4}$/),
        actualValue: z.number(),
      })
      .strict()
      .parse(data),
  });
  return actualEntryResponseSchema.parse(response).data;
};

export const updateKpiActual = async (payload: {
  kpiPlanId: string;
  actualEntryId: string;
  actualValue: number;
}): Promise<KpiActualEntry> => {
  const response = await apiRequest<unknown>({
    method: 'PATCH',
    url: `/admin/kpi/plans/${encodeURIComponent(payload.kpiPlanId)}/actuals/${encodeURIComponent(
      payload.actualEntryId,
    )}`,
    data: z.object({ actualValue: z.number() }).strict().parse({
      actualValue: payload.actualValue,
    }),
  });
  return actualEntryResponseSchema.parse(response).data;
};

export const createKpiCorrection = async (payload: {
  kpiPlanId: string;
  actualEntryId: string;
  correctedValue: number;
  reason: string;
}): Promise<{ actualEntry: KpiActualEntry; correction: KpiActualCorrection }> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/kpi/plans/${encodeURIComponent(payload.kpiPlanId)}/actuals/${encodeURIComponent(
      payload.actualEntryId,
    )}/corrections`,
    data: z
      .object({
        correctedValue: z.number(),
        reason: z.string().trim().min(1),
      })
      .strict()
      .parse({ correctedValue: payload.correctedValue, reason: payload.reason }),
  });
  return correctionMutationResponseSchema.parse(response).data;
};

export const fetchKpiCorrectionHistory = async (
  kpiPlanId: string,
  actualEntryId: string,
): Promise<KpiActualCorrection[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/kpi/plans/${encodeURIComponent(kpiPlanId)}/actuals/${encodeURIComponent(
      actualEntryId,
    )}/corrections`,
  });
  return correctionListResponseSchema.parse(response).data;
};

export const parseKpiPlanListResponseForTest = (response: unknown) =>
  listResponseSchema.parse(response).data;

export const parseKpiAllocationDraftPayloadForTest = (
  payload: unknown,
): { allocations: KpiAllocationDraftMemberInput[] } =>
  z
    .object({
      allocations: z
        .array(allocationDraftMemberInputSchema)
        .min(1)
        .superRefine((items, context) => {
          const seen = new Set<string>();
          items.forEach((item, index) => {
            if (seen.has(item.employmentProfileId)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index, 'employmentProfileId'],
                message: `Duplicate KPI allocation employmentProfileId: ${item.employmentProfileId}`,
              });
            }
            seen.add(item.employmentProfileId);
          });
        }),
    })
    .strict()
    .parse(payload);

export const parseKpiAllocationListResponseForTest = (response: unknown): KpiAllocation[] =>
  allocationListResponseSchema.parse(response).data;
