import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useModulePageActions } from '@app/providers/module-runtime';
import { APP_PATHS } from '@app/router/paths';
import { useEmploymentProfileList } from '@modules/employment-profile/hooks/use-employment-profile';
import { createEmploymentProfileListColumns } from '@modules/employment-profile/tables/employment-profile-columns';
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
  MoreFiltersPanel,
  PermissionDeniedState,
  SearchBoxSeam,
  SortControlSeam,
} from '@shared/components/primitives';
import { ReferenceFilterField, type ReferenceOption } from '@shared/components/reference';
import { loadOrgUnitReferenceOptions } from '@modules/org-unit';
import { employmentProfileFlatListQueryConfig } from '@modules/employment-profile';
import { createCursorStack, moveNextCursor, movePreviousCursor } from '@shared/query/cursor';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';
import { useRouteQueryState } from '@shared/query/use-route-query-state';
import { ModuleListScreenShell } from '@shared/modules';
import { readReferenceDisplayForId } from '@shared/formatting/reference-display';

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
  { value: 'employeeCode', labelKey: 'employment-profile:sort.employeeCode' },
  { value: 'displayName', labelKey: 'employment-profile:sort.displayName' },
  { value: 'legalName', labelKey: 'employment-profile:sort.legalName' },
  { value: 'createdAt', labelKey: 'employment-profile:sort.createdAt' },
] as const;

const employmentStatusOptions = [
  '',
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'TERMINATED',
  'ARCHIVED',
] as const;
const contractStatusOptions = [
  '',
  'NONE',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
] as const;
const employmentKindOptions = ['', 'EMPLOYEE', 'CONTRACTOR', 'PART_TIME', 'INTERN'] as const;

