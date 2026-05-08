import type {
  userAccountStatusValues,
  userActorKindValues,
  userLifecycleActionValues,
  USER_PERMISSION_LITERALS,
} from '@modules/user/constants/user.constants';

export type UserAccountStatus = (typeof userAccountStatusValues)[number];
export type UserActorKind = (typeof userActorKindValues)[number];
export type UserLifecycleAction = (typeof userLifecycleActionValues)[number];
export type UserPermissionLiteral = (typeof USER_PERMISSION_LITERALS)[number];

export type UserListItem = {
  id: string;
  displayName: string;
  email?: string | null;
  actorKind: UserActorKind;
  accountStatus: UserAccountStatus;
  updatedAt: number | string;
};

export type UserDetailRecord = {
  id: string;
  accountStatus: UserAccountStatus;
  actorKind: UserActorKind;
  authLinkage: {
    provider: 'auth0';
    subject: string;
  };
  contextAccess: {
    contexts: Array<{ context: 'ADMIN' }>;
  };
  profile: {
    displayName: string;
    email?: string | null;
    phone?: string | null;
  };
  preferences: {
    locale?: string | null;
    timezone?: string | null;
  };
  createdAt: number | string;
  updatedAt: number | string;
  activatedAt?: number | string | null;
  disabledAt?: number | string | null;
  archivedAt?: number | string | null;
};

export type UserListQuery = {
  state?: UserAccountStatus;
  actorKind?: UserActorKind;
  limit?: number;
  cursor?: string;
  search?: string;
};

export type UserCreatePayload = {
  authSubject: string;
  actorKind?: UserActorKind;
  displayName: string;
  email?: string;
  phone?: string;
  locale?: string;
  timezone?: string;
};

export type UserUpdatePayload = {
  displayName?: string;
  email?: string;
  phone?: string;
  locale?: string;
  timezone?: string;
};

export type UserAuthLinkagePayload = {
  provider: 'auth0';
  subject: string;
};

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
