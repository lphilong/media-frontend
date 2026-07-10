import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { useModulePageActions } from '@app/providers/module-runtime';
import { EventCreateSurface } from '@modules/event-assignment/forms/event-assignment-mutation-forms';
import {
  useCreateEventMutation,
  useEventFlatList,
  useEventLifecycleMutation,
  useEventsByAssignment,
  useEventsByPlatform,
  useEventsByResource,
} from '@modules/event-assignment/hooks/use-event-assignment';
import { createEventListColumns } from '@modules/event-assignment/tables/event-assignment-columns';
import type {
  EventAssignmentKind,
  EventLifecycleAction,
} from '@modules/event-assignment/types/event-assignment.types';
import type { NormalizedApiError } from '@shared/api';
import {
  hasPermission,
  hasScopeGrant,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  AppliedFilterChips,
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterToolbar,
  LoadingState,
  MoreFiltersPanel,
  PermissionDeniedState,
  SearchBoxSeam,
  SortControlSeam,
  useMutationFeedback,
  type AppliedFilterChipItem,
} from '@shared/components/primitives';
import { ReferenceFilterField, type ReferenceOption } from '@shared/components/reference';
import { loadEmploymentProfileReferenceOptions } from '@modules/employment-profile';
import { loadPlatformAccountReferenceOptions } from '@modules/platform-account';
import { loadStudioResourceReferenceOptions } from '@modules/studio-resource';
import { loadTalentReferenceOptions } from '@modules/talent';
import { loadTalentGroupReferenceOptions } from '@modules/talent-group';
import { ModuleListScreenShell } from '@shared/modules';
import {
  eventByAssignmentQueryConfig,
  eventByPlatformQueryConfig,
  eventByResourceQueryConfig,
  eventFlatListQueryConfig,
} from '@modules/event-assignment';
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

const sortOptions = [
  { value: 'eventStartAt', labelKey: 'event-assignment:sort.eventStartAt' },
  { value: 'eventCode', labelKey: 'event-assignment:sort.eventCode' },
  { value: 'createdAt', labelKey: 'event-assignment:sort.createdAt' },
] as const;

const statusOptions = [
  '',
  'DRAFT',
  'PLANNED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
] as const;
const assignmentKindOptions = ['', 'EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP'] as const;

type FilterLabelKey = 'assignment' | 'studioResource' | 'platformAccount';

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

