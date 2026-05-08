import type { z } from 'zod';

import {
  mergeQueryParams,
  parseQueryParams,
  sanitizeQueryShape,
  serializeQueryParams,
  type QueryParamConfig,
  type QueryParamSchema,
  type QueryShape,
} from '@shared/query/querystring';

export type ScreenQuerySurface = 'flat-list' | 'related-list';

type ScreenQueryPrimitive = QueryShape[string];

export type ScreenQueryRelatedIdentityRule<TSchema extends QueryParamSchema> = {
  when?: Partial<Record<keyof z.infer<TSchema> & string, ScreenQueryPrimitive>>;
  requiredKeys: readonly (keyof z.infer<TSchema> & string)[];
};

export type ScreenQueryRelatedContract<TSchema extends QueryParamSchema> = {
  view: string;
  identityRules: readonly ScreenQueryRelatedIdentityRule<TSchema>[];
};

export type ScreenQueryCapabilities<TSchema extends QueryParamSchema> = {
  surface: ScreenQuerySurface;
  related?: ScreenQueryRelatedContract<TSchema>;
  search: {
    supported: boolean;
    key?: keyof z.infer<TSchema> & string;
  };
  cursor: {
    supported: boolean;
    key?: keyof z.infer<TSchema> & string;
  };
  sort: {
    supported: boolean;
    sortByKey?: keyof z.infer<TSchema> & string;
    sortDirectionKey?: keyof z.infer<TSchema> & string;
    allowedSortFields: readonly string[];
    allowedSortDirections: readonly string[];
  };
  allowedFilterKeys: readonly (keyof z.infer<TSchema> & string)[];
  archivedByDefault?: {
    hiddenByDefault: boolean;
    statusKey: keyof z.infer<TSchema> & string;
    archivedValue: string;
  };
};

export type ScreenQueryConfig<TSchema extends QueryParamSchema> = QueryParamConfig<TSchema> & {
  id: string;
  capabilities: ScreenQueryCapabilities<TSchema>;
};

export const sanitizeScreenQuery = <TSchema extends QueryParamSchema>(
  query: QueryShape,
  config: ScreenQueryConfig<TSchema>,
): z.infer<TSchema> => {
  return sanitizeQueryShape(query, config);
};

export const parseScreenQueryParams = <TSchema extends QueryParamSchema>(
  searchParams: URLSearchParams,
  config: ScreenQueryConfig<TSchema>,
): z.infer<TSchema> => {
  return parseQueryParams(searchParams, config);
};

export const serializeScreenQueryParams = <TSchema extends QueryParamSchema>(
  query: QueryShape,
  config: ScreenQueryConfig<TSchema>,
): URLSearchParams => {
  return serializeQueryParams(query, config);
};

export const mergeScreenQueryParams = <TSchema extends QueryParamSchema>(
  current: URLSearchParams,
  nextShape: QueryShape,
  config: ScreenQueryConfig<TSchema>,
  options?: { resetCursorOnChange?: boolean },
): URLSearchParams => {
  return mergeQueryParams(current, nextShape, config, options);
};

const hasPresentQueryValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
};

const identityRuleMatches = <TSchema extends QueryParamSchema>(
  query: z.infer<TSchema>,
  rule: ScreenQueryRelatedIdentityRule<TSchema>,
): boolean => {
  if (!rule.when) {
    return true;
  }

  return Object.entries(rule.when).every(([key, value]) => {
    return query[key as keyof z.infer<TSchema>] === value;
  });
};

const collectRequiredIdentityKeys = <TSchema extends QueryParamSchema>(
  query: z.infer<TSchema>,
  config: ScreenQueryConfig<TSchema>,
): (keyof z.infer<TSchema> & string)[] => {
  const related = config.capabilities.related;
  if (!related) {
    return [];
  }

  const required = new Set<keyof z.infer<TSchema> & string>();
  related.identityRules.forEach((rule) => {
    if (!identityRuleMatches(query, rule)) {
      return;
    }

    rule.requiredKeys.forEach((key) => {
      required.add(key);
    });
  });

  return Array.from(required);
};

export const getMissingRelatedIdentityKeys = <TSchema extends QueryParamSchema>(
  query: z.infer<TSchema>,
  config: ScreenQueryConfig<TSchema>,
): (keyof z.infer<TSchema> & string)[] => {
  const required = collectRequiredIdentityKeys(query, config);

  return required.filter((key) => {
    return !hasPresentQueryValue(query[key]);
  });
};

export const defineScreenQueryConfig = <TSchema extends QueryParamSchema>(
  config: ScreenQueryConfig<TSchema>,
): ScreenQueryConfig<TSchema> => {
  return config;
};
