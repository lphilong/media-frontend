import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { buildEntityDetailHref } from '@app/router/reference-links';
import { createEventActionRailItems } from '@modules/event-assignment/actions/event-assignment-action-rail';
import {
  EventEditSurface,
  EventReplaceAssignmentsSurface,
  EventReplacePlatformAccountsSurface,
  EventReplaceStudioResourcesSurface,
  EventRescheduleSurface,
} from '@modules/event-assignment/forms/event-assignment-mutation-forms';
import {
  useEventAssignments,
  useEventDetail,
  useEventLifecycleMutation,
  useReplaceEventAssignmentsMutation,
  useReplaceEventPlatformAccountsMutation,
  useReplaceEventStudioResourcesMutation,
  useRescheduleEventMutation,
  useUpdateEventMutation,
} from '@modules/event-assignment/hooks/use-event-assignment';
import {
  createEventAssignmentRosterColumns,
  readEventAssignmentSubjectId,
} from '@modules/event-assignment/tables/event-assignment-columns';
import type {
  EventAssignmentInput,
  EventAssignmentItem,
  EventLifecycleAction,
} from '@modules/event-assignment/types/event-assignment.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ActionRail,
  AdminTableShell,
  ErrorState,
  LoadingState,
  MetadataSection,
  NotFoundState,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  ReferenceChip,
  RelatedSectionShell,
  StatusBadge,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface =
  | 'edit'
  | 'reschedule'
  | 'replace-assignments'
  | 'replace-studio-resources'
  | 'replace-platform-accounts'
  | null;

const statusToneMap = {
  SCHEDULED: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  ARCHIVED: 'muted',
} as const;

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

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

const readLifecycleConfirmKey = (action: EventLifecycleAction): string => {
  switch (action) {
    case 'start':
      return 'event-assignment:confirm.start';
    case 'complete':
      return 'event-assignment:confirm.complete';
    case 'cancel':
      return 'event-assignment:confirm.cancel';
    case 'archive':
      return 'event-assignment:confirm.archive';
    default:
      return 'event-assignment:confirm.archive';
  }
};

const assignmentToInput = (assignment: EventAssignmentItem): EventAssignmentInput => {
  return {
    assignmentKind: assignment.assignmentKind,
    assignmentEmploymentProfileId: assignment.assignmentEmploymentProfileId,
    assignmentTalentId: assignment.assignmentTalentId,
    assignmentTalentGroupId: assignment.assignmentTalentGroupId,
  };
};

const buildAssignmentSubjectHref = (assignment: EventAssignmentItem): string | undefined => {
  const subjectId = readEventAssignmentSubjectId(assignment);
  if (assignment.assignmentKind === 'EMPLOYMENT_PROFILE') {
    return buildEntityDetailHref('employmentProfile', subjectId);
  }

  if (assignment.assignmentKind === 'TALENT') {
    return buildEntityDetailHref('talent', subjectId);
  }

  return buildEntityDetailHref('talentGroup', subjectId);
};

