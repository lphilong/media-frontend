import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';

import {
  useAccessAssignmentApplyMutation,
  useAccessAssignmentPreviewMutation,
  useAccessAssignmentRevokeMutation,
  useAccessAssignmentsForUser,
  useAccessAssignmentTargets,
} from '@modules/role/hooks/use-role';
import {
  AccessRiskBadges,
  AccessRiskSummary,
  ReviewDueBadge,
} from '@modules/role/components/AccessRiskIndicators';
import { AccessGovernancePanel } from '@modules/role/components/AccessGovernancePanel';
import { AccessAssignmentScopeResolver } from '@modules/role/components/AccessAssignmentScopeResolver';
import { buildAccessAssignmentPayload } from '@modules/role/model/access-assignment-payload';
import {
  buildAccessAssignmentRequirementState,
  buildAccessAssignmentStructuredScopeGrants,
  getAccessAssignmentRequirementIssueCodes,
  getUnsupportedAccessAssignmentScopeTypes,
  normalizeAccessAssignmentRequiredScopeTypes,
  type AccessAssignmentRequirementState,
} from '@modules/role/model/access-assignment-requirements';
import {
  selectAccessAssignmentTargets,
  selectDefaultAccessAssignmentTarget,
  selectHiddenReadinessAccessAssignmentTargets,
  selectRestrictedAccessAssignmentTargets,
  toAccessAssignmentTargetKey,
  type AccessAssignmentMode,
} from '@modules/role/model/access-assignment-targets';
import {
  buildAccessAssignmentWorkflowSteps,
  deriveAccessAssignmentReadiness,
  type AccessAssignmentWorkflowStep,
  type AccessAssignmentWorkflowStepId,
} from '@modules/role/model/access-assignment-workflow';
import type {
  AccessAssignmentApplyResult,
  AccessAssignmentIssue,
  AccessAssignmentLifecycleItem,
  AccessAssignmentLifecycleResult,
  AccessAssignmentPreviewResult,
  AccessAssignmentScopeGrant,
  AccessAssignmentScopeType,
  AccessAssignmentTargetOption,
} from '@modules/role/types/role.types';
import type { NormalizedApiError } from '@shared/api';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MetadataSection,
  ReadOnlyFieldGrid,
  SensitiveActionDialog,
  StatusBadge,
  TechnicalDetailsDisclosure,
  useMutationFeedback,
  WorkflowProgress,
  type WorkflowProgressItem,
} from '@shared/components/primitives';
import {
  AsyncReferencePicker,
  type ReferenceOption,
  useReferenceRegistry,
} from '@shared/components/reference';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

type AccessAssignmentApplyOutcome =
  | 'conflict'
  | 'noOp'
  | 'stale'
  | 'validation'
  | 'retryable'
  | 'unexpected';

type AccessAssignmentReferenceLoaders = {
  loadAccessAssignmentLinkedUserOptions: (search: string) => Promise<ReferenceOption[]>;
  loadEventReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadOrgUnitReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadPlatformAccountReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadStudioResourceReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadTalentGroupReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
};

const DEFAULT_USER_SUGGESTION_LIMIT = 10;

const assignmentPickerGroupOrder = [
  'REQUIRES_SCOPE_SELECTION',
  'READY_TO_ASSIGN',
  'READ_ONLY_AUDIT',
  'RESTRICTED_SENSITIVE',
] as const;

