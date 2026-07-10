import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approvePlatformEarningBatch,
  createRevenueEntryFromPlatformEarningBatch,
  createRevenueEntry,
  fetchRevenueEntries,
  fetchRevenueEntriesByEvent,
  fetchRevenueEntriesByPlatform,
  fetchRevenueEntriesByTalent,
  fetchRevenueEntryDetail,
  fetchPlatformEarningBatchDetail,
  fetchPlatformEarningBatches,
  fetchPlatformEarningLines,
  performPlatformEarningLifecycleAction,
  performRevenueEntryLifecycleAction,
  reconcileRevenueEntry,
  rejectPlatformEarningBatch,
  updateRevenueEntryDraftCore,
  voidPlatformEarningBatch,
} from '@modules/revenue-ledger/api/revenue-ledger.api';
import type {
  CreateRevenueEntryFromPlatformEarningPayload,
  PlatformEarningApprovePayload,
  PlatformEarningBatchQuery,
  PlatformEarningLineQuery,
  PlatformEarningReasonPayload,
  RevenueEntryCreatePayload,
  RevenueEntryDraftCorePayload,
  RevenueEntryReconcilePayload,
  RevenueLedgerByEventQuery,
  RevenueLedgerByPlatformQuery,
  RevenueLedgerByTalentQuery,
  RevenueLedgerFlatListQuery,
  RevenueLedgerLifecycleAction,
} from '@modules/revenue-ledger/types/revenue-ledger.types';
import {
  revenueLedgerByEventQueryConfig,
  revenueLedgerByPlatformQueryConfig,
  revenueLedgerByTalentQueryConfig,
  revenueLedgerFlatListQueryConfig,
} from '@modules/revenue-ledger';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';

const REVENUE_LEDGER_QUERY_ROOT = ['revenue-ledger'] as const;

const toFlatListQueryToken = (query: RevenueLedgerFlatListQuery): string =>
  serializeScreenQueryParams(query, revenueLedgerFlatListQueryConfig).toString();

const toByTalentQueryToken = (query: RevenueLedgerByTalentQuery): string =>
  serializeScreenQueryParams(query, revenueLedgerByTalentQueryConfig).toString();

const toByPlatformQueryToken = (query: RevenueLedgerByPlatformQuery): string =>
  serializeScreenQueryParams(query, revenueLedgerByPlatformQueryConfig).toString();

const toByEventQueryToken = (query: RevenueLedgerByEventQuery): string =>
  serializeScreenQueryParams(query, revenueLedgerByEventQueryConfig).toString();

const toPlatformEarningQueryToken = (query: PlatformEarningBatchQuery): string =>
  new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();

const toPlatformEarningLineQueryToken = (query: PlatformEarningLineQuery): string =>
  new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();

export const revenueLedgerQueryKeys = {
  all: (): readonly ['revenue-ledger'] => REVENUE_LEDGER_QUERY_ROOT,
  flatList: (query: RevenueLedgerFlatListQuery) =>
    ['revenue-ledger', 'flat-list', toFlatListQueryToken(query)] as const,
  byTalent: (query: RevenueLedgerByTalentQuery) =>
    ['revenue-ledger', 'by-talent', toByTalentQueryToken(query)] as const,
  byPlatform: (query: RevenueLedgerByPlatformQuery) =>
    ['revenue-ledger', 'by-platform', toByPlatformQueryToken(query)] as const,
  byEvent: (query: RevenueLedgerByEventQuery) =>
    ['revenue-ledger', 'by-event', toByEventQueryToken(query)] as const,
  detail: (revenueEntryId: string) => ['revenue-ledger', 'detail', revenueEntryId] as const,
  platformEarnings: (query: PlatformEarningBatchQuery) =>
    ['revenue-ledger', 'platform-earnings', toPlatformEarningQueryToken(query)] as const,
  platformEarningDetail: (batchId: string) =>
    ['revenue-ledger', 'platform-earnings', 'detail', batchId] as const,
  platformEarningLines: (query: PlatformEarningLineQuery) =>
    [
      'revenue-ledger',
      'platform-earnings',
      'lines',
      toPlatformEarningLineQueryToken(query),
    ] as const,
};

export const useRevenueLedgerFlatList = (
  query: RevenueLedgerFlatListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: revenueLedgerQueryKeys.flatList(query),
    queryFn: () => fetchRevenueEntries(query),
    enabled: options?.enabled ?? true,
  });
};

