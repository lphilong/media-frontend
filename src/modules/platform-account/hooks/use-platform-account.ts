import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createPlatformAccount,
  fetchPlatformAccountDetail,
  fetchPlatformAccounts,
  performPlatformAccountLifecycleAction,
  transferPlatformAccountOwnership,
  updatePlatformAccount,
  updatePlatformAccountCapabilities,
} from '@modules/platform-account/api/platform-account.api';
import type {
  PlatformAccountCapabilitiesPayload,
  PlatformAccountCreatePayload,
  PlatformAccountLifecycleAction,
  PlatformAccountListQuery,
  PlatformAccountOwnershipTransferPayload,
  PlatformAccountUpdatePayload,
} from '@modules/platform-account/types/platform-account.types';
import { platformAccountFlatListQueryConfig } from '@modules/platform-account';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';

const PLATFORM_ACCOUNT_QUERY_ROOT = ['platform-account'] as const;
const TALENT_QUERY_ROOT = ['talent'] as const;
const TALENT_GROUP_QUERY_ROOT = ['talent-group'] as const;
const ORG_UNIT_QUERY_ROOT = ['org-unit'] as const;

const toListQueryToken = (query: PlatformAccountListQuery): string => {
  return serializeScreenQueryParams(query, platformAccountFlatListQueryConfig).toString();
};

export const platformAccountQueryKeys = {
  all: (): readonly ['platform-account'] => PLATFORM_ACCOUNT_QUERY_ROOT,
  list: (query: PlatformAccountListQuery) =>
    ['platform-account', 'list', toListQueryToken(query)] as const,
  detail: (platformAccountId: string) => ['platform-account', 'detail', platformAccountId] as const,
};

export const usePlatformAccountList = (query: PlatformAccountListQuery) => {
  return useQuery({
    queryKey: platformAccountQueryKeys.list(query),
    queryFn: () => fetchPlatformAccounts(query),
  });
};

export const usePlatformAccountDetail = (platformAccountId?: string) => {
  return useQuery({
    queryKey: platformAccountId
      ? platformAccountQueryKeys.detail(platformAccountId)
      : [...PLATFORM_ACCOUNT_QUERY_ROOT, 'detail'],
    queryFn: () => fetchPlatformAccountDetail(platformAccountId ?? ''),
    enabled: Boolean(platformAccountId),
  });
};

const invalidatePlatformAccountModuleQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  await queryClient.invalidateQueries({ queryKey: PLATFORM_ACCOUNT_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: ORG_UNIT_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: TALENT_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: TALENT_GROUP_QUERY_ROOT });
};

export const useCreatePlatformAccountMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PlatformAccountCreatePayload) => createPlatformAccount(payload),
    onSuccess: async () => {
      await invalidatePlatformAccountModuleQueries(queryClient);
    },
  });
};

export const useUpdatePlatformAccountMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      platformAccountId,
      payload,
    }: {
      platformAccountId: string;
      payload: PlatformAccountUpdatePayload;
    }) => updatePlatformAccount(platformAccountId, payload),
    onSuccess: async () => {
      await invalidatePlatformAccountModuleQueries(queryClient);
    },
  });
};

export const usePlatformAccountOwnershipTransferMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      platformAccountId,
      payload,
    }: {
      platformAccountId: string;
      payload: PlatformAccountOwnershipTransferPayload;
    }) => transferPlatformAccountOwnership(platformAccountId, payload),
    onSuccess: async () => {
      await invalidatePlatformAccountModuleQueries(queryClient);
    },
  });
};

export const usePlatformAccountCapabilitiesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      platformAccountId,
      payload,
    }: {
      platformAccountId: string;
      payload: PlatformAccountCapabilitiesPayload;
    }) => updatePlatformAccountCapabilities(platformAccountId, payload),
    onSuccess: async () => {
      await invalidatePlatformAccountModuleQueries(queryClient);
    },
  });
};

export const usePlatformAccountLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      platformAccountId,
      action,
    }: {
      platformAccountId: string;
      action: PlatformAccountLifecycleAction;
    }) => performPlatformAccountLifecycleAction(platformAccountId, action),
    onSuccess: async () => {
      await invalidatePlatformAccountModuleQueries(queryClient);
    },
  });
};
