import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import {
  ContractCreateSurface,
  ContractDateActionSurface,
} from '@modules/contract-registry/forms/contract-registry-mutation-forms';
import {
  useContractLifecycleMutation,
  useContractRecordFlatList,
  useContractRecordsByLinkedEntity,
  useContractRecordsByOwner,
  useCreateContractRecordMutation,
  useExpireContractRecordMutation,
  useTerminateContractRecordMutation,
} from '@modules/contract-registry/hooks/use-contract-registry';
import { createContractRecordColumns } from '@modules/contract-registry/tables/contract-registry-columns';
import type {
  ContractLifecycleAction,
  ContractLinkedEntityKind,
} from '@modules/contract-registry/types/contract-registry.types';
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
  loadEmploymentProfileReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import { ModuleListScreenShell } from '@shared/modules';
import {
  contractRegistryByLinkedEntityQueryConfig,
  contractRegistryByOwnerQueryConfig,
  contractRegistryFlatListQueryConfig,
  createCursorStack,
  mergeScreenQueryParams,
  moveNextCursor,
  movePreviousCursor,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query';

type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

type ListDateAction = {
  contractRecordId: string;
  action: 'expire' | 'terminate';
};

const sortOptions = [
  { value: 'effectiveStartDate', labelKey: 'contract-registry:sort.effectiveStartDate' },
  { value: 'contractCode', labelKey: 'contract-registry:sort.contractCode' },
  { value: 'createdAt', labelKey: 'contract-registry:sort.createdAt' },
] as const;

const statusOptions = [
  '',
  'DRAFT',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'ARCHIVED',
] as const;
const contractKindOptions = ['', 'EMPLOYMENT', 'TALENT_SERVICE', 'TALENT_MANAGEMENT'] as const;
const linkedEntityKindOptions = ['', 'EMPLOYMENT_PROFILE', 'TALENT'] as const;
const confidentialityTierOptions = ['', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const;
const hasFileReferenceOptions = ['', 'true', 'false'] as const;

type FilterLabelKey = 'linkedEntity' | 'owner';

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

const readLifecycleConfirmKey = (action: ContractLifecycleAction): string => {
  switch (action) {
    case 'mark-pending-signature':
      return 'contract-registry:confirm.markPendingSignature';
    case 'reopen-draft':
      return 'contract-registry:confirm.reopenDraft';
    case 'activate':
      return 'contract-registry:confirm.activate';
    case 'archive':
      return 'contract-registry:confirm.archive';
    default:
      return 'contract-registry:confirm.archive';
  }
};

export const ContractRegistryListPage = (): JSX.Element => {
  const { t } = useTranslation(['contract-registry', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, contractRegistryFlatListQueryConfig),
    [searchParams],
  );
  const byLinkedEntityQuery = useMemo(
    () => parseScreenQueryParams(searchParams, contractRegistryByLinkedEntityQueryConfig),
    [searchParams],
  );
  const byOwnerQuery = useMemo(
    () => parseScreenQueryParams(searchParams, contractRegistryByOwnerQueryConfig),
    [searchParams],
  );

  const routeMode =
    byLinkedEntityQuery.view === 'by-linked-entity'
      ? 'by-linked-entity'
      : byOwnerQuery.view === 'by-owner'
        ? 'by-owner'
        : 'flat';
  const activeQuery =
    routeMode === 'by-linked-entity'
      ? byLinkedEntityQuery
      : routeMode === 'by-owner'
        ? byOwnerQuery
        : flatListQuery;
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(() => {
    if (routeMode === 'by-linked-entity') {
      return serializeScreenQueryParams(
        byLinkedEntityQuery,
        contractRegistryByLinkedEntityQueryConfig,
      ).toString();
    }

    if (routeMode === 'by-owner') {
      return serializeScreenQueryParams(
        byOwnerQuery,
        contractRegistryByOwnerQueryConfig,
      ).toString();
    }

    return serializeScreenQueryParams(
      flatListQuery,
      contractRegistryFlatListQueryConfig,
    ).toString();
  }, [byLinkedEntityQuery, byOwnerQuery, flatListQuery, routeMode]);

  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
    }
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | boolean | undefined>, options?: RoutePatchOptions) => {
      const mergeOptions = { resetCursorOnChange: options?.resetCursorOnChange ?? true };
      const next =
        routeMode === 'by-linked-entity'
          ? mergeScreenQueryParams(
              searchParams,
              patch,
              contractRegistryByLinkedEntityQueryConfig,
              mergeOptions,
            )
          : routeMode === 'by-owner'
            ? mergeScreenQueryParams(
                searchParams,
                patch,
                contractRegistryByOwnerQueryConfig,
                mergeOptions,
              )
            : mergeScreenQueryParams(
                searchParams,
                patch,
                contractRegistryFlatListQueryConfig,
                mergeOptions,
              );
      setSearchParams(next, { replace: options?.replace });
    },
    [routeMode, searchParams, setSearchParams],
  );

  const flatQueryResult = useContractRecordFlatList(flatListQuery, {
    enabled: routeMode === 'flat',
  });
  const byLinkedEntityQueryResult = useContractRecordsByLinkedEntity(byLinkedEntityQuery, {
    enabled: routeMode === 'by-linked-entity',
  });
  const byOwnerQueryResult = useContractRecordsByOwner(byOwnerQuery, {
    enabled: routeMode === 'by-owner',
  });
  const listQueryResult =
    routeMode === 'by-linked-entity'
      ? byLinkedEntityQueryResult
      : routeMode === 'by-owner'
        ? byOwnerQueryResult
        : flatQueryResult;

  const createMutation = useCreateContractRecordMutation();
  const lifecycleMutation = useContractLifecycleMutation();
  const expireMutation = useExpireContractRecordMutation();
  const terminateMutation = useTerminateContractRecordMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterLabels, setFilterLabels] = useState<Partial<Record<FilterLabelKey, string>>>({});
  const [activeDateAction, setActiveDateAction] = useState<ListDateAction | null>(null);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    if (routeMode === 'by-linked-entity') {
      return serializeScreenQueryParams(
        { ...byLinkedEntityQuery, cursor: undefined },
        contractRegistryByLinkedEntityQueryConfig,
      ).toString();
    }

    if (routeMode === 'by-owner') {
      return serializeScreenQueryParams(
        { ...byOwnerQuery, cursor: undefined },
        contractRegistryByOwnerQueryConfig,
      ).toString();
    }

    return serializeScreenQueryParams(
      { ...flatListQuery, cursor: undefined },
      contractRegistryFlatListQueryConfig,
    ).toString();
  }, [byLinkedEntityQuery, byOwnerQuery, flatListQuery, routeMode]);
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
        ? t('contract-registry:actions.closeCreate')
        : t('contract-registry:actions.create')}
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
    async (contractRecordId: string, action: ContractLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({ contractRecordId, action });
        notifySuccess('contract-registry:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createContractRecordColumns(t, {
        onOpenDetail: (contractRecordId) =>
          navigate(APP_PATHS.contractRecordDetail(contractRecordId)),
        onLifecycleAction,
        onDateAction: (contractRecordId, action) =>
          setActiveDateAction({ contractRecordId, action }),
        isActionPending: (contractRecordId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.contractRecordId === contractRecordId &&
          lifecycleMutation.variables?.action === action,
        isDateActionPending: (contractRecordId, action) =>
          action === 'expire'
            ? expireMutation.isPending &&
              expireMutation.variables?.contractRecordId === contractRecordId
            : terminateMutation.isPending &&
              terminateMutation.variables?.contractRecordId === contractRecordId,
      }),
    [
      expireMutation.isPending,
      expireMutation.variables,
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      t,
      terminateMutation.isPending,
      terminateMutation.variables,
    ],
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

  const linkedKind =
    'linkedEntityKind' in activeQuery
      ? (activeQuery.linkedEntityKind as ContractLinkedEntityKind | undefined)
      : undefined;
  const selectedLinkedEntityId =
    'linkedEmploymentProfileId' in activeQuery
      ? (activeQuery.linkedEmploymentProfileId ?? activeQuery.linkedTalentId ?? undefined)
      : undefined;
  const loadLinkedEntityFilterOptions = useCallback(
    (search: string) => {
      if (linkedKind === 'EMPLOYMENT_PROFILE') {
        return loadEmploymentProfileReferenceOptions(search);
      }
      if (linkedKind === 'TALENT') {
        return loadTalentReferenceOptions(search);
      }

      return Promise.resolve([]);
    },
    [linkedKind],
  );

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
        label: t('contract-registry:filters.status'),
        value: t(`contract-registry:statuses.${activeQuery.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.contractKind) {
      chips.push({
        id: 'contractKind',
        label: t('contract-registry:filters.contractKind'),
        value: t(`contract-registry:contractKinds.${flatListQuery.contractKind}`),
        onClear: () => patchQuery({ contractKind: undefined }),
      });
    }

    if (routeMode === 'flat' && linkedKind) {
      chips.push({
        id: 'linkedEntityKind',
        label: t('contract-registry:filters.linkedEntityKind'),
        value: t(`contract-registry:linkedEntityKinds.${linkedKind}`),
        onClear: () =>
          patchQuery({
            linkedEntityKind: undefined,
            linkedEmploymentProfileId: undefined,
            linkedTalentId: undefined,
          }),
      });
    }

    if (routeMode === 'flat' && selectedLinkedEntityId) {
      chips.push({
        id: 'linkedEntity',
        label: t('contract-registry:filters.linkedEntityId'),
        value: filterLabels.linkedEntity ?? selectedLinkedEntityId,
        onClear: () =>
          patchQuery({
            linkedEmploymentProfileId: undefined,
            linkedTalentId: undefined,
          }),
      });
    }

    const ownerEmploymentProfileId =
      'ownerEmploymentProfileId' in activeQuery
        ? (activeQuery.ownerEmploymentProfileId ?? undefined)
        : undefined;
    if (routeMode === 'flat' && ownerEmploymentProfileId) {
      chips.push({
        id: 'owner',
        label: t('contract-registry:filters.ownerEmploymentProfileId'),
        value: filterLabels.owner ?? ownerEmploymentProfileId,
        onClear: () => patchQuery({ ownerEmploymentProfileId: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.confidentialityTier) {
      chips.push({
        id: 'confidentialityTier',
        label: t('contract-registry:filters.confidentialityTier'),
        value: t(`contract-registry:confidentialityTiers.${flatListQuery.confidentialityTier}`),
        onClear: () => patchQuery({ confidentialityTier: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.hasFileReference !== undefined) {
      chips.push({
        id: 'hasFileReference',
        label: t('contract-registry:filters.hasFileReference'),
        value: t(
          `contract-registry:filters.fileReference.${String(flatListQuery.hasFileReference)}`,
        ),
        onClear: () => patchQuery({ hasFileReference: undefined }),
      });
    }

    if (activeQuery.windowStartDate) {
      chips.push({
        id: 'windowStartDate',
        label: t('contract-registry:filters.windowStartDate'),
        value: activeQuery.windowStartDate,
        onClear: () => patchQuery({ windowStartDate: undefined }),
      });
    }

    if (activeQuery.windowEndDate) {
      chips.push({
        id: 'windowEndDate',
        label: t('contract-registry:filters.windowEndDate'),
        value: activeQuery.windowEndDate,
        onClear: () => patchQuery({ windowEndDate: undefined }),
      });
    }

    if ('effectiveEndDateFrom' in activeQuery && activeQuery.effectiveEndDateFrom) {
      chips.push({
        id: 'effectiveEndDateFrom',
        label: 'Effective end date from',
        value: activeQuery.effectiveEndDateFrom,
        onClear: () => patchQuery({ effectiveEndDateFrom: undefined }),
      });
    }

    if ('effectiveEndDateTo' in activeQuery && activeQuery.effectiveEndDateTo) {
      chips.push({
        id: 'effectiveEndDateTo',
        label: 'Effective end date to',
        value: activeQuery.effectiveEndDateTo,
        onClear: () => patchQuery({ effectiveEndDateTo: undefined }),
      });
    }

    return chips;
  }, [
    activeQuery,
    filterLabels.linkedEntity,
    filterLabels.owner,
    flatListQuery.confidentialityTier,
    flatListQuery.contractKind,
    flatListQuery.hasFileReference,
    flatListQuery.search,
    linkedKind,
    patchQuery,
    routeMode,
    selectedLinkedEntityId,
    t,
  ]);

  const clearAllFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
      contractKind: undefined,
      linkedEntityKind: routeMode === 'by-linked-entity' ? linkedKind : undefined,
      linkedEmploymentProfileId:
        routeMode === 'by-linked-entity'
          ? byLinkedEntityQuery.linkedEmploymentProfileId
          : undefined,
      linkedTalentId:
        routeMode === 'by-linked-entity' ? byLinkedEntityQuery.linkedTalentId : undefined,
      ownerEmploymentProfileId:
        routeMode === 'by-owner' ? byOwnerQuery.ownerEmploymentProfileId : undefined,
      confidentialityTier: undefined,
      hasFileReference: undefined,
      windowStartDate: undefined,
      windowEndDate: undefined,
      effectiveEndDateFrom: undefined,
      effectiveEndDateTo: undefined,
    });
  }, [
    byLinkedEntityQuery.linkedEmploymentProfileId,
    byLinkedEntityQuery.linkedTalentId,
    byOwnerQuery.ownerEmploymentProfileId,
    linkedKind,
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
              {t(`contract-registry:relatedModes.${routeMode}`)}
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
                placeholder={t('contract-registry:filters.searchPlaceholder')}
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
              aria-controls="contract-registry-more-filters"
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
              id="contract-registry-more-filters"
              title={t('common:filters.moreFilters')}
              isOpen={isMoreFiltersOpen}
              closeLabel={t('common:actions.close')}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
              {routeMode === 'flat' ? (
                <label className="flex min-w-[210px] flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('contract-registry:filters.contractKind')}
                  </span>
                  <select
                    value={flatListQuery.contractKind ?? ''}
                    className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                    onChange={(event) =>
                      patchQuery({ contractKind: event.target.value || undefined })
                    }
                  >
                    {contractKindOptions.map((kind) => (
                      <option key={kind || 'all'} value={kind}>
                        {kind
                          ? t(`contract-registry:contractKinds.${kind}`)
                          : t('contract-registry:filters.allContractKinds')}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {routeMode !== 'by-owner' ? (
                <>
                  <label className="flex min-w-[210px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('contract-registry:filters.linkedEntityKind')}
                    </span>
                    <select
                      value={linkedKind ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        patchQuery({
                          linkedEntityKind: event.target.value || undefined,
                          linkedEmploymentProfileId: undefined,
                          linkedTalentId: undefined,
                        })
                      }
                    >
                      {linkedEntityKindOptions.map((kind) => (
                        <option key={kind || 'all'} value={kind}>
                          {kind
                            ? t(`contract-registry:linkedEntityKinds.${kind}`)
                            : t('contract-registry:filters.allLinkedEntityKinds')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ReferenceFilterField
                    label={t('contract-registry:filters.linkedEntityId')}
                    pickerId="contract-registry-filter-linked-entity"
                    value={selectedLinkedEntityId}
                    loadOptions={loadLinkedEntityFilterOptions}
                    placeholder={t('contract-registry:filters.linkedEntityIdPlaceholder')}
                    clearLabel={t('common:actions.clear')}
                    disabled={!linkedKind}
                    onSelectedOptionChange={rememberFilterLabel('linkedEntity')}
                    onChange={(value) =>
                      patchQuery({
                        linkedEmploymentProfileId:
                          linkedKind === 'EMPLOYMENT_PROFILE' ? value : undefined,
                        linkedTalentId: linkedKind === 'TALENT' ? value : undefined,
                      })
                    }
                  />
                </>
              ) : null}
              <ReferenceFilterField
                label={t('contract-registry:filters.ownerEmploymentProfileId')}
                pickerId="contract-registry-filter-owner"
                value={
                  'ownerEmploymentProfileId' in activeQuery
                    ? (activeQuery.ownerEmploymentProfileId ?? undefined)
                    : undefined
                }
                loadOptions={loadEmploymentProfileReferenceOptions}
                placeholder={t('contract-registry:filters.ownerEmploymentProfileIdPlaceholder')}
                clearLabel={t('common:actions.clear')}
                onSelectedOptionChange={rememberFilterLabel('owner')}
                onChange={(value) => patchQuery({ ownerEmploymentProfileId: value })}
              />
              {routeMode === 'flat' ? (
                <>
                  <label className="flex min-w-[190px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('contract-registry:filters.confidentialityTier')}
                    </span>
                    <select
                      value={flatListQuery.confidentialityTier ?? ''}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        patchQuery({ confidentialityTier: event.target.value || undefined })
                      }
                    >
                      {confidentialityTierOptions.map((tier) => (
                        <option key={tier || 'all'} value={tier}>
                          {tier
                            ? t(`contract-registry:confidentialityTiers.${tier}`)
                            : t('contract-registry:filters.allConfidentialityTiers')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[170px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('contract-registry:filters.hasFileReference')}
                    </span>
                    <select
                      value={
                        flatListQuery.hasFileReference === undefined
                          ? ''
                          : String(flatListQuery.hasFileReference)
                      }
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        patchQuery({
                          hasFileReference:
                            event.target.value === '' ? undefined : event.target.value === 'true',
                        })
                      }
                    >
                      {hasFileReferenceOptions.map((value) => (
                        <option key={value || 'all'} value={value}>
                          {value === ''
                            ? t('contract-registry:filters.anyFileReference')
                            : t(`contract-registry:filters.fileReference.${value}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label className="flex min-w-[170px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('contract-registry:filters.windowStartDate')}
                </span>
                <input
                  type="date"
                  value={activeQuery.windowStartDate ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({ windowStartDate: event.target.value || undefined })
                  }
                />
              </label>
              <label className="flex min-w-[170px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('contract-registry:filters.windowEndDate')}
                </span>
                <input
                  type="date"
                  value={activeQuery.windowEndDate ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({ windowEndDate: event.target.value || undefined })
                  }
                />
              </label>
            </MoreFiltersPanel>
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('contract-registry:filters.status')}
            </span>
            <select
              value={activeQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              {statusOptions.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status
                    ? t(`contract-registry:statuses.${status}`)
                    : t('contract-registry:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterToolbar>
      }
      interactionSection={
        <>
          {isCreateOpen ? (
            <ContractCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={async (payload) => {
                try {
                  await createMutation.mutateAsync(payload);
                  notifySuccess('contract-registry:feedback.created');
                  setIsCreateOpen(false);
                } catch (error) {
                  notifyError(error as NormalizedApiError);
                }
              }}
            />
          ) : null}
          {activeDateAction ? (
            <ContractDateActionSurface
              action={activeDateAction.action}
              isPending={
                activeDateAction.action === 'expire'
                  ? expireMutation.isPending
                  : terminateMutation.isPending
              }
              onCancel={() => setActiveDateAction(null)}
              onSubmit={async (payload) => {
                try {
                  if ('expiryDate' in payload) {
                    await expireMutation.mutateAsync({
                      contractRecordId: activeDateAction.contractRecordId,
                      payload,
                    });
                    notifySuccess('contract-registry:feedback.expired');
                  } else {
                    await terminateMutation.mutateAsync({
                      contractRecordId: activeDateAction.contractRecordId,
                      payload,
                    });
                    notifySuccess('contract-registry:feedback.terminated');
                  }
                  setActiveDateAction(null);
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
            emptyTitle={t('contract-registry:states.emptyTitle')}
            emptyMessage={t('contract-registry:states.emptyMessage')}
            caption={t('contract-registry:table.caption')}
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
          title={t('contract-registry:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'contract-registry:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
