export type WorkScheduleDeadlineCueType =
  | 'AVAILABILITY_CUTOFF'
  | 'PUBLISH_TARGET'
  | 'FREEZE_REMINDER';

export type WorkScheduleDeadlineCueLabel = 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'NOT_APPLICABLE';

export type WorkScheduleDeadlineCue = {
  label: WorkScheduleDeadlineCueLabel;
  dueDate: string | null;
  daysUntilDue: number | null;
  reason: string;
};

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 3;

const deadlineOffsets: Record<WorkScheduleDeadlineCueType, number> = {
  AVAILABILITY_CUTOFF: -7,
  PUBLISH_TARGET: -2,
  FREEZE_REMINDER: -1,
};

const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

export const getHcmLocalDate = (timestamp = Date.now()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
};

const parseDateOnlyUtc = (value: string): Date | null => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
  if (!match) {
    return null;
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return formatDateOnly(date) === value ? date : null;
};

export const getWorkScheduleDeadlineCue = ({
  targetMonth,
  cueType,
  currentDate = getHcmLocalDate(),
}: {
  targetMonth?: string | null;
  cueType: WorkScheduleDeadlineCueType;
  currentDate?: string;
}): WorkScheduleDeadlineCue => {
  const monthMatch = targetMonth ? MONTH_PATTERN.exec(targetMonth) : null;
  const today = parseDateOnlyUtc(currentDate);
  if (!monthMatch || !today) {
    return {
      label: 'NOT_APPLICABLE',
      dueDate: null,
      daysUntilDue: null,
      reason: 'A valid target month and current local date are required.',
    };
  }

  const due = new Date(Date.UTC(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
  due.setUTCDate(due.getUTCDate() + deadlineOffsets[cueType]);
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  const label: WorkScheduleDeadlineCueLabel =
    daysUntilDue < 0 ? 'OVERDUE' : daysUntilDue <= DUE_SOON_DAYS ? 'DUE_SOON' : 'ON_TRACK';

  return {
    label,
    dueDate: formatDateOnly(due),
    daysUntilDue,
    reason:
      label === 'OVERDUE'
        ? `The display-only target passed ${Math.abs(daysUntilDue)} day(s) ago.`
        : label === 'DUE_SOON'
          ? `The display-only target is due in ${daysUntilDue} day(s).`
          : `The display-only target is ${daysUntilDue} day(s) away.`,
  };
};
