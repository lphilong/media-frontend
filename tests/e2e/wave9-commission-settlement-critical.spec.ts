import { expect, test } from '@playwright/test';

type CommissionSettlementStatus = 'DRAFT' | 'FINALIZED' | 'VOIDED' | 'ARCHIVED';

type CommissionSettlementRecord = {
  id: string;
  settlementCode: string;
  title: string;
  sourceRuleId: string;
  sourceContractRecordIdSnapshot: string;
  settlementKindSnapshot: 'REVENUE_SHARE';
  beneficiaryKindSnapshot: 'TALENT';
  beneficiaryEmploymentProfileIdSnapshot: null;
  beneficiaryTalentIdSnapshot: string;
  subjectTalentId: string;
  settlementBasisSnapshot: 'RECOGNIZED_GROSS_REVENUE';
  ratePercentSnapshot: number;
  revenueEntryIds: string[];
  settlementPeriodStartAt: number;
  settlementPeriodEndAt: number;
  settlementCurrencyCode: string;
  grossRevenueAmount: number;
  settlementAmount: number;
  status: CommissionSettlementStatus;
  finalizedAt: number | null;
  voidedAt: number | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type CommissionSettlementLineRecord = {
  id: string;
  revenueEntryId: string;
  revenueEntryCodeSnapshot: string;
  revenueKindSnapshot: 'PLATFORM_LIVESTREAM';
  revenueCurrencyCodeSnapshot: string;
  revenueRecognizedAmountSnapshot: number;
  revenueRecognizedAtSnapshot: number;
  lineSettlementAmount: number;
};

const toSettlementListItem = (record: CommissionSettlementRecord) => ({
  id: record.id,
  settlementCode: record.settlementCode,
  title: record.title,
  sourceRuleId: record.sourceRuleId,
  settlementKindSnapshot: record.settlementKindSnapshot,
  beneficiaryKindSnapshot: record.beneficiaryKindSnapshot,
  beneficiaryEmploymentProfileIdSnapshot: record.beneficiaryEmploymentProfileIdSnapshot,
  beneficiaryTalentIdSnapshot: record.beneficiaryTalentIdSnapshot,
  subjectTalentId: record.subjectTalentId,
  settlementCurrencyCode: record.settlementCurrencyCode,
  grossRevenueAmount: record.grossRevenueAmount,
  settlementAmount: record.settlementAmount,
  status: record.status,
  settlementPeriodStartAt: record.settlementPeriodStartAt,
  settlementPeriodEndAt: record.settlementPeriodEndAt,
  finalizedAt: record.finalizedAt,
  createdAt: record.createdAt,
});

const buildLines = (record: CommissionSettlementRecord): CommissionSettlementLineRecord[] =>
  record.revenueEntryIds.map((revenueEntryId, index) => ({
    id: `${record.id}-line-${index + 1}`,
    revenueEntryId,
    revenueEntryCodeSnapshot: revenueEntryId.toUpperCase().replace(/-/g, '_'),
    revenueKindSnapshot: 'PLATFORM_LIVESTREAM',
    revenueCurrencyCodeSnapshot: record.settlementCurrencyCode,
    revenueRecognizedAmountSnapshot: record.grossRevenueAmount / record.revenueEntryIds.length,
    revenueRecognizedAtSnapshot: Date.now(),
    lineSettlementAmount: record.settlementAmount / record.revenueEntryIds.length,
  }));

const generatedSettlementCode = (periodStartAt: number, counter: number): string => {
  const date = new Date(periodStartAt);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `CS-${year}${month}-${String(counter).padStart(6, '0')}`;
};

test('wave 9 Commission Settlement critical flow: create, open detail, finalize', async ({
  page,
}) => {
  let settlementCounter = 900;
  const periodStart = 1735689600000;
  const periodEnd = 1735776000000;
  const settlements: CommissionSettlementRecord[] = [];
  const linesBySettlementId = new Map<string, CommissionSettlementLineRecord[]>();

  await page.route('**/admin/commission/rules**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/commission/rules')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'commission-rule-001',
              ruleCode: 'CRULE-000001',
              title: 'April livestream revenue share',
              settlementKind: 'REVENUE_SHARE',
              beneficiaryKind: 'TALENT',
              beneficiaryEmploymentProfileId: null,
              beneficiaryTalentId: 'talent-001',
              sourceContractRecordId: 'contract-record-001',
              ratePercent: 12.5,
              status: 'ACTIVE',
              effectiveStartDate: periodStart,
              effectiveEndDate: null,
              createdAt: Date.now(),
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/admin/revenue-entries**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/revenue-entries')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'revenue-entry-001',
              revenueEntryCode: 'REV-202501-000001',
              title: 'April livestream revenue',
              subjectTalentId: 'talent-001',
              attributionPlatformAccountId: 'platform-001',
              attributionEventId: null,
              revenueKind: 'PLATFORM_LIVESTREAM',
              entrySource: 'MANUAL',
              status: 'FINALIZED',
              currencyCode: 'VND',
              recognizedAmount: 1000000,
              recognizedAt: periodStart,
              createdAt: Date.now(),
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/admin/commission/settlements**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/commission/settlements')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: settlements.filter((item) => item.status !== 'ARCHIVED').map(toSettlementListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/commission/settlements')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      expect(payload.settlementCode).toBeUndefined();
      settlementCounter += 1;
      const revenueEntryIds = Array.isArray(payload.revenueEntryIds)
        ? payload.revenueEntryIds.map(String)
        : ['revenue-entry-001'];
      const grossRevenueAmount = 1000000;
      const record: CommissionSettlementRecord = {
        id: `commission-settlement-${settlementCounter}`,
        settlementCode: generatedSettlementCode(
          Number(payload.settlementPeriodStartAt ?? periodStart),
          settlementCounter,
        ),
        title: String(payload.title ?? `Settlement ${settlementCounter}`),
        sourceRuleId: String(payload.sourceRuleId ?? 'commission-rule-001'),
        sourceContractRecordIdSnapshot: 'contract-record-001',
        settlementKindSnapshot: 'REVENUE_SHARE',
        beneficiaryKindSnapshot: 'TALENT',
        beneficiaryEmploymentProfileIdSnapshot: null,
        beneficiaryTalentIdSnapshot: 'talent-001',
        subjectTalentId: 'talent-001',
        settlementBasisSnapshot: 'RECOGNIZED_GROSS_REVENUE',
        ratePercentSnapshot: 12.5,
        revenueEntryIds,
        settlementPeriodStartAt: Number(payload.settlementPeriodStartAt ?? periodStart),
        settlementPeriodEndAt: Number(payload.settlementPeriodEndAt ?? periodEnd),
        settlementCurrencyCode: 'VND',
        grossRevenueAmount,
        settlementAmount: 125000,
        status: 'DRAFT',
        finalizedAt: null,
        voidedAt: null,
        description: typeof payload.description === 'string' ? payload.description : null,
        externalRef: typeof payload.externalRef === 'string' ? payload.externalRef : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      settlements.unshift(record);
      linesBySettlementId.set(record.id, buildLines(record));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    const linesMatch = pathname.match(/\/admin\/commission\/settlements\/([^/]+)\/lines$/);
    if (method === 'GET' && linesMatch) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: linesBySettlementId.get(linesMatch[1]) ?? [] }),
      });
      return;
    }

    const finalizeMatch = pathname.match(/\/admin\/commission\/settlements\/([^/]+)\/finalize$/);
    if (method === 'POST' && finalizeMatch) {
      const record = settlements.find((item) => item.id === finalizeMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }
      record.status = 'FINALIZED';
      record.finalizedAt = Date.now();
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/commission\/settlements\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const record = settlements.find((item) => item.id === detailMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/commission/settlements');
  await expect(page.getByRole('heading', { name: 'Commission Settlements' })).toBeVisible();
  await page.getByRole('button', { name: 'Create commission settlement' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create commission settlement' }) })
    .first();

  await expect(createSurface.getByLabel('Settlement code')).toHaveCount(0);
  await expect(
    createSurface.getByText('Code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Title').fill('Wave 9 settlement');
  await createSurface.getByRole('button', { name: /April livestream revenue share/ }).click();
  await createSurface.getByLabel('Settlement period start timestamp').fill(String(periodStart));
  await createSurface.getByLabel('Settlement period end timestamp').fill(String(periodEnd));
  await createSurface
    .locator('[data-picker-id="commission-settlement-revenue-entry-0"]')
    .getByRole('button', { name: /April livestream revenue/ })
    .click();
  await createSurface.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('CS-202501-000901')).toBeVisible();
  await page
    .locator('tr', { hasText: 'CS-202501-000901' })
    .getByRole('button', { name: 'Open' })
    .click();

  await expect(page).toHaveURL(/\/commission\/settlements\/commission-settlement-\d+$/);
  await expect(page.getByText('Commission settlement actions')).toBeVisible();
  await expect(page.getByText('Read-only settlement lines').first()).toBeVisible();
  await expect(page.getByText('REVENUE_ENTRY_001')).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit line/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Finalize' }).click();
  await page.getByRole('button', { name: /Confirm/ }).click();

  await expect(page.getByText('Finalized').first()).toBeVisible();
});
