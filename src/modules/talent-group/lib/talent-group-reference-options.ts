import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
} from '@shared/components/reference/reference-lookup.api';
import {
  fetchTalentGroupDetail,
  fetchTalentGroups,
} from '@modules/talent-group/api/talent-group.api';
import type { TalentGroupRecord } from '@modules/talent-group/types/talent-group.types';

const OPTION_LIMIT = 20;

const toTalentGroupOption = (item: ReferenceLookupItem): ReferenceOption => ({
  id: item.id,
  label: item.label,
  description: item.secondaryLabel,
  secondaryLabel: item.secondaryLabel,
  code: item.code,
  type: item.type,
  status: item.status,
  state: item.state,
  href: `/talent-groups/${item.id}`,
});

const toTalentGroupRecordOption = (item: TalentGroupRecord): ReferenceOption => ({
  id: item.id,
  label: `${item.groupCode} - ${item.name}`,
  description: [item.shortName, item.status].filter(Boolean).join(' - ') || undefined,
  href: `/talent-groups/${item.id}`,
});

export const loadTalentGroupReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('talent-groups', {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map(toTalentGroupOption);
};

export const loadTalentGroupReferenceOptionById = async (
  talentGroupId: string,
): Promise<ReferenceOption> =>
  toTalentGroupRecordOption(await fetchTalentGroupDetail(talentGroupId));

export const loadActiveTalentGroupReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchTalentGroups({
    search: search || undefined,
    status: 'ACTIVE',
    limit: OPTION_LIMIT,
    sortBy: 'name',
    sortDirection: 'asc',
  });

  return response.data.map(toTalentGroupRecordOption);
};
