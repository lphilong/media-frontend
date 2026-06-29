import type { TFunction } from 'i18next';

import type { ActionRailItem } from '@shared/components/primitives';
import type {
  EmploymentProfileLifecycleAction,
  EmploymentProfileRecord,
} from '@modules/employment-profile/types/employment-profile.types';

type ActionSurfaceHandlers = {
  onEdit: () => void;
  onAssignOrgUnit: () => void;
  onLinkUser: () => void;
  onContractStatus: () => void;
  canUpdateContractStatus?: boolean;
  onTerminate: () => void;
  onUnlinkUser: () => void;
  onLifecycleAction: (action: EmploymentProfileLifecycleAction) => void;
  isLifecyclePending?: (action: EmploymentProfileLifecycleAction) => boolean;
};

const isArchived = (record: EmploymentProfileRecord): boolean =>
  record.employmentStatus === 'ARCHIVED';

const canEdit = (record: EmploymentProfileRecord): boolean => !isArchived(record);
const canAssign = (record: EmploymentProfileRecord): boolean => !isArchived(record);
const canLinkUser = (record: EmploymentProfileRecord): boolean =>
  !isArchived(record) && !record.linkedUserId;
const canUnlinkUser = (record: EmploymentProfileRecord): boolean =>
  !isArchived(record) && Boolean(record.linkedUserId);

const canPlaceOnLeave = (record: EmploymentProfileRecord): boolean =>
  record.employmentStatus === 'ACTIVE';
const canReturnFromLeave = (record: EmploymentProfileRecord): boolean =>
  record.employmentStatus === 'ON_LEAVE';
const canSuspend = (record: EmploymentProfileRecord): boolean =>
  record.employmentStatus === 'ACTIVE' || record.employmentStatus === 'ON_LEAVE';
const canReactivate = (record: EmploymentProfileRecord): boolean =>
  record.employmentStatus === 'SUSPENDED';
const canTerminate = (record: EmploymentProfileRecord): boolean =>
  record.employmentStatus === 'ACTIVE' ||
  record.employmentStatus === 'ON_LEAVE' ||
  record.employmentStatus === 'SUSPENDED';
const canArchive = (record: EmploymentProfileRecord): boolean =>
  record.employmentStatus === 'TERMINATED';

export const createEmploymentProfileActionRailItems = (
  t: TFunction,
  record: EmploymentProfileRecord,
  handlers: ActionSurfaceHandlers,
): ActionRailItem[] => {
  const canUpdateContractStatus = !isArchived(record) && handlers.canUpdateContractStatus !== false;

  return [
    {
      id: 'edit',
      label: t('employment-profile:actions.edit'),
      disabled: !canEdit(record),
      onClick: canEdit(record) ? handlers.onEdit : undefined,
    },
    {
      id: 'assign-org-unit',
      label: t('employment-profile:actions.assignOrgUnit'),
      disabled: !canAssign(record),
      onClick: canAssign(record) ? handlers.onAssignOrgUnit : undefined,
    },
    {
      id: 'link-user',
      label: t('employment-profile:actions.linkUser'),
      disabled: !canLinkUser(record),
      onClick: canLinkUser(record) ? handlers.onLinkUser : undefined,
    },
    {
      id: 'unlink-user',
      label: t('employment-profile:actions.unlinkUser'),
      disabled: !canUnlinkUser(record),
      onClick: canUnlinkUser(record) ? handlers.onUnlinkUser : undefined,
    },
    {
      id: 'contract-status',
      label: t('employment-profile:actions.updateContractStatus'),
      disabled: !canUpdateContractStatus,
      onClick: canUpdateContractStatus ? handlers.onContractStatus : undefined,
    },
    {
      id: 'place-on-leave',
      label: t('employment-profile:actions.place-on-leave'),
      disabled: !canPlaceOnLeave(record) || handlers.isLifecyclePending?.('place-on-leave'),
      onClick: canPlaceOnLeave(record)
        ? () => handlers.onLifecycleAction('place-on-leave')
        : undefined,
    },
    {
      id: 'return-from-leave',
      label: t('employment-profile:actions.return-from-leave'),
      disabled: !canReturnFromLeave(record) || handlers.isLifecyclePending?.('return-from-leave'),
      onClick: canReturnFromLeave(record)
        ? () => handlers.onLifecycleAction('return-from-leave')
        : undefined,
    },
    {
      id: 'suspend',
      label: t('employment-profile:actions.suspend'),
      disabled: !canSuspend(record) || handlers.isLifecyclePending?.('suspend'),
      onClick: canSuspend(record) ? () => handlers.onLifecycleAction('suspend') : undefined,
    },
    {
      id: 'reactivate',
      label: t('employment-profile:actions.reactivate'),
      disabled: !canReactivate(record) || handlers.isLifecyclePending?.('reactivate'),
      onClick: canReactivate(record) ? () => handlers.onLifecycleAction('reactivate') : undefined,
    },
    {
      id: 'terminate',
      label: t('employment-profile:actions.terminate'),
      tone: 'danger',
      disabled: !canTerminate(record),
      onClick: canTerminate(record) ? handlers.onTerminate : undefined,
    },
    {
      id: 'archive',
      label: t('employment-profile:actions.archive'),
      tone: 'danger',
      disabled: !canArchive(record) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchive(record) ? () => handlers.onLifecycleAction('archive') : undefined,
    },
  ];
};
