import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

describe('contract registry wave 7 surfaces', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders Contract Registry list rows, filters archived by default, and keeps scope absent', async () => {
    renderRoute('/contract-records?scope=global&scopeGrants=x');

    expect(
      await screen.findByRole('heading', { name: i18n.t('contract-registry:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CON-2026-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    const activeRow = screen.getByText('CON-2026-000002').closest('tr');
    expect(activeRow).not.toBeNull();
    if (!activeRow) {
      return;
    }
    expect(
      within(activeRow).getByRole('button', { name: i18n.t('contract-registry:actions.expire') }),
    ).toBeInTheDocument();
    expect(
      within(activeRow).getByRole('button', {
        name: i18n.t('contract-registry:actions.terminate'),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Archived contract record')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/scope|scopeGrants|delete|bulk|unarchive|upload|download/i),
    ).not.toBeInTheDocument();
  });

  it('renders detail from detail API with links, action rail, and file metadata only', async () => {
    renderRoute('/contract-records/contract-record-001');

    expect(
      await screen.findByText(i18n.t('contract-registry:actionRail.title')),
    ).toBeInTheDocument();
    expect(screen.getByText('CON-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('alice-contract.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'ep-001' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'ep-001' })[0]).toHaveAttribute(
      'href',
      '/employment-profiles/ep-001',
    );
    expect(
      screen.getByRole('link', { name: i18n.t('contract-registry:related.commissionRules') }),
    ).toHaveAttribute(
      'href',
      '/commission/rules?view=by-contract&sourceContractRecordId=contract-record-001',
    );
    expect(
      screen.queryByText(/approval|signing workflow|file vault|upload|download|payroll|payout/i),
    ).not.toBeInTheDocument();
  });

  it('keeps archived contract records read-only without unsupported controls', async () => {
    renderRoute('/contract-records/contract-record-archived');

    expect(
      await screen.findByText(i18n.t('contract-registry:actionRail.title')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('contract-registry:detail.archivedReadOnly')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('contract-registry:actions.editDraftCore') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('contract-registry:actions.assignOwner') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('contract-registry:actions.updateFileReference') }),
    ).toBeDisabled();
    const main = screen.getByTestId('admin-shell-main');
    expect(
      within(main).queryByText(/delete|bulk|unarchive|approval|signing|vault|upload|download/i),
    ).not.toBeInTheDocument();
  });

  it('supports create and a conservative lifecycle action from the list', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('contract-registry:actions.create'),
      }),
    );

    const createHeading = await screen.findByRole('heading', {
      name: i18n.t('contract-registry:mutations.create.title'),
    });
    const createSurface = createHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const scope = within(createSurface);
    expect(scope.queryByLabelText(i18n.t('contract-registry:fields.contractCode'))).toBeNull();
    expect(
      scope.getByText(i18n.t('contract-registry:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(
      scope.getByLabelText(i18n.t('contract-registry:fields.title')),
      'Wave 7 contract',
    );
    const employeeOptions = await scope.findAllByRole('button', { name: /Alice/ });
    await user.click(employeeOptions[0]);
    await user.click(employeeOptions[1]);
    await user.type(
      scope.getByLabelText(i18n.t('contract-registry:fields.effectiveStartDate')),
      '2026-01-01',
    );
    await user.click(
      scope.getByRole('button', { name: i18n.t('contract-registry:mutations.create.submit') }),
    );

    expect(await screen.findByText('CON-2026-000101', {}, { timeout: 3000 })).toBeInTheDocument();
    const row = screen.getByText('CON-2026-000101').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', {
        name: i18n.t('contract-registry:actions.mark-pending-signature'),
      }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('CON-2026-000101').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('contract-registry:statuses.PENDING_SIGNATURE')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 20_000);

  it('supports date-based expire action from an eligible list row', async () => {
    const user = userEvent.setup();
    renderRoute('/contract-records');

    expect(await screen.findByText('CON-2026-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    const activeRow = screen.getByText('CON-2026-000002').closest('tr');
    expect(activeRow).not.toBeNull();
    if (!activeRow) {
      return;
    }

    await user.click(
      within(activeRow).getByRole('button', { name: i18n.t('contract-registry:actions.expire') }),
    );
    const expireSurface = await screen.findByRole('heading', {
      name: i18n.t('contract-registry:mutations.expire.title'),
    });
    const section = expireSurface.closest('section');
    expect(section).not.toBeNull();
    if (!section) {
      return;
    }

    await user.type(
      within(section).getByLabelText(i18n.t('contract-registry:fields.expiryDate')),
      '2026-05-01',
    );
    await user.click(
      within(section).getByRole('button', {
        name: i18n.t('contract-registry:mutations.expire.submit'),
      }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('CON-2026-000002').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('contract-registry:statuses.EXPIRED')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 20_000);
});
