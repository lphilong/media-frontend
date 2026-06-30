import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import type { RoleLifecycleAction, RoleListItem } from '@modules/role/types/role.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';

type RoleListColumnHandlers = {
  onOpenDetail: (roleId: string) => void;
  onLifecycleAction: (roleId: string, action: RoleLifecycleAction) => void;
  canShowLifecycleAction?: (action: RoleLifecycleAction) => boolean;
  isActionPending?: (roleId: string, action: RoleLifecycleAction) => boolean;
};

const roleStateToneMap = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const readLifecycleActions = (record: RoleListItem): RoleLifecycleAction[] => {
  if (record.state === 'DRAFT' || record.state === 'INACTIVE') {
    return ['activate', 'archive'];
  }

  if (record.state === 'ACTIVE') {
    return ['deactivate'];
  }

  return [];
};

export const createRoleListColumns = (
  t: TFunction,
  handlers: RoleListColumnHandlers,
): ColumnDef<RoleListItem>[] => [
  {
    accessorKey: 'code',
    header: t('role:table.code'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'name',
    header: t('role:table.name'),
  },
  {
    accessorKey: 'state',
    header: t('role:table.state'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`role:states.${String(context.getValue() ?? '')}`)}
        toneByStatus={roleStateToneMap}
      />
    ),
  },
  {
    accessorKey: 'permissionsSummary',
    header: t('role:table.permissionsSummary'),
    cell: (context) => String(context.getValue() ?? '-'),
  },
  {
    accessorKey: 'assignmentCountSummary',
    header: t('role:table.assignmentCountSummary'),
    cell: (context) => String(context.getValue() ?? '-'),
  },
  {
    accessorKey: 'updatedAt',
    header: t('role:table.updatedAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('role:table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const actions = readLifecycleActions(record).filter(
        (action) => handlers.canShowLifecycleAction?.(action) ?? true,
      );

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
            {t('role:actions.open')}
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
              {t(`role:actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];
