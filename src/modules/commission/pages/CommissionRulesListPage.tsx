import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { CommissionRuleCreateSurface } from '@modules/commission/forms/commission-mutation-forms';
import {
  useCommissionRuleLifecycleMutation,
  useCommissionRulesByBeneficiary,
  useCommissionRulesByContract,
  useCommissionRulesFlatList,
  useCreateCommissionRuleMutation,
} from '@modules/commission/hooks/use-commission';
import { createCommissionRuleColumns } from '@modules/commission/tables/commission-columns';
import type {
  CommissionRuleLifecycleAction,
  CommissionRulesByBeneficiaryQuery,
  CommissionRulesByContractQuery,
  CommissionRulesFlatListQuery,
} from '@modules/commission/types/commission.types';
import {
  commissionBeneficiaryKindValues,
  commissionRevenueKindValues,
  commissionRuleStatusValues,
  commissionSettlementKindValues,
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
  loadContractReferenceOptions,
  loadEmploymentProfileReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import { ModuleListScreenShell } from '@shared/modules';
import {
  commissionRulesByBeneficiaryQueryConfig,
  commissionRulesByContractQueryConfig,
  commissionRulesFlatListQueryConfig,
  createCursorStack,
  mergeScreenQueryParams,
  moveNextCursor,
  movePreviousCursor,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query';

type RouteMode = 'flat' | 'by-beneficiary' | 'by-contract';
type ActiveRuleQuery =
  | CommissionRulesFlatListQuery
  | CommissionRulesByBeneficiaryQuery
  | CommissionRulesByContractQuery;
type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

const sortOptions = [
  { value: 'ruleCode', labelKey: 'commission:rules.sort.ruleCode' },
  { value: 'title', labelKey: 'commission:rules.sort.title' },
  { value: 'effectiveStartDate', labelKey: 'commission:rules.sort.effectiveStartDate' },
  { value: 'createdAt', labelKey: 'commission:rules.sort.createdAt' },
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

const readLifecycleConfirmKey = (action: CommissionRuleLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'commission:rules.confirm.activate';
    case 'deactivate':
      return 'commission:rules.confirm.deactivate';
    case 'archive':
      return 'commission:rules.confirm.archive';
    default:
      return 'commission:rules.confirm.archive';
  }
};

const serializeForMode = (routeMode: RouteMode, query: ActiveRuleQuery): URLSearchParams => {
  if (routeMode === 'by-beneficiary') {
    return serializeScreenQueryParams(query, commissionRulesByBeneficiaryQueryConfig);
  }
  if (routeMode === 'by-contract') {
    return serializeScreenQueryParams(query, commissionRulesByContractQueryConfig);
  }

  return serializeScreenQueryParams(query, commissionRulesFlatListQueryConfig);
};

export const CommissionRulesListPage = (): JSX.Element => {
  const { t } = useTranslation(['commission', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, commissionRulesFlatListQueryConfig),
    [searchParams],
  );
  const byBeneficiaryQuery = useMemo(
    () => parseScreenQueryParams(searchParams, commissionRulesByBeneficiaryQueryConfig),
    [searchParams],
  );
  const byContractQuery = useMemo(
    () => parseScreenQueryParams(searchParams, commissionRulesByContractQueryConfig),
    [searchParams],
  );
  const routeMode: RouteMode =
    byBeneficiaryQuery.view === 'by-beneficiary'
      ? 'by-beneficiary'
      : byContractQuery.view === 'by-contract'
        ? 'by-contract'
        : 'flat';
  const activeQuery =
    routeMode === 'by-beneficiary'
      ? byBeneficiaryQuery
      : routeMode === 'by-contract'
        ? byContractQuery
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
              commissionRulesByBeneficiaryQueryConfig,
              mergeOptions,
            )
          : routeMode === 'by-contract'
            ? mergeScreenQueryParams(
                searchParams,
                patch,
                commissionRulesByContractQueryConfig,
                mergeOptions,
              )
            : mergeScreenQueryParams(
                searchParams,
                patch,
                commissionRulesFlatListQueryConfig,
                mergeOptions,
              );
      setSearchParams(next, { replace: options?.replace });
    },
    [routeMode, searchParams, setSearchParams],
  );

  const flatQueryResult = useCommissionRulesFlatList(flatListQuery, {
    enabled: routeMode === 'flat',
  });
  const byBeneficiaryQueryResult = useCommissionRulesByBeneficiary(byBeneficiaryQuery, {
    enabled: routeMode === 'by-beneficiary',
  });
  const byContractQueryResult = useCommissionRulesByContract(byContractQuery, {
    enabled: routeMode === 'by-contract',
  });
  const listQueryResult =
    routeMode === 'by-beneficiary'
      ? byBeneficiaryQueryResult
      : routeMode === 'by-contract'
        ? byContractQueryResult
        : flatQueryResult;

  const createMutation = useCreateCommissionRuleMutation();
  const lifecycleMutation = useCommissionRuleLifecycleMutation();
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
        ? t('commission:rules.actions.closeCreate')
        : t('commission:rules.actions.create')}
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
    async (commissionRuleId: string, action: CommissionRuleLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) return;

      try {
        await lifecycleMutation.mutateAsync({ commissionRuleId, action });
        notifySuccess('commission:rules.feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createCommissionRuleColumns(t, {
        onOpenDetail: (commissionRuleId) =>
          navigate(APP_PATHS.commissionRuleDetail(commissionRuleId)),
        onLifecycleAction,
        isActionPending: (commissionRuleId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.commissionRuleId === commissionRuleId &&
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

  return (
    <ModuleListScreenShell
      mode={routeMode === 'flat' ? 'flat-list' : 'related-list'}
      banner={
        <div className="space-y-2">
          {routeMode !== 'flat' ? (
            <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-text">
              {t(`commission:rules.relatedModes.${routeMode}`)}
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
                placeholder={t('commission:rules.filters.searchPlaceholder')}
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
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('commission:rules.filters.status')}
            </span>
            <select
              value={activeQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              <option value="">{t('commission:rules.filters.allStatuses')}</option>
              {commissionRuleStatusValues.map((status) => (
                <option key={status} value={status}>
                  {t(`commission:rules.statuses.${status}`)}
                </option>
              ))}
            </select>
          </label>
          {routeMode !== 'by-contract' ? (
            <>
              <label className="flex min-w-[190px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('commission:rules.filters.beneficiaryKind')}
                </span>
                <select
                  value={
                    'beneficiaryKind' in activeQuery ? (activeQuery.beneficiaryKind ?? '') : ''
                  }
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      beneficiaryKind: event.target.value || undefined,
                      beneficiaryEmploymentProfileId: undefined,
                      beneficiaryTalentId: undefined,
                    })
                  }
                >
                  <option value="">{t('commission:rules.filters.anyBeneficiaryKind')}</option>
                  {commissionBeneficiaryKindValues.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`commission:beneficiaryKinds.${kind}`)}
                    </option>
                  ))}
                </select>
              </label>
              <ReferenceFilterField
                label={t('commission:rules.filters.beneficiaryEmploymentProfileId')}
                pickerId="commission-rule-filter-beneficiary-employment"
                value={
                  'beneficiaryEmploymentProfileId' in activeQuery
                    ? (activeQuery.beneficiaryEmploymentProfileId ?? undefined)
                    : undefined
                }
                loadOptions={loadEmploymentProfileReferenceOptions}
                placeholder={t('commission:rules.placeholders.searchReference')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[230px]"
                onChange={(value) =>
                  patchQuery({
                    beneficiaryKind: value ? 'EMPLOYMENT_PROFILE' : undefined,
                    beneficiaryEmploymentProfileId: value,
                    beneficiaryTalentId: undefined,
                  })
                }
              />
              <ReferenceFilterField
                label={t('commission:rules.filters.beneficiaryTalentId')}
                pickerId="commission-rule-filter-beneficiary-talent"
                value={
                  'beneficiaryTalentId' in activeQuery
                    ? (activeQuery.beneficiaryTalentId ?? undefined)
                    : undefined
                }
                loadOptions={loadTalentReferenceOptions}
                placeholder={t('commission:rules.placeholders.searchReference')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[210px]"
                onChange={(value) =>
                  patchQuery({
                    beneficiaryKind: value ? 'TALENT' : undefined,
                    beneficiaryTalentId: value,
                    beneficiaryEmploymentProfileId: undefined,
                  })
                }
              />
            </>
          ) : null}
          {routeMode !== 'by-beneficiary' ? (
            <ReferenceFilterField
              label={t('commission:rules.filters.sourceContractRecordId')}
              pickerId="commission-rule-filter-source-contract"
              value={
                'sourceContractRecordId' in activeQuery
                  ? (activeQuery.sourceContractRecordId ?? undefined)
                  : undefined
              }
              loadOptions={loadContractReferenceOptions}
              placeholder={t('commission:rules.placeholders.searchReference')}
              clearLabel={t('common:actions.clear')}
              className="min-w-[230px]"
              onChange={(value) => patchQuery({ sourceContractRecordId: value })}
            />
          ) : null}
          {routeMode === 'flat' ? (
            <>
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('commission:rules.filters.settlementKind')}
                </span>
                <select
                  value={flatListQuery.settlementKind ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({ settlementKind: event.target.value || undefined })
                  }
                >
                  <option value="">{t('commission:rules.filters.anySettlementKind')}</option>
                  {commissionSettlementKindValues.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`commission:settlementKinds.${kind}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[210px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('commission:rules.filters.appliesToRevenueKind')}
                </span>
                <select
                  value={flatListQuery.appliesToRevenueKind ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({ appliesToRevenueKind: event.target.value || undefined })
                  }
                >
                  <option value="">{t('commission:rules.filters.anyRevenueKind')}</option>
                  {commissionRevenueKindValues.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`commission:revenueKinds.${kind}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[210px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('commission:rules.filters.windowStartDate')}
                </span>
                <input
                  type="number"
                  value={flatListQuery.windowStartDate ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      windowStartDate: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="flex min-w-[210px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('commission:rules.filters.windowEndDate')}
                </span>
                <input
                  type="number"
                  value={flatListQuery.windowEndDate ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      windowEndDate: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
            </>
          ) : null}
        </FilterBarShell>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <CommissionRuleCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={async (payload) => {
                try {
                  await createMutation.mutateAsync(payload);
                  notifySuccess('commission:rules.feedback.created');
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
            emptyTitle={t('commission:rules.states.emptyTitle')}
            emptyMessage={t('commission:rules.states.emptyMessage')}
            caption={t('commission:rules.table.caption')}
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
          title={t('commission:rules.states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'commission:rules.states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
