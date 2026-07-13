import i18n from 'i18next';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import {
  sanitizeCommissionRuleCreatePayload,
  sanitizeCommissionRuleDraftCorePayload,
  sanitizeCommissionSettlementCreatePayload,
  sanitizeCommissionSettlementDraftCorePayload,
} from '@modules/commission/api/commission.api';
import {
  CommissionRuleCreateSurface,
  CommissionSettlementCreateSurface,
  CommissionSettlementRevenueEntriesSurface,
} from '@modules/commission/forms/commission-mutation-forms';
import { formatVietnamTimestamp } from '@shared/formatting/formatters';
import { setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

vi.mock('@modules/employment-profile', async () => {
  const actual = await vi.importActual<typeof import('@modules/employment-profile')>(
    '@modules/employment-profile',
  );

  return {
    ...actual,
    loadEmploymentProfileReferenceOptions: vi.fn(async () => [
      { id: 'ep-001', label: 'Employee One - EP-000001' },
    ]),
  };
});

vi.mock('@modules/talent', async () => {
  const actual = await vi.importActual<typeof import('@modules/talent')>('@modules/talent');

  return {
    ...actual,
    loadTalentReferenceOptions: vi.fn(async (search: string) =>
      search === 'missing-reference'
        ? []
        : [{ id: 'talent-001', label: 'Talent One - TAL-000001' }],
    ),
  };
});

vi.mock('@modules/contract-registry', async () => {
  const actual = await vi.importActual<typeof import('@modules/contract-registry')>(
    '@modules/contract-registry',
  );

  return {
    ...actual,
    loadContractReferenceOptions: vi.fn(async () => [
      { id: 'contract-record-001', label: 'Contract One - CON-2026-000001' },
    ]),
  };
});

vi.mock('@modules/commission', async () => {
  const actual = await vi.importActual<typeof import('@modules/commission')>('@modules/commission');

  return {
    ...actual,
    loadCommissionRuleReferenceOptions: vi.fn(async () => [
      { id: 'commission-rule-001', label: 'Rule One - CRULE-000001' },
    ]),
  };
});

vi.mock('@modules/revenue-ledger', async () => {
  const actual =
    await vi.importActual<typeof import('@modules/revenue-ledger')>('@modules/revenue-ledger');

  return {
    ...actual,
    loadRevenueEntryReferenceOptions: vi.fn(async () => [
      { id: 'revenue-entry-001', label: 'Revenue One - REV-202604-000001' },
    ]),
  };
});

const renderRoute = async (path: string) => {
  await setLocale('en');
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

const expectUnsupportedCommercialControlsAbsent = (): void => {
  [
    /delete/i,
    /fixed amount/i,
    /bulk/i,
    /approval/i,
    /payout/i,
    /payroll/i,
    /unarchive/i,
    /reopen/i,
    /unvoid/i,
    /unfinalize/i,
    /edit line/i,
  ].forEach((name) => {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });
};

const expectSettlementFilterAbsent = (label: string): void => {
  expect(screen.queryByRole('textbox', { name: label })).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: label })).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton', { name: label })).not.toBeInTheDocument();
};

