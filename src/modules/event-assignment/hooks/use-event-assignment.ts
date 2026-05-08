import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createEvent,
  fetchEventAssignments,
  fetchEventDetail,
  fetchEvents,
  fetchEventsByAssignment,
  fetchEventsByPlatform,
  fetchEventsByResource,
  performEventLifecycleAction,
  replaceEventAssignments,
  replaceEventPlatformAccounts,
  replaceEventStudioResources,
  rescheduleEvent,
  updateEvent,
} from '@modules/event-assignment/api/event-assignment.api';
import type {
  EventByAssignmentQuery,
  EventByPlatformQuery,
  EventByResourceQuery,
  EventCreatePayload,
  EventLifecycleAction,
  EventListQuery,
  EventReplaceAssignmentsPayload,
  EventReplacePlatformAccountsPayload,
  EventReplaceStudioResourcesPayload,
  EventReschedulePayload,
  EventUpdatePayload,
} from '@modules/event-assignment/types/event-assignment.types';
import {
  eventByAssignmentQueryConfig,
  eventByPlatformQueryConfig,
  eventByResourceQueryConfig,
  eventFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

const EVENT_ASSIGNMENT_QUERY_ROOT = ['event-assignment'] as const;

const toFlatListQueryToken = (query: EventListQuery): string =>
  serializeScreenQueryParams(query, eventFlatListQueryConfig).toString();

const toByAssignmentQueryToken = (query: EventByAssignmentQuery): string =>
  serializeScreenQueryParams(query, eventByAssignmentQueryConfig).toString();

const toByResourceQueryToken = (query: EventByResourceQuery): string =>
  serializeScreenQueryParams(query, eventByResourceQueryConfig).toString();

const toByPlatformQueryToken = (query: EventByPlatformQuery): string =>
  serializeScreenQueryParams(query, eventByPlatformQueryConfig).toString();

export const eventAssignmentQueryKeys = {
  all: (): readonly ['event-assignment'] => EVENT_ASSIGNMENT_QUERY_ROOT,
  flatList: (query: EventListQuery) =>
    ['event-assignment', 'flat-list', toFlatListQueryToken(query)] as const,
  byAssignment: (query: EventByAssignmentQuery) =>
    ['event-assignment', 'by-assignment', toByAssignmentQueryToken(query)] as const,
  byResource: (query: EventByResourceQuery) =>
    ['event-assignment', 'by-resource', toByResourceQueryToken(query)] as const,
  byPlatform: (query: EventByPlatformQuery) =>
    ['event-assignment', 'by-platform', toByPlatformQueryToken(query)] as const,
  detail: (eventId: string) => ['event-assignment', 'detail', eventId] as const,
  assignments: (eventId: string) => ['event-assignment', 'assignments', eventId] as const,
};

export const useEventFlatList = (query: EventListQuery, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: eventAssignmentQueryKeys.flatList(query),
    queryFn: () => fetchEvents(query),
    enabled: options?.enabled ?? true,
  });
};

export const useEventsByAssignment = (
  query: EventByAssignmentQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: eventAssignmentQueryKeys.byAssignment(query),
    queryFn: () => fetchEventsByAssignment(query),
    enabled: options?.enabled ?? true,
  });
};

export const useEventsByResource = (
  query: EventByResourceQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: eventAssignmentQueryKeys.byResource(query),
    queryFn: () => fetchEventsByResource(query),
    enabled: options?.enabled ?? true,
  });
};

export const useEventsByPlatform = (
  query: EventByPlatformQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: eventAssignmentQueryKeys.byPlatform(query),
    queryFn: () => fetchEventsByPlatform(query),
    enabled: options?.enabled ?? true,
  });
};

export const useEventDetail = (eventId?: string) => {
  return useQuery({
    queryKey: eventId
      ? eventAssignmentQueryKeys.detail(eventId)
      : [...EVENT_ASSIGNMENT_QUERY_ROOT, 'detail'],
    queryFn: () => fetchEventDetail(eventId ?? ''),
    enabled: Boolean(eventId),
  });
};

export const useEventAssignments = (eventId?: string) => {
  return useQuery({
    queryKey: eventId
      ? eventAssignmentQueryKeys.assignments(eventId)
      : [...EVENT_ASSIGNMENT_QUERY_ROOT, 'assignments'],
    queryFn: () => fetchEventAssignments(eventId ?? ''),
    enabled: Boolean(eventId),
  });
};

const invalidateEventAssignmentQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: EVENT_ASSIGNMENT_QUERY_ROOT });
};

export const useCreateEventMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: EventCreatePayload) => createEvent(payload),
    onSuccess: async () => {
      await invalidateEventAssignmentQueries(queryClient);
    },
  });
};

export const useUpdateEventMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, payload }: { eventId: string; payload: EventUpdatePayload }) =>
      updateEvent(eventId, payload),
    onSuccess: async () => {
      await invalidateEventAssignmentQueries(queryClient);
    },
  });
};

export const useRescheduleEventMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, payload }: { eventId: string; payload: EventReschedulePayload }) =>
      rescheduleEvent(eventId, payload),
    onSuccess: async () => {
      await invalidateEventAssignmentQueries(queryClient);
    },
  });
};

export const useReplaceEventAssignmentsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: EventReplaceAssignmentsPayload;
    }) => replaceEventAssignments(eventId, payload),
    onSuccess: async () => {
      await invalidateEventAssignmentQueries(queryClient);
    },
  });
};

export const useReplaceEventStudioResourcesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: EventReplaceStudioResourcesPayload;
    }) => replaceEventStudioResources(eventId, payload),
    onSuccess: async () => {
      await invalidateEventAssignmentQueries(queryClient);
    },
  });
};

export const useReplaceEventPlatformAccountsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: EventReplacePlatformAccountsPayload;
    }) => replaceEventPlatformAccounts(eventId, payload),
    onSuccess: async () => {
      await invalidateEventAssignmentQueries(queryClient);
    },
  });
};

export const useEventLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, action }: { eventId: string; action: EventLifecycleAction }) =>
      performEventLifecycleAction(eventId, action),
    onSuccess: async () => {
      await invalidateEventAssignmentQueries(queryClient);
    },
  });
};
