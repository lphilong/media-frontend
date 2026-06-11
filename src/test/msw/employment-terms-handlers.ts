import { http, HttpResponse } from 'msw';

import { employmentTermsPayloadSchema } from '@modules/employment-terms/api/employment-terms.api';
import type { EmploymentTermsPayload } from '@modules/employment-terms/types/employment-terms.types';

type Terms = {
  id: string;
  termsCode: string;
  employmentProfileId: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SUPERSEDED' | 'CANCELLED';
  effectiveFrom: number;
  effectiveTo: number | null;
  baseSalaryAmount?: number;
  currencyCode: string;
  payFrequency: 'MONTHLY';
  allowances: Array<{
    type: string;
    label: string;
    amount?: number;
    currencyCode: string;
    payrollEligible: boolean;
    effectiveFrom: number | null;
    effectiveTo: number | null;
    sourceNote: string | null;
  }>;
  payrollEligible: boolean;
  sourceNote: string | null;
  sensitiveAmountsRedacted: boolean;
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
  approvedAt: number | null;
  cancelledAt: number | null;
  supersedesTermsId: string | null;
  supersededByTermsId: string | null;
  version: number;
};

const initial: Terms[] = [
  {
    id: 'terms-draft',
    termsCode: 'HRET-2026-000001',
    employmentProfileId: 'ep-001',
    status: 'DRAFT',
    effectiveFrom: Date.UTC(2026, 0, 1),
    effectiveTo: null,
    baseSalaryAmount: 20000000,
    currencyCode: 'VND',
    payFrequency: 'MONTHLY',
    allowances: [
      {
        type: 'MEAL',
        label: 'Meal allowance',
        amount: 500000,
        currencyCode: 'VND',
        payrollEligible: true,
        effectiveFrom: null,
        effectiveTo: null,
        sourceNote: null,
      },
    ],
    payrollEligible: true,
    sourceNote: 'Approved outside the system',
    sensitiveAmountsRedacted: false,
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: Date.UTC(2026, 0, 2),
    submittedAt: null,
    approvedAt: null,
    cancelledAt: null,
    supersedesTermsId: null,
    supersededByTermsId: null,
    version: 1,
  },
];

let records: Terms[] = [];
let conflictNextAction = false;
let mutationErrorNext: 'permission' | 'validation' | null = null;

export const resetEmploymentTermsMockData = (): void => {
  records = initial.map((record) => ({
    ...record,
    allowances: record.allowances.map((item) => ({ ...item })),
  }));
  conflictNextAction = false;
  mutationErrorNext = null;
};

export const setEmploymentTermsRedacted = (redacted: boolean): void => {
  records = records.map((record) => ({
    ...record,
    sensitiveAmountsRedacted: redacted,
    baseSalaryAmount: redacted ? undefined : 20000000,
    allowances: record.allowances.map((allowance) => ({
      ...allowance,
      amount: redacted ? undefined : 500000,
    })),
  }));
};

export const setEmploymentTermsConflictNextAction = (): void => {
  conflictNextAction = true;
};

export const setEmploymentTermsPermissionDeniedNextMutation = (): void => {
  mutationErrorNext = 'permission';
};

export const setEmploymentTermsValidationErrorNextMutation = (): void => {
  mutationErrorNext = 'validation';
};

export const setEmploymentTermsStatus = (termsId: string, status: Terms['status']): void => {
  const record = records.find((item) => item.id === termsId);
  if (record) record.status = status;
};

export const setEmploymentTermsEmpty = (): void => {
  records = [];
};

resetEmploymentTermsMockData();

const parseBody = async (request: Request): Promise<EmploymentTermsPayload | null> => {
  const result = employmentTermsPayloadSchema.safeParse(await request.json());
  return result.success ? result.data : null;
};

const dateValue = (value: unknown): number | null =>
  typeof value === 'string' && value ? Date.parse(`${value}T00:00:00.000Z`) : null;

const mutationErrorResponse = (): Response | null => {
  const error = mutationErrorNext;
  mutationErrorNext = null;
  if (error === 'permission') {
    return HttpResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Employment Terms permission required' } },
      { status: 403 },
    );
  }
  if (error === 'validation') {
    return HttpResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid employment terms payload' } },
      { status: 422 },
    );
  }
  return null;
};

