import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { PlatformAccountCreateSurface } from '@modules/platform-account/forms/platform-account-mutation-forms';
import {
  useCreatePlatformAccountMutation,
  usePlatformAccountLifecycleMutation,
  usePlatformAccountList,
} from '@modules/platform-account/hooks/use-platform-account';
import { createPlatformAccountListColumns } from '@modules/platform-account/tables/platform-account-columns';
import type {
  PlatformAccountLifecycleAction,
  PlatformAccountListQuery,
  PlatformAccountOwnerKind,
} from '@modules/platform-account/types/platform-account.types';
import type { NormalizedApiError } from '@shared/api';
import {
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterBarShell,
  LoadingState,
  PermissionDeniedState,
  SearchBoxSeam,
  SortControlSeam,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { ModuleListScreenShell } from '@shared/modules';
import {
  createCursorStack,
  moveNextCursor,
  movePreviousCursor,
  platformAccountFlatListQueryConfig,
  serializeScreenQueryParams,
  useRouteQueryState,
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

const sortOptions = [
  { value: 'accountCode', labelKey: 'platform-account:sort.accountCode' },
  { value: 'displayName', labelKey: 'platform-account:sort.displayName' },
  { value: 'createdAt', labelKey: 'platform-account:sort.createdAt' },
] as const;

const operationalStatusOptions = ['', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
const ownerKindOptions = ['', 'ORG_UNIT', 'TALENT', 'TALENT_GROUP'] as const;

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

const readOwnerIdFromQuery = (query: PlatformAccountListQuery): string => {
  if (query.ownerKind === 'ORG_UNIT') {
    return query.ownerOrgUnitId ?? '';
  }

  if (query.ownerKind === 'TALENT') {
    return query.ownerTalentId ?? '';
  }

  if (query.ownerKind === 'TALENT_GROUP') {
    return query.ownerTalentGroupId ?? '';
  }

  return '';
};

const buildOwnerPatch = (
  ownerKind: PlatformAccountOwnerKind | undefined,
  ownerId: string,
): Partial<PlatformAccountListQuery> => {
  const normalizedOwnerId = ownerId.trim() || undefined;
  if (!ownerKind) {
    return {
      ownerKind: undefined,
      ownerOrgUnitId: undefined,
      ownerTalentId: undefined,
      ownerTalentGroupId: undefined,
    };
  }

  return {
    ownerKind,
    ownerOrgUnitId: ownerKind === 'ORG_UNIT' ? normalizedOwnerId : undefined,
    ownerTalentId: ownerKind === 'TALENT' ? normalizedOwnerId : undefined,
    ownerTalentGroupId: ownerKind === 'TALENT_GROUP' ? normalizedOwnerId : undefined,
  };
};

export const PlatformAccountListPage = (): JSX.Element => {
  const { t } = useTranslation(['platform-account', 'common', 'errors']);
  const navigate = useNavigate();
  const { query, patchQuery } = useRouteQueryState(platformAccountFlatListQueryConfig);
  const listQueryResult = usePlatformAccountList(query);
  const createMutation = useCreatePlatformAccountMutation();
  const lifecycleMutation = usePlatformAccountLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    return serializeScreenQueryParams(
      {
        ...query,
        cursor: undefined,
      },
      platformAccountFlatListQueryConfig,
    ).toString();
  }, [query]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const pageActions = (
    <button
      type="button"
      onClick={() => setIsCreateOpen((current) => !current)}
      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
    >
      {isCreateOpen
        ? t('platform-account:actions.closeCreate')
        : t('platform-account:actions.create')}
    </button>
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
    patchQuery(
      {
        cursor: nextCursor,
      },
      { resetCursorOnChange: false },
    );
  };

  const onPrevious = (): void => {
    setCursorStack((current) => {
      const nextStack = movePreviousCursor(current);
      patchQuery(
        {
          cursor: nextStack.current ?? undefined,
        },
        { resetCursorOnChange: false },
      );

      return nextStack;
    });
  };

  const onCreateSubmit = async (payload: Parameters<typeof createMutation.mutateAsync>[0]) => {
    try {
      await createMutation.mutateAsync(payload);
      notifySuccess('platform-account:feedback.created');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onLifecycleAction = useCallback(
    async (platformAccountId: string, action: PlatformAccountLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          platformAccountId,
          action,
        });
        notifySuccess('platform-account:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createPlatformAccountListColumns(t, {
        onOpenDetail: (platformAccountId) =>
          navigate(APP_PATHS.platformAccountDetail(platformAccountId)),
        onLifecycleAction,
        isActionPending: (platformAccountId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.platformAccountId === platformAccountId &&
          lifecycleMutation.variables?.action === action,
      }),
    [lifecycleMutation.isPending, lifecycleMutation.variables, navigate, onLifecycleAction, t],
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

  const ownerId = readOwnerIdFromQuery(query);

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterBarShell
          searchSlot={
            <SearchBoxSeam
              value={query.search ?? ''}
              placeholder={t('platform-account:filters.searchPlaceholder')}
              onApply={(value) => {
                patchQuery({
                  search: value || undefined,
                });
              }}
            />
          }
          sortSlot={
            <SortControlSeam
              sortBy={query.sortBy}
              sortDirection={query.sortDirection}
              options={sortOptions.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              onChange={(sortBy, sortDirection) =>
                patchQuery({
                  sortBy,
                  sortDirection,
                })
              }
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('platform-account:filters.operationalStatus')}
            </span>
            <select
              value={query.operationalStatus ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  operationalStatus: (event.target.value ||
                    undefined) as PlatformAccountListQuery['operationalStatus'],
                })
              }
            >
              {operationalStatusOptions.map((statusOption) => (
                <option key={statusOption || 'all'} value={statusOption}>
                  {statusOption
                    ? t(`platform-account:statuses.${statusOption}`)
                    : t('platform-account:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('platform-account:filters.platform')}
            </span>
            <input
              value={query.platform ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('platform-account:filters.platformPlaceholder')}
              onChange={(event) => patchQuery({ platform: event.target.value || undefined })}
            />
          </label>
          <label className="flex min-w-[190px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('platform-account:filters.platformSurfaceType')}
            </span>
            <input
              value={query.platformSurfaceType ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('platform-account:filters.platformSurfaceTypePlaceholder')}
              onChange={(event) =>
                patchQuery({ platformSurfaceType: event.target.value || undefined })
              }
            />
          </label>
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('platform-account:filters.ownerKind')}
            </span>
            <select
              value={query.ownerKind ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery(
                  buildOwnerPatch(
                    (event.target.value || undefined) as PlatformAccountOwnerKind | undefined,
                    ownerId,
                  ),
                )
              }
            >
              {ownerKindOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option
                    ? t(`platform-account:ownerKinds.${option}`)
                    : t('platform-account:filters.allOwnerKinds')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[220px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('platform-account:filters.ownerId')}
            </span>
            <input
              value={ownerId}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('platform-account:filters.ownerIdPlaceholder')}
              onChange={(event) => patchQuery(buildOwnerPatch(query.ownerKind, event.target.value))}
            />
          </label>
          {(['livestreamEnabled', 'contentPublishingEnabled', 'monetizationEnabled'] as const).map(
            (key) => (
              <label key={key} className="flex min-w-[170px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t(`platform-account:filters.${key}`)}
                </span>
                <select
                  value={query[key] === undefined ? '' : query[key] ? 'true' : 'false'}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) => {
                    const value = event.target.value;
                    patchQuery({
                      [key]: value === '' ? undefined : value === 'true',
                    });
                  }}
                >
                  <option value="">{t('platform-account:filters.allCapabilityStates')}</option>
                  <option value="true">{t('platform-account:boolean.true')}</option>
                  <option value="false">{t('platform-account:boolean.false')}</option>
                </select>
              </label>
            ),
          )}
        </FilterBarShell>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <PlatformAccountCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={onCreateSubmit}
            />
          ) : null}
        </>
      }
      tableSection={
        <div className="space-y-4">
          <AdminTableShell
            data={listQueryResult.data?.data ?? []}
            columns={columns}
            isLoading={listQueryResult.isFetching && !listQueryResult.data}
            emptyTitle={t('platform-account:states.emptyTitle')}
            emptyMessage={t('platform-account:states.emptyMessage')}
            caption={t('platform-account:table.caption')}
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
          title={t('platform-account:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'platform-account:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
