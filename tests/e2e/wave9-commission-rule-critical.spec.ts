import { expect, test } from '@playwright/test';

type CommissionRuleStatus = 'DRAFT' | 'INACTIVE' | 'ACTIVE' | 'ARCHIVED';

type CommissionRuleRecord = {
  id: string;
  ruleCode: string;
  title: string;
  settlementKind: 'REVENUE_SHARE';
  beneficiaryKind: 'TALENT';
  beneficiaryEmploymentProfileId: null;
  beneficiaryTalentId: string;
  sourceContractRecordId: string;
  settlementBasis: 'RECOGNIZED_GROSS_REVENUE';
  ratePercent: number;
  appliesToRevenueKinds: ['PLATFORM_LIVESTREAM'];
  status: CommissionRuleStatus;
  effectiveStartDate: number;
  effectiveEndDate: number | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

const toRuleListItem = (record: CommissionRuleRecord) => ({
  id: record.id,
  ruleCode: record.ruleCode,
  title: record.title,
  settlementKind: record.settlementKind,
  beneficiaryKind: record.beneficiaryKind,
  beneficiaryEmploymentProfileId: record.beneficiaryEmploymentProfileId,
  beneficiaryTalentId: record.beneficiaryTalentId,
  sourceContractRecordId: record.sourceContractRecordId,
  ratePercent: record.ratePercent,
  status: record.status,
  effectiveStartDate: record.effectiveStartDate,
  effectiveEndDate: record.effectiveEndDate,
  createdAt: record.createdAt,
});

test('wave 9 Commission Rule critical flow: create, open detail, activate', async ({ page }) => {
  let ruleCounter = 900;
  const utcMidnight = 1735689600000;
  const rules: CommissionRuleRecord[] = [];

  await page.route('**/admin/talents**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/talents')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'talent-001',
              talentCode: 'TAL-000001',
              stageName: 'Mina',
              legalName: 'Mina Le',
              displayShortName: 'Mina',
              talentOrigin: 'EXTERNAL',
              operationalStatus: 'ACTIVE',
              commercialParticipationStatus: 'ALLOWED',
              livestreamEligible: true,
              eventEligible: true,
              createdAt: utcMidnight,
              updatedAt: utcMidnight,
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/admin/contract-records**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/contract-records')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'contract-record-001',
              contractCode: 'CON-2025-000001',
              title: 'Talent contract',
              contractKind: 'TALENT_SERVICE',
              linkedEntityKind: 'TALENT',
              linkedEmploymentProfileId: null,
              linkedTalentId: 'talent-001',
              ownerEmploymentProfileId: 'ep-001',
              confidentialityTier: 'CONFIDENTIAL',
              status: 'ACTIVE',
              effectiveStartDate: utcMidnight,
              effectiveEndDate: null,
              createdAt: utcMidnight,
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/admin/commission/rules**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/commission/rules')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: rules.filter((item) => item.status !== 'ARCHIVED').map(toRuleListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/commission/rules')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      expect(payload.ruleCode).toBeUndefined();
      ruleCounter += 1;
      const record: CommissionRuleRecord = {
        id: `commission-rule-${ruleCounter}`,
        ruleCode: `CRULE-${String(ruleCounter).padStart(6, '0')}`,
        title: String(payload.title ?? `Rule ${ruleCounter}`),
        settlementKind: 'REVENUE_SHARE',
        beneficiaryKind: 'TALENT',
        beneficiaryEmploymentProfileId: null,
        beneficiaryTalentId: String(payload.beneficiaryTalentId ?? 'talent-001'),
        sourceContractRecordId: String(payload.sourceContractRecordId ?? 'contract-record-001'),
        settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
        ratePercent: Number(payload.ratePercent ?? 10),
        appliesToRevenueKinds: ['PLATFORM_LIVESTREAM'],
        status: 'DRAFT',
        effectiveStartDate: Number(payload.effectiveStartDate ?? utcMidnight),
        effectiveEndDate:
          typeof payload.effectiveEndDate === 'number' ? payload.effectiveEndDate : null,
        description: typeof payload.description === 'string' ? payload.description : null,
        externalRef: typeof payload.externalRef === 'string' ? payload.externalRef : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      rules.unshift(record);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    const activateMatch = pathname.match(/\/admin\/commission\/rules\/([^/]+)\/activate$/);
    if (method === 'POST' && activateMatch) {
      const record = rules.find((item) => item.id === activateMatch[1]);
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }
      record.status = 'ACTIVE';
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: record }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/commission\/rules\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const record = rules.find((item) => item.id === detailMatch[1]);
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

  await page.goto('/commission/rules');
  await expect(page.getByRole('heading', { name: 'Commission Rules' })).toBeVisible();
  await page.getByRole('button', { name: 'Create commission rule' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create commission rule' }) })
    .first();

  await expect(createSurface.getByLabel('Rule code')).toHaveCount(0);
  await expect(
    createSurface.getByText('Code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Title').fill('Wave 9 rule');
  await createSurface
    .locator('[data-picker-id="commission-rule-beneficiary-talent"]')
    .getByRole('button', { name: /Mina/ })
    .click();
  await createSurface
    .locator('[data-picker-id="commission-rule-source-contract"]')
    .getByRole('button', { name: /Talent contract/ })
    .click();
  await createSurface.getByLabel('Rate percent').fill('12.5');
  await createSurface.getByLabel('Effective start date').fill(String(utcMidnight));
  await createSurface.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('CRULE-000901')).toBeVisible();
  await page
    .locator('tr', { hasText: 'CRULE-000901' })
    .getByRole('button', { name: 'Open' })
    .click();

  await expect(page).toHaveURL(/\/commission\/rules\/commission-rule-\d+$/);
  await expect(page.getByText('Commission rule actions')).toBeVisible();
  await page.getByRole('button', { name: 'Activate', exact: true }).click();
  await page.getByRole('button', { name: /Confirm/ }).click();

  await expect(page.getByText('Active').first()).toBeVisible();
});
