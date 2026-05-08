import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';

import { StatusBadge } from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';
import type {
  StudioResourceAvailabilityItem,
  StudioResourceLifecycleAction,
  StudioResourceListItem,
} from '@modules/studio-resource/types/studio-resource.types';

type StudioResourceListColumnHandlers = {
  onOpenDetail: (studioResourceId: string) => void;
  onLifecycleAction: (studioResourceId: string, action: StudioResourceLifecycleAction) => void;
  isActionPending?: (studioResourceId: string, action: StudioResourceLifecycleAction) => boolean;
};

const statusToneMap = {
  ACTIVE: 'success',
  OUT_OF_SERVICE: 'warning',
  INACTIVE: 'neutral',
  ARCHIVED: 'muted',
} as const;

const readLifecycleActions = (record: StudioResourceListItem): StudioResourceLifecycleAction[] => {
  if (record.operationalStatus === 'ACTIVE' || record.operationalStatus === 'OUT_OF_SERVICE') {
    return ['deactivate'];
  }

  if (record.operationalStatus === 'INACTIVE') {
    return ['activate', 'archive'];
  }

  return [];
};

const formatOccupancy = (value?: number | null): string => {
  return value === null || value === undefined ? '-' : String(value);
};

export const createStudioResourceListColumns = (
  t: TFunction,
  handlers: StudioResourceListColumnHandlers,
): ColumnDef<StudioResourceListItem>[] => {
  return [
    {
      accessorKey: 'resourceCode',
      header: t('studio-resource:table.resourceCode'),
      cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
    },
    {
      accessorKey: 'name',
      header: t('studio-resource:table.name'),
    },
    {
      accessorKey: 'shortName',
      header: t('studio-resource:table.shortName'),
      cell: (context) => String(context.getValue() ?? '-'),
    },
    {
      accessorKey: 'resourceClass',
      header: t('studio-resource:table.resourceClass'),
      cell: (context) => <span className="font-mono text-xs">{String(context.getValue())}</span>,
    },
    {
      accessorKey: 'operationalStatus',
      header: t('studio-resource:table.operationalStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`studio-resource:statuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={statusToneMap}
        />
      ),
    },
    {
      accessorKey: 'locationLabel',
      header: t('studio-resource:table.locationLabel'),
      cell: (context) => String(context.getValue() ?? '-'),
    },
    {
      accessorKey: 'maxOccupancy',
      header: t('studio-resource:table.maxOccupancy'),
      cell: (context) => formatOccupancy(context.getValue() as number | null | undefined),
    },
    {
      accessorKey: 'createdAt',
      header: t('studio-resource:table.createdAt'),
      cell: (context) => formatUtcTimestamp(context.getValue() as number | string),
    },
    {
      id: 'actions',
      header: t('studio-resource:table.actions'),
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
              {t('studio-resource:actions.open')}
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
                {t(`studio-resource:actions.${action}`)}
              </button>
            ))}
          </div>
        );
      },
    },
  ];
};

export const createStudioResourceAvailabilityColumns = (
  t: TFunction,
  handlers: Pick<StudioResourceListColumnHandlers, 'onOpenDetail'>,
): ColumnDef<StudioResourceAvailabilityItem>[] => {
  return [
    {
      accessorKey: 'resourceCode',
      header: t('studio-resource:table.resourceCode'),
      cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
    },
    {
      accessorKey: 'name',
      header: t('studio-resource:table.name'),
    },
    {
      accessorKey: 'resourceClass',
      header: t('studio-resource:table.resourceClass'),
      cell: (context) => <span className="font-mono text-xs">{String(context.getValue())}</span>,
    },
    {
      accessorKey: 'operationalStatus',
      header: t('studio-resource:table.operationalStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`studio-resource:statuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={statusToneMap}
        />
      ),
    },
    {
      accessorKey: 'maxOccupancy',
      header: t('studio-resource:table.maxOccupancy'),
      cell: (context) => formatOccupancy(context.getValue() as number | null | undefined),
    },
    {
      id: 'actions',
      header: t('studio-resource:table.actions'),
      cell: ({ row }) => (
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs"
          onClick={() => handlers.onOpenDetail(row.original.id)}
        >
          {t('studio-resource:actions.open')}
        </button>
      ),
    },
  ];
};
