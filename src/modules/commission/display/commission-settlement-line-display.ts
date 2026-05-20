type CommissionSettlementLineRevenueEntryReference = {
  revenueEntryId: string;
  revenueEntryCodeSnapshot?: string | null;
};

export const readCommissionSettlementLineRevenueEntryDisplay = (
  line: CommissionSettlementLineRevenueEntryReference,
): string => {
  const snapshot = line.revenueEntryCodeSnapshot?.trim();

  return snapshot && snapshot.length > 0 ? snapshot : line.revenueEntryId;
};
