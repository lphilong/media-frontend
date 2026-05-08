import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { EventCreateSurface } from '@modules/event-assignment/forms/event-assignment-mutation-forms';
import {
  useCreateEventMutation,
  useEventFlatList,
  useEventLifecycleMutation,
  useEventsByAssignment,
  useEventsByPlatform,
  useEventsByResource,
} from '@modules/event-assignment/hooks/use-event-assignment';
import { createEventListColumns } from '@modules/event-assignment/tables/event-assignment-columns';
import type {
  EventAssignmentKind,
  EventLifecycleAction,
} from '@modules/event-assignment/types/event-assignment.types';
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
  eventByAssignmentQueryConfig,
  eventByPlatformQueryConfig,
  eventByResourceQueryConfig,
  eventFlatListQueryConfig,
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

const sortOptions = [
  { value: 'eventStartAt', labelKey: 'event-assignment:sort.eventStartAt' },
  { value: 'eventCode', labelKey: 'event-assignment:sort.eventCode' },
  { value: 'createdAt', labelKey: 'event-assignment:sort.createdAt' },
] as const;

const statusOptions = [
  '',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
] as const;
const assignmentKindOptions = ['', 'EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP'] as const;

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

const readLifecycleConfirmKey = (action: EventLifecycleAction): string => {
  switch (action) {
    case 'start':
      return 'event-assignment:confirm.start';
    case 'complete':
      return 'event-assignment:confirm.complete';
    case 'cancel':
      return 'event-assignment:confirm.cancel';
    case 'archive':
      return 'event-assignment:confirm.archive';
    default:
      return 'event-assignment:confirm.archive';
  }
};

