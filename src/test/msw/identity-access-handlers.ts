import { http, HttpResponse } from 'msw';

type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
type UserActorKind = 'ADMIN' | 'STAFF';
type RoleState = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type RoleAssignmentState = 'ACTIVE' | 'REVOKED';
type RoleTemplateCode =
  | 'OWNER_ADMIN'
  | 'ACCESS_ADMIN'
  | 'HR_OPERATIONS'
  | 'HR_TERMS_APPROVER'
  | 'PRODUCTION_OPS'
  | 'PLATFORM_CHANNEL_OPS'
  | 'CREATIVE_VISUAL_LEAD'
  | 'CONTENT_OPS'
  | 'TALENT_GROUP_MANAGER'
  | 'ORG_UNIT_MANAGER'
  | 'KPI_OPERATIONS'
  | 'COMMERCIAL_CONTRACT_OPS'
  | 'REVENUE_FINANCE_OPS'
  | 'REVENUE_APPROVER'
  | 'REVENUE_RECONCILER'
  | 'COMMISSION_OPS'
  | 'COMMISSION_APPROVER'
  | 'ATTENDANCE_OPS'
  | 'LEAVE_REVIEWER'
  | 'ATTENDANCE_APPROVER'
  | 'MONTHLY_CLOSE_OWNER'
  | 'PAYROLL_DRAFT_OPS'
  | 'PAYROLL_DRAFT_APPROVER'
  | 'VIEWER_AUDITOR'
  | 'STAFF_CONSOLE_USER';
type RoleTemplateStatus = 'READY' | 'PREVIEW_ONLY' | 'REQUIRES_FUTURE_SCOPE';
type AccountContext = 'STAFF_CONSOLE' | 'MANAGER_CONSOLE' | 'ADMIN_CONSOLE';

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
  accountContexts?: AccountContext[];
  workspaceAvailability?: WorkspaceAvailabilityRecord;
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
  recommendedAccountContext: AccountContext;
  recommendedScopeGrants: RoleAssignmentScopeGrants;
  scopePlan: RoleTemplateScopePlanEntry[];
  warnings: string[];
  implementationNotes: string[];
  status: RoleTemplateStatus;
};

