import type { TFunction } from 'i18next';

import type { ActionRailItem } from '@shared/components/primitives';
import type {
  StudioResourceAvailabilityAction,
  StudioResourceLifecycleAction,
  StudioResourceRecord,
} from '@modules/studio-resource/types/studio-resource.types';

type StudioResourceActionRailHandlers = {
  onEdit: () => void;
  onAvailabilityAction: (action: StudioResourceAvailabilityAction) => void;
  onLifecycleAction: (action: StudioResourceLifecycleAction) => void;
  isAvailabilityPending?: (action: StudioResourceAvailabilityAction) => boolean;
  isLifecyclePending?: (action: StudioResourceLifecycleAction) => boolean;
};

const canEdit = (record: StudioResourceRecord): boolean => record.operationalStatus !== 'ARCHIVED';
const canOutOfService = (record: StudioResourceRecord): boolean =>
  record.operationalStatus === 'ACTIVE';
const canRestoreToActive = (record: StudioResourceRecord): boolean =>
  record.operationalStatus === 'OUT_OF_SERVICE';
const canDeactivate = (record: StudioResourceRecord): boolean =>
  record.operationalStatus === 'ACTIVE' || record.operationalStatus === 'OUT_OF_SERVICE';
const canActivate = (record: StudioResourceRecord): boolean =>
  record.operationalStatus === 'INACTIVE';
const canArchive = (record: StudioResourceRecord): boolean =>
  record.operationalStatus === 'INACTIVE';

export const createStudioResourceActionRailItems = (
  t: TFunction,
  record: StudioResourceRecord,
  handlers: StudioResourceActionRailHandlers,
): ActionRailItem[] => {
  return [
    {
      id: 'edit',
      label: t('studio-resource:actions.edit'),
      disabled: !canEdit(record),
      onClick: canEdit(record) ? handlers.onEdit : undefined,
    },
    {
      id: 'out-of-service',
      label: t('studio-resource:actions.outOfService'),
      disabled: !canOutOfService(record) || handlers.isAvailabilityPending?.('out-of-service'),
      onClick: canOutOfService(record)
        ? () => handlers.onAvailabilityAction('out-of-service')
        : undefined,
    },
    {
      id: 'restore-to-active',
      label: t('studio-resource:actions.restoreToActive'),
      disabled:
        !canRestoreToActive(record) || handlers.isAvailabilityPending?.('restore-to-active'),
      onClick: canRestoreToActive(record)
        ? () => handlers.onAvailabilityAction('restore-to-active')
        : undefined,
    },
    {
      id: 'deactivate',
      label: t('studio-resource:actions.deactivate'),
      disabled: !canDeactivate(record) || handlers.isLifecyclePending?.('deactivate'),
      onClick: canDeactivate(record) ? () => handlers.onLifecycleAction('deactivate') : undefined,
    },
    {
      id: 'activate',
      label: t('studio-resource:actions.activate'),
      disabled: !canActivate(record) || handlers.isLifecyclePending?.('activate'),
      onClick: canActivate(record) ? () => handlers.onLifecycleAction('activate') : undefined,
    },
    {
      id: 'archive',
      label: t('studio-resource:actions.archive'),
      tone: 'danger',
      disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
    },
  ];
};
