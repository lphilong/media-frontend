import {
  DEFAULT_BUSINESS_TIME_ZONE,
  formatCanonicalDate,
  formatBusinessDateTimeInputValue,
  formatBusinessTimestamp,
  formatCreatedDate,
  formatCurrency,
  formatDecimal,
  formatInteger,
  formatLocalizedUtcMidnightDateLike,
  formatPercent,
  formatTimestamp,
  formatUtcDateInputValue,
  formatUtcTimestamp,
  formatUtcMidnightDateLike,
  formatVietnamMonth,
  formatVietnamMonthLabel,
  formatVietnamTimestamp,
  parseBusinessDateTimeInputValue,
  parseUtcMidnightDateInputValue,
  readReferenceDisplay,
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
  it.each(['America/Los_Angeles', 'UTC'])(
    'formats business timestamps in the explicit business timezone without local drift in %s',
    (timezone) => {
      withTimezone(timezone, () => {
        expect(formatBusinessTimestamp('2026-05-20T07:14:00.000Z')).toBe('14:14 20-05-2026');
        expect(DEFAULT_BUSINESS_TIME_ZONE).toBe('Asia/Ho_Chi_Minh');
      });
    },
  );

  it('uses an explicit timezone parameter for business timestamp display', () => {
    expect(formatBusinessTimestamp('2026-05-20T07:14:00.000Z', 'UTC')).toBe('07:14 20-05-2026');
  });

  it('formats operator-facing Vietnam time labels', () => {
    expect(formatVietnamTimestamp('2026-05-20T07:14:00.000Z')).toBe(
      '14:14 20-05-2026, giờ Việt Nam',
    );
    expect(formatVietnamTimestamp('not-a-date')).toBe('-');
    expect(formatVietnamMonth('2026-05')).toBe('05-2026');
    expect(formatVietnamMonthLabel('2026-05')).toBe('Tháng 05-2026');
  });

  it.each(['America/Los_Angeles', 'UTC'])(
    'round-trips datetime-local values through the business timezone without local drift in %s',
    (timezone) => {
      withTimezone(timezone, () => {
        const utcTimestamp = Date.parse('2026-05-20T07:14:00.000Z');

        expect(formatBusinessDateTimeInputValue(utcTimestamp)).toBe('2026-05-20T14:14');
        expect(parseBusinessDateTimeInputValue('2026-05-20T14:14')).toBe(utcTimestamp);
        expect(parseBusinessDateTimeInputValue('2026-05-20T07:14', 'UTC')).toBe(utcTimestamp);
      });
    },
  );

  it('parses date-only input as UTC-midnight milliseconds', () => {
    expect(parseUtcMidnightDateInputValue('2025-01-01')).toBe(1_735_689_600_000);
    expect(formatUtcDateInputValue(1_735_689_600_000)).toBe('2025-01-01');
    expect(parseUtcMidnightDateInputValue('2025-02-30')).toBeUndefined();
  });

  it('keeps business timestamp fallback behavior for missing or invalid input', () => {
    expect(formatBusinessTimestamp('')).toBe('-');
    expect(formatBusinessTimestamp('not-a-date')).toBe('-');
    expect(formatBusinessTimestamp('2026-05-20T07:14:00.000Z', 'not-a-timezone')).toBe(
      '14:14 20-05-2026',
    );
  });

  it.each(['America/Los_Angeles', 'Asia/Ho_Chi_Minh'])(
    'formats UTC-midnight date-like values as stable calendar dates in %s',
    (timezone) => {
      withTimezone(timezone, () => {
        expect(formatUtcMidnightDateLike('2024-01-01T00:00:00.000Z')).toBe('01-01-2024');
      });
    },
  );

  it('formats UTC-midnight date-like values with the requested UI locale', () => {
    const value = '2026-01-01T00:00:00.000Z';

    expect(formatLocalizedUtcMidnightDateLike(value, 'en')).toBe('Jan 1, 2026');
    expect(formatLocalizedUtcMidnightDateLike(value, 'vi')).toBe('1 thg 1, 2026');
    expect(formatLocalizedUtcMidnightDateLike(value, 'zh')).toBe('2026年1月1日');
    expect(formatLocalizedUtcMidnightDateLike('invalid', 'en')).toBe('-');
  });

  it.each(['America/Los_Angeles', 'Asia/Ho_Chi_Minh'])(
    'formats UTC timestamps without local timezone drift in %s',
    (timezone) => {
      withTimezone(timezone, () => {
        expect(formatUtcTimestamp('2024-01-01T10:20:30.000Z')).toBe('10:20 01-01-2024');
        expect(formatTimestamp('2024-01-01T10:20:30.000Z')).toBe('10:20 01-01-2024');
      });
    },
  );

  it('formats Batch 1 target timestamp and date-only displays', () => {
    const timestamp = formatUtcTimestamp('2026-05-18T19:04:47.000Z');

    expect(timestamp).toBe('19:04 18-05-2026');
    expect(timestamp).not.toContain('19:04:47');
    expect(formatCanonicalDate('2026-05-18')).toBe('18-05-2026');
    expect(formatUtcDateInputValue('2026-05-18T00:00:00.000Z')).toBe('2026-05-18');
  });

  it('formats entity created dates without time-of-day', () => {
    expect(formatCreatedDate('2026-05-17T18:05:00.000Z')).toBe('17-05-2026');
  });

  it('keeps canonical date formatting limited to date-only values', () => {
    expect(formatCanonicalDate('2024-01-01')).toBe('01-01-2024');
    expect(formatCanonicalDate('2024-01-01T00:00:00.000Z')).toBe('-');
  });

  it('keeps canonical date formatting separate from UTC-midnight date-like formatting', () => {
    const input = '2024-01-01T00:00:00.000Z';
    expect(formatCanonicalDate(input)).toBe('-');
    expect(formatUtcMidnightDateLike(input)).toBe('01-01-2024');
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

  it('formats reference summaries by readable label before code and shortened fallback', () => {
    expect(
      readReferenceDisplay(
        {
          id: 'talent-001',
          code: 'TAL-001',
          name: 'Luna Park',
        },
        'talent-001',
      ),
    ).toBe('Luna Park');
    expect(
      readReferenceDisplay({
        id: 'talent-002',
        code: 'TAL-002',
        name: 'Name Wins',
        displayName: 'Display Name Loses',
      }),
    ).toBe('Display Name Loses');
    expect(
      readReferenceDisplay({
        id: 'display-001',
        display: 'Display Label',
        displayName: 'Display Name Label',
        title: 'Title Label',
        handle: '@handle',
      }),
    ).toBe('Display Label');
    expect(
      readReferenceDisplay({
        id: 'display-name-001',
        displayName: 'Display Name Label',
        title: 'Title Label',
        handle: '@handle',
      }),
    ).toBe('Display Name Label');
    expect(readReferenceDisplay({ id: 'event-001', title: 'Spring Show' })).toBe('Spring Show');
    expect(readReferenceDisplay({ id: 'platform-001', code: 'PA-001' })).toBe('PA-001');
    expect(readReferenceDisplay(null, 'reference-id-1234567890')).toBe('referenc...7890');
  });
});
