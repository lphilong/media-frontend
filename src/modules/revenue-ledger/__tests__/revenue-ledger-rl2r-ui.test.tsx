import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import { resetWave8MockData } from '@test/msw/wave8-handlers';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRevenueLedger = async (): Promise<void> => {
  cleanup();
  await setLocale('en');
  resetWave8MockData();
  setMockCurrentActorCapabilities({
    id: 'finance-admin',
    type: 'admin',
    context: 'ADMIN',
    isActive: true,
    roles: ['FINANCE'],
    permissions: [
      'revenueLedger.read',
      'revenueLedger.create',
      'revenueLedger.platformEarning.submit',
      'revenueLedger.platformEarning.review',
      'revenueLedger.platformEarning.approve',
      'revenueLedger.platformEarning.void',
    ],
    scopeGrants: { revenueLedger: ['global'] },
    generatedAt: '2026-06-18T00:00:00.000Z',
  });
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/revenue-entries'],
  });
  renderAppWithProviders(<RouterProvider router={router} />);
};

describe('RL-2R Revenue Admin UI', () => {
  it('requires and submits a subject Talent for an approved multi-member batch', async () => {
    const user = userEvent.setup();
    await renderRevenueLedger();

    const approvedCode = await screen.findByText('PEB-202604-000001', {}, { timeout: 5000 });
    const approvedRow = approvedCode.closest('tr');
    expect(approvedRow).not.toBeNull();
    await user.click(within(approvedRow as HTMLTableRowElement).getByRole('button', { name: 'Open' }));

    const createButton = (await screen.findAllByRole('button', {
      name: 'Create revenue entry',
    })).at(-1)!;
    await user.click(createButton);
    expect(
      await screen.findByText(/contains multiple member Talents/i),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Create revenue entry' }).at(-1)!);
    expect(
      await screen.findByText('Select the subject Talent before creating the Revenue Entry.'),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Subject Talent'), 'talent-002');
    await user.click(screen.getAllByRole('button', { name: 'Create revenue entry' }).at(-1)!);

    expect(
      await screen.findByText('Revenue entry created from approved batch.'),
    ).toBeInTheDocument();
  });

  it('uses a localized reason form and blocks empty rejection reasons', async () => {
    const user = userEvent.setup();
    await renderRevenueLedger();

    const reviewCode = await screen.findByText('PEB-202604-000002', {}, { timeout: 5000 });
    const reviewRow = reviewCode.closest('tr');
    expect(reviewRow).not.toBeNull();
    await user.click(within(reviewRow as HTMLTableRowElement).getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Reject' }));

    expect(screen.getByLabelText('Rejection reason')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Reject' }).at(-1)!);
    expect(await screen.findByText('A reason is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Rejection reason'), 'Source needs correction.');
    await user.click(screen.getAllByRole('button', { name: 'Reject' }).at(-1)!);
    await waitFor(() =>
      expect(screen.queryByLabelText('Rejection reason')).not.toBeInTheDocument(),
    );
  });
});
