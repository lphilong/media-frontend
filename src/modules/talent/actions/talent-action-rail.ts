import type { TFunction } from 'i18next';

import type { ActionRailItem } from '@shared/components/primitives';
import type { TalentLifecycleAction, TalentRecord } from '@modules/talent/types/talent.types';

type TalentActionRailHandlers = {
  onEdit: () => void;
  onAssignManager: () => void;
  onLinkEmploymentProfile: () => void;
  onUpdateCommercialParticipation: () => void;
  onLifecycleAction: (action: TalentLifecycleAction) => void;
  isLifecyclePending?: (action: TalentLifecycleAction) => boolean;
};

const isArchived = (record: TalentRecord): boolean => record.operationalStatus === 'ARCHIVED';
const canEdit = (record: TalentRecord): boolean => !isArchived(record);
const canRelationshipMutate = (record: TalentRecord): boolean => !isArchived(record);
const canCommercialMutate = (record: TalentRecord): boolean => !isArchived(record);
const canSuspend = (record: TalentRecord): boolean => record.operationalStatus === 'ACTIVE';
const canDeactivate = (record: TalentRecord): boolean =>
  record.operationalStatus === 'ACTIVE' || record.operationalStatus === 'SUSPENDED';
const canReactivate = (record: TalentRecord): boolean =>
  record.operationalStatus === 'SUSPENDED' || record.operationalStatus === 'INACTIVE';
const canArchive = (record: TalentRecord): boolean => record.operationalStatus === 'INACTIVE';

export const createTalentActionRailItems = (
  t: TFunction,
  record: TalentRecord,
  handlers: TalentActionRailHandlers,
): ActionRailItem[] => {
  return [
    {
      id: 'edit',
      label: t('talent:actions.edit'),
      disabled: !canEdit(record),
      onClick: canEdit(record) ? handlers.onEdit : undefined,
    },
    {
      id: 'assign-manager',
      label: t('talent:actions.assignManager'),
      disabled: !canRelationshipMutate(record),
      onClick: canRelationshipMutate(record) ? handlers.onAssignManager : undefined,
    },
    {
      id: 'employment-link',
      label: t('talent:actions.linkEmploymentProfile'),
      disabled: !canRelationshipMutate(record),
      onClick: canRelationshipMutate(record) ? handlers.onLinkEmploymentProfile : undefined,
    },
    {
      id: 'commercial-participation',
      label: t('talent:actions.updateCommercialParticipation'),
      disabled: !canCommercialMutate(record),
      onClick: canCommercialMutate(record) ? handlers.onUpdateCommercialParticipation : undefined,
    },
    {
      id: 'suspend',
      label: t('talent:actions.suspend'),
      disabled: !canSuspend(record) || handlers.isLifecyclePending?.('suspend'),
      onClick: canSuspend(record) ? () => handlers.onLifecycleAction('suspend') : undefined,
    },
    {
      id: 'reactivate',
      label: t('talent:actions.reactivate'),
      disabled: !canReactivate(record) || handlers.isLifecyclePending?.('reactivate'),
      onClick: canReactivate(record) ? () => handlers.onLifecycleAction('reactivate') : undefined,
    },
    {
      id: 'deactivate',
      label: t('talent:actions.deactivate'),
      disabled: !canDeactivate(record) || handlers.isLifecyclePending?.('deactivate'),
      onClick: canDeactivate(record) ? () => handlers.onLifecycleAction('deactivate') : undefined,
    },
    {
      id: 'archive',
      label: t('talent:actions.archive'),
      tone: 'danger',
      disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
    },
  ];
};
