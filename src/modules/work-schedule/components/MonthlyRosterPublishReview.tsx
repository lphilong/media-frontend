import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useMonthlyRosterPreview,
  usePublishMonthlyRosterMutation,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { createWorkScheduleCapabilityHint } from '@modules/work-schedule/capability-hints';
import type {
  MonthlyRosterPreview,
  MonthlyRosterPublishResult,
  MonthlyRosterRecord,
  MonthlyRosterScope,
} from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ErrorState,
  LoadingState,
  MetadataSection,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  StatusBadge,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import { formatBusinessTimestamp, readReferenceDisplay } from '@shared/formatting/formatters';

type MonthlyRosterPublishReviewProps = {
  roster: MonthlyRosterRecord;
  scope?: MonthlyRosterScope;
  onPublished?: (result: MonthlyRosterPublishResult) => void;
};

type Freshness = 'current' | 'notPreviewed' | 'stale';

const formatNullable = (value?: string | number | null): string =>
  value === null || value === undefined || value === '' ? '-' : String(value);

const formatNullableTimestamp = (value?: string | number | null): string =>
  value ? formatBusinessTimestamp(value) : '-';

const resolveFreshness = (preview: MonthlyRosterPreview): Freshness => {
  if (!preview.currentPreviewHash) {
    return 'notPreviewed';
  }

  return preview.currentPreviewHash === preview.computedPreviewHash ? 'current' : 'stale';
};

const countBlockers = (preview?: MonthlyRosterPreview): number =>
  (preview?.rows ?? []).reduce((total, row) => total + row.blockers.length, 0);

const countExceptions = (preview?: MonthlyRosterPreview): number =>
  preview
    ? preview.summary.totalWorkingToOff +
      preview.summary.totalChangeTime +
      preview.summary.totalAddSpecialShift
    : 0;

const isStalePublishError = (error?: NormalizedApiError | null): boolean => {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('expectedpreviewhash') || message.includes('preview hash');
};

const readPublishErrorMessage = (
  t: (key: string, options?: Record<string, unknown>) => string,
  error?: NormalizedApiError | null,
): string => {
  if (isStalePublishError(error)) {
    return t('work-schedule:monthlyRosters.publish.errors.stalePreview');
  }

  if (error?.message?.includes(':')) {
    return t(error.message);
  }

  if (error?.status === 401) {
    return t('work-schedule:monthlyRosters.publish.errors.unauthorized');
  }

  if (error?.status === 403 || error?.permissionDenied) {
    return t('work-schedule:monthlyRosters.publish.errors.forbidden');
  }

  if (error?.status === 409) {
    return t('work-schedule:monthlyRosters.publish.errors.conflict');
  }

  if (error?.status === 422) {
    return t('work-schedule:monthlyRosters.publish.errors.validation');
  }

  return error?.message ?? t('work-schedule:monthlyRosters.publish.errors.generic');
};

