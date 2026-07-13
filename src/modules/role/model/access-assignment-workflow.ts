import type {
  AccessAssignmentIssue,
  AccessAssignmentPreviewResult,
  AccessAssignmentRequestPayload,
} from '@modules/role/types/role.types';

import type { AccessAssignmentRequirementState } from './access-assignment-requirements';

export type AccessAssignmentWorkflowStepId = 'user' | 'target' | 'conditions' | 'preview';
export type AccessAssignmentWorkflowTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type AccessAssignmentWorkflowStep = {
  id: AccessAssignmentWorkflowStepId;
  number: number;
  title: string;
  summary: string;
  note?: string;
  tone: AccessAssignmentWorkflowTone;
  isActive: boolean;
  canNavigate: boolean;
};

export type AccessAssignmentIssueState = {
  blockers: AccessAssignmentIssue[];
  warnings: AccessAssignmentIssue[];
  hasBlockers: boolean;
};

export const deriveAccessAssignmentIssueState = (
  result: Pick<AccessAssignmentPreviewResult, 'blockers' | 'warnings'> | undefined,
): AccessAssignmentIssueState => {
  const blockers = result?.blockers ?? [];
  return {
    blockers,
    warnings: result?.warnings ?? [],
    hasBlockers: blockers.length > 0,
  };
};

export const deriveAccessAssignmentReadiness = (input: {
  currentPayload: AccessAssignmentRequestPayload | null;
  hasSelectedUser: boolean;
  userStepComplete: boolean;
  hasSelectedTarget: boolean;
  requirementState: AccessAssignmentRequirementState;
  previewResult: AccessAssignmentPreviewResult | undefined;
  previewSignature: string | null;
  currentSignature: string;
  isPreviewPending: boolean;
  isApplyPending: boolean;
  reason: string;
}): {
  previewMatchesCurrent: boolean;
  issues: AccessAssignmentIssueState;
  canPreview: boolean;
  canApply: boolean;
  userStepComplete: boolean;
  targetStepComplete: boolean;
  conditionsStepComplete: boolean;
  previewStepComplete: boolean;
} => {
  const previewMatchesCurrent = Boolean(
    input.previewResult &&
    input.previewSignature &&
    input.previewSignature === input.currentSignature,
  );
  const issues = deriveAccessAssignmentIssueState(input.previewResult);
  const targetStepComplete = Boolean(input.hasSelectedUser && input.hasSelectedTarget);
  const conditionsStepComplete = Boolean(
    targetStepComplete && input.requirementState.canEnterPreview,
  );
  const previewStepComplete = Boolean(
    previewMatchesCurrent && input.previewResult?.canApply === true && !issues.hasBlockers,
  );

  return {
    previewMatchesCurrent,
    issues,
    canPreview: Boolean(
      input.currentPayload &&
      input.hasSelectedUser &&
      input.hasSelectedTarget &&
      input.requirementState.canEnterPreview &&
      !input.isPreviewPending,
    ),
    canApply: Boolean(
      input.currentPayload &&
      previewMatchesCurrent &&
      input.previewResult?.canApply === true &&
      !issues.hasBlockers &&
      input.reason &&
      !input.isApplyPending,
    ),
    userStepComplete: input.userStepComplete,
    targetStepComplete,
    conditionsStepComplete,
    previewStepComplete,
  };
};

export const buildAccessAssignmentWorkflowSteps = (input: {
  activeStepId: AccessAssignmentWorkflowStepId;
  user: { id: string | undefined; label: string | undefined; disabled: boolean };
  target: {
    selected: boolean;
    complete: boolean;
    summary: string;
    unavailable: boolean;
    requiresSensitiveConfirmation: boolean;
  };
  conditions: { complete: boolean; summary: string; note?: string };
  preview: {
    result: AccessAssignmentPreviewResult | undefined;
    matchesCurrent: boolean;
    hasBlockers: boolean;
    complete: boolean;
  };
  labels: {
    userTitle: string;
    userEmptySummary: string;
    userInvalidNote: string;
    targetTitle: string;
    targetEmptySummary: string;
    targetUnavailableNote: string;
    targetSensitiveNote: string;
    conditionsTitle: string;
    conditionsIncompleteSummary: string;
    previewTitle: string;
    previewReadySummary: string;
    previewEmptySummary: string;
    previewSensitiveNote: string;
  };
}): AccessAssignmentWorkflowStep[] => {
  const userComplete = Boolean(input.user.id && input.user.label && !input.user.disabled);
  const targetTone = input.target.unavailable
    ? 'danger'
    : !input.target.selected
      ? 'neutral'
      : input.target.requiresSensitiveConfirmation
        ? 'warning'
        : 'success';
  const conditionTone = !input.target.selected
    ? 'neutral'
    : input.conditions.complete
      ? 'success'
      : 'danger';
  const previewTone = !input.conditions.complete
    ? 'neutral'
    : input.preview.result && input.preview.matchesCurrent && input.preview.hasBlockers
      ? 'danger'
      : input.preview.complete
        ? input.target.requiresSensitiveConfirmation
          ? 'warning'
          : 'success'
        : 'info';

  return [
    {
      id: 'user',
      number: 1,
      title: input.labels.userTitle,
      summary: input.user.label ?? input.labels.userEmptySummary,
      note:
        input.user.id && (!input.user.label || input.user.disabled)
          ? input.labels.userInvalidNote
          : undefined,
      tone:
        input.user.id && (!input.user.label || input.user.disabled)
          ? 'danger'
          : userComplete
            ? 'success'
            : 'neutral',
      isActive: input.activeStepId === 'user',
      canNavigate: input.activeStepId === 'user' || userComplete,
    },
    {
      id: 'target',
      number: 2,
      title: input.labels.targetTitle,
      summary: input.target.selected ? input.target.summary : input.labels.targetEmptySummary,
      note: input.target.unavailable
        ? input.labels.targetUnavailableNote
        : input.target.requiresSensitiveConfirmation
          ? input.labels.targetSensitiveNote
          : undefined,
      tone: targetTone,
      isActive: input.activeStepId === 'target',
      canNavigate: input.activeStepId === 'target' || input.target.complete,
    },
    {
      id: 'conditions',
      number: 3,
      title: input.labels.conditionsTitle,
      summary: input.conditions.complete
        ? input.conditions.summary
        : input.labels.conditionsIncompleteSummary,
      note: input.conditions.note,
      tone: conditionTone,
      isActive: input.activeStepId === 'conditions',
      canNavigate: input.activeStepId === 'conditions' || input.conditions.complete,
    },
    {
      id: 'preview',
      number: 4,
      title: input.labels.previewTitle,
      summary: input.preview.complete
        ? input.labels.previewReadySummary
        : input.labels.previewEmptySummary,
      note:
        input.target.requiresSensitiveConfirmation && input.preview.complete
          ? input.labels.previewSensitiveNote
          : undefined,
      tone: previewTone,
      isActive: input.activeStepId === 'preview',
      canNavigate: input.activeStepId === 'preview' || input.preview.complete,
    },
  ];
};
