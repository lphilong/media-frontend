import {
  applyAccessAssignment,
  createRole,
  createRoleFromTemplate,
  fetchAccessAssignmentsForUser,
  fetchAccessAssignmentTargets,
  fetchEffectiveAccess,
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
import type {
  RolePermissionReplacementPayload,
  RoleTemplateListItem,
} from '@modules/role/types/role.types';
import {
  accessAssignmentTargetsFixture,
  lifecycleListFixture,
  lifecycleRevokeFixture,
  roleDetailFixture,
  roleTemplateCatalogFixture,
  roleTemplatePreviewFixture,
} from '@modules/role/__tests__/role-test-fixtures';
import { apiRequest } from '@shared/api';

vi.mock('@shared/api', () => ({ apiRequest: vi.fn() }));

const apiRequestMock = vi.mocked(apiRequest);
const mockRoleDetailResponse = () => apiRequestMock.mockResolvedValue({ data: roleDetailFixture });

describe('Role API and schema contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes list, create, and update requests at the API boundary', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: [] });
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
        params: { state: 'ACTIVE', cursor: 'opaque', limit: 50, search: 'Admin' },
      }),
    );

    mockRoleDetailResponse();
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

    mockRoleDetailResponse();
    await createRole({ name: 'Manual role', code: 'MANUAL_ROLE', description: null });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toMatchObject({
      name: 'Manual role',
      code: 'MANUAL_ROLE',
    });

    await updateRole('role-admin', {
      name: 'Admin role updated',
      scopeGrants: ['x'],
    } as Parameters<typeof updateRole>[1]);
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      name: 'Admin role updated',
      description: undefined,
      delegationBand: undefined,
      maxDelegatableBand: undefined,
    });
  });

  it('sends exact lifecycle, permission, assignment-rule, and revoke payloads', async () => {
    mockRoleDetailResponse();

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
        data: { reason: null },
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
        data: { permissions: ['role:view', 'user:view'] },
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
        data: { rules: [{ code: 'ALLOW_ADMIN', conditions: null }] },
      }),
    );

    apiRequestMock.mockResolvedValueOnce({ data: lifecycleRevokeFixture });
    await revokeAccessAssignment('assignment-1', { reason: 'Done' });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/access-assignments/assignment-1/revoke',
        data: { reason: 'Done' },
      }),
    );
  });

  it('parses strict Role template responses and rejects contract drift', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: roleTemplateCatalogFixture });
    await expect(fetchRoleTemplates()).resolves.toEqual(roleTemplateCatalogFixture);

    apiRequestMock.mockResolvedValueOnce({ data: roleTemplatePreviewFixture });
    await expect(previewRoleTemplate('TALENT_GROUP_MANAGER')).resolves.toEqual(
      roleTemplatePreviewFixture,
    );

    mockRoleDetailResponse();
    await expect(
      createRoleFromTemplate({
        templateCode: 'TALENT_GROUP_MANAGER',
        name: 'Team Manager Copy',
        description: null,
      }),
    ).resolves.toEqual(roleDetailFixture);

    apiRequestMock.mockResolvedValueOnce({
      data: [{ ...roleTemplateCatalogFixture[0], extra: 'unsupported' }],
    });
    await expect(fetchRoleTemplates()).rejects.toThrow();
  });

  it('fails closed when catalog readiness metadata is missing or unknown', async () => {
    const templateMissingReadiness: Partial<RoleTemplateListItem> = {
      ...roleTemplateCatalogFixture[0],
    };
    delete templateMissingReadiness.assignabilityStatus;
    delete templateMissingReadiness.operatorFlowGroup;

    apiRequestMock.mockResolvedValueOnce({ data: [templateMissingReadiness] });
    const [template] = await fetchRoleTemplates();
    expect(template.assignabilityStatus).toBe('SYSTEM_CONTROLLED');
    expect(template.operatorFlowGroup).toBe('SYSTEM_CONTROLLED');

    apiRequestMock.mockResolvedValueOnce({
      data: {
        ...accessAssignmentTargetsFixture,
        assignmentTargets: [
          {
            ...accessAssignmentTargetsFixture.assignmentTargets[0],
            assignabilityStatus: 'UNKNOWN_READY_STATE',
            operatorFlowGroup: 'UNKNOWN_READY_GROUP',
          },
        ],
      },
    });
    const targets = await fetchAccessAssignmentTargets();
    expect(targets.assignmentTargets[0]).toMatchObject({
      assignabilityStatus: 'SYSTEM_CONTROLLED',
      operatorFlowGroup: 'SYSTEM_CONTROLLED',
    });
  });

  it('uses canonical assignment endpoints and strips backend-owned authority fields', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: accessAssignmentTargetsFixture });
    await expect(fetchAccessAssignmentTargets()).resolves.toEqual(accessAssignmentTargetsFixture);
    expect(apiRequestMock).toHaveBeenLastCalledWith({
      method: 'GET',
      url: '/admin/access-assignments/targets',
    });

    apiRequestMock.mockResolvedValueOnce({ data: lifecycleListFixture });
    await expect(fetchAccessAssignmentsForUser('user-admin')).resolves.toEqual(
      lifecycleListFixture,
    );
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/access-assignments',
        params: { targetUserId: 'user-admin' },
      }),
    );

    apiRequestMock.mockResolvedValueOnce({
      data: {
        previewOnly: true,
        canApply: true,
        blockers: [],
        warnings: [],
        normalizedScope: [{ scopeType: 'self' }],
      },
    });
    await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'BUNDLE',
      assignmentTargetCode: 'STAFF_CONSOLE_BUNDLE',
      bundleVersion: '2026-05-20',
      structuredScopeGrants: [{ scopeType: 'self' }],
      reason: 'Personal access',
      accountContext: 'ADMIN_CONSOLE',
      workspaceAvailability: { primaryWorkspace: 'ADMIN_CONSOLE' },
      actorKind: 'ADMIN',
      employmentProfileId: 'ep-001',
    } as Parameters<typeof previewAccessAssignment>[0]);

    const previewPayload = apiRequestMock.mock.calls.at(-1)?.[0].data;
    expect(previewPayload).toEqual({
      targetUserId: 'user-alice',
      assignmentTargetType: 'BUNDLE',
      assignmentTargetCode: 'STAFF_CONSOLE_BUNDLE',
      bundleVersion: '2026-05-20',
      structuredScopeGrants: [{ scopeType: 'self' }],
      reason: 'Personal access',
    });

    apiRequestMock.mockResolvedValueOnce({
      data: {
        applied: true,
        canApply: true,
        applyStatus: 'APPLIED',
        blockers: [],
        warnings: [],
        normalizedScope: [{ scopeType: 'self' }],
      },
    });
    await applyAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'BUNDLE',
      assignmentTargetCode: 'STAFF_CONSOLE_BUNDLE',
      bundleVersion: '2026-05-20',
      structuredScopeGrants: [{ scopeType: 'self' }],
      reason: 'Personal access',
      previewResponse: { canApply: true },
      accountContexts: ['ADMIN_CONSOLE'],
      primaryWorkspace: 'ADMIN_CONSOLE',
      actorKind: 'ADMIN',
      permissions: ['role:assign_to_user'],
      employmentProfileId: 'ep-001',
    } as Parameters<typeof applyAccessAssignment>[0]);

    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual(previewPayload);
    for (const forbidden of [
      'previewResponse',
      'accountContext',
      'accountContexts',
      'console',
      'workspaceAvailability',
      'primaryWorkspace',
      'actorKind',
      'permissions',
      'employmentProfileId',
    ]) {
      expect(previewPayload).not.toHaveProperty(forbidden);
      expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty(forbidden);
    }
  });

  it('parses additive materialization fields without weakening strict response roots', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: {
        previewOnly: true,
        canApply: true,
        blockers: [],
        warnings: [],
        normalizedScope: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
        accountContextRequirement: {
          status: 'PROPOSED_FOR_APPLICATION',
          requiredAccountContexts: ['MANAGER_CONSOLE'],
          futureTrace: { accepted: true },
        },
        responsibilityRequirements: [
          {
            status: 'CREATE_PROPOSED',
            requiredResponsibilityType: 'TALENT_GROUP_MANAGER',
            futureTrace: { accepted: true },
          },
        ],
        futurePreviewField: { accepted: true },
      },
    });
    const preview = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
      reason: 'Materialization contract',
    });
    expect(preview.accountContextRequirement).toMatchObject({
      status: 'PROPOSED_FOR_APPLICATION',
      futureTrace: { accepted: true },
    });
    expect(preview.responsibilityRequirements?.[0]).toMatchObject({
      status: 'CREATE_PROPOSED',
      futureTrace: { accepted: true },
    });

    apiRequestMock.mockResolvedValueOnce({
      data: {
        applied: true,
        canApply: true,
        applyStatus: 'APPLIED',
        blockers: [],
        warnings: [],
        accountContextResult: { materialized: true, futureTrace: { accepted: true } },
        responsibilityOperationResult: {
          materialized: true,
          futureTrace: { accepted: true },
        },
      },
    });
    const applied = await applyAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
      reason: 'Materialization contract',
    });
    expect(applied.accountContextResult).toMatchObject({
      materialized: true,
      futureTrace: { accepted: true },
    });
    expect(applied.responsibilityOperationResult).toMatchObject({
      materialized: true,
      futureTrace: { accepted: true },
    });
  });

  it('accepts additive templateCode in effective-access assignment trace', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: {
        readOnly: true,
        sourceTruth: true,
        user: {
          id: 'user-admin',
          displayName: 'Admin User',
          email: 'admin@example.test',
          accountStatus: 'ACTIVE',
        },
        accountContextSignals: {
          canonicalAccountContextImplemented: true,
          canonicalSource: 'ACCOUNT_CONTEXT',
          accountContexts: ['ADMIN_CONSOLE'],
          compatibilityContexts: [],
          grantsAuthorityByItself: false,
        },
        workspaceAvailability: {
          primaryWorkspace: 'ADMIN_CONSOLE',
          availableWorkspaces: [
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
        activeRoleAssignments: [
          {
            assignmentId: 'assignment-owner',
            roleId: 'role-owner',
            roleCode: 'OWNER_ADMIN',
            roleName: 'Owner Admin',
            templateCode: 'OWNER_ADMIN',
            permissions: ['role:view'],
            legacyScopeGrants: null,
            structuredScopeGrants: [{ scopeType: 'global', additiveTrace: 'preserved' }],
            scopeFingerprint: 'global',
            reason: 'Source trace coverage',
            assignedBy: 'owner',
            assignedAt: 1,
            effectiveAt: 1,
            expiresAt: null,
            reviewAt: null,
            origin: 'DIRECT',
            bundleOrigin: null,
            sensitiveOrGlobal: true,
            isSensitive: true,
            isGlobalLike: true,
            isHighRisk: true,
            requiresReview: true,
            isBreakGlassLike: false,
            futureAdditiveTrace: 'accepted',
          },
        ],
        roles: [
          {
            id: 'role-owner',
            code: 'OWNER_ADMIN',
            name: 'Owner Admin',
            templateCode: 'OWNER_ADMIN',
          },
        ],
        permissions: ['role:view'],
        permissionSourceTrace: [],
        businessResponsibilitySupport: {
          status: 'NOT_EVALUATED',
          claims: [],
          note: 'No responsibility trace.',
        },
        generatedAt: '2026-05-20T00:00:00.000Z',
      },
    });

    const access = await fetchEffectiveAccess('user-admin');
    expect(access.activeRoleAssignments[0]).toMatchObject({
      assignmentId: 'assignment-owner',
      templateCode: 'OWNER_ADMIN',
    });
    expect(access.roles[0]).toMatchObject({
      id: 'role-owner',
      code: 'OWNER_ADMIN',
      templateCode: 'OWNER_ADMIN',
    });
  });
});
