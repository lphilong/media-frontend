import type { TFunction } from 'i18next';

import type {
  CommissionRuleLifecycleAction,
  CommissionRuleRecord,
  CommissionRuleStatus,
  CommissionSettlementLifecycleAction,
  CommissionSettlementRecord,
  CommissionSettlementStatus,
} from '@modules/commission/types/commission.types';
import type { ActionRailItem } from '@shared/components/primitives';

type RuleActionRailHandlers = {
  onDraftCoreEdit: () => void;
  onLifecycleAction: (action: CommissionRuleLifecycleAction) => void;
  isLifecyclePending?: (action: CommissionRuleLifecycleAction) => boolean;
};

type SettlementActionRailHandlers = {
  onDraftCoreEdit: () => void;
  onReplaceRevenueEntries: () => void;
  onLifecycleAction: (action: CommissionSettlementLifecycleAction) => void;
  isLifecyclePending?: (action: CommissionSettlementLifecycleAction) => boolean;
};

export const canEditCommissionRuleDraftCore = (status: CommissionRuleStatus): boolean =>
  status === 'DRAFT' || status === 'INACTIVE';
export const canActivateCommissionRule = (status: CommissionRuleStatus): boolean =>
  status === 'DRAFT' || status === 'INACTIVE';
export const canDeactivateCommissionRule = (status: CommissionRuleStatus): boolean =>
  status === 'ACTIVE';
export const canArchiveCommissionRule = (status: CommissionRuleStatus): boolean =>
  status === 'DRAFT' || status === 'INACTIVE';

export const canEditCommissionSettlementDraftCore = (status: CommissionSettlementStatus): boolean =>
  status === 'DRAFT';
export const canReplaceCommissionSettlementRevenueEntries = (
  status: CommissionSettlementStatus,
): boolean => status === 'DRAFT';
export const canFinalizeCommissionSettlement = (status: CommissionSettlementStatus): boolean =>
  status === 'DRAFT';
export const canVoidCommissionSettlement = (status: CommissionSettlementStatus): boolean =>
  status === 'FINALIZED';
export const canArchiveCommissionSettlement = (status: CommissionSettlementStatus): boolean =>
  status === 'DRAFT' || status === 'VOIDED';

export const createCommissionRuleActionRailItems = (
  t: TFunction,
  record: CommissionRuleRecord,
  handlers: RuleActionRailHandlers,
): ActionRailItem[] => {
  const status = record.status;

  return [
    {
      id: 'draft-core',
      label: t('commission:rules.actions.editDraftCore'),
      disabled: !canEditCommissionRuleDraftCore(status),
      onClick: canEditCommissionRuleDraftCore(status) ? handlers.onDraftCoreEdit : undefined,
    },
    {
      id: 'activate',
      label: t('commission:rules.actions.activate'),
      disabled: !canActivateCommissionRule(status) || handlers.isLifecyclePending?.('activate'),
      onClick: canActivateCommissionRule(status)
        ? () => handlers.onLifecycleAction('activate')
        : undefined,
    },
    {
      id: 'deactivate',
      label: t('commission:rules.actions.deactivate'),
      disabled: !canDeactivateCommissionRule(status) || handlers.isLifecyclePending?.('deactivate'),
      onClick: canDeactivateCommissionRule(status)
        ? () => handlers.onLifecycleAction('deactivate')
        : undefined,
    },
    {
      id: 'archive',
      label: t('commission:rules.actions.archive'),
      tone: 'danger',
      disabled: !canArchiveCommissionRule(status) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchiveCommissionRule(status)
        ? () => handlers.onLifecycleAction('archive')
        : undefined,
    },
  ];
};

export const readCommissionRuleListLifecycleActions = (
  status: CommissionRuleStatus,
): CommissionRuleLifecycleAction[] => {
  const actions: CommissionRuleLifecycleAction[] = [];

  if (canActivateCommissionRule(status)) actions.push('activate');
  if (canDeactivateCommissionRule(status)) actions.push('deactivate');
  if (canArchiveCommissionRule(status)) actions.push('archive');

  return actions;
};

export const createCommissionSettlementActionRailItems = (
  t: TFunction,
  record: CommissionSettlementRecord,
  handlers: SettlementActionRailHandlers,
): ActionRailItem[] => {
  const status = record.status;

  return [
    {
      id: 'draft-core',
      label: t('commission:settlements.actions.editDraftCore'),
      disabled: !canEditCommissionSettlementDraftCore(status),
      onClick: canEditCommissionSettlementDraftCore(status) ? handlers.onDraftCoreEdit : undefined,
    },
    {
      id: 'replace-revenue-entries',
      label: t('commission:settlements.actions.replaceRevenueEntries'),
      disabled: !canReplaceCommissionSettlementRevenueEntries(status),
      onClick: canReplaceCommissionSettlementRevenueEntries(status)
        ? handlers.onReplaceRevenueEntries
        : undefined,
    },
    {
      id: 'finalize',
      label: t('commission:settlements.actions.finalize'),
      disabled:
        !canFinalizeCommissionSettlement(status) || handlers.isLifecyclePending?.('finalize'),
      onClick: canFinalizeCommissionSettlement(status)
        ? () => handlers.onLifecycleAction('finalize')
        : undefined,
    },
    {
      id: 'void',
      label: t('commission:settlements.actions.void'),
      tone: 'danger',
      disabled: !canVoidCommissionSettlement(status) || handlers.isLifecyclePending?.('void'),
      onClick: canVoidCommissionSettlement(status)
        ? () => handlers.onLifecycleAction('void')
        : undefined,
    },
    {
      id: 'archive',
      label: t('commission:settlements.actions.archive'),
      tone: 'danger',
      disabled: !canArchiveCommissionSettlement(status) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchiveCommissionSettlement(status)
        ? () => handlers.onLifecycleAction('archive')
        : undefined,
    },
  ];
};

export const readCommissionSettlementListLifecycleActions = (
  status: CommissionSettlementStatus,
): CommissionSettlementLifecycleAction[] => {
  const actions: CommissionSettlementLifecycleAction[] = [];

  if (canFinalizeCommissionSettlement(status)) actions.push('finalize');
  if (canVoidCommissionSettlement(status)) actions.push('void');
  if (canArchiveCommissionSettlement(status)) actions.push('archive');

  return actions;
};
