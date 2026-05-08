import { useQuery } from '@tanstack/react-query';

import { fetchDashboardLiteSnapshot } from '@modules/dashboard-lite/api/dashboard-lite.api';

export const DASHBOARD_LITE_SNAPSHOT_QUERY_KEY = ['dashboard-lite', 'snapshot'] as const;

export const useDashboardLiteSnapshot = () => {
  return useQuery({
    queryKey: DASHBOARD_LITE_SNAPSHOT_QUERY_KEY,
    queryFn: fetchDashboardLiteSnapshot,
  });
};
