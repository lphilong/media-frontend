import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const SELF_SERVICE_CURRENT_PERSON_QUERY_KEY = ['self-service', 'current-person'] as const;
export const SELF_SERVICE_WORK_SHIFTS_QUERY_KEY = ['self-service', 'work-shifts'] as const;
export const SELF_SERVICE_EVENTS_QUERY_KEY = ['self-service', 'events'] as const;
export const SELF_SERVICE_KPI_QUERY_KEY = ['self-service', 'kpi'] as const;
export const SELF_SERVICE_TALENT_GROUPS_QUERY_KEY = ['self-service', 'talent-groups'] as const;

export const SELF_SERVICE_SUPPORTED_LOCALES = ['en', 'vi', 'zh'] as const;
export const SELF_SERVICE_TIMEZONE_OPTIONS = [
  'Asia/Saigon',
  'Asia/Ho_Chi_Minh',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
] as const;

const linkedInternalTalentSchema = z
  .object({
    talentId: z.string().trim().min(1),
    talentCode: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    performanceAlias: z.string().trim().min(1).nullable(),
  })
  .strict();

const nullableOptionalTextSchema = z
  .string()
  .trim()
  .min(1)
  .nullish()
  .transform((value) => value ?? undefined);

export const selfServiceCurrentPersonSchema = z
  .object({
    employmentProfileId: z.string().trim().min(1),
    employeeCode: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ARCHIVED']),
    accountEmail: z.string().trim().min(1).optional(),
    accountStatus: z.enum(['PENDING', 'ACTIVE', 'DISABLED', 'ARCHIVED']).optional(),
    accountLinkStatus: z.literal('LINKED'),
    linkedInternalTalent: linkedInternalTalentSchema.optional(),
    locale: nullableOptionalTextSchema,
    timezone: nullableOptionalTextSchema,
  })
  .strict();

const selfServiceCurrentPersonResponseSchema = z
  .object({
    data: selfServiceCurrentPersonSchema,
  })
  .strict();

export type SelfServiceCurrentPerson = z.infer<typeof selfServiceCurrentPersonSchema>;

