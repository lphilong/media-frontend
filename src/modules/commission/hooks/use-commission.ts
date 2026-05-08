import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCommissionRule,
  createCommissionSettlement,
  fetchCommissionRuleDetail,
  fetchCommissionRules,
  fetchCommissionRulesByBeneficiary,
  fetchCommissionRulesByContract,
  fetchCommissionSettlementDetail,
  fetchCommissionSettlementLines,
  fetchCommissionSettlements,
  fetchCommissionSettlementsByBeneficiary,
  fetchCommissionSettlementsByRevenueEntry,
  fetchCommissionSettlementsBySubjectTalent,
  performCommissionRuleLifecycleAction,
  performCommissionSettlementLifecycleAction,
  replaceCommissionSettlementRevenueEntries,
  updateCommissionRuleDraftCore,
  updateCommissionSettlementDraftCore,
} from '@modules/commission/api/commission.api';
import type {
  CommissionRuleCreatePayload,
  CommissionRuleDraftCorePayload,
  CommissionRuleLifecycleAction,
  CommissionRulesByBeneficiaryQuery,
  CommissionRulesByContractQuery,
  CommissionRulesFlatListQuery,
  CommissionSettlementCreatePayload,
  CommissionSettlementDraftCorePayload,
  CommissionSettlementLifecycleAction,
  CommissionSettlementRevenueEntriesPayload,
  CommissionSettlementsByBeneficiaryQuery,
  CommissionSettlementsByRevenueEntryQuery,
  CommissionSettlementsBySubjectTalentQuery,
  CommissionSettlementsFlatListQuery,
} from '@modules/commission/types/commission.types';
import {
  commissionRulesByBeneficiaryQueryConfig,
  commissionRulesByContractQueryConfig,
  commissionRulesFlatListQueryConfig,
  commissionSettlementsByBeneficiaryQueryConfig,
  commissionSettlementsByRevenueEntryQueryConfig,
  commissionSettlementsBySubjectTalentQueryConfig,
  commissionSettlementsFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

const COMMISSION_QUERY_ROOT = ['commission'] as const;

const toRulesFlatToken = (query: CommissionRulesFlatListQuery): string =>
  serializeScreenQueryParams(query, commissionRulesFlatListQueryConfig).toString();

const toRulesByBeneficiaryToken = (query: CommissionRulesByBeneficiaryQuery): string =>
  serializeScreenQueryParams(query, commissionRulesByBeneficiaryQueryConfig).toString();

const toRulesByContractToken = (query: CommissionRulesByContractQuery): string =>
  serializeScreenQueryParams(query, commissionRulesByContractQueryConfig).toString();

const toSettlementsFlatToken = (query: CommissionSettlementsFlatListQuery): string =>
  serializeScreenQueryParams(query, commissionSettlementsFlatListQueryConfig).toString();

const toSettlementsByBeneficiaryToken = (query: CommissionSettlementsByBeneficiaryQuery): string =>
  serializeScreenQueryParams(query, commissionSettlementsByBeneficiaryQueryConfig).toString();

const toSettlementsBySubjectTalentToken = (
  query: CommissionSettlementsBySubjectTalentQuery,
): string =>
  serializeScreenQueryParams(query, commissionSettlementsBySubjectTalentQueryConfig).toString();

const toSettlementsByRevenueEntryToken = (
  query: CommissionSettlementsByRevenueEntryQuery,
): string =>
  serializeScreenQueryParams(query, commissionSettlementsByRevenueEntryQueryConfig).toString();

export const commissionQueryKeys = {
  all: (): readonly ['commission'] => COMMISSION_QUERY_ROOT,
  rulesFlatList: (query: CommissionRulesFlatListQuery) =>
    ['commission', 'rules', 'flat-list', toRulesFlatToken(query)] as const,
  rulesByBeneficiary: (query: CommissionRulesByBeneficiaryQuery) =>
    ['commission', 'rules', 'by-beneficiary', toRulesByBeneficiaryToken(query)] as const,
  rulesByContract: (query: CommissionRulesByContractQuery) =>
    ['commission', 'rules', 'by-contract', toRulesByContractToken(query)] as const,
  ruleDetail: (commissionRuleId: string) =>
    ['commission', 'rules', 'detail', commissionRuleId] as const,
  settlementsFlatList: (query: CommissionSettlementsFlatListQuery) =>
    ['commission', 'settlements', 'flat-list', toSettlementsFlatToken(query)] as const,
  settlementsByBeneficiary: (query: CommissionSettlementsByBeneficiaryQuery) =>
    [
      'commission',
      'settlements',
      'by-beneficiary',
      toSettlementsByBeneficiaryToken(query),
    ] as const,
  settlementsBySubjectTalent: (query: CommissionSettlementsBySubjectTalentQuery) =>
    [
      'commission',
      'settlements',
      'by-subject-talent',
      toSettlementsBySubjectTalentToken(query),
    ] as const,
  settlementsByRevenueEntry: (query: CommissionSettlementsByRevenueEntryQuery) =>
    [
      'commission',
      'settlements',
      'by-revenue-entry',
      toSettlementsByRevenueEntryToken(query),
    ] as const,
  settlementDetail: (commissionSettlementId: string) =>
    ['commission', 'settlements', 'detail', commissionSettlementId] as const,
  settlementLines: (commissionSettlementId: string) =>
    ['commission', 'settlements', 'lines', commissionSettlementId] as const,
};

export const useCommissionRulesFlatList = (
  query: CommissionRulesFlatListQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: commissionQueryKeys.rulesFlatList(query),
    queryFn: () => fetchCommissionRules(query),
    enabled: options?.enabled ?? true,
  });

