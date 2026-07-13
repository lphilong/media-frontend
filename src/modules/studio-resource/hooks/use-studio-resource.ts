import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createStudioResource,
  fetchStudioResourceAvailability,
  fetchStudioResourceDetail,
  fetchStudioResources,
  performStudioResourceAvailabilityAction,
  performStudioResourceLifecycleAction,
  updateStudioResource,
} from '@modules/studio-resource/api/studio-resource.api';
import type {
  StudioResourceAvailabilityAction,
  StudioResourceAvailabilityQuery,
  StudioResourceCreatePayload,
  StudioResourceLifecycleAction,
  StudioResourceListQuery,
  StudioResourceUpdatePayload,
} from '@modules/studio-resource/types/studio-resource.types';
import {
  studioResourceAvailabilityQueryConfig,
  studioResourceFlatListQueryConfig,
} from '@modules/studio-resource';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';

const STUDIO_RESOURCE_QUERY_ROOT = ['studio-resource'] as const;

const toFlatListQueryToken = (query: StudioResourceListQuery): string => {
  return serializeScreenQueryParams(query, studioResourceFlatListQueryConfig).toString();
};

const toAvailabilityQueryToken = (query: StudioResourceAvailabilityQuery): string => {
  return serializeScreenQueryParams(query, studioResourceAvailabilityQueryConfig).toString();
};

export const studioResourceQueryKeys = {
  all: (): readonly ['studio-resource'] => STUDIO_RESOURCE_QUERY_ROOT,
  flatList: (query: StudioResourceListQuery) =>
    ['studio-resource', 'flat-list', toFlatListQueryToken(query)] as const,
  availability: (query: StudioResourceAvailabilityQuery) =>
    ['studio-resource', 'availability', toAvailabilityQueryToken(query)] as const,
  detail: (studioResourceId: string) => ['studio-resource', 'detail', studioResourceId] as const,
};

export const useStudioResourceFlatList = (
  query: StudioResourceListQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: studioResourceQueryKeys.flatList(query),
    queryFn: () => fetchStudioResources(query),
    enabled: options?.enabled ?? true,
  });
};

export const useStudioResourceAvailability = (
  query: StudioResourceAvailabilityQuery,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: studioResourceQueryKeys.availability(query),
    queryFn: () => fetchStudioResourceAvailability(query),
    enabled: options?.enabled ?? true,
  });
};

export const useStudioResourceDetail = (studioResourceId?: string) => {
  return useQuery({
    queryKey: studioResourceId
      ? studioResourceQueryKeys.detail(studioResourceId)
      : [...STUDIO_RESOURCE_QUERY_ROOT, 'detail'],
    queryFn: () => fetchStudioResourceDetail(studioResourceId ?? ''),
    enabled: Boolean(studioResourceId),
  });
};

const invalidateStudioResourceModuleQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  await queryClient.invalidateQueries({ queryKey: STUDIO_RESOURCE_QUERY_ROOT });
};

export const useCreateStudioResourceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StudioResourceCreatePayload) => createStudioResource(payload),
    onSuccess: async () => {
      await invalidateStudioResourceModuleQueries(queryClient);
    },
  });
};

export const useUpdateStudioResourceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studioResourceId,
      payload,
    }: {
      studioResourceId: string;
      payload: StudioResourceUpdatePayload;
    }) => updateStudioResource(studioResourceId, payload),
    onSuccess: async () => {
      await invalidateStudioResourceModuleQueries(queryClient);
    },
  });
};

export const useStudioResourceAvailabilityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studioResourceId,
      action,
    }: {
      studioResourceId: string;
      action: StudioResourceAvailabilityAction;
    }) => performStudioResourceAvailabilityAction(studioResourceId, action),
    onSuccess: async () => {
      await invalidateStudioResourceModuleQueries(queryClient);
    },
  });
};

export const useStudioResourceLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studioResourceId,
      action,
    }: {
      studioResourceId: string;
      action: StudioResourceLifecycleAction;
    }) => performStudioResourceLifecycleAction(studioResourceId, action),
    onSuccess: async () => {
      await invalidateStudioResourceModuleQueries(queryClient);
    },
  });
};