const selfServiceAccountPreferencesPayloadSchema = z
  .object({
    locale: z.enum(SELF_SERVICE_SUPPORTED_LOCALES).optional(),
    timezone: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((value) => value.locale !== undefined || value.timezone !== undefined, {
    message: 'At least one preference is required.',
  });

export type SelfServiceAccountPreferencesPayload = z.infer<
  typeof selfServiceAccountPreferencesPayloadSchema
>;

const selfServiceWorkShiftSchema = z
  .object({
    workShiftId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    status: z.enum(['ACTIVE', 'CANCELLED', 'ARCHIVED']),
    startsAt: z.number().int(),
    endsAt: z.number().int(),
    sourceType: z.enum(['MANUAL', 'ROSTER_GENERATED']),
  })
  .strict();

const selfServiceWorkShiftsResponseSchema = z
  .object({
    data: z.array(selfServiceWorkShiftSchema),
    meta: z
      .object({
        nextCursor: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SelfServiceWorkShift = z.infer<typeof selfServiceWorkShiftSchema>;
export type SelfServiceListEnvelope<TItem, TMeta = Record<string, unknown>> = {
  items: TItem[];
  meta?: TMeta;
};
export type SelfServiceWorkShiftsMeta = z.infer<typeof selfServiceWorkShiftsResponseSchema>['meta'];

const selfServiceEventSchema = z
  .object({
    eventId: z.string().trim().min(1),
    eventCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED']),
    startsAt: z.number().int(),
    endsAt: z.number().int(),
    ownAssignmentKind: z.enum(['EMPLOYMENT_PROFILE', 'TALENT']),
    ownAssignmentStatus: z.enum(['ACTIVE', 'REMOVED']),
  })
  .strict();

const selfServiceEventsResponseSchema = z
  .object({
    data: z.array(selfServiceEventSchema),
    meta: z
      .object({
        window: z
          .object({
            recentPastDays: z.number().int().nonnegative(),
            upcomingDays: z.number().int().nonnegative(),
            windowStartAt: z.number().int(),
            windowEndAt: z.number().int(),
          })
          .strict()
          .optional(),
        limit: z.number().int().positive().optional(),
        truncated: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SelfServiceEvent = z.infer<typeof selfServiceEventSchema>;
export type SelfServiceEventsMeta = z.infer<typeof selfServiceEventsResponseSchema>['meta'];

const selfServiceKpiMetricSchema = z
  .object({
    metricCode: z.enum([
      'REVENUE_VND',
      'CONTENT_OUTPUT_COUNT',
      'LIVE_HOURS',
      'EVENT_COMPLETION_COUNT',
      'ONBOARDED_TALENT_COUNT',
      'TIKTOK_DIAMOND',
    ]),
    unit: z.enum(['VND', 'COUNT', 'HOUR']),
    targetValue: z.number(),
    actualValue: z.number(),
    progressPercent: z.number().nullable(),
  })
  .strict();

const selfServiceKpiActualEntryStatusSummarySchema = z
  .object({
    expectedEntryCount: z.number().int().nonnegative(),
    enteredEntryCount: z.number().int().nonnegative(),
    enteredZeroCount: z.number().int().nonnegative(),
    pendingEntryCount: z.number().int().nonnegative(),
    overdueEntryCount: z.number().int().nonnegative(),
    excusedEntryCount: z.number().int().nonnegative(),
    notRequiredEntryCount: z.number().int().nonnegative(),
    notDueEntryCount: z.number().int().nonnegative(),
  })
  .strict();

const selfServiceKpiItemSchema = z
  .object({
    kpiPlanId: z.string().trim().min(1),
    planCode: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1),
    periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    periodStartAt: z.number().int(),
    periodEndAt: z.number().int(),
    officialStatus: z.enum(['OFFICIAL_PUBLISHED', 'OFFICIAL_FINALIZED']),
    isCurrentPeriod: z.boolean().optional(),
    isPreviousPeriod: z.boolean().optional(),
    isReadOnly: z.literal(true).optional(),
    lastUpdatedAt: z.number().int(),
    metrics: z.array(selfServiceKpiMetricSchema),
    actualEntryStatusSummary: selfServiceKpiActualEntryStatusSummarySchema.optional(),
  })
  .strict();

const selfServiceKpiResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(selfServiceKpiItemSchema),
        current: selfServiceKpiItemSchema.nullable().optional(),
        latestPrevious: selfServiceKpiItemSchema.nullable().optional(),
        history: z.array(selfServiceKpiItemSchema).optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export type SelfServiceKpiItem = z.infer<typeof selfServiceKpiItemSchema>;
export type SelfServiceKpiMetric = z.infer<typeof selfServiceKpiMetricSchema>;
export type SelfServiceKpiActualEntryStatusSummary = z.infer<
  typeof selfServiceKpiActualEntryStatusSummarySchema
>;
export type SelfServiceKpiMeta = z.infer<typeof selfServiceKpiResponseSchema>['data']['meta'];
export type SelfServiceKpiEnvelope = {
  items: SelfServiceKpiItem[];
  current?: SelfServiceKpiItem | null;
  latestPrevious?: SelfServiceKpiItem | null;
  history?: SelfServiceKpiItem[];
  meta?: SelfServiceKpiMeta;
};

const selfServiceTalentGroupManagerSchema = z
  .object({
    displayName: z.string().trim().min(1),
    employeeCode: z.string().trim().min(1).optional(),
  })
  .strict();

const selfServiceTalentGroupMemberSchema = z
  .object({
    talentCode: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    performanceAlias: z.string().trim().min(1).optional(),
    origin: z.enum(['INTERNAL', 'EXTERNAL']),
  })
  .strict();

const selfServiceTalentGroupSchema = z
  .object({
    talentGroupCode: z.string().trim().min(1),
    name: z.string().trim().min(1),
    status: z.literal('ACTIVE').optional(),
    managers: z.array(selfServiceTalentGroupManagerSchema),
    members: z.array(selfServiceTalentGroupMemberSchema),
    managersTruncated: z.boolean().optional(),
    maxManagers: z.number().int().positive().optional(),
    membersTruncated: z.boolean().optional(),
    maxMembers: z.number().int().positive().optional(),
  })
  .strict();

const selfServiceTalentGroupsResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(selfServiceTalentGroupSchema),
        meta: z
          .object({
            groupsTruncated: z.boolean().optional(),
            maxGroups: z.number().int().positive().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

export type SelfServiceTalentGroup = z.infer<typeof selfServiceTalentGroupSchema>;
export type SelfServiceTalentGroupsMeta = z.infer<
  typeof selfServiceTalentGroupsResponseSchema
>['data']['meta'];

export const fetchSelfServiceCurrentPerson = async (): Promise<SelfServiceCurrentPerson> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/self-service/me',
  });

  return selfServiceCurrentPersonResponseSchema.parse(response).data;
};

export const useSelfServiceCurrentPerson = () =>
  useQuery({
    queryKey: SELF_SERVICE_CURRENT_PERSON_QUERY_KEY,
    queryFn: fetchSelfServiceCurrentPerson,
    retry: false,
  });

export const updateSelfServiceAccountPreferences = async (
  payload: SelfServiceAccountPreferencesPayload,
): Promise<SelfServiceCurrentPerson> => {
  const parsedPayload = selfServiceAccountPreferencesPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, SelfServiceAccountPreferencesPayload>({
    method: 'PATCH',
    url: '/self-service/account/preferences',
    data: parsedPayload,
  });

  return selfServiceCurrentPersonResponseSchema.parse(response).data;
};

export const useUpdateSelfServiceAccountPreferences = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSelfServiceAccountPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(SELF_SERVICE_CURRENT_PERSON_QUERY_KEY, data);
    },
  });
};

export const fetchSelfServiceWorkShifts = async (
  cursor?: string,
): Promise<SelfServiceListEnvelope<SelfServiceWorkShift, SelfServiceWorkShiftsMeta>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/self-service/work-shifts',
    params: cursor ? { cursor } : undefined,
  });
  const parsed = selfServiceWorkShiftsResponseSchema.parse(response);

  return { items: parsed.data, meta: parsed.meta };
};

export const useSelfServiceWorkShifts = (enabled = true, cursor?: string) =>
  useQuery({
    queryKey: [...SELF_SERVICE_WORK_SHIFTS_QUERY_KEY, cursor ?? null],
    queryFn: () => fetchSelfServiceWorkShifts(cursor),
    enabled,
    retry: false,
  });

export const fetchSelfServiceEvents = async (): Promise<
  SelfServiceListEnvelope<SelfServiceEvent, SelfServiceEventsMeta>
> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/self-service/events',
  });
  const parsed = selfServiceEventsResponseSchema.parse(response);

  return { items: parsed.data, meta: parsed.meta };
};

