import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { usePageActions } from '@app/store/use-page-actions';
import { APP_PATHS } from '@app/router/paths';
import {
  useCreateOrgUnitMutation,
  useOrgUnitLifecycleMutation,
  useOrgUnitList,
} from '@modules/org-unit/hooks/use-org-unit';
import { OrgUnitCreateSurface } from '@modules/org-unit/forms/org-unit-mutation-forms';
import { createOrgUnitListColumns } from '@modules/org-unit/tables/org-unit-columns';
import type { OrgUnitLifecycleAction } from '@modules/org-unit/types/org-unit.types';
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
} from '@shared/components/primitives';
import { useDestructiveConfirm, useMutationFeedback } from '@shared/components/primitives';
import {
  createCursorStack,
  moveNextCursor,
  movePreviousCursor,
  orgUnitFlatListQueryConfig,
  serializeScreenQueryParams,
  useRouteQueryState,
} from '@shared/query';
import { ModuleListScreenShell } from '@shared/modules';

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
  { value: 'code', labelKey: 'org-unit:sort.code' },
  { value: 'name', labelKey: 'org-unit:sort.name' },
  { value: 'createdAt', labelKey: 'org-unit:sort.createdAt' },
  { value: 'displayOrder', labelKey: 'org-unit:sort.displayOrder' },
] as const;

const statusOptions = ['', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;

const readLifecycleConfirmKey = (action: OrgUnitLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'org-unit:confirm.activate';
    case 'deactivate':
      return 'org-unit:confirm.deactivate';
    case 'archive':
      return 'org-unit:confirm.archive';
    default:
      return 'org-unit:confirm.archive';
  }
};

export const OrgUnitListPage = (): JSX.Element => {
  const { t } = useTranslation(['org-unit', 'common', 'errors']);
  const navigate = useNavigate();
  const { query, patchQuery } = useRouteQueryState(orgUnitFlatListQueryConfig);
  const listQuery = useMemo(() => query, [query]);

  const listQueryResult = useOrgUnitList(listQuery);
  const createMutation = useCreateOrgUnitMutation();
  const lifecycleMutation = useOrgUnitLifecycleMutation();
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
      orgUnitFlatListQueryConfig,
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
      {isCreateOpen ? t('org-unit:actions.closeCreate') : t('org-unit:actions.create')}
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
      notifySuccess('org-unit:feedback.created');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onLifecycleAction = useCallback(
    async (orgUnitId: string, action: OrgUnitLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          orgUnitId,
          action,
        });
        notifySuccess('org-unit:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createOrgUnitListColumns(t, {
        onOpenDetail: (orgUnitId) => navigate(APP_PATHS.orgUnitDetail(orgUnitId)),
        onLifecycleAction,
        isActionPending: (orgUnitId, action) => {
          return (
            lifecycleMutation.isPending &&
            lifecycleMutation.variables?.orgUnitId === orgUnitId &&
            lifecycleMutation.variables?.action === action
          );
        },
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

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterBarShell
          searchSlot={
            <SearchBoxSeam
              value={query.search ?? ''}
              placeholder={t('org-unit:filters.searchPlaceholder')}
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
              {t('org-unit:filters.status')}
            </span>
            <select
              value={query.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  status: (event.target.value || undefined) as typeof query.status,
                })
              }
            >
              {statusOptions.map((statusOption) => (
                <option key={statusOption || 'all'} value={statusOption}>
                  {statusOption
                    ? t(`org-unit:statuses.${statusOption}`)
                    : t('org-unit:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('org-unit:filters.type')}
            </span>
            <input
              value={query.type ?? ''}
              placeholder={t('org-unit:filters.typePlaceholder')}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => {
                patchQuery({
                  type: event.target.value || undefined,
                });
              }}
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('org-unit:filters.parentOrgUnitId')}
            </span>
            <input
              value={query.parentOrgUnitId ?? ''}
              placeholder={t('org-unit:filters.parentOrgUnitIdPlaceholder')}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => {
                patchQuery({
                  parentOrgUnitId: event.target.value || undefined,
                });
              }}
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('org-unit:filters.rootOnly')}
            </span>
            <select
              value={query.rootOnly === undefined ? '' : query.rootOnly ? 'true' : 'false'}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => {
                const value = event.target.value;
                patchQuery({
                  rootOnly: value === '' ? undefined : value === 'true',
                });
              }}
            >
              <option value="">{t('org-unit:filters.allRootModes')}</option>
              <option value="true">{t('org-unit:filters.onlyRoots')}</option>
              <option value="false">{t('org-unit:filters.withParent')}</option>
            </select>
          </label>
        </FilterBarShell>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <OrgUnitCreateSurface
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
            emptyTitle={t('org-unit:states.emptyTitle')}
            emptyMessage={t('org-unit:states.emptyMessage')}
            caption={t('org-unit:table.caption')}
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
          title={t('org-unit:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'org-unit:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
