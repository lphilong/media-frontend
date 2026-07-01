import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';
import { createRole, createRoleFromTemplate } from '@modules/role/api/role.api';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

const renderAssignmentTab = async (user: ReturnType<typeof userEvent.setup>) => {
  renderRoute('/roles');

  expect(
    await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
  ).toBeInTheDocument();
  await user.click(
    await screen.findByRole('tab', { name: i18n.t('role:tabs.assignments') }, { timeout: 3000 }),
  );
  expect(
    await screen.findByRole('heading', {
      name: i18n.t('role:accessAssignment.userTitle'),
    }),
  ).toBeInTheDocument();
};

const findPickerSurface = async (pickerId: string): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(
      screen
        .getAllByTestId('picker-surface')
        .some((surface) => surface.getAttribute('data-picker-id') === pickerId),
    ).toBe(true);
  });

  const picker = screen
    .getAllByTestId('picker-surface')
    .find((surface) => surface.getAttribute('data-picker-id') === pickerId);
  if (!picker) {
    throw new Error(`Picker not found: ${pickerId}`);
  }
  return picker;
};

const waitForDebounce = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 350);
  });
};

const successfulAccessAssignmentPreview = {
  previewOnly: true,
  canApply: true,
  blockers: [],
  warnings: [],
  normalizedScope: [{ scopeType: 'self' }],
  proposedAssignments: [{ roleCode: 'STAFF_CONSOLE_USER' }],
  effectiveAccessDelta: { addedPermissions: ['workSchedule.read'] },
};

const lifecycleAssignment = {
  assignmentId: 'assignment-alice-staff',
  targetUserId: 'user-alice',
  roleId: 'role-staff',
  roleCode: 'STAFF_CONSOLE_USER',
  roleName: 'Staff Console User',
  roleTemplateCode: 'STAFF_CONSOLE_USER',
  roleTemplateVersion: '2026-05-20',
  structuredScopeGrants: [{ scopeType: 'self' }],
  scopeFingerprint: 'self',
  status: 'ACTIVE',
  lifecycleState: 'ACTIVE',
  currentlyEffective: true,
  inactiveReason: null,
  effectiveAt: Date.UTC(2026, 4, 20),
  expiresAt: null,
  reviewAt: null,
  assignedBy: 'mock-admin',
  assignedAt: Date.UTC(2026, 4, 20),
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  origin: 'DIRECT',
  bundleOrigin: null,
  reason: 'Mock staff console access',
  sensitiveOrGlobal: false,
  supportedActions: ['REVOKE'],
  auditSummary: {
    assignmentId: 'assignment-alice-staff',
    action: 'ASSIGN',
    actorId: 'mock-admin',
    timestamp: Date.UTC(2026, 4, 20),
    reason: 'Mock staff console access',
    oldStatus: null,
    newStatus: 'ACTIVE',
  },
};

const completeSuccessfulPreviewAndApply = async (
  user: ReturnType<typeof userEvent.setup>,
  reason = 'Apply result classification coverage',
): Promise<void> => {
  await renderAssignmentTab(user);

  const userPicker = await findPickerSurface('role-access-assignment-linked-user');
  await user.type(
    within(userPicker).getByPlaceholderText(i18n.t('role:accessAssignment.userSearchPlaceholder')),
    'Al',
  );
  await user.click(await within(userPicker).findByText(/Alice Linked/u));
  await user.type(
    screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
    reason,
  );

  const previewButton = screen.getByRole('button', {
    name: i18n.t('role:accessAssignment.previewButton'),
  });
  const applyButton = screen.getByRole('button', {
    name: i18n.t('role:accessAssignment.applyButton'),
  });
  await user.click(previewButton);
  expect(
    await screen.findByText(i18n.t('role:accessAssignment.previewCanApply')),
  ).toBeInTheDocument();
  await waitFor(() => expect(applyButton).toBeEnabled());
  await user.click(applyButton);
};

const activeLinkedEmploymentProfile = {
  id: 'ep-linked-active',
  employeeCode: 'EP-LINKED-ACTIVE',
  legalName: 'Alice Nguyen',
  displayName: 'Alice Linked',
  employmentKind: 'FULL_TIME',
  jobTitle: 'Director',
  orgUnitId: 'ou-sales',
  orgUnitRef: { id: 'ou-sales', code: 'OU-SALES', name: 'Sales', status: 'ACTIVE' },
  recruiterEmploymentProfileId: null,
  recruiterEmploymentProfileRef: null,
  hrOwnerEmploymentProfileId: null,
  hrOwnerEmploymentProfileRef: null,
  onboardingOwnerEmploymentProfileId: null,
  onboardingOwnerEmploymentProfileRef: null,
  sourcedByEmploymentProfileId: null,
  sourcedByEmploymentProfileRef: null,
  linkedUserId: 'user-alice',
  linkedUserRef: {
    id: 'user-alice',
    displayName: 'Alice User',
    name: 'alice@example.test',
    status: 'ACTIVE',
  },
  employmentStatus: 'ACTIVE',
  contractStatus: 'ACTIVE',
  hiredAt: Date.UTC(2024, 0, 1),
  onboardedAt: Date.UTC(2024, 0, 8),
  createdAt: Date.UTC(2024, 0, 1),
};

