import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addHolidayCalendarEntry,
  addRosterException,
  applyAvailabilityLinesToMonthlyRoster,
  approveWorkScheduleAvailabilityBatchLines,
  approveWorkScheduleRequestBatchLines,
  approveWorkScheduleRequest,
  archiveMonthlyRoster,
  cancelWorkScheduleAvailabilityBatchLines,
  cancelWorkScheduleRequestBatchLines,
  cancelWorkScheduleRequest,
  createHolidayCalendar,
  createMonthlyRosterDraft,
  createWorkScheduleRequest,
  createWorkPattern,
  createWorkShift,
  fetchHolidayCalendarDetail,
  fetchHolidayCalendars,
  fetchMonthlyRosterDetail,
  fetchMonthlyRosterPreview,
  fetchMonthlyRosters,
  fetchWorkScheduleAvailabilityBatchDetail,
  fetchWorkScheduleAvailabilityBatches,
  fetchWorkPatternDetail,
  fetchWorkPatterns,
  fetchWorkShiftDetail,
  fetchWorkShifts,
  fetchWorkShiftsByResource,
  fetchWorkShiftsBySubject,
  fetchWorkScheduleRequests,
  fetchWorkScheduleRequestBatches,
  fetchWorkScheduleRequestBatchDetail,
  performHolidayCalendarLifecycleAction,
  performWorkPatternLifecycleAction,
  performWorkShiftLifecycleAction,
  publishMonthlyRoster,
  reassignWorkShiftSubject,
  rejectWorkScheduleAvailabilityBatchLines,
  rejectWorkScheduleRequestBatchLines,
  rejectWorkScheduleRequest,
  removeHolidayCalendarEntry,
  removeRosterException,
  replaceWorkShiftResources,
  rescheduleWorkShift,
  updateHolidayCalendar,
  updateHolidayCalendarEntry,
  updateMonthlyRosterDraft,
  updateRosterException,
  updateWorkPattern,
  updateWorkShift,
} from '@modules/work-schedule/api/work-schedule.api';
import type {
  ApplyAvailabilityLinesToMonthlyRosterPayload,
  HolidayCalendarCreatePayload,
  HolidayCalendarEntryPayload,
  HolidayCalendarLifecycleAction,
  HolidayCalendarListQuery,
  HolidayCalendarUpdatePayload,
  MonthlyRosterCreatePayload,
  MonthlyRosterListQuery,
  MonthlyRosterPublishPayload,
  MonthlyRosterScope,
  MonthlyRosterUpdatePayload,
  RosterExceptionPayload,
  WorkPatternCreatePayload,
  WorkPatternLifecycleAction,
  WorkPatternListQuery,
  WorkPatternUpdatePayload,
  WorkScheduleAvailabilityBatchListQuery,
  WorkScheduleAvailabilityLineDecisionPayload,
  WorkScheduleRequestApprovePayload,
  WorkScheduleRequestBatchLineDecisionPayload,
  WorkScheduleRequestBatchListQuery,
  WorkScheduleRequestCancelPayload,
  WorkScheduleRequestCreatePayload,
  WorkScheduleRequestListQuery,
  WorkScheduleRequestRejectPayload,
  WorkScheduleScope,
  WorkShiftByResourceQuery,
  WorkShiftBySubjectQuery,
  WorkShiftCreatePayload,
  WorkShiftLifecycleAction,
  WorkShiftListQuery,
  WorkShiftReassignSubjectPayload,
  WorkShiftReplaceResourcesPayload,
  WorkShiftReschedulePayload,
  WorkShiftUpdatePayload,
} from '@modules/work-schedule/types/work-schedule.types';
import {
  serializeScreenQueryParams,
  holidayCalendarListQueryConfig,
  monthlyRosterListQueryConfig,
  workShiftByResourceQueryConfig,
  workShiftBySubjectQueryConfig,
  workShiftFlatListQueryConfig,
  workPatternListQueryConfig,
} from '@shared/query';

const WORK_SCHEDULE_QUERY_ROOT = ['work-schedule'] as const;

const toFlatListQueryToken = (query: WorkShiftListQuery): string =>
  serializeScreenQueryParams(query, workShiftFlatListQueryConfig).toString();

const toBySubjectQueryToken = (query: WorkShiftBySubjectQuery): string =>
  serializeScreenQueryParams(query, workShiftBySubjectQueryConfig).toString();

