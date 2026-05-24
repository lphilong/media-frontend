import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useCurrentActorCapabilities } from '@shared/auth/current-actor-capabilities';
import {
  canAccessWorkScheduleSurface,
  workScheduleSurfaceDefinitions,
  type WorkScheduleSurfaceId,
} from '@modules/work-schedule/work-schedule-surface-access';

type WorkScheduleSubnavigationProps = {
  active: WorkScheduleSurfaceId;
};

const itemClassName =
  'inline-flex min-h-9 items-center rounded border px-3 py-2 text-sm font-medium';

export const WorkScheduleSubnavigation = ({
  active,
}: WorkScheduleSubnavigationProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const visibleSurfaces = workScheduleSurfaceDefinitions.filter((surface) =>
    canAccessWorkScheduleSurface(capabilitiesQuery.data, surface.id),
  );

  return (
    <nav
      aria-label={t('work-schedule:rosterNav.label')}
      className="rounded border border-border bg-panel p-3"
    >
      <div className="flex flex-wrap gap-2">
        {visibleSurfaces.map((surface) => (
          <Link
            key={surface.id}
            to={surface.path}
            className={`${itemClassName} ${
              active === surface.id
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-bg text-text hover:bg-slate-50'
            }`}
          >
            {t(surface.labelKey)}
          </Link>
        ))}
      </div>
    </nav>
  );
};
