import { describe, expect, it } from 'vitest';

import {
  readKpiPlanQuery,
  readKpiSafeErrorMessage,
  readKpiSubjectFilterLabel,
} from '@modules/kpi/presentation/kpi-read-models';

describe('KPI read models', () => {
  const t = (key: string) => `copy:${key}`;

  it('retains only supported plan query values', () => {
    expect(
      readKpiPlanQuery(
        new URLSearchParams({
          subjectType: 'ORG_UNIT',
          status: 'PUBLISHED',
          metricCode: 'REVENUE_VND',
          subjectId: 'internal-id',
        }),
      ),
    ).toMatchObject({
      subjectType: 'ORG_UNIT',
      status: 'PUBLISHED',
      metricCode: 'REVENUE_VND',
      subjectId: 'internal-id',
      limit: 50,
    });
  });

  it('maps unknown backend diagnostics to safe local copy', () => {
    expect(
      readKpiSafeErrorMessage(
        t,
        { message: 'database fingerprint: 83e1' } as never,
        'kpi:states.loadErrorMessage',
      ),
    ).toBe('copy:kpi:states.loadErrorMessage');
  });

  it('never uses an internal subject id as the applied-filter label', () => {
    expect(readKpiSubjectFilterLabel(t)).toBe('copy:kpi:filters.selectedSubject');
  });
});
