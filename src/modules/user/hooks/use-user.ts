import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createUser,
  fetchUserDetail,
  fetchUsers,
  performUserLifecycleAction,
  setUserAuthLinkage,
  updateUser,
} from '@modules/user/api/user.api';
import type {
  UserAuthLinkagePayload,
  UserCreatePayload,
  UserLifecycleAction,
  UserListQuery,
  UserUpdatePayload,
} from '@modules/user/types/user.types';
import { serializeScreenQueryParams, userFlatListQueryConfig } from '@shared/query';

const USER_QUERY_ROOT = ['user'] as const;
const ROLE_QUERY_ROOT = ['role'] as const;

const toListQueryToken = (query: UserListQuery): string =>
  serializeScreenQueryParams(query, userFlatListQueryConfig).toString();

export const userQueryKeys = {
  all: (): readonly ['user'] => USER_QUERY_ROOT,
  list: (query: UserListQuery) => ['user', 'list', toListQueryToken(query)] as const,
  detail: (userId: string) => ['user', 'detail', userId] as const,
};

export const useUserList = (query: UserListQuery) => {
  return useQuery({
    queryKey: userQueryKeys.list(query),
    queryFn: () => fetchUsers(query),
  });
};

export const useUserDetail = (userId?: string) => {
  return useQuery({
    queryKey: userId ? userQueryKeys.detail(userId) : [...USER_QUERY_ROOT, 'detail'],
    queryFn: () => fetchUserDetail(userId ?? ''),
    enabled: Boolean(userId),
  });
};

const invalidateUserLaneQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({ queryKey: USER_QUERY_ROOT });
  await queryClient.invalidateQueries({ queryKey: ROLE_QUERY_ROOT });
};

export const useCreateUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UserCreatePayload) => createUser(payload),
    onSuccess: async () => {
      await invalidateUserLaneQueries(queryClient);
    },
  });
};

export const useUpdateUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UserUpdatePayload }) =>
      updateUser(userId, payload),
    onSuccess: async () => {
      await invalidateUserLaneQueries(queryClient);
    },
  });
};

export const useUserAuthLinkageMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UserAuthLinkagePayload }) =>
      setUserAuthLinkage(userId, payload),
    onSuccess: async () => {
      await invalidateUserLaneQueries(queryClient);
    },
  });
};

export const useUserLifecycleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: UserLifecycleAction }) =>
      performUserLifecycleAction(userId, action),
    onSuccess: async () => {
      await invalidateUserLaneQueries(queryClient);
    },
  });
};
