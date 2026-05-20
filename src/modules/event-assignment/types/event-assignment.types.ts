import type { ReferenceSummary } from '@shared/formatting/reference-display';

export type EventAssignmentKind = 'EMPLOYMENT_PROFILE' | 'TALENT' | 'TALENT_GROUP';
export type EventStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type EventStatusGroup = 'ACTIVE';
export type EventAssignmentStatus = 'ACTIVE';

export type EventRecord = {
  id: string;
  eventCode: string;
  title: string;
  studioResourceIds: string[];
  platformAccountIds: string[];
  studioResourceRefs?: ReferenceSummary[];
  platformAccountRefs?: ReferenceSummary[];
  status: EventStatus;
  eventStartAt: number | string;
  eventEndAt: number | string;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type EventListItem = Pick<
  EventRecord,
  'id' | 'eventCode' | 'title' | 'status' | 'eventStartAt' | 'eventEndAt' | 'createdAt'
>;

export type EventRelatedListItem = Pick<
  EventRecord,
  'id' | 'eventCode' | 'title' | 'status' | 'eventStartAt' | 'eventEndAt'
>;

export type EventAssignmentItem = {
  id: string;
  eventId: string;
  assignmentKind: EventAssignmentKind;
  assignmentEmploymentProfileId?: string | null;
  assignmentTalentId?: string | null;
  assignmentTalentGroupId?: string | null;
  assignmentSubjectRef?: ReferenceSummary | null;
  assignmentStatus: EventAssignmentStatus;
  createdAt: number | string;
};

export type EventAssignmentInput = {
  assignmentKind: EventAssignmentKind;
  assignmentEmploymentProfileId?: string | null;
  assignmentTalentId?: string | null;
  assignmentTalentGroupId?: string | null;
};

export type EventListQuery = {
  status?: EventStatus;
  statusGroup?: EventStatusGroup;
  assignmentKind?: EventAssignmentKind;
  assignmentEmploymentProfileId?: string;
  assignmentTalentId?: string;
  assignmentTalentGroupId?: string;
  containsStudioResourceId?: string;
  containsPlatformAccountId?: string;
  windowStartAt?: number;
  windowEndAt?: number;
  eventOverlapStartAt?: number;
  eventOverlapEndAt?: number;
  eventStartFromAt?: number;
  eventStartToAt?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: 'eventStartAt' | 'eventCode' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
};

export type EventByAssignmentQuery = Omit<
  EventListQuery,
  'containsStudioResourceId' | 'containsPlatformAccountId' | 'search'
> & {
  view?: 'by-assignment';
};

export type EventByResourceQuery = Pick<
  EventListQuery,
  'status' | 'windowStartAt' | 'windowEndAt' | 'limit' | 'cursor' | 'sortBy' | 'sortDirection'
> & {
  view?: 'by-resource';
  studioResourceId?: string;
};

export type EventByPlatformQuery = Pick<
  EventListQuery,
  'status' | 'windowStartAt' | 'windowEndAt' | 'limit' | 'cursor' | 'sortBy' | 'sortDirection'
> & {
  view?: 'by-platform';
  platformAccountId?: string;
};

export type EventCreatePayload = {
  eventCode?: string;
  title: string;
  assignments: EventAssignmentInput[];
  eventStartAt: number;
  eventEndAt: number;
  studioResourceIds?: string[];
  platformAccountIds?: string[];
  description?: string | null;
  externalRef?: string | null;
};

export type EventUpdatePayload = {
  title: string;
  description?: string | null;
  externalRef?: string | null;
};

export type EventReschedulePayload = {
  newEventStartAt: number;
  newEventEndAt: number;
};

export type EventReplaceAssignmentsPayload = {
  replacementAssignments: EventAssignmentInput[];
};

export type EventReplaceStudioResourcesPayload = {
  newStudioResourceIds: string[];
};

export type EventReplacePlatformAccountsPayload = {
  newPlatformAccountIds: string[];
};

export type EventLifecycleAction = 'start' | 'complete' | 'cancel' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
