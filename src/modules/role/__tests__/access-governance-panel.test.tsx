import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient } from '@tanstack/react-query';

import { AccessGovernancePanel } from '@modules/role/components/AccessGovernancePanel';
import { PERMISSIONS } from '@shared/auth/current-actor-capabilities';
import { createActorCapabilities } from '@test/factories/access';
import { renderModuleSurface } from '@test/render-app-route';
import { server } from '@test/msw/server';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import { parseBusinessDateTimeInputValue } from '@shared/formatting/formatters';
import { mergeLifecycleQueue } from '@modules/role/hooks/use-role';
import type { AccessLifecycleStatusView } from '@modules/role/types/role.types';

const now = Date.now();

const capabilities = (permissions: string[]) =>
  createActorCapabilities({
    id: 'reviewer-user',
    accountContexts: ['ADMIN_CONSOLE'],
    permissions,
  });

const lifecycleResponse = {
  generatedAt: now,
  availableScopeTypes: ['global', 'contractPortfolio'],
  policy: {
    version: 'access-lifecycle-command-policy/v2',
    timeZone: 'Asia/Ho_Chi_Minh',
    grace: { automaticExtensionMs: 259_200_000, maximumAbsoluteExtensionMs: 604_800_000 },
  },
  pagination: {
    pageSize: 25,
    reviewCycles: { nextCursor: null, exhausted: true },
    graceExceptions: { nextCursor: null, exhausted: true },
    successorRequests: { nextCursor: null, exhausted: true },
  },
  reviewCycles: [],
  graceExceptions: [],
  successorRequests: [],
  requestableAssignments: [],
};

const governancePrincipal = (principalId: string, overrides: Record<string, unknown> = {}) => ({
  principalId,
  principalType: 'SUCCESSOR_OWNER',
  status: 'PENDING',
  effectiveAt: now + 1_000,
  expiresAt: now + 30 * 24 * 60 * 60 * 1_000,
  eligibleNow: false,
  eligible: false,
  eligibilityReasons: ['PRINCIPAL_NOT_ACTIVE'],
  canApproveSuccessor: false,
  canActivateSuccessor: false,
  ineligibilityReason: 'INDEPENDENT_APPROVER_REQUIRED',
  nextAllowedAction: 'INDEPENDENT_REVIEW',
  ...overrides,
});

const activation = (
  activationId: string,
  status: 'ACTIVE' | 'EXPIRED',
  canReview: boolean,
  canEnd = false,
) => ({
  activationId,
  requestId: `request-${activationId}`,
  targetUserId: 'target-user',
  permissions: ['kpi.read'],
  structuredScopeGrants: [{ scopeType: 'global' }],
  scopeFingerprint: 'scope:v1:global',
  incidentReferenceId: status === 'ACTIVE' ? 'INC-ACTIVE' : 'INC-EXPIRED',
  reason: 'Emergency response',
  activatorUserId: 'owner-user',
  activatedAt: now - 60_000,
  expiresAt: status === 'ACTIVE' ? now + 60_000 : now - 1,
  endedAt: null,
  endedByUserId: null,
  endReason: null,
  status,
  stepUpState: 'SATISFIED',
  independentReviewDeadline: {
    calendarVersion: 'v1',
    timeZone: 'Asia/Ho_Chi_Minh',
    dueAt: now + 24 * 60 * 60 * 1_000,
  },
  independentReviewState: status === 'EXPIRED' ? 'OVERDUE' : 'PENDING',
  independentReviewCategory: 'POST_USE_REVIEW',
  overdueSince: status === 'EXPIRED' ? now - 1 : null,
  completedAt: null,
  wasOverdue: false,
  reviewerUserId: null,
  reviewResult: null,
  reviewedAt: null,
  auditCorrelationId: `trace-${activationId}`,
  currentlyEffective: status === 'ACTIVE',
  remainingMs: status === 'ACTIVE' ? 60_000 : 0,
  canReview,
  canEnd,
  endIneligibilityReason: canEnd ? null : 'BREAK_GLASS_END_NOT_AUTHORIZED',
  ineligibilityReason: canReview ? null : 'POST_USE_REVIEW_REQUIRES_EXPIRED_ACTIVATION',
  nextAllowedAction: status === 'ACTIVE' ? 'WAIT_FOR_EXPIRY' : 'INDEPENDENT_REVIEW',
});

