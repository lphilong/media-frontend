import clsx from 'clsx';

export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
export type StatusToneMap = Record<string, StatusBadgeTone>;

type StatusBadgeProps = {
  label?: string;
  status?: string;
  tone?: StatusBadgeTone;
  toneByStatus?: StatusToneMap;
  className?: string;
  uppercase?: boolean;
};

const TONE_STYLES: Record<StatusBadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-sky-100 text-sky-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  muted: 'bg-gray-200 text-gray-700',
};

const resolveTone = (
  status: string | undefined,
  tone: StatusBadgeTone | undefined,
  toneByStatus: StatusToneMap | undefined,
): StatusBadgeTone => {
  if (status && toneByStatus?.[status]) {
    return toneByStatus[status];
  }

  return tone ?? 'neutral';
};

export const StatusBadge = ({
  label,
  status,
  tone = 'neutral',
  toneByStatus,
  className,
  uppercase = true,
}: StatusBadgeProps): JSX.Element => {
  const textTransform = uppercase ? 'uppercase' : 'normal-case';
  const badgeTone = resolveTone(status, tone, toneByStatus);
  const text = label ?? status ?? '';

  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-2 py-1 text-xs font-medium',
        textTransform,
        TONE_STYLES[badgeTone],
        className,
      )}
    >
      {text}
    </span>
  );
};