export const useSelfServiceEvents = (enabled = true) =>
  useQuery({
    queryKey: SELF_SERVICE_EVENTS_QUERY_KEY,
    queryFn: fetchSelfServiceEvents,
    enabled,
    retry: false,
  });

export const fetchSelfServiceKpi = async (): Promise<SelfServiceKpiEnvelope> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/self-service/kpi',
  });
  const parsed = selfServiceKpiResponseSchema.parse(response);
  const hasCurrent = Object.prototype.hasOwnProperty.call(parsed.data, 'current');
  const hasLatestPrevious = Object.prototype.hasOwnProperty.call(parsed.data, 'latestPrevious');
  const hasHistory = Object.prototype.hasOwnProperty.call(parsed.data, 'history');

  return {
    items: parsed.data.items,
    ...(hasCurrent ? { current: parsed.data.current } : {}),
    ...(hasLatestPrevious ? { latestPrevious: parsed.data.latestPrevious } : {}),
    ...(hasHistory ? { history: parsed.data.history ?? [] } : {}),
    meta: parsed.data.meta,
  };
};

export const useSelfServiceKpi = (enabled = true) =>
  useQuery({
    queryKey: SELF_SERVICE_KPI_QUERY_KEY,
    queryFn: fetchSelfServiceKpi,
    enabled,
    retry: false,
  });

export const fetchSelfServiceTalentGroups = async (): Promise<
  SelfServiceListEnvelope<SelfServiceTalentGroup, SelfServiceTalentGroupsMeta>
> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/self-service/talent-groups',
  });
  const parsed = selfServiceTalentGroupsResponseSchema.parse(response);

  return { items: parsed.data.items, meta: parsed.data.meta };
};

export const useSelfServiceTalentGroups = (enabled = true) =>
  useQuery({
    queryKey: SELF_SERVICE_TALENT_GROUPS_QUERY_KEY,
    queryFn: fetchSelfServiceTalentGroups,
    enabled,
    retry: false,
  });
