import { z, type ZodRawShape } from 'zod';

export type QueryShape = Record<string, string | number | boolean | undefined | null>;
export type QueryParamSchema = z.ZodObject<ZodRawShape>;

export type QueryParamConfig<TSchema extends QueryParamSchema> = {
  schema: TSchema;
  normalize?: (query: z.infer<TSchema>) => z.infer<TSchema>;
  cursorKey?: keyof z.infer<TSchema> & string;
};

const getAllowedKeys = <TSchema extends QueryParamSchema>(schema: TSchema): Set<string> => {
  return new Set(Object.keys(schema.shape));
};

const readAllowedParams = (payload: QueryShape, allowedKeys: Set<string>): QueryShape => {
  const result: QueryShape = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (allowedKeys.has(key)) {
      result[key] = value;
    }
  });

  return result;
};

const readAllowedSearchParams = <TSchema extends QueryParamSchema>(
  searchParams: URLSearchParams,
  schema: TSchema,
): Record<string, string> => {
  const payload: Record<string, string> = {};
  const allowedKeys = getAllowedKeys(schema);

  searchParams.forEach((value, key) => {
    if (allowedKeys.has(key)) {
      payload[key] = value;
    }
  });

  return payload;
};

const coerceAllowedPayload = <TSchema extends QueryParamSchema>(
  payload: QueryShape,
  schema: TSchema,
): QueryShape => {
  const allowedKeys = getAllowedKeys(schema);
  const allowedPayload = readAllowedParams(payload, allowedKeys);
  const coercedPayload: QueryShape = {};

  Object.entries(allowedPayload).forEach(([key, value]) => {
    const parser = schema.shape[key];
    if (!parser) {
      return;
    }

    const parsed = parser.safeParse(value);
    if (!parsed.success) {
      return;
    }

    coercedPayload[key] = parsed.data as QueryShape[string];
  });

  return coercedPayload;
};

const parseWithFallback = <TSchema extends QueryParamSchema>(
  payload: QueryShape,
  schema: TSchema,
): z.infer<TSchema> => {
  const coercedPayload = coerceAllowedPayload(payload, schema);
  const parsed = schema.safeParse(coercedPayload);
  if (parsed.success) {
    return parsed.data;
  }

  const fallback = schema.safeParse({});
  if (!fallback.success) {
    throw parsed.error;
  }

  return fallback.data;
};

export const sanitizeQueryShape = <TSchema extends QueryParamSchema>(
  query: QueryShape,
  config: QueryParamConfig<TSchema>,
): z.infer<TSchema> => {
  const parsed = parseWithFallback(query, config.schema);
  return config.normalize ? config.normalize(parsed) : parsed;
};

export const parseQueryParams = <TSchema extends QueryParamSchema>(
  searchParams: URLSearchParams,
  config: QueryParamConfig<TSchema>,
): z.infer<TSchema> => {
  return sanitizeQueryShape(readAllowedSearchParams(searchParams, config.schema), config);
};

export const serializeQueryParams = <TSchema extends QueryParamSchema>(
  query: QueryShape,
  config: QueryParamConfig<TSchema>,
): URLSearchParams => {
  const params = new URLSearchParams();
  const allowedKeys = getAllowedKeys(config.schema);
  const normalized = sanitizeQueryShape(query, config);

  Object.entries(normalized).forEach(([key, value]) => {
    if (!allowedKeys.has(key)) {
      return;
    }

    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  return params;
};

const normalizeComparableValue = (value: QueryShape[string]): QueryShape[string] => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  return value;
};

const comparableShape = (query: QueryShape, cursorKey: string): QueryShape => {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([key]) => key !== cursorKey)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeComparableValue(value)])
      .filter(([, value]) => value !== undefined),
  );
};

export const hasQueryShapeChanged = <TSchema extends QueryParamSchema>(
  current: z.infer<TSchema>,
  next: z.infer<TSchema>,
  cursorKey = 'cursor',
): boolean => {
  const currentComparable = comparableShape(current as QueryShape, cursorKey);
  const nextComparable = comparableShape(next as QueryShape, cursorKey);

  return JSON.stringify(currentComparable) !== JSON.stringify(nextComparable);
};

export const resetCursorValueOnShapeChange = <TSchema extends QueryParamSchema>(
  current: z.infer<TSchema>,
  next: z.infer<TSchema>,
  cursorKey = 'cursor',
): z.infer<TSchema> => {
  if (!hasQueryShapeChanged(current, next, cursorKey)) {
    return next;
  }

  const nextShape = { ...next } as QueryShape;
  delete nextShape[cursorKey];

  return nextShape as z.infer<TSchema>;
};

export const mergeQueryParams = <TSchema extends QueryParamSchema>(
  current: URLSearchParams,
  nextShape: QueryShape,
  config: QueryParamConfig<TSchema>,
  options?: { resetCursorOnChange?: boolean },
): URLSearchParams => {
  const cursorKey = config.cursorKey ?? 'cursor';
  const currentQuery = parseQueryParams(current, config);
  const mergedQuery = {
    ...currentQuery,
    ...nextShape,
  };
  let nextQuery = config.normalize
    ? config.normalize(parseWithFallback(mergedQuery, config.schema))
    : parseWithFallback(mergedQuery, config.schema);

  if (options?.resetCursorOnChange) {
    nextQuery = resetCursorValueOnShapeChange(currentQuery, nextQuery, cursorKey);
  }

  return serializeQueryParams(nextQuery, config);
};
