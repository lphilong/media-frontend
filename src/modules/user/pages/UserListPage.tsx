import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { useModulePageActions } from '@app/providers/module-runtime';
import { userAccountStatusValues } from '@modules/user/constants/user.constants';
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
import { getProvisionPasswordSetupFeedback } from '@modules/user/utils/password-setup-feedback';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import {
  AppliedFilterChips,
  type AppliedFilterChipItem,
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterToolbar,
  LoadingState,
  PermissionDeniedState,
  SearchBoxSeam,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { ModuleListScreenShell } from '@shared/modules';
import { userFlatListQueryConfig } from '@modules/user';
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query/cursor';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';
import { useRouteQueryState } from '@shared/query/use-route-query-state';
import { useScrollToPanel } from '@shared/hooks/useScrollToPanel';

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
  const { containerRef: provisionPanelRef } = useScrollToPanel(isCreateOpen ? 'provision' : null);

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

  const pageActions = provisionCapability.hidden ? null : (
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

  useModulePageActions(pageActions);

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
        canShowAction: (action) => {
          const permission =
            action === 'activate'
              ? PERMISSIONS.USER_ACTIVATE
              : action === 'disable'
                ? PERMISSIONS.USER_DISABLE
                : PERMISSIONS.USER_ARCHIVE;
          return canShowAction(capabilitiesQuery.data, { permission });
        },
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

  const clearUserFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      state: undefined,
    });
  }, [patchQuery]);

  const appliedFilterChips = useMemo<AppliedFilterChipItem[]>(() => {
    const items: AppliedFilterChipItem[] = [];

    if (query.search) {
      items.push({
        id: 'search',
        label: t('common:labels.search'),
        value: query.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    if (query.state) {
      items.push({
        id: 'state',
        label: t('user:filters.state'),
        value: t(`user:statuses.${query.state}`),
        onClear: () => patchQuery({ state: undefined }),
      });
    }

    return items;
  }, [patchQuery, query.search, query.state, t]);

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterToolbar
          searchSlot={
            <SearchBoxSeam
              value={query.search ?? ''}
              placeholder={t('user:filters.searchPlaceholder')}
              onApply={(value) => patchQuery({ search: value || undefined })}
            />
          }
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              items={appliedFilterChips}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              onClearAll={appliedFilterChips.length > 0 ? clearUserFilters : undefined}
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
        </FilterToolbar>
      }
      interactionSection={
        <div ref={provisionPanelRef} className="space-y-4">
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
                <li>{t(getProvisionPasswordSetupFeedback(lastProvisionResult))}</li>
                <li>{t('user:provisionResult.noTicketUrl')}</li>
                <li>{t('user:provisionResult.pendingUntilActivated')}</li>
              </ul>
            </div>
          ) : null}
        </div>
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
          displayedCount={listQueryResult.data?.data.length}
          limit={query.limit ?? 20}
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
