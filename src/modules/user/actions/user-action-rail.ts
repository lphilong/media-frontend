import type { TFunction } from 'i18next';

import type { UserDetailRecord, UserLifecycleAction } from '@modules/user/types/user.types';
import type { ActionRailItem } from '@shared/components/primitives';

type UserActionRailHandlers = {
  onEdit: () => void;
  onAuthLinkage: () => void;
  onLifecycleAction: (action: UserLifecycleAction) => void;
  isLifecyclePending?: (action: UserLifecycleAction) => boolean;
};

const isArchived = (record: UserDetailRecord): boolean => record.accountStatus === 'ARCHIVED';
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
    onClick: !isArchived(record) ? handlers.onEdit : undefined,
  },
  {
    id: 'auth-linkage',
    label: t('user:actions.setAuthLinkage'),
    disabled: isArchived(record),
    onClick: !isArchived(record) ? handlers.onAuthLinkage : undefined,
  },
  {
    id: 'activate',
    label: t('user:actions.activate'),
    disabled: !canActivate(record) || handlers.isLifecyclePending?.('activate'),
    onClick: canActivate(record) ? () => handlers.onLifecycleAction('activate') : undefined,
  },
  {
    id: 'disable',
    label: t('user:actions.disable'),
    disabled: !canDisable(record) || handlers.isLifecyclePending?.('disable'),
    onClick: canDisable(record) ? () => handlers.onLifecycleAction('disable') : undefined,
  },
  {
    id: 'archive',
    label: t('user:actions.archive'),
    tone: 'danger',
    disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
    onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
  },
];
