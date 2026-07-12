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
  {
    id: 'terms-current',
    termsCode: 'HRET-2026-000002',
    employmentProfileId: 'ep-002',
    status: 'APPROVED',
    effectiveFrom: Date.UTC(2026, 0, 1),
    effectiveTo: null,
    baseSalaryAmount: 18000000,
    currencyCode: 'VND',
    payFrequency: 'MONTHLY',
    allowances: [],
    payrollEligible: true,
    sourceNote: null,
    sensitiveAmountsRedacted: false,
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: Date.UTC(2026, 0, 2),
    submittedAt: Date.UTC(2026, 0, 2),
    approvedAt: Date.UTC(2026, 0, 3),
    cancelledAt: null,
    supersedesTermsId: null,
    supersededByTermsId: null,
    version: 1,
  },
  {
    id: 'terms-expired',
    termsCode: 'HRET-2025-000003',
    employmentProfileId: 'ep-003',
    status: 'APPROVED',
    effectiveFrom: Date.UTC(2025, 0, 1),
    effectiveTo: Date.UTC(2025, 11, 31),
    baseSalaryAmount: 15000000,
    currencyCode: 'VND',
    payFrequency: 'MONTHLY',
    allowances: [],
    payrollEligible: true,
    sourceNote: null,
    sensitiveAmountsRedacted: false,
    createdAt: Date.UTC(2025, 0, 1),
    updatedAt: Date.UTC(2025, 0, 2),
    submittedAt: Date.UTC(2025, 0, 2),
    approvedAt: Date.UTC(2025, 0, 3),
    cancelledAt: null,
    supersedesTermsId: null,
    supersededByTermsId: null,
    version: 1,
  },
  {
    id: 'terms-ineligible',
    termsCode: 'HRET-2026-000004',
    employmentProfileId: 'ep-004',
    status: 'PENDING_APPROVAL',
    effectiveFrom: Date.UTC(2026, 0, 1),
    effectiveTo: null,
    baseSalaryAmount: 0,
    currencyCode: 'VND',
    payFrequency: 'MONTHLY',
    allowances: [],
    payrollEligible: false,
    sourceNote: null,
    sensitiveAmountsRedacted: false,
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: Date.UTC(2026, 0, 2),
    submittedAt: Date.UTC(2026, 0, 2),
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
let adminListErrorNext = false;
let adminListErrorMessage = 'List failed';

const adminProfiles: Record<
  string,
  {
    id: string;
    employeeCode: string;
    displayName: string;
    legalName: string;
    employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'ARCHIVED';
    orgUnitId: string;
    orgUnitRef: { id: string; code: string; name: string; status: string };
    linkedUserRef?: { id: string; displayName: string; name: string; status: string } | null;
  }
> = {
  'ep-001': {
    id: 'ep-001',
    employeeCode: 'EP-000001',
    displayName: 'Alice',
    legalName: 'Alice Nguyen',
    employmentStatus: 'ACTIVE',
    orgUnitId: 'ou-sales',
    orgUnitRef: { id: 'ou-sales', code: 'OU-000002', name: 'Sales', status: 'ACTIVE' },
    linkedUserRef: {
      id: 'user-alice',
      displayName: 'Alice User',
      name: 'alice@example.test',
      status: 'ACTIVE',
    },
  },
  'ep-002': {
    id: 'ep-002',
    employeeCode: 'EP-000002',
    displayName: 'Bao',
    legalName: 'Bao Tran',
    employmentStatus: 'ON_LEAVE',
    orgUnitId: 'ou-sales',
    orgUnitRef: { id: 'ou-sales', code: 'OU-000002', name: 'Sales', status: 'ACTIVE' },
    linkedUserRef: null,
  },
  'ep-003': {
    id: 'ep-003',
    employeeCode: 'EP-000003',
    displayName: 'Chau',
    legalName: 'Chau Le',
    employmentStatus: 'SUSPENDED',
    orgUnitId: 'ou-ops',
    orgUnitRef: { id: 'ou-ops', code: 'OU-000003', name: 'Operations', status: 'INACTIVE' },
    linkedUserRef: null,
  },
  'ep-004': {
    id: 'ep-004',
    employeeCode: 'EP-000004',
    displayName: 'Dung',
    legalName: 'Dung Pham',
    employmentStatus: 'TERMINATED',
    orgUnitId: 'ou-ops',
    orgUnitRef: { id: 'ou-ops', code: 'OU-000003', name: 'Operations', status: 'INACTIVE' },
    linkedUserRef: null,
  },
};

export const resetEmploymentTermsMockData = (): void => {
  records = initial.map((record) => ({
    ...record,
    allowances: record.allowances.map((item) => ({ ...item })),
  }));
  conflictNextAction = false;
  mutationErrorNext = null;
  adminListErrorNext = false;
  adminListErrorMessage = 'List failed';
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

export const setEmploymentTermsAdminListErrorNext = (message = 'List failed'): void => {
  adminListErrorNext = true;
  adminListErrorMessage = message;
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

const parseDateParam = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? timestamp
    : undefined;
};

const parseCursor = (value: string | null): number => {
  if (!value) return 0;
  const match = /^cursor:(\d+)$/.exec(value);
  return match ? Number(match[1]) : 0;
};

const isEffectiveOn = (record: Terms, date: number): boolean =>
  record.effectiveFrom <= date && (record.effectiveTo === null || record.effectiveTo >= date);

const hasOverlap = (record: Terms): boolean =>
  record.status === 'APPROVED' &&
  record.payrollEligible &&
  records.some(
    (candidate) =>
      candidate.id !== record.id &&
      candidate.employmentProfileId === record.employmentProfileId &&
      candidate.status === 'APPROVED' &&
      candidate.payrollEligible &&
      record.effectiveFrom <= (candidate.effectiveTo ?? Number.MAX_SAFE_INTEGER) &&
      candidate.effectiveFrom <= (record.effectiveTo ?? Number.MAX_SAFE_INTEGER),
  );

const toAdminListItem = (record: Terms, effectiveOn: number) => {
  const profile = adminProfiles[record.employmentProfileId] ?? adminProfiles['ep-001']!;
  const isCurrentEffective =
    record.status === 'APPROVED' && record.payrollEligible && isEffectiveOn(record, effectiveOn);
  const isExpired =
    record.status === 'APPROVED' &&
    record.payrollEligible &&
    record.effectiveTo !== null &&
    record.effectiveTo < effectiveOn;
  const hasMissingBaseSalary =
    record.payrollEligible &&
    (record.status === 'APPROVED' || record.status === 'PENDING_APPROVAL') &&
    isEffectiveOn(record, effectiveOn) &&
    !(typeof record.baseSalaryAmount === 'number' && record.baseSalaryAmount >= 0);

  return {
    ...record,
    employmentProfile: profile,
    isCurrentEffective,
    isExpired,
    isPendingApproval: record.status === 'PENDING_APPROVAL',
    hasMissingBaseSalary,
    hasOverlapForProfile: hasOverlap(record),
    payrollSourceEligibility: record.payrollEligible ? 'ELIGIBLE' : 'INELIGIBLE',
  };
};

const matchesReadiness = (
  item: ReturnType<typeof toAdminListItem>,
  readiness: string | null,
): boolean => {
  if (!readiness) return true;
  if (readiness === 'CURRENT_EFFECTIVE') return item.isCurrentEffective;
  if (readiness === 'PENDING_APPROVAL') return item.isPendingApproval && item.payrollEligible;
  if (readiness === 'EXPIRED') return item.isExpired;
  if (readiness === 'MISSING_BASE_SALARY') return item.hasMissingBaseSalary;
  if (readiness === 'OVERLAPPING') return item.hasOverlapForProfile;
  if (readiness === 'PAYROLL_SOURCE_ELIGIBLE') return item.payrollEligible;
  if (readiness === 'PAYROLL_SOURCE_INELIGIBLE') return !item.payrollEligible;
  return false;
};

export const employmentTermsHandlers = [
  http.get('*/admin/employment-terms', ({ request }) => {
    if (adminListErrorNext) {
      adminListErrorNext = false;
      return HttpResponse.json(
        { error: { code: 'EMPLOYMENT_TERMS_LIST_FAILED', message: adminListErrorMessage } },
        { status: 500 },
      );
    }

    const url = new URL(request.url);
    const params = url.searchParams;
    const effectiveOn = parseDateParam(params.get('effectiveOn')) ?? Date.UTC(2026, 0, 15);
    const expiringBefore = parseDateParam(params.get('expiringBefore'));
    const search = params.get('search')?.trim().toLowerCase();
    const limit = Math.min(Number(params.get('limit') ?? 20), 100);
    const start = parseCursor(params.get('cursor'));

    const employmentProfileId = params.get('employmentProfileId');
    const orgUnitId = params.get('orgUnitId');
    const employmentStatus = params.get('employmentStatus');
    const status = params.get('status');
    const payrollEligible = params.get('payrollEligible');
    const readiness = params.get('readiness');

    let rows = records.map((record) => toAdminListItem(record, effectiveOn));

    if (employmentProfileId) {
      rows = rows.filter((item) => item.employmentProfile.id === employmentProfileId);
    }
    if (orgUnitId) {
      rows = rows.filter((item) => item.employmentProfile.orgUnitId === orgUnitId);
    }
    if (employmentStatus) {
      rows = rows.filter((item) => item.employmentProfile.employmentStatus === employmentStatus);
    }
    if (status) {
      rows = rows.filter((item) => item.status === status);
    }
    if (payrollEligible === 'true' || payrollEligible === 'false') {
      rows = rows.filter((item) => item.payrollEligible === (payrollEligible === 'true'));
    }
    if (params.has('effectiveOn')) {
      rows = rows.filter((item) => isEffectiveOn(item, effectiveOn));
    }
    if (expiringBefore !== undefined) {
      rows = rows.filter((item) => item.effectiveTo !== null && item.effectiveTo < expiringBefore);
    }
    if (search) {
      rows = rows.filter((item) => {
        const profile = item.employmentProfile;
        return (
          item.termsCode.toLowerCase().includes(search) ||
          profile.employeeCode.toLowerCase().includes(search) ||
          profile.displayName.toLowerCase().includes(search) ||
          profile.legalName.toLowerCase().includes(search)
        );
      });
    }
    rows = rows.filter((item) => matchesReadiness(item, readiness));

    const page = rows.slice(start, start + limit);
    const nextOffset = start + page.length;

    return HttpResponse.json({
      data: {
        items: page,
        nextCursor: nextOffset < rows.length ? `cursor:${nextOffset}` : null,
        appliedFilters: {
          ...(employmentProfileId ? { employmentProfileId } : {}),
          ...(orgUnitId ? { orgUnitId } : {}),
          ...(employmentStatus ? { employmentStatus } : {}),
          ...(status ? { status } : {}),
          ...(payrollEligible === 'true' || payrollEligible === 'false'
            ? { payrollEligible: payrollEligible === 'true' }
            : {}),
          effectiveOn,
          ...(expiringBefore !== undefined ? { expiringBefore } : {}),
          ...(readiness ? { readiness } : {}),
          ...(search ? { search } : {}),
        },
      },
    });
  }),
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
