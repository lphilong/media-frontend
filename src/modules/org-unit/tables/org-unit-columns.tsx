import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';

import { StatusBadge } from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';
import type {
  OrgUnitChildRecord,
  OrgUnitLifecycleAction,
  OrgUnitRecord,
} from '@modules/org-unit/types/org-unit.types';

type OrgUnitListColumnHandlers = {
  onOpenDetail: (orgUnitId: string) => void;
  onLifecycleAction: (orgUnitId: string, action: OrgUnitLifecycleAction) => void;
  isActionPending?: (orgUnitId: string, action: OrgUnitLifecycleAction) => boolean;
};

const STATUS_TONE_MAP = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const readLifecycleActions = (record: OrgUnitRecord): OrgUnitLifecycleAction[] => {
  if (record.status === 'ACTIVE') {
    return ['deactivate', 'archive'];
  }

  if (record.status === 'INACTIVE') {
    return ['activate', 'archive'];
  }

  return [];
};

export const createOrgUnitListColumns = (
  t: TFunction,
  handlers: OrgUnitListColumnHandlers,
): ColumnDef<OrgUnitRecord>[] => {
  return [
    {
      accessorKey: 'code',
      header: t('org-unit:table.code'),
      cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
    },
    {
      accessorKey: 'name',
      header: t('org-unit:table.name'),
    },
    {
      accessorKey: 'type',
      header: t('org-unit:table.type'),
    },
    {
      accessorKey: 'status',
      header: t('org-unit:table.status'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          toneByStatus={STATUS_TONE_MAP}
          uppercase
        />
      ),
    },
    {
      accessorKey: 'parentOrgUnitId',
      header: t('org-unit:table.parentOrgUnitId'),
      cell: (context) => {
        const value = context.getValue() as string | null | undefined;
        return <span className="font-mono text-xs">{value ?? '-'}</span>;
      },
    },
    {
      accessorKey: 'depth',
      header: t('org-unit:table.depth'),
    },
    {
      accessorKey: 'displayOrder',
      header: t('org-unit:table.displayOrder'),
    },
    {
      accessorKey: 'createdAt',
      header: t('org-unit:table.createdAt'),
      cell: (context) => {
        return formatUtcTimestamp(context.getValue() as number | string);
      },
    },
    {
      id: 'actions',
      header: t('org-unit:table.actions'),
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
              {t('org-unit:actions.open')}
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
                {t(`org-unit:actions.${action}`)}
              </button>
            ))}
          </div>
        );
      },
    },
  ];
};

export const createOrgUnitChildrenColumns = (t: TFunction): ColumnDef<OrgUnitChildRecord>[] => {
  return [
    {
      accessorKey: 'code',
      header: t('org-unit:childrenTable.code'),
      cell: (context) => (
        <span className="font-mono text-xs">{String(context.getValue() ?? '-')}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: t('org-unit:childrenTable.name'),
    },
    {
      accessorKey: 'type',
      header: t('org-unit:childrenTable.type'),
    },
    {
      accessorKey: 'status',
      header: t('org-unit:childrenTable.status'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          toneByStatus={STATUS_TONE_MAP}
          uppercase
        />
      ),
    },
    {
      accessorKey: 'depth',
      header: t('org-unit:childrenTable.depth'),
    },
    {
      accessorKey: 'displayOrder',
      header: t('org-unit:childrenTable.displayOrder'),
    },
  ];
};
