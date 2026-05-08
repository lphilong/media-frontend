import type { TFunction } from 'i18next';

import type {
  HolidayCalendarLifecycleAction,
  HolidayCalendarRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import type { ActionRailItem } from '@shared/components/primitives';

export const canActivateHolidayCalendar = (record: HolidayCalendarRecord): boolean =>
  record.status === 'DRAFT';

export const canArchiveHolidayCalendar = (record: HolidayCalendarRecord): boolean =>
  record.status === 'DRAFT' || record.status === 'ACTIVE';

export const canEditHolidayCalendar = (record: HolidayCalendarRecord): boolean =>
  record.status !== 'ARCHIVED';

export const createHolidayCalendarActionRailItems = (
  t: TFunction,
  record: HolidayCalendarRecord,
  handlers: {
    onEdit: () => void;
    onLifecycleAction: (action: HolidayCalendarLifecycleAction) => void;
    isLifecyclePending?: (action: HolidayCalendarLifecycleAction) => boolean;
  },
): ActionRailItem[] => [
  {
    id: 'edit',
    label: t('work-schedule:holidayCalendars.actions.edit'),
    disabled: !canEditHolidayCalendar(record),
    onClick: canEditHolidayCalendar(record) ? handlers.onEdit : undefined,
  },
  {
    id: 'activate',
    label: t('work-schedule:holidayCalendars.actions.activate'),
    disabled: !canActivateHolidayCalendar(record) || handlers.isLifecyclePending?.('activate'),
    onClick: canActivateHolidayCalendar(record)
      ? () => handlers.onLifecycleAction('activate')
      : undefined,
  },
  {
    id: 'archive',
    label: t('work-schedule:holidayCalendars.actions.archive'),
    tone: 'danger',
    disabled: !canArchiveHolidayCalendar(record) || handlers.isLifecyclePending?.('archive'),
    onClick: canArchiveHolidayCalendar(record)
      ? () => handlers.onLifecycleAction('archive')
      : undefined,
  },
];
