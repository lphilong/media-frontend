import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import { canArchiveEvent } from '@modules/event-assignment/actions/event-assignment-action-rail';
import type {
  EventAssignmentItem,
  EventAssignmentKind,
  EventLifecycleAction,
  EventListItem,
  EventRelatedListItem,
} from '@modules/event-assignment/types/event-assignment.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatVietnamTimestamp, readReferenceDisplay } from '@shared/formatting/formatters';

export type EventTableRow = EventListItem | EventRelatedListItem;

type EventListColumnHandlers = {
  onOpenDetail: (eventId: string) => void;
  onLifecycleAction: (eventId: string, action: EventLifecycleAction) => void;
  isActionPending?: (eventId: string, action: EventLifecycleAction) => boolean;
  canShowLifecycleActions?: boolean;
};

const statusToneMap = {
  DRAFT: 'muted',
  PLANNED: 'info',
  CONFIRMED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  ARCHIVED: 'muted',
} as const;

export const assignmentKindValues: EventAssignmentKind[] = [
  'EMPLOYMENT_PROFILE',
  'TALENT',
  'TALENT_GROUP',
];

export const readEventAssignmentSubjectId = (
  assignment: Pick<
    EventAssignmentItem,
    | 'assignmentKind'
    | 'assignmentEmploymentProfileId'
    | 'assignmentTalentId'
    | 'assignmentTalentGroupId'
  >,
): string | null | undefined => {
  switch (assignment.assignmentKind) {
    case 'EMPLOYMENT_PROFILE':
      return assignment.assignmentEmploymentProfileId;
    case 'TALENT':
      return assignment.assignmentTalentId;
    case 'TALENT_GROUP':
      return assignment.assignmentTalentGroupId;
    default:
      return undefined;
  }
};

const readLifecycleActions = (record: EventTableRow): EventLifecycleAction[] => {
  const actions: EventLifecycleAction[] = [];

  if (record.status === 'DRAFT') {
    actions.push('plan');
  }

  if (record.status === 'PLANNED') {
    actions.push('confirm');
  }

  if (record.status === 'CONFIRMED') {
    actions.push('complete');
  }

  if (canArchiveEvent(record)) {
    actions.push('archive');
  }

  return actions;
};

export const createEventListColumns = (
  t: TFunction,
  handlers: EventListColumnHandlers,
): ColumnDef<EventTableRow>[] => [
  {
    accessorKey: 'eventCode',
    header: t('event-assignment:table.eventCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'title',
    header: t('event-assignment:table.title'),
  },
  {
    accessorKey: 'status',
    header: t('event-assignment:table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`event-assignment:statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={statusToneMap}
      />
    ),
  },
  {
    accessorKey: 'eventStartAt',
    header: t('event-assignment:table.eventStartAt'),
    cell: (context) => formatVietnamTimestamp(context.getValue() as number | string),
  },
  {
    accessorKey: 'eventEndAt',
    header: t('event-assignment:table.eventEndAt'),
    cell: (context) => formatVietnamTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('event-assignment:table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const actions = handlers.canShowLifecycleActions ? readLifecycleActions(record) : [];

      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              handlers.onOpenDetail(record.id);
            }}
          >
            {t('event-assignment:actions.open')}
          </button>
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={handlers.isActionPending?.(record.id, action)}
              onClick={(event) => {
                event.stopPropagation();
                handlers.onLifecycleAction(record.id, action);
              }}
            >
              {t(`event-assignment:actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];

export const createEventAssignmentRosterColumns = (
  t: TFunction,
  onOpenSubject: (assignment: EventAssignmentItem) => void,
): ColumnDef<EventAssignmentItem>[] => [
  {
    accessorKey: 'assignmentKind',
    header: t('event-assignment:assignments.assignmentKind'),
    cell: (context) => t(`event-assignment:assignmentKinds.${String(context.getValue() ?? '')}`),
  },
  {
    id: 'subjectId',
    header: t('event-assignment:assignments.subjectId'),
    cell: ({ row }) => (
      <span className="text-xs">
        {readReferenceDisplay(
          row.original.assignmentSubjectRef,
          readEventAssignmentSubjectId(row.original),
        )}
      </span>
    ),
  },
  {
    accessorKey: 'assignmentStatus',
    header: t('event-assignment:assignments.assignmentStatus'),
  },
  {
    id: 'actions',
    header: t('event-assignment:assignments.actions'),
    cell: ({ row }) => (
      <button
        type="button"
        className="rounded border border-border px-2 py-1 text-xs"
        onClick={() => onOpenSubject(row.original)}
      >
        {t('event-assignment:actions.openSubject')}
      </button>
    ),
  },
];