type RoleBundleRecord = {
  code: string;
  name: string;
  description: string;
  businessPurpose: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: string;
  childRoles: string[];
  recommendedAccountContext: AccountContext;
  recommendedScopes: string[];
  sensitiveWarning: string | null;
  sensitive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AccessAssignmentTargetFixture =
  | {
      assignmentKind: 'ROLE_TEMPLATE';
      code: RoleTemplateCode;
      name: string;
      recommendedAccountContext: AccountContext;
      requiredScopeTypes: string[];
      requiresResponsibility: boolean;
      requiredResponsibilityType: string | null;
      sensitiveLevel: 'STANDARD' | 'HIGH_RISK';
      legacyAssignable: boolean;
      recommendedPickerMode: string;
    }
  | {
      assignmentKind: 'BUNDLE';
      code: string;
      version: string;
      name: string;
      childRoles: string[];
      recommendedAccountContext: AccountContext;
      requiredScopeTypes: string[];
      requiresResponsibility: boolean;
      requiredResponsibilityType: string[];
      sensitiveLevel: 'STANDARD' | 'HIGH_RISK';
      legacyAssignable: boolean;
      recommendedPickerMode: string;
    };

type CurrentActorCapabilitiesRecord = {
  id: string;
  type: 'admin' | 'staff';
  context: 'ADMIN';
  isActive: boolean;
  roles: string[];
  permissions: string[];
  scopeGrants: RoleAssignmentScopeGrants;
  accountContexts?: AccountContext[];
  workspaceAvailability?: WorkspaceAvailabilityRecord;
  generatedAt: string;
};

type WorkspaceAvailabilityRecord = {
  primaryWorkspace: AccountContext | null;
  availableWorkspaces: Array<{
    context: AccountContext;
    available: boolean;
    source: 'ACCOUNT_CONTEXT';
    reasonCodes: string[];
    trace: Array<Record<string, unknown>>;
  }>;
  ownDataAvailable: boolean;
  managerResponsibilitiesAvailable: boolean;
  effectiveAccessTraceAvailable: boolean;
  sourceTrace: Array<Record<string, unknown>>;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const templateVersion = '2026-05-20';
const initialUserSeed = 900;
const initialRoleSeed = 800;
const initialAssignmentSeed = 300;

const permissionRecords = (codes: readonly string[]): Array<{ code: string }> =>
  codes.map((code) => ({ code }));

const adminFullPermissionCodes = [
  'user:view',
  'user:create',
  'user:edit',
  'user:activate',
  'user:disable',
  'user:archive',
  'user:auth_linkage:set',
  'user:provision_account',
  'user:auth_linkage:unlink',
  'user:password_setup:send',
  'user:actor_kind:update',
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
  'role:assignment:view',
  'orgUnit.read',
  'orgUnit.lookup',
  'orgUnit.create',
  'orgUnit.update',
  'orgUnit.manageHierarchy',
  'orgUnit.manageLifecycle',
  'employmentProfile.read',
  'employmentProfile.lookup',
  'employmentProfile.create',
  'employmentProfile.update',
  'employmentProfile.manageOrgAssignment',
  'employmentProfile.manageManagerAssignment',
  'employmentProfile.manageUserLinkage',
  'employmentProfile.manageLifecycle',
  'talent.read',
  'talent.lookup',
  'talent.create',
  'talent.update',
  'talent.manageManager',
  'talent.manageEmploymentLink',
  'talent.manageLifecycle',
  'talent.manageCommercialParticipation',
  'talentGroup.read',
  'talentGroup.lookup',
  'talentGroup.create',
  'talentGroup.update',
  'talentGroup.manageLifecycle',
  'talentGroup.manageMembership',
  'platformAccount.read',
  'platformAccount.lookup',
  'platformAccount.create',
  'platformAccount.update',
  'platformAccount.manageOwnership',
  'platformAccount.manageLifecycle',
  'platformAccount.manageCapabilities',
  'studioResource.read',
  'studioResource.lookup',
  'studioResource.create',
  'studioResource.update',
  'studioResource.manageAvailability',
  'studioResource.manageLifecycle',
  'event.read',
  'event.lookup',
  'event.create',
  'event.update',
  'event.manageAssignments',
  'event.manageLifecycle',
  'workSchedule.read',
  'workSchedule.create',
  'workSchedule.update',
  'workSchedule.manageLifecycle',
  'contractRegistry.read',
  'contractRegistry.lookup',
  'contractRegistry.create',
  'contractRegistry.update',
  'contractRegistry.manageOwner',
  'contractRegistry.manageFileReference',
  'contractRegistry.manageLifecycle',
  'contractObligation.read',
  'contractObligation.manageDraft',
  'contractObligation.deliver',
  'contractObligation.review',
  'contractObligation.manageLifecycle',
  'contractObligation.eventEvidenceLink.read',
  'contractObligation.eventEvidenceLink.link',
  'contractObligation.eventEvidenceLink.remove',
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
  'commissionRule.read',
  'commissionRule.lookup',
  'commissionRule.create',
  'commissionRule.update',
  'commissionRule.manageLifecycle',
  'commissionSettlement.read',
  'commissionSettlement.create',
  'commissionSettlement.update',
  'commissionSettlement.manageLifecycle',
  'revenueLedger.read',
  'revenueLedger.lookup',
  'revenueLedger.create',
  'revenueLedger.update',
  'revenueLedger.manageLifecycle',
  'revenueLedger.reconcile',
  'dashboardLite.read',
];

let userSeed = initialUserSeed;
let roleSeed = initialRoleSeed;
let assignmentSeed = initialAssignmentSeed;

const requiredAccountContextByRoleCode: Partial<Record<RoleTemplateCode, AccountContext>> = {
  OWNER_ADMIN: 'ADMIN_CONSOLE',
  ACCESS_ADMIN: 'ADMIN_CONSOLE',
  HR_OPERATIONS: 'ADMIN_CONSOLE',
  HR_TERMS_APPROVER: 'ADMIN_CONSOLE',
  PRODUCTION_OPS: 'ADMIN_CONSOLE',
  PLATFORM_CHANNEL_OPS: 'ADMIN_CONSOLE',
  CREATIVE_VISUAL_LEAD: 'ADMIN_CONSOLE',
  CONTENT_OPS: 'ADMIN_CONSOLE',
  TALENT_GROUP_MANAGER: 'MANAGER_CONSOLE',
  ORG_UNIT_MANAGER: 'MANAGER_CONSOLE',
  KPI_OPERATIONS: 'ADMIN_CONSOLE',
  COMMERCIAL_CONTRACT_OPS: 'ADMIN_CONSOLE',
  REVENUE_FINANCE_OPS: 'ADMIN_CONSOLE',
  REVENUE_APPROVER: 'ADMIN_CONSOLE',
  REVENUE_RECONCILER: 'ADMIN_CONSOLE',
  COMMISSION_OPS: 'ADMIN_CONSOLE',
  COMMISSION_APPROVER: 'ADMIN_CONSOLE',
  ATTENDANCE_OPS: 'ADMIN_CONSOLE',
  LEAVE_REVIEWER: 'ADMIN_CONSOLE',
  ATTENDANCE_APPROVER: 'ADMIN_CONSOLE',
  MONTHLY_CLOSE_OWNER: 'ADMIN_CONSOLE',
  PAYROLL_DRAFT_OPS: 'ADMIN_CONSOLE',
  PAYROLL_DRAFT_APPROVER: 'ADMIN_CONSOLE',
  VIEWER_AUDITOR: 'ADMIN_CONSOLE',
  STAFF_CONSOLE_USER: 'STAFF_CONSOLE',
};

const isAdminConsoleRoleCode = (code: string): boolean =>
  requiredAccountContextByRoleCode[code as RoleTemplateCode] === 'ADMIN_CONSOLE';

const initialUsers: UserRecord[] = [
  {
    id: 'user-admin',
    accountStatus: 'ACTIVE',
    actorKind: 'ADMIN',
    accountContexts: ['ADMIN_CONSOLE'],
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
    id: 'user-alice',
    accountStatus: 'ACTIVE',
    actorKind: 'STAFF',
    accountContexts: ['STAFF_CONSOLE'],
    authLinkage: { provider: 'auth0', subject: 'auth0|alice', status: 'LINKED' },
    contextAccess: { contexts: [{ context: 'ADMIN' }] },
    profile: { displayName: 'Alice User', email: 'alice@example.test', phone: null },
    preferences: { locale: 'vi', timezone: 'Asia/Saigon' },
    createdAt: now - 9_500,
    updatedAt: now - 9_250,
    activatedAt: now - 9_250,
    disabledAt: null,
    archivedAt: null,
  },
  {
    id: 'user-staff',
    accountStatus: 'PENDING',
    actorKind: 'STAFF',
    accountContexts: ['STAFF_CONSOLE'],
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
    accountContexts: [],
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

const createRoleTemplateRecord = ({
  code,
  name,
  category,
  recommendedAccountContext,
  permissions = [],
  status = 'REQUIRES_FUTURE_SCOPE',
}: {
  code: RoleTemplateCode;
  name: string;
  category: string;
  recommendedAccountContext: AccountContext;
  permissions?: string[];
  status?: RoleTemplateStatus;
}): RoleTemplateRecord => ({
  code,
  version: templateVersion,
  name,
  description: `${name} preset.`,
  category,
  permissions: permissionRecords(permissions),
  recommendedAccountContext,
  recommendedScopeGrants: {},
  scopePlan: [
    {
      module: name,
      scopes: ['target'],
      status,
      note: 'MSW target catalog fixture; runtime enforcement remains source-backed.',
    },
  ],
  warnings:
    permissions.length > 0
      ? []
      : ['No source permission keys exist for this target role yet in the MSW fixture.'],
  implementationNotes: ['Aligned with AUTH-4C target role catalog.'],
  status,
});

const roleTemplates: RoleTemplateRecord[] = [
  {
    code: 'OWNER_ADMIN',
    version: templateVersion,
    name: 'Owner Admin',
    description: 'Owner-controlled full administration preset.',
    category: 'ADMINISTRATION',
    permissions: permissionRecords(adminFullPermissionCodes),
    recommendedAccountContext: 'ADMIN_CONSOLE',
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
    permissions: permissionRecords([
      'orgUnit.read',
      'orgUnit.lookup',
      'orgUnit.create',
      'orgUnit.update',
      'orgUnit.manageHierarchy',
      'orgUnit.manageLifecycle',
      'employmentProfile.read',
      'employmentProfile.lookup',
      'employmentProfile.create',
      'employmentProfile.update',
      'employmentProfile.manageOrgAssignment',
      'employmentProfile.manageManagerAssignment',
      'employmentProfile.manageUserLinkage',
      'employmentProfile.manageLifecycle',
      'talent.read',
      'talent.lookup',
      'talent.create',
      'talent.update',
      'talent.manageManager',
      'talent.manageEmploymentLink',
      'talent.manageLifecycle',
      'talentGroup.read',
      'talentGroup.lookup',
      'talentGroup.create',
      'talentGroup.update',
      'talentGroup.manageLifecycle',
      'talentGroup.manageMembership',
      'studioResource.lookup',
      'user:view',
      'user:create',
      'user:provision_account',
      'user:auth_linkage:set',
      'user:password_setup:send',
      'workSchedule.read',
      'kpi.read',
      'kpi.readProgress',
    ]),
    recommendedAccountContext: 'ADMIN_CONSOLE',
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
    code: 'TALENT_GROUP_MANAGER',
    version: templateVersion,
    name: 'Talent Group Manager',
    description:
      'Conservative team operations preset for schedules, assignments, and KPI management.',
    category: 'MANAGEMENT',
    permissions: permissionRecords([
      'workSchedule.read',
      'event.read',
      'event.update',
      'event.manageAssignments',
      'event.manageLifecycle',
      'talent.read',
      'talentGroup.read',
      'talentKpi.read',
      'talentKpi.create',
      'talentKpi.update',
      'talentKpi.manageMetrics',
      'kpi.read',
      'kpi.readProgress',
      'kpi.enterActual',
      'kpi.correctActual',
    ]),
    recommendedAccountContext: 'MANAGER_CONSOLE',
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
    permissions: permissionRecords([
      'event.read',
      'event.create',
      'event.update',
      'event.manageAssignments',
      'event.manageLifecycle',
      'orgUnit.lookup',
      'employmentProfile.lookup',
      'talent.lookup',
      'talentGroup.lookup',
      'platformAccount.lookup',
      'studioResource.lookup',
      'event.lookup',
      'studioResource.read',
      'studioResource.create',
      'studioResource.update',
      'studioResource.manageAvailability',
      'studioResource.manageLifecycle',
      'workSchedule.read',
      'workSchedule.create',
      'workSchedule.update',
      'workSchedule.manageLifecycle',
      'platformAccount.read',
    ]),
    recommendedAccountContext: 'ADMIN_CONSOLE',
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
    code: 'REVENUE_FINANCE_OPS',
    version: templateVersion,
    name: 'Revenue Finance Ops',
    description:
      'Commercial finance preset for revenue, commission, settlement, contract, and dashboard workflows.',
    category: 'FINANCE',
    permissions: permissionRecords([
      'revenueLedger.read',
      'revenueLedger.lookup',
      'revenueLedger.create',
      'revenueLedger.update',
      'revenueLedger.manageLifecycle',
      'revenueLedger.reconcile',
      'commissionRule.read',
      'commissionRule.lookup',
      'commissionRule.create',
      'commissionRule.update',
      'commissionRule.manageLifecycle',
      'commissionSettlement.read',
      'commissionSettlement.create',
      'commissionSettlement.update',
      'commissionSettlement.manageLifecycle',
      'contractRegistry.read',
      'contractRegistry.lookup',
      'contractObligation.read',
      'contractObligation.eventEvidenceLink.read',
      'employmentProfile.lookup',
      'talent.lookup',
      'platformAccount.lookup',
      'event.lookup',
      'kpi.read',
      'kpi.readProgress',
      'dashboardLite.read',
    ]),
    recommendedAccountContext: 'ADMIN_CONSOLE',
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
    code: 'STAFF_CONSOLE_USER',
    version: templateVersion,
    name: 'Staff Console User',
    description: 'Read-only self-intended baseline for talent-facing staff access.',
    category: 'SELF_SERVICE',
    permissions: permissionRecords([
      'workSchedule.read',
      'event.read',
      'talentKpi.read',
      'kpi.readProgress',
      'employmentProfile.read',
      'talent.read',
    ]),
    recommendedAccountContext: 'STAFF_CONSOLE',
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
    permissions: permissionRecords([
      'orgUnit.read',
      'employmentProfile.read',
      'talent.read',
      'talentGroup.read',
      'platformAccount.read',
      'studioResource.read',
      'event.read',
      'workSchedule.read',
      'contractRegistry.read',
      'contractObligation.read',
      'contractObligation.eventEvidenceLink.read',
      'talentKpi.read',
      'kpi.read',
      'kpi.readProgress',
      'commissionRule.read',
      'commissionSettlement.read',
      'revenueLedger.read',
      'dashboardLite.read',
    ]),
    recommendedAccountContext: 'ADMIN_CONSOLE',
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
  createRoleTemplateRecord({
    code: 'ACCESS_ADMIN',
    name: 'Access Admin',
    category: 'ACCESS_GOVERNANCE',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
      'user:view',
      'user:create',
      'user:edit',
      'role:list',
      'role:view',
      'role:create',
      'role:update',
      'role:assign_to_user',
    ],
    status: 'READY',
  }),
  createRoleTemplateRecord({
    code: 'HR_TERMS_APPROVER',
    name: 'HR Terms Approver',
    category: 'PEOPLE_APPROVAL',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
      'employmentTerms.read',
      'employmentTerms.readSensitive',
      'employmentTerms.approve',
      'employmentTerms.audit',
    ],
  }),
  createRoleTemplateRecord({
    code: 'PLATFORM_CHANNEL_OPS',
    name: 'Platform Channel Ops',
    category: 'PLATFORM',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
      'platformAccount.read',
      'platformAccount.lookup',
      'platformAccount.create',
      'platformAccount.update',
      'platformAccount.manageOwnership',
      'platformAccount.manageLifecycle',
      'platformAccount.manageCapabilities',
    ],
  }),
  createRoleTemplateRecord({
    code: 'CREATIVE_VISUAL_LEAD',
    name: 'Creative Visual Lead',
    category: 'CREATIVE',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
      'event.read',
      'event.lookup',
      'studioResource.read',
      'studioResource.lookup',
      'workSchedule.read',
      'talent.read',
      'talentGroup.read',
    ],
  }),
  createRoleTemplateRecord({
    code: 'CONTENT_OPS',
    name: 'Content Ops',
    category: 'CONTENT',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
      'event.read',
      'event.lookup',
      'studioResource.read',
      'studioResource.lookup',
      'workSchedule.read',
      'platformAccount.read',
      'platformAccount.lookup',
    ],
  }),
  createRoleTemplateRecord({
    code: 'ORG_UNIT_MANAGER',
    name: 'Org Unit Manager',
    category: 'MANAGEMENT',
    recommendedAccountContext: 'MANAGER_CONSOLE',
    permissions: [
      'orgUnit.read',
      'employmentProfile.read',
      'talent.read',
      'workSchedule.read',
      'kpi.read',
      'kpi.readProgress',
    ],
  }),
  createRoleTemplateRecord({
    code: 'KPI_OPERATIONS',
    name: 'KPI Operations',
    category: 'KPI',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
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
    ],
    status: 'READY',
  }),
  createRoleTemplateRecord({
    code: 'COMMERCIAL_CONTRACT_OPS',
    name: 'Commercial Contract Ops',
    category: 'COMMERCIAL',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
      'contractRegistry.read',
      'contractRegistry.lookup',
      'contractRegistry.create',
      'contractRegistry.update',
      'contractObligation.read',
      'contractObligation.manageDraft',
      'contractObligation.deliver',
    ],
    status: 'READY',
  }),
  createRoleTemplateRecord({
    code: 'REVENUE_APPROVER',
    name: 'Revenue Approver',
    category: 'FINANCE_APPROVAL',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: ['revenueLedger.read', 'revenueLedger.lookup', 'revenueLedger.manageLifecycle'],
    status: 'READY',
  }),
  createRoleTemplateRecord({
    code: 'REVENUE_RECONCILER',
    name: 'Revenue Reconciler',
    category: 'FINANCE_RECONCILIATION',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
      'revenueLedger.read',
      'revenueLedger.lookup',
      'revenueLedger.reconcile',
      'dashboardLite.read',
    ],
    status: 'READY',
  }),
  createRoleTemplateRecord({
    code: 'COMMISSION_OPS',
    name: 'Commission Ops',
    category: 'COMMISSION',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: [
      'commissionRule.read',
      'commissionRule.lookup',
      'commissionRule.create',
      'commissionRule.update',
      'commissionSettlement.read',
      'commissionSettlement.create',
      'commissionSettlement.update',
    ],
    status: 'READY',
  }),
  createRoleTemplateRecord({
    code: 'COMMISSION_APPROVER',
    name: 'Commission Approver',
    category: 'COMMISSION_APPROVAL',
    recommendedAccountContext: 'ADMIN_CONSOLE',
    permissions: ['commissionSettlement.read', 'commissionSettlement.manageLifecycle'],
  }),
  createRoleTemplateRecord({
    code: 'ATTENDANCE_OPS',
    name: 'Attendance Ops',
    category: 'ATTENDANCE',
    recommendedAccountContext: 'ADMIN_CONSOLE',
  }),
  createRoleTemplateRecord({
    code: 'LEAVE_REVIEWER',
    name: 'Leave Reviewer',
    category: 'ATTENDANCE_REVIEW',
    recommendedAccountContext: 'ADMIN_CONSOLE',
  }),
  createRoleTemplateRecord({
    code: 'ATTENDANCE_APPROVER',
    name: 'Attendance Approver',
    category: 'ATTENDANCE_APPROVAL',
    recommendedAccountContext: 'ADMIN_CONSOLE',
  }),
  createRoleTemplateRecord({
    code: 'MONTHLY_CLOSE_OWNER',
    name: 'Monthly Close Owner',
    category: 'MONTHLY_CLOSE',
    recommendedAccountContext: 'ADMIN_CONSOLE',
  }),
  createRoleTemplateRecord({
    code: 'PAYROLL_DRAFT_OPS',
    name: 'Payroll Draft Ops',
    category: 'PAYROLL',
    recommendedAccountContext: 'ADMIN_CONSOLE',
  }),
  createRoleTemplateRecord({
    code: 'PAYROLL_DRAFT_APPROVER',
    name: 'Payroll Draft Approver',
    category: 'PAYROLL_APPROVAL',
    recommendedAccountContext: 'ADMIN_CONSOLE',
  }),
];

