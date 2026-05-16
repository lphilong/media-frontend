import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
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
import { ReferenceFilterField } from '@shared/components/reference';
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
  revenueLedgerByEventQueryConfig,
  revenueLedgerByPlatformQueryConfig,
  revenueLedgerByTalentQueryConfig,
  revenueLedgerFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

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
    hasPresentValue(query.windowEndAt)
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

  const createMutation = useCreateRevenueEntryMutation();
  const lifecycleMutation = useRevenueEntryLifecycleMutation();
  const reconcileMutation = useReconcileRevenueEntryMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  usePageActions(
    <button
      type="button"
      onClick={() => setIsCreateOpen((current) => !current)}
      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
    >
      {isCreateOpen ? t('revenue-ledger:actions.closeCreate') : t('revenue-ledger:actions.create')}
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
        <FilterBarShell
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
                  onChange={(event) => patchQuery({ revenueKind: event.target.value || undefined })}
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
                  onChange={(event) => patchQuery({ entrySource: event.target.value || undefined })}
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
        </FilterBarShell>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
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
