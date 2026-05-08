import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignEmploymentProfileManager,
  assignEmploymentProfileOrgUnit,
  createEmploymentProfile,
  fetchEmploymentProfileDetail,
  fetchEmploymentProfileDirectReports,
  fetchEmploymentProfiles,
  linkEmploymentProfileUser,
  performEmploymentProfileLifecycleAction,
  terminateEmploymentProfile,
  unlinkEmploymentProfileUser,
  updateEmploymentProfile,
  updateEmploymentProfileContractStatus,
} from '@modules/employment-profile/api/employment-profile.api';
import type {
  EmploymentProfileContractStatusPayload,
  EmploymentProfileCreatePayload,
  EmploymentProfileDirectReportsQuery,
  EmploymentProfileLifecycleAction,
  EmploymentProfileListQuery,
  EmploymentProfileManagerAssignmentPayload,
  EmploymentProfileOrgUnitAssignmentPayload,
  EmploymentProfileTerminatePayload,
  EmploymentProfileUpdatePayload,
  EmploymentProfileUserLinkPayload,
} from '@modules/employment-profile/types/employment-profile.types';
import {
  employmentProfileDirectReportsQueryConfig,
  employmentProfileFlatListQueryConfig,
  serializeScreenQueryParams,
} from '@shared/query';

const EMPLOYMENT_PROFILE_QUERY_ROOT = ['employment-profile'] as const;
const ORG_UNIT_QUERY_ROOT = ['org-unit'] as const;

const toListQueryToken = (query: EmploymentProfileListQuery): string => {
  return serializeScreenQueryParams(query, employmentProfileFlatListQueryConfig).toString();
};

const toDirectReportsQueryToken = (query: EmploymentProfileDirectReportsQuery): string => {
  return serializeScreenQueryParams(
    {
      ...query,
      view: 'direct-reports',
    },
    employmentProfileDirectReportsQueryConfig,
  ).toString();
};

export const employmentProfileQueryKeys = {
  all: (): readonly ['employment-profile'] => EMPLOYMENT_PROFILE_QUERY_ROOT,
  list: (query: EmploymentProfileListQuery) =>
    ['employment-profile', 'list', toListQueryToken(query)] as const,
  detail: (employmentProfileId: string) =>
    ['employment-profile', 'detail', employmentProfileId] as const,
  directReports: (employmentProfileId: string, query: EmploymentProfileDirectReportsQuery) =>
    [
      'employment-profile',
      'direct-reports',
      employmentProfileId,
      toDirectReportsQueryToken(query),
    ] as const,
};

export const useEmploymentProfileList = (query: EmploymentProfileListQuery) => {
  return useQuery({
    queryKey: employmentProfileQueryKeys.list(query),
    queryFn: () => fetchEmploymentProfiles(query),
  });
};

export const useEmploymentProfileDetail = (employmentProfileId?: string) => {
  return useQuery({
    queryKey: employmentProfileId
      ? employmentProfileQueryKeys.detail(employmentProfileId)
      : [...EMPLOYMENT_PROFILE_QUERY_ROOT, 'detail'],
    queryFn: () => fetchEmploymentProfileDetail(employmentProfileId ?? ''),
    enabled: Boolean(employmentProfileId),
  });
};

export const useEmploymentProfileDirectReports = (
  employmentProfileId: string | undefined,
  query: EmploymentProfileDirectReportsQuery,
) => {
  return useQuery({
    queryKey: employmentProfileId
      ? employmentProfileQueryKeys.directReports(employmentProfileId, query)
      : [...EMPLOYMENT_PROFILE_QUERY_ROOT, 'direct-reports'],
    queryFn: () => fetchEmploymentProfileDirectReports(employmentProfileId ?? '', query),
    enabled: Boolean(employmentProfileId),
  });
};

const invalidateEmploymentProfileModuleQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  await queryClient.invalidateQueries({ queryKey: EMPLOYMENT_PROFILE_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: ORG_UNIT_QUERY_ROOT });
};

export const useCreateEmploymentProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: EmploymentProfileCreatePayload) => createEmploymentProfile(payload),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};

export const useUpdateEmploymentProfileMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employmentProfileId,
      payload,
    }: {
      employmentProfileId: string;
      payload: EmploymentProfileUpdatePayload;
    }) => updateEmploymentProfile(employmentProfileId, payload),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};

export const useEmploymentProfileOrgAssignmentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employmentProfileId,
      payload,
    }: {
      employmentProfileId: string;
      payload: EmploymentProfileOrgUnitAssignmentPayload;
    }) => assignEmploymentProfileOrgUnit(employmentProfileId, payload),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};

export const useEmploymentProfileManagerAssignmentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employmentProfileId,
      payload,
    }: {
      employmentProfileId: string;
      payload: EmploymentProfileManagerAssignmentPayload;
    }) => assignEmploymentProfileManager(employmentProfileId, payload),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};

export const useEmploymentProfileUserLinkMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employmentProfileId,
      payload,
    }: {
      employmentProfileId: string;
      payload: EmploymentProfileUserLinkPayload;
    }) => linkEmploymentProfileUser(employmentProfileId, payload),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};

export const useEmploymentProfileUserUnlinkMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ employmentProfileId }: { employmentProfileId: string }) =>
      unlinkEmploymentProfileUser(employmentProfileId),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};

export const useEmploymentProfileContractStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employmentProfileId,
      payload,
    }: {
      employmentProfileId: string;
      payload: EmploymentProfileContractStatusPayload;
    }) => updateEmploymentProfileContractStatus(employmentProfileId, payload),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};

export const useEmploymentProfileTerminateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employmentProfileId,
      payload,
    }: {
      employmentProfileId: string;
      payload: EmploymentProfileTerminatePayload;
    }) => terminateEmploymentProfile(employmentProfileId, payload),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};

export const useEmploymentProfileLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      employmentProfileId,
      action,
    }: {
      employmentProfileId: string;
      action: EmploymentProfileLifecycleAction;
    }) => performEmploymentProfileLifecycleAction(employmentProfileId, action),
    onSuccess: async () => {
      await invalidateEmploymentProfileModuleQueries(queryClient);
    },
  });
};
