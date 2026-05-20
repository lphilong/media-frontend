import type { TFunction } from 'i18next';

import type {
  RevenueEntryRecord,
  RevenueEntryStatus,
  RevenueLedgerLifecycleAction,
} from '@modules/revenue-ledger/types/revenue-ledger.types';
import type { ActionRailItem } from '@shared/components/primitives';

type RevenueLedgerActionRailHandlers = {
  onDraftCoreEdit: () => void;
  onReconcile: () => void;
  onLifecycleAction: (action: Exclude<RevenueLedgerLifecycleAction, 'reconcile'>) => void;
  isLifecyclePending?: (action: Exclude<RevenueLedgerLifecycleAction, 'reconcile'>) => boolean;
};

export const canEditRevenueDraftCore = (status: RevenueEntryStatus): boolean => status === 'DRAFT';
export const canFinalizeRevenueEntry = (status: RevenueEntryStatus): boolean => status === 'DRAFT';
export const canReconcileRevenueEntry = (status: RevenueEntryStatus): boolean =>
  status === 'FINALIZED';
export const canVoidRevenueEntry = (status: RevenueEntryStatus): boolean => status === 'FINALIZED';
export const canArchiveRevenueEntry = (status: RevenueEntryStatus): boolean =>
  status === 'DRAFT' || status === 'RECONCILED' || status === 'VOIDED';

export const createRevenueLedgerActionRailItems = (
  t: TFunction,
  record: RevenueEntryRecord,
  handlers: RevenueLedgerActionRailHandlers,
): ActionRailItem[] => {
  const status = record.status;

  return [
    {
      id: 'draft-core',
      label: t('revenue-ledger:actions.editDraftCore'),
      disabled: !canEditRevenueDraftCore(status),
      disabledReason: !canEditRevenueDraftCore(status)
        ? t('common:capabilities.invalidStatus')
        : undefined,
      onClick: canEditRevenueDraftCore(status) ? handlers.onDraftCoreEdit : undefined,
    },
    {
      id: 'finalize',
      label: t('revenue-ledger:actions.finalize'),
      disabled: !canFinalizeRevenueEntry(status) || handlers.isLifecyclePending?.('finalize'),
      disabledReason: !canFinalizeRevenueEntry(status)
        ? t('common:capabilities.invalidStatus')
        : undefined,
      onClick: canFinalizeRevenueEntry(status)
        ? () => handlers.onLifecycleAction('finalize')
        : undefined,
    },
    {
      id: 'reconcile',
      label: t('revenue-ledger:actions.reconcile'),
      disabled: !canReconcileRevenueEntry(status),
      disabledReason: !canReconcileRevenueEntry(status)
        ? t('common:capabilities.invalidStatus')
        : undefined,
      onClick: canReconcileRevenueEntry(status) ? handlers.onReconcile : undefined,
    },
    {
      id: 'void',
      label: t('revenue-ledger:actions.void'),
      tone: 'danger',
      disabled: !canVoidRevenueEntry(status) || handlers.isLifecyclePending?.('void'),
      disabledReason: !canVoidRevenueEntry(status)
        ? t('common:capabilities.invalidStatus')
        : undefined,
      onClick: canVoidRevenueEntry(status) ? () => handlers.onLifecycleAction('void') : undefined,
    },
    {
      id: 'archive',
      label: t('revenue-ledger:actions.archive'),
      tone: 'danger',
      disabled: !canArchiveRevenueEntry(status) || handlers.isLifecyclePending?.('archive'),
      disabledReason: !canArchiveRevenueEntry(status)
        ? t('common:capabilities.invalidStatus')
        : undefined,
      onClick: canArchiveRevenueEntry(status)
        ? () => handlers.onLifecycleAction('archive')
        : undefined,
    },
  ];
};

export const readRevenueLedgerListLifecycleActions = (
  status: RevenueEntryStatus,
): RevenueLedgerLifecycleAction[] => {
  const actions: RevenueLedgerLifecycleAction[] = [];

  if (canFinalizeRevenueEntry(status)) {
    actions.push('finalize');
  }
  if (canReconcileRevenueEntry(status)) {
    actions.push('reconcile');
  }
  if (canVoidRevenueEntry(status)) {
    actions.push('void');
  }
  if (canArchiveRevenueEntry(status)) {
    actions.push('archive');
  }

  return actions;
};
