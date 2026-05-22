import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import {
  userAccountStatusValues,
  userActorKindValues,
} from '@modules/user/constants/user.constants';
import { UserProvisionSurface } from '@modules/user/forms/user-mutation-forms';
import {
  useProvisionUserMutation,
  useUserLifecycleMutation,
  useUserList,
} from '@modules/user/hooks/use-user';
import { createUserListColumns } from '@modules/user/tables/user-columns';
import type {
  UserLifecycleAction,
  UserListQuery,
  UserMutationResult,
} from '@modules/user/types/user.types';
import type { NormalizedApiError } from '@shared/api';
import {
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import {
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterBarShell,
  LoadingState,
  PermissionDeniedState,
  SearchBoxSeam,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { ModuleListScreenShell } from '@shared/modules';
import {
  createCursorStack,
  moveNextCursor,
  movePreviousCursor,
  serializeScreenQueryParams,
  useRouteQueryState,
  userFlatListQueryConfig,
} from '@shared/query';

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

export const UserListPage = (): JSX.Element => {
  const { t } = useTranslation(['user', 'common', 'errors']);
  const navigate = useNavigate();
  const { query, patchQuery } = useRouteQueryState(userFlatListQueryConfig);
  const listQueryResult = useUserList(query);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const provisionMutation = useProvisionUserMutation();
  const lifecycleMutation = useUserLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [lastProvisionResult, setLastProvisionResult] = useState<UserMutationResult | null>(null);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(
    () =>
      serializeScreenQueryParams(
        {
          ...query,
          cursor: undefined,
        },
        userFlatListQueryConfig,
      ).toString(),
    [query],
  );
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  const provisionCapability = createActionCapabilityHint(
    {
      capabilities: capabilitiesQuery.data,
      isLoading: capabilitiesQuery.isLoading,
      isError: capabilitiesQuery.isError,
    },
    { permission: PERMISSIONS.USER_PROVISION_ACCOUNT },
    capabilityCopy,
  );

  const pageActions = (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => {
          setIsCreateOpen((current) => !current);
          setLastProvisionResult(null);
        }}
        disabled={provisionCapability.disabled}
        aria-describedby={
          provisionCapability.disabledReason ? 'user-provision-disabled' : undefined
        }
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCreateOpen ? t('user:actions.closeProvision') : t('user:actions.provisionAccount')}
      </button>
      {provisionCapability.disabledReason ? (
        <p id="user-provision-disabled" className="text-xs text-muted">
          {provisionCapability.disabledReason}
        </p>
      ) : null}
    </div>
  );

  usePageActions(pageActions);

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(query.cursor);

  const onNext = (): void => {
    if (!nextCursor) {
      return;
    }

    setCursorStack((current) => moveNextCursor(current, nextCursor));
    patchQuery({ cursor: nextCursor }, { resetCursorOnChange: false });
  };

  const onPrevious = (): void => {
    setCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      patchQuery({ cursor: nextStack.current ?? undefined }, { resetCursorOnChange: false });

      return nextStack;
    });
  };

  const onProvisionSubmit = async (
    payload: Parameters<typeof provisionMutation.mutateAsync>[0],
  ) => {
    try {
      const result = await provisionMutation.mutateAsync(payload);
      setLastProvisionResult(result);
      notifySuccess('user:feedback.provisioned');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onLifecycleAction = useCallback(
    async (userId: string, action: UserLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({ userId, action });
        notifySuccess('user:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createUserListColumns(t, {
        onOpenDetail: (userId) => navigate(APP_PATHS.userDetail(userId)),
        onLifecycleAction,
        getActionDisabledReason: (action) => {
          const permission =
            action === 'activate'
              ? PERMISSIONS.USER_ACTIVATE
              : action === 'disable'
                ? PERMISSIONS.USER_DISABLE
                : PERMISSIONS.USER_ARCHIVE;
          return createActionCapabilityHint(
            {
              capabilities: capabilitiesQuery.data,
              isLoading: capabilitiesQuery.isLoading,
              isError: capabilitiesQuery.isError,
            },
            { permission },
            capabilityCopy,
          ).disabledReason;
        },
        isActionPending: (userId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.userId === userId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      capabilitiesQuery.data,
      capabilitiesQuery.isError,
      capabilitiesQuery.isLoading,
      capabilityCopy,
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      t,
    ],
  );

  const listError = listQueryResult.error as NormalizedApiError | null;
  const shellState = useMemo(() => {
    if (listQueryResult.isPending) {
      return 'loading' as const;
    }

    if (listQueryResult.isError) {
      if (listError?.permissionDenied) {
        return 'denied' as const;
      }

      return 'error' as const;
    }

    return 'ready' as const;
  }, [listError?.permissionDenied, listQueryResult.isError, listQueryResult.isPending]);

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterBarShell
          searchSlot={
            <SearchBoxSeam
              value={query.search ?? ''}
              placeholder={t('user:filters.searchPlaceholder')}
              onApply={(value) => patchQuery({ search: value || undefined })}
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('user:filters.state')}
            </span>
            <select
              value={query.state ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  state: (event.target.value || undefined) as UserListQuery['state'],
                })
              }
            >
              <option value="">{t('user:filters.allStates')}</option>
              {userAccountStatusValues.map((status) => (
                <option key={status} value={status}>
                  {t(`user:statuses.${status}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('user:filters.actorKind')}
            </span>
            <select
              value={query.actorKind ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  actorKind: (event.target.value || undefined) as UserListQuery['actorKind'],
                })
              }
            >
              <option value="">{t('user:filters.allActorKinds')}</option>
              {userActorKindValues.map((actorKind) => (
                <option key={actorKind} value={actorKind}>
                  {t(`user:actorKinds.${actorKind}`)}
                </option>
              ))}
            </select>
          </label>
        </FilterBarShell>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <UserProvisionSurface
              isPending={provisionMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={onProvisionSubmit}
            />
          ) : null}
          {lastProvisionResult ? (
            <div className="rounded border border-border bg-panel p-3 text-sm">
              <h3 className="font-semibold text-text">{t('user:provisionResult.title')}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                <li>{t('user:provisionResult.userCreated')}</li>
                <li>
                  {lastProvisionResult.provisioning?.auth0UserCreated
                    ? t('user:provisionResult.auth0Linked')
                    : t('user:provisionResult.auth0ExistingLinked')}
                </li>
                <li>
                  {lastProvisionResult.provisioning?.invitationTicketCreated ||
                  lastProvisionResult.passwordSetup?.ticketCreated
                    ? t('user:provisionResult.passwordSetupSent')
                    : t('user:provisionResult.passwordSetupNotCreated')}
                </li>
                <li>{t('user:provisionResult.noTicketUrl')}</li>
                <li>{t('user:provisionResult.pendingUntilActivated')}</li>
              </ul>
            </div>
          ) : null}
        </>
      }
      tableSection={
        <div className="space-y-4">
          <AdminTableShell
            data={listQueryResult.data?.data ?? []}
            columns={columns}
            isLoading={listQueryResult.isFetching && !listQueryResult.data}
            emptyTitle={t('user:states.emptyTitle')}
            emptyMessage={t('user:states.emptyMessage')}
            caption={t('user:table.caption')}
          />
        </div>
      }
      pager={
        <CursorPager
          canGoBack={canGoBack}
          canGoNext={canGoNext}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      }
      state={shellState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      errorState={
        <ErrorState
          title={t('user:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'user:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
