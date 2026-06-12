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
  onReplacePlatformAccounts: () => void;
  onLifecycleAction: (action: EventLifecycleAction) => void;
  hasActiveAssignments?: boolean;
  assignmentRosterKnown?: boolean;
  isLifecyclePending?: (action: EventLifecycleAction) => boolean;
};

const isDraftOrPlanned = (record: EventRecord): boolean =>
  record.status === 'DRAFT' || record.status === 'PLANNED';
const isArchived = (record: EventRecord): boolean => record.status === 'ARCHIVED';

export const canArchiveEvent = (record: Pick<EventRecord, 'status'>): boolean =>
  record.status === 'COMPLETED' || record.status === 'CANCELLED';

export const createEventActionRailItems = (
  t: TFunction,
  record: EventRecord,
  handlers: EventActionRailHandlers,
): ActionRailItem[] => {
  const editable = isDraftOrPlanned(record);
  const startDisabledByRoster = handlers.assignmentRosterKnown && !handlers.hasActiveAssignments;
  const assignmentReplacementAvailable = editable && handlers.assignmentRosterKnown;
  const canPlan = record.status === 'DRAFT' && !startDisabledByRoster;
  const canConfirm = record.status === 'PLANNED';
  const canComplete = record.status === 'CONFIRMED';
  const canCancel =
    record.status === 'DRAFT' || record.status === 'PLANNED' || record.status === 'CONFIRMED';
  const canArchive = !isArchived(record) && canArchiveEvent(record);

  const items: ActionRailItem[] = [
    {
      id: 'edit',
      label: t('event-assignment:actions.edit'),
      disabled: !editable,
      onClick: editable ? handlers.onEdit : undefined,
    },
    {
      id: 'reschedule',
      label: t('event-assignment:actions.reschedule'),
      disabled: !editable,
      onClick: editable ? handlers.onReschedule : undefined,
    },
    {
      id: 'replace-assignments',
      label: t('event-assignment:actions.replaceAssignments'),
      disabled: !assignmentReplacementAvailable,
      onClick: assignmentReplacementAvailable ? handlers.onReplaceAssignments : undefined,
    },
    {
      id: 'replace-platform-accounts',
      label: t('event-assignment:actions.replacePlatformAccounts'),
      disabled: !editable,
      onClick: editable ? handlers.onReplacePlatformAccounts : undefined,
    },
    {
      id: 'plan',
      label: t('event-assignment:actions.plan'),
      disabled: !canPlan || handlers.isLifecyclePending?.('plan'),
      onClick: canPlan ? () => handlers.onLifecycleAction('plan') : undefined,
    },
    {
      id: 'confirm',
      label: t('event-assignment:actions.confirm'),
      disabled: !canConfirm || handlers.isLifecyclePending?.('confirm'),
      onClick: canConfirm ? () => handlers.onLifecycleAction('confirm') : undefined,
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
  ];

  return items;
};
