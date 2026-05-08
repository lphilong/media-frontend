import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';

import { StatusBadge } from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';
import type {
  EmploymentProfileDirectReport,
  EmploymentProfileListItem,
} from '@modules/employment-profile/types/employment-profile.types';

type EmploymentProfileListColumnHandlers = {
  onOpenDetail: (employmentProfileId: string) => void;
};

const employmentStatusToneMap = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  SUSPENDED: 'danger',
  TERMINATED: 'neutral',
  ARCHIVED: 'muted',
} as const;

const contractStatusToneMap = {
  NONE: 'neutral',
  PENDING_SIGNATURE: 'warning',
  ACTIVE: 'success',
  EXPIRED: 'danger',
  TERMINATED: 'muted',
} as const;

export const createEmploymentProfileListColumns = (
  t: TFunction,
  handlers: EmploymentProfileListColumnHandlers,
): ColumnDef<EmploymentProfileListItem>[] => {
  return [
    {
      accessorKey: 'employeeCode',
      header: t('employment-profile:table.employeeCode'),
      cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
    },
    {
      accessorKey: 'displayName',
      header: t('employment-profile:table.displayName'),
    },
    {
      accessorKey: 'legalName',
      header: t('employment-profile:table.legalName'),
    },
    {
      accessorKey: 'employmentKind',
      header: t('employment-profile:table.employmentKind'),
    },
    {
      accessorKey: 'jobTitle',
      header: t('employment-profile:table.jobTitle'),
    },
    {
      accessorKey: 'orgUnitId',
      header: t('employment-profile:table.orgUnitId'),
      cell: (context) => (
        <span className="font-mono text-xs">{String(context.getValue() ?? '-')}</span>
      ),
    },
    {
      accessorKey: 'managerEmploymentProfileId',
      header: t('employment-profile:table.managerEmploymentProfileId'),
      cell: (context) => {
        const value = context.getValue() as string | null | undefined;
        return <span className="font-mono text-xs">{value ?? '-'}</span>;
      },
    },
    {
      accessorKey: 'linkedUserId',
      header: t('employment-profile:table.linkedUserId'),
      cell: (context) => {
        const value = context.getValue() as string | null | undefined;
        return <span className="font-mono text-xs">{value ?? '-'}</span>;
      },
    },
    {
      accessorKey: 'employmentStatus',
      header: t('employment-profile:table.employmentStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`employment-profile:statuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={employmentStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'contractStatus',
      header: t('employment-profile:table.contractStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`employment-profile:contractStatuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={contractStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: t('employment-profile:table.createdAt'),
      cell: (context) => formatUtcTimestamp(context.getValue() as number | string),
    },
    {
      id: 'actions',
      header: t('employment-profile:table.actions'),
      cell: ({ row }) => (
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            handlers.onOpenDetail(row.original.id);
          }}
        >
          {t('employment-profile:actions.open')}
        </button>
      ),
    },
  ];
};

export const createEmploymentDirectReportsColumns = (
  t: TFunction,
): ColumnDef<EmploymentProfileDirectReport>[] => {
  return [
    {
      accessorKey: 'employeeCode',
      header: t('employment-profile:directReportsTable.employeeCode'),
      cell: (context) => (
        <span className="font-mono text-xs">{String(context.getValue() ?? '-')}</span>
      ),
    },
    {
      accessorKey: 'displayName',
      header: t('employment-profile:directReportsTable.displayName'),
    },
    {
      accessorKey: 'employmentStatus',
      header: t('employment-profile:directReportsTable.employmentStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`employment-profile:statuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={employmentStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'contractStatus',
      header: t('employment-profile:directReportsTable.contractStatus'),
      cell: (context) => (
        <StatusBadge
          status={String(context.getValue() ?? '')}
          label={t(`employment-profile:contractStatuses.${String(context.getValue() ?? '')}`)}
          toneByStatus={contractStatusToneMap}
        />
      ),
    },
    {
      accessorKey: 'orgUnitId',
      header: t('employment-profile:directReportsTable.orgUnitId'),
      cell: (context) => (
        <span className="font-mono text-xs">{String(context.getValue() ?? '-')}</span>
      ),
    },
    {
      accessorKey: 'managerEmploymentProfileId',
      header: t('employment-profile:directReportsTable.managerEmploymentProfileId'),
      cell: (context) => {
        const value = context.getValue() as string | null | undefined;
        return <span className="font-mono text-xs">{value ?? '-'}</span>;
      },
    },
  ];
};
