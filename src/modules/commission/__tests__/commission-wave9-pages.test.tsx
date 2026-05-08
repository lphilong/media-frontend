import i18n from 'i18next';
import { act, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

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
  it('renders the Commission Rules list from the rules list API', async () => {
    await renderRoute('/commission/rules');

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:rules.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CRULE001', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('April livestream revenue share')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('commission:rules.table.beneficiaryId'))).toBeInTheDocument();
    expectUnsupportedCommercialControlsAbsent();
  });

  it('renders Commission Rule detail from the detail API and keeps archived rules read-only', async () => {
    await renderRoute('/commission/rules/commission-rule-001');

    expect(await screen.findByText('CRULE001')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('commission:rules.actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('contract-record-001')).toBeInTheDocument();
    expect(screen.getAllByText('talent-001').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: i18n.t('commission:rules.related.settlementsByRule') }),
    ).toHaveAttribute('href', '/commission/settlements?sourceRuleId=commission-rule-001');
    expectUnsupportedCommercialControlsAbsent();
  });

  it('renders archived Commission Rule detail as read-only', async () => {
    await renderRoute('/commission/rules/commission-rule-archived');

    expect(await screen.findByText('CRULE999')).toBeInTheDocument();
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
    expect(await screen.findByText('CSET001')).toBeInTheDocument();
    expect(screen.getByText('April livestream settlement')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('commission:settlements.table.settlementAmount')),
    ).toBeInTheDocument();
    expectUnsupportedCommercialControlsAbsent();
  });

  it('exposes the documented flat-list filters on the Commission Settlements list', async () => {
    await renderRoute('/commission/settlements');

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CSET001')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: i18n.t('common:labels.search') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', {
        name: i18n.t('commission:settlements.filters.status'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', {
        name: i18n.t('commission:settlements.filters.beneficiaryKindSnapshot'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {
        name: i18n.t('commission:settlements.filters.beneficiaryEmploymentProfileIdSnapshot'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {
        name: i18n.t('commission:settlements.filters.beneficiaryTalentIdSnapshot'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {
        name: i18n.t('commission:settlements.filters.subjectTalentId'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {
        name: i18n.t('commission:settlements.filters.sourceRuleId'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {
        name: i18n.t('commission:settlements.filters.containsRevenueEntryId'),
      }),
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
    await renderRoute(
      '/commission/settlements?view=by-beneficiary&beneficiaryKindSnapshot=TALENT&beneficiaryTalentIdSnapshot=talent-001&subjectTalentId=talent-002&containsRevenueEntryId=revenue-entry-001&search=CSET001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CSET001')).toBeInTheDocument();
    expectSettlementFilterAbsent(i18n.t('common:labels.search'));
    expectSettlementFilterAbsent(i18n.t('commission:settlements.filters.subjectTalentId'));
    expectSettlementFilterAbsent(i18n.t('commission:settlements.filters.containsRevenueEntryId'));
  });

  it('hides unsupported settlement filters in by-subject-talent related mode', async () => {
    await renderRoute(
      '/commission/settlements?view=by-subject-talent&subjectTalentId=talent-001&containsRevenueEntryId=revenue-entry-001&beneficiaryKindSnapshot=TALENT&beneficiaryTalentIdSnapshot=talent-002&search=CSET001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CSET001')).toBeInTheDocument();
    expectSettlementFilterAbsent(i18n.t('common:labels.search'));
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
    await renderRoute(
      '/commission/settlements?view=by-revenue-entry&revenueEntryId=revenue-entry-001&subjectTalentId=talent-001&beneficiaryKindSnapshot=TALENT&beneficiaryTalentIdSnapshot=talent-001&search=CSET001',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('commission:settlements.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CSET001')).toBeInTheDocument();
    expectSettlementFilterAbsent(i18n.t('common:labels.search'));
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

    expect(await screen.findByText('CSET001')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('commission:settlements.actionRail.title'))).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('commission:settlements.detail.linesTitle')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('REV001')).toBeInTheDocument();
    expect(screen.getAllByText('revenue-entry-001').length).toBeGreaterThan(0);
    expect(
      screen.getByText(i18n.t('commission:settlements.lines.lineSettlementAmount')),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit line/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove line/i })).not.toBeInTheDocument();
    expectUnsupportedCommercialControlsAbsent();
  });

  it('renders archived Settlement detail as read-only', async () => {
    await renderRoute('/commission/settlements/commission-settlement-archived');

    expect(await screen.findByText('CSET999')).toBeInTheDocument();
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
});
