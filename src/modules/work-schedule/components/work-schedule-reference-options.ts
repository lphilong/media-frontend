import { APP_PATHS } from '@app/router/paths';
import {
  loadContextualEmploymentProfileReferenceOptions,
  loadEmploymentProfileReferenceOptionById,
  loadEmploymentProfileReferenceOptions,
} from '@modules/employment-profile';
import {
  loadActiveDepartmentReferenceOptions,
  loadActiveOrgUnitReferenceOptions,
  loadOrgUnitReferenceOptionById,
} from '@modules/org-unit';
import {
  loadTalentReferenceOptionById,
  loadTalentReferenceOptions,
} from '@modules/talent';
import {
  loadActiveTalentGroupReferenceOptions,
  loadTalentGroupReferenceOptionById,
  loadTalentGroupReferenceOptions,
} from '@modules/talent-group';
import {
  loadStudioResourceReferenceOptions,
  loadStudioResourceReferenceOptionsByIds,
} from '@modules/studio-resource';
import {
  fetchHolidayCalendarDetail,
  fetchHolidayCalendars,
  fetchWorkPatternDetail,
  fetchWorkPatterns,
} from '@modules/work-schedule/api/work-schedule.api';
import type {
  HolidayCalendarRecord,
  WorkPatternRecord,
  WorkShiftSubjectKind,
} from '@modules/work-schedule/types/work-schedule.types';
import type { ReferenceOption } from '@shared/components/reference';

const OPTION_LIMIT = 20;

const compactDescription = (values: Array<string | null | undefined>): string | undefined => {
  const items = values.filter((value): value is string => Boolean(value));
  return items.length > 0 ? items.join(' - ') : undefined;
};

const toWorkPatternOption = (item: WorkPatternRecord): ReferenceOption => ({
  id: item.workPatternId,
  label: `${item.patternCode} - ${item.name}`,
  description: compactDescription([
    item.status,
    item.workingDays.join(', '),
    `${item.startLocalTime}-${item.endLocalTime}`,
  ]),
  href: APP_PATHS.workPatternDetail(item.workPatternId),
});

const toHolidayCalendarOption = (item: HolidayCalendarRecord): ReferenceOption => ({
  id: item.holidayCalendarId,
  label: `${item.calendarCode} - ${item.name}`,
  description: compactDescription([item.scopeType, item.timezone, item.status]),
  href: APP_PATHS.holidayCalendarDetail(item.holidayCalendarId),
});

const mergeSelectedOption = async (
  options: ReferenceOption[],
  search: string,
  selectedId: string | undefined,
  loadSelected: (id: string) => Promise<ReferenceOption>,
): Promise<ReferenceOption[]> => {
  const normalizedSelectedId = selectedId?.trim();
  if (search.trim() || !normalizedSelectedId) {
    return options;
  }

  if (options.some((option) => option.id === normalizedSelectedId)) {
    return options;
  }

  const selectedOption = await loadSelected(normalizedSelectedId);
  return [selectedOption, ...options];
};

export const loadWorkShiftSubjectOptions = async (
  subjectKind: WorkShiftSubjectKind,
  search: string,
): Promise<ReferenceOption[]> => {
  if (subjectKind === 'EMPLOYMENT_PROFILE') {
    return loadEmploymentProfileReferenceOptions(search);
  }

  if (subjectKind === 'TALENT') {
    return loadTalentReferenceOptions(search);
  }

  return loadTalentGroupReferenceOptions(search);
};

export const loadWorkShiftSubjectOptionById = async (
  subjectKind: WorkShiftSubjectKind,
  subjectId: string,
): Promise<ReferenceOption> => {
  if (subjectKind === 'EMPLOYMENT_PROFILE') {
    return loadEmploymentProfileReferenceOptionById(subjectId);
  }

  if (subjectKind === 'TALENT') {
    return loadTalentReferenceOptionById(subjectId);
  }

  return loadTalentGroupReferenceOptionById(subjectId);
};

export const loadWorkShiftSubjectFilterOptions = async (
  subjectKind: WorkShiftSubjectKind,
  search: string,
  selectedId?: string,
): Promise<ReferenceOption[]> =>
  mergeSelectedOption(
    await loadWorkShiftSubjectOptions(subjectKind, search),
    search,
    selectedId,
    (subjectId) => loadWorkShiftSubjectOptionById(subjectKind, subjectId),
  );

export const loadWorkShiftStudioResourceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  return loadStudioResourceReferenceOptions(search);
};

