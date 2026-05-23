import { APP_PATHS } from '@app/router/paths';
import { fetchCommissionRules } from '@modules/commission/api/commission.api';
import type { CommissionRuleListItem } from '@modules/commission/types/commission.types';
import { fetchContractRecords } from '@modules/contract-registry/api/contract-registry.api';
import type { ContractListItem } from '@modules/contract-registry/types/contract-registry.types';
import { fetchEmploymentProfiles } from '@modules/employment-profile/api/employment-profile.api';
import type { EmploymentProfileListItem } from '@modules/employment-profile/types/employment-profile.types';
import { fetchEvents } from '@modules/event-assignment/api/event-assignment.api';
import type { EventListItem } from '@modules/event-assignment/types/event-assignment.types';
import { fetchOrgUnits } from '@modules/org-unit/api/org-unit.api';
import type { OrgUnitRecord } from '@modules/org-unit/types/org-unit.types';
import { fetchPlatformAccounts } from '@modules/platform-account/api/platform-account.api';
import type { PlatformAccountOwnerKind } from '@modules/platform-account/types/platform-account.types';
import type { PlatformAccountRecord } from '@modules/platform-account/types/platform-account.types';
import { fetchRevenueEntries } from '@modules/revenue-ledger/api/revenue-ledger.api';
import type { RevenueEntryListItem } from '@modules/revenue-ledger/types/revenue-ledger.types';
import { fetchStudioResources } from '@modules/studio-resource/api/studio-resource.api';
import type { StudioResourceListItem } from '@modules/studio-resource/types/studio-resource.types';
import { fetchTalentGroups } from '@modules/talent-group/api/talent-group.api';
import type { TalentGroupRecord } from '@modules/talent-group/types/talent-group.types';
import { fetchTalents } from '@modules/talent/api/talent.api';
import type { TalentRecord } from '@modules/talent/types/talent.types';
import { fetchUsers } from '@modules/user/api/user.api';
import type { UserListItem } from '@modules/user/types/user.types';
import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';

const OPTION_LIMIT = 20;

const compactDescription = (values: Array<string | null | undefined>): string | undefined => {
  const items = values.filter((value): value is string => Boolean(value));
  return items.length > 0 ? items.join(' - ') : undefined;
};

const toOrgUnitOption = (item: OrgUnitRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.name} - ${item.code}`,
  description: compactDescription([item.status, item.type]),
  href: APP_PATHS.orgUnitDetail(item.id),
});

const toEmploymentProfileOption = (item: EmploymentProfileListItem): ReferenceOption => ({
  id: item.id,
  label: `${item.displayName || item.legalName} - ${item.employeeCode}`,
  description: compactDescription([item.jobTitle, item.employmentStatus, item.contractStatus]),
  href: APP_PATHS.employmentProfileDetail(item.id),
});

const toTalentOption = (item: TalentRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.stageName} - ${item.talentCode}`,
  description: compactDescription([item.displayShortName, item.legalName, item.operationalStatus]),
  href: APP_PATHS.talentDetail(item.id),
});

const toTalentGroupOption = (item: TalentGroupRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.name} - ${item.groupCode}`,
  description: compactDescription([item.shortName, item.status]),
  href: APP_PATHS.talentGroupDetail(item.id),
});

const toUserOption = (item: UserListItem): ReferenceOption => ({
  id: item.id,
  label: compactDescription([item.displayName, item.email]) ?? item.displayName,
  description: compactDescription([item.accountStatus, item.actorKind]),
  href: APP_PATHS.userDetail(item.id),
  meta: {
    actorKind: item.actorKind,
  },
});

const toPlatformAccountOption = (item: PlatformAccountRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.displayName} - ${item.accountCode}`,
  description: compactDescription([
    item.platform,
    item.platformSurfaceType,
    item.operationalStatus,
  ]),
  href: APP_PATHS.platformAccountDetail(item.id),
});

const toStudioResourceOption = (item: StudioResourceListItem): ReferenceOption => ({
  id: item.id,
  label: `${item.name} - ${item.resourceCode}`,
  description: compactDescription([item.resourceClass, item.operationalStatus, item.locationLabel]),
  href: APP_PATHS.studioResourceDetail(item.id),
});

const toEventOption = (item: EventListItem): ReferenceOption => ({
  id: item.id,
  label: `${item.title} - ${item.eventCode}`,
  description: compactDescription([
    item.status,
    String(item.eventStartAt),
    String(item.eventEndAt),
  ]),
  href: APP_PATHS.eventDetail(item.id),
});

const toContractOption = (item: ContractListItem): ReferenceOption => ({
  id: item.id,
  label: `${item.title} - ${item.contractCode}`,
  description: compactDescription([item.contractKind, item.status, item.linkedEntityKind]),
  href: APP_PATHS.contractRecordDetail(item.id),
});

const toRevenueEntryOption = (item: RevenueEntryListItem): ReferenceOption => ({
  id: item.id,
  label: `${item.title} - ${item.revenueEntryCode}`,
  description: compactDescription([item.revenueKind, item.status, item.currencyCode]),
  href: APP_PATHS.revenueEntryDetail(item.id),
});

const toCommissionRuleOption = (item: CommissionRuleListItem): ReferenceOption => ({
  id: item.id,
  label: `${item.title} - ${item.ruleCode}`,
  description: compactDescription([item.settlementKind, item.beneficiaryKind, item.status]),
  href: APP_PATHS.commissionRuleDetail(item.id),
});

export const loadOrgUnitReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const response = await fetchOrgUnits({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  return response.data.map(toOrgUnitOption);
};

export const loadEmploymentProfileReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchEmploymentProfiles({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'employeeCode',
    sortDirection: 'asc',
  });

  return response.data.map(toEmploymentProfileOption);
};

export const loadTalentReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const response = await fetchTalents({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'talentCode',
    sortDirection: 'asc',
  });

  return response.data.map(toTalentOption);
};

export const loadTalentGroupReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchTalentGroups({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'groupCode',
    sortDirection: 'asc',
  });

  return response.data.map(toTalentGroupOption);
};

export const loadUserReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const response = await fetchUsers({
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return response.data.map(toUserOption);
};

export const loadPlatformAccountReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchPlatformAccounts({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'accountCode',
    sortDirection: 'asc',
  });

  return response.data.map(toPlatformAccountOption);
};

export const loadStudioResourceReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchStudioResources({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'resourceCode',
    sortDirection: 'asc',
  });

  return response.data.map(toStudioResourceOption);
};

export const loadEventReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const response = await fetchEvents({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'eventCode',
    sortDirection: 'asc',
  });

  return response.data.map(toEventOption);
};

export const loadContractReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const response = await fetchContractRecords({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'contractCode',
    sortDirection: 'asc',
  });

  return response.data.map(toContractOption);
};

export const loadRevenueEntryReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchRevenueEntries({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'recognizedAt',
    sortDirection: 'desc',
  });

  return response.data.map(toRevenueEntryOption);
};

export const loadCommissionRuleReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchCommissionRules({
    search: search || undefined,
    limit: OPTION_LIMIT,
    sortBy: 'ruleCode',
    sortDirection: 'asc',
  });

  return response.data.map(toCommissionRuleOption);
};

export const loadPlatformOwnerReferenceOptions = (
  ownerKind: PlatformAccountOwnerKind,
  search: string,
): Promise<ReferenceOption[]> => {
  if (ownerKind === 'ORG_UNIT') {
    return loadOrgUnitReferenceOptions(search);
  }

  if (ownerKind === 'TALENT') {
    return loadTalentReferenceOptions(search);
  }

  return loadTalentGroupReferenceOptions(search);
};
