import type { NormalizedApiError } from '@shared/api';
import type { KpiPlanQuery } from '@modules/kpi/types/kpi.types';
import { kpiMetricCodes, kpiPlanStatuses, kpiSubjectTypes } from '@modules/kpi/types/kpi.types';

type Translate = (key: string) => string;

/** Keeps deterministic read policy owned by the KPI module. */
export const readKpiPlanQuery = (searchParams: URLSearchParams): KpiPlanQuery => {
  const subjectType = searchParams.get('subjectType');
  const status = searchParams.get('status');
  const metricCode = searchParams.get('metricCode');

  return {
    search: searchParams.get('search') || undefined,
    subjectType: kpiSubjectTypes.includes(subjectType as never)
      ? (subjectType as never)
      : undefined,
    subjectId: searchParams.get('subjectId') || undefined,
    groupId: searchParams.get('groupId') || undefined,
    periodMonth: searchParams.get('periodMonth') || undefined,
    status: kpiPlanStatuses.includes(status as never) ? (status as never) : undefined,
    metricCode: kpiMetricCodes.includes(metricCode as never) ? (metricCode as never) : undefined,
    limit: 50,
  };
};

export const readKpiSafeErrorMessage = (
  t: Translate,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  const message = error?.message?.toLowerCase() ?? '';

  if (
    message.includes('use direct edit before cutoff') ||
    message.includes('allowed only after the direct edit window')
  ) {
    return t('kpi:errors.correctionDirectEditWindow');
  }
  if (message.includes('active excuse') || message.includes('not-required')) {
    return t('kpi:errors.correctionActiveExcuse');
  }
  if (message.includes('finalized kpi') || message.includes('plan_finalized')) {
    return t('kpi:errors.finalizedReadOnly');
  }

  // Unknown backend diagnostics are not ordinary operator copy.
  return t(fallbackKey);
};

export const readKpiSubjectFilterLabel = (t: Translate): string => t('kpi:filters.selectedSubject');