const roleBundles: RoleBundleRecord[] = [
  {
    code: 'OWNER_ADMIN_BUNDLE',
    name: 'Owner Admin',
    description: 'Owner-controlled full administration preset.',
    businessPurpose: 'Quản trị hệ thống và vận hành nhân sự.',
    status: 'ACTIVE',
    version: templateVersion,
    childRoles: ['OWNER_ADMIN'],
    recommendedAccountContext: 'ADMIN_CONSOLE',
    recommendedScopes: ['global'],
    sensitiveWarning: 'Contains global administrative capability groups.',
    sensitive: true,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
  },
  {
    code: 'TALENT_GROUP_MANAGER_BUNDLE',
    name: 'Talent Group Manager',
    description: 'Preset for talent group managers.',
    businessPurpose: 'Quản lý nhóm, lịch làm việc và KPI nhóm.',
    status: 'ACTIVE',
    version: templateVersion,
    childRoles: ['TALENT_GROUP_MANAGER'],
    recommendedAccountContext: 'MANAGER_CONSOLE',
    recommendedScopes: ['managedTalentGroup'],
    sensitiveWarning: null,
    sensitive: false,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
  },
  {
    code: 'STAFF_CONSOLE_BUNDLE',
    name: 'Staff Console',
    description: 'Preset for staff self-service.',
    businessPurpose: 'Nhân viên xem dữ liệu cá nhân và KPI cá nhân.',
    status: 'ACTIVE',
    version: templateVersion,
    childRoles: ['STAFF_CONSOLE_USER'],
    recommendedAccountContext: 'STAFF_CONSOLE',
    recommendedScopes: ['self'],
    sensitiveWarning: null,
    sensitive: false,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
  },
  {
    code: 'ACCESS_ADMIN_BUNDLE',
    name: 'Access Admin',
    description: 'User and role governance preset.',
    businessPurpose: 'Access governance operations.',
    status: 'ACTIVE',
    version: templateVersion,
    childRoles: ['ACCESS_ADMIN'],
    recommendedAccountContext: 'ADMIN_CONSOLE',
    recommendedScopes: ['global'],
    sensitiveWarning: 'Contains access governance capability groups.',
    sensitive: true,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
  },
  {
    code: 'FINANCE_STAFF_BUNDLE',
    name: 'Finance Staff',
    description: 'Revenue and commission operations preset.',
    businessPurpose: 'Finance operations.',
    status: 'ACTIVE',
    version: templateVersion,
    childRoles: ['REVENUE_FINANCE_OPS', 'COMMISSION_OPS'],
    recommendedAccountContext: 'ADMIN_CONSOLE',
    recommendedScopes: ['financeGlobal', 'financePeriod'],
    sensitiveWarning: 'Contains finance operations capability groups.',
    sensitive: true,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
  },
  {
    code: 'AUDITOR_BUNDLE',
    name: 'Auditor',
    description: 'Read-only operational audit preset.',
    businessPurpose: 'Read-only audit.',
    status: 'ACTIVE',
    version: templateVersion,
    childRoles: ['VIEWER_AUDITOR'],
    recommendedAccountContext: 'ADMIN_CONSOLE',
    recommendedScopes: ['global'],
    sensitiveWarning: null,
    sensitive: false,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
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
    templateCode: 'OWNER_ADMIN',
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
  permissions: adminFullPermissionCodes,
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
  accountContexts: ['ADMIN_CONSOLE'],
  workspaceAvailability: buildWorkspaceAvailability(['ADMIN_CONSOLE']),
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
  ...(record.accountContexts ? { accountContexts: [...record.accountContexts] } : {}),
  ...(record.workspaceAvailability
    ? { workspaceAvailability: cloneWorkspaceAvailability(record.workspaceAvailability) }
    : {}),
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
    ...(record.accountContexts ? { accountContexts: [...record.accountContexts] } : {}),
    ...(record.workspaceAvailability
      ? { workspaceAvailability: cloneWorkspaceAvailability(record.workspaceAvailability) }
      : {}),
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
  const {
    accountContexts: sourceAccountContexts,
    workspaceAvailability: sourceWorkspaceAvailability,
    ...rest
  } = record;
  const accountContexts = sourceAccountContexts ? [...sourceAccountContexts] : undefined;
  const workspaceAvailability = sourceWorkspaceAvailability
    ? cloneWorkspaceAvailability(sourceWorkspaceAvailability)
    : accountContexts
      ? buildWorkspaceAvailability(accountContexts)
      : undefined;

  return {
    ...rest,
    roles: [...record.roles],
    permissions: [...record.permissions],
    ...(accountContexts ? { accountContexts } : {}),
    ...(workspaceAvailability ? { workspaceAvailability } : {}),
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

function buildWorkspaceAvailability(
  accountContexts: AccountContext[],
): WorkspaceAvailabilityRecord {
  const uniqueContexts = Array.from(new Set(accountContexts));
  const primaryWorkspace =
    (['ADMIN_CONSOLE', 'MANAGER_CONSOLE', 'STAFF_CONSOLE'] as const).find((context) =>
      uniqueContexts.includes(context),
    ) ?? null;

  return {
    primaryWorkspace,
    availableWorkspaces: (['STAFF_CONSOLE', 'MANAGER_CONSOLE', 'ADMIN_CONSOLE'] as const).map(
      (context) => {
        const available = uniqueContexts.includes(context);
        return {
          context,
          available,
          source: 'ACCOUNT_CONTEXT',
          reasonCodes: available ? ['ACCOUNT_CONTEXT_ACTIVE'] : ['ACCOUNT_CONTEXT_MISSING'],
          trace: [{ source: 'ACCOUNT_CONTEXT', context, matched: available }],
        };
      },
    ),
    ownDataAvailable: uniqueContexts.includes('STAFF_CONSOLE'),
    managerResponsibilitiesAvailable: uniqueContexts.includes('MANAGER_CONSOLE'),
    effectiveAccessTraceAvailable: true,
    sourceTrace: [
      {
        source: 'ACCOUNT_CONTEXT',
        accountContexts: uniqueContexts,
        primaryWorkspace,
      },
    ],
  };
}

function cloneWorkspaceAvailability(
  record: WorkspaceAvailabilityRecord,
): WorkspaceAvailabilityRecord {
  return {
    primaryWorkspace: record.primaryWorkspace,
    availableWorkspaces: record.availableWorkspaces.map((entry) => ({
      ...entry,
      reasonCodes: [...entry.reasonCodes],
      trace: entry.trace.map((trace) => ({ ...trace })),
    })),
    ownDataAvailable: record.ownDataAvailable,
    managerResponsibilitiesAvailable: record.managerResponsibilitiesAvailable,
    effectiveAccessTraceAvailable: record.effectiveAccessTraceAvailable,
    sourceTrace: record.sourceTrace.map((trace) => ({ ...trace })),
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
  recommendedAccountContext: template.recommendedAccountContext,
  recommendedScopeGrants: template.recommendedScopeGrants,
  scopePlan: template.scopePlan,
  warnings: template.warnings,
  implementationNotes: template.implementationNotes,
  status: template.status,
});

const readRoleTemplate = (templateCode: string): RoleTemplateRecord | undefined =>
  roleTemplates.find((template) => template.code === templateCode.trim().toUpperCase());

const readAssignedAccountContexts = (user: UserRecord): AccountContext[] => {
  return user.accountContexts ? [...user.accountContexts] : [];
};

const toEffectiveAccessRecord = (user: UserRecord) => {
  const activeAssignments = assignments.filter(
    (assignment) => assignment.userId === user.id && assignment.state === 'ACTIVE',
  );
  const assignedRoles = activeAssignments
    .map((assignment) => readRole(assignment.roleId))
    .filter((role): role is RoleRecord => Boolean(role));
  const accountContexts = readAssignedAccountContexts(user);
  const permissions = Array.from(
    new Set(assignedRoles.flatMap((role) => role.permissions.map((permission) => permission.code))),
  );

  return {
    readOnly: true,
    sourceTruth: true,
    user: {
      id: user.id,
      displayName: user.profile.displayName,
      email: user.profile.email,
      accountStatus: user.accountStatus,
    },
    accountContextSignals: {
      canonicalAccountContextImplemented: true,
      canonicalSource: 'ACCOUNT_CONTEXT',
      accountContexts,
      legacyActorKind: user.actorKind,
      compatibilityContexts: [],
      grantsAuthorityByItself: false,
    },
    workspaceAvailability: user.workspaceAvailability
      ? cloneWorkspaceAvailability(user.workspaceAvailability)
      : buildWorkspaceAvailability(accountContexts),
    activeRoleAssignments: activeAssignments.map((assignment) => {
      const role = readRole(assignment.roleId);
      const scopeModules = assignment.scopeGrants ? Object.keys(assignment.scopeGrants) : [];

      return {
        assignmentId: assignment.assignmentId,
        roleId: assignment.roleId,
        roleCode: role?.code ?? null,
        roleName: role?.name ?? null,
        permissions: role ? role.permissions.map((permission) => permission.code) : [],
        legacyScopeGrants: assignment.scopeGrants ?? null,
        structuredScopeGrants: scopeModules.map((module) => ({ module })),
        scopeFingerprint: scopeModules.length > 0 ? scopeModules.join('|') : 'none',
        reason: assignment.reason,
        assignedBy: 'mock-admin',
        assignedAt: assignment.effectiveAt,
        effectiveAt: assignment.effectiveAt,
        expiresAt: null,
        reviewAt: null,
        origin: 'DIRECT',
        bundleOrigin: null,
        sensitiveOrGlobal: Boolean(
          assignment.scopeGrants &&
          Object.values(assignment.scopeGrants).some((scopes) => scopes?.includes('global')),
        ),
      };
    }),
    roles: assignedRoles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
    })),
    permissions,
    permissionSourceTrace: [],
    businessResponsibilitySupport: {
      status: 'NOT_IMPLEMENTED',
      claims: [],
      note: 'MSW read model for frontend effective-access display.',
    },
    generatedAt: '2026-05-20T00:00:00.000Z',
  };
};

