import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useAccessAssignmentApplyMutation,
  useAccessAssignmentPreviewMutation,
  useAccessAssignmentTargets,
} from '@modules/role/hooks/use-role';
import type {
  AccessAssignmentApplyResult,
  AccessAssignmentIssue,
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
import { AsyncReferencePicker, type ReferenceOption } from '@shared/components/reference';
import {
  loadAccessAssignmentLinkedUserOptions,
  loadEventReferenceOptions,
  loadOrgUnitReferenceOptions,
  loadPlatformAccountReferenceOptions,
  loadStudioResourceReferenceOptions,
  loadTalentGroupReferenceOptions,
} from '@shared/components/reference/admin-reference-options';

type AssignmentMode = 'BUNDLE' | 'ROLE_TEMPLATE';

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

const objectScopeLoaders: Partial<
  Record<AccessAssignmentScopeType, (search: string) => Promise<ReferenceOption[]>>
> = {
  managedTalentGroup: loadTalentGroupReferenceOptions,
  managedOrgUnit: loadOrgUnitReferenceOptions,
  assignedPlatformAccount: loadPlatformAccountReferenceOptions,
  assignedEvent: loadEventReferenceOptions,
  assignedStudioResource: loadStudioResourceReferenceOptions,
};

const scopeTypesWithoutTarget = new Set<AccessAssignmentScopeType>([
  'self',
  'global',
  'financeGlobal',
]);

const periodScopeTypes = new Set<AccessAssignmentScopeType>(['financePeriod', 'payrollPeriod']);

export const AccessAssignmentTab = (): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const targetsQuery = useAccessAssignmentTargets();
  const previewMutation = useAccessAssignmentPreviewMutation();
  const applyMutation = useAccessAssignmentApplyMutation();
  const resetPreviewMutation = previewMutation.reset;
  const { notifyError, notifySuccess } = useMutationFeedback();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [selectedUserOption, setSelectedUserOption] = useState<ReferenceOption | undefined>();
  const [mode, setMode] = useState<AssignmentMode>('BUNDLE');
  const [targetKey, setTargetKey] = useState<string>('');
  const [scopeTargetIds, setScopeTargetIds] = useState<Record<string, string | undefined>>({});
  const [scopePeriodKeys, setScopePeriodKeys] = useState<Record<string, string | undefined>>({});
  const [reason, setReason] = useState('');
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<AccessAssignmentApplyResult | null>(null);

  const targets = useMemo(
    () => targetsQuery.data?.assignmentTargets ?? [],
    [targetsQuery.data?.assignmentTargets],
  );
  const bundleTargets = useMemo(
    () =>
      targets.filter(
        (target) => target.assignmentKind === 'BUNDLE' && target.legacyAssignable,
      ),
    [targets],
  );
  const roleTemplateTargets = useMemo(
    () =>
      targets.filter(
        (target) => target.assignmentKind === 'ROLE_TEMPLATE' && target.legacyAssignable,
      ),
    [targets],
  );
  const activeTargets = mode === 'BUNDLE' ? bundleTargets : roleTemplateTargets;
  const selectedTarget = activeTargets.find((target) => targetKey === toTargetKey(target));

  useEffect(() => {
    const nextTargets = mode === 'BUNDLE' ? bundleTargets : roleTemplateTargets;
    if (targetKey && nextTargets.some((target) => toTargetKey(target) === targetKey)) {
      return;
    }
    setTargetKey(nextTargets[0] ? toTargetKey(nextTargets[0]) : '');
  }, [bundleTargets, mode, roleTemplateTargets, targetKey]);

  const requiredScopeTypes = useMemo(
    () => normalizeRequiredScopeTypes(selectedTarget?.requiredScopeTypes ?? []),
    [selectedTarget],
  );
  const unsupportedScopeTypes = requiredScopeTypes.filter(
    (scopeType) => !supportedScopeTypes.has(scopeType),
  );
  const structuredScopeGrants = useMemo(
    () => buildStructuredScopeGrants(requiredScopeTypes, scopeTargetIds, scopePeriodKeys),
    [requiredScopeTypes, scopePeriodKeys, scopeTargetIds],
  );
  const missingScope = requiredScopeTypes.some(
    (scopeType) => !isScopeComplete(scopeType, scopeTargetIds, scopePeriodKeys),
  );
  const reasonValue = reason.trim();
  const currentPayload = useMemo(
    () =>
      selectedUserId && selectedTarget && reasonValue && unsupportedScopeTypes.length === 0
        ? buildPayload({
            selectedUserId,
            selectedTarget,
            structuredScopeGrants,
            reason: reasonValue,
          })
        : null,
    [reasonValue, selectedTarget, selectedUserId, structuredScopeGrants, unsupportedScopeTypes.length],
  );
  const currentSignature = currentPayload ? JSON.stringify(currentPayload) : '';
  const previewResult = previewMutation.data;
  const previewMatchesCurrent = Boolean(
    previewResult && previewSignature && previewSignature === currentSignature,
  );
  const canPreview = Boolean(
    currentPayload &&
      selectedUserId &&
      selectedTarget &&
      reasonValue &&
      !missingScope &&
      unsupportedScopeTypes.length === 0 &&
      !previewMutation.isPending,
  );
  const canApply = Boolean(
    currentPayload &&
      previewMatchesCurrent &&
      previewResult?.canApply === true &&
      reasonValue &&
      !applyMutation.isPending,
  );

  useEffect(() => {
    setPreviewSignature(null);
    setApplyResult(null);
    resetPreviewMutation();
  }, [currentSignature, resetPreviewMutation]);

  const loadSearchFirstLinkedUsers = useCallback(
    (search: string): ReturnType<typeof loadAccessAssignmentLinkedUserOptions> => {
      if (search.trim().length < 2) {
        return Promise.resolve([]);
      }
      return loadAccessAssignmentLinkedUserOptions(search);
    },
    [],
  );

  const runPreview = useCallback(async () => {
    if (!currentPayload || !canPreview) {
      return;
    }
    try {
      await previewMutation.mutateAsync(currentPayload);
      setPreviewSignature(JSON.stringify(currentPayload));
      setApplyResult(null);
    } catch (error) {
      notifyError(error as unknown as NormalizedApiError);
    }
  }, [canPreview, currentPayload, notifyError, previewMutation]);

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

  return (
    <div className="space-y-4">
      <MetadataSection
        title={t('role:accessAssignment.userTitle')}
        subtitle={t('role:accessAssignment.userSubtitle')}
      >
        <AsyncReferencePicker
          pickerId="role-access-assignment-linked-user"
          value={selectedUserId}
          onChange={setSelectedUserId}
          onSelectedOptionChange={setSelectedUserOption}
          loadOptions={loadSearchFirstLinkedUsers}
          placeholder={t('role:accessAssignment.userSearchPlaceholder')}
          resourceLabel={t('role:accessAssignment.userResource')}
          emptySlot={
            <div className="space-y-1 text-xs text-muted">
              <p>{t('role:accessAssignment.userSearchEmpty')}</p>
              <p>{t('role:accessAssignment.userSearchMinLength')}</p>
            </div>
          }
        />
        {!selectedUserId ? (
          <p className="mt-2 text-sm text-muted">{t('role:accessAssignment.noUserSelected')}</p>
        ) : selectedUserOption ? (
          <ReadOnlyFieldGrid
            columns={3}
            fields={[
              {
                key: 'user',
                label: t('role:accessAssignment.targetUser'),
                value: selectedUserOption.label,
              },
              {
                key: 'profile',
                label: t('role:accessAssignment.employmentProfile'),
                value: selectedUserOption.meta?.employeeCode ?? '-',
              },
              {
                key: 'status',
                label: t('role:accessAssignment.linkedAccount'),
                value: selectedUserOption.meta?.linkedUserStatus ?? '-',
              },
            ]}
          />
        ) : null}
      </MetadataSection>

      <MetadataSection
        title={t('role:accessAssignment.targetTitle')}
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
          <label className="mt-3 flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('role:accessAssignment.targetLabel')}
            </span>
            <select
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
              className="rounded border border-border bg-panel px-2 py-2 text-sm"
            >
              {activeTargets.map((target) => (
                <option key={toTargetKey(target)} value={toTargetKey(target)}>
                  {target.name} ({target.code})
                </option>
              ))}
            </select>
          </label>
        )}

        {targets.some((target) => !target.legacyAssignable) ? (
          <p className="mt-2 text-xs text-muted">
            {t('role:accessAssignment.legacyTargetsHidden')}
          </p>
        ) : null}
      </MetadataSection>

      <ScopeResolver
        requiredScopeTypes={requiredScopeTypes}
        unsupportedScopeTypes={unsupportedScopeTypes}
        scopeTargetIds={scopeTargetIds}
        scopePeriodKeys={scopePeriodKeys}
        onTargetChange={(scopeType, value) =>
          setScopeTargetIds((current) => ({ ...current, [scopeType]: value }))
        }
        onPeriodChange={(scopeType, value) =>
          setScopePeriodKeys((current) => ({ ...current, [scopeType]: value || undefined }))
        }
      />

      <MetadataSection
        title={t('role:accessAssignment.reasonTitle')}
        subtitle={t('role:accessAssignment.reasonHelp')}
      >
        <label className="block">
          <span className="text-xs font-medium uppercase text-muted">
            {t('role:accessAssignment.reasonLabel')}
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 min-h-24 w-full rounded border border-border bg-bg px-3 py-2 text-sm"
            placeholder={t('role:accessAssignment.reasonPlaceholder')}
          />
        </label>
      </MetadataSection>

      <MetadataSection title={t('role:accessAssignment.previewTitle')}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canPreview}
            onClick={() => void runPreview()}
            className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewMutation.isPending
              ? t('role:accessAssignment.previewPending')
              : t('role:accessAssignment.previewButton')}
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => void runApply()}
            className="rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            {applyMutation.isPending
              ? t('role:accessAssignment.applyPending')
              : t('role:accessAssignment.applyButton')}
          </button>
        </div>

        <ValidationSummary
          hasUser={Boolean(selectedUserId)}
          hasTarget={Boolean(selectedTarget)}
          hasReason={Boolean(reasonValue)}
          missingScope={missingScope}
          previewStale={Boolean(previewResult && !previewMatchesCurrent)}
          unsupportedScopeTypes={unsupportedScopeTypes}
        />

        {previewResult ? (
          <PreviewSummary result={previewResult} previewMatchesCurrent={previewMatchesCurrent} />
        ) : null}
      </MetadataSection>

      {applyResult ? <ApplySummary result={applyResult} reason={reasonValue} /> : null}
    </div>
  );
};

