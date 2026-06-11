import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { HolidayCalendarCreateSurface } from '@modules/work-schedule/forms/holiday-calendar-mutation-forms';
import {
  useCreateHolidayCalendarMutation,
  useHolidayCalendarLifecycleMutation,
  useHolidayCalendarList,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { createHolidayCalendarListColumns } from '@modules/work-schedule/tables/holiday-calendar-columns';
import type { HolidayCalendarLifecycleAction } from '@modules/work-schedule/types/work-schedule.types';
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
  useModalHost,
  PermissionDeniedState,
  SearchBoxSeam,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { ModuleListScreenShell } from '@shared/modules';
import {
  createCursorStack,
  holidayCalendarListQueryConfig,
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

const statusOptions = ['', 'DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

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

const readLifecycleConfirmKey = (action: HolidayCalendarLifecycleAction): string =>
  action === 'activate'
    ? 'work-schedule:holidayCalendars.confirm.activate'
    : 'work-schedule:holidayCalendars.confirm.archive';

export const HolidayCalendarListPage = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const listQuery = useMemo(
    () => parseScreenQueryParams(searchParams, holidayCalendarListQueryConfig),
    [searchParams],
  );
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(
    () => serializeScreenQueryParams(listQuery, holidayCalendarListQueryConfig).toString(),
    [listQuery],
  );

  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
    }
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | undefined>, options?: RoutePatchOptions) => {
      const next = mergeScreenQueryParams(searchParams, patch, holidayCalendarListQueryConfig, {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      });
      setSearchParams(next, { replace: options?.replace });
    },
    [searchParams, setSearchParams],
  );

  const listQueryResult = useHolidayCalendarList(listQuery);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const createMutation = useCreateHolidayCalendarMutation();
  const lifecycleMutation = useHolidayCalendarLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const { close: closeModal, openDrawer } = useModalHost();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const canCreateHolidayCalendar = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.WORK_SCHEDULE_CREATE,
    scope: { module: 'workSchedule', value: 'global' },
  });
  const canManageHolidayCalendarLifecycle = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.WORK_SCHEDULE_MANAGE_LIFECYCLE,
    scope: { module: 'workSchedule', value: 'global' },
  });

  const onCreateSubmit = useCallback(
    async (payload: Parameters<typeof createMutation.mutateAsync>[0]['payload']) => {
      try {
        const record = await createMutation.mutateAsync({ payload });
        notifySuccess('work-schedule:holidayCalendars.feedback.created');
        setIsCreateOpen(false);
        navigate(APP_PATHS.holidayCalendarDetail(record.holidayCalendarId));
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [createMutation, navigate, notifyError, notifySuccess],
  );

  useEffect(() => {
    if (!isCreateOpen || !canCreateHolidayCalendar) {
      closeModal();
      return;
    }

    openDrawer({
      title: t('work-schedule:holidayCalendars.mutations.create.title'),
      content: (
        <HolidayCalendarCreateSurface
          presentation="drawer"
          isPending={createMutation.isPending}
          onCancel={() => setIsCreateOpen(false)}
          onSubmit={onCreateSubmit}
        />
      ),
    });
  }, [
    canCreateHolidayCalendar,
    closeModal,
    createMutation.isPending,
    isCreateOpen,
    onCreateSubmit,
    openDrawer,
    t,
  ]);

  useEffect(
    () => () => {
      closeModal();
    },
    [closeModal],
  );

  usePageActions(
    canCreateHolidayCalendar ? (
      <button
        type="button"
        onClick={() => setIsCreateOpen((current) => !current)}
        data-action-priority="primary"
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {isCreateOpen
          ? t('work-schedule:holidayCalendars.actions.closeCreate')
          : t('work-schedule:holidayCalendars.actions.create')}
      </button>
    ) : null,
  );

  const queryShapeSignature = useMemo(
    () =>
      serializeScreenQueryParams(
        {
          ...listQuery,
          cursor: undefined,
        },
        holidayCalendarListQueryConfig,
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

  const onLifecycleAction = useCallback(
    async (holidayCalendarId: string, action: HolidayCalendarLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({ holidayCalendarId, action });
        notifySuccess('work-schedule:holidayCalendars.feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createHolidayCalendarListColumns(t, {
        onOpenDetail: (holidayCalendarId) =>
          navigate(APP_PATHS.holidayCalendarDetail(holidayCalendarId)),
        onLifecycleAction,
        canShowLifecycleAction: () => canManageHolidayCalendarLifecycle,
        isActionPending: (holidayCalendarId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.holidayCalendarId === holidayCalendarId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      canManageHolidayCalendarLifecycle,
      lifecycleMutation.isPending,
      lifecycleMutation.variables,
      navigate,
      onLifecycleAction,
      t,
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

  const clearHolidayCalendarFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
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
        label: t('work-schedule:holidayCalendars.filters.status'),
        value: t(`work-schedule:holidayCalendars.statuses.${listQuery.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    return items;
  }, [listQuery.search, listQuery.status, patchQuery, t]);
  const hasActiveFilters = appliedFilterChips.length > 0;

  return (
    <ModuleListScreenShell
      mode="flat-list"
      banner={<WorkScheduleSubnavigation active="holiday-calendars" />}
      filterBar={
        <FilterToolbar
          searchSlot={
            <SearchBoxSeam
              value={listQuery.search ?? ''}
              placeholder={t('work-schedule:holidayCalendars.filters.searchPlaceholder')}
              onApply={(value) => patchQuery({ search: value || undefined })}
            />
          }
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              items={appliedFilterChips}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              emptyLabel={t('common:filters.noFiltersApplied')}
              onClearAll={hasActiveFilters ? clearHolidayCalendarFilters : undefined}
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:holidayCalendars.filters.status')}
            </span>
            <select
              value={listQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              {statusOptions.map((status) => (
                <option key={status || 'default'} value={status}>
                  {status
                    ? t(`work-schedule:holidayCalendars.statuses.${status}`)
                    : t('work-schedule:holidayCalendars.filters.defaultStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterToolbar>
      }
      tableSection={
        <AdminTableShell
          data={listQueryResult.data?.data ?? []}
          columns={columns}
          isLoading={listQueryResult.isFetching && !listQueryResult.data}
          emptyTitle={t('work-schedule:holidayCalendars.states.emptyTitle')}
          emptyMessage={t('work-schedule:holidayCalendars.states.emptyMessage')}
          caption={t('work-schedule:holidayCalendars.table.caption')}
        />
      }
      pager={
        <CursorPager
          canGoBack={canGoBack}
          canGoNext={canGoNext}
          displayedCount={listQueryResult.data?.data.length}
          limit={listQuery.limit ?? 20}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      }
      state={shellState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      errorState={
        <ErrorState
          title={t('work-schedule:holidayCalendars.states.loadErrorTitle')}
          message={readErrorMessage(
            t,
            listError,
            'work-schedule:holidayCalendars.states.loadErrorMessage',
          )}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
