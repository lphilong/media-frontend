import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import {
  canActivateHolidayCalendar,
  canArchiveHolidayCalendar,
} from '@modules/work-schedule/actions/holiday-calendar-action-rail';
import type {
  HolidayCalendarLifecycleAction,
  HolidayCalendarRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';

type HolidayCalendarListColumnHandlers = {
  onOpenDetail: (holidayCalendarId: string) => void;
  onLifecycleAction: (holidayCalendarId: string, action: HolidayCalendarLifecycleAction) => void;
  isActionPending?: (holidayCalendarId: string, action: HolidayCalendarLifecycleAction) => boolean;
};

const statusToneMap = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  ARCHIVED: 'muted',
} as const;

const readLifecycleActions = (record: HolidayCalendarRecord): HolidayCalendarLifecycleAction[] => {
  const actions: HolidayCalendarLifecycleAction[] = [];

  if (canActivateHolidayCalendar(record)) {
    actions.push('activate');
  }

  if (canArchiveHolidayCalendar(record)) {
    actions.push('archive');
  }

  return actions;
};

export const createHolidayCalendarListColumns = (
  t: TFunction,
  handlers: HolidayCalendarListColumnHandlers,
): ColumnDef<HolidayCalendarRecord>[] => [
  {
    accessorKey: 'calendarCode',
    header: t('work-schedule:holidayCalendars.table.calendarCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'name',
    header: t('work-schedule:holidayCalendars.table.name'),
  },
  {
    accessorKey: 'status',
    header: t('work-schedule:holidayCalendars.table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`work-schedule:holidayCalendars.statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={statusToneMap}
      />
    ),
  },
  {
    accessorKey: 'scopeType',
    header: t('work-schedule:holidayCalendars.table.scopeType'),
    cell: (context) =>
      t(`work-schedule:holidayCalendars.scopeTypes.${String(context.getValue() ?? 'GLOBAL')}`),
  },
  {
    accessorKey: 'timezone',
    header: t('work-schedule:holidayCalendars.table.timezone'),
  },
  {
    id: 'active-entry-count',
    header: t('work-schedule:holidayCalendars.table.activeEntryCount'),
    cell: ({ row }) =>
      String(row.original.entries.filter((entry) => entry.status === 'ACTIVE').length),
  },
  {
    accessorKey: 'updatedAt',
    header: t('work-schedule:holidayCalendars.table.updatedAt'),
    cell: (context) => formatUtcTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('work-schedule:holidayCalendars.table.actions'),
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
              handlers.onOpenDetail(record.holidayCalendarId);
            }}
          >
            {t('work-schedule:holidayCalendars.actions.open')}
          </button>
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={handlers.isActionPending?.(record.holidayCalendarId, action)}
              onClick={(event) => {
                event.stopPropagation();
                handlers.onLifecycleAction(record.holidayCalendarId, action);
              }}
            >
              {t(`work-schedule:holidayCalendars.actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];
