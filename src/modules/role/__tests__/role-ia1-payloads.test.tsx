import i18n from 'i18next';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyAccessAssignment,
  createRoleFromTemplate,
  createRole,
  fetchAccessAssignmentTargets,
  fetchAccessAssignmentsForUser,
  fetchRoleTemplates,
  fetchRoles,
  performRoleLifecycleAction,
  previewAccessAssignment,
  previewRoleTemplate,
  replaceRoleAssignmentRules,
  replaceRolePermissions,
  revokeAccessAssignment,
  updateRole,
} from '@modules/role/api/role.api';
import {
  RoleCreateSurface,
  RoleEditSurface,
} from '@modules/role/forms/role-mutation-forms';
import {
  roleAssignmentRuleReplacementPayloadSchema,
  roleCreatePayloadSchema,
  roleCreateFromTemplatePayloadSchema,
} from '@modules/role/schemas/role-payload-schemas';
import type {
  RoleDetailRecord,
  RolePermissionReplacementPayload,
  RoleTemplateListItem,
  RoleTemplatePreview,
  AccessAssignmentTargetsMetadata,
} from '@modules/role/types/role.types';
import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  parseScreenQueryParams,
  roleFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

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

const lifecycleAssignment = {
  assignmentId: 'assignment-1',
  targetUserId: 'user-admin',
  roleId: 'role-admin',
  roleCode: 'ADMIN',
  roleName: 'Admin role',
  roleTemplateCode: 'OWNER_ADMIN',
  roleTemplateVersion: '2026-05-20',
  structuredScopeGrants: [{ scopeType: 'self' as const }],
  scopeFingerprint: 'scope:v1:self',
  status: 'ACTIVE' as const,
  lifecycleState: 'ACTIVE' as const,
  currentlyEffective: true,
  inactiveReason: null,
  effectiveAt: 2,
  expiresAt: null,
  reviewAt: null,
  assignedBy: 'user-owner',
  assignedAt: 2,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  origin: 'DIRECT' as const,
  bundleOrigin: null,
  reason: 'Initial assignment',
  sensitiveOrGlobal: false,
  supportedActions: ['REVOKE'],
  auditSummary: {
    assignmentId: 'assignment-1',
    action: 'ASSIGN',
    actorId: 'user-owner',
    timestamp: 2,
    reason: 'Initial assignment',
    oldStatus: null,
    newStatus: 'ACTIVE',
  },
};

const lifecycleListResponse = {
  readOnly: true,
  sourceTruth: false,
  targetUser: {
    id: 'user-admin',
    displayName: 'Admin User',
    email: 'admin@example.test',
    accountStatus: 'ACTIVE',
  },
  supportedLifecycleActions: ['REVOKE'],
  unsupportedLifecycleActions: ['DISABLE', 'EXPIRE', 'ARCHIVE'],
  items: [lifecycleAssignment],
  generatedAt: '2026-05-20T00:00:00.000Z',
};

const lifecycleRevokeResponse = {
  revoked: true,
  lifecycleStatus: 'REVOKED',
  blockers: [],
  warnings: [],
  assignment: {
    ...lifecycleAssignment,
    status: 'REVOKED' as const,
    lifecycleState: 'REVOKED' as const,
    currentlyEffective: false,
    inactiveReason: 'REVOKED',
    revokedAt: 3,
    revokedBy: 'user-admin',
    revokeReason: 'Done',
    supportedActions: [],
    auditSummary: {
      assignmentId: 'assignment-1',
      action: 'REVOKE',
      actorId: 'user-admin',
      timestamp: 3,
      reason: 'Done',
      oldStatus: 'ACTIVE',
      newStatus: 'REVOKED',
    },
  },
  auditTrace: {
    written: true,
    lifecycleAction: 'REVOKE',
    actorId: 'user-admin',
    assignmentId: 'assignment-1',
    targetUserId: 'user-admin',
    oldStatus: 'ACTIVE',
    newStatus: 'REVOKED',
    reason: 'Done',
    timestamp: 3,
  },
  sourceTrace: {
    mutatesSource: true,
    source: 'role_assignments',
    auditSource: 'audit_log',
  },
  effectiveAccessAfterLifecycle: {
    permissions: [],
  },
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

const accessAssignmentTargetsMetadata: AccessAssignmentTargetsMetadata = {
  readOnly: false,
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
  ],
  previewRemainsAuthoritative: true,
};

