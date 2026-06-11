import { http, HttpResponse } from 'msw';

import {
  createEmploymentTerms,
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
});
