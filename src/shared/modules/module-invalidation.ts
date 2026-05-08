import type { QueryClient, QueryKey } from '@tanstack/react-query';

export type ModuleInvalidationContextMap = Record<string, unknown>;

export type ModuleInvalidationRules<TContextMap extends ModuleInvalidationContextMap> = {
  [TMutation in keyof TContextMap]: (context: TContextMap[TMutation]) => readonly QueryKey[];
};

export const defineModuleInvalidationRules = <TContextMap extends ModuleInvalidationContextMap>(
  rules: ModuleInvalidationRules<TContextMap>,
): ModuleInvalidationRules<TContextMap> => {
  return rules;
};

export const createModuleQueryKeys = (moduleId: string) => {
  return {
    all: (): QueryKey => ['module', moduleId],
    list: (scope?: string): QueryKey => ['module', moduleId, 'list', scope ?? 'default'],
    detail: (id: string): QueryKey => ['module', moduleId, 'detail', id],
    related: (relation: string, targetId: string): QueryKey => [
      'module',
      moduleId,
      'related',
      relation,
      targetId,
    ],
  };
};

export const createModuleInvalidator = <TContextMap extends ModuleInvalidationContextMap>(
  queryClient: QueryClient,
  rules: ModuleInvalidationRules<TContextMap>,
) => {
  return {
    invalidate: async <TMutation extends keyof TContextMap>(
      mutation: TMutation,
      context: TContextMap[TMutation],
    ): Promise<readonly QueryKey[]> => {
      const queryKeys = rules[mutation](context);

      await Promise.all(
        queryKeys.map((queryKey) => {
          return queryClient.invalidateQueries({ queryKey });
        }),
      );

      return queryKeys;
    },
  };
};
