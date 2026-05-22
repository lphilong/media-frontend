import { z } from 'zod';

import {
  userAccountStatusValues,
  userActorKindValues,
} from '@modules/user/constants/user.constants';
import type {
  CursorPagedResponse,
  UserAuthLinkagePayload,
  UserCreatePayload,
  UserDetailRecord,
  UserLifecycleAction,
  UserListItem,
  UserListQuery,
  UserMutationResult,
  UserProvisionPayload,
  UserUpdatePayload,
} from '@modules/user/types/user.types';
import { apiRequest } from '@shared/api';

const userAccountStatusSchema = z.enum(userAccountStatusValues);
const userActorKindSchema = z.enum(userActorKindValues);

const userListItemSchema = z
  .object({
    id: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    email: z.string().nullable().optional(),
    actorKind: userActorKindSchema,
    accountStatus: userAccountStatusSchema,
    authLinkage: z
      .object({
        status: z.enum(['LINKED', 'UNLINKED', 'PENDING']).optional(),
      })
      .strict()
      .optional(),
    updatedAt: z.union([z.number(), z.string()]),
  })
  .strict();

const userDetailSchema = z
  .object({
    id: z.string().trim().min(1),
    accountStatus: userAccountStatusSchema,
    actorKind: userActorKindSchema,
    authLinkage: z
      .object({
        provider: z.literal('auth0'),
        subject: z.string().trim().min(1),
        status: z.enum(['LINKED', 'UNLINKED', 'PENDING']).optional(),
      })
      .strict(),
    contextAccess: z
      .object({
        contexts: z.array(
          z
            .object({
              context: z.literal('ADMIN'),
            })
            .strict(),
        ),
      })
      .strict(),
    profile: z
      .object({
        displayName: z.string().trim().min(1),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
      })
      .strict(),
    preferences: z
      .object({
        locale: z.string().nullable().optional(),
        timezone: z.string().nullable().optional(),
      })
      .strict(),
    createdAt: z.union([z.number(), z.string()]),
    updatedAt: z.union([z.number(), z.string()]),
    activatedAt: z.union([z.number(), z.string()]).nullable().optional(),
    disabledAt: z.union([z.number(), z.string()]).nullable().optional(),
    archivedAt: z.union([z.number(), z.string()]).nullable().optional(),
  })
  .strict();

const cursorMetaSchema = z
  .object({
    nextCursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .optional();

const listResponseSchema = z
  .object({
    data: z.array(userListItemSchema),
    meta: cursorMetaSchema,
  })
  .strict();

const detailResponseSchema = z
  .object({
    data: userDetailSchema,
  })
  .strict();

const mutationResponseSchema = z
  .object({
    data: userDetailSchema,
    meta: z
      .object({
        provisioning: z
          .object({
            credentialMode: z.literal('INVITE_LINK'),
            auth0UserCreated: z.boolean(),
            invitationTicketCreated: z.boolean(),
          })
          .strict()
          .optional(),
        passwordSetup: z
          .object({
            ticketCreated: z.boolean(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const sanitizeListQuery = (query: UserListQuery): Record<string, string | number | undefined> => ({
  state: query.state,
  actorKind: query.actorKind,
  limit: query.limit,
  cursor: query.cursor,
  search: query.search,
});

const sanitizeCreatePayload = (payload: UserCreatePayload): UserCreatePayload => ({
  actorKind: payload.actorKind,
  displayName: payload.displayName,
  email: payload.email,
  phone: payload.phone,
  locale: payload.locale,
  timezone: payload.timezone,
});

const sanitizeProvisionPayload = (payload: UserProvisionPayload): UserProvisionPayload => ({
  actorKind: payload.actorKind,
  displayName: payload.displayName,
  email: payload.email,
  phone: payload.phone,
  locale: payload.locale,
  timezone: payload.timezone,
  credentialMode: payload.credentialMode ?? 'INVITE_LINK',
  sendInvitation: payload.sendInvitation ?? true,
});

const sanitizeUpdatePayload = (payload: UserUpdatePayload): UserUpdatePayload => ({
  displayName: payload.displayName,
  email: payload.email,
  phone: payload.phone,
  locale: payload.locale,
  timezone: payload.timezone,
});

export const fetchUsers = async (
  query: UserListQuery,
): Promise<CursorPagedResponse<UserListItem>> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: '/admin/users',
    params: sanitizeListQuery(query),
  });

  return listResponseSchema.parse(response);
};

export const fetchUserDetail = async (userId: string): Promise<UserDetailRecord> => {
  const response = await apiRequest<unknown>({
    method: 'GET',
    url: `/admin/users/${encodeURIComponent(userId)}`,
  });

  return detailResponseSchema.parse(response).data;
};

export const createUser = async (payload: UserCreatePayload): Promise<UserDetailRecord> => {
  const response = await apiRequest<unknown, UserCreatePayload>({
    method: 'POST',
    url: '/admin/users',
    data: sanitizeCreatePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const provisionUser = async (payload: UserProvisionPayload): Promise<UserMutationResult> => {
  const response = await apiRequest<unknown, UserProvisionPayload>({
    method: 'POST',
    url: '/admin/users/provision',
    data: sanitizeProvisionPayload(payload),
  });

  const parsed = mutationResponseSchema.parse(response);
  return {
    user: parsed.data,
    provisioning: parsed.meta?.provisioning,
    passwordSetup: parsed.meta?.passwordSetup,
  };
};

export const updateUser = async (
  userId: string,
  payload: UserUpdatePayload,
): Promise<UserDetailRecord> => {
  const response = await apiRequest<unknown, UserUpdatePayload>({
    method: 'PATCH',
    url: `/admin/users/${encodeURIComponent(userId)}`,
    data: sanitizeUpdatePayload(payload),
  });

  return detailResponseSchema.parse(response).data;
};

export const unlinkUserAuthLinkage = async (userId: string): Promise<UserDetailRecord> => {
  const response = await apiRequest<unknown>({
    method: 'DELETE',
    url: `/admin/users/${encodeURIComponent(userId)}/auth-linkage`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};

export const sendUserPasswordSetup = async (userId: string): Promise<UserMutationResult> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/users/${encodeURIComponent(userId)}/send-password-setup`,
    data: {},
  });

  const parsed = mutationResponseSchema.parse(response);
  return {
    user: parsed.data,
    provisioning: parsed.meta?.provisioning,
    passwordSetup: parsed.meta?.passwordSetup,
  };
};

export const setUserAuthLinkage = async (
  userId: string,
  payload: UserAuthLinkagePayload,
): Promise<UserDetailRecord> => {
  const response = await apiRequest<unknown, UserAuthLinkagePayload>({
    method: 'PUT',
    url: `/admin/users/${encodeURIComponent(userId)}/auth-linkage`,
    data: {
      provider: 'auth0',
      subject: payload.subject,
    },
  });

  return detailResponseSchema.parse(response).data;
};

export const performUserLifecycleAction = async (
  userId: string,
  action: UserLifecycleAction,
): Promise<UserDetailRecord> => {
  const response = await apiRequest<unknown>({
    method: 'POST',
    url: `/admin/users/${encodeURIComponent(userId)}/${action}`,
    data: {},
  });

  return detailResponseSchema.parse(response).data;
};
