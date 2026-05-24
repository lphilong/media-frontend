import { http, HttpResponse } from 'msw';

type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
type UserActorKind = 'ADMIN' | 'STAFF';
type RoleState = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type RoleAssignmentState = 'ACTIVE' | 'REVOKED';
type RoleTemplateCode =
  | 'ADMIN_FULL'
  | 'HR_OPERATIONS'
  | 'TEAM_MANAGER'
  | 'PRODUCTION_OPS'
  | 'COMMERCIAL_FINANCE'
  | 'TALENT_STAFF_SELF'
  | 'VIEWER_AUDITOR';
type RoleTemplateStatus = 'READY' | 'PREVIEW_ONLY' | 'REQUIRES_FUTURE_SCOPE';

type RoleAssignmentScopeGrants = {
  workSchedule?: Array<'self' | 'team' | 'department' | 'global'>;
  eventAssignment?: Array<'global' | 'managedGroup'>;
  contractRegistry?: Array<'global'>;
  talentKpi?: Array<'global'>;
  kpi?: Array<'global' | 'managedGroup' | 'self'>;
  revenueLedger?: Array<'global'>;
  commission?: Array<'global'>;
  dashboardLite?: Array<'global'>;
};

type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  status?: string;
};

type UserRecord = {
  id: string;
  accountStatus: UserStatus;
  actorKind: UserActorKind;
  authLinkage: {
    provider: 'auth0';
    subject: string;
    status?: 'LINKED' | 'UNLINKED' | 'PENDING';
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
  templateCode?: RoleTemplateCode | null;
  templateVersion?: string | null;
  templateAppliedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  activatedAt: number | null;
  archivedAt: number | null;
};

type RoleAssignmentRecord = {
  assignmentId: string;
  roleId: string;
  userId: string;
  roleRef?: ReferenceSummary | null;
  userRef?: ReferenceSummary | null;
  scopeGrants?: RoleAssignmentScopeGrants;
  state: RoleAssignmentState;
  effectiveAt: number;
  revokedAt: number | null;
  reason: string | null;
};

type RoleTemplateScopePlanEntry = {
  module: string;
  scopes: string[];
  status: RoleTemplateStatus;
  note: string;
};

type RoleTemplateRecord = {
  code: RoleTemplateCode;
  version: string;
  name: string;
  description: string;
  category: string;
  permissions: Array<{ code: string }>;
  recommendedScopeGrants: RoleAssignmentScopeGrants;
  scopePlan: RoleTemplateScopePlanEntry[];
  warnings: string[];
  implementationNotes: string[];
  status: RoleTemplateStatus;
};

type CurrentActorCapabilitiesRecord = {
  id: string;
  type: 'admin';
  context: 'ADMIN';
  isActive: boolean;
  roles: string[];
  permissions: string[];
  scopeGrants: RoleAssignmentScopeGrants;
  generatedAt: string;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const templateVersion = '2026-05-20';
const initialUserSeed = 900;
const initialRoleSeed = 800;
const initialAssignmentSeed = 300;

let userSeed = initialUserSeed;
let roleSeed = initialRoleSeed;
let assignmentSeed = initialAssignmentSeed;

const adminConsoleRoleCodes = [
  'ADMIN_FULL',
  'HR_OPERATIONS',
  'TEAM_MANAGER',
  'PRODUCTION_OPS',
  'COMMERCIAL_FINANCE',
  'VIEWER_AUDITOR',
] as const;
const selfServiceRoleCodes = ['TALENT_STAFF_SELF'] as const;

const initialUsers: UserRecord[] = [
  {
    id: 'user-admin',
    accountStatus: 'ACTIVE',
    actorKind: 'ADMIN',
    authLinkage: { provider: 'auth0', subject: 'auth0|admin', status: 'LINKED' },
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
    authLinkage: { provider: 'auth0', subject: 'auth0|staff', status: 'PENDING' },
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
    authLinkage: { provider: 'auth0', subject: 'auth0|archived', status: 'LINKED' },
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

const roleTemplates: RoleTemplateRecord[] = [
  {
    code: 'ADMIN_FULL',
    version: templateVersion,
    name: 'Admin Full',
    description: 'Full explicit permission preset for administrative operators.',
    category: 'ADMINISTRATION',
    permissions: [
      { code: 'role:view' },
      { code: 'role:create' },
      { code: 'role:assign-to-user' },
      { code: 'user:view' },
      { code: 'dashboard-lite:read' },
    ],
    recommendedScopeGrants: {
      workSchedule: ['global'],
      eventAssignment: ['global'],
      contractRegistry: ['global'],
      talentKpi: ['global'],
      kpi: ['global'],
      revenueLedger: ['global'],
      commission: ['global'],
      dashboardLite: ['global'],
    },
    scopePlan: [
      {
        module: 'Work Schedule',
        scopes: ['global'],
        status: 'PREVIEW_ONLY',
        note: 'Preview-only scope plan; assignment scopes are chosen separately.',
      },
      {
        module: 'Dashboard Lite',
        scopes: ['global'],
        status: 'PREVIEW_ONLY',
        note: 'Preview-only scope plan; assignment scopes are chosen separately.',
      },
    ],
    warnings: [
      'Scope plans are preview-only and do not create assignment grants.',
      'Generated permissions remain explicit role permissions.',
    ],
    implementationNotes: ['Includes current administrative permission examples.'],
    status: 'PREVIEW_ONLY',
  },
  {
    code: 'HR_OPERATIONS',
    version: templateVersion,
    name: 'HR Operations',
    description: 'People, organization, employment, talent, and talent-group operations preset.',
    category: 'PEOPLE_OPERATIONS',
    permissions: [
      { code: 'user:view' },
      { code: 'user:create' },
      { code: 'user:provision_account' },
      { code: 'user:password_setup:send' },
      { code: 'orgUnit.lookup' },
      { code: 'employmentProfile.lookup' },
      { code: 'talent.read' },
      { code: 'talent.lookup' },
      { code: 'talentGroup.lookup' },
      { code: 'studioResource.lookup' },
      { code: 'workSchedule.read' },
      { code: 'kpi.read' },
      { code: 'kpi.readProgress' },
    ],
    recommendedScopeGrants: {
      workSchedule: ['department'],
      kpi: ['global'],
    },
    scopePlan: [
      {
        module: 'Work Schedule',
        scopes: ['department'],
        status: 'PREVIEW_ONLY',
        note: 'Department scope can be requested at assignment time.',
      },
    ],
    warnings: [
      'Revenue, commission, finance lifecycle, and role-management permissions are excluded.',
    ],
    implementationNotes: ['Uses current people-operation permission examples.'],
    status: 'REQUIRES_FUTURE_SCOPE',
  },
  {
    code: 'TEAM_MANAGER',
    version: templateVersion,
    name: 'Team Manager',
    description:
      'Conservative team operations preset for schedules, assignments, and KPI management.',
    category: 'MANAGEMENT',
    permissions: [
      { code: 'work-schedule:read' },
      { code: 'event:read' },
      { code: 'talent-kpi:read' },
      { code: 'kpi.read' },
      { code: 'kpi.readProgress' },
      { code: 'kpi.enterActual' },
      { code: 'kpi.correctActual' },
    ],
    recommendedScopeGrants: {
      workSchedule: ['self', 'team'],
      eventAssignment: ['managedGroup'],
      kpi: ['managedGroup'],
    },
    scopePlan: [
      {
        module: 'Work Schedule',
        scopes: ['self', 'team'],
        status: 'PREVIEW_ONLY',
        note: 'Team Managers may view managed team schedules.',
      },
    ],
    warnings: [
      'Event Assignment and Talent KPI permissions may be global-only until object scope is implemented.',
    ],
    implementationNotes: ['Includes work-schedule read permission only.'],
    status: 'REQUIRES_FUTURE_SCOPE',
  },
  {
    code: 'PRODUCTION_OPS',
    version: templateVersion,
    name: 'Production Ops',
    description: 'Production operations preset for events, resources, schedules, and references.',
    category: 'PRODUCTION',
    permissions: [
      { code: 'event:read' },
      { code: 'event.lookup' },
      { code: 'orgUnit.lookup' },
      { code: 'employmentProfile.lookup' },
      { code: 'talent.lookup' },
      { code: 'talentGroup.lookup' },
      { code: 'platformAccount.lookup' },
      { code: 'studio-resource:read' },
      { code: 'studioResource.lookup' },
      { code: 'work-schedule:read' },
    ],
    recommendedScopeGrants: {
      workSchedule: ['global'],
      eventAssignment: ['global'],
    },
    scopePlan: [
      {
        module: 'Work Schedule',
        scopes: ['global'],
        status: 'READY',
        note: 'Production Ops is the central Work Schedule dispatcher.',
      },
    ],
    warnings: ['Event and studio scope is not materialized by this template.'],
    implementationNotes: ['Uses production operation permission examples.'],
    status: 'REQUIRES_FUTURE_SCOPE',
  },
  {
    code: 'COMMERCIAL_FINANCE',
    version: templateVersion,
    name: 'Commercial Finance',
    description:
      'Commercial finance preset for revenue, commission, settlement, contract, and dashboard workflows.',
    category: 'FINANCE',
    permissions: [
      { code: 'revenue-ledger:read' },
      { code: 'revenueLedger.lookup' },
      { code: 'commissionRule.lookup' },
      { code: 'commission-settlement:read' },
      { code: 'contract-registry:read' },
      { code: 'contractRegistry.lookup' },
      { code: 'employmentProfile.lookup' },
      { code: 'talent.lookup' },
      { code: 'platformAccount.lookup' },
      { code: 'event.lookup' },
      { code: 'kpi.read' },
      { code: 'kpi.readProgress' },
      { code: 'dashboard-lite:read' },
    ],
    recommendedScopeGrants: {
      contractRegistry: ['global'],
      kpi: ['global'],
      revenueLedger: ['global'],
      commission: ['global'],
      dashboardLite: ['global'],
    },
    scopePlan: [
      {
        module: 'Commercial Finance',
        scopes: ['global'],
        status: 'REQUIRES_FUTURE_SCOPE',
        note: 'Current commercial finance route scope is mostly global-only.',
      },
    ],
    warnings: ['No assignment scope or scope grants are persisted by this template.'],
    implementationNotes: ['Includes commercial finance permission examples.'],
    status: 'REQUIRES_FUTURE_SCOPE',
  },
  {
    code: 'TALENT_STAFF_SELF',
    version: templateVersion,
    name: 'Talent Staff Self',
    description: 'Read-only self-intended baseline for talent-facing staff access.',
    category: 'SELF_SERVICE',
    permissions: [
      { code: 'work-schedule:read' },
      { code: 'event:read' },
      { code: 'talent-kpi:read' },
      { code: 'kpi.readProgress' },
    ],
    recommendedScopeGrants: {
      workSchedule: ['self'],
      kpi: ['self'],
    },
    scopePlan: [
      {
        module: 'Self Service',
        scopes: ['self'],
        status: 'REQUIRES_FUTURE_SCOPE',
        note: 'Self-facing object scope is mostly not implemented outside Work Schedule.',
      },
    ],
    warnings: [
      'Self-scope intent is preview-only and does not limit generated permissions by itself.',
    ],
    implementationNotes: ['Includes read-only self-service permission examples.'],
    status: 'REQUIRES_FUTURE_SCOPE',
  },
  {
    code: 'VIEWER_AUDITOR',
    version: templateVersion,
    name: 'Viewer Auditor',
    description: 'Read-only auditor preset across operational and commercial modules.',
    category: 'AUDIT',
    permissions: [
      { code: 'work-schedule:read' },
      { code: 'contract-registry:read' },
      { code: 'kpi.read' },
      { code: 'kpi.readProgress' },
      { code: 'dashboard-lite:read' },
    ],
    recommendedScopeGrants: {
      workSchedule: ['global'],
      eventAssignment: ['global'],
      contractRegistry: ['global'],
      talentKpi: ['global'],
      kpi: ['global'],
      revenueLedger: ['global'],
      commission: ['global'],
      dashboardLite: ['global'],
    },
    scopePlan: [
      {
        module: 'Read Only Audit',
        scopes: ['global'],
        status: 'REQUIRES_FUTURE_SCOPE',
        note: 'Final auditor scope policy must be product-confirmed per module.',
      },
    ],
    warnings: ['No create, update, lifecycle, finalize, or reconcile permissions are included.'],
    implementationNotes: ['Uses current read-only permission examples.'],
    status: 'REQUIRES_FUTURE_SCOPE',
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
    templateCode: 'ADMIN_FULL',
    templateVersion,
    templateAppliedAt: now - 9_500,
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
    scopeGrants: {
      workSchedule: ['self', 'team'],
      dashboardLite: ['global'],
    },
    state: 'ACTIVE',
    effectiveAt: now - 8_000,
    revokedAt: null,
    reason: null,
  },
];

const defaultCurrentActorCapabilities: CurrentActorCapabilitiesRecord = {
  id: 'user-admin',
  type: 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: ['role-admin'],
  permissions: [
    'dashboardLite.read',
    'user:view',
    'user:create',
    'role:list',
    'role:view',
    'role:create',
    'role:update',
    'role:activate',
    'role:deactivate',
    'role:archive',
    'role:permission:assign',
    'role:assignment_rule:set',
    'role:assign_to_user',
    'role:revoke_from_user',
    'user:edit',
    'user:provision_account',
    'user:activate',
    'user:disable',
    'user:archive',
    'user:auth_linkage:set',
    'user:auth_linkage:unlink',
    'user:password_setup:send',
    'user:actor_kind:update',
    'orgUnit.read',
    'orgUnit.create',
    'orgUnit.update',
    'orgUnit.manageHierarchy',
    'orgUnit.manageLifecycle',
    'employmentProfile.read',
    'employmentProfile.create',
    'employmentProfile.update',
    'employmentProfile.manageOrgAssignment',
    'employmentProfile.manageManagerAssignment',
    'employmentProfile.manageUserLinkage',
    'employmentProfile.manageLifecycle',
    'talent.read',
    'talent.create',
    'talent.update',
    'talent.manageManager',
    'talent.manageEmploymentLink',
    'talent.manageCommercialParticipation',
    'talent.manageLifecycle',
    'talentGroup.read',
    'talentGroup.create',
    'talentGroup.update',
    'talentGroup.manageMembership',
    'talentGroup.manageLifecycle',
    'platformAccount.read',
    'platformAccount.create',
    'platformAccount.update',
    'platformAccount.manageOwnership',
    'platformAccount.manageCapabilities',
    'platformAccount.manageLifecycle',
    'studioResource.read',
    'studioResource.create',
    'studioResource.update',
    'studioResource.manageAvailability',
    'studioResource.manageLifecycle',
    'event.read',
    'event.create',
    'event.update',
    'event.manageAssignments',
    'event.manageLifecycle',
    'workSchedule.read',
    'workSchedule.create',
    'workSchedule.update',
    'workSchedule.manageLifecycle',
    'contractRegistry.read',
    'contractRegistry.create',
    'contractRegistry.update',
    'contractRegistry.manageOwner',
    'contractRegistry.manageFileReference',
    'contractRegistry.manageLifecycle',
    'talentKpi.read',
    'talentKpi.create',
    'talentKpi.update',
    'talentKpi.manageMetrics',
    'talentKpi.manageLifecycle',
    'kpi.read',
    'kpi.createPlan',
    'kpi.updateDraft',
    'kpi.publish',
    'kpi.manageAllocation',
    'kpi.archive',
    'kpi.enterActual',
    'kpi.correctActual',
    'kpi.readProgress',
    'kpi.finalize',
    'revenueLedger.read',
    'revenueLedger.create',
    'revenueLedger.update',
    'revenueLedger.manageLifecycle',
    'revenueLedger.reconcile',
    'commissionRule.read',
    'commissionRule.create',
    'commissionRule.update',
    'commissionRule.manageLifecycle',
    'commissionSettlement.read',
    'commissionSettlement.create',
    'commissionSettlement.update',
    'commissionSettlement.manageLifecycle',
  ],
  scopeGrants: {
    eventAssignment: ['global'],
    contractRegistry: ['global'],
    talentKpi: ['global'],
    kpi: ['global'],
    revenueLedger: ['global'],
    commission: ['global'],
    dashboardLite: ['global'],
    workSchedule: ['self', 'team', 'department', 'global'],
  },
  generatedAt: '2026-05-20T00:00:00.000Z',
};

let currentActorCapabilities: CurrentActorCapabilitiesRecord = cloneCurrentActorCapabilities(
  defaultCurrentActorCapabilities,
);

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
  currentActorCapabilities = cloneCurrentActorCapabilities(defaultCurrentActorCapabilities);
};

export const getMockCurrentActorCapabilities = (): CurrentActorCapabilitiesRecord =>
  cloneCurrentActorCapabilities(currentActorCapabilities);

export const setMockCurrentActorCapabilities = (
  capabilities: CurrentActorCapabilitiesRecord,
): void => {
  currentActorCapabilities = cloneCurrentActorCapabilities(capabilities);
};

function cloneCurrentActorCapabilities(
  record: CurrentActorCapabilitiesRecord,
): CurrentActorCapabilitiesRecord {
  return {
    ...record,
    roles: [...record.roles],
    permissions: [...record.permissions],
    scopeGrants: {
      ...(record.scopeGrants.workSchedule
        ? { workSchedule: [...record.scopeGrants.workSchedule] }
        : {}),
      ...(record.scopeGrants.eventAssignment
        ? { eventAssignment: [...record.scopeGrants.eventAssignment] }
        : {}),
      ...(record.scopeGrants.contractRegistry
        ? { contractRegistry: [...record.scopeGrants.contractRegistry] }
        : {}),
      ...(record.scopeGrants.talentKpi ? { talentKpi: [...record.scopeGrants.talentKpi] } : {}),
      ...(record.scopeGrants.kpi ? { kpi: [...record.scopeGrants.kpi] } : {}),
      ...(record.scopeGrants.revenueLedger
        ? { revenueLedger: [...record.scopeGrants.revenueLedger] }
        : {}),
      ...(record.scopeGrants.commission ? { commission: [...record.scopeGrants.commission] } : {}),
      ...(record.scopeGrants.dashboardLite
        ? { dashboardLite: [...record.scopeGrants.dashboardLite] }
        : {}),
    },
  };
}

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

const toUserRef = (userId: string): ReferenceSummary | null => {
  const user = readUser(userId);
  return user
    ? {
        id: user.id,
        displayName: user.profile.displayName,
        name: user.profile.email ?? undefined,
        status: user.accountStatus,
      }
    : null;
};

const readRole = (roleId: string): RoleRecord | undefined =>
  roles.find((record) => record.id === roleId);

const toRoleRef = (roleId: string): ReferenceSummary | null => {
  const role = readRole(roleId);
  return role
    ? {
        id: role.id,
        code: role.code,
        name: role.name,
        status: role.state,
      }
    : null;
};

const toRoleAssignmentItem = (assignment: RoleAssignmentRecord): RoleAssignmentRecord => ({
  ...assignment,
  roleRef: toRoleRef(assignment.roleId),
  userRef: toUserRef(assignment.userId),
});

const toUserListItem = (record: UserRecord) => ({
  id: record.id,
  displayName: record.profile.displayName,
  email: record.profile.email,
  actorKind: record.actorKind,
  accountStatus: record.accountStatus,
  authLinkage: { status: record.authLinkage.status ?? 'LINKED' },
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
  templateCode: record.templateCode ?? null,
  templateVersion: record.templateVersion ?? null,
  templateAppliedAt: record.templateAppliedAt ?? null,
  updatedAt: record.updatedAt,
});

const toRoleDetail = (record: RoleRecord) => ({ ...record });

const toRoleTemplateListItem = (template: RoleTemplateRecord) => ({
  code: template.code,
  version: template.version,
  name: template.name,
  description: template.description,
  category: template.category,
  permissionCount: template.permissions.length,
  recommendedScopeGrants: template.recommendedScopeGrants,
  scopePlan: template.scopePlan,
  warnings: template.warnings,
  implementationNotes: template.implementationNotes,
  status: template.status,
});

const readRoleTemplate = (templateCode: string): RoleTemplateRecord | undefined =>
  roleTemplates.find((template) => template.code === templateCode.trim().toUpperCase());

const readManualRoleCode = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().toUpperCase();
  }

  return undefined;
};

const roleCodeExists = (code: string): boolean => roles.some((role) => role.code === code);

const duplicateRoleCodeResponse = (code: string): Response =>
  HttpResponse.json(
    {
      error: {
        code: 'ROLE_CONFLICT',
        message: `Role code already exists: ${code}`,
      },
      message: `Role code already exists: ${code}`,
    },
    { status: 409 },
  );

const allocateGeneratedRoleCode = (): string => {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const code = `ROLE-${String(roleSeed).padStart(6, '0')}`;
    if (!roleCodeExists(code)) {
      return code;
    }
    roleSeed += 1;
  }

  throw new Error('MSW generated Role code sequence exhausted');
};

