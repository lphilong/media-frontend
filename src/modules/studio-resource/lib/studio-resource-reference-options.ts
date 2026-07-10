import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
} from '@shared/components/reference/reference-lookup.api';

const OPTION_LIMIT = 20;

const toStudioResourceOption = (item: ReferenceLookupItem): ReferenceOption => ({
  id: item.id,
  label: item.label,
  description: item.secondaryLabel,
  secondaryLabel: item.secondaryLabel,
  code: item.code,
  type: item.type,
  status: item.status,
  state: item.state,
  href: `/studio-resources/${item.id}`,
});

export const loadStudioResourceReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('studio-resources', {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map(toStudioResourceOption);
};

export const loadStudioResourceReferenceOptionsByIds = async (
  ids: readonly string[],
): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('studio-resources', {
    ids,
    limit: Math.min(ids.length || 1, OPTION_LIMIT),
  });

  return items.map(toStudioResourceOption);
};
