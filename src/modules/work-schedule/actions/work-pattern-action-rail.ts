import type { TFunction } from 'i18next';

import type {
  WorkPatternLifecycleAction,
  WorkPatternRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import type { ActionRailItem } from '@shared/components/primitives';

type WorkPatternActionRailHandlers = {
  onEdit: () => void;
  onLifecycleAction: (action: WorkPatternLifecycleAction) => void;
  isLifecyclePending?: (action: WorkPatternLifecycleAction) => boolean;
};

export const canActivateWorkPattern = (record: Pick<WorkPatternRecord, 'status'>): boolean =>
  record.status === 'DRAFT';

export const canArchiveWorkPattern = (record: Pick<WorkPatternRecord, 'status'>): boolean =>
  record.status === 'DRAFT' || record.status === 'ACTIVE';

export const createWorkPatternActionRailItems = (
  t: TFunction,
  record: WorkPatternRecord,
  handlers: WorkPatternActionRailHandlers,
): ActionRailItem[] => {
  const archived = record.status === 'ARCHIVED';
  const canActivate = canActivateWorkPattern(record);
  const canArchive = canArchiveWorkPattern(record);

  return [
    {
      id: 'edit',
      label: t('work-schedule:patterns.actions.edit'),
      disabled: archived,
      onClick: archived ? undefined : handlers.onEdit,
    },
    {
      id: 'activate',
      label: t('work-schedule:patterns.actions.activate'),
      disabled: !canActivate || handlers.isLifecyclePending?.('activate'),
      onClick: canActivate ? () => handlers.onLifecycleAction('activate') : undefined,
    },
    {
      id: 'archive',
      label: t('work-schedule:patterns.actions.archive'),
      tone: 'danger',
      disabled: !canArchive || handlers.isLifecyclePending?.('archive'),
      onClick: canArchive ? () => handlers.onLifecycleAction('archive') : undefined,
    },
  ];
};
