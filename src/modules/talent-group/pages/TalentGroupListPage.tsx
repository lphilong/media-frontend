import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { TalentGroupCreateSurface } from '@modules/talent-group/forms/talent-group-mutation-forms';
import {
  useCreateTalentGroupMutation,
  useTalentGroupByTalentList,
  useTalentGroupFlatList,
  useTalentGroupLifecycleMutation,
} from '@modules/talent-group/hooks/use-talent-group';
import {
  createTalentGroupByTalentColumns,
  createTalentGroupListColumns,
} from '@modules/talent-group/tables/talent-group-columns';
import type {
  TalentGroupFlatListQuery,
  TalentGroupLifecycleAction,
} from '@modules/talent-group/types/talent-group.types';
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
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { ReferenceFilterField, type ReferenceOption } from '@shared/components/reference';
import { loadTalentReferenceOptions } from '@shared/components/reference/admin-reference-options';
import {
  createCursorStack,
  mergeScreenQueryParams,
  moveNextCursor,
  movePreviousCursor,
  parseScreenQueryParams,
  serializeScreenQueryParams,
  talentGroupByTalentQueryConfig,
  talentGroupFlatListQueryConfig,
} from '@shared/query';
import { ModuleListScreenShell } from '@shared/modules';
import {
  readReferenceDisplay,
  readReferenceDisplayForId,
} from '@shared/formatting/reference-display';

type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
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

const sortOptions = [
  { value: 'groupCode', labelKey: 'talent-group:sort.groupCode' },
  { value: 'name', labelKey: 'talent-group:sort.name' },
  { value: 'createdAt', labelKey: 'talent-group:sort.createdAt' },
  { value: 'displayOrder', labelKey: 'talent-group:sort.displayOrder' },
] as const;

const groupStatusOptions = ['', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;

const readLifecycleConfirmKey = (action: TalentGroupLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'talent-group:confirm.activate';
    case 'deactivate':
      return 'talent-group:confirm.deactivate';
    case 'archive':
      return 'talent-group:confirm.archive';
    default:
      return 'talent-group:confirm.archive';
  }
};

