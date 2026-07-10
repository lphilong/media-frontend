import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { useModulePageActions } from '@app/providers/module-runtime';
import { StudioResourceCreateSurface } from '@modules/studio-resource/forms/studio-resource-mutation-forms';
import {
  useCreateStudioResourceMutation,
  useStudioResourceAvailability,
  useStudioResourceFlatList,
  useStudioResourceLifecycleMutation,
} from '@modules/studio-resource/hooks/use-studio-resource';
import {
  createStudioResourceAvailabilityColumns,
  createStudioResourceListColumns,
} from '@modules/studio-resource/tables/studio-resource-columns';
import type {
  StudioResourceLifecycleAction,
  StudioResourceListQuery,
} from '@modules/studio-resource/types/studio-resource.types';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  AppliedFilterChips,
  type AppliedFilterChipItem,
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterToolbar,
  LoadingState,
  useModalHost,
  PermissionDeniedState,
  SearchBoxSeam,
  SortControlSeam,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { ModuleListScreenShell } from '@shared/modules';
import { studioResourceAvailabilityQueryConfig, studioResourceFlatListQueryConfig } from '@modules/studio-resource';
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query/cursor';
import {
  mergeScreenQueryParams,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query/screen-query-config';

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
  { value: 'resourceCode', labelKey: 'studio-resource:sort.resourceCode' },
  { value: 'name', labelKey: 'studio-resource:sort.name' },
  { value: 'createdAt', labelKey: 'studio-resource:sort.createdAt' },
] as const;

const operationalStatusOptions = ['', 'ACTIVE', 'OUT_OF_SERVICE', 'INACTIVE', 'ARCHIVED'] as const;
const resourceClassOptions = ['', 'SPACE', 'EQUIPMENT', 'KIT'] as const;

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

