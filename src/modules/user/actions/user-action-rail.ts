import type { TFunction } from 'i18next';

import type { UserDetailRecord, UserLifecycleAction } from '@modules/user/types/user.types';
import type { ActionRailItem } from '@shared/components/primitives';

type UserActionRailHandlers = {
  onEdit: () => void;
  onAuthLinkage: () => void;
  onUnlinkAuthLinkage: () => void;
  onSendPasswordSetup: () => void;
  onLifecycleAction: (action: UserLifecycleAction) => void;
  isLifecyclePending?: (action: UserLifecycleAction) => boolean;
  isUnlinkPending?: boolean;
  isPasswordSetupPending?: boolean;
};

const isArchived = (record: UserDetailRecord): boolean => record.accountStatus === 'ARCHIVED';
const isPasswordSetupLinked = (record: UserDetailRecord): boolean =>
  record.authLinkage.status === 'LINKED';
const readPasswordSetupDisabledReason = (
  t: TFunction,
  record: UserDetailRecord,
): string | undefined => {
  if (isArchived(record) || !isPasswordSetupLinked(record)) {
    return t('common:capabilities.invalidStatus');
  }

  return undefined;
};
const canActivate = (record: UserDetailRecord): boolean =>
  record.accountStatus === 'PENDING' || record.accountStatus === 'DISABLED';
const canDisable = (record: UserDetailRecord): boolean => record.accountStatus === 'ACTIVE';
const canArchive = (record: UserDetailRecord): boolean =>
  record.accountStatus === 'PENDING' || record.accountStatus === 'DISABLED';

export const createUserActionRailItems = (
  t: TFunction,
  record: UserDetailRecord,
  handlers: UserActionRailHandlers,
): ActionRailItem[] => [
  {
    id: 'edit',
    label: t('user:actions.edit'),
    disabled: isArchived(record),
    disabledReason: isArchived(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: !isArchived(record) ? handlers.onEdit : undefined,
  },
  {
    id: 'auth-linkage',
    label: t('user:actions.linkAuth0'),
    disabled: isArchived(record),
    disabledReason: isArchived(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: !isArchived(record) ? handlers.onAuthLinkage : undefined,
  },
  {
    id: 'auth-linkage-unlink',
    label: t('user:actions.unlinkAuth0'),
    tone: 'danger',
    disabled: isArchived(record) || handlers.isUnlinkPending,
    disabledReason: isArchived(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: !isArchived(record) ? handlers.onUnlinkAuthLinkage : undefined,
  },
  {
    id: 'password-setup-send',
    label: t('user:actions.sendPasswordSetup'),
    disabled:
      Boolean(readPasswordSetupDisabledReason(t, record)) || handlers.isPasswordSetupPending,
    disabledReason: readPasswordSetupDisabledReason(t, record),
    onClick: !readPasswordSetupDisabledReason(t, record) ? handlers.onSendPasswordSetup : undefined,
  },
  {
    id: 'activate',
    label: t('user:actions.activate'),
    disabled: !canActivate(record) || handlers.isLifecyclePending?.('activate'),
    disabledReason: !canActivate(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: canActivate(record) ? () => handlers.onLifecycleAction('activate') : undefined,
  },
  {
    id: 'disable',
    label: t('user:actions.disable'),
    disabled: !canDisable(record) || handlers.isLifecyclePending?.('disable'),
    disabledReason: !canDisable(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: canDisable(record) ? () => handlers.onLifecycleAction('disable') : undefined,
  },
  {
    id: 'archive',
    label: t('user:actions.archive'),
    tone: 'danger',
    disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
    disabledReason: !canArchive(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
  },
];
