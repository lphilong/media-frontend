import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  buildEventsByStudioResourceHref,
  buildWorkShiftsByStudioResourceHref,
} from '@app/router/reference-links';
import { createStudioResourceActionRailItems } from '@modules/studio-resource/actions/studio-resource-action-rail';
import { StudioResourceEditSurface } from '@modules/studio-resource/forms/studio-resource-mutation-forms';
import {
  useStudioResourceAvailabilityMutation,
  useStudioResourceDetail,
  useStudioResourceLifecycleMutation,
  useUpdateStudioResourceMutation,
} from '@modules/studio-resource/hooks/use-studio-resource';
import type {
  StudioResourceAvailabilityAction,
  StudioResourceLifecycleAction,
} from '@modules/studio-resource/types/studio-resource.types';
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
import {
  applyActionCapabilityHints,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import { formatCreatedDate, formatBusinessTimestamp } from '@shared/formatting/formatters';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveMutationSurface = 'edit' | null;

const statusToneMap = {
  ACTIVE: 'success',
  OUT_OF_SERVICE: 'warning',
  INACTIVE: 'neutral',
  ARCHIVED: 'muted',
} as const;

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

  return t(fallbackKey);
};

const readAvailabilityConfirmKey = (action: StudioResourceAvailabilityAction): string => {
  switch (action) {
    case 'out-of-service':
      return 'studio-resource:confirm.outOfService';
    case 'restore-to-active':
      return 'studio-resource:confirm.restoreToActive';
    default:
      return 'studio-resource:confirm.outOfService';
  }
};

const readLifecycleConfirmKey = (action: StudioResourceLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'studio-resource:confirm.activate';
    case 'deactivate':
      return 'studio-resource:confirm.deactivate';
    case 'archive':
      return 'studio-resource:confirm.archive';
    default:
      return 'studio-resource:confirm.archive';
  }
};

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

export const StudioResourceDetailPage = (): JSX.Element => {
  const { studioResourceId } = useParams<{ studioResourceId: string }>();
  const { t } = useTranslation(['studio-resource', 'common', 'errors']);

  const detailQuery = useStudioResourceDetail(studioResourceId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const updateMutation = useUpdateStudioResourceMutation();
  const availabilityMutation = useStudioResourceAvailabilityMutation();
  const lifecycleMutation = useStudioResourceLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [studioResourceId]);

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

  const onEditSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        studioResourceId: record.id,
        payload,
      });
      notifySuccess('studio-resource:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAvailabilityAction = useCallback(
    async (action: StudioResourceAvailabilityAction) => {
      if (!record) {
        return;
      }

      const confirmed = await requestDestructiveConfirm({
        description: t(readAvailabilityConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await availabilityMutation.mutateAsync({
          studioResourceId: record.id,
          action,
        });
        notifySuccess('studio-resource:feedback.availabilityUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [availabilityMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onLifecycleAction = useCallback(
    async (action: StudioResourceLifecycleAction) => {
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
          studioResourceId: record.id,
          action,
        });
        notifySuccess('studio-resource:feedback.lifecycleUpdated');
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

    return applyActionCapabilityHints(
      createStudioResourceActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onAvailabilityAction,
        onLifecycleAction,
        isAvailabilityPending: (action) =>
          availabilityMutation.isPending &&
          availabilityMutation.variables?.studioResourceId === record.id &&
          availabilityMutation.variables?.action === action,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.studioResourceId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        edit: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.STUDIO_RESOURCE_UPDATE },
          capabilityCopy,
        ),
        'out-of-service': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.STUDIO_RESOURCE_MANAGE_AVAILABILITY },
          capabilityCopy,
        ),
        'restore-to-active': createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.STUDIO_RESOURCE_MANAGE_AVAILABILITY },
          capabilityCopy,
        ),
        deactivate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.STUDIO_RESOURCE_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        activate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.STUDIO_RESOURCE_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.STUDIO_RESOURCE_MANAGE_LIFECYCLE },
          capabilityCopy,
        ),
      },
    );
  }, [
    availabilityMutation.isPending,
    availabilityMutation.variables,
    capabilityCopy,
    capabilitiesQuery.data,
    capabilitiesQuery.isError,
    capabilitiesQuery.isLoading,
    lifecycleMutation.isPending,
    lifecycleMutation.variables,
    onAvailabilityAction,
    onLifecycleAction,
    record,
    t,
  ]);

  const relatedWorkShiftsHref = record ? buildWorkShiftsByStudioResourceHref(record.id) : undefined;
  const relatedEventsHref = record ? buildEventsByStudioResourceHref(record.id) : undefined;

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.operationalStatus}
            label={t(`studio-resource:statuses.${record.operationalStatus}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.operationalStatus === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('studio-resource:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('studio-resource:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'resource-code',
                  label: t('studio-resource:fields.resourceCode'),
                  value: <ReferenceChip label={record.resourceCode} />,
                },
                {
                  key: 'name',
                  label: t('studio-resource:fields.name'),
                  value: record.name,
                },
                {
                  key: 'short-name',
                  label: t('studio-resource:fields.shortName'),
                  value: formatNullable(record.shortName),
                },
                {
                  key: 'resource-class',
                  label: t('studio-resource:fields.resourceClass'),
                  value: record.resourceClass,
                },
                {
                  key: 'status',
                  label: t('studio-resource:fields.operationalStatus'),
                  value: t(`studio-resource:statuses.${record.operationalStatus}`),
                },
                {
                  key: 'location-label',
                  label: t('studio-resource:fields.locationLabel'),
                  value: formatNullable(record.locationLabel),
                },
                {
                  key: 'max-occupancy',
                  label: t('studio-resource:fields.maxOccupancy'),
                  value: formatNullable(record.maxOccupancy),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('studio-resource:detail.metadataTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'description',
                  label: t('studio-resource:fields.description'),
                  value: formatNullable(record.description),
                },
                {
                  key: 'external-ref',
                  label: t('studio-resource:fields.externalRef'),
                  value: formatNullable(record.externalRef),
                },
                {
                  key: 'created-at',
                  label: t('studio-resource:fields.createdAt'),
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('studio-resource:fields.updatedAt'),
                  value: formatBusinessTimestamp(record.updatedAt),
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
            {activeSurface === 'edit' ? (
              <StudioResourceEditSurface
                resourceClass={record.resourceClass}
                initialValues={{
                  name: record.name,
                  shortName: record.shortName,
                  locationLabel: record.locationLabel,
                  description: record.description,
                  externalRef: record.externalRef,
                  maxOccupancy: record.maxOccupancy,
                }}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onEditSubmit}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <RelatedSectionShell title={t('studio-resource:related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(
                [
                  ['workShifts', relatedWorkShiftsHref],
                  ['events', relatedEventsHref],
                ] satisfies Array<[string, string | undefined]>
              ).map(([key, href]) => (
                <div key={key} className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t(`studio-resource:related.${key}`)}
                  </p>
                  {href ? (
                    <Link
                      to={href}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('studio-resource:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('studio-resource:related.unavailable')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('studio-resource:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('studio-resource:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'studio-resource:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
