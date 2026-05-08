import type { TFunction } from 'i18next';

import type {
  EventLifecycleAction,
  EventRecord,
} from '@modules/event-assignment/types/event-assignment.types';
import type { ActionRailItem } from '@shared/components/primitives';

type EventActionRailHandlers = {
  onEdit: () => void;
  onReschedule: () => void;
  onReplaceAssignments: () => void;
  onReplaceStudioResources: () => void;
  onReplacePlatformAccounts: () => void;
  onLifecycleAction: (action: EventLifecycleAction) => void;
  hasActiveAssignments?: boolean;
  assignmentRosterKnown?: boolean;
  isLifecyclePending?: (action: EventLifecycleAction) => boolean;
};

const isScheduled = (record: EventRecord): boolean => record.status === 'SCHEDULED';
const isArchived = (record: EventRecord): boolean => record.status === 'ARCHIVED';
const isHistorical = (record: EventRecord): boolean => Number(record.eventEndAt) < Date.now();

export const canArchiveEvent = (record: Pick<EventRecord, 'status' | 'eventEndAt'>): boolean => {
  return (
    record.status === 'COMPLETED' ||
    record.status === 'CANCELLED' ||
    (record.status === 'SCHEDULED' && Number(record.eventEndAt) < Date.now())
  );
};

export const createEventActionRailItems = (
  t: TFunction,
  record: EventRecord,
  handlers: EventActionRailHandlers,
): ActionRailItem[] => {
  const scheduled = isScheduled(record);
  const startDisabledByRoster = handlers.assignmentRosterKnown && !handlers.hasActiveAssignments;
  const assignmentReplacementAvailable = scheduled && handlers.assignmentRosterKnown;
  const canStart = scheduled && !startDisabledByRoster;
  const canComplete = record.status === 'IN_PROGRESS';
  const canCancel = record.status === 'SCHEDULED' || record.status === 'IN_PROGRESS';
  const canArchive = !isArchived(record) && canArchiveEvent(record);

  const items: ActionRailItem[] = [
    {
      id: 'edit',
      label: t('event-assignment:actions.edit'),
      disabled: !scheduled,
      onClick: scheduled ? handlers.onEdit : undefined,
    },
    {
      id: 'reschedule',
      label: t('event-assignment:actions.reschedule'),
      disabled: !scheduled,
      onClick: scheduled ? handlers.onReschedule : undefined,
    },
    {
      id: 'replace-assignments',
      label: t('event-assignment:actions.replaceAssignments'),
      disabled: !assignmentReplacementAvailable,
      onClick: assignmentReplacementAvailable ? handlers.onReplaceAssignments : undefined,
    },
    {
      id: 'replace-studio-resources',
      label: t('event-assignment:actions.replaceStudioResources'),
      disabled: !scheduled,
      onClick: scheduled ? handlers.onReplaceStudioResources : undefined,
    },
    {
      id: 'replace-platform-accounts',
      label: t('event-assignment:actions.replacePlatformAccounts'),
      disabled: !scheduled,
      onClick: scheduled ? handlers.onReplacePlatformAccounts : undefined,
    },
    {
      id: 'start',
      label: t('event-assignment:actions.start'),
      disabled: !canStart || handlers.isLifecyclePending?.('start'),
      onClick: canStart ? () => handlers.onLifecycleAction('start') : undefined,
    },
    {
      id: 'complete',
      label: t('event-assignment:actions.complete'),
      disabled: !canComplete || handlers.isLifecyclePending?.('complete'),
      onClick: canComplete ? () => handlers.onLifecycleAction('complete') : undefined,
    },
    {
      id: 'cancel',
      label: t('event-assignment:actions.cancel'),
      tone: 'danger',
      disabled: !canCancel || handlers.isLifecyclePending?.('cancel'),
      onClick: canCancel ? () => handlers.onLifecycleAction('cancel') : undefined,
    },
    {
      id: 'archive',
      label: t('event-assignment:actions.archive'),
      tone: 'danger',
      disabled: !canArchive || handlers.isLifecyclePending?.('archive'),
      onClick: canArchive ? () => handlers.onLifecycleAction('archive') : undefined,
    },
    {
      id: 'historical-readonly-note',
      label: t('event-assignment:actions.historicalArchiveEligible'),
      disabled: true,
      onClick: undefined,
    },
  ];

  return items.filter(
    (item) => item.id !== 'historical-readonly-note' || (scheduled && isHistorical(record)),
  );
};
