import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { useModulePageActions } from '@app/providers/module-runtime';
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
import { loadContractReferenceOptions } from '@modules/contract-registry';
import { loadEmploymentProfileReferenceOptions } from '@modules/employment-profile';
import { loadTalentReferenceOptions } from '@modules/talent';
import { ModuleListScreenShell } from '@shared/modules';
import {
  commissionRulesByBeneficiaryQueryConfig,
  commissionRulesByContractQueryConfig,
  commissionRulesFlatListQueryConfig,
} from '@modules/commission';
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query/cursor';
import {
  mergeScreenQueryParams,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query/screen-query-config';
import { readReferenceDisplayForId } from '@shared/formatting/reference-display';

type RouteMode = 'flat' | 'by-beneficiary' | 'by-contract';
type ActiveRuleQuery =
  | CommissionRulesFlatListQuery
  | CommissionRulesByBeneficiaryQuery
  | CommissionRulesByContractQuery;
type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

type FilterLabelKey = 'beneficiaryEmployment' | 'beneficiaryTalent' | 'sourceContract';
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

  const capabilitiesQuery = useCurrentActorCapabilities();
  const createMutation = useCreateCommissionRuleMutation();
  const lifecycleMutation = useCommissionRuleLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterLabels, setFilterLabels] = useState<
    Partial<Record<FilterLabelKey, FilterLabelEntry>>
  >({});
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

  const commissionGlobalScope = { module: 'commission', value: 'global' } as const;
  const canCreateCommissionRule = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.COMMISSION_RULE_CREATE,
    scope: commissionGlobalScope,
  });
  const canManageCommissionRuleLifecycle = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.COMMISSION_RULE_MANAGE_LIFECYCLE,
    scope: commissionGlobalScope,
  });

  useModulePageActions(
    canCreateCommissionRule ? (
      <button
        type="button"
        onClick={() => setIsCreateOpen((current) => !current)}
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {isCreateOpen
          ? t('commission:rules.actions.closeCreate')
          : t('commission:rules.actions.create')}
      </button>
    ) : null,
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
        canShowLifecycleAction: () => canManageCommissionRuleLifecycle,
        isActionPending: (commissionRuleId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.commissionRuleId === commissionRuleId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      canManageCommissionRuleLifecycle,
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      t,
    ],
  );

  const listError = listQueryResult.error as NormalizedApiError | null;
  const shellState = useMemo(() => {
    if (listQueryResult.isPending) return 'loading' as const;
    if (listQueryResult.isError) return listError?.permissionDenied ? 'denied' : 'error';
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
  const beneficiaryEmploymentFilterLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        'beneficiaryEmploymentProfileId' in activeQuery
          ? activeQuery.beneficiaryEmploymentProfileId
          : undefined,
        (listQueryResult.data?.data ?? []).map((record) => record.beneficiaryRef),
      ),
    [activeQuery, listQueryResult.data?.data],
  );
  const beneficiaryTalentFilterLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        'beneficiaryTalentId' in activeQuery ? activeQuery.beneficiaryTalentId : undefined,
        (listQueryResult.data?.data ?? []).map((record) => record.beneficiaryRef),
      ),
    [activeQuery, listQueryResult.data?.data],
  );
  const sourceContractFilterLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        'sourceContractRecordId' in activeQuery ? activeQuery.sourceContractRecordId : undefined,
        (listQueryResult.data?.data ?? []).map((record) => record.sourceContractRecordRef),
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
        label: t('commission:rules.filters.status'),
        value: t(`commission:rules.statuses.${activeQuery.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.beneficiaryKind) {
      chips.push({
        id: 'beneficiaryKind',
        label: t('commission:rules.filters.beneficiaryKind'),
        value: t(`commission:beneficiaryKinds.${flatListQuery.beneficiaryKind}`),
        onClear: () =>
          patchQuery({
            beneficiaryKind: undefined,
            beneficiaryEmploymentProfileId: undefined,
            beneficiaryTalentId: undefined,
          }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.beneficiaryEmploymentProfileId) {
      chips.push({
        id: 'beneficiaryEmploymentProfileId',
        label: t('commission:rules.filters.beneficiaryEmploymentProfileId'),
        value:
          readCachedFilterLabel(
            filterLabels,
            'beneficiaryEmployment',
            flatListQuery.beneficiaryEmploymentProfileId,
          ) ?? beneficiaryEmploymentFilterLabel,
        onClear: () => patchQuery({ beneficiaryEmploymentProfileId: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.beneficiaryTalentId) {
      chips.push({
        id: 'beneficiaryTalentId',
        label: t('commission:rules.filters.beneficiaryTalentId'),
        value:
          readCachedFilterLabel(
            filterLabels,
            'beneficiaryTalent',
            flatListQuery.beneficiaryTalentId,
          ) ?? beneficiaryTalentFilterLabel,
        onClear: () => patchQuery({ beneficiaryTalentId: undefined }),
      });
    }

    const sourceContractRecordId =
      'sourceContractRecordId' in activeQuery
        ? (activeQuery.sourceContractRecordId ?? undefined)
        : undefined;
    if (routeMode === 'flat' && sourceContractRecordId) {
      chips.push({
        id: 'sourceContractRecordId',
        label: t('commission:rules.filters.sourceContractRecordId'),
        value:
          readCachedFilterLabel(filterLabels, 'sourceContract', sourceContractRecordId) ??
          sourceContractFilterLabel,
        onClear: () => patchQuery({ sourceContractRecordId: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.settlementKind) {
      chips.push({
        id: 'settlementKind',
        label: t('commission:rules.filters.settlementKind'),
        value: t(`commission:settlementKinds.${flatListQuery.settlementKind}`),
        onClear: () => patchQuery({ settlementKind: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.appliesToRevenueKind) {
      chips.push({
        id: 'appliesToRevenueKind',
        label: t('commission:rules.filters.appliesToRevenueKind'),
        value: t(`commission:revenueKinds.${flatListQuery.appliesToRevenueKind}`),
        onClear: () => patchQuery({ appliesToRevenueKind: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.windowStartDate !== undefined) {
      chips.push({
        id: 'windowStartDate',
        label: t('commission:rules.filters.windowStartDate'),
        value: String(flatListQuery.windowStartDate),
        onClear: () => patchQuery({ windowStartDate: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.windowEndDate !== undefined) {
      chips.push({
        id: 'windowEndDate',
        label: t('commission:rules.filters.windowEndDate'),
        value: String(flatListQuery.windowEndDate),
        onClear: () => patchQuery({ windowEndDate: undefined }),
      });
    }

    return chips;
  }, [
    activeQuery,
    beneficiaryEmploymentFilterLabel,
    beneficiaryTalentFilterLabel,
    filterLabels,
    flatListQuery.appliesToRevenueKind,
    flatListQuery.beneficiaryEmploymentProfileId,
    flatListQuery.beneficiaryKind,
    flatListQuery.beneficiaryTalentId,
    flatListQuery.search,
    flatListQuery.settlementKind,
    flatListQuery.windowEndDate,
    flatListQuery.windowStartDate,
    patchQuery,
    routeMode,
    sourceContractFilterLabel,
    t,
  ]);

  const clearAllFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
      beneficiaryKind:
        routeMode === 'by-beneficiary' ? byBeneficiaryQuery.beneficiaryKind : undefined,
      beneficiaryEmploymentProfileId:
        routeMode === 'by-beneficiary'
          ? byBeneficiaryQuery.beneficiaryEmploymentProfileId
          : undefined,
      beneficiaryTalentId:
        routeMode === 'by-beneficiary' ? byBeneficiaryQuery.beneficiaryTalentId : undefined,
      sourceContractRecordId:
        routeMode === 'by-contract' ? byContractQuery.sourceContractRecordId : undefined,
      settlementKind: undefined,
      appliesToRevenueKind: undefined,
      windowStartDate: undefined,
      windowEndDate: undefined,
    });
  }, [
    byBeneficiaryQuery.beneficiaryEmploymentProfileId,
    byBeneficiaryQuery.beneficiaryKind,
    byBeneficiaryQuery.beneficiaryTalentId,
    byContractQuery.sourceContractRecordId,
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
              {t(`commission:rules.relatedModes.${routeMode}`)}
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
          moreFiltersTrigger={
            <button
              type="button"
              aria-expanded={isMoreFiltersOpen}
              aria-controls="commission-rules-more-filters"
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
              id="commission-rules-more-filters"
              title={t('common:filters.moreFilters')}
              isOpen={isMoreFiltersOpen}
              closeLabel={t('common:actions.close')}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
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
                    onSelectedOptionChange={rememberFilterLabel(
                      'beneficiaryEmployment',
                      'beneficiaryEmploymentProfileId' in activeQuery
                        ? (activeQuery.beneficiaryEmploymentProfileId ?? undefined)
                        : undefined,
                    )}
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
                    onSelectedOptionChange={rememberFilterLabel(
                      'beneficiaryTalent',
                      'beneficiaryTalentId' in activeQuery
                        ? (activeQuery.beneficiaryTalentId ?? undefined)
                        : undefined,
                    )}
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
                  onSelectedOptionChange={rememberFilterLabel(
                    'sourceContract',
                    'sourceContractRecordId' in activeQuery
                      ? (activeQuery.sourceContractRecordId ?? undefined)
                      : undefined,
                  )}
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
                          windowStartDate: event.target.value
                            ? Number(event.target.value)
                            : undefined,
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
                          windowEndDate: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>
                </>
              ) : null}
            </MoreFiltersPanel>
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
        </FilterToolbar>
      }
      interactionSection={
        <>
          {canCreateCommissionRule && isCreateOpen ? (
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
