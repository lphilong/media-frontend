import {
  hasAllPermissions,
  hasAnyPermission,
  hasAnyScopeGrant,
  hasPermission,
  hasScopeGrant,
  hasWorkspace,
  PERMISSIONS,
  type ActorScopeGrantModule,
  type ActorScopeGrantValue,
  type CurrentActorCapabilities,
  type PermissionCode,
} from '@shared/auth/current-actor-capabilities';

export type ModuleAccessModuleId =
  | 'dashboard'
  | 'people-readiness'
  | 'employment-terms'
  | 'user'
  | 'role'
  | 'org-unit'
  | 'employment-profile'
  | 'talent'
  | 'talent-group'
  | 'responsibility'
  | 'platform-account'
  | 'studio-resource'
  | 'work-schedule'
  | 'event-assignment'
  | 'contract-registry'
  | 'kpi'
  | 'revenue-ledger'
  | 'commission-rules'
  | 'commission-settlements';

export type ModuleAccessReason =
  | 'missing-capabilities'
  | 'missing-permission'
  | 'missing-scope'
  | 'missing-account-context';

type ScopeRequirement = {
  module: ActorScopeGrantModule;
  anyOf: readonly ActorScopeGrantValue[];
};

type AccessRequirement = {
  allPermissions?: readonly PermissionCode[];
  anyPermission?: readonly PermissionCode[];
  anyScope?: ScopeRequirement;
  anyOf?: readonly AccessRequirement[];
  excludeSelfServiceOnly?: boolean;
};

export type ModuleAccessDefinition = {
  id: ModuleAccessModuleId;
  routePaths: readonly string[];
  access: AccessRequirement;
  noAccessReason?: ModuleAccessReason;
};

export const moduleAccessDefinitions: Readonly<
  Record<ModuleAccessModuleId, ModuleAccessDefinition>
> = {
  dashboard: {
    id: 'dashboard',
    routePaths: ['/dashboard'],
    access: {
      allPermissions: [PERMISSIONS.DASHBOARD_LITE_READ],
      anyScope: {
        module: 'dashboardLite',
        anyOf: ['global'],
      },
    },
  },
  'people-readiness': {
    id: 'people-readiness',
    routePaths: ['/people-readiness'],
    access: {
      allPermissions: [PERMISSIONS.EMPLOYMENT_PROFILE_READ],
      excludeSelfServiceOnly: true,
    },
  },
  'employment-terms': {
    id: 'employment-terms',
    routePaths: ['/employment-terms'],
    access: {
      allPermissions: [PERMISSIONS.EMPLOYMENT_TERMS_READ],
      excludeSelfServiceOnly: true,
    },
  },
  user: {
    id: 'user',
    routePaths: ['/users'],
    access: { allPermissions: [PERMISSIONS.USER_VIEW], excludeSelfServiceOnly: true },
  },
  role: {
    id: 'role',
    routePaths: ['/roles'],
    access: {
      anyPermission: [PERMISSIONS.ROLE_LIST, PERMISSIONS.ROLE_VIEW],
      excludeSelfServiceOnly: true,
    },
  },
  'org-unit': {
    id: 'org-unit',
    routePaths: ['/org-units'],
    access: { allPermissions: [PERMISSIONS.ORG_UNIT_READ], excludeSelfServiceOnly: true },
  },
  'employment-profile': {
    id: 'employment-profile',
    routePaths: ['/employment-profiles'],
    access: {
      allPermissions: [PERMISSIONS.EMPLOYMENT_PROFILE_READ],
      excludeSelfServiceOnly: true,
    },
  },
  talent: {
    id: 'talent',
    routePaths: ['/talents'],
    access: { allPermissions: [PERMISSIONS.TALENT_READ], excludeSelfServiceOnly: true },
  },
  'talent-group': {
    id: 'talent-group',
    routePaths: ['/talent-groups'],
    access: { allPermissions: [PERMISSIONS.TALENT_GROUP_READ], excludeSelfServiceOnly: true },
  },
  responsibility: {
    id: 'responsibility',
    routePaths: ['/responsibilities'],
    access: {
      anyPermission: [
        PERMISSIONS.TALENT_GROUP_READ,
        PERMISSIONS.ORG_UNIT_READ,
        PERMISSIONS.TALENT_READ,
        PERMISSIONS.EMPLOYMENT_PROFILE_READ,
      ],
      excludeSelfServiceOnly: true,
    },
  },
  'platform-account': {
    id: 'platform-account',
    routePaths: ['/platform-accounts'],
    access: {
      allPermissions: [PERMISSIONS.PLATFORM_ACCOUNT_READ],
      excludeSelfServiceOnly: true,
    },
  },
  'studio-resource': {
    id: 'studio-resource',
    routePaths: ['/studio-resources'],
    access: {
      allPermissions: [PERMISSIONS.STUDIO_RESOURCE_READ],
      excludeSelfServiceOnly: true,
    },
  },
  'work-schedule': {
    id: 'work-schedule',
    routePaths: [
      '/work-shifts',
      '/work-schedule/my-shifts',
      '/work-schedule/team-shifts',
      '/work-schedule/department-shifts',
      '/work-schedule/global-ops',
      '/work-schedule/patterns',
      '/work-schedule/holiday-calendars',
      '/work-schedule/rosters',
    ],
    access: {
      allPermissions: [PERMISSIONS.WORK_SCHEDULE_READ],
      anyScope: {
        module: 'workSchedule',
        anyOf: ['global'],
      },
    },
  },
  'event-assignment': {
    id: 'event-assignment',
    routePaths: ['/events'],
    access: {
      allPermissions: [PERMISSIONS.EVENT_READ],
      anyScope: {
        module: 'eventAssignment',
        anyOf: ['global'],
      },
    },
  },
  'contract-registry': {
    id: 'contract-registry',
    routePaths: ['/contract-records'],
    access: {
      allPermissions: [PERMISSIONS.CONTRACT_REGISTRY_READ],
      anyScope: {
        module: 'contractRegistry',
        anyOf: ['global'],
      },
    },
  },
  kpi: {
    id: 'kpi',
    routePaths: ['/kpi', '/kpi/plans'],
    access: {
      anyOf: [
        {
          allPermissions: [PERMISSIONS.KPI_READ],
          anyScope: {
            module: 'kpi',
            anyOf: ['global'],
          },
        },
      ],
    },
  },
  'revenue-ledger': {
    id: 'revenue-ledger',
    routePaths: ['/revenue-entries'],
    access: {
      allPermissions: [PERMISSIONS.REVENUE_LEDGER_READ],
      anyScope: {
        module: 'revenueLedger',
        anyOf: ['global'],
      },
    },
  },
  'commission-rules': {
    id: 'commission-rules',
    routePaths: ['/commission/rules'],
    access: {
      allPermissions: [PERMISSIONS.COMMISSION_RULE_READ],
      anyScope: {
        module: 'commission',
        anyOf: ['global'],
      },
    },
  },
  'commission-settlements': {
    id: 'commission-settlements',
    routePaths: ['/commission/settlements'],
    access: {
      allPermissions: [PERMISSIONS.COMMISSION_SETTLEMENT_READ],
      anyScope: {
        module: 'commission',
        anyOf: ['global'],
      },
    },
  },
};

