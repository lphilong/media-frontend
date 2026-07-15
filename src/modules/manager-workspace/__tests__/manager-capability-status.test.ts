import { parseManagerWorkspaceContextForTest } from '@modules/manager-workspace/api/manager-workspace.api';
import {
  deriveManagerCapabilityStatuses,
  isManagerCapabilityAvailable,
} from '@modules/manager-workspace/manager-capability-status';
import {
  managerWorkspaceDualContext,
  managerWorkspaceNoProfileContext,
  managerWorkspaceWorkEnabledContext,
} from '@test/msw/manager-workspace-handlers';

const blockedContext = (
  reason: 'NO_MANAGER_RESPONSIBILITY_ASSIGNED' | 'NO_STRUCTURED_SCOPE_ASSIGNED',
) => {
  const base = managerWorkspaceDualContext();
  return parseManagerWorkspaceContextForTest({
    data: {
      ...base,
      readiness: { canUseManagerWorkspace: true, reasons: [reason] },
      scopes: { orgUnits: [], talentGroups: [] },
      modules: {
        ...base.modules,
        kpi: { visible: false, unitKpiVisible: false, talentGroupKpiVisible: false },
        workShifts: { visible: false, reason },
        events: { visible: false, reason },
        revenueSource: { visible: false, reason },
      },
    },
  });
};

describe('Manager capability status derivation', () => {
  it('keeps released read-only/actionable modules distinct including Groups/Members', () => {
    const statuses = deriveManagerCapabilityStatuses({
      context: managerWorkspaceWorkEnabledContext(),
    });

    expect(statuses.events).toBe('AVAILABLE_READ_ONLY');
    expect(statuses.work).toBe('AVAILABLE_ACTIONABLE');
    expect(statuses.groups).toBe('AVAILABLE_READ_ONLY');
    expect(statuses.members).toBe('AVAILABLE_READ_ONLY');
    expect(isManagerCapabilityAvailable(statuses.events)).toBe(true);
    expect(isManagerCapabilityAvailable(statuses.groups)).toBe(true);
  });

  it('distinguishes missing profile, central responsibility, structured scope, and load error', () => {
    expect(
      deriveManagerCapabilityStatuses({ context: managerWorkspaceNoProfileContext() }).events,
    ).toBe('MISSING_PROFILE');
    expect(
      deriveManagerCapabilityStatuses({
        context: blockedContext('NO_MANAGER_RESPONSIBILITY_ASSIGNED'),
      }).events,
    ).toBe('MISSING_RESPONSIBILITY');
    expect(
      deriveManagerCapabilityStatuses({ context: blockedContext('NO_STRUCTURED_SCOPE_ASSIGNED') })
        .events,
    ).toBe('MISSING_SCOPE');
    expect(deriveManagerCapabilityStatuses({ loadError: true }).events).toBe('LOAD_ERROR');
  });
});
