import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SensitiveActionDialog } from '@shared/components/primitives';

export type KpiSensitiveAction =
  | 'publish'
  | 'archive'
  | 'finalize'
  | 'submitAllocation'
  | 'approveAllocation'
  | 'rejectAllocation'
  | 'publishAllocation';

const actionLabelKeys: Record<KpiSensitiveAction, string> = {
  publish: 'kpi:actions.publish',
  archive: 'kpi:actions.archive',
  finalize: 'kpi:actions.finalize',
  submitAllocation: 'kpi:actions.submitAllocation',
  approveAllocation: 'kpi:actions.approveAllocation',
  rejectAllocation: 'kpi:actions.rejectAllocation',
  publishAllocation: 'kpi:actions.publishAllocation',
};

/** A KPI-owned bridge to the shared dialog; opening or cancelling never mutates. */
export const useKpiSensitiveConfirm = () => {
  const { t } = useTranslation(['kpi', 'common']);
  const [action, setAction] = useState<KpiSensitiveAction | null>(null);
  const resolverRef = useRef<(confirmed: boolean) => void>();

  const confirm = (nextAction: KpiSensitiveAction): Promise<boolean> => {
    setAction(nextAction);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const resolve = (confirmed: boolean): void => {
    resolverRef.current?.(confirmed);
    resolverRef.current = undefined;
    setAction(null);
  };

  const dialog = action ? (
    <SensitiveActionDialog
      open
      title={t(actionLabelKeys[action])}
      summary={t(`kpi:confirm.${action}`)}
      riskItems={[t('kpi:confirm.operationalOnly')]}
      acknowledgementLabel={t('kpi:confirm.acknowledge')}
      confirmLabel={t(actionLabelKeys[action])}
      cancelLabel={t('common:actions.cancel')}
      tone={
        action === 'approveAllocation' || action === 'publishAllocation' ? 'warning' : 'critical'
      }
      onConfirm={() => resolve(true)}
      onCancel={() => resolve(false)}
    />
  ) : null;

  return { confirm, dialog };
};
