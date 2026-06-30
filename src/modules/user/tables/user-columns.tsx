import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import type { UserLifecycleAction, UserListItem } from '@modules/user/types/user.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';

type UserListColumnHandlers = {
  onOpenDetail: (userId: string) => void;
  onLifecycleAction: (userId: string, action: UserLifecycleAction) => void;
  isActionPending?: (userId: string, action: UserLifecycleAction) => boolean;
  canShowAction?: (action: UserLifecycleAction) => boolean;
  getActionDisabledReason?: (action: UserLifecycleAction) => string | undefined;
};

const statusToneMap = {
  PENDING: 'neutral',
  ACTIVE: 'success',
  DISABLED: 'warning',
  ARCHIVED: 'muted',
} as const;

const authLinkageToneMap = {
  LINKED: 'success',
  UNLINKED: 'warning',
  PENDING: 'neutral',
} as const;

const readAuthLinkageStatus = (record: UserListItem): 'LINKED' | 'UNLINKED' | 'PENDING' =>
  record.authLinkage?.status ?? 'PENDING';

const readLifecycleActions = (record: UserListItem): UserLifecycleAction[] => {
  if (record.accountStatus === 'PENDING') {
    return ['activate', 'archive'];
  }

  if (record.accountStatus === 'ACTIVE') {
    return ['disable'];
  }

  if (record.accountStatus === 'DISABLED') {
    return ['activate', 'archive'];
  }

  return [];
};

export const createUserListColumns = (
  t: TFunction,
  handlers: UserListColumnHandlers,
): ColumnDef<UserListItem>[] => [
  {
    accessorKey: 'displayName',
    header: t('user:table.displayName'),
  },
  {
    accessorKey: 'email',
    header: t('user:table.email'),
    cell: (context) => String(context.getValue() ?? '-'),
  },
  {
    accessorKey: 'accountStatus',
    header: t('user:table.accountStatus'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`user:statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={statusToneMap}
      />
    ),
  },
  {
    id: 'authLinkage',
    header: t('user:table.authLinkage'),
    cell: ({ row }) => {
      const status = readAuthLinkageStatus(row.original);
      return (
        <StatusBadge
          status={status}
          label={t(`user:authLinkageStatuses.${status}`)}
          toneByStatus={authLinkageToneMap}
        />
      );
    },
  },
  {
    accessorKey: 'updatedAt',
    header: t('user:table.updatedAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('user:table.actions'),
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
            {t('user:actions.open')}
          </button>
          {actions
            .filter((action) => handlers.canShowAction?.(action) ?? true)
            .map((action) => (
            <div key={action} className="space-y-1">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  Boolean(handlers.getActionDisabledReason?.(action)) ||
                  handlers.isActionPending?.(record.id, action)
                }
                title={handlers.getActionDisabledReason?.(action)}
                onClick={(event) => {
                  event.stopPropagation();
                  handlers.onLifecycleAction(record.id, action);
                }}
              >
                {t(`user:actions.${action}`)}
              </button>
              {handlers.getActionDisabledReason?.(action) ? (
                <p className="text-xs text-muted">{handlers.getActionDisabledReason?.(action)}</p>
              ) : null}
            </div>
          ))}
        </div>
      );
    },
  },
];
