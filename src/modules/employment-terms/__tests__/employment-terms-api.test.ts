import { http, HttpResponse } from 'msw';

import {
  createEmploymentTerms,
  fetchEmploymentTermsAdminList,
  fetchEmploymentTerms,
  updateEmploymentTerms,
} from '@modules/employment-terms/api/employment-terms.api';
import type { EmploymentTermsPayload } from '@modules/employment-terms/types/employment-terms.types';
import {
  setEmploymentTermsPermissionDeniedNextMutation,
  setEmploymentTermsValidationErrorNextMutation,
} from '@test/msw/employment-terms-handlers';
import { server } from '@test/msw/server';

const payload = (): EmploymentTermsPayload => ({
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  baseSalaryAmount: 20_000_000,
  currencyCode: 'VND',
  payFrequency: 'MONTHLY',
  allowances: [
    {
      type: 'MEAL',
      label: 'Meal allowance',
      amount: 500_000,
      currencyCode: 'VND',
      payrollEligible: true,
      effectiveFrom: null,
      effectiveTo: null,
      sourceNote: null,
    },
  ],
  payrollEligible: true,
  sourceNote: 'Confirmed source',
});

const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'terms-1',
  termsCode: 'HRET-2026-000001',
  employmentProfileId: 'ep-001',
  status: 'DRAFT',
  effectiveFrom: Date.UTC(2026, 0, 1),
  effectiveTo: null,
  baseSalaryAmount: 20_000_000,
  currencyCode: 'VND',
  payFrequency: 'MONTHLY',
  allowances: [
    {
      type: 'MEAL',
      label: 'Meal allowance',
      amount: 500_000,
      currencyCode: 'VND',
      payrollEligible: true,
      effectiveFrom: null,
      effectiveTo: null,
      sourceNote: null,
    },
  ],
  payrollEligible: true,
  sourceNote: null,
  sensitiveAmountsRedacted: false,
  createdAt: Date.UTC(2026, 0, 1),
  updatedAt: Date.UTC(2026, 0, 2),
  submittedAt: null,
  approvedAt: null,
  cancelledAt: null,
  supersedesTermsId: null,
  supersededByTermsId: null,
  version: 1,
  ...overrides,
});

const adminRecord = (overrides: Record<string, unknown> = {}) => ({
  ...record({
    id: 'terms-admin-1',
    status: 'APPROVED',
    sensitiveAmountsRedacted: true,
    baseSalaryAmount: undefined,
    allowances: [],
  }),
  employmentProfile: {
    id: 'ep-001',
    employeeCode: 'EP-000001',
    displayName: 'Alice',
    legalName: 'Alice Nguyen',
    employmentStatus: 'ACTIVE',
    orgUnitId: 'ou-sales',
    orgUnitRef: { id: 'ou-sales', code: 'OU-000002', name: 'Sales', status: 'ACTIVE' },
    linkedUserRef: null,
  },
  isCurrentEffective: true,
  isExpired: false,
  isPendingApproval: false,
  hasMissingBaseSalary: false,
  hasOverlapForProfile: false,
  payrollSourceEligibility: 'ELIGIBLE',
  ...overrides,
});

