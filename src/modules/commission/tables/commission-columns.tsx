import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import {
  readCommissionRuleListLifecycleActions,
  readCommissionSettlementListLifecycleActions,
} from '@modules/commission/actions/commission-action-rail';
import type {
  CommissionRuleLifecycleAction,
  CommissionRuleListItem,
  CommissionRuleStatus,
  CommissionSettlementLifecycleAction,
  CommissionSettlementListItem,
  CommissionSettlementStatus,
} from '@modules/commission/types/commission.types';
import { StatusBadge } from '@shared/components/primitives';
import {
  formatCurrency,
  formatDecimal,
  formatUtcMidnightDateLike,
  formatBusinessTimestamp,
} from '@shared/formatting/formatters';
import { readReferenceDisplay, type ReferenceSummary } from '@shared/formatting/reference-display';

type RuleColumnHandlers = {
  onOpenDetail: (commissionRuleId: string) => void;
  onLifecycleAction: (commissionRuleId: string, action: CommissionRuleLifecycleAction) => void;
  canShowLifecycleAction?: (action: CommissionRuleLifecycleAction) => boolean;
  isActionPending?: (commissionRuleId: string, action: CommissionRuleLifecycleAction) => boolean;
};

type SettlementColumnHandlers = {
  onOpenDetail: (commissionSettlementId: string) => void;
  onLifecycleAction: (
    commissionSettlementId: string,
    action: CommissionSettlementLifecycleAction,
  ) => void;
  canShowLifecycleAction?: (action: CommissionSettlementLifecycleAction) => boolean;
  isActionPending?: (
    commissionSettlementId: string,
    action: CommissionSettlementLifecycleAction,
  ) => boolean;
};

export const commissionRuleStatusToneMap = {
  DRAFT: 'neutral',
  INACTIVE: 'neutral',
  ACTIVE: 'success',
  ARCHIVED: 'muted',
} as const;

export const commissionSettlementStatusToneMap = {
  DRAFT: 'neutral',
  FINALIZED: 'success',
  VOIDED: 'danger',
  ARCHIVED: 'muted',
} as const;

const renderMono = (value: unknown): JSX.Element | string => {
  if (!value) {
    return '-';
  }

  return <span className="font-mono text-xs">{String(value)}</span>;
};

const renderNullableTimestamp = (value: unknown): string => {
  if (!value) {
    return '-';
  }

  return formatBusinessTimestamp(value as string | number);
};

const renderNullableUtcDate = (value: unknown): string => {
  if (!value) {
    return '-';
  }

  return formatUtcMidnightDateLike(value as string | number);
};

const readRuleBeneficiaryId = (record: CommissionRuleListItem): string | null | undefined =>
  record.beneficiaryKind === 'EMPLOYMENT_PROFILE'
    ? record.beneficiaryEmploymentProfileId
    : record.beneficiaryTalentId;

const readRuleBeneficiaryRef = (
  record: CommissionRuleListItem,
): ReferenceSummary | null | undefined => record.beneficiaryRef;

const readSettlementBeneficiaryId = (
  record: CommissionSettlementListItem,
): string | null | undefined =>
  record.beneficiaryKindSnapshot === 'EMPLOYMENT_PROFILE'
    ? record.beneficiaryEmploymentProfileIdSnapshot
    : record.beneficiaryTalentIdSnapshot;

const readSettlementBeneficiaryRef = (
  record: CommissionSettlementListItem,
): ReferenceSummary | null | undefined => record.beneficiaryRef;

