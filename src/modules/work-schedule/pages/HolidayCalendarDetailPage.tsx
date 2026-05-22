import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { createHolidayCalendarActionRailItems } from '@modules/work-schedule/actions/holiday-calendar-action-rail';
import { createWorkScheduleCapabilityHint } from '@modules/work-schedule/capability-hints';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import {
  HolidayCalendarEditSurface,
  HolidayCalendarEntrySurface,
} from '@modules/work-schedule/forms/holiday-calendar-mutation-forms';
import {
  useAddHolidayCalendarEntryMutation,
  useHolidayCalendarDetail,
  useHolidayCalendarLifecycleMutation,
  useRemoveHolidayCalendarEntryMutation,
  useUpdateHolidayCalendarEntryMutation,
  useUpdateHolidayCalendarMutation,
} from '@modules/work-schedule/hooks/use-work-schedule';
import type {
  HolidayCalendarEntryRecord,
  HolidayCalendarLifecycleAction,
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
import {
  applyActionCapabilityHints,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import { formatCreatedDate, formatBusinessTimestamp } from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface =
  | 'edit-calendar'
  | 'add-entry'
  | { type: 'edit-entry'; entry: HolidayCalendarEntryRecord }
  | null;

const statusToneMap = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  ARCHIVED: 'muted',
} as const;

const entryStatusToneMap = {
  ACTIVE: 'success',
  REMOVED: 'muted',
} as const;

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const formatNullableTimestamp = (value?: string | number | null): string =>
  value ? formatBusinessTimestamp(value) : '-';

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

const readLifecycleConfirmKey = (action: HolidayCalendarLifecycleAction): string =>
  action === 'activate'
    ? 'work-schedule:holidayCalendars.confirm.activate'
    : 'work-schedule:holidayCalendars.confirm.archive';

export const HolidayCalendarDetailPage = (): JSX.Element => {
  const { holidayCalendarId } = useParams<{ holidayCalendarId: string }>();
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const detailQuery = useHolidayCalendarDetail(holidayCalendarId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const updateMutation = useUpdateHolidayCalendarMutation();
  const lifecycleMutation = useHolidayCalendarLifecycleMutation();
  const addEntryMutation = useAddHolidayCalendarEntryMutation();
  const updateEntryMutation = useUpdateHolidayCalendarEntryMutation();
  const removeEntryMutation = useRemoveHolidayCalendarEntryMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);
  const [showRemovedEntries, setShowRemovedEntries] = useState(false);

  useEffect(() => {
    setActiveSurface(null);
    setShowRemovedEntries(false);
  }, [holidayCalendarId]);

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
  const isArchived = record?.status === 'ARCHIVED';
  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );
  const visibleEntries = useMemo(() => {
    const entries = record?.entries ?? [];
    return showRemovedEntries ? entries : entries.filter((entry) => entry.status === 'ACTIVE');
  }, [record?.entries, showRemovedEntries]);
  const removedEntryCount =
    record?.entries.filter((entry) => entry.status === 'REMOVED').length ?? 0;

  const onLifecycleAction = useCallback(
    async (action: HolidayCalendarLifecycleAction) => {
      if (!record) {
        return;
      }

      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          holidayCalendarId: record.holidayCalendarId,
          action,
        });
        notifySuccess('work-schedule:holidayCalendars.feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onRemoveEntry = useCallback(
    async (entry: HolidayCalendarEntryRecord) => {
      if (!record) {
        return;
      }

      const confirmed = await requestDestructiveConfirm({
        description: t('work-schedule:holidayCalendars.entries.confirmRemove'),
      });
      if (!confirmed) {
        return;
      }

      try {
        await removeEntryMutation.mutateAsync({
          holidayCalendarId: record.holidayCalendarId,
          holidayCalendarEntryId: entry.holidayCalendarEntryId,
        });
        notifySuccess('work-schedule:holidayCalendars.feedback.entryRemoved');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [notifyError, notifySuccess, record, removeEntryMutation, requestDestructiveConfirm, t],
  );

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    const capabilityState = {
      capabilities: capabilitiesQuery.data,
      isLoading: capabilitiesQuery.isLoading,
      isError: capabilitiesQuery.isError,
    };
    const lifecycleHint = createWorkScheduleCapabilityHint({
      state: capabilityState,
      permission: PERMISSIONS.WORK_SCHEDULE_MANAGE_LIFECYCLE,
      copy: capabilityCopy,
    });

    return applyActionCapabilityHints(
      createHolidayCalendarActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit-calendar'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.holidayCalendarId === record.holidayCalendarId &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        edit: createWorkScheduleCapabilityHint({
          state: capabilityState,
          permission: PERMISSIONS.WORK_SCHEDULE_UPDATE,
          copy: capabilityCopy,
        }),
        activate: lifecycleHint,
        archive: lifecycleHint,
      },
    );
  }, [
    capabilitiesQuery.data,
    capabilitiesQuery.isError,
    capabilitiesQuery.isLoading,
    capabilityCopy,
    lifecycleMutation.isPending,
    lifecycleMutation.variables,
    onLifecycleAction,
    record,
    t,
  ]);

  return (
    <ModuleDetailScreenShell
      banner={<WorkScheduleSubnavigation active="holiday-calendars" />}
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`work-schedule:holidayCalendars.statuses.${record.status}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        isArchived ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('work-schedule:holidayCalendars.detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('work-schedule:holidayCalendars.detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'calendar-code',
                  label: t('work-schedule:holidayCalendars.fields.calendarCode'),
                  value: <ReferenceChip label={record.calendarCode} />,
                },
                {
                  key: 'name',
                  label: t('work-schedule:holidayCalendars.fields.name'),
                  value: record.name,
                },
                {
                  key: 'status',
                  label: t('work-schedule:holidayCalendars.fields.status'),
                  value: t(`work-schedule:holidayCalendars.statuses.${record.status}`),
                },
                {
                  key: 'scope',
                  label: t('work-schedule:holidayCalendars.fields.scopeType'),
                  value: t(`work-schedule:holidayCalendars.scopeTypes.${record.scopeType}`),
                },
                {
                  key: 'timezone',
                  label: t('work-schedule:holidayCalendars.fields.timezone'),
                  value: record.timezone,
                },
                {
                  key: 'description',
                  label: t('work-schedule:holidayCalendars.fields.description'),
                  value: formatNullable(record.description),
                },
                {
                  key: 'external-ref',
                  label: t('work-schedule:holidayCalendars.fields.externalRef'),
                  value: formatNullable(record.externalRef),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('work-schedule:holidayCalendars.detail.lifecycleTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'created-at',
                  label: t('work-schedule:holidayCalendars.fields.createdAt'),
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('work-schedule:holidayCalendars.fields.updatedAt'),
                  value: formatBusinessTimestamp(record.updatedAt),
                },
                {
                  key: 'activated-at',
                  label: t('work-schedule:holidayCalendars.fields.activatedAt'),
                  value: formatNullableTimestamp(record.activatedAt),
                },
                {
                  key: 'archived-at',
                  label: t('work-schedule:holidayCalendars.fields.archivedAt'),
                  value: formatNullableTimestamp(record.archivedAt),
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
            {activeSurface === 'edit-calendar' ? (
              <HolidayCalendarEditSurface
                initialValues={record}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await updateMutation.mutateAsync({
                      holidayCalendarId: record.holidayCalendarId,
                      payload,
                    });
                    notifySuccess('work-schedule:holidayCalendars.feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'add-entry' ? (
              <HolidayCalendarEntrySurface
                isPending={addEntryMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await addEntryMutation.mutateAsync({
                      holidayCalendarId: record.holidayCalendarId,
                      payload,
                    });
                    notifySuccess('work-schedule:holidayCalendars.feedback.entryAdded');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface && typeof activeSurface === 'object' ? (
              <HolidayCalendarEntrySurface
                initialValues={activeSurface.entry}
                isReadOnly={activeSurface.entry.status === 'REMOVED' || isArchived}
                isPending={updateEntryMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await updateEntryMutation.mutateAsync({
                      holidayCalendarId: record.holidayCalendarId,
                      holidayCalendarEntryId: activeSurface.entry.holidayCalendarEntryId,
                      payload,
                    });
                    notifySuccess('work-schedule:holidayCalendars.feedback.entryUpdated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            <MetadataSection
              title={t('work-schedule:holidayCalendars.entries.title')}
              subtitle={t('work-schedule:holidayCalendars.entries.description')}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={showRemovedEntries}
                    onChange={(event) => setShowRemovedEntries(event.target.checked)}
                  />
                  <span>
                    {t('work-schedule:holidayCalendars.entries.showRemoved', {
                      count: removedEntryCount,
                    })}
                  </span>
                </label>
                {!isArchived ? (
                  <button
                    type="button"
                    className="rounded border border-border bg-panel px-3 py-2 text-sm"
                    onClick={() => setActiveSurface('add-entry')}
                  >
                    {t('work-schedule:holidayCalendars.entries.add')}
                  </button>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-bg text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">
                        {t('work-schedule:holidayCalendars.entries.date')}
                      </th>
                      <th className="px-3 py-2">
                        {t('work-schedule:holidayCalendars.entries.name')}
                      </th>
                      <th className="px-3 py-2">
                        {t('work-schedule:holidayCalendars.entries.type')}
                      </th>
                      <th className="px-3 py-2">
                        {t('work-schedule:holidayCalendars.entries.status')}
                      </th>
                      <th className="px-3 py-2">
                        {t('work-schedule:holidayCalendars.fields.description')}
                      </th>
                      <th className="px-3 py-2">
                        {t('work-schedule:holidayCalendars.fields.externalRef')}
                      </th>
                      <th className="px-3 py-2">
                        {t('work-schedule:holidayCalendars.table.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleEntries.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-muted" colSpan={7}>
                          {t('work-schedule:holidayCalendars.entries.empty')}
                        </td>
                      </tr>
                    ) : (
                      visibleEntries.map((entry) => (
                        <tr key={entry.holidayCalendarEntryId}>
                          <td className="px-3 py-2 font-mono">{entry.date}</td>
                          <td className="px-3 py-2">{entry.name}</td>
                          <td className="px-3 py-2">
                            {t(`work-schedule:holidayCalendars.entryTypes.${entry.entryType}`)}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              status={entry.status}
                              label={t(
                                `work-schedule:holidayCalendars.entryStatuses.${entry.status}`,
                              )}
                              toneByStatus={entryStatusToneMap}
                            />
                          </td>
                          <td className="px-3 py-2">{formatNullable(entry.description)}</td>
                          <td className="px-3 py-2">{formatNullable(entry.externalRef)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded border border-border px-2 py-1 text-xs"
                                onClick={() => setActiveSurface({ type: 'edit-entry', entry })}
                              >
                                {entry.status === 'REMOVED' || isArchived
                                  ? t('work-schedule:holidayCalendars.entries.view')
                                  : t('work-schedule:holidayCalendars.entries.edit')}
                              </button>
                              {entry.status === 'ACTIVE' && !isArchived ? (
                                <button
                                  type="button"
                                  className="rounded border border-danger/40 px-2 py-1 text-xs text-danger"
                                  disabled={removeEntryMutation.isPending}
                                  onClick={() => void onRemoveEntry(entry)}
                                >
                                  {t('work-schedule:holidayCalendars.entries.remove')}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </MetadataSection>
          </div>
        ) : undefined
      }
      actionRail={
        <ActionRail
          title={t('work-schedule:holidayCalendars.actionRail.title')}
          items={actionItems}
        />
      }
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('work-schedule:holidayCalendars.states.loadErrorTitle')}
          message={readErrorMessage(
            t,
            detailError,
            'work-schedule:holidayCalendars.states.loadErrorMessage',
          )}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