const toByResourceQueryToken = (query: WorkShiftByResourceQuery): string =>
  serializeScreenQueryParams(query, workShiftByResourceQueryConfig).toString();

const toWorkPatternListQueryToken = (query: WorkPatternListQuery): string =>
  serializeScreenQueryParams(query, workPatternListQueryConfig).toString();

const toHolidayCalendarListQueryToken = (query: HolidayCalendarListQuery): string =>
  serializeScreenQueryParams(query, holidayCalendarListQueryConfig).toString();

const toMonthlyRosterListQueryToken = (query: MonthlyRosterListQuery): string =>
  serializeScreenQueryParams(query, monthlyRosterListQueryConfig).toString();

const toWorkScheduleRequestListQueryToken = (query: WorkScheduleRequestListQuery): string =>
  new URLSearchParams(
    Object.entries(query).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        accumulator[key] = String(value);
      }
      return accumulator;
    }, {}),
  ).toString();

const toWorkScheduleRequestBatchListQueryToken = (
  query: WorkScheduleRequestBatchListQuery,
): string =>
  new URLSearchParams(
    Object.entries(query).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        accumulator[key] = String(value);
      }
      return accumulator;
    }, {}),
  ).toString();

const toWorkScheduleAvailabilityBatchListQueryToken = (
  query: WorkScheduleAvailabilityBatchListQuery,
): string =>
  new URLSearchParams(
    Object.entries(query).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        accumulator[key] = String(value);
      }
      return accumulator;
    }, {}),
  ).toString();

export const workScheduleQueryKeys = {
  all: (): readonly ['work-schedule'] => WORK_SCHEDULE_QUERY_ROOT,
  flatList: (query: WorkShiftListQuery) =>
    ['work-schedule', 'flat-list', toFlatListQueryToken(query)] as const,
  bySubject: (query: WorkShiftBySubjectQuery) =>
    ['work-schedule', 'by-subject', toBySubjectQueryToken(query)] as const,
  byResource: (query: WorkShiftByResourceQuery) =>
    ['work-schedule', 'by-resource', toByResourceQueryToken(query)] as const,
  detail: (workShiftId: string, scope?: WorkScheduleScope) =>
    ['work-schedule', 'detail', workShiftId, scope ?? 'scope-omitted'] as const,
  workPatternList: (query: WorkPatternListQuery) =>
    ['work-schedule', 'patterns', 'list', toWorkPatternListQueryToken(query)] as const,
  workPatternDetail: (workPatternId: string) =>
    ['work-schedule', 'patterns', 'detail', workPatternId] as const,
  holidayCalendarList: (query: HolidayCalendarListQuery) =>
    ['work-schedule', 'holiday-calendars', 'list', toHolidayCalendarListQueryToken(query)] as const,
  holidayCalendarDetail: (holidayCalendarId: string) =>
    ['work-schedule', 'holiday-calendars', 'detail', holidayCalendarId] as const,
  monthlyRosterList: (query: MonthlyRosterListQuery) =>
    ['work-schedule', 'monthly-rosters', 'list', toMonthlyRosterListQueryToken(query)] as const,
  monthlyRosterDetail: (monthlyRosterId: string, scope?: MonthlyRosterScope) =>
    [
      'work-schedule',
      'monthly-rosters',
      'detail',
      monthlyRosterId,
      scope ?? 'scope-omitted',
    ] as const,
  monthlyRosterPreview: (monthlyRosterId: string, scope?: MonthlyRosterScope) =>
    [
      'work-schedule',
      'monthly-rosters',
      'preview',
      monthlyRosterId,
      scope ?? 'scope-omitted',
    ] as const,
  monthlyRosterPublish: () => ['work-schedule', 'monthly-rosters', 'publish'] as const,
  requestList: (query: WorkScheduleRequestListQuery) =>
    ['work-schedule', 'requests', 'list', toWorkScheduleRequestListQueryToken(query)] as const,
  requestBatchList: (query: WorkScheduleRequestBatchListQuery) =>
    [
      'work-schedule',
      'request-batches',
      'list',
      toWorkScheduleRequestBatchListQueryToken(query),
    ] as const,
  requestBatchDetail: (batchId: string) =>
    ['work-schedule', 'request-batches', 'detail', batchId] as const,
  availabilityBatchList: (query: WorkScheduleAvailabilityBatchListQuery) =>
    [
      'work-schedule',
      'availability-batches',
      'list',
      toWorkScheduleAvailabilityBatchListQueryToken(query),
    ] as const,
  availabilityBatchDetail: (batchId: string) =>
    ['work-schedule', 'availability-batches', 'detail', batchId] as const,
  monthlyRosterApplyAvailability: () =>
    ['work-schedule', 'monthly-rosters', 'apply-availability'] as const,
};

