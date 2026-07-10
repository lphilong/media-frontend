import type { AccessAssignmentTargetOption } from '@modules/role/types/role.types';

import {
  isAccessAssignmentScopeComplete,
  normalizeAccessAssignmentRequiredScopeTypes,
} from './access-assignment-requirements';

export type AccessAssignmentMode = 'BUNDLE' | 'ROLE_TEMPLATE';

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

export const toAccessAssignmentTargetKey = (target: AccessAssignmentTargetOption): string =>
  `${target.assignmentKind}:${target.code}:${target.version ?? target.id ?? ''}`;

export const isNormalSelectableAccessAssignmentTarget = (
  target: AccessAssignmentTargetOption,
): boolean =>
  target.legacyAssignable &&
  target.assignabilityStatus !== undefined &&
  target.operatorFlowGroup !== undefined &&
  normalSelectableAssignability.has(target.assignabilityStatus) &&
  normalSelectableOperatorFlowGroups.has(target.operatorFlowGroup);

export const selectAccessAssignmentTargets = (
  targets: readonly AccessAssignmentTargetOption[],
  mode: AccessAssignmentMode,
): AccessAssignmentTargetOption[] =>
  targets.filter(
    (target) =>
      target.assignmentKind === mode && isNormalSelectableAccessAssignmentTarget(target),
  );

export const selectRestrictedAccessAssignmentTargets = (
  targets: readonly AccessAssignmentTargetOption[],
  mode: AccessAssignmentMode,
): AccessAssignmentTargetOption[] =>
  targets.filter(
    (target) =>
      target.assignmentKind === mode &&
      target.legacyAssignable &&
      target.assignabilityStatus === 'RESTRICTED_SENSITIVE',
  );

export const selectHiddenReadinessAccessAssignmentTargets = (
  targets: readonly AccessAssignmentTargetOption[],
): AccessAssignmentTargetOption[] =>
  targets.filter(
    (target) =>
      target.legacyAssignable &&
      (target.assignabilityStatus === 'FUTURE_READY_CONDITION' ||
        target.assignabilityStatus === 'SYSTEM_CONTROLLED' ||
        target.operatorFlowGroup === 'FUTURE_READINESS' ||
        target.operatorFlowGroup === 'SYSTEM_CONTROLLED'),
  );

export const selectDefaultAccessAssignmentTarget = (
  targets: readonly AccessAssignmentTargetOption[],
): AccessAssignmentTargetOption | undefined =>
  targets.find(isPreferredDefaultAccessAssignmentTarget) ??
  targets.find(hasCompleteDefaultScopes) ??
  targets[0];

const isPreferredDefaultAccessAssignmentTarget = (target: AccessAssignmentTargetOption): boolean => {
  if (target.code === 'STAFF_CONSOLE_BUNDLE' || target.code === 'STAFF_CONSOLE_USER') {
    return true;
  }

  const requiredScopes = normalizeAccessAssignmentRequiredScopeTypes(target.requiredScopeTypes ?? []);
  return requiredScopes.length > 0 && requiredScopes.every((scopeType) => scopeType === 'self');
};

const hasCompleteDefaultScopes = (target: AccessAssignmentTargetOption): boolean => {
  const requiredScopes = normalizeAccessAssignmentRequiredScopeTypes(target.requiredScopeTypes ?? []);
  return requiredScopes.every((scopeType) => isAccessAssignmentScopeComplete(scopeType, {}, {}));
};
