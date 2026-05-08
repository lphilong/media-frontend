import type { RoleDetailRecord, RoleListItem } from '@modules/role/types/role.types';

export const readRoleName = (record: RoleDetailRecord | RoleListItem): string => record.name;
