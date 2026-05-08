import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createUser,
  fetchUsers,
  performUserLifecycleAction,
  setUserAuthLinkage,
  updateUser,
} from '@modules/user/api/user.api';
import {
  UserAuthLinkageSurface,
  UserCreateSurface,
  UserUpdateSurface,
} from '@modules/user/forms/user-mutation-forms';
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

const userDetail: UserDetailRecord = {
  id: 'user-admin',
  accountStatus: 'ACTIVE',
  actorKind: 'ADMIN',
  authLinkage: {
    provider: 'auth0',
    subject: 'auth0|admin',
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
      actorKind: 'ADMIN',
      cursor: 'opaque',
      search: 'Admin',
    });

    const serialized = serializeScreenQueryParams(
      {
        state: 'DISABLED',
        actorKind: 'STAFF',
        cursor: 'next',
        limit: 50,
        search: 'Staff',
        scope: 'global',
        scopeGrants: 'admin',
        sortBy: 'updatedAt',
      },
      userFlatListQueryConfig,
    );

    expect(Array.from(serialized.keys()).sort()).toEqual([
      'actorKind',
      'cursor',
      'limit',
      'search',
      'state',
    ]);
    expect(serialized.get('scope')).toBeNull();
    expect(serialized.get('scopeGrants')).toBeNull();
    expect(serialized.get('sortBy')).toBeNull();
  });

  it('does not emit scope, scopeGrants, or unsupported body keys through the User API layer', async () => {
    apiRequestMock.mockResolvedValue({
      data: [],
    });
    await fetchUsers({
      state: 'ACTIVE',
      actorKind: 'ADMIN',
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
          actorKind: 'ADMIN',
          cursor: 'opaque',
          limit: 50,
          search: 'Admin',
        },
      }),
    );

    mockDetailResponse();
    await createUser({
      authSubject: 'auth0|new',
      actorKind: 'STAFF',
      displayName: 'New User',
      email: 'new@example.test',
      scope: 'global',
      scopeGrants: ['x'],
      roleIds: ['role-admin'],
    } as Parameters<typeof createUser>[0]);

    const createCall = apiRequestMock.mock.calls.at(-1)?.[0];
    expect(createCall?.data).toMatchObject({
      authSubject: 'auth0|new',
      actorKind: 'STAFF',
      displayName: 'New User',
      email: 'new@example.test',
    });
    expect(createCall?.data).not.toHaveProperty('scope');
    expect(createCall?.data).not.toHaveProperty('scopeGrants');
    expect(createCall?.data).not.toHaveProperty('roleIds');

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

  it('submits create, update, and Auth0 linkage surfaces with supported payload keys only', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onUpdate = vi.fn();
    const onAuthLinkage = vi.fn();

    const createRender = render(
      <UserCreateSurface onCancel={() => undefined} onSubmit={onCreate} />,
    );

    await user.type(screen.getByLabelText(i18n.t('user:fields.authSubject')), 'auth0|created');
    await user.type(screen.getByLabelText(i18n.t('user:fields.displayName')), 'Created User');
    await user.type(screen.getByLabelText(i18n.t('user:fields.email')), 'created@example.test');
    await user.click(screen.getByRole('button', { name: i18n.t('user:mutations.create.submit') }));

    expect(onCreate).toHaveBeenCalledWith({
      authSubject: 'auth0|created',
      actorKind: 'STAFF',
      displayName: 'Created User',
      email: 'created@example.test',
      phone: undefined,
      locale: undefined,
      timezone: undefined,
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

  it('sends User Auth0 linkage and lifecycle payloads exactly as IA-1 allows', async () => {
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

    await performUserLifecycleAction('user-admin', 'disable');
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/users/user-admin/disable',
        data: {},
      }),
    );
  });
});
