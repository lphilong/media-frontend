import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignContractOwner,
  createContractRecord,
  expireContractRecord,
  fetchContractRecordDetail,
  fetchContractRecords,
  fetchContractRecordsByLinkedEntity,
  fetchContractRecordsByOwner,
  performContractLifecycleAction,
  terminateContractRecord,
  updateContractDraftCore,
  updateContractFileReference,
} from '@modules/contract-registry/api/contract-registry.api';
import type {
  ContractAssignOwnerPayload,
  ContractByLinkedEntityQuery,
  ContractByOwnerQuery,
  ContractCreatePayload,
  ContractDraftCorePayload,
  ContractExpirePayload,
  ContractFileReferencePayload,
  ContractFlatListQuery,
  ContractLifecycleAction,
  ContractTerminatePayload,
} from '@modules/contract-registry/types/contract-registry.types';
import {
  contractRegistryByLinkedEntityQueryConfig,
  contractRegistryByOwnerQueryConfig,
  contractRegistryFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

const CONTRACT_REGISTRY_QUERY_ROOT = ['contract-registry'] as const;

const toFlatListQueryToken = (query: ContractFlatListQuery): string =>
  serializeScreenQueryParams(query, contractRegistryFlatListQueryConfig).toString();

const toByLinkedEntityQueryToken = (query: ContractByLinkedEntityQuery): string =>
  serializeScreenQueryParams(query, contractRegistryByLinkedEntityQueryConfig).toString();

const toByOwnerQueryToken = (query: ContractByOwnerQuery): string =>
  serializeScreenQueryParams(query, contractRegistryByOwnerQueryConfig).toString();

export const contractRegistryQueryKeys = {
  all: (): readonly ['contract-registry'] => CONTRACT_REGISTRY_QUERY_ROOT,
  flatList: (query: ContractFlatListQuery) =>
    ['contract-registry', 'flat-list', toFlatListQueryToken(query)] as const,
  byLinkedEntity: (query: ContractByLinkedEntityQuery) =>
    ['contract-registry', 'by-linked-entity', toByLinkedEntityQueryToken(query)] as const,
  byOwner: (query: ContractByOwnerQuery) =>
    ['contract-registry', 'by-owner', toByOwnerQueryToken(query)] as const,
  detail: (contractRecordId: string) => ['contract-registry', 'detail', contractRecordId] as const,
};

export const useContractRecordFlatList = (
  query: ContractFlatListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: contractRegistryQueryKeys.flatList(query),
    queryFn: () => fetchContractRecords(query),
    enabled: options?.enabled ?? true,
  });
};

export const useContractRecordsByLinkedEntity = (
  query: ContractByLinkedEntityQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: contractRegistryQueryKeys.byLinkedEntity(query),
    queryFn: () => fetchContractRecordsByLinkedEntity(query),
    enabled: options?.enabled ?? true,
  });
};

export const useContractRecordsByOwner = (
  query: ContractByOwnerQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: contractRegistryQueryKeys.byOwner(query),
    queryFn: () => fetchContractRecordsByOwner(query),
    enabled: options?.enabled ?? true,
  });
};

export const useContractRecordDetail = (contractRecordId?: string) => {
  return useQuery({
    queryKey: contractRecordId
      ? contractRegistryQueryKeys.detail(contractRecordId)
      : [...CONTRACT_REGISTRY_QUERY_ROOT, 'detail'],
    queryFn: () => fetchContractRecordDetail(contractRecordId ?? ''),
    enabled: Boolean(contractRecordId),
  });
};

const invalidateContractRegistryQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  await queryClient.invalidateQueries({ queryKey: CONTRACT_REGISTRY_QUERY_ROOT });
};

export const useCreateContractRecordMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ContractCreatePayload) => createContractRecord(payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useUpdateContractDraftCoreMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractRecordId,
      payload,
    }: {
      contractRecordId: string;
      payload: ContractDraftCorePayload;
    }) => updateContractDraftCore(contractRecordId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useAssignContractOwnerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractRecordId,
      payload,
    }: {
      contractRecordId: string;
      payload: ContractAssignOwnerPayload;
    }) => assignContractOwner(contractRecordId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useUpdateContractFileReferenceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractRecordId,
      payload,
    }: {
      contractRecordId: string;
      payload: ContractFileReferencePayload;
    }) => updateContractFileReference(contractRecordId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useExpireContractRecordMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractRecordId,
      payload,
    }: {
      contractRecordId: string;
      payload: ContractExpirePayload;
    }) => expireContractRecord(contractRecordId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useTerminateContractRecordMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractRecordId,
      payload,
    }: {
      contractRecordId: string;
      payload: ContractTerminatePayload;
    }) => terminateContractRecord(contractRecordId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useContractLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractRecordId,
      action,
    }: {
      contractRecordId: string;
      action: ContractLifecycleAction;
    }) => performContractLifecycleAction(contractRecordId, action),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};
