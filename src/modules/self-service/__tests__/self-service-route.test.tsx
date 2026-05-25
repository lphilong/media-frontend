import i18n from 'i18next';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import {
  resetSelfServiceMockData,
  setMockSelfServiceEvents,
} from '@test/msw/self-service-handlers';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

type MockCapabilities = Parameters<typeof setMockCurrentActorCapabilities>[0];

const staffCapabilities = (): MockCapabilities => ({
  id: 'user-staff',
  type: 'staff',
  context: 'ADMIN',
  isActive: true,
  roles: ['TALENT_STAFF_SELF'],
  permissions: [
    'workSchedule.read',
    'event.read',
    'talentKpi.read',
    'kpi.readProgress',
    'employmentProfile.read',
    'talent.read',
  ],
  scopeGrants: {
    workSchedule: ['self'],
    kpi: ['self'],
  },
  generatedAt: '2026-05-24T00:00:00.000Z',
});

const renderRoute = async (path: string, setup?: () => void): Promise<void> => {
  cleanup();
  await setLocale('en');
  resetSelfServiceMockData();
  setMockCurrentActorCapabilities(staffCapabilities());
  setup?.();

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

describe('/self-service route', () => {
  it('renders staff shell and read-only My Profile summary outside the admin sidebar', async () => {
    await renderRoute('/self-service');

    expect(await screen.findByTestId('self-service-shell')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Self-Service' })).toBeInTheDocument();
    expect(await screen.findAllByText('Mina Staff')).toHaveLength(2);
    expect(await screen.findByText('EP-SELF-001')).toBeInTheDocument();
    expect(await screen.findByText('mina.staff@example.test')).toBeInTheDocument();
    expect(await screen.findByText('Creator Mina')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-employment-profiles')).not.toBeInTheDocument();
  });

  it('renders read-only My Work Shifts from the self-service endpoint only', async () => {
    let adminWorkShiftCalls = 0;

    server.use(
      http.get('*/admin/work-shifts*', () => {
        adminWorkShiftCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    expect(await screen.findByRole('heading', { name: 'My Work Shifts' })).toBeInTheDocument();
    expect(await screen.findByText('Studio filming shift')).toBeInTheDocument();
    expect(await screen.findByText('Content review shift')).toBeInTheDocument();
    expect(await screen.findByText('Roster generated')).toBeInTheDocument();
    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-work-shift-row')).toHaveLength(2);
    expect(document.body.textContent ?? '').not.toContain('Other Staff');
    expect(document.body.textContent ?? '').not.toContain('subjectEmploymentProfileId');
    expect(document.body.textContent ?? '').not.toContain('studioResourceIds');
    expect(document.body.textContent ?? '').not.toContain('internal admin note');
    expect(
      screen.queryByRole('button', { name: /create|edit|cancel|request|approve/i }),
    ).toBeNull();
    await waitFor(() => {
      expect(adminWorkShiftCalls).toBe(0);
    });
  });

  it('does not render forbidden person, HR, Auth0, password setup, or role data', async () => {
    await renderRoute('/self-service');

    expect(await screen.findAllByText('Mina Staff')).toHaveLength(2);
    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'Mina Legal',
      'legalName',
      'recruiterEmploymentProfileId',
      'hrOwnerEmploymentProfileId',
      'onboardingOwnerEmploymentProfileId',
      'sourcedByEmploymentProfileId',
      'hiredAt',
      'onboardedAt',
      'auth0|',
      'setupUrl',
      'ticketUrl',
      'resetUrl',
      'temporaryPassword',
      'credential',
      'session',
      'role:list',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }
  });

  it('renders read-only My Events from the self-service endpoint only', async () => {
    let selfServiceEventCalls = 0;
    let adminEventCalls = 0;
    let kpiCalls = 0;

    server.use(
      http.get('*/self-service/events', () => {
        selfServiceEventCalls += 1;
        return HttpResponse.json({
          data: [
            {
              eventId: 'event-self-talent',
              eventCode: 'EVT-SELF-TAL',
              title: 'Creator livestream event',
              status: 'SCHEDULED',
              startsAt: Date.UTC(2026, 4, 28, 2, 0),
              endsAt: Date.UTC(2026, 4, 28, 4, 0),
              ownAssignmentKind: 'TALENT',
              ownAssignmentStatus: 'ACTIVE',
            },
          ],
        });
      }),
      http.get('*/admin/events*', () => {
        adminEventCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
      http.get('*/admin/kpi*', () => {
        kpiCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    expect(await screen.findByTestId('self-service-nav-events')).toHaveTextContent('Available');
    expect(await screen.findByTestId('self-service-nav-kpi')).toHaveTextContent('Coming soon');
    expect(await screen.findByRole('heading', { name: 'My Events' })).toBeInTheDocument();
    expect(await screen.findByText('EVT-SELF-TAL')).toBeInTheDocument();
    expect(await screen.findByText('Creator livestream event')).toBeInTheDocument();
    expect(await screen.findByText('Talent')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-event-row')).toHaveLength(1);
    await waitFor(() => {
      expect(selfServiceEventCalls).toBe(1);
      expect(adminEventCalls).toBe(0);
      expect(kpiCalls).toBe(0);
    });
    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'Other staff event',
      'TalentGroup-only event',
      'External Talent event',
      'Removed assignment event',
      'full roster',
      'participantRoster',
      'Internal production note',
      'client budget',
      'commercial confidential',
      'platform-secret-account',
      'studioResourceIds',
      'externalRef',
      'manager only note',
      'PENDING_APPROVAL',
      'legacy Active',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }
    expect(
      screen.queryByRole('button', {
        name: /create|edit|delete|assign|accept|decline|check[- ]?in|request|change|start|complete|cancel/i,
      }),
    ).toBeNull();
  });

  it('renders My Events empty, loading, and error states safely', async () => {
    await renderRoute('/self-service', () => setMockSelfServiceEvents([]));

    expect(await screen.findByText('No events')).toBeInTheDocument();
    expect(
      await screen.findByText('No directly assigned events are available for your profile yet.'),
    ).toBeInTheDocument();

    let resolveEvents: () => void = () => {};
    const pendingEvents = new Promise<void>((resolve) => {
      resolveEvents = resolve;
    });
    server.use(
      http.get('*/self-service/events', async () => {
        await pendingEvents;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');
    expect(await screen.findByTestId('self-service-events-loading')).toBeInTheDocument();
    resolveEvents();
    await waitFor(() => {
      expect(screen.queryByTestId('self-service-events-loading')).not.toBeInTheDocument();
    });

    server.use(
      http.get('*/self-service/events', () => {
        return HttpResponse.json({ error: { code: 'TEST_ERROR' } }, { status: 500 });
      }),
    );

    await renderRoute('/self-service');
    expect(await screen.findByText('Events unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Your events could not be loaded.')).toBeInTheDocument();
  });

  it('keeps Account as read-only summary only without password or profile mutation flows', async () => {
    await renderRoute('/self-service');

    expect(await screen.findByText('mina.staff@example.test')).toBeInTheDocument();
    expect(await screen.findByTestId('self-service-nav-account')).toHaveTextContent('Coming soon');
    expect(screen.queryByRole('button', { name: /password|change|edit|save|setup/i })).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(
      /setupUrl|ticketUrl|resetUrl|temporaryPassword/i,
    );
  });

  it('keeps TALENT_STAFF_SELF denied from People Hub admin EmploymentProfile route', async () => {
    await renderRoute('/employment-profiles/ep-001');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('People Operations Hub')).not.toBeInTheDocument();
  });

  it('keeps TALENT_STAFF_SELF denied from the admin Event Assignment route', async () => {
    await renderRoute('/events');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('Event Assignment')).not.toBeInTheDocument();
  });
});
