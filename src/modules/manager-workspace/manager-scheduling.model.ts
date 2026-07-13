import type {
  ManagerAvailabilityBatchLine,
  ManagerRequestBatchLine,
  ManagerSubmitRequestBatchLinePayload,
  ManagerWorkScheduleAvailabilityTaxonomyCode,
  ManagerWorkScheduleAvailabilityType,
  ManagerWorkScheduleRequestType,
} from './api/manager-workspace.api';
export type { ManagerWorkScheduleRequestType } from './api/manager-workspace.api';

export type ManagerWorkTab = 'published' | 'requests' | 'availability';

export type DraftRequestLine = ManagerSubmitRequestBatchLinePayload & {
  localId: string;
  startLocal: string;
  endLocal: string;
};

export const requestTypeOptions: readonly ManagerWorkScheduleRequestType[] = [
  'CREATE_SHIFT',
  'RESCHEDULE_SHIFT',
  'CANCEL_SHIFT',
];

export const managerRequestStatusTone = {
  PENDING: 'warning',
  PARTIALLY_APPROVED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'muted',
  FAILED_TO_APPLY: 'danger',
} as const;

export const getHcmMonth = (timestamp = Date.now()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(timestamp));
  return `${parts.find((part) => part.type === 'year')?.value}-${
    parts.find((part) => part.type === 'month')?.value
  }`;
};

export const getAllowedRequestMonths = (): string[] => {
  const [yearText, monthText] = getHcmMonth().split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return [0, 1, 2].map((offset) => {
    const monthIndex = month - 1 + offset;
    const nextYear = year + Math.floor(monthIndex / 12);
    const nextMonth = (monthIndex % 12) + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  });
};

export const hcmLocalToTimestamp = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(`${value}:00+07:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const timestampToDateTimeLocal = (value: number): string => {
  const date = new Date(value + 7 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
};

export const createDraftRequestLine = (
  requestType: ManagerWorkScheduleRequestType,
  memberEmploymentProfileId: string,
  defaultTitle: string,
  workShiftId?: string,
): DraftRequestLine => ({
  localId: `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  requestType,
  memberEmploymentProfileId,
  ...(workShiftId ? { workShiftId } : {}),
  requestedStartAt: null,
  requestedEndAt: null,
  timezone: 'Asia/Ho_Chi_Minh',
  title: requestType === 'CREATE_SHIFT' ? defaultTitle : null,
  reason: '',
  startLocal: '',
  endLocal: '',
});

export const formatManagerRequestTimestamp = (
  value: number | null,
  timezone = 'Asia/Ho_Chi_Minh',
): string =>
  value === null
    ? '-'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(value);

export const managerRequestLineDecisionText = (line: ManagerRequestBatchLine): string | null =>
  line.failureReason ??
  line.rejectionReason ??
  line.cancellationReason ??
  line.approvalNote ??
  null;

export type ManagerSchedulingCancellation =
  | { readonly kind: 'request-batch'; readonly batchId: string }
  | { readonly kind: 'request-line'; readonly batchId: string; readonly lineId: string }
  | { readonly kind: 'availability-batch'; readonly batchId: string }
  | { readonly kind: 'availability-line'; readonly batchId: string; readonly lineId: string };

export const requestTypeLabelKey = (
  value: ManagerWorkScheduleRequestType,
): `manager-workspace:requests.types.${ManagerWorkScheduleRequestType}` =>
  `manager-workspace:requests.types.${value}`;

export const availabilityTypeLabelKey = (
  value: ManagerWorkScheduleAvailabilityType,
): `manager-workspace:availability.types.${ManagerWorkScheduleAvailabilityType}` =>
  `manager-workspace:availability.types.${value}`;

export const availabilityTaxonomyLabelKey = (
  value: ManagerWorkScheduleAvailabilityTaxonomyCode,
): `manager-workspace:availability.taxonomy.${ManagerWorkScheduleAvailabilityTaxonomyCode}` =>
  `manager-workspace:availability.taxonomy.${value}`;

export const availabilityStatusLabelKey = (
  value: ManagerAvailabilityBatchLine['status'],
): `manager-workspace:availability.statuses.${ManagerAvailabilityBatchLine['status']}` =>
  `manager-workspace:availability.statuses.${value}`;

export const availabilityApplyStatusLabelKey = (
  value: ManagerAvailabilityBatchLine['applyStatus'],
): `manager-workspace:availability.applyStatuses.${ManagerAvailabilityBatchLine['applyStatus']}` =>
  `manager-workspace:availability.applyStatuses.${value}`;

export const availabilityPolicyLabelKey = (
  value: ManagerAvailabilityBatchLine['policyEvaluationStatus'],
): `manager-workspace:availability.policyStatuses.${ManagerAvailabilityBatchLine['policyEvaluationStatus']}` =>
  `manager-workspace:availability.policyStatuses.${value}`;

export const requestLineStatusLabelKey = (
  value: ManagerRequestBatchLine['status'],
): `manager-workspace:requests.lineStatuses.${ManagerRequestBatchLine['status']}` =>
  `manager-workspace:requests.lineStatuses.${value}`;
