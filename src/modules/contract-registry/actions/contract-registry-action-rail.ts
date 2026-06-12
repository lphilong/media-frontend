import type { TFunction } from 'i18next';

import type {
  ContractLifecycleAction,
  ContractRecord,
  ContractStatus,
} from '@modules/contract-registry/types/contract-registry.types';
import type { ActionRailItem } from '@shared/components/primitives';

type ContractActionRailHandlers = {
  onDraftCoreEdit: () => void;
  onAssignOwner: () => void;
  onUpdateFileReference: () => void;
  onExpire: () => void;
  onTerminate: () => void;
  onLifecycleAction: (action: ContractLifecycleAction) => void;
  isLifecyclePending?: (action: ContractLifecycleAction) => boolean;
};

export const canEditDraftCore = (status: ContractStatus): boolean =>
  status === 'DRAFT' || status === 'PENDING_SIGNATURE';
export const canAssignOwner = (status: ContractStatus): boolean => status !== 'ARCHIVED';
export const canUpdateFileReference = (status: ContractStatus): boolean => status !== 'ARCHIVED';
export const canMarkPendingSignature = (status: ContractStatus): boolean => status === 'DRAFT';
export const canReopenDraft = (status: ContractStatus): boolean => status === 'PENDING_SIGNATURE';
export const canActivateContract = (status: ContractStatus): boolean =>
  status === 'DRAFT' || status === 'PENDING_SIGNATURE';
export const canExpireContract = (status: ContractStatus): boolean => status === 'ACTIVE';
export const canTerminateContract = (status: ContractStatus): boolean => status === 'ACTIVE';
export const canArchiveContract = (status: ContractStatus): boolean =>
  status === 'DRAFT' ||
  status === 'PENDING_SIGNATURE' ||
  status === 'EXPIRED' ||
  status === 'TERMINATED';

export const createContractActionRailItems = (
  t: TFunction,
  record: ContractRecord,
  handlers: ContractActionRailHandlers,
): ActionRailItem[] => {
  const status = record.status;
  const canPromoteCommercialContract =
    record.boundaryMetadata.kindClassification === 'COMMERCIAL_LEGAL_SUPPORTED' &&
    record.boundaryMetadata.commercialLegalRegistry;

  return [
    {
      id: 'draft-core',
      label: t('contract-registry:actions.editDraftCore'),
      disabled: !canEditDraftCore(status),
      onClick: canEditDraftCore(status) ? handlers.onDraftCoreEdit : undefined,
    },
    {
      id: 'assign-owner',
      label: t('contract-registry:actions.assignOwner'),
      disabled: !canAssignOwner(status),
      onClick: canAssignOwner(status) ? handlers.onAssignOwner : undefined,
    },
    {
      id: 'file-reference',
      label: t('contract-registry:actions.updateFileReference'),
      disabled: !canUpdateFileReference(status),
      onClick: canUpdateFileReference(status) ? handlers.onUpdateFileReference : undefined,
    },
    {
      id: 'mark-pending-signature',
      label: t('contract-registry:actions.markPendingSignature'),
      disabled:
        !canPromoteCommercialContract ||
        !canMarkPendingSignature(status) ||
        handlers.isLifecyclePending?.('mark-pending-signature'),
      onClick:
        canPromoteCommercialContract && canMarkPendingSignature(status)
          ? () => handlers.onLifecycleAction('mark-pending-signature')
          : undefined,
    },
    {
      id: 'reopen-draft',
      label: t('contract-registry:actions.reopenDraft'),
      disabled: !canReopenDraft(status) || handlers.isLifecyclePending?.('reopen-draft'),
      onClick: canReopenDraft(status)
        ? () => handlers.onLifecycleAction('reopen-draft')
        : undefined,
    },
    {
      id: 'activate',
      label: t('contract-registry:actions.activate'),
      disabled:
        !canPromoteCommercialContract ||
        !canActivateContract(status) ||
        handlers.isLifecyclePending?.('activate'),
      onClick:
        canPromoteCommercialContract && canActivateContract(status)
          ? () => handlers.onLifecycleAction('activate')
          : undefined,
    },
    {
      id: 'expire',
      label: t('contract-registry:actions.expire'),
      disabled: !canExpireContract(status),
      onClick: canExpireContract(status) ? handlers.onExpire : undefined,
    },
    {
      id: 'terminate',
      label: t('contract-registry:actions.terminate'),
      tone: 'danger',
      disabled: !canTerminateContract(status),
      onClick: canTerminateContract(status) ? handlers.onTerminate : undefined,
    },
    {
      id: 'archive',
      label: t('contract-registry:actions.archive'),
      tone: 'danger',
      disabled: !canArchiveContract(status) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchiveContract(status) ? () => handlers.onLifecycleAction('archive') : undefined,
    },
  ];
};

export const readContractListLifecycleActions = (
  record: Pick<ContractRecord, 'status' | 'boundaryMetadata'>,
): ContractLifecycleAction[] => {
  const actions: ContractLifecycleAction[] = [];
  const canPromoteCommercialContract =
    record.boundaryMetadata.kindClassification === 'COMMERCIAL_LEGAL_SUPPORTED' &&
    record.boundaryMetadata.commercialLegalRegistry;

  if (canPromoteCommercialContract && canMarkPendingSignature(record.status)) {
    actions.push('mark-pending-signature');
  }
  if (canReopenDraft(record.status)) {
    actions.push('reopen-draft');
  }
  if (canPromoteCommercialContract && canActivateContract(record.status)) {
    actions.push('activate');
  }
  if (canArchiveContract(record.status)) {
    actions.push('archive');
  }

  return actions;
};