export const EventAssignmentListPage = (): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common', 'errors']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const flatListQuery = useMemo(
    () => parseScreenQueryParams(searchParams, eventFlatListQueryConfig),
    [searchParams],
  );
  const byAssignmentQuery = useMemo(
    () => parseScreenQueryParams(searchParams, eventByAssignmentQueryConfig),
    [searchParams],
  );
  const byResourceQuery = useMemo(
    () => parseScreenQueryParams(searchParams, eventByResourceQueryConfig),
    [searchParams],
  );
  const byPlatformQuery = useMemo(
    () => parseScreenQueryParams(searchParams, eventByPlatformQueryConfig),
    [searchParams],
  );

  const routeMode =
    byAssignmentQuery.view === 'by-assignment'
      ? 'by-assignment'
      : byResourceQuery.view === 'by-resource'
        ? 'by-resource'
        : byPlatformQuery.view === 'by-platform'
          ? 'by-platform'
          : 'flat';
  const activeQuery =
    routeMode === 'by-assignment'
      ? byAssignmentQuery
      : routeMode === 'by-resource'
        ? byResourceQuery
        : routeMode === 'by-platform'
          ? byPlatformQuery
          : flatListQuery;
  const currentSearch = searchParams.toString();
  const canonicalSearch = useMemo(() => {
    if (routeMode === 'by-assignment') {
      return serializeScreenQueryParams(byAssignmentQuery, eventByAssignmentQueryConfig).toString();
    }

    if (routeMode === 'by-resource') {
      return serializeScreenQueryParams(byResourceQuery, eventByResourceQueryConfig).toString();
    }

    if (routeMode === 'by-platform') {
      return serializeScreenQueryParams(byPlatformQuery, eventByPlatformQueryConfig).toString();
    }

    return serializeScreenQueryParams(flatListQuery, eventFlatListQueryConfig).toString();
  }, [byAssignmentQuery, byPlatformQuery, byResourceQuery, flatListQuery, routeMode]);

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
        routeMode === 'by-assignment'
          ? mergeScreenQueryParams(searchParams, patch, eventByAssignmentQueryConfig, mergeOptions)
          : routeMode === 'by-resource'
            ? mergeScreenQueryParams(searchParams, patch, eventByResourceQueryConfig, mergeOptions)
            : routeMode === 'by-platform'
              ? mergeScreenQueryParams(
                  searchParams,
                  patch,
                  eventByPlatformQueryConfig,
                  mergeOptions,
                )
              : mergeScreenQueryParams(searchParams, patch, eventFlatListQueryConfig, mergeOptions);
      setSearchParams(next, { replace: options?.replace });
    },
    [routeMode, searchParams, setSearchParams],
  );

  const flatQueryResult = useEventFlatList(flatListQuery, { enabled: routeMode === 'flat' });
  const byAssignmentQueryResult = useEventsByAssignment(byAssignmentQuery, {
    enabled: routeMode === 'by-assignment',
  });
  const byResourceQueryResult = useEventsByResource(byResourceQuery, {
    enabled: routeMode === 'by-resource',
  });
  const byPlatformQueryResult = useEventsByPlatform(byPlatformQuery, {
    enabled: routeMode === 'by-platform',
  });
  const listQueryResult =
    routeMode === 'by-assignment'
      ? byAssignmentQueryResult
      : routeMode === 'by-resource'
        ? byResourceQueryResult
        : routeMode === 'by-platform'
          ? byPlatformQueryResult
          : flatQueryResult;

  const createMutation = useCreateEventMutation();
  const lifecycleMutation = useEventLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setCursorStack] = useState(createCursorStack);

  const queryShapeSignature = useMemo(() => {
    if (routeMode === 'by-assignment') {
      return serializeScreenQueryParams(
        {
          ...byAssignmentQuery,
          cursor: undefined,
        },
        eventByAssignmentQueryConfig,
      ).toString();
    }

    if (routeMode === 'by-resource') {
      return serializeScreenQueryParams(
        {
          ...byResourceQuery,
          cursor: undefined,
        },
        eventByResourceQueryConfig,
      ).toString();
    }

    if (routeMode === 'by-platform') {
      return serializeScreenQueryParams(
        {
          ...byPlatformQuery,
          cursor: undefined,
        },
        eventByPlatformQueryConfig,
      ).toString();
    }

    return serializeScreenQueryParams(
      {
        ...flatListQuery,
        cursor: undefined,
      },
      eventFlatListQueryConfig,
    ).toString();
  }, [byAssignmentQuery, byPlatformQuery, byResourceQuery, flatListQuery, routeMode]);
  const previousShapeSignatureRef = useRef(queryShapeSignature);

  useEffect(() => {
    if (previousShapeSignatureRef.current === queryShapeSignature) {
      return;
    }
    previousShapeSignatureRef.current = queryShapeSignature;
    setCursorStack(createCursorStack());
  }, [queryShapeSignature]);

  usePageActions(
    <button
      type="button"
      onClick={() => setIsCreateOpen((current) => !current)}
      className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
    >
      {isCreateOpen
        ? t('event-assignment:actions.closeCreate')
        : t('event-assignment:actions.create')}
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
    async (eventId: string, action: EventLifecycleAction) => {
      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          eventId,
          action,
        });
        notifySuccess('event-assignment:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const columns = useMemo(
    () =>
      createEventListColumns(t, {
        onOpenDetail: (eventId) => navigate(APP_PATHS.eventDetail(eventId)),
        onLifecycleAction,
        isActionPending: (eventId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.eventId === eventId &&
          lifecycleMutation.variables?.action === action,
      }),
    [lifecycleMutation.isPending, lifecycleMutation.variables, navigate, onLifecycleAction, t],
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
      mode={routeMode === 'flat' ? 'flat-list' : 'related-list'}
      banner={
        <div className="space-y-2">
          {routeMode !== 'flat' ? (
            <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-text">
              {t(`event-assignment:relatedModes.${routeMode}`)}
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
                placeholder={t('event-assignment:filters.searchPlaceholder')}
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
              {t('event-assignment:filters.status')}
            </span>
            <select
              value={activeQuery.status ?? ''}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              onChange={(event) => patchQuery({ status: event.target.value || undefined })}
            >
              {statusOptions.map((status) => (
                <option key={status || 'all'} value={status}>
                  {status
                    ? t(`event-assignment:statuses.${status}`)
                    : t('event-assignment:filters.allStatuses')}
                </option>
              ))}
            </select>
          </label>
          {routeMode === 'flat' || routeMode === 'by-assignment' ? (
            <>
              <label className="flex min-w-[210px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('event-assignment:filters.assignmentKind')}
                </span>
                <select
                  value={'assignmentKind' in activeQuery ? (activeQuery.assignmentKind ?? '') : ''}
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    patchQuery({
                      assignmentKind: event.target.value || undefined,
                      assignmentEmploymentProfileId: undefined,
                      assignmentTalentId: undefined,
                      assignmentTalentGroupId: undefined,
                    })
                  }
                >
                  {assignmentKindOptions.map((kind) => (
                    <option key={kind || 'all'} value={kind}>
                      {kind
                        ? t(`event-assignment:assignmentKinds.${kind}`)
                        : t('event-assignment:filters.allAssignmentKinds')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[220px] flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('event-assignment:filters.assignmentId')}
                </span>
                <input
                  value={
                    'assignmentEmploymentProfileId' in activeQuery
                      ? (activeQuery.assignmentEmploymentProfileId ??
                        activeQuery.assignmentTalentId ??
                        activeQuery.assignmentTalentGroupId ??
                        '')
                      : ''
                  }
                  className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                  placeholder={t('event-assignment:filters.assignmentIdPlaceholder')}
                  onChange={(event) => {
                    const value = event.target.value || undefined;
                    const assignmentKind =
                      'assignmentKind' in activeQuery
                        ? (activeQuery.assignmentKind as EventAssignmentKind | undefined)
                        : undefined;
                    patchQuery({
                      assignmentEmploymentProfileId:
                        assignmentKind === 'EMPLOYMENT_PROFILE' ? value : undefined,
                      assignmentTalentId: assignmentKind === 'TALENT' ? value : undefined,
                      assignmentTalentGroupId:
                        assignmentKind === 'TALENT_GROUP' ? value : undefined,
                    });
                  }}
                />
              </label>
            </>
          ) : null}
          <label className="flex min-w-[220px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('event-assignment:filters.studioResourceId')}
            </span>
            <input
              value={
                routeMode === 'by-resource'
                  ? (byResourceQuery.studioResourceId ?? '')
                  : (flatListQuery.containsStudioResourceId ?? '')
              }
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('event-assignment:filters.studioResourceIdPlaceholder')}
              onChange={(event) =>
                patchQuery(
                  routeMode === 'by-resource'
                    ? { studioResourceId: event.target.value || undefined }
                    : { containsStudioResourceId: event.target.value || undefined },
                )
              }
            />
          </label>
          <label className="flex min-w-[220px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('event-assignment:filters.platformAccountId')}
            </span>
            <input
              value={
                routeMode === 'by-platform'
                  ? (byPlatformQuery.platformAccountId ?? '')
                  : (flatListQuery.containsPlatformAccountId ?? '')
              }
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              placeholder={t('event-assignment:filters.platformAccountIdPlaceholder')}
              onChange={(event) =>
                patchQuery(
                  routeMode === 'by-platform'
                    ? { platformAccountId: event.target.value || undefined }
                    : { containsPlatformAccountId: event.target.value || undefined },
                )
              }
            />
          </label>
          <label className="flex min-w-[170px] flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('event-assignment:filters.windowStartAt')}
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
              {t('event-assignment:filters.windowEndAt')}
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
            <EventCreateSurface
              isPending={createMutation.isPending}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={async (payload) => {
                try {
                  await createMutation.mutateAsync(payload);
                  notifySuccess('event-assignment:feedback.created');
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
            emptyTitle={t('event-assignment:states.emptyTitle')}
            emptyMessage={t('event-assignment:states.emptyMessage')}
            caption={t('event-assignment:table.caption')}
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
          title={t('event-assignment:states.loadErrorTitle')}
          message={readErrorMessage(t, listError, 'event-assignment:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQueryResult.refetch()}
        />
      }
    />
  );
};
