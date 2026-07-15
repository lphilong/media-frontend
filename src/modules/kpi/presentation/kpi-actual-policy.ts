import type {
  KpiActualAggregationMethod,
  KpiActualCaptureMode,
  KpiActualEvidenceMode,
  KpiActualLifecycleStatus,
  KpiActualReviewMode,
} from '../types/kpi.types';

export type ActualDeadlineStage =
  | 'DIRECT_ENTRY'
  | 'ORDINARY_CORRECTION'
  | 'LATE_CORRECTION_REVIEW_REQUIRED'
  | 'LOCKED';

export function resolveActualDeadlineStage(input: {
  actualDate: string;
  periodMonth: string;
  now: number;
}): ActualDeadlineStage {
  const directEntryClosesAt = localDateTimeToUtcMs(input.actualDate, '12:00', 1);
  const ordinaryCorrectionClosesAt = localDateTimeToUtcMs(input.actualDate, '18:00', 2);
  const periodLocksAt = followingMonthLockAt(input.periodMonth, 3, '18:00');
  if (input.now <= directEntryClosesAt) return 'DIRECT_ENTRY';
  if (input.now <= ordinaryCorrectionClosesAt) return 'ORDINARY_CORRECTION';
  if (input.now <= periodLocksAt) return 'LATE_CORRECTION_REVIEW_REQUIRED';
  return 'LOCKED';
}

export type ActualPolicyPresentation = {
  sourceLabel: string;
  lifecycleLabel: string;
  captureLabel: string;
  aggregationLabel: string;
  reviewLabel: string;
  evidenceLabel: string;
  canManualEntry: boolean;
  canAttachEvidence: boolean;
  requiresEvidence: boolean;
  requiresReview: boolean;
  warnsAgainstSourceImplication: boolean;
};

export function presentActualPolicy(input: {
  source: 'MANUAL' | 'IMPORTED_SOURCE' | 'DERIVED';
  lifecycle?: KpiActualLifecycleStatus;
  captureMode?: KpiActualCaptureMode;
  aggregationMethod?: KpiActualAggregationMethod;
  reviewMode?: KpiActualReviewMode;
  evidenceMode?: KpiActualEvidenceMode;
}): ActualPolicyPresentation {
  const captureMode = input.captureMode ?? 'MEMBER_ENTRY';
  const aggregationMethod = input.aggregationMethod ?? 'SUM';
  const reviewMode = input.reviewMode ?? 'NONE';
  const evidenceMode = input.evidenceMode ?? 'NONE';
  return {
    sourceLabel: input.source.replaceAll('_', ' '),
    lifecycleLabel: (input.lifecycle ?? 'POSTED').replaceAll('_', ' '),
    captureLabel: captureMode.replaceAll('_', ' '),
    aggregationLabel: aggregationMethod,
    reviewLabel: reviewMode.replaceAll('_', ' '),
    evidenceLabel: evidenceMode.replaceAll('_', ' '),
    canManualEntry: captureMode === 'GROUP_ENTRY' || captureMode === 'MEMBER_ENTRY',
    canAttachEvidence: evidenceMode === 'OPTIONAL' || evidenceMode === 'REQUIRED',
    requiresEvidence: evidenceMode === 'REQUIRED',
    requiresReview: reviewMode !== 'NONE',
    // Imported and derived records identify their configured source only. The
    // UI must never infer Revenue, Attendance, or Payroll ownership.
    warnsAgainstSourceImplication: input.source !== 'MANUAL',
  };
}

export function memberActualVisibility(input: {
  ownRecord: boolean;
  publishedTarget: boolean;
  lifecycle: KpiActualLifecycleStatus;
  approvedGroupAggregate: boolean;
}): {
  showPersonalProgress: boolean;
  showGroupAggregate: boolean;
  showPeerDetail: false;
  showEvidence: false;
  showRanking: false;
} {
  return {
    showPersonalProgress:
      input.ownRecord &&
      input.publishedTarget &&
      (input.lifecycle === 'ACCEPTED' || input.lifecycle === 'CORRECTED'),
    showGroupAggregate: input.approvedGroupAggregate,
    showPeerDetail: false,
    showEvidence: false,
    showRanking: false,
  };
}

function localDateTimeToUtcMs(dateText: string, timeText: string, dayOffset: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) throw new Error(`Invalid local date: ${dateText}`);
  const [hour, minute] = timeText.split(':').map(Number);
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + dayOffset,
    (hour ?? 0) - 7,
    minute ?? 0,
  );
}

function followingMonthLockAt(periodMonth: string, day: number, timeText: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(periodMonth);
  if (!match) throw new Error(`Invalid period month: ${periodMonth}`);
  const [hour, minute] = timeText.split(':').map(Number);
  return Date.UTC(Number(match[1]), Number(match[2]), day, (hour ?? 0) - 7, minute ?? 0);
}
