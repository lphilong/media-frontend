import type {
  userAccountStatusValues,
  userLifecycleActionValues,
  USER_PERMISSION_LITERALS,
} from '@modules/user/constants/user.constants';

export type UserAccountStatus = (typeof userAccountStatusValues)[number];
export type UserLifecycleAction = (typeof userLifecycleActionValues)[number];
export type UserPermissionLiteral = (typeof USER_PERMISSION_LITERALS)[number];
export type UserAuthLinkageStatus = 'LINKED' | 'UNLINKED' | 'PENDING';

export type UserAuthLinkage = {
  provider: 'auth0';
  subject: string;
  status?: UserAuthLinkageStatus;
};

export type UserListAuthLinkage = {
  status?: UserAuthLinkageStatus;
};

export type UserListItem = {
  id: string;
  displayName: string;
  email?: string | null;
  accountStatus: UserAccountStatus;
  authLinkage?: UserListAuthLinkage;
  updatedAt: number | string;
};

export type UserDetailRecord = {
  id: string;
  accountStatus: UserAccountStatus;
  authLinkage: UserAuthLinkage;
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
  limit?: number;
  cursor?: string;
  search?: string;
};

export type UserCreatePayload = {
  displayName: string;
  email?: string;
  phone?: string;
  locale?: string;
  timezone?: string;
};

export type UserProvisionPayload = UserCreatePayload & {
  email: string;
  credentialMode?: 'INVITE_LINK';
  sendInvitation?: boolean;
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

export type UserProvisionMetadata = {
  credentialMode: 'INVITE_LINK';
  auth0UserCreated: boolean;
  invitationEmailSent: boolean;
  invitationTicketCreated: boolean;
  passwordSetupDeliveryMode: 'auth0_email' | 'backend_ticket';
};

export type UserPasswordSetupMetadata = {
  deliveryMode: 'auth0_email' | 'backend_ticket';
  emailSent?: boolean;
  ticketCreated?: boolean;
};

export type UserMutationResult = {
  user: UserDetailRecord;
  provisioning?: UserProvisionMetadata;
  passwordSetup?: UserPasswordSetupMetadata;
};

export type CursorPagedResponse<TData> = {
  data: TData[];
  meta?: {
    nextCursor?: string;
  };
};
