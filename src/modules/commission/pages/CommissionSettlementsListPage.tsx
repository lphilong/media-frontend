import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { CommissionSettlementCreateSurface } from '@modules/commission/forms/commission-mutation-forms';
import {
  useCommissionSettlementLifecycleMutation,
  useCommissionSettlementsByBeneficiary,
  useCommissionSettlementsByRevenueEntry,
  useCommissionSettlementsBySubjectTalent,
  useCommissionSettlementsFlatList,
  useCreateCommissionSettlementMutation,
} from '@modules/commission/hooks/use-commission';
import { createCommissionSettlementColumns } from '@modules/commission/tables/commission-columns';
import type {
  CommissionSettlementLifecycleAction,
  CommissionSettlementsByBeneficiaryQuery,
  CommissionSettlementsByRevenueEntryQuery,
  CommissionSettlementsBySubjectTalentQuery,
  CommissionSettlementsFlatListQuery,
} from '@modules/commission/types/commission.types';
import {
  commissionBeneficiaryKindValues,
  commissionSettlementKindValues,
  commissionSettlementStatusValues,
} from '@modules/commission/types/commission.types';
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
  loadCommissionRuleReferenceOptions,
  loadEmploymentProfileReferenceOptions,
  loadRevenueEntryReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import { ModuleListScreenShell } from '@shared/modules';
