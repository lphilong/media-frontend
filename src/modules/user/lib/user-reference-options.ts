import { fetchUsers } from '@modules/user/api/user.api';
import type { UserListItem } from '@modules/user/types/user.types';
import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';

const OPTION_LIMIT = 20;

const toUserOption = (item: UserListItem): ReferenceOption => ({
  id: item.id,
  label: item.displayName,
  description: item.email ?? undefined,
  status: item.accountStatus,
  href: `/users/${item.id}`,
});

export const loadUserReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const response = await fetchUsers({
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return response.data.map(toUserOption);
};
