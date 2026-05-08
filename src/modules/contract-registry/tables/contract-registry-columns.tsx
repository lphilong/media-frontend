import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import {
  canExpireContract,
  canTerminateContract,
  readContractListLifecycleActions,
} from '@modules/contract-registry/actions/contract-registry-action-rail';
import type {
  ContractByLinkedEntityItem,
  ContractByOwnerItem,
  ContractLifecycleAction,
  ContractListItem,
  ContractStatus,
} from '@modules/contract-registry/types/contract-registry.types';
import { StatusBadge } from '@shared/components/primitives';
import { formatUtcMidnightDateLike } from '@shared/formatting/formatters';

export type ContractTableRow = ContractListItem | ContractByLinkedEntityItem | ContractByOwnerItem;

type ContractListColumnHandlers = {
  onOpenDetail: (contractRecordId: string) => void;
  onLifecycleAction: (contractRecordId: string, action: ContractLifecycleAction) => void;
  onDateAction: (contractRecordId: string, action: 'expire' | 'terminate') => void;
  isActionPending?: (contractRecordId: string, action: ContractLifecycleAction) => boolean;
  isDateActionPending?: (contractRecordId: string, action: 'expire' | 'terminate') => boolean;
};

export const contractStatusToneMap = {
  DRAFT: 'neutral',
  PENDING_SIGNATURE: 'warning',
  ACTIVE: 'success',
  EXPIRED: 'warning',
  TERMINATED: 'danger',
  ARCHIVED: 'muted',
} as const;

export const contractStatusValues: ContractStatus[] = [
  'DRAFT',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'ARCHIVED',
];

export const readContractLinkedEntityId = (record: {
  linkedEntityKind?: string;
  linkedEmploymentProfileId?: string | null;
  linkedTalentId?: string | null;
}): string | null | undefined => {
  if (record.linkedEntityKind === 'EMPLOYMENT_PROFILE') {
    return record.linkedEmploymentProfileId;
  }

  return record.linkedTalentId;
};

export const createContractRecordColumns = (
  t: TFunction,
  handlers: ContractListColumnHandlers,
): ColumnDef<ContractTableRow>[] => [
  {
    accessorKey: 'contractCode',
    header: t('contract-registry:table.contractCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'title',
    header: t('contract-registry:table.title'),
  },
  {
    accessorKey: 'contractKind',
    header: t('contract-registry:table.contractKind'),
    cell: (context) => t(`contract-registry:contractKinds.${String(context.getValue() ?? '')}`),
  },
  {
    accessorKey: 'linkedEntityKind',
    header: t('contract-registry:table.linkedEntityKind'),
    cell: (context) => t(`contract-registry:linkedEntityKinds.${String(context.getValue() ?? '')}`),
  },
  {
    id: 'linkedEntityId',
    header: t('contract-registry:table.linkedEntityId'),
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {readContractLinkedEntityId(
          row.original as Parameters<typeof readContractLinkedEntityId>[0],
        ) ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'ownerEmploymentProfileId',
    header: t('contract-registry:table.ownerEmploymentProfileId'),
    cell: (context) => {
      const value = context.getValue();
      return value ? <span className="font-mono text-xs">{String(value)}</span> : '-';
    },
  },
  {
    accessorKey: 'confidentialityTier',
    header: t('contract-registry:table.confidentialityTier'),
    cell: (context) =>
      t(`contract-registry:confidentialityTiers.${String(context.getValue() ?? '')}`),
  },
  {
    accessorKey: 'status',
    header: t('contract-registry:table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`contract-registry:statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={contractStatusToneMap}
      />
    ),
  },
  {
    accessorKey: 'effectiveStartDate',
    header: t('contract-registry:table.effectiveStartDate'),
    cell: (context) => formatUtcMidnightDateLike(context.getValue() as number | string),
  },
  {
    accessorKey: 'effectiveEndDate',
    header: t('contract-registry:table.effectiveEndDate'),
    cell: (context) => {
      const value = context.getValue() as number | string | null | undefined;
      return value ? formatUtcMidnightDateLike(value) : '-';
    },
  },
  {
    id: 'actions',
    header: t('contract-registry:table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const lifecycleActions = readContractListLifecycleActions(record.status);

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
            {t('contract-registry:actions.open')}
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
              {t(`contract-registry:actions.${action}`)}
            </button>
          ))}
          {canExpireContract(record.status) ? (
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={handlers.isDateActionPending?.(record.id, 'expire')}
              onClick={(event) => {
                event.stopPropagation();
                handlers.onDateAction(record.id, 'expire');
              }}
            >
              {t('contract-registry:actions.expire')}
            </button>
          ) : null}
          {canTerminateContract(record.status) ? (
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={handlers.isDateActionPending?.(record.id, 'terminate')}
              onClick={(event) => {
                event.stopPropagation();
                handlers.onDateAction(record.id, 'terminate');
              }}
            >
              {t('contract-registry:actions.terminate')}
            </button>
          ) : null}
        </div>
      );
    },
  },
];
