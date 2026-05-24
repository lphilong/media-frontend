import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';

import { StatusBadge } from '@shared/components/primitives';
import { formatBusinessTimestamp, readReferenceDisplay } from '@shared/formatting/formatters';
import type {
  TalentGroupByTalentListItem,
  TalentGroupLifecycleAction,
  TalentGroupMemberRecord,
  TalentGroupMembershipLifecycleAction,
  TalentGroupRecord,
} from '@modules/talent-group/types/talent-group.types';

type TalentGroupListColumnHandlers = {
  onOpenDetail: (groupId: string) => void;
  onLifecycleAction: (groupId: string, action: TalentGroupLifecycleAction) => void;
  canShowLifecycleAction?: (action: TalentGroupLifecycleAction) => boolean;
  isActionPending?: (groupId: string, action: TalentGroupLifecycleAction) => boolean;
};

type TalentGroupMemberColumnHandlers = {
  onOpenTalentDetail: (talentId: string) => void;
  onOpenLineupSurface: (membershipId: string) => void;
  onLifecycleAction: (membershipId: string, action: TalentGroupMembershipLifecycleAction) => void;
  isLifecyclePending?: (
    membershipId: string,
    action: TalentGroupMembershipLifecycleAction,
  ) => boolean;
  canShowMemberMutationActions?: boolean;
  isGroupArchived?: boolean;
};

const groupStatusToneMap = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const membershipStatusToneMap = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  REMOVED: 'muted',
} as const;

const readGroupLifecycleActions = (
  record: Pick<TalentGroupRecord, 'status'>,
): TalentGroupLifecycleAction[] => {
  if (record.status === 'ACTIVE') {
    return ['deactivate'];
  }

  if (record.status === 'INACTIVE') {
    return ['activate', 'archive'];
  }

  return [];
};

export const createTalentGroupListColumns = (
  t: TFunction,
  handlers: TalentGroupListColumnHandlers,
): ColumnDef<TalentGroupRecord>[] => {
  return [
    {
      accessorKey: 'groupCode',
      header: t('talent-group:table.groupCode'),
      cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
    },
    {
      accessorKey: 'name',
      header: t('talent-group:table.name'),
    },
    {
      accessorKey: 'shortName',
      header: t('talent-group:table.shortName'),
      cell: (context) => String(context.getValue() ?? '-'),
    },
    {
      accessorKey: 'status',
      header: t('talent-group:table.status'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`talent-group:statuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={groupStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: t('talent-group:table.updatedAt'),
      cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
    },
    {
      id: 'actions',
      header: t('talent-group:table.actions'),
      cell: ({ row }) => {
        const record = row.original;
        const actions = readGroupLifecycleActions(record).filter(
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
              {t('talent-group:actions.open')}
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
                {t(`talent-group:actions.${action}`)}
              </button>
            ))}
          </div>
        );
      },
    },
  ];
};

export const createTalentGroupByTalentColumns = (
  t: TFunction,
  handlers: TalentGroupListColumnHandlers,
): ColumnDef<TalentGroupByTalentListItem>[] => {
  return [
    {
      accessorKey: 'groupCode',
      header: t('talent-group:table.groupCode'),
      cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
    },
    {
      accessorKey: 'name',
      header: t('talent-group:table.name'),
    },
    {
      accessorKey: 'shortName',
      header: t('talent-group:table.shortName'),
      cell: (context) => String(context.getValue() ?? '-'),
    },
    {
      accessorKey: 'status',
      header: t('talent-group:table.status'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`talent-group:statuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={groupStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'membershipStatus',
      header: t('talent-group:membersTable.membershipStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`talent-group:membershipStatuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={membershipStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'lineupOrder',
      header: t('talent-group:membersTable.lineupOrder'),
    },
    {
      accessorKey: 'joinedAt',
      header: t('talent-group:membersTable.joinedAt'),
      cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
    },
    {
      id: 'actions',
      header: t('talent-group:table.actions'),
      cell: ({ row }) => {
        const record = row.original;
        const actions = readGroupLifecycleActions(record).filter(
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
              {t('talent-group:actions.open')}
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
                {t(`talent-group:actions.${action}`)}
              </button>
            ))}
          </div>
        );
      },
    },
  ];
};

export const createTalentGroupMemberColumns = (
  t: TFunction,
  handlers: TalentGroupMemberColumnHandlers,
): ColumnDef<TalentGroupMemberRecord>[] => {
  return [
    {
      accessorKey: 'talentId',
      header: t('talent-group:membersTable.talentId'),
      cell: ({ row }) => {
        const talentId = row.original.talentId;
        const label = readReferenceDisplay(row.original.talentRef, talentId);

        return (
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => handlers.onOpenTalentDetail(talentId)}
          >
            {label}
          </button>
        );
      },
    },
    {
      accessorKey: 'membershipStatus',
      header: t('talent-group:membersTable.membershipStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`talent-group:membershipStatuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={membershipStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'lineupOrder',
      header: t('talent-group:membersTable.lineupOrder'),
    },
    {
      accessorKey: 'joinedAt',
      header: t('talent-group:membersTable.joinedAt'),
      cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
    },
    {
      accessorKey: 'leftAt',
      header: t('talent-group:membersTable.leftAt'),
      cell: (context) => {
        const value = context.getValue() as number | string | null | undefined;
        return value ? formatBusinessTimestamp(value) : '-';
      },
    },
    {
      id: 'actions',
      header: t('talent-group:membersTable.actions'),
      cell: ({ row }) => {
        if (handlers.canShowMemberMutationActions === false) {
          return null;
        }

        const record = row.original;
        const canMutate = !handlers.isGroupArchived && record.membershipStatus !== 'REMOVED';
        const canDeactivate = canMutate && record.membershipStatus === 'ACTIVE';
        const canReactivate = canMutate && record.membershipStatus === 'INACTIVE';
        const canRemove = canMutate;

        return (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={!canMutate}
              onClick={() => handlers.onOpenLineupSurface(record.id)}
            >
              {t('talent-group:actions.updateLineup')}
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={!canDeactivate || handlers.isLifecyclePending?.(record.id, 'deactivate')}
              onClick={() => handlers.onLifecycleAction(record.id, 'deactivate')}
            >
              {t('talent-group:actions.deactivateMember')}
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={!canReactivate || handlers.isLifecyclePending?.(record.id, 'reactivate')}
              onClick={() => handlers.onLifecycleAction(record.id, 'reactivate')}
            >
              {t('talent-group:actions.reactivateMember')}
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={!canRemove || handlers.isLifecyclePending?.(record.id, 'remove')}
              onClick={() => handlers.onLifecycleAction(record.id, 'remove')}
            >
              {t('talent-group:actions.removeMember')}
            </button>
          </div>
        );
      },
    },
  ];
};
