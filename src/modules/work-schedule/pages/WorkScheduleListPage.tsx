import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { usePageActions } from '@app/store/use-page-actions';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { WorkShiftGuidedWorkflow } from '@modules/work-schedule/components/WorkShiftGuidedWorkflow';
import {
  loadWorkShiftStudioResourceFilterOptions,
  loadWorkShiftSubjectFilterOptions,
} from '@modules/work-schedule/components/work-schedule-reference-options';
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
  WorkShiftSubjectKind,
} from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  canUseAnyAction,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type ActionCapabilityRequirement,
} from '@shared/auth/current-actor-capabilities';
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

const padNumber = (value: number, length = 2): string => value.toString().padStart(length, '0');

const formatUtcTimestampInput = (timestamp: number | undefined): string => {
  if (timestamp === undefined || !Number.isFinite(timestamp)) {
    return '';
  }

  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  const base = `${date.getUTCFullYear()}-${padNumber(date.getUTCMonth() + 1)}-${padNumber(
    date.getUTCDate(),
  )}T${padNumber(date.getUTCHours())}:${padNumber(date.getUTCMinutes())}`;
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();

  if (milliseconds > 0) {
    return `${base}:${padNumber(seconds)}.${padNumber(milliseconds, 3)}`;
  }

  if (seconds > 0) {
    return `${base}:${padNumber(seconds)}`;
  }

  return base;
};

