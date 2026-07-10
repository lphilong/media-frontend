import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
import type {
  AccessAssignmentApplyResult,
  AccessAssignmentIssue,
  AccessAssignmentLifecycleItem,
  AccessAssignmentLifecycleResult,
  AccessAssignmentPreviewResult,
  AccessAssignmentRequestPayload,
  AccessAssignmentScopeGrant,
  AccessAssignmentScopeType,
  AccessAssignmentTargetOption,
} from '@modules/role/types/role.types';
import type { NormalizedApiError } from '@shared/api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetadataSection,
  ReadOnlyFieldGrid,
  StatusBadge,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  AsyncReferencePicker,
  type ReferenceOption,
  useReferenceRegistry,
} from '@shared/components/reference';

type AssignmentMode = 'BUNDLE' | 'ROLE_TEMPLATE';
type AssignmentWorkflowStepId = 'user' | 'target' | 'conditions' | 'preview';
type GuidedWorkflowTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

type GuidedWorkflowStep = {
  id: AssignmentWorkflowStepId;
  number: number;
  title: string;
  summary: string;
  note?: string;
  tone: GuidedWorkflowTone;
  isActive: boolean;
  canNavigate: boolean;
};

type AssignmentRequirementState = {
  requiresScope: boolean;
  requiresReason: boolean;
  requiresReviewDate: boolean;
  requiresExpiryDate: boolean;
  requiresSensitiveConfirmation: boolean;
  unsupportedScopeTypes: AccessAssignmentScopeType[];
  missingScope: boolean;
  missingReason: boolean;
  missingReviewDate: boolean;
  missingExpiryDate: boolean;
  missingUnsupportedScope: boolean;
  canEnterPreview: boolean;
};

type AccessAssignmentReferenceLoaders = {
  loadAccessAssignmentLinkedUserOptions: (search: string) => Promise<ReferenceOption[]>;
  loadEventReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadOrgUnitReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadPlatformAccountReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadStudioResourceReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadTalentGroupReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
};

const guidedWorkflowToneMeta: Record<
  GuidedWorkflowTone,
  { icon: string; className: string; iconClassName: string }
> = {
  neutral: {
    icon: '...',
    className: 'border-border bg-bg text-muted',
    iconClassName: 'border-border bg-panel text-muted',
  },
  success: {
    icon: '✓',
    className: 'border-success/50 bg-success/10 text-text',
    iconClassName: 'border-success bg-success text-white',
  },
  warning: {
    icon: '!',
    className: 'border-warning/60 bg-warning/10 text-text',
    iconClassName: 'border-warning bg-warning text-text',
  },
  danger: {
    icon: '×',
    className: 'border-danger/50 bg-rose-50 text-text',
    iconClassName: 'border-danger bg-danger text-white',
  },
  info: {
    icon: '●',
    className: 'border-accent/40 bg-accent/10 text-text',
    iconClassName: 'border-accent bg-accent text-white',
  },
};

const DEFAULT_USER_SUGGESTION_LIMIT = 10;

const normalSelectableAssignability = new Set([
  'READY_ASSIGNABLE',
  'REQUIRES_SCOPE_SELECTION',
  'RESTRICTED_SENSITIVE',
  'READ_ONLY_AUDIT',
]);
const normalSelectableOperatorFlowGroups = new Set([
  'READY_TO_ASSIGN',
  'REQUIRES_SCOPE_SELECTION',
  'RESTRICTED_SENSITIVE',
  'READ_ONLY_AUDIT',
]);

const supportedScopeTypes = new Set<AccessAssignmentScopeType>([
  'self',
  'global',
  'managedTalentGroup',
  'managedOrgUnit',
  'assignedPlatformAccount',
  'financeGlobal',
  'financePeriod',
  'assignedEvent',
  'assignedStudioResource',
  'payrollPeriod',
]);

const scopeTypesWithoutTarget = new Set<AccessAssignmentScopeType>([
  'self',
  'global',
  'financeGlobal',
]);

const periodScopeTypes = new Set<AccessAssignmentScopeType>(['financePeriod', 'payrollPeriod']);

const assignmentPickerGroupOrder = [
  'REQUIRES_SCOPE_SELECTION',
  'READY_TO_ASSIGN',
  'READ_ONLY_AUDIT',
  'RESTRICTED_SENSITIVE',
] as const;