const ScopeResolver = ({
  requiredScopeTypes,
  unsupportedScopeTypes,
  scopeTargetIds,
  scopePeriodKeys,
  onTargetChange,
  onPeriodChange,
}: {
  requiredScopeTypes: AccessAssignmentScopeType[];
  unsupportedScopeTypes: AccessAssignmentScopeType[];
  scopeTargetIds: Record<string, string | undefined>;
  scopePeriodKeys: Record<string, string | undefined>;
  onTargetChange: (scopeType: AccessAssignmentScopeType, value?: string) => void;
  onPeriodChange: (scopeType: AccessAssignmentScopeType, value?: string) => void;
}): JSX.Element => {
  const { t } = useTranslation('role');

  return (
    <MetadataSection
      title={t('accessAssignment.scopeTitle')}
      subtitle={t('accessAssignment.scopeSubtitle')}
    >
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
              <p className="text-sm font-semibold text-text">{formatScopeTypeLabel(scopeType)}</p>
              {unsupportedScopeTypes.includes(scopeType) ? (
                <p className="mt-2 text-sm text-danger">
                  {t('accessAssignment.scopeUnavailable')}
                </p>
              ) : scopeTypesWithoutTarget.has(scopeType) ? (
                <p className="mt-2 text-sm text-muted">{formatScopeReadOnlyHelp(scopeType)}</p>
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
                  loadOptions={objectScopeLoaders[scopeType] ?? (() => Promise.resolve([]))}
                  placeholder={t('accessAssignment.scopeSearchPlaceholder')}
                  resourceLabel={formatScopeTypeLabel(scopeType)}
                  emptySlot={
                    <p className="text-xs text-muted">{t('accessAssignment.scopeNoResults')}</p>
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}
    </MetadataSection>
  );
};

const PreviewSummary = ({
  result,
  previewMatchesCurrent,
}: {
  result: AccessAssignmentPreviewResult;
  previewMatchesCurrent: boolean;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const blockers = result.blockers ?? [];
  const warnings = result.warnings ?? [];
  const proposedAssignments = result.proposedAssignments ?? [];
  const addedPermissions = result.effectiveAccessDelta?.addedPermissions ?? [];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={
            result.canApply
              ? t('accessAssignment.previewCanApply')
              : t('accessAssignment.previewBlocked')
          }
          tone={result.canApply ? 'success' : 'warning'}
        />
        {!previewMatchesCurrent ? (
          <StatusBadge label={t('accessAssignment.previewStale')} tone="warning" />
        ) : null}
      </div>
      <IssueList title={t('accessAssignment.blockersTitle')} issues={blockers} />
      <IssueList title={t('accessAssignment.warningsTitle')} issues={warnings} />
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
            value: formatScopeSummary(result.normalizedScope ?? []),
          },
        ]}
      />
      {result.accountContextRequirement ? (
        <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('accessAssignment.accountContextReadOnly')}
        </p>
      ) : null}
      {(result.responsibilityRequirements ?? []).length > 0 ? (
        <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('accessAssignment.responsibilityReadOnly')}
        </p>
      ) : null}
    </div>
  );
};

