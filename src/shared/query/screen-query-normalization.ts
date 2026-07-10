import { z } from 'zod';

export type RelatedIdentityRule<TQuery extends Record<string, unknown>> = {
  when?: Partial<Record<Extract<keyof TQuery, string>, string | number | boolean | undefined>>;
  requiredKeys: readonly Extract<keyof TQuery, string>[];
};

export const preprocessBlankNumericQueryValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().length === 0 ? undefined : value;
};

export const idSchema = z.string().trim().min(1);
export const cursorSchema = z.string().trim().min(1).optional();
export const limitSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce.number().int().min(1).max(100).optional(),
);
export const searchSchema = z.string().trim().min(1).optional();
export const integerTimestampSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce.number().int().safe().optional(),
);

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const utcMidnightTimestampSchema = z.preprocess(
  preprocessBlankNumericQueryValue,
  z.coerce
    .number()
    .int()
    .safe()
    .refine((value) => value % MILLISECONDS_PER_DAY === 0)
    .optional(),
);

export const sortDirectionSchema = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.enum(['asc', 'desc']),
  )
  .optional();

const isCanonicalDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() + 1 === month &&
    utcDate.getUTCDate() === day
  );
};

export const canonicalDateSchema = z.string().trim().refine(isCanonicalDate).optional();

export const booleanQuerySchema = z
  .preprocess((value) => {
    if (value === 'true' || value === true) {
      return true;
    }

    if (value === 'false' || value === false) {
      return false;
    }

    return value;
  }, z.boolean())
  .optional();

export const hasPresentValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
};

export const dropSortDirectionWithoutSortBy = <
  TQuery extends { sortBy?: string; sortDirection?: string },
>(
  query: TQuery,
): TQuery => {
  if (query.sortBy) {
    return query;
  }

  return {
    ...query,
    sortDirection: undefined,
  };
};

export const sanitizeWindowRange = <
  TQuery extends Record<string, unknown>,
  TStartKey extends Extract<keyof TQuery, string>,
  TEndKey extends Extract<keyof TQuery, string>,
>(
  query: TQuery,
  startKey: TStartKey,
  endKey: TEndKey,
): TQuery => {
  const start = query[startKey];
  const end = query[endKey];

  if (typeof start === 'number' && typeof end === 'number' && end <= start) {
    return {
      ...query,
      [startKey]: undefined,
      [endKey]: undefined,
    };
  }

  const startString = typeof start === 'string' ? (start as string) : undefined;
  const endString = typeof end === 'string' ? (end as string) : undefined;

  if (startString && endString && endString <= startString) {
    return {
      ...query,
      [startKey]: undefined,
      [endKey]: undefined,
    };
  }

  return query;
};

const ruleMatches = <TQuery extends Record<string, unknown>>(
  query: TQuery,
  rule: RelatedIdentityRule<TQuery>,
): boolean => {
  if (!rule.when) {
    return true;
  }

  return Object.entries(rule.when).every(([key, expectedValue]) => {
    return query[key as keyof TQuery] === expectedValue;
  });
};

const resolveRequiredIdentityKeys = <TQuery extends Record<string, unknown>>(
  query: TQuery,
  rules: readonly RelatedIdentityRule<TQuery>[],
): Extract<keyof TQuery, string>[] => {
  const required = new Set<Extract<keyof TQuery, string>>();

  rules.forEach((rule) => {
    if (!ruleMatches(query, rule)) {
      return;
    }

    rule.requiredKeys.forEach((key) => {
      required.add(key);
    });
  });

  return Array.from(required);
};

export const enforceRelatedIdentityContract = <TQuery extends { view?: string }>(
  query: TQuery,
  relatedView: string,
  rules: readonly RelatedIdentityRule<TQuery>[],
): TQuery => {
  const next = { ...query };

  if (next.view !== relatedView) {
    return {
      ...next,
      view: undefined,
    };
  }

  const requiredKeys = resolveRequiredIdentityKeys(next, rules);
  const hasAllRequiredKeys = requiredKeys.every((key) => hasPresentValue(next[key]));

  if (hasAllRequiredKeys) {
    return next;
  }

  const cleared: Record<string, unknown> = {
    ...next,
    view: undefined,
  };
  requiredKeys.forEach((key) => {
    cleared[key] = undefined;
  });

  return cleared as TQuery;
};
