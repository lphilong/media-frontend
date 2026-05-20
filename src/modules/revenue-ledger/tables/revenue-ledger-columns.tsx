import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import { readRevenueLedgerListLifecycleActions } from '@modules/revenue-ledger/actions/revenue-ledger-action-rail';
import type {
  RevenueEntryByEventItem,
  RevenueEntryByPlatformItem,
  RevenueEntryByTalentItem,
  RevenueEntryListItem,
  RevenueEntryStatus,
  RevenueLedgerLifecycleAction,
} from '@modules/revenue-ledger/types/revenue-ledger.types';
import { StatusBadge } from '@shared/components/primitives';
import {
  formatCurrency,
  formatBusinessTimestamp,
  readReferenceDisplay,
  type ReferenceSummary,
} from '@shared/formatting/formatters';

export type RevenueLedgerTableRow =
  | RevenueEntryListItem
  | RevenueEntryByTalentItem
  | RevenueEntryByPlatformItem
  | RevenueEntryByEventItem;

type RevenueLedgerColumnHandlers = {
  onOpenDetail: (revenueEntryId: string) => void;
  onLifecycleAction: (revenueEntryId: string, action: RevenueLedgerLifecycleAction) => void;
  isActionPending?: (revenueEntryId: string, action: RevenueLedgerLifecycleAction) => boolean;
};

export const revenueLedgerStatusToneMap = {
  DRAFT: 'neutral',
  FINALIZED: 'warning',
  RECONCILED: 'success',
  VOIDED: 'danger',
  ARCHIVED: 'muted',
} as const;

export const revenueEntryStatusValues: RevenueEntryStatus[] = [
  'DRAFT',
  'FINALIZED',
  'RECONCILED',
  'VOIDED',
  'ARCHIVED',
];

const renderMono = (value: unknown): JSX.Element | string => {
  if (!value) {
    return '-';
  }

  return <span className="font-mono text-xs">{String(value)}</span>;
};

const renderReference = (
  ref: ReferenceSummary | null | undefined,
  fallbackId: string | null | undefined,
): JSX.Element | string => {
  if (!ref && !fallbackId) {
    return '-';
  }

  return (
    <span className={ref ? 'text-sm' : 'font-mono text-xs'}>
      {readReferenceDisplay(ref, fallbackId)}
    </span>
  );
};

const renderTranslated = (t: TFunction, namespaceKey: string, value: unknown): string => {
  if (!value) {
    return '-';
  }

  return t(`${namespaceKey}.${String(value)}`);
};

export const createRevenueLedgerColumns = (
  t: TFunction,
  handlers: RevenueLedgerColumnHandlers,
): ColumnDef<RevenueLedgerTableRow>[] => [
  {
    accessorKey: 'revenueEntryCode',
    header: t('revenue-ledger:table.revenueEntryCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'title',
    header: t('revenue-ledger:table.title'),
  },
  {
    accessorKey: 'subjectTalentId',
    header: t('revenue-ledger:table.subjectTalentId'),
    cell: ({ row }) =>
      renderReference(
        'subjectTalentRef' in row.original ? row.original.subjectTalentRef : undefined,
        row.original.subjectTalentId,
      ),
  },
  {
    accessorKey: 'attributionPlatformAccountId',
    header: t('revenue-ledger:table.attributionPlatformAccountId'),
    cell: ({ row }) =>
      renderReference(
        'attributionPlatformAccountRef' in row.original
          ? row.original.attributionPlatformAccountRef
          : undefined,
        'attributionPlatformAccountId' in row.original
          ? row.original.attributionPlatformAccountId
          : undefined,
      ),
  },
  {
    accessorKey: 'attributionEventId',
    header: t('revenue-ledger:table.attributionEventId'),
    cell: ({ row }) =>
      renderReference(
        'attributionEventRef' in row.original ? row.original.attributionEventRef : undefined,
        'attributionEventId' in row.original ? row.original.attributionEventId : undefined,
      ),
  },
  {
    accessorKey: 'revenueKind',
    header: t('revenue-ledger:table.revenueKind'),
    cell: (context) => renderTranslated(t, 'revenue-ledger:revenueKinds', context.getValue()),
  },
  {
    accessorKey: 'entrySource',
    header: t('revenue-ledger:table.entrySource'),
    cell: (context) => renderTranslated(t, 'revenue-ledger:entrySources', context.getValue()),
  },
  {
    accessorKey: 'status',
    header: t('revenue-ledger:table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`revenue-ledger:statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={revenueLedgerStatusToneMap}
      />
    ),
  },
  {
    accessorKey: 'currencyCode',
    header: t('revenue-ledger:table.currencyCode'),
    cell: (context) => renderMono(context.getValue()),
  },
  {
    accessorKey: 'recognizedAmount',
    header: t('revenue-ledger:table.recognizedAmount'),
    cell: ({ row }) =>
      formatCurrency(
        Number(row.original.recognizedAmount),
        String(row.original.currencyCode ?? 'VND'),
      ),
  },
  {
    accessorKey: 'recognizedAt',
    header: t('revenue-ledger:table.recognizedAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as string),
  },
  {
    id: 'actions',
    header: t('revenue-ledger:table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const lifecycleActions = readRevenueLedgerListLifecycleActions(record.status);

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
            {t('revenue-ledger:actions.open')}
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
              {t(`revenue-ledger:actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];
