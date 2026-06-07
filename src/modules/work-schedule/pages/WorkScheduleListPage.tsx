import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { AdminWorkScheduleActionNeeded } from '@modules/work-schedule/components/AdminWorkScheduleActionNeeded';
import { WorkScheduleSubnavigation } from '@modules/work-schedule/components/WorkScheduleSubnavigation';
import { WorkShiftGuidedWorkflow } from '@modules/work-schedule/components/WorkShiftGuidedWorkflow';
import {
  loadWorkShiftStudioResourceFilterOptions,
  loadWorkShiftSubjectFilterOptions,
} from '@modules/work-schedule/components/work-schedule-reference-options';
import {
  useCreateWorkShiftMutation,
  useApproveWorkScheduleRequestMutation,
  useCancelWorkScheduleRequestMutation,
  useCreateWorkScheduleRequestMutation,
  useRejectWorkScheduleRequestMutation,
  useWorkScheduleRequestList,
  useWorkShiftFlatList,
  useWorkShiftLifecycleMutation,
  useWorkShiftsByResource,
  useWorkShiftsBySubject,
} from '@modules/work-schedule/hooks/use-work-schedule';
import { createWorkShiftListColumns } from '@modules/work-schedule/tables/work-schedule-columns';
import type {
  WorkScheduleRequestType,
  WorkScheduleScope,
  WorkShiftLifecycleAction,
  WorkShiftSubjectKind,
} from '@modules/work-schedule/types/work-schedule.types';
import {
  canAccessWorkScheduleSurface,
  getWorkScheduleSurfaceForPath,
  resolveDefaultWorkScheduleSurfacePath,
} from '@modules/work-schedule/work-schedule-surface-access';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  canUseAnyAction,
  hasScopeGrant,
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
const scheduleRequestTypeOptions: readonly WorkScheduleRequestType[] = [
  'CREATE_SHIFT',
  'RESCHEDULE_SHIFT',
  'CANCEL_SHIFT',
];

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const capabilitiesQuery = useCurrentActorCapabilities();
  const routeSurface = getWorkScheduleSurfaceForPath(location.pathname);
  const legacyRedirectPath =
    location.pathname === APP_PATHS.workShifts
      ? resolveDefaultWorkScheduleSurfacePath(capabilitiesQuery.data)
      : null;

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

  const routeSurfaceScope = routeSurface?.scope;
  const activeQuery =
    routeMode === 'by-subject'
      ? { ...bySubjectQuery, scope: bySubjectQuery.scope ?? routeSurfaceScope }
      : routeMode === 'by-resource'
        ? { ...byResourceQuery, scope: byResourceQuery.scope ?? routeSurfaceScope }
        : { ...flatListQuery, scope: flatListQuery.scope ?? routeSurfaceScope };
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

  const scopedFlatListQuery = useMemo(
    () => ({ ...flatListQuery, scope: flatListQuery.scope ?? routeSurfaceScope }),
    [flatListQuery, routeSurfaceScope],
  );
  const scopedBySubjectQuery = useMemo(
    () => ({ ...bySubjectQuery, scope: bySubjectQuery.scope ?? routeSurfaceScope }),
    [bySubjectQuery, routeSurfaceScope],
  );
  const scopedByResourceQuery = useMemo(
    () => ({ ...byResourceQuery, scope: byResourceQuery.scope ?? routeSurfaceScope }),
    [byResourceQuery, routeSurfaceScope],
  );

  const flatQueryResult = useWorkShiftFlatList(scopedFlatListQuery, {
    enabled: routeMode === 'flat' && location.pathname !== APP_PATHS.workShifts,
  });
  const bySubjectQueryResult = useWorkShiftsBySubject(scopedBySubjectQuery, {
    enabled: routeMode === 'by-subject' && location.pathname !== APP_PATHS.workShifts,
  });
  const byResourceQueryResult = useWorkShiftsByResource(scopedByResourceQuery, {
    enabled: routeMode === 'by-resource' && location.pathname !== APP_PATHS.workShifts,
  });
  const listQueryResult =
    routeMode === 'by-subject'
      ? bySubjectQueryResult
      : routeMode === 'by-resource'
        ? byResourceQueryResult
        : flatQueryResult;

  const createMutation = useCreateWorkShiftMutation();
  const lifecycleMutation = useWorkShiftLifecycleMutation();
  const createScheduleRequestMutation = useCreateWorkScheduleRequestMutation();
  const approveScheduleRequestMutation = useApproveWorkScheduleRequestMutation();
  const rejectScheduleRequestMutation = useRejectWorkScheduleRequestMutation();
  const cancelScheduleRequestMutation = useCancelWorkScheduleRequestMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [isGuidedWorkflowOpen, setIsGuidedWorkflowOpen] = useState(false);
  const [guidedWorkflowError, setGuidedWorkflowError] = useState<NormalizedApiError | null>(null);
  const [scheduleRequestError, setScheduleRequestError] = useState<NormalizedApiError | null>(null);
  const [scheduleRequestForm, setScheduleRequestForm] = useState({
    requestType: 'CREATE_SHIFT' as WorkScheduleRequestType,
    targetEmploymentProfileId: '',
    targetWorkShiftId: '',
    reason: '',
    proposedTitle: '',
    proposedStartAt: '',
    proposedEndAt: '',
    decisionNote: '',
  });
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

  const workScheduleCreateRequirements: readonly ActionCapabilityRequirement[] = [
    {
      permission: PERMISSIONS.WORK_SCHEDULE_CREATE,
      scope: { module: 'workSchedule', value: 'global' },
    },
  ];
  const canCreateWorkShift =
    routeSurface?.id === 'global-ops' &&
    canUseAnyAction(capabilitiesQuery.data, workScheduleCreateRequirements).allowed;
  const canManageWorkShiftLifecycle =
    routeSurface?.id === 'global-ops' &&
    canShowAction(capabilitiesQuery.data, {
      permission: PERMISSIONS.WORK_SCHEDULE_MANAGE_LIFECYCLE,
      scope: { module: 'workSchedule', value: 'global' },
    });
  const canCreateScheduleRequest =
    routeSurface?.id === 'team-shifts' &&
    canShowAction(capabilitiesQuery.data, {
      permission: PERMISSIONS.WORK_SCHEDULE_READ,
      scope: { module: 'workSchedule', value: 'team' },
    });
  const canViewScheduleRequests =
    routeSurface?.id === 'team-shifts' ||
    routeSurface?.id === 'department-shifts' ||
    routeSurface?.id === 'global-ops';
  const canApproveScheduleRequests =
    routeSurface?.id === 'global-ops' &&
    canShowAction(capabilitiesQuery.data, {
      permission: PERMISSIONS.WORK_SCHEDULE_UPDATE,
      scope: { module: 'workSchedule', value: 'global' },
    });
  const scheduleRequestListQuery = useWorkScheduleRequestList(
    {
      status: routeSurface?.id === 'global-ops' ? 'PENDING' : undefined,
      limit: 20,
    },
    {
      enabled:
        canViewScheduleRequests &&
        Boolean(capabilitiesQuery.data) &&
        hasScopeGrant(capabilitiesQuery.data, 'workSchedule', routeSurfaceScope ?? 'self'),
    },
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
    void scope;
    setGuidedWorkflowError(null);

    try {
      await createMutation.mutateAsync({
        payload,
        scope: 'global',
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
          scope: 'global',
        });
        notifySuccess('work-schedule:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, requestDestructiveConfirm, t],
  );

  const onSubmitScheduleRequest = async (): Promise<void> => {
    setScheduleRequestError(null);

    try {
      await createScheduleRequestMutation.mutateAsync({
        payload: {
          requestType: scheduleRequestForm.requestType,
          targetEmploymentProfileId: scheduleRequestForm.targetEmploymentProfileId,
          targetWorkShiftId:
            scheduleRequestForm.requestType === 'CREATE_SHIFT'
              ? null
              : scheduleRequestForm.targetWorkShiftId,
          reason: scheduleRequestForm.reason,
          proposedTitle:
            scheduleRequestForm.requestType === 'CREATE_SHIFT'
              ? scheduleRequestForm.proposedTitle
              : null,
          proposedStartAt:
            scheduleRequestForm.requestType === 'CANCEL_SHIFT'
              ? null
              : (parseUtcTimestampInput(scheduleRequestForm.proposedStartAt) ?? null),
          proposedEndAt:
            scheduleRequestForm.requestType === 'CANCEL_SHIFT'
              ? null
              : (parseUtcTimestampInput(scheduleRequestForm.proposedEndAt) ?? null),
        },
      });
      notifySuccess('work-schedule:requests.feedback.submitted');
      setScheduleRequestForm((current) => ({
        ...current,
        targetWorkShiftId: '',
        reason: '',
        proposedTitle: '',
        proposedStartAt: '',
        proposedEndAt: '',
      }));
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setScheduleRequestError(normalizedError);
      notifyError(normalizedError);
    }
  };

  const onApproveScheduleRequest = async (requestId: string): Promise<void> => {
    try {
      await approveScheduleRequestMutation.mutateAsync({
        requestId,
        payload: { approvalNote: scheduleRequestForm.decisionNote || null },
      });
      notifySuccess('work-schedule:requests.feedback.approved');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onRejectScheduleRequest = async (requestId: string): Promise<void> => {
    try {
      await rejectScheduleRequestMutation.mutateAsync({
        requestId,
        payload: { rejectionReason: scheduleRequestForm.decisionNote || 'Rejected by dispatcher' },
      });
      notifySuccess('work-schedule:requests.feedback.rejected');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onCancelScheduleRequest = async (requestId: string): Promise<void> => {
    const confirmed = await requestDestructiveConfirm({
      description: t('work-schedule:requests.confirm.cancel'),
    });

    if (!confirmed) {
      return;
    }

    try {
      await cancelScheduleRequestMutation.mutateAsync({
        requestId,
        payload: { cancellationReason: 'Cancelled by requester' },
      });
      notifySuccess('work-schedule:requests.feedback.cancelled');
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

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

  const visibleScopeOptions = routeSurfaceScope
    ? ['', routeSurfaceScope]
    : 'subjectKind' in activeQuery &&
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

  if (legacyRedirectPath) {
    return <Navigate to={legacyRedirectPath} replace />;
  }

  if (
    routeSurface &&
    !capabilitiesQuery.isLoading &&
    !canAccessWorkScheduleSurface(capabilitiesQuery.data, routeSurface.id)
  ) {
    return <PermissionDeniedState />;
  }

  return (
    <ModuleListScreenShell
      mode={routeMode === 'flat' ? 'flat-list' : 'related-list'}
      banner={
        <div className="space-y-3">
          <WorkScheduleSubnavigation active={routeSurface?.id ?? 'global-ops'} />
          {routeSurface?.id === 'global-ops' ? <AdminWorkScheduleActionNeeded /> : null}
          {routeSurface?.id === 'global-ops' ? (
            <div className="flex flex-col gap-2 rounded border border-border bg-panel px-3 py-2 text-sm text-text sm:flex-row sm:items-center sm:justify-between">
              <span>{t('work-schedule:requestBatches.page.subtitle')}</span>
              <div className="flex flex-wrap gap-2">
                {canCreateWorkShift ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsGuidedWorkflowOpen((current) => !current);
                      setGuidedWorkflowError(null);
                    }}
                    data-action-priority="primary"
                    className="inline-flex min-h-9 items-center justify-center rounded border border-accent bg-accent px-3 py-2 font-medium text-white"
                  >
                    {isGuidedWorkflowOpen
                      ? t('work-schedule:actions.closeGuidedWorkflow')
                      : t('work-schedule:actions.scheduleWorkShift')}
                  </button>
                ) : null}
                <Link
                  className="inline-flex min-h-9 items-center justify-center rounded border border-border bg-bg px-3 py-2 font-medium text-text hover:bg-slate-50"
                  to={APP_PATHS.workScheduleRequestBatches}
                >
                  {t('work-schedule:rosterNav.requestBatches')}
                </Link>
              </div>
            </div>
          ) : null}
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
        <div className="space-y-4">
          {canCreateWorkShift && isGuidedWorkflowOpen ? (
            <WorkShiftGuidedWorkflow
              isPending={createMutation.isPending}
              error={guidedWorkflowError}
              availableScopes={['global']}
              onCancel={() => {
                setIsGuidedWorkflowOpen(false);
                setGuidedWorkflowError(null);
              }}
              onSubmit={onGuidedWorkflowSubmit}
            />
          ) : null}
          {canCreateScheduleRequest ? (
            <section className="space-y-3 border-y border-border py-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[190px] flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('work-schedule:requests.fields.type')}
                  </span>
                  <select
                    value={scheduleRequestForm.requestType}
                    className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                    onChange={(event) =>
                      setScheduleRequestForm((current) => ({
                        ...current,
                        requestType: event.target.value as WorkScheduleRequestType,
                      }))
                    }
                  >
                    {scheduleRequestTypeOptions.map((requestType) => (
                      <option key={requestType} value={requestType}>
                        {t(`work-schedule:requests.types.${requestType}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-[220px] flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('work-schedule:requests.fields.targetEmploymentProfileId')}
                  </span>
                  <input
                    value={scheduleRequestForm.targetEmploymentProfileId}
                    className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                    onChange={(event) =>
                      setScheduleRequestForm((current) => ({
                        ...current,
                        targetEmploymentProfileId: event.target.value,
                      }))
                    }
                  />
                </label>
                {scheduleRequestForm.requestType !== 'CREATE_SHIFT' ? (
                  <label className="flex min-w-[220px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('work-schedule:requests.fields.targetWorkShiftId')}
                    </span>
                    <input
                      value={scheduleRequestForm.targetWorkShiftId}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        setScheduleRequestForm((current) => ({
                          ...current,
                          targetWorkShiftId: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                {scheduleRequestForm.requestType === 'CREATE_SHIFT' ? (
                  <label className="flex min-w-[220px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('work-schedule:requests.fields.title')}
                    </span>
                    <input
                      value={scheduleRequestForm.proposedTitle}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        setScheduleRequestForm((current) => ({
                          ...current,
                          proposedTitle: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                {scheduleRequestForm.requestType !== 'CANCEL_SHIFT' ? (
                  <>
                    <label className="flex min-w-[190px] flex-col gap-1">
                      <span className="text-xs font-medium uppercase text-muted">
                        {t('work-schedule:requests.fields.startAt')}
                      </span>
                      <input
                        type="datetime-local"
                        value={scheduleRequestForm.proposedStartAt}
                        className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                        onChange={(event) =>
                          setScheduleRequestForm((current) => ({
                            ...current,
                            proposedStartAt: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="flex min-w-[190px] flex-col gap-1">
                      <span className="text-xs font-medium uppercase text-muted">
                        {t('work-schedule:requests.fields.endAt')}
                      </span>
                      <input
                        type="datetime-local"
                        value={scheduleRequestForm.proposedEndAt}
                        className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                        onChange={(event) =>
                          setScheduleRequestForm((current) => ({
                            ...current,
                            proposedEndAt: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                ) : null}
                <label className="flex min-w-[260px] flex-1 flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('work-schedule:requests.fields.reason')}
                  </span>
                  <input
                    value={scheduleRequestForm.reason}
                    className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                    onChange={(event) =>
                      setScheduleRequestForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={createScheduleRequestMutation.isPending}
                  onClick={() => void onSubmitScheduleRequest()}
                >
                  {t('work-schedule:requests.actions.requestChange')}
                </button>
              </div>
              {scheduleRequestError ? (
                <p className="text-sm text-danger">
                  {readErrorMessage(
                    t,
                    scheduleRequestError,
                    'work-schedule:requests.feedback.submitFailed',
                  )}
                </p>
              ) : null}
            </section>
          ) : null}
          {canViewScheduleRequests && scheduleRequestListQuery.data?.data.length ? (
            <section className="space-y-3 border-y border-border py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-base font-semibold text-text">
                  {routeSurface?.id === 'global-ops'
                    ? t('work-schedule:requests.approvalQueue')
                    : t('work-schedule:requests.title')}
                </h2>
                {canApproveScheduleRequests ? (
                  <label className="flex min-w-[260px] flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted">
                      {t('work-schedule:requests.fields.decisionNote')}
                    </span>
                    <input
                      value={scheduleRequestForm.decisionNote}
                      className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        setScheduleRequestForm((current) => ({
                          ...current,
                          decisionNote: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
              </div>
              <div className="grid gap-2">
                {scheduleRequestListQuery.data.data.map((request) => {
                  const isPending = request.status === 'PENDING';
                  const canCancelOwn =
                    isPending && request.requestedByUserId === capabilitiesQuery.data?.id;
                  return (
                    <div
                      key={request.id}
                      className="grid gap-2 border border-border bg-panel px-3 py-2 md:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <span>{request.requestCode}</span>
                          <span>{t(`work-schedule:requests.types.${request.requestType}`)}</span>
                          <span>{t(`work-schedule:requests.statuses.${request.status}`)}</span>
                        </div>
                        <p className="truncate text-sm text-muted">
                          {request.targetEmploymentProfileRef?.displayName ??
                            request.targetEmploymentProfileId}
                          {request.targetWorkShiftRef?.title
                            ? ` · ${request.targetWorkShiftRef.title}`
                            : ''}
                        </p>
                        <p className="truncate text-sm text-text">{request.reason}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canApproveScheduleRequests ? (
                          <>
                            <button
                              type="button"
                              className="rounded border border-border bg-surface px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={!isPending || approveScheduleRequestMutation.isPending}
                              onClick={() => void onApproveScheduleRequest(request.id)}
                            >
                              {t('work-schedule:requests.actions.approve')}
                            </button>
                            <button
                              type="button"
                              className="rounded border border-border bg-surface px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={!isPending || rejectScheduleRequestMutation.isPending}
                              onClick={() => void onRejectScheduleRequest(request.id)}
                            >
                              {t('work-schedule:requests.actions.reject')}
                            </button>
                          </>
                        ) : null}
                        {canCancelOwn ? (
                          <button
                            type="button"
                            className="rounded border border-border bg-surface px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={cancelScheduleRequestMutation.isPending}
                            onClick={() => void onCancelScheduleRequest(request.id)}
                          >
                            {t('work-schedule:requests.actions.cancel')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
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
