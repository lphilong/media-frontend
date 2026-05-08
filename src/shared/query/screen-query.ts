import type { z } from 'zod';

import {
  mergeQueryParams,
  parseQueryParams,
  serializeQueryParams,
  type QueryParamConfig,
  type QueryParamSchema,
  type QueryShape,
} from '@shared/query/querystring';

export type ScreenQueryManager<TSchema extends QueryParamSchema> = {
  parse: (searchParams: URLSearchParams) => z.infer<TSchema>;
  serialize: (query: QueryShape) => URLSearchParams;
  merge: (
    current: URLSearchParams,
    nextShape: QueryShape,
    options?: { resetCursorOnChange?: boolean },
  ) => URLSearchParams;
};

export const createScreenQueryManager = <TSchema extends QueryParamSchema>(
  config: QueryParamConfig<TSchema>,
): ScreenQueryManager<TSchema> => {
  return {
    parse: (searchParams) => parseQueryParams(searchParams, config),
    serialize: (query) => serializeQueryParams(query, config),
    merge: (current, nextShape, options) => mergeQueryParams(current, nextShape, config, options),
  };
};
