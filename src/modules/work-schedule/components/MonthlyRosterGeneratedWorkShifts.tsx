import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_PATHS } from '@app/router/paths';
import type {
  MonthlyRosterPublishResult,
  MonthlyRosterRecord,
  MonthlyRosterScope,
} from '@modules/work-schedule/types/work-schedule.types';
import { MetadataSection, ReadOnlyFieldGrid } from '@shared/components/primitives';
import { readReferenceDisplay } from '@shared/formatting/formatters';

type MonthlyRosterGeneratedWorkShiftsProps = {
  roster: MonthlyRosterRecord;
  scope?: MonthlyRosterScope;
  publishResult?: MonthlyRosterPublishResult | null;
};

const buildGeneratedWorkShiftsHref = (
  roster: MonthlyRosterRecord,
  scope?: MonthlyRosterScope,
): string => {
  const params = new URLSearchParams({
    sourceType: 'ROSTER_GENERATED',
    sourceRosterId: roster.monthlyRosterId,
  });

  if (scope) {
    params.set('scope', scope);
  }

  return `${APP_PATHS.workShifts}?${params.toString()}`;
};

const formatNullable = (value?: string | number | null): string =>
  value === null || value === undefined || value === '' ? '-' : String(value);

export const MonthlyRosterGeneratedWorkShifts = ({
  roster,
  scope,
  publishResult,
}: MonthlyRosterGeneratedWorkShiftsProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const isPublished = roster.status === 'PUBLISHED' || publishResult?.status === 'PUBLISHED';

  if (!isPublished) {
    return (
      <MetadataSection title={t('work-schedule:monthlyRosters.generated.title')}>
        <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('work-schedule:monthlyRosters.generated.states.unavailable')}
        </div>
      </MetadataSection>
    );
  }

  const generatedIds = publishResult?.generatedWorkShiftIds ?? [];

  return (
    <MetadataSection title={t('work-schedule:monthlyRosters.generated.title')}>
      <div className="space-y-3">
        <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('work-schedule:monthlyRosters.generated.copy')}
        </div>
        <ReadOnlyFieldGrid
          fields={[
            {
              key: 'source',
              label: t('work-schedule:monthlyRosters.generated.fields.source'),
              value: t('work-schedule:sourceLabels.ROSTER_GENERATED'),
            },
            {
              key: 'roster',
              label: t('work-schedule:monthlyRosters.generated.fields.sourceRosterId'),
              value: readReferenceDisplay(
                {
                  id: roster.monthlyRosterId,
                  code: roster.rosterCode,
                  title: roster.rosterMonth,
                  status: roster.status,
                },
                roster.monthlyRosterId,
              ),
            },
            {
              key: 'generation-run',
              label: t('work-schedule:monthlyRosters.publish.summary.generationRunId'),
              value: formatNullable(
                publishResult?.sourceGenerationRunId ?? roster.publishGenerationRunId,
              ),
              monospace: true,
            },
            {
              key: 'generated',
              label: t('work-schedule:monthlyRosters.publish.summary.generatedCount'),
              value: formatNullable(publishResult?.generatedWorkShiftCount),
            },
          ]}
          columns={2}
        />
        <Link
          to={buildGeneratedWorkShiftsHref(roster, scope)}
          className="inline-flex rounded border border-border px-3 py-2 text-sm text-accent hover:underline"
        >
          {t('work-schedule:monthlyRosters.generated.actions.openList')}
        </Link>
        {generatedIds.length > 0 ? (
          <div className="rounded border border-border bg-panel p-3">
            <p className="text-sm font-semibold text-text">
              {t('work-schedule:monthlyRosters.generated.fields.generatedShiftIds')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {generatedIds.map((workShiftId) => (
                <Link
                  key={workShiftId}
                  to={APP_PATHS.workShiftDetail(workShiftId)}
                  className="rounded border border-border px-2 py-1 font-mono text-xs text-accent hover:underline"
                >
                  {workShiftId}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </MetadataSection>
  );
};
