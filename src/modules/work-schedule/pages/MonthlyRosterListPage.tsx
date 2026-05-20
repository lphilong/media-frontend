import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import {
  loadMonthlyRosterDepartmentFilterOptions,
  loadMonthlyRosterHolidayCalendarFilterOptions,
  loadMonthlyRosterWorkPatternFilterOptions,
} from '@modules/work-schedule/components/work-schedule-reference-options';
import { MonthlyRosterCreateSurface } from '@modules/work-schedule/forms/monthly-roster-mutation-forms';
import {
  useArchiveMonthlyRosterMutation,
  useCreateMonthlyRosterDraftMutation,
  useMonthlyRosterList,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { createMonthlyRosterListColumns } from '@modules/work-schedule/tables/monthly-roster-columns';
import type { MonthlyRosterScope } from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import { ReferenceFilterField, type ReferenceOption } from '@shared/components/reference';
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
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { ModuleListScreenShell } from '@shared/modules';
import {
  createCursorStack,
  mergeScreenQueryParams,
  monthlyRosterListQueryConfig,
  moveNextCursor,
  movePreviousCursor,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query';

type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

const statusOptions = ['', 'DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED'] as const;
const scopeOptions = ['', 'global', 'department'] as const;

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

export const MonthlyRosterListPage = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const listQuery = useMemo(
    () => parseScreenQueryParams(searchParams, monthlyRosterListQueryConfig),
    [searchParams],
  );
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(
    () => serializeScreenQueryParams(listQuery, monthlyRosterListQueryConfig).toString(),
    [listQuery],
  );

  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
    }
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | undefined>, options?: RoutePatchOptions) => {
      const next = mergeScreenQueryParams(searchParams, patch, monthlyRosterListQueryConfig, {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      });
      setSearchParams(next, { replace: options?.replace });
    },
    [searchParams, setSearchParams],
  );

  const listQueryResult = useMonthlyRosterList(listQuery);
  const createMutation = useCreateMonthlyRosterDraftMutation();
  const archiveMutation = useArchiveMonthlyRosterMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterOptionLabels, setFilterOptionLabels] = useState<Record<string, string>>({});
  const [, setCursorStack] = useState(createCursorStack);

  usePageActions(
    <button
      type="button"
      onClick={() => setIsCreateOpen((current) => !current)}
      data-action-priority="primary"
      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
    >
      {isCreateOpen
        ? t('work-schedule:monthlyRosters.actions.closeCreate')
        : t('work-schedule:monthlyRosters.actions.create')}
    </button>,
  );

  const queryShapeSignature = useMemo(
    () =>
      serializeScreenQueryParams(
        {
          ...listQuery,
          cursor: undefined,
        },
        monthlyRosterListQueryConfig,
      ).toString(),
    [listQuery],
  );
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(listQuery.cursor);

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

  const onArchive = useCallback(
    async (monthlyRosterId: string, scope?: MonthlyRosterScope) => {
      const confirmed = await requestDestructiveConfirm({
        description: t('work-schedule:monthlyRosters.confirm.archive'),
      });

      if (!confirmed) {
        return;
      }

      try {
        await archiveMutation.mutateAsync({ monthlyRosterId, scope });
        notifySuccess('work-schedule:monthlyRosters.feedback.archived');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [archiveMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createMonthlyRosterListColumns(t, {
        scope: listQuery.scope,
        onOpenDetail: (monthlyRosterId, scope) =>
          navigate(
            APP_PATHS.monthlyRosterDetail(monthlyRosterId) + (scope ? `?scope=${scope}` : ''),
          ),
        onArchive,
        isArchivePending: (monthlyRosterId) =>
          archiveMutation.isPending &&
          archiveMutation.variables?.monthlyRosterId === monthlyRosterId,
      }),
    [archiveMutation.isPending, archiveMutation.variables, listQuery.scope, navigate, onArchive, t],
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
  const loadDepartmentFilterOptions = useCallback(
    (search: string) =>
      loadMonthlyRosterDepartmentFilterOptions(search, listQuery.departmentOrgUnitId),
    [listQuery.departmentOrgUnitId],
  );
  const loadWorkPatternFilterOptions = useCallback(
    (search: string) => loadMonthlyRosterWorkPatternFilterOptions(search, listQuery.workPatternId),
    [listQuery.workPatternId],
  );
  const loadHolidayCalendarFilterOptions = useCallback(
    (search: string) =>
      loadMonthlyRosterHolidayCalendarFilterOptions(search, listQuery.holidayCalendarId),
    [listQuery.holidayCalendarId],
  );
  const rememberFilterOption = useCallback(
    (key: string, option: ReferenceOption | undefined): void => {
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
    },
    [],
  );
  const moreFilterCount = [
    listQuery.departmentOrgUnitId,
    listQuery.workPatternId,
    listQuery.holidayCalendarId,
    listQuery.scope,
  ].filter((value) => value !== undefined && value !== '').length;
  const clearMonthlyRosterFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
      rosterMonth: undefined,
      departmentOrgUnitId: undefined,
      workPatternId: undefined,
      holidayCalendarId: undefined,
      scope: undefined,
    });
  }, [patchQuery]);
  const appliedFilterChips = useMemo<AppliedFilterChipItem[]>(() => {
    const items: AppliedFilterChipItem[] = [];

    if (listQuery.search) {
      items.push({
        id: 'search',
        label: t('common:labels.search'),
        value: listQuery.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    if (listQuery.status) {
      items.push({
        id: 'status',
        label: t('work-schedule:monthlyRosters.filters.status'),
        value: t(`work-schedule:monthlyRosters.statuses.${listQuery.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    if (listQuery.rosterMonth) {
      items.push({
        id: 'roster-month',
        label: t('work-schedule:monthlyRosters.filters.rosterMonth'),
        value: listQuery.rosterMonth,
        onClear: () => patchQuery({ rosterMonth: undefined }),
      });
    }

    if (listQuery.departmentOrgUnitId) {
      items.push({
        id: 'department',
        label: t('work-schedule:monthlyRosters.filters.departmentOrgUnitId'),
        value: filterOptionLabels.department ?? t('work-schedule:filterChips.selectedDepartment'),
        onClear: () => patchQuery({ departmentOrgUnitId: undefined }),
      });
    }

    if (listQuery.workPatternId) {
      items.push({
        id: 'work-pattern',
        label: t('work-schedule:monthlyRosters.filters.workPatternId'),
        value: filterOptionLabels.workPattern ?? t('work-schedule:filterChips.selectedWorkPattern'),
        onClear: () => patchQuery({ workPatternId: undefined }),
      });
    }

    if (listQuery.holidayCalendarId) {
      items.push({
        id: 'holiday-calendar',
        label: t('work-schedule:monthlyRosters.filters.holidayCalendarId'),
        value:
          filterOptionLabels.holidayCalendar ??
          t('work-schedule:filterChips.selectedHolidayCalendar'),
        onClear: () => patchQuery({ holidayCalendarId: undefined }),
      });
    }

    if (listQuery.scope) {
      items.push({
        id: 'scope',
        label: t('work-schedule:monthlyRosters.filters.scope'),
        value: t(`work-schedule:monthlyRosters.scopes.${listQuery.scope}`),
        onClear: () => patchQuery({ scope: undefined }),
      });
    }

    return items;
  }, [
    filterOptionLabels.department,
    filterOptionLabels.holidayCalendar,
    filterOptionLabels.workPattern,
    listQuery.departmentOrgUnitId,
    listQuery.holidayCalendarId,
    listQuery.rosterMonth,
    listQuery.scope,
    listQuery.search,
    listQuery.status,
    listQuery.workPatternId,
    patchQuery,
    t,
  ]);

  return (
    <ModuleListScreenShell
      mode="flat-list"
      banner={<WorkScheduleSubnavigation active="monthly-rosters" />}
      filterBar={
        <FilterToolbar
          searchSlot={
            <SearchBoxSeam
              value={listQuery.search ?? ''}
              placeholder={t('work-schedule:monthlyRosters.filters.searchPlaceholder')}
              onApply={(value) => patchQuery({ search: value || undefined })}
            />
          }
          moreFiltersTrigger={
            <button
              type="button"
              aria-expanded={isMoreFiltersOpen}
              aria-controls="monthly-roster-more-filters"
              onClick={() => setIsMoreFiltersOpen((current) => !current)}
              className="rounded border border-border bg-panel px-3 py-1.5 text-sm font-medium"
            >
              {t('common:filters.moreFilters')}
              {moreFilterCount > 0 ? ` (${moreFilterCount})` : ''}
            </button>
          }
          moreFiltersPanel={
            <MoreFiltersPanel
              id="monthly-roster-more-filters"
              title={t('common:filters.moreFilters')}
              closeLabel={t('common:actions.close')}
              isOpen={isMoreFiltersOpen}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
              <ReferenceFilterField
                label={t('work-schedule:monthlyRosters.filters.departmentOrgUnitId')}
                pickerId="monthly-roster-filter-department"
                value={listQuery.departmentOrgUnitId}
                loadOptions={loadDepartmentFilterOptions}
                onChange={(value) => patchQuery({ departmentOrgUnitId: value })}
                placeholder={t('work-schedule:monthlyRosters.pickers.departmentSearch')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[240px]"
                onSelectedOptionChange={(option) => rememberFilterOption('department', option)}
              />
              <ReferenceFilterField
                label={t('work-schedule:monthlyRosters.filters.workPatternId')}
                pickerId="monthly-roster-filter-work-pattern"
                value={listQuery.workPatternId}
                loadOptions={loadWorkPatternFilterOptions}
                onChange={(value) => patchQuery({ workPatternId: value })}
                placeholder={t('work-schedule:monthlyRosters.pickers.workPatternSearch')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[240px]"
                onSelectedOptionChange={(option) => rememberFilterOption('workPattern', option)}
              />
              <ReferenceFilterField
                label={t('work-schedule:monthlyRosters.filters.holidayCalendarId')}
                pickerId="monthly-roster-filter-holiday-calendar"
                value={listQuery.holidayCalendarId}
                loadOptions={loadHolidayCalendarFilterOptions}
                onChange={(value) => patchQuery({ holidayCalendarId: value })}
                placeholder={t('work-schedule:monthlyRosters.pickers.holidayCalendarSearch')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[240px]"
                onSelectedOptionChange={(option) => rememberFilterOption('holidayCalendar', option)}
              />
              <label className="flex min-w-[160px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:monthlyRosters.filters.scope')}
                </span>
                <select
                  value={listQuery.scope ?? ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) => patchQuery({ scope: event.target.value || undefined })}
                >
                  {scopeOptions.map((scope) => (
                    <option key={scope || 'default'} value={scope}>
                      {scope
                        ? t(`work-schedule:monthlyRosters.scopes.${scope}`)
                        : t('work-schedule:monthlyRosters.filters.defaultScopes')}
                    </option>
                  ))}
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
              onClearAll={appliedFilterChips.length > 0 ? clearMonthlyRosterFilters : undefined}
            />
          }
        >
          <label className="flex min-w-[160px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:monthlyRosters.filters.status')}
            </span>
            <select
              value={listQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              {statusOptions.map((status) => (
                <option key={status || 'default'} value={status}>
                  {status
                    ? t(`work-schedule:monthlyRosters.statuses.${status}`)
                    : t('work-schedule:monthlyRosters.filters.defaultStatuses')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[150px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:monthlyRosters.filters.rosterMonth')}
            </span>
            <input
              type="month"
              value={listQuery.rosterMonth ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ rosterMonth: event.target.value || undefined })}
            />
          </label>
        </FilterToolbar>
      }
      interactionSection={
        isCreateOpen ? (
          <MonthlyRosterCreateSurface
            isPending={createMutation.isPending}
            onCancel={() => setIsCreateOpen(false)}
            onSubmit={async (payload) => {
              try {
                const record = await createMutation.mutateAsync({ payload });
                notifySuccess('work-schedule:monthlyRosters.feedback.created');
                setIsCreateOpen(false);
                navigate(APP_PATHS.monthlyRosterDetail(record.monthlyRosterId));
              } catch (error) {
                notifyError(error as NormalizedApiError);
              }
            }}
          />
        ) : null
      }
      tableSection={
        <AdminTableShell
          data={listQueryResult.data?.data ?? []}
          columns={columns}
          isLoading={listQueryResult.isFetching && !listQueryResult.data}
          emptyTitle={t('work-schedule:monthlyRosters.states.emptyTitle')}
          emptyMessage={t('work-schedule:monthlyRosters.states.emptyMessage')}
          caption={t('work-schedule:monthlyRosters.table.caption')}
        />
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
          title={t('work-schedule:monthlyRosters.states.loadErrorTitle')}
          message={readErrorMessage(
            t,
            listError,
            'work-schedule:monthlyRosters.states.loadErrorMessage',
          )}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
