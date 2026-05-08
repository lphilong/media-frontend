import { z } from 'zod';

import { apiRequest } from '@shared/api';

import {
  talentCommercialParticipationStatusValues,
  talentOriginValues,
} from '@modules/talent/types/talent.types';
import type {
  CursorPagedResponse,
  TalentCommercialParticipationPayload,
  TalentCreatePayload,
  TalentCommercialParticipationStatus,
  TalentEmploymentProfileLinkPayload,
  TalentLifecycleAction,
  TalentOrigin,
  TalentListQuery,
  TalentManagerAssignmentPayload,
  TalentRecord,
  TalentUpdatePayload,
} from '@modules/talent/types/talent.types';

const talentOperationalStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED']);
const talentOriginSchema = z.enum(talentOriginValues);
const talentCommercialParticipationStatusSchema = z.enum(talentCommercialParticipationStatusValues);

const listTalentSchema = z
  .object({
    id: z.string().trim().min(1),
    talentCode: z.string().trim().min(1),
    stageName: z.string().trim().min(1),
    legalName: z.string().trim().min(1),
    displayShortName: z.string().nullable().optional(),
    talentOrigin: talentOriginSchema,
    operationalStatus: talentOperationalStatusSchema,
    managerEmploymentProfileId: z.string().trim().min(1).nullable().optional(),
    linkedEmploymentProfileId: z.string().trim().min(1).nullable().optional(),
    commercialParticipationStatus: talentCommercialParticipationStatusSchema,
    livestreamEligible: z.boolean(),
    eventEligible: z.boolean(),
    createdAt: z.union([z.number(), z.string()]),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const detailTalentSchema = listTalentSchema
  .extend({
    externalRef: z.string().nullable().optional(),
    profileSummary: z.string().nullable().optional(),
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
    data: z.array(listTalentSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: detailTalentSchema,
  })
  .strict();

const sanitizeListQuery = (
  query: TalentListQuery,
): Record<string, string | number | boolean | undefined> => {
  return {
    operationalStatus: query.operationalStatus,
    talentOrigin: query.talentOrigin,
    managerEmploymentProfileId: query.managerEmploymentProfileId,
    hasLinkedEmploymentProfile: query.hasLinkedEmploymentProfile,
    commercialParticipationStatus: query.commercialParticipationStatus,
    livestreamEligible: query.livestreamEligible,
    eventEligible: query.eventEligible,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    limit: query.limit,
    cursor: query.cursor,
  };
};

const parseTalentOrigin = (value: unknown): TalentOrigin => {
  return talentOriginSchema.parse(value);
};

const parseTalentCommercialParticipationStatus = (
  value: unknown,
): TalentCommercialParticipationStatus => {
  return talentCommercialParticipationStatusSchema.parse(value);
};

export const fetchTalents = async (
  query: TalentListQuery,
): Promise<CursorPagedResponse<TalentRecord>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/talents',
    params: sanitizeListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchTalentDetail = async (talentId: string): Promise<TalentRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/talents/${encodeURIComponent(talentId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const createTalent = async (payload: TalentCreatePayload): Promise<TalentRecord> => {
  const response = await apiRequest<unknown, TalentCreatePayload>({
    method: 'POST',
    url: '/admin/talents',
    data: {
      ...payload,
      talentOrigin: parseTalentOrigin(payload.talentOrigin),
      commercialParticipationStatus: parseTalentCommercialParticipationStatus(
        payload.commercialParticipationStatus,
      ),
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const updateTalent = async (
  talentId: string,
  payload: TalentUpdatePayload,
): Promise<TalentRecord> => {
  const response = await apiRequest<unknown, TalentUpdatePayload>({
    method: 'PATCH',
    url: `/admin/talents/${encodeURIComponent(talentId)}`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const assignTalentManager = async (
  talentId: string,
  payload: TalentManagerAssignmentPayload,
): Promise<TalentRecord> => {
  const response = await apiRequest<unknown, TalentManagerAssignmentPayload>({
    method: 'POST',
    url: `/admin/talents/${encodeURIComponent(talentId)}/manager-assignment`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const linkTalentEmploymentProfile = async (
  talentId: string,
  payload: TalentEmploymentProfileLinkPayload,
): Promise<TalentRecord> => {
  const response = await apiRequest<unknown, TalentEmploymentProfileLinkPayload>({
    method: 'POST',
    url: `/admin/talents/${encodeURIComponent(talentId)}/employment-profile-link`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const updateTalentCommercialParticipation = async (
  talentId: string,
  payload: TalentCommercialParticipationPayload,
): Promise<TalentRecord> => {
  const response = await apiRequest<unknown, TalentCommercialParticipationPayload>({
    method: 'POST',
    url: `/admin/talents/${encodeURIComponent(talentId)}/commercial-participation-status`,
    data: {
      ...payload,
      newCommercialParticipationStatus: parseTalentCommercialParticipationStatus(
        payload.newCommercialParticipationStatus,
      ),
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const performTalentLifecycleAction = async (
  talentId: string,
  action: TalentLifecycleAction,
): Promise<TalentRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/talents/${encodeURIComponent(talentId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};