export const TalentGroupListPage = (): JSX.Element => {
  const { t } = useTranslation(['talent-group', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const byTalentQuery = useMemo(
    () => parseScreenQueryParams(searchParams, talentGroupByTalentQueryConfig),
    [searchParams],
  );
  const isByTalentView = byTalentQuery.view === 'by-talent';
  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, talentGroupFlatListQueryConfig),
    [searchParams],
  );
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(
    () =>
      isByTalentView
        ? serializeScreenQueryParams(byTalentQuery, talentGroupByTalentQueryConfig).toString()
        : serializeScreenQueryParams(flatListQuery, talentGroupFlatListQueryConfig).toString(),
    [byTalentQuery, flatListQuery, isByTalentView],
  );

  useEffect(() => {
    if (canonicalSearch === currentSearch) {
      return;
    }

    setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchFlatQuery = useCallback(
    (patch: Record<string, string | number | boolean | undefined>, options?: RoutePatchOptions) => {
      const next = mergeScreenQueryParams(searchParams, patch, talentGroupFlatListQueryConfig, {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      });
      setSearchParams(next, { replace: options?.replace });
    },
    [searchParams, setSearchParams],
  );
  const patchByTalentQuery = useCallback(
    (patch: Record<string, string | number | boolean | undefined>, options?: RoutePatchOptions) => {
      const next = mergeScreenQueryParams(searchParams, patch, talentGroupByTalentQueryConfig, {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      });
      setSearchParams(next, { replace: options?.replace });
    },
    [searchParams, setSearchParams],
  );
  const patchQuery = isByTalentView ? patchByTalentQuery : patchFlatQuery;

  const flatListQueryResult = useTalentGroupFlatList(flatListQuery, {
    enabled: !isByTalentView,
  });
  const byTalentListQueryResult = useTalentGroupByTalentList(byTalentQuery, {
    enabled: isByTalentView,
  });
  const listQueryResult = isByTalentView ? byTalentListQueryResult : flatListQueryResult;

  const createMutation = useCreateTalentGroupMutation();
  const lifecycleMutation = useTalentGroupLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterOptionLabels, setFilterOptionLabels] = useState<Record<string, string>>({});
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    if (isByTalentView) {
      return serializeScreenQueryParams(
        {
          ...byTalentQuery,
          cursor: undefined,
        },
        talentGroupByTalentQueryConfig,
      ).toString();
    }

    return serializeScreenQueryParams(
      {
        ...flatListQuery,
        cursor: undefined,
      },
      talentGroupFlatListQueryConfig,
    ).toString();
  }, [byTalentQuery, flatListQuery, isByTalentView]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const pageActions = (
    <div className="flex flex-wrap items-center gap-2">
      {isByTalentView ? (
        <button
          type="button"
          className="rounded border border-border bg-panel px-3 py-2 text-sm"
          onClick={() => {
            setCursorStack(createCursorStack());
            setSearchParams(serializeScreenQueryParams({}, talentGroupFlatListQueryConfig), {
              replace: false,
            });
          }}
        >
          {t('talent-group:actions.exitByTalent')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setIsCreateOpen((current) => !current)}
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {isCreateOpen ? t('talent-group:actions.closeCreate') : t('talent-group:actions.create')}
      </button>
    </div>
  );

  usePageActions(pageActions);

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(isByTalentView ? byTalentQuery.cursor : flatListQuery.cursor);

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
      notifySuccess('talent-group:feedback.created');
      setIsCreateOpen(false);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onLifecycleAction = useCallback(
    async (groupId: string, action: TalentGroupLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          groupId,
          action,
        });
        notifySuccess('talent-group:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const flatColumns = useMemo(
    () =>
      createTalentGroupListColumns(t, {
        onOpenDetail: (groupId) => navigate(APP_PATHS.talentGroupDetail(groupId)),
        onLifecycleAction,
        isActionPending: (groupId, action) => {
          return (
            lifecycleMutation.isPending &&
            lifecycleMutation.variables?.groupId === groupId &&
            lifecycleMutation.variables?.action === action
          );
        },
      }),
    [lifecycleMutation.isPending, lifecycleMutation.variables, navigate, onLifecycleAction, t],
  );

  const byTalentColumns = useMemo(
    () =>
      createTalentGroupByTalentColumns(t, {
        onOpenDetail: (groupId) => navigate(APP_PATHS.talentGroupDetail(groupId)),
        onLifecycleAction,
        isActionPending: (groupId, action) => {
          return (
            lifecycleMutation.isPending &&
            lifecycleMutation.variables?.groupId === groupId &&
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
  const moreFilterCount = !isByTalentView && flatListQuery.containsTalentId ? 1 : 0;
  const clearTalentGroupFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
      containsTalentId: undefined,
    });
  }, [patchQuery]);
  const containsTalentFilterLabel = useMemo(
    () => readReferenceDisplay(undefined, flatListQuery.containsTalentId),
    [flatListQuery.containsTalentId],
  );
  const relatedTalentLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        byTalentQuery.talentId,
        (byTalentListQueryResult.data?.data ?? []).map((record) => record.talentRef),
      ),
    [byTalentListQueryResult.data?.data, byTalentQuery.talentId],
  );
  const appliedFilterChips = useMemo<AppliedFilterChipItem[]>(() => {
    const items: AppliedFilterChipItem[] = [];

    if (!isByTalentView && flatListQuery.search) {
      items.push({
        id: 'search',
        label: t('common:labels.search'),
        value: flatListQuery.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    const activeStatus = isByTalentView ? byTalentQuery.status : flatListQuery.status;
    if (activeStatus) {
      items.push({
        id: 'status',
        label: t('talent-group:filters.status'),
        value: t(`talent-group:statuses.${activeStatus}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    if (!isByTalentView && flatListQuery.containsTalentId) {
      items.push({
        id: 'contains-talent',
        label: t('talent-group:filters.containsTalentId'),
        value: filterOptionLabels.containsTalent ?? containsTalentFilterLabel,
        onClear: () => patchQuery({ containsTalentId: undefined }),
      });
    }

    return items;
  }, [
    byTalentQuery.status,
    containsTalentFilterLabel,
    filterOptionLabels.containsTalent,
    flatListQuery.containsTalentId,
    flatListQuery.search,
    flatListQuery.status,
    isByTalentView,
    patchQuery,
    t,
  ]);

  return (
    <ModuleListScreenShell
      mode={isByTalentView ? 'related-list' : 'flat-list'}
      banner={
        isByTalentView ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-text">
            <span className="font-medium">{t('talent-group:related.byTalentModeLabel')}</span>{' '}
            <span>{relatedTalentLabel}</span>
          </div>
        ) : undefined
      }
      filterBar={
        <FilterToolbar
          searchSlot={
            !isByTalentView ? (
              <SearchBoxSeam
                value={flatListQuery.search ?? ''}
                placeholder={t('talent-group:filters.searchPlaceholder')}
                onApply={(value) => {
                  patchQuery({
                    search: value || undefined,
                  });
                }}
              />
            ) : undefined
          }
          sortSlot={
            <SortControlSeam
              sortBy={isByTalentView ? byTalentQuery.sortBy : flatListQuery.sortBy}
              sortDirection={
                isByTalentView ? byTalentQuery.sortDirection : flatListQuery.sortDirection
              }
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
            !isByTalentView ? (
              <button
                type="button"
                aria-expanded={isMoreFiltersOpen}
                aria-controls="talent-group-more-filters"
                onClick={() => setIsMoreFiltersOpen((current) => !current)}
                className="rounded border border-border bg-panel px-3 py-1.5 text-sm font-medium"
              >
                {t('common:filters.moreFilters')}
                {moreFilterCount > 0 ? ` (${moreFilterCount})` : ''}
              </button>
            ) : undefined
          }
          moreFiltersPanel={
            !isByTalentView ? (
              <MoreFiltersPanel
                id="talent-group-more-filters"
                title={t('common:filters.moreFilters')}
                closeLabel={t('common:actions.close')}
                isOpen={isMoreFiltersOpen}
                onClose={() => setIsMoreFiltersOpen(false)}
              >
                <ReferenceFilterField
                  label={t('talent-group:filters.containsTalentId')}
                  pickerId="talent-group-filter-contains-talent"
                  value={flatListQuery.containsTalentId}
                  loadOptions={loadTalentReferenceOptions}
                  placeholder={t('talent-group:placeholders.talentSearch')}
                  clearLabel={t('common:actions.clear')}
                  className="min-w-[240px]"
                  onSelectedOptionChange={(option) =>
                    rememberFilterOption('containsTalent', option)
                  }
                  onChange={(nextId) =>
                    patchQuery({
                      containsTalentId: nextId,
                    })
                  }
                />
              </MoreFiltersPanel>
            ) : undefined
          }
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              items={appliedFilterChips}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              onClearAll={appliedFilterChips.length > 0 ? clearTalentGroupFilters : undefined}
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('talent-group:filters.status')}
            </span>
            <select
              value={isByTalentView ? (byTalentQuery.status ?? '') : (flatListQuery.status ?? '')}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  status: (event.target.value || undefined) as TalentGroupFlatListQuery['status'],
                })
              }
            >
              {groupStatusOptions.map((statusOption) => (
                <option key={statusOption || 'all'} value={statusOption}>
                  {statusOption
                    ? t(`talent-group:statuses.${statusOption}`)
                    : t('talent-group:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterToolbar>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <TalentGroupCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={onCreateSubmit}
            />
          ) : null}
        </>
      }
      tableSection={
        <div className="space-y-4">
          {isByTalentView ? (
            <AdminTableShell
              data={byTalentListQueryResult.data?.data ?? []}
              columns={byTalentColumns}
              isLoading={byTalentListQueryResult.isFetching && !byTalentListQueryResult.data}
              emptyTitle={t('talent-group:states.emptyTitle')}
              emptyMessage={t('talent-group:states.emptyMessage')}
              caption={t('talent-group:table.caption')}
            />
          ) : (
            <AdminTableShell
              data={flatListQueryResult.data?.data ?? []}
              columns={flatColumns}
              isLoading={flatListQueryResult.isFetching && !flatListQueryResult.data}
              emptyTitle={t('talent-group:states.emptyTitle')}
              emptyMessage={t('talent-group:states.emptyMessage')}
              caption={t('talent-group:table.caption')}
            />
          )}
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
          title={t('talent-group:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'talent-group:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
