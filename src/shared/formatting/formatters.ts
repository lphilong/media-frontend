import { isValid } from 'date-fns';

const asDate = (value: number | string | Date): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  return new Date(value);
};

const safeFormat = (value: number | string | Date, formatter: (date: Date) => string): string => {
  const date = asDate(value);
  return isValid(date) ? formatter(date) : '-';
};

const padTwo = (value: number): string => value.toString().padStart(2, '0');

const formatUtcDate = (date: Date): string => {
  return `${date.getUTCFullYear()}-${padTwo(date.getUTCMonth() + 1)}-${padTwo(date.getUTCDate())}`;
};

export const formatUtcTimestamp = (value: number | string | Date): string => {
  return safeFormat(value, (date) => {
    return `${formatUtcDate(date)} ${padTwo(date.getUTCHours())}:${padTwo(date.getUTCMinutes())}:${padTwo(
      date.getUTCSeconds(),
    )}`;
  });
};

export const formatTimestamp = formatUtcTimestamp;

export const formatCanonicalDate = (value: string): string => {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '-';
};

export const formatUtcMidnightDateLike = (value: number | string | Date): string => {
  return safeFormat(value, formatUtcDate);
};

export const formatCurrency = (value: number, currencyCode = 'VND', locale = 'vi-VN'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatDecimal = (
  value: number,
  locale = 'vi-VN',
  maximumFractionDigits = 4,
): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
};

export const formatInteger = (value: number, locale = 'vi-VN'): string => {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatPercent = (
  value: number,
  locale = 'vi-VN',
  maximumFractionDigits = 2,
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits,
  }).format(value / 100);
};
