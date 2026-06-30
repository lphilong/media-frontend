import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createUser,
  fetchUsers,
  performUserLifecycleAction,
  provisionUser,
  sendUserPasswordSetup,
  setUserAuthLinkage,
  unlinkUserAuthLinkage,
  updateUser,
} from '@modules/user/api/user.api';
import { APP_PATHS } from '@app/router/paths';
import {
  UserAuthLinkageSurface,
  UserCreateSurface,
  UserProvisionSurface,
  UserUpdateSurface,
} from '@modules/user/forms/user-mutation-forms';
import {
  userCreatePayloadSchema,
  userProvisionPayloadSchema,
} from '@modules/user/schemas/user-payload-schemas';
import type { UserDetailRecord } from '@modules/user/types/user.types';
import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  parseScreenQueryParams,
  serializeScreenQueryParams,
  userFlatListQueryConfig,
} from '@shared/query';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);
const unsafeSetupUrlField = ['ticket', 'Url'].join('');

const userDetail: UserDetailRecord = {
  id: 'user-admin',
  accountStatus: 'ACTIVE',
  authLinkage: {
    provider: 'auth0',
    subject: 'auth0|admin',
    status: 'LINKED',
  },
  contextAccess: {
    contexts: [{ context: 'ADMIN' }],
  },
  profile: {
    displayName: 'Admin User',
    email: 'admin@example.test',
    phone: '0900000000',
  },
  preferences: {
    locale: 'en',
    timezone: 'Asia/Saigon',
  },
  createdAt: 1,
  updatedAt: 2,
  activatedAt: 2,
  disabledAt: null,
  archivedAt: null,
};

const mockDetailResponse = () => {
  apiRequestMock.mockResolvedValue({ data: userDetail });
};

