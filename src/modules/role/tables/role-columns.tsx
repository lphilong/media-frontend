import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import { APP_PATHS } from '@app/router/paths';
import type {
  RoleAssignmentItem,
  RoleLifecycleAction,
  RoleListItem,
  RoleState,
} from '@modules/role/types/role.types';
import { ReferenceChip, StatusBadge } from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';

type RoleListColumnHandlers = {
  onOpenDetail: (roleId: string) => void;
  onLifecycleAction: (roleId: string, action: RoleLifecycleAction) => void;
  isActionPending?: (roleId: string, action: RoleLifecycleAction) => boolean;
};

type RoleAssignmentColumnHandlers = {
  roleState?: RoleState;
  onRevokeAssignment: (assignment: RoleAssignmentItem) => void;
  isActionPending?: (assignmentId: string) => boolean;
};

const roleStateToneMap = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const assignmentStateToneMap = {
  ACTIVE: 'success',
  REVOKED: 'muted',
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
    cell: (context) => formatUtcTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('role:table.actions'),
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

export const createRoleAssignmentColumns = (
  t: TFunction,
  handlers: RoleAssignmentColumnHandlers,
): ColumnDef<RoleAssignmentItem>[] => [
  {
    accessorKey: 'assignmentId',
    header: t('role:assignments.assignmentId'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'userId',
    header: t('role:assignments.userId'),
    cell: (context) => {
      const userId = String(context.getValue() ?? '');
      return userId ? <ReferenceChip label={userId} to={APP_PATHS.userDetail(userId)} /> : '-';
    },
  },
  {
    accessorKey: 'state',
    header: t('role:assignments.state'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`role:assignmentStates.${String(context.getValue() ?? '')}`)}
        toneByStatus={assignmentStateToneMap}
      />
    ),
  },
  {
    accessorKey: 'effectiveAt',
    header: t('role:assignments.effectiveAt'),
    cell: (context) => formatUtcTimestamp(context.getValue() as number | string),
  },
  {
    accessorKey: 'revokedAt',
    header: t('role:assignments.revokedAt'),
    cell: (context) => {
      const value = context.getValue() as number | string | null | undefined;
      return value === null || value === undefined ? '-' : formatUtcTimestamp(value);
    },
  },
  {
    accessorKey: 'reason',
    header: t('role:assignments.reason'),
    cell: (context) => String(context.getValue() ?? '-'),
  },
  {
    id: 'actions',
    header: t('role:table.actions'),
    cell: ({ row }) => {
      const assignment = row.original;
      const canRevoke = handlers.roleState === 'ACTIVE' && assignment.state === 'ACTIVE';

      return (
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canRevoke || handlers.isActionPending?.(assignment.assignmentId)}
          onClick={() => handlers.onRevokeAssignment(assignment)}
        >
          {t('role:actions.revokeAssignment')}
        </button>
      );
    },
  },
];
