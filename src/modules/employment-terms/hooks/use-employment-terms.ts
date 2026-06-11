import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createEmploymentTerms,
  fetchEmploymentTermsAdminList,
  fetchEmploymentTerms,
  fetchEmploymentTermsDetail,
  transitionEmploymentTerms,
  updateEmploymentTerms,
} from '@modules/employment-terms/api/employment-terms.api';
import type {
  EmploymentTermsAdminFilters,
  EmploymentTermsPayload,
} from '@modules/employment-terms/types/employment-terms.types';

const ROOT = ['employment-terms'] as const;

export const employmentTermsQueryKeys = {
  all: () => ROOT,
  list: (employmentProfileId: string) => [...ROOT, 'list', employmentProfileId] as const,
  adminList: (filters: EmploymentTermsAdminFilters) => [...ROOT, 'admin-list', filters] as const,
  detail: (employmentProfileId: string, termsId: string) =>
    [...ROOT, 'detail', employmentProfileId, termsId] as const,
};

export const useEmploymentTermsList = (employmentProfileId?: string) =>
  useQuery({
    queryKey: employmentProfileId ? employmentTermsQueryKeys.list(employmentProfileId) : ROOT,
    queryFn: () => fetchEmploymentTerms(employmentProfileId ?? ''),
    enabled: Boolean(employmentProfileId),
  });

export const useEmploymentTermsAdminList = (filters: EmploymentTermsAdminFilters) =>
  useQuery({
    queryKey: employmentTermsQueryKeys.adminList(filters),
    queryFn: () => fetchEmploymentTermsAdminList(filters),
  });

export const useEmploymentTermsDetail = (employmentProfileId?: string, termsId?: string) =>
  useQuery({
    queryKey:
      employmentProfileId && termsId
        ? employmentTermsQueryKeys.detail(employmentProfileId, termsId)
        : [...ROOT, 'detail'],
    queryFn: () => fetchEmploymentTermsDetail(employmentProfileId ?? '', termsId ?? ''),
    enabled: Boolean(employmentProfileId && termsId),
  });

const useInvalidateEmploymentTerms = () => {
  const queryClient = useQueryClient();
  return async () => queryClient.invalidateQueries({ queryKey: ROOT });
};

export const useCreateEmploymentTermsMutation = () => {
  const invalidate = useInvalidateEmploymentTerms();
  return useMutation({
    mutationFn: ({
      employmentProfileId,
      payload,
    }: {
      employmentProfileId: string;
      payload: EmploymentTermsPayload;
    }) => createEmploymentTerms(employmentProfileId, payload),
    onSuccess: invalidate,
  });
};

export const useUpdateEmploymentTermsMutation = () => {
  const invalidate = useInvalidateEmploymentTerms();
  return useMutation({
    mutationFn: ({
      employmentProfileId,
      termsId,
      payload,
    }: {
      employmentProfileId: string;
      termsId: string;
      payload: EmploymentTermsPayload;
    }) => updateEmploymentTerms(employmentProfileId, termsId, payload),
    onSuccess: invalidate,
  });
};

export const useTransitionEmploymentTermsMutation = () => {
  const invalidate = useInvalidateEmploymentTerms();
  return useMutation({
    mutationFn: ({
      employmentProfileId,
      termsId,
      action,
    }: {
      employmentProfileId: string;
      termsId: string;
      action: 'submit' | 'approve' | 'cancel';
    }) => transitionEmploymentTerms(employmentProfileId, termsId, action),
    onSuccess: invalidate,
  });
};
