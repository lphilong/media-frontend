import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useAccessAssignmentApplyMutation,
  useAccessAssignmentPreviewMutation,
  useAccessAssignmentRevokeMutation,
  useAccessAssignmentsForUser,
  useAccessAssignmentTargets,
} from '@modules/role/hooks/use-role';
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
  const revokeMutation = useAccessAssignmentRevokeMutation();
  const resetPreviewMutation = previewMutation.reset;
  const { notifyError, notifySuccess } = useMutationFeedback();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [selectedUserOption, setSelectedUserOption] = useState<ReferenceOption | undefined>();
  const assignmentsQuery = useAccessAssignmentsForUser(selectedUserId);
  const [mode, setMode] = useState<AssignmentMode>('BUNDLE');
  const [targetKey, setTargetKey] = useState<string>('');
  const [scopeTargetIds, setScopeTargetIds] = useState<Record<string, string | undefined>>({});
  const [scopePeriodKeys, setScopePeriodKeys] = useState<Record<string, string | undefined>>({});
  const [reason, setReason] = useState('');
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<AccessAssignmentApplyResult | null>(null);
  const [selectedLifecycleAssignment, setSelectedLifecycleAssignment] =
    useState<AccessAssignmentLifecycleItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeResult, setRevokeResult] = useState<AccessAssignmentLifecycleResult | null>(null);

  const targets = useMemo(
    () => targetsQuery.data?.assignmentTargets ?? [],
    [targetsQuery.data?.assignmentTargets],
  );
  const bundleTargets = useMemo(
    () => targets.filter((target) => target.assignmentKind === 'BUNDLE' && target.legacyAssignable),
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
    [
      reasonValue,
      selectedTarget,
      selectedUserId,
      structuredScopeGrants,
      unsupportedScopeTypes.length,
    ],
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

  useEffect(() => {
    setSelectedLifecycleAssignment(null);
    setRevokeReason('');
    setRevokeResult(null);
  }, [selectedUserId]);

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

      {selectedUserId ? (
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
      ) : null}

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
                <p className="mt-2 text-sm text-danger">{t('accessAssignment.scopeUnavailable')}</p>
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
                    {assignment.roleName ?? assignment.roleCode ?? assignment.roleId}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t('role:accessAssignment.lifecycle.assignmentReference', {
                      assignmentId: assignment.assignmentId,
                    })}
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
                </div>
              </div>
              <ReadOnlyFieldGrid
                columns={3}
                fields={[
                  {
                    key: 'scope',
                    label: t('role:accessAssignment.lifecycle.scope'),
                    value: formatScopeSummary(assignment.structuredScopeGrants),
                  },
                  {
                    key: 'source',
                    label: t('role:accessAssignment.lifecycle.bundleOrigin'),
                    value: formatBundleOrigin(assignment),
                  },
                  {
                    key: 'reason',
                    label: t('role:accessAssignment.lifecycle.originalReason'),
                    value: assignment.reason ?? '-',
                  },
                  {
                    key: 'assigned',
                    label: t('role:accessAssignment.lifecycle.assignedAt'),
                    value: formatTimestamp(assignment.assignedAt),
                  },
                  {
                    key: 'expires',
                    label: t('role:accessAssignment.lifecycle.expiresAt'),
                    value: formatTimestamp(assignment.expiresAt),
                  },
                  {
                    key: 'audit',
                    label: t('role:accessAssignment.lifecycle.audit'),
                    value: formatAssignmentAudit(assignment),
                  },
                ]}
              />
              {assignment.status === 'REVOKED' ? (
                <p className="mt-2 text-sm text-muted">
                  {t('role:accessAssignment.lifecycle.revokedSummary', {
                    actor: assignment.revokedBy ?? '-',
                    time: formatTimestamp(assignment.revokedAt),
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
              role:
                selectedAssignment.roleName ??
                selectedAssignment.roleCode ??
                selectedAssignment.roleId,
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
            value: result.assignment?.assignmentId ?? '-',
          },
          {
            key: 'audit',
            label: t('accessAssignment.lifecycle.audit'),
            value: readLifecycleAuditTrace(result.auditTrace),
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
      subtitle={applied ? t('accessAssignment.resultApplied') : t('accessAssignment.resultBlocked')}
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

function formatLifecycleStatus(t: (key: string) => string, status: string): string {
  const key = `role:assignmentStates.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

function formatBundleOrigin(assignment: AccessAssignmentLifecycleItem): string {
  if (!assignment.bundleOrigin) {
    return assignment.origin === 'BUNDLE' ? 'Gói quyền' : 'Trực tiếp';
  }
  const code = readStringRecordValue(assignment.bundleOrigin, 'bundleCode');
  const version = readStringRecordValue(assignment.bundleOrigin, 'bundleVersion');
  return [code, version].filter(Boolean).join(' · ') || 'Gói quyền';
}

function formatAssignmentAudit(assignment: AccessAssignmentLifecycleItem): string {
  const audit = assignment.auditSummary;
  if (!audit) {
    return '-';
  }
  const action = audit.action ?? '-';
  const actor = audit.actorId ?? '-';
  const time = formatTimestamp(audit.timestamp);
  const reason = audit.reason ?? '-';
  return `${action} · ${actor} · ${time} · ${reason}`;
}

function formatTimestamp(value: number | string | null | undefined): string {
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
  return `${parts}, giờ Việt Nam`;
}

function readAuditTrace(value: Record<string, unknown> | null | undefined): string {
  if (!value) {
    return '-';
  }
  const assignmentIds = Array.isArray(value.assignmentIds) ? value.assignmentIds : [];
  return assignmentIds.length > 0
    ? assignmentIds.map(String).join(', ')
    : String(value.mutationType ?? '-');
}

function readLifecycleAuditTrace(value: Record<string, unknown> | null | undefined): string {
  if (!value) {
    return '-';
  }
  const action =
    readStringRecordValue(value, 'lifecycleAction') ?? readStringRecordValue(value, 'mutationType');
  const actor = readStringRecordValue(value, 'actorId');
  const timestamp = value.timestamp;
  return [
    action,
    actor,
    formatTimestamp(
      typeof timestamp === 'string' || typeof timestamp === 'number' ? timestamp : null,
    ),
  ]
    .filter(Boolean)
    .join(' · ');
}

function readStringRecordValue(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  return typeof field === 'string' && field.trim() ? field : null;
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