export const useWorkShiftFlatList = (
  query: WorkShiftListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.flatList(query),
    queryFn: () => fetchWorkShifts(query),
    enabled: options?.enabled ?? true,
  });
};

export const useWorkShiftsBySubject = (
  query: WorkShiftBySubjectQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.bySubject(query),
    queryFn: () => fetchWorkShiftsBySubject(query),
    enabled: options?.enabled ?? true,
  });
};

export const useWorkShiftsByResource = (
  query: WorkShiftByResourceQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.byResource(query),
    queryFn: () => fetchWorkShiftsByResource(query),
    enabled: options?.enabled ?? true,
  });
};

export const useWorkShiftDetail = (workShiftId?: string, scope?: WorkScheduleScope) => {
  return useQuery({
    queryKey: workShiftId
      ? workScheduleQueryKeys.detail(workShiftId, scope)
      : [...WORK_SCHEDULE_QUERY_ROOT, 'detail'],
    queryFn: () => fetchWorkShiftDetail(workShiftId ?? '', scope),
    enabled: Boolean(workShiftId),
  });
};

export const useWorkScheduleRequestList = (
  query: WorkScheduleRequestListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.requestList(query),
    queryFn: () => fetchWorkScheduleRequests(query),
    enabled: options?.enabled ?? true,
  });
};

export const useWorkScheduleRequestBatchList = (
  query: WorkScheduleRequestBatchListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.requestBatchList(query),
    queryFn: () => fetchWorkScheduleRequestBatches(query),
    enabled: options?.enabled ?? true,
  });
};

export const useWorkScheduleRequestBatchDetail = (
  batchId: string | undefined,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: batchId
      ? workScheduleQueryKeys.requestBatchDetail(batchId)
      : [...WORK_SCHEDULE_QUERY_ROOT, 'request-batches', 'detail'],
    queryFn: () => fetchWorkScheduleRequestBatchDetail(batchId ?? ''),
    enabled: Boolean(batchId) && (options?.enabled ?? true),
  });
};

export const useWorkScheduleAvailabilityBatchList = (
  query: WorkScheduleAvailabilityBatchListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.availabilityBatchList(query),
    queryFn: () => fetchWorkScheduleAvailabilityBatches(query),
    enabled: options?.enabled ?? true,
  });
};

export const useWorkScheduleAvailabilityBatchDetail = (
  batchId: string | undefined,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: batchId
      ? workScheduleQueryKeys.availabilityBatchDetail(batchId)
      : [...WORK_SCHEDULE_QUERY_ROOT, 'availability-batches', 'detail'],
    queryFn: () => fetchWorkScheduleAvailabilityBatchDetail(batchId ?? ''),
    enabled: Boolean(batchId) && (options?.enabled ?? true),
  });
};

export const useWorkPatternList = (
  query: WorkPatternListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.workPatternList(query),
    queryFn: () => fetchWorkPatterns(query),
    enabled: options?.enabled ?? true,
  });
};

export const useWorkPatternDetail = (workPatternId?: string) => {
  return useQuery({
    queryKey: workPatternId
      ? workScheduleQueryKeys.workPatternDetail(workPatternId)
      : [...WORK_SCHEDULE_QUERY_ROOT, 'patterns', 'detail'],
    queryFn: () => fetchWorkPatternDetail(workPatternId ?? ''),
    enabled: Boolean(workPatternId),
  });
};

export const useHolidayCalendarList = (
  query: HolidayCalendarListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.holidayCalendarList(query),
    queryFn: () => fetchHolidayCalendars(query),
    enabled: options?.enabled ?? true,
  });
};

export const useHolidayCalendarDetail = (holidayCalendarId?: string) => {
  return useQuery({
    queryKey: holidayCalendarId
      ? workScheduleQueryKeys.holidayCalendarDetail(holidayCalendarId)
      : [...WORK_SCHEDULE_QUERY_ROOT, 'holiday-calendars', 'detail'],
    queryFn: () => fetchHolidayCalendarDetail(holidayCalendarId ?? ''),
    enabled: Boolean(holidayCalendarId),
  });
};

