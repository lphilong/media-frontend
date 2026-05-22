import type {
  ActionCapabilityHint,
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
  createPlan: {
    permission: PERMISSIONS.KPI_CREATE_PLAN,
    scope: { module: 'kpi', value: 'global' },
  },
  enterActual: {
    permission: PERMISSIONS.KPI_ENTER_ACTUAL,
    scope: { module: 'kpi', value: 'global' },
  },
  correctActual: {
    permission: PERMISSIONS.KPI_CORRECT_ACTUAL,
    scope: { module: 'kpi', value: 'global' },
  },
} satisfies Record<KpiMoneyAction, Parameters<typeof canUseAction>[1]>;

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

  const result = canUseAction(state.capabilities, kpiMoneyActionRequirements[action]);
  if (result.allowed) {
    return {
      allowed: true,
      disabled: false,
    };
  }

  return {
    allowed: false,
    disabled: true,
    disabledReason: copy[result.reason ?? 'missing-permission'],
  };
};
