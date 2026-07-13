import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
} from '@shared/components/reference/reference-lookup.api';

const OPTION_LIMIT = 20;

const toTalentOption = (item: ReferenceLookupItem): ReferenceOption => ({
  id: item.id,
  label: item.label,
  description: item.secondaryLabel,
  secondaryLabel: item.secondaryLabel,
  code: item.code,
  type: item.type,
  status: item.status,
  state: item.state,
  href: `/talents/${item.id}`,
});

export const loadTalentReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('talents', {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map(toTalentOption);
};

export const loadTalentReferenceOptionById = async (talentId: string): Promise<ReferenceOption> => {
  const items = await fetchReferenceLookupOptions('talents', {
    ids: [talentId],
    limit: 1,
  });
  const option = items.map(toTalentOption).find((candidate) => candidate.id === talentId);

  return (
    option ?? {
      id: talentId,
      label: talentId,
      href: `/talents/${talentId}`,
    }
  );
};
