import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';

import { StatusBadge } from '@shared/components/primitives';
import { readReferenceDisplay } from '@shared/formatting/formatters';
import type {
  TalentCommercialParticipationStatus,
  TalentLifecycleAction,
  TalentRecord,
} from '@modules/talent/types/talent.types';

type TalentListColumnHandlers = {
  onOpenDetail: (talentId: string) => void;
  onLifecycleAction: (talentId: string, action: TalentLifecycleAction) => void;
  isActionPending?: (talentId: string, action: TalentLifecycleAction) => boolean;
};

const operationalStatusToneMap = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const commercialStatusToneMap = {
  ELIGIBLE: 'success',
  RESTRICTED: 'warning',
  BLOCKED: 'danger',
} as const satisfies Record<TalentCommercialParticipationStatus, 'success' | 'warning' | 'danger'>;

const readLifecycleActions = (record: TalentRecord): TalentLifecycleAction[] => {
  if (record.operationalStatus === 'ACTIVE') {
    return ['suspend', 'deactivate'];
  }

  if (record.operationalStatus === 'SUSPENDED') {
    return ['reactivate', 'deactivate'];
  }

  if (record.operationalStatus === 'INACTIVE') {
    return ['reactivate', 'archive'];
  }

  return [];
};

export const createTalentListColumns = (
  t: TFunction,
  handlers: TalentListColumnHandlers,
): ColumnDef<TalentRecord>[] => {
  return [
    {
      accessorKey: 'talentCode',
      header: t('talent:table.talentCode'),
      cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
    },
    {
      accessorKey: 'stageName',
      header: t('talent:table.stageName'),
    },
    {
      accessorKey: 'legalName',
      header: t('talent:table.legalName'),
    },
    {
      accessorKey: 'displayShortName',
      header: t('talent:table.displayShortName'),
      cell: (context) => String(context.getValue() ?? '-'),
    },
    {
      accessorKey: 'operationalStatus',
      header: t('talent:table.operationalStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`talent:statuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={operationalStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'managerEmploymentProfileId',
      header: t('talent:table.managerEmploymentProfileId'),
      cell: ({ row }) =>
        readReferenceDisplay(
          row.original.managerEmploymentProfileRef,
          row.original.managerEmploymentProfileId,
        ),
    },
    {
      accessorKey: 'commercialParticipationStatus',
      header: t('talent:table.commercialParticipationStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          toneByStatus={commercialStatusToneMap}
          label={t(
            `talent:commercialStatuses.${String(context.getValue() as TalentCommercialParticipationStatus)}`,
          )}
          uppercase
        />
      ),
    },
    {
      accessorKey: 'livestreamEligible',
      header: t('talent:table.livestreamEligible'),
      cell: (context) =>
        context.getValue() === true ? t('talent:boolean.true') : t('talent:boolean.false'),
    },
    {
      accessorKey: 'eventEligible',
      header: t('talent:table.eventEligible'),
      cell: (context) =>
        context.getValue() === true ? t('talent:boolean.true') : t('talent:boolean.false'),
    },
    {
      id: 'actions',
      header: t('talent:table.actions'),
      cell: ({ row }) => {
        const record = row.original;
        const actions = readLifecycleActions(record);

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
              {t('talent:actions.open')}
            </button>
            {actions.map((action) => (
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
                {t(`talent:actions.${action}`)}
              </button>
            ))}
          </div>
        );
      },
    },
  ];
};
