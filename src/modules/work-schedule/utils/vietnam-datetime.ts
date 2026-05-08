export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const VIETNAM_UTC_OFFSET_LABEL = 'UTC+7';

const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;
const NATIVE_LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;
const VIETNAM_DISPLAY_DATETIME_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/u;

const padTwo = (value: number): string => value.toString().padStart(2, '0');

export const formatVietnamLocalInputValue = (timestamp: number): string => {
  const localDate = new Date(timestamp + VIETNAM_UTC_OFFSET_MINUTES * 60_000);

  return `${localDate.getUTCFullYear()}-${padTwo(localDate.getUTCMonth() + 1)}-${padTwo(
    localDate.getUTCDate(),
  )}T${padTwo(localDate.getUTCHours())}:${padTwo(localDate.getUTCMinutes())}`;
};

export const formatVietnamLocalDisplay = (timestamp: number): string => {
  const localInputValue = formatVietnamLocalInputValue(timestamp);
  const [datePart, timePart] = localInputValue.split('T');
  const [year, month, day] = datePart.split('-');

  return `${day}/${month}/${year} ${timePart}`;
};

const parsePartsToUtcTimestamp = ({
  year,
  month,
  day,
  hour,
  minute,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): number | null => {
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const utcTimestamp =
    Date.UTC(year, month - 1, day, hour, minute, 0, 0) - VIETNAM_UTC_OFFSET_MINUTES * 60_000;

  return formatVietnamLocalDisplay(utcTimestamp) ===
    `${padTwo(day)}/${padTwo(month)}/${year} ${padTwo(hour)}:${padTwo(minute)}`
    ? utcTimestamp
    : null;
};

export const parseVietnamDisplayDateTimeToUtcTimestamp = (value: string): number | null => {
  const match = VIETNAM_DISPLAY_DATETIME_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText, hourText, minuteText] = match;

  return parsePartsToUtcTimestamp({
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  });
};

export const parseVietnamLocalDateTimeToUtcTimestamp = (value: string): number | null => {
  const trimmed = value.trim();

  const displayTimestamp = parseVietnamDisplayDateTimeToUtcTimestamp(trimmed);
  if (displayTimestamp !== null) {
    return displayTimestamp;
  }

  const nativeMatch = NATIVE_LOCAL_DATETIME_PATTERN.exec(trimmed);
  if (!nativeMatch) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = nativeMatch;

  return parsePartsToUtcTimestamp({
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  });
};
