import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const SELF_SERVICE_CURRENT_PERSON_QUERY_KEY = ['self-service', 'current-person'] as const;
export const SELF_SERVICE_WORK_SHIFTS_QUERY_KEY = ['self-service', 'work-shifts'] as const;
export const SELF_SERVICE_EVENTS_QUERY_KEY = ['self-service', 'events'] as const;
export const SELF_SERVICE_KPI_QUERY_KEY = ['self-service', 'kpi'] as const;

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
        nextCursor: z.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SelfServiceEvent = z.infer<typeof selfServiceEventSchema>;

const selfServiceKpiMetricSchema = z
  .object({
    metricCode: z.enum([
      'REVENUE_VND',
      'CONTENT_OUTPUT_COUNT',
      'LIVE_HOURS',
      'EVENT_COMPLETION_COUNT',
      'ONBOARDED_TALENT_COUNT',
    ]),
    unit: z.enum(['VND', 'COUNT', 'HOUR']),
    targetValue: z.number(),
    actualValue: z.number(),
    progressPercent: z.number().nullable(),
  })
  .strict();

const selfServiceKpiItemSchema = z
  .object({
    kpiPlanId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    periodStartAt: z.number().int(),
    periodEndAt: z.number().int(),
    officialStatus: z.literal('OFFICIAL_PUBLISHED'),
    lastUpdatedAt: z.number().int(),
    metrics: z.array(selfServiceKpiMetricSchema),
  })
  .strict();

const selfServiceKpiResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(selfServiceKpiItemSchema),
      })
      .strict(),
  })
  .strict();

export type SelfServiceKpiItem = z.infer<typeof selfServiceKpiItemSchema>;
export type SelfServiceKpiMetric = z.infer<typeof selfServiceKpiMetricSchema>;

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

export const fetchSelfServiceWorkShifts = async (): Promise<SelfServiceWorkShift[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/self-service/work-shifts',
  });

  return selfServiceWorkShiftsResponseSchema.parse(response).data;
};

export const useSelfServiceWorkShifts = (enabled = true) =>
  useQuery({
    queryKey: SELF_SERVICE_WORK_SHIFTS_QUERY_KEY,
    queryFn: fetchSelfServiceWorkShifts,
    enabled,
    retry: false,
  });

export const fetchSelfServiceEvents = async (): Promise<SelfServiceEvent[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/self-service/events',
  });

  return selfServiceEventsResponseSchema.parse(response).data;
};

export const useSelfServiceEvents = (enabled = true) =>
  useQuery({
    queryKey: SELF_SERVICE_EVENTS_QUERY_KEY,
    queryFn: fetchSelfServiceEvents,
    enabled,
    retry: false,
  });

export const fetchSelfServiceKpi = async (): Promise<SelfServiceKpiItem[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/self-service/kpi',
  });

  return selfServiceKpiResponseSchema.parse(response).data.items;
};

export const useSelfServiceKpi = (enabled = true) =>
  useQuery({
    queryKey: SELF_SERVICE_KPI_QUERY_KEY,
    queryFn: fetchSelfServiceKpi,
    enabled,
    retry: false,
  });
