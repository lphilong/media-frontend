import i18n from 'i18next';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
  assignRoleToUser,
  createRoleFromTemplate,
  createRole,
  fetchRoleAssignments,
  fetchRoleTemplates,
  fetchRoles,
  performRoleLifecycleAction,
  previewRoleTemplate,
  replaceRoleAssignmentRules,
  replaceRolePermissions,
  revokeRoleAssignment,
  updateRole,
} from '@modules/role/api/role.api';
import {
  RoleAssignUserSurface,
  RoleCreateSurface,
  RoleEditSurface,
  RoleRevokeAssignmentSurface,
} from '@modules/role/forms/role-mutation-forms';
import {
  roleAssignmentRuleReplacementPayloadSchema,
  roleAssignToUserPayloadSchema,
  roleCreatePayloadSchema,
  roleCreateFromTemplatePayloadSchema,
} from '@modules/role/schemas/role-payload-schemas';
import type {
  RoleAssignmentItem,
  RoleDetailRecord,
  RolePermissionReplacementPayload,
  RoleTemplateListItem,
  RoleTemplatePreview,
} from '@modules/role/types/role.types';
import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  parseScreenQueryParams,
  roleAssignmentListQueryConfig,
  roleFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadUserReferenceOptions: vi.fn(async () => [
    {
      id: 'user-admin',
      label: 'Admin User - admin@example.com',
      description: 'ACTIVE',
      href: '/users/user-admin',
    },
  ]),
}));

const apiRequestMock = vi.mocked(apiRequest);

const selectPickerOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pickerId: string,
  optionText: RegExp,
): Promise<void> => {
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
  await user.click(await within(picker).findByText(optionText));
};

const roleDetail: RoleDetailRecord = {
  id: 'role-admin',
  code: 'ADMIN',
  name: 'Admin role',
  description: 'Admin permission template',
  state: 'ACTIVE',
  permissions: [{ code: 'role:view' }, { code: 'user:view' }],
  delegationBand: 'PRIVILEGED',
  maxDelegatableBand: 'LIMITED',
  assignmentRules: [{ id: 'rule-1', code: 'ALLOW_ADMIN', conditions: null }],
  templateCode: 'OWNER_ADMIN',
  templateVersion: '2026-05-20',
  templateAppliedAt: 2,
  createdAt: 1,
  updatedAt: 2,
  activatedAt: 2,
  archivedAt: null,
};

const roleAssignment: RoleAssignmentItem = {
  assignmentId: 'assignment-1',
  roleId: 'role-admin',
  userId: 'user-admin',
  roleRef: {
    id: 'role-admin',
    code: 'ADMIN',
    name: 'Admin role',
  },
  userRef: {
    id: 'user-admin',
    displayName: 'Admin User',
  },
  scopeGrants: {
    workSchedule: ['self', 'team'],
  },
  state: 'ACTIVE',
  effectiveAt: 2,
  revokedAt: null,
  reason: null,
};

const roleTemplateCatalog: RoleTemplateListItem[] = [
  {
    code: 'TALENT_GROUP_MANAGER',
    version: '2026-06-26',
    name: 'Talent Group Manager',
    description: 'Team operations preset',
    category: 'MANAGEMENT',
    permissionCount: 15,
    recommendedAccountContext: 'MANAGER_CONSOLE',
    recommendedScopeGrants: {
      workSchedule: ['self', 'team'],
      eventAssignment: ['managedGroup'],
      kpi: ['managedGroup'],
    },
    scopePlan: [
      {
        module: 'Work Schedule',
        scopes: ['self', 'team'],
        status: 'PREVIEW_ONLY',
        note: 'Preview-only scope plan.',
      },
    ],
    warnings: ['Scope plans are preview-only.'],
    implementationNotes: ['Permissions remain explicit.'],
    status: 'PREVIEW_ONLY',
  },
];

const roleTemplatePreview: RoleTemplatePreview = {
  template: {
    ...roleTemplateCatalog[0],
    permissions: [{ code: 'workSchedule.read' }, { code: 'talentKpi.read' }],
  },
  permissions: [{ code: 'workSchedule.read' }, { code: 'talentKpi.read' }],
  scopePlan: roleTemplateCatalog[0].scopePlan,
  warnings: roleTemplateCatalog[0].warnings,
  unsupportedScopeNotes: [],
};

const mockDetailResponse = () => {
  apiRequestMock.mockResolvedValue({ data: roleDetail });
};