export const useRevenueLedgerByTalent = (
  query: RevenueLedgerByTalentQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: revenueLedgerQueryKeys.byTalent(query),
    queryFn: () => fetchRevenueEntriesByTalent(query),
    enabled: options?.enabled ?? true,
  });
};

export const useRevenueLedgerByPlatform = (
  query: RevenueLedgerByPlatformQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: revenueLedgerQueryKeys.byPlatform(query),
    queryFn: () => fetchRevenueEntriesByPlatform(query),
    enabled: options?.enabled ?? true,
  });
};

export const useRevenueLedgerByEvent = (
  query: RevenueLedgerByEventQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: revenueLedgerQueryKeys.byEvent(query),
    queryFn: () => fetchRevenueEntriesByEvent(query),
    enabled: options?.enabled ?? true,
  });
};

export const useRevenueEntryDetail = (revenueEntryId?: string) => {
  return useQuery({
    queryKey: revenueEntryId
      ? revenueLedgerQueryKeys.detail(revenueEntryId)
      : [...REVENUE_LEDGER_QUERY_ROOT, 'detail'],
    queryFn: () => fetchRevenueEntryDetail(revenueEntryId ?? ''),
    enabled: Boolean(revenueEntryId),
  });
};

export const usePlatformEarningBatches = (query: PlatformEarningBatchQuery) =>
  useQuery({
    queryKey: revenueLedgerQueryKeys.platformEarnings(query),
    queryFn: () => fetchPlatformEarningBatches(query),
  });

export const usePlatformEarningBatchDetail = (batchId?: string) =>
  useQuery({
    queryKey: batchId
      ? revenueLedgerQueryKeys.platformEarningDetail(batchId)
      : [...REVENUE_LEDGER_QUERY_ROOT, 'platform-earnings', 'detail'],
    queryFn: () => fetchPlatformEarningBatchDetail(batchId ?? ''),
    enabled: Boolean(batchId),
  });

export const usePlatformEarningLines = (query: PlatformEarningLineQuery, enabled: boolean) =>
  useQuery({
    queryKey: revenueLedgerQueryKeys.platformEarningLines(query),
    queryFn: () => fetchPlatformEarningLines(query),
    enabled,
  });

const invalidateRevenueLedgerQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: REVENUE_LEDGER_QUERY_ROOT });
};

export const useCreateRevenueEntryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RevenueEntryCreatePayload) => createRevenueEntry(payload),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};

export const useUpdateRevenueEntryDraftCoreMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      revenueEntryId,
      payload,
    }: {
      revenueEntryId: string;
      payload: RevenueEntryDraftCorePayload;
    }) => updateRevenueEntryDraftCore(revenueEntryId, payload),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};

export const useReconcileRevenueEntryMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      revenueEntryId,
      payload,
    }: {
      revenueEntryId: string;
      payload?: RevenueEntryReconcilePayload;
    }) => reconcileRevenueEntry(revenueEntryId, payload),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};

export const useRevenueEntryLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      revenueEntryId,
      action,
    }: {
      revenueEntryId: string;
      action: Exclude<RevenueLedgerLifecycleAction, 'reconcile'>;
    }) => performRevenueEntryLifecycleAction(revenueEntryId, action),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};

export const usePlatformEarningLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      action,
    }: {
      batchId: string;
      action: 'submit' | 'start-review' | 'archive';
    }) => performPlatformEarningLifecycleAction(batchId, action),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};

export const useApprovePlatformEarningBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: PlatformEarningApprovePayload;
    }) => approvePlatformEarningBatch(batchId, payload),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};

export const useRejectPlatformEarningBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: PlatformEarningReasonPayload;
    }) => rejectPlatformEarningBatch(batchId, payload),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};

export const useVoidPlatformEarningBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: PlatformEarningReasonPayload;
    }) => voidPlatformEarningBatch(batchId, payload),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};

export const useCreateRevenueEntryFromPlatformEarningBatchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      payload,
    }: {
      batchId: string;
      payload: CreateRevenueEntryFromPlatformEarningPayload;
    }) => createRevenueEntryFromPlatformEarningBatch(batchId, payload),
    onSuccess: async () => {
      await invalidateRevenueLedgerQueries(queryClient);
    },
  });
};
