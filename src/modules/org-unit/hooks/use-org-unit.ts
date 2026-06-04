import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignOrgUnitResponsibility,
  createOrgUnit,
  fetchOrgUnitChildren,
  fetchOrgUnitDetail,
  fetchOrgUnitResponsibilities,
  fetchOrgUnits,
  moveOrgUnit,
  performOrgUnitLifecycleAction,
  revokeOrgUnitResponsibility,
  updateOrgUnitResponsibility,
  updateOrgUnit,
} from '@modules/org-unit/api/org-unit.api';
import type {
  OrgUnitCreatePayload,
  OrgUnitLifecycleAction,
  OrgUnitListQuery,
  OrgUnitMovePayload,
  OrgUnitResponsibilityPayload,
  OrgUnitResponsibilityUpdatePayload,
  OrgUnitUpdatePayload,
} from '@modules/org-unit/types/org-unit.types';
import { orgUnitFlatListQueryConfig, serializeScreenQueryParams } from '@shared/query';

const ORG_UNIT_QUERY_ROOT = ['org-unit'] as const;
const EMPLOYMENT_PROFILE_QUERY_ROOT = ['employment-profile'] as const;

const toListQueryToken = (query: OrgUnitListQuery): string => {
  return serializeScreenQueryParams(query, orgUnitFlatListQueryConfig).toString();
};

export const orgUnitQueryKeys = {
  all: (): readonly ['org-unit'] => ORG_UNIT_QUERY_ROOT,
  list: (query: OrgUnitListQuery) => ['org-unit', 'list', toListQueryToken(query)] as const,
  detail: (orgUnitId: string) => ['org-unit', 'detail', orgUnitId] as const,
  children: (orgUnitId: string, cursor?: string) =>
    ['org-unit', 'children', orgUnitId, cursor ?? 'root'] as const,
  responsibilities: (orgUnitId: string) => ['org-unit', 'responsibilities', orgUnitId] as const,
};

export const useOrgUnitList = (query: OrgUnitListQuery) => {
  return useQuery({
    queryKey: orgUnitQueryKeys.list(query),
    queryFn: () => fetchOrgUnits(query),
  });
};

export const useOrgUnitDetail = (orgUnitId?: string) => {
  return useQuery({
    queryKey: orgUnitId ? orgUnitQueryKeys.detail(orgUnitId) : [...ORG_UNIT_QUERY_ROOT, 'detail'],
    queryFn: () => fetchOrgUnitDetail(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
};

export const useOrgUnitChildren = (
  orgUnitId: string | undefined,
  query: Pick<OrgUnitListQuery, 'cursor' | 'limit'>,
) => {
  return useQuery({
    queryKey: orgUnitId
      ? orgUnitQueryKeys.children(orgUnitId, query.cursor)
      : [...ORG_UNIT_QUERY_ROOT, 'children'],
    queryFn: () => fetchOrgUnitChildren(orgUnitId ?? '', query),
    enabled: Boolean(orgUnitId),
  });
};

export const useOrgUnitResponsibilities = (orgUnitId: string | undefined) => {
  return useQuery({
    queryKey: orgUnitId
      ? orgUnitQueryKeys.responsibilities(orgUnitId)
      : [...ORG_UNIT_QUERY_ROOT, 'responsibilities'],
    queryFn: () => fetchOrgUnitResponsibilities(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
};

const invalidateOrgUnitModuleQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: ORG_UNIT_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: EMPLOYMENT_PROFILE_QUERY_ROOT });
};

export const useCreateOrgUnitMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: OrgUnitCreatePayload) => createOrgUnit(payload),
    onSuccess: async () => {
      await invalidateOrgUnitModuleQueries(queryClient);
    },
  });
};

export const useUpdateOrgUnitMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgUnitId, payload }: { orgUnitId: string; payload: OrgUnitUpdatePayload }) =>
      updateOrgUnit(orgUnitId, payload),
    onSuccess: async () => {
      await invalidateOrgUnitModuleQueries(queryClient);
    },
  });
};

export const useMoveOrgUnitMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgUnitId, payload }: { orgUnitId: string; payload: OrgUnitMovePayload }) =>
      moveOrgUnit(orgUnitId, payload),
    onSuccess: async () => {
      await invalidateOrgUnitModuleQueries(queryClient);
    },
  });
};

export const useOrgUnitLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgUnitId, action }: { orgUnitId: string; action: OrgUnitLifecycleAction }) =>
      performOrgUnitLifecycleAction(orgUnitId, action),
    onSuccess: async () => {
      await invalidateOrgUnitModuleQueries(queryClient);
    },
  });
};

export const useAssignOrgUnitResponsibilityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgUnitId,
      payload,
    }: {
      orgUnitId: string;
      payload: OrgUnitResponsibilityPayload;
    }) => assignOrgUnitResponsibility(orgUnitId, payload),
    onSuccess: async () => {
      await invalidateOrgUnitModuleQueries(queryClient);
    },
  });
};

export const useUpdateOrgUnitResponsibilityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgUnitId,
      assignmentId,
      payload,
    }: {
      orgUnitId: string;
      assignmentId: string;
      payload: OrgUnitResponsibilityUpdatePayload;
    }) => updateOrgUnitResponsibility(orgUnitId, assignmentId, payload),
    onSuccess: async () => {
      await invalidateOrgUnitModuleQueries(queryClient);
    },
  });
};

export const useRevokeOrgUnitResponsibilityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgUnitId, assignmentId }: { orgUnitId: string; assignmentId: string }) =>
      revokeOrgUnitResponsibility(orgUnitId, assignmentId),
    onSuccess: async () => {
      await invalidateOrgUnitModuleQueries(queryClient);
    },
  });
};
