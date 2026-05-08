import type { TFunction } from 'i18next';

import type { ActionRailItem } from '@shared/components/primitives';
import type { OrgUnitLifecycleAction, OrgUnitRecord } from '@modules/org-unit/types/org-unit.types';

type OrgUnitActionRailHandlers = {
  onEdit: () => void;
  onMove: () => void;
  onLifecycleAction: (action: OrgUnitLifecycleAction) => void;
  isLifecyclePending?: (action: OrgUnitLifecycleAction) => boolean;
};

const canEdit = (record: OrgUnitRecord): boolean => record.status !== 'ARCHIVED';
const canMove = (record: OrgUnitRecord): boolean => record.status !== 'ARCHIVED';
const canActivate = (record: OrgUnitRecord): boolean => record.status === 'INACTIVE';
const canDeactivate = (record: OrgUnitRecord): boolean => record.status === 'ACTIVE';
const canArchive = (record: OrgUnitRecord): boolean =>
  record.status === 'ACTIVE' || record.status === 'INACTIVE';

export const createOrgUnitActionRailItems = (
  t: TFunction,
  record: OrgUnitRecord,
  handlers: OrgUnitActionRailHandlers,
): ActionRailItem[] => {
  return [
    {
      id: 'edit',
      label: t('org-unit:actions.edit'),
      disabled: !canEdit(record),
      onClick: canEdit(record) ? handlers.onEdit : undefined,
    },
    {
      id: 'move',
      label: t('org-unit:actions.move'),
      disabled: !canMove(record),
      onClick: canMove(record) ? handlers.onMove : undefined,
    },
    {
      id: 'activate',
      label: t('org-unit:actions.activate'),
      disabled: !canActivate(record) || handlers.isLifecyclePending?.('activate'),
      onClick: canActivate(record) ? () => handlers.onLifecycleAction('activate') : undefined,
    },
    {
      id: 'deactivate',
      label: t('org-unit:actions.deactivate'),
      disabled: !canDeactivate(record) || handlers.isLifecyclePending?.('deactivate'),
      onClick: canDeactivate(record) ? () => handlers.onLifecycleAction('deactivate') : undefined,
    },
    {
      id: 'archive',
      label: t('org-unit:actions.archive'),
      tone: 'danger',
      disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
    },
  ];
};