const onLeaveLinkedEmploymentProfile = {
  ...activeLinkedEmploymentProfile,
  id: 'ep-linked-on-leave',
  employeeCode: 'EP-LINKED-LEAVE',
  legalName: 'Linh On Leave',
  displayName: 'Linh Linked',
  linkedUserId: 'user-linh',
  linkedUserRef: {
    id: 'user-linh',
    displayName: 'Linh User',
    name: 'linh@example.test',
    status: 'ACTIVE',
  },
  employmentStatus: 'ON_LEAVE',
};

const unlinkedEmploymentProfile = {
  ...activeLinkedEmploymentProfile,
  id: 'ep-unlinked-active',
  employeeCode: 'EP-UNLINKED',
  legalName: 'Bao Unlinked',
  displayName: 'Bao Unlinked',
  linkedUserId: null,
  linkedUserRef: null,
  employmentStatus: 'ACTIVE',
};

const suspendedEmploymentProfile = {
  ...activeLinkedEmploymentProfile,
  id: 'ep-linked-suspended',
  employeeCode: 'EP-SUSPENDED',
  legalName: 'Chau Suspended',
  displayName: 'Chau Suspended',
  linkedUserId: 'user-chau',
  linkedUserRef: {
    id: 'user-chau',
    displayName: 'Chau User',
    name: 'chau@example.test',
    status: 'ACTIVE',
  },
  employmentStatus: 'SUSPENDED',
};

