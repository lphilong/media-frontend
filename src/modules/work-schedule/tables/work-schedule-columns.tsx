import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import { canArchiveWorkShift } from '@modules/work-schedule/actions/work-schedule-action-rail';
import type {
  WorkShiftByResourceItem,
  WorkShiftBySubjectItem,
  WorkShiftLifecycleAction,
  WorkShiftListItem,
  WorkShiftRecord,
  WorkShiftSubjectKind,
} from '@modules/work-schedule/types/work-schedule.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatBusinessTimestamp, readReferenceDisplay } from '@shared/formatting/formatters';

export type WorkShiftTableRow =
  | WorkShiftListItem
  | WorkShiftBySubjectItem
  | WorkShiftByResourceItem;

type WorkShiftListColumnHandlers = {
  onOpenDetail: (workShiftId: string) => void;
  onLifecycleAction: (workShiftId: string, action: WorkShiftLifecycleAction) => void;
  isActionPending?: (workShiftId: string, action: WorkShiftLifecycleAction) => boolean;
};

const statusToneMap = {
  ACTIVE: 'success',
  CANCELLED: 'danger',
  ARCHIVED: 'muted',
} as const;

export const subjectKindValues: WorkShiftSubjectKind[] = [
  'EMPLOYMENT_PROFILE',
  'TALENT',
  'TALENT_GROUP',
];

export const readWorkShiftSubjectId = (
  record: Pick<
    WorkShiftRecord,
    'subjectKind' | 'subjectEmploymentProfileId' | 'subjectTalentId' | 'subjectTalentGroupId'
  >,
): string | null | undefined => {
  switch (record.subjectKind) {
    case 'EMPLOYMENT_PROFILE':
      return record.subjectEmploymentProfileId;
    case 'TALENT':
      return record.subjectTalentId;
    case 'TALENT_GROUP':
      return record.subjectTalentGroupId;
    default:
      return undefined;
  }
};

const readLifecycleActions = (record: WorkShiftTableRow): WorkShiftLifecycleAction[] => {
  const actions: WorkShiftLifecycleAction[] = [];

  if (record.status === 'ACTIVE') {
    actions.push('cancel');
  }

  if (canArchiveWorkShift(record)) {
    actions.push('archive');
  }

  return actions;
};

const readSourceType = (record: WorkShiftTableRow): 'MANUAL' | 'ROSTER_GENERATED' =>
  'sourceType' in record && record.sourceType === 'ROSTER_GENERATED'
    ? 'ROSTER_GENERATED'
    : 'MANUAL';

export const createWorkShiftListColumns = (
  t: TFunction,
  handlers: WorkShiftListColumnHandlers,
): ColumnDef<WorkShiftTableRow>[] => [
  {
    accessorKey: 'shiftCode',
    header: t('work-schedule:table.shiftCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'title',
    header: t('work-schedule:table.title'),
  },
  {
    accessorKey: 'subjectKind',
    header: t('work-schedule:table.subjectKind'),
    cell: (context) => {
      const value = context.getValue();
      return value ? t(`work-schedule:subjectKinds.${String(value)}`) : '-';
    },
  },
  {
    id: 'subjectId',
    header: t('work-schedule:table.subjectId'),
    cell: ({ row }) => {
      const subjectId =
        'subjectKind' in row.original
          ? readWorkShiftSubjectId(row.original as WorkShiftListItem)
          : null;
      return readReferenceDisplay(
        'subjectRef' in row.original ? row.original.subjectRef : null,
        subjectId,
      );
    },
  },
  {
    accessorKey: 'status',
    header: t('work-schedule:table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`work-schedule:statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={statusToneMap}
      />
    ),
  },
  {
    id: 'sourceType',
    header: t('work-schedule:table.source'),
    cell: ({ row }) => {
      const sourceType = readSourceType(row.original);
      const month =
        'sourceRosterMonth' in row.original ? (row.original.sourceRosterMonth ?? null) : null;
      const sourceRosterLabel =
        'sourceRosterRef' in row.original
          ? readReferenceDisplay(row.original.sourceRosterRef, row.original.sourceRosterId)
          : null;

      return (
        <div>
          <span>{t(`work-schedule:sourceLabels.${sourceType}`)}</span>
          {sourceType === 'ROSTER_GENERATED' && sourceRosterLabel ? (
            <span className="block text-xs text-muted">{sourceRosterLabel}</span>
          ) : sourceType === 'ROSTER_GENERATED' && month ? (
            <span className="block text-xs text-muted">{month}</span>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: 'shiftStartAt',
    header: t('work-schedule:table.shiftStartAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
  },
  {
    accessorKey: 'shiftEndAt',
    header: t('work-schedule:table.shiftEndAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('work-schedule:table.actions'),
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
              handlers.onOpenDetail(record.id);
            }}
          >
            {t('work-schedule:actions.open')}
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
              {t(`work-schedule:actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];
