import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
} from '@shared/components/reference/reference-lookup.api';
import { fetchOrgUnitDetail, fetchOrgUnits } from '@modules/org-unit/api/org-unit.api';
import type { OrgUnitRecord } from '@modules/org-unit/types/org-unit.types';

const OPTION_LIMIT = 20;

const toOrgUnitOption = (item: ReferenceLookupItem): ReferenceOption => ({
  id: item.id,
  label: item.label,
  description: item.secondaryLabel,
  secondaryLabel: item.secondaryLabel,
  code: item.code,
  type: item.type,
  status: item.status,
  state: item.state,
  href: `/org-units/${item.id}`,
});

const toOrgUnitRecordOption = (item: OrgUnitRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.code} - ${item.name}`,
  description: [item.type, item.status].filter(Boolean).join(' - ') || undefined,
  href: `/org-units/${item.id}`,
});

export const loadOrgUnitReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('org-units', {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map(toOrgUnitOption);
};

export const loadOrgUnitReferenceOptionById = async (
  orgUnitId: string,
): Promise<ReferenceOption> => toOrgUnitRecordOption(await fetchOrgUnitDetail(orgUnitId));

export const loadActiveOrgUnitReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchOrgUnits({
    search: search || undefined,
    status: 'ACTIVE',
    limit: OPTION_LIMIT,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  return response.data.map(toOrgUnitRecordOption);
};

export const loadActiveDepartmentReferenceOptions = async (
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

  return response.data.map(toOrgUnitRecordOption);
};