const ApplySummary = ({
  result,
  reason,
}: {
  result: AccessAssignmentApplyResult;
  reason: string;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const appliedAssignments = result.appliedAssignments ?? [];
  const applied = isApplySuccess(result);

  return (
    <MetadataSection
      title={t('accessAssignment.resultTitle')}
      subtitle={
        applied
          ? t('accessAssignment.resultApplied')
          : t('accessAssignment.resultBlocked')
      }
    >
      <IssueList title={t('accessAssignment.blockersTitle')} issues={result.blockers ?? []} />
      <IssueList title={t('accessAssignment.warningsTitle')} issues={result.warnings ?? []} />
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
            value: formatScopeSummary(result.normalizedScope ?? []),
          },
          {
            key: 'reason',
            label: t('accessAssignment.reasonLabel'),
            value: reason,
          },
          {
            key: 'audit',
            label: t('accessAssignment.auditTrace'),
            value: readAuditTrace(result.auditTrace),
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
    </MetadataSection>
  );
};

const IssueList = ({
  title,
  issues,
}: {
  title: string;
  issues: AccessAssignmentIssue[];
}): JSX.Element | null => {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="rounded border border-border bg-bg p-3">
      <p className="text-sm font-semibold text-text">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>{formatIssue(issue)}</li>
        ))}
      </ul>
    </div>
  );
};