const accessAssignmentTargets = (): AccessAssignmentTargetFixture[] => [
  ...roleTemplates.map<AccessAssignmentTargetFixture>((template) => ({
    assignmentKind: 'ROLE_TEMPLATE',
    code: template.code,
    name: template.name,
    recommendedAccountContext: template.recommendedAccountContext,
    requiredScopeTypes: Object.values(template.recommendedScopeGrants).flatMap((scopes) =>
      scopes.map((scope) =>
        scope === 'managedGroup' || scope === 'team'
          ? 'managedTalentGroup'
          : scope === 'department'
            ? 'managedOrgUnit'
            : scope,
      ),
    ),
    requiresResponsibility:
      template.code === 'TALENT_GROUP_MANAGER' || template.code === 'ORG_UNIT_MANAGER',
    requiredResponsibilityType:
      template.code === 'TALENT_GROUP_MANAGER'
        ? 'TALENT_GROUP_MANAGER'
        : template.code === 'ORG_UNIT_MANAGER'
          ? 'ORG_UNIT_MANAGER'
          : null,
    sensitiveLevel: template.code === 'OWNER_ADMIN' ? 'HIGH_RISK' : 'STANDARD',
    legacyAssignable: !['PRODUCTION_OPS', 'VIEWER_AUDITOR', 'HR_OPERATIONS'].includes(
      template.code,
    ),
    recommendedPickerMode:
      template.code === 'TALENT_GROUP_MANAGER' || template.code === 'ORG_UNIT_MANAGER'
        ? 'RESPONSIBILITY_SCOPE_FIRST'
        : 'SEARCH_FIRST',
  })),
  ...roleBundles.map<AccessAssignmentTargetFixture>((bundle) => ({
    assignmentKind: 'BUNDLE',
    code: bundle.code,
    version: bundle.version,
    name: bundle.name,
    childRoles: bundle.childRoles,
    recommendedAccountContext: bundle.recommendedAccountContext,
    requiredScopeTypes: bundle.recommendedScopes,
    requiresResponsibility: bundle.childRoles.some((roleCode) =>
      ['TALENT_GROUP_MANAGER', 'ORG_UNIT_MANAGER'].includes(roleCode),
    ),
    requiredResponsibilityType: bundle.childRoles
      .map((roleCode) =>
        roleCode === 'TALENT_GROUP_MANAGER'
          ? 'TALENT_GROUP_MANAGER'
          : roleCode === 'ORG_UNIT_MANAGER'
            ? 'ORG_UNIT_MANAGER'
            : null,
      )
      .filter(
        (value): value is 'TALENT_GROUP_MANAGER' | 'ORG_UNIT_MANAGER' => value !== null,
      ),
    sensitiveLevel: bundle.sensitive ? 'HIGH_RISK' : 'STANDARD',
    legacyAssignable: bundle.code !== 'AUDITOR_BUNDLE',
    recommendedPickerMode: bundle.childRoles.some((roleCode) =>
      ['TALENT_GROUP_MANAGER', 'ORG_UNIT_MANAGER'].includes(roleCode),
    )
      ? 'RESPONSIBILITY_SCOPE_FIRST'
      : 'SEARCH_FIRST',
  })),
];