const mockAssignmentResponse = () => {
  apiRequestMock.mockResolvedValue({ data: roleAssignment });
};

describe('role IA-1 query and payload shaping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses and serializes only documented Role list and assignment-list query keys', () => {
    const roleListQuery = parseScreenQueryParams(
      new URLSearchParams(
        'state=ACTIVE&cursor=opaque&limit=250&search=%20Admin%20&scope=global&scopeGrants=x&sortBy=name',
      ),
      roleFlatListQueryConfig,
    );

    expect(roleListQuery).toEqual({
      state: 'ACTIVE',
      cursor: 'opaque',
      search: 'Admin',
    });

    const roleListParams = serializeScreenQueryParams(
      {
        state: 'DRAFT',
        cursor: 'next',
        limit: 50,
        search: 'Ops',
        scope: 'global',
        scopeGrants: 'x',
        sortBy: 'name',
      },
      roleFlatListQueryConfig,
    );
    expect(Array.from(roleListParams.keys()).sort()).toEqual([
      'cursor',
      'limit',
      'search',
      'state',
    ]);
    expect(roleListParams.get('scope')).toBeNull();
    expect(roleListParams.get('scopeGrants')).toBeNull();
    expect(roleListParams.get('sortBy')).toBeNull();

    const assignmentQuery = parseScreenQueryParams(
      new URLSearchParams('state=ACTIVE&cursor=a1&limit=50&search=nope&scope=global'),
      roleAssignmentListQueryConfig,
    );
    expect(assignmentQuery).toEqual({
      state: 'ACTIVE',
      cursor: 'a1',
      limit: 50,
    });

    const assignmentParams = serializeScreenQueryParams(
      {
        state: 'REVOKED',
        cursor: 'a2',
        limit: 25,
        search: 'forbidden',
        scopeGrants: 'x',
      },
      roleAssignmentListQueryConfig,
    );
    expect(Array.from(assignmentParams.keys()).sort()).toEqual(['cursor', 'limit', 'state']);
    expect(assignmentParams.get('search')).toBeNull();
    expect(assignmentParams.get('scopeGrants')).toBeNull();
  });

  it('does not emit scope, scopeGrants, sort, or unsupported assignment keys through the Role API layer', async () => {
    apiRequestMock.mockResolvedValue({
      data: [],
    });

    await fetchRoles({
      state: 'ACTIVE',
      cursor: 'opaque',
      limit: 50,
      search: 'Admin',
      scope: 'global',
      scopeGrants: ['x'],
      sortBy: 'name',
    } as Parameters<typeof fetchRoles>[0]);

    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/roles',
        params: {
          state: 'ACTIVE',
          cursor: 'opaque',
          limit: 50,
          search: 'Admin',
        },
      }),
    );

    await fetchRoleAssignments('role-admin', {
      state: 'ACTIVE',
      cursor: 'a1',
      limit: 50,
      search: 'unsupported',
      scope: 'global',
    } as Parameters<typeof fetchRoleAssignments>[1]);

    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/roles/role-admin/assignments',
        params: {
          state: 'ACTIVE',
          cursor: 'a1',
          limit: 50,
        },
      }),
    );

    mockDetailResponse();
    await createRole({
      name: 'Ops role',
      description: null,
      initialPermissions: ['role:view'],
      initialDelegationBand: 'LIMITED',
      initialMaxDelegatableBand: 'NONE',
      initialAssignmentRules: [],
      scope: 'global',
    } as Parameters<typeof createRole>[0]);

    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      name: 'Ops role',
      description: null,
      initialPermissions: ['role:view'],
      initialDelegationBand: 'LIMITED',
      initialMaxDelegatableBand: 'NONE',
      initialAssignmentRules: [],
    });

    mockDetailResponse();
    await createRole({
      name: 'Manual role',
      code: 'MANUAL_ROLE',
      description: null,
      initialPermissions: [],
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toMatchObject({
      name: 'Manual role',
      code: 'MANUAL_ROLE',
    });

    await updateRole('role-admin', {
      name: 'Admin role updated',
      scopeGrants: ['x'],
    } as Parameters<typeof updateRole>[1]);

    const updateCall = apiRequestMock.mock.calls.at(-1)?.[0];
    expect(updateCall).toBeDefined();
    if (!updateCall) {
      return;
    }
    expect(updateCall.data).toEqual({
      name: 'Admin role updated',
      description: undefined,
      delegationBand: undefined,
      maxDelegatableBand: undefined,
    });
    expect(updateCall.data).not.toHaveProperty('scopeGrants');
  });

  it('sends Role lifecycle, permission, assignment-rule, assign, and revoke payloads exactly', async () => {
    mockDetailResponse();

    await performRoleLifecycleAction('role-admin', 'activate');
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/roles/role-admin/activate',
        data: {},
      }),
    );

    await performRoleLifecycleAction('role-admin', 'deactivate', { reason: null });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/roles/role-admin/deactivate',
        data: {
          reason: null,
        },
      }),
    );

    await replaceRolePermissions('role-admin', {
      permissions: ['role:view', 'user:view'],
      scopeGrants: ['forbidden'],
    } as RolePermissionReplacementPayload);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: '/admin/roles/role-admin/permissions',
        data: {
          permissions: ['role:view', 'user:view'],
        },
      }),
    );

    await replaceRoleAssignmentRules('role-admin', {
      rules: [{ code: 'ALLOW_ADMIN', conditions: null }],
      scope: 'global',
    } as Parameters<typeof replaceRoleAssignmentRules>[1]);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: '/admin/roles/role-admin/assignment-rules',
        data: {
          rules: [{ code: 'ALLOW_ADMIN', conditions: null }],
        },
      }),
    );

    mockAssignmentResponse();
    await assignRoleToUser('role-admin', {
      userId: 'user-admin',
      reason: null,
      effectiveAt: 1,
    } as Parameters<typeof assignRoleToUser>[1]);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/roles/role-admin/assignments',
        data: {
          userId: 'user-admin',
          reason: null,
        },
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('effectiveAt');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scopeGrants');

    await assignRoleToUser('role-admin', {
      userId: 'user-admin',
      reason: 'Scoped coverage',
      scopeGrants: {
        workSchedule: ['self', 'team', 'department', 'global'],
        eventAssignment: ['managedGroup'],
        kpi: ['global', 'managedGroup', 'self'],
        dashboardLite: ['global'],
      },
    });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/roles/role-admin/assignments',
        data: {
          userId: 'user-admin',
          reason: 'Scoped coverage',
          scopeGrants: {
            workSchedule: ['self', 'team', 'department', 'global'],
            eventAssignment: ['managedGroup'],
            kpi: ['global', 'managedGroup', 'self'],
            dashboardLite: ['global'],
          },
        },
      }),
    );

    await revokeRoleAssignment('role-admin', 'assignment-1', { reason: 'Done' });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/roles/role-admin/assignments/assignment-1/revoke',
        data: {
          reason: 'Done',
        },
      }),
    );
  });

  it('parses assignment mutation responses and rejects role DTO or unsafe extras safely', async () => {
    mockAssignmentResponse();
    await expect(
      assignRoleToUser('role-admin', {
        userId: 'user-admin',
        reason: null,
      }),
    ).resolves.toEqual(roleAssignment);

    apiRequestMock.mockResolvedValueOnce({ data: roleDetail });
    await expect(
      assignRoleToUser('role-admin', {
        userId: 'user-admin',
        reason: null,
      }),
    ).rejects.toMatchObject({
      message: 'role:feedback.assignmentResponseInvalid',
      code: 'ROLE_ASSIGNMENT_RESPONSE_INVALID',
    });

    apiRequestMock.mockResolvedValueOnce({
      data: {
        ...roleAssignment,
        secret: 'do-not-expose',
      },
    });
    await expect(
      assignRoleToUser('role-admin', {
        userId: 'user-admin',
        reason: null,
      }),
    ).rejects.toMatchObject({
      message: 'role:feedback.assignmentResponseInvalid',
    });
  });

  it('parses role templates, previews, and create-from-template responses with strict schemas', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: roleTemplateCatalog });
    await expect(fetchRoleTemplates()).resolves.toEqual(roleTemplateCatalog);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/role-templates',
      }),
    );

    apiRequestMock.mockResolvedValueOnce({ data: roleTemplatePreview });
    await expect(previewRoleTemplate('TALENT_GROUP_MANAGER')).resolves.toEqual(roleTemplatePreview);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/role-templates/TALENT_GROUP_MANAGER/preview',
        data: {},
      }),
    );

    mockDetailResponse();
    await expect(
      createRoleFromTemplate({
        templateCode: 'TALENT_GROUP_MANAGER',
        name: 'Team Manager Copy',
        description: null,
      }),
    ).resolves.toEqual(roleDetail);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/roles/from-template',
        data: {
          templateCode: 'TALENT_GROUP_MANAGER',
          name: 'Team Manager Copy',
          description: null,
        },
      }),
    );

    apiRequestMock.mockResolvedValueOnce({
      data: [
        {
          ...roleTemplateCatalog[0],
          extra: 'unsupported',
        },
      ],
    });
    await expect(fetchRoleTemplates()).rejects.toThrow();
  });

  it('submits normal Role create, update, assign, and revoke surfaces with supported payloads', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreateFromTemplate = vi.fn();
    const onUpdate = vi.fn();
    const onAssign = vi.fn();
    const onRevoke = vi.fn();

    const createRender = render(
      <RoleCreateSurface
        onCancel={() => undefined}
        onTemplateSubmit={onCreateFromTemplate}
        onPreviewTemplate={vi.fn(async () => roleTemplatePreview)}
        templateCatalog={roleTemplateCatalog}
      />,
    );
    expect(screen.queryByLabelText(i18n.t('role:templates.customMode'))).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: i18n.t('role:templates.roleTemplate'),
      }),
      'TALENT_GROUP_MANAGER',
    );
    expect(screen.getByText(i18n.t('role:generatedCode.description'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('role:fields.name')), 'Ops role');
    await user.click(screen.getByRole('button', { name: i18n.t('role:mutations.create.submit') }));
    expect(onCreateFromTemplate).toHaveBeenCalledWith({
      templateCode: 'TALENT_GROUP_MANAGER',
      name: 'Ops role',
      description: null,
    });
    createRender.unmount();

    const templateRender = render(
      <RoleCreateSurface
        onCancel={() => undefined}
        onTemplateSubmit={onCreateFromTemplate}
        onPreviewTemplate={vi.fn(async () => roleTemplatePreview)}
        templateCatalog={roleTemplateCatalog}
      />,
    );
    await user.selectOptions(
      within(templateRender.container).getByRole('combobox', {
        name: i18n.t('role:templates.roleTemplate'),
      }),
      'TALENT_GROUP_MANAGER',
    );
    expect(
      await screen.findByText(i18n.t('role:templates.generatedPermissions')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        i18n.t('role:permissionGroups.summaryItem', {
          group: i18n.t('role:permissionGroups.workSchedule'),
          count: 1,
        }),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('workSchedule.read')).not.toBeInTheDocument();
    expect(screen.getByText('Scope plans are preview-only.')).toBeInTheDocument();
    expect(screen.getByText(/Preview-only scope plan/u)).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('role:fields.name')), 'Team Manager Copy');
    await user.click(screen.getByRole('button', { name: i18n.t('role:mutations.create.submit') }));
    expect(onCreateFromTemplate).toHaveBeenCalledWith({
      templateCode: 'TALENT_GROUP_MANAGER',
      name: 'Team Manager Copy',
      description: null,
    });
    templateRender.unmount();

    const editRender = render(
      <RoleEditSurface initialRecord={roleDetail} onCancel={() => undefined} onSubmit={onUpdate} />,
    );
    await user.clear(screen.getByLabelText(i18n.t('role:fields.description')));
    await user.click(screen.getByRole('button', { name: i18n.t('role:mutations.update.submit') }));
    expect(onUpdate).toHaveBeenCalledWith({
      name: 'Admin role',
      description: null,
      delegationBand: 'PRIVILEGED',
      maxDelegatableBand: 'LIMITED',
    });
    editRender.unmount();

    const assignRender = render(
      <MemoryRouter>
        <RoleAssignUserSurface
          onCancel={() => undefined}
          onSubmit={onAssign}
          roleCode="OWNER_ADMIN"
        />
      </MemoryRouter>,
    );
    await selectPickerOption(user, 'role-assignment-user', /Admin User/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:mutations.assignToUser.submit') }),
    );
    expect(onAssign).toHaveBeenCalledWith({
      userId: 'user-admin',
      reason: null,
    });
    expect(onAssign.mock.calls[0][0]).not.toHaveProperty('effectiveAt');
    assignRender.unmount();

    const scopedAssignRender = render(
      <MemoryRouter>
        <RoleAssignUserSurface
          onCancel={() => undefined}
          onSubmit={onAssign}
          roleCode="OWNER_ADMIN"
          recommendedScopeGrants={{
            workSchedule: ['team'],
            eventAssignment: ['managedGroup'],
            kpi: ['global', 'managedGroup', 'self'],
          }}
        />
      </MemoryRouter>,
    );
    await selectPickerOption(user, 'role-assignment-user', /Admin User/);
    expect(screen.getByText(i18n.t('role:scopePicker.recommendedScopes'))).toBeInTheDocument();
    expect(screen.getByText(/kpi\.global, kpi\.managedGroup, kpi\.self/u)).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Event Assignment: ${i18n.t('role:scopePicker.scopes.managedGroup')}`),
    ).toBeChecked();
    expect(
      screen.getByLabelText(`Event Assignment: ${i18n.t('role:scopePicker.scopes.global')}`),
    ).not.toBeChecked();
    expect(screen.queryByLabelText(/Event Assignment: Team/u)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('role:scopePicker.applyRecommendedScopes'),
      }),
    );
    expect(screen.getByLabelText(`KPI: ${i18n.t('role:scopePicker.scopes.global')}`)).toBeChecked();
    expect(
      screen.getByLabelText(`KPI: ${i18n.t('role:scopePicker.scopes.managedGroup')}`),
    ).toBeChecked();
    expect(screen.getByLabelText(`KPI: ${i18n.t('role:scopePicker.scopes.self')}`)).toBeChecked();
    await user.click(screen.getByLabelText(i18n.t('role:scopePicker.scopes.self')));
    await user.click(screen.getByLabelText(i18n.t('role:scopePicker.scopes.department')));
    await user.click(
      screen.getByLabelText(`Dashboard Lite: ${i18n.t('role:scopePicker.scopes.global')}`),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:mutations.assignToUser.submit') }),
    );
    expect(onAssign).toHaveBeenLastCalledWith({
      userId: 'user-admin',
      reason: null,
      scopeGrants: {
        workSchedule: ['self', 'team', 'department'],
        eventAssignment: ['managedGroup'],
        kpi: ['global', 'managedGroup', 'self'],
        dashboardLite: ['global'],
      },
    });
    scopedAssignRender.unmount();

    render(
      <RoleRevokeAssignmentSurface
        assignmentId="assignment-1"
        onCancel={() => undefined}
        onSubmit={onRevoke}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:mutations.revokeAssignment.submit') }),
    );
    expect(onRevoke).toHaveBeenCalledWith({
      reason: null,
    });
  }, 20_000);

  it('prefills template assignment scopes without promoting managedGroup to global', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onAssign = vi.fn();

    const teamManagerRender = render(
      <MemoryRouter>
        <RoleAssignUserSurface
          onCancel={() => undefined}
          onSubmit={onAssign}
          roleCode="TALENT_GROUP_MANAGER"
          templateCode="TALENT_GROUP_MANAGER"
          recommendedScopeGrants={{
            workSchedule: ['self', 'team'],
            kpi: ['managedGroup'],
            eventAssignment: ['managedGroup'],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(i18n.t('role:scopePicker.scopes.self'))).toBeChecked();
    expect(screen.getByLabelText(i18n.t('role:scopePicker.scopes.team'))).toBeChecked();
    expect(screen.getByLabelText(i18n.t('role:scopePicker.scopes.department'))).not.toBeChecked();
    expect(
      screen.getByLabelText(`Event Assignment: ${i18n.t('role:scopePicker.scopes.managedGroup')}`),
    ).toBeChecked();
    expect(
      screen.getByLabelText(`Event Assignment: ${i18n.t('role:scopePicker.scopes.global')}`),
    ).not.toBeChecked();

    await selectPickerOption(user, 'role-assignment-user', /Admin User/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:mutations.assignToUser.submit') }),
    );

    expect(onAssign).toHaveBeenCalledWith({
      userId: 'user-admin',
      reason: null,
      scopeGrants: {
        workSchedule: ['self', 'team'],
        eventAssignment: ['managedGroup'],
        kpi: ['managedGroup'],
      },
    });
    teamManagerRender.unmount();

    const productionOpsRender = render(
      <MemoryRouter>
        <RoleAssignUserSurface
          onCancel={() => undefined}
          onSubmit={onAssign}
          roleCode="PRODUCTION_OPS"
          templateCode="PRODUCTION_OPS"
          recommendedScopeGrants={{
            workSchedule: ['global'],
            eventAssignment: ['global'],
          }}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByLabelText(`Event Assignment: ${i18n.t('role:scopePicker.scopes.managedGroup')}`),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText(`Event Assignment: ${i18n.t('role:scopePicker.scopes.global')}`),
    ).toBeChecked();

    await selectPickerOption(user, 'role-assignment-user', /Admin User/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:mutations.assignToUser.submit') }),
    );

    expect(onAssign).toHaveBeenLastCalledWith({
      userId: 'user-admin',
      reason: null,
      scopeGrants: {
        workSchedule: ['global'],
        eventAssignment: ['global'],
      },
    });
    productionOpsRender.unmount();

    const viewerAuditorRender = render(
      <MemoryRouter>
        <RoleAssignUserSurface
          onCancel={() => undefined}
          onSubmit={onAssign}
          roleCode="VIEWER_AUDITOR"
          templateCode="VIEWER_AUDITOR"
          recommendedScopeGrants={{
            workSchedule: ['global'],
            eventAssignment: ['global'],
            contractRegistry: ['global'],
            talentKpi: ['global'],
            kpi: ['global'],
            revenueLedger: ['global'],
            commission: ['global'],
            dashboardLite: ['global'],
          }}
        />
      </MemoryRouter>,
    );

    await selectPickerOption(user, 'role-assignment-user', /Admin User/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:mutations.assignToUser.submit') }),
    );

    expect(onAssign).toHaveBeenLastCalledWith({
      userId: 'user-admin',
      reason: null,
      scopeGrants: {
        workSchedule: ['global'],
        eventAssignment: ['global'],
        contractRegistry: ['global'],
        talentKpi: ['global'],
        kpi: ['global'],
        revenueLedger: ['global'],
        commission: ['global'],
        dashboardLite: ['global'],
      },
    });
    viewerAuditorRender.unmount();
  }, 20_000);

  it('keeps exported assignment-rule conditions schemas strict plain JSON objects or null', () => {
    const validReplacement = roleAssignmentRuleReplacementPayloadSchema.safeParse({
      rules: [
        {
          code: 'ALLOW_ADMIN',
          conditions: {
            band: 'LIMITED',
            active: true,
            priority: 1,
            nested: {
              owner: null,
            },
          },
        },
        {
          code: 'ALLOW_EMPTY',
          conditions: {},
        },
        {
          code: 'ALLOW_NULL',
          conditions: null,
        },
      ],
    });

    expect(validReplacement.success).toBe(true);

    const validCreate = roleCreatePayloadSchema.safeParse({
      name: 'Ops role',
      code: 'OPS',
      initialAssignmentRules: [
        {
          code: 'ALLOW_OPS',
          conditions: {
            band: 'LIMITED',
          },
        },
      ],
    });

    expect(validCreate.success).toBe(true);

    expect(
      roleCreateFromTemplatePayloadSchema.safeParse({
        templateCode: 'TALENT_GROUP_MANAGER',
        code: 'TALENT_GROUP_MANAGER_COPY',
        name: 'Team Manager Copy',
        description: null,
      }).success,
    ).toBe(true);

    expect(
      roleAssignToUserPayloadSchema.safeParse({
        userId: 'user-admin',
        reason: null,
        scopeGrants: {
          workSchedule: ['self', 'team', 'department', 'global'],
          eventAssignment: ['managedGroup', 'global'],
          contractRegistry: ['global'],
          talentKpi: ['global'],
          kpi: ['global', 'managedGroup', 'self'],
          revenueLedger: ['global'],
          commission: ['global'],
          dashboardLite: ['global'],
        },
      }).success,
    ).toBe(true);

    expect(
      roleAssignToUserPayloadSchema.safeParse({
        userId: 'user-admin',
        scopeGrants: {
          role: ['global'],
        },
      }).success,
    ).toBe(false);

    expect(
      roleAssignToUserPayloadSchema.safeParse({
        userId: 'user-admin',
        scopeGrants: {
          eventAssignment: ['team'],
        },
      }).success,
    ).toBe(false);

    const forbiddenConditions: unknown[] = [
      [],
      new Date(),
      new Map([['band', 'LIMITED']]),
      new Set(['LIMITED']),
      new Uint8Array([1]),
      { list: [] },
      { createdAt: new Date() },
      { map: new Map([['band', 'LIMITED']]) },
      { fn: () => undefined },
      { sym: Symbol('band') },
      { big: BigInt(1) },
      { toJSON: () => ({ band: 'LIMITED' }) },
      { nested: { toJSON: () => ({ band: 'LIMITED' }) } },
      { nan: Number.NaN },
      { infinite: Number.POSITIVE_INFINITY },
    ];

    forbiddenConditions.forEach((conditions) => {
      expect(
        roleAssignmentRuleReplacementPayloadSchema.safeParse({
          rules: [
            {
              code: 'ALLOW_ADMIN',
              conditions,
            },
          ],
        }).success,
      ).toBe(false);
    });
  });
});
