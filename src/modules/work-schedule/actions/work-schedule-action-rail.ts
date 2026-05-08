import type { TFunction } from 'i18next';

import type {
  WorkShiftLifecycleAction,
  WorkShiftRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import type { ActionRailItem } from '@shared/components/primitives';

type WorkShiftActionRailHandlers = {
  onEdit: () => void;
  onReschedule: () => void;
  onReassignSubject: () => void;
  onReplaceResources: () => void;
  onLifecycleAction: (action: WorkShiftLifecycleAction) => void;
  isLifecyclePending?: (action: WorkShiftLifecycleAction) => boolean;
};

const isActive = (record: WorkShiftRecord): boolean => record.status === 'ACTIVE';
const isArchived = (record: WorkShiftRecord): boolean => record.status === 'ARCHIVED';
const isHistorical = (record: WorkShiftRecord): boolean => Number(record.shiftEndAt) < Date.now();

export const canArchiveWorkShift = (
  record: Pick<WorkShiftRecord, 'status' | 'shiftEndAt'>,
): boolean => {
  return (
    record.status === 'CANCELLED' ||
    (record.status === 'ACTIVE' && Number(record.shiftEndAt) < Date.now())
  );
};

export const createWorkShiftActionRailItems = (
  t: TFunction,
  record: WorkShiftRecord,
  handlers: WorkShiftActionRailHandlers,
): ActionRailItem[] => {
  const active = isActive(record);
  const archived = isArchived(record);
  const canArchive = canArchiveWorkShift(record);

  const items: ActionRailItem[] = [
    {
      id: 'edit',
      label: t('work-schedule:actions.edit'),
      disabled: !active,
      onClick: active ? handlers.onEdit : undefined,
    },
    {
      id: 'reschedule',
      label: t('work-schedule:actions.reschedule'),
      disabled: !active,
      onClick: active ? handlers.onReschedule : undefined,
    },
    {
      id: 'reassign-subject',
      label: t('work-schedule:actions.reassignSubject'),
      disabled: !active,
      onClick: active ? handlers.onReassignSubject : undefined,
    },
    {
      id: 'replace-resources',
      label: t('work-schedule:actions.replaceResources'),
      disabled: !active,
      onClick: active ? handlers.onReplaceResources : undefined,
    },
    {
      id: 'cancel',
      label: t('work-schedule:actions.cancel'),
      tone: 'danger',
      disabled: !active || handlers.isLifecyclePending?.('cancel'),
      onClick: active ? () => handlers.onLifecycleAction('cancel') : undefined,
    },
    {
      id: 'archive',
      label: t('work-schedule:actions.archive'),
      tone: 'danger',
      disabled: archived || !canArchive || handlers.isLifecyclePending?.('archive'),
      onClick: !archived && canArchive ? () => handlers.onLifecycleAction('archive') : undefined,
    },
    {
      id: 'historical-readonly-note',
      label: t('work-schedule:actions.historicalArchiveEligible'),
      disabled: true,
      onClick: undefined,
    },
  ];

  return items.filter(
    (item) => item.id !== 'historical-readonly-note' || (active && isHistorical(record)),
  );
};
