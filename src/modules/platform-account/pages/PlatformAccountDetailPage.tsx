import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  buildEntityDetailHref,
  buildEventsByPlatformAccountHref,
  buildRevenueLedgerByPlatformHref,
  buildTalentKpiByPlatformHref,
} from '@app/router/reference-links';
import { createPlatformAccountActionRailItems } from '@modules/platform-account/actions/platform-account-action-rail';
import {
  PlatformAccountCapabilitiesSurface,
  PlatformAccountEditSurface,
  PlatformAccountOwnershipTransferSurface,
} from '@modules/platform-account/forms/platform-account-mutation-forms';
import {
  usePlatformAccountCapabilitiesMutation,
  usePlatformAccountDetail,
  usePlatformAccountLifecycleMutation,
  usePlatformAccountOwnershipTransferMutation,
  useUpdatePlatformAccountMutation,
} from '@modules/platform-account/hooks/use-platform-account';
import { readPlatformAccountOwnerId } from '@modules/platform-account/tables/platform-account-columns';
import type {
  PlatformAccountLifecycleAction,
  PlatformAccountRecord,
} from '@modules/platform-account/types/platform-account.types';
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

type ActiveMutationSurface = 'edit' | 'transfer-ownership' | 'capabilities' | null;

const statusToneMap = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
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

  return error.message;
};

const readLifecycleConfirmKey = (action: PlatformAccountLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'platform-account:confirm.activate';
    case 'deactivate':
      return 'platform-account:confirm.deactivate';
    case 'archive':
      return 'platform-account:confirm.archive';
    default:
      return 'platform-account:confirm.archive';
  }
};

const buildOwnerHref = (record: PlatformAccountRecord): string | undefined => {
  const ownerId = readPlatformAccountOwnerId(record);
  if (!ownerId) {
    return undefined;
  }

  if (record.ownerKind === 'ORG_UNIT') {
    return buildEntityDetailHref('orgUnit', ownerId);
  }

  if (record.ownerKind === 'TALENT') {
    return buildEntityDetailHref('talent', ownerId);
  }

  return buildEntityDetailHref('talentGroup', ownerId);
};

