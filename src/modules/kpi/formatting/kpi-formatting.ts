import type { KpiMetricCode } from '@modules/kpi/types/kpi.types';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';

const strictKpiDatePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
const moneyPattern = /^(0|[1-9]\d{0,2}(?:\.\d{3})*|[1-9]\d*)$/;
const countPattern = /^(0|[1-9]\d*)$/;
const hourPattern = /^(0|[1-9]\d*)(?:[,.]\d{1,2})?$/;

export const isStrictKpiDate = (value: string): boolean => {
  const match = strictKpiDatePattern.exec(value.trim());
  if (!match) {
    return false;
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

export const parseKpiDate = (value: string): string | undefined =>
  isStrictKpiDate(value) ? value.trim() : undefined;

export const formatKpiDate = (value: string): string => (isStrictKpiDate(value) ? value : '-');

export const formatKpiDateTime = (value: number | string | Date | null | undefined): string =>
  value === null || value === undefined || value === '' ? '-' : formatBusinessTimestamp(value);

export const formatKpiMoney = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(value);

export const formatKpiMoneyWithCurrency = (value: number): string => `${formatKpiMoney(value)} VND`;

export const parseKpiMoneyInput = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!moneyPattern.test(trimmed)) {
    return undefined;
  }
  const normalized = trimmed.replace(/\./g, '');
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

export const parseKpiCountInput = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!countPattern.test(trimmed)) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

export const parseKpiHoursInput = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!hourPattern.test(trimmed)) {
    return undefined;
  }
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export const formatKpiNumber = (metricCode: KpiMetricCode, value: number): string => {
  if (metricCode === 'REVENUE_VND') {
    return formatKpiMoneyWithCurrency(value);
  }
  if (metricCode === 'LIVE_HOURS') {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
};

export const parseKpiMetricInput = (
  metricCode: KpiMetricCode,
  value: string,
): number | undefined => {
  if (metricCode === 'REVENUE_VND') {
    return parseKpiMoneyInput(value);
  }
  if (metricCode === 'LIVE_HOURS') {
    return parseKpiHoursInput(value);
  }
  return parseKpiCountInput(value);
};

export const formatKpiMetricInput = (metricCode: KpiMetricCode, value: number): string => {
  if (metricCode === 'REVENUE_VND') {
    return formatKpiMoney(value);
  }
  if (metricCode === 'LIVE_HOURS') {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
};