describe('AccessGovernancePanel', () => {
  it('keeps queue-specific explicit continuation actionable beyond twenty pages and across an empty page', () => {
    let current = lifecycleResponse as unknown as AccessLifecycleStatusView;
    for (let page = 1; page <= 21; page += 1) {
      const next = {
        ...lifecycleResponse,
        reviewCycles: [{ cycleId: `cycle-${page}` }],
        pagination: {
          ...lifecycleResponse.pagination,
          reviewCycles: { nextCursor: `cursor-${page}`, exhausted: false },
        },
      } as unknown as AccessLifecycleStatusView;
      current = mergeLifecycleQueue(current, next, 'review');
    }

    assertQueueContinuation(current, 21, 'cursor-21');
    const emptyContinuation = {
      ...lifecycleResponse,
      pagination: {
        ...lifecycleResponse.pagination,
        reviewCycles: { nextCursor: 'cursor-22', exhausted: false },
      },
    } as unknown as AccessLifecycleStatusView;
    current = mergeLifecycleQueue(current, emptyContinuation, 'review');
    assertQueueContinuation(current, 21, 'cursor-22');
  });

  it('renders lifecycle actions only when the backend marks the exact record eligible', async () => {
    const posts: string[] = [];
    const successorBodies: Array<Record<string, unknown>> = [];
    let successorAttempts = 0;
    setMockCurrentActorCapabilities(
      capabilities([
        PERMISSIONS.ROLE_ASSIGNMENT_REVIEW,
        PERMISSIONS.ROLE_ASSIGNMENT_GRACE_APPROVE,
        PERMISSIONS.ROLE_ASSIGNMENT_RENEW,
        PERMISSIONS.ROLE_ASSIGNMENT_REPLACE,
      ]),
    );
    server.use(
      http.get('*/admin/access-assignments/targets', () =>
        HttpResponse.json({
          data: {
            readOnly: false,
            unrestrictedUserListReturned: false,
            searchFirstUserPickerRequired: true,
            eligibleUsersReturned: false,
            userListReturned: false,
            frontendSettableFields: [],
            frontendSettableAuthorityFields: [],
            backendOwnedAuthorityFields: [],
            assignmentTargets: [
              {
                assignmentKind: 'ROLE',
                id: 'role-owner',
                code: 'OWNER_ADMIN',
                name: 'Owner administration',
                requiredScopeTypes: ['global'],
                requiresResponsibility: false,
                legacyAssignable: true,
              },
              {
                assignmentKind: 'ROLE',
                id: 'role-replacement',
                code: 'ACCESS_ADMIN',
                name: 'Access administrator',
                requiredScopeTypes: ['global', 'financePeriod'],
                requiresResponsibility: false,
                legacyAssignable: true,
              },
            ],
            previewRemainsAuthoritative: true,
          },
        }),
      ),
      http.get('*/admin/roles', () =>
        HttpResponse.json({
          data: [
            {
              id: 'role-owner',
              code: 'OWNER_ADMIN',
              name: 'Owner administration',
              state: 'ACTIVE',
              updatedAt: now,
            },
            {
              id: 'role-replacement',
              code: 'ACCESS_ADMIN',
              name: 'Access administrator',
              state: 'ACTIVE',
              updatedAt: now,
            },
          ],
        }),
      ),
      http.get('*/admin/access-assignments/lifecycle', () =>
        HttpResponse.json({
          data: {
            ...lifecycleResponse,
            reviewCycles: [
              {
                cycleId: 'cycle-ineligible',
                assignmentId: 'assignment-1',
                targetUserId: 'target-user',
                riskTier: 'HIGH',
                reviewDeadline: now + 60_000,
                automaticGraceEndsAt: null,
                maximumGraceEndsAt: null,
                state: 'PENDING',
                requiredApprovals: 2,
                completedApprovals: 0,
                remainingApprovals: 2,
                canApprove: false,
                canReject: false,
                canRequestGrace: false,
                ineligibilityReason: 'EXACT_LIFECYCLE_SCOPE_REQUIRED',
                nextAllowedAction: null,
              },
              {
                cycleId: 'cycle-eligible',
                assignmentId: 'assignment-2',
                targetUserId: 'target-user',
                riskTier: 'LOW',
                reviewDeadline: now + 120_000,
                automaticGraceEndsAt: now + 259_200_000,
                maximumGraceEndsAt: now + 604_800_000,
                state: 'PENDING',
                requiredApprovals: 1,
                completedApprovals: 0,
                remainingApprovals: 1,
                canApprove: true,
                canReject: true,
                canRequestGrace: true,
                ineligibilityReason: null,
                nextAllowedAction: 'INDEPENDENT_REVIEW',
              },
            ],
            graceExceptions: [
              {
                exceptionId: 'grace-eligible',
                cycleId: 'cycle-eligible',
                targetUserId: 'target-user',
                requestedAt: now,
                requestedExpiresAt: now + 3 * 24 * 60 * 60 * 1_000,
                state: 'PENDING',
                canApprove: true,
                canReject: true,
                ineligibilityReason: null,
                nextAllowedAction: 'INDEPENDENT_GRACE_DECISION',
              },
            ],
            successorRequests: [
              {
                requestId: 'successor-eligible',
                action: 'RENEWAL',
                predecessorAssignmentId: 'assignment-2',
                targetUserId: 'target-user',
                requestedAt: now,
                state: 'PENDING',
                riskTier: 'LOW',
                effectiveAt: now + 60_000,
                expiresAt: now + 60 * 24 * 60 * 60 * 1_000,
                reviewAt: now + 30 * 24 * 60 * 60 * 1_000,
                requiredApprovals: 1,
                completedApprovals: 0,
                remainingApprovals: 1,
                canApprove: true,
                canReject: true,
                ineligibilityReason: null,
                nextAllowedAction: 'INDEPENDENT_SUCCESSOR_DECISION',
              },
            ],
            requestableAssignments: [
              {
                assignmentId: 'assignment-owner',
                targetUserId: 'target-user',
                roleId: 'role-owner',
                roleCode: 'OWNER_ADMIN',
                structuredScopeGrants: [{ scopeType: 'global' }],
                scopeFingerprint: 'scope:v1:global',
                state: 'ACTIVE',
                effectiveAt: now - 1,
                expiresAt: null,
                reviewAt: now + 30 * 24 * 60 * 60 * 1_000,
                riskTier: 'HIGH',
                riskPolicyVersion: 'sensitive-access-policy/v1',
                reviewWindowMs: 30 * 24 * 60 * 60 * 1_000,
                actionTiming: {
                  renewalEffectiveAt: now + 60_000,
                  replacementEffectiveAt: now,
                  restorationEffectiveAt: now,
                },
                canRenew: true,
                canReplace: true,
                canRestore: false,
                ineligibilityReasons: {
                  renewal: null,
                  replacement: null,
                  restoration: 'RESTORATION_NOT_ELIGIBLE',
                },
              },
              {
                assignmentId: 'assignment-active-2',
                targetUserId: 'target-user',
                roleId: 'role-owner',
                roleCode: 'OWNER_ADMIN',
                structuredScopeGrants: [{ scopeType: 'global' }],
                scopeFingerprint: 'scope:v1:global',
                state: 'ACTIVE',
                effectiveAt: now - 1,
                expiresAt: now + 24 * 60 * 60 * 1_000,
                reviewAt: now + 30 * 24 * 60 * 60 * 1_000,
                riskTier: 'HIGH',
                riskPolicyVersion: 'sensitive-access-policy/v1',
                reviewWindowMs: 30 * 24 * 60 * 60 * 1_000,
                actionTiming: {
                  renewalEffectiveAt: now + 24 * 60 * 60 * 1_000,
                  replacementEffectiveAt: now,
                  restorationEffectiveAt: now,
                },
                canRenew: false,
                canReplace: true,
                canRestore: false,
                ineligibilityReasons: {
                  renewal: 'RENEWAL_NOT_ELIGIBLE',
                  replacement: null,
                  restoration: 'RESTORATION_NOT_ELIGIBLE',
                },
              },
              {
                assignmentId: 'assignment-suspended',
                targetUserId: 'target-user',
                roleId: 'role-suspended',
                roleCode: 'ACCESS_ADMIN',
                structuredScopeGrants: [{ scopeType: 'global' }],
                scopeFingerprint: 'scope:v1:global',
                state: 'SUSPENDED',
                effectiveAt: now - 1,
                expiresAt: null,
                reviewAt: now - 1,
                riskTier: 'HIGH',
                riskPolicyVersion: 'sensitive-access-policy/v1',
                reviewWindowMs: 30 * 24 * 60 * 60 * 1_000,
                actionTiming: {
                  renewalEffectiveAt: now,
                  replacementEffectiveAt: now,
                  restorationEffectiveAt: now,
                },
                canRenew: false,
                canReplace: false,
                canRestore: true,
                ineligibilityReasons: {
                  renewal: 'RENEWAL_NOT_ELIGIBLE',
                  replacement: 'REPLACEMENT_NOT_ELIGIBLE',
                  restoration: null,
                },
              },
            ],
          },
        }),
      ),
      http.post('*/admin/access-assignments/lifecycle/reviews/:cycleId/decision', ({ params }) => {
        posts.push(String(params.cycleId));
        return HttpResponse.json({ data: { applied: true } });
      }),
      http.post(
        '*/admin/access-assignments/lifecycle/grace-exceptions/:exceptionId/decision',
        ({ params }) => {
          posts.push(`grace:${String(params.exceptionId)}`);
          return HttpResponse.json({ data: { applied: true } });
        },
      ),
      http.post('*/admin/access-assignments/lifecycle/successors', async ({ request }) => {
        posts.push('successor:create');
        successorBodies.push((await request.json()) as Record<string, unknown>);
        successorAttempts += 1;
        if (successorAttempts === 1) {
          return HttpResponse.json({ error: { code: 'RESPONSE_LOST' } }, { status: 503 });
        }
        return HttpResponse.json({ data: { applied: true } });
      }),
      http.post(
        '*/admin/access-assignments/lifecycle/successors/:requestId/decision',
        ({ params }) => {
          posts.push(`successor:${String(params.requestId)}`);
          return HttpResponse.json({ data: { applied: true } });
        },
      ),
    );

    const user = userEvent.setup();
    renderModuleSurface(<AccessGovernancePanel targetUserId="target-user" />);
    const cards = await screen.findAllByText(i18n.t('role:accessGovernance.reviewCycle'));
    expect(within(cards[0].closest('div.rounded') as HTMLElement).queryByRole('button')).toBeNull();
    expect(posts).toEqual([]);

    await user.type(
      screen.getByLabelText(i18n.t('role:accessGovernance.decisionReason')),
      'Independent review decision',
    );
    await user.click(
      within(cards[1].closest('div.rounded') as HTMLElement).getByRole('button', {
        name: i18n.t('role:accessGovernance.reject'),
      }),
    );
    await waitFor(() => expect(posts).toEqual(['cycle-eligible']));
    await user.click(
      within(
        screen
          .getByText(i18n.t('role:accessGovernance.graceDecision'))
          .closest('div.rounded') as HTMLElement,
      ).getByRole('button', { name: i18n.t('role:accessGovernance.reject') }),
    );
    await waitFor(() => expect(posts).toContain('grace:grace-eligible'));
    const renewButton = screen.getByRole('button', {
      name: i18n.t('role:accessGovernance.renew'),
    });
    const renewalCard = renewButton.closest('div.rounded') as HTMLElement;
    await user.type(
      within(renewalCard).getByLabelText(i18n.t('role:accessGovernance.expiresAt')),
      '2027-12-31T17:00',
    );
    await user.click(renewButton);
    await screen.findByRole('alert');
    await user.click(renewButton);
    await waitFor(() => expect(successorBodies).toHaveLength(2));
    expect(successorBodies[1]?.idempotencyKey).toBe(successorBodies[0]?.idempotencyKey);
    const primaryCard = screen.getByTestId('successor-form-assignment-owner');
    const secondaryCard = screen.getByTestId('successor-form-assignment-active-2');
    expect(
      within(primaryCard).getByRole('button', { name: i18n.t('role:accessGovernance.replace') }),
    ).toBeInTheDocument();
    await user.selectOptions(
      within(primaryCard).getByLabelText(i18n.t('role:accessGovernance.replacementRole')),
      'role-replacement',
    );
    await user.type(
      within(primaryCard).getByLabelText(i18n.t('role:accessAssignment.periodLabel')),
      '2027-01',
    );
    expect(
      within(secondaryCard).getByLabelText(i18n.t('role:accessGovernance.replacementRole')),
    ).toHaveValue('');
    await user.click(
      within(primaryCard).getByRole('button', { name: i18n.t('role:accessGovernance.replace') }),
    );
    await waitFor(() => expect(successorBodies).toHaveLength(3));
    expect(successorBodies[2]).toMatchObject({
      action: 'REPLACEMENT',
      roleId: 'role-replacement',
      structuredScopeGrants: [
        { scopeType: 'global' },
        { scopeType: 'financePeriod', periodKey: '2027-01' },
      ],
      expiresAt: parseBusinessDateTimeInputValue('2027-12-31T17:00'),
    });
    expect(successorBodies[2]?.idempotencyKey).not.toBe(successorBodies[0]?.idempotencyKey);
    expect(
      screen.getByRole('button', { name: i18n.t('role:accessGovernance.restore') }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(i18n.t('role:accessGovernance.ownerAdminWarning'))).toHaveLength(2);
    expect(screen.queryByText('cycle-ineligible')).not.toBeInTheDocument();
  });

  it('keeps ACTIVE post-use review unavailable, reviews EXPIRED access, and hides raw authority codes', async () => {
    const reviewBodies: Array<Record<string, unknown>> = [];
    const endBodies: Array<Record<string, unknown>> = [];
    const decisionBodies: Array<Record<string, unknown>> = [];
    const requestBodies: Array<Record<string, unknown>> = [];
    setMockCurrentActorCapabilities(
      capabilities([
        PERMISSIONS.BREAK_GLASS_REQUEST,
        PERMISSIONS.BREAK_GLASS_END,
        PERMISSIONS.BREAK_GLASS_REVIEW,
      ]),
    );
    server.use(
      http.get('*/admin/access-assignments/break-glass', () =>
        HttpResponse.json({
          data: {
            generatedAt: now,
            policy: {
              version: 'break-glass-policy/v1',
              defaultDurationMs: 3_600_000,
              maximumDurationMs: 14_400_000,
            },
            pagination: {
              pageSize: 25,
              requests: { nextCursor: null, exhausted: true },
              activations: { nextCursor: null, exhausted: true },
            },
            availablePermissions: ['kpi.read'],
            availableScopeTypes: ['global'],
            primaryOwner: { eligible: true, isCurrentActor: false },
            requestEligibility: {
              canRequestNonUrgent: true,
              canRequestUrgent: false,
              nonUrgentIneligibilityReason: null,
              urgentIneligibilityReason: 'ACTIVE_PRIMARY_OWNER_REQUIRED',
            },
            requests: [
              {
                requestId: 'request-pending',
                idempotencyKey: 'pending-key',
                payloadFingerprint: 'pending-fingerprint',
                targetUserId: 'target-user',
                permissions: ['kpi.read'],
                structuredScopeGrants: [{ scopeType: 'global' }],
                scopeFingerprint: 'scope:v1:global',
                urgency: 'NON_URGENT',
                incidentReferenceId: 'INC-PENDING',
                reason: 'Emergency response',
                requesterUserId: 'requester-user',
                requestedAt: now,
                requestedDurationMs: 60_000,
                approvals: [],
                status: 'PENDING_APPROVAL',
                canApprove: true,
                canReject: true,
                requiredApprovals: 2,
                completedApprovals: 0,
                remainingApprovals: 2,
                ineligibilityReason: null,
                nextAllowedAction: 'INDEPENDENT_APPROVAL',
              },
            ],
            activations: [
              activation('active', 'ACTIVE', false, true),
              activation('expired', 'EXPIRED', true),
            ],
            nextAuthorityTransitionAt: now + 60_000,
          },
        }),
      ),
      http.post(
        '*/admin/access-assignments/break-glass/activations/:activationId/review',
        async ({ request }) => {
          reviewBodies.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ data: { applied: true } });
        },
      ),
      http.post(
        '*/admin/access-assignments/break-glass/activations/:activationId/end',
        async ({ request }) => {
          endBodies.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ data: { applied: true } });
        },
      ),
      http.post('*/admin/access-assignments/break-glass', async ({ request }) => {
        requestBodies.push((await request.json()) as Record<string, unknown>);
        if (requestBodies.length === 1) {
          return HttpResponse.json({ error: { code: 'RESPONSE_LOST' } }, { status: 503 });
        }
        return HttpResponse.json({ data: { applied: false, replay: true } });
      }),
      http.post(
        '*/admin/access-assignments/break-glass/:requestId/decision',
        async ({ request }) => {
          decisionBodies.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ data: { applied: true } });
        },
      ),
    );

    const user = userEvent.setup();
    renderModuleSurface(<AccessGovernancePanel targetUserId="target-user" />);
    const activeCard = (await screen.findByText('INC-ACTIVE')).closest(
      'div.rounded',
    ) as HTMLElement;
    const expiredCard = screen.getByText('INC-EXPIRED').closest('div.rounded') as HTMLElement;
    expect(
      within(activeCard).getByRole('button', {
        name: i18n.t('role:accessGovernance.endAccess'),
      }),
    ).toBeInTheDocument();
    expect(
      within(expiredCard).getByRole('button', {
        name: i18n.t('role:accessGovernance.misuseFound'),
      }),
    ).toBeInTheDocument();
    expect(
      within(expiredCard).getByText(
        i18n.t('role:accessGovernance.independentReviewState', {
          state: i18n.t('role:accessGovernance.reviewStates.OVERDUE'),
        }),
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', {
        name: i18n.t('role:permissionGroups.summaryItem', {
          group: i18n.t('role:permissionGroups.kpi'),
          count: 1,
        }),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('kpi.read')).not.toBeInTheDocument();

    await user.type(
      screen.getByLabelText(i18n.t('role:accessGovernance.decisionReason')),
      'Use exceeded the approved incident scope',
    );
    await user.click(
      within(expiredCard).getByRole('button', {
        name: i18n.t('role:accessGovernance.misuseFound'),
      }),
    );
    await waitFor(() =>
      expect(reviewBodies).toEqual([
        { result: 'MISUSE_FOUND', reason: 'Use exceeded the approved incident scope' },
      ]),
    );
    const refreshedActiveCard = screen
      .getByText('INC-ACTIVE')
      .closest('div.rounded') as HTMLElement;
    await user.click(
      within(refreshedActiveCard).getByRole('button', {
        name: i18n.t('role:accessGovernance.endAccess'),
      }),
    );
    await waitFor(() =>
      expect(endBodies).toEqual([{ reason: 'Use exceeded the approved incident scope' }]),
    );
    await user.click(
      within(screen.getByText('INC-PENDING').closest('div.rounded') as HTMLElement).getByRole(
        'button',
        { name: i18n.t('role:accessGovernance.reject') },
      ),
    );
    await waitFor(() =>
      expect(decisionBodies).toEqual([
        { decision: 'REJECTED', reason: 'Use exceeded the approved incident scope' },
      ]),
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t('role:accessGovernance.permission')),
      'kpi.read',
    );
    await user.type(screen.getByLabelText(i18n.t('role:accessGovernance.incident')), 'INC-RETRY');
    await user.type(
      screen.getByLabelText(i18n.t('role:accessGovernance.reason')),
      'Retry after response loss',
    );
    await user.click(screen.getByRole('button', { name: i18n.t('role:accessGovernance.submit') }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: i18n.t('role:accessGovernance.submit') }));
    await waitFor(() => expect(requestBodies).toHaveLength(2));
    expect(requestBodies[0]?.idempotencyKey).toBeTruthy();
    expect(requestBodies[1]?.idempotencyKey).toBe(requestBodies[0]?.idempotencyKey);
  });

  it('separates succession proposal, independent decision, and activation using backend flags', async () => {
    const calls: string[] = [];
    const proposalBodies: Array<Record<string, unknown>> = [];
    let proposalAttempts = 0;
    setMockCurrentActorCapabilities(
      capabilities([PERMISSIONS.OWNER_GOVERNANCE_VIEW, PERMISSIONS.OWNER_SUCCESSION_MANAGE]),
    );
    server.use(
      http.get('*/admin/access-assignments/governance', () =>
        HttpResponse.json({
          data: {
            generatedAt: now,
            policy: {
              version: 'owner-succession-command-policy/v2',
              timeZone: 'Asia/Ho_Chi_Minh',
              effectiveAtRequired: true,
              expiresAtRequired: true,
            },
            primaryOwner: governancePrincipal('primary', {
              principalType: 'PRIMARY_OWNER',
              status: 'ACTIVE',
              eligibleNow: true,
              eligible: true,
              eligibilityReasons: [],
              ineligibilityReason: null,
              nextAllowedAction: null,
            }),
            successors: [
              governancePrincipal('maker-blocked'),
              governancePrincipal('independent-review', {
                canApproveSuccessor: true,
                ineligibilityReason: null,
              }),
              governancePrincipal('activation-ready', {
                status: 'ACTIVE',
                eligibleNow: true,
                eligible: true,
                eligibilityReasons: [],
                canActivateSuccessor: true,
                ineligibilityReason: null,
                nextAllowedAction: 'ACTIVATE_IN_EFFECTIVE_WINDOW',
              }),
            ],
            actions: { canProposeSuccessor: true, proposalIneligibilityReason: null },
          },
        }),
      ),
      http.post('*/admin/access-assignments/governance/successors', async ({ request }) => {
        calls.push('propose');
        proposalBodies.push((await request.json()) as Record<string, unknown>);
        proposalAttempts += 1;
        if (proposalAttempts === 1) {
          return HttpResponse.json({ error: { code: 'RESPONSE_LOST' } }, { status: 503 });
        }
        return HttpResponse.json({ data: { applied: true } });
      }),
      http.post(
        '*/admin/access-assignments/governance/successors/:principalId/decision',
        ({ params }) => {
          calls.push(`decide:${String(params.principalId)}`);
          return HttpResponse.json({ data: { applied: true } });
        },
      ),
      http.post(
        '*/admin/access-assignments/governance/successors/:principalId/activate',
        ({ params }) => {
          calls.push(`activate:${String(params.principalId)}`);
          return HttpResponse.json({ data: { applied: true } });
        },
      ),
    );

    const user = userEvent.setup();
    renderModuleSurface(<AccessGovernancePanel targetUserId="target-user" />);
    const decisionInput = await screen.findByLabelText(
      i18n.t('role:accessGovernance.decisionReason'),
    );
    await user.type(decisionInput, 'Independent governance decision');
    await user.click(screen.getByRole('button', { name: i18n.t('role:accessGovernance.approve') }));
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:accessGovernance.activate') }),
    );
    await user.type(
      screen.getByLabelText(i18n.t('role:accessGovernance.successionReason')),
      'Planned continuity',
    );
    await user.type(
      screen.getByLabelText(i18n.t('role:accessGovernance.effectiveAt')),
      '2027-01-02T09:00',
    );
    await user.type(
      screen.getByLabelText(i18n.t('role:accessGovernance.expiresAt')),
      '2027-02-02T09:00',
    );
    const proposalButton = screen.getByRole('button', {
      name: i18n.t('role:accessGovernance.proposeSuccessor'),
    });
    await user.click(proposalButton);
    await screen.findByRole('alert');
    await user.click(proposalButton);
    await waitFor(() =>
      expect(calls).toEqual([
        'decide:independent-review',
        'activate:activation-ready',
        'propose',
        'propose',
      ]),
    );
    expect(proposalBodies).toEqual([
      {
        targetUserId: 'target-user',
        effectiveAt: parseBusinessDateTimeInputValue('2027-01-02T09:00'),
        expiresAt: parseBusinessDateTimeInputValue('2027-02-02T09:00'),
        reason: 'Planned continuity',
        idempotencyKey: expect.any(String),
      },
      {
        targetUserId: 'target-user',
        effectiveAt: parseBusinessDateTimeInputValue('2027-01-02T09:00'),
        expiresAt: parseBusinessDateTimeInputValue('2027-02-02T09:00'),
        reason: 'Planned continuity',
        idempotencyKey: expect.any(String),
      },
    ]);
    expect(proposalBodies[1]?.idempotencyKey).toBe(proposalBodies[0]?.idempotencyKey);
  });

  it('renders a retryable error without exposing mutation controls when the read model fails', async () => {
    setMockCurrentActorCapabilities(capabilities([PERMISSIONS.ROLE_ASSIGNMENT_REVIEW]));
    server.use(
      http.get('*/admin/access-assignments/lifecycle', () =>
        HttpResponse.json({ error: { code: 'ACCESS_DENIED' } }, { status: 403 }),
      ),
    );
    renderModuleSurface(<AccessGovernancePanel targetUserId="target-user" />, {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
    });
    expect(await screen.findByText(i18n.t('role:accessGovernance.loadError'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('role:accessGovernance.approve') }),
    ).toBeNull();
  });
});

function assertQueueContinuation(
  view: AccessLifecycleStatusView,
  expectedRows: number,
  expectedCursor: string,
): void {
  expect(view.reviewCycles).toHaveLength(expectedRows);
  expect(view.graceExceptions).toHaveLength(0);
  expect(view.successorRequests).toHaveLength(0);
  expect(view.pagination.reviewCycles.nextCursor).toBe(expectedCursor);
}