describe('Employment Terms API boundary', () => {
  it('rejects a redacted response that still contains salary or allowance amounts', async () => {
    server.use(
      http.get('*/admin/employment-profiles/:employmentProfileId/employment-terms', () =>
        HttpResponse.json({
          data: [
            record({
              sensitiveAmountsRedacted: true,
              allowances: [
                {
                  type: 'MEAL',
                  label: 'Meal allowance',
                  amount: 500_000,
                  currencyCode: 'VND',
                  payrollEligible: true,
                  effectiveFrom: null,
                  effectiveTo: null,
                  sourceNote: null,
                },
              ],
            }),
          ],
        }),
      ),
    );

    await expect(fetchEmploymentTerms('ep-001')).rejects.toThrow();
  });

  it('parses a redacted response only when all sensitive amounts are absent', async () => {
    server.use(
      http.get('*/admin/employment-profiles/:employmentProfileId/employment-terms', () =>
        HttpResponse.json({
          data: [
            record({
              sensitiveAmountsRedacted: true,
              baseSalaryAmount: undefined,
              allowances: [
                {
                  type: 'MEAL',
                  label: 'Meal allowance',
                  currencyCode: 'VND',
                  payrollEligible: true,
                  effectiveFrom: null,
                  effectiveTo: null,
                  sourceNote: null,
                },
              ],
            }),
          ],
        }),
      ),
    );

    await expect(fetchEmploymentTerms('ep-001')).resolves.toMatchObject([
      { sensitiveAmountsRedacted: true },
    ]);
  });

  it('validates and preserves allowances in create and update requests', async () => {
    const created = await createEmploymentTerms('ep-001', payload());
    expect(created).toMatchObject({
      allowances: [{ type: 'MEAL', amount: 500_000 }],
    });

    const updated = payload();
    updated.allowances[0]!.amount = 750_000;
    await expect(updateEmploymentTerms('ep-001', created.id, updated)).resolves.toMatchObject({
      allowances: [{ type: 'MEAL', amount: 750_000 }],
    });
  });

  it.each([
    ['negative salary', { baseSalaryAmount: -1 }],
    ['missing currency', { currencyCode: '' }],
    ['invalid pay frequency', { payFrequency: 'WEEKLY' }],
    ['invalid date', { effectiveFrom: '2026-02-30' }],
    ['overlong terms note', { sourceNote: 'x'.repeat(501) }],
    [
      'too many allowances',
      { allowances: Array.from({ length: 21 }, () => payload().allowances[0]!) },
    ],
    [
      'negative allowance',
      {
        allowances: [{ ...payload().allowances[0]!, amount: -1 }],
      },
    ],
    [
      'missing allowance currency',
      { allowances: [{ ...payload().allowances[0]!, currencyCode: '' }] },
    ],
    [
      'overlong allowance type',
      { allowances: [{ ...payload().allowances[0]!, type: 'x'.repeat(65) }] },
    ],
    [
      'overlong allowance label',
      { allowances: [{ ...payload().allowances[0]!, label: 'x'.repeat(121) }] },
    ],
    [
      'overlong allowance note',
      { allowances: [{ ...payload().allowances[0]!, sourceNote: 'x'.repeat(501) }] },
    ],
    [
      'invalid allowance date',
      {
        allowances: [
          {
            ...payload().allowances[0]!,
            effectiveFrom: '2026-02-30',
          },
        ],
      },
    ],
    [
      'reversed allowance dates',
      {
        allowances: [
          {
            ...payload().allowances[0]!,
            effectiveFrom: '2026-02-02',
            effectiveTo: '2026-02-01',
          },
        ],
      },
    ],
  ])('rejects %s before sending a request', async (_label, patch) => {
    let requestCount = 0;
    server.use(
      http.post('*/admin/employment-profiles/:employmentProfileId/employment-terms', () => {
        requestCount += 1;
        return HttpResponse.json({ data: record() });
      }),
    );
    const invalidPayload = { ...payload(), ...patch } as EmploymentTermsPayload;

    await expect(createEmploymentTerms('ep-001', invalidPayload)).rejects.toThrow();
    expect(requestCount).toBe(0);
  });

  it.each([
    ['permission', setEmploymentTermsPermissionDeniedNextMutation, 403],
    ['validation', setEmploymentTermsValidationErrorNextMutation, 422],
  ])('preserves the MSW %s error variant', async (_label, configure, status) => {
    configure();

    await expect(createEmploymentTerms('ep-001', payload())).rejects.toMatchObject({ status });
  });

  it('parses the accepted all-profiles admin list response', async () => {
    server.use(
      http.get('*/admin/employment-terms', () =>
        HttpResponse.json({
          data: {
            items: [adminRecord()],
            nextCursor: 'opaque-next-cursor',
            appliedFilters: {
              effectiveOn: Date.UTC(2026, 0, 1),
              readiness: 'CURRENT_EFFECTIVE',
            },
          },
        }),
      ),
    );

    await expect(
      fetchEmploymentTermsAdminList({ readiness: 'CURRENT_EFFECTIVE', limit: 10 }),
    ).resolves.toMatchObject({
      items: [
        {
          employmentProfile: { displayName: 'Alice' },
          sensitiveAmountsRedacted: true,
        },
      ],
      nextCursor: 'opaque-next-cursor',
      appliedFilters: { readiness: 'CURRENT_EFFECTIVE' },
    });
  });

  it('rejects unknown admin readiness enum values from the backend', async () => {
    server.use(
      http.get('*/admin/employment-terms', () =>
        HttpResponse.json({
          data: {
            items: [adminRecord()],
            nextCursor: null,
            appliedFilters: {
              effectiveOn: Date.UTC(2026, 0, 1),
              readiness: 'READY',
            },
          },
        }),
      ),
    );

    await expect(fetchEmploymentTermsAdminList({})).rejects.toThrow();
  });

  it('keeps redacted all-profiles amounts absent instead of coercing them to zero', async () => {
    server.use(
      http.get('*/admin/employment-terms', () =>
        HttpResponse.json({
          data: {
            items: [
              adminRecord({
                sensitiveAmountsRedacted: true,
                baseSalaryAmount: undefined,
                allowances: [
                  {
                    type: 'MEAL',
                    label: 'Meal allowance',
                    currencyCode: 'VND',
                    payrollEligible: true,
                    effectiveFrom: null,
                    effectiveTo: null,
                    sourceNote: null,
                  },
                ],
              }),
            ],
            nextCursor: null,
            appliedFilters: { effectiveOn: Date.UTC(2026, 0, 1) },
          },
        }),
      ),
    );

    const result = await fetchEmploymentTermsAdminList({});

    expect(result.items[0]?.baseSalaryAmount).toBeUndefined();
    expect(result.items[0]?.baseSalaryAmount).not.toBe(0);
    expect(result.items[0]?.allowances[0]).not.toHaveProperty('amount');
  });

  it('serializes supported admin list filters and cursor without unsupported params', async () => {
    let capturedUrl = new URL('http://localhost/placeholder');
    server.use(
      http.get('*/admin/employment-terms', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          data: {
            items: [],
            nextCursor: null,
            appliedFilters: { effectiveOn: Date.UTC(2026, 0, 1) },
          },
        });
      }),
    );

    await fetchEmploymentTermsAdminList({
      employmentProfileId: 'ep-001',
      orgUnitId: 'ou-sales',
      employmentStatus: 'ACTIVE',
      status: 'APPROVED',
      payrollEligible: true,
      effectiveOn: '2026-01-01',
      expiringBefore: '2026-12-31',
      readiness: 'OVERLAPPING',
      search: 'Alice',
      cursor: 'opaque',
      limit: 50,
    });

    const url = capturedUrl;
    expect(url.searchParams.get('employmentProfileId')).toBe('ep-001');
    expect(url.searchParams.get('orgUnitId')).toBe('ou-sales');
    expect(url.searchParams.get('employmentStatus')).toBe('ACTIVE');
    expect(url.searchParams.get('status')).toBe('APPROVED');
    expect(url.searchParams.get('payrollEligible')).toBe('true');
    expect(url.searchParams.get('effectiveOn')).toBe('2026-01-01');
    expect(url.searchParams.get('expiringBefore')).toBe('2026-12-31');
    expect(url.searchParams.get('readiness')).toBe('OVERLAPPING');
    expect(url.searchParams.get('search')).toBe('Alice');
    expect(url.searchParams.get('cursor')).toBe('opaque');
    expect(url.searchParams.get('limit')).toBe('50');
    expect([...url.searchParams.keys()].sort()).toEqual([
      'cursor',
      'effectiveOn',
      'employmentProfileId',
      'employmentStatus',
      'expiringBefore',
      'limit',
      'orgUnitId',
      'payrollEligible',
      'readiness',
      'search',
      'status',
    ]);
  });
});
