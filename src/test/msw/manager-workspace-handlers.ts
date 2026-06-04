import { http, HttpResponse } from 'msw';

import type { ManagerWorkspaceContext } from '@modules/manager-workspace/api/manager-workspace.api';

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
      reason: 'NOT_ENABLED_IN_MANAGER_WORKSPACE_YET',
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
        orgUnitId: 'ou-production',
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

export const managerWorkspaceTalentGroupOnlyContext = (): ManagerWorkspaceContext => ({
  ...baseContext(),
  scopes: {
    orgUnits: [],
    talentGroups: [
      {
        talentGroupId: 'tg-live',
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

let managerWorkspaceContext = managerWorkspaceDualContext();

export const resetManagerWorkspaceMockData = (): void => {
  managerWorkspaceContext = managerWorkspaceDualContext();
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
];
