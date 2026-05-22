import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { createWorkPatternActionRailItems } from '@modules/work-schedule/actions/work-pattern-action-rail';
import { createWorkScheduleCapabilityHint } from '@modules/work-schedule/capability-hints';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { WorkPatternEditSurface } from '@modules/work-schedule/forms/work-pattern-mutation-forms';
import {
  useUpdateWorkPatternMutation,
  useWorkPatternDetail,
  useWorkPatternLifecycleMutation,
} from '@modules/work-schedule/hooks/use-work-schedule';
import type {
  WorkPatternLifecycleAction,
  WorkPatternRecord,
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

type ActiveSurface = 'edit' | null;

const statusToneMap = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  ARCHIVED: 'muted',
} as const;

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const formatNullableTimestamp = (value?: string | number | null): string =>
  value ? formatBusinessTimestamp(value) : '-';

const formatWorkingDays = (t: (key: string) => string, record: WorkPatternRecord): string =>
  record.workingDays.map((day) => t(`work-schedule:patterns.weekdays.${day}`)).join(', ');

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

const readLifecycleConfirmKey = (action: WorkPatternLifecycleAction): string =>
  action === 'activate'
    ? 'work-schedule:patterns.confirm.activate'
    : 'work-schedule:patterns.confirm.archive';

export const WorkPatternDetailPage = (): JSX.Element => {
  const { workPatternId } = useParams<{ workPatternId: string }>();
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const detailQuery = useWorkPatternDetail(workPatternId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const updateMutation = useUpdateWorkPatternMutation();
  const lifecycleMutation = useWorkPatternLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [workPatternId]);

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
  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  const onLifecycleAction = useCallback(
    async (action: WorkPatternLifecycleAction) => {
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
          workPatternId: record.workPatternId,
          action,
        });
        notifySuccess('work-schedule:patterns.feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
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
      createWorkPatternActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.workPatternId === record.workPatternId &&
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
      banner={<WorkScheduleSubnavigation active="work-patterns" />}
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`work-schedule:patterns.statuses.${record.status}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.status === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('work-schedule:patterns.detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('work-schedule:patterns.detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'pattern-code',
                  label: t('work-schedule:patterns.fields.patternCode'),
                  value: <ReferenceChip label={record.patternCode} />,
                },
                {
                  key: 'name',
                  label: t('work-schedule:patterns.fields.name'),
                  value: record.name,
                },
                {
                  key: 'status',
                  label: t('work-schedule:patterns.fields.status'),
                  value: t(`work-schedule:patterns.statuses.${record.status}`),
                },
                {
                  key: 'timezone',
                  label: t('work-schedule:patterns.fields.timezone'),
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
          <MetadataSection title={t('work-schedule:patterns.detail.scheduleTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'start',
                  label: t('work-schedule:patterns.fields.startLocalTime'),
                  value: record.startLocalTime,
                },
                {
                  key: 'working-minutes',
                  label: t('work-schedule:patterns.fields.workingMinutes'),
                  value: String(record.workingMinutes),
                },
                {
                  key: 'break-minutes',
                  label: t('work-schedule:patterns.fields.breakMinutes'),
                  value: String(record.breakMinutes),
                },
                {
                  key: 'end',
                  label: t('work-schedule:patterns.fields.calculatedEndLocalTime'),
                  value: record.endLocalTime,
                },
                {
                  key: 'working-days',
                  label: t('work-schedule:patterns.fields.workingDays'),
                  value: formatWorkingDays(t, record),
                },
                {
                  key: 'description',
                  label: t('work-schedule:patterns.fields.description'),
                  value: formatNullable(record.description),
                },
                {
                  key: 'external-ref',
                  label: t('work-schedule:patterns.fields.externalRef'),
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
            <MetadataSection title={t('work-schedule:patterns.detail.lifecycleTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'created-at',
                    label: t('work-schedule:patterns.fields.createdAt'),
                    value: formatCreatedDate(record.createdAt),
                  },
                  {
                    key: 'updated-at',
                    label: t('work-schedule:patterns.fields.updatedAt'),
                    value: formatBusinessTimestamp(record.updatedAt),
                  },
                  {
                    key: 'activated-at',
                    label: t('work-schedule:patterns.fields.activatedAt'),
                    value: formatNullableTimestamp(record.activatedAt),
                  },
                  {
                    key: 'archived-at',
                    label: t('work-schedule:patterns.fields.archivedAt'),
                    value: formatNullableTimestamp(record.archivedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            {activeSurface === 'edit' ? (
              <WorkPatternEditSurface
                initialValues={record}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await updateMutation.mutateAsync({
                      workPatternId: record.workPatternId,
                      payload,
                    });
                    notifySuccess('work-schedule:patterns.feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
          </div>
        ) : undefined
      }
      actionRail={
        <ActionRail title={t('work-schedule:patterns.actionRail.title')} items={actionItems} />
      }
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('work-schedule:patterns.states.loadErrorTitle')}
          message={readErrorMessage(
            t,
            detailError,
            'work-schedule:patterns.states.loadErrorMessage',
          )}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