const mockDetailResponse = () => {
  apiRequestMock.mockResolvedValue({ data: roleDetail });
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

  it('sends Role lifecycle, permission, assignment-rule, and canonical revoke payloads exactly', async () => {
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

    apiRequestMock.mockResolvedValueOnce({ data: lifecycleRevokeResponse });
    await revokeAccessAssignment('assignment-1', { reason: 'Done' });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/access-assignments/assignment-1/revoke',
        data: {
          reason: 'Done',
        },
      }),
    );
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

  it('uses accepted access-assignment endpoints and strips frontend-owned authority fields', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: accessAssignmentTargetsMetadata });
    await expect(fetchAccessAssignmentTargets()).resolves.toEqual(accessAssignmentTargetsMetadata);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/access-assignments/targets',
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).not.toHaveProperty('data');

    apiRequestMock.mockResolvedValueOnce({ data: lifecycleListResponse });
    await expect(fetchAccessAssignmentsForUser('user-admin')).resolves.toEqual(
      lifecycleListResponse,
    );
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/access-assignments',
        params: {
          targetUserId: 'user-admin',
        },
      }),
    );

    apiRequestMock.mockResolvedValueOnce({
      data: {
        previewOnly: true,
        canApply: true,
        blockers: [],
        warnings: [],
        normalizedScope: [{ scopeType: 'self' }],
        effectiveAccessDelta: {
          addedPermissions: ['workSchedule.read'],
          removedPermissions: [],
          unchangedPermissions: [],
        },
        proposedAssignments: [{ roleCode: 'STAFF_CONSOLE_USER' }],
      },
    });
    await expect(
      previewAccessAssignment({
        targetUserId: 'user-alice',
        assignmentTargetType: 'BUNDLE',
        assignmentTargetCode: 'STAFF_CONSOLE_BUNDLE',
        bundleVersion: '2026-05-20',
        structuredScopeGrants: [{ scopeType: 'self' }],
        reason: 'Promoted to self-service access',
        accountContext: 'ADMIN_CONSOLE',
        workspaceAvailability: { primaryWorkspace: 'ADMIN_CONSOLE' },
        actorKind: 'ADMIN',
        consoleEntitlement: true,
        employmentProfileId: 'ep-001',
      } as Parameters<typeof previewAccessAssignment>[0]),
    ).resolves.toMatchObject({
      canApply: true,
    });

    const previewPayload = apiRequestMock.mock.calls.at(-1)?.[0].data;
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/access-assignments/preview',
      }),
    );
    expect(previewPayload).toEqual({
      targetUserId: 'user-alice',
      assignmentTargetType: 'BUNDLE',
      assignmentTargetCode: 'STAFF_CONSOLE_BUNDLE',
      bundleVersion: '2026-05-20',
      structuredScopeGrants: [{ scopeType: 'self' }],
      reason: 'Promoted to self-service access',
    });
    expect(previewPayload).not.toHaveProperty('accountContext');
    expect(previewPayload).not.toHaveProperty('accountContexts');
    expect(previewPayload).not.toHaveProperty('console');
    expect(previewPayload).not.toHaveProperty('consoleCode');
    expect(previewPayload).not.toHaveProperty('workspaceAvailability');
    expect(previewPayload).not.toHaveProperty('primaryWorkspace');
    expect(previewPayload).not.toHaveProperty('actorKind');
    expect(previewPayload).not.toHaveProperty('consoleEntitlement');
    expect(previewPayload).not.toHaveProperty('manualEntitlements');
    expect(previewPayload).not.toHaveProperty('permissions');
    expect(previewPayload).not.toHaveProperty('permissionRules');
    expect(previewPayload).not.toHaveProperty('assignmentRules');
    expect(previewPayload).not.toHaveProperty('employmentProfileId');

    apiRequestMock.mockResolvedValueOnce({
      data: {
        applied: true,
        canApply: true,
        applyStatus: 'APPLIED',
        blockers: [],
        warnings: [],
        normalizedScope: [{ scopeType: 'self' }],
        appliedAssignments: [{ assignmentId: 'assignment-4c' }],
        auditTrace: { assignmentIds: ['assignment-4c'] },
        effectiveAccessAfterApply: { permissions: ['workSchedule.read'] },
      },
    });
    await expect(
      applyAccessAssignment({
        targetUserId: 'user-alice',
        assignmentTargetType: 'BUNDLE',
        assignmentTargetCode: 'STAFF_CONSOLE_BUNDLE',
        bundleVersion: '2026-05-20',
        structuredScopeGrants: [{ scopeType: 'self' }],
        reason: 'Promoted to self-service access',
        previewResponse: { canApply: true },
        accountContexts: ['ADMIN_CONSOLE'],
        console: 'ADMIN',
        consoleCode: 'ADMIN_CONSOLE',
        workspaceAvailability: { primaryWorkspace: 'ADMIN_CONSOLE' },
        primaryWorkspace: 'ADMIN_CONSOLE',
        actorKind: 'ADMIN',
        manualEntitlements: ['role.assign'],
        permissions: ['role:assign_to_user'],
        permissionRules: [{ code: 'ALLOW_ALL' }],
        assignmentRules: [{ code: 'ALLOW_ALL' }],
        employmentProfileId: 'ep-001',
      } as Parameters<typeof applyAccessAssignment>[0]),
    ).resolves.toMatchObject({
      applied: true,
      applyStatus: 'APPLIED',
    });

    const applyPayload = apiRequestMock.mock.calls.at(-1)?.[0].data;
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/access-assignments/apply',
      }),
    );
    expect(applyPayload).toEqual({
      targetUserId: 'user-alice',
      assignmentTargetType: 'BUNDLE',
      assignmentTargetCode: 'STAFF_CONSOLE_BUNDLE',
      bundleVersion: '2026-05-20',
      structuredScopeGrants: [{ scopeType: 'self' }],
      reason: 'Promoted to self-service access',
    });
    expect(applyPayload).not.toHaveProperty('previewResponse');
    expect(applyPayload).not.toHaveProperty('accountContext');
    expect(applyPayload).not.toHaveProperty('accountContexts');
    expect(applyPayload).not.toHaveProperty('console');
    expect(applyPayload).not.toHaveProperty('consoleCode');
    expect(applyPayload).not.toHaveProperty('workspaceAvailability');
    expect(applyPayload).not.toHaveProperty('primaryWorkspace');
    expect(applyPayload).not.toHaveProperty('actorKind');
    expect(applyPayload).not.toHaveProperty('manualEntitlements');
    expect(applyPayload).not.toHaveProperty('permissions');
    expect(applyPayload).not.toHaveProperty('permissionRules');
    expect(applyPayload).not.toHaveProperty('assignmentRules');
    expect(applyPayload).not.toHaveProperty('employmentProfileId');
  });

  it('submits normal Role create and update surfaces with supported payloads', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreateFromTemplate = vi.fn();
    const onUpdate = vi.fn();

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