import {
  commissionSettlementsByBeneficiaryQueryConfig,
  commissionSettlementsByRevenueEntryQueryConfig,
  commissionSettlementsBySubjectTalentQueryConfig,
  commissionSettlementsFlatListQueryConfig,
  createCursorStack,
  mergeScreenQueryParams,
  moveNextCursor,
  movePreviousCursor,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query';

type RouteMode = 'flat' | 'by-beneficiary' | 'by-subject-talent' | 'by-revenue-entry';
type ActiveSettlementQuery =
  | CommissionSettlementsFlatListQuery
  | CommissionSettlementsByBeneficiaryQuery
  | CommissionSettlementsBySubjectTalentQuery
  | CommissionSettlementsByRevenueEntryQuery;
type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

const sortOptions = [
  {
    value: 'settlementPeriodStartAt',
    labelKey: 'commission:settlements.sort.settlementPeriodStartAt',
  },
  { value: 'settlementCode', labelKey: 'commission:settlements.sort.settlementCode' },
  { value: 'createdAt', labelKey: 'commission:settlements.sort.createdAt' },
  { value: 'finalizedAt', labelKey: 'commission:settlements.sort.finalizedAt' },
] as const;

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

const readLifecycleConfirmKey = (action: CommissionSettlementLifecycleAction): string => {
  switch (action) {
    case 'finalize':
      return 'commission:settlements.confirm.finalize';
    case 'void':
      return 'commission:settlements.confirm.void';
    case 'archive':
      return 'commission:settlements.confirm.archive';
    default:
      return 'commission:settlements.confirm.archive';
  }
};

const serializeForMode = (routeMode: RouteMode, query: ActiveSettlementQuery): URLSearchParams => {
  if (routeMode === 'by-beneficiary') {
    return serializeScreenQueryParams(query, commissionSettlementsByBeneficiaryQueryConfig);
  }
  if (routeMode === 'by-subject-talent') {
    return serializeScreenQueryParams(query, commissionSettlementsBySubjectTalentQueryConfig);
  }
  if (routeMode === 'by-revenue-entry') {
    return serializeScreenQueryParams(query, commissionSettlementsByRevenueEntryQueryConfig);
  }

  return serializeScreenQueryParams(query, commissionSettlementsFlatListQueryConfig);
};

export const CommissionSettlementsListPage = (): JSX.Element => {
  const { t } = useTranslation(['commission', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, commissionSettlementsFlatListQueryConfig),
    [searchParams],
  );
  const byBeneficiaryQuery = useMemo(
    () => parseScreenQueryParams(searchParams, commissionSettlementsByBeneficiaryQueryConfig),
    [searchParams],
  );
  const bySubjectTalentQuery = useMemo(
    () => parseScreenQueryParams(searchParams, commissionSettlementsBySubjectTalentQueryConfig),
    [searchParams],
  );
  const byRevenueEntryQuery = useMemo(
    () => parseScreenQueryParams(searchParams, commissionSettlementsByRevenueEntryQueryConfig),
    [searchParams],
  );
  const routeMode: RouteMode =
    byBeneficiaryQuery.view === 'by-beneficiary'
      ? 'by-beneficiary'
      : bySubjectTalentQuery.view === 'by-subject-talent'
        ? 'by-subject-talent'
        : byRevenueEntryQuery.view === 'by-revenue-entry'
          ? 'by-revenue-entry'
          : 'flat';
  const activeQuery =
    routeMode === 'by-beneficiary'
      ? byBeneficiaryQuery
      : routeMode === 'by-subject-talent'
        ? bySubjectTalentQuery
        : routeMode === 'by-revenue-entry'
          ? byRevenueEntryQuery
          : flatListQuery;

  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(
    () => serializeForMode(routeMode, activeQuery).toString(),
    [activeQuery, routeMode],
  );

  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
    }
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | undefined>, options?: RoutePatchOptions) => {
      const mergeOptions = { resetCursorOnChange: options?.resetCursorOnChange ?? true };
      const next =
        routeMode === 'by-beneficiary'
          ? mergeScreenQueryParams(
              searchParams,
              patch,
              commissionSettlementsByBeneficiaryQueryConfig,
              mergeOptions,
            )
          : routeMode === 'by-subject-talent'
            ? mergeScreenQueryParams(
                searchParams,
                patch,
                commissionSettlementsBySubjectTalentQueryConfig,
                mergeOptions,
              )
            : routeMode === 'by-revenue-entry'
              ? mergeScreenQueryParams(
                  searchParams,
                  patch,
                  commissionSettlementsByRevenueEntryQueryConfig,
                  mergeOptions,
                )
              : mergeScreenQueryParams(
                  searchParams,
                  patch,
                  commissionSettlementsFlatListQueryConfig,
                  mergeOptions,
                );
      setSearchParams(next, { replace: options?.replace });
    },
    [routeMode, searchParams, setSearchParams],
  );

  const flatQueryResult = useCommissionSettlementsFlatList(flatListQuery, {
    enabled: routeMode === 'flat',
  });
  const byBeneficiaryQueryResult = useCommissionSettlementsByBeneficiary(byBeneficiaryQuery, {
    enabled: routeMode === 'by-beneficiary',
  });
  const bySubjectTalentQueryResult = useCommissionSettlementsBySubjectTalent(bySubjectTalentQuery, {
    enabled: routeMode === 'by-subject-talent',
  });
  const byRevenueEntryQueryResult = useCommissionSettlementsByRevenueEntry(byRevenueEntryQuery, {
    enabled: routeMode === 'by-revenue-entry',
  });
  const listQueryResult =
    routeMode === 'by-beneficiary'
      ? byBeneficiaryQueryResult
      : routeMode === 'by-subject-talent'
        ? bySubjectTalentQueryResult
        : routeMode === 'by-revenue-entry'
          ? byRevenueEntryQueryResult
          : flatQueryResult;

  const createMutation = useCreateCommissionSettlementMutation();
  const lifecycleMutation = useCommissionSettlementLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    return serializeForMode(routeMode, { ...activeQuery, cursor: undefined }).toString();
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
      {isCreateOpen
        ? t('commission:settlements.actions.closeCreate')
        : t('commission:settlements.actions.create')}
    </button>,
  );

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(activeQuery.cursor);

  const onNext = (): void => {
    if (!nextCursor) return;
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
    async (commissionSettlementId: string, action: CommissionSettlementLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) return;

      try {
        await lifecycleMutation.mutateAsync({ commissionSettlementId, action });
        notifySuccess('commission:settlements.feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createCommissionSettlementColumns(t, {
        onOpenDetail: (commissionSettlementId) =>
          navigate(APP_PATHS.commissionSettlementDetail(commissionSettlementId)),
        onLifecycleAction,
        isActionPending: (commissionSettlementId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.commissionSettlementId === commissionSettlementId &&
          lifecycleMutation.variables?.action === action,
      }),
    [lifecycleMutation.isPending, lifecycleMutation.variables, navigate, onLifecycleAction, t],
  );

  const listError = listQueryResult.error as NormalizedApiError | null;
  const shellState = useMemo(() => {
    if (listQueryResult.isPending) return 'loading' as const;
    if (listQueryResult.isError) return listError?.permissionDenied ? 'denied' : 'error';
    return 'ready' as const;
  }, [listError?.permissionDenied, listQueryResult.isError, listQueryResult.isPending]);
  const relatedContext =
    routeMode === 'by-beneficiary' ? (
      <div className="flex min-w-[260px] flex-col gap-1 rounded border border-border bg-bg px-3 py-2 text-sm">
        <span className="text-xs font-medium uppercase text-muted">
          {t('commission:settlements.filters.beneficiaryKindSnapshot')}
        </span>
        <span className="text-text">
          {byBeneficiaryQuery.beneficiaryKindSnapshot
            ? t(`commission:beneficiaryKinds.${byBeneficiaryQuery.beneficiaryKindSnapshot}`)
            : '-'}
        </span>
        <span className="text-xs font-medium uppercase text-muted">
          {byBeneficiaryQuery.beneficiaryKindSnapshot === 'EMPLOYMENT_PROFILE'
            ? t('commission:settlements.filters.beneficiaryEmploymentProfileIdSnapshot')
            : t('commission:settlements.filters.beneficiaryTalentIdSnapshot')}
        </span>
        <span className="font-mono text-xs text-text">
          {byBeneficiaryQuery.beneficiaryKindSnapshot === 'EMPLOYMENT_PROFILE'
            ? (byBeneficiaryQuery.beneficiaryEmploymentProfileIdSnapshot ?? '-')
            : (byBeneficiaryQuery.beneficiaryTalentIdSnapshot ?? '-')}
        </span>
      </div>
    ) : routeMode === 'by-subject-talent' ? (
      <div className="flex min-w-[240px] flex-col gap-1 rounded border border-border bg-bg px-3 py-2 text-sm">
        <span className="text-xs font-medium uppercase text-muted">
          {t('commission:settlements.filters.subjectTalentId')}
        </span>
        <span className="font-mono text-xs text-text">
          {bySubjectTalentQuery.subjectTalentId ?? '-'}
        </span>
      </div>
    ) : routeMode === 'by-revenue-entry' ? (
      <div className="flex min-w-[240px] flex-col gap-1 rounded border border-border bg-bg px-3 py-2 text-sm">
        <span className="text-xs font-medium uppercase text-muted">
          {t('commission:settlements.filters.containsRevenueEntryId')}
        </span>
        <span className="font-mono text-xs text-text">
          {byRevenueEntryQuery.revenueEntryId ?? '-'}
        </span>
      </div>
    ) : null;

  return (
    <ModuleListScreenShell
      mode={routeMode === 'flat' ? 'flat-list' : 'related-list'}
      banner={
        <div className="space-y-2">
          {routeMode !== 'flat' ? (
            <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-text">
              {t(`commission:settlements.relatedModes.${routeMode}`)}
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
                placeholder={t('commission:settlements.filters.searchPlaceholder')}
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
          {relatedContext}
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('commission:settlements.filters.status')}
            </span>
            <select
              value={activeQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              <option value="">{t('commission:settlements.filters.allStatuses')}</option>
              {commissionSettlementStatusValues.map((status) => (
                <option key={status} value={status}>
                  {t(`commission:settlements.statuses.${status}`)}
                </option>
              ))}
            </select>
          </label>
          {routeMode === 'flat' ? (
            <>
              <label className="flex min-w-[210px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('commission:settlements.filters.beneficiaryKindSnapshot')}
                </span>
                <select
                  value={
                    'beneficiaryKindSnapshot' in activeQuery
                      ? (activeQuery.beneficiaryKindSnapshot ?? '')
                      : ''
                  }
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      beneficiaryKindSnapshot: event.target.value || undefined,
                      beneficiaryEmploymentProfileIdSnapshot: undefined,
                      beneficiaryTalentIdSnapshot: undefined,
                    })
                  }
                >
                  <option value="">{t('commission:settlements.filters.anyBeneficiaryKind')}</option>
                  {commissionBeneficiaryKindValues.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`commission:beneficiaryKinds.${kind}`)}
                    </option>
                  ))}
                </select>
              </label>
              <ReferenceFilterField
                label={t('commission:settlements.filters.beneficiaryEmploymentProfileIdSnapshot')}
                pickerId="commission-settlement-filter-beneficiary-employment"
                value={
                  'beneficiaryEmploymentProfileIdSnapshot' in activeQuery
                    ? (activeQuery.beneficiaryEmploymentProfileIdSnapshot ?? undefined)
                    : undefined
                }
                loadOptions={loadEmploymentProfileReferenceOptions}
                placeholder={t('commission:settlements.placeholders.searchReference')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[260px]"
                onChange={(value) =>
                  patchQuery({
                    beneficiaryKindSnapshot: value ? 'EMPLOYMENT_PROFILE' : undefined,
                    beneficiaryEmploymentProfileIdSnapshot: value,
                    beneficiaryTalentIdSnapshot: undefined,
                  })
                }
              />
              <ReferenceFilterField
                label={t('commission:settlements.filters.beneficiaryTalentIdSnapshot')}
                pickerId="commission-settlement-filter-beneficiary-talent"
                value={
                  'beneficiaryTalentIdSnapshot' in activeQuery
                    ? (activeQuery.beneficiaryTalentIdSnapshot ?? undefined)
                    : undefined
                }
                loadOptions={loadTalentReferenceOptions}
                placeholder={t('commission:settlements.placeholders.searchReference')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[230px]"
                onChange={(value) =>
                  patchQuery({
                    beneficiaryKindSnapshot: value ? 'TALENT' : undefined,
                    beneficiaryTalentIdSnapshot: value,
                    beneficiaryEmploymentProfileIdSnapshot: undefined,
                  })
                }
              />
            </>
          ) : null}
          {routeMode === 'flat' ? (
            <ReferenceFilterField
              label={t('commission:settlements.filters.containsRevenueEntryId')}
              pickerId="commission-settlement-filter-revenue-entry"
              value={
                'containsRevenueEntryId' in activeQuery
                  ? (activeQuery.containsRevenueEntryId ?? undefined)
                  : undefined
              }
              loadOptions={loadRevenueEntryReferenceOptions}
              placeholder={t('commission:settlements.placeholders.searchReference')}
              clearLabel={t('common:actions.clear')}
              onChange={(value) => patchQuery({ containsRevenueEntryId: value })}
            />
          ) : null}
          {routeMode === 'flat' ? (
            <ReferenceFilterField
              label={t('commission:settlements.filters.subjectTalentId')}
              pickerId="commission-settlement-filter-subject-talent"
              value={
                'subjectTalentId' in activeQuery
                  ? (activeQuery.subjectTalentId ?? undefined)
                  : undefined
              }
              loadOptions={loadTalentReferenceOptions}
              placeholder={t('commission:settlements.placeholders.searchReference')}
              clearLabel={t('common:actions.clear')}
              className="min-w-[210px]"
              onChange={(value) => patchQuery({ subjectTalentId: value })}
            />
          ) : null}
          {routeMode === 'flat' ? (
            <>
              <ReferenceFilterField
                label={t('commission:settlements.filters.sourceRuleId')}
                pickerId="commission-settlement-filter-rule"
                value={flatListQuery.sourceRuleId ?? undefined}
                loadOptions={loadCommissionRuleReferenceOptions}
                placeholder={t('commission:settlements.placeholders.searchReference')}
                clearLabel={t('common:actions.clear')}
                onChange={(value) => patchQuery({ sourceRuleId: value })}
              />
              <label className="flex min-w-[220px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('commission:settlements.filters.settlementKindSnapshot')}
                </span>
                <select
                  value={flatListQuery.settlementKindSnapshot ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({ settlementKindSnapshot: event.target.value || undefined })
                  }
                >
                  <option value="">{t('commission:settlements.filters.anySettlementKind')}</option>
                  {commissionSettlementKindValues.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`commission:settlementKinds.${kind}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[150px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('commission:settlements.filters.settlementCurrencyCode')}
                </span>
                <input
                  value={flatListQuery.settlementCurrencyCode ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({ settlementCurrencyCode: event.target.value || undefined })
                  }
                />
              </label>
            </>
          ) : null}
          <label className="flex min-w-[190px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('commission:settlements.filters.windowStartAt')}
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
          <label className="flex min-w-[190px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('commission:settlements.filters.windowEndAt')}
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
            <CommissionSettlementCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={async (payload) => {
                try {
                  await createMutation.mutateAsync(payload);
                  notifySuccess('commission:settlements.feedback.created');
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
            emptyTitle={t('commission:settlements.states.emptyTitle')}
            emptyMessage={t('commission:settlements.states.emptyMessage')}
            caption={t('commission:settlements.table.caption')}
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
          title={t('commission:settlements.states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'commission:settlements.states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
