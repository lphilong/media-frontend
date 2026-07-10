import { loadOrgUnitReferenceOptions } from '@modules/org-unit';
import type { PlatformAccountOwnerKind } from '@modules/platform-account/types/platform-account.types';
import { loadTalentReferenceOptions } from '@modules/talent';
import { loadTalentGroupReferenceOptions } from '@modules/talent-group';
import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
} from '@shared/components/reference/reference-lookup.api';

const OPTION_LIMIT = 20;

const toPlatformAccountOption = (item: ReferenceLookupItem): ReferenceOption => ({
  id: item.id,
  label: item.label,
  description: item.secondaryLabel,
  secondaryLabel: item.secondaryLabel,
  code: item.code,
  type: item.type,
  status: item.status,
  state: item.state,
  href: `/platform-accounts/${item.id}`,
});

export const loadPlatformAccountReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('platform-accounts', {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map(toPlatformAccountOption);
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