export const EventAssignmentListPage = (): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, eventFlatListQueryConfig),
    [searchParams],
  );
  const byAssignmentQuery = useMemo(
    () => parseScreenQueryParams(searchParams, eventByAssignmentQueryConfig),
    [searchParams],
  );
  const byResourceQuery = useMemo(
    () => parseScreenQueryParams(searchParams, eventByResourceQueryConfig),
    [searchParams],
  );
  const byPlatformQuery = useMemo(
    () => parseScreenQueryParams(searchParams, eventByPlatformQueryConfig),
    [searchParams],
  );

  const routeMode =
    byAssignmentQuery.view === 'by-assignment'
      ? 'by-assignment'
      : byResourceQuery.view === 'by-resource'
        ? 'by-resource'
        : byPlatformQuery.view === 'by-platform'
          ? 'by-platform'
          : 'flat';
  const activeQuery =
    routeMode === 'by-assignment'
      ? byAssignmentQuery
      : routeMode === 'by-resource'
        ? byResourceQuery
        : routeMode === 'by-platform'
          ? byPlatformQuery
          : flatListQuery;
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(() => {
    if (routeMode === 'by-assignment') {
      return serializeScreenQueryParams(byAssignmentQuery, eventByAssignmentQueryConfig).toString();
    }

    if (routeMode === 'by-resource') {
      return serializeScreenQueryParams(byResourceQuery, eventByResourceQueryConfig).toString();
    }

    if (routeMode === 'by-platform') {
      return serializeScreenQueryParams(byPlatformQuery, eventByPlatformQueryConfig).toString();
    }

    return serializeScreenQueryParams(flatListQuery, eventFlatListQueryConfig).toString();
  }, [byAssignmentQuery, byPlatformQuery, byResourceQuery, flatListQuery, routeMode]);

  useEffect(() => {
    if (canonicalSearch === currentSearch) {
      return;
    }

    setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | undefined>, options?: RoutePatchOptions) => {
      const mergeOptions = {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      };
      const next =
        routeMode === 'by-assignment'
          ? mergeScreenQueryParams(searchParams, patch, eventByAssignmentQueryConfig, mergeOptions)
          : routeMode === 'by-resource'
            ? mergeScreenQueryParams(searchParams, patch, eventByResourceQueryConfig, mergeOptions)
            : routeMode === 'by-platform'
              ? mergeScreenQueryParams(
                  searchParams,
                  patch,
                  eventByPlatformQueryConfig,
                  mergeOptions,
                )
              : mergeScreenQueryParams(searchParams, patch, eventFlatListQueryConfig, mergeOptions);
      setSearchParams(next, { replace: options?.replace });
    },
    [routeMode, searchParams, setSearchParams],
  );

  const flatQueryResult = useEventFlatList(flatListQuery, { enabled: routeMode === 'flat' });
  const capabilitiesQuery = useCurrentActorCapabilities();
  const byAssignmentQueryResult = useEventsByAssignment(byAssignmentQuery, {
    enabled: routeMode === 'by-assignment',
  });
  const byResourceQueryResult = useEventsByResource(byResourceQuery, {
    enabled: routeMode === 'by-resource',
  });
  const byPlatformQueryResult = useEventsByPlatform(byPlatformQuery, {
    enabled: routeMode === 'by-platform',
  });
  const listQueryResult =
    routeMode === 'by-assignment'
      ? byAssignmentQueryResult
      : routeMode === 'by-resource'
        ? byResourceQueryResult
        : routeMode === 'by-platform'
          ? byPlatformQueryResult
          : flatQueryResult;

  const createMutation = useCreateEventMutation();
  const lifecycleMutation = useEventLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterLabels, setFilterLabels] = useState<Partial<Record<FilterLabelKey, string>>>({});
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    if (routeMode === 'by-assignment') {
      return serializeScreenQueryParams(
        {
          ...byAssignmentQuery,
          cursor: undefined,
        },
        eventByAssignmentQueryConfig,
      ).toString();
    }

    if (routeMode === 'by-resource') {
      return serializeScreenQueryParams(
        {
          ...byResourceQuery,
          cursor: undefined,
        },
        eventByResourceQueryConfig,
      ).toString();
    }

    if (routeMode === 'by-platform') {
      return serializeScreenQueryParams(
        {
          ...byPlatformQuery,
          cursor: undefined,
        },
        eventByPlatformQueryConfig,
      ).toString();
    }

    return serializeScreenQueryParams(
      {
        ...flatListQuery,
        cursor: undefined,
      },
      eventFlatListQueryConfig,
    ).toString();
  }, [byAssignmentQuery, byPlatformQuery, byResourceQuery, flatListQuery, routeMode]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }
    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const canUseGlobalEventMutations = useMemo(() => {
    const capabilities = capabilitiesQuery.data;
    if (!capabilities) {
      return false;
    }

    return (
      hasScopeGrant(capabilities, 'eventAssignment', 'global') &&
      hasPermission(capabilities, PERMISSIONS.EVENT_MANAGE_LIFECYCLE)
    );
  }, [capabilitiesQuery.data]);

  const canCreateGlobalEvent = useMemo(() => {
    const capabilities = capabilitiesQuery.data;
    if (!capabilities) {
      return false;
    }

    return (
      hasScopeGrant(capabilities, 'eventAssignment', 'global') &&
      hasPermission(capabilities, PERMISSIONS.EVENT_CREATE)
    );
  }, [capabilitiesQuery.data]);

  useModulePageActions(
    canCreateGlobalEvent ? (
      <button
        type="button"
        onClick={() => setIsCreateOpen((current) => !current)}
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {isCreateOpen
          ? t('event-assignment:actions.closeCreate')
          : t('event-assignment:actions.create')}
      </button>
    ) : null,
  );

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(activeQuery.cursor);

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

  const onLifecycleAction = useCallback(
    async (eventId: string, action: EventLifecycleAction) => {
      try {
        await lifecycleMutation.mutateAsync({
          eventId,
          action,
        });
        notifySuccess('event-assignment:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess],
  );

  const columns = useMemo(
    () =>
      createEventListColumns(t, {
        onOpenDetail: (eventId) => navigate(APP_PATHS.eventDetail(eventId)),
        onLifecycleAction,
        canShowLifecycleActions: canUseGlobalEventMutations,
        isActionPending: (eventId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.eventId === eventId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      canUseGlobalEventMutations,
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      t,
    ],
  );

  const listError = listQueryResult.error as NormalizedApiError | null;
  const activeAssignmentKind =
    'assignmentKind' in activeQuery
      ? (activeQuery.assignmentKind as EventAssignmentKind | undefined)
      : undefined;
  const selectedAssignmentId =
    'assignmentEmploymentProfileId' in activeQuery
      ? (activeQuery.assignmentEmploymentProfileId ??
        activeQuery.assignmentTalentId ??
        activeQuery.assignmentTalentGroupId ??
        undefined)
      : undefined;
  const loadAssignmentFilterOptions = useCallback(
    (search: string) => {
      if (activeAssignmentKind === 'EMPLOYMENT_PROFILE') {
        return loadEmploymentProfileReferenceOptions(search);
      }
      if (activeAssignmentKind === 'TALENT') {
        return loadTalentReferenceOptions(search);
      }
      if (activeAssignmentKind === 'TALENT_GROUP') {
        return loadTalentGroupReferenceOptions(search);
      }

      return Promise.resolve([]);
    },
    [activeAssignmentKind],
  );
  const shellState = useMemo(() => {
    if (listQueryResult.isPending) {
      return 'loading' as const;
    }

    if (listQueryResult.isError) {
      return listError?.permissionDenied ? 'denied' : 'error';
    }

    return 'ready' as const;
  }, [listError?.permissionDenied, listQueryResult.isError, listQueryResult.isPending]);

  const rememberFilterLabel = useCallback(
    (key: FilterLabelKey) => (option: ReferenceOption | undefined) => {
      if (!option) {
        return;
      }

      setFilterLabels((current) => ({ ...current, [key]: option.label }));
    },
    [],
  );

  const activeFilterChips = useMemo(() => {
    const chips: AppliedFilterChipItem[] = [];

    if (routeMode === 'flat' && flatListQuery.search) {
      chips.push({
        id: 'search',
        label: t('common:labels.search'),
        value: flatListQuery.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    if (activeQuery.status) {
      chips.push({
        id: 'status',
        label: t('event-assignment:filters.status'),
        value: t(`event-assignment:statuses.${activeQuery.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    if ('statusGroup' in activeQuery && activeQuery.statusGroup === 'ACTIVE') {
      chips.push({
        id: 'statusGroup',
        label: 'Status group',
        value: 'Active',
        onClear: () => patchQuery({ statusGroup: undefined }),
      });
    }

    if (routeMode === 'flat' && 'assignmentKind' in activeQuery && activeQuery.assignmentKind) {
      chips.push({
        id: 'assignmentKind',
        label: t('event-assignment:filters.assignmentKind'),
        value: t(`event-assignment:assignmentKinds.${activeQuery.assignmentKind}`),
        onClear: () =>
          patchQuery({
            assignmentKind: undefined,
            assignmentEmploymentProfileId: undefined,
            assignmentTalentId: undefined,
            assignmentTalentGroupId: undefined,
          }),
      });
    }

    if (routeMode === 'flat' && selectedAssignmentId) {
      chips.push({
        id: 'assignment',
        label: t('event-assignment:filters.assignmentId'),
        value: filterLabels.assignment ?? selectedAssignmentId,
        onClear: () =>
          patchQuery({
            assignmentEmploymentProfileId: undefined,
            assignmentTalentId: undefined,
            assignmentTalentGroupId: undefined,
          }),
      });
    }

    const studioResourceId =
      routeMode === 'by-resource'
        ? (byResourceQuery.studioResourceId ?? undefined)
        : (flatListQuery.containsStudioResourceId ?? undefined);
    if (routeMode === 'flat' && studioResourceId) {
      chips.push({
        id: 'studioResource',
        label: t('event-assignment:filters.studioResourceId'),
        value: filterLabels.studioResource ?? studioResourceId,
        onClear: () => patchQuery({ containsStudioResourceId: undefined }),
      });
    }

    const platformAccountId =
      routeMode === 'by-platform'
        ? (byPlatformQuery.platformAccountId ?? undefined)
        : (flatListQuery.containsPlatformAccountId ?? undefined);
    if (routeMode === 'flat' && platformAccountId) {
      chips.push({
        id: 'platformAccount',
        label: t('event-assignment:filters.platformAccountId'),
        value: filterLabels.platformAccount ?? platformAccountId,
        onClear: () => patchQuery({ containsPlatformAccountId: undefined }),
      });
    }

    if (activeQuery.windowStartAt !== undefined) {
      chips.push({
        id: 'windowStartAt',
        label: t('event-assignment:filters.windowStartAt'),
        value: String(activeQuery.windowStartAt),
        onClear: () => patchQuery({ windowStartAt: undefined }),
      });
    }

    if (activeQuery.windowEndAt !== undefined) {
      chips.push({
        id: 'windowEndAt',
        label: t('event-assignment:filters.windowEndAt'),
        value: String(activeQuery.windowEndAt),
        onClear: () => patchQuery({ windowEndAt: undefined }),
      });
    }

    if ('eventOverlapStartAt' in activeQuery && activeQuery.eventOverlapStartAt !== undefined) {
      chips.push({
        id: 'eventOverlapStartAt',
        label: 'Event overlaps from',
        value: String(activeQuery.eventOverlapStartAt),
        onClear: () => patchQuery({ eventOverlapStartAt: undefined }),
      });
    }

    if ('eventOverlapEndAt' in activeQuery && activeQuery.eventOverlapEndAt !== undefined) {
      chips.push({
        id: 'eventOverlapEndAt',
        label: 'Event overlaps until',
        value: String(activeQuery.eventOverlapEndAt),
        onClear: () => patchQuery({ eventOverlapEndAt: undefined }),
      });
    }

    if ('eventStartFromAt' in activeQuery && activeQuery.eventStartFromAt !== undefined) {
      chips.push({
        id: 'eventStartFromAt',
        label: 'Event starts from',
        value: String(activeQuery.eventStartFromAt),
        onClear: () => patchQuery({ eventStartFromAt: undefined }),
      });
    }

    if ('eventStartToAt' in activeQuery && activeQuery.eventStartToAt !== undefined) {
      chips.push({
        id: 'eventStartToAt',
        label: 'Event starts until',
        value: String(activeQuery.eventStartToAt),
        onClear: () => patchQuery({ eventStartToAt: undefined }),
      });
    }

    return chips;
  }, [
    activeQuery,
    byPlatformQuery.platformAccountId,
    byResourceQuery.studioResourceId,
    filterLabels.assignment,
    filterLabels.platformAccount,
    filterLabels.studioResource,
    flatListQuery.containsPlatformAccountId,
    flatListQuery.containsStudioResourceId,
    flatListQuery.search,
    patchQuery,
    routeMode,
    selectedAssignmentId,
    t,
  ]);

  const clearAllFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
      statusGroup: undefined,
      assignmentKind: undefined,
      assignmentEmploymentProfileId: undefined,
      assignmentTalentId: undefined,
      assignmentTalentGroupId: undefined,
      containsStudioResourceId: undefined,
      containsPlatformAccountId: undefined,
      windowStartAt: undefined,
      windowEndAt: undefined,
      eventOverlapStartAt: undefined,
      eventOverlapEndAt: undefined,
      eventStartFromAt: undefined,
      eventStartToAt: undefined,
    });
  }, [patchQuery]);

  return (
    <ModuleListScreenShell
      mode={routeMode === 'flat' ? 'flat-list' : 'related-list'}
      banner={
        <div className="space-y-2">
          {routeMode !== 'flat' ? (
            <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-text">
              {t(`event-assignment:relatedModes.${routeMode}`)}
            </div>
          ) : null}
        </div>
      }
      filterBar={
        <FilterToolbar
          searchSlot={
            routeMode === 'flat' ? (
              <SearchBoxSeam
                value={flatListQuery.search ?? ''}
                placeholder={t('event-assignment:filters.searchPlaceholder')}
                onApply={(value) => patchQuery({ search: value || undefined })}
              />
            ) : undefined
          }
          sortSlot={
            <SortControlSeam
              sortBy={activeQuery.sortBy}
              sortDirection={activeQuery.sortDirection}
              options={sortOptions.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              onChange={(sortBy, sortDirection) => patchQuery({ sortBy, sortDirection })}
            />
          }
          moreFiltersTrigger={
            <button
              type="button"
              aria-expanded={isMoreFiltersOpen}
              aria-controls="event-assignment-more-filters"
              onClick={() => setIsMoreFiltersOpen((current) => !current)}
              className="rounded border border-border bg-panel px-3 py-1.5 text-sm font-medium"
            >
              {t('common:filters.moreFilters')}
            </button>
          }
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              emptyLabel={t('common:filters.noFiltersApplied')}
              items={activeFilterChips}
              onClearAll={activeFilterChips.length > 0 ? clearAllFilters : undefined}
            />
          }
          moreFiltersPanel={
            <MoreFiltersPanel
              id="event-assignment-more-filters"
              title={t('common:filters.moreFilters')}
              isOpen={isMoreFiltersOpen}
              closeLabel={t('common:actions.close')}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
              {routeMode === 'flat' || routeMode === 'by-assignment' ? (
                <>
                  <label className="flex min-w-[210px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('event-assignment:filters.assignmentKind')}
                    </span>
                    <select
                      value={
                        'assignmentKind' in activeQuery ? (activeQuery.assignmentKind ?? '') : ''
                      }
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        patchQuery({
                          assignmentKind: event.target.value || undefined,
                          assignmentEmploymentProfileId: undefined,
                          assignmentTalentId: undefined,
                          assignmentTalentGroupId: undefined,
                        })
                      }
                    >
                      {assignmentKindOptions.map((kind) => (
                        <option key={kind || 'all'} value={kind}>
                          {kind
                            ? t(`event-assignment:assignmentKinds.${kind}`)
                            : t('event-assignment:filters.allAssignmentKinds')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ReferenceFilterField
                    label={t('event-assignment:filters.assignmentId')}
                    pickerId="event-assignment-filter-assignment"
                    value={selectedAssignmentId}
                    loadOptions={loadAssignmentFilterOptions}
                    placeholder={t('event-assignment:filters.assignmentIdPlaceholder')}
                    clearLabel={t('common:actions.clear')}
                    disabled={!activeAssignmentKind}
                    onSelectedOptionChange={rememberFilterLabel('assignment')}
                    onChange={(value) =>
                      patchQuery({
                        assignmentEmploymentProfileId:
                          activeAssignmentKind === 'EMPLOYMENT_PROFILE' ? value : undefined,
                        assignmentTalentId: activeAssignmentKind === 'TALENT' ? value : undefined,
                        assignmentTalentGroupId:
                          activeAssignmentKind === 'TALENT_GROUP' ? value : undefined,
                      })
                    }
                  />
                </>
              ) : null}
              <ReferenceFilterField
                label={t('event-assignment:filters.studioResourceId')}
                pickerId="event-assignment-filter-studio-resource"
                value={
                  routeMode === 'by-resource'
                    ? (byResourceQuery.studioResourceId ?? undefined)
                    : (flatListQuery.containsStudioResourceId ?? undefined)
                }
                loadOptions={loadStudioResourceReferenceOptions}
                placeholder={t('event-assignment:filters.studioResourceIdPlaceholder')}
                clearLabel={t('common:actions.clear')}
                onSelectedOptionChange={rememberFilterLabel('studioResource')}
                onChange={(value) =>
                  patchQuery(
                    routeMode === 'by-resource'
                      ? { studioResourceId: value }
                      : { containsStudioResourceId: value },
                  )
                }
              />
              <ReferenceFilterField
                label={t('event-assignment:filters.platformAccountId')}
                pickerId="event-assignment-filter-platform-account"
                value={
                  routeMode === 'by-platform'
                    ? (byPlatformQuery.platformAccountId ?? undefined)
                    : (flatListQuery.containsPlatformAccountId ?? undefined)
                }
                loadOptions={loadPlatformAccountReferenceOptions}
                placeholder={t('event-assignment:filters.platformAccountIdPlaceholder')}
                clearLabel={t('common:actions.clear')}
                onSelectedOptionChange={rememberFilterLabel('platformAccount')}
                onChange={(value) =>
                  patchQuery(
                    routeMode === 'by-platform'
                      ? { platformAccountId: value }
                      : { containsPlatformAccountId: value },
                  )
                }
              />
              <label className="flex min-w-[170px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('event-assignment:filters.windowStartAt')}
                </span>
                <input
                  type="number"
                  value={activeQuery.windowStartAt ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      windowStartAt: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="flex min-w-[170px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('event-assignment:filters.windowEndAt')}
                </span>
                <input
                  type="number"
                  value={activeQuery.windowEndAt ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      windowEndAt: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
            </MoreFiltersPanel>
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('event-assignment:filters.status')}
            </span>
            <select
              value={activeQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              {statusOptions.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status
                    ? t(`event-assignment:statuses.${status}`)
                    : t('event-assignment:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterToolbar>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <EventCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={async (payload) => {
                try {
                  await createMutation.mutateAsync(payload);
                  notifySuccess('event-assignment:feedback.created');
                  setIsCreateOpen(false);
                } catch (error) {
                  notifyError(error as NormalizedApiError);
                }
              }}
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
            emptyTitle={t('event-assignment:states.emptyTitle')}
            emptyMessage={t('event-assignment:states.emptyMessage')}
            caption={t('event-assignment:table.caption')}
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
          title={t('event-assignment:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'event-assignment:states.loadErrorMessage')}
          technicalDetails={listError}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
