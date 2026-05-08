export type RevenueEntryStatus = 'DRAFT' | 'FINALIZED' | 'RECONCILED' | 'VOIDED' | 'ARCHIVED';
export type RevenueKind = 'PLATFORM_LIVESTREAM' | 'PLATFORM_CONTENT' | 'EVENT_OPERATIONAL';
export type RevenueEntrySource = 'MANUAL';
export type RevenueLedgerSortBy = 'recognizedAt' | 'revenueEntryCode' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export const revenueEntryStatusValues: RevenueEntryStatus[] = [
  'DRAFT',
  'FINALIZED',
  'RECONCILED',
  'VOIDED',
  'ARCHIVED',
];

export const revenueKindValues: RevenueKind[] = [
  'PLATFORM_LIVESTREAM',
  'PLATFORM_CONTENT',
  'EVENT_OPERATIONAL',
];

export type RevenueEntryRecord = {
  id: string;
  revenueEntryCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  revenueKind: RevenueKind;
  entrySource: RevenueEntrySource;
  status: RevenueEntryStatus;
  currencyCode: string;
  recognizedAmount: number;
  recognizedAt: number | string;
  finalizedAt?: number | string | null;
  reconciledAt?: number | string | null;
  voidedAt?: number | string | null;
  reconciliationReference?: string | null;
  description?: string | null;
  externalRef?: string | null;
  createdAt: number | string;
  updatedAt: number | string;
};

export type RevenueEntryListItem = Pick<
  RevenueEntryRecord,
  | 'id'
  | 'revenueEntryCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionPlatformAccountId'
  | 'attributionEventId'
  | 'revenueKind'
  | 'entrySource'
  | 'status'
  | 'currencyCode'
  | 'recognizedAmount'
  | 'recognizedAt'
  | 'createdAt'
>;

export type RevenueEntryByTalentItem = Pick<
  RevenueEntryRecord,
  | 'id'
  | 'revenueEntryCode'
  | 'title'
  | 'subjectTalentId'
  | 'revenueKind'
  | 'entrySource'
  | 'status'
  | 'currencyCode'
  | 'recognizedAmount'
  | 'recognizedAt'
>;

export type RevenueEntryByPlatformItem = Pick<
  RevenueEntryRecord,
  | 'id'
  | 'revenueEntryCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionPlatformAccountId'
  | 'status'
  | 'currencyCode'
  | 'recognizedAmount'
  | 'recognizedAt'
>;

export type RevenueEntryByEventItem = Pick<
  RevenueEntryRecord,
  | 'id'
  | 'revenueEntryCode'
  | 'title'
  | 'subjectTalentId'
  | 'attributionEventId'
  | 'status'
  | 'currencyCode'
  | 'recognizedAmount'
  | 'recognizedAt'
>;

export type RevenueLedgerFlatListQuery = {
  status?: RevenueEntryStatus;
  subjectTalentId?: string;
  attributionPlatformAccountId?: string;
  attributionEventId?: string;
  revenueKind?: RevenueKind;
  entrySource?: RevenueEntrySource;
  currencyCode?: string;
  windowStartAt?: number;
  windowEndAt?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: RevenueLedgerSortBy;
  sortDirection?: SortDirection;
};

export type RevenueLedgerByTalentQuery = Pick<
  RevenueLedgerFlatListQuery,
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

export type RevenueLedgerByPlatformQuery = Pick<
  RevenueLedgerFlatListQuery,
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

export type RevenueLedgerByEventQuery = Pick<
  RevenueLedgerFlatListQuery,
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

export type RevenueEntryCreatePayload = {
  revenueEntryCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  revenueKind: RevenueKind;
  entrySource: RevenueEntrySource;
  currencyCode: string;
  recognizedAmount: number;
  recognizedAt: number;
  description?: string | null;
  externalRef?: string | null;
};

export type RevenueEntryDraftCorePayload = {
  title?: string;
  description?: string | null;
  externalRef?: string | null;
  subjectTalentId?: string;
  attributionPlatformAccountId?: string | null;
  attributionEventId?: string | null;
  revenueKind?: RevenueKind;
  currencyCode?: string;
  recognizedAmount?: number;
  recognizedAt?: number;
};

export type RevenueEntryReconcilePayload = {
  reconciliationReference?: string | null;
};

export type RevenueLedgerLifecycleAction = 'finalize' | 'reconcile' | 'void' | 'archive';

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