const parseUtcTimestampInput = (value: string): number | undefined => {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(`${value}Z`);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const formatUtcTimestampChipValue = (timestamp: number | undefined): string => {
  const inputValue = formatUtcTimestampInput(timestamp);
  return inputValue ? `${inputValue.replace('T', ' ')} UTC` : '';
};

const UtcTimestampFilterField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}): JSX.Element => (
  <label className="flex min-w-[190px] flex-col gap-1">
    <span className="text-xs font-medium uppercase text-muted">{label}</span>
    <input
      type="datetime-local"
      step="0.001"
      value={formatUtcTimestampInput(value)}
      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
      onChange={(event) => onChange(parseUtcTimestampInput(event.target.value))}
    />
  </label>
);

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

  const capabilitiesQuery = useCurrentActorCapabilities();
  const createMutation = useCreateWorkShiftMutation();
  const lifecycleMutation = useWorkShiftLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isGuidedWorkflowOpen, setIsGuidedWorkflowOpen] = useState(false);
  const [guidedWorkflowError, setGuidedWorkflowError] = useState<NormalizedApiError | null>(null);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [filterOptionLabels, setFilterOptionLabels] = useState<Record<string, string>>({});
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

  const workScheduleScopes: readonly WorkScheduleScope[] = ['self', 'team', 'department', 'global'];
  const workScheduleCreateRequirements: readonly ActionCapabilityRequirement[] =
    workScheduleScopes.map((value) => ({
      permission: PERMISSIONS.WORK_SCHEDULE_CREATE,
      scope: { module: 'workSchedule', value },
    }));
  const canCreateWorkShift = canUseAnyAction(
    capabilitiesQuery.data,
    workScheduleCreateRequirements,
  ).allowed;
  const canManageWorkShiftLifecycle = canShowAction(capabilitiesQuery.data, {
    permission: PERMISSIONS.WORK_SCHEDULE_MANAGE_LIFECYCLE,
    scope: { module: 'workSchedule', value: activeQuery.scope ?? 'global' },
  });

  usePageActions(
    canCreateWorkShift ? (
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
      </div>
    ) : null,
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
        canShowLifecycleAction: () => canManageWorkShiftLifecycle,
        isActionPending: (workShiftId, action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.workShiftId === workShiftId &&
          lifecycleMutation.variables?.action === action,
      }),
    [
      activeQuery.scope,
      canManageWorkShiftLifecycle,
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
  const activeSubjectKind = 'subjectKind' in activeQuery ? activeQuery.subjectKind : undefined;
  const activeSubjectId =
    'subjectEmploymentProfileId' in activeQuery
      ? (activeQuery.subjectEmploymentProfileId ??
        activeQuery.subjectTalentId ??
        activeQuery.subjectTalentGroupId)
      : undefined;
  const studioResourceFilterValue =
    routeMode === 'by-resource'
      ? byResourceQuery.studioResourceId
      : flatListQuery.containsStudioResourceId;
  const loadSubjectFilterOptions = useCallback(
    (search: string) =>
      activeSubjectKind
        ? loadWorkShiftSubjectFilterOptions(activeSubjectKind, search, activeSubjectId)
        : Promise.resolve([]),
    [activeSubjectId, activeSubjectKind],
  );
  const loadStudioResourceFilterOptions = useCallback(
    (search: string) => loadWorkShiftStudioResourceFilterOptions(search, studioResourceFilterValue),
    [studioResourceFilterValue],
  );
  const updateSubjectFilter = useCallback(
    (value: string | undefined) => {
      const subjectKind = activeSubjectKind as WorkShiftSubjectKind | undefined;
      patchQuery({
        subjectEmploymentProfileId: subjectKind === 'EMPLOYMENT_PROFILE' ? value : undefined,
        subjectTalentId: subjectKind === 'TALENT' ? value : undefined,
        subjectTalentGroupId: subjectKind === 'TALENT_GROUP' ? value : undefined,
      });
    },
    [activeSubjectKind, patchQuery],
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
  const advancedFilterCount = [
    activeSubjectKind,
    activeSubjectId,
    studioResourceFilterValue,
    activeQuery.scope,
    activeQuery.windowStartAt,
    activeQuery.windowEndAt,
    routeMode === 'flat' ? flatListQuery.sourceType : undefined,
    routeMode === 'flat' ? flatListQuery.sourceRosterId : undefined,
    routeMode === 'flat' ? flatListQuery.sourceDepartmentOrgUnitId : undefined,
    routeMode === 'flat' ? flatListQuery.sourceRosterMonth : undefined,
  ].filter((value) => value !== undefined && value !== '').length;
  const clearWorkShiftFilters = useCallback(() => {
    patchQuery({
      search: undefined,
      status: undefined,
      subjectKind: undefined,
      subjectEmploymentProfileId: undefined,
      subjectTalentId: undefined,
      subjectTalentGroupId: undefined,
      containsStudioResourceId: undefined,
      studioResourceId: undefined,
      scope: undefined,
      windowStartAt: undefined,
      windowEndAt: undefined,
      sourceType: undefined,
      sourceRosterId: undefined,
      sourceDepartmentOrgUnitId: undefined,
      sourceRosterMonth: undefined,
    });
  }, [patchQuery]);
  const appliedFilterChips = useMemo<AppliedFilterChipItem[]>(() => {
    const items: AppliedFilterChipItem[] = [];

    if (routeMode === 'flat' && flatListQuery.search) {
      items.push({
        id: 'search',
        label: t('common:labels.search'),
        value: flatListQuery.search,
        onClear: () => patchQuery({ search: undefined }),
      });
    }

    if (activeQuery.status) {
      items.push({
        id: 'status',
        label: t('work-schedule:filters.status'),
        value: t(`work-schedule:statuses.${activeQuery.status}`),
        onClear: () => patchQuery({ status: undefined }),
      });
    }

    if (routeMode !== 'by-resource' && activeSubjectKind) {
      items.push({
        id: 'subject-kind',
        label: t('work-schedule:filters.subjectKind'),
        value: t(`work-schedule:subjectKinds.${activeSubjectKind}`),
        onClear: () =>
          patchQuery({
            subjectKind: undefined,
            subjectEmploymentProfileId: undefined,
            subjectTalentId: undefined,
            subjectTalentGroupId: undefined,
          }),
      });
    }

    if (routeMode !== 'by-resource' && activeSubjectId) {
      items.push({
        id: 'subject',
        label: t('work-schedule:filters.subjectId'),
        value: filterOptionLabels.subject ?? t('work-schedule:filterChips.selectedSubject'),
        onClear: () =>
          patchQuery({
            subjectEmploymentProfileId: undefined,
            subjectTalentId: undefined,
            subjectTalentGroupId: undefined,
          }),
      });
    }

    if (studioResourceFilterValue) {
      items.push({
        id: 'studio-resource',
        label: t('work-schedule:filters.studioResourceId'),
        value:
          filterOptionLabels.studioResource ??
          t('work-schedule:filterChips.selectedStudioResource'),
        onClear: () =>
          patchQuery(
            routeMode === 'by-resource'
              ? { studioResourceId: undefined }
              : { containsStudioResourceId: undefined },
          ),
      });
    }

    if (activeQuery.scope) {
      items.push({
        id: 'scope',
        label: t('work-schedule:filters.scope'),
        value: t(`work-schedule:scopes.${activeQuery.scope}`),
        onClear: () => patchQuery({ scope: undefined }),
      });
    }

    if (activeQuery.windowStartAt !== undefined) {
      items.push({
        id: 'window-start',
        label: t('work-schedule:filters.windowStartAt'),
        value: formatUtcTimestampChipValue(activeQuery.windowStartAt),
        onClear: () => patchQuery({ windowStartAt: undefined }),
      });
    }

    if (activeQuery.windowEndAt !== undefined) {
      items.push({
        id: 'window-end',
        label: t('work-schedule:filters.windowEndAt'),
        value: formatUtcTimestampChipValue(activeQuery.windowEndAt),
        onClear: () => patchQuery({ windowEndAt: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.sourceType) {
      items.push({
        id: 'source-type',
        label: t('work-schedule:sourceDetail.fields.sourceType'),
        value: t(`work-schedule:sourceLabels.${flatListQuery.sourceType}`),
        onClear: () =>
          patchQuery({
            sourceType: undefined,
            sourceRosterId: undefined,
            sourceDepartmentOrgUnitId: undefined,
            sourceRosterMonth: undefined,
          }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.sourceRosterId) {
      items.push({
        id: 'source-roster',
        label: t('work-schedule:sourceDetail.fields.sourceRosterId'),
        value: t('work-schedule:filterChips.selectedMonthlyRoster'),
        onClear: () => patchQuery({ sourceRosterId: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.sourceDepartmentOrgUnitId) {
      items.push({
        id: 'source-department',
        label: t('work-schedule:sourceDetail.fields.sourceDepartmentOrgUnitId'),
        value: t('work-schedule:filterChips.selectedDepartment'),
        onClear: () => patchQuery({ sourceDepartmentOrgUnitId: undefined }),
      });
    }

    if (routeMode === 'flat' && flatListQuery.sourceRosterMonth) {
      items.push({
        id: 'source-roster-month',
        label: t('work-schedule:sourceDetail.fields.sourceRosterMonth'),
        value: flatListQuery.sourceRosterMonth,
        onClear: () => patchQuery({ sourceRosterMonth: undefined }),
      });
    }

    return items;
  }, [
    activeQuery.scope,
    activeQuery.status,
    activeQuery.windowEndAt,
    activeQuery.windowStartAt,
    activeSubjectId,
    activeSubjectKind,
    filterOptionLabels.studioResource,
    filterOptionLabels.subject,
    flatListQuery.search,
    flatListQuery.sourceDepartmentOrgUnitId,
    flatListQuery.sourceRosterId,
    flatListQuery.sourceRosterMonth,
    flatListQuery.sourceType,
    patchQuery,
    routeMode,
    studioResourceFilterValue,
    t,
  ]);

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
        <FilterToolbar
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
          moreFiltersTrigger={
            <button
              type="button"
              aria-expanded={isMoreFiltersOpen}
              aria-controls="work-shift-more-filters"
              onClick={() => setIsMoreFiltersOpen((current) => !current)}
              className="rounded border border-border bg-panel px-3 py-1.5 text-sm font-medium"
            >
              {t('common:filters.moreFilters')}
              {advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
            </button>
          }
          moreFiltersPanel={
            <MoreFiltersPanel
              id="work-shift-more-filters"
              title={t('common:filters.moreFilters')}
              closeLabel={t('common:actions.close')}
              isOpen={isMoreFiltersOpen}
              onClose={() => setIsMoreFiltersOpen(false)}
            >
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
                  <ReferenceFilterField
                    label={t('work-schedule:filters.subjectId')}
                    pickerId="work-shift-filter-subject"
                    value={activeSubjectId}
                    loadOptions={loadSubjectFilterOptions}
                    onChange={updateSubjectFilter}
                    placeholder={t('work-schedule:filters.subjectIdPlaceholder')}
                    clearLabel={t('common:actions.clear')}
                    disabled={!activeSubjectKind}
                    className="min-w-[260px]"
                    onSelectedOptionChange={(option) => rememberFilterOption('subject', option)}
                  />
                </>
              ) : null}
              <ReferenceFilterField
                label={t('work-schedule:filters.studioResourceId')}
                pickerId="work-shift-filter-studio-resource"
                value={studioResourceFilterValue}
                loadOptions={loadStudioResourceFilterOptions}
                onChange={(value) =>
                  patchQuery(
                    routeMode === 'by-resource'
                      ? { studioResourceId: value }
                      : { containsStudioResourceId: value },
                  )
                }
                placeholder={t('work-schedule:filters.studioResourceIdPlaceholder')}
                clearLabel={t('common:actions.clear')}
                className="min-w-[260px]"
                onSelectedOptionChange={(option) => rememberFilterOption('studioResource', option)}
              />
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
                      {scope
                        ? t(`work-schedule:scopes.${scope}`)
                        : t('work-schedule:scopes.omitted')}
                    </option>
                  ))}
                </select>
              </label>
              <UtcTimestampFilterField
                label={t('work-schedule:filters.windowStartAt')}
                value={activeQuery.windowStartAt}
                onChange={(value) => patchQuery({ windowStartAt: value })}
              />
              <UtcTimestampFilterField
                label={t('work-schedule:filters.windowEndAt')}
                value={activeQuery.windowEndAt}
                onChange={(value) => patchQuery({ windowEndAt: value })}
              />
            </MoreFiltersPanel>
          }
          appliedFilters={
            <AppliedFilterChips
              title={t('common:filters.appliedFilters')}
              items={appliedFilterChips}
              clearFilterLabel={t('common:filters.clearFilter')}
              clearAllLabel={t('common:filters.clearAll')}
              onClearAll={appliedFilterChips.length > 0 ? clearWorkShiftFilters : undefined}
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
        </FilterToolbar>
      }
      interactionSection={
        <>
          {canCreateWorkShift && isGuidedWorkflowOpen ? (
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
