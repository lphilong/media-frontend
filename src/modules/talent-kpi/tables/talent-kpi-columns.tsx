import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import { readTalentKpiListLifecycleActions } from '@modules/talent-kpi/actions/talent-kpi-action-rail';
import type {
  TalentKpiByEventItem,
  TalentKpiByPlatformItem,
  TalentKpiByTalentItem,
  TalentKpiLifecycleAction,
  TalentKpiListItem,
  TalentKpiStatus,
} from '@modules/talent-kpi/types/talent-kpi.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';

export type TalentKpiTableRow =
  | TalentKpiListItem
  | TalentKpiByTalentItem
  | TalentKpiByPlatformItem
  | TalentKpiByEventItem;

type TalentKpiColumnHandlers = {
  onOpenDetail: (talentKpiRecordId: string) => void;
  onLifecycleAction: (talentKpiRecordId: string, action: TalentKpiLifecycleAction) => void;
  isActionPending?: (talentKpiRecordId: string, action: TalentKpiLifecycleAction) => boolean;
};

export const talentKpiStatusToneMap = {
  DRAFT: 'neutral',
  FINALIZED: 'success',
  ARCHIVED: 'muted',
} as const;

export const talentKpiStatusValues: TalentKpiStatus[] = ['DRAFT', 'FINALIZED', 'ARCHIVED'];

const renderMono = (value: unknown): JSX.Element | string => {
  if (!value) {
    return '-';
  }

  return <span className="font-mono text-xs">{String(value)}</span>;
};

const renderNullableTimestamp = (value: unknown): string =>
  value === null || value === undefined || value === '' ? '-' : formatUtcTimestamp(value as string);

export const createTalentKpiColumns = (
  t: TFunction,
  handlers: TalentKpiColumnHandlers,
): ColumnDef<TalentKpiTableRow>[] => [
  {
    accessorKey: 'kpiRecordCode',
    header: t('talent-kpi:table.kpiRecordCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'title',
    header: t('talent-kpi:table.title'),
  },
  {
    accessorKey: 'subjectTalentId',
    header: t('talent-kpi:table.subjectTalentId'),
    cell: (context) => renderMono(context.getValue()),
  },
  {
    accessorKey: 'attributionPlatformAccountId',
    header: t('talent-kpi:table.attributionPlatformAccountId'),
    cell: (context) => renderMono(context.getValue()),
  },
  {
    accessorKey: 'attributionEventId',
    header: t('talent-kpi:table.attributionEventId'),
    cell: (context) => renderMono(context.getValue()),
  },
  {
    accessorKey: 'measurementSource',
    header: t('talent-kpi:table.measurementSource'),
    cell: (context) => t(`talent-kpi:measurementSources.${String(context.getValue() ?? '')}`),
  },
  {
    accessorKey: 'status',
    header: t('talent-kpi:table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`talent-kpi:statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={talentKpiStatusToneMap}
      />
    ),
  },
  {
    accessorKey: 'periodStartAt',
    header: t('talent-kpi:table.periodStartAt'),
    cell: (context) => formatUtcTimestamp(context.getValue() as string),
  },
  {
    accessorKey: 'periodEndAt',
    header: t('talent-kpi:table.periodEndAt'),
    cell: (context) => formatUtcTimestamp(context.getValue() as string),
  },
  {
    accessorKey: 'publishedAt',
    header: t('talent-kpi:table.publishedAt'),
    cell: (context) => renderNullableTimestamp(context.getValue()),
  },
  {
    id: 'actions',
    header: t('talent-kpi:table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const lifecycleActions = readTalentKpiListLifecycleActions(record.status);

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
            {t('talent-kpi:actions.open')}
          </button>
          {lifecycleActions.map((action) => (
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
              {t(`talent-kpi:actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];
