import type {
  AccessAssignmentScopeGrant,
  AccessAssignmentScopeType,
  AccessAssignmentTargetOption,
} from '@modules/role/types/role.types';

export type AccessAssignmentRequirementState = {
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

export const normalizeAccessAssignmentRequiredScopeTypes = (
  values: readonly string[],
): AccessAssignmentScopeType[] => {
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
};

export const getUnsupportedAccessAssignmentScopeTypes = (
  scopeTypes: readonly AccessAssignmentScopeType[],
): AccessAssignmentScopeType[] =>
  scopeTypes.filter((scopeType) => !supportedScopeTypes.has(scopeType));

export const isAccessAssignmentScopeWithoutTarget = (
  scopeType: AccessAssignmentScopeType,
): boolean => scopeTypesWithoutTarget.has(scopeType);

export const isAccessAssignmentPeriodScope = (scopeType: AccessAssignmentScopeType): boolean =>
  periodScopeTypes.has(scopeType);

export const getAccessAssignmentRequirementIssueCodes = (
  state: AccessAssignmentRequirementState,
): Array<'unsupportedScope' | 'scope' | 'reason' | 'reviewDate' | 'expiryDate'> => [
  ...(state.missingScope ? (['scope'] as const) : []),
  ...(state.missingReason ? (['reason'] as const) : []),
  ...(state.missingReviewDate ? (['reviewDate'] as const) : []),
  ...(state.missingExpiryDate ? (['expiryDate'] as const) : []),
  ...(state.missingUnsupportedScope ? (['unsupportedScope'] as const) : []),
];

export const buildAccessAssignmentRequirementState = (args: {
  selectedTarget: AccessAssignmentTargetOption | undefined;
  requiredScopeTypes: AccessAssignmentScopeType[];
  scopeTargetIds: Record<string, string | undefined>;
  scopePeriodKeys: Record<string, string | undefined>;
  reason: string;
  reviewAt: string;
  expiresAt: string;
  unsupportedScopeTypes: AccessAssignmentScopeType[];
}): AccessAssignmentRequirementState => {
  const requiresScope = args.requiredScopeTypes.length > 0;
  const requiresReason = true;
  const requiresReviewDate = Boolean(
    args.selectedTarget &&
    requiresAccessAssignmentReviewDate(args.selectedTarget, args.requiredScopeTypes),
  );
  const requiresExpiryDate = Boolean(
    args.selectedTarget && requiresAccessAssignmentExpiryDate(args.selectedTarget),
  );
  const requiresSensitiveConfirmation = Boolean(
    args.selectedTarget && isSensitiveOrControlledAccessAssignmentTarget(args.selectedTarget),
  );
  const missingScope = args.requiredScopeTypes.some(
    (scopeType) =>
      !isAccessAssignmentScopeComplete(scopeType, args.scopeTargetIds, args.scopePeriodKeys),
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
};

export const buildAccessAssignmentStructuredScopeGrants = (
  scopeTypes: readonly AccessAssignmentScopeType[],
  targetIds: Record<string, string | undefined>,
  periodKeys: Record<string, string | undefined>,
): AccessAssignmentScopeGrant[] =>
  scopeTypes.flatMap((scopeType) => {
    if (!supportedScopeTypes.has(scopeType)) {
      return [];
    }
    if (isAccessAssignmentScopeWithoutTarget(scopeType)) {
      return [{ scopeType }];
    }
    if (isAccessAssignmentPeriodScope(scopeType)) {
      const periodKey = periodKeys[scopeType];
      return periodKey ? [{ scopeType, periodKey }] : [];
    }
    const targetId = targetIds[scopeType];
    return targetId ? [{ scopeType, targetId }] : [];
  });

export const isAccessAssignmentScopeComplete = (
  scopeType: AccessAssignmentScopeType,
  targetIds: Record<string, string | undefined>,
  periodKeys: Record<string, string | undefined>,
): boolean => {
  if (!supportedScopeTypes.has(scopeType)) {
    return false;
  }
  if (isAccessAssignmentScopeWithoutTarget(scopeType)) {
    return true;
  }
  if (isAccessAssignmentPeriodScope(scopeType)) {
    return Boolean(periodKeys[scopeType]);
  }
  return Boolean(targetIds[scopeType]);
};

const isSensitiveOrControlledAccessAssignmentTarget = (
  target: AccessAssignmentTargetOption,
): boolean => {
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
};

const requiresAccessAssignmentReviewDate = (
  target: AccessAssignmentTargetOption,
  requiredScopeTypes: readonly AccessAssignmentScopeType[],
): boolean => {
  const risk = readTargetAccessRisk(target);
  return (
    isSensitiveOrControlledAccessAssignmentTarget(target) ||
    target.requiresResponsibility ||
    hasRequiredResponsibilityType(target.requiredResponsibilityType) ||
    readBooleanTargetValue(target, 'requiresReview') ||
    risk.requiresReview === true ||
    requiredScopeTypes.some((scopeType) =>
      ['global', 'financeGlobal', 'financePeriod', 'payrollPeriod'].includes(scopeType),
    ) ||
    /OWNER|ACCESS|FINANCE|REVENUE|COMMISSION/u.test(target.code)
  );
};

const requiresAccessAssignmentExpiryDate = (target: AccessAssignmentTargetOption): boolean => {
  const risk = readTargetAccessRisk(target);
  return (
    risk.requiresExpiry === true ||
    readBooleanTargetValue(target, 'isBreakGlassLike') ||
    target.code === 'OWNER_ADMIN' ||
    target.code === 'OWNER_ADMIN_BUNDLE'
  );
};

const readTargetAccessRisk = (
  target: AccessAssignmentTargetOption,
): Partial<{
  isSensitive: boolean;
  isHighRisk: boolean;
  requiresReview: boolean;
  requiresExpiry: boolean;
}> => {
  const risk = (target as { accessRisk?: Record<string, unknown> | null }).accessRisk;
  return risk && typeof risk === 'object' ? (risk as Record<string, boolean>) : {};
};

const readBooleanTargetValue = (target: AccessAssignmentTargetOption, key: string): boolean =>
  (target as Record<string, unknown>)[key] === true;

const hasRequiredResponsibilityType = (value: string | string[] | null | undefined): boolean =>
  Array.isArray(value) ? value.length > 0 : Boolean(value);
