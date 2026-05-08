import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { MonthlyRosterCreateSurface } from '@modules/work-schedule/forms/monthly-roster-mutation-forms';
import {
  useArchiveMonthlyRosterMutation,
  useCreateMonthlyRosterDraftMutation,
  useMonthlyRosterList,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { createMonthlyRosterListColumns } from '@modules/work-schedule/tables/monthly-roster-columns';
import type { MonthlyRosterScope } from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import {
  AdminTableShell,
  CursorPager,
  ErrorState,
  FilterBarShell,
  LoadingState,
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

  return (
    <ModuleListScreenShell
      mode="flat-list"
      banner={<WorkScheduleSubnavigation active="monthly-rosters" />}
      filterBar={
        <FilterBarShell
          searchSlot={
            <SearchBoxSeam
              value={listQuery.search ?? ''}
              placeholder={t('work-schedule:monthlyRosters.filters.searchPlaceholder')}
              onApply={(value) => patchQuery({ search: value || undefined })}
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
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:monthlyRosters.filters.departmentOrgUnitId')}
            </span>
            <input
              value={listQuery.departmentOrgUnitId ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({ departmentOrgUnitId: event.target.value || undefined })
              }
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:monthlyRosters.filters.workPatternId')}
            </span>
            <input
              value={listQuery.workPatternId ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ workPatternId: event.target.value || undefined })}
            />
          </label>
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:monthlyRosters.filters.holidayCalendarId')}
            </span>
            <input
              value={listQuery.holidayCalendarId ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({ holidayCalendarId: event.target.value || undefined })
              }
            />
          </label>
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
        </FilterBarShell>
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