export const createCommissionRuleColumns = (
  t: TFunction,
  handlers: RuleColumnHandlers,
): ColumnDef<CommissionRuleListItem>[] => [
  {
    accessorKey: 'ruleCode',
    header: t('commission:rules.table.ruleCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'title',
    header: t('commission:rules.table.title'),
  },
  {
    accessorKey: 'settlementKind',
    header: t('commission:rules.table.settlementKind'),
    cell: (context) => t(`commission:settlementKinds.${String(context.getValue() ?? '')}`),
  },
  {
    accessorKey: 'beneficiaryKind',
    header: t('commission:rules.table.beneficiaryKind'),
    cell: (context) => t(`commission:beneficiaryKinds.${String(context.getValue() ?? '')}`),
  },
  {
    id: 'beneficiaryId',
    header: t('commission:rules.table.beneficiaryId'),
    cell: ({ row }) =>
      readReferenceDisplay(
        readRuleBeneficiaryRef(row.original),
        readRuleBeneficiaryId(row.original),
      ),
  },
  {
    accessorKey: 'sourceContractRecordId',
    header: t('commission:rules.table.sourceContractRecordId'),
    cell: ({ row }) =>
      readReferenceDisplay(
        row.original.sourceContractRecordRef,
        row.original.sourceContractRecordId,
      ),
  },
  {
    accessorKey: 'ratePercent',
    header: t('commission:rules.table.ratePercent'),
    cell: (context) => `${formatDecimal(Number(context.getValue()), undefined, 4)}%`,
  },
  {
    accessorKey: 'status',
    header: t('commission:rules.table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`commission:rules.statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={commissionRuleStatusToneMap}
      />
    ),
  },
  {
    accessorKey: 'effectiveStartDate',
    header: t('commission:rules.table.effectiveStartDate'),
    cell: (context) => formatUtcMidnightDateLike(context.getValue() as string | number),
  },
  {
    accessorKey: 'effectiveEndDate',
    header: t('commission:rules.table.effectiveEndDate'),
    cell: (context) => renderNullableUtcDate(context.getValue()),
  },
  {
    id: 'actions',
    header: t('commission:rules.table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const lifecycleActions = readCommissionRuleListLifecycleActions(record.status).filter(
        (action) => handlers.canShowLifecycleAction?.(action) ?? true,
      );

      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              handlers.onOpenDetail(record.id);
            }}
          >
            {t('commission:rules.actions.open')}
          </button>
          {lifecycleActions.map((action) => (
            <button
              key={action}
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={handlers.isActionPending?.(record.id, action)}
              onClick={(event) => {
                event.stopPropagation();
                handlers.onLifecycleAction(record.id, action);
              }}
            >
              {t(`commission:rules.actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];

export const createCommissionSettlementColumns = (
  t: TFunction,
  handlers: SettlementColumnHandlers,
): ColumnDef<CommissionSettlementListItem>[] => [
  {
    accessorKey: 'settlementCode',
    header: t('commission:settlements.table.settlementCode'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'title',
    header: t('commission:settlements.table.title'),
  },
  {
    accessorKey: 'sourceRuleId',
    header: t('commission:settlements.table.sourceRuleId'),
    cell: ({ row }) => readReferenceDisplay(row.original.sourceRuleRef, row.original.sourceRuleId),
  },
  {
    accessorKey: 'settlementKindSnapshot',
    header: t('commission:settlements.table.settlementKindSnapshot'),
    cell: (context) => t(`commission:settlementKinds.${String(context.getValue() ?? '')}`),
  },
  {
    accessorKey: 'beneficiaryKindSnapshot',
    header: t('commission:settlements.table.beneficiaryKindSnapshot'),
    cell: (context) => t(`commission:beneficiaryKinds.${String(context.getValue() ?? '')}`),
  },
  {
    id: 'beneficiarySnapshotId',
    header: t('commission:settlements.table.beneficiarySnapshotId'),
    cell: ({ row }) =>
      readReferenceDisplay(
        readSettlementBeneficiaryRef(row.original),
        readSettlementBeneficiaryId(row.original),
      ),
  },
  {
    accessorKey: 'subjectTalentId',
    header: t('commission:settlements.table.subjectTalentId'),
    cell: (context) => renderMono(context.getValue()),
  },
  {
    accessorKey: 'settlementCurrencyCode',
    header: t('commission:settlements.table.settlementCurrencyCode'),
    cell: (context) => renderMono(context.getValue()),
  },
  {
    accessorKey: 'grossRevenueAmount',
    header: t('commission:settlements.table.grossRevenueAmount'),
    cell: ({ row }) =>
      formatCurrency(Number(row.original.grossRevenueAmount), row.original.settlementCurrencyCode),
  },
  {
    accessorKey: 'settlementAmount',
    header: t('commission:settlements.table.settlementAmount'),
    cell: ({ row }) =>
      formatCurrency(Number(row.original.settlementAmount), row.original.settlementCurrencyCode),
  },
  {
    accessorKey: 'status',
    header: t('commission:settlements.table.status'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`commission:settlements.statuses.${String(context.getValue() ?? '')}`)}
        toneByStatus={commissionSettlementStatusToneMap}
      />
    ),
  },
  {
    accessorKey: 'settlementPeriodStartAt',
    header: t('commission:settlements.table.settlementPeriodStartAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as string | number),
  },
  {
    accessorKey: 'settlementPeriodEndAt',
    header: t('commission:settlements.table.settlementPeriodEndAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as string | number),
  },
  {
    accessorKey: 'finalizedAt',
    header: t('commission:settlements.table.finalizedAt'),
    cell: (context) => renderNullableTimestamp(context.getValue()),
  },
  {
    id: 'actions',
    header: t('commission:settlements.table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const lifecycleActions = readCommissionSettlementListLifecycleActions(record.status).filter(
        (action) => handlers.canShowLifecycleAction?.(action) ?? true,
      );

      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              handlers.onOpenDetail(record.id);
            }}
          >
            {t('commission:settlements.actions.open')}
          </button>
          {lifecycleActions.map((action) => (
            <button
              key={action}
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              disabled={handlers.isActionPending?.(record.id, action)}
              onClick={(event) => {
                event.stopPropagation();
                handlers.onLifecycleAction(record.id, action);
              }}
            >
              {t(`commission:settlements.actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];

export const isCommissionRuleStatus = (value: string): value is CommissionRuleStatus =>
  ['DRAFT', 'INACTIVE', 'ACTIVE', 'ARCHIVED'].includes(value);

export const isCommissionSettlementStatus = (value: string): value is CommissionSettlementStatus =>
  ['DRAFT', 'FINALIZED', 'VOIDED', 'ARCHIVED'].includes(value);
