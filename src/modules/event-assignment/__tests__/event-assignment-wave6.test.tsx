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

describe('event assignment wave 6 surfaces', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders Event list rows, filters archived by default, and exposes no scope UI', async () => {
    renderRoute('/events?scope=global&status=SCHEDULED');

    expect(
      await screen.findByRole('heading', { name: i18n.t('event-assignment:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('EVT-202605-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('Archived event')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/scope/i)).not.toBeInTheDocument();
    const main = screen.getByTestId('admin-shell-main');
    expect(
      within(main).queryByText(/removed|attendance|recurrence|work shift|bulk|delete|unarchive/i),
    ).not.toBeInTheDocument();
  });

  it('renders detail and active assignment roster from the roster endpoint', async () => {
    const user = userEvent.setup();
    renderRoute('/events/event-001');

    expect(
      await screen.findByText(i18n.t('event-assignment:actionRail.title')),
    ).toBeInTheDocument();
    expect(screen.getByText('EVT-202605-000001')).toBeInTheDocument();
    expect(screen.getByText('Launch livestream')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('event-assignment:assignments.title'))).toBeInTheDocument();
    expect(screen.getByText('ep-001')).toBeInTheDocument();
    expect(screen.getByText('talent-002')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'studio-001' })).toHaveAttribute(
      'href',
      '/studio-resources/studio-001',
    );
    expect(screen.getByRole('link', { name: 'platform-001' })).toHaveAttribute(
      'href',
      '/platform-accounts/platform-001',
    );

    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:actions.replaceAssignments') }),
    );
    expect(screen.getByText('ep-001')).toBeInTheDocument();
    expect(screen.getByText('talent-002')).toBeInTheDocument();
  });

  it('keeps archived events read-only and does not present unsupported event surfaces', async () => {
    renderRoute('/events/event-archive');

    expect(
      await screen.findByText(i18n.t('event-assignment:actionRail.title')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('event-assignment:detail.archivedReadOnly')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('event-assignment:actions.edit') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('event-assignment:actions.start') }),
    ).toBeDisabled();
    const main = screen.getByTestId('admin-shell-main');
    expect(
      within(main).queryByText(/removed|attendance|recurrence|work shift|bulk|delete|unarchive/i),
    ).not.toBeInTheDocument();
  });

  it('supports create, detail roster verification, and a valid lifecycle action', async () => {
    const user = userEvent.setup();
    renderRoute('/events');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('event-assignment:actions.create'),
      }),
    );

    const createHeading = await screen.findByRole('heading', {
      name: i18n.t('event-assignment:mutations.create.title'),
    });
    const createSurface = createHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const scope = within(createSurface);
    expect(scope.queryByLabelText(i18n.t('event-assignment:fields.eventCode'))).toBeNull();
    expect(
      scope.getByText(i18n.t('event-assignment:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(scope.getByLabelText(i18n.t('event-assignment:fields.title')), 'Wave 6 event');
    await user.click(await scope.findByRole('button', { name: /Alice/ }));
    await user.type(
      scope.getByLabelText(i18n.t('event-assignment:fields.eventStartAt')),
      '1900000000000',
    );
    await user.type(
      scope.getByLabelText(i18n.t('event-assignment:fields.eventEndAt')),
      '1900003600000',
    );
    await user.click(
      scope.getByRole('button', { name: i18n.t('event-assignment:actions.addStudioResource') }),
    );
    await user.click(await scope.findByRole('button', { name: /Main Studio/ }));
    await user.click(
      scope.getByRole('button', { name: i18n.t('event-assignment:actions.addPlatformAccount') }),
    );
    await user.click(await scope.findByRole('button', { name: /Mina Live/ }));
    await user.click(
      scope.getByRole('button', { name: i18n.t('event-assignment:mutations.create.submit') }),
    );

    expect(await screen.findByText('EVT-203003-000801', {}, { timeout: 3000 })).toBeInTheDocument();
    const row = screen.getByText('EVT-203003-000801').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }
    await user.click(
      within(row).getByRole('button', { name: i18n.t('event-assignment:actions.open') }),
    );

    expect(
      await screen.findByText(i18n.t('event-assignment:assignments.title')),
    ).toBeInTheDocument();
    expect(screen.getByText('ep-001')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:actions.start') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(i18n.t('event-assignment:statuses.IN_PROGRESS')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 20_000);
});
