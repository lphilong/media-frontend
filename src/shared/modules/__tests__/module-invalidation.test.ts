import { QueryClient } from '@tanstack/react-query';
import { vi } from 'vitest';

import {
  createModuleInvalidator,
  createModuleQueryKeys,
  defineModuleInvalidationRules,
} from '@shared/modules/module-invalidation';

describe('module invalidation conventions', () => {
  it('lets modules declare explicit mutation invalidation maps', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    const queryKeys = createModuleQueryKeys('org-unit');
    const rules = defineModuleInvalidationRules<{
      create: { orgUnitId: string };
      move: { orgUnitId: string; parentOrgUnitId?: string };
    }>({
      create: () => [queryKeys.list(), queryKeys.all()],
      move: ({ orgUnitId, parentOrgUnitId }) => [
        queryKeys.detail(orgUnitId),
        queryKeys.list(),
        ...(parentOrgUnitId ? [queryKeys.related('children', parentOrgUnitId)] : []),
      ],
    });

    const invalidator = createModuleInvalidator(queryClient, rules);
    const invalidated = await invalidator.invalidate('move', {
      orgUnitId: 'org-01',
      parentOrgUnitId: 'parent-01',
    });

    expect(invalidated).toEqual([
      ['module', 'org-unit', 'detail', 'org-01'],
      ['module', 'org-unit', 'list', 'default'],
      ['module', 'org-unit', 'related', 'children', 'parent-01'],
    ]);
    expect(invalidateSpy).toHaveBeenCalledTimes(3);
  });
});
