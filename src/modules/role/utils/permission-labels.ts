import type { TFunction } from 'i18next';

import type { RolePermission } from '@modules/role/types/role.types';

const permissionGroupOrder = [
  'role',
  'user',
  'orgUnit',
  'employmentProfile',
  'employmentTerms',
  'talent',
  'talentGroup',
  'platformAccount',
  'studioResource',
  'event',
  'eventAssignment',
  'workSchedule',
  'contractRegistry',
  'contractObligation',
  'talentKpi',
  'kpi',
  'revenueLedger',
  'commissionRule',
  'commissionSettlement',
  'dashboardLite',
  'other',
] as const;

type PermissionGroup = (typeof permissionGroupOrder)[number];

const permissionGroupSet = new Set<string>(permissionGroupOrder);

const readPermissionGroup = (code: string): PermissionGroup => {
  const group = code.split(/[.:]/u)[0] || 'other';
  return permissionGroupSet.has(group) ? (group as PermissionGroup) : 'other';
};

const countPermissionGroups = (
  permissions: readonly RolePermission[],
): Partial<Record<PermissionGroup, number>> =>
  permissions.reduce<Partial<Record<PermissionGroup, number>>>((counts, permission) => {
    const group = readPermissionGroup(permission.code);
    counts[group] = (counts[group] ?? 0) + 1;
    return counts;
  }, {});

export const formatPermissionCapabilitySummary = (
  permissions: readonly RolePermission[],
  t: TFunction,
): string => {
  if (permissions.length === 0) {
    return '-';
  }

  const counts = countPermissionGroups(permissions);
  return permissionGroupOrder
    .flatMap((group) => {
      const count = counts[group] ?? 0;
      return count > 0
        ? [
            t('role:permissionGroups.summaryItem', {
              group: t(`role:permissionGroups.${group}`),
              count,
            }),
          ]
        : [];
    })
    .join(', ');
};

export const formatPermissionCapabilityItems = (
  permissions: readonly RolePermission[],
  t: TFunction,
): string[] => {
  if (permissions.length === 0) {
    return ['-'];
  }

  const counts = countPermissionGroups(permissions);
  return permissionGroupOrder.flatMap((group) => {
    const count = counts[group] ?? 0;
    return count > 0
      ? [
          t('role:permissionGroups.summaryItem', {
            group: t(`role:permissionGroups.${group}`),
            count,
          }),
        ]
      : [];
  });
};