export const useMonthlyRosterList = (
  query: MonthlyRosterListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: workScheduleQueryKeys.monthlyRosterList(query),
    queryFn: () => fetchMonthlyRosters(query),
    enabled: options?.enabled ?? true,
  });
};

export const useMonthlyRosterDetail = (monthlyRosterId?: string, scope?: MonthlyRosterScope) => {
  return useQuery({
    queryKey: monthlyRosterId
      ? workScheduleQueryKeys.monthlyRosterDetail(monthlyRosterId, scope)
      : [...WORK_SCHEDULE_QUERY_ROOT, 'monthly-rosters', 'detail'],
    queryFn: () => fetchMonthlyRosterDetail(monthlyRosterId ?? '', scope),
    enabled: Boolean(monthlyRosterId),
  });
};

export const useMonthlyRosterPreview = (
  monthlyRosterId?: string,
  scope?: MonthlyRosterScope,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: monthlyRosterId
      ? workScheduleQueryKeys.monthlyRosterPreview(monthlyRosterId, scope)
      : [...WORK_SCHEDULE_QUERY_ROOT, 'monthly-rosters', 'preview'],
    queryFn: () => fetchMonthlyRosterPreview(monthlyRosterId ?? '', scope),
    enabled: Boolean(monthlyRosterId) && (options?.enabled ?? true),
  });
};

const invalidateWorkScheduleQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: WORK_SCHEDULE_QUERY_ROOT });
};

