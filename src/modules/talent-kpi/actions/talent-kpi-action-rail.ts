import type { TFunction } from 'i18next';

import type {
  TalentKpiLifecycleAction,
  TalentKpiRecord,
  TalentKpiStatus,
} from '@modules/talent-kpi/types/talent-kpi.types';
import type { ActionRailItem } from '@shared/components/primitives';

type TalentKpiActionRailHandlers = {
  onDraftCoreEdit: () => void;
  onReplaceMetrics: () => void;
  onLifecycleAction: (action: TalentKpiLifecycleAction) => void;
  isLifecyclePending?: (action: TalentKpiLifecycleAction) => boolean;
};

export const canEditTalentKpiDraftCore = (status: TalentKpiStatus): boolean => status === 'DRAFT';
export const canReplaceTalentKpiMetrics = (status: TalentKpiStatus): boolean => status === 'DRAFT';
export const canFinalizeTalentKpi = (status: TalentKpiStatus): boolean => status === 'DRAFT';
export const canArchiveTalentKpi = (status: TalentKpiStatus): boolean =>
  status === 'DRAFT' || status === 'FINALIZED';

export const createTalentKpiActionRailItems = (
  t: TFunction,
  record: TalentKpiRecord,
  handlers: TalentKpiActionRailHandlers,
): ActionRailItem[] => {
  const status = record.status;

  return [
    {
      id: 'draft-core',
      label: t('talent-kpi:actions.editDraftCore'),
      disabled: !canEditTalentKpiDraftCore(status),
      onClick: canEditTalentKpiDraftCore(status) ? handlers.onDraftCoreEdit : undefined,
    },
    {
      id: 'replace-metrics',
      label: t('talent-kpi:actions.replaceMetrics'),
      disabled: !canReplaceTalentKpiMetrics(status),
      onClick: canReplaceTalentKpiMetrics(status) ? handlers.onReplaceMetrics : undefined,
    },
    {
      id: 'finalize',
      label: t('talent-kpi:actions.finalize'),
      disabled: !canFinalizeTalentKpi(status) || handlers.isLifecyclePending?.('finalize'),
      onClick: canFinalizeTalentKpi(status)
        ? () => handlers.onLifecycleAction('finalize')
        : undefined,
    },
    {
      id: 'archive',
      label: t('talent-kpi:actions.archive'),
      tone: 'danger',
      disabled: !canArchiveTalentKpi(status) || handlers.isLifecyclePending?.('archive'),
      onClick: canArchiveTalentKpi(status)
        ? () => handlers.onLifecycleAction('archive')
        : undefined,
    },
  ];
};

export const readTalentKpiListLifecycleActions = (
  status: TalentKpiStatus,
): TalentKpiLifecycleAction[] => {
  const actions: TalentKpiLifecycleAction[] = [];

  if (canFinalizeTalentKpi(status)) {
    actions.push('finalize');
  }
  if (canArchiveTalentKpi(status)) {
    actions.push('archive');
  }

  return actions;
};
