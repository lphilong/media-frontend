import type { TFunction } from 'i18next';

import type {
  MonthlyRosterRecord,
  MonthlyRosterStatus,
} from '@modules/work-schedule/types/work-schedule.types';
import type { ActionRailItem } from '@shared/components/primitives';

const archiveableStatuses: readonly MonthlyRosterStatus[] = ['DRAFT', 'PUBLISHED', 'LOCKED'];

export const canEditMonthlyRosterDraft = (record: MonthlyRosterRecord): boolean =>
  record.status === 'DRAFT';

export const canArchiveMonthlyRoster = (record: MonthlyRosterRecord): boolean =>
  archiveableStatuses.includes(record.status);

export const createMonthlyRosterActionRailItems = (
  t: TFunction,
  record: MonthlyRosterRecord,
  handlers: {
    onEdit: () => void;
    onArchive: () => void;
    isArchivePending?: boolean;
  },
): ActionRailItem[] => [
  {
    id: 'edit-draft',
    label: t('work-schedule:monthlyRosters.actions.editDraft'),
    disabled: !canEditMonthlyRosterDraft(record),
    onClick: canEditMonthlyRosterDraft(record) ? handlers.onEdit : undefined,
  },
  {
    id: 'archive',
    label: t('work-schedule:monthlyRosters.actions.archive'),
    tone: 'danger',
    disabled: !canArchiveMonthlyRoster(record) || handlers.isArchivePending,
    onClick: canArchiveMonthlyRoster(record) ? handlers.onArchive : undefined,
  },
];
