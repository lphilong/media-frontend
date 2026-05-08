import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_PATHS } from '@app/router/paths';

type WorkScheduleSubnavigationProps = {
  active: 'work-shifts' | 'monthly-rosters' | 'work-patterns' | 'holiday-calendars';
};

const itemClassName =
  'inline-flex min-h-9 items-center rounded border px-3 py-2 text-sm font-medium';

export const WorkScheduleSubnavigation = ({
  active,
}: WorkScheduleSubnavigationProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);

  return (
    <nav
      aria-label={t('work-schedule:rosterNav.label')}
      className="rounded border border-border bg-panel p-3"
    >
      <div className="flex flex-wrap gap-2">
        <Link
          to={APP_PATHS.workShifts}
          className={`${itemClassName} ${
            active === 'work-shifts'
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-bg text-text hover:bg-slate-50'
          }`}
        >
          {t('work-schedule:rosterNav.workShifts')}
        </Link>
        <Link
          to={APP_PATHS.monthlyRosters}
          className={`${itemClassName} ${
            active === 'monthly-rosters'
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-bg text-text hover:bg-slate-50'
          }`}
        >
          {t('work-schedule:rosterNav.monthlyRosters')}
        </Link>
        <Link
          to={APP_PATHS.workPatterns}
          className={`${itemClassName} ${
            active === 'work-patterns'
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-bg text-text hover:bg-slate-50'
          }`}
        >
          {t('work-schedule:rosterNav.workPatterns')}
        </Link>
        <Link
          to={APP_PATHS.holidayCalendars}
          className={`${itemClassName} ${
            active === 'holiday-calendars'
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-bg text-text hover:bg-slate-50'
          }`}
        >
          {t('work-schedule:rosterNav.holidayCalendars')}
        </Link>
      </div>
    </nav>
  );
};
