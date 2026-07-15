import type {
  KpiAllocation,
  KpiAllocationLifecycleStatus,
  KpiAllocationMode,
  KpiPlanLifecycleStatus,
  KpiTargetMetricInput,
} from '@modules/kpi/types/kpi.types';

const scale = 1_000_000n;

export const readPlanLifecycleStatus = (status: string): KpiPlanLifecycleStatus =>
  status === 'PUBLISHED' ? 'ACTIVE' : (status as KpiPlanLifecycleStatus);

export const readAllocationLifecycleStatus = (
  allocation: Pick<KpiAllocation, 'allocationStatus' | 'lifecycleStatus' | 'rejectionReason'>,
): KpiAllocationLifecycleStatus | 'LEGACY_REJECTED' | 'LEGACY_TERMINAL' => {
  if (allocation.lifecycleStatus) return allocation.lifecycleStatus;
  if (allocation.allocationStatus === 'PENDING_APPROVAL') return 'SUBMITTED';
  if (allocation.allocationStatus === 'REJECTED') {
    return allocation.rejectionReason?.trim() ? 'CHANGES_REQUESTED' : 'LEGACY_REJECTED';
  }
  if (['ACTIVE', 'CLOSED', 'CANCELLED'].includes(allocation.allocationStatus)) {
    return 'LEGACY_TERMINAL';
  }
  return allocation.allocationStatus as KpiAllocationLifecycleStatus;
};

export const isAllocationVisibleToMember = (
  allocation: Pick<KpiAllocation, 'allocationStatus' | 'lifecycleStatus' | 'publishedAt'>,
): boolean =>
  (allocation.lifecycleStatus ?? allocation.allocationStatus) === 'PUBLISHED' &&
  allocation.publishedAt !== null;

export type AllocationMetricPreview = {
  metricCode: string;
  target: string;
  memberTotal: string;
  groupRemainder: string;
  delta: string;
  exact: boolean;
  overAllocated: boolean;
};

export const previewExactAllocation = (input: {
  targetMetrics: readonly KpiTargetMetricInput[];
  rows: readonly { targetMetrics: readonly KpiTargetMetricInput[] }[];
  mode?: KpiAllocationMode;
  groupRemainders?: Readonly<Record<string, string>>;
}): readonly AllocationMetricPreview[] =>
  input.targetMetrics.map((target) => {
    const targetValue = parseDecimal(String(target.targetValue));
    const memberTotal = input.rows.reduce((total, row) => {
      const metric = row.targetMetrics.find((item) => item.metricCode === target.metricCode);
      return total + parseDecimal(String(metric?.targetValue ?? 0));
    }, 0n);
    const mode = input.mode ?? 'MEMBER_ALLOCATED';
    const groupRemainder =
      mode === 'HYBRID'
        ? parseDecimal(input.groupRemainders?.[target.metricCode] ?? '0')
        : mode === 'GROUP_ONLY'
          ? targetValue
          : 0n;
    const delta = targetValue - memberTotal - groupRemainder;
    return {
      metricCode: target.metricCode,
      target: formatDecimal(targetValue),
      memberTotal: formatDecimal(memberTotal),
      groupRemainder: formatDecimal(groupRemainder),
      delta: formatDecimal(delta),
      exact: delta === 0n,
      overAllocated: delta < 0n,
    };
  });

export const hasStaleAllocationSource = (
  planUpdatedAt: number | string,
  allocations: readonly Pick<KpiAllocation, 'sourcePlanVersion'>[],
): boolean => {
  const version = Number(planUpdatedAt);
  return allocations.some(
    (allocation) =>
      allocation.sourcePlanVersion !== undefined && allocation.sourcePlanVersion !== version,
  );
};

const parseDecimal = (value: string): bigint => {
  const normalized = value.trim();
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/u.test(normalized)) {
    throw new Error('KPI allocation value must be a canonical decimal with at most 6 places');
  }
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.');
  const result = BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'));
  return negative ? -result : result;
};

const formatDecimal = (value: bigint): string => {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(6, '0').replace(/0+$/u, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
};
