import type {
  WorkScheduleScope,
  WorkShiftSubjectKind,
} from '@modules/work-schedule/types/work-schedule.types';

export const isNonGlobalWorkScheduleScope = (scope?: WorkScheduleScope): boolean =>
  scope === 'self' || scope === 'team' || scope === 'department';

export const canUseWorkScheduleSubjectInScope = (
  subjectKind: WorkShiftSubjectKind,
  scope?: WorkScheduleScope,
): boolean => {
  if (!isNonGlobalWorkScheduleScope(scope)) {
    return true;
  }

  return subjectKind === 'EMPLOYMENT_PROFILE';
};
