import { http, HttpResponse } from 'msw';

import type {
  ManagerWorkspaceContext,
  ManagerWorkShiftList,
} from '@modules/manager-workspace/api/manager-workspace.api';

const kpiCapabilities = {
  read: true,
  manageAllocation: false,
  enterActual: false,
  correctActual: false,
  finalize: false,
} as const;

const baseContext = (): ManagerWorkspaceContext => ({
  actor: {
    id: 'user-manager',
    displayName: 'Mina Manager',
  },
  employmentProfile: {
    id: 'ep-manager',
    displayName: 'Mina Manager',
    employeeCode: 'EP-MGR-001',
    employmentStatus: 'ACTIVE',
    orgUnitId: 'ou-home',
  },
  readiness: {
    canUseManagerWorkspace: true,
    reasons: [],
  },
  scopes: {
    orgUnits: [],
    talentGroups: [],
  },
  modules: {
    kpi: {
      visible: false,
      unitKpiVisible: false,
      talentGroupKpiVisible: false,
    },
    workShifts: {
      visible: false,
      reason: 'NO_MANAGED_SCOPE_ASSIGNED',
    },
    events: {
      visible: false,
      reason: 'NOT_ENABLED_IN_MANAGER_WORKSPACE_YET',
    },
    members: {
      visible: false,
      reason: 'NOT_ENABLED_IN_MANAGER_WORKSPACE_YET',
    },
  },
});

export const managerWorkspaceNoProfileContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  employmentProfile: null,
  readiness: {
    canUseManagerWorkspace: false,
    reasons: ['NO_LINKED_EMPLOYMENT_PROFILE'],
  },
});

export const managerWorkspaceNoAssignmentsContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  readiness: {
    canUseManagerWorkspace: true,
    reasons: ['NO_MANAGED_SCOPE_ASSIGNED'],
  },
});

export const managerWorkspaceOrgUnitOnlyContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  scopes: {
    orgUnits: [
      {
        orgUnitId: 'org-unit-001',
        code: 'OU-PROD',
        name: 'Production Unit',
        role: 'UNIT_MANAGER',
        includeDescendants: false,
        capabilities: {
          kpi: {
            ...kpiCapabilities,
            manageAllocation: true,
            enterActual: true,
            correctActual: true,
          },
        },
      },
    ],
    talentGroups: [],
  },
  modules: {
    ...baseContext().modules,
    kpi: {
      visible: true,
      unitKpiVisible: true,
      talentGroupKpiVisible: false,
    },
  },
});

export const managerWorkspaceOrgUnitDepartmentOwnerContext = (): ManagerWorkspaceContext => ({
  ...managerWorkspaceOrgUnitOnlyContext(),
  scopes: {
    orgUnits: managerWorkspaceOrgUnitOnlyContext().scopes.orgUnits.map((scope) => ({
      ...scope,
      role: 'DEPARTMENT_OWNER',
      capabilities: {
        kpi: {
          ...scope.capabilities.kpi,
          manageAllocation: false,
          enterActual: false,
          correctActual: false,
        },
      },
    })),
    talentGroups: [],
  },
});

export const managerWorkspaceOrgUnitOperatorContext = (): ManagerWorkspaceContext => ({
  ...managerWorkspaceOrgUnitOnlyContext(),
  scopes: {
    orgUnits: managerWorkspaceOrgUnitOnlyContext().scopes.orgUnits.map((scope) => ({
      ...scope,
      role: 'UNIT_OPERATOR',
      capabilities: {
        kpi: {
          ...scope.capabilities.kpi,
          manageAllocation: false,
          enterActual: false,
          correctActual: false,
        },
      },
    })),
    talentGroups: [],
  },
});

export const managerWorkspaceOrgUnitNoKpiCapabilityContext = (): ManagerWorkspaceContext => ({
  ...managerWorkspaceOrgUnitOnlyContext(),
  scopes: {
    orgUnits: managerWorkspaceOrgUnitOnlyContext().scopes.orgUnits.map((scope) => ({
      ...scope,
      capabilities: {
        kpi: kpiCapabilities,
      },
    })),
    talentGroups: [],
  },
  modules: {
    ...baseContext().modules,
    kpi: {
      visible: false,
      unitKpiVisible: false,
      talentGroupKpiVisible: false,
    },
  },
  readiness: {
    canUseManagerWorkspace: true,
    reasons: ['MISSING_KPI_MANAGER_CAPABILITY'],
  },
});

export const managerWorkspaceTalentGroupOnlyContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  scopes: {
    orgUnits: [],
    talentGroups: [
      {
        talentGroupId: 'group-001',
        code: 'TG-LIVE',
        name: 'Live Talent',
        capabilities: {
          kpi: kpiCapabilities,
        },
      },
    ],
  },
  modules: {
    ...baseContext().modules,
    kpi: {
      visible: true,
      unitKpiVisible: false,
      talentGroupKpiVisible: true,
    },
  },
});

export const managerWorkspaceDualContext = (): ManagerWorkspaceContext => {
  const orgUnit = managerWorkspaceOrgUnitOnlyContext();
  const talentGroup = managerWorkspaceTalentGroupOnlyContext();

  return {
    ...baseContext(),
    scopes: {
      orgUnits: orgUnit.scopes.orgUnits,
      talentGroups: talentGroup.scopes.talentGroups,
    },
    modules: {
      ...baseContext().modules,
      kpi: {
        visible: true,
        unitKpiVisible: true,
        talentGroupKpiVisible: true,
      },
    },
  };
};

export const managerWorkspaceWorkEnabledContext = (): ManagerWorkspaceContext => {
  const context = managerWorkspaceDualContext();
  return {
    ...context,
    modules: {
      ...context.modules,
      workShifts: {
        visible: true,
      },
    },
  };
};

const defaultManagerWorkShifts = (): ManagerWorkShiftList => ({
  items: [
    {
      workShiftId: 'manager-shift-org',
      title: 'Production morning shift',
      status: 'ACTIVE',
      shiftStartAt: Date.parse('2026-06-08T09:00:00+07:00'),
      shiftEndAt: Date.parse('2026-06-08T17:00:00+07:00'),
      timezone: 'Asia/Ho_Chi_Minh',
      sourceType: 'MANUAL',
      sourceRosterMonth: null,
      member: {
        employmentProfileId: 'ep-org-member',
        displayName: 'Org Unit Member',
        employeeCode: 'EP-ORG-001',
      },
    },
    {
      workShiftId: 'manager-shift-group',
      title: 'Talent group roster shift',
      status: 'ACTIVE',
      shiftStartAt: Date.parse('2026-06-09T10:00:00+07:00'),
      shiftEndAt: Date.parse('2026-06-09T18:00:00+07:00'),
      timezone: 'Asia/Ho_Chi_Minh',
      sourceType: 'ROSTER_GENERATED',
      sourceRosterMonth: '2026-06',
      member: {
        employmentProfileId: 'ep-group-member',
        displayName: 'Talent Group Member',
        employeeCode: 'EP-TG-001',
      },
    },
  ],
  meta: {
    month: '2026-06',
    timezone: 'Asia/Ho_Chi_Minh',
    managedMemberCount: 2,
    representedMemberCount: 2,
    returnedShiftCount: 2,
  },
});

let managerWorkspaceContext = managerWorkspaceDualContext();
let managerWorkShifts = defaultManagerWorkShifts();

export const resetManagerWorkspaceMockData = (): void => {
  managerWorkspaceContext = managerWorkspaceDualContext();
  managerWorkShifts = defaultManagerWorkShifts();
};

export const setMockManagerWorkShifts = (value: ManagerWorkShiftList): void => {
  managerWorkShifts = {
    items: value.items.map((item) => ({ ...item, member: { ...item.member } })),
    meta: { ...value.meta },
  };
};

export const setMockManagerWorkspaceContext = (context: ManagerWorkspaceContext): void => {
  managerWorkspaceContext = {
    ...context,
    scopes: {
      orgUnits: context.scopes.orgUnits.map((scope) => ({ ...scope })),
      talentGroups: context.scopes.talentGroups.map((scope) => ({ ...scope })),
    },
  };
};

export const managerWorkspaceHandlers = [
  http.get('*/admin/manager-workspace/context', () =>
    HttpResponse.json({ data: managerWorkspaceContext }),
  ),
  http.get('*/admin/manager-workspace/work-schedule/work-shifts', () =>
    HttpResponse.json({ data: managerWorkShifts }),
  ),
];
