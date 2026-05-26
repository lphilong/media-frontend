import i18n from 'i18next';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import {
  resetSelfServiceMockData,
  setMockSelfServiceEvents,
  setMockSelfServiceCurrentPerson,
  setMockSelfServiceKpi,
} from '@test/msw/self-service-handlers';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

const mockAuthAdapter = vi.hoisted(() => ({
  initialize: vi.fn(async () => ({
    isAuthenticated: true,
    session: {
      userName: 'Mina Staff',
      capabilityHints: [],
      expiresAt: Date.UTC(2026, 4, 26, 12, 0),
    },
  })),
  getAccessToken: vi.fn(async () => 'mock-access-token'),
  loginRedirect: vi.fn(async () => undefined),
  logoutRedirect: vi.fn(async () => undefined),
  handleCallback: vi.fn(async () => null),
}));

vi.mock('@shared/auth/auth-adapter', () => ({
  createAuthAdapter: () => mockAuthAdapter,
  isAuthConfigurationError: () => false,
}));

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
  mockAuthAdapter.logoutRedirect.mockClear();
  setup?.();

  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

describe('/self-service route', () => {
  it('routes staff actors from root landing into the self-service shell', async () => {
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Permission denied' } },
          { status: 403 },
        ),
      ),
    );

    await renderRoute('/');

    expect(await screen.findByTestId('self-service-shell')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Self-Service' })).toBeInTheDocument();
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('primary-navigation')).not.toBeInTheDocument();
  });

  it('renders staff shell and read-only My Profile summary outside the admin sidebar', async () => {
    await renderRoute('/self-service');

    expect(await screen.findByTestId('self-service-shell')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Self-Service' })).toBeInTheDocument();
    expect((await screen.findAllByText('Mina Staff')).length).toBeGreaterThanOrEqual(2);
    expect((await screen.findAllByText('EP-SELF-001')).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('mina.staff@example.test')).toBeInTheDocument();
    expect((await screen.findAllByText('Creator Mina')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('admin-shell-main')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-employment-profiles')).not.toBeInTheDocument();
  });

  it('parses nullable current-person locale and renders My Profile instead of not-linked state', async () => {
    await renderRoute('/self-service', () =>
      setMockSelfServiceCurrentPerson({
        employmentProfileId: 'ep-linked-null-locale',
        employeeCode: 'EP-LINKED-NULL',
        displayName: 'Linked Null Locale Staff',
        employmentStatus: 'ACTIVE',
        accountEmail: 'linked.null.locale@example.test',
        accountStatus: 'ACTIVE',
        accountLinkStatus: 'LINKED',
        linkedInternalTalent: {
          talentId: 'talent-linked-null-locale',
          talentCode: 'TAL-LINKED-NULL',
          displayName: 'Linked Null Locale Staff',
          performanceAlias: null,
        },
        locale: null,
        timezone: 'Asia/Saigon',
      }),
    );

    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeInTheDocument();
    expect((await screen.findAllByText('EP-LINKED-NULL')).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('linked.null.locale@example.test')).toBeInTheDocument();
    expect((await screen.findAllByText('TAL-LINKED-NULL')).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('No linked Employment Profile')).not.toBeInTheDocument();
  });

  it('renders no-linked profile state only for the backend self-service not-linked error', async () => {
    server.use(
      http.get('*/self-service/me', () =>
        HttpResponse.json(
          {
            error: {
              code: 'SELF_SERVICE_CURRENT_PERSON_NOT_LINKED',
              message: 'No linked Employment Profile',
            },
          },
          { status: 404 },
        ),
      ),
    );

    await renderRoute('/self-service');

    expect(await screen.findByText('No linked Employment Profile')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Your account is authenticated, but no staff profile is linked for self-service yet.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Profile' })).not.toBeInTheDocument();
  });

  it('renders generic current-person load errors for parse/client failures', async () => {
    server.use(
      http.get('*/self-service/me', () =>
        HttpResponse.json({
          data: {
            employmentProfileId: 'ep-invalid-current-person',
            employeeCode: 'EP-INVALID',
            displayName: 'Invalid Current Person',
            employmentStatus: 'ACTIVE',
            accountStatus: 'ACTIVE',
            accountLinkStatus: 'LINKED',
            locale: 42,
          },
        }),
      ),
    );

    await renderRoute('/self-service');

    expect(await screen.findByText('Self-Service unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Your profile could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No linked Employment Profile')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'My Profile' })).not.toBeInTheDocument();
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

    expect((await screen.findAllByText('Mina Staff')).length).toBeGreaterThanOrEqual(2);
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
    expect(await screen.findByTestId('self-service-nav-kpi')).toHaveTextContent('Available');
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

  it('renders read-only My KPI from the self-service endpoint only', async () => {
    let selfServiceKpiCalls = 0;
    let adminKpiCalls = 0;

    server.use(
      http.get('*/self-service/kpi', () => {
        selfServiceKpiCalls += 1;
        return HttpResponse.json({
          data: {
            items: [
              {
                kpiPlanId: 'kpi-plan-self-published',
                title: 'May creator KPI',
                periodMonth: '2026-05',
                periodStartAt: Date.UTC(2026, 4, 1, -7, 0),
                periodEndAt: Date.UTC(2026, 5, 1, -7, 0) - 1,
                officialStatus: 'OFFICIAL_PUBLISHED',
                lastUpdatedAt: Date.UTC(2026, 4, 20, 4, 0),
                metrics: [
                  {
                    metricCode: 'REVENUE_VND',
                    unit: 'VND',
                    targetValue: 10000000,
                    actualValue: 4500000,
                    progressPercent: 45,
                  },
                ],
              },
            ],
          },
        });
      }),
      http.get('*/admin/kpi*', () => {
        adminKpiCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    expect(await screen.findByRole('heading', { name: 'My KPI' })).toBeInTheDocument();
    expect(await screen.findByText('May creator KPI')).toBeInTheDocument();
    expect(await screen.findByText('Official published')).toBeInTheDocument();
    expect(await screen.findByText('Revenue')).toBeInTheDocument();
    expect(await screen.findByText('45%')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-service-kpi-item')).toHaveLength(1);
    expect(screen.getAllByTestId('self-service-kpi-metric-row')).toHaveLength(1);

    await waitFor(() => {
      expect(selfServiceKpiCalls).toBe(1);
      expect(adminKpiCalls).toBe(0);
    });

    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'Own DRAFT KPI allocation',
      'Own pending KPI allocation',
      'Own approved KPI allocation',
      'Own rejected KPI allocation',
      'Own legacy active KPI allocation',
      'Other member published KPI allocation',
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'ACTIVE allocation',
      'Other Staff',
      'group total',
      'manager note',
      'approval note',
      'submittedByActorId',
      'approvedByActorId',
      'publishedByActorId',
      'payroll',
      'bonus',
      'commission',
      'finance',
      'commercial',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }

    expect(
      screen.queryByRole('button', {
        name: /enter|actual|correct|correction|approve|publish|submit|reject|edit|request/i,
      }),
    ).toBeNull();
  });

  it('renders My KPI empty, loading, and error states safely', async () => {
    await renderRoute('/self-service', () => setMockSelfServiceKpi([]));

    expect(await screen.findByText('No official KPI')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'No published KPI allocation is available for your linked internal Talent yet.',
      ),
    ).toBeInTheDocument();

    let resolveKpi: () => void = () => {};
    const pendingKpi = new Promise<void>((resolve) => {
      resolveKpi = resolve;
    });
    server.use(
      http.get('*/self-service/kpi', async () => {
        await pendingKpi;
        return HttpResponse.json({ data: { items: [] } });
      }),
    );

    await renderRoute('/self-service');
    expect(await screen.findByTestId('self-service-kpi-loading')).toBeInTheDocument();
    resolveKpi();
    await waitFor(() => {
      expect(screen.queryByTestId('self-service-kpi-loading')).not.toBeInTheDocument();
    });

    server.use(
      http.get('*/self-service/kpi', () => {
        return HttpResponse.json({ error: { code: 'TEST_ERROR' } }, { status: 500 });
      }),
    );

    await renderRoute('/self-service');
    expect(await screen.findByText('KPI unavailable')).toBeInTheDocument();
    expect(await screen.findByText('Your official KPI could not be loaded.')).toBeInTheDocument();
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
    let adminUserCalls = 0;
    server.use(
      http.get('*/admin/users*', () => {
        adminUserCalls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    await renderRoute('/self-service');

    expect(await screen.findByTestId('self-service-account-card')).toBeInTheDocument();
    expect(await screen.findByTestId('self-service-nav-account')).toHaveTextContent('Available');
    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(await screen.findByText('mina.staff@example.test')).toBeInTheDocument();
    expect(await screen.findByText('Linked')).toBeInTheDocument();
    expect(await screen.findByText('Asia/Saigon')).toBeInTheDocument();
    expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByRole('button', {
        name: /edit|save|change email|change password|reset password|setup/i,
      }),
    ).toBeNull();

    const bodyText = document.body.textContent ?? '';
    for (const forbidden of [
      'auth0|',
      'setupUrl',
      'ticketUrl',
      'resetUrl',
      'temporaryPassword',
      'credential',
      'session',
      'token',
      'cookie',
      'role:list',
      'scopeGrants',
      'legalName',
      'hrOwnerEmploymentProfileId',
      'recruiterEmploymentProfileId',
      'managerEmploymentProfileId',
      'orgUnitId',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }

    await waitFor(() => {
      expect(adminUserCalls).toBe(0);
    });
  });

  it('shows a logout button that uses the existing auth logout flow', async () => {
    await renderRoute('/self-service');

    const user = userEvent.setup();
    const logoutButton = await screen.findByRole('button', { name: 'Log out' });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(mockAuthAdapter.logoutRedirect).toHaveBeenCalledWith('/auth/login');
    });
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
