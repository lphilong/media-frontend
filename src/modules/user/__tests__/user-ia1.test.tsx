import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const unsafeSetupDisclosurePattern = new RegExp(
  'https?:\\/\\/|temporary' + 'Password|ticket' + 'Url',
  'u',
);

const createUserDetailResponse = (authLinkage: {
  provider: 'auth0';
  subject: string;
  status?: 'LINKED' | 'UNLINKED' | 'PENDING';
}) => ({
  data: {
    id: 'user-audit',
    accountStatus: 'ACTIVE',
    actorKind: 'ADMIN',
    authLinkage,
    contextAccess: {
      contexts: [{ context: 'ADMIN' }],
    },
    profile: {
      displayName: 'Audit User',
      email: 'audit@example.test',
      phone: null,
    },
    preferences: {
      locale: 'en',
      timezone: 'Asia/Saigon',
    },
    createdAt: 1,
    updatedAt: 2,
    activatedAt: 2,
    disabledAt: null,
    archivedAt: null,
  },
});

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  return renderAppWithProviders(<RouterProvider router={router} />, { queryClient });
};

describe('user IA-1 surfaces', () => {
  it('renders the constrained User list and ignores unsupported scope-shaped query keys', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/users?state=PENDING&actorKind=STAFF&scope=global&scopeGrants=admin');

    expect(
      await screen.findByRole('heading', { name: i18n.t('user:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Staff User', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('staff@example.test')).toBeInTheDocument();
    expect(screen.queryByText('Archived User')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /link employment profile/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|session/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('user:authLinkageStatuses.PENDING')).length).toBeGreaterThan(
      0,
    );
  });

  it('renders detail data from the User detail route and keeps forbidden mutation ownership absent', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/users/user-admin');

    expect(await screen.findByText(i18n.t('user:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('auth0|admin')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('user:detail.boundaryNotice'))).toBeInTheDocument();

    expect(screen.getByRole('button', { name: i18n.t('user:actions.edit') })).toBeEnabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.linkAuth0') })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: i18n.t('user:actions.sendPasswordSetup') }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.disable') })).toBeEnabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.archive') })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /employment profile/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|session/i)).not.toBeInTheDocument();
  });

  it('hides User actions when permissions are missing', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: ['user:view'],
            scopeGrants: {},
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/users/user-admin');

    await screen.findByText(i18n.t('user:actionRail.title'));
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: i18n.t('user:actions.edit') }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18n.t('user:actions.linkAuth0') }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18n.t('user:actions.sendPasswordSetup') }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18n.t('user:actions.convertActorKind') }),
      ).not.toBeInTheDocument();
    });
  });

  it('allows HR password setup capability without unlink or disable powers', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'hr-operations-user',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['HR_OPERATIONS'],
            permissions: ['user:view', 'user:password_setup:send'],
            scopeGrants: {},
            generatedAt: '2026-05-24T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/users/user-admin');

    const passwordSetup = await screen.findByRole('button', {
      name: i18n.t('user:actions.sendPasswordSetup'),
    });
    expect(passwordSetup).toBeEnabled();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: i18n.t('user:actions.unlinkAuth0') }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18n.t('user:actions.disable') }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText(unsafeSetupDisclosurePattern)).not.toBeInTheDocument();
  });

  it('still surfaces backend mutation 403 when capability hints allow the action', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    server.use(
      http.patch('*/admin/users/:userId', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Permission denied' } },
          { status: 403 },
        ),
      ),
    );

    renderRoute('/users/user-admin');

    await user.click(await screen.findByRole('button', { name: i18n.t('user:actions.edit') }));
    await user.clear(screen.getByLabelText(i18n.t('user:fields.displayName')));
    await user.type(screen.getByLabelText(i18n.t('user:fields.displayName')), 'Denied User');
    await user.click(screen.getByRole('button', { name: i18n.t('user:mutations.update.submit') }));

    expect(await screen.findByText('Permission denied')).toBeInTheDocument();
  });

  it('supports provision and lifecycle transition flows without User-owned Role assignment UI', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/users');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('user:actions.provisionAccount'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('user:mutations.provision.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const createSurfaceScope = within(createSurface);
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('user:fields.displayName')),
      'IA User',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('user:fields.email')),
      'ia-user@example.test',
    );
    await user.click(
      createSurfaceScope.getByRole('button', {
        name: i18n.t('user:mutations.provision.submit'),
      }),
    );

    expect(await screen.findByText(i18n.t('user:provisionResult.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('user:provisionResult.noTicketUrl'))).toBeInTheDocument();
    expect(screen.queryByText(unsafeSetupDisclosurePattern)).not.toBeInTheDocument();
    expect(await screen.findByText('IA User', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();

    const row = screen.getByText('IA User').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(within(row).getByRole('button', { name: i18n.t('user:actions.activate') }));
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('IA User').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }

        expect(within(refreshedRow).getByText(i18n.t('user:statuses.ACTIVE'))).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);

  it('converts actor kind with a required reason and shows success feedback', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/users/user-staff');

    await user.click(
      await screen.findByRole('button', { name: i18n.t('user:actions.convertActorKind') }),
    );

    const heading = await screen.findByRole('heading', {
      name: i18n.t('user:mutations.actorKind.title'),
    });
    const surface = heading.closest('section');
    expect(surface).not.toBeNull();
    if (!surface) {
      return;
    }

    await user.click(
      within(surface).getByRole('button', {
        name: i18n.t('user:mutations.actorKind.submit'),
      }),
    );
    expect(
      await within(surface).findByText(i18n.t('user:validation.required')),
    ).toBeInTheDocument();

    await user.type(
      within(surface).getByLabelText(i18n.t('user:fields.reason')),
      'Promote for HR console access',
    );
    await user.click(
      within(surface).getByRole('button', {
        name: i18n.t('user:mutations.actorKind.submit'),
      }),
    );

    expect(await screen.findByText(i18n.t('user:feedback.actorKindUpdated'))).toBeInTheDocument();
    expect(await screen.findAllByText(i18n.t('user:actorKinds.ADMIN'))).not.toHaveLength(0);
  });

  it('keeps User provision and identity/access filters inspectable when the list request fails', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/users', () =>
        HttpResponse.json({ message: 'errors:transport.generic' }, { status: 500 }),
      ),
    );

    renderRoute('/users?state=PENDING&actorKind=STAFF&search=staff');

    expect(await screen.findByText(i18n.t('user:states.loadErrorTitle'))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.t('user:filters.searchPlaceholder'))).toHaveValue(
      'staff',
    );
    expect(screen.getByRole('combobox', { name: i18n.t('user:filters.state') })).toHaveValue(
      'PENDING',
    );
    expect(screen.getByRole('combobox', { name: i18n.t('user:filters.actorKind') })).toHaveValue(
      'STAFF',
    );

    await user.click(screen.getByRole('button', { name: i18n.t('user:actions.provisionAccount') }));

    expect(
      await screen.findByRole('heading', { name: i18n.t('user:mutations.provision.title') }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();
  });

  it('keeps archived users read-only and hides unsupported admin surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/users/user-archived');

    expect(await screen.findByText(i18n.t('user:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('user:detail.archivedReadOnly'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.edit') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.linkAuth0') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.activate') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.disable') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('user:actions.archive') })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /assign role/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /employment profile/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|session/i)).not.toBeInTheDocument();
  });

  it('shows email-sent feedback for auth0_email password setup and never displays a setup URL', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/users/user-admin');

    await user.click(
      await screen.findByRole('button', { name: i18n.t('user:actions.sendPasswordSetup') }),
    );

    expect(
      await screen.findByText(i18n.t('user:feedback.passwordSetupEmailSent')),
    ).toBeInTheDocument();
    expect(screen.queryByText(unsafeSetupDisclosurePattern)).not.toBeInTheDocument();
  });

  it('shows neutral feedback for backend_ticket password setup and does not claim email delivery', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    server.use(
      http.post('*/admin/users/:userId/send-password-setup', ({ params }) =>
        HttpResponse.json({
          ...createUserDetailResponse({
            provider: 'auth0',
            subject: `auth0|${String(params.userId)}`,
            status: 'LINKED',
          }),
          meta: {
            passwordSetup: {
              deliveryMode: 'backend_ticket',
              emailSent: false,
              ticketCreated: true,
            },
          },
        }),
      ),
    );

    renderRoute('/users/user-admin');

    await user.click(
      await screen.findByRole('button', { name: i18n.t('user:actions.sendPasswordSetup') }),
    );

    expect(
      await screen.findByText(i18n.t('user:feedback.passwordSetupTicketCreated')),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('user:feedback.passwordSetupEmailSent')),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(unsafeSetupDisclosurePattern)).not.toBeInTheDocument();
  });

  it('shows neutral provision result copy for backend_ticket setup delivery', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    server.use(
      http.post('*/admin/users/provision', async ({ request }) => {
        const body = (await request.json()) as { displayName?: string; email?: string };

        return HttpResponse.json({
          data: {
            id: 'user-ticket-provision',
            accountStatus: 'PENDING',
            actorKind: 'STAFF',
            authLinkage: {
              provider: 'auth0',
              subject: 'auth0|ticket-provision',
              status: 'LINKED',
            },
            contextAccess: {
              contexts: [{ context: 'ADMIN' }],
            },
            profile: {
              displayName: body.displayName ?? 'Ticket Provision',
              email: body.email ?? 'ticket-provision@example.test',
              phone: null,
            },
            preferences: {
              locale: 'en',
              timezone: 'Asia/Saigon',
            },
            createdAt: 1,
            updatedAt: 2,
            activatedAt: null,
            disabledAt: null,
            archivedAt: null,
          },
          meta: {
            provisioning: {
              credentialMode: 'INVITE_LINK',
              auth0UserCreated: true,
              invitationEmailSent: false,
              invitationTicketCreated: true,
              passwordSetupDeliveryMode: 'backend_ticket',
            },
            passwordSetup: {
              deliveryMode: 'backend_ticket',
              emailSent: false,
              ticketCreated: true,
            },
          },
        });
      }),
    );

    renderRoute('/users');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('user:actions.provisionAccount'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('user:mutations.provision.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }

    const createSurfaceScope = within(createSurface);
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('user:fields.displayName')),
      'Ticket Provision',
    );
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('user:fields.email')),
      'ticket-provision@example.test',
    );
    await user.click(
      createSurfaceScope.getByRole('button', {
        name: i18n.t('user:mutations.provision.submit'),
      }),
    );

    expect(
      await screen.findByText(i18n.t('user:provisionResult.passwordSetupTicketCreated')),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('user:provisionResult.passwordSetupEmailSent')),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(unsafeSetupDisclosurePattern)).not.toBeInTheDocument();
  });

  it('disables password setup for unlinked users and does not call the API', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    let passwordSetupCalls = 0;
    server.use(
      http.get('*/admin/users/user-audit', () =>
        HttpResponse.json(
          createUserDetailResponse({
            provider: 'auth0',
            subject: 'unlinked:user-audit',
            status: 'UNLINKED',
          }),
        ),
      ),
      http.post('*/admin/users/:userId/send-password-setup', () => {
        passwordSetupCalls += 1;
        return HttpResponse.json({ message: 'unexpected password setup call' }, { status: 500 });
      }),
    );

    renderRoute('/users/user-audit');

    const passwordSetup = await screen.findByRole('button', {
      name: i18n.t('user:actions.sendPasswordSetup'),
    });
    expect(passwordSetup).toBeDisabled();
    await waitFor(() =>
      expect(passwordSetup).toHaveAccessibleDescription(
        i18n.t('common:capabilities.invalidStatus'),
      ),
    );

    await user.click(passwordSetup);
    expect(passwordSetupCalls).toBe(0);
  });

  it('disables password setup for pending and missing linkage status without API calls', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    let passwordSetupCalls = 0;
    const detailById = {
      'user-pending-linkage': createUserDetailResponse({
        provider: 'auth0',
        subject: 'auth0|pending',
        status: 'PENDING',
      }),
      'user-missing-linkage-status': createUserDetailResponse({
        provider: 'auth0',
        subject: 'auth0|missing-status',
      }),
    } as const;
    server.use(
      http.get('*/admin/users/:userId', ({ params }) => {
        const response = detailById[String(params.userId) as keyof typeof detailById];
        if (!response) {
          return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
        }

        return HttpResponse.json(response);
      }),
      http.post('*/admin/users/:userId/send-password-setup', () => {
        passwordSetupCalls += 1;
        return HttpResponse.json({ message: 'unexpected password setup call' }, { status: 500 });
      }),
    );

    const pendingRender = renderRoute('/users/user-pending-linkage');

    const pendingPasswordSetup = await screen.findByRole('button', {
      name: i18n.t('user:actions.sendPasswordSetup'),
    });
    expect(pendingPasswordSetup).toBeDisabled();
    expect(pendingPasswordSetup).toHaveAccessibleDescription(
      i18n.t('common:capabilities.invalidStatus'),
    );
    await user.click(pendingPasswordSetup);
    pendingRender.unmount();

    renderRoute('/users/user-missing-linkage-status');

    const missingStatusPasswordSetup = await screen.findByRole('button', {
      name: i18n.t('user:actions.sendPasswordSetup'),
    });
    expect(missingStatusPasswordSetup).toBeDisabled();
    expect(missingStatusPasswordSetup).toHaveAccessibleDescription(
      i18n.t('common:capabilities.invalidStatus'),
    );
    await user.click(missingStatusPasswordSetup);

    expect(passwordSetupCalls).toBe(0);
  });

  it('links and unlinks Auth0 through backend-owned account routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/users/user-admin');

    await user.click(await screen.findByRole('button', { name: i18n.t('user:actions.linkAuth0') }));
    await user.clear(screen.getByLabelText(i18n.t('user:fields.authSubject')));
    await user.type(screen.getByLabelText(i18n.t('user:fields.authSubject')), 'auth0|ia-linked');
    await user.click(
      screen.getByRole('button', { name: i18n.t('user:mutations.authLinkage.submit') }),
    );

    expect(await screen.findByText('auth0|ia-linked')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: i18n.t('user:actions.unlinkAuth0') }));
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(() =>
      expect(
        screen.getAllByText(i18n.t('user:authLinkageStatuses.UNLINKED')).length,
      ).toBeGreaterThan(0),
    );
  });

  it('hides provisioning without permission', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: ['user:view'],
            scopeGrants: {},
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/users');

    await screen.findByRole('heading', { name: i18n.t('user:page.title') });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: i18n.t('user:actions.provisionAccount') }),
      ).not.toBeInTheDocument();
    });
  });

  it('fails identity actions closed when capabilities cannot be loaded', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({ message: 'denied' }, { status: 500 }),
      ),
    );

    renderRoute('/users/user-admin');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('user:actions.linkAuth0') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('user:actions.unlinkAuth0') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('user:actions.sendPasswordSetup') }),
    ).not.toBeInTheDocument();
  });
});
