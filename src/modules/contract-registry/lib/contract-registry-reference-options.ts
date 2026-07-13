import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
} from '@shared/components/reference/reference-lookup.api';

const OPTION_LIMIT = 20;

const toContractOption = (item: ReferenceLookupItem): ReferenceOption => ({
  id: item.id,
  label: item.label,
  description: item.secondaryLabel,
  secondaryLabel: item.secondaryLabel,
  code: item.code,
  type: item.type,
  status: item.status,
  state: item.state,
  href: `/contract-registry/${item.id}`,
});

export const loadContractReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('contract-records', {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map(toContractOption);
};
