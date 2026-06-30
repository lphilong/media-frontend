export const userAccountStatusValues = ['PENDING', 'ACTIVE', 'DISABLED', 'ARCHIVED'] as const;

export const userLifecycleActionValues = ['activate', 'disable', 'archive'] as const;

export const USER_PERMISSION_LITERALS = [
  'user:view',
  'user:create',
  'user:provision_account',
  'user:edit',
  'user:activate',
  'user:disable',
  'user:archive',
  'user:auth_linkage:set',
  'user:auth_linkage:unlink',
  'user:password_setup:send',
] as const;