export const useCommissionRulesByBeneficiary = (
  query: CommissionRulesByBeneficiaryQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: commissionQueryKeys.rulesByBeneficiary(query),
    queryFn: () => fetchCommissionRulesByBeneficiary(query),
    enabled: options?.enabled ?? true,
  });

export const useCommissionRulesByContract = (
  query: CommissionRulesByContractQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: commissionQueryKeys.rulesByContract(query),
    queryFn: () => fetchCommissionRulesByContract(query),
    enabled: options?.enabled ?? true,
  });

export const useCommissionRuleDetail = (commissionRuleId?: string) =>
  useQuery({
    queryKey: commissionRuleId
      ? commissionQueryKeys.ruleDetail(commissionRuleId)
      : [...COMMISSION_QUERY_ROOT, 'rules', 'detail'],
    queryFn: () => fetchCommissionRuleDetail(commissionRuleId ?? ''),
    enabled: Boolean(commissionRuleId),
  });

export const useCommissionSettlementsFlatList = (
  query: CommissionSettlementsFlatListQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: commissionQueryKeys.settlementsFlatList(query),
    queryFn: () => fetchCommissionSettlements(query),
    enabled: options?.enabled ?? true,
  });

export const useCommissionSettlementsByBeneficiary = (
  query: CommissionSettlementsByBeneficiaryQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: commissionQueryKeys.settlementsByBeneficiary(query),
    queryFn: () => fetchCommissionSettlementsByBeneficiary(query),
    enabled: options?.enabled ?? true,
  });

export const useCommissionSettlementsBySubjectTalent = (
  query: CommissionSettlementsBySubjectTalentQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: commissionQueryKeys.settlementsBySubjectTalent(query),
    queryFn: () => fetchCommissionSettlementsBySubjectTalent(query),
    enabled: options?.enabled ?? true,
  });

export const useCommissionSettlementsByRevenueEntry = (
  query: CommissionSettlementsByRevenueEntryQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: commissionQueryKeys.settlementsByRevenueEntry(query),
    queryFn: () => fetchCommissionSettlementsByRevenueEntry(query),
    enabled: options?.enabled ?? true,
  });

export const useCommissionSettlementDetail = (commissionSettlementId?: string) =>
  useQuery({
    queryKey: commissionSettlementId
      ? commissionQueryKeys.settlementDetail(commissionSettlementId)
      : [...COMMISSION_QUERY_ROOT, 'settlements', 'detail'],
    queryFn: () => fetchCommissionSettlementDetail(commissionSettlementId ?? ''),
    enabled: Boolean(commissionSettlementId),
  });

export const useCommissionSettlementLines = (commissionSettlementId?: string) =>
  useQuery({
    queryKey: commissionSettlementId
      ? commissionQueryKeys.settlementLines(commissionSettlementId)
      : [...COMMISSION_QUERY_ROOT, 'settlements', 'lines'],
    queryFn: () => fetchCommissionSettlementLines(commissionSettlementId ?? ''),
    enabled: Boolean(commissionSettlementId),
  });

const invalidateCommissionQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: COMMISSION_QUERY_ROOT });
};

export const useCreateCommissionRuleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CommissionRuleCreatePayload) => createCommissionRule(payload),
    onSuccess: async () => {
      await invalidateCommissionQueries(queryClient);
    },
  });
};

export const useUpdateCommissionRuleDraftCoreMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commissionRuleId,
      payload,
    }: {
      commissionRuleId: string;
      payload: CommissionRuleDraftCorePayload;
    }) => updateCommissionRuleDraftCore(commissionRuleId, payload),
    onSuccess: async () => {
      await invalidateCommissionQueries(queryClient);
    },
  });
};

export const useCommissionRuleLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commissionRuleId,
      action,
    }: {
      commissionRuleId: string;
      action: CommissionRuleLifecycleAction;
    }) => performCommissionRuleLifecycleAction(commissionRuleId, action),
    onSuccess: async () => {
      await invalidateCommissionQueries(queryClient);
    },
  });
};

export const useCreateCommissionSettlementMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CommissionSettlementCreatePayload) => createCommissionSettlement(payload),
    onSuccess: async () => {
      await invalidateCommissionQueries(queryClient);
    },
  });
};

export const useUpdateCommissionSettlementDraftCoreMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commissionSettlementId,
      payload,
    }: {
      commissionSettlementId: string;
      payload: CommissionSettlementDraftCorePayload;
    }) => updateCommissionSettlementDraftCore(commissionSettlementId, payload),
    onSuccess: async () => {
      await invalidateCommissionQueries(queryClient);
    },
  });
};

export const useReplaceCommissionSettlementRevenueEntriesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commissionSettlementId,
      payload,
    }: {
      commissionSettlementId: string;
      payload: CommissionSettlementRevenueEntriesPayload;
    }) => replaceCommissionSettlementRevenueEntries(commissionSettlementId, payload),
    onSuccess: async () => {
      await invalidateCommissionQueries(queryClient);
    },
  });
};

export const useCommissionSettlementLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commissionSettlementId,
      action,
    }: {
      commissionSettlementId: string;
      action: CommissionSettlementLifecycleAction;
    }) => performCommissionSettlementLifecycleAction(commissionSettlementId, action),
    onSuccess: async () => {
      await invalidateCommissionQueries(queryClient);
    },
  });
};
