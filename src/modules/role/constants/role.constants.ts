export const roleStateValues = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;

export const roleAssignmentStateValues = ['ACTIVE', 'REVOKED'] as const;

export const roleDelegationBandValues = ['LIMITED', 'PRIVILEGED', 'FOUNDATION'] as const;

export const roleMaxDelegatableBandValues = ['NONE', 'LIMITED', 'PRIVILEGED'] as const;

export const roleLifecycleActionValues = ['activate', 'deactivate', 'archive'] as const;

export const ROLE_PERMISSION_LITERALS = [
  'role:list',
  'role:view',
  'role:create',
  'role:update',
  'role:activate',
  'role:deactivate',
  'role:archive',
  'role:permission:assign',
  'role:assignment_rule:set',
  'role:assign_to_user',
  'role:revoke_from_user',
  'role:assignment:view',
] as const;
