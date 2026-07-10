import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { useModulePageActions } from '@app/providers/module-runtime';
import { PlatformEarningBatchesPanel } from '@modules/revenue-ledger/components/PlatformEarningBatchesPanel';
import { RevenueEntryCreateSurface } from '@modules/revenue-ledger/forms/revenue-ledger-mutation-forms';
import {
  useCreateRevenueEntryMutation,
  useReconcileRevenueEntryMutation,
  useRevenueEntryLifecycleMutation,
  useRevenueLedgerByEvent,
  useRevenueLedgerByPlatform,
  useRevenueLedgerByTalent,
  useRevenueLedgerFlatList,
} from '@modules/revenue-ledger/hooks/use-revenue-ledger';
import { createRevenueLedgerColumns } from '@modules/revenue-ledger/tables/revenue-ledger-columns';
import type {
  RevenueLedgerFlatListQuery,
  RevenueLedgerLifecycleAction,
} from '@modules/revenue-ledger/types/revenue-ledger.types';
import { revenueKindValues } from '@modules/revenue-ledger/types/revenue-ledger.types';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
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
  useDestructiveConfirm,
  useMutationFeedback,
  type AppliedFilterChipItem,
} from '@shared/components/primitives';
import { ReferenceFilterField, type ReferenceOption } from '@shared/components/reference';
import { loadEventReferenceOptions } from '@modules/event-assignment';
import { loadPlatformAccountReferenceOptions } from '@modules/platform-account';
import { loadTalentReferenceOptions } from '@modules/talent';
import { ModuleListScreenShell } from '@shared/modules';
import {
  revenueLedgerByEventQueryConfig,
  revenueLedgerByPlatformQueryConfig,
  revenueLedgerByTalentQueryConfig,
  revenueLedgerFlatListQueryConfig,
} from '@modules/revenue-ledger';
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query/cursor';
import {
  mergeScreenQueryParams,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query/screen-query-config';
import { readReferenceDisplayForId } from '@shared/formatting/reference-display';

type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

const allSortOptions = [
  { value: 'recognizedAt', labelKey: 'revenue-ledger:sort.recognizedAt' },
  { value: 'revenueEntryCode', labelKey: 'revenue-ledger:sort.revenueEntryCode' },
  { value: 'createdAt', labelKey: 'revenue-ledger:sort.createdAt' },
] as const;

const broadSortOptions = [allSortOptions[0]] as const;
const statusOptions = ['', 'DRAFT', 'FINALIZED', 'RECONCILED', 'VOIDED', 'ARCHIVED'] as const;
const entrySourceOptions = ['', 'MANUAL'] as const;

type FilterLabelKey = 'subjectTalent' | 'platformAccount' | 'event';
type FilterLabelEntry = {
  id: string;
  label: string;
};

const readCachedFilterLabel = (
  labels: Partial<Record<FilterLabelKey, FilterLabelEntry>>,
  key: FilterLabelKey,
  activeId: string | undefined,
): string | undefined => {
  const cached = labels[key];
  return cached && cached.id === activeId ? cached.label : undefined;
};

const hasPresentValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
};

export const isRevenueLedgerNarrowFlatSortMode = (query: RevenueLedgerFlatListQuery): boolean => {
  return !(
    hasPresentValue(query.status) ||
    hasPresentValue(query.search) ||
    hasPresentValue(query.subjectTalentId) ||
    hasPresentValue(query.attributionPlatformAccountId) ||
    hasPresentValue(query.attributionEventId) ||
    hasPresentValue(query.revenueKind) ||
    hasPresentValue(query.entrySource) ||
    hasPresentValue(query.currencyCode) ||
    hasPresentValue(query.windowStartAt) ||
    hasPresentValue(query.windowEndAt) ||
    hasPresentValue(query.createdBeforeAt) ||
    hasPresentValue(query.finalizedFromAt) ||
    hasPresentValue(query.finalizedToAt) ||
    hasPresentValue(query.reconciledFromAt) ||
    hasPresentValue(query.reconciledToAt)
  );
};

const readErrorMessage = (
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  if (!error?.message) {
    return t(fallbackKey);
  }

  return error.message.includes(':') ? t(error.message) : error.message;
};

