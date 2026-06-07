import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_PATHS } from '@app/router/paths';
import {
  useMonthlyRosterList,
  useWorkScheduleAvailabilityBatchList,
  useWorkScheduleRequestBatchList,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { getWorkScheduleDeadlineCue } from '@modules/work-schedule/operational/deadline-cues';
import { StatusBadge } from '@shared/components/primitives';

const toneBySeverity = {
  INFO: 'info',
  DUE_SOON: 'warning',
  OVERDUE: 'danger',
  BLOCKED: 'danger',
} as const;
type OperationalSeverity = keyof typeof toneBySeverity;

export const AdminWorkScheduleActionNeeded = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const requestQuery = useWorkScheduleRequestBatchList({ limit: 50 });
  const availabilityQuery = useWorkScheduleAvailabilityBatchList({ limit: 50 });
  const rosterQuery = useMonthlyRosterList({ status: 'DRAFT', scope: 'global', limit: 50 });

  const requestBatches = requestQuery.data?.data ?? [];
  const availabilityBatches = availabilityQuery.data?.items ?? [];
  const pendingRequestLines = requestBatches.reduce(
    (total, batch) => total + batch.lineCounts.pending,
    0,
  );
  const pendingAvailabilityLines = availabilityBatches.reduce(
    (total, batch) => total + batch.lineCounts.pending,
    0,
  );
  const availabilityCues = availabilityBatches
    .filter((batch) => batch.lineCounts.pending > 0)
    .map((batch) =>
      getWorkScheduleDeadlineCue({
        targetMonth: batch.periodMonth,
        cueType: 'AVAILABILITY_CUTOFF',
      }),
    );
  const availabilitySeverity: OperationalSeverity = availabilityCues.some(
    (cue) => cue.label === 'OVERDUE',
  )
    ? 'OVERDUE'
    : availabilityCues.some((cue) => cue.label === 'DUE_SOON')
      ? 'DUE_SOON'
      : 'INFO';
  const draftRosters = rosterQuery.data?.data ?? [];
  const rosterCues = draftRosters.map((roster) =>
    getWorkScheduleDeadlineCue({ targetMonth: roster.rosterMonth, cueType: 'PUBLISH_TARGET' }),
  );
  const rosterSeverity = rosterCues.some((cue) => cue.label === 'OVERDUE')
    ? 'OVERDUE'
    : rosterCues.some((cue) => cue.label === 'DUE_SOON')
      ? 'DUE_SOON'
      : 'INFO';

  const cards: Array<{ id: string; count: number; severity: OperationalSeverity; to: string }> = [
    {
      id: 'availability',
      count: pendingAvailabilityLines,
      severity: availabilitySeverity,
      to: APP_PATHS.workScheduleAvailabilityBatches,
    },
    {
      id: 'requests',
      count: pendingRequestLines,
      severity: 'INFO',
      to: APP_PATHS.workScheduleRequestBatches,
    },
    {
      id: 'rosters',
      count: draftRosters.length,
      severity: rosterSeverity,
      to: APP_PATHS.monthlyRosters,
    },
  ];

  return (
    <section
      className="rounded border border-border bg-panel p-4 shadow-sm"
      data-testid="admin-work-action-needed"
    >
      <div>
        <h2 className="text-lg font-semibold text-text">
          {t('work-schedule:operational.admin.title')}
        </h2>
        <p className="text-sm text-muted">{t('work-schedule:operational.admin.summary')}</p>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className="rounded border border-border bg-bg p-3"
            data-testid={`admin-action-needed-${card.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text">
                  {t(`work-schedule:operational.admin.cards.${card.id}.label`)}
                </div>
                <div className="mt-1 text-2xl font-semibold text-text">{card.count}</div>
              </div>
              <StatusBadge
                label={t(`work-schedule:operational.severity.${card.severity}`)}
                tone={toneBySeverity[card.severity]}
                uppercase={false}
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              {t(`work-schedule:operational.admin.cards.${card.id}.reason`)}
            </p>
            <Link
              className="mt-3 inline-flex rounded border border-border px-3 py-2 text-sm font-medium text-text hover:bg-panel"
              to={card.to}
            >
              {t(`work-schedule:operational.admin.cards.${card.id}.cta`)}
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{t('work-schedule:operational.admin.bounded')}</p>
    </section>
  );
};