describe('commission Wave 9 pages', () => {
  it('keeps generated-code locale keys available for EN, VI, and ZH', async () => {
    for (const locale of ['en', 'vi', 'zh'] as const) {
      await setLocale(locale);
      expect(i18n.t('commission:generatedCode.label')).not.toBe('generatedCode.label');
      expect(i18n.t('commission:generatedCode.description')).not.toBe('generatedCode.description');
    }
  });

  it('renders the Commission Rules list from the rules list API', async () => {
    const user = userEvent.setup();
    await renderRoute('/commission/rules');

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:rules.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CRULE-000001', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('April livestream revenue share')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('commission:rules.table.beneficiaryId'))).toBeInTheDocument();
    expect(screen.getByText('Luna')).toBeInTheDocument();
    expect(screen.getAllByText('Alice employment contract').length).toBeGreaterThan(0);
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.noFiltersApplied'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expect(
      screen.getByRole('combobox', { name: i18n.t('commission:rules.filters.settlementKind') }),
    ).toBeInTheDocument();
    expectUnsupportedCommercialControlsAbsent();
  });

  it('renders Commission Rules applied chips and clears exact flat filter keys', async () => {
    const user = userEvent.setup();
    await renderRoute('/commission/rules?settlementKind=REVENUE_SHARE');

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:rules.title') }),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expect(
      screen.getByRole('combobox', { name: i18n.t('commission:rules.filters.settlementKind') }),
    ).toHaveValue('REVENUE_SHARE');
    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'commission:rules.filters.settlementKind',
        )}`,
      }),
    );
    expect(
      screen.getByRole('combobox', { name: i18n.t('commission:rules.filters.settlementKind') }),
    ).toHaveValue('');
  });

  it('clears stale Commission Rules selected reference labels when the option becomes unavailable', async () => {
    const user = userEvent.setup();
    await renderRoute('/commission/rules?beneficiaryTalentId=talent-001');

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:rules.title') }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));

    const appliedFilters = screen.getByLabelText(i18n.t('common:filters.appliedFilters'));
    expect(await within(appliedFilters).findByText(/Talent One - TAL-000001/)).toBeInTheDocument();

    await user.type(
      screen.getAllByPlaceholderText(i18n.t('commission:rules.placeholders.searchReference'))[1],
      'missing-reference',
    );

    await waitFor(() => {
      expect(appliedFilters).toHaveTextContent('Luna');
      expect(appliedFilters).not.toHaveTextContent('Talent One - TAL-000001');
    });
  });

  it('renders Commission Rule detail from the detail API and keeps archived rules read-only', async () => {
    await renderRoute('/commission/rules/commission-rule-001');

    expect(await screen.findByText('CRULE-000001')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('commission:rules.actionRail.title'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice employment contract' })).toHaveAttribute(
      'href',
      '/contract-records/contract-record-001',
    );
    expect(screen.getByRole('link', { name: 'Luna' })).toHaveAttribute(
      'href',
      '/talents/talent-001',
    );
    expect(screen.queryByText('contract-record-001')).not.toBeInTheDocument();
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: i18n.t('commission:rules.related.settlementsByRule') }),
    ).toHaveAttribute('href', '/commission/settlements?sourceRuleId=commission-rule-001');
    expectUnsupportedCommercialControlsAbsent();
  });

  it('renders archived Commission Rule detail as read-only', async () => {
    await renderRoute('/commission/rules/commission-rule-archived');

    expect(await screen.findByText('CRULE-999999')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('commission:rules.detail.archivedReadOnly')),
    ).toBeInTheDocument();
    const actionRail = screen
      .getByText(i18n.t('commission:rules.actionRail.title'))
      .closest('section');
    expect(actionRail).not.toBeNull();
    within(actionRail as HTMLElement)
      .getAllByRole('button')
      .forEach((button) => expect(button).toBeDisabled());
  });

  it('renders the Commission Settlements list from the settlements list API', async () => {
    await renderRoute('/commission/settlements');

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CS-202604-000001')).toBeInTheDocument();
    expect(screen.getByText('April livestream settlement')).toBeInTheDocument();
    expect(screen.getByText('April livestream revenue share')).toBeInTheDocument();
    expect(screen.getByText('Luna')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('commission:settlements.table.settlementAmount')),
    ).toBeInTheDocument();
    expectUnsupportedCommercialControlsAbsent();
  });

  it('keeps settlement target timestamp filters hidden but active through the flat-list URL', async () => {
    await renderRoute(
      '/commission/settlements?status=FINALIZED&createdBeforeAt=1780000000000&finalizedFromAt=1770000000000&finalizedToAt=1780000000000',
    );

    expect(await screen.findByText('CS-202604-000002')).toBeInTheDocument();
    expect(
      screen.getByText(`${i18n.t('commission:settlements.filters.createdBeforeAt')}:`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${i18n.t('commission:settlements.filters.finalizedFromAt')}:`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${i18n.t('commission:settlements.filters.finalizedToAt')}:`),
    ).toBeInTheDocument();
    expect(screen.getAllByText(formatVietnamTimestamp(1_780_000_000_000)).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(formatVietnamTimestamp(1_770_000_000_000)).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/1770000000000|1780000000000/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', {
        name: i18n.t('commission:settlements.filters.finalizedFromAt'),
      }),
    ).not.toBeInTheDocument();
  });

  it('exposes the documented flat-list filters on the Commission Settlements list', async () => {
    const user = userEvent.setup();
    await renderRoute('/commission/settlements');

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CS-202604-000001')).toBeInTheDocument();
    expect(
      screen.getAllByRole('textbox', { name: i18n.t('common:labels.search') }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('combobox', {
        name: i18n.t('commission:settlements.filters.status'),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expect(
      screen.getByRole('combobox', {
        name: i18n.t('commission:settlements.filters.beneficiaryKindSnapshot'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        i18n.t('commission:settlements.filters.beneficiaryEmploymentProfileIdSnapshot'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('commission:settlements.filters.beneficiaryTalentIdSnapshot')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('commission:settlements.filters.subjectTalentId')),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('commission:settlements.filters.sourceRuleId')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(i18n.t('commission:settlements.filters.containsRevenueEntryId')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', {
        name: i18n.t('commission:settlements.filters.settlementKindSnapshot'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {
        name: i18n.t('commission:settlements.filters.settlementCurrencyCode'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', {
        name: i18n.t('commission:settlements.filters.windowStartAt'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', {
        name: i18n.t('commission:settlements.filters.windowEndAt'),
      }),
    ).toBeInTheDocument();
  });

  it('hides unsupported settlement filters in by-beneficiary related mode', async () => {
    const user = userEvent.setup();
    await renderRoute(
      '/commission/settlements?view=by-beneficiary&beneficiaryKindSnapshot=TALENT&beneficiaryTalentIdSnapshot=talent-001&subjectTalentId=talent-002&containsRevenueEntryId=revenue-entry-001&search=CS-202604-000001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CS-202604-000001')).toBeInTheDocument();
    expectSettlementFilterAbsent(i18n.t('common:labels.search'));
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expectSettlementFilterAbsent(i18n.t('commission:settlements.filters.subjectTalentId'));
    expectSettlementFilterAbsent(i18n.t('commission:settlements.filters.containsRevenueEntryId'));
  });

  it('hides unsupported settlement filters in by-subject-talent related mode', async () => {
    const user = userEvent.setup();
    await renderRoute(
      '/commission/settlements?view=by-subject-talent&subjectTalentId=talent-001&containsRevenueEntryId=revenue-entry-001&beneficiaryKindSnapshot=TALENT&beneficiaryTalentIdSnapshot=talent-002&search=CS-202604-000001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CS-202604-000001')).toBeInTheDocument();
    expectSettlementFilterAbsent(i18n.t('common:labels.search'));
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expectSettlementFilterAbsent(i18n.t('commission:settlements.filters.containsRevenueEntryId'));
    expectSettlementFilterAbsent(i18n.t('commission:settlements.filters.beneficiaryKindSnapshot'));
    expectSettlementFilterAbsent(
      i18n.t('commission:settlements.filters.beneficiaryEmploymentProfileIdSnapshot'),
    );
    expectSettlementFilterAbsent(
      i18n.t('commission:settlements.filters.beneficiaryTalentIdSnapshot'),
    );
  });

  it('hides unsupported settlement filters in by-revenue-entry related mode', async () => {
    const user = userEvent.setup();
    await renderRoute(
      '/commission/settlements?view=by-revenue-entry&revenueEntryId=revenue-entry-001&subjectTalentId=talent-001&beneficiaryKindSnapshot=TALENT&beneficiaryTalentIdSnapshot=talent-001&search=CS-202604-000001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CS-202604-000001')).toBeInTheDocument();
    expectSettlementFilterAbsent(i18n.t('common:labels.search'));
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expectSettlementFilterAbsent(i18n.t('commission:settlements.filters.subjectTalentId'));
    expectSettlementFilterAbsent(i18n.t('commission:settlements.filters.beneficiaryKindSnapshot'));
    expectSettlementFilterAbsent(
      i18n.t('commission:settlements.filters.beneficiaryEmploymentProfileIdSnapshot'),
    );
    expectSettlementFilterAbsent(
      i18n.t('commission:settlements.filters.beneficiaryTalentIdSnapshot'),
    );
  });

  it('renders Settlement detail and read-only backend-derived lines', async () => {
    await renderRoute('/commission/settlements/commission-settlement-001');

    expect(await screen.findByText('CS-202604-000001')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('commission:settlements.detail.boundaryHelper')),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('commission:settlements.actionRail.title'))).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('commission:settlements.detail.linesTitle')).length,
    ).toBeGreaterThan(0);
    const linesTable = screen.getByRole('table', {
      name: i18n.t('commission:settlements.lines.caption'),
    });
    expect(within(linesTable).getByRole('link', { name: 'REV-202604-000001' })).toHaveAttribute(
      'href',
      '/revenue-entries/revenue-entry-001',
    );
    expect(within(linesTable).queryByText('revenue-entry-001')).not.toBeInTheDocument();
    expect(screen.getByText('REV-202604-000001')).toBeInTheDocument();
    expect(screen.getByText('April livestream revenue')).toBeInTheDocument();
    expect(screen.getByText('07:00 21-04-2026')).toBeInTheDocument();
    expect(screen.getByText('07:00 22-04-2026')).toBeInTheDocument();
    expect(screen.getByText('21-04-2026')).toBeInTheDocument();
    expect(screen.queryByText('revenue-entry-001')).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('commission:settlements.lines.lineSettlementAmount')),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit line/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove line/i })).not.toBeInTheDocument();
    expectUnsupportedCommercialControlsAbsent();
  });

  it('renders archived Settlement detail as read-only', async () => {
    await renderRoute('/commission/settlements/commission-settlement-archived');

    expect(await screen.findByText('CS-202604-999999')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('commission:settlements.detail.archivedReadOnly')),
    ).toBeInTheDocument();
    const actionRail = screen
      .getByText(i18n.t('commission:settlements.actionRail.title'))
      .closest('section');
    expect(actionRail).not.toBeNull();
    within(actionRail as HTMLElement)
      .getAllByRole('button')
      .forEach((button) => expect(button).toBeDisabled());
  });

  it('submits Commission Rule selector IDs and canonical UTC-midnight dates', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const effectiveStartDate = Date.parse('2026-04-01T00:00:00.000Z');

    render(<CommissionRuleCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />);

    expect(
      screen.queryByLabelText(i18n.t('commission:rules.fields.ruleCode')),
    ).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('commission:generatedCode.description'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('commission:rules.fields.title')), 'Rule create');
    await user.click(await screen.findByRole('option', { name: /Talent One/ }));
    await user.click(await screen.findByRole('option', { name: /Contract One/ }));
    await user.type(screen.getByLabelText(i18n.t('commission:rules.fields.ratePercent')), '12.5');
    await user.type(
      screen.getByLabelText(i18n.t('commission:rules.fields.effectiveStartDate')),
      '2026-04-01',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('commission:rules.mutations.create.submit') }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        beneficiaryKind: 'TALENT',
        beneficiaryTalentId: 'talent-001',
        sourceContractRecordId: 'contract-record-001',
        effectiveStartDate,
      }),
    );
    expect(onSubmit.mock.calls.at(-1)?.[0].ruleCode).toBeUndefined();
    expect(onSubmit.mock.calls.at(-1)?.[0].beneficiaryEmploymentProfileId).toBeUndefined();
  });

  it('submits Commission Settlement rule and revenue-entry selectors as full ID sets', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    const onCreate = vi.fn();

    const createRender = render(
      <CommissionSettlementCreateSurface onCancel={() => undefined} onSubmit={onCreate} />,
    );

    expect(
      screen.queryByLabelText(i18n.t('commission:settlements.fields.settlementCode')),
    ).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('commission:generatedCode.description'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('commission:settlements.fields.title')), 'Settle');
    await user.click(await screen.findByRole('option', { name: /Rule One/ }));
    await user.type(
      screen.getByLabelText(i18n.t('commission:settlements.fields.settlementPeriodStartAt')),
      '2030-03-18T00:46',
    );
    await user.type(
      screen.getByLabelText(i18n.t('commission:settlements.fields.settlementPeriodEndAt')),
      '2030-03-18T01:46',
    );
    await user.click(await screen.findByRole('option', { name: /Revenue One/ }));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('commission:settlements.mutations.create.submit'),
      }),
    );

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRuleId: 'commission-rule-001',
        revenueEntryIds: ['revenue-entry-001'],
      }),
    );
    expect(onCreate.mock.calls.at(-1)?.[0].settlementCode).toBeUndefined();
    createRender.unmount();

    const onReplace = vi.fn();
    render(
      <CommissionSettlementRevenueEntriesSurface
        initialRevenueEntryIds={['revenue-entry-001', 'revenue-entry-002']}
        onCancel={() => undefined}
        onSubmit={onReplace}
      />,
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('commission:settlements.mutations.revenueEntries.submit'),
      }),
    );

    expect(onReplace).toHaveBeenCalledWith({
      revenueEntryIds: ['revenue-entry-001', 'revenue-entry-002'],
    });
  });

  it('omits generated Commission codes from sanitized create and draft update payloads', () => {
    expect(
      sanitizeCommissionRuleCreatePayload({
        title: 'Rule create',
        settlementKind: 'REVENUE_SHARE',
        beneficiaryKind: 'TALENT',
        beneficiaryTalentId: 'talent-001',
        sourceContractRecordId: 'contract-record-001',
        settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
        ratePercent: 12.5,
        appliesToRevenueKinds: ['PLATFORM_LIVESTREAM'],
        effectiveStartDate: Date.parse('2026-04-01T00:00:00.000Z'),
        effectiveEndDate: null,
        description: null,
        externalRef: null,
      }),
    ).not.toHaveProperty('ruleCode');
    expect(
      sanitizeCommissionRuleDraftCorePayload({
        title: 'Rule update',
        effectiveStartDate: Date.parse('2026-04-01T00:00:00.000Z'),
        effectiveEndDate: null,
      }),
    ).not.toHaveProperty('ruleCode');
    expect(
      sanitizeCommissionSettlementCreatePayload({
        title: 'Settlement create',
        sourceRuleId: 'commission-rule-001',
        settlementPeriodStartAt: 1900000000000,
        settlementPeriodEndAt: 1900003600000,
        revenueEntryIds: ['revenue-entry-001'],
        description: null,
        externalRef: null,
      }),
    ).not.toHaveProperty('settlementCode');
    expect(
      sanitizeCommissionSettlementDraftCorePayload({
        title: 'Settlement update',
        settlementPeriodStartAt: 1900000000000,
        settlementPeriodEndAt: 1900003600000,
      }),
    ).not.toHaveProperty('settlementCode');
  });
});
