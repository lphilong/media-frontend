import { useTranslation } from 'react-i18next';

import {
  getWorkScheduleDeadlineCue,
  type WorkScheduleDeadlineCueType,
} from '@modules/work-schedule/operational/deadline-cues';
import { StatusBadge } from '@shared/components/primitives';

const toneByLabel = {
  ON_TRACK: 'success',
  DUE_SOON: 'warning',
  OVERDUE: 'danger',
  NOT_APPLICABLE: 'neutral',
} as const;

export const WorkScheduleDeadlineCue = ({
  targetMonth,
  cueType,
  compact = false,
}: {
  targetMonth?: string | null;
  cueType: WorkScheduleDeadlineCueType;
  compact?: boolean;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const cue = getWorkScheduleDeadlineCue({ targetMonth, cueType });

  return (
    <div
      className={
        compact ? 'flex flex-wrap items-center gap-2' : 'rounded border border-border bg-bg p-3'
      }
    >
      <StatusBadge
        label={t(`work-schedule:operational.deadlines.labels.${cue.label}`)}
        tone={toneByLabel[cue.label]}
        uppercase={false}
      />
      <span className="text-sm text-muted">
        {t(`work-schedule:operational.deadlines.types.${cueType}`)}
        {cue.dueDate
          ? `: ${cue.dueDate}. ${t(`work-schedule:operational.deadlines.reasons.${cue.label}`, {
              count: Math.abs(cue.daysUntilDue ?? 0),
            })}`
          : `: ${t('work-schedule:operational.deadlines.reasons.NOT_APPLICABLE')}`}
      </span>
    </div>
  );
};