const payloadAllowances = (payload: EmploymentTermsPayload): Terms['allowances'] =>
  payload.allowances.map((allowance) => ({
    ...allowance,
    effectiveFrom: dateValue(allowance.effectiveFrom),
    effectiveTo: dateValue(allowance.effectiveTo),
  }));

export const employmentTermsHandlers = [
  http.get('*/admin/employment-profiles/:employmentProfileId/employment-terms', ({ params }) =>
    HttpResponse.json({
      data: records.filter(
        (record) => record.employmentProfileId === String(params.employmentProfileId),
      ),
    }),
  ),
  http.get(
    '*/admin/employment-profiles/:employmentProfileId/employment-terms/:termsId',
    ({ params }) => {
      const record = records.find((item) => item.id === String(params.termsId));
      return record
        ? HttpResponse.json({ data: record })
        : HttpResponse.json(
            { error: { code: 'EMPLOYMENT_TERMS_NOT_FOUND', message: 'Not found' } },
            { status: 404 },
          );
    },
  ),
  http.post(
    '*/admin/employment-profiles/:employmentProfileId/employment-terms',
    async ({ params, request }) => {
      const errorResponse = mutationErrorResponse();
      if (errorResponse) return errorResponse;
      const body = await parseBody(request);
      if (!body) {
        return HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid employment terms payload' } },
          { status: 422 },
        );
      }
      const record: Terms = {
        ...initial[0]!,
        id: `terms-${records.length + 1}`,
        termsCode: `HRET-2026-${String(records.length + 1).padStart(6, '0')}`,
        employmentProfileId: String(params.employmentProfileId),
        effectiveFrom: dateValue(body.effectiveFrom) ?? Date.UTC(2026, 0, 1),
        effectiveTo: dateValue(body.effectiveTo),
        baseSalaryAmount: body.baseSalaryAmount,
        currencyCode: body.currencyCode,
        payFrequency: body.payFrequency,
        allowances: payloadAllowances(body),
        payrollEligible: body.payrollEligible,
        sourceNote: body.sourceNote,
        sensitiveAmountsRedacted: false,
      };
      records.push(record);
      return HttpResponse.json({ data: record });
    },
  ),
  http.patch(
    '*/admin/employment-profiles/:employmentProfileId/employment-terms/:termsId',
    async ({ params, request }) => {
      const errorResponse = mutationErrorResponse();
      if (errorResponse) return errorResponse;
      const body = await parseBody(request);
      if (!body) {
        return HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid employment terms payload' } },
          { status: 422 },
        );
      }
      const record = records.find((item) => item.id === String(params.termsId));
      if (!record)
        return HttpResponse.json(
          { error: { code: 'EMPLOYMENT_TERMS_NOT_FOUND', message: 'Not found' } },
          { status: 404 },
        );
      record.effectiveFrom = dateValue(body.effectiveFrom) ?? record.effectiveFrom;
      record.effectiveTo = dateValue(body.effectiveTo);
      record.baseSalaryAmount = body.baseSalaryAmount;
      record.currencyCode = body.currencyCode;
      record.payFrequency = body.payFrequency;
      record.allowances = payloadAllowances(body);
      record.payrollEligible = body.payrollEligible;
      record.sourceNote = body.sourceNote;
      record.sensitiveAmountsRedacted = false;
      record.updatedAt = Date.now();
      return HttpResponse.json({ data: record });
    },
  ),
  ...(['submit', 'approve', 'cancel'] as const).map((action) =>
    http.post(
      `*/admin/employment-profiles/:employmentProfileId/employment-terms/:termsId/${action}`,
      ({ params }) => {
        if (conflictNextAction) {
          conflictNextAction = false;
          return HttpResponse.json(
            {
              error: {
                code: 'EMPLOYMENT_TERMS_CONFLICT',
                message: 'Maker/checker or overlap conflict',
              },
            },
            { status: 409 },
          );
        }
        const record = records.find((item) => item.id === String(params.termsId));
        if (!record)
          return HttpResponse.json(
            { error: { code: 'EMPLOYMENT_TERMS_NOT_FOUND', message: 'Not found' } },
            { status: 404 },
          );
        record.status =
          action === 'submit'
            ? 'PENDING_APPROVAL'
            : action === 'approve'
              ? 'APPROVED'
              : 'CANCELLED';
        return HttpResponse.json({ data: record });
      },
    ),
  ),
];
