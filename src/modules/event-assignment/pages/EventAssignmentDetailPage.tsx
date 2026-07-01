import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { buildEntityDetailHref } from '@app/router/reference-links';
import { createEventActionRailItems } from '@modules/event-assignment/actions/event-assignment-action-rail';
import {
  EventCompletionEvidenceSurface,
  EventEditSurface,
  EventLifecycleReasonSurface,
  EventReplaceAssignmentsSurface,
  EventReplacePlatformAccountsSurface,
  EventRescheduleSurface,
} from '@modules/event-assignment/forms/event-assignment-mutation-forms';
import {
  useEventAssignments,
  useEventDetail,
  useEventLifecycleMutation,
  useEventStudioBookings,
  useReplaceEventAssignmentsMutation,
  useReplaceEventPlatformAccountsMutation,
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
  EventCompletionEvidenceRef,
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
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  applyActionCapabilityHints,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import {
  formatCreatedDate,
  formatVietnamTimestamp,
  readReferenceDisplay,
  type ReferenceSummary,
} from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface =
  | 'edit'
  | 'reschedule'
  | 'replace-assignments'
  | 'replace-platform-accounts'
  | 'complete'
  | 'cancel'
  | null;

const statusToneMap = {
  DRAFT: 'muted',
  PLANNED: 'info',
  CONFIRMED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  ARCHIVED: 'muted',
} as const;

const bookingStatusToneMap = {
  HELD: 'warning',
  CONFIRMED: 'success',
  RELEASED: 'muted',
  CANCELLED: 'danger',
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

const createReferenceMap = (
  refs: readonly ReferenceSummary[] | undefined,
): ReadonlyMap<string, ReferenceSummary> => new Map((refs ?? []).map((ref) => [ref.id, ref]));

const formatReferenceList = (
  ids: readonly string[],
  refsById: ReadonlyMap<string, ReferenceSummary>,
): string => {
  if (ids.length === 0) {
    return '-';
  }

  return ids.map((id) => readReferenceDisplay(refsById.get(id), id)).join(', ');
};

const formatEvidenceRefValue = (ref: EventCompletionEvidenceRef, fallback: string): string =>
  ref.url ?? ref.referenceId ?? ref.label ?? fallback;

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
  const capabilitiesQuery = useCurrentActorCapabilities();
  const assignmentsQuery = useEventAssignments(eventId);
  const bookingsQuery = useEventStudioBookings(eventId);
  const updateMutation = useUpdateEventMutation();
  const rescheduleMutation = useRescheduleEventMutation();
  const replaceAssignmentsMutation = useReplaceEventAssignmentsMutation();
  const replacePlatformAccountsMutation = useReplaceEventPlatformAccountsMutation();
  const lifecycleMutation = useEventLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
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
  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  const studioResourceRefsById = useMemo(
    () => createReferenceMap(record?.studioResourceRefs),
    [record?.studioResourceRefs],
  );
  const platformAccountRefsById = useMemo(
    () => createReferenceMap(record?.platformAccountRefs),
    [record?.platformAccountRefs],
  );
  const assignmentInputs = useMemo(
    () => assignments.map((assignment) => assignmentToInput(assignment)),
    [assignments],
  );
  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  const onLifecycleAction = useCallback(
    async (action: EventLifecycleAction) => {
      if (!record) {
        return;
      }

      if (action === 'cancel') {
        setActiveSurface('cancel');
        return;
      }

      if (action === 'complete') {
        setActiveSurface('complete');
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
    [lifecycleMutation, notifyError, notifySuccess, record],
  );

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    const eventUpdateRequirement = {
      permission: PERMISSIONS.EVENT_UPDATE,
      scope: { module: 'eventAssignment' as const, value: 'global' as const },
    };
    const lifecycleRequirement = {
      permission: PERMISSIONS.EVENT_MANAGE_LIFECYCLE,
      scope: { module: 'eventAssignment' as const, value: 'global' as const },
    };

    return applyActionCapabilityHints(
      createEventActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onReschedule: () => setActiveSurface('reschedule'),
        onReplaceAssignments: () => {
          if (assignmentsQuery.isSuccess) {
            setActiveSurface('replace-assignments');
          }
        },
        onReplacePlatformAccounts: () => setActiveSurface('replace-platform-accounts'),
        onLifecycleAction,
        assignmentRosterKnown: assignmentsQuery.isSuccess,
        hasActiveAssignments: assignments.length > 0,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.eventId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        edit: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          eventUpdateRequirement,
          capabilityCopy,
        ),
        reschedule: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          eventUpdateRequirement,
          capabilityCopy,
        ),
        'replace-assignments': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          {
            permission: PERMISSIONS.EVENT_MANAGE_ASSIGNMENTS,
            scope: { module: 'eventAssignment', value: 'global' },
          },
          capabilityCopy,
        ),
        'replace-platform-accounts': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          eventUpdateRequirement,
          capabilityCopy,
        ),
        plan: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          lifecycleRequirement,
          capabilityCopy,
        ),
        confirm: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          lifecycleRequirement,
          capabilityCopy,
        ),
        complete: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          lifecycleRequirement,
          capabilityCopy,
        ),
        cancel: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          lifecycleRequirement,
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          lifecycleRequirement,
          capabilityCopy,
        ),
      },
    );
  }, [
    assignments.length,
    assignmentsQuery.isSuccess,
    capabilityCopy,
    capabilitiesQuery.data,
    capabilitiesQuery.isError,
    capabilitiesQuery.isLoading,
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
      banner={
        record ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('event-assignment:detail.boundaryHelper')}
          </div>
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
                  label: t('event-assignment:generatedCode.label'),
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
                  key: 'owner',
                  label: t('event-assignment:fields.ownerEmploymentProfileId'),
                  value: readReferenceDisplay(
                    record.ownerEmploymentProfileRef,
                    record.ownerEmploymentProfileId,
                  ),
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
                  value: formatVietnamTimestamp(record.eventStartAt),
                },
                {
                  key: 'end',
                  label: t('event-assignment:fields.eventEndAt'),
                  value: formatVietnamTimestamp(record.eventEndAt),
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
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('event-assignment:fields.updatedAt'),
                  value: formatVietnamTimestamp(record.updatedAt),
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
            <MetadataSection title={t('event-assignment:detail.bookingTitle')}>
              {bookingsQuery.isError ? (
                <ErrorState
                  title={t('event-assignment:bookings.loadErrorTitle')}
                  message={readErrorMessage(
                    t,
                    bookingsQuery.error as unknown as NormalizedApiError | null,
                    'event-assignment:bookings.loadErrorMessage',
                  )}
                  actionLabel={t('common:actions.retry')}
                  onRetry={() => void bookingsQuery.refetch()}
                />
              ) : bookings.length === 0 ? (
                <p className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
                  {t('event-assignment:bookings.emptyMessage')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">
                          {t('event-assignment:bookings.resource')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('event-assignment:bookings.status')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('event-assignment:bookings.window')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('event-assignment:bookings.conflict')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bookings.map((booking) => (
                        <tr key={booking.id}>
                          <td className="px-3 py-3">
                            {readReferenceDisplay(
                              booking.studioResourceRef,
                              booking.studioResourceId,
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              status={booking.status}
                              label={t(`event-assignment:bookingStatuses.${booking.status}`)}
                              toneByStatus={bookingStatusToneMap}
                            />
                          </td>
                          <td className="px-3 py-3">
                            {formatVietnamTimestamp(booking.bookingStartAt)} -{' '}
                            {formatVietnamTimestamp(booking.bookingEndAt)}
                          </td>
                          <td className="px-3 py-3">
                            {booking.hasConfirmedConflict
                              ? t('event-assignment:bookings.confirmedConflict')
                              : booking.status === 'HELD'
                                ? t('event-assignment:bookings.heldReview')
                                : t('event-assignment:bookings.noConflict')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-sm text-muted">
                {t('event-assignment:detail.bookingReadOnlyHelper')}
              </p>
            </MetadataSection>
            <MetadataSection title={t('event-assignment:evidence.title')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'completed-at',
                    label: t('event-assignment:fields.completedAt'),
                    value: record.completionEvidence?.completedAt
                      ? formatVietnamTimestamp(record.completionEvidence.completedAt)
                      : '-',
                  },
                  {
                    key: 'completed-by',
                    label: t('event-assignment:fields.completedBy'),
                    value: formatNullable(
                      record.completionEvidence?.completedByActorId ?? record.completedByActorId,
                    ),
                  },
                  {
                    key: 'evidence-note',
                    label: t('event-assignment:fields.evidenceNote'),
                    value: formatNullable(record.completionEvidence?.evidenceNote),
                  },
                ]}
                columns={2}
              />
              {record.completionEvidence?.evidenceRefs.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {record.completionEvidence.evidenceRefs.map((ref, index) => (
                    <li
                      key={`${ref.type}-${index}`}
                      className="rounded border border-border bg-panel px-3 py-2"
                    >
                      <span className="font-medium">
                        {ref.label ?? t(`event-assignment:evidence.refTypes.${ref.type}`)}
                      </span>
                      <span className="ml-2 text-muted">
                        {t(`event-assignment:evidence.refTypes.${ref.type}`)}
                      </span>
                      {ref.url ? (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-accent hover:underline"
                        >
                          {ref.url}
                        </a>
                      ) : (
                        <span className="ml-2 text-muted">
                          {formatEvidenceRefValue(
                            ref,
                            t('event-assignment:evidence.referenceUnavailable'),
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
                  {t('event-assignment:evidence.notCompleted')}
                </p>
              )}
              <p className="mt-2 text-sm text-muted">
                {t('event-assignment:evidence.boundaryHelper')}
              </p>
            </MetadataSection>
            <MetadataSection title={t('event-assignment:detail.referencesTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'studio-resources',
                    label: t('event-assignment:fields.derivedStudioResourceIds'),
                    value: formatReferenceList(record.studioResourceIds, studioResourceRefsById),
                  },
                  {
                    key: 'platform-accounts',
                    label: t('event-assignment:fields.platformAccountIds'),
                    value: formatReferenceList(record.platformAccountIds, platformAccountRefsById),
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
            {activeSurface === 'cancel' ? (
              <EventLifecycleReasonSurface
                isPending={
                  lifecycleMutation.isPending &&
                  lifecycleMutation.variables?.eventId === record.id &&
                  lifecycleMutation.variables?.action === 'cancel'
                }
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await lifecycleMutation.mutateAsync({
                      eventId: record.id,
                      action: 'cancel',
                      payload,
                    });
                    notifySuccess('event-assignment:feedback.lifecycleUpdated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'complete' ? (
              <EventCompletionEvidenceSurface
                isPending={
                  lifecycleMutation.isPending &&
                  lifecycleMutation.variables?.eventId === record.id &&
                  lifecycleMutation.variables?.action === 'complete'
                }
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await lifecycleMutation.mutateAsync({
                      eventId: record.id,
                      action: 'complete',
                      payload,
                    });
                    notifySuccess('event-assignment:feedback.lifecycleUpdated');
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
              {record.studioResourceIds.map((referenceId) => {
                const href = buildEntityDetailHref('studioResource', referenceId);
                const label = readReferenceDisplay(
                  studioResourceRefsById.get(referenceId),
                  referenceId,
                );
                return (
                  <div
                    key={`studio-${referenceId}`}
                    className="rounded border border-border bg-bg px-3 py-2"
                  >
                    <p className="text-xs font-medium uppercase text-muted">
                      {t('event-assignment:related.studioResource')}
                    </p>
                    {href ? (
                      <Link
                        to={href}
                        className="mt-1 inline-flex text-sm text-accent hover:underline"
                      >
                        {label}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-muted">
                        {t('event-assignment:related.unavailable')}
                      </p>
                    )}
                  </div>
                );
              })}
              {record.platformAccountIds.map((referenceId) => {
                const href = buildEntityDetailHref('platformAccount', referenceId);
                const label = readReferenceDisplay(
                  platformAccountRefsById.get(referenceId),
                  referenceId,
                );
                return (
                  <div
                    key={`platform-${referenceId}`}
                    className="rounded border border-border bg-bg px-3 py-2"
                  >
                    <p className="text-xs font-medium uppercase text-muted">
                      {t('event-assignment:related.platformAccount')}
                    </p>
                    {href ? (
                      <Link
                        to={href}
                        className="mt-1 inline-flex text-sm text-accent hover:underline"
                      >
                        {label}
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
          technicalDetails={detailError}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
