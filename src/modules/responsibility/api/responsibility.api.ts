import { z } from 'zod';

import { apiRequest } from '@shared/api';
import type {
  CreateResponsibilityPayload,
  ResponsibilityAssignment,
  ResponsibilityListQuery,
  ResponsibilitySubjectType,
  ResponsibilitySummary,
} from '@modules/responsibility/types/responsibility.types';

const referenceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    displayName: z.string().optional(),
    handle: z.string().optional(),
    platform: z.string().optional(),
    status: z.string().optional(),
  })
  .strict();

const responsibilityAssignmentSchema = z
  .object({
    id: z.string().trim().min(1),
    subjectType: z.enum(['TALENT_GROUP', 'ORG_UNIT', 'TALENT', 'EMPLOYMENT_PROFILE']),
    subjectId: z.string().trim().min(1),
    responsibleEmploymentProfileId: z.string().trim().min(1),
    responsibilityType: z.enum([
      'TALENT_GROUP_MANAGER',
      'ORG_UNIT_MANAGER',
      'TALENT_DIRECT_MANAGER',
      'EMPLOYMENT_REPORTING_MANAGER',
    ]),
    responsibilityRole: z.string().nullable().default(null),
    includeDescendants: z.boolean().nullable().default(null),
    actionMask: z.array(z.string()).default([]),
    isPrimary: z.boolean(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'REVOKED']),
    effectiveAt: z.union([z.number(), z.string()]),
    expiresAt: z.union([z.number(), z.string()]).nullable().default(null),
    revokedAt: z.union([z.number(), z.string()]).nullable().default(null),
    reason: z.string().nullable().default(null),
    createdBy: z.string(),
    createdAt: z.union([z.number(), z.string()]),
    updatedBy: z.string(),
    updatedAt: z.union([z.number(), z.string()]),
    revokedBy: z.string().nullable().default(null),
    revokedReason: z.string().nullable().default(null),
    reviewNeeded: z.boolean(),
    reviewReason: z.string().nullable().default(null),
    subjectRef: referenceSummarySchema.nullable().default(null),
    responsibleEmploymentProfileRef: referenceSummarySchema.nullable().default(null),
  })
  .strict();

const listResponseSchema = z
  .object({
    data: z.array(responsibilityAssignmentSchema),
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: responsibilityAssignmentSchema,
  })
  .strict();

const summaryResponseSchema = z
  .object({
    data: z.array(responsibilityAssignmentSchema),
    meta: z
      .object({
        inherited: z.array(responsibilityAssignmentSchema).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const fetchResponsibilities = async (
  query: ResponsibilityListQuery,
): Promise<ResponsibilityAssignment[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/responsibilities',
    params: query,
  });

  return listResponseSchema.parse(response).data;
};

export const fetchResponsibilitySummary = async (
  subjectType: ResponsibilitySubjectType,
  subjectId: string,
): Promise<ResponsibilitySummary> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/responsibilities/summary/${encodeURIComponent(
      subjectType,
    )}/${encodeURIComponent(subjectId)}`,
  });
  const parsed = summaryResponseSchema.parse(response);

  return {
    items: parsed.data,
    inherited: parsed.meta?.inherited ?? [],
  };
};

export const createResponsibility = async (
  payload: CreateResponsibilityPayload,
): Promise<ResponsibilityAssignment> => {
  const response = await apiRequest<unknown, CreateResponsibilityPayload>({
    method: 'POST',
    url: '/admin/responsibilities',
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const revokeResponsibility = async (
  assignmentId: string,
  reason?: string | null,
): Promise<ResponsibilityAssignment> => {
  const response = await apiRequest<unknown, { reason?: string | null }>({
    method: 'POST',
    url: `/admin/responsibilities/${encodeURIComponent(assignmentId)}/revoke`,
    data: { reason },
  });

  return detailResponseSchema.parse(response).data;
};
