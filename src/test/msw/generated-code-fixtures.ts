const padSeed = (seed: number): string => String(seed).padStart(6, '0');

const readUtcDate = (value: unknown): Date | undefined => {
  const date = typeof value === 'number' || typeof value === 'string' ? new Date(value) : undefined;
  return date && Number.isFinite(date.getTime()) ? date : undefined;
};

export const generatedFixtureCode = (prefix: string, seed: number): string =>
  `${prefix}-${padSeed(seed)}`;

export const generatedFixtureMonthCode = (
  prefix: string,
  dateSource: unknown,
  seed: number,
  fallbackMonth = '202605',
): string => {
  const date = readUtcDate(dateSource);
  const month = date
    ? `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    : fallbackMonth;
  return `${prefix}-${month}-${padSeed(seed)}`;
};

export const generatedFixtureYearCode = (
  prefix: string,
  dateSource: unknown,
  seed: number,
  fallbackYear = '2026',
): string => {
  const date = readUtcDate(dateSource);
  const year = date ? String(date.getUTCFullYear()) : fallbackYear;
  return `${prefix}-${year}-${padSeed(seed)}`;
};

export const providedOrGeneratedFixtureCode = (provided: unknown, generated: string): string => {
  return typeof provided === 'string' && provided.trim().length > 0 ? provided.trim() : generated;
};