const ValidationSummary = ({
  hasUser,
  hasTarget,
  hasReason,
  missingScope,
  previewStale,
  unsupportedScopeTypes,
}: {
  hasUser: boolean;
  hasTarget: boolean;
  hasReason: boolean;
  missingScope: boolean;
  previewStale: boolean;
  unsupportedScopeTypes: AccessAssignmentScopeType[];
}): JSX.Element => {
  const { t } = useTranslation('role');
  const items = [
    !hasUser ? t('accessAssignment.noUserSelected') : null,
    !hasTarget ? t('accessAssignment.noTargetSelected') : null,
    missingScope ? t('accessAssignment.missingScope') : null,
    !hasReason ? t('accessAssignment.missingReason') : null,
    previewStale ? t('accessAssignment.previewChanged') : null,
    unsupportedScopeTypes.length > 0 ? t('accessAssignment.unsupportedScope') : null,
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
}): AccessAssignmentRequestPayload {
  const payload: AccessAssignmentRequestPayload = {
    targetUserId: input.selectedUserId,
    assignmentTargetType: input.selectedTarget.assignmentKind,
    structuredScopeGrants: input.structuredScopeGrants,
    reason: input.reason,
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

function isApplySuccess(result: AccessAssignmentApplyResult | null | undefined): boolean {
  if (!result) {
    return false;
  }
  const blockers = result.blockers ?? [];
  return result.applied === true && result.applyStatus === 'APPLIED' && blockers.length === 0;
}

function formatIssue(issue: AccessAssignmentIssue): string {
  const friendly: Record<string, string> = {
    REQUIRED_ACCOUNT_CONTEXT_MISSING:
      'Người dùng chưa đủ điều kiện vào Console cần thiết. Bước này không tự cấp điều kiện Console.',
    RESPONSIBILITY_REQUIRED: 'Chưa có phân công trách nhiệm quản lý phù hợp.',
    LEGACY_ROLE_BLOCKED: 'Mẫu vai trò cũ không còn được dùng để gán quyền mới.',
    DUPLICATE_ACTIVE_ASSIGNMENT: 'Quyền này đã được gán trong cùng phạm vi.',
    SELF_ASSIGNMENT_BLOCKED: 'Không thể tự gán quyền cho chính mình.',
    REASON_REQUIRED: 'Nhập lý do gán quyền.',
  };

  return friendly[issue.code] ?? issue.summary ?? issue.code;
}

function formatScopeTypeLabel(scopeType: AccessAssignmentScopeType): string {
  const labels: Record<AccessAssignmentScopeType, string> = {
    self: 'Dữ liệu của chính nhân sự',
    global: 'Toàn hệ thống',
    managedTalentGroup: 'Nhóm Talent được quản lý',
    managedOrgUnit: 'Phòng ban được quản lý',
    assignedPlatformAccount: 'Tài khoản nền tảng được phân công',
    financeGlobal: 'Tài chính toàn cục',
    financePeriod: 'Kỳ tài chính',
    contractPortfolio: 'Danh mục hợp đồng',
    assignedEvent: 'Sự kiện được phân công',
    assignedStudioResource: 'Tài nguyên studio được phân công',
    payrollPeriod: 'Kỳ nháp lương',
    attendancePeriodOrg: 'Kỳ chấm công theo phòng ban',
  };
  return labels[scopeType] ?? scopeType;
}

function formatScopeReadOnlyHelp(scopeType: AccessAssignmentScopeType): string {
  if (scopeType === 'self') {
    return 'Không cần chọn đối tượng; phạm vi là dữ liệu của chính nhân sự.';
  }
  return 'Không cần chọn đối tượng; hệ thống sẽ kiểm tra rủi ro và điều kiện khi xem trước.';
}

function formatScopeSummary(scopes: readonly AccessAssignmentScopeGrant[]): string {
  if (scopes.length === 0) {
    return '-';
  }
  return scopes
    .map((scope) =>
      [scope.scopeType, scope.targetId, scope.targetKey, scope.periodKey].filter(Boolean).join(':'),
    )
    .join(', ');
}

function readAuditTrace(value: Record<string, unknown> | null | undefined): string {
  if (!value) {
    return '-';
  }
  const assignmentIds = Array.isArray(value.assignmentIds) ? value.assignmentIds : [];
  return assignmentIds.length > 0 ? assignmentIds.map(String).join(', ') : String(value.mutationType ?? '-');
}

function readErrorMessage(
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
): string {
  if (!error?.message) {
    return t('role:statesView.loadErrorMessage');
  }
  return error.message.includes(':') ? t(error.message) : error.message;
}