export const isModuleAccessModuleId = (moduleId: string): moduleId is ModuleAccessModuleId =>
  moduleId in moduleAccessDefinitions;

export const canAccessModule = (
  capabilities: CurrentActorCapabilities | undefined,
  moduleId: ModuleAccessModuleId,
): boolean => evaluateRequirement(capabilities, moduleAccessDefinitions[moduleId].access);

export const getModuleAccessReason = (
  capabilities: CurrentActorCapabilities | undefined,
  moduleId: ModuleAccessModuleId,
): ModuleAccessReason | undefined => {
  if (canAccessModule(capabilities, moduleId)) {
    return undefined;
  }

  if (!capabilities) {
    return 'missing-capabilities';
  }

  if (!hasWorkspace(capabilities, 'ADMIN_CONSOLE')) {
    return 'missing-account-context';
  }

  const access = moduleAccessDefinitions[moduleId].access;
  if (requirementHasMissingPermission(capabilities, access)) {
    return 'missing-permission';
  }

  return 'missing-scope';
};

export const getAccessibleModuleIds = (
  capabilities: CurrentActorCapabilities | undefined,
): ModuleAccessModuleId[] =>
  (Object.keys(moduleAccessDefinitions) as ModuleAccessModuleId[]).filter((moduleId) =>
    canAccessModule(capabilities, moduleId),
  );

const evaluateRequirement = (
  capabilities: CurrentActorCapabilities | undefined,
  requirement: AccessRequirement,
): boolean => {
  if (!capabilities) {
    return false;
  }

  if (!hasWorkspace(capabilities, 'ADMIN_CONSOLE')) {
    return false;
  }

  if (requirement.excludeSelfServiceOnly === true && isSelfServiceOnlyAdminActor(capabilities)) {
    return false;
  }

  if (requirement.anyOf) {
    return requirement.anyOf.some((candidate) => evaluateRequirement(capabilities, candidate));
  }

  if (requirement.allPermissions && !hasAllPermissions(capabilities, requirement.allPermissions)) {
    return false;
  }

  if (requirement.anyPermission && !hasAnyPermission(capabilities, requirement.anyPermission)) {
    return false;
  }

  if (
    requirement.anyScope &&
    !hasAnyScopeGrant(capabilities, requirement.anyScope.module, requirement.anyScope.anyOf)
  ) {
    return false;
  }

  return true;
};

const requirementHasMissingPermission = (
  capabilities: CurrentActorCapabilities,
  requirement: AccessRequirement,
): boolean => {
  if (requirement.anyOf) {
    return requirement.anyOf.every((candidate) =>
      requirementHasMissingPermission(capabilities, candidate),
    );
  }

  if (requirement.allPermissions?.some((permission) => !hasPermission(capabilities, permission))) {
    return true;
  }

  if (requirement.anyPermission && !hasAnyPermission(capabilities, requirement.anyPermission)) {
    return true;
  }

  return false;
};

const isSelfServiceOnlyAdminActor = (capabilities: CurrentActorCapabilities): boolean => {
  const workScheduleScopes = capabilities.scopeGrants.workSchedule ?? [];
  const kpiScopes = capabilities.scopeGrants.kpi ?? [];

  const hasSelfScope = workScheduleScopes.includes('self') || kpiScopes.includes('self');
  const hasNonSelfScope =
    workScheduleScopes.some((scope) => scope !== 'self') ||
    kpiScopes.some((scope) => scope !== 'self') ||
    hasScopeGrant(capabilities, 'eventAssignment', 'global') ||
    hasScopeGrant(capabilities, 'eventAssignment', 'managedGroup') ||
    hasScopeGrant(capabilities, 'contractRegistry', 'global') ||
    hasScopeGrant(capabilities, 'revenueLedger', 'global') ||
    hasScopeGrant(capabilities, 'commission', 'global') ||
    hasScopeGrant(capabilities, 'dashboardLite', 'global');

  return hasSelfScope && !hasNonSelfScope;
};
