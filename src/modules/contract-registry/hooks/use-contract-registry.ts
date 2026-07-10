import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptContractObligation,
  archiveContractObligation,
  assignContractOwner,
  cancelContractObligation,
  createContractRecord,
  createContractObligation,
  deliverContractObligation,
  expireContractRecord,
  fetchContractObligationEventEvidenceLinks,
  fetchContractObligationDetail,
  fetchContractObligations,
  fetchContractRecordDetail,
  fetchContractRecords,
  fetchContractRecordsByLinkedEntity,
  fetchContractRecordsByOwner,
  linkContractObligationEventEvidence,
  performContractObligationOpen,
  performContractLifecycleAction,
  rejectContractObligation,
  reopenContractObligation,
  removeContractObligationEventEvidence,
  terminateContractRecord,
  updateContractObligation,
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
  ContractObligationAcceptPayload,
  ContractObligationArchivePayload,
  ContractObligationDeliverPayload,
  ContractObligationEventEvidenceLinkPayload,
  ContractObligationEventEvidenceRemovePayload,
  ContractObligationPayload,
  ContractObligationReasonPayload,
  ContractTerminatePayload,
} from '@modules/contract-registry/types/contract-registry.types';
import {
  contractRegistryByLinkedEntityQueryConfig,
  contractRegistryByOwnerQueryConfig,
  contractRegistryFlatListQueryConfig,
} from '@modules/contract-registry';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';

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
  obligations: (contractRecordId: string) =>
    ['contract-registry', 'obligations', contractRecordId] as const,
  obligationDetail: (obligationId: string) =>
    ['contract-registry', 'obligation-detail', obligationId] as const,
  eventEvidenceLinks: (obligationId: string) =>
    ['contract-registry', 'event-evidence-links', obligationId] as const,
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

export const useContractObligations = (
  contractRecordId?: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: contractRecordId
      ? contractRegistryQueryKeys.obligations(contractRecordId)
      : [...CONTRACT_REGISTRY_QUERY_ROOT, 'obligations'],
    queryFn: () => fetchContractObligations(contractRecordId ?? ''),
    enabled: Boolean(contractRecordId) && (options?.enabled ?? true),
  });
};

export const useContractObligationDetail = (obligationId?: string) => {
  return useQuery({
    queryKey: obligationId
      ? contractRegistryQueryKeys.obligationDetail(obligationId)
      : [...CONTRACT_REGISTRY_QUERY_ROOT, 'obligation-detail'],
    queryFn: () => fetchContractObligationDetail(obligationId ?? ''),
    enabled: Boolean(obligationId),
  });
};

export const useContractObligationEventEvidenceLinks = (
  obligationId?: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: obligationId
      ? contractRegistryQueryKeys.eventEvidenceLinks(obligationId)
      : [...CONTRACT_REGISTRY_QUERY_ROOT, 'event-evidence-links'],
    queryFn: () => fetchContractObligationEventEvidenceLinks(obligationId ?? ''),
    enabled: Boolean(obligationId) && (options?.enabled ?? true),
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

export const useCreateContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contractRecordId,
      payload,
    }: {
      contractRecordId: string;
      payload: ContractObligationPayload;
    }) => createContractObligation(contractRecordId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useUpdateContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      obligationId,
      payload,
    }: {
      obligationId: string;
      payload: ContractObligationPayload;
    }) => updateContractObligation(obligationId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useOpenContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ obligationId }: { obligationId: string }) =>
      performContractObligationOpen(obligationId),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useDeliverContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      obligationId,
      payload,
    }: {
      obligationId: string;
      payload: ContractObligationDeliverPayload;
    }) => deliverContractObligation(obligationId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useAcceptContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      obligationId,
      payload,
    }: {
      obligationId: string;
      payload: ContractObligationAcceptPayload;
    }) => acceptContractObligation(obligationId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useRejectContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      obligationId,
      payload,
    }: {
      obligationId: string;
      payload: ContractObligationReasonPayload;
    }) => rejectContractObligation(obligationId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useReopenContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      obligationId,
      payload,
    }: {
      obligationId: string;
      payload: ContractObligationReasonPayload;
    }) => reopenContractObligation(obligationId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useCancelContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      obligationId,
      payload,
    }: {
      obligationId: string;
      payload: ContractObligationReasonPayload;
    }) => cancelContractObligation(obligationId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useArchiveContractObligationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      obligationId,
      payload,
    }: {
      obligationId: string;
      payload: ContractObligationArchivePayload;
    }) => archiveContractObligation(obligationId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useLinkContractObligationEventEvidenceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      obligationId,
      payload,
    }: {
      obligationId: string;
      payload: ContractObligationEventEvidenceLinkPayload;
    }) => linkContractObligationEventEvidence(obligationId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};

export const useRemoveContractObligationEventEvidenceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      linkId,
      payload,
    }: {
      linkId: string;
      payload: ContractObligationEventEvidenceRemovePayload;
    }) => removeContractObligationEventEvidence(linkId, payload),
    onSuccess: async () => {
      await invalidateContractRegistryQueries(queryClient);
    },
  });
};
