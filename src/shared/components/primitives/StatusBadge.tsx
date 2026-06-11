import clsx from 'clsx';

export type StatusBadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted'
  | 'indigo'
  | 'privacy';
export type StatusToneMap = Record<string, StatusBadgeTone>;
export type StatusBadgeFamily =
  | 'lifecycle'
  | 'employment'
  | 'workflow'
  | 'readiness'
  | 'severity'
  | 'access'
  | 'privacy'
  | 'navigation';

type StatusBadgeProps = {
  label?: string;
  status?: string;
  tone?: StatusBadgeTone;
  family?: StatusBadgeFamily;
  toneByStatus?: StatusToneMap;
  className?: string;
  uppercase?: boolean;
  title?: string;
  ariaLabel?: string;
};

const TONE_STYLES: Record<StatusBadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-sky-100 text-sky-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  muted: 'bg-gray-200 text-gray-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  privacy: 'bg-violet-100 text-violet-700',
};

export const STATUS_BADGE_TONE_BY_FAMILY: Record<StatusBadgeFamily, StatusToneMap> = {
  lifecycle: {
    ACTIVE: 'success',
    INACTIVE: 'warning',
    SUSPENDED: 'warning',
    TERMINATED: 'danger',
    ARCHIVED: 'muted',
  },
  employment: {
    ACTIVE: 'success',
    ON_LEAVE: 'info',
    SUSPENDED: 'warning',
    TERMINATED: 'danger',
    ARCHIVED: 'muted',
  },
  workflow: {
    DRAFT: 'neutral',
    PENDING: 'warning',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    PUBLISHED: 'info',
    FINALIZED: 'indigo',
    CLOSED: 'indigo',
    CANCELLED: 'muted',
    REJECTED: 'danger',
    DENIED: 'danger',
    FAILED_TO_APPLY: 'danger',
  },
  readiness: {
    READY: 'success',
    CURRENT_EFFECTIVE: 'success',
    ACTION_NEEDED: 'danger',
    BLOCKED: 'danger',
    NOT_READY: 'warning',
    PENDING_APPROVAL: 'warning',
    MISSING_BASE_SALARY: 'danger',
    OVERLAPPING: 'danger',
  },
  severity: {
    CRITICAL: 'danger',
    BLOCKER: 'danger',
    WARNING: 'warning',
    INFO: 'info',
    ERROR: 'danger',
  },
  access: {
    READ_ONLY: 'info',
    CAN_ACT: 'success',
    CONFIGURABLE: 'info',
    NO_PERMISSION: 'danger',
    NO_SCOPE: 'warning',
  },
  privacy: {
    REDACTED: 'privacy',
    SENSITIVE_PERMISSION_REQUIRED: 'privacy',
  },
  navigation: {
    ACTIVE: 'info',
    SELECTED: 'info',
  },
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
  ariaLabel,
  family,
  label,
  status,
  tone = 'neutral',
  toneByStatus,
  className,
  title,
  uppercase = true,
}: StatusBadgeProps): JSX.Element => {
  const textTransform = uppercase ? 'uppercase' : 'normal-case';
  const badgeTone = resolveTone(
    status,
    tone,
    toneByStatus ?? (family ? STATUS_BADGE_TONE_BY_FAMILY[family] : undefined),
  );
  const text = label ?? status ?? '';

  return (
    <span
      aria-label={ariaLabel ?? text}
      className={clsx(
        'inline-flex rounded-full px-2 py-1 text-xs font-medium',
        textTransform,
        TONE_STYLES[badgeTone],
        className,
      )}
      title={title ?? text}
    >
      {text}
    </span>
  );
};