export const AccessAssignmentTab = (): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const {
    loadAccessAssignmentLinkedUserOptions,
  } = useReferenceRegistry<AccessAssignmentReferenceLoaders>();
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
  const [mode, setMode] = useState<AssignmentMode>('BUNDLE');
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
  const [selectedLifecycleAssignment, setSelectedLifecycleAssignment] =
    useState<AccessAssignmentLifecycleItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeResult, setRevokeResult] = useState<AccessAssignmentLifecycleResult | null>(null);
  const [activeStepId, setActiveStepId] = useState<AssignmentWorkflowStepId>('user');
  const [userPickerResetGeneration, setUserPickerResetGeneration] = useState(0);
  const [sensitiveConfirmationOpen, setSensitiveConfirmationOpen] = useState(false);

  const resetPreviewAndApplyState = useCallback(() => {
    setPreviewSignature(null);
    setPreviewRequestSignature(null);
    setAutoPreviewSignature(null);
    setApplyResult(null);
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
  const bundleTargets = useMemo(
    () =>
      targets.filter(
        (target) =>
          target.assignmentKind === 'BUNDLE' && isNormalSelectableAssignmentTarget(target),
      ),
    [targets],
  );
  const roleTemplateTargets = useMemo(
    () =>
      targets.filter(
        (target) =>
          target.assignmentKind === 'ROLE_TEMPLATE' && isNormalSelectableAssignmentTarget(target),
      ),
    [targets],
  );
  const restrictedTargets = useMemo(
    () =>
      targets.filter(
        (target) =>
          target.assignmentKind === mode &&
          target.legacyAssignable &&
          target.assignabilityStatus === 'RESTRICTED_SENSITIVE',
      ),
    [mode, targets],
  );
  const hiddenReadinessTargets = useMemo(
    () =>
      targets.filter(
        (target) =>
          target.legacyAssignable &&
          (target.assignabilityStatus === 'FUTURE_READY_CONDITION' ||
            target.assignabilityStatus === 'SYSTEM_CONTROLLED' ||
            target.operatorFlowGroup === 'FUTURE_READINESS' ||
            target.operatorFlowGroup === 'SYSTEM_CONTROLLED'),
      ),
    [targets],
  );
  const activeTargets = mode === 'BUNDLE' ? bundleTargets : roleTemplateTargets;
  const selectedTarget = activeTargets.find((target) => targetKey === toTargetKey(target));

  useEffect(() => {
    if (!selectedUserId) {
      if (targetKey) {
        setTargetKey('');
      }
      return;
    }
    const nextTargets = mode === 'BUNDLE' ? bundleTargets : roleTemplateTargets;
    if (targetKey && nextTargets.some((target) => toTargetKey(target) === targetKey)) {
      return;
    }
    const defaultTarget =
      nextTargets.find(isPreferredDefaultTarget) ??
      nextTargets.find(hasCompleteDefaultScopes) ??
      nextTargets[0];
    setTargetKey(defaultTarget ? toTargetKey(defaultTarget) : '');
  }, [bundleTargets, mode, roleTemplateTargets, selectedUserId, targetKey]);

  const requiredScopeTypes = useMemo(
    () => normalizeRequiredScopeTypes(selectedTarget?.requiredScopeTypes ?? []),
    [selectedTarget],
  );

  useEffect(() => {
    setScopeTargetIds({});
    setScopeTargetOptions({});
    setScopePeriodKeys({});
    resetPreviewAndApplyState();
  }, [resetPreviewAndApplyState, targetKey]);

  const unsupportedScopeTypes = requiredScopeTypes.filter(
    (scopeType) => !supportedScopeTypes.has(scopeType),
  );
  const requirementState = useMemo(
    () =>
      buildAssignmentRequirementState({
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
    () => buildStructuredScopeGrants(requiredScopeTypes, scopeTargetIds, scopePeriodKeys),
    [requiredScopeTypes, scopePeriodKeys, scopeTargetIds],
  );
  const targetUnavailable = Boolean(targetKey && !selectedTarget);
  const reasonValue = reason.trim();
  const currentPayload = useMemo(
    () =>
      selectedUserId &&
      selectedTarget &&
      requirementState.canEnterPreview
        ? buildPayload({
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
  const previewMatchesCurrent = Boolean(
    previewResult && previewSignature && previewSignature === currentSignature,
  );
  const previewHasBlockers = (previewResult?.blockers ?? []).length > 0;
  const canPreview = Boolean(
    currentPayload &&
    selectedUserId &&
    selectedTarget &&
    requirementState.canEnterPreview &&
    !previewMutation.isPending,
  );
  const canApply = Boolean(
    currentPayload &&
    previewMatchesCurrent &&
    previewResult?.canApply === true &&
    !previewHasBlockers &&
    reasonValue &&
    !applyMutation.isPending,
  );
  const userStepComplete = Boolean(selectedUserId && selectedUserOption && !selectedUserOption.disabled);
  const targetStepComplete = Boolean(selectedUserId && selectedTarget);
  const conditionsStepComplete = Boolean(
    targetStepComplete && requirementState.canEnterPreview,
  );
  const previewStepComplete = Boolean(
    previewMatchesCurrent && previewResult?.canApply === true && !previewHasBlockers,
  );
  const guidedSteps = useMemo<GuidedWorkflowStep[]>(() => buildGuidedWorkflowSteps({
    activeStepId,
    conditionsStepComplete,
    previewStepComplete,
    previewHasBlockers,
    previewMatchesCurrent,
    previewResult,
    requirementState,
    scopeTargetOptions,
    selectedTarget,
    selectedUserId,
    selectedUserOption,
    structuredScopeGrants,
    targetStepComplete,
    targetUnavailable,
    t,
    userStepComplete,
  }), [
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
    selectedUserOption,
    structuredScopeGrants,
    targetStepComplete,
    targetUnavailable,
    t,
    userStepComplete,
  ]);

  useEffect(() => {
    setPreviewSignature(null);
    setPreviewRequestSignature(null);
    setAutoPreviewSignature(null);
    setApplyResult(null);
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
      return loadAccessAssignmentLinkedUserOptions(normalizedSearch).then(
        (options) =>
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
      setPreviewRequestSignature((current) =>
        current === requestSignature ? null : current,
      );
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
    if (!currentPayload || !canApply) {
      return;
    }
    try {
      const result = await applyMutation.mutateAsync(currentPayload);
      setApplyResult(result);
      if (isApplySuccess(result)) {
        notifySuccess('role:accessAssignment.feedback.applied');
      }
    } catch (error) {
      notifyError(error as unknown as NormalizedApiError);
    }
  }, [applyMutation, canApply, currentPayload, notifyError, notifySuccess]);

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

  const goToStep = (stepId: AssignmentWorkflowStepId): void => {
    const step = guidedSteps.find((item) => item.id === stepId);
    if (step?.canNavigate) {
      setActiveStepId(stepId);
    }
  };

  const footerActions =
    activeStepId === 'user' ? (
      <button
        type="button"
        disabled={!userStepComplete}
        onClick={() => setActiveStepId('target')}
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t('role:accessAssignment.footer.continue')}
      </button>
    ) : activeStepId === 'target' ? (
      <>
        <button
          type="button"
          onClick={() => setActiveStepId('user')}
          className="rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text"
        >
          {t('role:accessAssignment.footer.back')}
        </button>
        <button
          type="button"
          disabled={!targetStepComplete}
          onClick={() => setActiveStepId('conditions')}
          className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('role:accessAssignment.footer.continue')}
        </button>
      </>
    ) : activeStepId === 'conditions' ? (
      <>
        <button
          type="button"
          onClick={() => setActiveStepId('target')}
          className="rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text"
        >
          {t('role:accessAssignment.footer.back')}
        </button>
        <button
          type="button"
          disabled={!conditionsStepComplete}
          onClick={() => setActiveStepId('preview')}
          className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('role:accessAssignment.footer.continueToPreview')}
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          onClick={() => setActiveStepId('conditions')}
          className="rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text"
        >
          {t('role:accessAssignment.footer.back')}
        </button>
        <button
          type="button"
          disabled={!canPreview}
          onClick={() => void runPreview()}
          className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('role:accessAssignment.previewButton')}
        </button>
        <button
          type="button"
          disabled={!canApply}
          onClick={() => {
            if (targetNeedsSensitiveConfirmation) {
              setSensitiveConfirmationOpen(true);
              return;
            }
            void runApply();
          }}
          className="rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text disabled:cursor-not-allowed disabled:opacity-60"
        >
          {applyMutation.isPending
            ? t('role:accessAssignment.applyPending')
            : t('role:accessAssignment.applyButton')}
        </button>
      </>
    );

  return (
    <div className="space-y-4">
      <GuidedWorkflowProgressCards
        steps={guidedSteps}
        activeStepId={activeStepId}
        onStepSelect={goToStep}
      />
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
                      key={toTargetKey(target)}
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
            <ScopeResolver
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
            <ConditionsGuardrailSummary
              requirementState={requirementState}
            />
            </MetadataSection>
          </div>
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
                message={readErrorMessage(t, previewMutation.error as unknown as NormalizedApiError)}
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

      {applyResult ? (
        <ApplySummary
          result={applyResult}
          reason={reasonValue}
          scopeTargetOptions={scopeTargetOptions}
        />
      ) : null}
      {sensitiveConfirmationOpen && selectedTarget ? (
        <SensitiveAssignmentConfirmDialog
          recipient={selectedUserOption?.label ?? selectedUserId ?? '-'}
          target={formatAccessTargetLabel(selectedTarget, t)}
          scope={formatScopeSummary(structuredScopeGrants, t, scopeTargetOptions)}
          reviewAt={reviewAt || '-'}
          isPending={applyMutation.isPending}
          onCancel={() => setSensitiveConfirmationOpen(false)}
          onConfirm={() => {
            setSensitiveConfirmationOpen(false);
            void runApply();
          }}
        />
      ) : null}
    </div>
  );
};

const ScopeResolver = ({
  requiredScopeTypes,
  unsupportedScopeTypes,
  scopeTargetIds,
  scopePeriodKeys,
  onTargetChange,
  onSelectedTargetChange,
  onPeriodChange,
}: {
  requiredScopeTypes: AccessAssignmentScopeType[];
  unsupportedScopeTypes: AccessAssignmentScopeType[];
  scopeTargetIds: Record<string, string | undefined>;
  scopePeriodKeys: Record<string, string | undefined>;
  onTargetChange: (scopeType: AccessAssignmentScopeType, value?: string) => void;
  onSelectedTargetChange: (
    scopeType: AccessAssignmentScopeType,
    option: ReferenceOption | undefined,
  ) => void;
  onPeriodChange: (scopeType: AccessAssignmentScopeType, value?: string) => void;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const {
    loadEventReferenceOptions,
    loadOrgUnitReferenceOptions,
    loadPlatformAccountReferenceOptions,
    loadStudioResourceReferenceOptions,
    loadTalentGroupReferenceOptions,
  } = useReferenceRegistry<AccessAssignmentReferenceLoaders>();
  const objectScopeLoaders = useMemo<
    Partial<Record<AccessAssignmentScopeType, (search: string) => Promise<ReferenceOption[]>>>
  >(
    () =>
      ({
        managedTalentGroup: loadTalentGroupReferenceOptions,
        managedOrgUnit: loadOrgUnitReferenceOptions,
        assignedPlatformAccount: loadPlatformAccountReferenceOptions,
        assignedEvent: loadEventReferenceOptions,
        assignedStudioResource: loadStudioResourceReferenceOptions,
      }),
    [
      loadEventReferenceOptions,
      loadOrgUnitReferenceOptions,
      loadPlatformAccountReferenceOptions,
      loadStudioResourceReferenceOptions,
      loadTalentGroupReferenceOptions,
    ],
  );
  const scopeLoadOptionsByType = useMemo(
    () =>
      Object.fromEntries(
        requiredScopeTypes.map((scopeType) => [
          scopeType,
          buildAssignmentReferenceLoader(objectScopeLoaders[scopeType] ?? emptyAssignmentOptions),
        ]),
      ) as Partial<
        Record<AccessAssignmentScopeType, (search: string) => Promise<ReferenceOption[]>>
      >,
    [objectScopeLoaders, requiredScopeTypes],
  );
  const scopeSelectedOptionHandlersByType = useMemo(
    () =>
      Object.fromEntries(
        requiredScopeTypes.map((scopeType) => [
          scopeType,
          (option: ReferenceOption | undefined) => onSelectedTargetChange(scopeType, option),
        ]),
      ) as Partial<Record<AccessAssignmentScopeType, (option?: ReferenceOption) => void>>,
    [onSelectedTargetChange, requiredScopeTypes],
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text">{t('accessAssignment.scopeTitle')}</p>
        <p className="mt-1 text-xs text-muted">{t('accessAssignment.scopeSubtitle')}</p>
      </div>
      {requiredScopeTypes.length === 0 ? (
        <EmptyState
          variant="inline"
          title={t('accessAssignment.noScopeTitle')}
          message={t('accessAssignment.noScopeMessage')}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {requiredScopeTypes.map((scopeType) => (
            <div key={scopeType} className="rounded border border-border bg-bg p-3">
              <p className="text-sm font-semibold text-text">{formatScopeTypeLabel(scopeType, t)}</p>
              {unsupportedScopeTypes.includes(scopeType) ? (
                <p className="mt-2 text-sm text-danger">{t('accessAssignment.scopeUnavailable')}</p>
              ) : scopeTypesWithoutTarget.has(scopeType) ? (
                <p className="mt-2 text-sm text-muted">{formatScopeReadOnlyHelp(scopeType, t)}</p>
              ) : periodScopeTypes.has(scopeType) ? (
                <label className="mt-2 block">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('accessAssignment.periodLabel')}
                  </span>
                  <input
                    type="month"
                    value={scopePeriodKeys[scopeType] ?? ''}
                    onChange={(event) => onPeriodChange(scopeType, event.target.value)}
                    className="mt-1 w-full rounded border border-border bg-panel px-2 py-2 text-sm"
                  />
                </label>
              ) : (
                <AsyncReferencePicker
                  pickerId={`role-access-assignment-scope-${scopeType}`}
                  value={scopeTargetIds[scopeType]}
                  onChange={(value) => onTargetChange(scopeType, value)}
                  onSelectedOptionChange={scopeSelectedOptionHandlersByType[scopeType]}
                  loadOptions={scopeLoadOptionsByType[scopeType] ?? emptyAssignmentOptions}
                  placeholder={t('accessAssignment.scopeSearchPlaceholder')}
                  resourceLabel={formatScopeTypeLabel(scopeType, t)}
                  showTechnicalMetadata={false}
                  emptySlot={
                    <p className="text-xs text-muted">{t('accessAssignment.scopeNoResults')}</p>
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const GuidedWorkflowProgressCards = ({
  steps,
  activeStepId,
  onStepSelect,
}: {
  steps: GuidedWorkflowStep[];
  activeStepId: AssignmentWorkflowStepId;
  onStepSelect: (stepId: AssignmentWorkflowStepId) => void;
}): JSX.Element => {
  const { t } = useTranslation('role');

  return (
  <nav
    className="rounded border border-border bg-panel p-3"
    aria-label={t('accessAssignment.workflow.ariaLabel')}
    data-testid="role-assignment-progress-cards"
  >
    <ol className="grid items-stretch gap-2 md:grid-cols-[repeat(4,minmax(0,1fr))]">
      {steps.map((step) => {
        const isActive = step.isActive || activeStepId === step.id;
        const testId =
          step.id === 'conditions'
            ? 'role-assignment-progress-card-condition'
            : `role-assignment-progress-card-${step.id}`;
        const toneLabel = t(`accessAssignment.workflowTone.${step.tone}`);
        const activeLabel = isActive ? t('accessAssignment.workflow.active') : undefined;

        return (
        <li key={step.id} className="flex min-w-0">
          <button
            type="button"
            disabled={!step.canNavigate}
            aria-current={isActive ? 'step' : undefined}
            aria-label={`${step.number}. ${step.title}: ${step.summary}. ${
              [toneLabel, activeLabel].filter(Boolean).join('. ')
            }`}
            title={[toneLabel, activeLabel].filter(Boolean).join(' - ')}
            data-testid={testId}
            data-status-tone={step.tone}
            data-active={isActive ? 'true' : 'false'}
            onClick={() => onStepSelect(step.id)}
            className={`flex min-h-36 w-full flex-col rounded border px-3 py-3 text-left text-sm transition hover:border-accent/60 disabled:cursor-not-allowed disabled:hover:border-border ${
              guidedWorkflowToneMeta[step.tone].className
            } ${isActive ? 'outline outline-2 outline-offset-0 outline-accent/60 ring-2 ring-accent/20' : ''}`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase text-muted">
                  {t('accessAssignment.workflow.stepNumber', { number: step.number })}
                </span>
                <span className="mt-1 block line-clamp-2 min-h-10 font-semibold text-text">
                  {step.title}
                </span>
              </span>
              <span
                aria-hidden="true"
                data-testid={`${testId}-marker`}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold leading-none ${
                  guidedWorkflowToneMeta[step.tone].iconClassName
                }`}
              >
                {guidedWorkflowToneMeta[step.tone].icon}
              </span>
              <span className="sr-only">{toneLabel}</span>
              {activeLabel ? <span className="sr-only">{activeLabel}</span> : null}
            </span>
            <span className="mt-2 block min-h-10 line-clamp-2 text-sm text-text">
              {step.summary}
            </span>
            {step.note ? (
              <span className="mt-1 block min-h-8 line-clamp-2 text-xs text-muted">
                {step.note}
              </span>
            ) : null}
          </button>
        </li>
        );
      })}
    </ol>
  </nav>
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
      (assignment.reviewAt === null || assignment.reviewAt === undefined || assignment.reviewAt === ''),
  );

  return (
    <aside
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
  requirementState: AssignmentRequirementState;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const blockers = [
    requirementState.missingScope ? t('accessAssignment.guardrail.missingScope') : null,
    requirementState.missingReason ? t('accessAssignment.guardrail.missingReason') : null,
    requirementState.missingReviewDate ? t('accessAssignment.guardrail.missingReviewDate') : null,
    requirementState.missingExpiryDate ? t('accessAssignment.guardrail.missingExpiryDate') : null,
    requirementState.missingUnsupportedScope
      ? t('accessAssignment.guardrail.unsupportedScope')
      : null,
  ].filter((message): message is string => Boolean(message));

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

const SensitiveAssignmentConfirmDialog = ({
  recipient,
  target,
  scope,
  reviewAt,
  isPending,
  onCancel,
  onConfirm,
}: {
  recipient: string;
  target: string;
  scope: string;
  reviewAt: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element => {
  const { t } = useTranslation('role');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sensitive-assignment-confirm-title"
        className="w-full max-w-lg rounded border border-warning/60 bg-panel p-5 shadow-shell"
      >
        <h3 id="sensitive-assignment-confirm-title" className="text-base font-semibold text-text">
          {t('accessAssignment.sensitiveConfirm.title')}
        </h3>
        <p className="mt-2 text-sm text-muted">
          {t('accessAssignment.sensitiveConfirm.message')}
        </p>
        <ReadOnlyFieldGrid
          columns={1}
          fields={[
            {
              key: 'recipient',
              label: t('accessAssignment.sensitiveConfirm.recipient'),
              value: recipient,
            },
            {
              key: 'target',
              label: t('accessAssignment.sensitiveConfirm.target'),
              value: target,
            },
            {
              key: 'scope',
              label: t('accessAssignment.sensitiveConfirm.scope'),
              value: scope,
            },
            { key: 'reviewAt', label: t('accessAssignment.reviewAtLabel'), value: reviewAt },
          ]}
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text"
          >
            {t('accessAssignment.sensitiveConfirm.cancel')}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="rounded border border-warning bg-warning px-3 py-2 text-sm font-medium text-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? t('accessAssignment.sensitiveConfirm.pending')
              : t('accessAssignment.sensitiveConfirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

const GuidedWorkflowActivePanel = ({
  activeStepId,
  children,
}: {
  activeStepId: AssignmentWorkflowStepId;
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
  mode: AssignmentMode;
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
                <option key={toTargetKey(target)} value={toTargetKey(target)}>
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
                const key = toTargetKey(target);
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
                        <p className="font-semibold text-text">{formatAccessTargetLabel(target, t)}</p>
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
}: {
  result: AccessAssignmentApplyResult;
  reason: string;
  scopeTargetOptions: Record<string, ReferenceOption | undefined>;
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
    <details className="rounded border border-border bg-bg p-3">
      <summary className="cursor-pointer text-sm font-semibold text-text">{title}</summary>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {records.map((record, index) => (
          <li key={`${title}-${index}`}>{formatTraceRecord(record, t)}</li>
        ))}
      </ul>
    </details>
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
  requirementState: AssignmentRequirementState;
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

function buildAssignmentRequirementState(args: {
  selectedTarget: AccessAssignmentTargetOption | undefined;
  requiredScopeTypes: AccessAssignmentScopeType[];
  scopeTargetIds: Record<string, string | undefined>;
  scopePeriodKeys: Record<string, string | undefined>;
  reason: string;
  reviewAt: string;
  expiresAt: string;
  unsupportedScopeTypes: AccessAssignmentScopeType[];
}): AssignmentRequirementState {
  const requiresScope = args.requiredScopeTypes.length > 0;
  const requiresReason = true;
  const requiresReviewDate = Boolean(
    args.selectedTarget &&
      requiresAssignmentReviewDate(args.selectedTarget, args.requiredScopeTypes),
  );
  const requiresExpiryDate = Boolean(
    args.selectedTarget && requiresAssignmentExpiryDate(args.selectedTarget),
  );
  const requiresSensitiveConfirmation = Boolean(
    args.selectedTarget && isSensitiveOrControlledAssignmentTarget(args.selectedTarget),
  );
  const missingScope = args.requiredScopeTypes.some(
    (scopeType) => !isScopeComplete(scopeType, args.scopeTargetIds, args.scopePeriodKeys),
  );
  const missingReason = args.reason.trim().length === 0;
  const missingReviewDate = requiresReviewDate && !args.reviewAt;
  const missingExpiryDate = requiresExpiryDate && !args.expiresAt;
  const missingUnsupportedScope = args.unsupportedScopeTypes.length > 0;

  return {
    requiresScope,
    requiresReason,
    requiresReviewDate,
    requiresExpiryDate,
    requiresSensitiveConfirmation,
    unsupportedScopeTypes: args.unsupportedScopeTypes,
    missingScope,
    missingReason,
    missingReviewDate,
    missingExpiryDate,
    missingUnsupportedScope,
    canEnterPreview: Boolean(
      args.selectedTarget &&
        !missingScope &&
        !missingReason &&
        !missingReviewDate &&
        !missingExpiryDate &&
        !missingUnsupportedScope,
    ),
  };
}

function getUserStepTone(input: {
  selectedUserId: string | undefined;
  selectedUserOption: ReferenceOption | undefined;
  userStepComplete: boolean;
}): GuidedWorkflowTone {
  if (input.selectedUserId && (!input.selectedUserOption || input.selectedUserOption.disabled)) {
    return 'danger';
  }
  return input.userStepComplete ? 'success' : 'neutral';
}

function getTargetStepTone(input: {
  selectedTarget: AccessAssignmentTargetOption | undefined;
  targetUnavailable: boolean;
  targetNeedsSensitiveConfirmation: boolean;
}): GuidedWorkflowTone {
  if (input.targetUnavailable) {
    return 'danger';
  }
  if (!input.selectedTarget) {
    return 'neutral';
  }
  return input.targetNeedsSensitiveConfirmation ? 'warning' : 'success';
}

function getConditionStepTone(input: {
  selectedTarget: AccessAssignmentTargetOption | undefined;
  conditionsStepComplete: boolean;
  requirementState: AssignmentRequirementState;
}): GuidedWorkflowTone {
  if (!input.selectedTarget) {
    return 'neutral';
  }
  if (input.conditionsStepComplete) {
    return 'success';
  }
  return input.requirementState.canEnterPreview ? 'info' : 'danger';
}

function getPreviewStepTone(input: {
  conditionsStepComplete: boolean;
  previewResult: AccessAssignmentPreviewResult | undefined;
  previewMatchesCurrent: boolean;
  previewHasBlockers: boolean;
  previewStepComplete: boolean;
  targetNeedsSensitiveConfirmation: boolean;
}): GuidedWorkflowTone {
  if (!input.conditionsStepComplete) {
    return 'neutral';
  }
  if (input.previewResult && input.previewMatchesCurrent && input.previewHasBlockers) {
    return 'danger';
  }
  if (input.previewStepComplete) {
    return input.targetNeedsSensitiveConfirmation ? 'warning' : 'success';
  }
  return 'info';
}

function buildGuidedWorkflowSteps(input: {
  activeStepId: AssignmentWorkflowStepId;
  conditionsStepComplete: boolean;
  previewStepComplete: boolean;
  previewHasBlockers: boolean;
  previewMatchesCurrent: boolean;
  previewResult: AccessAssignmentPreviewResult | undefined;
  requirementState: AssignmentRequirementState;
  scopeTargetOptions: Record<string, ReferenceOption | undefined>;
  selectedTarget: AccessAssignmentTargetOption | undefined;
  selectedUserId: string | undefined;
  selectedUserOption: ReferenceOption | undefined;
  structuredScopeGrants: AccessAssignmentScopeGrant[];
  targetStepComplete: boolean;
  targetUnavailable: boolean;
  t: TranslationFn;
  userStepComplete: boolean;
}): GuidedWorkflowStep[] {
  const targetNeedsSensitiveConfirmation = input.requirementState.requiresSensitiveConfirmation;
  return [
    {
      id: 'user',
      number: 1,
      title: input.t('accessAssignment.workflow.user.title'),
      summary:
        input.selectedUserOption?.label ?? input.t('accessAssignment.workflow.user.emptySummary'),
      note:
        input.selectedUserId && (!input.selectedUserOption || input.selectedUserOption.disabled)
          ? input.t('accessAssignment.workflow.user.invalidNote')
          : undefined,
      tone: getUserStepTone(input),
      isActive: input.activeStepId === 'user',
      canNavigate: input.activeStepId === 'user' || input.userStepComplete,
    },
    {
      id: 'target',
      number: 2,
      title: input.t('accessAssignment.workflow.target.title'),
      summary: input.selectedTarget
        ? formatAccessTargetLabel(input.selectedTarget, input.t)
        : input.t('accessAssignment.workflow.target.emptySummary'),
      note: input.targetUnavailable
        ? input.t('accessAssignment.workflow.target.unavailableNote')
        : targetNeedsSensitiveConfirmation
          ? input.t('accessAssignment.workflow.target.sensitiveNote')
          : undefined,
      tone: getTargetStepTone({
        selectedTarget: input.selectedTarget,
        targetUnavailable: input.targetUnavailable,
        targetNeedsSensitiveConfirmation,
      }),
      isActive: input.activeStepId === 'target',
      canNavigate: input.activeStepId === 'target' || input.targetStepComplete,
    },
    {
      id: 'conditions',
      number: 3,
      title: input.t('accessAssignment.workflow.conditions.title'),
      summary: input.conditionsStepComplete
        ? formatScopeSummary(input.structuredScopeGrants, input.t, input.scopeTargetOptions)
        : input.t('accessAssignment.workflow.conditions.incompleteSummary'),
      note: buildConditionsProgressNote(input.requirementState, input.t),
      tone: getConditionStepTone({
        selectedTarget: input.selectedTarget,
        conditionsStepComplete: input.conditionsStepComplete,
        requirementState: input.requirementState,
      }),
      isActive: input.activeStepId === 'conditions',
      canNavigate: input.activeStepId === 'conditions' || input.conditionsStepComplete,
    },
    {
      id: 'preview',
      number: 4,
      title: input.t('accessAssignment.workflow.preview.title'),
      summary: input.previewStepComplete
        ? input.t('accessAssignment.workflow.preview.readySummary')
        : input.t('accessAssignment.workflow.preview.emptySummary'),
      note:
        targetNeedsSensitiveConfirmation && input.previewStepComplete
          ? input.t('accessAssignment.workflow.preview.sensitiveNote')
          : undefined,
      tone: getPreviewStepTone({
        conditionsStepComplete: input.conditionsStepComplete,
        previewResult: input.previewResult,
        previewMatchesCurrent: input.previewMatchesCurrent,
        previewHasBlockers: input.previewHasBlockers,
        previewStepComplete: input.previewStepComplete,
        targetNeedsSensitiveConfirmation,
      }),
      isActive: input.activeStepId === 'preview',
      canNavigate: input.activeStepId === 'preview' || input.previewStepComplete,
    },
  ];
}

function normalizeRequiredScopeTypes(values: readonly string[]): AccessAssignmentScopeType[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value): value is AccessAssignmentScopeType => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

function isSensitiveOrControlledAssignmentTarget(target: AccessAssignmentTargetOption): boolean {
  const risk = readTargetAccessRisk(target);
  return (
    target.assignabilityStatus === 'RESTRICTED_SENSITIVE' ||
    target.operatorFlowGroup === 'RESTRICTED_SENSITIVE' ||
    target.reviewPolicy === 'REVIEW_REQUIRED' ||
    target.sensitivityLevel === 'SENSITIVE' ||
    target.sensitivityLevel === 'HIGH_RISK' ||
    target.sensitiveLevel === 'SENSITIVE' ||
    target.sensitiveLevel === 'HIGH_RISK' ||
    readBooleanTargetValue(target, 'isSensitive') ||
    readBooleanTargetValue(target, 'isHighRisk') ||
    risk.requiresReview === true ||
    risk.isSensitive === true ||
    risk.isHighRisk === true
  );
}

function requiresAssignmentReviewDate(
  target: AccessAssignmentTargetOption,
  requiredScopeTypes: readonly AccessAssignmentScopeType[],
): boolean {
  const risk = readTargetAccessRisk(target);
  return (
    isSensitiveOrControlledAssignmentTarget(target) ||
    target.requiresResponsibility ||
    hasRequiredResponsibilityType(target.requiredResponsibilityType) ||
    readBooleanTargetValue(target, 'requiresReview') ||
    risk.requiresReview === true ||
    requiredScopeTypes.some((scopeType) =>
      ['global', 'financeGlobal', 'financePeriod', 'payrollPeriod'].includes(scopeType),
    ) ||
    /OWNER|ACCESS|FINANCE|REVENUE|COMMISSION/u.test(target.code)
  );
}

function requiresAssignmentExpiryDate(target: AccessAssignmentTargetOption): boolean {
  const risk = readTargetAccessRisk(target);
  return (
    risk.requiresExpiry === true ||
    readBooleanTargetValue(target, 'isBreakGlassLike') ||
    target.code === 'OWNER_ADMIN' ||
    target.code === 'OWNER_ADMIN_BUNDLE'
  );
}

function readTargetAccessRisk(target: AccessAssignmentTargetOption): Partial<{
  isSensitive: boolean;
  isHighRisk: boolean;
  requiresReview: boolean;
  requiresExpiry: boolean;
}> {
  const risk = (target as { accessRisk?: Record<string, unknown> | null }).accessRisk;
  return risk && typeof risk === 'object' ? (risk as Record<string, boolean>) : {};
}

function readBooleanTargetValue(
  target: AccessAssignmentTargetOption,
  key: string,
): boolean {
  return (target as Record<string, unknown>)[key] === true;
}

function hasRequiredResponsibilityType(value: string | string[] | null | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
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

function buildConditionsProgressNote(
  input: AssignmentRequirementState,
  t: TranslationFn,
): string | undefined {
  if (input.missingUnsupportedScope) {
    return t('accessAssignment.workflow.conditions.unsupportedNote');
  }
  if (input.missingScope) {
    return t('accessAssignment.workflow.conditions.missingScopeNote');
  }
  if (input.missingReason) {
    return t('accessAssignment.workflow.conditions.missingReasonNote');
  }
  if (input.missingReviewDate) {
    return t('accessAssignment.workflow.conditions.missingReviewDateNote');
  }
  if (input.missingExpiryDate) {
    return t('accessAssignment.workflow.conditions.missingExpiryDateNote');
  }
  return undefined;
}

function buildStructuredScopeGrants(
  scopeTypes: readonly AccessAssignmentScopeType[],
  targetIds: Record<string, string | undefined>,
  periodKeys: Record<string, string | undefined>,
): AccessAssignmentScopeGrant[] {
  return scopeTypes.flatMap((scopeType) => {
    if (!supportedScopeTypes.has(scopeType)) {
      return [];
    }
    if (scopeTypesWithoutTarget.has(scopeType)) {
      return [{ scopeType }];
    }
    if (periodScopeTypes.has(scopeType)) {
      const periodKey = periodKeys[scopeType];
      return periodKey ? [{ scopeType, periodKey }] : [];
    }
    const targetId = targetIds[scopeType];
    return targetId ? [{ scopeType, targetId }] : [];
  });
}

function isScopeComplete(
  scopeType: AccessAssignmentScopeType,
  targetIds: Record<string, string | undefined>,
  periodKeys: Record<string, string | undefined>,
): boolean {
  if (!supportedScopeTypes.has(scopeType)) {
    return false;
  }
  if (scopeTypesWithoutTarget.has(scopeType)) {
    return true;
  }
  if (periodScopeTypes.has(scopeType)) {
    return Boolean(periodKeys[scopeType]);
  }
  return Boolean(targetIds[scopeType]);
}

function buildPayload(input: {
  selectedUserId: string;
  selectedTarget: AccessAssignmentTargetOption;
  structuredScopeGrants: AccessAssignmentScopeGrant[];
  reason: string;
  reviewAt?: string;
  expiresAt?: string;
}): AccessAssignmentRequestPayload {
  const payload: AccessAssignmentRequestPayload = {
    targetUserId: input.selectedUserId,
    assignmentTargetType: input.selectedTarget.assignmentKind,
    structuredScopeGrants: input.structuredScopeGrants,
    reason: input.reason,
    reviewAt: input.reviewAt || undefined,
    expiresAt: input.expiresAt || undefined,
  };

  if (input.selectedTarget.assignmentKind === 'ROLE') {
    if (input.selectedTarget.id) {
      payload.assignmentTargetId = input.selectedTarget.id;
    }
    payload.assignmentTargetCode = input.selectedTarget.code;
  } else {
    payload.assignmentTargetCode = input.selectedTarget.code;
  }
  if (input.selectedTarget.assignmentKind === 'BUNDLE' && input.selectedTarget.version) {
    payload.bundleVersion = input.selectedTarget.version;
  }
  return payload;
}

function toTargetKey(target: AccessAssignmentTargetOption): string {
  return `${target.assignmentKind}:${target.code}:${target.version ?? target.id ?? ''}`;
}

function isNormalSelectableAssignmentTarget(target: AccessAssignmentTargetOption): boolean {
  return (
    target.legacyAssignable &&
    target.assignabilityStatus !== undefined &&
    target.operatorFlowGroup !== undefined &&
    normalSelectableAssignability.has(target.assignabilityStatus) &&
    normalSelectableOperatorFlowGroups.has(target.operatorFlowGroup)
  );
}

function hasCompleteDefaultScopes(target: AccessAssignmentTargetOption): boolean {
  const requiredScopes = normalizeRequiredScopeTypes(target.requiredScopeTypes ?? []);
  return requiredScopes.every((scopeType) => isScopeComplete(scopeType, {}, {}));
}

function isPreferredDefaultTarget(target: AccessAssignmentTargetOption): boolean {
  if (target.code === 'STAFF_CONSOLE_BUNDLE' || target.code === 'STAFF_CONSOLE_USER') {
    return true;
  }

  const requiredScopes = normalizeRequiredScopeTypes(target.requiredScopeTypes ?? []);
  return requiredScopes.length > 0 && requiredScopes.every((scopeType) => scopeType === 'self');
}

function isApplySuccess(result: AccessAssignmentApplyResult | null | undefined): boolean {
  if (!result) {
    return false;
  }
  const blockers = result.blockers ?? [];
  return result.applied === true && result.applyStatus === 'APPLIED' && blockers.length === 0;
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
  return label ?? sanitizeInternalAccessLabel(
    target.name,
    t('accessAssignment.displayLabels.unknownAccess'),
    t,
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
  const scopes = normalizeRequiredScopeTypes(target.requiredScopeTypes ?? []);
  if (scopes.length === 0) {
    return t('accessAssignment.targetPicker.noSeparateScope');
  }
  return scopes.map((scopeType) => formatScopeTypeLabel(scopeType, t)).join(', ');
}

function formatTargetAvailability(
  target: AccessAssignmentTargetOption,
  t: TranslationFn,
): string {
  return t(`accessAssignment.targetAvailability.${target.assignabilityStatus}`, {
    defaultValue: t('accessAssignment.targetAvailability.SYSTEM_CONTROLLED'),
  });
}

function formatTargetBusinessGroup(
  target: AccessAssignmentTargetOption,
  t: TranslationFn,
): string {
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

function formatScopeReadOnlyHelp(scopeType: AccessAssignmentScopeType, t: TranslationFn): string {
  return scopeType === 'self'
    ? t('accessAssignment.scopeReadOnlyHelp.self')
    : t('accessAssignment.scopeReadOnlyHelp.default');
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

function emptyAssignmentOptions(): Promise<ReferenceOption[]> {
  return Promise.resolve([]);
}

function buildAssignmentReferenceLoader(
  loader: (search: string) => Promise<ReferenceOption[]>,
): (search: string) => Promise<ReferenceOption[]> {
  return (search: string) => loader(search).then(sanitizeAssignmentReferenceOptions);
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

function formatTimestamp(
  value: number | string | null | undefined,
  t: TranslationFn,
): string {
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
