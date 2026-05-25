import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const SELF_SERVICE_CURRENT_PERSON_QUERY_KEY = ['self-service', 'current-person'] as const;
export const SELF_SERVICE_WORK_SHIFTS_QUERY_KEY = ['self-service', 'work-shifts'] as const;
export const SELF_SERVICE_EVENTS_QUERY_KEY = ['self-service', 'events'] as const;

const linkedInternalTalentSchema = z
  .object({
    talentId: z.string().trim().min(1),
    talentCode: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    performanceAlias: z.string().trim().min(1).nullable(),
  })
  .strict();

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
    locale: z.string().trim().min(1).optional(),
    timezone: z.string().trim().min(1).optional(),
  })
  .strict();

const selfServiceCurrentPersonResponseSchema = z
  .object({
    data: selfServiceCurrentPersonSchema,
  })
  .strict();

export type SelfServiceCurrentPerson = z.infer<typeof selfServiceCurrentPersonSchema>;

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
