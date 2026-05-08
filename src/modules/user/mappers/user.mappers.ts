import type { UserDetailRecord, UserListItem } from '@modules/user/types/user.types';

export const readUserDisplayName = (record: UserDetailRecord | UserListItem): string => {
  if ('profile' in record) {
    return record.profile.displayName;
  }

  return record.displayName;
};
