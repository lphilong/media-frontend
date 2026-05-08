import { z } from 'zod';

import {
  userAccountStatusValues,
  userActorKindValues,
} from '@modules/user/constants/user.constants';
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

const userFlatListSchema = z.object({
  state: z.enum(userAccountStatusValues).optional(),
  actorKind: z.enum(userActorKindValues).optional(),
  cursor: cursorSchema,
  limit: limitSchema,
  search: searchSchema,
});

export const userFlatListQueryConfig = defineScreenQueryConfig({
  id: 'user.flat-list',
  schema: userFlatListSchema,
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
    allowedFilterKeys: ['state', 'actorKind'],
    archivedByDefault: {
      hiddenByDefault: true,
      statusKey: 'state',
      archivedValue: 'ARCHIVED',
    },
  },
});
