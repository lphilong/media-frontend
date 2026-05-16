import { expect, test } from '@playwright/test';

type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'ARCHIVED';
type ContractKind = 'EMPLOYMENT' | 'TALENT_SERVICE' | 'TALENT_MANAGEMENT';
type LinkedEntityKind = 'EMPLOYMENT_PROFILE' | 'TALENT';

type ContractRecord = {
  id: string;
  contractCode: string;
  title: string;
  contractKind: ContractKind;
  linkedEntityKind: LinkedEntityKind;
  linkedEmploymentProfileId: string | null;
  linkedTalentId: string | null;
  ownerEmploymentProfileId: string;
  confidentialityTier: 'STANDARD' | 'CONFIDENTIAL' | 'RESTRICTED';
  status: ContractStatus;
  effectiveStartDate: number;
  effectiveEndDate: number | null;
  fileReferenceId: string | null;
  fileDisplayName: string | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

const toListItem = (record: ContractRecord) => ({
  id: record.id,
  contractCode: record.contractCode,
  title: record.title,
  contractKind: record.contractKind,
  linkedEntityKind: record.linkedEntityKind,
  linkedEmploymentProfileId: record.linkedEmploymentProfileId,
  linkedTalentId: record.linkedTalentId,
  ownerEmploymentProfileId: record.ownerEmploymentProfileId,
  confidentialityTier: record.confidentialityTier,
  status: record.status,
  effectiveStartDate: record.effectiveStartDate,
  effectiveEndDate: record.effectiveEndDate,
  createdAt: record.createdAt,
});

const toDetail = (record: ContractRecord) => ({
  ...toListItem(record),
  fileReferenceId: record.fileReferenceId,
  fileDisplayName: record.fileDisplayName,
  description: record.description,
  externalRef: record.externalRef,
  updatedAt: record.updatedAt,
});

const generatedYearCode = (prefix: string, dateSource: unknown, seed: number): string => {
  const date =
    typeof dateSource === 'string'
      ? new Date(`${dateSource}T00:00:00.000Z`)
      : typeof dateSource === 'number'
        ? new Date(dateSource)
        : undefined;
  const year = date && Number.isFinite(date.getTime()) ? date.getUTCFullYear() : 2026;
  return `${prefix}-${year}-${String(seed).padStart(6, '0')}`;
};

test('wave 7 contract-registry critical flow: create, open detail, update owner', async ({
  page,
}) => {
  let contractCounter = 80;
  const now = Date.parse('2026-04-22T00:00:00.000Z');
  const contracts: ContractRecord[] = [
    {
      id: 'contract-record-001',
      contractCode: 'CON-2026-000001',
      title: 'Alice employment contract',
      contractKind: 'EMPLOYMENT',
      linkedEntityKind: 'EMPLOYMENT_PROFILE',
      linkedEmploymentProfileId: 'ep-001',
      linkedTalentId: null,
      ownerEmploymentProfileId: 'ep-001',
      confidentialityTier: 'CONFIDENTIAL',
      status: 'DRAFT',
      effectiveStartDate: now,
      effectiveEndDate: null,
      fileReferenceId: null,
      fileDisplayName: null,
      description: null,
      externalRef: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await page.route('**/admin/employment-profiles**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET' && url.pathname.endsWith('/admin/employment-profiles')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'ep-001',
              employeeCode: 'EP-000001',
              legalName: 'Alice Nguyen',
              displayName: 'Alice',
              employmentKind: 'FULL_TIME',
              jobTitle: 'Producer',
              orgUnitId: 'org-001',
              employmentStatus: 'ACTIVE',
              contractStatus: 'ACTIVE',
              createdAt: now,
            },
            {
              id: 'ep-002',
              employeeCode: 'EP-000002',
              legalName: 'Bao Tran',
              displayName: 'Bao',
              employmentKind: 'FULL_TIME',
              jobTitle: 'Legal owner',
              orgUnitId: 'org-001',
              employmentStatus: 'ACTIVE',
              contractStatus: 'ACTIVE',
              createdAt: now,
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
    const pathname = url.pathname;

    if (method === 'GET' && pathname.endsWith('/admin/contract-records')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: contracts.filter((item) => item.status !== 'ARCHIVED').map(toListItem),
        }),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/admin/contract-records')) {
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      contractCounter += 1;
      const nextContract: ContractRecord = {
        id: `contract-record-${contractCounter}`,
        contractCode: String(
          payload.contractCode ??
            generatedYearCode('CON', payload.effectiveStartDate, contractCounter),
        ),
        title: String(payload.title ?? `Contract ${contractCounter}`),
        contractKind: String(payload.contractKind ?? 'EMPLOYMENT') as ContractKind,
        linkedEntityKind: String(
          payload.linkedEntityKind ?? 'EMPLOYMENT_PROFILE',
        ) as LinkedEntityKind,
        linkedEmploymentProfileId:
          typeof payload.linkedEmploymentProfileId === 'string'
            ? payload.linkedEmploymentProfileId
            : null,
        linkedTalentId: typeof payload.linkedTalentId === 'string' ? payload.linkedTalentId : null,
        ownerEmploymentProfileId: String(payload.ownerEmploymentProfileId ?? 'ep-001'),
        confidentialityTier: 'CONFIDENTIAL',
        status: 'DRAFT',
        effectiveStartDate: Date.parse(`${String(payload.effectiveStartDate)}T00:00:00.000Z`),
        effectiveEndDate: null,
        fileReferenceId:
          typeof payload.fileReferenceId === 'string' ? payload.fileReferenceId : null,
        fileDisplayName:
          typeof payload.fileDisplayName === 'string' ? payload.fileDisplayName : null,
        description: typeof payload.description === 'string' ? payload.description : null,
        externalRef: typeof payload.externalRef === 'string' ? payload.externalRef : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      contracts.unshift(nextContract);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(nextContract) }),
      });
      return;
    }

    const ownerMatch = pathname.match(/\/admin\/contract-records\/([^/]+)\/assign-owner$/);
    if (method === 'POST' && ownerMatch) {
      const record = contracts.find((item) => item.id === ownerMatch[1]);
      const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'errors:notFound.message' }),
        });
        return;
      }
      record.ownerEmploymentProfileId = String(payload.newOwnerEmploymentProfileId ?? 'ep-002');
      record.updatedAt = Date.now();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: toDetail(record) }),
      });
      return;
    }

    const detailMatch = pathname.match(/\/admin\/contract-records\/([^/]+)$/);
    if (method === 'GET' && detailMatch) {
      const record = contracts.find((item) => item.id === detailMatch[1]);
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
        body: JSON.stringify({ data: toDetail(record) }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/contract-records');
  await page.locator('select').first().selectOption('en');

  await expect(page.getByRole('heading', { name: 'Contract Registry' })).toBeVisible();
  await page.getByRole('button', { name: 'Create contract' }).click();

  const createSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Create contract record' }) })
    .first();

  await expect(createSurface.getByLabel('Contract code')).toHaveCount(0);
  await expect(
    createSurface.getByText('Contract code will be generated by the system after create.'),
  ).toBeVisible();
  await createSurface.getByLabel('Title').fill('Wave 7 contract');
  await createSurface
    .locator('[data-picker-id="contract-linked-entity"]')
    .getByRole('button', { name: /Alice/ })
    .click();
  await createSurface
    .locator('[data-picker-id="contract-owner-employment-profile"]')
    .getByRole('button', { name: /Alice/ })
    .click();
  await createSurface.getByLabel('Effective start date').fill('2026-01-01');
  await createSurface.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('CON-2026-000081')).toBeVisible();
  await page
    .locator('tr', { hasText: 'CON-2026-000081' })
    .getByRole('button', { name: 'Open detail' })
    .click();

  await expect(page).toHaveURL(/\/contract-records\/contract-record-\d+$/);
  await expect(page.getByText('Contract actions')).toBeVisible();
  await page.getByRole('button', { name: 'Assign owner' }).click();
  const assignOwnerSurface = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Assign owner' }) })
    .first();
  await assignOwnerSurface
    .locator('[data-picker-id="contract-new-owner-employment-profile"]')
    .getByRole('button', { name: /Bao/ })
    .click();
  await assignOwnerSurface.getByRole('button', { name: 'Assign owner' }).click();

  await expect(page.getByText('ep-002')).toBeVisible();
});