export const useCreateWorkShiftMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      scope,
    }: {
      payload: WorkShiftCreatePayload;
      scope?: WorkScheduleScope;
    }) => createWorkShift(payload, scope),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useUpdateWorkShiftMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workShiftId,
      payload,
      scope,
    }: {
      workShiftId: string;
      payload: WorkShiftUpdatePayload;
      scope?: WorkScheduleScope;
    }) => updateWorkShift(workShiftId, payload, scope),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useRescheduleWorkShiftMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workShiftId,
      payload,
      scope,
    }: {
      workShiftId: string;
      payload: WorkShiftReschedulePayload;
      scope?: WorkScheduleScope;
    }) => rescheduleWorkShift(workShiftId, payload, scope),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useReassignWorkShiftSubjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workShiftId,
      payload,
      scope,
    }: {
      workShiftId: string;
      payload: WorkShiftReassignSubjectPayload;
      scope?: WorkScheduleScope;
    }) => reassignWorkShiftSubject(workShiftId, payload, scope),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useReplaceWorkShiftResourcesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workShiftId,
      payload,
      scope,
    }: {
      workShiftId: string;
      payload: WorkShiftReplaceResourcesPayload;
      scope?: WorkScheduleScope;
    }) => replaceWorkShiftResources(workShiftId, payload, scope),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useWorkShiftLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workShiftId,
      action,
      scope,
    }: {
      workShiftId: string;
      action: WorkShiftLifecycleAction;
      scope?: WorkScheduleScope;
    }) => performWorkShiftLifecycleAction(workShiftId, action, scope),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useCreateWorkScheduleRequestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }: { payload: WorkScheduleRequestCreatePayload }) =>
      createWorkScheduleRequest(payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useApproveWorkScheduleRequestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: WorkScheduleRequestApprovePayload;
    }) => approveWorkScheduleRequest(requestId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useRejectWorkScheduleRequestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: WorkScheduleRequestRejectPayload;
    }) => rejectWorkScheduleRequest(requestId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useApproveWorkScheduleRequestBatchLinesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: WorkScheduleRequestBatchLineDecisionPayload;
    }) => approveWorkScheduleRequestBatchLines(batchId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useRejectWorkScheduleRequestBatchLinesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: WorkScheduleRequestBatchLineDecisionPayload;
    }) => rejectWorkScheduleRequestBatchLines(batchId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useCancelWorkScheduleRequestBatchLinesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: WorkScheduleRequestBatchLineDecisionPayload;
    }) => cancelWorkScheduleRequestBatchLines(batchId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useApproveWorkScheduleAvailabilityBatchLinesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: WorkScheduleAvailabilityLineDecisionPayload;
    }) => approveWorkScheduleAvailabilityBatchLines(batchId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useRejectWorkScheduleAvailabilityBatchLinesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: WorkScheduleAvailabilityLineDecisionPayload;
    }) => rejectWorkScheduleAvailabilityBatchLines(batchId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useCancelWorkScheduleAvailabilityBatchLinesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: WorkScheduleAvailabilityLineDecisionPayload;
    }) => cancelWorkScheduleAvailabilityBatchLines(batchId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useCancelWorkScheduleRequestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload?: WorkScheduleRequestCancelPayload;
    }) => cancelWorkScheduleRequest(requestId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useCreateWorkPatternMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }: { payload: WorkPatternCreatePayload }) => createWorkPattern(payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useUpdateWorkPatternMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workPatternId,
      payload,
    }: {
      workPatternId: string;
      payload: WorkPatternUpdatePayload;
    }) => updateWorkPattern(workPatternId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useWorkPatternLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workPatternId,
      action,
    }: {
      workPatternId: string;
      action: WorkPatternLifecycleAction;
    }) => performWorkPatternLifecycleAction(workPatternId, action),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useCreateHolidayCalendarMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }: { payload: HolidayCalendarCreatePayload }) =>
      createHolidayCalendar(payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useUpdateHolidayCalendarMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      holidayCalendarId,
      payload,
    }: {
      holidayCalendarId: string;
      payload: HolidayCalendarUpdatePayload;
    }) => updateHolidayCalendar(holidayCalendarId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useHolidayCalendarLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      holidayCalendarId,
      action,
    }: {
      holidayCalendarId: string;
      action: HolidayCalendarLifecycleAction;
    }) => performHolidayCalendarLifecycleAction(holidayCalendarId, action),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useAddHolidayCalendarEntryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      holidayCalendarId,
      payload,
    }: {
      holidayCalendarId: string;
      payload: HolidayCalendarEntryPayload;
    }) => addHolidayCalendarEntry(holidayCalendarId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useUpdateHolidayCalendarEntryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      holidayCalendarId,
      holidayCalendarEntryId,
      payload,
    }: {
      holidayCalendarId: string;
      holidayCalendarEntryId: string;
      payload: HolidayCalendarEntryPayload;
    }) => updateHolidayCalendarEntry(holidayCalendarId, holidayCalendarEntryId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useRemoveHolidayCalendarEntryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      holidayCalendarId,
      holidayCalendarEntryId,
    }: {
      holidayCalendarId: string;
      holidayCalendarEntryId: string;
    }) => removeHolidayCalendarEntry(holidayCalendarId, holidayCalendarEntryId),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useCreateMonthlyRosterDraftMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }: { payload: MonthlyRosterCreatePayload }) =>
      createMonthlyRosterDraft(payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useUpdateMonthlyRosterDraftMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      monthlyRosterId,
      payload,
    }: {
      monthlyRosterId: string;
      payload: MonthlyRosterUpdatePayload;
    }) => updateMonthlyRosterDraft(monthlyRosterId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useArchiveMonthlyRosterMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      monthlyRosterId,
      scope,
    }: {
      monthlyRosterId: string;
      scope?: MonthlyRosterScope;
    }) => archiveMonthlyRoster(monthlyRosterId, scope),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const usePublishMonthlyRosterMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: workScheduleQueryKeys.monthlyRosterPublish(),
    mutationFn: ({
      monthlyRosterId,
      payload,
    }: {
      monthlyRosterId: string;
      payload: MonthlyRosterPublishPayload;
    }) => publishMonthlyRoster(monthlyRosterId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useApplyAvailabilityLinesToMonthlyRosterMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: workScheduleQueryKeys.monthlyRosterApplyAvailability(),
    mutationFn: ({
      monthlyRosterId,
      payload,
    }: {
      monthlyRosterId: string;
      payload: ApplyAvailabilityLinesToMonthlyRosterPayload;
    }) => applyAvailabilityLinesToMonthlyRoster(monthlyRosterId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useAddRosterExceptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      monthlyRosterId,
      payload,
    }: {
      monthlyRosterId: string;
      payload: RosterExceptionPayload;
    }) => addRosterException(monthlyRosterId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useUpdateRosterExceptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      monthlyRosterId,
      rosterExceptionId,
      payload,
    }: {
      monthlyRosterId: string;
      rosterExceptionId: string;
      payload: RosterExceptionPayload;
    }) => updateRosterException(monthlyRosterId, rosterExceptionId, payload),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};

export const useRemoveRosterExceptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      monthlyRosterId,
      rosterExceptionId,
      scope,
    }: {
      monthlyRosterId: string;
      rosterExceptionId: string;
      scope?: MonthlyRosterScope;
    }) => removeRosterException(monthlyRosterId, rosterExceptionId, scope),
    onSuccess: async () => {
      await invalidateWorkScheduleQueries(queryClient);
    },
  });
};
