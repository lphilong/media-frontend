import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useAccessGovernance,
  useAccessAssignmentTargets,
  useAccessLifecycleGraceDecisionMutation,
  useAccessLifecycleGraceRequestMutation,
  useAccessLifecycleReviewMutation,
  useAccessLifecycleStatus,
  useAccessLifecycleQueueLoadMore,
  useAccessLifecycleSuccessorDecisionMutation,
  useAccessLifecycleSuccessorRequestMutation,
  useBreakGlassDecisionMutation,
  useBreakGlassEndMutation,
  useBreakGlassRequestMutation,
  useBreakGlassReviewMutation,
  useBreakGlassStatus,
  useBreakGlassQueueLoadMore,
  useGovernanceSuccessorActivationMutation,
  useGovernanceSuccessorDecisionMutation,
  useGovernanceSuccessorProposalMutation,
  useRoleList,
} from '@modules/role/hooks/use-role';
import { AccessAssignmentScopeResolver } from '@modules/role/components/AccessAssignmentScopeResolver';
import {
  buildAccessAssignmentStructuredScopeGrants,
  getUnsupportedAccessAssignmentScopeTypes,
  normalizeAccessAssignmentRequiredScopeTypes,
} from '@modules/role/model/access-assignment-requirements';
import type {
  AccessAssignmentScopeGrant,
  AccessAssignmentScopeType,
} from '@modules/role/types/role.types';
import { formatPermissionCapabilityItems } from '@modules/role/utils/permission-labels';
import {
  PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  Button,
  ErrorState,
  LoadingState,
  MetadataSection,
  StatusBadge,
} from '@shared/components/primitives';
import {
  DEFAULT_BUSINESS_TIME_ZONE,
  formatBusinessTimestamp,
  parseBusinessDateTimeInputValue,
} from '@shared/formatting/formatters';

type SuccessorForm = {
  roleId: string;
  scopeTargetIds: Record<string, string | undefined>;
  scopePeriodKeys: Record<string, string | undefined>;
  effectiveAt: string;
  expiresAt: string;
  reviewAt: string;
};

type StableSubmission = { signature: string; idempotencyKey: string };

const PERIOD_SCOPES = new Set<AccessAssignmentScopeType>([
  'financePeriod',
  'payrollPeriod',
  'attendancePeriodOrg',
]);
const TARGET_SCOPES = new Set<AccessAssignmentScopeType>([
  'managedTalentGroup',
  'managedOrgUnit',
  'assignedPlatformAccount',
  'contractPortfolio',
  'assignedEvent',
  'assignedStudioResource',
]);

