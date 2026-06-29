import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  mergeQueryParams,
  parseQueryParams,
  serializeQueryParams,
  type QueryParamConfig,
  type QueryParamSchema,
  type QueryShape,
} from '@shared/query/querystring';

type UseRouteQueryStateOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

export const useRouteQueryState = <TSchema extends QueryParamSchema>(
  config: QueryParamConfig<TSchema>,
) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => parseQueryParams(searchParams, config), [config, searchParams]);

  useEffect(() => {
    const normalized = serializeQueryParams(query, config);
    if (normalized.toString() !== searchParams.toString()) {
      setSearchParams(normalized, { replace: true });
    }
  }, [config, query, searchParams, setSearchParams]);

  const patchQuery = useCallback(
    (patch: QueryShape, options?: UseRouteQueryStateOptions) => {
      const next = mergeQueryParams(searchParams, patch, config, {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      });
      setSearchParams(next, { replace: options?.replace });
    },
    [config, searchParams, setSearchParams],
  );

  const replaceQuery = useCallback(
    (nextShape: QueryShape, options?: Pick<UseRouteQueryStateOptions, 'replace'>) => {
      const next = serializeQueryParams(nextShape, config);
      setSearchParams(next, { replace: options?.replace ?? true });
    },
    [config, setSearchParams],
  );

  return {
    query,
    searchParams,
    patchQuery,
    replaceQuery,
  };
};
