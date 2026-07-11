import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useMonthlyRosterPreview,
  usePublishMonthlyRosterMutation,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { WorkScheduleDeadlineCue } from '@modules/work-schedule/components/WorkScheduleDeadlineCue';
import { createWorkScheduleCapabilityHint } from '@modules/work-schedule/capability-hints';
import type {
  MonthlyRosterPreview,
  MonthlyRosterPublishResult,
  MonthlyRosterRecord,
  MonthlyRosterScope,
} from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import {
  Button,
  ErrorState,
  LoadingState,
  MetadataSection,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  SensitiveActionDialog,
  StatusBadge,
  TechnicalDetailsDisclosure,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';

type MonthlyRosterPublishReviewProps = {
  roster: MonthlyRosterRecord;
  scope?: MonthlyRosterScope;
  onPublished?: (result: MonthlyRosterPublishResult) => void;
};

type Freshness = 'generatedReady' | 'staleRefresh';

const formatNullableTimestamp = (value?: string | number | null): string =>
  value ? formatBusinessTimestamp(value) : '-';

const resolveFreshness = (preview: MonthlyRosterPreview): Freshness => {
  if (preview.currentPreviewHash && preview.currentPreviewHash !== preview.computedPreviewHash) {
    return 'staleRefresh';
  }

  return 'generatedReady';
};

const countBlockers = (preview?: MonthlyRosterPreview): number =>
  (preview?.rows ?? []).reduce((total, row) => total + row.blockers.length, 0);

const countWarnings = (preview?: MonthlyRosterPreview): number =>
  (preview?.rows ?? []).reduce((total, row) => total + row.warnings.length, 0);

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
  const warningCount = countWarnings(preview);
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

    if (!preview.computedPreviewHash) {
      return 'hashUnavailable';
    }

    if (freshness === 'staleRefresh') {
      return 'stale';
    }

    if (preview.summary.totalEligibleProfiles === 0) {
      return 'noEligibleMembers';
    }

    if (preview.summary.totalCandidateShiftsAfterExceptions === 0) {
      return 'noPublishableCandidates';
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
      <Button variant="primary" disabled>
        {t('work-schedule:monthlyRosters.publish.actions.openConfirmation')}
      </Button>
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
            ]}
            columns={1}
          />
          <TechnicalDetailsDisclosure
            label={t('work-schedule:monthlyRosters.publish.summary.adminMetadata')}
            details={{
              publishedByUserId: roster.publishedByUserId,
              publishGenerationRunId: roster.publishGenerationRunId,
            }}
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
        <div className="grid gap-3 lg:grid-cols-2">
          <WorkScheduleDeadlineCue targetMonth={roster.rosterMonth} cueType="PUBLISH_TARGET" />
          <WorkScheduleDeadlineCue targetMonth={roster.rosterMonth} cueType="FREEZE_REMINDER" />
        </div>

        <div className="space-y-2 rounded border border-border bg-bg px-3 py-3 text-sm text-muted">
          <p>{t('work-schedule:monthlyRosters.publish.copy.createShifts')}</p>
          <p>{t('work-schedule:monthlyRosters.publish.copy.draftPlanningOnly')}</p>
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
                label: t('work-schedule:monthlyRosters.preview.detail.conflicts'),
                value: String(preview.summary.totalConflicts),
              },
              {
                key: 'blockers',
                label: t('work-schedule:monthlyRosters.preview.detail.blockers'),
                value: String(blockerCount),
              },
              {
                key: 'warnings',
                label: t('work-schedule:monthlyRosters.preview.detail.warnings'),
                value: String(warningCount),
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

        {preview ? (
          <div className="rounded border border-border bg-bg p-3">
            <h3 className="text-sm font-semibold text-text">
              {t('work-schedule:monthlyRosters.publish.readiness.checklistTitle')}
            </h3>
            <ul className="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-2">
              <li>{t('work-schedule:monthlyRosters.publish.readiness.checklist.previewLoaded')}</li>
              <li>
                {t('work-schedule:monthlyRosters.publish.readiness.checklist.eligible', {
                  count: preview.summary.totalEligibleProfiles,
                })}
              </li>
              <li>
                {t('work-schedule:monthlyRosters.publish.readiness.checklist.candidates', {
                  count: preview.summary.totalCandidateShiftsAfterExceptions,
                })}
              </li>
              <li>
                {t('work-schedule:monthlyRosters.publish.readiness.checklist.issues', {
                  count: preview.summary.totalConflicts + blockerCount,
                })}
              </li>
              <li>
                {t('work-schedule:monthlyRosters.publish.readiness.checklist.warnings', {
                  count: warningCount,
                })}
              </li>
            </ul>
          </div>
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
            <TechnicalDetailsDisclosure
              className="mt-3 text-left text-xs text-muted"
              label={t('work-schedule:monthlyRosters.publish.summary.adminMetadata')}
              details={{
                sourceGenerationRunId: lastPublishResult.sourceGenerationRunId,
                computedPreviewHash: lastPublishResult.computedPreviewHash,
              }}
            />
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={!isPublishAllowed || publishMutation.isPending}
            onClick={() => setConfirming(true)}
          >
            {t('work-schedule:monthlyRosters.publish.actions.openConfirmation')}
          </Button>
        </div>
        <TechnicalDetailsDisclosure
          label={t('work-schedule:monthlyRosters.preview.detail.technicalDetails')}
          details={{
            workPatternId: roster.workPatternId,
            holidayCalendarId: roster.holidayCalendarId,
            expectedPreviewHash: preview?.computedPreviewHash,
          }}
        />
        <SensitiveActionDialog
          open={confirming && Boolean(preview)}
          title={t('work-schedule:monthlyRosters.publish.confirmation.title')}
          summary={t('work-schedule:monthlyRosters.publish.confirmation.copy')}
          riskItems={
            preview
              ? [
                  t('work-schedule:monthlyRosters.publish.confirmation.month', {
                    month: roster.rosterMonth,
                  }),
                  t('work-schedule:monthlyRosters.publish.confirmation.candidateSummary', {
                    eligible: preview.summary.totalEligibleProfiles,
                    candidates: preview.summary.totalCandidateShiftsAfterExceptions,
                  }),
                  t('work-schedule:monthlyRosters.publish.confirmation.issueSummary', {
                    conflicts: preview.summary.totalConflicts,
                    blockers: blockerCount,
                    warnings: warningCount,
                  }),
                  t('work-schedule:monthlyRosters.publish.confirmation.plannedScheduleBoundary'),
                ]
              : []
          }
          confirmLabel={t('work-schedule:monthlyRosters.publish.actions.confirm')}
          cancelLabel={t('common:actions.cancel')}
          tone="critical"
          isSubmitting={publishMutation.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void handlePublish()}
        />
      </div>
    </MetadataSection>
  );
};