export const MonthlyRosterPublishReview = ({
  roster,
  scope,
  onPublished,
}: MonthlyRosterPublishReviewProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const previewEnabled = Boolean(roster.monthlyRosterId) && roster.status !== 'ARCHIVED';
  const previewQuery = useMonthlyRosterPreview(roster.monthlyRosterId, scope, {
    enabled: previewEnabled,
  });
  const capabilitiesQuery = useCurrentActorCapabilities();
  const publishMutation = usePublishMonthlyRosterMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const [confirming, setConfirming] = useState(false);
  const [lastPublishResult, setLastPublishResult] = useState<MonthlyRosterPublishResult | null>(
    null,
  );

  const preview = previewQuery.data;
  const blockerCount = countBlockers(preview);
  const exceptionCount = countExceptions(preview);
  const freshness = preview ? resolveFreshness(preview) : undefined;
  const publishError = publishMutation.error as NormalizedApiError | null;

  const disabledReasonKey = useMemo(() => {
    if (roster.status !== 'DRAFT') {
      return 'notDraft';
    }

    if (!previewEnabled) {
      return 'unavailable';
    }

    if (previewQuery.isPending) {
      return 'loading';
    }

    if (previewQuery.isError) {
      return 'error';
    }

    if (!preview) {
      return 'unavailable';
    }

    if (!preview.currentPreviewHash || !preview.computedPreviewHash) {
      return 'hashUnavailable';
    }

    if (freshness !== 'current') {
      return 'stale';
    }

    if (preview.summary.totalConflicts > 0) {
      return 'conflicts';
    }

    if (blockerCount > 0) {
      return 'blockers';
    }

    return null;
  }, [
    blockerCount,
    freshness,
    preview,
    previewEnabled,
    previewQuery.isError,
    previewQuery.isPending,
    roster.status,
  ]);

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );
  const publishCapabilityHint = useMemo(
    () =>
      createWorkScheduleCapabilityHint({
        state: {
          capabilities: capabilitiesQuery.data,
          isLoading: capabilitiesQuery.isLoading,
          isError: capabilitiesQuery.isError,
        },
        permission: PERMISSIONS.WORK_SCHEDULE_MANAGE_LIFECYCLE,
        requestedScope: 'global',
        copy: capabilityCopy,
      }),
    [
      capabilitiesQuery.data,
      capabilitiesQuery.isError,
      capabilitiesQuery.isLoading,
      capabilityCopy,
    ],
  );

  const shouldHidePublishAffordance =
    publishCapabilityHint.hidden ||
    capabilitiesQuery.isError ||
    (!capabilitiesQuery.isLoading && !capabilitiesQuery.data);
  const isPublishLocallyAllowed =
    roster.status === 'DRAFT' && !disabledReasonKey && Boolean(preview);
  const isPublishAllowed = isPublishLocallyAllowed && !publishCapabilityHint.disabled;
  const publishDisabledReason = disabledReasonKey
    ? t(`work-schedule:monthlyRosters.publish.disabledReasons.${disabledReasonKey}`)
    : isPublishLocallyAllowed
      ? publishCapabilityHint.disabledReason
      : undefined;

  const handlePublish = async (): Promise<void> => {
    if (!preview || !preview.computedPreviewHash || !isPublishAllowed) {
      return;
    }

    try {
      const result = await publishMutation.mutateAsync({
        monthlyRosterId: roster.monthlyRosterId,
        payload: {
          expectedPreviewHash: preview.computedPreviewHash,
          scope: 'global',
        },
      });
      setLastPublishResult(result);
      setConfirming(false);
      onPublished?.(result);
      notifySuccess('work-schedule:monthlyRosters.publish.feedback.success');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const renderDisabledPublishButton = (): JSX.Element => (
    <div className="mt-3 flex justify-end">
      <button
        type="button"
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled
      >
        {t('work-schedule:monthlyRosters.publish.actions.openConfirmation')}
      </button>
    </div>
  );

  if (shouldHidePublishAffordance) {
    return <></>;
  }

  if (roster.status === 'PUBLISHED') {
    return (
      <MetadataSection title={t('work-schedule:monthlyRosters.publish.title')}>
        <div className="space-y-3">
          <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
            {t('work-schedule:monthlyRosters.publish.states.alreadyPublished')}
          </div>
          <ReadOnlyFieldGrid
            fields={[
              {
                key: 'published-at',
                label: t('work-schedule:monthlyRosters.publish.summary.publishedAt'),
                value: formatNullableTimestamp(roster.publishedAt),
              },
              {
                key: 'published-by',
                label: t('work-schedule:monthlyRosters.publish.summary.publishedBy'),
                value: formatNullable(roster.publishedByUserId),
              },
              {
                key: 'generation-run',
                label: t('work-schedule:monthlyRosters.publish.summary.generationRunId'),
                value: formatNullable(roster.publishGenerationRunId),
                monospace: true,
              },
            ]}
            columns={3}
          />
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {publishDisabledReason}
          </div>
          {renderDisabledPublishButton()}
        </div>
      </MetadataSection>
    );
  }

  if (roster.status !== 'DRAFT') {
    return (
      <MetadataSection title={t('work-schedule:monthlyRosters.publish.title')}>
        <div className="space-y-3">
          <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
            {t('work-schedule:monthlyRosters.publish.states.unavailable')}
          </div>
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {publishDisabledReason}
          </div>
          {renderDisabledPublishButton()}
        </div>
      </MetadataSection>
    );
  }

  return (
    <MetadataSection title={t('work-schedule:monthlyRosters.publish.title')}>
      <div className="space-y-4">
        <div className="space-y-2 rounded border border-border bg-bg px-3 py-3 text-sm text-muted">
          <p>{t('work-schedule:monthlyRosters.publish.copy.createShifts')}</p>
          <p>{t('work-schedule:monthlyRosters.publish.copy.reviewPreview')}</p>
          <p>{t('work-schedule:monthlyRosters.publish.copy.noUndo')}</p>
        </div>

        {previewQuery.isPending ? <LoadingState lines={4} /> : null}

        {previewQuery.isError ? (
          (previewQuery.error as unknown as NormalizedApiError | null)?.permissionDenied ? (
            <PermissionDeniedState />
          ) : (
            <ErrorState
              title={t('work-schedule:monthlyRosters.publish.states.previewErrorTitle')}
              message={readPublishErrorMessage(
                t,
                previewQuery.error as unknown as NormalizedApiError | null,
              )}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void previewQuery.refetch()}
            />
          )
        ) : null}

        {preview ? (
          <ReadOnlyFieldGrid
            fields={[
              {
                key: 'freshness',
                label: t('work-schedule:monthlyRosters.publish.readiness.previewFreshness'),
                value: t(`work-schedule:monthlyRosters.preview.freshness.${freshness}`),
              },
              {
                key: 'eligible',
                label: t('work-schedule:monthlyRosters.publish.confirmation.eligibleEmployees'),
                value: String(preview.summary.totalEligibleProfiles),
              },
              {
                key: 'generated',
                label: t('work-schedule:monthlyRosters.publish.confirmation.generatedCandidates'),
                value: String(preview.summary.totalCandidateShiftsAfterExceptions),
              },
              {
                key: 'exceptions',
                label: t('work-schedule:monthlyRosters.publish.confirmation.exceptionCount'),
                value: String(exceptionCount),
              },
              {
                key: 'conflicts',
                label: t('work-schedule:monthlyRosters.publish.confirmation.conflictBlockerCount'),
                value: t('work-schedule:monthlyRosters.publish.confirmation.issueCount', {
                  conflicts: preview.summary.totalConflicts,
                  blockers: blockerCount,
                }),
              },
              {
                key: 'readiness',
                label: t('work-schedule:monthlyRosters.publish.readiness.status'),
                value: (
                  <StatusBadge
                    tone={disabledReasonKey ? 'danger' : 'success'}
                    label={
                      disabledReasonKey
                        ? t(
                            `work-schedule:monthlyRosters.publish.disabledReasons.${disabledReasonKey}`,
                          )
                        : t('work-schedule:monthlyRosters.publish.readiness.ready')
                    }
                    uppercase={false}
                  />
                ),
              },
            ]}
            columns={3}
          />
        ) : null}

        {publishDisabledReason ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {publishDisabledReason}
          </div>
        ) : null}

        {publishMutation.isError ? (
          <div role="alert" className="rounded border border-danger bg-bg px-3 py-2 text-sm">
            <p className="font-medium text-danger">
              {t('work-schedule:monthlyRosters.publish.errors.title')}
            </p>
            <p className="mt-1 text-muted">{readPublishErrorMessage(t, publishError)}</p>
          </div>
        ) : null}

        {lastPublishResult ? (
          <div className="rounded border border-border bg-panel p-3">
            <p className="text-sm font-semibold text-text">
              {t('work-schedule:monthlyRosters.publish.feedback.successTitle')}
            </p>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'generated',
                  label: t('work-schedule:monthlyRosters.publish.summary.generatedCount'),
                  value: String(lastPublishResult.generatedWorkShiftCount),
                },
                {
                  key: 'suppressed',
                  label: t('work-schedule:monthlyRosters.publish.summary.suppressedCount'),
                  value: String(lastPublishResult.holidaySuppressedCount),
                },
                {
                  key: 'skipped',
                  label: t('work-schedule:monthlyRosters.publish.summary.skippedCount'),
                  value: String(lastPublishResult.skippedWorkingToOffCount),
                },
                {
                  key: 'published-at',
                  label: t('work-schedule:monthlyRosters.publish.summary.publishedAt'),
                  value: formatNullableTimestamp(lastPublishResult.publishedAt),
                },
              ]}
              columns={2}
            />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-text">
                {t('work-schedule:monthlyRosters.publish.summary.adminMetadata')}
              </summary>
              <div className="pt-3">
                <ReadOnlyFieldGrid
                  fields={[
                    {
                      key: 'generation-run',
                      label: t('work-schedule:monthlyRosters.publish.summary.generationRunId'),
                      value: formatNullable(lastPublishResult.sourceGenerationRunId),
                      monospace: true,
                    },
                    {
                      key: 'computed-preview-hash',
                      label: t('work-schedule:monthlyRosters.fields.currentPreviewHash'),
                      value: formatNullable(lastPublishResult.computedPreviewHash),
                      monospace: true,
                    },
                  ]}
                  columns={2}
                />
              </div>
            </details>
          </div>
        ) : null}

        {confirming && preview ? (
          <div className="rounded border border-accent bg-panel p-4">
            <h3 className="text-sm font-semibold text-text">
              {t('work-schedule:monthlyRosters.publish.confirmation.title')}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {t('work-schedule:monthlyRosters.publish.confirmation.copy')}
            </p>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'month',
                  label: t('work-schedule:monthlyRosters.fields.rosterMonth'),
                  value: roster.rosterMonth,
                },
                {
                  key: 'target',
                  label: t('work-schedule:monthlyRosters.fields.target'),
                  value: `${t(
                    `work-schedule:monthlyRosters.targetTypes.${roster.targetType}`,
                  )}: ${readReferenceDisplay(
                    roster.targetRef,
                    roster.targetOrgUnitId ?? roster.targetTalentGroupId,
                  )}`,
                },
                {
                  key: 'pattern',
                  label: t('work-schedule:monthlyRosters.fields.workPatternId'),
                  value: roster.workPatternId,
                  monospace: true,
                },
                {
                  key: 'calendar',
                  label: t('work-schedule:monthlyRosters.fields.holidayCalendarId'),
                  value: roster.holidayCalendarId,
                  monospace: true,
                },
                {
                  key: 'eligible',
                  label: t('work-schedule:monthlyRosters.publish.confirmation.eligibleEmployees'),
                  value: String(preview.summary.totalEligibleProfiles),
                },
                {
                  key: 'generated',
                  label: t('work-schedule:monthlyRosters.publish.confirmation.generatedCandidates'),
                  value: String(preview.summary.totalCandidateShiftsAfterExceptions),
                },
                {
                  key: 'exceptions',
                  label: t('work-schedule:monthlyRosters.publish.confirmation.exceptionCount'),
                  value: String(exceptionCount),
                },
                {
                  key: 'issues',
                  label: t(
                    'work-schedule:monthlyRosters.publish.confirmation.conflictBlockerCount',
                  ),
                  value: t('work-schedule:monthlyRosters.publish.confirmation.issueCount', {
                    conflicts: preview.summary.totalConflicts,
                    blockers: blockerCount,
                  }),
                },
                {
                  key: 'freshness',
                  label: t('work-schedule:monthlyRosters.publish.readiness.previewFreshness'),
                  value: t(`work-schedule:monthlyRosters.preview.freshness.${freshness}`),
                },
              ]}
              columns={3}
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded border border-border px-3 py-2 text-sm"
                onClick={() => setConfirming(false)}
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={!isPublishAllowed || publishMutation.isPending}
                onClick={() => void handlePublish()}
              >
                {publishMutation.isPending
                  ? t('work-schedule:monthlyRosters.publish.actions.publishing')
                  : t('work-schedule:monthlyRosters.publish.actions.confirm')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!isPublishAllowed || publishMutation.isPending}
            onClick={() => setConfirming(true)}
          >
            {t('work-schedule:monthlyRosters.publish.actions.openConfirmation')}
          </button>
        </div>
      </div>
    </MetadataSection>
  );
};