describe('role IA-1 surfaces', () => {
  it('renders the constrained Role list and ignores unsupported scope-shaped query keys', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles?state=ACTIVE&search=Admin&scope=global&scopeGrants=admin&sortBy=name');

    expect(
      await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('ADMIN', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('role:states.ACTIVE')).length).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t('common:pagination.cursorDisclosure'))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('common:pagination.goToPage'))).not.toBeInTheDocument();
    expect(screen.getByText('Admin role')).toBeInTheDocument();
    expect(screen.queryByText('Archived role')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|password|session/i)).not.toBeInTheDocument();
  });

  it('renders the AUTH-4B Role tabs under a single Vai trò sidebar entry', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/roles');

    expect(
      await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: i18n.t('role:tabs.templates') }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('nav-link-roles')).toHaveLength(1));
    expect(screen.queryByTestId('nav-link-role-templates')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-role-bundles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-link-role-assignments')).not.toBeInTheDocument();

    expect(screen.getByRole('tab', { name: i18n.t('role:tabs.bundles') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: i18n.t('role:tabs.assignments') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: i18n.t('role:tabs.userAccess') })).toBeInTheDocument();
    expect(screen.queryByText(/role:view/u)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: i18n.t('role:tabs.bundles') }));
    await waitFor(() =>
      expect(screen.getAllByText('Quản trị chủ sở hữu').length).toBeGreaterThan(0),
    );
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: i18n.t('role:tabs.assignments') }));
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('role:accessAssignment.userTitle'),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:mutations.assignToUser.submit') }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: i18n.t('role:tabs.userAccess') }));
    expect(await screen.findByText(i18n.t('role:userAccess.emptyTitle'))).toBeInTheDocument();
  });

  it('supports user-first access assignment preview and apply without frontend-owned authority fields', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/roles');

    expect(
      await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('tab', { name: i18n.t('role:tabs.assignments') }));
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('role:accessAssignment.userTitle'),
      }),
    ).toBeInTheDocument();

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    expect(
      await within(userPicker).findByText(i18n.t('role:accessAssignment.userSearchMinLength')),
    ).toBeInTheDocument();
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Al',
    );
    await within(userPicker).findByText(/Alice/u);
    expect(within(userPicker).queryByText(/Bao/u)).not.toBeInTheDocument();
    expect(within(userPicker).queryByText(/Chau/u)).not.toBeInTheDocument();
    await user.click(within(userPicker).getByText(/Alice/u));

    const previewButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.previewButton'),
    });
    const applyButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.applyButton'),
    });
    expect(previewButton).toBeDisabled();
    expect(applyButton).toBeDisabled();
    expect(screen.queryByLabelText(/accountContext/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/workspaceAvailability/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/actorKind/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/manual entitlement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw json/i)).not.toBeInTheDocument();

    const reasonInput = screen.getByPlaceholderText(
      i18n.t('role:accessAssignment.reasonPlaceholder'),
    );
    await user.type(reasonInput, 'BATCH 4C assignment coverage');
    expect(previewButton).toBeEnabled();
    await user.click(previewButton);
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.previewBlocked')),
    ).toBeInTheDocument();
    await waitFor(() => expect(applyButton).toBeDisabled());

    const targetSelect = screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    const staffOption = within(targetSelect).getByRole('option', { name: /Staff Console/u });
    await user.selectOptions(targetSelect, staffOption);
    await waitFor(() => expect(applyButton).toBeDisabled());
    await user.click(previewButton);
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.previewCanApply')),
    ).toBeInTheDocument();
    await waitFor(() => expect(applyButton).toBeEnabled());

    await user.type(reasonInput, ' updated');
    await waitFor(() => expect(applyButton).toBeDisabled());
    await user.click(previewButton);
    await waitFor(() => expect(applyButton).toBeEnabled());
    await user.click(applyButton);

    expect(
      await screen.findByText(i18n.t('role:accessAssignment.resultTitle')),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:accessAssignment.resultApplied'))).toBeInTheDocument();
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.feedback.applied')),
    ).toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('role:accessAssignment.auditTrace')).length).toBeGreaterThan(
      0,
    );
  }, 25_000);

  it('lists target-user assignments and revokes through the canonical lifecycle endpoint only', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const revokePayloads: Array<Record<string, unknown>> = [];

    server.use(
      http.post('*/admin/access-assignments/:assignmentId/revoke', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        revokePayloads.push(body);

        return HttpResponse.json({
          data: {
            revoked: true,
            lifecycleStatus: 'REVOKED',
            blockers: [],
            warnings: [],
            assignment: {
              ...lifecycleAssignment,
              assignmentId: String(params.assignmentId),
              status: 'REVOKED',
              lifecycleState: 'REVOKED',
              currentlyEffective: false,
              inactiveReason: 'REVOKED',
              revokedAt: Date.UTC(2026, 5, 1),
              revokedBy: 'user-admin',
              revokeReason: String(body.reason),
              supportedActions: [],
              auditSummary: {
                assignmentId: String(params.assignmentId),
                action: 'REVOKE',
                actorId: 'user-admin',
                timestamp: Date.UTC(2026, 5, 1),
                reason: String(body.reason),
                oldStatus: 'ACTIVE',
                newStatus: 'REVOKED',
              },
            },
            auditTrace: {
              written: true,
              lifecycleAction: 'REVOKE',
              actorId: 'user-admin',
              assignmentId: String(params.assignmentId),
              targetUserId: 'user-alice',
              oldStatus: 'ACTIVE',
              newStatus: 'REVOKED',
              reason: String(body.reason),
              timestamp: Date.UTC(2026, 5, 1),
            },
            sourceTrace: {
              mutatesSource: true,
              source: 'role_assignments',
              auditSource: 'audit_log',
            },
            effectiveAccessAfterLifecycle: { permissions: [] },
          },
        });
      }),
    );

    await renderAssignmentTab(user);

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Al',
    );
    await user.click(await within(userPicker).findByText(/Alice/u));

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('role:accessAssignment.lifecycle.title'),
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Staff Console User')).toBeInTheDocument();
    expect(screen.getAllByText(/Mock staff console access/u).length).toBeGreaterThan(0);
    expect(screen.getByText(/ASSIGN/u)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('role:accessAssignment.lifecycle.revokeButton'),
      }),
    );
    const confirmButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.lifecycle.confirmRevoke'),
    });
    expect(confirmButton).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText(
        i18n.t('role:accessAssignment.lifecycle.revokeReasonPlaceholder'),
      ),
      'Access no longer required',
    );
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() => expect(revokePayloads).toHaveLength(1));
    expect(revokePayloads[0]).toEqual({ reason: 'Access no longer required' });
    expect(revokePayloads[0]).not.toHaveProperty('actorKind');
    expect(revokePayloads[0]).not.toHaveProperty('accountContext');
    expect(revokePayloads[0]).not.toHaveProperty('workspaceAvailability');
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.lifecycle.feedback.revoked')),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:accessAssignment.lifecycle.revoked'))).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.lifecycle.effectiveAfterRevoke')),
    ).toBeInTheDocument();
  }, 20_000);

  it('renders blocked lifecycle revoke results without success feedback', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    server.use(
      http.post('*/admin/access-assignments/:assignmentId/revoke', async ({ params }) =>
        HttpResponse.json({
          data: {
            revoked: false,
            lifecycleStatus: 'BLOCKED',
            blockers: [
              {
                severity: 'BLOCKER',
                code: 'ASSIGNMENT_ALREADY_INACTIVE',
                summary: 'Assignment is already inactive.',
              },
            ],
            warnings: [],
            assignment: {
              ...lifecycleAssignment,
              assignmentId: String(params.assignmentId),
            },
            auditTrace: {
              written: false,
              reason: 'LIFECYCLE_REVOKE_BLOCKED_BEFORE_MUTATION',
            },
            sourceTrace: {
              mutatesSource: false,
              source: 'role_assignments',
            },
          },
        }),
      ),
    );

    await renderAssignmentTab(user);

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Al',
    );
    await user.click(await within(userPicker).findByText(/Alice/u));
    await screen.findByText('Staff Console User');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('role:accessAssignment.lifecycle.revokeButton'),
      }),
    );
    await user.type(
      screen.getByPlaceholderText(
        i18n.t('role:accessAssignment.lifecycle.revokeReasonPlaceholder'),
      ),
      'Already gone',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('role:accessAssignment.lifecycle.confirmRevoke'),
      }),
    );

    expect(await screen.findByText('Assignment is already inactive.')).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.lifecycle.revokeBlocked')),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.lifecycle.feedback.revoked')),
    ).not.toBeInTheDocument();
  }, 20_000);

  it('does not load a full user list or fallback to /admin/users before operator search', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const userListRequests: URL[] = [];
    const employmentProfileRequests: URL[] = [];

    server.use(
      http.get('*/admin/users', ({ request }) => {
        userListRequests.push(new URL(request.url));
        return HttpResponse.json({ data: [], meta: {} });
      }),
      http.get('*/admin/employment-profiles', ({ request }) => {
        employmentProfileRequests.push(new URL(request.url));
        return HttpResponse.json({ data: [], meta: {} });
      }),
    );

    await renderAssignmentTab(user);

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    expect(
      await within(userPicker).findByText(i18n.t('role:accessAssignment.userSearchMinLength')),
    ).toBeInTheDocument();
    expect(
      within(userPicker).getByText(i18n.t('role:accessAssignment.userSearchEmpty')),
    ).toBeInTheDocument();
    expect(userListRequests).toHaveLength(0);
    expect(employmentProfileRequests).toHaveLength(0);
  });

  it('requires minimum search length and uses linked eligible EmploymentProfile queries only', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const userListRequests: URL[] = [];
    const employmentProfileRequests: URL[] = [];

    server.use(
      http.get('*/admin/users', ({ request }) => {
        userListRequests.push(new URL(request.url));
        return HttpResponse.json({ data: [], meta: {} });
      }),
      http.get('*/admin/employment-profiles', ({ request }) => {
        const url = new URL(request.url);
        employmentProfileRequests.push(url);
        const status = url.searchParams.get('employmentStatus');
        const data =
          status === 'ACTIVE'
            ? [activeLinkedEmploymentProfile]
            : status === 'ON_LEAVE'
              ? [onLeaveLinkedEmploymentProfile]
              : [];
        return HttpResponse.json({ data, meta: {} });
      }),
    );

    await renderAssignmentTab(user);

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    const searchInput = within(userPicker).getByPlaceholderText(
      i18n.t('role:accessAssignment.userSearchPlaceholder'),
    );
    await user.type(searchInput, 'A');
    await user.click(
      within(userPicker).getByRole('button', { name: i18n.t('common:actions.search') }),
    );
    await waitForDebounce();
    expect(employmentProfileRequests).toHaveLength(0);
    expect(userListRequests).toHaveLength(0);

    await user.type(searchInput, 'l');
    await user.click(
      within(userPicker).getByRole('button', { name: i18n.t('common:actions.search') }),
    );

    await within(userPicker).findByText(/Alice Linked/u);
    await within(userPicker).findByText(/Linh Linked/u);
    await waitFor(() => expect(employmentProfileRequests.length).toBeGreaterThanOrEqual(2));

    const statuses = employmentProfileRequests.map((url) =>
      url.searchParams.get('employmentStatus'),
    );
    expect(statuses).toEqual(expect.arrayContaining(['ACTIVE', 'ON_LEAVE']));
    expect(
      employmentProfileRequests.every(
        (url) =>
          url.searchParams.get('hasLinkedUser') === 'true' &&
          url.searchParams.get('search') === 'Al' &&
          url.searchParams.get('limit') === '20',
      ),
    ).toBe(true);
    expect(userListRequests).toHaveLength(0);
  }, 15_000);

  it('selects only linked eligible EmploymentProfiles and maps selection to targetUserId', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const userListRequests: URL[] = [];
    const previewPayloads: Array<Record<string, unknown>> = [];
    const applyPayloads: Array<Record<string, unknown>> = [];

    server.use(
      http.get('*/admin/users', ({ request }) => {
        userListRequests.push(new URL(request.url));
        return HttpResponse.json({ data: [], meta: {} });
      }),
      http.get('*/admin/employment-profiles', ({ request }) => {
        const status = new URL(request.url).searchParams.get('employmentStatus');
        return HttpResponse.json({
          data: status === 'ACTIVE' ? [activeLinkedEmploymentProfile] : [],
          meta: {},
        });
      }),
      http.post('*/admin/access-assignments/preview', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        previewPayloads.push(body);
        return HttpResponse.json({
          data: {
            previewOnly: true,
            canApply: true,
            blockers: [],
            warnings: [],
            normalizedScope: [{ scopeType: 'self' }],
            proposedAssignments: [{ roleCode: 'STAFF_CONSOLE_USER' }],
            effectiveAccessDelta: { addedPermissions: ['workSchedule.read'] },
          },
        });
      }),
      http.post('*/admin/access-assignments/apply', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        applyPayloads.push(body);
        return HttpResponse.json({
          data: {
            applied: true,
            canApply: true,
            applyStatus: 'APPLIED',
            blockers: [],
            warnings: [],
            normalizedScope: [{ scopeType: 'self' }],
            appliedAssignments: [{ assignmentId: 'assignment-linked' }],
            auditTrace: { assignmentIds: ['assignment-linked'] },
            effectiveAccessAfterApply: { permissions: ['workSchedule.read'] },
          },
        });
      }),
    );

    await renderAssignmentTab(user);

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Al',
    );
    await within(userPicker).findByText(/Alice Linked/u);
    expect(within(userPicker).getByText(/EP-LINKED-ACTIVE/u)).toBeInTheDocument();
    expect(within(userPicker).getByText(/Director/u)).toBeInTheDocument();
    expect(within(userPicker).getByText(/Sales/u)).toBeInTheDocument();
    expect(within(userPicker).getByText(/ACTIVE/u)).toBeInTheDocument();
    await user.click(within(userPicker).getByText(/Alice Linked/u));

    await user.type(
      screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
      'Linked profile assignment',
    );
    const previewButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.previewButton'),
    });
    const applyButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.applyButton'),
    });
    await user.click(previewButton);
    await waitFor(() => expect(applyButton).toBeEnabled());
    await user.click(applyButton);

    await screen.findByText(i18n.t('role:accessAssignment.resultApplied'));
    expect(previewPayloads.at(-1)).toMatchObject({
      targetUserId: 'user-alice',
      assignmentTargetType: 'BUNDLE',
    });
    expect(applyPayloads.at(-1)).toMatchObject({
      targetUserId: 'user-alice',
      assignmentTargetType: 'BUNDLE',
    });
    expect(previewPayloads.at(-1)).not.toHaveProperty('employmentProfileId');
    expect(applyPayloads.at(-1)).not.toHaveProperty('employmentProfileId');
    expect(userListRequests).toHaveLength(0);
  }, 20_000);

  it('does not allow unlinked, raw user, or suspended candidates to be selected', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const userListRequests: URL[] = [];
    const employmentProfileRequests: URL[] = [];

    server.use(
      http.get('*/admin/users', ({ request }) => {
        userListRequests.push(new URL(request.url));
        return HttpResponse.json({
          data: [
            {
              id: 'raw-user',
              displayName: 'Raw User',
              email: 'raw@example.test',
              actorKind: 'STAFF',
              accountStatus: 'ACTIVE',
              authLinkage: { status: 'UNLINKED' },
              updatedAt: Date.now(),
            },
          ],
          meta: {},
        });
      }),
      http.get('*/admin/employment-profiles', ({ request }) => {
        const url = new URL(request.url);
        employmentProfileRequests.push(url);
        return HttpResponse.json({
          data: [unlinkedEmploymentProfile, suspendedEmploymentProfile].filter(
            (profile) =>
              (!url.searchParams.get('employmentStatus') ||
                profile.employmentStatus === url.searchParams.get('employmentStatus')) &&
              (url.searchParams.get('hasLinkedUser') !== 'true' || Boolean(profile.linkedUserId)),
          ),
          meta: {},
        });
      }),
    );

    await renderAssignmentTab(user);

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Ba',
    );
    await waitForDebounce();
    expect(within(userPicker).queryByText(/Bao Unlinked/u)).not.toBeInTheDocument();
    expect(within(userPicker).queryByText(/Raw User/u)).not.toBeInTheDocument();
    expect(userListRequests).toHaveLength(0);

    await user.clear(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
    );
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Ch',
    );
    await waitForDebounce();
    expect(within(userPicker).queryByText(/Chau Suspended/u)).not.toBeInTheDocument();
    expect(
      employmentProfileRequests.every((url) =>
        ['ACTIVE', 'ON_LEAVE'].includes(url.searchParams.get('employmentStatus') ?? ''),
      ),
    ).toBe(true);
  }, 15_000);

  it('omits true legacy/non-assignable targets while keeping canonical role targets visible', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const previewPayloads: Array<Record<string, unknown>> = [];

    server.use(
      http.get('*/admin/access-assignments/targets', () =>
        HttpResponse.json({
          data: {
            readOnly: true,
            unrestrictedUserListReturned: false,
            searchFirstUserPickerRequired: true,
            eligibleUsersReturned: false,
            userListReturned: false,
            frontendSettableFields: [
              'targetUserId',
              'assignmentTargetType',
              'assignmentTargetCode',
              'bundleVersion',
              'structuredScopeGrants',
              'reason',
            ],
            frontendSettableAuthorityFields: [],
            backendOwnedAuthorityFields: ['accountContext', 'workspaceAvailability', 'actorKind'],
            assignmentTargets: [
              {
                assignmentKind: 'BUNDLE',
                code: 'STAFF_CONSOLE_BUNDLE',
                version: '2026-05-20',
                name: 'Staff Console',
                childRoles: ['STAFF_CONSOLE_USER'],
                recommendedAccountContext: 'STAFF_CONSOLE',
                requiredScopeTypes: ['self'],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'BUNDLE',
                code: 'AUDITOR_BUNDLE',
                version: '2026-05-20',
                name: 'Auditor',
                childRoles: ['VIEWER_AUDITOR'],
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: ['global'],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              ...['ADMIN_FULL', 'TEAM_MANAGER', 'COMMERCIAL_FINANCE', 'TALENT_STAFF_SELF'].map(
                (code) => ({
                  assignmentKind: 'ROLE_TEMPLATE',
                  code,
                  name: `Legacy ${code}`,
                  recommendedAccountContext: 'ADMIN_CONSOLE',
                  requiredScopeTypes: ['global'],
                  requiresResponsibility: false,
                  requiredResponsibilityType: null,
                  sensitiveLevel: 'STANDARD',
                  legacyAssignable: false,
                  recommendedPickerMode: 'SEARCH_FIRST',
                }),
              ),
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'HR_OPERATIONS',
                name: 'HR Operations',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: ['global'],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'PRODUCTION_OPS',
                name: 'Production Ops',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: ['global'],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'VIEWER_AUDITOR',
                name: 'Viewer Auditor',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: ['attendancePeriodOrg'],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                recommendedPickerMode: 'SEARCH_FIRST',
              },
            ],
            previewRemainsAuthoritative: true,
          },
        }),
      ),
      http.get('*/admin/employment-profiles', () =>
        HttpResponse.json({ data: [activeLinkedEmploymentProfile], meta: {} }),
      ),
      http.post('*/admin/access-assignments/preview', async ({ request }) => {
        previewPayloads.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ data: { canApply: true, blockers: [], warnings: [] } });
      }),
    );

    await renderAssignmentTab(user);

    const targetSelect = await screen.findByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    expect(within(targetSelect).getByRole('option', { name: /Auditor/u })).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.legacyTargetsHidden')),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('role:accessAssignment.roleMode') }),
    );
    const roleTargetSelect = screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    expect(
      within(roleTargetSelect).getByRole('option', { name: /HR Operations/u }),
    ).toBeInTheDocument();
    expect(
      within(roleTargetSelect).getByRole('option', { name: /Production Ops/u }),
    ).toBeInTheDocument();
    expect(
      within(roleTargetSelect).getByRole('option', { name: /Viewer Auditor/u }),
    ).toBeInTheDocument();
    for (const code of ['ADMIN_FULL', 'TEAM_MANAGER', 'COMMERCIAL_FINANCE', 'TALENT_STAFF_SELF']) {
      expect(
        within(roleTargetSelect).queryByRole('option', { name: new RegExp(code, 'u') }),
      ).not.toBeInTheDocument();
    }
    await user.selectOptions(roleTargetSelect, 'ROLE_TEMPLATE:VIEWER_AUDITOR:');
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.scopeUnavailable')),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/json/i)).not.toBeInTheDocument();

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Al',
    );
    await user.click(await within(userPicker).findByText(/Alice Linked/u));
    await user.type(
      screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
      'Unsupported scope coverage',
    );
    const previewButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.previewButton'),
    });
    expect(previewButton).toBeDisabled();
    expect(previewPayloads).toHaveLength(0);
  }, 20_000);

  it('renders backend apply blockers after a successful preview without showing success', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    server.use(
      http.get('*/admin/employment-profiles', () =>
        HttpResponse.json({ data: [activeLinkedEmploymentProfile], meta: {} }),
      ),
      http.post('*/admin/access-assignments/preview', () =>
        HttpResponse.json({
          data: {
            previewOnly: true,
            canApply: true,
            blockers: [],
            warnings: [],
            normalizedScope: [{ scopeType: 'self' }],
            proposedAssignments: [{ roleCode: 'STAFF_CONSOLE_USER' }],
            effectiveAccessDelta: { addedPermissions: ['workSchedule.read'] },
          },
        }),
      ),
      http.post('*/admin/access-assignments/apply', () =>
        HttpResponse.json({
          data: {
            applied: false,
            canApply: false,
            applyStatus: 'BLOCKED',
            blockers: [
              {
                severity: 'BLOCKER',
                code: 'SOURCE_CHANGED_AFTER_PREVIEW',
                summary: 'Source changed after preview.',
              },
            ],
            warnings: [],
            normalizedScope: [{ scopeType: 'self' }],
            appliedAssignments: [],
            auditTrace: { written: false, reason: 'SOURCE_CHANGED_AFTER_PREVIEW' },
          },
        }),
      ),
    );

    await renderAssignmentTab(user);

    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Al',
    );
    await user.click(await within(userPicker).findByText(/Alice Linked/u));
    await user.type(
      screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
      'Apply blocker coverage',
    );

    const previewButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.previewButton'),
    });
    const applyButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.applyButton'),
    });
    await user.click(previewButton);
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.previewCanApply')),
    ).toBeInTheDocument();
    await waitFor(() => expect(applyButton).toBeEnabled());
    await user.click(applyButton);

    expect(
      await screen.findByText(i18n.t('role:accessAssignment.resultBlocked')),
    ).toBeInTheDocument();
    expect(screen.getByText('Source changed after preview.')).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.resultApplied')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.feedback.applied')),
    ).not.toBeInTheDocument();
  }, 20_000);

  it.each([
    ['empty', ''],
    ['unknown', 'QUEUED'],
  ])(
    'does not show success for applied responses with %s applyStatus',
    async (_label, applyStatus) => {
      await setLocale(DEFAULT_LOCALE);
      const user = userEvent.setup();

      server.use(
        http.get('*/admin/employment-profiles', () =>
          HttpResponse.json({ data: [activeLinkedEmploymentProfile], meta: {} }),
        ),
        http.post('*/admin/access-assignments/preview', () =>
          HttpResponse.json({ data: successfulAccessAssignmentPreview }),
        ),
        http.post('*/admin/access-assignments/apply', () =>
          HttpResponse.json({
            data: {
              applied: true,
              canApply: true,
              applyStatus,
              blockers: [],
              warnings: [],
              normalizedScope: [{ scopeType: 'self' }],
              appliedAssignments: [{ assignmentId: 'assignment-malformed-status' }],
              auditTrace: { assignmentIds: ['assignment-malformed-status'] },
              effectiveAccessAfterApply: { permissions: ['workSchedule.read'] },
            },
          }),
        ),
      );

      await completeSuccessfulPreviewAndApply(user);

      expect(
        await screen.findByText(i18n.t('role:accessAssignment.resultBlocked')),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(i18n.t('role:accessAssignment.resultApplied')),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(i18n.t('role:accessAssignment.feedback.applied')),
      ).not.toBeInTheDocument();
    },
    20_000,
  );

  it('does not show success when applyStatus is missing from an applied response', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const applyRequests: URL[] = [];

    server.use(
      http.get('*/admin/employment-profiles', () =>
        HttpResponse.json({ data: [activeLinkedEmploymentProfile], meta: {} }),
      ),
      http.post('*/admin/access-assignments/preview', () =>
        HttpResponse.json({ data: successfulAccessAssignmentPreview }),
      ),
      http.post('*/admin/access-assignments/apply', ({ request }) => {
        applyRequests.push(new URL(request.url));
        return HttpResponse.json({
          data: {
            applied: true,
            canApply: true,
            blockers: [],
            warnings: [],
            normalizedScope: [{ scopeType: 'self' }],
            appliedAssignments: [{ assignmentId: 'assignment-missing-status' }],
            auditTrace: { assignmentIds: ['assignment-missing-status'] },
            effectiveAccessAfterApply: { permissions: ['workSchedule.read'] },
          },
        });
      }),
    );

    await completeSuccessfulPreviewAndApply(user);

    await waitFor(() => expect(applyRequests).toHaveLength(1));
    await screen.findByRole('button', {
      name: i18n.t('role:accessAssignment.applyButton'),
    });
    expect(screen.queryByText(i18n.t('role:accessAssignment.resultTitle'))).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.resultApplied')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.feedback.applied')),
    ).not.toBeInTheDocument();
  }, 20_000);

  it('does not show success when an APPLIED response includes blockers', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    server.use(
      http.get('*/admin/employment-profiles', () =>
        HttpResponse.json({ data: [activeLinkedEmploymentProfile], meta: {} }),
      ),
      http.post('*/admin/access-assignments/preview', () =>
        HttpResponse.json({ data: successfulAccessAssignmentPreview }),
      ),
      http.post('*/admin/access-assignments/apply', () =>
        HttpResponse.json({
          data: {
            applied: true,
            canApply: false,
            applyStatus: 'APPLIED',
            blockers: [
              {
                severity: 'BLOCKER',
                code: 'APPLY_RESULT_CONFLICT',
                summary: 'Apply result conflict.',
              },
            ],
            warnings: [],
            normalizedScope: [{ scopeType: 'self' }],
            appliedAssignments: [{ assignmentId: 'assignment-blocked-applied' }],
            auditTrace: { written: false, reason: 'APPLY_RESULT_CONFLICT' },
            effectiveAccessAfterApply: { permissions: ['workSchedule.read'] },
          },
        }),
      ),
    );

    await completeSuccessfulPreviewAndApply(user);

    expect(
      await screen.findByText(i18n.t('role:accessAssignment.resultBlocked')),
    ).toBeInTheDocument();
    expect(screen.getByText(/Apply result conflict/u)).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.resultApplied')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.feedback.applied')),
    ).not.toBeInTheDocument();
  }, 20_000);

  it('renders Role detail without calling the old role-scoped assignment list', async () => {
    await setLocale(DEFAULT_LOCALE);
    let oldAssignmentListRequests = 0;
    server.use(
      http.get('*/admin/roles/:roleId/assignments', () => {
        oldAssignmentListRequests += 1;
        return HttpResponse.json(
          { message: 'ROLE_ASSIGNMENT_LIST is superseded' },
          { status: 410 },
        );
      }),
    );

    renderRoute('/roles/role-admin?state=ACTIVE&scope=global');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('Admin role')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:detail.permissionMatrixTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:templates.basedOnTemplate'))).toBeInTheDocument();
    expect(screen.getByText(/Quản trị chủ sở hữu \(OWNER_ADMIN\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/Quản trị vai trò/u).length).toBeGreaterThan(0);
    expect(screen.queryByText(/role:view/u)).not.toBeInTheDocument();
    expect(screen.queryByText('assignment-1')).not.toBeInTheDocument();

    expect(screen.queryByText('user-admin')).not.toBeInTheDocument();
    expect(oldAssignmentListRequests).toBe(0);
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.revokeAssignment') }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set auth0 linkage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /user lifecycle/i })).not.toBeInTheDocument();
  });

  it('hides Role actions when permissions are missing', async () => {
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
            permissions: ['role:view', 'role:assignment:view'],
            scopeGrants: {},
            accountContexts: ['ADMIN_CONSOLE'],
            workspaceAvailability: {
              primaryWorkspace: 'ADMIN_CONSOLE',
              availableWorkspaces: [
                {
                  context: 'STAFF_CONSOLE',
                  available: false,
                  source: 'ACCOUNT_CONTEXT',
                  reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
                  trace: [],
                },
                {
                  context: 'MANAGER_CONSOLE',
                  available: false,
                  source: 'ACCOUNT_CONTEXT',
                  reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
                  trace: [],
                },
                {
                  context: 'ADMIN_CONSOLE',
                  available: true,
                  source: 'ACCOUNT_CONTEXT',
                  reasonCodes: ['ACCOUNT_CONTEXT_ACTIVE'],
                  trace: [],
                },
              ],
              ownDataAvailable: false,
              managerResponsibilitiesAvailable: false,
              effectiveAccessTraceAvailable: true,
              sourceTrace: [],
            },
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/roles/role-admin');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: i18n.t('role:actions.edit') }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: i18n.t('role:fields.permissions') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: i18n.t('role:fields.assignmentRules') }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/replace permissions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/replace assignment rules/i)).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.revokeAssignment') }),
    ).not.toBeInTheDocument();
  });

  it('does not expose Role detail as the primary assignment or revoke workflow', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles/role-admin');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.revokeAssignment') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: i18n.t('role:mutations.assignToUser.title') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: i18n.t('role:mutations.revokeAssignment.title') }),
    ).not.toBeInTheDocument();
  });

  it('shows Custom fallback when template metadata is absent', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles/role-draft');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('Operations role')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:templates.custom'))).toBeInTheDocument();
  });

  it('keeps archived roles immutable and excludes scope, rename, and User mutation controls', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/roles/role-archived');

    expect(await screen.findByText(i18n.t('role:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:detail.archivedReadOnly'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.edit') })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('role:actions.edit') }),
    ).toHaveAccessibleDescription(i18n.t('common:capabilities.invalidStatus'));
    expect(
      screen.queryByRole('textbox', { name: i18n.t('role:fields.permissions') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: i18n.t('role:fields.assignmentRules') }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/replace permissions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/replace assignment rules/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:actions.assignToUser') }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.activate') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.deactivate') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('role:actions.archive') })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /grant scope/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rename permission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /set auth0 linkage/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/credential|token|password|session/i)).not.toBeInTheDocument();
  });
});

describe('role MSW create code behavior', () => {
  it('rejects duplicate manual Role code on create using backend-like normalization', async () => {
    await expect(
      createRole({
        name: 'Duplicate admin code',
        code: ' admin ',
        description: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ROLE_CONFLICT',
      message: 'Role code already exists: ADMIN',
    });
  });

  it('rejects duplicate manual Role code on create-from-template', async () => {
    await expect(
      createRoleFromTemplate({
        templateCode: 'TALENT_GROUP_MANAGER',
        name: 'Duplicate template code',
        code: 'ops',
        description: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ROLE_CONFLICT',
      message: 'Role code already exists: OPS',
    });
  });

  it('generates unique MSW Role codes when code is omitted', async () => {
    const custom = await createRole({
      name: 'Generated custom role',
      description: null,
    });
    const templated = await createRoleFromTemplate({
      templateCode: 'VIEWER_AUDITOR',
      name: 'Generated template role',
      description: null,
    });

    expect(custom.code).toMatch(/^ROLE-\d{6}$/u);
    expect(templated.code).toMatch(/^ROLE-\d{6}$/u);
    expect(templated.code).not.toBe(custom.code);
  });
});
