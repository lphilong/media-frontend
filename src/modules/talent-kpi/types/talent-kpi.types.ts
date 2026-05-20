export type TalentKpiStatus = 'DRAFT' | 'FINALIZED' | 'ARCHIVED';
export type TalentKpiMeasurementSource = 'MANUAL';
export type TalentKpiSortBy = 'periodStartAt' | 'kpiRecordCode' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  status?: string;
};

export type TalentKpiMetricCode =
  | 'LIVESTREAM_HOURS'
  | 'REVENUE_ATTRIBUTED_AMOUNT'
  | 'LIVESTREAM_SESSION_COUNT'
  | 'CONTENT_PUBLISH_COUNT'
  | 'EVENT_APPEARANCE_COUNT'
  | 'ENGAGEMENT_COUNT'
  | 'FOLLOWER_DELTA';

export const talentKpiMetricCodeValues: TalentKpiMetricCode[] = [
  'LIVESTREAM_HOURS',
  'REVENUE_ATTRIBUTED_AMOUNT',
  'LIVESTREAM_SESSION_COUNT',
  'CONTENT_PUBLISH_COUNT',
  'EVENT_APPEARANCE_COUNT',
  'ENGAGEMENT_COUNT',
  'FOLLOWER_DELTA',
];

export type TalentKpiRecord = {
  id: string;
  kpiRecordCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  subjectTalentRef?: ReferenceSummary | null;
  attributionPlatformAccountRef?: ReferenceSummary | null;
  attributionEventRef?: ReferenceSummary | null;
  measurementSource: TalentKpiMeasurementSource;
  status: TalentKpiStatus;
  periodStartAt: number | string;
  periodEndAt: number | string;
  publishedAt?: number | string | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type TalentKpiListItem = Pick<
  TalentKpiRecord,
  | 'id'
  | 'kpiRecordCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionPlatformAccountId'
  | 'attributionEventId'
  | 'subjectTalentRef'
  | 'attributionPlatformAccountRef'
  | 'attributionEventRef'
  | 'measurementSource'
  | 'status'
  | 'periodStartAt'
  | 'periodEndAt'
  | 'publishedAt'
  | 'createdAt'
>;

export type TalentKpiByTalentItem = Pick<
  TalentKpiRecord,
  | 'id'
  | 'kpiRecordCode'
  | 'title'
  | 'subjectTalentId'
  | 'status'
  | 'measurementSource'
  | 'periodStartAt'
  | 'periodEndAt'
  | 'publishedAt'
>;

export type TalentKpiByPlatformItem = Pick<
  TalentKpiRecord,
  | 'id'
  | 'kpiRecordCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionPlatformAccountId'
  | 'status'
  | 'periodStartAt'
  | 'periodEndAt'
>;

export type TalentKpiByEventItem = Pick<
  TalentKpiRecord,
  | 'id'
  | 'kpiRecordCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionEventId'
  | 'status'
  | 'periodStartAt'
  | 'periodEndAt'
>;

export type TalentKpiMetric = {
  id?: string;
  metricCode: TalentKpiMetricCode;
  numericValue: number;
  createdAt?: number | string;
  updatedAt?: number | string;
};

export type TalentKpiFlatListQuery = {
  status?: TalentKpiStatus;
  subjectTalentId?: string;
  attributionPlatformAccountId?: string;
  attributionEventId?: string;
  measurementSource?: TalentKpiMeasurementSource;
  containsMetricCode?: TalentKpiMetricCode;
  windowStartAt?: number;
  windowEndAt?: number;
  createdBeforeAt?: number;
  publishedFromAt?: number;
  publishedToAt?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: TalentKpiSortBy;
  sortDirection?: SortDirection;
};

export type TalentKpiByTalentQuery = Pick<
  TalentKpiFlatListQuery,
  | 'subjectTalentId'
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-talent';
};

export type TalentKpiByPlatformQuery = Pick<
  TalentKpiFlatListQuery,
  | 'attributionPlatformAccountId'
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-platform';
};

export type TalentKpiByEventQuery = Pick<
  TalentKpiFlatListQuery,
  | 'attributionEventId'
  | 'status'
  | 'windowStartAt'
  | 'windowEndAt'
  | 'limit'
  | 'cursor'
  | 'sortBy'
  | 'sortDirection'
> & {
  view?: 'by-event';
};

export type TalentKpiMetricInput = {
  metricCode: TalentKpiMetricCode;
  numericValue: number;
};

export type TalentKpiCreatePayload = {
  kpiRecordCode?: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  measurementSource: TalentKpiMeasurementSource;
  periodStartAt: number;
  periodEndAt: number;
  metrics: TalentKpiMetricInput[];
  description?: string | null;
  externalRef?: string | null;
};

export type TalentKpiDraftCorePayload = {
  title?: string;
  subjectTalentId?: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  periodStartAt?: number;
  periodEndAt?: number;
  description?: string | null;
  externalRef?: string | null;
};

export type TalentKpiMetricsReplacementPayload = {
  metrics: TalentKpiMetricInput[];
};

export type TalentKpiLifecycleAction = 'finalize' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
