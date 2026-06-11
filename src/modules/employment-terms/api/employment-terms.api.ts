import { z } from 'zod';

import { apiRequest } from '@shared/api';
import type {
  EmploymentTermsPayload,
  EmploymentTermsRecord,
} from '@modules/employment-terms/types/employment-terms.types';

const canonicalDateSchema = z.number().int().nonnegative();
const canonicalDateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Invalid canonical date');
const statusSchema = z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED', 'CANCELLED']);
const allowanceCommonShape = {
  type: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  payrollEligible: z.boolean(),
  effectiveFrom: canonicalDateSchema.nullable(),
  effectiveTo: canonicalDateSchema.nullable(),
  sourceNote: z.string().max(500).nullable(),
};
const sensitiveAllowanceSchema = z
  .object({
    ...allowanceCommonShape,
    amount: z.number().nonnegative(),
  })
  .strict();
const redactedAllowanceSchema = z.object(allowanceCommonShape).strict();
const recordCommonShape = {
  id: z.string().min(1),
  termsCode: z.string().min(1),
  employmentProfileId: z.string().min(1),
  status: statusSchema,
  effectiveFrom: canonicalDateSchema,
  effectiveTo: canonicalDateSchema.nullable(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  payFrequency: z.literal('MONTHLY'),
  payrollEligible: z.boolean(),
  sourceNote: z.string().max(500).nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  submittedAt: z.number().nullable(),
  approvedAt: z.number().nullable(),
  cancelledAt: z.number().nullable(),
  supersedesTermsId: z.string().nullable(),
  supersededByTermsId: z.string().nullable(),
  version: z.number().int().positive(),
};
const sensitiveRecordSchema = z
  .object({
    ...recordCommonShape,
    baseSalaryAmount: z.number().nonnegative(),
    allowances: z.array(sensitiveAllowanceSchema).max(20),
    sensitiveAmountsRedacted: z.literal(false),
  })
  .strict();
const redactedRecordSchema = z
  .object({
    ...recordCommonShape,
    allowances: z.array(redactedAllowanceSchema).max(20),
    sensitiveAmountsRedacted: z.literal(true),
  })
  .strict();
export const employmentTermsRecordSchema = z.discriminatedUnion('sensitiveAmountsRedacted', [
  sensitiveRecordSchema,
  redactedRecordSchema,
]);
const payloadAllowanceSchema = z
  .object({
    type: z.string().min(1).max(64),
    label: z.string().min(1).max(120),
    amount: z.number().finite().nonnegative(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    payrollEligible: z.boolean(),
    effectiveFrom: canonicalDateInputSchema.nullable(),
    effectiveTo: canonicalDateInputSchema.nullable(),
    sourceNote: z.string().max(500).nullable(),
  })
  .strict()
  .refine(
    (allowance) =>
      !allowance.effectiveFrom ||
      !allowance.effectiveTo ||
      allowance.effectiveTo >= allowance.effectiveFrom,
    { message: 'Allowance effectiveTo must not be before effectiveFrom' },
  );
export const employmentTermsPayloadSchema = z
  .object({
    effectiveFrom: canonicalDateInputSchema,
    effectiveTo: canonicalDateInputSchema.nullable(),
    baseSalaryAmount: z.number().finite().nonnegative(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    payFrequency: z.literal('MONTHLY'),
    allowances: z.array(payloadAllowanceSchema).max(20),
    payrollEligible: z.boolean(),
    sourceNote: z.string().max(500).nullable(),
  })
  .strict()
  .refine((payload) => !payload.effectiveTo || payload.effectiveTo >= payload.effectiveFrom, {
    message: 'effectiveTo must not be before effectiveFrom',
  });
const detailResponseSchema = z.object({ data: employmentTermsRecordSchema }).strict();
const listResponseSchema = z.object({ data: z.array(employmentTermsRecordSchema) }).strict();

const baseUrl = (employmentProfileId: string): string =>
  `/admin/employment-profiles/${encodeURIComponent(employmentProfileId)}/employment-terms`;

export const fetchEmploymentTerms = async (
  employmentProfileId: string,
): Promise<EmploymentTermsRecord[]> => {
  const response = await apiRequest<unknown>({ method: 'GET', url: baseUrl(employmentProfileId) });
  return listResponseSchema.parse(response).data;
};

export const fetchEmploymentTermsDetail = async (
  employmentProfileId: string,
  termsId: string,
): Promise<EmploymentTermsRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `${baseUrl(employmentProfileId)}/${encodeURIComponent(termsId)}`,
  });
  return detailResponseSchema.parse(response).data;
};

export const createEmploymentTerms = async (
  employmentProfileId: string,
  payload: EmploymentTermsPayload,
): Promise<EmploymentTermsRecord> => {
  const validatedPayload = employmentTermsPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, EmploymentTermsPayload>({
    method: 'POST',
    url: baseUrl(employmentProfileId),
    data: validatedPayload,
  });
  return detailResponseSchema.parse(response).data;
};

export const updateEmploymentTerms = async (
  employmentProfileId: string,
  termsId: string,
  payload: EmploymentTermsPayload,
): Promise<EmploymentTermsRecord> => {
  const validatedPayload = employmentTermsPayloadSchema.parse(payload);
  const response = await apiRequest<unknown, EmploymentTermsPayload>({
    method: 'PATCH',
    url: `${baseUrl(employmentProfileId)}/${encodeURIComponent(termsId)}`,
    data: validatedPayload,
  });
  return detailResponseSchema.parse(response).data;
};

export const transitionEmploymentTerms = async (
  employmentProfileId: string,
  termsId: string,
  action: 'submit' | 'approve' | 'cancel',
): Promise<EmploymentTermsRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `${baseUrl(employmentProfileId)}/${encodeURIComponent(termsId)}/${action}`,
    data: {},
  });
  return detailResponseSchema.parse(response).data;
};
