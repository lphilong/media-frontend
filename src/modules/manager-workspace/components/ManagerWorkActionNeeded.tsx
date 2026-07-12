import { useTranslation } from 'react-i18next';

import {
  useManagerAvailabilityBatches,
  useManagerRequestBatches,
} from '@modules/manager-workspace/api/manager-workspace.api';
import { WorkScheduleDeadlineCue } from '@modules/work-schedule';
import { StatusBadge } from '@shared/components/primitives';

type ManagerWorkActionTab = 'requests' | 'availability';

const toneBySeverity = {
  INFO: 'info',
  DUE_SOON: 'warning',
  BLOCKED: 'danger',
} as const;

export const ManagerWorkActionNeeded = ({
  periodMonth,
  enabled,
  onSelectTab,
}: {
  periodMonth: string;
  enabled: boolean;
  onSelectTab: (tab: ManagerWorkActionTab) => void;
}): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const requestQuery = useManagerRequestBatches({ periodMonth }, enabled);
  const availabilityQuery = useManagerAvailabilityBatches({ periodMonth }, enabled);
  const requestBatches = requestQuery.data?.items ?? [];
  const availabilityBatches = availabilityQuery.data?.items ?? [];
  const pendingRequests = requestBatches.reduce(
    (total, batch) => total + batch.lineCounts.pending,
    0,
  );
  const rejectedRequests = requestBatches.reduce(
    (total, batch) => total + batch.lineCounts.rejected + batch.lineCounts.failedToApply,
    0,
  );
  const pendingAvailability = availabilityBatches.reduce(
    (total, batch) => total + batch.lineCounts.pending,
    0,
  );
  const rejectedAvailability = availabilityBatches.reduce(
    (total, batch) => total + batch.lineCounts.rejected,
    0,
  );
  const cards = [
    {
      id: 'pendingAvailability',
      count: pendingAvailability,
      severity: 'INFO' as const,
      tab: 'availability' as const,
    },
    {
      id: 'rejectedAvailability',
      count: rejectedAvailability,
      severity: rejectedAvailability > 0 ? ('BLOCKED' as const) : ('INFO' as const),
      tab: 'availability' as const,
    },
    {
      id: 'pendingRequests',
      count: pendingRequests,
      severity: 'INFO' as const,
      tab: 'requests' as const,
    },
    {
      id: 'rejectedRequests',
      count: rejectedRequests,
      severity: rejectedRequests > 0 ? ('BLOCKED' as const) : ('INFO' as const),
      tab: 'requests' as const,
    },
  ];

  return (
    <details
      className="rounded border border-border bg-bg p-3"
      data-testid="manager-work-action-needed"
    >
      <summary className="cursor-pointer text-sm font-semibold text-text">
        {t('manager-workspace:work.actionNeeded.title')}
      </summary>
      <div className="mt-3">
        <p className="text-sm text-muted">{t('manager-workspace:work.actionNeeded.summary')}</p>
        <p className="mt-1 text-xs text-muted">
          {t('manager-workspace:work.actionNeeded.bounded')}
        </p>
        <div className="mt-3">
          <WorkScheduleDeadlineCue
            targetMonth={periodMonth}
            cueType="AVAILABILITY_CUTOFF"
            compact
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="rounded border border-border bg-panel p-3"
              data-testid={`manager-action-needed-${card.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium uppercase text-muted">
                    {t(`manager-workspace:work.actionNeeded.cards.${card.id}.label`)}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-text">{card.count}</div>
                </div>
                <StatusBadge
                  label={t(`manager-workspace:work.actionNeeded.severity.${card.severity}`)}
                  tone={toneBySeverity[card.severity]}
                  uppercase={false}
                />
              </div>
              <button
                type="button"
                className="mt-3 rounded border border-border px-3 py-2 text-sm font-medium text-text"
                onClick={() => onSelectTab(card.tab)}
              >
                {t(`manager-workspace:work.actionNeeded.cards.${card.id}.cta`)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
};
