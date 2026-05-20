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
  AppliedFilterChips,
  type AppliedFilterChipItem,
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterToolbar,
  LoadingState,
  MoreFiltersPanel,
  PermissionDeniedState,
  SearchBoxSeam,
  SortControlSeam,
} from '@shared/components/primitives';
import { useDestructiveConfirm, useMutationFeedback } from '@shared/components/primitives';
import { ReferenceFilterField, type ReferenceOption } from '@shared/components/reference';
import { loadOrgUnitReferenceOptions } from '@shared/components/reference/admin-reference-options';
import { readReferenceDisplayForId } from '@shared/formatting/reference-display';
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
const orgUnitTypeOptions = ['', 'DEPARTMENT', 'TEAM', 'BUSINESS_UNIT', 'SUPPORT_UNIT'] as const;

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
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterOptionLabels, setFilterOptionLabels] = useState<Record<string, string>>({});
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

  const rememberFilterOption = useCallback((key: string, option: ReferenceOption | undefined) => {
    setFilterOptionLabels((current) => {
      if (option?.label) {
        return current[key] === option.label ? current : { ...current, [key]: option.label };
      }

      if (!(key in current)) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);
  const moreFilterCount = [query.parentOrgUnitId].filter(
    (value) => value !== undefined && value !== '',
  ).length;
  const clearOrgUnitFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
      type: undefined,
      parentOrgUnitId: undefined,
      rootOnly: undefined,
    });
  }, [patchQuery]);
  const parentOrgUnitFilterLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        query.parentOrgUnitId,
        (listQueryResult.data?.data ?? []).map((record) => record.parentOrgUnitRef),
      ),
    [listQueryResult.data?.data, query.parentOrgUnitId],
  );
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

    if (query.status) {
      items.push({
        id: 'status',
        label: t('org-unit:filters.status'),
        value: t(`org-unit:statuses.${query.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    if (query.type) {
      items.push({
        id: 'type',
        label: t('org-unit:filters.type'),
        value: query.type,
        onClear: () => patchQuery({ type: undefined }),
      });
    }

    if (query.rootOnly !== undefined) {
      items.push({
        id: 'root-only',
        label: t('org-unit:filters.rootOnly'),
        value: query.rootOnly ? t('org-unit:filters.onlyRoots') : t('org-unit:filters.withParent'),
        onClear: () => patchQuery({ rootOnly: undefined }),
      });
    }

    if (query.parentOrgUnitId) {
      items.push({
        id: 'parent-org-unit',
        label: t('org-unit:filters.parentOrgUnitId'),
        value: filterOptionLabels.parentOrgUnit ?? parentOrgUnitFilterLabel,
        onClear: () => patchQuery({ parentOrgUnitId: undefined }),
      });
    }

    return items;
  }, [
    filterOptionLabels.parentOrgUnit,
    parentOrgUnitFilterLabel,
    patchQuery,
    query.parentOrgUnitId,
    query.rootOnly,
    query.search,
    query.status,
    query.type,
    t,
  ]);

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterToolbar
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
          moreFiltersTrigger={
            <button
              type="button"
              aria-expanded={isMoreFiltersOpen}
              aria-controls="org-unit-more-filters"
              onClick={() => setIsMoreFiltersOpen((current) => !current)}
              className="rounded border border-border bg-panel px-3 py-1.5 text-sm font-medium"
            >
              {t('common:filters.moreFilters')}
              {moreFilterCount > 0 ? ` (${moreFilterCount})` : ''}
            </button>
          }
          moreFiltersPanel={
            <MoreFiltersPanel
              id="org-unit-more-filters"
              title={t('common:filters.moreFilters')}
              closeLabel={t('common:actions.close')}
              isOpen={isMoreFiltersOpen}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
              <ReferenceFilterField
                label={t('org-unit:filters.parentOrgUnitId')}
                pickerId="org-unit-filter-parent"
                value={query.parentOrgUnitId}
                loadOptions={loadOrgUnitReferenceOptions}
                placeholder={t('org-unit:placeholders.parentOrgUnitSearch')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[240px]"
                onSelectedOptionChange={(option) => rememberFilterOption('parentOrgUnit', option)}
                onChange={(nextId) => {
                  patchQuery({
                    parentOrgUnitId: nextId,
                  });
                }}
              />
            </MoreFiltersPanel>
          }
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              items={appliedFilterChips}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              onClearAll={appliedFilterChips.length > 0 ? clearOrgUnitFilters : undefined}
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
            <select
              value={query.type ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => {
                patchQuery({
                  type: event.target.value || undefined,
                });
              }}
            >
              {orgUnitTypeOptions.map((typeOption) => (
                <option key={typeOption || 'all'} value={typeOption}>
                  {typeOption ? t(`org-unit:types.${typeOption}`) : t('org-unit:filters.allTypes')}
                </option>
              ))}
            </select>
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
        </FilterToolbar>
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
