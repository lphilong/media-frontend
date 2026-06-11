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

export const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const VIETNAM_TIME_LABEL = 'giờ Việt Nam';
const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatUtcDate = (date: Date): string => {
  return `${padTwo(date.getUTCDate())}-${padTwo(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
};

export const formatUtcTimestamp = (value: number | string | Date): string => {
  return safeFormat(value, (date) => {
    return `${padTwo(date.getUTCHours())}:${padTwo(date.getUTCMinutes())} ${formatUtcDate(date)}`;
  });
};

export const formatTimestamp = formatUtcTimestamp;

const readDateTimeFormatPart = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string | undefined => parts.find((part) => part.type === type)?.value;

const formatBusinessDateTime = (date: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const hour = readDateTimeFormatPart(parts, 'hour');
  const minute = readDateTimeFormatPart(parts, 'minute');
  const day = readDateTimeFormatPart(parts, 'day');
  const month = readDateTimeFormatPart(parts, 'month');
  const year = readDateTimeFormatPart(parts, 'year');

  if (!hour || !minute || !day || !month || !year) {
    return '-';
  }

  return `${hour}:${minute} ${day}-${month}-${year}`;
};

const readBusinessDateTimeParts = (
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const hour = readDateTimeFormatPart(parts, 'hour');
  const minute = readDateTimeFormatPart(parts, 'minute');
  const second = readDateTimeFormatPart(parts, 'second');
  const day = readDateTimeFormatPart(parts, 'day');
  const month = readDateTimeFormatPart(parts, 'month');
  const year = readDateTimeFormatPart(parts, 'year');

  if (!hour || !minute || !second || !day || !month || !year) {
    return null;
  }

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
};

const readBusinessTimeZoneOffsetMs = (utcMs: number, timeZone: string): number | null => {
  const parts = readBusinessDateTimeParts(new Date(utcMs), timeZone);
  if (!parts) {
    return null;
  }

  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcMs
  );
};

export const formatBusinessTimestamp = (
  value: number | string | Date,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
): string => {
  try {
    return safeFormat(value, (date) =>
      formatBusinessDateTime(date, timeZone || DEFAULT_BUSINESS_TIME_ZONE),
    );
  } catch {
    return safeFormat(value, (date) => formatBusinessDateTime(date, DEFAULT_BUSINESS_TIME_ZONE));
  }
};

export const formatVietnamTimestamp = (value: number | string | Date): string => {
  const formatted = formatBusinessTimestamp(value, DEFAULT_BUSINESS_TIME_ZONE);
  return formatted === '-' ? formatted : `${formatted}, ${VIETNAM_TIME_LABEL}`;
};

export const formatVietnamMonth = (value: string): string => {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return '-';
  }

  return `${match[2]}-${match[1]}`;
};

export const formatVietnamMonthLabel = (value: string): string => {
  const formatted = formatVietnamMonth(value);
  return formatted === '-' ? formatted : `Tháng ${formatted}`;
};

export const formatBusinessDateTimeInputValue = (
  value: number | string | Date,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
): string => {
  const date = asDate(value);
  if (!isValid(date)) {
    return '';
  }

  try {
    const parts = readBusinessDateTimeParts(date, timeZone || DEFAULT_BUSINESS_TIME_ZONE);
    if (!parts) {
      return '';
    }

    return `${parts.year}-${padTwo(parts.month)}-${padTwo(parts.day)}T${padTwo(parts.hour)}:${padTwo(
      parts.minute,
    )}`;
  } catch {
    return formatBusinessDateTimeInputValue(value, DEFAULT_BUSINESS_TIME_ZONE);
  }
};

export const parseBusinessDateTimeInputValue = (
  value: string,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
): number | undefined => {
  const match = DATETIME_LOCAL_PATTERN.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const asUtcFields = Date.UTC(year, month - 1, day, hour, minute);
  const validDate = new Date(asUtcFields);

  if (
    validDate.getUTCFullYear() !== year ||
    validDate.getUTCMonth() + 1 !== month ||
    validDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return undefined;
  }

  try {
    const zone = timeZone || DEFAULT_BUSINESS_TIME_ZONE;
    const initialOffset = readBusinessTimeZoneOffsetMs(asUtcFields, zone);
    if (initialOffset === null) {
      return undefined;
    }

    const firstCandidate = asUtcFields - initialOffset;
    const resolvedOffset = readBusinessTimeZoneOffsetMs(firstCandidate, zone);
    if (resolvedOffset === null) {
      return undefined;
    }

    const candidate = asUtcFields - resolvedOffset;
    const roundTrip = readBusinessDateTimeParts(new Date(candidate), zone);
    if (
      !roundTrip ||
      roundTrip.year !== year ||
      roundTrip.month !== month ||
      roundTrip.day !== day ||
      roundTrip.hour !== hour ||
      roundTrip.minute !== minute
    ) {
      return undefined;
    }

    return Number.isSafeInteger(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
};

export const formatCreatedDate = (value: number | string | Date): string => {
  return safeFormat(value, formatUtcDate);
};

export const formatCanonicalDate = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '-';
  }

  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
};

export const formatUtcDateInputValue = (value: number | string | Date): string => {
  return safeFormat(value, (date) =>
    [date.getUTCFullYear(), padTwo(date.getUTCMonth() + 1), padTwo(date.getUTCDate())].join('-'),
  );
};

export const parseUtcMidnightDateInputValue = (value: string): number | undefined => {
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return timestamp;
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

export { readReferenceDisplay } from '@shared/formatting/reference-display';
export type { ReferenceSummary } from '@shared/formatting/reference-display';
