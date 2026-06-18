import i18n from 'i18next';

import {
  parsePlatformEarningBatchListForTest,
  parseRevenueEntryDetailForTest,
} from '@modules/revenue-ledger/api/revenue-ledger.api';
import { getPlatformEarningActionAvailabilityForTest } from '@modules/revenue-ledger/components/PlatformEarningBatchesPanel';
import type { PlatformEarningBatch } from '@modules/revenue-ledger/types/revenue-ledger.types';
import { parseManagerPlatformEarningBatchListForTest } from '@modules/manager-workspace/api/manager-workspace.api';
import { setLocale } from '@shared/i18n/i18n';

const now = Date.UTC(2026, 5, 18);

describe('RL-2R backend-realistic Revenue contracts', () => {
  it('parses backend Platform Earnings snapshots and normalizes nextCursor null', () => {
    const parsed = parsePlatformEarningBatchListForTest({
      data: [approvedBatch()],
      meta: { nextCursor: null },
    });

    expect(parsed.meta?.nextCursor).toBeUndefined();
    expect(parsed.data[0]?.conversionSnapshot).toMatchObject({
      rawQuantity: 2400,
      grossConvertedAmount: 240000,
      ruleRef: 'conversion-rule',
      appliedByActorId: 'finance-approver',
      appliedAt: now,
    });
    expect(parsed.data[0]?.platformCutSnapshot).toMatchObject({
      grossConvertedAmount: 240000,
      platformCutAmount: 72000,
      companyNetAmount: 168000,
      targetCurrency: 'VND',
      ruleRef: 'cut-rule',
    });
  });

  it('parses approved Revenue Entry snapshots linked to the source batch', () => {
    const parsed = parseRevenueEntryDetailForTest({
      data: {
        id: 'revenue-entry-1',
        revenueEntryCode: 'REV-202606-00001',
        title: 'Approved platform revenue',
        subjectTalentId: 'talent-1',
        attributionPlatformAccountId: 'pa-1',
        attributionTalentGroupId: 'tg-1',
        attributionEmploymentProfileId: null,
        attributionEventId: null,
        revenueKind: 'PLATFORM_LIVESTREAM',
        entrySource: 'PLATFORM_EARNING_BATCH',
        sourceBatchIds: ['batch-1'],
        sourceSummaryRef: 'batch-1:monthly-summary',
        sourceLineCount: 2,
        sourceSummarySnapshot: {
          sourceKind: 'PLATFORM_EARNING_BATCH',
          sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
          sourceBatchIds: ['batch-1'],
          sourceSummaryRef: 'batch-1:monthly-summary',
          sourceLineCount: 2,
          periodMonth: '2026-06',
          sourceDateFrom: now,
          sourceDateTo: now,
          platform: 'TIKTOK',
          platformAccountId: 'pa-1',
          talentGroupId: 'tg-1',
          memberTalentIds: ['talent-1', 'talent-2'],
          memberEmploymentProfileIds: ['ep-1', 'ep-2'],
          eventIds: [],
          sourceUnit: 'DIAMOND',
          rawQuantityTotal: 2400,
          sourceFingerprint: 'fingerprint',
          approvedAt: now,
          approvedByActorId: 'finance-approver',
        },
        conversionSnapshot: approvedBatch().conversionSnapshot,
        platformCutSnapshot: approvedBatch().platformCutSnapshot,
        commissionableBasisSnapshot: {
          basisType: 'COMPANY_NET',
          amount: 168000,
          currencyCode: 'VND',
          appliedByActorId: 'finance-approver',
          appliedAt: now,
          sourceNote: null,
        },
        status: 'DRAFT',
        currencyCode: 'VND',
        recognizedAmount: 168000,
        recognizedAt: now,
        finalizedAt: null,
        reconciledAt: null,
        voidedAt: null,
        reconciliationReference: null,
        description: null,
        externalRef: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    expect(parsed.sourceBatchIds).toEqual(['batch-1']);
    expect(parsed.commissionableBasisSnapshot?.amount).toBe(168000);
  });

  it('matches backend lifecycle state gates exactly', () => {
    expect(actions('SUBMITTED')).toMatchObject({
      startReview: true,
      reject: true,
      void: true,
      archive: false,
    });
    expect(actions('REJECTED')).toMatchObject({
      reject: false,
      void: false,
      archive: true,
    });
    expect(actions('APPROVED')).toMatchObject({
      void: true,
      archive: true,
      createRevenueEntry: true,
    });
  });

  it('accepts Manager list null cursor without exposing Finance-only batch fields', () => {
    const parsed = parseManagerPlatformEarningBatchListForTest({
      data: {
        items: [
          {
            id: 'manager-batch',
            batchCode: 'RLEB-202606-00001',
            platform: 'TIKTOK',
            platformAccountId: 'pa-1',
            talentGroupId: 'tg-1',
            sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
            sourceUnit: 'DIAMOND',
            periodMonth: '2026-06',
            sourceDateFrom: now,
            sourceDateTo: now,
            status: 'SUBMITTED',
            sourceLineCount: 1,
            rawQuantityTotal: 100,
            submittedAt: now,
            rejectedAt: null,
            rejectionReason: null,
            voidedAt: null,
            voidReason: null,
            approvedAt: null,
            revenueEntryLinked: false,
            createdAt: now,
            updatedAt: now,
          },
        ],
        nextCursor: null,
      },
    });

    expect(parsed.nextCursor).toBeUndefined();
    expect(parsed.items[0]).not.toHaveProperty('conversionSnapshot');
    expect(parsed.items[0]).not.toHaveProperty('approvedByActorId');
  });

  it('contains the required Admin and Manager money-boundary copy', async () => {
    await setLocale('en');
    expect(i18n.t('revenue-ledger:platformEarnings.boundaryHelper')).toMatch(
      /commission.*payment.*payroll.*tax.*accounting/i,
    );
    expect(i18n.t('manager-workspace:revenue.boundaryHelper')).toMatch(
      /not revenue approval.*commission.*payment.*payroll.*tax.*accounting/i,
    );
  });
});

function actions(status: PlatformEarningBatch['status']) {
  return getPlatformEarningActionAvailabilityForTest({
    ...approvedBatch(),
    status,
    revenueEntryId: null,
  });
}

function approvedBatch(): PlatformEarningBatch {
  return {
    id: 'batch-1',
    batchCode: 'RLEB-202606-00001',
    platform: 'TIKTOK',
    platformAccountId: 'pa-1',
    talentGroupId: 'tg-1',
    sourceType: 'TIKTOK_LIVESTREAM_DIAMOND',
    sourceUnit: 'DIAMOND',
    periodMonth: '2026-06',
    sourceDateFrom: now,
    sourceDateTo: now,
    status: 'APPROVED',
    sourceLineCount: 2,
    rawQuantityTotal: 2400,
    conversionSnapshot: {
      sourceUnit: 'DIAMOND',
      rawQuantity: 2400,
      targetCurrency: 'VND',
      appliedRate: 100,
      rateType: 'FINANCE_APPROVED',
      rateEffectiveFrom: null,
      rateEffectiveTo: null,
      grossConvertedAmount: 240000,
      ruleRef: 'conversion-rule',
      appliedByActorId: 'finance-approver',
      appliedAt: now,
      sourceNote: null,
    },
    platformCutSnapshot: {
      platformCutRate: 0.3,
      companyShareRate: 0.7,
      grossConvertedAmount: 240000,
      platformCutAmount: 72000,
      companyNetAmount: 168000,
      targetCurrency: 'VND',
      ruleRef: 'cut-rule',
      appliedByActorId: 'finance-approver',
      appliedAt: now,
      sourceNote: null,
    },
    companyNetAmount: 168000,
    commissionableBasisAmount: 168000,
    submittedByActorId: 'manager',
    submittedAt: now,
    reviewedByActorId: 'finance-reviewer',
    reviewedAt: now,
    approvedByActorId: 'finance-approver',
    approvedAt: now,
    rejectedByActorId: null,
    rejectedAt: null,
    rejectionReason: null,
    voidedByActorId: null,
    voidedAt: null,
    voidReason: null,
    archivedByActorId: null,
    archivedAt: null,
    sourceFingerprint: 'fingerprint',
    revenueEntryId: null,
    revenueEntryCreatedByActorId: null,
    revenueEntryCreatedAt: null,
    createdByActorId: 'manager',
    createdAt: now,
    updatedAt: now,
  };
}