const buildAccessAssignmentPreview = (body: Record<string, unknown>) => {
  const targetUserId = String(body.targetUserId ?? '');
  const targetUser = users.find((user) => user.id === targetUserId);
  const targetCode = String(body.assignmentTargetCode ?? '');
  const target = accessAssignmentTargets().find((item) => item.code === targetCode);
  const scopeGrants = Array.isArray(body.structuredScopeGrants)
    ? (body.structuredScopeGrants as Array<Record<string, unknown>>)
    : [];
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const blockers: Array<{ severity: 'BLOCKER'; code: string; summary: string }> = [];
  const warnings: Array<{ severity: 'WARNING'; code: string; summary: string }> = [];

  if (!targetUser || targetUser.accountStatus !== 'ACTIVE') {
    blockers.push({
      severity: 'BLOCKER',
      code: 'TARGET_USER_NOT_ASSIGNABLE',
      summary: 'Target user is not active or assignable.',
    });
  }
  if (!reason) {
    blockers.push({
      severity: 'BLOCKER',
      code: 'REASON_REQUIRED',
      summary: 'Reason is required.',
    });
  }
  if (target?.legacyAssignable === false) {
    blockers.push({
      severity: 'BLOCKER',
      code: 'LEGACY_ROLE_BLOCKED',
      summary: 'Legacy role target is blocked.',
    });
  }
  const requiredContext = target?.recommendedAccountContext;
  if (
    requiredContext &&
    targetUser &&
    !readAssignedAccountContexts(targetUser).includes(requiredContext)
  ) {
    blockers.push({
      severity: 'BLOCKER',
      code: 'REQUIRED_ACCOUNT_CONTEXT_MISSING',
      summary: 'Target user is missing required AccountContext.',
    });
  }
  if (
    target?.requiresResponsibility &&
    !scopeGrants.some((scope) => typeof scope.targetId === 'string' && scope.targetId === 'group-a')
  ) {
    blockers.push({
      severity: 'BLOCKER',
      code: 'RESPONSIBILITY_REQUIRED',
      summary: 'Matching active management responsibility is required.',
    });
  }
  if (target?.sensitiveLevel === 'HIGH_RISK') {
    warnings.push({
      severity: 'WARNING',
      code: 'ADDITIONAL_REVIEW_REQUIRED',
      summary: 'Additional review is required.',
    });
  }

  const canApply = blockers.length === 0;
  const proposedAssignments = canApply
    ? [
        {
          assignmentId: 'preview:assignment-1',
          roleId: `role-${targetCode.toLowerCase()}`,
          roleCode:
            target?.assignmentKind === 'BUNDLE'
              ? ((target.childRoles?.[0] as string | undefined) ?? targetCode)
              : targetCode,
          roleName: target?.name ?? targetCode,
          permissions: ['workSchedule.read'],
          structuredScopeGrants: scopeGrants,
          scopeFingerprint: scopeGrants.length > 0 ? 'scope:v1:test' : 'scope:v1:legacy',
          effectiveAt: Date.now(),
          expiresAt: null,
          reviewAt: null,
          origin: target?.assignmentKind === 'BUNDLE' ? 'BUNDLE' : 'DIRECT',
          bundleOrigin:
            target?.assignmentKind === 'BUNDLE'
              ? {
                  bundleAssignmentId: 'preview:bundle-1',
                  bundleCode: target.code,
                  bundleVersion: target.version,
                }
              : null,
          reason,
        },
      ]
    : [];

  return {
    previewOnly: true,
    canApply,
    blockers,
    warnings,
    targetUser: targetUser
      ? {
          id: targetUser.id,
          displayName: targetUser.profile.displayName,
          email: targetUser.profile.email,
          accountStatus: targetUser.accountStatus,
          activeEmploymentProfile: {
            id: 'ep-001',
            employeeCode: 'EP-000001',
            displayName: 'Alice',
            employmentStatus: 'ACTIVE',
          },
        }
      : { id: targetUserId, missing: true },
    assignmentTarget: target ?? { code: targetCode },
    requestedScope: scopeGrants,
    normalizedScope: scopeGrants,
    scopeFingerprint: scopeGrants.length > 0 ? 'scope:v1:test' : 'scope:v1:legacy',
    effectiveAccessDelta: {
      addedPermissions: canApply ? ['workSchedule.read'] : [],
      removedPermissions: [],
      unchangedPermissions: [],
    },
    proposedAssignments,
    bundleExpansion:
      target?.assignmentKind === 'BUNDLE'
        ? {
            bundleAssignmentId: 'preview:bundle-1',
            childRoleCodes: target.childRoles,
            proposedChildCount: proposedAssignments.length,
            persistedParentBundleAssignment: false,
          }
        : null,
    accountContextRequirement: {
      status: blockers.some((blocker) => blocker.code === 'REQUIRED_ACCOUNT_CONTEXT_MISSING')
        ? 'MISSING_REQUIRED_CONTEXT'
        : 'SATISFIED',
      requiredAccountContexts: requiredContext ? [requiredContext] : [],
      currentAccountContexts: targetUser ? readAssignedAccountContexts(targetUser) : [],
      materializationInScope: false,
    },
    consoleEntitlementPreview: {
      previewOnly: true,
      accountContextMutated: false,
      grantsAuthorityByItself: false,
    },
    responsibilityRequirements: target?.requiresResponsibility
      ? [
          {
            roleCode: targetCode,
            requiredScopeType: 'managedTalentGroup',
            requiredResponsibilityType: 'TALENT_GROUP_MANAGER',
            status: blockers.some((blocker) => blocker.code === 'RESPONSIBILITY_REQUIRED')
              ? 'MISSING_RESPONSIBILITY'
              : 'SATISFIED',
          },
        ]
      : [],
    sensitiveAccess: {
      sensitiveOrGlobal: target?.sensitiveLevel === 'HIGH_RISK',
      reasonRequired: target?.sensitiveLevel === 'HIGH_RISK',
    },
    duplicateConflicts: [],
    previewCompleteness: { status: 'COMPLETE', gaps: [] },
    sourceTrace: {
      roleSource: 'roles',
      assignmentSource: 'role_assignments',
      mutatesSource: false,
    },
  };
};

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

  http.get('*/admin/role-bundles', () => {
    return HttpResponse.json({ data: roleBundles });
  }),

  http.get('*/admin/access-assignments/targets', () => {
    return HttpResponse.json({
      data: {
        readOnly: true,
        unrestrictedUserListReturned: false,
        searchFirstUserPickerRequired: true,
        eligibleUsersReturned: false,
        userListReturned: false,
        frontendSettableFields: [
          'targetUserId',
          'assignmentTargetType',
          'assignmentTargetId',
          'assignmentTargetCode',
          'bundleVersion',
          'structuredScopeGrants',
          'reason',
          'sourceContext',
        ],
        frontendSettableAuthorityFields: [],
        backendOwnedAuthorityFields: [
          'accountContext',
          'accountContexts',
          'console',
          'workspaceAvailability',
          'primaryWorkspace',
          'actorKind',
        ],
        assignmentTargets: accessAssignmentTargets(),
        previewRemainsAuthoritative: true,
      },
    });
  }),

  http.post('*/admin/access-assignments/preview', async ({ request }) => {
    const body = await parseJsonBody(request);
    return HttpResponse.json({ data: buildAccessAssignmentPreview(body) });
  }),

  http.post('*/admin/access-assignments/apply', async ({ request }) => {
    const body = await parseJsonBody(request);
    const preview = buildAccessAssignmentPreview(body);
    if (!preview.canApply) {
      return HttpResponse.json({
        data: {
          applied: false,
          canApply: false,
          applyStatus: 'BLOCKED',
          blockers: preview.blockers,
          warnings: preview.warnings,
          targetUser: preview.targetUser,
          assignmentTarget: preview.assignmentTarget,
          normalizedScope: preview.normalizedScope,
          scopeFingerprint: preview.scopeFingerprint,
          proposedAssignments: preview.proposedAssignments,
          bundleExpansion: preview.bundleExpansion,
          accountContextResult: {
            materialized: false,
            materializationPolicy: 'DEFERRED_FAIL_CLOSED',
            requirement: preview.accountContextRequirement,
            grantsAuthorityByItself: false,
          },
          consoleEntitlementResult: preview.consoleEntitlementPreview,
          responsibilityRequirements: preview.responsibilityRequirements,
          sensitiveAccess: preview.sensitiveAccess,
          duplicateConflicts: preview.duplicateConflicts,
          auditTrace: { written: false, reason: 'APPLY_BLOCKED_BEFORE_MUTATION' },
          sourceTrace: { ...preview.sourceTrace, mutatesSource: false },
        },
      });
    }

    assignmentSeed += 1;
    const appliedAssignments = preview.proposedAssignments.map((assignment, index) => ({
      ...assignment,
      assignmentId: `assignment-${assignmentSeed + index}`,
      userId: String(body.targetUserId),
      assignedBy: 'user-admin',
      assignedAt: Date.now(),
    }));
    return HttpResponse.json({
      data: {
        applied: true,
        canApply: true,
        applyStatus: 'APPLIED',
        blockers: [],
        warnings: preview.warnings,
        targetUser: preview.targetUser,
        assignmentTarget: preview.assignmentTarget,
        normalizedScope: preview.normalizedScope,
        scopeFingerprint: preview.scopeFingerprint,
        appliedAssignments,
        bundleExpansion:
          preview.bundleExpansion && typeof preview.bundleExpansion === 'object'
            ? {
                ...preview.bundleExpansion,
                appliedChildCount: appliedAssignments.length,
                childAssignmentIds: appliedAssignments.map((assignment) =>
                  String(assignment.assignmentId),
                ),
              }
            : null,
        accountContextResult: {
          materialized: false,
          materializationPolicy: 'DEFERRED_FAIL_CLOSED',
          requirement: preview.accountContextRequirement,
          grantsAuthorityByItself: false,
        },
        consoleEntitlementResult: preview.consoleEntitlementPreview,
        responsibilityRequirements: preview.responsibilityRequirements,
        sensitiveAccess: preview.sensitiveAccess,
        duplicateConflicts: [],
        auditTrace: {
          written: true,
          mutationType: 'role.assign-to-user',
          assignmentIds: appliedAssignments.map((assignment) => String(assignment.assignmentId)),
          targetUserId: String(body.targetUserId),
        },
        sourceTrace: { ...preview.sourceTrace, mutatesSource: true, auditSource: 'audit_log' },
        effectiveAccessAfterApply: toEffectiveAccessRecord(users[0]),
      },
    });
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

  http.get('*/admin/effective-access/users/:userId', ({ params }) => {
    const record = readUser(String(params.userId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({ data: toEffectiveAccessRecord(record) });
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
        .filter((code) => isAdminConsoleRoleCode(code));
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
    const requiredAccountContext =
      requiredAccountContextByRoleCode[governingRoleCode as RoleTemplateCode];
    if (
      requiredAccountContext &&
      !readAssignedAccountContexts(targetUser).includes(requiredAccountContext)
    ) {
      return HttpResponse.json(
        { message: `${governingRoleCode} requires ${requiredAccountContext} account context.` },
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
