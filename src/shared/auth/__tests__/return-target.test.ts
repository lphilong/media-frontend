import { resolveReturnTarget } from '@shared/auth/return-target';

describe('resolveReturnTarget', () => {
  it('keeps safe internal deep links', () => {
    expect(resolveReturnTarget('/events?status=SCHEDULED#filters')).toBe(
      '/events?status=SCHEDULED#filters',
    );
  });

  it('falls back to dashboard for unsafe targets', () => {
    expect(resolveReturnTarget('https://example.com/hijack')).toBe('/dashboard');
    expect(resolveReturnTarget('//example.com/hijack')).toBe('/dashboard');
    expect(resolveReturnTarget('/auth/callback?code=123')).toBe('/dashboard');
  });

  it('uses fallback when candidate is missing', () => {
    expect(resolveReturnTarget(null, '/work-shifts')).toBe('/work-shifts');
  });
});
