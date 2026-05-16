import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createRevenueEntry,
  fetchRevenueEntries,
  fetchRevenueEntriesByPlatform,
  performRevenueEntryLifecycleAction,
  reconcileRevenueEntry,
  updateRevenueEntryDraftCore,
} from '@modules/revenue-ledger/api/revenue-ledger.api';
import { createRevenueLedgerActionRailItems } from '@modules/revenue-ledger/actions/revenue-ledger-action-rail';
import {
  RevenueEntryCreateSurface,
  RevenueEntryReconcileSurface,
} from '@modules/revenue-ledger/forms/revenue-ledger-mutation-forms';
import type { RevenueEntryRecord } from '@modules/revenue-ledger/types/revenue-ledger.types';
import { apiRequest } from '@shared/api';
import { setLocale } from '@shared/i18n/i18n';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadTalentReferenceOptions: vi.fn(async () => [
    { id: 'talent-001', label: 'Talent One - TAL-000001' },
  ]),
  loadPlatformAccountReferenceOptions: vi.fn(async () => [
    { id: 'platform-001', label: 'Platform One - PLA001' },
  ]),
  loadEventReferenceOptions: vi.fn(async () => [
    { id: 'event-001', label: 'Event One - EVT-202605-000001' },
  ]),
}));

const now = Date.parse('2026-04-22T00:00:00.000Z');

const revenueDetail: RevenueEntryRecord = {
  id: 'revenue-entry-001',
  revenueEntryCode: 'REV-202604-000001',
  title: 'April revenue',
  subjectTalentId: 'talent-001',
  attributionPlatformAccountId: 'platform-001',
  attributionEventId: null,
  revenueKind: 'PLATFORM_LIVESTREAM',
  entrySource: 'MANUAL',
  status: 'DRAFT',
  currencyCode: 'VND',
  recognizedAmount: 100,
  recognizedAt: now,
  finalizedAt: null,
  reconciledAt: null,
  voidedAt: null,
  reconciliationReference: null,
  description: null,
  externalRef: null,
  createdAt: now - 1000,
  updatedAt: now,
};