const readLifecycleConfirmKey = (action: RevenueLedgerLifecycleAction): string => {
  switch (action) {
    case 'finalize':
      return 'revenue-ledger:confirm.finalize';
    case 'reconcile':
      return 'revenue-ledger:confirm.reconcile';
    case 'void':
      return 'revenue-ledger:confirm.void';
    case 'archive':
      return 'revenue-ledger:confirm.archive';
    default:
      return 'revenue-ledger:confirm.archive';
  }
};

export const RevenueLedgerListPage = (): JSX.Element => {
  const { t } = useTranslation(['revenue-ledger', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, revenueLedgerFlatListQueryConfig),
    [searchParams],
  );
  const byTalentQuery = useMemo(
    () => parseScreenQueryParams(searchParams, revenueLedgerByTalentQueryConfig),
    [searchParams],
  );
  const byPlatformQuery = useMemo(
    () => parseScreenQueryParams(searchParams, revenueLedgerByPlatformQueryConfig),
    [searchParams],
  );
  const byEventQuery = useMemo(
    () => parseScreenQueryParams(searchParams, revenueLedgerByEventQueryConfig),
    [searchParams],
  );

  const routeMode =
    byTalentQuery.view === 'by-talent'
      ? 'by-talent'
      : byPlatformQuery.view === 'by-platform'
        ? 'by-platform'
        : byEventQuery.view === 'by-event'
          ? 'by-event'
          : 'flat';
  const activeQuery =
    routeMode === 'by-talent'
      ? byTalentQuery
      : routeMode === 'by-platform'
        ? byPlatformQuery
        : routeMode === 'by-event'
          ? byEventQuery
          : flatListQuery;

  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(() => {
    if (routeMode === 'by-talent') {
      return serializeScreenQueryParams(byTalentQuery, revenueLedgerByTalentQueryConfig).toString();
    }
    if (routeMode === 'by-platform') {
      return serializeScreenQueryParams(
        byPlatformQuery,
        revenueLedgerByPlatformQueryConfig,
      ).toString();
    }
    if (routeMode === 'by-event') {
      return serializeScreenQueryParams(byEventQuery, revenueLedgerByEventQueryConfig).toString();
    }

    return serializeScreenQueryParams(flatListQuery, revenueLedgerFlatListQueryConfig).toString();
  }, [byEventQuery, byPlatformQuery, byTalentQuery, flatListQuery, routeMode]);

  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
    }
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | undefined>, options?: RoutePatchOptions) => {
      const mergeOptions = { resetCursorOnChange: options?.resetCursorOnChange ?? true };
      const next =
        routeMode === 'by-talent'
          ? mergeScreenQueryParams(
              searchParams,
              patch,
              revenueLedgerByTalentQueryConfig,
              mergeOptions,
            )
          : routeMode === 'by-platform'
            ? mergeScreenQueryParams(
                searchParams,
                patch,
                revenueLedgerByPlatformQueryConfig,
                mergeOptions,
              )
            : routeMode === 'by-event'
              ? mergeScreenQueryParams(
                  searchParams,
                  patch,
                  revenueLedgerByEventQueryConfig,
                  mergeOptions,
                )
              : mergeScreenQueryParams(
                  searchParams,
                  patch,
                  revenueLedgerFlatListQueryConfig,
                  mergeOptions,
                );
      setSearchParams(next, { replace: options?.replace });
    },
    [routeMode, searchParams, setSearchParams],
  );

  const flatQueryResult = useRevenueLedgerFlatList(flatListQuery, {
    enabled: routeMode === 'flat',
  });
  const byTalentQueryResult = useRevenueLedgerByTalent(byTalentQuery, {
    enabled: routeMode === 'by-talent',
  });
  const byPlatformQueryResult = useRevenueLedgerByPlatform(byPlatformQuery, {
    enabled: routeMode === 'by-platform',
  });
  const byEventQueryResult = useRevenueLedgerByEvent(byEventQuery, {
    enabled: routeMode === 'by-event',
  });
  const listQueryResult =
    routeMode === 'by-talent'
      ? byTalentQueryResult
      : routeMode === 'by-platform'
        ? byPlatformQueryResult
        : routeMode === 'by-event'
          ? byEventQueryResult
          : flatQueryResult;

  const capabilitiesQuery = useCurrentActorCapabilities();
  const createMutation = useCreateRevenueEntryMutation();
  const lifecycleMutation = useRevenueEntryLifecycleMutation();
  const reconcileMutation = useReconcileRevenueEntryMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterLabels, setFilterLabels] = useState<
    Partial<Record<FilterLabelKey, FilterLabelEntry>>
  >({});
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    const queryWithoutCursor = { ...activeQuery, cursor: undefined };
    if (routeMode === 'by-talent') {
      return serializeScreenQueryParams(
        queryWithoutCursor,
        revenueLedgerByTalentQueryConfig,
      ).toString();
    }
    if (routeMode === 'by-platform') {
      return serializeScreenQueryParams(
        queryWithoutCursor,
        revenueLedgerByPlatformQueryConfig,
      ).toString();
    }
    if (routeMode === 'by-event') {
      return serializeScreenQueryParams(
        queryWithoutCursor,
        revenueLedgerByEventQueryConfig,
      ).toString();
    }

    return serializeScreenQueryParams(
      queryWithoutCursor,
      revenueLedgerFlatListQueryConfig,
    ).toString();
  }, [activeQuery, routeMode]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current !== queryShapeSignature) {
      previousShapeSignatureRef.current = queryShapeSignature;
      setCursorStack(createCursorStack());
    }
  }, [queryShapeSignature]);

  const revenueLedgerGlobalScope = { module: 'revenueLedger', value: 'global' } as const;
  const canCreateRevenueEntry = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.REVENUE_LEDGER_CREATE,
    scope: revenueLedgerGlobalScope,
  });
  const canShowRevenueLifecycleAction = useCallback(
    (action: RevenueLedgerLifecycleAction) =>
      canShowAction(capabilitiesQuery.data, {
        permission:
          action === 'reconcile'
            ? PERMISSIONS.REVENUE_LEDGER_RECONCILE
            : PERMISSIONS.REVENUE_LEDGER_MANAGE_LIFECYCLE,
        scope: { module: 'revenueLedger', value: 'global' },
      }),
    [capabilitiesQuery.data],
  );

  useModulePageActions(
    canCreateRevenueEntry ? (
      <button
        type="button"
        onClick={() => setIsCreateOpen((current) => !current)}
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {isCreateOpen
          ? t('revenue-ledger:actions.closeCreate')
          : t('revenue-ledger:actions.create')}
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
    async (revenueEntryId: string, action: RevenueLedgerLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        if (action === 'reconcile') {
          await reconcileMutation.mutateAsync({ revenueEntryId });
        } else {
          await lifecycleMutation.mutateAsync({ revenueEntryId, action });
        }
        notifySuccess('revenue-ledger:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [
      lifecycleMutation,
      notifyError,
      notifySuccess,
      reconcileMutation,
      requestDestructiveConfirm,
      t,
    ],
  );

  const columns = useMemo(
    () =>
      createRevenueLedgerColumns(t, {
        onOpenDetail: (revenueEntryId) => navigate(APP_PATHS.revenueEntryDetail(revenueEntryId)),
        onLifecycleAction,
        canShowLifecycleAction: canShowRevenueLifecycleAction,
        isActionPending: (revenueEntryId, action) =>
          action === 'reconcile'
            ? reconcileMutation.isPending &&
              reconcileMutation.variables?.revenueEntryId === revenueEntryId
            : lifecycleMutation.isPending &&
              lifecycleMutation.variables?.revenueEntryId === revenueEntryId &&
              lifecycleMutation.variables?.action === action,
      }),
    [
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      canShowRevenueLifecycleAction,
      reconcileMutation.isPending,
      reconcileMutation.variables,
      t,
    ],
  );

  const sortOptions =
    routeMode === 'flat' && isRevenueLedgerNarrowFlatSortMode(flatListQuery)
      ? allSortOptions
      : broadSortOptions;
  const listError = listQueryResult.error as NormalizedApiError | null;
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
    (key: FilterLabelKey, activeId: string | undefined) =>
      (option: ReferenceOption | undefined) => {
        setFilterLabels((current) => {
          if (!option) {
            if (!current[key] || (activeId && current[key]?.id !== activeId)) {
              return current;
            }

            const next = { ...current };
            delete next[key];
            return next;
          }

          if (current[key]?.id === option.id && current[key]?.label === option.label) {
            return current;
          }

          return { ...current, [key]: { id: option.id, label: option.label } };
        });
      },
    [],
  );
  const subjectTalentFilterLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        'subjectTalentId' in activeQuery ? activeQuery.subjectTalentId : undefined,
        (listQueryResult.data?.data ?? []).map((record) =>
          'subjectTalentRef' in record ? record.subjectTalentRef : undefined,
        ),
      ),
    [activeQuery, listQueryResult.data?.data],
  );
  const platformAccountFilterLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        'attributionPlatformAccountId' in activeQuery
          ? activeQuery.attributionPlatformAccountId
          : undefined,
        (listQueryResult.data?.data ?? []).map((record) =>
          'attributionPlatformAccountRef' in record
            ? record.attributionPlatformAccountRef
            : undefined,
        ),
      ),
    [activeQuery, listQueryResult.data?.data],
  );
  const eventFilterLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        'attributionEventId' in activeQuery ? activeQuery.attributionEventId : undefined,
        (listQueryResult.data?.data ?? []).map((record) =>
          'attributionEventRef' in record ? record.attributionEventRef : undefined,
        ),
      ),
    [activeQuery, listQueryResult.data?.data],
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
        label: t('revenue-ledger:filters.status'),
        value: t(`revenue-ledger:statuses.${activeQuery.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    const subjectTalentId =
      'subjectTalentId' in activeQuery ? (activeQuery.subjectTalentId ?? undefined) : undefined;
    if (routeMode === 'flat' && subjectTalentId) {
      chips.push({
        id: 'subjectTalentId',
        label: t('revenue-ledger:filters.subjectTalentId'),
        value:
          readCachedFilterLabel(filterLabels, 'subjectTalent', subjectTalentId) ??
          subjectTalentFilterLabel,
        onClear: () => patchQuery({ subjectTalentId: undefined }),
      });
    }

    const attributionPlatformAccountId =
      'attributionPlatformAccountId' in activeQuery
        ? (activeQuery.attributionPlatformAccountId ?? undefined)
        : undefined;
    if (routeMode === 'flat' && attributionPlatformAccountId) {
      chips.push({
        id: 'attributionPlatformAccountId',
        label: t('revenue-ledger:filters.attributionPlatformAccountId'),
        value:
          readCachedFilterLabel(filterLabels, 'platformAccount', attributionPlatformAccountId) ??
          platformAccountFilterLabel,
        onClear: () => patchQuery({ attributionPlatformAccountId: undefined }),
      });
    }

    const attributionEventId =
      'attributionEventId' in activeQuery
        ? (activeQuery.attributionEventId ?? undefined)
        : undefined;
    if (routeMode === 'flat' && attributionEventId) {
      chips.push({
        id: 'attributionEventId',
        label: t('revenue-ledger:filters.attributionEventId'),
        value: readCachedFilterLabel(filterLabels, 'event', attributionEventId) ?? eventFilterLabel,
        onClear: () => patchQuery({ attributionEventId: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.revenueKind) {
      chips.push({
        id: 'revenueKind',
        label: t('revenue-ledger:filters.revenueKind'),
        value: t(`revenue-ledger:revenueKinds.${flatListQuery.revenueKind}`),
        onClear: () => patchQuery({ revenueKind: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.entrySource) {
      chips.push({
        id: 'entrySource',
        label: t('revenue-ledger:filters.entrySource'),
        value: t(`revenue-ledger:entrySources.${flatListQuery.entrySource}`),
        onClear: () => patchQuery({ entrySource: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.currencyCode) {
      chips.push({
        id: 'currencyCode',
        label: t('revenue-ledger:filters.currencyCode'),
        value: flatListQuery.currencyCode,
        onClear: () => patchQuery({ currencyCode: undefined }),
      });
    }

    if (activeQuery.windowStartAt !== undefined) {
      chips.push({
        id: 'windowStartAt',
        label: t('revenue-ledger:filters.windowStartAt'),
        value: String(activeQuery.windowStartAt),
        onClear: () => patchQuery({ windowStartAt: undefined }),
      });
    }

    if (activeQuery.windowEndAt !== undefined) {
      chips.push({
        id: 'windowEndAt',
        label: t('revenue-ledger:filters.windowEndAt'),
        value: String(activeQuery.windowEndAt),
        onClear: () => patchQuery({ windowEndAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.createdBeforeAt !== undefined) {
      chips.push({
        id: 'createdBeforeAt',
        label: t('revenue-ledger:filters.createdBeforeAt'),
        value: String(flatListQuery.createdBeforeAt),
        onClear: () => patchQuery({ createdBeforeAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.finalizedFromAt !== undefined) {
      chips.push({
        id: 'finalizedFromAt',
        label: t('revenue-ledger:filters.finalizedFromAt'),
        value: String(flatListQuery.finalizedFromAt),
        onClear: () => patchQuery({ finalizedFromAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.finalizedToAt !== undefined) {
      chips.push({
        id: 'finalizedToAt',
        label: t('revenue-ledger:filters.finalizedToAt'),
        value: String(flatListQuery.finalizedToAt),
        onClear: () => patchQuery({ finalizedToAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.reconciledFromAt !== undefined) {
      chips.push({
        id: 'reconciledFromAt',
        label: t('revenue-ledger:filters.reconciledFromAt'),
        value: String(flatListQuery.reconciledFromAt),
        onClear: () => patchQuery({ reconciledFromAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.reconciledToAt !== undefined) {
      chips.push({
        id: 'reconciledToAt',
        label: t('revenue-ledger:filters.reconciledToAt'),
        value: String(flatListQuery.reconciledToAt),
        onClear: () => patchQuery({ reconciledToAt: undefined }),
      });
    }

    return chips;
  }, [
    activeQuery,
    eventFilterLabel,
    filterLabels,
    flatListQuery.currencyCode,
    flatListQuery.entrySource,
    flatListQuery.createdBeforeAt,
    flatListQuery.finalizedFromAt,
    flatListQuery.finalizedToAt,
    flatListQuery.revenueKind,
    flatListQuery.reconciledFromAt,
    flatListQuery.reconciledToAt,
    flatListQuery.search,
    patchQuery,
    platformAccountFilterLabel,
    routeMode,
    subjectTalentFilterLabel,
    t,
  ]);

  const clearAllFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
      subjectTalentId: routeMode === 'by-talent' ? byTalentQuery.subjectTalentId : undefined,
      attributionPlatformAccountId:
        routeMode === 'by-platform' ? byPlatformQuery.attributionPlatformAccountId : undefined,
      attributionEventId: routeMode === 'by-event' ? byEventQuery.attributionEventId : undefined,
      revenueKind: undefined,
      entrySource: undefined,
      currencyCode: undefined,
      windowStartAt: undefined,
      windowEndAt: undefined,
      createdBeforeAt: undefined,
      finalizedFromAt: undefined,
      finalizedToAt: undefined,
      reconciledFromAt: undefined,
      reconciledToAt: undefined,
    });
  }, [
    byEventQuery.attributionEventId,
    byPlatformQuery.attributionPlatformAccountId,
    byTalentQuery.subjectTalentId,
    patchQuery,
    routeMode,
  ]);

  return (
    <ModuleListScreenShell
      mode={routeMode === 'flat' ? 'flat-list' : 'related-list'}
      banner={
        <div className="space-y-2">
          {routeMode !== 'flat' ? (
            <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-text">
              {t(`revenue-ledger:relatedModes.${routeMode}`)}
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
                placeholder={t('revenue-ledger:filters.searchPlaceholder')}
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
              aria-controls="revenue-ledger-more-filters"
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
              id="revenue-ledger-more-filters"
              title={t('common:filters.moreFilters')}
              isOpen={isMoreFiltersOpen}
              closeLabel={t('common:actions.close')}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
              <ReferenceFilterField
                label={t('revenue-ledger:filters.subjectTalentId')}
                pickerId="revenue-ledger-filter-subject-talent"
                value={
                  'subjectTalentId' in activeQuery
                    ? (activeQuery.subjectTalentId ?? undefined)
                    : undefined
                }
                loadOptions={loadTalentReferenceOptions}
                placeholder={t('revenue-ledger:filters.subjectTalentIdPlaceholder')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[210px]"
                onSelectedOptionChange={rememberFilterLabel(
                  'subjectTalent',
                  'subjectTalentId' in activeQuery
                    ? (activeQuery.subjectTalentId ?? undefined)
                    : undefined,
                )}
                onChange={(value) => patchQuery({ subjectTalentId: value })}
              />
              <ReferenceFilterField
                label={t('revenue-ledger:filters.attributionPlatformAccountId')}
                pickerId="revenue-ledger-filter-platform-account"
                value={
                  'attributionPlatformAccountId' in activeQuery
                    ? (activeQuery.attributionPlatformAccountId ?? undefined)
                    : undefined
                }
                loadOptions={loadPlatformAccountReferenceOptions}
                placeholder={t('revenue-ledger:filters.attributionPlatformAccountIdPlaceholder')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[230px]"
                onSelectedOptionChange={rememberFilterLabel(
                  'platformAccount',
                  'attributionPlatformAccountId' in activeQuery
                    ? (activeQuery.attributionPlatformAccountId ?? undefined)
                    : undefined,
                )}
                onChange={(value) => patchQuery({ attributionPlatformAccountId: value })}
              />
              <ReferenceFilterField
                label={t('revenue-ledger:filters.attributionEventId')}
                pickerId="revenue-ledger-filter-event"
                value={
                  'attributionEventId' in activeQuery
                    ? (activeQuery.attributionEventId ?? undefined)
                    : undefined
                }
                loadOptions={loadEventReferenceOptions}
                placeholder={t('revenue-ledger:filters.attributionEventIdPlaceholder')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[210px]"
                onSelectedOptionChange={rememberFilterLabel(
                  'event',
                  'attributionEventId' in activeQuery
                    ? (activeQuery.attributionEventId ?? undefined)
                    : undefined,
                )}
                onChange={(value) => patchQuery({ attributionEventId: value })}
              />
              {routeMode === 'flat' ? (
                <>
                  <label className="flex min-w-[210px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('revenue-ledger:filters.revenueKind')}
                    </span>
                    <select
                      value={flatListQuery.revenueKind ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        patchQuery({ revenueKind: event.target.value || undefined })
                      }
                    >
                      <option value="">{t('revenue-ledger:filters.allRevenueKinds')}</option>
                      {revenueKindValues.map((kind) => (
                        <option key={kind} value={kind}>
                          {t(`revenue-ledger:revenueKinds.${kind}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[170px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('revenue-ledger:filters.entrySource')}
                    </span>
                    <select
                      value={flatListQuery.entrySource ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        patchQuery({ entrySource: event.target.value || undefined })
                      }
                    >
                      {entrySourceOptions.map((source) => (
                        <option key={source || 'all'} value={source}>
                          {source
                            ? t(`revenue-ledger:entrySources.${source}`)
                            : t('revenue-ledger:filters.allEntrySources')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[150px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('revenue-ledger:filters.currencyCode')}
                    </span>
                    <input
                      value={flatListQuery.currencyCode ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      placeholder={t('revenue-ledger:filters.currencyCodePlaceholder')}
                      onChange={(event) =>
                        patchQuery({ currencyCode: event.target.value || undefined })
                      }
                    />
                  </label>
                </>
              ) : null}
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('revenue-ledger:filters.windowStartAt')}
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
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('revenue-ledger:filters.windowEndAt')}
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
              {t('revenue-ledger:filters.status')}
            </span>
            <select
              value={activeQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              {statusOptions.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status
                    ? t(`revenue-ledger:statuses.${status}`)
                    : t('revenue-ledger:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterToolbar>
      }
      interactionSection={
        <>
          {canCreateRevenueEntry && isCreateOpen ? (
            <RevenueEntryCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={async (payload) => {
                try {
                  await createMutation.mutateAsync(payload);
                  notifySuccess('revenue-ledger:feedback.created');
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
            emptyTitle={t('revenue-ledger:states.emptyTitle')}
            emptyMessage={t('revenue-ledger:states.emptyMessage')}
            caption={t('revenue-ledger:table.caption')}
          />
          {routeMode === 'flat' ? <PlatformEarningBatchesPanel /> : null}
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
          title={t('revenue-ledger:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'revenue-ledger:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
