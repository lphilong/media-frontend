import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import {
  resetIdentityAccessMockData,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import type { CurrentActorCapabilities } from '@shared/auth/current-actor-capabilities';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

const setEventCapabilities = (
  overrides: Partial<Pick<CurrentActorCapabilities, 'permissions' | 'roles' | 'scopeGrants'>>,
) => {
  setMockCurrentActorCapabilities({
    id: 'user-event-test',
    type: 'admin',
    context: 'ADMIN',
    isActive: true,
    roles: overrides.roles ?? ['TEAM_MANAGER'],
    permissions: overrides.permissions ?? ['event.read'],
    scopeGrants: overrides.scopeGrants ?? { eventAssignment: ['managedGroup'] },
    generatedAt: '2026-05-20T00:00:00.000Z',
  });
};

describe('event assignment wave 6 surfaces', () => {
  beforeEach(async () => {
    resetIdentityAccessMockData();
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders Event list rows, filters archived by default, and exposes no scope UI', async () => {
    const user = userEvent.setup();
    renderRoute('/events?scope=global&status=SCHEDULED');

    expect(
      await screen.findByRole('heading', { name: i18n.t('event-assignment:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('EVT-202605-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText('Archived event')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/scope/i)).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(
      screen.getAllByText(i18n.t('event-assignment:statuses.SCHEDULED')).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expect(
      screen.getByRole('heading', { name: i18n.t('common:filters.moreFilters') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: i18n.t('event-assignment:filters.assignmentKind') }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'event-assignment:filters.status',
        )}`,
      }),
    );
    expect(
      screen.getByRole('combobox', { name: i18n.t('event-assignment:filters.status') }),
    ).toHaveValue('');
    const main = screen.getByTestId('admin-shell-main');
    expect(
      within(main).queryByText(/removed|attendance|recurrence|work shift|bulk|delete|unarchive/i),
    ).not.toBeInTheDocument();
  });

  it('TEAM_MANAGER with managedGroup scope sees Event nav and only managed Event rows', async () => {
    setEventCapabilities({
      roles: ['TEAM_MANAGER'],
      permissions: [
        'event.read',
        'event.update',
        'event.manageAssignments',
        'event.manageLifecycle',
      ],
      scopeGrants: { eventAssignment: ['managedGroup'] },
    });

    renderRoute('/events');

    expect(await screen.findByTestId('nav-link-events')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: i18n.t('event-assignment:page.title') }),
    ).toBeInTheDocument();
    expect(screen.getByText('EVT-202605-000002')).toBeInTheDocument();
    expect(screen.getByText('EVT-202603-000003')).toBeInTheDocument();
    expect(screen.getByText('EVT-202605-000005')).toBeInTheDocument();
    expect(screen.queryByText('EVT-202605-000001')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('event-assignment:actions.create') }),
    ).not.toBeInTheDocument();
  });

  it('TEAM_MANAGER with managedGroup empty Event result shows empty state instead of No Access', async () => {
    setEventCapabilities({
      roles: ['TEAM_MANAGER'],
      permissions: ['event.read'],
      scopeGrants: { eventAssignment: ['managedGroup'] },
    });

    renderRoute('/events?search=NO_MATCH');

    expect(
      await screen.findByText(i18n.t('event-assignment:states.emptyTitle')),
    ).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('errors:permission.title'))).not.toBeInTheDocument();
  });

  it('VIEWER_AUDITOR with global Event scope sees Event read-only', async () => {
    setEventCapabilities({
      roles: ['VIEWER_AUDITOR'],
      permissions: ['event.read'],
      scopeGrants: { eventAssignment: ['global'] },
    });

    renderRoute('/events/event-001');

    expect(await screen.findByText('EVT-202605-000001')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('event-assignment:actions.edit') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('event-assignment:actions.create') }),
    ).not.toBeInTheDocument();
  });

  it('renders target timestamp filter chips with readable UTC timestamps', async () => {
    renderRoute(
      '/events?statusGroup=ACTIVE&eventOverlapStartAt=1777507200000&eventOverlapEndAt=1777593600000&eventStartFromAt=1777507200000&eventStartToAt=1778112000000',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('event-assignment:page.title') }),
    ).toBeInTheDocument();
    expect(screen.getByText('Event overlaps from:')).toBeInTheDocument();
    expect(screen.getByText('Event overlaps until:')).toBeInTheDocument();
    expect(screen.getByText('Event starts from:')).toBeInTheDocument();
    expect(screen.getByText('Event starts until:')).toBeInTheDocument();
    expect(screen.getAllByText(/00:00 30-04-2026/).length).toBeGreaterThan(0);
    expect(screen.getByText(/00:00 01-05-2026/)).toBeInTheDocument();
    expect(screen.getByText(/00:00 07-05-2026/)).toBeInTheDocument();
    expect(screen.queryByText(/1777507200000|1777593600000|1778112000000/)).not.toBeInTheDocument();
  });

  it('renders detail and active assignment roster from the roster endpoint', async () => {
    const user = userEvent.setup();
    renderRoute('/events/event-001');

    expect(
      await screen.findByText(i18n.t('event-assignment:actionRail.title')),
    ).toBeInTheDocument();
    expect(screen.getByText('EVT-202605-000001')).toBeInTheDocument();
    expect(screen.getByText('Launch livestream')).toBeInTheDocument();
    expect(screen.getByText('16:06 12-05-2026')).toBeInTheDocument();
    expect(screen.getByText('19:06 12-05-2026')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('event-assignment:assignments.title'))).toBeInTheDocument();
    expect(screen.getByText('Alice Nguyen')).toBeInTheDocument();
    expect(screen.getByText('Luna')).toBeInTheDocument();
    expect(screen.queryByText('ep-001')).not.toBeInTheDocument();
    expect(screen.queryByText('talent-002')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Main Studio' })).toHaveAttribute(
      'href',
      '/studio-resources/studio-001',
    );
    expect(screen.getByRole('link', { name: 'Mina Live' })).toHaveAttribute(
      'href',
      '/platform-accounts/platform-001',
    );
    const main = screen.getByTestId('admin-shell-main');
    expect(within(main).queryByText('studio-001')).not.toBeInTheDocument();
    expect(within(main).queryByText('platform-001')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:actions.replaceAssignments') }),
    );
    expect(screen.getByText('Alice Nguyen')).toBeInTheDocument();
    expect(screen.getByText('Luna')).toBeInTheDocument();
  });

  it('requires the eventAssignment global scope for Event detail mutation actions', async () => {
    setEventCapabilities({
      roles: ['role-admin'],
      permissions: [
        'event.read',
        'event.update',
        'event.manageAssignments',
        'event.manageLifecycle',
      ],
      scopeGrants: { eventAssignment: ['managedGroup'] },
    });

    renderRoute('/events/event-managed-scheduled');

    expect(await screen.findByText('EVT-202605-000005')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('event-assignment:actions.edit') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('event-assignment:actions.replaceAssignments'),
      }),
    ).not.toBeInTheDocument();
    const historicalNote = screen.queryByRole('button', {
      name: i18n.t('event-assignment:actions.historicalArchiveEligible'),
    });
    if (historicalNote) {
      expect(historicalNote).not.toHaveAccessibleDescription(
        i18n.t('common:capabilities.missingScope'),
      );
    }
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
    setEventCapabilities({
      roles: ['PRODUCTION_OPS'],
      permissions: [
        'event.read',
        'event.create',
        'event.update',
        'event.manageAssignments',
        'event.manageLifecycle',
      ],
      scopeGrants: { eventAssignment: ['global'] },
    });

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
      '2030-03-18T00:46',
    );
    await user.type(
      scope.getByLabelText(i18n.t('event-assignment:fields.eventEndAt')),
      '2030-03-18T01:46',
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
    expect(screen.getByText('Alice Nguyen')).toBeInTheDocument();

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