export const loadWorkShiftStudioResourceOptionById = async (
  studioResourceId: string,
): Promise<ReferenceOption> => {
  const options = await loadStudioResourceReferenceOptionsByIds([studioResourceId]);
  const option = options.find((candidate) => candidate.id === studioResourceId);
  return (
    option ?? {
      id: studioResourceId,
      label: studioResourceId,
      href: APP_PATHS.studioResourceDetail(studioResourceId),
    }
  );
};

export const loadWorkShiftStudioResourceFilterOptions = async (
  search: string,
  selectedId?: string,
): Promise<ReferenceOption[]> =>
  mergeSelectedOption(
    await loadWorkShiftStudioResourceOptions(search),
    search,
    selectedId,
    loadWorkShiftStudioResourceOptionById,
  );

export const loadMonthlyRosterEmploymentProfileOptions = async (
  search: string,
  departmentOrgUnitId?: string,
): Promise<ReferenceOption[]> =>
  loadContextualEmploymentProfileReferenceOptions(search, {
    orgUnitId: departmentOrgUnitId || undefined,
    employmentStatuses: ['ACTIVE'],
  });

export const loadMonthlyRosterDepartmentOptions = async (
  search: string,
): Promise<ReferenceOption[]> => loadActiveDepartmentReferenceOptions(search);

export const loadMonthlyRosterOrgUnitOptions = async (
  search: string,
): Promise<ReferenceOption[]> => loadActiveOrgUnitReferenceOptions(search);

export const loadMonthlyRosterOrgUnitOptionById = async (
  orgUnitId: string,
): Promise<ReferenceOption> => loadOrgUnitReferenceOptionById(orgUnitId);

export const loadMonthlyRosterOrgUnitFilterOptions = async (
  search: string,
  selectedId?: string,
): Promise<ReferenceOption[]> =>
  mergeSelectedOption(
    await loadMonthlyRosterOrgUnitOptions(search),
    search,
    selectedId,
    loadMonthlyRosterOrgUnitOptionById,
  );

export const loadMonthlyRosterTalentGroupOptions = async (
  search: string,
): Promise<ReferenceOption[]> => loadActiveTalentGroupReferenceOptions(search);

export const loadMonthlyRosterTalentGroupOptionById = async (
  talentGroupId: string,
): Promise<ReferenceOption> => loadTalentGroupReferenceOptionById(talentGroupId);

export const loadMonthlyRosterTalentGroupFilterOptions = async (
  search: string,
  selectedId?: string,
): Promise<ReferenceOption[]> =>
  mergeSelectedOption(
    await loadMonthlyRosterTalentGroupOptions(search),
    search,
    selectedId,
    loadMonthlyRosterTalentGroupOptionById,
  );

export const loadMonthlyRosterDepartmentOptionById = async (
  departmentOrgUnitId: string,
): Promise<ReferenceOption> => loadOrgUnitReferenceOptionById(departmentOrgUnitId);

export const loadMonthlyRosterDepartmentFilterOptions = async (
  search: string,
  selectedId?: string,
): Promise<ReferenceOption[]> =>
  mergeSelectedOption(
    await loadMonthlyRosterDepartmentOptions(search),
    search,
    selectedId,
    loadMonthlyRosterDepartmentOptionById,
  );

export const loadMonthlyRosterWorkPatternOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchWorkPatterns({
    search: search || undefined,
    status: 'ACTIVE',
    limit: OPTION_LIMIT,
  });

  return response.data.map(toWorkPatternOption);
};

export const loadMonthlyRosterWorkPatternOptionById = async (
  workPatternId: string,
): Promise<ReferenceOption> => toWorkPatternOption(await fetchWorkPatternDetail(workPatternId));

export const loadMonthlyRosterWorkPatternFilterOptions = async (
  search: string,
  selectedId?: string,
): Promise<ReferenceOption[]> =>
  mergeSelectedOption(
    await loadMonthlyRosterWorkPatternOptions(search),
    search,
    selectedId,
    loadMonthlyRosterWorkPatternOptionById,
  );

export const loadMonthlyRosterHolidayCalendarOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchHolidayCalendars({
    search: search || undefined,
    status: 'ACTIVE',
    limit: OPTION_LIMIT,
  });

  return response.data.map(toHolidayCalendarOption);
};

export const loadMonthlyRosterHolidayCalendarOptionById = async (
  holidayCalendarId: string,
): Promise<ReferenceOption> =>
  toHolidayCalendarOption(await fetchHolidayCalendarDetail(holidayCalendarId));

export const loadMonthlyRosterHolidayCalendarFilterOptions = async (
  search: string,
  selectedId?: string,
): Promise<ReferenceOption[]> =>
  mergeSelectedOption(
    await loadMonthlyRosterHolidayCalendarOptions(search),
    search,
    selectedId,
    loadMonthlyRosterHolidayCalendarOptionById,
  );
