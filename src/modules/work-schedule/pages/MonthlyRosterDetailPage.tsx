import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';

import { createMonthlyRosterActionRailItems } from '@modules/work-schedule/actions/monthly-roster-action-rail';
import { MonthlyRosterExceptionEditor } from '@modules/work-schedule/components/MonthlyRosterExceptionEditor';
import { MonthlyRosterGeneratedWorkShifts } from '@modules/work-schedule/components/MonthlyRosterGeneratedWorkShifts';
import { MonthlyRosterPreviewPanel } from '@modules/work-schedule/components/MonthlyRosterPreviewPanel';
import { MonthlyRosterPublishReview } from '@modules/work-schedule/components/MonthlyRosterPublishReview';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { MonthlyRosterEditSurface } from '@modules/work-schedule/forms/monthly-roster-mutation-forms';
import {
  useAddRosterExceptionMutation,
  useArchiveMonthlyRosterMutation,
  useMonthlyRosterDetail,
  useRemoveRosterExceptionMutation,
  useUpdateRosterExceptionMutation,
  useUpdateMonthlyRosterDraftMutation,
} from '@modules/work-schedule/hooks/use-work-schedule';
import type {
  MonthlyRosterScope,
  MonthlyRosterPublishResult,
  RosterExceptionPayload,
  RosterExceptionRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ActionRail,
  ErrorState,
  LoadingState,
  MetadataSection,
  NotFoundState,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  ReferenceChip,
  StatusBadge,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface = 'edit-draft' | null;

const statusToneMap = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  LOCKED: 'info',
  ARCHIVED: 'muted',
} as const;

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const formatNullableTimestamp = (value?: string | number | null): string =>
  value ? formatUtcTimestamp(value) : '-';

const parseScope = (value: string | null): MonthlyRosterScope | undefined =>
  value === 'department' || value === 'global' ? value : undefined;

const readErrorMessage = (
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  if (!error?.message) {
    return t(fallbackKey);
  }

  if (error.message.includes(':')) {
    return t(error.message);
  }

  return error.message;
};

