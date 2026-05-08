import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { buildEntityDetailHref } from '@app/router/reference-links';
import { createWorkShiftActionRailItems } from '@modules/work-schedule/actions/work-schedule-action-rail';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import {
  WorkShiftEditSurface,
  WorkShiftReassignSubjectSurface,
  WorkShiftReplaceResourcesSurface,
  WorkShiftRescheduleSurface,
} from '@modules/work-schedule/forms/work-schedule-mutation-forms';
import {
  useReassignWorkShiftSubjectMutation,
  useReplaceWorkShiftResourcesMutation,
  useRescheduleWorkShiftMutation,
  useUpdateWorkShiftMutation,
  useWorkShiftDetail,
  useWorkShiftLifecycleMutation,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { readWorkShiftSubjectId } from '@modules/work-schedule/tables/work-schedule-columns';
import { canUseWorkScheduleSubjectInScope } from '@modules/work-schedule/scope-guards';
import type { WorkShiftLifecycleAction } from '@modules/work-schedule/types/work-schedule.types';
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
  RelatedSectionShell,
  StatusBadge,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';
import { parseWorkScheduleScope } from '@shared/query';

type ActiveSurface = 'edit' | 'reschedule' | 'reassign-subject' | 'replace-resources' | null;

const statusToneMap = {
  ACTIVE: 'success',
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

const readLifecycleConfirmKey = (action: WorkShiftLifecycleAction): string => {
  return action === 'cancel' ? 'work-schedule:confirm.cancel' : 'work-schedule:confirm.archive';
};

export const WorkScheduleDetailPage = (): JSX.Element => {
  const { workShiftId } = useParams<{ workShiftId: string }>();
  const [searchParams] = useSearchParams();
  const scope = useMemo(() => parseWorkScheduleScope(searchParams), [searchParams]);
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);

  const detailQuery = useWorkShiftDetail(workShiftId, scope);
  const updateMutation = useUpdateWorkShiftMutation();
  const rescheduleMutation = useRescheduleWorkShiftMutation();
  const reassignMutation = useReassignWorkShiftSubjectMutation();
  const replaceResourcesMutation = useReplaceWorkShiftResourcesMutation();
  const lifecycleMutation = useWorkShiftLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [workShiftId]);

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
  const sourceType = record?.sourceType ?? 'MANUAL';

  const onLifecycleAction = useCallback(
    async (action: WorkShiftLifecycleAction) => {
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
          workShiftId: record.id,
          action,
          scope,
        });
        notifySuccess('work-schedule:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, scope, t],
  );

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return createWorkShiftActionRailItems(t, record, {
      onEdit: () => setActiveSurface('edit'),
      onReschedule: () => setActiveSurface('reschedule'),
      onReassignSubject: () => setActiveSurface('reassign-subject'),
      onReplaceResources: () => setActiveSurface('replace-resources'),
      onLifecycleAction,
      isLifecyclePending: (action) =>
        lifecycleMutation.isPending &&
        lifecycleMutation.variables?.workShiftId === record.id &&
        lifecycleMutation.variables?.action === action,
    });
  }, [lifecycleMutation.isPending, lifecycleMutation.variables, onLifecycleAction, record, t]);

  const subjectId = record ? readWorkShiftSubjectId(record) : undefined;
  const subjectHref =
    record?.subjectKind === 'EMPLOYMENT_PROFILE'
      ? buildEntityDetailHref('employmentProfile', subjectId)
      : record?.subjectKind === 'TALENT'
        ? buildEntityDetailHref('talent', subjectId)
        : record?.subjectKind === 'TALENT_GROUP'
          ? buildEntityDetailHref('talentGroup', subjectId)
          : undefined;

  return (
    <ModuleDetailScreenShell
      banner={<WorkScheduleSubnavigation active="work-shifts" />}
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`work-schedule:statuses.${record.status}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.status === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('work-schedule:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('work-schedule:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'shift-code',
                  label: t('work-schedule:fields.shiftCode'),
                  value: <ReferenceChip label={record.shiftCode} />,
                },
                {
                  key: 'title',
                  label: t('work-schedule:fields.title'),
                  value: record.title,
                },
                {
                  key: 'status',
                  label: t('work-schedule:fields.status'),
                  value: t(`work-schedule:statuses.${record.status}`),
                },
                {
                  key: 'scope',
                  label: t('work-schedule:fields.requestScope'),
                  value: scope
                    ? t(`work-schedule:scopes.${scope}`)
                    : t('work-schedule:scopes.omitted'),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('work-schedule:detail.scheduleTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'start',
                  label: t('work-schedule:fields.shiftStartAt'),
                  value: formatUtcTimestamp(record.shiftStartAt),
                },
                {
                  key: 'end',
                  label: t('work-schedule:fields.shiftEndAt'),
                  value: formatUtcTimestamp(record.shiftEndAt),
                },
                {
                  key: 'description',
                  label: t('work-schedule:fields.description'),
                  value: formatNullable(record.description),
                },
                {
                  key: 'external-ref',
                  label: t('work-schedule:fields.externalRef'),
                  value: formatNullable(record.externalRef),
                },
                {
                  key: 'created-at',
                  label: t('work-schedule:fields.createdAt'),
                  value: formatUtcTimestamp(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('work-schedule:fields.updatedAt'),
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
            <MetadataSection title={t('work-schedule:detail.subjectTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'subject-kind',
                    label: t('work-schedule:fields.subjectKind'),
                    value: t(`work-schedule:subjectKinds.${record.subjectKind}`),
                  },
                  {
                    key: 'subject-id',
                    label: t('work-schedule:fields.subjectId'),
                    value: subjectHref ? (
                      <Link to={subjectHref} className="font-mono text-accent hover:underline">
                        {subjectId}
                      </Link>
                    ) : (
                      formatNullable(subjectId)
                    ),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('work-schedule:sourceDetail.title')}>
              <div className="space-y-3">
                <ReadOnlyFieldGrid
                  fields={[
                    {
                      key: 'source-type',
                      label: t('work-schedule:sourceDetail.fields.sourceType'),
                      value: t(`work-schedule:sourceLabels.${sourceType}`),
                    },
                    {
                      key: 'source-roster-month',
                      label: t('work-schedule:sourceDetail.fields.sourceRosterMonth'),
                      value: formatNullable(record.sourceRosterMonth),
                    },
                    {
                      key: 'source-roster-local-date',
                      label: t('work-schedule:sourceDetail.fields.sourceRosterLocalDate'),
                      value: formatNullable(record.sourceRosterLocalDate),
                    },
                    {
                      key: 'source-roster',
                      label: t('work-schedule:sourceDetail.fields.sourceRosterId'),
                      value: record.sourceRosterId ? (
                        <Link
                          to={APP_PATHS.monthlyRosterDetail(record.sourceRosterId)}
                          className="font-mono text-accent hover:underline"
                        >
                          {record.sourceRosterId}
                        </Link>
                      ) : (
                        formatNullable(record.sourceRosterId)
                      ),
                    },
                    {
                      key: 'source-pattern',
                      label: t('work-schedule:sourceDetail.fields.sourcePatternId'),
                      value: record.sourcePatternId ? (
                        <Link
                          to={APP_PATHS.workPatternDetail(record.sourcePatternId)}
                          className="font-mono text-accent hover:underline"
                        >
                          {record.sourcePatternId}
                        </Link>
                      ) : (
                        formatNullable(record.sourcePatternId)
                      ),
                    },
                    {
                      key: 'source-department',
                      label: t('work-schedule:sourceDetail.fields.sourceDepartmentOrgUnitId'),
                      value: record.sourceDepartmentOrgUnitId ? (
                        <Link
                          to={
                            buildEntityDetailHref('orgUnit', record.sourceDepartmentOrgUnitId) ??
                            APP_PATHS.orgUnitDetail(record.sourceDepartmentOrgUnitId)
                          }
                          className="font-mono text-accent hover:underline"
                        >
                          {record.sourceDepartmentOrgUnitId}
                        </Link>
                      ) : (
                        formatNullable(record.sourceDepartmentOrgUnitId)
                      ),
                    },
                  ]}
                  columns={2}
                />
                {sourceType === 'ROSTER_GENERATED' ? (
                  <details className="rounded border border-border bg-panel p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-text">
                      {t('work-schedule:sourceDetail.adminMetadata')}
                    </summary>
                    <div className="pt-3">
                      <ReadOnlyFieldGrid
                        fields={[
                          {
                            key: 'source-exception',
                            label: t('work-schedule:sourceDetail.fields.sourceExceptionId'),
                            value: formatNullable(record.sourceExceptionId),
                            monospace: true,
                          },
                          {
                            key: 'source-generation-run',
                            label: t('work-schedule:sourceDetail.fields.sourceGenerationRunId'),
                            value: formatNullable(record.sourceGenerationRunId),
                            monospace: true,
                          },
                          {
                            key: 'source-slot',
                            label: t('work-schedule:sourceDetail.fields.sourceRosterSlotKey'),
                            value: formatNullable(record.sourceRosterSlotKey),
                            monospace: true,
                          },
                        ]}
                        columns={3}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            </MetadataSection>
            {activeSurface === 'edit' ? (
              <WorkShiftEditSurface
                initialValues={record}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await updateMutation.mutateAsync({
                      workShiftId: record.id,
                      payload,
                      scope,
                    });
                    notifySuccess('work-schedule:feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'reschedule' ? (
              <WorkShiftRescheduleSurface
                initialValues={record}
                isPending={rescheduleMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await rescheduleMutation.mutateAsync({
                      workShiftId: record.id,
                      payload,
                      scope,
                    });
                    notifySuccess('work-schedule:feedback.rescheduled');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'reassign-subject' ? (
              <WorkShiftReassignSubjectSurface
                currentScope={scope}
                initialValues={record}
                isPending={reassignMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  if (!canUseWorkScheduleSubjectInScope(payload.newSubjectKind, scope)) {
                    notifyError({
                      status: null,
                      message: 'work-schedule:validation.nonGlobalEmploymentProfileOnly',
                      fieldErrors: {},
                      retryable: false,
                      permissionDenied: false,
                      notFound: false,
                    });
                    return;
                  }

                  try {
                    await reassignMutation.mutateAsync({
                      workShiftId: record.id,
                      payload,
                      scope,
                    });
                    notifySuccess('work-schedule:feedback.reassigned');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'replace-resources' ? (
              <WorkShiftReplaceResourcesSurface
                initialResourceIds={record.studioResourceIds}
                isPending={replaceResourcesMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await replaceResourcesMutation.mutateAsync({
                      workShiftId: record.id,
                      payload,
                      scope,
                    });
                    notifySuccess('work-schedule:feedback.resourcesReplaced');
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
      relatedSection={
        record ? (
          <RelatedSectionShell title={t('work-schedule:related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {record.studioResourceIds.length > 0 ? (
                record.studioResourceIds.map((studioResourceId) => {
                  const href = buildEntityDetailHref('studioResource', studioResourceId);
                  return (
                    <div
                      key={studioResourceId}
                      className="rounded border border-border bg-bg px-3 py-2"
                    >
                      <p className="text-xs font-medium uppercase text-muted">
                        {t('work-schedule:related.studioResource')}
                      </p>
                      {href ? (
                        <Link
                          to={href}
                          className="mt-1 inline-flex font-mono text-sm text-accent hover:underline"
                        >
                          {studioResourceId}
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm text-muted">
                          {t('work-schedule:related.unavailable')}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
                  {t('work-schedule:related.noResources')}
                </div>
              )}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('work-schedule:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('work-schedule:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'work-schedule:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
