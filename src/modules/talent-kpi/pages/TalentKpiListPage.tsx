import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { TalentKpiCreateSurface } from '@modules/talent-kpi/forms/talent-kpi-mutation-forms';
import {
  useCreateTalentKpiMutation,
  useTalentKpiByEvent,
  useTalentKpiByPlatform,
  useTalentKpiByTalent,
  useTalentKpiFlatList,
  useTalentKpiLifecycleMutation,
} from '@modules/talent-kpi/hooks/use-talent-kpi';
import { createTalentKpiColumns } from '@modules/talent-kpi/tables/talent-kpi-columns';
import type { TalentKpiLifecycleAction } from '@modules/talent-kpi/types/talent-kpi.types';
import { talentKpiMetricCodeValues } from '@modules/talent-kpi/types/talent-kpi.types';
import type { NormalizedApiError } from '@shared/api';
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
import {
  loadEventReferenceOptions,
  loadPlatformAccountReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import { ModuleListScreenShell } from '@shared/modules';
import {
  createCursorStack,
  mergeScreenQueryParams,
  moveNextCursor,
  movePreviousCursor,
  parseScreenQueryParams,
  serializeScreenQueryParams,
  talentKpiByEventQueryConfig,
  talentKpiByPlatformQueryConfig,
  talentKpiByTalentQueryConfig,
  talentKpiFlatListQueryConfig,
} from '@shared/query';
import { readReferenceDisplayForId } from '@shared/formatting/reference-display';

type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

const sortOptions = [
  { value: 'periodStartAt', labelKey: 'talent-kpi:sort.periodStartAt' },
  { value: 'kpiRecordCode', labelKey: 'talent-kpi:sort.kpiRecordCode' },
  { value: 'createdAt', labelKey: 'talent-kpi:sort.createdAt' },
] as const;

const statusOptions = ['', 'DRAFT', 'FINALIZED', 'ARCHIVED'] as const;
const measurementSourceOptions = ['', 'MANUAL'] as const;

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

const readLifecycleConfirmKey = (action: TalentKpiLifecycleAction): string => {
  switch (action) {
    case 'finalize':
      return 'talent-kpi:confirm.finalize';
    case 'archive':
      return 'talent-kpi:confirm.archive';
    default:
      return 'talent-kpi:confirm.archive';
  }
};

export const TalentKpiListPage = (): JSX.Element => {
  const { t } = useTranslation(['talent-kpi', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, talentKpiFlatListQueryConfig),
    [searchParams],
  );
  const byTalentQuery = useMemo(
    () => parseScreenQueryParams(searchParams, talentKpiByTalentQueryConfig),
    [searchParams],
  );
  const byPlatformQuery = useMemo(
    () => parseScreenQueryParams(searchParams, talentKpiByPlatformQueryConfig),
    [searchParams],
  );
  const byEventQuery = useMemo(
    () => parseScreenQueryParams(searchParams, talentKpiByEventQueryConfig),
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
      return serializeScreenQueryParams(byTalentQuery, talentKpiByTalentQueryConfig).toString();
    }
    if (routeMode === 'by-platform') {
      return serializeScreenQueryParams(byPlatformQuery, talentKpiByPlatformQueryConfig).toString();
    }
    if (routeMode === 'by-event') {
      return serializeScreenQueryParams(byEventQuery, talentKpiByEventQueryConfig).toString();
    }

    return serializeScreenQueryParams(flatListQuery, talentKpiFlatListQueryConfig).toString();
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
          ? mergeScreenQueryParams(searchParams, patch, talentKpiByTalentQueryConfig, mergeOptions)
          : routeMode === 'by-platform'
            ? mergeScreenQueryParams(
                searchParams,
                patch,
                talentKpiByPlatformQueryConfig,
                mergeOptions,
              )
            : routeMode === 'by-event'
              ? mergeScreenQueryParams(
                  searchParams,
                  patch,
                  talentKpiByEventQueryConfig,
                  mergeOptions,
                )
              : mergeScreenQueryParams(
                  searchParams,
                  patch,
                  talentKpiFlatListQueryConfig,
                  mergeOptions,
                );
      setSearchParams(next, { replace: options?.replace });
    },
    [routeMode, searchParams, setSearchParams],
  );

  const flatQueryResult = useTalentKpiFlatList(flatListQuery, { enabled: routeMode === 'flat' });
  const byTalentQueryResult = useTalentKpiByTalent(byTalentQuery, {
    enabled: routeMode === 'by-talent',
  });
  const byPlatformQueryResult = useTalentKpiByPlatform(byPlatformQuery, {
    enabled: routeMode === 'by-platform',
  });
  const byEventQueryResult = useTalentKpiByEvent(byEventQuery, {
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

  const createMutation = useCreateTalentKpiMutation();
  const lifecycleMutation = useTalentKpiLifecycleMutation();
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
        talentKpiByTalentQueryConfig,
      ).toString();
    }
    if (routeMode === 'by-platform') {
      return serializeScreenQueryParams(
        queryWithoutCursor,
        talentKpiByPlatformQueryConfig,
      ).toString();
    }
    if (routeMode === 'by-event') {
      return serializeScreenQueryParams(queryWithoutCursor, talentKpiByEventQueryConfig).toString();
    }

    return serializeScreenQueryParams(queryWithoutCursor, talentKpiFlatListQueryConfig).toString();
  }, [activeQuery, routeMode]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current !== queryShapeSignature) {
      previousShapeSignatureRef.current = queryShapeSignature;
      setCursorStack(createCursorStack());
    }
  }, [queryShapeSignature]);

  usePageActions(
    <button
      type="button"
      onClick={() => setIsCreateOpen((current) => !current)}
      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
    >
      {isCreateOpen ? t('talent-kpi:actions.closeCreate') : t('talent-kpi:actions.create')}
    </button>,
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
    async (talentKpiRecordId: string, action: TalentKpiLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({ talentKpiRecordId, action });
        notifySuccess('talent-kpi:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createTalentKpiColumns(t, {
        onOpenDetail: (talentKpiRecordId) =>
          navigate(APP_PATHS.talentKpiRecordDetail(talentKpiRecordId)),
        onLifecycleAction,
        isActionPending: (talentKpiRecordId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.talentKpiRecordId === talentKpiRecordId &&
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
        label: t('talent-kpi:filters.status'),
        value: t(`talent-kpi:statuses.${activeQuery.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    const subjectTalentId =
      'subjectTalentId' in activeQuery ? (activeQuery.subjectTalentId ?? undefined) : undefined;
    if (routeMode === 'flat' && subjectTalentId) {
      chips.push({
        id: 'subjectTalentId',
        label: t('talent-kpi:filters.subjectTalentId'),
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
        label: t('talent-kpi:filters.attributionPlatformAccountId'),
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
        label: t('talent-kpi:filters.attributionEventId'),
        value: readCachedFilterLabel(filterLabels, 'event', attributionEventId) ?? eventFilterLabel,
        onClear: () => patchQuery({ attributionEventId: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.measurementSource) {
      chips.push({
        id: 'measurementSource',
        label: t('talent-kpi:filters.measurementSource'),
        value: t(`talent-kpi:measurementSources.${flatListQuery.measurementSource}`),
        onClear: () => patchQuery({ measurementSource: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.containsMetricCode) {
      chips.push({
        id: 'containsMetricCode',
        label: t('talent-kpi:filters.containsMetricCode'),
        value: t(`talent-kpi:metricCodes.${flatListQuery.containsMetricCode}`),
        onClear: () => patchQuery({ containsMetricCode: undefined }),
      });
    }

    if (activeQuery.windowStartAt !== undefined) {
      chips.push({
        id: 'windowStartAt',
        label: t('talent-kpi:filters.windowStartAt'),
        value: String(activeQuery.windowStartAt),
        onClear: () => patchQuery({ windowStartAt: undefined }),
      });
    }

    if (activeQuery.windowEndAt !== undefined) {
      chips.push({
        id: 'windowEndAt',
        label: t('talent-kpi:filters.windowEndAt'),
        value: String(activeQuery.windowEndAt),
        onClear: () => patchQuery({ windowEndAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.createdBeforeAt !== undefined) {
      chips.push({
        id: 'createdBeforeAt',
        label: 'Created before',
        value: String(flatListQuery.createdBeforeAt),
        onClear: () => patchQuery({ createdBeforeAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.publishedFromAt !== undefined) {
      chips.push({
        id: 'publishedFromAt',
        label: 'Published from',
        value: String(flatListQuery.publishedFromAt),
        onClear: () => patchQuery({ publishedFromAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.publishedToAt !== undefined) {
      chips.push({
        id: 'publishedToAt',
        label: 'Published until',
        value: String(flatListQuery.publishedToAt),
        onClear: () => patchQuery({ publishedToAt: undefined }),
      });
    }

    return chips;
  }, [
    activeQuery,
    eventFilterLabel,
    filterLabels,
    flatListQuery.containsMetricCode,
    flatListQuery.createdBeforeAt,
    flatListQuery.measurementSource,
    flatListQuery.publishedFromAt,
    flatListQuery.publishedToAt,
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
      measurementSource: undefined,
      containsMetricCode: undefined,
      windowStartAt: undefined,
      windowEndAt: undefined,
      createdBeforeAt: undefined,
      publishedFromAt: undefined,
      publishedToAt: undefined,
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
              {t(`talent-kpi:relatedModes.${routeMode}`)}
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
                placeholder={t('talent-kpi:filters.searchPlaceholder')}
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
              aria-controls="talent-kpi-more-filters"
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
              id="talent-kpi-more-filters"
              title={t('common:filters.moreFilters')}
              isOpen={isMoreFiltersOpen}
              closeLabel={t('common:actions.close')}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
              <ReferenceFilterField
                label={t('talent-kpi:filters.subjectTalentId')}
                pickerId="talent-kpi-filter-subject-talent"
                value={
                  'subjectTalentId' in activeQuery
                    ? (activeQuery.subjectTalentId ?? undefined)
                    : undefined
                }
                loadOptions={loadTalentReferenceOptions}
                placeholder={t('talent-kpi:filters.subjectTalentIdPlaceholder')}
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
                label={t('talent-kpi:filters.attributionPlatformAccountId')}
                pickerId="talent-kpi-filter-platform-account"
                value={
                  'attributionPlatformAccountId' in activeQuery
                    ? (activeQuery.attributionPlatformAccountId ?? undefined)
                    : undefined
                }
                loadOptions={loadPlatformAccountReferenceOptions}
                placeholder={t('talent-kpi:filters.attributionPlatformAccountIdPlaceholder')}
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
                label={t('talent-kpi:filters.attributionEventId')}
                pickerId="talent-kpi-filter-event"
                value={
                  'attributionEventId' in activeQuery
                    ? (activeQuery.attributionEventId ?? undefined)
                    : undefined
                }
                loadOptions={loadEventReferenceOptions}
                placeholder={t('talent-kpi:filters.attributionEventIdPlaceholder')}
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
                  <label className="flex min-w-[190px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('talent-kpi:filters.measurementSource')}
                    </span>
                    <select
                      value={flatListQuery.measurementSource ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        patchQuery({ measurementSource: event.target.value || undefined })
                      }
                    >
                      {measurementSourceOptions.map((source) => (
                        <option key={source || 'all'} value={source}>
                          {source
                            ? t(`talent-kpi:measurementSources.${source}`)
                            : t('talent-kpi:filters.allMeasurementSources')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[230px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('talent-kpi:filters.containsMetricCode')}
                    </span>
                    <select
                      value={flatListQuery.containsMetricCode ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        patchQuery({ containsMetricCode: event.target.value || undefined })
                      }
                    >
                      <option value="">{t('talent-kpi:filters.allMetricCodes')}</option>
                      {talentKpiMetricCodeValues.map((metricCode) => (
                        <option key={metricCode} value={metricCode}>
                          {t(`talent-kpi:metricCodes.${metricCode}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('talent-kpi:filters.windowStartAt')}
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
                  {t('talent-kpi:filters.windowEndAt')}
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
              {t('talent-kpi:filters.status')}
            </span>
            <select
              value={activeQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              {statusOptions.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status
                    ? t(`talent-kpi:statuses.${status}`)
                    : t('talent-kpi:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterToolbar>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <TalentKpiCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={async (payload) => {
                try {
                  await createMutation.mutateAsync(payload);
                  notifySuccess('talent-kpi:feedback.created');
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
            emptyTitle={t('talent-kpi:states.emptyTitle')}
            emptyMessage={t('talent-kpi:states.emptyMessage')}
            caption={t('talent-kpi:table.caption')}
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
          title={t('talent-kpi:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'talent-kpi:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
