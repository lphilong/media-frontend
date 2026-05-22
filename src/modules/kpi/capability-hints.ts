import type {
  ActionCapabilityHint,
  ActionCapabilityRequirement,
  CapabilityMissingReason,
  CapabilityQueryState,
} from '@shared/auth/current-actor-capabilities';
import { canUseAction, PERMISSIONS } from '@shared/auth/current-actor-capabilities';

type KpiMoneyAction = 'createPlan' | 'enterActual' | 'correctActual';

type KpiCapabilityUnavailableReason = CapabilityMissingReason | 'unavailable';

type KpiCapabilityCopy = Record<KpiCapabilityUnavailableReason, string>;

type KpiActionAvailability = ActionCapabilityHint & {
  allowed: boolean;
  disabledReason?: string;
};

const kpiMoneyActionRequirements = {
  createPlan: [
    {
      permission: PERMISSIONS.KPI_CREATE_PLAN,
      scope: { module: 'kpi', value: 'global' },
    },
  ],
  enterActual: [
    {
      permission: PERMISSIONS.KPI_ENTER_ACTUAL,
      scope: { module: 'kpi', value: 'global' },
    },
    {
      permission: PERMISSIONS.KPI_ENTER_ACTUAL,
      scope: { module: 'kpi', value: 'managedGroup' },
    },
  ],
  correctActual: [
    {
      permission: PERMISSIONS.KPI_CORRECT_ACTUAL,
      scope: { module: 'kpi', value: 'global' },
    },
    {
      permission: PERMISSIONS.KPI_CORRECT_ACTUAL,
      scope: { module: 'kpi', value: 'managedGroup' },
    },
  ],
} satisfies Record<KpiMoneyAction, readonly ActionCapabilityRequirement[]>;

export const createKpiActionCapabilityHint = (
  state: CapabilityQueryState,
  action: KpiMoneyAction,
  copy: KpiCapabilityCopy,
): KpiActionAvailability => {
  if (state.isLoading && !state.capabilities) {
    return {
      allowed: false,
      disabled: true,
      disabledReason: copy.loading,
    };
  }

  if (state.isError || !state.capabilities) {
    return {
      allowed: false,
      disabled: true,
      disabledReason: copy.unavailable,
    };
  }

  const checks = kpiMoneyActionRequirements[action].map((requirement) =>
    canUseAction(state.capabilities, requirement),
  );
  const result = checks.find((check) => check.allowed) ?? checks[0];
  if (result?.allowed) {
    return {
      allowed: true,
      disabled: false,
    };
  }

  return {
    allowed: false,
    disabled: true,
    disabledReason: copy[result?.reason ?? 'missing-permission'],
  };
};