export const EventAssignmentDetailPage = (): JSX.Element => {
  const { eventId } = useParams<{ eventId: string }>();
  const { t } = useTranslation(['event-assignment', 'common', 'errors']);
  const navigate = useNavigate();

  const detailQuery = useEventDetail(eventId);
  const assignmentsQuery = useEventAssignments(eventId);
  const updateMutation = useUpdateEventMutation();
  const rescheduleMutation = useRescheduleEventMutation();
  const replaceAssignmentsMutation = useReplaceEventAssignmentsMutation();
  const replaceStudioResourcesMutation = useReplaceEventStudioResourcesMutation();
  const replacePlatformAccountsMutation = useReplaceEventPlatformAccountsMutation();
  const lifecycleMutation = useEventLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [eventId]);

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
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const assignmentInputs = useMemo(
    () => assignments.map((assignment) => assignmentToInput(assignment)),
    [assignments],
  );

  const onLifecycleAction = useCallback(
    async (action: EventLifecycleAction) => {
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
          eventId: record.id,
          action,
        });
        notifySuccess('event-assignment:feedback.lifecycleUpdated');
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

    return createEventActionRailItems(t, record, {
      onEdit: () => setActiveSurface('edit'),
      onReschedule: () => setActiveSurface('reschedule'),
      onReplaceAssignments: () => {
        if (assignmentsQuery.isSuccess) {
          setActiveSurface('replace-assignments');
        }
      },
      onReplaceStudioResources: () => setActiveSurface('replace-studio-resources'),
      onReplacePlatformAccounts: () => setActiveSurface('replace-platform-accounts'),
      onLifecycleAction,
      assignmentRosterKnown: assignmentsQuery.isSuccess,
      hasActiveAssignments: assignments.length > 0,
      isLifecyclePending: (action) =>
        lifecycleMutation.isPending &&
        lifecycleMutation.variables?.eventId === record.id &&
        lifecycleMutation.variables?.action === action,
    });
  }, [
    assignments.length,
    assignmentsQuery.isSuccess,
    lifecycleMutation.isPending,
    lifecycleMutation.variables,
    onLifecycleAction,
    record,
    t,
  ]);

  const rosterColumns = useMemo(
    () =>
      createEventAssignmentRosterColumns(t, (assignment) => {
        const href = buildAssignmentSubjectHref(assignment);
        if (href) {
          navigate(href);
        }
      }),
    [navigate, t],
  );

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`event-assignment:statuses.${record.status}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.status === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('event-assignment:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('event-assignment:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'event-code',
                  label: t('event-assignment:fields.eventCode'),
                  value: <ReferenceChip label={record.eventCode} />,
                },
                {
                  key: 'title',
                  label: t('event-assignment:fields.title'),
                  value: record.title,
                },
                {
                  key: 'status',
                  label: t('event-assignment:fields.status'),
                  value: t(`event-assignment:statuses.${record.status}`),
                },
                {
                  key: 'scope',
                  label: t('event-assignment:fields.scopeBoundary'),
                  value: t('event-assignment:detail.globalOnly'),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('event-assignment:detail.scheduleTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'start',
                  label: t('event-assignment:fields.eventStartAt'),
                  value: formatUtcTimestamp(record.eventStartAt),
                },
                {
                  key: 'end',
                  label: t('event-assignment:fields.eventEndAt'),
                  value: formatUtcTimestamp(record.eventEndAt),
                },
                {
                  key: 'description',
                  label: t('event-assignment:fields.description'),
                  value: formatNullable(record.description),
                },
                {
                  key: 'external-ref',
                  label: t('event-assignment:fields.externalRef'),
                  value: formatNullable(record.externalRef),
                },
                {
                  key: 'created-at',
                  label: t('event-assignment:fields.createdAt'),
                  value: formatUtcTimestamp(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('event-assignment:fields.updatedAt'),
                  value: formatUtcTimestamp(record.updatedAt),
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
            <MetadataSection title={t('event-assignment:detail.referencesTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'studio-resources',
                    label: t('event-assignment:fields.studioResourceIds'),
                    value:
                      record.studioResourceIds.length > 0
                        ? record.studioResourceIds.join(', ')
                        : '-',
                  },
                  {
                    key: 'platform-accounts',
                    label: t('event-assignment:fields.platformAccountIds'),
                    value:
                      record.platformAccountIds.length > 0
                        ? record.platformAccountIds.join(', ')
                        : '-',
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            {activeSurface === 'edit' ? (
              <EventEditSurface
                initialValues={record}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await updateMutation.mutateAsync({
                      eventId: record.id,
                      payload,
                    });
                    notifySuccess('event-assignment:feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'reschedule' ? (
              <EventRescheduleSurface
                initialValues={record}
                isPending={rescheduleMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await rescheduleMutation.mutateAsync({
                      eventId: record.id,
                      payload,
                    });
                    notifySuccess('event-assignment:feedback.rescheduled');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'replace-assignments' ? (
              <EventReplaceAssignmentsSurface
                initialAssignments={assignmentInputs}
                rosterAvailable={assignmentsQuery.isSuccess}
                isPending={replaceAssignmentsMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await replaceAssignmentsMutation.mutateAsync({
                      eventId: record.id,
                      payload,
                    });
                    notifySuccess('event-assignment:feedback.assignmentsReplaced');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'replace-studio-resources' ? (
              <EventReplaceStudioResourcesSurface
                initialResourceIds={record.studioResourceIds}
                isPending={replaceStudioResourcesMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await replaceStudioResourcesMutation.mutateAsync({
                      eventId: record.id,
                      payload,
                    });
                    notifySuccess('event-assignment:feedback.studioResourcesReplaced');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'replace-platform-accounts' ? (
              <EventReplacePlatformAccountsSurface
                initialPlatformAccountIds={record.platformAccountIds}
                isPending={replacePlatformAccountsMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await replacePlatformAccountsMutation.mutateAsync({
                      eventId: record.id,
                      payload,
                    });
                    notifySuccess('event-assignment:feedback.platformAccountsReplaced');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            <RelatedSectionShell title={t('event-assignment:assignments.title')}>
              {assignmentsQuery.isError ? (
                <ErrorState
                  title={t('event-assignment:assignments.loadErrorTitle')}
                  message={readErrorMessage(
                    t,
                    assignmentsQuery.error as unknown as NormalizedApiError | null,
                    'event-assignment:assignments.loadErrorMessage',
                  )}
                  actionLabel={t('common:actions.retry')}
                  onRetry={() => void assignmentsQuery.refetch()}
                />
              ) : (
                <AdminTableShell
                  data={assignments}
                  columns={rosterColumns}
                  isLoading={assignmentsQuery.isFetching && !assignmentsQuery.data}
                  emptyTitle={t('event-assignment:assignments.emptyTitle')}
                  emptyMessage={t('event-assignment:assignments.emptyMessage')}
                  caption={t('event-assignment:assignments.caption')}
                />
              )}
            </RelatedSectionShell>
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <RelatedSectionShell title={t('event-assignment:related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[...record.studioResourceIds, ...record.platformAccountIds].map((referenceId) => {
                const isStudio = record.studioResourceIds.includes(referenceId);
                const href = buildEntityDetailHref(
                  isStudio ? 'studioResource' : 'platformAccount',
                  referenceId,
                );
                return (
                  <div
                    key={`${isStudio ? 'studio' : 'platform'}-${referenceId}`}
                    className="rounded border border-border bg-bg px-3 py-2"
                  >
                    <p className="text-xs font-medium uppercase text-muted">
                      {isStudio
                        ? t('event-assignment:related.studioResource')
                        : t('event-assignment:related.platformAccount')}
                    </p>
                    {href ? (
                      <Link
                        to={href}
                        className="mt-1 inline-flex font-mono text-sm text-accent hover:underline"
                      >
                        {referenceId}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-muted">
                        {t('event-assignment:related.unavailable')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('event-assignment:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('event-assignment:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'event-assignment:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
