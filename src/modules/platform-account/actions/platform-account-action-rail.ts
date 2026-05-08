import type { TFunction } from 'i18next';

import type { ActionRailItem } from '@shared/components/primitives';
import type {
  PlatformAccountLifecycleAction,
  PlatformAccountRecord,
} from '@modules/platform-account/types/platform-account.types';

type PlatformAccountActionRailHandlers = {
  onEdit: () => void;
  onTransferOwnership: () => void;
  onUpdateCapabilities: () => void;
  onLifecycleAction: (action: PlatformAccountLifecycleAction) => void;
  isLifecyclePending?: (action: PlatformAccountLifecycleAction) => boolean;
};

const isArchived = (record: PlatformAccountRecord): boolean =>
  record.operationalStatus === 'ARCHIVED';
const canEditCore = (record: PlatformAccountRecord): boolean => !isArchived(record);
const canActivate = (record: PlatformAccountRecord): boolean =>
  record.operationalStatus === 'INACTIVE';
const canDeactivate = (record: PlatformAccountRecord): boolean =>
  record.operationalStatus === 'ACTIVE';
const canArchive = (record: PlatformAccountRecord): boolean =>
  record.operationalStatus === 'INACTIVE';

export const createPlatformAccountActionRailItems = (
  t: TFunction,
  record: PlatformAccountRecord,
  handlers: PlatformAccountActionRailHandlers,
): ActionRailItem[] => {
  return [
    {
      id: 'edit',
      label: t('platform-account:actions.edit'),
      disabled: !canEditCore(record),
      onClick: canEditCore(record) ? handlers.onEdit : undefined,
    },
    {
      id: 'transfer-ownership',
      label: t('platform-account:actions.transferOwnership'),
      disabled: !canEditCore(record),
      onClick: canEditCore(record) ? handlers.onTransferOwnership : undefined,
    },
    {
      id: 'capabilities',
      label: t('platform-account:actions.updateCapabilities'),
      disabled: !canEditCore(record),
      onClick: canEditCore(record) ? handlers.onUpdateCapabilities : undefined,
    },
    {
      id: 'activate',
      label: t('platform-account:actions.activate'),
      disabled: !canActivate(record) || handlers.isLifecyclePending?.('activate'),
      onClick: canActivate(record) ? () => handlers.onLifecycleAction('activate') : undefined,
    },
    {
      id: 'deactivate',
      label: t('platform-account:actions.deactivate'),
      disabled: !canDeactivate(record) || handlers.isLifecyclePending?.('deactivate'),
      onClick: canDeactivate(record) ? () => handlers.onLifecycleAction('deactivate') : undefined,
    },
    {
      id: 'archive',
      label: t('platform-account:actions.archive'),
      tone: 'danger',
      disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
    },
  ];
};
