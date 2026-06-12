import { z } from 'zod';

import type {
  CursorPagedResponse,
  EventAssignmentInput,
  EventAssignmentItem,
  EventByAssignmentQuery,
  EventByPlatformQuery,
  EventByResourceQuery,
  EventCreatePayload,
  EventLifecycleAction,
  EventLifecyclePayload,
  EventListItem,
  EventListQuery,
  EventRecord,
  EventRelatedListItem,
  EventReplaceAssignmentsPayload,
  EventReplacePlatformAccountsPayload,
  EventReschedulePayload,
  StudioBooking,
  EventUpdatePayload,
} from '@modules/event-assignment/types/event-assignment.types';
import { apiRequest } from '@shared/api';

const statusSchema = z.enum([
  'DRAFT',
  'PLANNED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);
const studioBookingStatusSchema = z.enum(['HELD', 'CONFIRMED', 'RELEASED', 'CANCELLED']);
const assignmentKindSchema = z.enum(['EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP']);
const timestampSchema = z.union([z.number(), z.string()]);
const referenceSummarySchema = z
  .object({
    id: z.string().trim().min(1),
    code: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    displayName: z.string().optional(),
    handle: z.string().optional(),
    platform: z.string().optional(),
    status: z.string().optional(),
  })
  .strict();

const listItemSchema = z
  .object({
    id: z.string().trim().min(1),
    eventCode: z.string().trim().min(1),
    title: z.string().trim().min(1),
    status: statusSchema,
    eventStartAt: timestampSchema,
    eventEndAt: timestampSchema,
    createdAt: timestampSchema,
  })
  .strict();

const relatedListItemSchema = listItemSchema.omit({ createdAt: true }).strict();

const detailSchema = listItemSchema
  .extend({
    ownerEmploymentProfileId: z.string().trim().min(1),
    ownerEmploymentProfileRef: referenceSummarySchema.nullable().optional(),
    studioResourceIds: z.array(z.string()),
    platformAccountIds: z.array(z.string()),
    studioResourceRefs: z.array(referenceSummarySchema).optional(),
    platformAccountRefs: z.array(referenceSummarySchema).optional(),
    description: z.string().nullable().optional(),
    externalRef: z.string().nullable().optional(),
    plannedAt: timestampSchema.nullable().optional(),
    confirmedAt: timestampSchema.nullable().optional(),
    completedAt: timestampSchema.nullable().optional(),
    cancelledAt: timestampSchema.nullable().optional(),
    cancellationReason: z.string().nullable().optional(),
    lastRescheduledAt: timestampSchema.nullable().optional(),
    lastRescheduleReason: z.string().nullable().optional(),
    updatedAt: timestampSchema,
  })
  .strict();

const studioBookingSchema = z
  .object({
    id: z.string().trim().min(1),
    eventId: z.string().trim().min(1),
    studioResourceId: z.string().trim().min(1),
    studioResourceRef: referenceSummarySchema.nullable().optional(),
    bookingStartAt: timestampSchema,
    bookingEndAt: timestampSchema,
    status: studioBookingStatusSchema,
    cancellationReason: z.string().nullable().optional(),
    releaseReason: z.string().nullable().optional(),
    hasConfirmedConflict: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const assignmentItemSchema = z
  .object({
    id: z.string().trim().min(1),
    eventId: z.string().trim().min(1),
    assignmentKind: assignmentKindSchema,
    assignmentEmploymentProfileId: z.string().nullable().optional(),
    assignmentTalentId: z.string().nullable().optional(),
    assignmentTalentGroupId: z.string().nullable().optional(),
    assignmentSubjectRef: referenceSummarySchema.nullable().optional(),
    assignmentStatus: z.literal('ACTIVE'),
    createdAt: timestampSchema,
  })
  .strict();

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const listResponseSchema = z
  .object({
    data: z.array(listItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const relatedListResponseSchema = z
  .object({
    data: z.array(relatedListItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: detailSchema,
  })
  .strict();

const assignmentListResponseSchema = z
  .object({
    data: z.array(assignmentItemSchema),
  })
  .strict();

const studioBookingListResponseSchema = z
  .object({
    data: z.array(studioBookingSchema),
  })
  .strict();

const sanitizeFlatListQuery = (
  query: EventListQuery,
): Record<string, string | number | undefined> => ({
  status: query.status,
  statusGroup: query.statusGroup,
  assignmentKind: query.assignmentKind,
  assignmentEmploymentProfileId: query.assignmentEmploymentProfileId,
  assignmentTalentId: query.assignmentTalentId,
  assignmentTalentGroupId: query.assignmentTalentGroupId,
  containsStudioResourceId: query.containsStudioResourceId,
  containsPlatformAccountId: query.containsPlatformAccountId,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  eventOverlapStartAt: query.eventOverlapStartAt,
  eventOverlapEndAt: query.eventOverlapEndAt,
  eventStartFromAt: query.eventStartFromAt,
  eventStartToAt: query.eventStartToAt,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByAssignmentQuery = (
  query: EventByAssignmentQuery,
): Record<string, string | number | undefined> => ({
  assignmentKind: query.assignmentKind,
  assignmentEmploymentProfileId: query.assignmentEmploymentProfileId,
  assignmentTalentId: query.assignmentTalentId,
  assignmentTalentGroupId: query.assignmentTalentGroupId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByResourceQuery = (
  query: EventByResourceQuery,
): Record<string, string | number | undefined> => ({
  studioResourceId: query.studioResourceId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeByPlatformQuery = (
  query: EventByPlatformQuery,
): Record<string, string | number | undefined> => ({
  platformAccountId: query.platformAccountId,
  status: query.status,
  windowStartAt: query.windowStartAt,
  windowEndAt: query.windowEndAt,
  limit: query.limit,
  cursor: query.cursor,
  sortBy: query.sortBy,
  sortDirection: query.sortDirection,
});

const sanitizeAssignmentInput = (assignment: EventAssignmentInput): EventAssignmentInput => {
  if (assignment.assignmentKind === 'EMPLOYMENT_PROFILE') {
    return {
      assignmentKind: assignment.assignmentKind,
      assignmentEmploymentProfileId: assignment.assignmentEmploymentProfileId,
    };
  }

  if (assignment.assignmentKind === 'TALENT') {
    return {
      assignmentKind: assignment.assignmentKind,
      assignmentTalentId: assignment.assignmentTalentId,
    };
  }

  return {
    assignmentKind: assignment.assignmentKind,
    assignmentTalentGroupId: assignment.assignmentTalentGroupId,
  };
};

const sanitizeCreatePayload = (payload: EventCreatePayload): EventCreatePayload => {
  const sanitized: EventCreatePayload = {
    title: payload.title,
    ownerEmploymentProfileId: payload.ownerEmploymentProfileId,
    status: payload.status,
    assignments: payload.assignments.map(sanitizeAssignmentInput),
    eventStartAt: payload.eventStartAt,
    eventEndAt: payload.eventEndAt,
    platformAccountIds: payload.platformAccountIds,
    description: payload.description,
    externalRef: payload.externalRef,
  };

  if (payload.eventCode !== undefined) {
    sanitized.eventCode = payload.eventCode;
  }

  return sanitized;
};

const sanitizeReplaceAssignmentsPayload = (
  payload: EventReplaceAssignmentsPayload,
): EventReplaceAssignmentsPayload => ({
  replacementAssignments: payload.replacementAssignments.map(sanitizeAssignmentInput),
});

export const fetchEvents = async (
  query: EventListQuery,
): Promise<CursorPagedResponse<EventListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/events',
    params: sanitizeFlatListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchEventsByAssignment = async (
  query: EventByAssignmentQuery,
): Promise<CursorPagedResponse<EventRelatedListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/events/by-assignment',
    params: sanitizeByAssignmentQuery(query),
  });

  return relatedListResponseSchema.parse(response);
};

export const fetchEventsByResource = async (
  query: EventByResourceQuery,
): Promise<CursorPagedResponse<EventRelatedListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/events/by-resource',
    params: sanitizeByResourceQuery(query),
  });

  return relatedListResponseSchema.parse(response);
};

export const fetchEventsByPlatform = async (
  query: EventByPlatformQuery,
): Promise<CursorPagedResponse<EventRelatedListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/events/by-platform',
    params: sanitizeByPlatformQuery(query),
  });

  return relatedListResponseSchema.parse(response);
};

export const fetchEventDetail = async (eventId: string): Promise<EventRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/events/${encodeURIComponent(eventId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const fetchEventAssignments = async (eventId: string): Promise<EventAssignmentItem[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/events/${encodeURIComponent(eventId)}/assignments`,
  });

  return assignmentListResponseSchema.parse(response).data;
};

export const fetchEventStudioBookings = async (eventId: string): Promise<StudioBooking[]> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/events/${encodeURIComponent(eventId)}/bookings`,
  });

  return studioBookingListResponseSchema.parse(response).data;
};

export const createEvent = async (payload: EventCreatePayload): Promise<EventRecord> => {
  const response = await apiRequest<unknown, EventCreatePayload>({
    method: 'POST',
    url: '/admin/events',
    data: sanitizeCreatePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const updateEvent = async (
  eventId: string,
  payload: EventUpdatePayload,
): Promise<EventRecord> => {
  const response = await apiRequest<unknown, EventUpdatePayload>({
    method: 'PATCH',
    url: `/admin/events/${encodeURIComponent(eventId)}`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const rescheduleEvent = async (
  eventId: string,
  payload: EventReschedulePayload,
): Promise<EventRecord> => {
  const response = await apiRequest<unknown, EventReschedulePayload>({
    method: 'POST',
    url: `/admin/events/${encodeURIComponent(eventId)}/reschedule`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const replaceEventAssignments = async (
  eventId: string,
  payload: EventReplaceAssignmentsPayload,
): Promise<EventRecord> => {
  const response = await apiRequest<unknown, EventReplaceAssignmentsPayload>({
    method: 'POST',
    url: `/admin/events/${encodeURIComponent(eventId)}/assignments`,
    data: sanitizeReplaceAssignmentsPayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const replaceEventPlatformAccounts = async (
  eventId: string,
  payload: EventReplacePlatformAccountsPayload,
): Promise<EventRecord> => {
  const response = await apiRequest<unknown, EventReplacePlatformAccountsPayload>({
    method: 'POST',
    url: `/admin/events/${encodeURIComponent(eventId)}/platform-accounts`,
    data: payload,
  });

  return detailResponseSchema.parse(response).data;
};

export const performEventLifecycleAction = async (
  eventId: string,
  action: EventLifecycleAction,
  payload: EventLifecyclePayload = {},
): Promise<EventRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/events/${encodeURIComponent(eventId)}/${action}`,
    data: action === 'cancel' ? { reason: payload.reason } : {},
  });

  return detailResponseSchema.parse(response).data;
};
