import { describe, expect, it } from 'vitest';
import {
  hasStaleAllocationSource,
  isAllocationVisibleToMember,
  previewExactAllocation,
  readAllocationLifecycleStatus,
  readPlanLifecycleStatus,
} from '@modules/kpi/presentation/kpi-allocation-lifecycle';

describe('KPI allocation lifecycle presentation', () => {
  it('presents canonical and historical lifecycle labels', () => {
    expect(readPlanLifecycleStatus('PUBLISHED')).toBe('ACTIVE');
    expect(
      readAllocationLifecycleStatus({
        allocationStatus: 'PENDING_APPROVAL',
        rejectionReason: null,
      }),
    ).toBe('SUBMITTED');
  });

  it('calculates totals and deltas with exact decimal arithmetic', () => {
    const [preview] = previewExactAllocation({
      targetMetrics: [{ metricCode: 'LIVE_HOURS', targetValue: 0.3 }],
      rows: [
        { targetMetrics: [{ metricCode: 'LIVE_HOURS', targetValue: 0.1 }] },
        { targetMetrics: [{ metricCode: 'LIVE_HOURS', targetValue: 0.2 }] },
      ],
    });
    expect(preview).toMatchObject({ memberTotal: '0.3', delta: '0', exact: true });
  });

  it('shows explicit hybrid remainder and over-allocation', () => {
    const [hybrid] = previewExactAllocation({
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 100 }],
      rows: [{ targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 70 }] }],
      mode: 'HYBRID',
      groupRemainders: { REVENUE_VND: '30' },
    });
    const [over] = previewExactAllocation({
      targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 100 }],
      rows: [{ targetMetrics: [{ metricCode: 'REVENUE_VND', targetValue: 101 }] }],
    });
    expect(hybrid).toMatchObject({ groupRemainder: '30', exact: true });
    expect(over).toMatchObject({ overAllocated: true, exact: false });
  });

  it('blocks stale source and member visibility before publication', () => {
    expect(hasStaleAllocationSource(20, [{ sourcePlanVersion: 19 }])).toBe(true);
    expect(
      isAllocationVisibleToMember({
        allocationStatus: 'APPROVED',
        lifecycleStatus: 'APPROVED',
        publishedAt: null,
      }),
    ).toBe(false);
    expect(
      isAllocationVisibleToMember({
        allocationStatus: 'PUBLISHED',
        lifecycleStatus: 'PUBLISHED',
        publishedAt: 20,
      }),
    ).toBe(true);
  });
});
