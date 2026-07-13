import { buildAccessAssignmentPayload } from '@modules/role/model/access-assignment-payload';
import {
  buildAccessAssignmentRequirementState,
  buildAccessAssignmentStructuredScopeGrants,
  getAccessAssignmentRequirementIssueCodes,
  getUnsupportedAccessAssignmentScopeTypes,
  normalizeAccessAssignmentRequiredScopeTypes,
} from '@modules/role/model/access-assignment-requirements';
import {
  selectAccessAssignmentTargets,
  selectDefaultAccessAssignmentTarget,
  toAccessAssignmentTargetKey,
} from '@modules/role/model/access-assignment-targets';
import {
  buildAccessAssignmentWorkflowSteps,
  deriveAccessAssignmentReadiness,
} from '@modules/role/model/access-assignment-workflow';
import type { AccessAssignmentTargetOption } from '@modules/role/types/role.types';

const target = (
  overrides: Partial<AccessAssignmentTargetOption> = {},
): AccessAssignmentTargetOption => ({
  assignmentKind: 'ROLE_TEMPLATE',
  code: 'STAFF_CONSOLE_USER',
  name: 'Staff Console User',
  requiredScopeTypes: ['self'],
  requiresResponsibility: false,
  legacyAssignable: true,
  assignabilityStatus: 'READY_ASSIGNABLE',
  operatorFlowGroup: 'READY_TO_ASSIGN',
  ...overrides,
});