export const PlatformAccountDetailPage = (): JSX.Element => {
  const { platformAccountId } = useParams<{ platformAccountId: string }>();
  const { t } = useTranslation(['platform-account', 'common', 'errors']);

  const detailQuery = usePlatformAccountDetail(platformAccountId);
  const updateMutation = useUpdatePlatformAccountMutation();
  const transferMutation = usePlatformAccountOwnershipTransferMutation();
  const capabilitiesMutation = usePlatformAccountCapabilitiesMutation();
  const lifecycleMutation = usePlatformAccountLifecycleMutation();

  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [platformAccountId]);

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

  const onLifecycleAction = useCallback(
    async (action: PlatformAccountLifecycleAction) => {
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
          platformAccountId: record.id,
          action,
        });
        notifySuccess('platform-account:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onEditSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        platformAccountId: record.id,
        payload,
      });
      notifySuccess('platform-account:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onTransferSubmit = async (
    payload: Parameters<typeof transferMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await transferMutation.mutateAsync({
        platformAccountId: record.id,
        payload,
      });
      notifySuccess('platform-account:feedback.ownershipTransferred');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onCapabilitiesSubmit = async (
    payload: Parameters<typeof capabilitiesMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await capabilitiesMutation.mutateAsync({
        platformAccountId: record.id,
        payload,
      });
      notifySuccess('platform-account:feedback.capabilitiesUpdated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return createPlatformAccountActionRailItems(t, record, {
      onEdit: () => setActiveSurface('edit'),
      onTransferOwnership: () => setActiveSurface('transfer-ownership'),
      onUpdateCapabilities: () => setActiveSurface('capabilities'),
      onLifecycleAction,
      isLifecyclePending: (action) =>
        lifecycleMutation.isPending &&
        lifecycleMutation.variables?.platformAccountId === record.id &&
        lifecycleMutation.variables?.action === action,
    });
  }, [lifecycleMutation.isPending, lifecycleMutation.variables, onLifecycleAction, record, t]);

  const ownerId = record ? readPlatformAccountOwnerId(record) : undefined;
  const ownerHref = record ? buildOwnerHref(record) : undefined;
  const relatedEventsHref = record ? buildEventsByPlatformAccountHref(record.id) : undefined;
  const relatedKpiHref = record ? buildTalentKpiByPlatformHref(record.id) : undefined;
  const relatedRevenueHref = record ? buildRevenueLedgerByPlatformHref(record.id) : undefined;

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.operationalStatus}
            label={t(`platform-account:statuses.${record.operationalStatus}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.operationalStatus === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('platform-account:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('platform-account:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'account-code',
                  label: t('platform-account:fields.accountCode'),
                  value: <ReferenceChip label={record.accountCode} />,
                },
                {
                  key: 'display-name',
                  label: t('platform-account:fields.displayName'),
                  value: record.displayName,
                },
                {
                  key: 'platform',
                  label: t('platform-account:fields.platform'),
                  value: record.platform,
                },
                {
                  key: 'platform-surface-type',
                  label: t('platform-account:fields.platformSurfaceType'),
                  value: record.platformSurfaceType,
                },
                {
                  key: 'status',
                  label: t('platform-account:fields.operationalStatus'),
                  value: t(`platform-account:statuses.${record.operationalStatus}`),
                },
                {
                  key: 'owner-kind',
                  label: t('platform-account:fields.ownerKind'),
                  value: t(`platform-account:ownerKinds.${record.ownerKind}`),
                },
                {
                  key: 'owner-id',
                  label: t('platform-account:fields.ownerId'),
                  value: ownerId ? <ReferenceChip label={ownerId} to={ownerHref} /> : '-',
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('platform-account:detail.locatorsTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'handle',
                  label: t('platform-account:fields.handle'),
                  value: record.handle ?? '-',
                },
                {
                  key: 'external-platform-id',
                  label: t('platform-account:fields.externalPlatformId'),
                  value: record.externalPlatformId ?? '-',
                },
                {
                  key: 'profile-url',
                  label: t('platform-account:fields.profileUrl'),
                  value: record.profileUrl ?? '-',
                },
                {
                  key: 'livestream-enabled',
                  label: t('platform-account:fields.livestreamEnabled'),
                  value: record.livestreamEnabled
                    ? t('platform-account:boolean.true')
                    : t('platform-account:boolean.false'),
                },
                {
                  key: 'content-publishing-enabled',
                  label: t('platform-account:fields.contentPublishingEnabled'),
                  value: record.contentPublishingEnabled
                    ? t('platform-account:boolean.true')
                    : t('platform-account:boolean.false'),
                },
                {
                  key: 'monetization-enabled',
                  label: t('platform-account:fields.monetizationEnabled'),
                  value: record.monetizationEnabled
                    ? t('platform-account:boolean.true')
                    : t('platform-account:boolean.false'),
                },
                {
                  key: 'description',
                  label: t('platform-account:fields.description'),
                  value: record.description ?? '-',
                },
                {
                  key: 'external-ref',
                  label: t('platform-account:fields.externalRef'),
                  value: record.externalRef ?? '-',
                },
                {
                  key: 'created-at',
                  label: t('platform-account:fields.createdAt'),
                  value: formatUtcTimestamp(record.createdAt),
                },
                {
                  key: 'updated-at',
                  label: t('platform-account:fields.updatedAt'),
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
            {activeSurface === 'edit' ? (
              <PlatformAccountEditSurface
                initialValues={{
                  displayName: record.displayName,
                  handle: record.handle,
                  externalPlatformId: record.externalPlatformId,
                  profileUrl: record.profileUrl,
                  description: record.description,
                  externalRef: record.externalRef,
                }}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onEditSubmit}
              />
            ) : null}
            {activeSurface === 'transfer-ownership' ? (
              <PlatformAccountOwnershipTransferSurface
                initialValues={{
                  ownerKind: record.ownerKind,
                  ownerOrgUnitId: record.ownerOrgUnitId,
                  ownerTalentId: record.ownerTalentId,
                  ownerTalentGroupId: record.ownerTalentGroupId,
                }}
                isPending={transferMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onTransferSubmit}
              />
            ) : null}
            {activeSurface === 'capabilities' ? (
              <PlatformAccountCapabilitiesSurface
                initialValues={{
                  livestreamEnabled: record.livestreamEnabled,
                  contentPublishingEnabled: record.contentPublishingEnabled,
                  monetizationEnabled: record.monetizationEnabled,
                }}
                isPending={capabilitiesMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onCapabilitiesSubmit}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <RelatedSectionShell title={t('platform-account:related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(
                [
                  ['events', relatedEventsHref],
                  ['talentKpi', relatedKpiHref],
                  ['revenueLedger', relatedRevenueHref],
                ] satisfies Array<[string, string | undefined]>
              ).map(([key, href]) => (
                <div key={key} className="rounded border border-border bg-bg px-3 py-2">
                  <p className="text-xs font-medium uppercase text-muted">
                    {t(`platform-account:related.${key}`)}
                  </p>
                  {href ? (
                    <Link
                      to={href}
                      className="mt-1 inline-flex text-sm text-accent hover:underline"
                    >
                      {t('platform-account:related.openFilteredList')}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      {t('platform-account:related.unavailable')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('platform-account:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('platform-account:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'platform-account:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