export const MonthlyRosterDetailPage = (): JSX.Element => {
  const { monthlyRosterId } = useParams<{ monthlyRosterId: string }>();
  const [searchParams] = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const detailQuery = useMonthlyRosterDetail(monthlyRosterId, scope);
  const updateMutation = useUpdateMonthlyRosterDraftMutation();
  const archiveMutation = useArchiveMonthlyRosterMutation();
  const addExceptionMutation = useAddRosterExceptionMutation();
  const updateExceptionMutation = useUpdateRosterExceptionMutation();
  const removeExceptionMutation = useRemoveRosterExceptionMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);
  const [exceptionError, setExceptionError] = useState<NormalizedApiError | null>(null);
  const [lastPublishResult, setLastPublishResult] = useState<MonthlyRosterPublishResult | null>(
    null,
  );

  useEffect(() => {
    setActiveSurface(null);
    setLastPublishResult(null);
  }, [monthlyRosterId]);

  const detailError = detailQuery.error as NormalizedApiError | null;
  const detailState = useMemo(() => {
    if (detailQuery.isPending) {
      return 'loading' as const;
    }

    if (detailQuery.isError) {
      if (detailError?.permissionDenied) {
        return 'denied' as const;
      }

      if (detailError?.notFound) {
        return 'not-found' as const;
      }

      return 'error' as const;
    }

    return 'ready' as const;
  }, [
    detailError?.notFound,
    detailError?.permissionDenied,
    detailQuery.isError,
    detailQuery.isPending,
  ]);

  const record = detailQuery.data;
  const activeExceptionCount =
    record?.exceptions?.filter((exception) => exception.status === 'ACTIVE').length ??
    record?.exceptionCount ??
    0;
  const structuralLocked = activeExceptionCount > 0;
  const isReadOnly = record?.status !== 'DRAFT';

  const onArchive = useCallback(async () => {
    if (!record) {
      return;
    }

    const confirmed = await requestDestructiveConfirm({
      description: t('work-schedule:monthlyRosters.confirm.archive'),
    });
    if (!confirmed) {
      return;
    }

    try {
      await archiveMutation.mutateAsync({
        monthlyRosterId: record.monthlyRosterId,
        scope,
      });
      notifySuccess('work-schedule:monthlyRosters.feedback.archived');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  }, [archiveMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, scope, t]);

  const onAddException = useCallback(
    async (payload: RosterExceptionPayload) => {
      if (!record) {
        return;
      }

      try {
        setExceptionError(null);
        await addExceptionMutation.mutateAsync({
          monthlyRosterId: record.monthlyRosterId,
          payload: { ...payload, scope },
        });
        notifySuccess('work-schedule:monthlyRosters.exceptions.feedback.added');
      } catch (error) {
        setExceptionError(error as NormalizedApiError);
        notifyError(error as NormalizedApiError);
        throw error;
      }
    },
    [addExceptionMutation, notifyError, notifySuccess, record, scope],
  );

  const onUpdateException = useCallback(
    async (exception: RosterExceptionRecord, payload: RosterExceptionPayload) => {
      if (!record) {
        return;
      }

      try {
        setExceptionError(null);
        await updateExceptionMutation.mutateAsync({
          monthlyRosterId: record.monthlyRosterId,
          rosterExceptionId: exception.rosterExceptionId,
          payload: { ...payload, scope },
        });
        notifySuccess('work-schedule:monthlyRosters.exceptions.feedback.updated');
      } catch (error) {
        setExceptionError(error as NormalizedApiError);
        notifyError(error as NormalizedApiError);
        throw error;
      }
    },
    [notifyError, notifySuccess, record, scope, updateExceptionMutation],
  );

  const onRemoveException = useCallback(
    async (exception: RosterExceptionRecord) => {
      if (!record) {
        return;
      }

      const confirmed = await requestDestructiveConfirm({
        description: t('work-schedule:monthlyRosters.exceptions.confirm.remove'),
      });
      if (!confirmed) {
        return;
      }

      try {
        setExceptionError(null);
        await removeExceptionMutation.mutateAsync({
          monthlyRosterId: record.monthlyRosterId,
          rosterExceptionId: exception.rosterExceptionId,
          scope,
        });
        notifySuccess('work-schedule:monthlyRosters.exceptions.feedback.removed');
      } catch (error) {
        setExceptionError(error as NormalizedApiError);
        notifyError(error as NormalizedApiError);
      }
    },
    [
      notifyError,
      notifySuccess,
      record,
      removeExceptionMutation,
      requestDestructiveConfirm,
      scope,
      t,
    ],
  );

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return createMonthlyRosterActionRailItems(t, record, {
      onEdit: () => setActiveSurface('edit-draft'),
      onArchive: () => void onArchive(),
      isArchivePending:
        archiveMutation.isPending &&
        archiveMutation.variables?.monthlyRosterId === record.monthlyRosterId,
    });
  }, [archiveMutation.isPending, archiveMutation.variables, onArchive, record, t]);

  return (
    <ModuleDetailScreenShell
      banner={<WorkScheduleSubnavigation active="monthly-rosters" />}
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`work-schedule:monthlyRosters.statuses.${record.status}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        isReadOnly && record ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('work-schedule:monthlyRosters.detail.readOnlyDraftSetup')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('work-schedule:monthlyRosters.detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'roster-code',
                  label: t('work-schedule:monthlyRosters.fields.rosterCode'),
                  value: <ReferenceChip label={record.rosterCode} />,
                },
                {
                  key: 'roster-month',
                  label: t('work-schedule:monthlyRosters.fields.rosterMonth'),
                  value: record.rosterMonth,
                },
                {
                  key: 'status',
                  label: t('work-schedule:monthlyRosters.fields.status'),
                  value: t(`work-schedule:monthlyRosters.statuses.${record.status}`),
                },
                {
                  key: 'timezone',
                  label: t('work-schedule:monthlyRosters.fields.timezone'),
                  value: record.timezone,
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('work-schedule:monthlyRosters.detail.setupTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'department',
                  label: t('work-schedule:monthlyRosters.fields.departmentOrgUnitId'),
                  value: record.departmentOrgUnitId,
                  monospace: true,
                },
                {
                  key: 'pattern',
                  label: t('work-schedule:monthlyRosters.fields.workPatternId'),
                  value: record.workPatternId,
                  monospace: true,
                },
                {
                  key: 'calendar',
                  label: t('work-schedule:monthlyRosters.fields.holidayCalendarId'),
                  value: record.holidayCalendarId,
                  monospace: true,
                },
                {
                  key: 'exception-count',
                  label: t('work-schedule:monthlyRosters.fields.exceptionCount'),
                  value: String(activeExceptionCount),
                },
                {
                  key: 'description',
                  label: t('work-schedule:monthlyRosters.fields.description'),
                  value: formatNullable(record.description),
                },
                {
                  key: 'external-ref',
                  label: t('work-schedule:monthlyRosters.fields.externalRef'),
                  value: formatNullable(record.externalRef),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      sections={
        record ? (
          <div className="space-y-4">
            {structuralLocked && record.status === 'DRAFT' ? (
              <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
                {t('work-schedule:monthlyRosters.detail.structuralLock')}
              </div>
            ) : null}
            {activeSurface === 'edit-draft' ? (
              <MonthlyRosterEditSurface
                initialValues={record}
                structuralLocked={structuralLocked}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await updateMutation.mutateAsync({
                      monthlyRosterId: record.monthlyRosterId,
                      payload,
                    });
                    notifySuccess('work-schedule:monthlyRosters.feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            <MetadataSection title={t('work-schedule:monthlyRosters.detail.draftSetupSection')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'created-at',
                    label: t('work-schedule:monthlyRosters.fields.createdAt'),
                    value: formatUtcTimestamp(record.createdAt),
                  },
                  {
                    key: 'updated-at',
                    label: t('work-schedule:monthlyRosters.fields.updatedAt'),
                    value: formatUtcTimestamp(record.updatedAt),
                  },
                  {
                    key: 'archived-at',
                    label: t('work-schedule:monthlyRosters.fields.archivedAt'),
                    value: formatNullableTimestamp(record.archivedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MonthlyRosterExceptionEditor
              roster={record}
              apiError={exceptionError}
              isAddPending={addExceptionMutation.isPending}
              isUpdatePending={updateExceptionMutation.isPending}
              isRemovePending={removeExceptionMutation.isPending}
              removingExceptionId={removeExceptionMutation.variables?.rosterExceptionId}
              onAdd={onAddException}
              onUpdate={onUpdateException}
              onRemove={onRemoveException}
              onClearError={() => setExceptionError(null)}
            />
            <MonthlyRosterPreviewPanel roster={record} scope={scope} />
            <MonthlyRosterPublishReview
              roster={record}
              scope={scope}
              onPublished={setLastPublishResult}
            />
            <MonthlyRosterGeneratedWorkShifts
              roster={record}
              scope={scope}
              publishResult={lastPublishResult}
            />
            <details className="rounded border border-border bg-panel p-4 shadow-shell">
              <summary className="cursor-pointer text-sm font-semibold text-text">
                {t('work-schedule:monthlyRosters.detail.adminMetadataTitle')}
              </summary>
              <div className="pt-3">
                <ReadOnlyFieldGrid
                  fields={[
                    {
                      key: 'draft-version',
                      label: t('work-schedule:monthlyRosters.fields.draftVersion'),
                      value: formatNullable(record.draftVersion),
                    },
                    {
                      key: 'preview-hash',
                      label: t('work-schedule:monthlyRosters.fields.currentPreviewHash'),
                      value: formatNullable(record.previewHash),
                    },
                    {
                      key: 'last-previewed-at',
                      label: t('work-schedule:monthlyRosters.fields.lastPreviewedAt'),
                      value: formatNullableTimestamp(record.lastPreviewedAt),
                    },
                    {
                      key: 'published-at',
                      label: t('work-schedule:monthlyRosters.fields.publishedAt'),
                      value: formatNullableTimestamp(record.publishedAt),
                    },
                    {
                      key: 'published-by',
                      label: t('work-schedule:monthlyRosters.fields.publishedBy'),
                      value: formatNullable(record.publishedByUserId),
                    },
                    {
                      key: 'generation-run',
                      label: t('work-schedule:monthlyRosters.fields.publishGenerationRunId'),
                      value: formatNullable(record.publishGenerationRunId),
                    },
                  ]}
                  columns={2}
                />
              </div>
            </details>
          </div>
        ) : undefined
      }
      actionRail={
        <ActionRail
          title={t('work-schedule:monthlyRosters.actionRail.title')}
          items={actionItems}
        />
      }
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('work-schedule:monthlyRosters.states.loadErrorTitle')}
          message={readErrorMessage(
            t,
            detailError,
            'work-schedule:monthlyRosters.states.loadErrorMessage',
          )}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
