import { readCommissionSettlementLineRevenueEntryDisplay } from '@modules/commission/display/commission-settlement-line-display';

describe('commission settlement line display', () => {
  it('prefers the readable revenue-entry code snapshot over the internal ID', () => {
    expect(
      readCommissionSettlementLineRevenueEntryDisplay({
        revenueEntryId: '018f9f2b-4d6f-75f1-ae2a-780d515d5d2a',
        revenueEntryCodeSnapshot: ' REV-202604-000001 ',
      }),
    ).toBe('REV-202604-000001');
  });

  it('falls back to the internal revenue-entry ID when no readable snapshot exists', () => {
    expect(
      readCommissionSettlementLineRevenueEntryDisplay({
        revenueEntryId: '018f9f2b-4d6f-75f1-ae2a-780d515d5d2a',
        revenueEntryCodeSnapshot: '   ',
      }),
    ).toBe('018f9f2b-4d6f-75f1-ae2a-780d515d5d2a');

    expect(
      readCommissionSettlementLineRevenueEntryDisplay({
        revenueEntryId: '018f9f2b-4d6f-75f1-ae2a-780d515d5d2a',
      }),
    ).toBe('018f9f2b-4d6f-75f1-ae2a-780d515d5d2a');
  });
});
