import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';

import { StatusBadge } from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';
import type {
  PlatformAccountLifecycleAction,
  PlatformAccountOwnerKind,
  PlatformAccountRecord,
} from '@modules/platform-account/types/platform-account.types';

type PlatformAccountListColumnHandlers = {
  onOpenDetail: (platformAccountId: string) => void;
  onLifecycleAction: (platformAccountId: string, action: PlatformAccountLifecycleAction) => void;
  isActionPending?: (platformAccountId: string, action: PlatformAccountLifecycleAction) => boolean;
};

const operationalStatusToneMap = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

export const readPlatformAccountOwnerId = (
  record: Pick<
    PlatformAccountRecord,
    'ownerKind' | 'ownerOrgUnitId' | 'ownerTalentId' | 'ownerTalentGroupId'
  >,
): string | null | undefined => {
  switch (record.ownerKind) {
    case 'ORG_UNIT':
      return record.ownerOrgUnitId;
    case 'TALENT':
      return record.ownerTalentId;
    case 'TALENT_GROUP':
      return record.ownerTalentGroupId;
    default:
      return undefined;
  }
};

const readLifecycleActions = (record: PlatformAccountRecord): PlatformAccountLifecycleAction[] => {
  if (record.operationalStatus === 'ACTIVE') {
    return ['deactivate'];
  }

  if (record.operationalStatus === 'INACTIVE') {
    return ['activate', 'archive'];
  }

  return [];
};

export const createPlatformAccountListColumns = (
  t: TFunction,
  handlers: PlatformAccountListColumnHandlers,
): ColumnDef<PlatformAccountRecord>[] => {
  return [
    {
      accessorKey: 'accountCode',
      header: t('platform-account:table.accountCode'),
      cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
    },
    {
      accessorKey: 'platform',
      header: t('platform-account:table.platform'),
      cell: (context) => <span className="font-mono text-xs">{String(context.getValue())}</span>,
    },
    {
      accessorKey: 'platformSurfaceType',
      header: t('platform-account:table.platformSurfaceType'),
      cell: (context) => <span className="font-mono text-xs">{String(context.getValue())}</span>,
    },
    {
      accessorKey: 'displayName',
      header: t('platform-account:table.displayName'),
    },
    {
      accessorKey: 'handle',
      header: t('platform-account:table.handle'),
      cell: (context) => String(context.getValue() ?? '-'),
    },
    {
      accessorKey: 'ownerKind',
      header: t('platform-account:table.ownerKind'),
      cell: (context) => t(`platform-account:ownerKinds.${context.getValue() as string}`),
    },
    {
      id: 'ownerId',
      header: t('platform-account:table.ownerId'),
      cell: ({ row }) => {
        const ownerId = readPlatformAccountOwnerId(row.original);
        return <span className="font-mono text-xs">{ownerId ?? '-'}</span>;
      },
    },
    {
      accessorKey: 'operationalStatus',
      header: t('platform-account:table.operationalStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`platform-account:statuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={operationalStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'livestreamEnabled',
      header: t('platform-account:table.livestreamEnabled'),
      cell: (context) =>
        context.getValue() === true
          ? t('platform-account:boolean.true')
          : t('platform-account:boolean.false'),
    },
    {
      accessorKey: 'contentPublishingEnabled',
      header: t('platform-account:table.contentPublishingEnabled'),
      cell: (context) =>
        context.getValue() === true
          ? t('platform-account:boolean.true')
          : t('platform-account:boolean.false'),
    },
    {
      accessorKey: 'monetizationEnabled',
      header: t('platform-account:table.monetizationEnabled'),
      cell: (context) =>
        context.getValue() === true
          ? t('platform-account:boolean.true')
          : t('platform-account:boolean.false'),
    },
    {
      accessorKey: 'createdAt',
      header: t('platform-account:table.createdAt'),
      cell: (context) => formatUtcTimestamp(context.getValue() as number | string),
    },
    {
      id: 'actions',
      header: t('platform-account:table.actions'),
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
              {t('platform-account:actions.open')}
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
                {t(`platform-account:actions.${action}`)}
              </button>
            ))}
          </div>
        );
      },
    },
  ];
};

export const ownerKindValues: PlatformAccountOwnerKind[] = ['ORG_UNIT', 'TALENT', 'TALENT_GROUP'];
