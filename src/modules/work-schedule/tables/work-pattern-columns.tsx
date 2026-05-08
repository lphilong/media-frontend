import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import {
  canActivateWorkPattern,
  canArchiveWorkPattern,
} from '@modules/work-schedule/actions/work-pattern-action-rail';
import type {
  WorkPatternLifecycleAction,
  WorkPatternRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';

type WorkPatternListColumnHandlers = {
  onOpenDetail: (workPatternId: string) => void;
  onLifecycleAction: (workPatternId: string, action: WorkPatternLifecycleAction) => void;
  isActionPending?: (workPatternId: string, action: WorkPatternLifecycleAction) => boolean;
};

const statusToneMap = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  ARCHIVED: 'muted',
} as const;

const readLifecycleActions = (record: WorkPatternRecord): WorkPatternLifecycleAction[] => {
  const actions: WorkPatternLifecycleAction[] = [];

  if (canActivateWorkPattern(record)) {
    actions.push('activate');
  }

  if (canArchiveWorkPattern(record)) {
    actions.push('archive');
  }

  return actions;
};

const formatWorkingDays = (t: TFunction, days: WorkPatternRecord['workingDays']): string =>
  days.map((day) => t(`work-schedule:patterns.weekdays.${day}`)).join(', ');

export const createWorkPatternListColumns = (
  t: TFunction,
  handlers: WorkPatternListColumnHandlers,
): ColumnDef<WorkPatternRecord>[] => [
  {
    accessorKey: 'patternCode',
    header: t('work-schedule:patterns.table.patternCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'name',
    header: t('work-schedule:patterns.table.name'),
  },
  {
    accessorKey: 'status',
    header: t('work-schedule:patterns.table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`work-schedule:patterns.statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={statusToneMap}
      />
    ),
  },
  {
    accessorKey: 'startLocalTime',
    header: t('work-schedule:patterns.table.startLocalTime'),
  },
  {
    accessorKey: 'endLocalTime',
    header: t('work-schedule:patterns.table.endLocalTime'),
  },
  {
    accessorKey: 'workingDays',
    header: t('work-schedule:patterns.table.workingDays'),
    cell: (context) => formatWorkingDays(t, context.getValue() as WorkPatternRecord['workingDays']),
  },
  {
    accessorKey: 'updatedAt',
    header: t('work-schedule:patterns.table.updatedAt'),
    cell: (context) => formatUtcTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('work-schedule:patterns.table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const actions = readLifecycleActions(record);

      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              handlers.onOpenDetail(record.workPatternId);
            }}
          >
            {t('work-schedule:patterns.actions.open')}
          </button>
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={handlers.isActionPending?.(record.workPatternId, action)}
              onClick={(event) => {
                event.stopPropagation();
                handlers.onLifecycleAction(record.workPatternId, action);
              }}
            >
              {t(`work-schedule:patterns.actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];
