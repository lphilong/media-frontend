import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { WorkShiftGuidedWorkflow } from '@modules/work-schedule/components/WorkShiftGuidedWorkflow';
import {
  useCreateWorkShiftMutation,
  useWorkShiftFlatList,
  useWorkShiftLifecycleMutation,
  useWorkShiftsByResource,
  useWorkShiftsBySubject,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { createWorkShiftListColumns } from '@modules/work-schedule/tables/work-schedule-columns';
import type {
  WorkScheduleScope,
  WorkShiftLifecycleAction,
} from '@modules/work-schedule/types/work-schedule.types';
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
import { ModuleListScreenShell } from '@shared/modules';
import {
  createCursorStack,
  mergeScreenQueryParams,
  moveNextCursor,
  movePreviousCursor,
  parseScreenQueryParams,
  serializeScreenQueryParams,
  workShiftByResourceQueryConfig,
  workShiftBySubjectQueryConfig,
  workShiftFlatListQueryConfig,
} from '@shared/query';

type RoutePatchOptions = {
  replace?: boolean;
  resetCursorOnChange?: boolean;
};

const sortOptions = [
  { value: 'shiftStartAt', labelKey: 'work-schedule:sort.shiftStartAt' },
  { value: 'shiftCode', labelKey: 'work-schedule:sort.shiftCode' },
  { value: 'createdAt', labelKey: 'work-schedule:sort.createdAt' },
] as const;

const statusOptions = ['', 'ACTIVE', 'CANCELLED', 'ARCHIVED'] as const;
const subjectKindOptions = ['', 'EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP'] as const;
const scopeOptions = ['', 'self', 'team', 'department', 'global'] as const;

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

const readLifecycleConfirmKey = (action: WorkShiftLifecycleAction): string => {
  return action === 'cancel' ? 'work-schedule:confirm.cancel' : 'work-schedule:confirm.archive';
};

export const WorkScheduleListPage = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, workShiftFlatListQueryConfig),
    [searchParams],
  );
  const bySubjectQuery = useMemo(
    () => parseScreenQueryParams(searchParams, workShiftBySubjectQueryConfig),
    [searchParams],
  );
  const byResourceQuery = useMemo(
    () => parseScreenQueryParams(searchParams, workShiftByResourceQueryConfig),
    [searchParams],
  );

  const routeMode =
    bySubjectQuery.view === 'by-subject'
      ? 'by-subject'
      : byResourceQuery.view === 'by-resource'
        ? 'by-resource'
        : 'flat';

  const activeQuery =
    routeMode === 'by-subject'
      ? bySubjectQuery
      : routeMode === 'by-resource'
        ? byResourceQuery
        : flatListQuery;
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(() => {
    if (routeMode === 'by-subject') {
      return serializeScreenQueryParams(bySubjectQuery, workShiftBySubjectQueryConfig).toString();
    }

    if (routeMode === 'by-resource') {
      return serializeScreenQueryParams(byResourceQuery, workShiftByResourceQueryConfig).toString();
    }

    return serializeScreenQueryParams(flatListQuery, workShiftFlatListQueryConfig).toString();
  }, [byResourceQuery, bySubjectQuery, flatListQuery, routeMode]);

  useEffect(() => {
    if (canonicalSearch === currentSearch) {
      return;
    }

    setSearchParams(new URLSearchParams(canonicalSearch), { replace: true });
  }, [canonicalSearch, currentSearch, setSearchParams]);

  const patchQuery = useCallback(
    (patch: Record<string, string | number | undefined>, options?: RoutePatchOptions) => {
      const mergeOptions = {
        resetCursorOnChange: options?.resetCursorOnChange ?? true,
      };
      const next =
        routeMode === 'by-subject'
          ? mergeScreenQueryParams(searchParams, patch, workShiftBySubjectQueryConfig, mergeOptions)
          : routeMode === 'by-resource'
            ? mergeScreenQueryParams(
                searchParams,
                patch,
                workShiftByResourceQueryConfig,
                mergeOptions,
              )
            : mergeScreenQueryParams(
                searchParams,
                patch,
                workShiftFlatListQueryConfig,
                mergeOptions,
              );
      setSearchParams(next, { replace: options?.replace });
    },
    [routeMode, searchParams, setSearchParams],
  );

  const flatQueryResult = useWorkShiftFlatList(flatListQuery, {
    enabled: routeMode === 'flat',
  });
  const bySubjectQueryResult = useWorkShiftsBySubject(bySubjectQuery, {
    enabled: routeMode === 'by-subject',
  });
  const byResourceQueryResult = useWorkShiftsByResource(byResourceQuery, {
    enabled: routeMode === 'by-resource',
  });
  const listQueryResult =
    routeMode === 'by-subject'
      ? bySubjectQueryResult
      : routeMode === 'by-resource'
        ? byResourceQueryResult
        : flatQueryResult;

  const createMutation = useCreateWorkShiftMutation();
  const lifecycleMutation = useWorkShiftLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isGuidedWorkflowOpen, setIsGuidedWorkflowOpen] = useState(false);
  const [guidedWorkflowError, setGuidedWorkflowError] = useState<NormalizedApiError | null>(null);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    if (routeMode === 'by-subject') {
      return serializeScreenQueryParams(
        {
          ...bySubjectQuery,
          cursor: undefined,
        },
        workShiftBySubjectQueryConfig,
      ).toString();
    }

    if (routeMode === 'by-resource') {
      return serializeScreenQueryParams(
        {
          ...byResourceQuery,
          cursor: undefined,
        },
        workShiftByResourceQueryConfig,
      ).toString();
    }

    return serializeScreenQueryParams(
      {
        ...flatListQuery,
        cursor: undefined,
      },
      workShiftFlatListQueryConfig,
    ).toString();
  }, [byResourceQuery, bySubjectQuery, flatListQuery, routeMode]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }

    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  usePageActions(
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => {
          setIsGuidedWorkflowOpen((current) => !current);
          setGuidedWorkflowError(null);
        }}
        data-action-priority="primary"
        className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        {isGuidedWorkflowOpen
          ? t('work-schedule:actions.closeGuidedWorkflow')
          : t('work-schedule:actions.scheduleWorkShift')}
      </button>
    </div>,
  );

  const nextCursor = listQueryResult.data?.meta?.nextCursor;
  const canGoNext = Boolean(nextCursor);
  const canGoBack = Boolean(activeQuery.cursor);

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

  const onGuidedWorkflowSubmit = async (
    payload: Parameters<typeof createMutation.mutateAsync>[0]['payload'],
    scope: WorkScheduleScope,
  ) => {
    setGuidedWorkflowError(null);

    try {
      await createMutation.mutateAsync({
        payload,
        scope,
      });
      notifySuccess('work-schedule:feedback.created');
      setIsGuidedWorkflowOpen(false);
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setGuidedWorkflowError(normalizedError);
      notifyError(normalizedError);
    }
  };

  const onLifecycleAction = useCallback(
    async (workShiftId: string, action: WorkShiftLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });

      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          workShiftId,
          action,
          scope: activeQuery.scope,
        });
        notifySuccess('work-schedule:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [
      activeQuery.scope,
      lifecycleMutation,
      notifyError,
      notifySuccess,
      requestDestructiveConfirm,
      t,
    ],
  );

  const columns = useMemo(
    () =>
      createWorkShiftListColumns(t, {
        onOpenDetail: (workShiftId) => {
          const detailSearch = activeQuery.scope ? `?scope=${activeQuery.scope}` : '';
          navigate(`${APP_PATHS.workShiftDetail(workShiftId)}${detailSearch}`);
        },
        onLifecycleAction,
        isActionPending: (workShiftId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.workShiftId === workShiftId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      activeQuery.scope,
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

  const visibleScopeOptions =
    'subjectKind' in activeQuery &&
    (activeQuery.subjectKind === 'TALENT' || activeQuery.subjectKind === 'TALENT_GROUP')
      ? ['', 'global']
      : scopeOptions;

  return (
    <ModuleListScreenShell
      mode={routeMode === 'flat' ? 'flat-list' : 'related-list'}
      banner={
        <div className="space-y-3">
          <WorkScheduleSubnavigation active="work-shifts" />
          {routeMode !== 'flat' ? (
            <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-text">
              {t(`work-schedule:relatedModes.${routeMode}`)}
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
                placeholder={t('work-schedule:filters.searchPlaceholder')}
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
              {t('work-schedule:filters.status')}
            </span>
            <select
              value={activeQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  status: event.target.value || undefined,
                })
              }
            >
              {statusOptions.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status
                    ? t(`work-schedule:statuses.${status}`)
                    : t('work-schedule:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
          {routeMode !== 'by-resource' ? (
            <>
              <label className="flex min-w-[210px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:filters.subjectKind')}
                </span>
                <select
                  value={'subjectKind' in activeQuery ? (activeQuery.subjectKind ?? '') : ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      subjectKind: event.target.value || undefined,
                      subjectEmploymentProfileId: undefined,
                      subjectTalentId: undefined,
                      subjectTalentGroupId: undefined,
                    })
                  }
                >
                  {subjectKindOptions.map((kind) => (
                    <option key={kind || 'all'} value={kind}>
                      {kind
                        ? t(`work-schedule:subjectKinds.${kind}`)
                        : t('work-schedule:filters.allSubjectKinds')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[220px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:filters.subjectId')}
                </span>
                <input
                  value={
                    'subjectEmploymentProfileId' in activeQuery
                      ? (activeQuery.subjectEmploymentProfileId ??
                        activeQuery.subjectTalentId ??
                        activeQuery.subjectTalentGroupId ??
                        '')
                      : ''
                  }
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  placeholder={t('work-schedule:filters.subjectIdPlaceholder')}
                  onChange={(event) => {
                    const value = event.target.value || undefined;
                    const subjectKind =
                      'subjectKind' in activeQuery ? activeQuery.subjectKind : undefined;
                    patchQuery({
                      subjectEmploymentProfileId:
                        subjectKind === 'EMPLOYMENT_PROFILE' ? value : undefined,
                      subjectTalentId: subjectKind === 'TALENT' ? value : undefined,
                      subjectTalentGroupId: subjectKind === 'TALENT_GROUP' ? value : undefined,
                    });
                  }}
                />
              </label>
            </>
          ) : null}
          <label className="flex min-w-[220px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:filters.studioResourceId')}
            </span>
            <input
              value={
                routeMode === 'by-resource'
                  ? (byResourceQuery.studioResourceId ?? '')
                  : (flatListQuery.containsStudioResourceId ?? '')
              }
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('work-schedule:filters.studioResourceIdPlaceholder')}
              onChange={(event) =>
                patchQuery(
                  routeMode === 'by-resource'
                    ? { studioResourceId: event.target.value || undefined }
                    : { containsStudioResourceId: event.target.value || undefined },
                )
              }
            />
          </label>
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:filters.scope')}
            </span>
            <select
              value={activeQuery.scope ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) =>
                patchQuery({
                  scope: (event.target.value || undefined) as WorkScheduleScope | undefined,
                })
              }
            >
              {visibleScopeOptions.map((scope) => (
                <option key={scope || 'omitted'} value={scope}>
                  {scope ? t(`work-schedule:scopes.${scope}`) : t('work-schedule:scopes.omitted')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:filters.windowStartAt')}
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
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('work-schedule:filters.windowEndAt')}
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
          {isGuidedWorkflowOpen ? (
            <WorkShiftGuidedWorkflow
              isPending={createMutation.isPending}
              error={guidedWorkflowError}
              onCancel={() => {
                setIsGuidedWorkflowOpen(false);
                setGuidedWorkflowError(null);
              }}
              onSubmit={onGuidedWorkflowSubmit}
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
            emptyTitle={t('work-schedule:states.emptyTitle')}
            emptyMessage={t('work-schedule:states.emptyMessage')}
            caption={t('work-schedule:table.caption')}
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
          title={t('work-schedule:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'work-schedule:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
