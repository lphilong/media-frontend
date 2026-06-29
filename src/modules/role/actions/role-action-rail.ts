import type { TFunction } from 'i18next';

import type { RoleDetailRecord, RoleLifecycleAction } from '@modules/role/types/role.types';
import type { ActionRailItem } from '@shared/components/primitives';

type RoleActionRailHandlers = {
  onEdit: () => void;
  onLifecycleAction: (action: RoleLifecycleAction) => void;
  isLifecyclePending?: (action: RoleLifecycleAction) => boolean;
};

const isArchived = (record: RoleDetailRecord): boolean => record.state === 'ARCHIVED';
const canMutatePolicy = (record: RoleDetailRecord): boolean => !isArchived(record);
const canActivate = (record: RoleDetailRecord): boolean =>
  record.state === 'DRAFT' || record.state === 'INACTIVE';
const canDeactivate = (record: RoleDetailRecord): boolean => record.state === 'ACTIVE';
const canArchive = (record: RoleDetailRecord): boolean =>
  record.state === 'DRAFT' || record.state === 'INACTIVE';
export const createRoleActionRailItems = (
  t: TFunction,
  record: RoleDetailRecord,
  handlers: RoleActionRailHandlers,
): ActionRailItem[] => [
  {
    id: 'edit',
    label: t('role:actions.edit'),
    disabled: !canMutatePolicy(record),
    disabledReason: !canMutatePolicy(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: canMutatePolicy(record) ? handlers.onEdit : undefined,
  },
  {
    id: 'activate',
    label: t('role:actions.activate'),
    disabled: !canActivate(record) || handlers.isLifecyclePending?.('activate'),
    disabledReason: !canActivate(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: canActivate(record) ? () => handlers.onLifecycleAction('activate') : undefined,
  },
  {
    id: 'deactivate',
    label: t('role:actions.deactivate'),
    disabled: !canDeactivate(record) || handlers.isLifecyclePending?.('deactivate'),
    disabledReason: !canDeactivate(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: canDeactivate(record) ? () => handlers.onLifecycleAction('deactivate') : undefined,
  },
  {
    id: 'archive',
    label: t('role:actions.archive'),
    tone: 'danger',
    disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
    disabledReason: !canArchive(record) ? t('common:capabilities.invalidStatus') : undefined,
    onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
  },
];
