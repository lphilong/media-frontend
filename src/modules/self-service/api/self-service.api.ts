import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const SELF_SERVICE_CURRENT_PERSON_QUERY_KEY = ['self-service', 'current-person'] as const;

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