describe('Revenue Ledger Wave 8 payloads and lifecycle seams', () => {
  const mockedApiRequest = vi.mocked(apiRequest);

  afterEach(() => {
    mockedApiRequest.mockReset();
  });

  it('validates attribution, currency, and amount rules before submit', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<RevenueEntryCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />);

    expect(
      screen.queryByLabelText(i18n.t('revenue-ledger:fields.revenueEntryCode')),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('revenue-ledger:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('revenue-ledger:fields.title')), 'Bad revenue');
    await user.click(await screen.findByRole('button', { name: /Talent One/ }));
    await user.clear(screen.getByLabelText(i18n.t('revenue-ledger:fields.currencyCode')));
    await user.type(screen.getByLabelText(i18n.t('revenue-ledger:fields.currencyCode')), 'usd');
    await user.type(screen.getByLabelText(i18n.t('revenue-ledger:fields.recognizedAmount')), '0');
    await user.type(screen.getByLabelText(i18n.t('revenue-ledger:fields.recognizedAt')), '1000');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('revenue-ledger:mutations.create.submit'),
      }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t('revenue-ledger:validation.invalidCurrency')),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('revenue-ledger:validation.invalidAmount'))).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('revenue-ledger:validation.attributionPlatformRequired')),
    ).toBeInTheDocument();
  });

  it('submits reconcile as its own optional-reference action surface', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <RevenueEntryReconcileSurface
        initialReconciliationReference={null}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('revenue-ledger:mutations.reconcile.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({ reconciliationReference: null });
  });

  it('sends exact API payloads without scope fields or unsupported reconcile keys', async () => {
    mockedApiRequest.mockResolvedValue({ data: revenueDetail });

    await createRevenueEntry({
      title: 'API revenue',
      subjectTalentId: 'talent-001',
      attributionPlatformAccountId: 'platform-001',
      attributionEventId: undefined,
      revenueKind: 'PLATFORM_LIVESTREAM',
      entrySource: 'MANUAL',
      currencyCode: 'VND',
      recognizedAmount: 100,
      recognizedAt: 1000,
      description: undefined,
      externalRef: null,
    });
    await updateRevenueEntryDraftCore('revenue-entry-001', {
      title: 'Updated revenue',
      subjectTalentId: 'talent-001',
      attributionPlatformAccountId: null,
      attributionEventId: null,
      revenueKind: 'PLATFORM_CONTENT',
      currencyCode: 'USD',
      recognizedAmount: 12.5,
      recognizedAt: 1000,
      description: null,
      externalRef: null,
    });
    await reconcileRevenueEntry('revenue-entry-001', { reconciliationReference: null });
    await performRevenueEntryLifecycleAction('revenue-entry-001', 'void');

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: '/admin/revenue-entries',
      data: {
        title: 'API revenue',
        subjectTalentId: 'talent-001',
        attributionPlatformAccountId: 'platform-001',
        attributionEventId: null,
        revenueKind: 'PLATFORM_LIVESTREAM',
        entrySource: 'MANUAL',
        currencyCode: 'VND',
        recognizedAmount: 100,
        recognizedAt: 1000,
        description: null,
        externalRef: null,
      },
    });
    expect(mockedApiRequest.mock.calls[0]?.[0].data).not.toHaveProperty('revenueEntryCode');
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, {
      method: 'POST',
      url: '/admin/revenue-entries/revenue-entry-001/reconcile',
      data: {},
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(4, {
      method: 'POST',
      url: '/admin/revenue-entries/revenue-entry-001/void',
      data: {},
    });
    expect(mockedApiRequest.mock.calls[1]?.[0].data).not.toHaveProperty('revenueEntryCode');
  });

  it('never sends scope, scopeGrants, or related-search from Revenue Ledger query builders', async () => {
    mockedApiRequest.mockResolvedValue({ data: [], meta: {} });

    await fetchRevenueEntries({
      subjectTalentId: 'talent-001',
      search: 'REV-202604-000001',
      scope: 'global',
      scopeGrants: 'x',
    } as never);
    await fetchRevenueEntriesByPlatform({
      view: 'by-platform',
      attributionPlatformAccountId: 'platform-001',
      search: 'not-supported',
      scope: 'global',
      scopeGrants: 'x',
    } as never);

    expect(mockedApiRequest.mock.calls[0]?.[0].params).toMatchObject({
      subjectTalentId: 'talent-001',
      search: 'REV-202604-000001',
    });
    expect(mockedApiRequest.mock.calls[0]?.[0].params).not.toHaveProperty('scope');
    expect(mockedApiRequest.mock.calls[0]?.[0].params).not.toHaveProperty('scopeGrants');
    expect(mockedApiRequest.mock.calls[1]?.[0].params).toMatchObject({
      attributionPlatformAccountId: 'platform-001',
    });
    expect(mockedApiRequest.mock.calls[1]?.[0].params).not.toHaveProperty('search');
    expect(mockedApiRequest.mock.calls[1]?.[0].params).not.toHaveProperty('scope');
    expect(mockedApiRequest.mock.calls[1]?.[0].params).not.toHaveProperty('scopeGrants');
  });

  it('gates lifecycle actions and omits unsupported reopen, unvoid, delete, and bulk ids', async () => {
    await setLocale('en');
    const handlers = {
      onDraftCoreEdit: vi.fn(),
      onReconcile: vi.fn(),
      onLifecycleAction: vi.fn(),
    };

    const draftItems = createRevenueLedgerActionRailItems(i18n.t, revenueDetail, handlers);
    const finalizedItems = createRevenueLedgerActionRailItems(
      i18n.t,
      { ...revenueDetail, status: 'FINALIZED' },
      handlers,
    );
    const archivedItems = createRevenueLedgerActionRailItems(
      i18n.t,
      { ...revenueDetail, status: 'ARCHIVED' },
      handlers,
    );

    expect(draftItems.map((item) => item.id)).toEqual([
      'draft-core',
      'finalize',
      'reconcile',
      'void',
      'archive',
    ]);
    expect(finalizedItems.find((item) => item.id === 'reconcile')?.disabled).toBe(false);
    expect(archivedItems.every((item) => item.disabled)).toBe(true);
    expect(
      draftItems.some((item) => ['delete', 'bulk', 'reopen', 'unvoid'].includes(item.id)),
    ).toBe(false);
  });
});
