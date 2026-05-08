import { http, HttpResponse } from 'msw';

type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
type UserActorKind = 'ADMIN' | 'STAFF';
type RoleState = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type RoleAssignmentState = 'ACTIVE' | 'REVOKED';

type UserRecord = {
  id: string;
  accountStatus: UserStatus;
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
    email: string | null;
    phone: string | null;
  };
  preferences: {
    locale: string | null;
    timezone: string | null;
  };
  createdAt: number;
  updatedAt: number;
  activatedAt: number | null;
  disabledAt: number | null;
  archivedAt: number | null;
};

type RoleRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  state: RoleState;
  permissions: Array<{ code: string }>;
  delegationBand: 'LIMITED' | 'PRIVILEGED' | 'FOUNDATION';
  maxDelegatableBand: 'NONE' | 'LIMITED' | 'PRIVILEGED';
  assignmentRules: Array<Record<string, unknown>>;
  createdAt: number;
  updatedAt: number;
  activatedAt: number | null;
  archivedAt: number | null;
};

type RoleAssignmentRecord = {
  assignmentId: string;
  roleId: string;
  userId: string;
  state: RoleAssignmentState;
  effectiveAt: number;
  revokedAt: number | null;
  reason: string | null;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const initialUserSeed = 900;
const initialRoleSeed = 800;
const initialAssignmentSeed = 300;

let userSeed = initialUserSeed;
let roleSeed = initialRoleSeed;
let assignmentSeed = initialAssignmentSeed;

const initialUsers: UserRecord[] = [
  {
    id: 'user-admin',
    accountStatus: 'ACTIVE',
    actorKind: 'ADMIN',
    authLinkage: { provider: 'auth0', subject: 'auth0|admin' },
    contextAccess: { contexts: [{ context: 'ADMIN' }] },
    profile: { displayName: 'Admin User', email: 'admin@example.test', phone: null },
    preferences: { locale: 'en', timezone: 'Asia/Saigon' },
    createdAt: now - 10_000,
    updatedAt: now - 9_000,
    activatedAt: now - 9_000,
    disabledAt: null,
    archivedAt: null,
  },
  {
    id: 'user-staff',
    accountStatus: 'PENDING',
    actorKind: 'STAFF',
    authLinkage: { provider: 'auth0', subject: 'auth0|staff' },
    contextAccess: { contexts: [{ context: 'ADMIN' }] },
    profile: { displayName: 'Staff User', email: 'staff@example.test', phone: '0900000000' },
    preferences: { locale: 'en', timezone: 'UTC' },
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
    activatedAt: null,
    disabledAt: null,
    archivedAt: null,
  },
  {
    id: 'user-archived',
    accountStatus: 'ARCHIVED',
    actorKind: 'STAFF',
    authLinkage: { provider: 'auth0', subject: 'auth0|archived' },
    contextAccess: { contexts: [{ context: 'ADMIN' }] },
    profile: { displayName: 'Archived User', email: 'archived@example.test', phone: null },
    preferences: { locale: null, timezone: null },
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
    activatedAt: null,
    disabledAt: null,
    archivedAt: now - 5_000,
  },
];

const initialRoles: RoleRecord[] = [
  {
    id: 'role-admin',
    code: 'ADMIN',
    name: 'Admin role',
    description: 'Admin permission template',
    state: 'ACTIVE',
    permissions: [{ code: 'role:view' }, { code: 'user:view' }],
    delegationBand: 'PRIVILEGED',
    maxDelegatableBand: 'LIMITED',
    assignmentRules: [{ id: 'rule-1', code: 'ALLOW_ADMIN', conditions: null }],
    createdAt: now - 10_000,
    updatedAt: now - 9_000,
    activatedAt: now - 9_000,
    archivedAt: null,
  },
  {
    id: 'role-draft',
    code: 'OPS',
    name: 'Operations role',
    description: null,
    state: 'DRAFT',
    permissions: [],
    delegationBand: 'LIMITED',
    maxDelegatableBand: 'NONE',
    assignmentRules: [],
    createdAt: now - 8_000,
    updatedAt: now - 7_000,
    activatedAt: null,
    archivedAt: null,
  },
  {
    id: 'role-archived',
    code: 'ARCHIVED',
    name: 'Archived role',
    description: null,
    state: 'ARCHIVED',
    permissions: [],
    delegationBand: 'LIMITED',
    maxDelegatableBand: 'NONE',
    assignmentRules: [],
    createdAt: now - 6_000,
    updatedAt: now - 5_000,
    activatedAt: null,
    archivedAt: now - 5_000,
  },
];

const initialAssignments: RoleAssignmentRecord[] = [
  {
    assignmentId: 'assignment-1',
    roleId: 'role-admin',
    userId: 'user-admin',
    state: 'ACTIVE',
    effectiveAt: now - 8_000,
    revokedAt: null,
    reason: null,
  },
];

let users = initialUsers.map((record) => ({
  ...record,
  profile: { ...record.profile },
  preferences: { ...record.preferences },
  authLinkage: { ...record.authLinkage },
  contextAccess: { contexts: [...record.contextAccess.contexts] },
}));
let roles = initialRoles.map((record) => ({
  ...record,
  permissions: record.permissions.map((permission) => ({ ...permission })),
  assignmentRules: record.assignmentRules.map((rule) => ({ ...rule })),
}));
let assignments = initialAssignments.map((record) => ({ ...record }));

export const resetIdentityAccessMockData = (): void => {
  userSeed = initialUserSeed;
  roleSeed = initialRoleSeed;
  assignmentSeed = initialAssignmentSeed;
  users = initialUsers.map((record) => ({
    ...record,
    profile: { ...record.profile },
    preferences: { ...record.preferences },
    authLinkage: { ...record.authLinkage },
    contextAccess: { contexts: [...record.contextAccess.contexts] },
  }));
  roles = initialRoles.map((record) => ({
    ...record,
    permissions: record.permissions.map((permission) => ({ ...permission })),
    assignmentRules: record.assignmentRules.map((rule) => ({ ...rule })),
  }));
  assignments = initialAssignments.map((record) => ({ ...record }));
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  const body = (await request.json()) as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const toPrefixMatch = (value: string | null, search: string): boolean => {
  if (!value) {
    return false;
  }

  return normalizeText(value).startsWith(normalizeText(search));
};

const parsePositiveInt = (value: string | null | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

const paginate = <TData>(
  items: TData[],
  searchParams: URLSearchParams,
): { data: TData[]; meta?: { nextCursor?: string } } => {
  const limitParam = parsePositiveInt(searchParams.get('limit'));
  const limit = Math.min(limitParam ?? 50, 200);
  const cursorParam = parsePositiveInt(searchParams.get('cursor'));
  const cursor = cursorParam ?? 0;
  const start = Math.min(cursor, items.length);
  const end = Math.min(start + limit, items.length);
  const data = items.slice(start, end);
  const nextCursor = end < items.length ? String(end) : undefined;

  return {
    data,
    meta: nextCursor ? { nextCursor } : undefined,
  };
};

const toNullableText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const readUser = (userId: string): UserRecord | undefined =>
  users.find((record) => record.id === userId);

const readRole = (roleId: string): RoleRecord | undefined =>
  roles.find((record) => record.id === roleId);

const toUserListItem = (record: UserRecord) => ({
  id: record.id,
  displayName: record.profile.displayName,
  email: record.profile.email,
  actorKind: record.actorKind,
  accountStatus: record.accountStatus,
  updatedAt: record.updatedAt,
});

const toUserDetail = (record: UserRecord) => ({ ...record });

const toRoleListItem = (record: RoleRecord) => ({
  id: record.id,
  code: record.code,
  name: record.name,
  state: record.state,
  permissionsSummary: String(record.permissions.length),
  assignmentCountSummary: String(
    assignments.filter(
      (assignment) => assignment.roleId === record.id && assignment.state === 'ACTIVE',
    ).length,
  ),
  updatedAt: record.updatedAt,
});

const toRoleDetail = (record: RoleRecord) => ({ ...record });

export const identityAccessHandlers = [
  http.get('*/admin/users', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const state = searchParams.get('state');
    const actorKind = searchParams.get('actorKind');
    const search = searchParams.get('search');

    let rows = [...users];
    if (!state) {
      rows = rows.filter((item) => item.accountStatus !== 'ARCHIVED');
    } else {
      rows = rows.filter((item) => item.accountStatus === state);
    }
    if (actorKind) {
      rows = rows.filter((item) => item.actorKind === actorKind);
    }
    if (search) {
      rows = rows.filter(
        (item) =>
          toPrefixMatch(item.profile.displayName, search) ||
          toPrefixMatch(item.profile.email, search),
      );
    }

    rows.sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));

    return HttpResponse.json(paginate(rows.map(toUserListItem), searchParams));
  }),

  http.post('*/admin/users', async ({ request }) => {
    const body = await parseJsonBody(request);
    userSeed += 1;
    const record: UserRecord = {
      id: `user-${userSeed}`,
      accountStatus: 'PENDING',
      actorKind: body.actorKind === 'ADMIN' ? 'ADMIN' : 'STAFF',
      authLinkage: { provider: 'auth0', subject: String(body.authSubject ?? `auth0|${userSeed}`) },
      contextAccess: { contexts: [{ context: 'ADMIN' }] },
      profile: {
        displayName: String(body.displayName ?? `User ${userSeed}`),
        email: toNullableText(body.email),
        phone: toNullableText(body.phone),
      },
      preferences: {
        locale: toNullableText(body.locale),
        timezone: toNullableText(body.timezone),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activatedAt: null,
      disabledAt: null,
      archivedAt: null,
    };

    users.push(record);
    return HttpResponse.json({ data: toUserDetail(record) });
  }),

  http.get('*/admin/users/:userId', ({ params }) => {
    const record = readUser(String(params.userId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({ data: toUserDetail(record) });
  }),

  http.patch('*/admin/users/:userId', async ({ params, request }) => {
    const record = readUser(String(params.userId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.accountStatus === 'ARCHIVED') {
      return HttpResponse.json({ message: 'user:detail.archivedReadOnly' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    if (typeof body.displayName === 'string') {
      record.profile.displayName = body.displayName;
    }
    if (typeof body.email === 'string') {
      record.profile.email = body.email;
    }
    if (typeof body.phone === 'string') {
      record.profile.phone = body.phone;
    }
    if (typeof body.locale === 'string') {
      record.preferences.locale = body.locale;
    }
    if (typeof body.timezone === 'string') {
      record.preferences.timezone = body.timezone;
    }
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toUserDetail(record) });
  }),

  http.put('*/admin/users/:userId/auth-linkage', async ({ params, request }) => {
    const record = readUser(String(params.userId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.accountStatus === 'ARCHIVED') {
      return HttpResponse.json({ message: 'user:detail.archivedReadOnly' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    record.authLinkage = { provider: 'auth0', subject: String(body.subject ?? '') };
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toUserDetail(record) });
  }),

  http.post('*/admin/users/:userId/:action', ({ params }) => {
    const record = readUser(String(params.userId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const action = String(params.action);
    if (action === 'activate' && ['PENDING', 'DISABLED'].includes(record.accountStatus)) {
      record.accountStatus = 'ACTIVE';
      record.activatedAt = Date.now();
    } else if (action === 'disable' && record.accountStatus === 'ACTIVE') {
      record.accountStatus = 'DISABLED';
      record.disabledAt = Date.now();
    } else if (action === 'archive' && ['PENDING', 'DISABLED'].includes(record.accountStatus)) {
      record.accountStatus = 'ARCHIVED';
      record.archivedAt = Date.now();
    } else {
      return HttpResponse.json({ message: 'user:validation.lifecycleInvalid' }, { status: 422 });
    }
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toUserDetail(record) });
  }),

  http.get('*/admin/roles/:roleId/assignments', ({ params, request }) => {
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    let rows = assignments.filter((assignment) => assignment.roleId === String(params.roleId));
    if (state) {
      rows = rows.filter((assignment) => assignment.state === state);
    }

    return HttpResponse.json(paginate(rows, url.searchParams));
  }),

  http.post(
    '*/admin/roles/:roleId/assignments/:assignmentId/revoke',
    async ({ params, request }) => {
      const assignment = assignments.find(
        (item) =>
          item.roleId === String(params.roleId) &&
          item.assignmentId === String(params.assignmentId),
      );
      if (!assignment) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }

      const body = await parseJsonBody(request);
      assignment.state = 'REVOKED';
      assignment.revokedAt = Date.now();
      assignment.reason = toNullableText(body.reason);
      return HttpResponse.json({ data: assignment });
    },
  ),

  http.post('*/admin/roles/:roleId/assignments', async ({ params, request }) => {
    const role = readRole(String(params.roleId));
    if (!role || role.state !== 'ACTIVE') {
      return HttpResponse.json({ message: 'role:validation.required' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    assignmentSeed += 1;
    const assignment: RoleAssignmentRecord = {
      assignmentId: `assignment-${assignmentSeed}`,
      roleId: role.id,
      userId: String(body.userId ?? ''),
      state: 'ACTIVE',
      effectiveAt: Date.now(),
      revokedAt: null,
      reason: toNullableText(body.reason),
    };
    assignments.push(assignment);
    return HttpResponse.json({ data: assignment });
  }),

  http.get('*/admin/roles/:roleId/permission-matrix', ({ params }) => {
    const role = readRole(String(params.roleId));
    if (!role) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({
      data: {
        roleId: role.id,
        roleCode: role.code,
        roleState: role.state,
        permissions: role.permissions,
        delegationBand: role.delegationBand,
        maxDelegatableBand: role.maxDelegatableBand,
      },
    });
  }),

  http.get('*/admin/roles', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const state = searchParams.get('state');
    const search = searchParams.get('search');
    let rows = [...roles];
    if (!state) {
      rows = rows.filter((item) => item.state !== 'ARCHIVED');
    } else {
      rows = rows.filter((item) => item.state === state);
    }
    if (search) {
      rows = rows.filter(
        (item) => toPrefixMatch(item.code, search) || toPrefixMatch(item.name, search),
      );
    }
    rows.sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));

    return HttpResponse.json(paginate(rows.map(toRoleListItem), searchParams));
  }),

  http.post('*/admin/roles', async ({ request }) => {
    const body = await parseJsonBody(request);
    roleSeed += 1;
    const role: RoleRecord = {
      id: `role-${roleSeed}`,
      code: String(body.code ?? `ROLE${roleSeed}`).toUpperCase(),
      name: String(body.name ?? `Role ${roleSeed}`),
      description: toNullableText(body.description),
      state: 'DRAFT',
      permissions: Array.isArray(body.initialPermissions)
        ? body.initialPermissions.map((code) => ({ code: String(code) }))
        : [],
      delegationBand:
        body.initialDelegationBand === 'PRIVILEGED' || body.initialDelegationBand === 'FOUNDATION'
          ? body.initialDelegationBand
          : 'LIMITED',
      maxDelegatableBand:
        body.initialMaxDelegatableBand === 'LIMITED' ||
        body.initialMaxDelegatableBand === 'PRIVILEGED'
          ? body.initialMaxDelegatableBand
          : 'NONE',
      assignmentRules: Array.isArray(body.initialAssignmentRules)
        ? (body.initialAssignmentRules as Array<Record<string, unknown>>)
        : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activatedAt: null,
      archivedAt: null,
    };
    roles.push(role);
    return HttpResponse.json({ data: toRoleDetail(role) });
  }),

  http.get('*/admin/roles/:roleId', ({ params }) => {
    const role = readRole(String(params.roleId));
    if (!role) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({ data: toRoleDetail(role) });
  }),

  http.patch('*/admin/roles/:roleId', async ({ params, request }) => {
    const role = readRole(String(params.roleId));
    if (!role) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    if (typeof body.name === 'string') {
      role.name = body.name;
    }
    if ('description' in body) {
      role.description = toNullableText(body.description);
    }
    if (
      body.delegationBand === 'LIMITED' ||
      body.delegationBand === 'PRIVILEGED' ||
      body.delegationBand === 'FOUNDATION'
    ) {
      role.delegationBand = body.delegationBand;
    }
    if (
      body.maxDelegatableBand === 'NONE' ||
      body.maxDelegatableBand === 'LIMITED' ||
      body.maxDelegatableBand === 'PRIVILEGED'
    ) {
      role.maxDelegatableBand = body.maxDelegatableBand;
    }
    role.updatedAt = Date.now();
    return HttpResponse.json({ data: toRoleDetail(role) });
  }),

  http.put('*/admin/roles/:roleId/permissions', async ({ params, request }) => {
    const role = readRole(String(params.roleId));
    if (!role) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    const permissions = Array.isArray(body.permissions)
      ? body.permissions.map((code) => String(code))
      : [];
    role.permissions = Array.from(new Set(permissions)).map((code) => ({ code }));
    role.updatedAt = Date.now();
    return HttpResponse.json({ data: toRoleDetail(role) });
  }),

  http.put('*/admin/roles/:roleId/assignment-rules', async ({ params, request }) => {
    const role = readRole(String(params.roleId));
    if (!role) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const body = await parseJsonBody(request);
    role.assignmentRules = Array.isArray(body.rules)
      ? (body.rules as Array<Record<string, unknown>>)
      : [];
    role.updatedAt = Date.now();
    return HttpResponse.json({ data: toRoleDetail(role) });
  }),

  http.post('*/admin/roles/:roleId/:action', async ({ params, request }) => {
    const role = readRole(String(params.roleId));
    if (!role) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    await parseJsonBody(request);
    const action = String(params.action);
    if (action === 'activate' && (role.state === 'DRAFT' || role.state === 'INACTIVE')) {
      role.state = 'ACTIVE';
      role.activatedAt = Date.now();
    } else if (action === 'deactivate' && role.state === 'ACTIVE') {
      role.state = 'INACTIVE';
    } else if (action === 'archive' && (role.state === 'DRAFT' || role.state === 'INACTIVE')) {
      role.state = 'ARCHIVED';
      role.archivedAt = Date.now();
    } else {
      return HttpResponse.json({ message: 'role:validation.required' }, { status: 422 });
    }
    role.updatedAt = Date.now();
    return HttpResponse.json({ data: toRoleDetail(role) });
  }),
];
