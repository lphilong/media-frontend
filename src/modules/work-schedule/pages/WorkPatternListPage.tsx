import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { WorkPatternCreateSurface } from '@modules/work-schedule/forms/work-pattern-mutation-forms';
import {
  useCreateWorkPatternMutation,
  useWorkPatternLifecycleMutation,
  useWorkPatternList,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { createWorkPatternListColumns } from '@modules/work-schedule/tables/work-pattern-columns';
import type { WorkPatternLifecycleAction } from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
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
  moveNextCursor,
  movePreviousCursor,
  parseScreenQueryParams,
  serializeScreenQueryParams,
  workPatternListQueryConfig,
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

const readLifecycleConfirmKey = (action: WorkPatternLifecycleAction): string =>
  action === 'activate'
    ? 'work-schedule:patterns.confirm.activate'
    : 'work-schedule:patterns.confirm.archive';

export const WorkPatternListPage = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const listQuery = useMemo(
    () => parseScreenQueryParams(searchParams, workPatternListQueryConfig),
    [searchParams],
  );
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(
    () => serializeScreenQueryParams(listQuery, workPatternListQueryConfig).toString(),
    [listQuery],
  );

  useEffect(() => {
    if (canonicalSearch === currentSearch) {
      return;
    }

    setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | undefined>, options?: RoutePatchOptions) => {
      const next = mergeScreenQueryParams(searchParams, patch, workPatternListQueryConfig, {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      });
      setSearchParams(next, { replace: options?.replace });
    },
    [searchParams, setSearchParams],
  );

  const listQueryResult = useWorkPatternList(listQuery);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const createMutation = useCreateWorkPatternMutation();
  const lifecycleMutation = useWorkPatternLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const canCreateWorkPattern = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.WORK_SCHEDULE_CREATE,
    scope: { module: 'workSchedule', value: 'global' },
  });
  const canManageWorkPatternLifecycle = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.WORK_SCHEDULE_MANAGE_LIFECYCLE,
    scope: { module: 'workSchedule', value: 'global' },
  });

  usePageActions(
    canCreateWorkPattern ? (
      <button
        type="button"
        onClick={() => setIsCreateOpen((current) => !current)}
        data-action-priority="primary"
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {isCreateOpen
          ? t('work-schedule:patterns.actions.closeCreate')
          : t('work-schedule:patterns.actions.create')}
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
        workPatternListQueryConfig,
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
    async (workPatternId: string, action: WorkPatternLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({ workPatternId, action });
        notifySuccess('work-schedule:patterns.feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createWorkPatternListColumns(t, {
        onOpenDetail: (workPatternId) => navigate(APP_PATHS.workPatternDetail(workPatternId)),
        onLifecycleAction,
        canShowLifecycleAction: () => canManageWorkPatternLifecycle,
        isActionPending: (workPatternId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.workPatternId === workPatternId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      canManageWorkPatternLifecycle,
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

  return (
    <ModuleListScreenShell
      mode="flat-list"
      banner={<WorkScheduleSubnavigation active="work-patterns" />}
      filterBar={
        <FilterBarShell
          searchSlot={
            <SearchBoxSeam
              value={listQuery.search ?? ''}
              placeholder={t('work-schedule:patterns.filters.searchPlaceholder')}
              onApply={(value) => patchQuery({ search: value || undefined })}
            />
          }
        >
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:patterns.filters.status')}
            </span>
            <select
              value={listQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  status: event.target.value || undefined,
                })
              }
            >
              {statusOptions.map((status) => (
                <option key={status || 'default'} value={status}>
                  {status
                    ? t(`work-schedule:patterns.statuses.${status}`)
                    : t('work-schedule:patterns.filters.defaultStatuses')}
                </option>
              ))}
            </select>
          </label>
        </FilterBarShell>
      }
      interactionSection={
        canCreateWorkPattern && isCreateOpen ? (
          <WorkPatternCreateSurface
            isPending={createMutation.isPending}
            onCancel={() => setIsCreateOpen(false)}
            onSubmit={async (payload) => {
              try {
                const record = await createMutation.mutateAsync({ payload });
                notifySuccess('work-schedule:patterns.feedback.created');
                setIsCreateOpen(false);
                navigate(APP_PATHS.workPatternDetail(record.workPatternId));
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
          emptyTitle={t('work-schedule:patterns.states.emptyTitle')}
          emptyMessage={t('work-schedule:patterns.states.emptyMessage')}
          caption={t('work-schedule:patterns.table.caption')}
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
          title={t('work-schedule:patterns.states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'work-schedule:patterns.states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
