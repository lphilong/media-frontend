import {
  applyAccessAssignment,
  createRole,
  createRoleFromTemplate,
  previewAccessAssignment,
} from '@modules/role/api/role.api';
import { roleAdminCapabilities } from '@modules/role/__tests__/role-integration-test-helpers';
import {
  getMockCurrentActorCapabilities,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import { setupMswScenario } from '@test/msw-scenario';

describe('Role MSW test-double behavior', () => {
  beforeEach(() => {
    setupMswScenario({ capabilities: roleAdminCapabilities });
  });

  it('models Account Context reused and proposed preview states', async () => {
    const proposed = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-a' }],
      reason: 'MSW proposed context',
    });
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
      reason: 'MSW reused context',
    });
    expect(reused.accountContextRequirement).toMatchObject({
      status: 'SATISFIED',
      reusedAccountContexts: ['STAFF_CONSOLE'],
    });
  });

  it('models responsibility reuse, create proposal, and fail-closed materialization', async () => {
    const reused = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-a' }],
      reason: 'MSW reused responsibility',
    });
    expect(reused.responsibilityRequirements?.[0]).toMatchObject({
      status: 'SATISFIED',
      operation: 'REUSE_EXISTING',
    });

    const proposed = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
      reason: 'MSW proposed responsibility',
    });
    expect(proposed.responsibilityRequirements?.[0]).toMatchObject({
      status: 'CREATE_PROPOSED',
      operation: 'CREATE_REQUIRED',
      proposedResponsibility: {
        subjectId: 'group-create',
        responsibilityType: 'TALENT_GROUP_MANAGER',
      },
    });

    const original = getMockCurrentActorCapabilities();
    setMockCurrentActorCapabilities({
      ...original,
      permissions: original.permissions.filter(
        (permission) => permission !== 'role:assign_to_user' && permission !== 'talentGroup.update',
      ),
    });
    try {
      const blocked = await previewAccessAssignment({
        targetUserId: 'user-alice',
        assignmentTargetType: 'ROLE_TEMPLATE',
        assignmentTargetCode: 'TALENT_GROUP_MANAGER',
        structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
        reason: 'MSW blocked materialization',
      });
      expect(blocked.canApply).toBe(false);
      expect(blocked.accountContextRequirement).toMatchObject({ status: 'BLOCKED_UNAUTHORIZED' });
      expect(blocked.responsibilityRequirements?.[0]).toMatchObject({
        status: 'MISSING_RESPONSIBILITY_UNAUTHORIZED',
      });
    } finally {
      setMockCurrentActorCapabilities(original);
    }
  });

  it('models apply materialization as a test double only', async () => {
    const result = await applyAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'TALENT_GROUP_MANAGER',
      structuredScopeGrants: [{ scopeType: 'managedTalentGroup', targetId: 'group-create' }],
      reason: 'MSW apply materialization',
    });

    expect(result.applied).toBe(true);
    expect(result.accountContextResult).toMatchObject({
      materialized: true,
      materializationPolicy: 'APPLIED_FROM_ACCESS_ASSIGNMENT_PREVIEW',
      appliedAccountContexts: ['MANAGER_CONSOLE'],
    });
    expect(result.responsibilityOperationResult).toMatchObject({
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

  it('models review and expiry window blockers consistently', async () => {
    const lateReview = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'STAFF_CONSOLE_USER',
      structuredScopeGrants: [{ scopeType: 'global' }],
      reason: 'MSW review window',
      effectiveAt: '2026-01-01',
      reviewAt: '2026-04-15',
    });
    expect(lateReview.canApply).toBe(false);
    expect(lateReview.blockers.map((blocker) => blocker.code)).toContain(
      'REVIEW_AT_EXCEEDS_MAX_WINDOW',
    );
    expect(lateReview.sensitiveAccess).toMatchObject({ maxReviewWindowDays: 90 });

    const lateExpiry = await previewAccessAssignment({
      targetUserId: 'user-alice',
      assignmentTargetType: 'ROLE_TEMPLATE',
      assignmentTargetCode: 'OWNER_ADMIN',
      structuredScopeGrants: [{ scopeType: 'global' }],
      reason: 'MSW expiry window',
      effectiveAt: '2026-01-01',
      reviewAt: '2026-01-10',
      expiresAt: '2026-01-20',
    });
    expect(lateExpiry.canApply).toBe(false);
    expect(lateExpiry.blockers.map((blocker) => blocker.code)).toContain(
      'EXPIRES_AT_EXCEEDS_MAX_WINDOW',
    );
    expect(lateExpiry.sensitiveAccess).toMatchObject({
      maxReviewWindowDays: 14,
      maxExpiryWindowDays: 14,
    });
  });

  it('normalizes duplicate create codes and generates unique omitted codes', async () => {
    await expect(
      createRole({ name: 'Duplicate admin code', code: ' admin ', description: null }),
    ).rejects.toMatchObject({ status: 409, code: 'ROLE_CONFLICT' });

    await expect(
      createRoleFromTemplate({
        templateCode: 'TALENT_GROUP_MANAGER',
        name: 'Duplicate template code',
        code: 'ops',
        description: null,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'ROLE_CONFLICT' });

    const custom = await createRole({ name: 'Generated custom role', description: null });
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