export const StudioResourceListPage = (): JSX.Element => {
  const { t } = useTranslation(['studio-resource', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const availabilityQuery = useMemo(
    () => parseScreenQueryParams(searchParams, studioResourceAvailabilityQueryConfig),
    [searchParams],
  );
  const isAvailabilityView = searchParams.get('view') === 'availability';
  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, studioResourceFlatListQueryConfig),
    [searchParams],
  );
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(
    () =>
      isAvailabilityView
        ? serializeScreenQueryParams(
            availabilityQuery,
            studioResourceAvailabilityQueryConfig,
          ).toString()
        : serializeScreenQueryParams(flatListQuery, studioResourceFlatListQueryConfig).toString(),
    [availabilityQuery, flatListQuery, isAvailabilityView],
  );

  useEffect(() => {
    if (canonicalSearch === currentSearch) {
      return;
    }

    setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchFlatQuery = useCallback(
    (patch: Record<string, string | number | boolean | undefined>, options?: RoutePatchOptions) => {
      const next = mergeScreenQueryParams(searchParams, patch, studioResourceFlatListQueryConfig, {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      });
      setSearchParams(next, { replace: options?.replace });
    },
    [searchParams, setSearchParams],
  );
  const patchAvailabilityQuery = useCallback(
    (patch: Record<string, string | number | boolean | undefined>, options?: RoutePatchOptions) => {
      const next = mergeScreenQueryParams(
        searchParams,
        {
          view: 'availability',
          ...patch,
        },
        studioResourceAvailabilityQueryConfig,
        {
          resetCursorOnChange: options?.resetCursorOnChange ?? true,
        },
      );
      setSearchParams(next, { replace: options?.replace });
    },
    [searchParams, setSearchParams],
  );
  const patchQuery = isAvailabilityView ? patchAvailabilityQuery : patchFlatQuery;

  const flatListQueryResult = useStudioResourceFlatList(flatListQuery, {
    enabled: !isAvailabilityView,
  });
  const availabilityQueryResult = useStudioResourceAvailability(availabilityQuery, {
    enabled: isAvailabilityView,
  });
  const listQueryResult = isAvailabilityView ? availabilityQueryResult : flatListQueryResult;

  const capabilitiesQuery = useCurrentActorCapabilities();
  const createMutation = useCreateStudioResourceMutation();
  const lifecycleMutation = useStudioResourceLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const { close: closeModal, openDrawer } = useModalHost();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    if (isAvailabilityView) {
      return serializeScreenQueryParams(
        {
          ...availabilityQuery,
          cursor: undefined,
        },
        studioResourceAvailabilityQueryConfig,
      ).toString();
    }

    return serializeScreenQueryParams(
      {
        ...flatListQuery,
        cursor: undefined,
      },
      studioResourceFlatListQueryConfig,
    ).toString();
  }, [availabilityQuery, flatListQuery, isAvailabilityView]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const canCreateStudioResource = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.STUDIO_RESOURCE_CREATE,
  });
  const canManageStudioResourceLifecycle = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.STUDIO_RESOURCE_MANAGE_LIFECYCLE,
  });

  const onCreateSubmit = useCallback(
    async (payload: Parameters<typeof createMutation.mutateAsync>[0]) => {
      try {
        await createMutation.mutateAsync(payload);
        notifySuccess('studio-resource:feedback.created');
        setIsCreateOpen(false);
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [createMutation, notifyError, notifySuccess],
  );

  useEffect(() => {
    if (!isCreateOpen || !canCreateStudioResource) {
      closeModal();
      return;
    }

    openDrawer({
      title: t('studio-resource:mutations.create.title'),
      content: (
        <StudioResourceCreateSurface
          presentation="drawer"
          isPending={createMutation.isPending}
          onCancel={() => setIsCreateOpen(false)}
          onSubmit={onCreateSubmit}
        />
      ),
    });
  }, [
    canCreateStudioResource,
    closeModal,
    createMutation.isPending,
    isCreateOpen,
    onCreateSubmit,
    openDrawer,
    t,
  ]);

  useEffect(
    () => () => {
      closeModal();
    },
    [closeModal],
  );

  const pageActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded border border-border bg-panel px-3 py-2 text-sm"
        onClick={() => {
          setCursorStack(createCursorStack());
          if (isAvailabilityView) {
            setSearchParams(serializeScreenQueryParams({}, studioResourceFlatListQueryConfig), {
              replace: false,
            });
            return;
          }

          setSearchParams(
            serializeScreenQueryParams(
              {
                view: 'availability',
              },
              studioResourceAvailabilityQueryConfig,
            ),
            { replace: false },
          );
        }}
      >
        {isAvailabilityView
          ? t('studio-resource:actions.exitAvailability')
          : t('studio-resource:actions.openAvailability')}
      </button>
      {canCreateStudioResource ? (
        <button
          type="button"
          onClick={() => setIsCreateOpen((current) => !current)}
          className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          {isCreateOpen
            ? t('studio-resource:actions.closeCreate')
            : t('studio-resource:actions.create')}
        </button>
      ) : null}
    </div>
  );

  useModulePageActions(pageActions);

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(isAvailabilityView ? availabilityQuery.cursor : flatListQuery.cursor);

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

  const onLifecycleAction = useCallback(
    async (studioResourceId: string, action: StudioResourceLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          studioResourceId,
          action,
        });
        notifySuccess('studio-resource:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const flatColumns = useMemo(
    () =>
      createStudioResourceListColumns(t, {
        onOpenDetail: (studioResourceId) =>
          navigate(APP_PATHS.studioResourceDetail(studioResourceId)),
        onLifecycleAction,
        canShowLifecycleAction: () => canManageStudioResourceLifecycle,
        isActionPending: (studioResourceId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.studioResourceId === studioResourceId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      canManageStudioResourceLifecycle,
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      t,
    ],
  );

  const availabilityColumns = useMemo(
    () =>
      createStudioResourceAvailabilityColumns(t, {
        onOpenDetail: (studioResourceId) =>
          navigate(APP_PATHS.studioResourceDetail(studioResourceId)),
      }),
    [navigate, t],
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

  const activeQuery = isAvailabilityView ? availabilityQuery : flatListQuery;
  const clearStudioResourceFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      operationalStatus: undefined,
      resourceClass: undefined,
      hasMaxOccupancy: undefined,
      sortBy: undefined,
      sortDirection: undefined,
    });
  }, [patchQuery]);

  const appliedFilterChips = useMemo<AppliedFilterChipItem[]>(() => {
    const items: AppliedFilterChipItem[] = [];

    if (activeQuery.search) {
      items.push({
        id: 'search',
        label: t('common:labels.search'),
        value: activeQuery.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    if (activeQuery.operationalStatus) {
      items.push({
        id: 'operationalStatus',
        label: t('studio-resource:filters.operationalStatus'),
        value: t(`studio-resource:statuses.${activeQuery.operationalStatus}`),
        onClear: () => patchQuery({ operationalStatus: undefined }),
      });
    }

    if (activeQuery.resourceClass) {
      items.push({
        id: 'resourceClass',
        label: t('studio-resource:filters.resourceClass'),
        value: t(`studio-resource:resourceClasses.${activeQuery.resourceClass}`),
        onClear: () => patchQuery({ resourceClass: undefined }),
      });
    }

    if (activeQuery.hasMaxOccupancy !== undefined) {
      items.push({
        id: 'hasMaxOccupancy',
        label: t('studio-resource:filters.hasMaxOccupancy'),
        value: activeQuery.hasMaxOccupancy
          ? t('studio-resource:filters.withOccupancy')
          : t('studio-resource:filters.withoutOccupancy'),
        onClear: () => patchQuery({ hasMaxOccupancy: undefined }),
      });
    }

    return items;
  }, [
    activeQuery.hasMaxOccupancy,
    activeQuery.operationalStatus,
    activeQuery.resourceClass,
    activeQuery.search,
    patchQuery,
    t,
  ]);
  const hasActiveFilters = appliedFilterChips.length > 0;

  return (
    <ModuleListScreenShell
      mode={isAvailabilityView ? 'related-list' : 'flat-list'}
      banner={
        <div className="space-y-3">
          {isAvailabilityView ? (
            <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-text">
              {t('studio-resource:availability.modeLabel')}
            </div>
          ) : null}
        </div>
      }
      filterBar={
        <FilterToolbar
          searchSlot={
            <SearchBoxSeam
              value={activeQuery.search ?? ''}
              placeholder={t('studio-resource:filters.searchPlaceholder')}
              onApply={(value) => {
                patchQuery({
                  search: value || undefined,
                });
              }}
            />
          }
          sortSlot={
            <SortControlSeam
              sortBy={activeQuery.sortBy}
              sortDirection={activeQuery.sortDirection}
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
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              items={appliedFilterChips}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              emptyLabel={t('common:filters.noFiltersApplied')}
              onClearAll={hasActiveFilters ? clearStudioResourceFilters : undefined}
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('studio-resource:filters.operationalStatus')}
            </span>
            <select
              value={activeQuery.operationalStatus ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  operationalStatus: (event.target.value ||
                    undefined) as StudioResourceListQuery['operationalStatus'],
                })
              }
            >
              {operationalStatusOptions.map((statusOption) => (
                <option key={statusOption || 'all'} value={statusOption}>
                  {statusOption
                    ? t(`studio-resource:statuses.${statusOption}`)
                    : t('studio-resource:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('studio-resource:filters.resourceClass')}
            </span>
            <select
              value={activeQuery.resourceClass ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ resourceClass: event.target.value || undefined })}
            >
              {resourceClassOptions.map((classOption) => (
                <option key={classOption || 'all'} value={classOption}>
                  {classOption
                    ? t(`studio-resource:resourceClasses.${classOption}`)
                    : t('studio-resource:filters.allResourceClasses')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[190px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('studio-resource:filters.hasMaxOccupancy')}
            </span>
            <select
              value={
                activeQuery.hasMaxOccupancy === undefined
                  ? ''
                  : activeQuery.hasMaxOccupancy
                    ? 'true'
                    : 'false'
              }
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => {
                const value = event.target.value;
                patchQuery({
                  hasMaxOccupancy: value === '' ? undefined : value === 'true',
                });
              }}
            >
              <option value="">{t('studio-resource:filters.allOccupancyStates')}</option>
              <option value="true">{t('studio-resource:filters.withOccupancy')}</option>
              <option value="false">{t('studio-resource:filters.withoutOccupancy')}</option>
            </select>
          </label>
        </FilterToolbar>
      }
      tableSection={
        <div className="space-y-4">
          {isAvailabilityView ? (
            <AdminTableShell
              data={availabilityQueryResult.data?.data ?? []}
              columns={availabilityColumns}
              isLoading={availabilityQueryResult.isFetching && !availabilityQueryResult.data}
              emptyTitle={t('studio-resource:states.emptyTitle')}
              emptyMessage={t('studio-resource:states.emptyMessage')}
              caption={t('studio-resource:availability.caption')}
            />
          ) : (
            <AdminTableShell
              data={flatListQueryResult.data?.data ?? []}
              columns={flatColumns}
              isLoading={flatListQueryResult.isFetching && !flatListQueryResult.data}
              emptyTitle={t('studio-resource:states.emptyTitle')}
              emptyMessage={t('studio-resource:states.emptyMessage')}
              caption={t('studio-resource:table.caption')}
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
          displayedCount={listQueryResult.data?.data.length}
          limit={activeQuery.limit ?? 20}
        />
      }
      state={shellState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      errorState={
        <ErrorState
          title={t('studio-resource:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'studio-resource:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
