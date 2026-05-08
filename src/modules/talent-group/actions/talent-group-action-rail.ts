import type { TFunction } from 'i18next';

import type { ActionRailItem } from '@shared/components/primitives';
import type {
  TalentGroupLifecycleAction,
  TalentGroupRecord,
} from '@modules/talent-group/types/talent-group.types';

type TalentGroupActionRailHandlers = {
  onEdit: () => void;
  onAddMember: () => void;
  onLifecycleAction: (action: TalentGroupLifecycleAction) => void;
  isLifecyclePending?: (action: TalentGroupLifecycleAction) => boolean;
};

const canEdit = (record: TalentGroupRecord): boolean => record.status !== 'ARCHIVED';
const canAddMember = (record: TalentGroupRecord): boolean => record.status === 'ACTIVE';
const canActivate = (record: TalentGroupRecord): boolean => record.status === 'INACTIVE';
const canDeactivate = (record: TalentGroupRecord): boolean => record.status === 'ACTIVE';
const canArchive = (record: TalentGroupRecord): boolean => record.status === 'INACTIVE';

export const createTalentGroupActionRailItems = (
  t: TFunction,
  record: TalentGroupRecord,
  handlers: TalentGroupActionRailHandlers,
): ActionRailItem[] => {
  return [
    {
      id: 'edit',
      label: t('talent-group:actions.edit'),
      disabled: !canEdit(record),
      onClick: canEdit(record) ? handlers.onEdit : undefined,
    },
    {
      id: 'add-member',
      label: t('talent-group:actions.addMember'),
      disabled: !canAddMember(record),
      onClick: canAddMember(record) ? handlers.onAddMember : undefined,
    },
    {
      id: 'activate',
      label: t('talent-group:actions.activate'),
      disabled: !canActivate(record) || handlers.isLifecyclePending?.('activate'),
      onClick: canActivate(record) ? () => handlers.onLifecycleAction('activate') : undefined,
    },
    {
      id: 'deactivate',
      label: t('talent-group:actions.deactivate'),
      disabled: !canDeactivate(record) || handlers.isLifecyclePending?.('deactivate'),
      onClick: canDeactivate(record) ? () => handlers.onLifecycleAction('deactivate') : undefined,
    },
    {
      id: 'archive',
      label: t('talent-group:actions.archive'),
      tone: 'danger',
      disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
    },
  ];
};
