import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createResponsibility,
  fetchResponsibilities,
  fetchResponsibilitySummary,
  revokeResponsibility,
} from '@modules/responsibility/api/responsibility.api';
import type {
  CreateResponsibilityPayload,
  ResponsibilityListQuery,
  ResponsibilitySubjectType,
} from '@modules/responsibility/types/responsibility.types';

const RESPONSIBILITY_QUERY_ROOT = ['responsibility'] as const;

const toQueryToken = (query: ResponsibilityListQuery): string => {
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== '');
  return JSON.stringify(
    Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right))),
  );
};

export const responsibilityQueryKeys = {
  all: (): readonly ['responsibility'] => RESPONSIBILITY_QUERY_ROOT,
  list: (query: ResponsibilityListQuery) =>
    ['responsibility', 'list', toQueryToken(query)] as const,
  summary: (subjectType: ResponsibilitySubjectType, subjectId: string) =>
    ['responsibility', 'summary', subjectType, subjectId] as const,
};

export const useResponsibilities = (query: ResponsibilityListQuery) => {
  return useQuery({
    queryKey: responsibilityQueryKeys.list(query),
    queryFn: () => fetchResponsibilities(query),
  });
};

export const useResponsibilitySummary = (
  subjectType: ResponsibilitySubjectType,
  subjectId: string | undefined,
) => {
  return useQuery({
    queryKey: subjectId
      ? responsibilityQueryKeys.summary(subjectType, subjectId)
      : [...RESPONSIBILITY_QUERY_ROOT, 'summary', subjectType],
    queryFn: () => fetchResponsibilitySummary(subjectType, subjectId ?? ''),
    enabled: Boolean(subjectId),
  });
};

const invalidateResponsibilityQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: RESPONSIBILITY_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: ['talent-group'] });
  await queryClient.invalidateQueries({ queryKey: ['org-unit'] });
  await queryClient.invalidateQueries({ queryKey: ['talent'] });
  await queryClient.invalidateQueries({ queryKey: ['employment-profile'] });
};

export const useCreateResponsibilityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateResponsibilityPayload) => createResponsibility(payload),
    onSuccess: async () => {
      await invalidateResponsibilityQueries(queryClient);
    },
  });
};

export const useRevokeResponsibilityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason?: string | null }) =>
      revokeResponsibility(assignmentId, reason),
    onSuccess: async () => {
      await invalidateResponsibilityQueries(queryClient);
    },
  });
};
