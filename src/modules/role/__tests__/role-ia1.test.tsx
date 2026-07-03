import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';
import {
  getMockCurrentActorCapabilities,
  resetIdentityAccessMockData,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import {
  createRole,
  createRoleFromTemplate,
  applyAccessAssignment,
  previewAccessAssignment,
} from '@modules/role/api/role.api';

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

const materializationPreviewBase = {
  ...successfulAccessAssignmentPreview,
  accountContextRequirement: {
    status: 'NOT_REQUIRED',
    requiredAccountContexts: [],
    currentAccountContexts: ['STAFF_CONSOLE'],
    missingAccountContexts: [],
    reusedAccountContexts: [],
    proposedAccountContexts: [],
    materializationInScope: true,
  },
  responsibilityRequirements: [],
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

const previewMaterializationCopy = async (
  user: ReturnType<typeof userEvent.setup>,
  previewData: Record<string, unknown>,
): Promise<void> => {
  server.use(
    http.get('*/admin/employment-profiles', () =>
      HttpResponse.json({ data: [activeLinkedEmploymentProfile], meta: {} }),
    ),
    http.post('*/admin/access-assignments/preview', () =>
      HttpResponse.json({
        data: {
          ...materializationPreviewBase,
          ...previewData,
        },
      }),
    ),
  );

  await renderAssignmentTab(user);

  const userPicker = await findPickerSurface('role-access-assignment-linked-user');
  await user.type(
    within(userPicker).getByPlaceholderText(i18n.t('role:accessAssignment.userSearchPlaceholder')),
    'Al',
  );
  await user.click(await within(userPicker).findByText(/Alice Linked/u));
  await user.type(
    screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
    'M2 materialization copy coverage',
  );
  await user.click(
    screen.getByRole('button', { name: i18n.t('role:accessAssignment.previewButton') }),
  );
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
      screen.getByText(
        'Auditor mặc định chỉ có quyền đọc không nhạy cảm. Dữ liệu lương, phụ cấp hoặc dữ liệu nhạy cảm cần quyền riêng.',
      ),
    ).toBeInTheDocument();
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

  it('shows AUTH-5 risk and review state in effective access', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/roles');

    expect(
      await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('tab', { name: i18n.t('role:tabs.userAccess') }));

    const userPicker = await findPickerSurface('role-effective-access-user');
    await user.type(
      within(userPicker).getByPlaceholderText(i18n.t('role:placeholders.userSearch')),
      'Ad',
    );
    await user.click(await within(userPicker).findByText(/Admin User/u));

    expect(await screen.findByText('Phạm vi toàn cục')).toBeInTheDocument();
    expect(screen.getByText('Rủi ro cao')).toBeInTheDocument();
    expect(screen.getByText('Cần rà soát')).toBeInTheDocument();
    expect(screen.getByText('Thiếu ngày rà soát')).toBeInTheDocument();
    expect(screen.getByText(/Ngày rà soát: - · Ngày hết hiệu lực: -/u)).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.scopeGrants'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.assignedBy'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.reason'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.responsibilityTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.traceTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:userAccess.lifecycleReadOnlyHere'))).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/unrecognized_keys|templateCode/u);
  }, 15_000);

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
      await screen.findByText(i18n.t('role:accessAssignment.previewCanApply')),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:accessAssignment.scopeFingerprint'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:accessAssignment.bundleTrace'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:accessAssignment.childRoleTrace'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('role:accessAssignment.sourceTrace'))).toBeInTheDocument();
    await waitFor(() => expect(applyButton).toBeEnabled());

    const targetSelect = screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    expect(
      Array.from(targetSelect.querySelectorAll('optgroup')).map((group) => group.label),
    ).toEqual(
      expect.arrayContaining([
        i18n.t('role:catalogGroups.REQUIRES_SCOPE_SELECTION'),
        i18n.t('role:catalogGroups.READ_ONLY_AUDIT'),
      ]),
    );
    const staffOption = within(targetSelect).getByRole('option', { name: /Staff Console/u });
    await user.selectOptions(targetSelect, staffOption);
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
    expect(
      screen.getByText(i18n.t('role:accessAssignment.accountContextResult')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.responsibilityResult')),
    ).toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('role:accessAssignment.auditTrace')).length).toBeGreaterThan(
      0,
    );
  }, 25_000);

  it('renders proposed Account Context and CREATE_PROPOSED responsibility preview copy truthfully', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    await previewMaterializationCopy(user, {
      accountContextRequirement: {
        status: 'PROPOSED_FOR_APPLICATION',
        requiredAccountContexts: ['MANAGER_CONSOLE'],
        currentAccountContexts: ['STAFF_CONSOLE'],
        missingAccountContexts: ['MANAGER_CONSOLE'],
        reusedAccountContexts: [],
        proposedAccountContexts: ['MANAGER_CONSOLE'],
        materializationInScope: true,
      },
      responsibilityRequirements: [
        {
          status: 'CREATE_PROPOSED',
          requiredResponsibilityType: 'TALENT_GROUP_MANAGER',
          targetId: 'group-create',
        },
      ],
    });

    expect(
      await screen.findByText(i18n.t('role:accessAssignment.accountContextStates.proposed')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.responsibilityStates.createProposed')),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/màn này không tạo phân công trách nhiệm/u);
    expect(document.body).not.toHaveTextContent(/không tự cấp điều kiện Console/u);
  }, 20_000);

  it('renders reused Account Context and responsibility preview copy truthfully', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    await previewMaterializationCopy(user, {
      accountContextRequirement: {
        status: 'SATISFIED',
        requiredAccountContexts: ['MANAGER_CONSOLE'],
        currentAccountContexts: ['MANAGER_CONSOLE'],
        missingAccountContexts: [],
        reusedAccountContexts: ['MANAGER_CONSOLE'],
        proposedAccountContexts: [],
        materializationInScope: true,
      },
      responsibilityRequirements: [
        {
          status: 'SATISFIED',
          responsibilityAssignmentId: 'responsibility-existing-group-a',
          requiredResponsibilityType: 'TALENT_GROUP_MANAGER',
          targetId: 'group-a',
        },
      ],
    });

    expect(
      await screen.findByText(i18n.t('role:accessAssignment.accountContextStates.reused')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.responsibilityStates.reused')),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/màn này không tạo phân công trách nhiệm/u);
  }, 20_000);

  it('renders blocked Account Context and responsibility preview copy truthfully', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    await previewMaterializationCopy(user, {
      canApply: false,
      blockers: [
        {
          severity: 'BLOCKER',
          code: 'ACCOUNT_CONTEXT_MATERIALIZATION_NOT_AUTHORIZED',
          summary: 'Target user is missing required AccountContext.',
        },
        {
          severity: 'BLOCKER',
          code: 'RESPONSIBILITY_MATERIALIZATION_NOT_AUTHORIZED',
          summary: 'Matching active management responsibility is required.',
        },
      ],
      accountContextRequirement: {
        status: 'BLOCKED_UNAUTHORIZED',
        requiredAccountContexts: ['MANAGER_CONSOLE'],
        currentAccountContexts: ['STAFF_CONSOLE'],
        missingAccountContexts: ['MANAGER_CONSOLE'],
        reusedAccountContexts: [],
        proposedAccountContexts: [],
        materializationInScope: true,
      },
      responsibilityRequirements: [
        {
          status: 'MISSING_RESPONSIBILITY_UNAUTHORIZED',
          requiredResponsibilityType: 'TALENT_GROUP_MANAGER',
          targetId: 'group-blocked',
        },
      ],
    });

    expect(
      await screen.findAllByText(i18n.t('role:accessAssignment.accountContextStates.blocked')),
    ).not.toHaveLength(0);
    expect(
      await screen.findAllByText(i18n.t('role:accessAssignment.responsibilityStates.blocked')),
    ).not.toHaveLength(0);
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.previewCanApply')),
    ).not.toBeInTheDocument();
  }, 20_000);

  it('renders not-required materialization states truthfully', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    await previewMaterializationCopy(user, {
      accountContextRequirement: {
        status: 'NOT_REQUIRED',
        requiredAccountContexts: [],
        currentAccountContexts: ['STAFF_CONSOLE'],
        missingAccountContexts: [],
        reusedAccountContexts: [],
        proposedAccountContexts: [],
        materializationInScope: true,
      },
      responsibilityRequirements: [],
    });
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.accountContextStates.notRequired')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.responsibilityStates.notRequired')),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/màn này không tạo phân công trách nhiệm/u);
  }, 20_000);

  it('renders unknown materialization states without false success copy', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    await previewMaterializationCopy(user, {
      accountContextRequirement: {
        status: 'QUEUED_FOR_REVIEW',
        requiredAccountContexts: ['MANAGER_CONSOLE'],
        currentAccountContexts: ['STAFF_CONSOLE'],
        missingAccountContexts: ['MANAGER_CONSOLE'],
        reusedAccountContexts: [],
        proposedAccountContexts: [],
        materializationInScope: true,
      },
      responsibilityRequirements: [
        {
          status: 'QUEUED_FOR_REVIEW',
          requiredResponsibilityType: 'TALENT_GROUP_MANAGER',
          targetId: 'group-queued',
        },
      ],
    });

    expect(
      await screen.findByText(i18n.t('role:accessAssignment.accountContextStates.unknown')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.responsibilityStates.unknown')),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.accountContextStates.proposed')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('role:accessAssignment.responsibilityStates.createProposed')),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/màn này không tạo phân công trách nhiệm/u);
  }, 30_000);

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

  it('separates AUTH-5 sensitive targets from the normal assignment picker', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    await renderAssignmentTab(user);

    const targetSelect = screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    expect(
      within(targetSelect).queryByRole('option', { name: /Owner Admin/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.restrictedTargetsTitle')),
    ).toBeInTheDocument();
    expect(screen.getByText(/Owner Admin/u)).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.restrictedTargetsHelp')),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('role:accessAssignment.roleMode') }),
    );
    const roleTargetSelect = screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    expect(
      within(roleTargetSelect).queryByRole('option', { name: /Owner Admin/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.restrictedTargetsTitle')),
    ).toBeInTheDocument();
    expect(screen.getByText(/Owner Admin/u)).toBeInTheDocument();
    const userPicker = await findPickerSurface('role-access-assignment-linked-user');
    await user.type(
      within(userPicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.userSearchPlaceholder'),
      ),
      'Al',
    );
    await user.click(await within(userPicker).findByText(/Alice/u));
    const previewButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.previewButton'),
    });
    expect(previewButton).toBeDisabled();
  }, 20_000);

  it('keeps Apply disabled when preview contradicts canApply with blockers', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    let applyRequests = 0;

    server.use(
      http.get('*/admin/employment-profiles', () =>
        HttpResponse.json({ data: [activeLinkedEmploymentProfile], meta: {} }),
      ),
      http.post('*/admin/access-assignments/preview', () =>
        HttpResponse.json({
          data: {
            previewOnly: true,
            canApply: true,
            blockers: [
              {
                severity: 'BLOCKER',
                code: 'REVIEW_AT_EXCEEDS_MAX_WINDOW',
                summary: 'reviewAt must be within 90 days for this access grant.',
              },
            ],
            warnings: [],
            normalizedScope: [{ scopeType: 'self' }],
            proposedAssignments: [{ roleCode: 'STAFF_CONSOLE_USER' }],
            effectiveAccessDelta: { addedPermissions: ['workSchedule.read'] },
          },
        }),
      ),
      http.post('*/admin/access-assignments/apply', () => {
        applyRequests += 1;
        return HttpResponse.json({ data: { applied: true, applyStatus: 'APPLIED' } });
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
    await user.click(await within(userPicker).findByText(/Alice Linked/u));
    const targetSelect = screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    const staffOption = within(targetSelect).getByRole('option', { name: /Staff Console/u });
    await user.selectOptions(targetSelect, staffOption);
    await user.type(
      screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
      'Contradictory preview blocker coverage',
    );

    const previewButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.previewButton'),
    });
    const applyButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.applyButton'),
    });
    await user.click(previewButton);

    expect(
      await screen.findByText(i18n.t('role:accessAssignment.previewBlocked')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Ngày rà soát vượt giới hạn. Ngày rà soát vượt giới hạn chính sách cho quyền nhạy cảm hoặc quyền toàn cục.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(applyButton).toBeDisabled());
    await user.click(applyButton);
    expect(applyRequests).toBe(0);
  }, 20_000);

  it('renders self-grant and self-revoke blockers with operator wording', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();

    server.use(
      http.post('*/admin/access-assignments/preview', () =>
        HttpResponse.json({
          data: {
            previewOnly: true,
            canApply: false,
            blockers: [
              {
                severity: 'BLOCKER',
                code: 'SELF_ASSIGNMENT_BLOCKED',
                summary: 'Current actor cannot assign access to themselves.',
              },
            ],
            warnings: [],
            normalizedScope: [{ scopeType: 'self' }],
            sensitiveAccess: {
              sensitiveOrGlobal: true,
              isSensitive: true,
              isHighRisk: true,
              requiresReview: true,
            },
          },
        }),
      ),
      http.post('*/admin/access-assignments/:assignmentId/revoke', async ({ params }) =>
        HttpResponse.json({
          data: {
            revoked: false,
            lifecycleStatus: 'BLOCKED',
            blockers: [
              {
                severity: 'BLOCKER',
                code: 'SELF_LIFECYCLE_BLOCKED',
                summary:
                  'Actors cannot revoke their own access assignment through normal lifecycle UI.',
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
    const targetSelect = screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    const staffOption = within(targetSelect).getByRole('option', { name: /Staff Console/u });
    await user.selectOptions(targetSelect, staffOption);
    await user.type(
      screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
      'Self grant copy coverage',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:accessAssignment.previewButton') }),
    );
    expect(
      await screen.findByText(
        'Không thể tự cấp quyền. Bạn không thể cấp quyền nhạy cảm hoặc quyền toàn cục cho chính mình.',
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('role:accessAssignment.lifecycle.revokeButton'),
      }),
    );
    await user.type(
      screen.getByPlaceholderText(
        i18n.t('role:accessAssignment.lifecycle.revokeReasonPlaceholder'),
      ),
      'Self revoke copy coverage',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('role:accessAssignment.lifecycle.confirmRevoke'),
      }),
    );
    expect(
      await screen.findByText(
        'Không thể tự thu hồi quyền của chính bạn. Thao tác này cần được thực hiện bởi người có thẩm quyền khác để đảm bảo kiểm soát vận hành.',
      ),
    ).toBeInTheDocument();
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
    expect(within(userPicker).getAllByText(/ACTIVE/u).length).toBeGreaterThan(0);
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
                assignabilityStatus: 'REQUIRES_SCOPE_SELECTION',
                operatorFlowGroup: 'REQUIRES_SCOPE_SELECTION',
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
                assignabilityStatus: 'READ_ONLY_AUDIT',
                operatorFlowGroup: 'READ_ONLY_AUDIT',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'BUNDLE',
                code: 'DIRECT_READY_BUNDLE',
                version: '2026-05-20',
                name: 'Direct Ready Bundle',
                childRoles: ['KPI_OPERATIONS'],
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: [],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                assignabilityStatus: 'READY_ASSIGNABLE',
                operatorFlowGroup: 'READY_TO_ASSIGN',
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
                  assignabilityStatus: 'READ_ONLY_AUDIT',
                  operatorFlowGroup: 'READ_ONLY_AUDIT',
                  recommendedPickerMode: 'SEARCH_FIRST',
                }),
              ),
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'KPI_OPERATIONS',
                name: 'KPI Operations',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: [],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                assignabilityStatus: 'READY_ASSIGNABLE',
                operatorFlowGroup: 'READY_TO_ASSIGN',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
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
                assignabilityStatus: 'REQUIRES_SCOPE_SELECTION',
                operatorFlowGroup: 'REQUIRES_SCOPE_SELECTION',
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
                assignabilityStatus: 'REQUIRES_SCOPE_SELECTION',
                operatorFlowGroup: 'REQUIRES_SCOPE_SELECTION',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'VIEWER_AUDITOR',
                name: 'Viewer Auditor',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: ['global'],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                assignabilityStatus: 'READ_ONLY_AUDIT',
                operatorFlowGroup: 'READ_ONLY_AUDIT',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'OWNER_ADMIN',
                name: 'Owner Admin',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: ['global'],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'HIGH_RISK',
                legacyAssignable: true,
                assignabilityStatus: 'RESTRICTED_SENSITIVE',
                operatorFlowGroup: 'RESTRICTED_SENSITIVE',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'ATTENDANCE_OPS',
                name: 'Attendance Ops',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: ['attendancePeriodOrg'],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                assignabilityStatus: 'FUTURE_READY_CONDITION',
                operatorFlowGroup: 'FUTURE_READINESS',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'MISSING_ASSIGNABILITY',
                name: 'Missing Assignability',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: [],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                operatorFlowGroup: 'READY_TO_ASSIGN',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'UNKNOWN_ASSIGNABILITY',
                name: 'Unknown Assignability',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: [],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                assignabilityStatus: 'UNKNOWN_READY_STATE',
                operatorFlowGroup: 'READY_TO_ASSIGN',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'MISSING_FLOW',
                name: 'Missing Flow',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: [],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                assignabilityStatus: 'READY_ASSIGNABLE',
                recommendedPickerMode: 'SEARCH_FIRST',
              },
              {
                assignmentKind: 'ROLE_TEMPLATE',
                code: 'SYSTEM_CONTROLLED_TARGET',
                name: 'System Controlled Target',
                recommendedAccountContext: 'ADMIN_CONSOLE',
                requiredScopeTypes: [],
                requiresResponsibility: false,
                requiredResponsibilityType: null,
                sensitiveLevel: 'STANDARD',
                legacyAssignable: true,
                assignabilityStatus: 'SYSTEM_CONTROLLED',
                operatorFlowGroup: 'SYSTEM_CONTROLLED',
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
      within(targetSelect).getByRole('option', { name: /Direct Ready Bundle/u }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.legacyTargetsHidden')),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('role:accessAssignment.roleMode') }),
    );
    const roleTargetSelect = screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel'));
    expect(
      within(roleTargetSelect).getByRole('option', { name: /KPI Operations/u }),
    ).toBeInTheDocument();
    expect(
      within(roleTargetSelect).getByRole('option', { name: /HR Operations/u }),
    ).toBeInTheDocument();
    expect(
      within(roleTargetSelect).getByRole('option', { name: /Production Ops/u }),
    ).toBeInTheDocument();
    expect(
      within(roleTargetSelect).getByRole('option', { name: /Viewer Auditor/u }),
    ).toBeInTheDocument();
    expect(
      within(roleTargetSelect).queryByRole('option', { name: /Owner Admin/u }),
    ).not.toBeInTheDocument();
    expect(
      within(roleTargetSelect).queryByRole('option', { name: /Attendance Ops/u }),
    ).not.toBeInTheDocument();
    expect(
      within(roleTargetSelect).queryByRole('option', { name: /Missing Assignability/u }),
    ).not.toBeInTheDocument();
    expect(
      within(roleTargetSelect).queryByRole('option', { name: /Unknown Assignability/u }),
    ).not.toBeInTheDocument();
    expect(
      within(roleTargetSelect).queryByRole('option', { name: /Missing Flow/u }),
    ).not.toBeInTheDocument();
    expect(
      within(roleTargetSelect).queryByRole('option', { name: /System Controlled Target/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.restrictedTargetsTitle')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.futureTargetsHidden')),
    ).toBeInTheDocument();
    for (const code of ['ADMIN_FULL', 'TEAM_MANAGER', 'COMMERCIAL_FINANCE', 'TALENT_STAFF_SELF']) {
      expect(
        within(roleTargetSelect).queryByRole('option', { name: new RegExp(code, 'u') }),
      ).not.toBeInTheDocument();
    }
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

describe('role MSW access assignment policy behavior', () => {
  it('returns M2 Account Context proposed and reused states in preview fixtures', async () => {
    const proposed = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-a' }],
      reason: 'MSW account context proposed coverage',
    });

    expect(proposed.canApply).toBe(true);
    expect(proposed.accountContextRequirement).toMatchObject({
      status: 'PROPOSED_FOR_APPLICATION',
      proposedAccountContexts: ['MANAGER_CONSOLE'],
      materializationInScope: true,
    });

    const reused = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'STAFF_CONSOLE_USER',
      structuredScopeGrants: [{ scopeType: 'self' }],
      reason: 'MSW account context reused coverage',
    });

    expect(reused.accountContextRequirement).toMatchObject({
      status: 'SATISFIED',
      reusedAccountContexts: ['STAFF_CONSOLE'],
    });
  });

  it('returns M2 responsibility reused, CREATE_PROPOSED, and blocked states in preview fixtures', async () => {
    const reused = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-a' }],
      reason: 'MSW responsibility reused coverage',
    });

    expect(reused.responsibilityRequirements?.[0]).toMatchObject({
      status: 'SATISFIED',
      operation: 'REUSE_EXISTING',
    });

    const createProposed = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
      reason: 'MSW responsibility create proposed coverage',
    });

    expect(createProposed.canApply).toBe(true);
    expect(createProposed.responsibilityRequirements?.[0]).toMatchObject({
      status: 'CREATE_PROPOSED',
      operation: 'CREATE_REQUIRED',
      proposedResponsibility: {
        subjectId: 'group-create',
        responsibilityType: 'TALENT_GROUP_MANAGER',
      },
    });

    const originalCapabilities = getMockCurrentActorCapabilities();
    setMockCurrentActorCapabilities({
      ...originalCapabilities,
      permissions: originalCapabilities.permissions.filter(
        (permission) => permission !== 'role:assign_to_user' && permission !== 'talentGroup.update',
      ),
    });
    try {
      const blocked = await previewAccessAssignment({
        targetUserId: 'user-alice',
        assignmentTargetType: 'ROLE_TEMPLATE',
        assignmentTargetCode: 'TALENT_GROUP_MANAGER',
        structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
        reason: 'MSW blocked materialization coverage',
      });

      expect(blocked.canApply).toBe(false);
      expect(blocked.accountContextRequirement).toMatchObject({
        status: 'BLOCKED_UNAUTHORIZED',
      });
      expect(blocked.responsibilityRequirements?.[0]).toMatchObject({
        status: 'MISSING_RESPONSIBILITY_UNAUTHORIZED',
      });
      expect(blocked.blockers.map((blocker) => blocker.code)).toEqual(
        expect.arrayContaining([
          'ACCOUNT_CONTEXT_MATERIALIZATION_NOT_AUTHORIZED',
          'RESPONSIBILITY_MATERIALIZATION_NOT_AUTHORIZED',
        ]),
      );
    } finally {
      setMockCurrentActorCapabilities(originalCapabilities);
    }
  });

  it('returns M2 materialization results from MSW apply fixtures', async () => {
    resetIdentityAccessMockData();

    const result = await applyAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
      reason: 'MSW apply materialization coverage',
    });

    expect(result.applied).toBe(true);
    expect(result.accountContextResult).toMatchObject({
      materialized: true,
      materializationPolicy: 'APPLIED_FROM_ACCESS_ASSIGNMENT_PREVIEW',
      appliedAccountContexts: ['MANAGER_CONSOLE'],
    });
    expect((result as Record<string, unknown>).responsibilityOperationResult).toMatchObject({
      materialized: true,
      items: [
        expect.objectContaining({
          operation: 'CREATE',
          subjectId: 'group-create',
          responsibilityType: 'TALENT_GROUP_MANAGER',
        }),
      ],
    });
  });

  it('returns REVIEW_AT_EXCEEDS_MAX_WINDOW for global access beyond the 90-day review window', async () => {
    const result = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'STAFF_CONSOLE_USER',
      structuredScopeGrants: [{ scopeType: 'global' }],
      reason: 'MSW max review window coverage',
      effectiveAt: '2026-01-01',
      reviewAt: '2026-04-15',
    });

    expect(result.canApply).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toContain(
      'REVIEW_AT_EXCEEDS_MAX_WINDOW',
    );
    expect(result.sensitiveAccess).toMatchObject({
      maxReviewWindowDays: 90,
      reviewAt: Date.parse('2026-04-15'),
    });
  });

  it('returns EXPIRES_AT_EXCEEDS_MAX_WINDOW for Owner Admin beyond the 14-day expiry window', async () => {
    const result = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'OWNER_ADMIN',
      structuredScopeGrants: [{ scopeType: 'global' }],
      reason: 'MSW max expiry window coverage',
      effectiveAt: '2026-01-01',
      reviewAt: '2026-01-10',
      expiresAt: '2026-01-20',
    });

    expect(result.canApply).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toContain(
      'EXPIRES_AT_EXCEEDS_MAX_WINDOW',
    );
    expect(result.sensitiveAccess).toMatchObject({
      maxReviewWindowDays: 14,
      maxExpiryWindowDays: 14,
      expiresAt: Date.parse('2026-01-20'),
    });
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