export const EmploymentProfileListPage = (): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common', 'errors']);
  const navigate = useNavigate();
  const { query, patchQuery } = useRouteQueryState(employmentProfileFlatListQueryConfig);
  const listQuery = useMemo(() => query, [query]);

  const listQueryResult = useEmploymentProfileList(listQuery);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterOptionLabels, setFilterOptionLabels] = useState<Record<string, string>>({});
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    return serializeScreenQueryParams(
      {
        ...query,
        cursor: undefined,
      },
      employmentProfileFlatListQueryConfig,
    ).toString();
  }, [query]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const canCreateEmploymentProfile = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.EMPLOYMENT_PROFILE_CREATE,
  });

  const pageActions = canCreateEmploymentProfile ? (
    <button
      type="button"
      onClick={() => navigate(APP_PATHS.employmentProfileCreate)}
      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
    >
      {t('employment-profile:actions.create')}
    </button>
  ) : null;

  useModulePageActions(pageActions);

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(query.cursor);

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

  const columns = useMemo(
    () =>
      createEmploymentProfileListColumns(t, {
        onOpenDetail: (employmentProfileId) =>
          navigate(APP_PATHS.employmentProfileDetail(employmentProfileId)),
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
  const moreFilterCount = [
    query.contractStatus,
    query.employmentKind,
    query.orgUnitId,
    query.hasLinkedUser,
  ].filter((value) => value !== undefined && value !== '').length;
  const clearEmploymentProfileFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      employmentStatus: undefined,
      contractStatus: undefined,
      employmentKind: undefined,
      orgUnitId: undefined,
      hasLinkedUser: undefined,
    });
  }, [patchQuery]);
  const orgUnitFilterLabel = useMemo(
    () =>
      readReferenceDisplayForId(
        query.orgUnitId,
        (listQueryResult.data?.data ?? []).map((record) => record.orgUnitRef),
      ),
    [listQueryResult.data?.data, query.orgUnitId],
  );
  const appliedFilterChips = useMemo<AppliedFilterChipItem[]>(() => {
    const items: AppliedFilterChipItem[] = [];

    if (query.search) {
      items.push({
        id: 'search',
        label: t('common:labels.search'),
        value: query.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    if (query.employmentStatus) {
      items.push({
        id: 'employment-status',
        label: t('employment-profile:filters.employmentStatus'),
        value: t(`employment-profile:statuses.${query.employmentStatus}`),
        onClear: () => patchQuery({ employmentStatus: undefined }),
      });
    }

    if (query.contractStatus) {
      items.push({
        id: 'contract-status',
        label: t('employment-profile:filters.contractStatus'),
        value: t(`employment-profile:contractStatuses.${query.contractStatus}`),
        onClear: () => patchQuery({ contractStatus: undefined }),
      });
    }

    if (query.employmentKind) {
      items.push({
        id: 'employment-kind',
        label: t('employment-profile:filters.employmentKind'),
        value: query.employmentKind,
        onClear: () => patchQuery({ employmentKind: undefined }),
      });
    }

    if (query.orgUnitId) {
      items.push({
        id: 'org-unit',
        label: t('employment-profile:filters.orgUnitId'),
        value: filterOptionLabels.orgUnit ?? orgUnitFilterLabel,
        onClear: () => patchQuery({ orgUnitId: undefined }),
      });
    }

    if (query.hasLinkedUser !== undefined) {
      items.push({
        id: 'linked-user',
        label: t('employment-profile:filters.hasLinkedUser'),
        value: query.hasLinkedUser
          ? t('employment-profile:filters.linkedOnly')
          : t('employment-profile:filters.unlinkedOnly'),
        onClear: () => patchQuery({ hasLinkedUser: undefined }),
      });
    }

    return items;
  }, [
    filterOptionLabels.orgUnit,
    orgUnitFilterLabel,
    patchQuery,
    query.contractStatus,
    query.employmentKind,
    query.employmentStatus,
    query.hasLinkedUser,
    query.orgUnitId,
    query.search,
    t,
  ]);

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterToolbar
          searchSlot={
            <SearchBoxSeam
              value={query.search ?? ''}
              placeholder={t('employment-profile:filters.searchPlaceholder')}
              onApply={(value) => {
                patchQuery({
                  search: value || undefined,
                });
              }}
            />
          }
          sortSlot={
            <SortControlSeam
              sortBy={query.sortBy}
              sortDirection={query.sortDirection}
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
            <button
              type="button"
              aria-expanded={isMoreFiltersOpen}
              aria-controls="employment-profile-more-filters"
              onClick={() => setIsMoreFiltersOpen((current) => !current)}
              className="rounded border border-border bg-panel px-3 py-1.5 text-sm font-medium"
            >
              {t('common:filters.moreFilters')}
              {moreFilterCount > 0 ? ` (${moreFilterCount})` : ''}
            </button>
          }
          moreFiltersPanel={
            <MoreFiltersPanel
              id="employment-profile-more-filters"
              title={t('common:filters.moreFilters')}
              closeLabel={t('common:actions.close')}
              isOpen={isMoreFiltersOpen}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('employment-profile:filters.contractStatus')}
                </span>
                <select
                  value={query.contractStatus ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      contractStatus: (event.target.value ||
                        undefined) as typeof query.contractStatus,
                    })
                  }
                >
                  {contractStatusOptions.map((statusOption) => (
                    <option key={statusOption || 'all'} value={statusOption}>
                      {statusOption
                        ? t(`employment-profile:contractStatuses.${statusOption}`)
                        : t('employment-profile:filters.allContractStatuses')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('employment-profile:filters.employmentKind')}
                </span>
                <select
                  value={query.employmentKind ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      employmentKind: event.target.value || undefined,
                    })
                  }
                >
                  {employmentKindOptions.map((kindOption) => (
                    <option key={kindOption || 'all'} value={kindOption}>
                      {kindOption
                        ? t(`employment-profile:employmentKinds.${kindOption}`)
                        : t('employment-profile:filters.allEmploymentKinds')}
                    </option>
                  ))}
                </select>
              </label>
              <ReferenceFilterField
                label={t('employment-profile:filters.orgUnitId')}
                pickerId="employment-profile-filter-org-unit"
                value={query.orgUnitId}
                loadOptions={loadOrgUnitReferenceOptions}
                placeholder={t('employment-profile:placeholders.orgUnitSearch')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[240px]"
                onSelectedOptionChange={(option) => rememberFilterOption('orgUnit', option)}
                onChange={(nextId) =>
                  patchQuery({
                    orgUnitId: nextId,
                  })
                }
              />
              <label className="flex min-w-[180px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('employment-profile:filters.hasLinkedUser')}
                </span>
                <select
                  value={
                    query.hasLinkedUser === undefined ? '' : query.hasLinkedUser ? 'true' : 'false'
                  }
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) => {
                    const value = event.target.value;
                    patchQuery({
                      hasLinkedUser: value === '' ? undefined : value === 'true',
                    });
                  }}
                >
                  <option value="">{t('employment-profile:filters.allLinkedUserStates')}</option>
                  <option value="true">{t('employment-profile:filters.linkedOnly')}</option>
                  <option value="false">{t('employment-profile:filters.unlinkedOnly')}</option>
                </select>
              </label>
            </MoreFiltersPanel>
          }
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              items={appliedFilterChips}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              onClearAll={appliedFilterChips.length > 0 ? clearEmploymentProfileFilters : undefined}
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('employment-profile:filters.employmentStatus')}
            </span>
            <select
              value={query.employmentStatus ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  employmentStatus: (event.target.value ||
                    undefined) as typeof query.employmentStatus,
                })
              }
            >
              {employmentStatusOptions.map((statusOption) => (
                <option key={statusOption || 'all'} value={statusOption}>
                  {statusOption
                    ? t(`employment-profile:statuses.${statusOption}`)
                    : t('employment-profile:filters.allEmploymentStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterToolbar>
      }
      tableSection={
        <div className="space-y-4">
          <AdminTableShell
            data={listQueryResult.data?.data ?? []}
            columns={columns}
            isLoading={listQueryResult.isFetching && !listQueryResult.data}
            emptyTitle={t('employment-profile:states.emptyTitle')}
            emptyMessage={t('employment-profile:states.emptyMessage')}
            caption={t('employment-profile:table.caption')}
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
          title={t('employment-profile:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'employment-profile:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
