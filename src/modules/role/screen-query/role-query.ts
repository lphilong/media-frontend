import { z } from 'zod';

import { roleStateValues } from '@modules/role/constants/role.constants';
import { defineScreenQueryConfig } from '@shared/query/screen-query-config';

const cursorSchema = z.string().trim().min(1).optional();
const searchSchema = z.string().trim().min(1).max(64).optional();

const preprocessBlankNumericQueryValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().length === 0 ? undefined : value;
};

const limitSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce.number().int().min(1).max(200).optional(),
);

const roleFlatListSchema = z.object({
  state: z.enum(roleStateValues).optional(),
  cursor: cursorSchema,
  limit: limitSchema,
  search: searchSchema,
});

export const roleFlatListQueryConfig = defineScreenQueryConfig({
  id: 'role.flat-list',
  schema: roleFlatListSchema,
  cursorKey: 'cursor',
  capabilities: {
    surface: 'flat-list',
    search: {
      supported: true,
      key: 'search',
    },
    cursor: {
      supported: true,
      key: 'cursor',
    },
    sort: {
      supported: false,
      allowedSortFields: [],
      allowedSortDirections: [],
    },
    allowedFilterKeys: ['state'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'state',
      archivedValue: 'ARCHIVED',
    },
  },
});