describe('user IA-1 query and payload shaping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses and serializes only the documented User flat-list query keys', () => {
    const parsed = parseScreenQueryParams(
      new URLSearchParams(
        'state=ACTIVE&actorKind=ADMIN&cursor=opaque&limit=250&search=%20Admin%20&scope=global&scopeGrants=x&sortBy=updatedAt',
      ),
      userFlatListQueryConfig,
    );

    expect(parsed).toEqual({
      state: 'ACTIVE',
      cursor: 'opaque',
      search: 'Admin',
    });

    const serialized = serializeScreenQueryParams(
      {
        state: 'DISABLED',
        cursor: 'next',
        limit: 50,
        search: 'Staff',
        scope: 'global',
        scopeGrants: 'admin',
        sortBy: 'updatedAt',
      },
      userFlatListQueryConfig,
    );

    expect(Array.from(serialized.keys()).sort()).toEqual(['cursor', 'limit', 'search', 'state']);
    expect(serialized.get('actorKind')).toBeNull();
    expect(serialized.get('scope')).toBeNull();
    expect(serialized.get('scopeGrants')).toBeNull();
    expect(serialized.get('sortBy')).toBeNull();
  });

  it('does not define public signup or registration routes', () => {
    const pathValues = Object.values(APP_PATHS).filter((value) => typeof value === 'string');

    expect(pathValues).not.toContain('/signup');
    expect(pathValues).not.toContain('/register');
    expect(pathValues).not.toContain('/auth/signup');
    expect(pathValues).not.toContain('/auth/register');
  });

  it('does not emit scope, scopeGrants, or unsupported body keys through the User API layer', async () => {
    apiRequestMock.mockResolvedValue({
      data: [],
    });
    await fetchUsers({
      state: 'ACTIVE',
      cursor: 'opaque',
      limit: 50,
      search: 'Admin',
      scope: 'global',
      scopeGrants: ['x'],
    } as Parameters<typeof fetchUsers>[0]);

    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/users',
        params: {
          state: 'ACTIVE',
          cursor: 'opaque',
          limit: 50,
          search: 'Admin',
        },
      }),
    );

    mockDetailResponse();
    await createUser({
      displayName: 'New User',
      email: 'new@example.test',
      actorKind: 'STAFF',
      scope: 'global',
      scopeGrants: ['x'],
      roleIds: ['role-admin'],
    } as Parameters<typeof createUser>[0]);

    const createCall = apiRequestMock.mock.calls.at(-1)?.[0];
    expect(createCall?.data).toMatchObject({
      displayName: 'New User',
      email: 'new@example.test',
    });
    expect(createCall?.data).not.toHaveProperty('actorKind');
    expect(createCall?.data).not.toHaveProperty('scope');
    expect(createCall?.data).not.toHaveProperty('scopeGrants');
    expect(createCall?.data).not.toHaveProperty('roleIds');

    apiRequestMock.mockResolvedValueOnce({
      data: userDetail,
      meta: {
        provisioning: {
          credentialMode: 'INVITE_LINK',
          auth0UserCreated: true,
          invitationEmailSent: true,
          invitationTicketCreated: false,
          passwordSetupDeliveryMode: 'auth0_email',
        },
        passwordSetup: {
          deliveryMode: 'auth0_email',
          emailSent: true,
          ticketCreated: false,
        },
      },
    });
    await provisionUser({
      displayName: 'Provisioned User',
      email: 'provisioned@example.test',
      actorKind: 'STAFF',
      scope: 'global',
      [unsafeSetupUrlField]: 'https://unsafe.example.test',
    } as Parameters<typeof provisionUser>[0]);

    const provisionCall = apiRequestMock.mock.calls.at(-1)?.[0];
    expect(provisionCall?.data).toEqual({
      displayName: 'Provisioned User',
      email: 'provisioned@example.test',
      phone: undefined,
      locale: undefined,
      timezone: undefined,
      credentialMode: 'INVITE_LINK',
      sendInvitation: true,
    });
    expect(provisionCall?.data).not.toHaveProperty('actorKind');
    expect(provisionCall?.data).not.toHaveProperty(unsafeSetupUrlField);
    expect(provisionCall?.data).not.toHaveProperty('password');

    await updateUser('user-admin', {
      displayName: 'Admin Updated',
      scope: 'global',
      employmentProfileId: 'ep-001',
    } as Parameters<typeof updateUser>[1]);

    const updateCall = apiRequestMock.mock.calls.at(-1)?.[0];
    expect(updateCall?.data).toEqual({
      displayName: 'Admin Updated',
      email: undefined,
      phone: undefined,
      locale: undefined,
      timezone: undefined,
    });
    expect(updateCall?.data).not.toHaveProperty('scope');
    expect(updateCall?.data).not.toHaveProperty('employmentProfileId');
  });

  it('accepts only minimal auth linkage status from the User list response', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [
        {
          id: 'user-list-linked',
          displayName: 'List Linked',
          email: 'list-linked@example.test',
          accountStatus: 'ACTIVE',
          authLinkage: {
            status: 'LINKED',
          },
          updatedAt: 2,
        },
      ],
    });

    await expect(fetchUsers({})).resolves.toMatchObject({
      data: [
        {
          authLinkage: {
            status: 'LINKED',
          },
        },
      ],
    });

    apiRequestMock.mockResolvedValueOnce({
      data: [
        {
          id: 'user-list-leaky',
          displayName: 'List Leaky',
          email: 'list-leaky@example.test',
          accountStatus: 'ACTIVE',
          authLinkage: {
            status: 'LINKED',
            subject: 'auth0|leaky',
          },
          updatedAt: 3,
        },
      ],
    });

    await expect(fetchUsers({})).rejects.toThrow();
  });

  it('submits provision, create, update, and Auth0 linkage surfaces with supported payload keys only', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onProvision = vi.fn();
    const onUpdate = vi.fn();
    const onAuthLinkage = vi.fn();

    const provisionRender = render(
      <UserProvisionSurface onCancel={() => undefined} onSubmit={onProvision} />,
    );
    await user.type(screen.getByLabelText(i18n.t('user:fields.email')), 'created@example.test');
    await user.type(screen.getByLabelText(i18n.t('user:fields.displayName')), 'Created User');
    expect(screen.getByText(i18n.t('user:help.employmentProfileLater'))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('user:fields.actorKind'))).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: i18n.t('user:mutations.provision.submit') }),
    );
    expect(onProvision).toHaveBeenCalledWith({
      displayName: 'Created User',
      email: 'created@example.test',
      phone: undefined,
      locale: undefined,
      timezone: 'Asia/Ho_Chi_Minh',
      credentialMode: 'INVITE_LINK',
      sendInvitation: true,
    });
    provisionRender.unmount();

    const createRender = render(
      <UserCreateSurface onCancel={() => undefined} onSubmit={onCreate} />,
    );

    await user.type(screen.getByLabelText(i18n.t('user:fields.displayName')), 'Created User');
    await user.type(screen.getByLabelText(i18n.t('user:fields.email')), 'created@example.test');
    expect(screen.getByLabelText(i18n.t('user:fields.locale')).tagName).toBe('SELECT');
    expect(screen.getByLabelText(i18n.t('user:fields.timezone'))).toHaveValue('Asia/Ho_Chi_Minh');
    expect(screen.queryByLabelText(i18n.t('user:fields.actorKind'))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('user:mutations.create.submit') }));

    expect(onCreate).toHaveBeenCalledWith({
      displayName: 'Created User',
      email: 'created@example.test',
      phone: undefined,
      locale: undefined,
      timezone: 'Asia/Ho_Chi_Minh',
    });
    createRender.unmount();

    const updateRender = render(
      <UserUpdateSurface
        initialRecord={userDetail}
        onCancel={() => undefined}
        onSubmit={onUpdate}
      />,
    );
    await user.clear(screen.getByLabelText(i18n.t('user:fields.phone')));
    await user.type(screen.getByLabelText(i18n.t('user:fields.phone')), '0911111111');
    await user.click(screen.getByRole('button', { name: i18n.t('user:mutations.update.submit') }));

    expect(onUpdate).toHaveBeenCalledWith({
      phone: '0911111111',
    });
    updateRender.unmount();

    render(
      <UserAuthLinkageSurface
        initialValues={{ provider: 'auth0', subject: 'auth0|admin' }}
        onCancel={() => undefined}
        onSubmit={onAuthLinkage}
      />,
    );
    await user.clear(screen.getByLabelText(i18n.t('user:fields.authSubject')));
    await user.type(screen.getByLabelText(i18n.t('user:fields.authSubject')), 'auth0|updated');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('user:mutations.authLinkage.submit'),
      }),
    );

    expect(onAuthLinkage).toHaveBeenCalledWith({
      provider: 'auth0',
      subject: 'auth0|updated',
    });
  });

  it('sends User Auth0 linkage, unlink, password setup, and lifecycle payloads exactly as IA-1 allows', async () => {
    mockDetailResponse();

    await setUserAuthLinkage('user-admin', {
      provider: 'auth0',
      subject: 'auth0|updated',
    });

    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'PUT',
        url: '/admin/users/user-admin/auth-linkage',
        data: {
          provider: 'auth0',
          subject: 'auth0|updated',
        },
      }),
    );

    await unlinkUserAuthLinkage('user-admin');
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        url: '/admin/users/user-admin/auth-linkage',
        data: {},
      }),
    );

    apiRequestMock.mockResolvedValueOnce({
      data: userDetail,
      meta: {
        passwordSetup: {
          deliveryMode: 'auth0_email',
          emailSent: true,
          ticketCreated: false,
        },
      },
    });
    await sendUserPasswordSetup('user-admin');
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/users/user-admin/send-password-setup',
        data: {},
      }),
    );

    await performUserLifecycleAction('user-admin', 'disable');
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/users/user-admin/disable',
        data: {},
      }),
    );
  });

  it('rejects unsafe user provisioning schema fields and setup URL responses', async () => {
    expect(
      userCreatePayloadSchema.safeParse({
        displayName: 'Created User',
        actorKind: 'ADMIN',
      }).success,
    ).toBe(false);
    expect(
      userProvisionPayloadSchema.safeParse({
        displayName: 'Provisioned User',
        email: 'provisioned@example.test',
        actorKind: 'ADMIN',
      }).success,
    ).toBe(false);
    expect(
      userProvisionPayloadSchema.safeParse({
        displayName: 'Provisioned User',
        email: 'provisioned@example.test',
        [unsafeSetupUrlField]: 'https://unsafe.example.test',
      }).success,
    ).toBe(false);

    apiRequestMock.mockResolvedValueOnce({
      data: userDetail,
      meta: {
        passwordSetup: {
          deliveryMode: 'backend_ticket',
          emailSent: false,
          ticketCreated: true,
          [unsafeSetupUrlField]: 'https://unsafe.example.test',
        },
      },
    });

    await expect(sendUserPasswordSetup('user-admin')).rejects.toThrow();
  });
});
