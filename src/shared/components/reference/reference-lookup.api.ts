import { z } from 'zod';

import { apiRequest } from '@shared/api';

export const referenceLookupResourceValues = [
  'org-units',
  'employment-profiles',
  'talents',
  'talent-groups',
  'platform-accounts',
  'studio-resources',
  'events',
  'contract-records',
  'revenue-entries',
  'commission-rules',
] as const;

export type ReferenceLookupResource = (typeof referenceLookupResourceValues)[number];

const referenceLookupItemSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    secondaryLabel: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
  })
  .strict();

const referenceLookupResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(referenceLookupItemSchema),
      })
      .strict(),
  })
  .strict();

export type ReferenceLookupItem = z.infer<typeof referenceLookupItemSchema>;

export const fetchReferenceLookupOptions = async (
  resource: ReferenceLookupResource,
  query: { search?: string; limit?: number },
): Promise<ReferenceLookupItem[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/reference/${resource}`,
    params: {
      search: query.search || undefined,
      limit: query.limit,
    },
  });

  return referenceLookupResponseSchema.parse(response).data.items;
};
