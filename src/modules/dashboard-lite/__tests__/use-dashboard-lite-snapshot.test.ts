import { useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchDashboardLiteSnapshot } from '@modules/dashboard-lite/api/dashboard-lite.api';
import {
  DASHBOARD_LITE_REFRESH_INTERVAL_MS,
  DASHBOARD_LITE_SNAPSHOT_QUERY_KEY,
  useDashboardLiteSnapshot,
} from '@modules/dashboard-lite/hooks/use-dashboard-lite-snapshot';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@modules/dashboard-lite/api/dashboard-lite.api', () => ({
  fetchDashboardLiteSnapshot: vi.fn(),
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('useDashboardLiteSnapshot', () => {
  beforeEach(() => {
    mockedUseQuery.mockReset();
  });

  it('configures Dashboard Lite refresh options without changing the query key', () => {
    renderHook(() => useDashboardLiteSnapshot());

    expect(mockedUseQuery).toHaveBeenCalledWith({
      queryKey: DASHBOARD_LITE_SNAPSHOT_QUERY_KEY,
      queryFn: fetchDashboardLiteSnapshot,
      refetchInterval: 10 * 60_000,
      staleTime: 10 * 60_000,
      refetchOnWindowFocus: false,
    });
    expect(DASHBOARD_LITE_REFRESH_INTERVAL_MS).toBe(10 * 60_000);
  });
});
