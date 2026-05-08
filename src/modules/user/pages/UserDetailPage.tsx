import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { createUserActionRailItems } from '@modules/user/actions/user-action-rail';
import { UserBoundaryNotice } from '@modules/user/components/UserBoundaryNotice';
import { UserAuthLinkageSurface, UserUpdateSurface } from '@modules/user/forms/user-mutation-forms';
import {
  useUpdateUserMutation,
  useUserAuthLinkageMutation,
  useUserDetail,
  useUserLifecycleMutation,
} from '@modules/user/hooks/use-user';
import type { UserLifecycleAction } from '@modules/user/types/user.types';
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

type ActiveMutationSurface = 'edit' | 'auth-linkage' | null;

const statusToneMap = {
  PENDING: 'neutral',
  ACTIVE: 'success',
  DISABLED: 'warning',
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

const readLifecycleConfirmKey = (action: UserLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'user:confirm.activate';
    case 'disable':
      return 'user:confirm.disable';
    case 'archive':
      return 'user:confirm.archive';
    default:
      return 'user:confirm.archive';
  }
};

const formatOptionalTimestamp = (value?: number | string | null): string =>
  value === null || value === undefined ? '-' : formatUtcTimestamp(value);

export const UserDetailPage = (): JSX.Element => {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useTranslation(['user', 'common', 'errors']);

  const detailQuery = useUserDetail(userId);
  const updateMutation = useUpdateUserMutation();
  const authLinkageMutation = useUserAuthLinkageMutation();
  const lifecycleMutation = useUserLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [userId]);

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
    async (action: UserLifecycleAction) => {
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
          userId: record.id,
          action,
        });
        notifySuccess('user:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onUpdateSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        userId: record.id,
        payload,
      });
      notifySuccess('user:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onAuthLinkageSubmit = async (
    payload: Parameters<typeof authLinkageMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await authLinkageMutation.mutateAsync({
        userId: record.id,
        payload,
      });
      notifySuccess('user:feedback.authLinkageUpdated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return createUserActionRailItems(t, record, {
      onEdit: () => setActiveSurface('edit'),
      onAuthLinkage: () => setActiveSurface('auth-linkage'),
      onLifecycleAction,
      isLifecyclePending: (action) =>
        lifecycleMutation.isPending &&
        lifecycleMutation.variables?.userId === record.id &&
        lifecycleMutation.variables?.action === action,
    });
  }, [lifecycleMutation.isPending, lifecycleMutation.variables, onLifecycleAction, record, t]);

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.accountStatus}
            label={t(`user:statuses.${record.accountStatus}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.accountStatus === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('user:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('user:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'id',
                  label: t('user:fields.id'),
                  value: <ReferenceChip label={record.id} />,
                },
                {
                  key: 'displayName',
                  label: t('user:fields.displayName'),
                  value: record.profile.displayName,
                },
                {
                  key: 'email',
                  label: t('user:fields.email'),
                  value: record.profile.email ?? '-',
                },
                {
                  key: 'phone',
                  label: t('user:fields.phone'),
                  value: record.profile.phone ?? '-',
                },
                {
                  key: 'actorKind',
                  label: t('user:fields.actorKind'),
                  value: t(`user:actorKinds.${record.actorKind}`),
                },
                {
                  key: 'accountStatus',
                  label: t('user:fields.accountStatus'),
                  value: t(`user:statuses.${record.accountStatus}`),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <div className="space-y-4">
            <MetadataSection title={t('user:detail.authLinkageTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'provider',
                    label: t('user:fields.authProvider'),
                    value: record.authLinkage.provider,
                  },
                  {
                    key: 'subject',
                    label: t('user:fields.authSubject'),
                    value: record.authLinkage.subject,
                  },
                  {
                    key: 'contexts',
                    label: t('user:fields.contexts'),
                    value: record.contextAccess.contexts.map((item) => item.context).join(', '),
                  },
                  {
                    key: 'locale',
                    label: t('user:fields.locale'),
                    value: record.preferences.locale ?? '-',
                  },
                  {
                    key: 'timezone',
                    label: t('user:fields.timezone'),
                    value: record.preferences.timezone ?? '-',
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('user:detail.lifecycleTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'createdAt',
                    label: t('user:fields.createdAt'),
                    value: formatUtcTimestamp(record.createdAt),
                  },
                  {
                    key: 'updatedAt',
                    label: t('user:fields.updatedAt'),
                    value: formatUtcTimestamp(record.updatedAt),
                  },
                  {
                    key: 'activatedAt',
                    label: t('user:fields.activatedAt'),
                    value: formatOptionalTimestamp(record.activatedAt),
                  },
                  {
                    key: 'disabledAt',
                    label: t('user:fields.disabledAt'),
                    value: formatOptionalTimestamp(record.disabledAt),
                  },
                  {
                    key: 'archivedAt',
                    label: t('user:fields.archivedAt'),
                    value: formatOptionalTimestamp(record.archivedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
          </div>
        ) : undefined
      }
      sections={
        record ? (
          <div className="space-y-4">
            <UserBoundaryNotice />
            {activeSurface === 'edit' ? (
              <UserUpdateSurface
                initialRecord={record}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onUpdateSubmit}
              />
            ) : null}
            {activeSurface === 'auth-linkage' ? (
              <UserAuthLinkageSurface
                initialValues={record.authLinkage}
                isPending={authLinkageMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onAuthLinkageSubmit}
              />
            ) : null}
          </div>
        ) : undefined
      }
      actionRail={<ActionRail title={t('user:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('user:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'user:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
