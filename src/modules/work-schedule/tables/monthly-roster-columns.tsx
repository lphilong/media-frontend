import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import { canArchiveMonthlyRoster } from '@modules/work-schedule/actions/monthly-roster-action-rail';
import type {
  MonthlyRosterListItem,
  MonthlyRosterScope,
} from '@modules/work-schedule/types/work-schedule.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatBusinessTimestamp, readReferenceDisplay } from '@shared/formatting/formatters';

type MonthlyRosterListColumnHandlers = {
  onOpenDetail: (monthlyRosterId: string, scope?: MonthlyRosterScope) => void;
  onArchive: (monthlyRosterId: string, scope?: MonthlyRosterScope) => void;
  canShowArchive?: boolean;
  isArchivePending?: (monthlyRosterId: string) => boolean;
  scope?: MonthlyRosterScope;
};

const statusToneMap = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  LOCKED: 'info',
  ARCHIVED: 'muted',
} as const;

export const createMonthlyRosterListColumns = (
  t: TFunction,
  handlers: MonthlyRosterListColumnHandlers,
): ColumnDef<MonthlyRosterListItem>[] => [
  {
    accessorKey: 'rosterCode',
    header: t('work-schedule:monthlyRosters.table.rosterCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'rosterMonth',
    header: t('work-schedule:monthlyRosters.table.rosterMonth'),
  },
  {
    accessorKey: 'departmentOrgUnitId',
    header: t('work-schedule:monthlyRosters.table.department'),
    cell: ({ row }) =>
      readReferenceDisplay(row.original.departmentOrgUnitRef, row.original.departmentOrgUnitId),
  },
  {
    accessorKey: 'workPatternId',
    header: t('work-schedule:monthlyRosters.table.workPattern'),
    cell: ({ row }) =>
      readReferenceDisplay(row.original.workPatternRef, row.original.workPatternId),
  },
  {
    accessorKey: 'holidayCalendarId',
    header: t('work-schedule:monthlyRosters.table.holidayCalendar'),
    cell: ({ row }) =>
      readReferenceDisplay(row.original.holidayCalendarRef, row.original.holidayCalendarId),
  },
  {
    accessorKey: 'status',
    header: t('work-schedule:monthlyRosters.table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`work-schedule:monthlyRosters.statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={statusToneMap}
      />
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: t('work-schedule:monthlyRosters.table.updatedAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('work-schedule:monthlyRosters.table.actions'),
    cell: ({ row }) => {
      const record = row.original;

      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              handlers.onOpenDetail(record.monthlyRosterId, handlers.scope);
            }}
          >
            {t('work-schedule:monthlyRosters.actions.open')}
          </button>
          {canArchiveMonthlyRoster(record) && handlers.canShowArchive !== false ? (
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={handlers.isArchivePending?.(record.monthlyRosterId)}
              onClick={(event) => {
                event.stopPropagation();
                handlers.onArchive(record.monthlyRosterId, handlers.scope);
              }}
            >
              {t('work-schedule:monthlyRosters.actions.archive')}
            </button>
          ) : null}
        </div>
      );
    },
  },
];
