import { z } from 'zod';

import { apiRequest } from '@shared/api';

import type {
  CursorPagedResponse,
  EmploymentProfileContractStatusPayload,
  EmploymentProfileCreatePayload,
  EmploymentProfileDirectReport,
  EmploymentProfileDirectReportsQuery,
  EmploymentProfileLifecycleAction,
  EmploymentProfileListItem,
  EmploymentProfileListQuery,
  EmploymentProfileManagerAssignmentPayload,
  EmploymentProfileOrgUnitAssignmentPayload,
  EmploymentProfileRecord,
  EmploymentProfileTerminatePayload,
  EmploymentProfileUpdatePayload,
  EmploymentProfileUserLinkPayload,
} from '@modules/employment-profile/types/employment-profile.types';

const employmentStatusSchema = z.enum([
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'TERMINATED',
  'ARCHIVED',
]);
const contractStatusSchema = z.enum([
  'NONE',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
]);
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isUtcMidnightTimestamp = (value: number): boolean => {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && value % MS_PER_DAY === 0;
};

const parseCanonicalDateToUtcMidnight = (value: string): number => {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const date = new Date(utcMidnight);

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? utcMidnight
    : Number.NaN;
};

const isCanonicalDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parseCanonicalDateToUtcMidnight(value));

const canonicalDateSchema = z.string().trim().refine(isCanonicalDate);

const utcMidnightDateLikeSchema = z.union([
  z.number().refine(isUtcMidnightTimestamp),
  canonicalDateSchema.transform(parseCanonicalDateToUtcMidnight),
]);

const employmentProfileListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    employeeCode: z.string().trim().min(1),
    legalName: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    employmentKind: z.string().trim().min(1),
    jobTitle: z.string().trim().min(1),
    orgUnitId: z.string().trim().min(1),
    orgUnitRef: referenceSummarySchema.nullable().optional(),
    managerEmploymentProfileId: z.string().trim().min(1).nullable().optional(),
    managerEmploymentProfileRef: referenceSummarySchema.nullable().optional(),
    linkedUserId: z.string().trim().min(1).nullable().optional(),
    linkedUserRef: referenceSummarySchema.nullable().optional(),
    employmentStatus: employmentStatusSchema,
    contractStatus: contractStatusSchema,
    createdAt: z.union([z.number(), z.string()]),
  })
  .strict();

const employmentProfileDetailSchema = z
  .object({
    id: z.string().trim().min(1),
    employeeCode: z.string().trim().min(1),
    legalName: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    employmentKind: z.string().trim().min(1),
    jobTitle: z.string().trim().min(1),
    titleDescription: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    orgUnitId: z.string().trim().min(1),
    orgUnitRef: referenceSummarySchema.nullable().optional(),
    managerEmploymentProfileId: z.string().trim().min(1).nullable().optional(),
    managerEmploymentProfileRef: referenceSummarySchema.nullable().optional(),
    linkedUserId: z.string().trim().min(1).nullable().optional(),
    linkedUserRef: referenceSummarySchema.nullable().optional(),
    employmentStatus: employmentStatusSchema,
    contractStatus: contractStatusSchema,
    employmentStartDate: utcMidnightDateLikeSchema,
    employmentEndDate: utcMidnightDateLikeSchema.nullable().optional(),
    createdAt: z.union([z.number(), z.string()]),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const employmentProfileDirectReportSchema = z
  .object({
    id: z.string().trim().min(1),
    employeeCode: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    employmentStatus: employmentStatusSchema,
    contractStatus: contractStatusSchema,
    orgUnitId: z.string().trim().min(1),
    orgUnitRef: referenceSummarySchema.nullable().optional(),
    managerEmploymentProfileId: z.string().trim().min(1).nullable().optional(),
    managerEmploymentProfileRef: referenceSummarySchema.nullable().optional(),
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
    data: z.array(employmentProfileListItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: employmentProfileDetailSchema,
  })
  .strict();

const directReportsResponseSchema = z
  .object({
    data: z.array(employmentProfileDirectReportSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const toBackendSortDirection = (
  sortDirection: EmploymentProfileListQuery['sortDirection'],
): 'ASC' | 'DESC' | undefined => {
  if (sortDirection === 'asc') {
    return 'ASC';
  }

  if (sortDirection === 'desc') {
    return 'DESC';
  }

  return undefined;
};

const sanitizeListQuery = (
  query: EmploymentProfileListQuery,
): Record<string, string | number | boolean | undefined> => {
  return {
    employmentStatus: query.employmentStatus,
    contractStatus: query.contractStatus,
    employmentKind: query.employmentKind,
    orgUnitId: query.orgUnitId,
    managerEmploymentProfileId: query.managerEmploymentProfileId,
    hasLinkedUser: query.hasLinkedUser,
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: toBackendSortDirection(query.sortDirection),
  };
};

export const fetchEmploymentProfiles = async (
  query: EmploymentProfileListQuery,
): Promise<CursorPagedResponse<EmploymentProfileListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/employment-profiles',
    params: sanitizeListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchEmploymentProfileDetail = async (
  employmentProfileId: string,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const fetchEmploymentProfileDirectReports = async (
  employmentProfileId: string,
  query: EmploymentProfileDirectReportsQuery,
): Promise<CursorPagedResponse<EmploymentProfileDirectReport>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/direct-reports`,
    params: {
      sortBy: query.sortBy,
      sortDirection: toBackendSortDirection(query.sortDirection),
      limit: query.limit,
      cursor: query.cursor,
    },
  });

  return directReportsResponseSchema.parse(response);
};

export const createEmploymentProfile = async (
  payload: EmploymentProfileCreatePayload,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown, EmploymentProfileCreatePayload>({
    method: 'POST',
    url: '/admin/employment-profiles',
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const updateEmploymentProfile = async (
  employmentProfileId: string,
  payload: EmploymentProfileUpdatePayload,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown, EmploymentProfileUpdatePayload>({
    method: 'PATCH',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const assignEmploymentProfileOrgUnit = async (
  employmentProfileId: string,
  payload: EmploymentProfileOrgUnitAssignmentPayload,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown, EmploymentProfileOrgUnitAssignmentPayload>({
    method: 'POST',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/org-unit-assignment`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const assignEmploymentProfileManager = async (
  employmentProfileId: string,
  payload: EmploymentProfileManagerAssignmentPayload,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown, EmploymentProfileManagerAssignmentPayload>({
    method: 'POST',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/manager-assignment`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const linkEmploymentProfileUser = async (
  employmentProfileId: string,
  payload: EmploymentProfileUserLinkPayload,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown, EmploymentProfileUserLinkPayload>({
    method: 'POST',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/user-link`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const unlinkEmploymentProfileUser = async (
  employmentProfileId: string,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/user-unlink`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};

export const updateEmploymentProfileContractStatus = async (
  employmentProfileId: string,
  payload: EmploymentProfileContractStatusPayload,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown, EmploymentProfileContractStatusPayload>({
    method: 'POST',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/contract-status`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const terminateEmploymentProfile = async (
  employmentProfileId: string,
  payload: EmploymentProfileTerminatePayload,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown, EmploymentProfileTerminatePayload>({
    method: 'POST',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/terminate`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const performEmploymentProfileLifecycleAction = async (
  employmentProfileId: string,
  action: EmploymentProfileLifecycleAction,
): Promise<EmploymentProfileRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};