export const AccessAssignmentTab = (): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const { loadAccessAssignmentLinkedUserOptions } =
    useReferenceRegistry<AccessAssignmentReferenceLoaders>();
  const targetsQuery = useAccessAssignmentTargets();
  const previewMutation = useAccessAssignmentPreviewMutation();
  const applyMutation = useAccessAssignmentApplyMutation();
  const revokeMutation = useAccessAssignmentRevokeMutation();
  const resetPreviewMutation = previewMutation.reset;
  const resetApplyMutation = applyMutation.reset;
  const resetRevokeMutation = revokeMutation.reset;
  const { notifyError, notifySuccess } = useMutationFeedback();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [selectedUserOption, setSelectedUserOption] = useState<ReferenceOption | undefined>();
  const assignmentsQuery = useAccessAssignmentsForUser(selectedUserId);
  const [mode, setMode] = useState<AccessAssignmentMode>('BUNDLE');
  const [targetKey, setTargetKey] = useState<string>('');
  const [targetSearch, setTargetSearch] = useState('');
  const [scopeTargetIds, setScopeTargetIds] = useState<Record<string, string | undefined>>({});
  const [scopeTargetOptions, setScopeTargetOptions] = useState<
    Record<string, ReferenceOption | undefined>
  >({});
  const [scopePeriodKeys, setScopePeriodKeys] = useState<Record<string, string | undefined>>({});
  const [reason, setReason] = useState('');
  const [reviewAt, setReviewAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [previewRequestSignature, setPreviewRequestSignature] = useState<string | null>(null);
  const [autoPreviewSignature, setAutoPreviewSignature] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<AccessAssignmentApplyResult | null>(null);
  const [applyOutcome, setApplyOutcome] = useState<AccessAssignmentApplyOutcome | null>(null);
  const [selectedLifecycleAssignment, setSelectedLifecycleAssignment] =
    useState<AccessAssignmentLifecycleItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeResult, setRevokeResult] = useState<AccessAssignmentLifecycleResult | null>(null);
  const [activeStepId, setActiveStepId] = useState<AccessAssignmentWorkflowStepId>('user');
  const [userPickerResetGeneration, setUserPickerResetGeneration] = useState(0);
  const [sensitiveConfirmationOpen, setSensitiveConfirmationOpen] = useState(false);
  const applyInFlightRef = useRef(false);

  const resetPreviewAndApplyState = useCallback(() => {
    setPreviewSignature(null);
    setPreviewRequestSignature(null);
    setAutoPreviewSignature(null);
    setApplyResult(null);
    setApplyOutcome(null);
    setSensitiveConfirmationOpen(false);
    resetPreviewMutation();
    resetApplyMutation();
  }, [resetApplyMutation, resetPreviewMutation]);

  const resetUserBoundState = useCallback(() => {
    setTargetKey('');
    setScopeTargetIds({});
    setScopeTargetOptions({});
    setScopePeriodKeys({});
    setReason('');
    setReviewAt('');
    setExpiresAt('');
    setPreviewSignature(null);
    setPreviewRequestSignature(null);
    setAutoPreviewSignature(null);
    setApplyResult(null);
    setApplyOutcome(null);
    setSensitiveConfirmationOpen(false);
    setSelectedLifecycleAssignment(null);
    setRevokeReason('');
    setRevokeResult(null);
    setTargetSearch('');
    resetPreviewMutation();
    resetApplyMutation();
    resetRevokeMutation();
  }, [resetApplyMutation, resetPreviewMutation, resetRevokeMutation]);

  const handleSelectedUserChange = useCallback(
    (nextUserId?: string) => {
      setSelectedUserId((currentUserId) => {
        if (currentUserId !== nextUserId) {
          resetUserBoundState();
          setSelectedUserOption(undefined);
        }
        return nextUserId;
      });
      if (!nextUserId) {
        setActiveStepId('user');
        setSelectedUserOption(undefined);
        setUserPickerResetGeneration((generation) => generation + 1);
      }
    },
    [resetUserBoundState],
  );

  const handleSelectedUserOptionChange = useCallback(
    (option: ReferenceOption | undefined) => {
      if (option) {
        setSelectedUserOption(option);
        return;
      }
      setSelectedUserOption((currentOption) => (selectedUserId ? currentOption : undefined));
    },
    [selectedUserId],
  );

  const targets = useMemo(
    () => targetsQuery.data?.assignmentTargets ?? [],
    [targetsQuery.data?.assignmentTargets],
  );
  const bundleTargets = useMemo(() => selectAccessAssignmentTargets(targets, 'BUNDLE'), [targets]);
  const roleTemplateTargets = useMemo(
    () => selectAccessAssignmentTargets(targets, 'ROLE_TEMPLATE'),
    [targets],
  );
  const restrictedTargets = useMemo(
    () => selectRestrictedAccessAssignmentTargets(targets, mode),
    [mode, targets],
  );
  const hiddenReadinessTargets = useMemo(
    () => selectHiddenReadinessAccessAssignmentTargets(targets),
    [targets],
  );
  const activeTargets = mode === 'BUNDLE' ? bundleTargets : roleTemplateTargets;
  const selectedTarget = activeTargets.find(
    (target) => targetKey === toAccessAssignmentTargetKey(target),
  );

  useEffect(() => {
    if (!selectedUserId) {
      if (targetKey) {
        setTargetKey('');
      }
      return;
    }
    const nextTargets = mode === 'BUNDLE' ? bundleTargets : roleTemplateTargets;
    if (
      targetKey &&
      nextTargets.some((target) => toAccessAssignmentTargetKey(target) === targetKey)
    ) {
      return;
    }
    const defaultTarget = selectDefaultAccessAssignmentTarget(nextTargets);
    setTargetKey(defaultTarget ? toAccessAssignmentTargetKey(defaultTarget) : '');
  }, [bundleTargets, mode, roleTemplateTargets, selectedUserId, targetKey]);

  const requiredScopeTypes = useMemo(
    () => normalizeAccessAssignmentRequiredScopeTypes(selectedTarget?.requiredScopeTypes ?? []),
    [selectedTarget],
  );

  useEffect(() => {
    setScopeTargetIds({});
    setScopeTargetOptions({});
    setScopePeriodKeys({});
    resetPreviewAndApplyState();
  }, [resetPreviewAndApplyState, targetKey]);

  const unsupportedScopeTypes = getUnsupportedAccessAssignmentScopeTypes(requiredScopeTypes);
  const requirementState = useMemo(
    () =>
      buildAccessAssignmentRequirementState({
        selectedTarget,
        requiredScopeTypes,
        scopeTargetIds,
        scopePeriodKeys,
        reason,
        reviewAt,
        expiresAt,
        unsupportedScopeTypes,
      }),
    [
      expiresAt,
      reason,
      requiredScopeTypes,
      reviewAt,
      scopePeriodKeys,
      scopeTargetIds,
      selectedTarget,
      unsupportedScopeTypes,
    ],
  );
  const targetNeedsSensitiveConfirmation = requirementState.requiresSensitiveConfirmation;
  const structuredScopeGrants = useMemo(
    () =>
      buildAccessAssignmentStructuredScopeGrants(
        requiredScopeTypes,
        scopeTargetIds,
        scopePeriodKeys,
      ),
    [requiredScopeTypes, scopePeriodKeys, scopeTargetIds],
  );
  const targetUnavailable = Boolean(targetKey && !selectedTarget);
  const reasonValue = reason.trim();
  const currentPayload = useMemo(
    () =>
      selectedUserId && selectedTarget && requirementState.canEnterPreview
        ? buildAccessAssignmentPayload({
            selectedUserId,
            selectedTarget,
            structuredScopeGrants,
            reason: reasonValue,
            reviewAt,
            expiresAt,
          })
        : null,
    [
      expiresAt,
      requirementState.canEnterPreview,
      reasonValue,
      reviewAt,
      selectedTarget,
      selectedUserId,
      structuredScopeGrants,
    ],
  );
  const currentSignature = currentPayload ? JSON.stringify(currentPayload) : '';
  const previewResult = previewMutation.data;
  const workflowCompleted = isApplySuccess(applyResult);
  const userStepComplete = Boolean(
    selectedUserId && selectedUserOption && !selectedUserOption.disabled,
  );
  const readiness = deriveAccessAssignmentReadiness({
    currentPayload,
    hasSelectedUser: Boolean(selectedUserId),
    userStepComplete,
    hasSelectedTarget: Boolean(selectedTarget),
    requirementState,
    previewResult,
    previewSignature,
    currentSignature,
    isPreviewPending: previewMutation.isPending,
    isApplyPending: applyMutation.isPending,
    reason: reasonValue,
  });
  const {
    canApply,
    canPreview,
    conditionsStepComplete,
    previewMatchesCurrent,
    previewStepComplete,
    targetStepComplete,
  } = readiness;
  const previewHasBlockers = readiness.issues.hasBlockers;
  const guidedSteps = useMemo<AccessAssignmentWorkflowStep[]>(
    () =>
      buildAccessAssignmentWorkflowSteps({
        activeStepId,
        user: {
          id: selectedUserId,
          label: selectedUserOption?.label,
          disabled: selectedUserOption?.disabled === true,
        },
        target: {
          selected: Boolean(selectedTarget),
          complete: targetStepComplete,
          summary: selectedTarget ? formatAccessTargetLabel(selectedTarget, t) : '',
          unavailable: targetUnavailable,
          requiresSensitiveConfirmation: targetNeedsSensitiveConfirmation,
        },
        conditions: {
          complete: conditionsStepComplete,
          summary: formatScopeSummary(structuredScopeGrants, t, scopeTargetOptions),
          note: buildConditionsProgressNote(requirementState, t),
        },
        preview: {
          result: previewResult,
          matchesCurrent: previewMatchesCurrent,
          hasBlockers: previewHasBlockers,
          complete: previewStepComplete,
        },
        labels: {
          userTitle: t('role:accessAssignment.workflow.user.title'),
          userEmptySummary: t('role:accessAssignment.workflow.user.emptySummary'),
          userInvalidNote: t('role:accessAssignment.workflow.user.invalidNote'),
          targetTitle: t('role:accessAssignment.workflow.target.title'),
          targetEmptySummary: t('role:accessAssignment.workflow.target.emptySummary'),
          targetUnavailableNote: t('role:accessAssignment.workflow.target.unavailableNote'),
          targetSensitiveNote: t('role:accessAssignment.workflow.target.sensitiveNote'),
          conditionsTitle: t('role:accessAssignment.workflow.conditions.title'),
          conditionsIncompleteSummary: t(
            'role:accessAssignment.workflow.conditions.incompleteSummary',
          ),
          previewTitle: t('role:accessAssignment.workflow.preview.title'),
          previewReadySummary: t('role:accessAssignment.workflow.preview.readySummary'),
          previewEmptySummary: t('role:accessAssignment.workflow.preview.emptySummary'),
          previewSensitiveNote: t('role:accessAssignment.workflow.preview.sensitiveNote'),
        },
      }),
    [
      activeStepId,
      conditionsStepComplete,
      previewHasBlockers,
      previewMatchesCurrent,
      previewResult,
      previewStepComplete,
      requirementState,
      scopeTargetOptions,
      selectedTarget,
      selectedUserId,
      selectedUserOption?.disabled,
      selectedUserOption?.label,
      structuredScopeGrants,
      t,
      targetStepComplete,
      targetNeedsSensitiveConfirmation,
      targetUnavailable,
    ],
  );
  const workflowProgressItems = useMemo<WorkflowProgressItem[]>(
    () =>
      guidedSteps.map((step) => ({
        id: step.id,
        title: step.title,
        summary: workflowCompleted
          ? t('role:accessAssignment.workflow.completedSummary')
          : step.summary,
        note: [
          t(`role:accessAssignment.workflowTone.${step.tone}`),
          step.isActive && !workflowCompleted
            ? t('role:accessAssignment.workflow.active')
            : undefined,
          step.note,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' · '),
        businessTone: workflowCompleted ? 'success' : step.tone,
        isActive: workflowCompleted ? false : step.isActive,
        isComplete: workflowCompleted || step.tone === 'success',
        isDisabled: !step.canNavigate,
      })),
    [guidedSteps, t, workflowCompleted],
  );

  useEffect(() => {
    setPreviewSignature(null);
    setPreviewRequestSignature(null);
    setAutoPreviewSignature(null);
    setApplyResult(null);
    setApplyOutcome(null);
    resetPreviewMutation();
  }, [currentSignature, resetPreviewMutation]);

  useEffect(() => {
    if (!selectedUserId && activeStepId !== 'user') {
      setActiveStepId('user');
      return;
    }
    if (!targetStepComplete && (activeStepId === 'conditions' || activeStepId === 'preview')) {
      setActiveStepId('target');
      return;
    }
    if (!conditionsStepComplete && activeStepId === 'preview') {
      setActiveStepId('conditions');
    }
  }, [activeStepId, conditionsStepComplete, selectedUserId, targetStepComplete]);

  useEffect(() => {
    setSelectedLifecycleAssignment(null);
    setRevokeReason('');
    setRevokeResult(null);
  }, [selectedUserId]);

  const loadSearchFirstLinkedUsers = useCallback(
    (search: string): ReturnType<typeof loadAccessAssignmentLinkedUserOptions> => {
      const normalizedSearch = search.trim();
      if (normalizedSearch.length > 0 && normalizedSearch.length < 2) {
        return Promise.resolve([]);
      }
      return loadAccessAssignmentLinkedUserOptions(normalizedSearch).then((options) =>
        sanitizeAssignmentReferenceOptions(
          normalizedSearch ? options : options.slice(0, DEFAULT_USER_SUGGESTION_LIMIT),
        ),
      );
    },
    [loadAccessAssignmentLinkedUserOptions],
  );

  const runPreview = useCallback(async () => {
    if (!currentPayload || !canPreview || !currentSignature) {
      return;
    }
    const requestSignature = currentSignature;
    setPreviewRequestSignature(requestSignature);
    try {
      await previewMutation.mutateAsync(currentPayload);
      setPreviewSignature(requestSignature);
      setApplyResult(null);
    } catch (error) {
      notifyError(error as unknown as NormalizedApiError);
    } finally {
      setPreviewRequestSignature((current) => (current === requestSignature ? null : current));
    }
  }, [canPreview, currentPayload, currentSignature, notifyError, previewMutation]);

  useEffect(() => {
    if (
      activeStepId !== 'preview' ||
      !currentPayload ||
      !currentSignature ||
      !canPreview ||
      previewSignature === currentSignature ||
      previewRequestSignature === currentSignature ||
      autoPreviewSignature === currentSignature
    ) {
      return;
    }

    setAutoPreviewSignature(currentSignature);
    void runPreview();
  }, [
    activeStepId,
    autoPreviewSignature,
    canPreview,
    currentPayload,
    currentSignature,
    previewRequestSignature,
    previewSignature,
    runPreview,
  ]);

  const runApply = useCallback(async () => {
    if (!currentPayload || !canApply || workflowCompleted || applyInFlightRef.current) {
      return;
    }

    applyInFlightRef.current = true;
    try {
      const result = await applyMutation.mutateAsync(currentPayload);
      setApplyResult(result);
      if (isApplySuccess(result)) {
        setApplyOutcome(null);
        notifySuccess('role:accessAssignment.feedback.applied');
      } else {
        setApplyOutcome(getApplyResultOutcome(result));
      }
    } catch (error) {
      setApplyOutcome(getApplyErrorOutcome(error as NormalizedApiError));
    } finally {
      applyInFlightRef.current = false;
    }
  }, [applyMutation, canApply, currentPayload, notifySuccess, workflowCompleted]);

  const runRevoke = useCallback(async () => {
    const reasonText = revokeReason.trim();
    if (!selectedLifecycleAssignment || !reasonText || revokeMutation.isPending) {
      return;
    }
    try {
      const result = await revokeMutation.mutateAsync({
        assignmentId: selectedLifecycleAssignment.assignmentId,
        payload: { reason: reasonText },
      });
      setRevokeResult(result);
      if (isLifecycleRevokeSuccess(result)) {
        notifySuccess('role:accessAssignment.lifecycle.feedback.revoked');
        setSelectedLifecycleAssignment(null);
        setRevokeReason('');
      }
    } catch (error) {
      notifyError(error as unknown as NormalizedApiError);
    }
  }, [notifyError, notifySuccess, revokeMutation, revokeReason, selectedLifecycleAssignment]);

  const handleTargetSelect = useCallback(
    (nextTargetKey: string) => {
      setTargetKey((currentTargetKey) => {
        if (currentTargetKey !== nextTargetKey) {
          resetPreviewAndApplyState();
        }
        return nextTargetKey;
      });
    },
    [resetPreviewAndApplyState],
  );

  const handleScopeTargetChange = useCallback(
    (scopeType: AccessAssignmentScopeType, value?: string) => {
      resetPreviewAndApplyState();
      setScopeTargetIds((current) =>
        current[scopeType] === value ? current : { ...current, [scopeType]: value },
      );
    },
    [resetPreviewAndApplyState],
  );

  const handleScopeSelectedTargetChange = useCallback(
    (scopeType: AccessAssignmentScopeType, option?: ReferenceOption) => {
      setScopeTargetOptions((current) =>
        current[scopeType]?.id === option?.id ? current : { ...current, [scopeType]: option },
      );
    },
    [],
  );

  const handleScopePeriodChange = useCallback(
    (scopeType: AccessAssignmentScopeType, value?: string) => {
      const nextValue = value || undefined;
      resetPreviewAndApplyState();
      setScopePeriodKeys((current) =>
        current[scopeType] === nextValue ? current : { ...current, [scopeType]: nextValue },
      );
    },
    [resetPreviewAndApplyState],
  );

  const handleReasonChange = useCallback(
    (value: string) => {
      resetPreviewAndApplyState();
      setReason(value);
    },
    [resetPreviewAndApplyState],
  );

  const handleReviewAtChange = useCallback(
    (value: string) => {
      resetPreviewAndApplyState();
      setReviewAt(value);
    },
    [resetPreviewAndApplyState],
  );

  const handleExpiresAtChange = useCallback(
    (value: string) => {
      resetPreviewAndApplyState();
      setExpiresAt(value);
    },
    [resetPreviewAndApplyState],
  );

  if (targetsQuery.isLoading) {
    return <LoadingState lines={6} />;
  }

  if (targetsQuery.error) {
    return (
      <ErrorState
        title={t('role:accessAssignment.targetsLoadErrorTitle')}
        message={readErrorMessage(t, targetsQuery.error as unknown as NormalizedApiError)}
        actionLabel={t('common:actions.retry')}
        onRetry={() => void targetsQuery.refetch()}
      />
    );
  }

  const goToStep = (stepId: AccessAssignmentWorkflowStepId): void => {
    const step = guidedSteps.find((item) => item.id === stepId);
    if (step?.canNavigate) {
      setActiveStepId(stepId);
    }
  };

  const startAnotherAssignment = (): void => {
    applyInFlightRef.current = false;
    setSelectedUserId(undefined);
    setSelectedUserOption(undefined);
    setMode('BUNDLE');
    resetUserBoundState();
    setActiveStepId('user');
    setUserPickerResetGeneration((generation) => generation + 1);
  };

  const footerActions = workflowCompleted ? (
    <>
      <Button variant="primary" onClick={startAnotherAssignment}>
        {t('role:accessAssignment.completion.assignAnother')}
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          document
            .getElementById('role-assignment-selected-user-detail')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      >
        {t('role:accessAssignment.completion.viewEffectiveAccess')}
      </Button>
    </>
  ) : activeStepId === 'user' ? (
    <Button
      variant="primary"
      disabled={!userStepComplete}
      onClick={() => setActiveStepId('target')}
    >
      {t('role:accessAssignment.footer.continue')}
    </Button>
  ) : activeStepId === 'target' ? (
    <>
      <Button variant="secondary" onClick={() => setActiveStepId('user')}>
        {t('role:accessAssignment.footer.back')}
      </Button>
      <Button
        variant="primary"
        disabled={!targetStepComplete}
        onClick={() => setActiveStepId('conditions')}
      >
        {t('role:accessAssignment.footer.continue')}
      </Button>
    </>
  ) : activeStepId === 'conditions' ? (
    <>
      <Button variant="secondary" onClick={() => setActiveStepId('target')}>
        {t('role:accessAssignment.footer.back')}
      </Button>
      <Button
        variant="primary"
        disabled={!conditionsStepComplete}
        onClick={() => setActiveStepId('preview')}
      >
        {t('role:accessAssignment.footer.continueToPreview')}
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={() => setActiveStepId('conditions')}>
        {t('role:accessAssignment.footer.back')}
      </Button>
      <Button variant="primary" disabled={!canPreview} onClick={() => void runPreview()}>
        {t('role:accessAssignment.previewButton')}
      </Button>
      <Button
        variant="secondary"
        disabled={!canApply || applyMutation.isPending}
        onClick={() => {
          if (targetNeedsSensitiveConfirmation) {
            setSensitiveConfirmationOpen(true);
            return;
          }
          void runApply();
        }}
        loading={applyMutation.isPending}
        loadingLabel={t('role:accessAssignment.applyPending')}
      >
        {t('role:accessAssignment.applyButton')}
      </Button>
    </>
  );

  return (
    <div className="space-y-4">
      <AccessGovernancePanel targetUserId={selectedUserId} />
      <nav
        className="rounded border border-border bg-panel p-3"
        aria-label={t('role:accessAssignment.workflow.ariaLabel')}
        data-testid="role-assignment-workflow-progress"
      >
        <WorkflowProgress
          ariaLabel={t('role:accessAssignment.workflow.ariaLabel')}
          items={workflowProgressItems}
          onItemSelect={(stepId) => goToStep(stepId as AccessAssignmentWorkflowStepId)}
        />
      </nav>
      <h2 className="sr-only">{t('role:accessAssignment.userTitle')}</h2>

      <GuidedWorkflowActivePanel activeStepId={activeStepId}>
        {activeStepId === 'user' ? (
          <div data-testid="role-assignment-step-user" className="space-y-4">
            <MetadataSection
              title={t('role:accessAssignment.workflow.user.sectionTitle')}
              subtitle={t('role:accessAssignment.userSubtitle')}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                <div className="space-y-3">
                  <div className="rounded border border-border bg-bg p-3">
                    <p className="mb-2 text-sm font-medium text-text">
                      {t('role:accessAssignment.selectedUser.eligibleTitle')}
                    </p>
                    <AsyncReferencePicker
                      key={`assignment-user-${userPickerResetGeneration}`}
                      pickerId="role-access-assignment-linked-user"
                      value={selectedUserId}
                      onChange={handleSelectedUserChange}
                      onSelectedOptionChange={handleSelectedUserOptionChange}
                      loadOptions={loadSearchFirstLinkedUsers}
                      placeholder={t('role:accessAssignment.userSearchPlaceholder')}
                      resourceLabel={t('role:accessAssignment.userResource')}
                      clearable
                      showTechnicalMetadata={false}
                      emptySlot={
                        <div className="space-y-1 text-xs text-muted">
                          <p>{t('role:accessAssignment.userSearchEmpty')}</p>
                          <p>{t('role:accessAssignment.userSearchMinLength')}</p>
                        </div>
                      }
                    />
                    <p className="mt-2 text-xs text-muted">
                      {t('role:accessAssignment.selectedUser.defaultSuggestionsHelp', {
                        count: DEFAULT_USER_SUGGESTION_LIMIT,
                      })}
                    </p>
                  </div>
                </div>
                <UserSelectionDetailCard
                  selectedUserId={selectedUserId}
                  selectedUserOption={selectedUserOption}
                  assignments={assignmentsQuery.data?.items ?? []}
                  assignmentsLoading={assignmentsQuery.isLoading}
                  assignmentsError={assignmentsQuery.error as NormalizedApiError | null}
                  onRetryAssignments={() => void assignmentsQuery.refetch()}
                  onClear={() => handleSelectedUserChange(undefined)}
                >
                  <AssignmentLifecycleSection
                    isLoading={assignmentsQuery.isLoading}
                    error={assignmentsQuery.error as NormalizedApiError | null}
                    onRetry={() => void assignmentsQuery.refetch()}
                    assignments={assignmentsQuery.data?.items ?? []}
                    selectedAssignment={selectedLifecycleAssignment}
                    revokeReason={revokeReason}
                    revokeResult={revokeResult}
                    revokePending={revokeMutation.isPending}
                    onSelectAssignment={(assignment) => {
                      setSelectedLifecycleAssignment(assignment);
                      setRevokeReason('');
                      setRevokeResult(null);
                    }}
                    onCancelRevoke={() => {
                      setSelectedLifecycleAssignment(null);
                      setRevokeReason('');
                    }}
                    onReasonChange={setRevokeReason}
                    onConfirmRevoke={() => void runRevoke()}
                  />
                </UserSelectionDetailCard>
              </div>
            </MetadataSection>
          </div>
        ) : activeStepId === 'target' ? (
          <div data-testid="role-assignment-step-target">
            <MetadataSection
              title={t('role:accessAssignment.workflow.target.sectionTitle')}
              subtitle={t('role:accessAssignment.targetSubtitle')}
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMode('BUNDLE')}
                  className={`rounded border px-3 py-2 text-sm font-medium ${
                    mode === 'BUNDLE'
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-panel text-text'
                  }`}
                >
                  {t('role:accessAssignment.bundleMode')}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('ROLE_TEMPLATE')}
                  className={`rounded border px-3 py-2 text-sm font-medium ${
                    mode === 'ROLE_TEMPLATE'
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-panel text-text'
                  }`}
                >
                  {t('role:accessAssignment.roleMode')}
                </button>
              </div>

              {activeTargets.length === 0 ? (
                <EmptyState
                  variant="inline"
                  title={t('role:accessAssignment.noTargetsTitle')}
                  message={t('role:accessAssignment.noTargetsMessage')}
                />
              ) : (
                <AssignmentTargetPicker
                  targets={activeTargets}
                  selectedKey={targetKey}
                  search={targetSearch}
                  mode={mode}
                  onSearchChange={setTargetSearch}
                  onSelect={handleTargetSelect}
                />
              )}

              {targets.some((target) => !target.legacyAssignable) ? (
                <p className="mt-2 text-xs text-muted">
                  {t('role:accessAssignment.legacyTargetsHidden')}
                </p>
              ) : null}
              {hiddenReadinessTargets.length > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  {t('role:accessAssignment.futureTargetsHidden')}
                </p>
              ) : null}
              {restrictedTargets.length > 0 ? (
                <div className="mt-3 rounded border border-border bg-bg p-3">
                  <p className="text-sm font-semibold text-text">
                    {t('role:accessAssignment.restrictedTargetsTitle')}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t('role:accessAssignment.restrictedTargetsHelp')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {restrictedTargets.map((target) => (
                      <StatusBadge
                        key={toAccessAssignmentTargetKey(target)}
                        label={formatAccessTargetLabel(target, t)}
                        tone="warning"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </MetadataSection>
          </div>
        ) : activeStepId === 'conditions' ? (
          <div data-testid="role-assignment-step-scope">
            <MetadataSection
              title={t('role:accessAssignment.workflow.conditions.sectionTitle')}
              subtitle={t('role:accessAssignment.reasonHelp')}
            >
              <AccessAssignmentScopeResolver
                requiredScopeTypes={requiredScopeTypes}
                unsupportedScopeTypes={unsupportedScopeTypes}
                scopeTargetIds={scopeTargetIds}
                scopePeriodKeys={scopePeriodKeys}
                onTargetChange={handleScopeTargetChange}
                onSelectedTargetChange={handleScopeSelectedTargetChange}
                onPeriodChange={handleScopePeriodChange}
              />
              <label className="mt-4 block">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('role:accessAssignment.reasonLabel')}
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => handleReasonChange(event.target.value)}
                  className="mt-1 min-h-24 w-full rounded border border-border bg-bg px-3 py-2 text-sm"
                  placeholder={t('role:accessAssignment.reasonPlaceholder')}
                />
              </label>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('role:accessAssignment.reviewAtLabel')}
                  </span>
                  <input
                    type="date"
                    value={reviewAt}
                    onChange={(event) => handleReviewAtChange(event.target.value)}
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('role:accessAssignment.expiresAtLabel')}
                  </span>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(event) => handleExpiresAtChange(event.target.value)}
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-muted">
                {t('role:accessAssignment.conditionDateHelp')}
              </p>
              <ConditionsGuardrailSummary requirementState={requirementState} />
            </MetadataSection>
          </div>
        ) : workflowCompleted && applyResult ? (
          <CompletionSummary
            result={applyResult}
            selectedUserLabel={selectedUserOption?.label ?? selectedUserId ?? '-'}
            selectedTargetLabel={selectedTarget ? formatAccessTargetLabel(selectedTarget, t) : '-'}
            scopeSummary={formatScopeSummary(structuredScopeGrants, t, scopeTargetOptions)}
          />
        ) : (
          <div data-testid="role-assignment-step-preview">
            <MetadataSection title={t('role:accessAssignment.workflow.preview.sectionTitle')}>
              <ValidationSummary
                hasUser={Boolean(selectedUserId)}
                hasTarget={Boolean(selectedTarget)}
                hasReason={Boolean(reasonValue)}
                requirementState={requirementState}
                previewStale={Boolean(previewResult && !previewMatchesCurrent)}
              />

              {previewMutation.isPending ? (
                <div className="mt-3 rounded border border-border bg-bg p-3">
                  <p className="text-sm font-medium text-text">
                    {t('role:accessAssignment.previewPending')}
                  </p>
                  <LoadingState lines={2} variant="inline" />
                </div>
              ) : null}

              {previewMutation.error ? (
                <ErrorState
                  title={t('role:accessAssignment.previewBlocked')}
                  message={readErrorMessage(
                    t,
                    previewMutation.error as unknown as NormalizedApiError,
                  )}
                  variant="inline"
                />
              ) : null}

              {previewResult ? (
                <PreviewSummary
                  result={previewResult}
                  previewMatchesCurrent={previewMatchesCurrent}
                  scopeTargetOptions={scopeTargetOptions}
                />
              ) : null}
            </MetadataSection>
          </div>
        )}
      </GuidedWorkflowActivePanel>

      <GuidedWorkflowFooter>{footerActions}</GuidedWorkflowFooter>

      {applyResult && !workflowCompleted ? (
        <ApplySummary
          result={applyResult}
          reason={reasonValue}
          scopeTargetOptions={scopeTargetOptions}
          selectedUserLabel={selectedUserOption?.label ?? selectedUserId ?? '-'}
          selectedTargetLabel={selectedTarget ? formatAccessTargetLabel(selectedTarget, t) : '-'}
        />
      ) : null}
      {applyOutcome && !workflowCompleted ? <ApplyOutcomeNotice outcome={applyOutcome} /> : null}
      <SensitiveActionDialog
        open={sensitiveConfirmationOpen && Boolean(selectedTarget)}
        title={t('role:accessAssignment.sensitiveConfirm.title')}
        summary={t('role:accessAssignment.sensitiveConfirm.message')}
        riskItems={
          selectedTarget
            ? [
                `${t('role:accessAssignment.sensitiveConfirm.recipient')}: ${selectedUserOption?.label ?? selectedUserId ?? '-'}`,
                `${t('role:accessAssignment.sensitiveConfirm.target')}: ${formatAccessTargetLabel(selectedTarget, t)}`,
                `${t('role:accessAssignment.sensitiveConfirm.scope')}: ${formatScopeSummary(structuredScopeGrants, t, scopeTargetOptions)}`,
                `${t('role:accessAssignment.reviewAtLabel')}: ${reviewAt || '-'}`,
              ]
            : []
        }
        cancelLabel={t('role:accessAssignment.sensitiveConfirm.cancel')}
        confirmLabel={t('role:accessAssignment.sensitiveConfirm.confirm')}
        isSubmitting={applyMutation.isPending}
        tone="warning"
        onCancel={() => setSensitiveConfirmationOpen(false)}
        onConfirm={() => {
          setSensitiveConfirmationOpen(false);
          void runApply();
        }}
      />
    </div>
  );
};