const readRoleCodeForCreate = (value: unknown): string | Response => {
  const manualCode = readManualRoleCode(value);
  if (manualCode) {
    return roleCodeExists(manualCode) ? duplicateRoleCodeResponse(manualCode) : manualCode;
  }

  return allocateGeneratedRoleCode();
};

export const identityAccessHandlers = [
  http.get('*/admin/me/capabilities', () => {
    return HttpResponse.json({
      data: currentActorCapabilities,
    });
  }),

  http.get('*/admin/role-templates', () => {
    return HttpResponse.json({ data: roleTemplates.map(toRoleTemplateListItem) });
  }),

  http.post('*/admin/role-templates/:templateCode/preview', ({ params }) => {
    const template = readRoleTemplate(String(params.templateCode));
    if (!template) {
      return HttpResponse.json({ message: 'Unknown role template code' }, { status: 400 });
    }

    return HttpResponse.json({
      data: {
        template: {
          ...toRoleTemplateListItem(template),
          permissions: template.permissions,
        },
        permissions: template.permissions,
        scopePlan: template.scopePlan,
        warnings: template.warnings,
        unsupportedScopeNotes: template.scopePlan
          .filter((entry) => entry.status === 'REQUIRES_FUTURE_SCOPE')
          .map((entry) => entry.note),
      },
    });
  }),

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
    if (typeof body.authSubject !== 'string' || body.authSubject.trim().length === 0) {
      return HttpResponse.json({ message: 'authSubject is required' }, { status: 400 });
    }
    userSeed += 1;
    const record: UserRecord = {
      id: `user-${userSeed}`,
      accountStatus: 'PENDING',
      actorKind: body.actorKind === 'ADMIN' ? 'ADMIN' : 'STAFF',
      authLinkage: { provider: 'auth0', subject: body.authSubject.trim() },
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

  http.post('*/admin/users/provision', async ({ request }) => {
    const body = await parseJsonBody(request);
    if (typeof body.email !== 'string' || body.email.trim().length === 0) {
      return HttpResponse.json({ message: 'email is required' }, { status: 400 });
    }
    const usesBackendTicket = body.email.includes('backend-ticket');
    userSeed += 1;
    const record: UserRecord = {
      id: `user-${userSeed}`,
      accountStatus: 'PENDING',
      actorKind: body.actorKind === 'ADMIN' ? 'ADMIN' : 'STAFF',
      authLinkage: {
        provider: 'auth0',
        subject: `auth0|provisioned-${userSeed}`,
        status: 'LINKED',
      },
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
    return HttpResponse.json({
      data: toUserDetail(record),
      meta: {
        provisioning: {
          credentialMode: 'INVITE_LINK',
          auth0UserCreated: true,
          invitationEmailSent: !usesBackendTicket,
          invitationTicketCreated: usesBackendTicket,
          passwordSetupDeliveryMode: usesBackendTicket ? 'backend_ticket' : 'auth0_email',
        },
        passwordSetup: {
          deliveryMode: usesBackendTicket ? 'backend_ticket' : 'auth0_email',
          emailSent: !usesBackendTicket,
          ticketCreated: usesBackendTicket,
        },
      },
    });
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
    record.authLinkage = {
      provider: 'auth0',
      subject: String(body.subject ?? ''),
      status: 'LINKED',
    };
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toUserDetail(record) });
  }),

  http.patch('*/admin/users/:userId/actor-kind', async ({ params, request }) => {
    const record = readUser(String(params.userId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.accountStatus === 'ARCHIVED') {
      return HttpResponse.json({ message: 'user:detail.archivedReadOnly' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    const nextActorKind = body.actorKind;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (nextActorKind !== 'ADMIN' && nextActorKind !== 'STAFF') {
      return HttpResponse.json({ message: 'actorKind must be ADMIN or STAFF' }, { status: 422 });
    }
    if (!reason) {
      return HttpResponse.json({ message: 'reason is required' }, { status: 422 });
    }
    if (record.actorKind === 'ADMIN' && nextActorKind === 'STAFF') {
      const activeAdminRoleCodes = assignments
        .filter((assignment) => assignment.userId === record.id && assignment.state === 'ACTIVE')
        .map((assignment) => readRole(assignment.roleId))
        .filter((role): role is RoleRecord => Boolean(role))
        .map((role) => role.templateCode ?? role.code)
        .filter((code) =>
          adminConsoleRoleCodes.includes(code as (typeof adminConsoleRoleCodes)[number]),
        );
      if (activeAdminRoleCodes.length > 0) {
        return HttpResponse.json(
          {
            message: `Cannot convert ADMIN account to STAFF while active admin-console role assignments exist: ${activeAdminRoleCodes.join(', ')}`,
          },
          { status: 422 },
        );
      }
    }

    record.actorKind = nextActorKind;
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toUserDetail(record) });
  }),

  http.delete('*/admin/users/:userId/auth-linkage', ({ params }) => {
    const record = readUser(String(params.userId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.accountStatus === 'ARCHIVED') {
      return HttpResponse.json({ message: 'user:detail.archivedReadOnly' }, { status: 422 });
    }

    record.authLinkage = {
      provider: 'auth0',
      subject: `unlinked:${record.id}`,
      status: 'UNLINKED',
    };
    record.accountStatus = record.accountStatus === 'ACTIVE' ? 'PENDING' : record.accountStatus;
    record.updatedAt = Date.now();
    return HttpResponse.json({ data: toUserDetail(record) });
  }),

  http.post('*/admin/users/:userId/send-password-setup', ({ params }) => {
    const record = readUser(String(params.userId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.accountStatus === 'ARCHIVED') {
      return HttpResponse.json({ message: 'user:detail.archivedReadOnly' }, { status: 422 });
    }
    if ((record.authLinkage.status ?? 'PENDING') !== 'LINKED') {
      return HttpResponse.json(
        { message: 'user:validation.passwordSetupRequiresLinked' },
        { status: 422 },
      );
    }

    record.updatedAt = Date.now();
    const usesBackendTicket = record.profile.email?.includes('backend-ticket') === true;
    return HttpResponse.json({
      data: toUserDetail(record),
      meta: {
        passwordSetup: {
          deliveryMode: usesBackendTicket ? 'backend_ticket' : 'auth0_email',
          emailSent: !usesBackendTicket,
          ticketCreated: usesBackendTicket,
        },
      },
    });
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

    return HttpResponse.json(paginate(rows.map(toRoleAssignmentItem), url.searchParams));
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
      return HttpResponse.json({ data: toRoleAssignmentItem(assignment) });
    },
  ),

  http.post('*/admin/roles/:roleId/assignments', async ({ params, request }) => {
    const role = readRole(String(params.roleId));
    if (!role || role.state !== 'ACTIVE') {
      return HttpResponse.json({ message: 'role:validation.required' }, { status: 422 });
    }

    const body = await parseJsonBody(request);
    const targetUser = readUser(String(body.userId ?? ''));
    if (!targetUser) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    const governingRoleCode = role.templateCode ?? role.code;
    if (
      adminConsoleRoleCodes.includes(governingRoleCode as (typeof adminConsoleRoleCodes)[number]) &&
      targetUser.actorKind !== 'ADMIN'
    ) {
      return HttpResponse.json(
        { message: `${governingRoleCode} requires an admin console account.` },
        { status: 422 },
      );
    }
    if (
      selfServiceRoleCodes.includes(governingRoleCode as (typeof selfServiceRoleCodes)[number]) &&
      targetUser.actorKind !== 'STAFF'
    ) {
      return HttpResponse.json(
        { message: `${governingRoleCode} requires a self-service staff account.` },
        { status: 422 },
      );
    }

    assignmentSeed += 1;
    const assignment: RoleAssignmentRecord = {
      assignmentId: `assignment-${assignmentSeed}`,
      roleId: role.id,
      userId: String(body.userId ?? ''),
      ...(body.scopeGrants &&
      typeof body.scopeGrants === 'object' &&
      !Array.isArray(body.scopeGrants)
        ? { scopeGrants: body.scopeGrants as RoleAssignmentScopeGrants }
        : {}),
      state: 'ACTIVE',
      effectiveAt: Date.now(),
      revokedAt: null,
      reason: toNullableText(body.reason),
    };
    assignments.push(assignment);
    return HttpResponse.json({ data: toRoleAssignmentItem(assignment) });
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

  http.post('*/admin/roles/from-template', async ({ request }) => {
    const body = await parseJsonBody(request);
    const template = readRoleTemplate(String(body.templateCode ?? ''));
    if (!template) {
      return HttpResponse.json({ message: 'Unknown role template code' }, { status: 400 });
    }

    roleSeed += 1;
    const code = readRoleCodeForCreate(body.code);
    if (code instanceof Response) {
      return code;
    }

    const role: RoleRecord = {
      id: `role-${roleSeed}`,
      code,
      name: String(body.name ?? template.name),
      description: toNullableText(body.description),
      state: 'DRAFT',
      permissions: template.permissions.map((permission) => ({ ...permission })),
      delegationBand: 'LIMITED',
      maxDelegatableBand: 'NONE',
      assignmentRules: [],
      templateCode: template.code,
      templateVersion: template.version,
      templateAppliedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activatedAt: null,
      archivedAt: null,
    };
    roles.push(role);
    return HttpResponse.json({ data: toRoleDetail(role) });
  }),

  http.post('*/admin/roles', async ({ request }) => {
    const body = await parseJsonBody(request);
    roleSeed += 1;
    const code = readRoleCodeForCreate(body.code);
    if (code instanceof Response) {
      return code;
    }

    const role: RoleRecord = {
      id: `role-${roleSeed}`,
      code,
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
