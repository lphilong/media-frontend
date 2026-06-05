import { APP_PATHS } from '@app/router/paths';
import {
  fetchEmploymentProfileDetail,
  fetchEmploymentProfiles,
} from '@modules/employment-profile/api/employment-profile.api';
import type { EmploymentProfileListItem } from '@modules/employment-profile/types/employment-profile.types';
import { fetchOrgUnitDetail, fetchOrgUnits } from '@modules/org-unit/api/org-unit.api';
import type { OrgUnitRecord } from '@modules/org-unit/types/org-unit.types';
import { fetchTalentGroupDetail, fetchTalentGroups } from '@modules/talent-group/api/talent-group.api';
import type { TalentGroupRecord } from '@modules/talent-group/types/talent-group.types';
import { fetchTalentDetail } from '@modules/talent/api/talent.api';
import type { TalentRecord } from '@modules/talent/types/talent.types';
import {
  readTalentPerformanceAlias,
  readTalentPrimaryDisplay,
} from '@modules/talent/utils/talent-display';
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
import {
  loadEmploymentProfileReferenceOptions,
  loadStudioResourceReferenceOptionsByIds,
  loadStudioResourceReferenceOptions,
  loadTalentGroupReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';

const OPTION_LIMIT = 20;

const compactDescription = (values: Array<string | null | undefined>): string | undefined => {
  const items = values.filter((value): value is string => Boolean(value));
  return items.length > 0 ? items.join(' - ') : undefined;
};

const toEmploymentProfileOption = (item: EmploymentProfileListItem): ReferenceOption => ({
  id: item.id,
  label: `${item.employeeCode} - ${item.displayName || item.legalName}`,
  description: compactDescription([item.jobTitle, item.employmentStatus]),
  href: APP_PATHS.employmentProfileDetail(item.id),
});

const toTalentOption = (item: TalentRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.talentCode} - ${readTalentPrimaryDisplay(item)}`,
  description: compactDescription([
    item.talentOrigin === 'INTERNAL' ? readTalentPerformanceAlias(item) : item.legalName,
    item.talentOrigin === 'EXTERNAL' ? item.displayShortName : null,
    item.operationalStatus,
  ]),
  href: APP_PATHS.talentDetail(item.id),
});

const toTalentGroupOption = (item: TalentGroupRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.groupCode} - ${item.name}`,
  description: compactDescription([item.shortName, item.status]),
  href: APP_PATHS.talentGroupDetail(item.id),
});

const toDepartmentOption = (item: OrgUnitRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.code} - ${item.name}`,
  description: compactDescription([item.type, item.status]),
  href: APP_PATHS.orgUnitDetail(item.id),
});

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
    return toEmploymentProfileOption(await fetchEmploymentProfileDetail(subjectId));
  }

  if (subjectKind === 'TALENT') {
    return toTalentOption(await fetchTalentDetail(subjectId));
  }

  return toTalentGroupOption(await fetchTalentGroupDetail(subjectId));
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
): Promise<ReferenceOption[]> => {
  const response = await fetchEmploymentProfiles({
    search: search || undefined,
    orgUnitId: departmentOrgUnitId || undefined,
    employmentStatus: 'ACTIVE',
    limit: OPTION_LIMIT,
    sortBy: 'employeeCode',
    sortDirection: 'asc',
  });

  return response.data.map(toEmploymentProfileOption);
};

export const loadMonthlyRosterDepartmentOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchOrgUnits({
    search: search || undefined,
    status: 'ACTIVE',
    type: 'DEPARTMENT',
    limit: OPTION_LIMIT,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  return response.data.map(toDepartmentOption);
};

export const loadMonthlyRosterOrgUnitOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchOrgUnits({
    search: search || undefined,
    status: 'ACTIVE',
    limit: OPTION_LIMIT,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  return response.data.map(toDepartmentOption);
};

export const loadMonthlyRosterOrgUnitOptionById = async (
  orgUnitId: string,
): Promise<ReferenceOption> => toDepartmentOption(await fetchOrgUnitDetail(orgUnitId));

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
): Promise<ReferenceOption[]> => {
  const response = await fetchTalentGroups({
    search: search || undefined,
    status: 'ACTIVE',
    limit: OPTION_LIMIT,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  return response.data.map(toTalentGroupOption);
};

export const loadMonthlyRosterTalentGroupOptionById = async (
  talentGroupId: string,
): Promise<ReferenceOption> => toTalentGroupOption(await fetchTalentGroupDetail(talentGroupId));

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
): Promise<ReferenceOption> => toDepartmentOption(await fetchOrgUnitDetail(departmentOrgUnitId));

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