export const AccessGovernancePanel = ({
  targetUserId,
}: {
  targetUserId?: string;
}): JSX.Element | null => {
  const { t } = useTranslation('role');
  const capabilities = useCurrentActorCapabilities();
  const canViewGovernance = hasPermission(capabilities.data, PERMISSIONS.OWNER_GOVERNANCE_VIEW);
  const canUseLifecycle = hasAnyPermission(capabilities.data, [
    PERMISSIONS.ROLE_ASSIGNMENT_REVIEW,
    PERMISSIONS.ROLE_ASSIGNMENT_GRACE_APPROVE,
    PERMISSIONS.ROLE_ASSIGNMENT_RENEW,
    PERMISSIONS.ROLE_ASSIGNMENT_REPLACE,
  ]);
  const canUseBreakGlass = hasAnyPermission(capabilities.data, [
    PERMISSIONS.BREAK_GLASS_REQUEST,
    PERMISSIONS.BREAK_GLASS_ACTIVATE,
    PERMISSIONS.BREAK_GLASS_END,
    PERMISSIONS.BREAK_GLASS_APPROVE,
    PERMISSIONS.BREAK_GLASS_REVIEW,
  ]);
  const governance = useAccessGovernance(canViewGovernance);
  const lifecycle = useAccessLifecycleStatus(targetUserId, canUseLifecycle);
  const breakGlass = useBreakGlassStatus(canUseBreakGlass);
  const lifecycleLoadMore = useAccessLifecycleQueueLoadMore(targetUserId);
  const breakGlassLoadMore = useBreakGlassQueueLoadMore();
  const roles = useRoleList({ state: 'ACTIVE', limit: 100 }, canUseLifecycle);
  const assignmentTargets = useAccessAssignmentTargets();

  const reviewMutation = useAccessLifecycleReviewMutation();
  const graceRequestMutation = useAccessLifecycleGraceRequestMutation();
  const graceDecisionMutation = useAccessLifecycleGraceDecisionMutation();
  const successorRequestMutation = useAccessLifecycleSuccessorRequestMutation();
  const successorDecisionMutation = useAccessLifecycleSuccessorDecisionMutation();
  const governanceProposalMutation = useGovernanceSuccessorProposalMutation();
  const governanceDecisionMutation = useGovernanceSuccessorDecisionMutation();
  const governanceActivationMutation = useGovernanceSuccessorActivationMutation();
  const requestMutation = useBreakGlassRequestMutation();
  const breakGlassDecisionMutation = useBreakGlassDecisionMutation();
  const breakGlassReviewMutation = useBreakGlassReviewMutation();
  const breakGlassEndMutation = useBreakGlassEndMutation();

  const [permission, setPermission] = useState('');
  const [scopeType, setScopeType] = useState<AccessAssignmentScopeType>('global');
  const [scopeReference, setScopeReference] = useState('');
  const [incidentReferenceId, setIncidentReferenceId] = useState('');
  const [reason, setReason] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [urgency, setUrgency] = useState<'URGENT' | 'NON_URGENT'>('NON_URGENT');
  const [decisionReason, setDecisionReason] = useState('');
  const [successionReason, setSuccessionReason] = useState('');
  const [successionEffectiveAt, setSuccessionEffectiveAt] = useState('');
  const [successionExpiresAt, setSuccessionExpiresAt] = useState('');
  const [successorForms, setSuccessorForms] = useState<Record<string, SuccessorForm>>({});
  const [graceDates, setGraceDates] = useState<Record<string, string>>({});
  const breakGlassSubmissionRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);
  const successorSubmissionRef = useRef<Record<string, StableSubmission>>({});
  const governanceSubmissionRef = useRef<Record<string, StableSubmission>>({});

  const grant = useMemo<AccessAssignmentScopeGrant>(() => {
    if (PERIOD_SCOPES.has(scopeType)) return { scopeType, periodKey: scopeReference.trim() };
    if (scopeType === 'contractPortfolio') {
      return { scopeType, targetKey: scopeReference.trim() };
    }
    if (TARGET_SCOPES.has(scopeType)) return { scopeType, targetId: scopeReference.trim() };
    return { scopeType };
  }, [scopeReference, scopeType]);
  useEffect(() => {
    if (!durationMinutes && breakGlass.data?.policy.defaultDurationMs) {
      setDurationMinutes(String(breakGlass.data.policy.defaultDurationMs / 60_000));
    }
  }, [breakGlass.data?.policy.defaultDurationMs, durationMinutes]);
  const requiresReference = PERIOD_SCOPES.has(scopeType) || TARGET_SCOPES.has(scopeType);
  const requestEligibility = breakGlass.data?.requestEligibility;
  const requestAllowed =
    urgency === 'URGENT'
      ? requestEligibility?.canRequestUrgent === true
      : requestEligibility?.canRequestNonUrgent === true;
  const canSubmitBreakGlass = Boolean(
    targetUserId &&
    permission &&
    incidentReferenceId.trim() &&
    reason.trim() &&
    (!requiresReference || scopeReference.trim()) &&
    Number(durationMinutes) > 0 &&
    Number(durationMinutes) <= (breakGlass.data?.policy.maximumDurationMs ?? 0) / 60_000 &&
    requestAllowed,
  );
  const mutationFailed = [
    reviewMutation,
    graceRequestMutation,
    graceDecisionMutation,
    successorRequestMutation,
    successorDecisionMutation,
    governanceProposalMutation,
    governanceDecisionMutation,
    governanceActivationMutation,
    requestMutation,
    breakGlassDecisionMutation,
    breakGlassReviewMutation,
    breakGlassEndMutation,
  ].some((mutation) => mutation.isError);

  if (!canViewGovernance && !canUseLifecycle && !canUseBreakGlass) return null;

  const decisionReady = decisionReason.trim().length > 0;
  const safeReason = (code: string | null): string =>
    code
      ? t(`accessGovernance.reasonCodes.${code}`, {
          defaultValue: t('accessGovernance.notEligible'),
        })
      : t('accessGovernance.eligible');
  const formatBusinessTime = (value: number): string =>
    formatBusinessTimestamp(value, DEFAULT_BUSINESS_TIME_ZONE);
  const getSuccessorForm = (assignmentId: string): SuccessorForm =>
    successorForms[assignmentId] ?? {
      roleId: '',
      scopeTargetIds: {},
      scopePeriodKeys: {},
      effectiveAt: '',
      expiresAt: '',
      reviewAt: '',
    };
  const updateSuccessorForm = (assignmentId: string, patch: Partial<SuccessorForm>) =>
    setSuccessorForms((current) => ({
      ...current,
      [assignmentId]: {
        ...(current[assignmentId] ?? {
          roleId: '',
          scopeTargetIds: {},
          scopePeriodKeys: {},
          effectiveAt: '',
          expiresAt: '',
          reviewAt: '',
        }),
        ...patch,
      },
    }));
  const stableIdempotencyKey = (
    store: MutableRefObject<Record<string, StableSubmission>>,
    operation: string,
    payload: Record<string, unknown>,
  ): string => {
    const signature = JSON.stringify(payload);
    const existing = store.current[operation];
    if (existing?.signature === signature) return existing.idempotencyKey;
    const idempotencyKey = globalThis.crypto.randomUUID();
    store.current[operation] = { signature, idempotencyKey };
    return idempotencyKey;
  };
  const parseDateTime = (value: string): number | undefined => {
    return value ? parseBusinessDateTimeInputValue(value, DEFAULT_BUSINESS_TIME_ZONE) : undefined;
  };

  return (
    <div className="space-y-4" data-testid="access-governance-panel">
      {mutationFailed ? (
        <div className="rounded border border-danger bg-danger/10 p-3 text-sm" role="alert">
          {t('accessGovernance.mutationError')}
        </div>
      ) : null}

      {canViewGovernance ? (
        <MetadataSection
          title={t('accessGovernance.ownerTitle')}
          subtitle={t('accessGovernance.ownerSubtitle')}
        >
          {governance.isLoading ? <LoadingState lines={2} /> : null}
          {governance.error ? (
            <ErrorState
              title={t('accessGovernance.loadError')}
              message={t('accessGovernance.backendAuthoritative')}
              actionLabel={t('accessGovernance.retry')}
              onRetry={() => void governance.refetch()}
            />
          ) : null}
          {governance.data ? (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge
                  label={
                    governance.data.primaryOwner?.eligible
                      ? t('accessGovernance.primaryOwnerActive')
                      : t('accessGovernance.primaryOwnerUnavailable')
                  }
                  tone={governance.data.primaryOwner?.eligible ? 'success' : 'warning'}
                />
                <span>
                  {t('accessGovernance.successorCount', {
                    count: governance.data.successors.length,
                  })}
                </span>
              </div>
              {governance.data.successors.some(
                (item) => item.canApproveSuccessor || item.canActivateSuccessor,
              ) ? (
                <label className="block">
                  {t('accessGovernance.decisionReason')}
                  <input
                    className="mt-1 w-full rounded border border-border bg-panel p-2"
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                  />
                </label>
              ) : null}
              {targetUserId && governance.data.actions.canProposeSuccessor ? (
                <div className="rounded border border-border p-3">
                  <label className="block">
                    {t('accessGovernance.successionReason')}
                    <input
                      className="mt-1 w-full rounded border border-border bg-panel p-2"
                      value={successionReason}
                      onChange={(event) => setSuccessionReason(event.target.value)}
                    />
                  </label>
                  <label className="mt-2 block">
                    {t('accessGovernance.effectiveAt')}
                    <input
                      aria-label={t('accessGovernance.effectiveAt')}
                      type="datetime-local"
                      className="mt-1 w-full rounded border border-border bg-panel p-2"
                      value={successionEffectiveAt}
                      onChange={(event) => setSuccessionEffectiveAt(event.target.value)}
                    />
                  </label>
                  <label className="mt-2 block">
                    {t('accessGovernance.expiresAt')}
                    <input
                      aria-label={t('accessGovernance.expiresAt')}
                      type="datetime-local"
                      className="mt-1 w-full rounded border border-border bg-panel p-2"
                      value={successionExpiresAt}
                      onChange={(event) => setSuccessionExpiresAt(event.target.value)}
                    />
                  </label>
                  <Button
                    className="mt-2"
                    variant="secondary"
                    disabled={
                      !successionReason.trim() ||
                      !parseDateTime(successionEffectiveAt) ||
                      !parseDateTime(successionExpiresAt)
                    }
                    loading={governanceProposalMutation.isPending}
                    onClick={() => {
                      const command = {
                        targetUserId,
                        effectiveAt: parseDateTime(successionEffectiveAt)!,
                        expiresAt: parseDateTime(successionExpiresAt)!,
                        reason: successionReason.trim(),
                      };
                      const operation = `proposal:${targetUserId}`;
                      governanceProposalMutation.mutate(
                        {
                          ...command,
                          idempotencyKey: stableIdempotencyKey(
                            governanceSubmissionRef,
                            operation,
                            command,
                          ),
                        },
                        {
                          onSuccess: () => {
                            delete governanceSubmissionRef.current[operation];
                          },
                        },
                      );
                    }}
                  >
                    {t('accessGovernance.proposeSuccessor')}
                  </Button>
                </div>
              ) : null}
              {governance.data.successors.map((item) => (
                <div key={item.principalId} className="rounded border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{t('accessGovernance.successorCandidate')}</span>
                    <StatusBadge
                      label={t(`accessGovernance.governanceStates.${item.status}`)}
                      tone={item.eligible ? 'success' : 'warning'}
                    />
                  </div>
                  <p>
                    {t('accessGovernance.effectiveAt')}: {formatBusinessTime(item.effectiveAt)}
                  </p>
                  {item.expiresAt !== null ? (
                    <p>
                      {t('accessGovernance.expiresAt')}: {formatBusinessTime(item.expiresAt)}
                    </p>
                  ) : null}
                  <p>{safeReason(item.ineligibilityReason)}</p>
                  {item.canApproveSuccessor || item.canActivateSuccessor ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.canApproveSuccessor ? (
                        <>
                          <Button
                            variant="secondary"
                            disabled={!decisionReady}
                            loading={governanceDecisionMutation.isPending}
                            onClick={() => {
                              const command = {
                                principalId: item.principalId,
                                decision: 'APPROVED' as const,
                                reason: decisionReason.trim(),
                              };
                              const operation = `decision:${item.principalId}:APPROVED`;
                              governanceDecisionMutation.mutate(
                                {
                                  ...command,
                                  idempotencyKey: stableIdempotencyKey(
                                    governanceSubmissionRef,
                                    operation,
                                    command,
                                  ),
                                },
                                {
                                  onSuccess: () => {
                                    delete governanceSubmissionRef.current[operation];
                                  },
                                },
                              );
                            }}
                          >
                            {t('accessGovernance.approve')}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={!decisionReady}
                            loading={governanceDecisionMutation.isPending}
                            onClick={() => {
                              const command = {
                                principalId: item.principalId,
                                decision: 'REJECTED' as const,
                                reason: decisionReason.trim(),
                              };
                              const operation = `decision:${item.principalId}:REJECTED`;
                              governanceDecisionMutation.mutate(
                                {
                                  ...command,
                                  idempotencyKey: stableIdempotencyKey(
                                    governanceSubmissionRef,
                                    operation,
                                    command,
                                  ),
                                },
                                {
                                  onSuccess: () => {
                                    delete governanceSubmissionRef.current[operation];
                                  },
                                },
                              );
                            }}
                          >
                            {t('accessGovernance.reject')}
                          </Button>
                        </>
                      ) : null}
                      {item.canActivateSuccessor ? (
                        <Button
                          variant="primary"
                          disabled={!decisionReady}
                          loading={governanceActivationMutation.isPending}
                          onClick={() => {
                            const command = {
                              principalId: item.principalId,
                              reason: decisionReason.trim(),
                            };
                            const operation = `activation:${item.principalId}`;
                            governanceActivationMutation.mutate(
                              {
                                ...command,
                                idempotencyKey: stableIdempotencyKey(
                                  governanceSubmissionRef,
                                  operation,
                                  command,
                                ),
                              },
                              {
                                onSuccess: () => {
                                  delete governanceSubmissionRef.current[operation];
                                },
                              },
                            );
                          }}
                        >
                          {t('accessGovernance.activate')}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </MetadataSection>
      ) : null}

      {canUseLifecycle ? (
        <MetadataSection
          title={t('accessGovernance.lifecycleTitle')}
          subtitle={t('accessGovernance.lifecycleSubtitle')}
        >
          {lifecycle.isLoading ? <LoadingState lines={3} /> : null}
          {lifecycle.error ? (
            <ErrorState
              title={t('accessGovernance.loadError')}
              message={t('accessGovernance.backendAuthoritative')}
              actionLabel={t('accessGovernance.retry')}
              onRetry={() => void lifecycle.refetch()}
            />
          ) : null}
          {lifecycle.data ? (
            <div className="space-y-3 text-sm">
              <label className="block">
                {t('accessGovernance.decisionReason')}
                <input
                  className="mt-1 w-full rounded border border-border bg-panel p-2"
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                />
              </label>
              {lifecycle.data.reviewCycles.map((item) => (
                <div key={item.cycleId} className="rounded border border-border p-3">
                  <p className="font-medium">{t('accessGovernance.reviewCycle')}</p>
                  <p>
                    {t('accessGovernance.approvalProgress', {
                      completed: item.completedApprovals,
                      required: item.requiredApprovals,
                    })}
                  </p>
                  <p>
                    {t('accessGovernance.reviewDeadline', {
                      value: formatBusinessTime(item.reviewDeadline),
                    })}
                  </p>
                  {item.automaticGraceEndsAt !== null ? (
                    <p>
                      {t('accessGovernance.automaticGraceEnd', {
                        value: formatBusinessTime(item.automaticGraceEndsAt),
                      })}
                    </p>
                  ) : null}
                  {item.maximumGraceEndsAt !== null ? (
                    <p>
                      {t('accessGovernance.maximumGraceEnd', {
                        value: formatBusinessTime(item.maximumGraceEndsAt),
                      })}
                    </p>
                  ) : null}
                  <p>{safeReason(item.ineligibilityReason)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.canApprove ? (
                      <Button
                        variant="secondary"
                        disabled={!decisionReady}
                        loading={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            cycleId: item.cycleId,
                            decision: 'APPROVED',
                            reason: decisionReason.trim(),
                          })
                        }
                      >
                        {t('accessGovernance.approve')}
                      </Button>
                    ) : null}
                    {item.canReject ? (
                      <Button
                        variant="secondary"
                        disabled={!decisionReady}
                        loading={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            cycleId: item.cycleId,
                            decision: 'REJECTED',
                            reason: decisionReason.trim(),
                          })
                        }
                      >
                        {t('accessGovernance.reject')}
                      </Button>
                    ) : null}
                    {item.canRequestGrace ? (
                      <label className="w-full">
                        {t('accessGovernance.graceUntilLabel')}
                        <input
                          aria-label={`${t('accessGovernance.graceUntilLabel')} ${item.cycleId}`}
                          type="datetime-local"
                          className="mt-1 w-full rounded border border-border bg-panel p-2"
                          value={graceDates[item.cycleId] ?? ''}
                          onChange={(event) =>
                            setGraceDates((current) => ({
                              ...current,
                              [item.cycleId]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : null}
                    {item.canRequestGrace ? (
                      <Button
                        variant="secondary"
                        disabled={!decisionReady || !parseDateTime(graceDates[item.cycleId] ?? '')}
                        loading={graceRequestMutation.isPending}
                        onClick={() =>
                          graceRequestMutation.mutate({
                            cycleId: item.cycleId,
                            requestedExpiresAt: parseDateTime(graceDates[item.cycleId] ?? '')!,
                            reason: decisionReason.trim(),
                          })
                        }
                      >
                        {t('accessGovernance.requestGrace')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {lifecycle.data.pagination.reviewCycles.nextCursor ? (
                <Button
                  variant="secondary"
                  loading={
                    lifecycleLoadMore.isPending && lifecycleLoadMore.variables?.queue === 'review'
                  }
                  onClick={() =>
                    lifecycleLoadMore.mutate({
                      queue: 'review',
                      cursor: lifecycle.data.pagination.reviewCycles.nextCursor!,
                    })
                  }
                >
                  {t('accessGovernance.loadMore')}
                </Button>
              ) : null}
              {lifecycle.data.graceExceptions.map((item) => (
                <div key={item.exceptionId} className="rounded border border-border p-3">
                  <p className="font-medium">{t('accessGovernance.graceDecision')}</p>
                  <p>
                    {t('accessGovernance.graceUntil', {
                      value: formatBusinessTime(item.requestedExpiresAt),
                    })}
                  </p>
                  <p>{safeReason(item.ineligibilityReason)}</p>
                  <div className="mt-2 flex gap-2">
                    {item.canApprove ? (
                      <Button
                        variant="secondary"
                        disabled={!decisionReady}
                        loading={graceDecisionMutation.isPending}
                        onClick={() =>
                          graceDecisionMutation.mutate({
                            exceptionId: item.exceptionId,
                            decision: 'APPROVED',
                            reason: decisionReason.trim(),
                          })
                        }
                      >
                        {t('accessGovernance.approve')}
                      </Button>
                    ) : null}
                    {item.canReject ? (
                      <Button
                        variant="secondary"
                        disabled={!decisionReady}
                        loading={graceDecisionMutation.isPending}
                        onClick={() =>
                          graceDecisionMutation.mutate({
                            exceptionId: item.exceptionId,
                            decision: 'REJECTED',
                            reason: decisionReason.trim(),
                          })
                        }
                      >
                        {t('accessGovernance.reject')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {lifecycle.data.pagination.graceExceptions.nextCursor ? (
                <Button
                  variant="secondary"
                  loading={
                    lifecycleLoadMore.isPending && lifecycleLoadMore.variables?.queue === 'grace'
                  }
                  onClick={() =>
                    lifecycleLoadMore.mutate({
                      queue: 'grace',
                      cursor: lifecycle.data.pagination.graceExceptions.nextCursor!,
                    })
                  }
                >
                  {t('accessGovernance.loadMore')}
                </Button>
              ) : null}
              {lifecycle.data.requestableAssignments.map((item) => {
                const form = getSuccessorForm(item.assignmentId);
                const selectedRoleTarget = assignmentTargets.data?.assignmentTargets.find(
                  (target) => target.assignmentKind === 'ROLE' && target.id === form.roleId,
                );
                const requiredScopeTypes = normalizeAccessAssignmentRequiredScopeTypes(
                  selectedRoleTarget?.requiredScopeTypes ?? [],
                );
                const unsupportedScopeTypes =
                  getUnsupportedAccessAssignmentScopeTypes(requiredScopeTypes);
                const replacementGrants = buildAccessAssignmentStructuredScopeGrants(
                  requiredScopeTypes,
                  form.scopeTargetIds,
                  form.scopePeriodKeys,
                );
                const scopeComplete =
                  unsupportedScopeTypes.length === 0 &&
                  replacementGrants.length === requiredScopeTypes.length;
                const replacementChanged = Boolean(
                  form.roleId &&
                  (form.roleId !== item.roleId ||
                    canonicalScopeSignature(replacementGrants) !==
                      canonicalScopeSignature(item.structuredScopeGrants)),
                );
                const expiresAt = parseDateTime(form.expiresAt);
                const submitSuccessor = (action: 'RENEWAL' | 'REPLACEMENT' | 'RESTORATION') => {
                  if (!expiresAt) return;
                  const command = {
                    action,
                    predecessorAssignmentId: item.assignmentId,
                    ...(action === 'REPLACEMENT'
                      ? { roleId: form.roleId, structuredScopeGrants: replacementGrants }
                      : {}),
                    ...(parseDateTime(form.effectiveAt)
                      ? { effectiveAt: parseDateTime(form.effectiveAt) }
                      : {}),
                    expiresAt,
                    ...(parseDateTime(form.reviewAt)
                      ? { reviewAt: parseDateTime(form.reviewAt) }
                      : {}),
                    reason: decisionReason.trim(),
                  };
                  const operation = `${action}:${item.assignmentId}`;
                  successorRequestMutation.mutate(
                    {
                      ...command,
                      idempotencyKey: stableIdempotencyKey(
                        successorSubmissionRef,
                        operation,
                        command,
                      ),
                    },
                    {
                      onSuccess: () => {
                        delete successorSubmissionRef.current[operation];
                      },
                    },
                  );
                };
                return (
                  <div
                    key={item.assignmentId}
                    data-testid={`successor-form-${item.assignmentId}`}
                    className="rounded border border-border p-3"
                  >
                    <p className="font-medium">
                      {item.roleCode === 'OWNER_ADMIN'
                        ? t('accessGovernance.ownerAdminLabel')
                        : t('accessGovernance.assignedAccessLabel')}
                    </p>
                    {item.roleCode === 'OWNER_ADMIN' ? (
                      <p className="text-warning">{t('accessGovernance.ownerAdminWarning')}</p>
                    ) : null}
                    <p>
                      {t('accessGovernance.assignmentState', {
                        state: t(`accessGovernance.assignmentStates.${item.state}`),
                      })}
                    </p>
                    {item.reviewAt ? (
                      <p>
                        {t('accessGovernance.reviewDeadline', {
                          value: formatBusinessTime(item.reviewAt),
                        })}
                      </p>
                    ) : null}
                    {item.canReplace ? (
                      <div className="mt-2 space-y-3">
                        <label>
                          {t('accessGovernance.replacementRole')}
                          <select
                            className="mt-1 w-full rounded border border-border bg-panel p-2"
                            value={form.roleId}
                            onChange={(event) =>
                              updateSuccessorForm(item.assignmentId, {
                                roleId: event.target.value,
                                scopeTargetIds: {},
                                scopePeriodKeys: {},
                              })
                            }
                          >
                            <option value="">{t('accessGovernance.choose')}</option>
                            {roles.data?.data.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {selectedRoleTarget ? (
                          <AccessAssignmentScopeResolver
                            requiredScopeTypes={requiredScopeTypes}
                            unsupportedScopeTypes={unsupportedScopeTypes}
                            scopeTargetIds={form.scopeTargetIds}
                            scopePeriodKeys={form.scopePeriodKeys}
                            onTargetChange={(scope, value) =>
                              updateSuccessorForm(item.assignmentId, {
                                scopeTargetIds: { ...form.scopeTargetIds, [scope]: value },
                              })
                            }
                            onSelectedTargetChange={() => undefined}
                            onPeriodChange={(scope, value) =>
                              updateSuccessorForm(item.assignmentId, {
                                scopePeriodKeys: { ...form.scopePeriodKeys, [scope]: value },
                              })
                            }
                          />
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <label>
                        {t('accessGovernance.effectiveAt')}
                        <input
                          type="datetime-local"
                          className="mt-1 w-full rounded border border-border bg-panel p-2"
                          value={form.effectiveAt}
                          onChange={(event) =>
                            updateSuccessorForm(item.assignmentId, {
                              effectiveAt: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        {t('accessGovernance.expiresAt')}
                        <input
                          type="datetime-local"
                          className="mt-1 w-full rounded border border-border bg-panel p-2"
                          value={form.expiresAt}
                          onChange={(event) =>
                            updateSuccessorForm(item.assignmentId, {
                              expiresAt: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        {t('accessGovernance.reviewAtOptional')}
                        <input
                          type="datetime-local"
                          className="mt-1 w-full rounded border border-border bg-panel p-2"
                          value={form.reviewAt}
                          onChange={(event) =>
                            updateSuccessorForm(item.assignmentId, { reviewAt: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.canRenew ? (
                        <Button
                          variant="secondary"
                          disabled={!decisionReady || !expiresAt}
                          loading={successorRequestMutation.isPending}
                          onClick={() => submitSuccessor('RENEWAL')}
                        >
                          {t('accessGovernance.renew')}
                        </Button>
                      ) : null}
                      {item.canReplace ? (
                        <Button
                          variant="secondary"
                          disabled={
                            !decisionReady || !expiresAt || !replacementChanged || !scopeComplete
                          }
                          loading={successorRequestMutation.isPending}
                          onClick={() => submitSuccessor('REPLACEMENT')}
                        >
                          {t('accessGovernance.replace')}
                        </Button>
                      ) : null}
                      {item.canRestore ? (
                        <Button
                          variant="secondary"
                          disabled={!decisionReady || !expiresAt}
                          loading={successorRequestMutation.isPending}
                          onClick={() => submitSuccessor('RESTORATION')}
                        >
                          {t('accessGovernance.restore')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {lifecycle.data.successorRequests.map((item) => (
                <div key={item.requestId} className="rounded border border-border p-3">
                  <p className="font-medium">
                    {t(`accessGovernance.successorActions.${item.action}`)}
                  </p>
                  <p>
                    {t('accessGovernance.approvalProgress', {
                      completed: item.completedApprovals,
                      required: item.requiredApprovals,
                    })}
                  </p>
                  <p>
                    {t('accessGovernance.effectiveAt')}: {formatBusinessTime(item.effectiveAt)}
                  </p>
                  <p>
                    {t('accessGovernance.expiresAt')}: {formatBusinessTime(item.expiresAt)}
                  </p>
                  <p>
                    {t('accessGovernance.reviewDeadline', {
                      value: formatBusinessTime(item.reviewAt),
                    })}
                  </p>
                  <p>{safeReason(item.ineligibilityReason)}</p>
                  <div className="mt-2 flex gap-2">
                    {item.canApprove ? (
                      <Button
                        variant="secondary"
                        disabled={!decisionReady}
                        loading={successorDecisionMutation.isPending}
                        onClick={() =>
                          successorDecisionMutation.mutate({
                            requestId: item.requestId,
                            decision: 'APPROVED',
                            reason: decisionReason.trim(),
                          })
                        }
                      >
                        {t('accessGovernance.approve')}
                      </Button>
                    ) : null}
                    {item.canReject ? (
                      <Button
                        variant="secondary"
                        disabled={!decisionReady}
                        loading={successorDecisionMutation.isPending}
                        onClick={() =>
                          successorDecisionMutation.mutate({
                            requestId: item.requestId,
                            decision: 'REJECTED',
                            reason: decisionReason.trim(),
                          })
                        }
                      >
                        {t('accessGovernance.reject')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {lifecycle.data.pagination.successorRequests.nextCursor ? (
                <Button
                  variant="secondary"
                  loading={
                    lifecycleLoadMore.isPending &&
                    lifecycleLoadMore.variables?.queue === 'successor'
                  }
                  onClick={() =>
                    lifecycleLoadMore.mutate({
                      queue: 'successor',
                      cursor: lifecycle.data.pagination.successorRequests.nextCursor!,
                    })
                  }
                >
                  {t('accessGovernance.loadMore')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </MetadataSection>
      ) : null}

      {canUseBreakGlass ? (
        <MetadataSection
          title={t('accessGovernance.breakGlassTitle')}
          subtitle={t('accessGovernance.breakGlassSubtitle')}
        >
          {breakGlass.isLoading ? <LoadingState lines={3} /> : null}
          {breakGlass.error ? (
            <ErrorState
              title={t('accessGovernance.loadError')}
              message={t('accessGovernance.backendAuthoritative')}
              actionLabel={t('accessGovernance.retry')}
              onRetry={() => void breakGlass.refetch()}
            />
          ) : null}
          {breakGlass.data?.requests.some((item) => item.canApprove || item.canReject) ||
          breakGlass.data?.activations.some((item) => item.canReview || item.canEnd) ? (
            <label className="mb-3 block text-sm">
              {t('accessGovernance.decisionReason')}
              <input
                className="mt-1 w-full rounded border border-border bg-panel p-2"
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
              />
            </label>
          ) : null}
          {breakGlass.data?.activations.map((item) => (
            <div key={item.activationId} className="mb-2 rounded border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{item.incidentReferenceId}</span>
                <StatusBadge
                  label={
                    item.currentlyEffective
                      ? t('accessGovernance.activationActive')
                      : t(`accessGovernance.activationStates.${item.status}`)
                  }
                  tone={item.currentlyEffective ? 'warning' : 'neutral'}
                />
              </div>
              {item.currentlyEffective ? (
                <p>
                  {t('accessGovernance.remainingMinutes', {
                    count: Math.ceil(item.remainingMs / 60_000),
                  })}
                </p>
              ) : null}
              <p>
                {t('accessGovernance.expiresAt')}: {formatBusinessTime(item.expiresAt)}
              </p>
              <p>
                {t('accessGovernance.independentReviewDue', {
                  value: formatBusinessTime(item.independentReviewDeadline.dueAt),
                })}
              </p>
              <p>
                {t('accessGovernance.independentReviewState', {
                  state: t(`accessGovernance.reviewStates.${item.independentReviewState}`),
                })}
              </p>
              {item.overdueSince !== null ? (
                <p className="text-warning">
                  {t('accessGovernance.reviewOverdueSince', {
                    value: formatBusinessTime(item.overdueSince),
                  })}
                </p>
              ) : null}
              {item.completedAt !== null ? (
                <p>
                  {t('accessGovernance.reviewCompletedAt', {
                    value: formatBusinessTime(item.completedAt),
                  })}
                </p>
              ) : null}
              <p>{safeReason(item.ineligibilityReason)}</p>
              {item.canReview ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={!decisionReady}
                    loading={breakGlassReviewMutation.isPending}
                    onClick={() =>
                      breakGlassReviewMutation.mutate({
                        activationId: item.activationId,
                        result: 'APPROVED_USE',
                        reason: decisionReason.trim(),
                      })
                    }
                  >
                    {t('accessGovernance.approvedUse')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!decisionReady}
                    loading={breakGlassReviewMutation.isPending}
                    onClick={() =>
                      breakGlassReviewMutation.mutate({
                        activationId: item.activationId,
                        result: 'MISUSE_FOUND',
                        reason: decisionReason.trim(),
                      })
                    }
                  >
                    {t('accessGovernance.misuseFound')}
                  </Button>
                </div>
              ) : null}
              {item.canEnd ? (
                <Button
                  className="mt-2"
                  variant="secondary"
                  disabled={!decisionReady}
                  loading={breakGlassEndMutation.isPending}
                  onClick={() =>
                    breakGlassEndMutation.mutate({
                      activationId: item.activationId,
                      reason: decisionReason.trim(),
                    })
                  }
                >
                  {t('accessGovernance.endAccess')}
                </Button>
              ) : null}
            </div>
          ))}
          {breakGlass.data?.pagination.activations.nextCursor ? (
            <Button
              variant="secondary"
              loading={
                breakGlassLoadMore.isPending &&
                breakGlassLoadMore.variables?.queue === 'independentReview'
              }
              onClick={() =>
                breakGlassLoadMore.mutate({
                  queue: 'independentReview',
                  cursor: breakGlass.data.pagination.activations.nextCursor!,
                })
              }
            >
              {t('accessGovernance.loadMore')}
            </Button>
          ) : null}

          {targetUserId &&
          (requestEligibility?.canRequestNonUrgent || requestEligibility?.canRequestUrgent) ? (
            <form
              className="grid gap-3 rounded border border-border bg-bg p-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSubmitBreakGlass || !targetUserId) return;
                const request = {
                  targetUserId,
                  permissions: [permission],
                  structuredScopeGrants: [grant],
                  urgency,
                  incidentReferenceId: incidentReferenceId.trim(),
                  reason: reason.trim(),
                  durationMs: Number(durationMinutes) * 60_000,
                };
                const signature = JSON.stringify(request);
                const idempotencyKey =
                  breakGlassSubmissionRef.current?.signature === signature
                    ? breakGlassSubmissionRef.current.idempotencyKey
                    : globalThis.crypto.randomUUID();
                breakGlassSubmissionRef.current = { signature, idempotencyKey };
                requestMutation.mutate(
                  { ...request, idempotencyKey },
                  {
                    onSuccess: () => {
                      breakGlassSubmissionRef.current = null;
                    },
                  },
                );
              }}
            >
              <label className="text-sm">
                {t('accessGovernance.permission')}
                <select
                  className="mt-1 w-full rounded border border-border bg-panel p-2"
                  value={permission}
                  onChange={(event) => setPermission(event.target.value)}
                >
                  <option value="">{t('accessGovernance.choose')}</option>
                  {breakGlass.data?.availablePermissions.map((item) => (
                    <option key={item} value={item}>
                      {formatPermissionCapabilityItems([{ code: item }], t)[0]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {t('accessGovernance.scope')}
                <select
                  className="mt-1 w-full rounded border border-border bg-panel p-2"
                  value={scopeType}
                  onChange={(event) =>
                    setScopeType(event.target.value as AccessAssignmentScopeType)
                  }
                >
                  {breakGlass.data?.availableScopeTypes.map((item) => (
                    <option key={item} value={item}>
                      {t(`accessAssignment.scopeTypes.${item}`, {
                        defaultValue: t('accessGovernance.scopeUnavailable'),
                      })}
                    </option>
                  ))}
                </select>
              </label>
              {requiresReference ? (
                <label className="text-sm">
                  {t('accessGovernance.scopeReference')}
                  <input
                    className="mt-1 w-full rounded border border-border bg-panel p-2"
                    value={scopeReference}
                    onChange={(event) => setScopeReference(event.target.value)}
                  />
                </label>
              ) : null}
              <label className="text-sm">
                {t('accessGovernance.urgency')}
                <select
                  className="mt-1 w-full rounded border border-border bg-panel p-2"
                  value={urgency}
                  onChange={(event) => setUrgency(event.target.value as 'URGENT' | 'NON_URGENT')}
                >
                  <option value="NON_URGENT" disabled={!requestEligibility?.canRequestNonUrgent}>
                    {t('accessGovernance.nonUrgent')}
                  </option>
                  <option value="URGENT" disabled={!requestEligibility?.canRequestUrgent}>
                    {t('accessGovernance.urgent')}
                  </option>
                </select>
              </label>
              <label className="text-sm">
                {t('accessGovernance.incident')}
                <input
                  className="mt-1 w-full rounded border border-border bg-panel p-2"
                  value={incidentReferenceId}
                  onChange={(event) => setIncidentReferenceId(event.target.value)}
                />
              </label>
              <label className="text-sm">
                {t('accessGovernance.duration')}
                <input
                  type="number"
                  min={1}
                  max={(breakGlass.data?.policy.maximumDurationMs ?? 0) / 60_000}
                  className="mt-1 w-full rounded border border-border bg-panel p-2"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                />
              </label>
              <label className="text-sm md:col-span-2">
                {t('accessGovernance.reason')}
                <textarea
                  className="mt-1 w-full rounded border border-border bg-panel p-2"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!canSubmitBreakGlass}
                  loading={requestMutation.isPending}
                >
                  {t('accessGovernance.submit')}
                </Button>
              </div>
            </form>
          ) : null}

          {breakGlass.data?.requests.map((item) => (
            <div key={item.requestId} className="mt-3 rounded border border-border p-3 text-sm">
              <p className="font-medium">{item.incidentReferenceId}</p>
              <p>
                {t('accessGovernance.approvalProgress', {
                  completed: item.completedApprovals,
                  required: item.requiredApprovals,
                })}
              </p>
              <p>{safeReason(item.ineligibilityReason)}</p>
              <div className="mt-2 flex gap-2">
                {item.canApprove ? (
                  <Button
                    variant="secondary"
                    disabled={!decisionReady}
                    loading={breakGlassDecisionMutation.isPending}
                    onClick={() =>
                      breakGlassDecisionMutation.mutate({
                        requestId: item.requestId,
                        decision: 'APPROVED',
                        reason: decisionReason.trim(),
                      })
                    }
                  >
                    {t('accessGovernance.approve')}
                  </Button>
                ) : null}
                {item.canReject ? (
                  <Button
                    variant="secondary"
                    disabled={!decisionReady}
                    loading={breakGlassDecisionMutation.isPending}
                    onClick={() =>
                      breakGlassDecisionMutation.mutate({
                        requestId: item.requestId,
                        decision: 'REJECTED',
                        reason: decisionReason.trim(),
                      })
                    }
                  >
                    {t('accessGovernance.reject')}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {breakGlass.data?.pagination.requests.nextCursor ? (
            <Button
              variant="secondary"
              loading={
                breakGlassLoadMore.isPending && breakGlassLoadMore.variables?.queue === 'approval'
              }
              onClick={() =>
                breakGlassLoadMore.mutate({
                  queue: 'approval',
                  cursor: breakGlass.data.pagination.requests.nextCursor!,
                })
              }
            >
              {t('accessGovernance.loadMore')}
            </Button>
          ) : null}
        </MetadataSection>
      ) : null}
    </div>
  );
};

const canonicalScopeSignature = (grants: readonly AccessAssignmentScopeGrant[]): string =>
  JSON.stringify(
    [...grants]
      .map((grant) => ({
        scopeType: grant.scopeType,
        targetId: grant.targetId ?? null,
        targetKey: grant.targetKey ?? null,
        periodKey: grant.periodKey ?? null,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  );
