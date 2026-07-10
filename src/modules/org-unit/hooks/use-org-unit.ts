import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createOrgUnit,
  fetchOrgUnitChildren,
  fetchOrgUnitDetail,
  fetchOrgUnits,
  moveOrgUnit,
  performOrgUnitLifecycleAction,
  updateOrgUnit,
} from '@modules/org-unit/api/org-unit.api';
import type {
  OrgUnitCreatePayload,
  OrgUnitLifecycleAction,
  OrgUnitListQuery,
  OrgUnitMovePayload,
  OrgUnitUpdatePayload,
} from '@modules/org-unit/types/org-unit.types';
import { orgUnitFlatListQueryConfig } from '@modules/org-unit';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';

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
