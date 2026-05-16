import {
  formatCanonicalDate,
  formatCurrency,
  formatDecimal,
  formatInteger,
  formatPercent,
  formatTimestamp,
  formatUtcTimestamp,
  formatUtcMidnightDateLike,
} from '@shared/formatting/formatters';

const withTimezone = (timezone: string, assertion: () => void): void => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = timezone;

  try {
    assertion();
  } finally {
    process.env.TZ = previousTimezone;
  }
};

describe('formatters', () => {
  it.each(['America/Los_Angeles', 'Asia/Ho_Chi_Minh'])(
    'formats UTC-midnight date-like values as stable calendar dates in %s',
    (timezone) => {
      withTimezone(timezone, () => {
        expect(formatUtcMidnightDateLike('2024-01-01T00:00:00.000Z')).toBe('2024-01-01');
      });
    },
  );

  it.each(['America/Los_Angeles', 'Asia/Ho_Chi_Minh'])(
    'formats UTC timestamps without local timezone drift in %s',
    (timezone) => {
      withTimezone(timezone, () => {
        expect(formatUtcTimestamp('2024-01-01T10:20:30.000Z')).toBe('2024-01-01 10:20:30');
        expect(formatTimestamp('2024-01-01T10:20:30.000Z')).toBe('2024-01-01 10:20:30');
      });
    },
  );

  it('keeps canonical date formatting limited to date-only values', () => {
    expect(formatCanonicalDate('2024-01-01')).toBe('2024-01-01');
    expect(formatCanonicalDate('2024-01-01T00:00:00.000Z')).toBe('-');
  });

  it('keeps canonical date formatting separate from UTC-midnight date-like formatting', () => {
    const input = '2024-01-01T00:00:00.000Z';
    expect(formatCanonicalDate(input)).toBe('-');
    expect(formatUtcMidnightDateLike(input)).toBe('2024-01-01');
  });

  it('formats currency values for commercial display', () => {
    expect(formatCurrency(1234.5, 'USD', 'en-US')).toBe('$1,234.50');
  });

  it('formats decimal values for commercial display', () => {
    expect(formatDecimal(1234.56789, 'en-US', 4)).toBe('1,234.5679');
  });

  it('formats integer values for commercial display', () => {
    expect(formatInteger(1234.567, 'en-US')).toBe('1,235');
  });

  it('formats percent values for commercial display', () => {
    expect(formatPercent(12.345, 'en-US', 2)).toBe('12.35%');
  });
});