const UserSelectionDetailCard = ({
  selectedUserId,
  selectedUserOption,
  assignments,
  assignmentsLoading,
  assignmentsError,
  onRetryAssignments,
  onClear,
  children,
}: {
  selectedUserId: string | undefined;
  selectedUserOption: ReferenceOption | undefined;
  assignments: AccessAssignmentLifecycleItem[];
  assignmentsLoading: boolean;
  assignmentsError: NormalizedApiError | null;
  onRetryAssignments: () => void;
  onClear: () => void;
  children: ReactNode;
}): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!selectedUserId) {
    return (
      <aside className="h-full rounded border border-dashed border-border bg-bg p-4">
        <p className="text-sm font-semibold text-text">
          {t('role:accessAssignment.selectedUser.emptyTitle')}
        </p>
        <p className="mt-2 text-sm text-muted">
          {t('role:accessAssignment.selectedUser.emptyMessage')}
        </p>
      </aside>
    );
  }

  const effectiveAssignments = assignments.filter((assignment) => assignment.currentlyEffective);
  const previewAssignments = effectiveAssignments.slice(0, 5);
  const hasReviewIssue = assignments.some(
    (assignment) =>
      assignment.requiresReview &&
      (assignment.reviewAt === null ||
        assignment.reviewAt === undefined ||
        assignment.reviewAt === ''),
  );

  return (
    <aside
      id="role-assignment-selected-user-detail"
      className="h-full rounded border border-border bg-bg p-4"
      data-testid="role-assignment-selected-user-detail"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted">
            {t('role:accessAssignment.selectedUser.title')}
          </p>
          <p className="mt-1 truncate text-base font-semibold text-text">
            {selectedUserOption?.label ?? selectedUserId}
          </p>
          {selectedUserOption?.description ? (
            <p className="mt-1 text-sm text-muted">{selectedUserOption.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-text"
        >
          {t('role:accessAssignment.selectedUser.clear')}
        </button>
      </div>
      <div className="mt-4">
        <ReadOnlyFieldGrid
          columns={2}
          fields={[
            {
              key: 'account',
              label: t('role:accessAssignment.selectedUser.account'),
              value: selectedUserOption?.label ?? selectedUserId,
            },
            {
              key: 'employeeCode',
              label: t('role:accessAssignment.selectedUser.employeeCode'),
              value: selectedUserOption?.meta?.employeeCode ?? '-',
            },
            {
              key: 'profileStatus',
              label: t('role:accessAssignment.selectedUser.profileStatus'),
              value: formatOperatorValue(selectedUserOption?.meta?.employmentStatus, t),
            },
            {
              key: 'linkedAccount',
              label: t('role:accessAssignment.selectedUser.linkedAccount'),
              value: formatLinkedAccountStatus(selectedUserOption?.meta?.linkedUserStatus, t),
            },
          ]}
        />
      </div>
      <div
        className="mt-4 space-y-2 rounded border border-border bg-panel p-3"
        data-testid="role-assignment-current-permissions-compact"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text">
            {t('role:accessAssignment.selectedUser.currentPermissionsTitle')}
          </p>
          {hasReviewIssue ? (
            <StatusBadge
              label={t('role:accessAssignment.selectedUser.reviewWarning')}
              tone="warning"
              uppercase={false}
            />
          ) : null}
        </div>
        {assignmentsLoading ? (
          <LoadingState lines={2} variant="inline" />
        ) : assignmentsError ? (
          <ErrorState
            title={t('role:accessAssignment.lifecycle.loadErrorTitle')}
            message={readErrorMessage(t, assignmentsError)}
            actionLabel={t('common:actions.retry')}
            onRetry={onRetryAssignments}
            variant="inline"
          />
        ) : previewAssignments.length === 0 ? (
          <p className="text-sm text-muted">
            {t('role:accessAssignment.selectedUser.noCurrentPermissions')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {previewAssignments.map((assignment) => (
              <StatusBadge
                key={assignment.assignmentId}
                label={formatAccessRoleLabel(assignment, t)}
                tone={assignment.requiresReview ? 'warning' : 'success'}
                uppercase={false}
              />
            ))}
          </div>
        )}
        {assignments.length > previewAssignments.length ? (
          <p className="text-xs text-muted">
            {t('role:accessAssignment.selectedUser.moreCurrentPermissions', {
              count: assignments.length - previewAssignments.length,
            })}
          </p>
        ) : null}
        <details
          className="pt-1"
          data-testid="role-assignment-current-permissions-details"
          open={detailsOpen}
          onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-medium text-accent">
            {t('role:accessAssignment.selectedUser.viewDetails')}
          </summary>
          {detailsOpen ? <div className="mt-3">{children}</div> : null}
        </details>
      </div>
    </aside>
  );
};

const ConditionsGuardrailSummary = ({
  requirementState,
}: {
  requirementState: AccessAssignmentRequirementState;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const blockers = getAccessAssignmentRequirementIssueCodes(requirementState).map((issue) => {
    switch (issue) {
      case 'scope':
        return t('accessAssignment.guardrail.missingScope');
      case 'reason':
        return t('accessAssignment.guardrail.missingReason');
      case 'reviewDate':
        return t('accessAssignment.guardrail.missingReviewDate');
      case 'expiryDate':
        return t('accessAssignment.guardrail.missingExpiryDate');
      case 'unsupportedScope':
        return t('accessAssignment.guardrail.unsupportedScope');
    }
  });

  if (blockers.length === 0) {
    return (
      <p className="mt-3 rounded border border-success/40 bg-success/10 px-3 py-2 text-sm text-text">
        {t('accessAssignment.guardrail.ready')}
      </p>
    );
  }

  return (
    <div className="mt-3 rounded border border-danger/40 bg-rose-50 px-3 py-2 text-sm text-danger">
      <p className="font-semibold">{t('accessAssignment.guardrail.title')}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {blockers.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
};

const GuidedWorkflowActivePanel = ({
  activeStepId,
  children,
}: {
  activeStepId: AccessAssignmentWorkflowStepId;
  children: JSX.Element;
}): JSX.Element => (
  <div
    data-testid="role-assignment-active-step"
    data-active-step={activeStepId}
    className="space-y-3"
  >
    {children}
  </div>
);

const GuidedWorkflowFooter = ({ children }: { children: JSX.Element }): JSX.Element => (
  <div
    data-testid="role-assignment-footer"
    className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-border bg-bg/95 py-3 backdrop-blur"
  >
    {children}
  </div>
);

const AssignmentTargetPicker = ({
  targets,
  selectedKey,
  search,
  mode,
  onSearchChange,
  onSelect,
}: {
  targets: AccessAssignmentTargetOption[];
  selectedKey: string;
  search: string;
  mode: AccessAssignmentMode;
  onSearchChange: (value: string) => void;
  onSelect: (targetKey: string) => void;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const filteredTargets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN');
    if (!normalizedSearch) {
      return targets;
    }
    return targets.filter((target) =>
      [
        formatAccessTargetLabel(target, t),
        formatTargetOperationalDescription(target, t),
        formatTargetScopeRequirement(target, t),
        formatTargetBusinessGroup(target, t),
      ]
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(normalizedSearch),
    );
  }, [search, t, targets]);
  const groups = groupSelectableTargets(filteredTargets);
  const allGroups = groupSelectableTargets(targets);

  return (
    <div className="mt-3 space-y-3">
      <label className="sr-only">
        {t('accessAssignment.targetLabel')}
        <select value={selectedKey} onChange={(event) => onSelect(event.target.value)}>
          {allGroups.map(({ group, items }) => (
            <optgroup key={group} label={formatPickerGroupLabel(group, t)}>
              {items.map((target) => (
                <option
                  key={toAccessAssignmentTargetKey(target)}
                  value={toAccessAssignmentTargetKey(target)}
                >
                  {formatAccessTargetLabel(target, t)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium uppercase text-muted">
          {t(
            mode === 'BUNDLE'
              ? 'accessAssignment.targetPicker.searchBundleLabel'
              : 'accessAssignment.targetPicker.searchTemplateLabel',
          )}
        </span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="mt-1 w-full rounded border border-border bg-panel px-3 py-2 text-sm"
          placeholder={t('accessAssignment.targetPicker.searchPlaceholder')}
        />
      </label>

      {groups.length === 0 ? (
        <EmptyState
          variant="inline"
          title={t('accessAssignment.targetPicker.noMatchTitle')}
          message={t('accessAssignment.targetPicker.noMatchMessage')}
        />
      ) : (
        groups.map(({ group, items }) => (
          <section key={group} className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-text">{formatPickerGroupLabel(group, t)}</p>
              <p className="text-xs text-muted">{formatPickerGroupHelp(group, t)}</p>
            </div>
            <div className="grid gap-2 xl:grid-cols-2">
              {items.map((target) => {
                const key = toAccessAssignmentTargetKey(target);
                const selected = key === selectedKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelect(key)}
                    className={`rounded border p-3 text-left text-sm ${
                      selected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg hover:border-accent/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-text">
                          {formatAccessTargetLabel(target, t)}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {formatTargetOperationalDescription(target, t)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge
                          label={formatTargetAvailability(target, t)}
                          tone={
                            target.assignabilityStatus === 'RESTRICTED_SENSITIVE'
                              ? 'warning'
                              : 'success'
                          }
                          uppercase={false}
                        />
                        {target.reviewPolicy === 'REVIEW_REQUIRED' ? (
                          <StatusBadge
                            label={t('accessAssignment.targetPicker.reviewRequired')}
                            tone="warning"
                            uppercase={false}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <p className="text-xs text-muted">
                        <span className="font-medium text-text">
                          {t('accessAssignment.targetPicker.scopeLabel')}{' '}
                        </span>
                        {formatTargetScopeRequirement(target, t)}
                      </p>
                      <p className="text-xs text-muted">
                        <span className="font-medium text-text">
                          {t('accessAssignment.targetPicker.groupLabel')}{' '}
                        </span>
                        {formatTargetBusinessGroup(target, t)}
                      </p>
                      <p className="text-xs text-muted">
                        <span className="font-medium text-text">
                          {t('accessAssignment.targetPicker.usageLabel')}{' '}
                        </span>
                        {target.assignmentKind === 'BUNDLE'
                          ? t('accessAssignment.targetPicker.bundleUsage')
                          : t('accessAssignment.targetPicker.templateUsage')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

const AssignmentLifecycleSection = ({
  isLoading,
  error,
  assignments,
  selectedAssignment,
  revokeReason,
  revokeResult,
  revokePending,
  onRetry,
  onSelectAssignment,
  onCancelRevoke,
  onReasonChange,
  onConfirmRevoke,
}: {
  isLoading: boolean;
  error: NormalizedApiError | null;
  assignments: AccessAssignmentLifecycleItem[];
  selectedAssignment: AccessAssignmentLifecycleItem | null;
  revokeReason: string;
  revokeResult: AccessAssignmentLifecycleResult | null;
  revokePending: boolean;
  onRetry: () => void;
  onSelectAssignment: (assignment: AccessAssignmentLifecycleItem) => void;
  onCancelRevoke: () => void;
  onReasonChange: (value: string) => void;
  onConfirmRevoke: () => void;
}): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);

  return (
    <MetadataSection
      title={t('role:accessAssignment.lifecycle.title')}
      subtitle={t('role:accessAssignment.lifecycle.subtitle')}
    >
      {isLoading ? (
        <LoadingState lines={4} />
      ) : error ? (
        <ErrorState
          title={t('role:accessAssignment.lifecycle.loadErrorTitle')}
          message={readErrorMessage(t, error)}
          actionLabel={t('common:actions.retry')}
          onRetry={onRetry}
        />
      ) : assignments.length === 0 ? (
        <EmptyState
          variant="inline"
          title={t('role:accessAssignment.lifecycle.emptyTitle')}
          message={t('role:accessAssignment.lifecycle.emptyMessage')}
        />
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div key={assignment.assignmentId} className="rounded border border-border bg-bg p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">
                    {formatAccessRoleLabel(assignment, t)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={formatLifecycleStatus(t, assignment.status)}
                    tone={assignment.status === 'ACTIVE' ? 'success' : 'neutral'}
                  />
                  {assignment.currentlyEffective ? (
                    <StatusBadge
                      label={t('role:accessAssignment.lifecycle.effective')}
                      tone="success"
                    />
                  ) : (
                    <StatusBadge
                      label={t('role:accessAssignment.lifecycle.inactive')}
                      tone="warning"
                    />
                  )}
                  <AccessRiskBadges risk={assignment} />
                  <ReviewDueBadge risk={assignment} />
                </div>
              </div>
              <ReadOnlyFieldGrid
                columns={3}
                fields={[
                  {
                    key: 'scope',
                    label: t('role:accessAssignment.lifecycle.scope'),
                    value: formatScopeSummary(assignment.structuredScopeGrants, t),
                  },
                  {
                    key: 'source',
                    label: t('role:accessAssignment.lifecycle.bundleOrigin'),
                    value: formatBundleOrigin(assignment, t),
                  },
                  {
                    key: 'reason',
                    label: t('role:accessAssignment.lifecycle.originalReason'),
                    value: assignment.reason ?? '-',
                  },
                  {
                    key: 'assigned',
                    label: t('role:accessAssignment.lifecycle.assignedAt'),
                    value: formatTimestamp(assignment.assignedAt, t),
                  },
                  {
                    key: 'review',
                    label: t('role:accessAssignment.reviewAtLabel'),
                    value: formatTimestamp(assignment.reviewAt, t),
                  },
                  {
                    key: 'expires',
                    label: t('role:accessAssignment.expiresAtLabel'),
                    value: formatTimestamp(assignment.expiresAt, t),
                  },
                  {
                    key: 'audit',
                    label: t('role:accessAssignment.lifecycle.audit'),
                    value: formatAssignmentAudit(assignment, t),
                  },
                ]}
              />
              {assignment.status === 'REVOKED' ? (
                <p className="mt-2 text-sm text-muted">
                  {t('role:accessAssignment.lifecycle.revokedSummary', {
                    actor: assignment.revokedBy ?? '-',
                    time: formatTimestamp(assignment.revokedAt, t),
                    reason: assignment.revokeReason ?? '-',
                  })}
                </p>
              ) : assignment.supportedActions.includes('REVOKE') ? (
                <button
                  type="button"
                  onClick={() => onSelectAssignment(assignment)}
                  className="mt-3 rounded border border-danger px-3 py-2 text-sm font-medium text-danger"
                >
                  {t('role:accessAssignment.lifecycle.revokeButton')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {selectedAssignment ? (
        <div className="mt-4 rounded border border-danger/50 bg-bg p-3">
          <p className="text-sm font-semibold text-text">
            {t('role:accessAssignment.lifecycle.confirmTitle')}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t('role:accessAssignment.lifecycle.confirmSubtitle', {
              role: formatAccessRoleLabel(selectedAssignment, t),
            })}
          </p>
          <label className="mt-3 block">
            <span className="text-xs font-medium uppercase text-muted">
              {t('role:accessAssignment.lifecycle.revokeReason')}
            </span>
            <textarea
              value={revokeReason}
              onChange={(event) => onReasonChange(event.target.value)}
              className="mt-1 min-h-20 w-full rounded border border-border bg-panel px-3 py-2 text-sm"
              placeholder={t('role:accessAssignment.lifecycle.revokeReasonPlaceholder')}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!revokeReason.trim() || revokePending}
              onClick={onConfirmRevoke}
              className="rounded border border-danger bg-danger px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {revokePending
                ? t('role:accessAssignment.lifecycle.revokePending')
                : t('role:accessAssignment.lifecycle.confirmRevoke')}
            </button>
            <button
              type="button"
              disabled={revokePending}
              onClick={onCancelRevoke}
              className="rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text"
            >
              {t('common:actions.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {revokeResult ? <LifecycleResultSummary result={revokeResult} /> : null}
    </MetadataSection>
  );
};

const LifecycleResultSummary = ({
  result,
}: {
  result: AccessAssignmentLifecycleResult;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const success = isLifecycleRevokeSuccess(result);

  return (
    <div className="mt-4 rounded border border-border bg-bg p-3">
      <StatusBadge
        label={
          success
            ? t('accessAssignment.lifecycle.revoked')
            : t('accessAssignment.lifecycle.revokeBlocked')
        }
        tone={success ? 'success' : 'warning'}
      />
      <IssueList title={t('accessAssignment.blockersTitle')} issues={result.blockers ?? []} />
      <ReadOnlyFieldGrid
        columns={3}
        fields={[
          {
            key: 'assignment',
            label: t('accessAssignment.lifecycle.assignmentId'),
            value: result.assignment ? t('accessAssignment.available') : '-',
          },
          {
            key: 'audit',
            label: t('accessAssignment.lifecycle.audit'),
            value: readLifecycleAuditTrace(result.auditTrace, t),
          },
          {
            key: 'effective',
            label: t('accessAssignment.lifecycle.effectiveAfterRevoke'),
            value: result.effectiveAccessAfterLifecycle ? t('accessAssignment.available') : '-',
          },
        ]}
      />
    </div>
  );
};

const PreviewSummary = ({
  result,
  previewMatchesCurrent,
  scopeTargetOptions,
}: {
  result: AccessAssignmentPreviewResult;
  previewMatchesCurrent: boolean;
  scopeTargetOptions: Record<string, ReferenceOption | undefined>;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const blockers = result.blockers ?? [];
  const warnings = result.warnings ?? [];
  const proposedAssignments = result.proposedAssignments ?? [];
  const addedPermissions = result.effectiveAccessDelta?.addedPermissions ?? [];
  const canApply = result.canApply === true && blockers.length === 0;
  const accountContextMessageKey = getAccountContextPreviewMessageKey(
    result.accountContextRequirement,
  );
  const responsibilityMessageKey = getResponsibilityPreviewMessageKey(
    result.responsibilityRequirements ?? [],
  );

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={
            canApply ? t('accessAssignment.previewCanApply') : t('accessAssignment.previewBlocked')
          }
          tone={canApply ? 'success' : 'warning'}
        />
        {!previewMatchesCurrent ? (
          <StatusBadge label={t('accessAssignment.previewStale')} tone="warning" />
        ) : null}
      </div>
      <IssueList title={t('accessAssignment.blockersTitle')} issues={blockers} />
      <IssueList title={t('accessAssignment.warningsTitle')} issues={warnings} />
      <AccessRiskSummary risk={result.sensitiveAccess} />
      <ReadOnlyFieldGrid
        columns={3}
        fields={[
          {
            key: 'assignments',
            label: t('accessAssignment.proposedAssignments'),
            value: String(proposedAssignments.length),
          },
          {
            key: 'delta',
            label: t('accessAssignment.addedPermissions'),
            value: String(addedPermissions.length),
          },
          {
            key: 'scope',
            label: t('accessAssignment.normalizedScope'),
            value: formatScopeSummary(result.normalizedScope ?? [], t, scopeTargetOptions),
          },
        ]}
      />
      <AssignmentTraceList
        title={t('accessAssignment.bundleTrace')}
        records={readTraceRecords(result.bundleExpansion)}
      />
      <AssignmentTraceList
        title={t('accessAssignment.childRoleTrace')}
        records={proposedAssignments}
      />
      <AssignmentTraceList
        title={t('accessAssignment.sourceTrace')}
        records={readTraceRecords(result.sourceTrace)}
      />
      {accountContextMessageKey ? (
        <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t(accountContextMessageKey)}
        </p>
      ) : null}
      {responsibilityMessageKey ? (
        <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t(responsibilityMessageKey)}
        </p>
      ) : null}
    </div>
  );
};

const ApplySummary = ({
  result,
  reason,
  scopeTargetOptions,
  selectedUserLabel,
  selectedTargetLabel,
}: {
  result: AccessAssignmentApplyResult;
  reason: string;
  scopeTargetOptions: Record<string, ReferenceOption | undefined>;
  selectedUserLabel: string;
  selectedTargetLabel: string;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const appliedAssignments = result.appliedAssignments ?? [];
  const applied = isApplySuccess(result);

  return (
    <MetadataSection
      title={t('accessAssignment.resultTitle')}
      subtitle={applied ? t('accessAssignment.resultApplied') : t('accessAssignment.resultBlocked')}
    >
      <IssueList title={t('accessAssignment.blockersTitle')} issues={result.blockers ?? []} />
      <IssueList title={t('accessAssignment.warningsTitle')} issues={result.warnings ?? []} />
      <AccessRiskSummary risk={result.sensitiveAccess} />
      <ReadOnlyFieldGrid
        columns={3}
        fields={[
          {
            key: 'assignee',
            label: t('accessAssignment.completion.assignee'),
            value: selectedUserLabel,
          },
          {
            key: 'target',
            label: t('accessAssignment.completion.accessTarget'),
            value: selectedTargetLabel,
          },
          {
            key: 'count',
            label: t('accessAssignment.appliedCount'),
            value: String(appliedAssignments.length),
          },
          {
            key: 'scope',
            label: t('accessAssignment.normalizedScope'),
            value: formatScopeSummary(result.normalizedScope ?? [], t, scopeTargetOptions),
          },
          {
            key: 'reason',
            label: t('accessAssignment.reasonLabel'),
            value: reason,
          },
          {
            key: 'audit',
            label: t('accessAssignment.auditTrace'),
            value: readAuditTrace(result.auditTrace, t),
          },
          {
            key: 'effective',
            label: t('accessAssignment.effectiveAccessAfterApply'),
            value: result.effectiveAccessAfterApply ? t('accessAssignment.available') : '-',
          },
          {
            key: 'console',
            label: t('accessAssignment.consoleResult'),
            value: result.consoleEntitlementResult ? t('accessAssignment.readOnlyOutcome') : '-',
          },
        ]}
      />
      <AssignmentTraceList
        title={t('accessAssignment.bundleTrace')}
        records={readTraceRecords(result.bundleExpansion)}
      />
      <AssignmentTraceList
        title={t('accessAssignment.childRoleTrace')}
        records={
          appliedAssignments.length > 0 ? appliedAssignments : (result.proposedAssignments ?? [])
        }
      />
      <AssignmentTraceList
        title={t('accessAssignment.accountContextResult')}
        records={readTraceRecords(result.accountContextResult)}
      />
      <AssignmentTraceList
        title={t('accessAssignment.responsibilityResult')}
        records={readTraceRecords(result.responsibilityOperationResult)}
      />
      <AssignmentTraceList
        title={t('accessAssignment.sourceTrace')}
        records={readTraceRecords(result.sourceTrace)}
      />
    </MetadataSection>
  );
};

const CompletionSummary = ({
  result,
  selectedUserLabel,
  selectedTargetLabel,
  scopeSummary,
}: {
  result: AccessAssignmentApplyResult;
  selectedUserLabel: string;
  selectedTargetLabel: string;
  scopeSummary: string;
}): JSX.Element => {
  const { t } = useTranslation('role');

  return (
    <div className="rounded-lg border border-success/40 bg-success/10 p-5" role="status">
      <p className="text-lg font-semibold text-success">{t('accessAssignment.completion.title')}</p>
      <p className="mt-1 text-sm text-muted">{t('accessAssignment.completion.message')}</p>
      <p className="mt-2 text-sm font-medium text-text">{t('accessAssignment.resultApplied')}</p>
      <div className="mt-4">
        <ReadOnlyFieldGrid
          columns={2}
          fields={[
            {
              key: 'assignee',
              label: t('accessAssignment.completion.assignee'),
              value: selectedUserLabel,
            },
            {
              key: 'target',
              label: t('accessAssignment.completion.accessTarget'),
              value: selectedTargetLabel,
            },
            {
              key: 'scope',
              label: t('accessAssignment.normalizedScope'),
              value: scopeSummary,
            },
            {
              key: 'count',
              label: t('accessAssignment.appliedCount'),
              value: String(result.appliedAssignments?.length ?? 0),
            },
          ]}
        />
      </div>
      <p className="mt-4 text-sm text-muted">{t('accessAssignment.completion.nextActions')}</p>
    </div>
  );
};

const ApplyOutcomeNotice = ({
  outcome,
}: {
  outcome: AccessAssignmentApplyOutcome;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const danger = outcome === 'retryable' || outcome === 'unexpected';

  return (
    <div
      className={`rounded border p-4 ${
        danger ? 'border-danger/30 bg-panel' : 'border-warning/30 bg-warning/10'
      }`}
      role="alert"
    >
      <p className={danger ? 'font-semibold text-danger' : 'font-semibold text-text'}>
        {t(`accessAssignment.applyOutcomes.${outcome}.title`)}
      </p>
      <p className="mt-1 text-sm text-muted">
        {t(`accessAssignment.applyOutcomes.${outcome}.message`)}
      </p>
    </div>
  );
};

const AssignmentTraceList = ({
  title,
  records,
}: {
  title: string;
  records: readonly Record<string, unknown>[];
}): JSX.Element | null => {
  const { t } = useTranslation('role');

  if (records.length === 0) {
    return null;
  }

  return (
    <TechnicalDetailsDisclosure
      className="rounded border border-border bg-bg p-3"
      label={title}
      details={records.map((record) => formatTraceRecord(record, t))}
    />
  );
};

const IssueList = ({
  title,
  issues,
}: {
  title: string;
  issues: AccessAssignmentIssue[];
}): JSX.Element | null => {
  const { t } = useTranslation('role');

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="rounded border border-border bg-bg p-3">
      <p className="text-sm font-semibold text-text">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>{formatIssue(issue, t)}</li>
        ))}
      </ul>
    </div>
  );
};

const ValidationSummary = ({
  hasUser,
  hasTarget,
  hasReason,
  requirementState,
  previewStale,
}: {
  hasUser: boolean;
  hasTarget: boolean;
  hasReason: boolean;
  requirementState: AccessAssignmentRequirementState;
  previewStale: boolean;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const items = [
    !hasUser ? t('accessAssignment.noUserSelected') : null,
    !hasTarget ? t('accessAssignment.noTargetSelected') : null,
    requirementState.missingScope ? t('accessAssignment.missingScope') : null,
    !hasReason ? t('accessAssignment.missingReason') : null,
    requirementState.missingReviewDate ? t('accessAssignment.missingReviewDate') : null,
    requirementState.missingExpiryDate ? t('accessAssignment.missingExpiryDate') : null,
    previewStale ? t('accessAssignment.previewChanged') : null,
    requirementState.missingUnsupportedScope ? t('accessAssignment.unsupportedScope') : null,
  ].filter((item): item is string => Boolean(item));

  if (items.length === 0) {
    return <p className="mt-3 text-sm text-muted">{t('accessAssignment.readyForPreview')}</p>;
  }

  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
};

function buildConditionsProgressNote(
  requirementState: AccessAssignmentRequirementState,
  t: TranslationFn,
): string | undefined {
  const issues = getAccessAssignmentRequirementIssueCodes(requirementState);
  const issue = issues.includes('unsupportedScope') ? 'unsupportedScope' : issues[0];
  switch (issue) {
    case 'unsupportedScope':
      return t('accessAssignment.workflow.conditions.unsupportedNote');
    case 'scope':
      return t('accessAssignment.workflow.conditions.missingScopeNote');
    case 'reason':
      return t('accessAssignment.workflow.conditions.missingReasonNote');
    case 'reviewDate':
      return t('accessAssignment.workflow.conditions.missingReviewDateNote');
    case 'expiryDate':
      return t('accessAssignment.workflow.conditions.missingExpiryDateNote');
    default:
      return undefined;
  }
}

function formatOperatorValue(value: string | undefined, t: TranslationFn): string {
  if (!value) {
    return '-';
  }
  return t(`accessAssignment.operatorStatus.${value}`, {
    defaultValue: t('accessAssignment.operatorStatus.other'),
  });
}

function formatLinkedAccountStatus(value: string | undefined, t: TranslationFn): string {
  if (!value) {
    return '-';
  }
  return t(`accessAssignment.linkedAccountStatus.${value}`, {
    defaultValue: t('accessAssignment.linkedAccountStatus.other'),
  });
}

function isApplySuccess(result: AccessAssignmentApplyResult | null | undefined): boolean {
  if (!result) {
    return false;
  }
  const blockers = result.blockers ?? [];
  return result.applied === true && result.applyStatus === 'APPLIED' && blockers.length === 0;
}

function getApplyResultOutcome(result: AccessAssignmentApplyResult): AccessAssignmentApplyOutcome {
  const issueCodes = new Set((result.blockers ?? []).map((issue) => issue.code));
  if (issueCodes.has('DUPLICATE_ACTIVE_ASSIGNMENT')) {
    return 'noOp';
  }
  if (issueCodes.has('SOURCE_CHANGED_AFTER_PREVIEW')) {
    return 'stale';
  }
  if (issueCodes.has('REASON_REQUIRED') || issueCodes.has('REVIEW_AT_REQUIRED')) {
    return 'validation';
  }
  return 'conflict';
}

function getApplyErrorOutcome(error: NormalizedApiError): AccessAssignmentApplyOutcome {
  if (error.status === 409) {
    return 'conflict';
  }
  if (error.status === 400 || error.status === 422) {
    return 'validation';
  }
  return error.retryable ? 'retryable' : 'unexpected';
}

function isLifecycleRevokeSuccess(
  result: AccessAssignmentLifecycleResult | null | undefined,
): boolean {
  if (!result) {
    return false;
  }
  return (
    result.revoked === true && result.lifecycleStatus === 'REVOKED' && result.blockers.length === 0
  );
}

const internalAccessDisplayLabelKeys: Record<string, string> = {
  OWNER_ADMIN: 'ownerAdmin',
  ACCESS_ADMIN: 'accessAdmin',
  HR_OPERATIONS: 'hrOperations',
  HR_TERMS_APPROVER: 'hrTermsApprover',
  PRODUCTION_OPS: 'productionOps',
  PLATFORM_CHANNEL_OPS: 'platformChannelOps',
  CREATIVE_VISUAL_LEAD: 'creativeVisualLead',
  CONTENT_OPS: 'contentOps',
  TALENT_GROUP_MANAGER: 'talentGroupManager',
  ORG_UNIT_MANAGER: 'orgUnitManager',
  KPI_OPERATIONS: 'kpiOperations',
  COMMERCIAL_CONTRACT_OPS: 'commercialContractOps',
  REVENUE_FINANCE_OPS: 'revenueFinanceOps',
  REVENUE_APPROVER: 'revenueApprover',
  REVENUE_RECONCILER: 'revenueReconciler',
  COMMISSION_OPS: 'commissionOps',
  COMMISSION_APPROVER: 'commissionApprover',
  ATTENDANCE_OPS: 'attendanceOps',
  LEAVE_REVIEWER: 'leaveReviewer',
  ATTENDANCE_APPROVER: 'attendanceApprover',
  MONTHLY_CLOSE_OWNER: 'monthlyCloseOwner',
  PAYROLL_DRAFT_OPS: 'payrollDraftOps',
  PAYROLL_DRAFT_APPROVER: 'payrollDraftApprover',
  VIEWER_AUDITOR: 'viewerAuditor',
  OWNER_ADMIN_BUNDLE: 'ownerAdmin',
  ACCESS_ADMIN_BUNDLE: 'accessAdmin',
  HR_STAFF_BUNDLE: 'hrOperations',
  HR_MANAGER_BUNDLE: 'hrManagerBundle',
  PRODUCTION_OPS_BUNDLE: 'productionOps',
  PLATFORM_CHANNEL_OPS_BUNDLE: 'platformChannelOps',
  CREATIVE_VISUAL_LEAD_BUNDLE: 'creativeVisualLead',
  CONTENT_OPS_BUNDLE: 'contentOps',
  TALENT_GROUP_MANAGER_BUNDLE: 'talentGroupManager',
  ORG_UNIT_MANAGER_BUNDLE: 'orgUnitManager',
  KPI_OPERATOR_BUNDLE: 'kpiOperations',
  COMMERCIAL_STAFF_BUNDLE: 'commercialContractOps',
  FINANCE_STAFF_BUNDLE: 'financeStaffBundle',
  FINANCE_APPROVER_BUNDLE: 'revenueApprover',
  COMMISSION_APPROVER_BUNDLE: 'commissionApprover',
  ATTENDANCE_OPERATOR_BUNDLE: 'attendanceOps',
  ATTENDANCE_APPROVER_BUNDLE: 'attendanceApprover',
  MONTHLY_CLOSE_OWNER_BUNDLE: 'monthlyCloseOwner',
  PAYROLL_DRAFT_OPERATOR_BUNDLE: 'payrollDraftOps',
  PAYROLL_DRAFT_APPROVER_BUNDLE: 'payrollDraftApprover',
  AUDITOR_BUNDLE: 'viewerAuditor',
  STAFF_CONSOLE_USER: 'staffConsoleUser',
  STAFF_CONSOLE_BUNDLE: 'staffConsoleUser',
};

function readAccessDisplayLabel(code: string | null | undefined, t: TranslationFn): string | null {
  if (!code) {
    return null;
  }
  const key = internalAccessDisplayLabelKeys[code];
  return key ? t(`accessAssignment.displayLabels.${key}`) : null;
}

function hasInternalAccessTerm(value: string | null | undefined): boolean {
  return /console|account context|workspace/i.test(value ?? '');
}

function sanitizeInternalAccessLabel(
  value: string | null | undefined,
  fallback: string,
  t: TranslationFn,
): string {
  if (!value) {
    return fallback;
  }

  if (/staff console/i.test(value)) {
    return t('accessAssignment.displayLabels.staffConsoleUser');
  }

  if (/manager console/i.test(value)) {
    return t('accessAssignment.displayLabels.managerAssignedAccess');
  }

  if (/admin console/i.test(value)) {
    return t('accessAssignment.displayLabels.adminOperationalAccess');
  }

  return hasInternalAccessTerm(value) ? fallback : value;
}

function formatAccessTargetLabel(target: AccessAssignmentTargetOption, t: TranslationFn): string {
  const label = readAccessDisplayLabel(target.code, t);
  return (
    label ??
    sanitizeInternalAccessLabel(target.name, t('accessAssignment.displayLabels.unknownAccess'), t)
  );
}

const targetDescriptionKeys: Record<string, string> = {
  TALENT_GROUP_MANAGER: 'talentGroupManager',
  ORG_UNIT_MANAGER: 'orgUnitManager',
  TALENT_GROUP_MANAGER_BUNDLE: 'talentGroupManagerBundle',
  ORG_UNIT_MANAGER_BUNDLE: 'orgUnitManagerBundle',
  AUDITOR_BUNDLE: 'auditorBundle',
  VIEWER_AUDITOR: 'viewerAuditor',
  STAFF_CONSOLE_USER: 'staffConsoleUser',
  STAFF_CONSOLE_BUNDLE: 'staffConsoleBundle',
};

function formatTargetOperationalDescription(
  target: AccessAssignmentTargetOption,
  t: TranslationFn,
): string {
  const key = targetDescriptionKeys[target.code];
  if (key) {
    return t(`accessAssignment.targetDescriptions.${key}`);
  }
  return target.assignmentKind === 'BUNDLE'
    ? t('accessAssignment.targetDescriptions.defaultBundle')
    : t('accessAssignment.targetDescriptions.defaultTemplate');
}

function formatTargetScopeRequirement(
  target: AccessAssignmentTargetOption,
  t: TranslationFn,
): string {
  const scopes = normalizeAccessAssignmentRequiredScopeTypes(target.requiredScopeTypes ?? []);
  if (scopes.length === 0) {
    return t('accessAssignment.targetPicker.noSeparateScope');
  }
  return scopes.map((scopeType) => formatScopeTypeLabel(scopeType, t)).join(', ');
}

function formatTargetAvailability(target: AccessAssignmentTargetOption, t: TranslationFn): string {
  return t(`accessAssignment.targetAvailability.${target.assignabilityStatus}`, {
    defaultValue: t('accessAssignment.targetAvailability.SYSTEM_CONTROLLED'),
  });
}

function formatTargetBusinessGroup(target: AccessAssignmentTargetOption, t: TranslationFn): string {
  if (/TALENT_GROUP_MANAGER|ORG_UNIT_MANAGER|HR_/u.test(target.code)) {
    return t('accessAssignment.targetBusinessGroups.people');
  }
  if (/REVENUE|FINANCE|COMMISSION/u.test(target.code)) {
    return t('accessAssignment.targetBusinessGroups.finance');
  }
  if (/AUDITOR|VIEWER/u.test(target.code)) {
    return t('accessAssignment.targetBusinessGroups.audit');
  }
  if (/OWNER|ACCESS/u.test(target.code)) {
    return t('accessAssignment.targetBusinessGroups.controlledAdmin');
  }
  if (/STAFF_CONSOLE/u.test(target.code)) {
    return t('accessAssignment.targetBusinessGroups.selfService');
  }
  return t('accessAssignment.targetBusinessGroups.operations');
}

function formatPickerGroupLabel(
  group: (typeof assignmentPickerGroupOrder)[number],
  t: TranslationFn,
): string {
  return t(`accessAssignment.pickerGroups.${group}`);
}

function formatPickerGroupHelp(
  group: (typeof assignmentPickerGroupOrder)[number],
  t: TranslationFn,
): string {
  return t(`accessAssignment.pickerGroupHelp.${group}`);
}

function formatAccessRoleLabel(
  assignment: Pick<AccessAssignmentLifecycleItem, 'roleCode' | 'roleName' | 'roleId'>,
  t: TranslationFn,
): string {
  const fallback = t('accessAssignment.displayLabels.assignedAccess');
  const displayLabel = readAccessDisplayLabel(assignment.roleCode, t);
  if (displayLabel) {
    return displayLabel;
  }
  return sanitizeInternalAccessLabel(assignment.roleName, fallback, t);
}

function formatIssue(issue: AccessAssignmentIssue, t: TranslationFn): string {
  return t(`accessAssignment.issues.${issue.code}`, {
    defaultValue: t('accessAssignment.issues.generic'),
  });
}

function getAccountContextPreviewMessageKey(
  requirement: Record<string, unknown> | null | undefined,
): string | null {
  if (!requirement) {
    return null;
  }
  const status = readStringRecordValue(requirement, 'status');
  const requiredAccountContexts = readStringArrayRecordValue(
    requirement,
    'requiredAccountContexts',
  );

  if (status === 'NOT_REQUIRED' || (requiredAccountContexts.length === 0 && status !== null)) {
    return 'accessAssignment.accountContextStates.notRequired';
  }
  if (status === 'SATISFIED') {
    return 'accessAssignment.accountContextStates.reused';
  }
  if (status === 'PROPOSED_FOR_APPLICATION') {
    return 'accessAssignment.accountContextStates.proposed';
  }
  if (
    status === 'BLOCKED_UNAUTHORIZED' ||
    status === 'TARGET_USER_UNRESOLVED' ||
    status === 'MISSING_REQUIRED_CONTEXT'
  ) {
    return 'accessAssignment.accountContextStates.blocked';
  }
  return 'accessAssignment.accountContextStates.unknown';
}

function getResponsibilityPreviewMessageKey(
  requirements: readonly Record<string, unknown>[],
): string {
  if (requirements.length === 0) {
    return 'accessAssignment.responsibilityStates.notRequired';
  }

  const statuses = requirements.map((requirement) => readStringRecordValue(requirement, 'status'));
  if (
    statuses.some(
      (status) =>
        status === 'MISSING_RESPONSIBILITY_UNAUTHORIZED' ||
        status === 'MISSING_RESPONSIBILITY_TARGET_NOT_ACTIVE' ||
        status === 'CREATE_PROPOSED_REASON_REQUIRED' ||
        status === 'MISSING_RESPONSIBILITY' ||
        status === 'RESPONSIBILITY_REQUIRED',
    )
  ) {
    return 'accessAssignment.responsibilityStates.blocked';
  }
  if (statuses.some((status) => status === 'CREATE_PROPOSED')) {
    return 'accessAssignment.responsibilityStates.createProposed';
  }
  if (statuses.every((status) => status === 'SATISFIED')) {
    return 'accessAssignment.responsibilityStates.reused';
  }
  return 'accessAssignment.responsibilityStates.unknown';
}

function formatScopeTypeLabel(scopeType: AccessAssignmentScopeType, t: TranslationFn): string {
  return t(`accessAssignment.scopeTypes.${scopeType}`, { defaultValue: scopeType });
}

function sanitizeAssignmentReferenceOption(option: ReferenceOption): ReferenceOption {
  return {
    ...option,
    code: undefined,
    status: undefined,
    state: undefined,
    badges: undefined,
    meta: option.meta
      ? {
          employeeCode: option.meta.employeeCode,
          employmentStatus: option.meta.employmentStatus,
        }
      : undefined,
  };
}

function sanitizeAssignmentReferenceOptions(options: ReferenceOption[]): ReferenceOption[] {
  return options.map(sanitizeAssignmentReferenceOption);
}

function formatScopeSummary(
  scopes: readonly AccessAssignmentScopeGrant[],
  t: TranslationFn,
  scopeTargetOptions: Record<string, ReferenceOption | undefined> = {},
): string {
  if (scopes.length === 0) {
    return '-';
  }
  return scopes
    .map((scope) => {
      const label = scope.targetId ? scopeTargetOptions[scope.scopeType]?.label : undefined;
      return [
        formatScopeTypeLabel(scope.scopeType, t),
        label,
        scope.targetId && !label ? t('accessAssignment.selectedScopeFallback') : null,
        scope.periodKey,
      ]
        .filter(Boolean)
        .join(': ');
    })
    .join(', ');
}

function groupSelectableTargets(targets: readonly AccessAssignmentTargetOption[]): Array<{
  group: (typeof assignmentPickerGroupOrder)[number];
  items: AccessAssignmentTargetOption[];
}> {
  return assignmentPickerGroupOrder
    .map((group) => ({
      group,
      items: targets.filter((target) => target.operatorFlowGroup === group),
    }))
    .filter(({ items }) => items.length > 0);
}

function readTraceRecords(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  const record = value as Record<string, unknown>;
  const itemLists = ['items', 'proposedAssignments', 'appliedAssignments'];
  const nestedRecords = itemLists.flatMap((key) =>
    Array.isArray(record[key])
      ? record[key].filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === 'object' && entry !== null && !Array.isArray(entry),
        )
      : [],
  );
  return nestedRecords.length > 0 ? [record, ...nestedRecords] : [record];
}

function formatTraceRecord(record: Record<string, unknown>, t: TranslationFn): string {
  const parts: string[] = [];
  const bundleCode = readStringRecordValue(record, 'bundleCode');
  const roleCode = readStringRecordValue(record, 'roleCode');
  const roleName = readStringRecordValue(record, 'roleName');
  const operation =
    readStringRecordValue(record, 'operation') ??
    readStringRecordValue(record, 'mutationType') ??
    readStringRecordValue(record, 'materializationPolicy');

  if (bundleCode) {
    parts.push(
      t('accessAssignment.trace.bundle', {
        value: formatSafeTraceCodeLabel(bundleCode, t('accessAssignment.trace.bundleFallback'), t),
      }),
    );
  }

  if (roleCode) {
    parts.push(
      t('accessAssignment.trace.role', {
        value: formatSafeTraceCodeLabel(roleCode, t('accessAssignment.trace.roleFallback'), t),
      }),
    );
  } else if (roleName) {
    parts.push(
      t('accessAssignment.trace.role', {
        value: sanitizeInternalAccessLabel(roleName, t('accessAssignment.trace.roleFallback'), t),
      }),
    );
  }

  if (operation) {
    parts.push(t('accessAssignment.trace.recordedState'));
  }

  return parts.length > 0 ? parts.join(' · ') : t('accessAssignment.trace.recordedDetail');
}

function formatSafeTraceCodeLabel(code: string, fallback: string, t: TranslationFn): string {
  const displayLabel = readAccessDisplayLabel(code, t);
  if (displayLabel) {
    return displayLabel;
  }

  return hasInternalAccessTerm(code) || /^[A-Z0-9_]+$/u.test(code)
    ? fallback
    : sanitizeInternalAccessLabel(code, fallback, t);
}

function formatLifecycleStatus(t: (key: string) => string, status: string): string {
  const key = `role:assignmentStates.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function formatBundleOrigin(assignment: AccessAssignmentLifecycleItem, t: TranslationFn): string {
  if (!assignment.bundleOrigin) {
    return assignment.origin === 'BUNDLE'
      ? t('accessAssignment.lifecycle.bundleDirectOrigin')
      : t('accessAssignment.lifecycle.directOrigin');
  }
  const code = readStringRecordValue(assignment.bundleOrigin, 'bundleCode');
  return readAccessDisplayLabel(code, t) ?? t('accessAssignment.lifecycle.bundleDirectOrigin');
}

function formatAssignmentAudit(
  assignment: AccessAssignmentLifecycleItem,
  t: TranslationFn,
): string {
  const audit = assignment.auditSummary;
  if (!audit) {
    return '-';
  }
  const action =
    audit.action === 'ASSIGN'
      ? t('accessAssignment.auditActions.assign')
      : t('accessAssignment.auditActions.update');
  const time = formatTimestamp(audit.timestamp, t);
  const reason = audit.reason ?? '-';
  return `${action} · ${time} · ${reason}`;
}

function formatTimestamp(value: number | string | null | undefined, t: TranslationFn): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const date =
    typeof value === 'number'
      ? new Date(value)
      : /^\d+$/u.test(value)
        ? new Date(Number(value))
        : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  return t('accessAssignment.time.vietnam', { value: parts });
}

function readAuditTrace(
  value: Record<string, unknown> | null | undefined,
  t: TranslationFn,
): string {
  if (!value) {
    return '-';
  }
  if (Array.isArray(value.assignmentIds) && value.assignmentIds.length > 0) {
    return t('accessAssignment.trace.recorded');
  }
  return value.mutationType ? t('accessAssignment.trace.recorded') : '-';
}

function readLifecycleAuditTrace(
  value: Record<string, unknown> | null | undefined,
  t: TranslationFn,
): string {
  if (!value) {
    return '-';
  }
  const action =
    readStringRecordValue(value, 'lifecycleAction') ?? readStringRecordValue(value, 'mutationType');
  const timestamp = value.timestamp;
  return [
    action ? t('accessAssignment.trace.recorded') : null,
    formatTimestamp(
      typeof timestamp === 'string' || typeof timestamp === 'number' ? timestamp : null,
      t,
    ),
  ]
    .filter(Boolean)
    .join(' · ');
}

function readStringRecordValue(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  return typeof field === 'string' && field.trim() ? field : null;
}

function readStringArrayRecordValue(value: Record<string, unknown>, key: string): string[] {
  const field = value[key];
  return Array.isArray(field)
    ? field.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function readErrorMessage(
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
): string {
  if (!error?.message) {
    return t('role:statesView.loadErrorMessage');
  }
  if (containsRawTechnicalToken(error.message)) {
    return t('role:statesView.loadErrorMessage');
  }
  return error.message.includes(':') ? t(error.message) : error.message;
}

function containsRawTechnicalToken(message: string): boolean {
  return (
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu.test(message) ||
    /\b(objectId|uuid|_id|assignmentId|bundleAssignmentId|scopeFingerprint)\b/iu.test(message) ||
    /\bnot found:\s*\S+/iu.test(message)
  );
}