describe('Access assignment model', () => {
  it('derives one blocking requirement state for scoped review-required assignments', () => {
    const selectedTarget = target({
      code: 'TALENT_GROUP_MANAGER',
      requiredScopeTypes: ['managedTalentGroup'],
      requiresResponsibility: true,
    });
    const requiredScopeTypes = normalizeAccessAssignmentRequiredScopeTypes(
      selectedTarget.requiredScopeTypes,
    );
    const requirementState = buildAccessAssignmentRequirementState({
      selectedTarget,
      requiredScopeTypes,
      scopeTargetIds: {},
      scopePeriodKeys: {},
      reason: ' ',
      reviewAt: '',
      expiresAt: '',
      unsupportedScopeTypes: getUnsupportedAccessAssignmentScopeTypes(requiredScopeTypes),
    });

    expect(requirementState).toMatchObject({
      requiresScope: true,
      requiresReason: true,
      requiresReviewDate: true,
      missingScope: true,
      missingReason: true,
      missingReviewDate: true,
      canEnterPreview: false,
    });
    expect(getAccessAssignmentRequirementIssueCodes(requirementState)).toEqual([
      'scope',
      'reason',
      'reviewDate',
    ]);
  });

  it('keeps supported scope construction ordered and fails closed for unsupported scopes', () => {
    const scopeTypes = normalizeAccessAssignmentRequiredScopeTypes([
      'self',
      'managedTalentGroup',
      'financePeriod',
      'attendancePeriodOrg',
      'self',
    ]);

    expect(
      buildAccessAssignmentStructuredScopeGrants(
        scopeTypes,
        {
          managedTalentGroup: 'group-a',
        },
        {
          financePeriod: '2026-08',
        },
      ),
    ).toEqual([
      { scopeType: 'self' },
      { scopeType: 'managedTalentGroup', targetId: 'group-a' },
      { scopeType: 'financePeriod', periodKey: '2026-08' },
    ]);
    expect(getUnsupportedAccessAssignmentScopeTypes(scopeTypes)).toEqual(['attendancePeriodOrg']);
  });

  it('preserves direct-role and bundle payload field inclusion rules', () => {
    expect(
      buildAccessAssignmentPayload({
        selectedUserId: 'user-a',
        selectedTarget: target({ assignmentKind: 'ROLE', id: 'role-a', code: 'ACCESS_ADMIN' }),
        structuredScopeGrants: [{ scopeType: 'global' }],
        reason: 'Direct role assignment',
      }),
    ).toEqual({
      targetUserId: 'user-a',
      assignmentTargetType: 'ROLE',
      assignmentTargetId: 'role-a',
      assignmentTargetCode: 'ACCESS_ADMIN',
      structuredScopeGrants: [{ scopeType: 'global' }],
      reason: 'Direct role assignment',
      reviewAt: undefined,
      expiresAt: undefined,
    });

    expect(
      buildAccessAssignmentPayload({
        selectedUserId: 'user-a',
        selectedTarget: target({
          assignmentKind: 'BUNDLE',
          code: 'OWNER_ADMIN_BUNDLE',
          version: '2026-05-20',
        }),
        structuredScopeGrants: [{ scopeType: 'global' }],
        reason: 'Controlled bundle assignment',
        reviewAt: '2026-08-01',
        expiresAt: '2026-08-10',
      }),
    ).toEqual({
      targetUserId: 'user-a',
      assignmentTargetType: 'BUNDLE',
      assignmentTargetCode: 'OWNER_ADMIN_BUNDLE',
      bundleVersion: '2026-05-20',
      structuredScopeGrants: [{ scopeType: 'global' }],
      reason: 'Controlled bundle assignment',
      reviewAt: '2026-08-01',
      expiresAt: '2026-08-10',
    });
  });

  it('keeps target participation, preview freshness, blocker, and apply readiness aligned', () => {
    const readyTarget = target();
    const targets = [
      readyTarget,
      target({
        assignmentKind: 'BUNDLE',
        code: 'STAFF_CONSOLE_BUNDLE',
        version: '2026-05-20',
      }),
      target({ code: 'FUTURE_ROLE', assignabilityStatus: 'FUTURE_READY_CONDITION' }),
    ];
    const activeTargets = selectAccessAssignmentTargets(targets, 'BUNDLE');
    const selectedTarget = selectDefaultAccessAssignmentTarget(activeTargets);
    const payload = buildAccessAssignmentPayload({
      selectedUserId: 'user-a',
      selectedTarget: selectedTarget!,
      structuredScopeGrants: [{ scopeType: 'self' }],
      reason: 'Ready to preview',
    });
    const signature = JSON.stringify(payload);
    const requirementState = buildAccessAssignmentRequirementState({
      selectedTarget,
      requiredScopeTypes: ['self'],
      scopeTargetIds: {},
      scopePeriodKeys: {},
      reason: 'Ready to preview',
      reviewAt: '',
      expiresAt: '',
      unsupportedScopeTypes: [],
    });
    const readiness = deriveAccessAssignmentReadiness({
      currentPayload: payload,
      hasSelectedUser: true,
      userStepComplete: true,
      hasSelectedTarget: true,
      requirementState,
      previewResult: { canApply: true, blockers: [], warnings: [] },
      previewSignature: signature,
      currentSignature: signature,
      isPreviewPending: false,
      isApplyPending: false,
      reason: 'Ready to preview',
    });

    expect(activeTargets.map(toAccessAssignmentTargetKey)).toEqual([
      'BUNDLE:STAFF_CONSOLE_BUNDLE:2026-05-20',
    ]);
    expect(readiness).toMatchObject({
      previewMatchesCurrent: true,
      canPreview: true,
      canApply: true,
      conditionsStepComplete: true,
      previewStepComplete: true,
    });

    const blockedSteps = buildAccessAssignmentWorkflowSteps({
      activeStepId: 'conditions',
      user: { id: 'user-a', label: 'Alice', disabled: false },
      target: {
        selected: true,
        complete: true,
        summary: 'Staff access',
        unavailable: false,
        requiresSensitiveConfirmation: false,
      },
      conditions: { complete: false, summary: '-', note: 'Missing a required field' },
      preview: { result: undefined, matchesCurrent: false, hasBlockers: false, complete: false },
      labels: {
        userTitle: 'User',
        userEmptySummary: 'No user',
        userInvalidNote: 'Invalid user',
        targetTitle: 'Target',
        targetEmptySummary: 'No target',
        targetUnavailableNote: 'Unavailable',
        targetSensitiveNote: 'Sensitive',
        conditionsTitle: 'Conditions',
        conditionsIncompleteSummary: 'Incomplete',
        previewTitle: 'Preview',
        previewReadySummary: 'Ready',
        previewEmptySummary: 'Not previewed',
        previewSensitiveNote: 'Confirm',
      },
    });

    expect(blockedSteps[2]).toMatchObject({ tone: 'danger', isActive: true });
    expect(blockedSteps[3]).toMatchObject({ tone: 'neutral', canNavigate: false });
  });
});
