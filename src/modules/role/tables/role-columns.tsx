import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';

import { APP_PATHS } from '@app/router/paths';
import type {
  RoleAssignmentItem,
  RoleAssignmentScopeGrants,
  RoleLifecycleAction,
  RoleListItem,
  RoleState,
} from '@modules/role/types/role.types';
import { ReferenceChip, StatusBadge } from '@shared/components/primitives';
import { formatBusinessTimestamp, readReferenceDisplay } from '@shared/formatting/formatters';

type RoleListColumnHandlers = {
  onOpenDetail: (roleId: string) => void;
  onLifecycleAction: (roleId: string, action: RoleLifecycleAction) => void;
  canShowLifecycleAction?: (action: RoleLifecycleAction) => boolean;
  isActionPending?: (roleId: string, action: RoleLifecycleAction) => boolean;
};

type RoleAssignmentColumnHandlers = {
  roleState?: RoleState;
  canRevokeAssignment?: boolean;
  revokeDisabledReason?: string;
  onRevokeAssignment: (assignment: RoleAssignmentItem) => void;
  isActionPending?: (assignmentId: string) => boolean;
};

const roleStateToneMap = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const assignmentStateToneMap = {
  ACTIVE: 'success',
  REVOKED: 'muted',
} as const;

const readLifecycleActions = (record: RoleListItem): RoleLifecycleAction[] => {
  if (record.state === 'DRAFT' || record.state === 'INACTIVE') {
    return ['activate', 'archive'];
  }

  if (record.state === 'ACTIVE') {
    return ['deactivate'];
  }

  return [];
};

const scopeModuleLabels: Record<keyof RoleAssignmentScopeGrants, string> = {
  workSchedule: 'Lịch làm việc',
  eventAssignment: 'Phân công sự kiện',
  contractRegistry: 'Hồ sơ hợp đồng',
  talentKpi: 'Talent KPI',
  kpi: 'Vận hành KPI',
  revenueLedger: 'Dữ liệu doanh thu',
  commission: 'Hoa hồng',
  dashboardLite: 'Tổng quan vận hành',
};

const scopeOrder: Array<keyof RoleAssignmentScopeGrants> = [
  'workSchedule',
  'eventAssignment',
  'contractRegistry',
  'talentKpi',
  'kpi',
  'revenueLedger',
  'commission',
  'dashboardLite',
];

const scopeValueLabels: Record<string, string> = {
  self: 'Dữ liệu của chính nhân sự này',
  team: 'Nhóm đang phụ trách',
  department: 'Phòng ban',
  managedGroup: 'Nhóm Talent được quản lý',
  global: 'Toàn bộ phạm vi được phép',
};

const toScopeLabel = (value: string): string => scopeValueLabels[value] ?? value;

export const formatAssignmentScopeSummary = (
  scopeGrants?: RoleAssignmentScopeGrants | null,
): string => {
  if (!scopeGrants) {
    return '-';
  }

  const entries = scopeOrder.flatMap((module) => {
    const scopes = scopeGrants[module] ?? [];
    return scopes.length > 0
      ? [`${scopeModuleLabels[module]}: ${scopes.map((scope) => toScopeLabel(scope)).join(', ')}`]
      : [];
  });

  return entries.length > 0 ? entries.join('; ') : '-';
};

export const createRoleListColumns = (
  t: TFunction,
  handlers: RoleListColumnHandlers,
): ColumnDef<RoleListItem>[] => [
  {
    accessorKey: 'code',
    header: t('role:table.code'),
    cell: (context) => <span className="font-mono">{String(context.getValue() ?? '-')}</span>,
  },
  {
    accessorKey: 'name',
    header: t('role:table.name'),
  },
  {
    accessorKey: 'state',
    header: t('role:table.state'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`role:states.${String(context.getValue() ?? '')}`)}
        toneByStatus={roleStateToneMap}
      />
    ),
  },
  {
    accessorKey: 'permissionsSummary',
    header: t('role:table.permissionsSummary'),
    cell: (context) => String(context.getValue() ?? '-'),
  },
  {
    accessorKey: 'assignmentCountSummary',
    header: t('role:table.assignmentCountSummary'),
    cell: (context) => String(context.getValue() ?? '-'),
  },
  {
    accessorKey: 'updatedAt',
    header: t('role:table.updatedAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
  },
  {
    id: 'actions',
    header: t('role:table.actions'),
    cell: ({ row }) => {
      const record = row.original;
      const actions = readLifecycleActions(record).filter(
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
            {t('role:actions.open')}
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
              {t(`role:actions.${action}`)}
            </button>
          ))}
        </div>
      );
    },
  },
];

export const createRoleAssignmentColumns = (
  t: TFunction,
  handlers: RoleAssignmentColumnHandlers,
): ColumnDef<RoleAssignmentItem>[] => [
  {
    accessorKey: 'userId',
    header: t('role:assignments.userId'),
    cell: ({ row }) => {
      const userId = row.original.userId;
      return userId ? (
        <ReferenceChip
          label={readReferenceDisplay(row.original.userRef, userId)}
          to={APP_PATHS.userDetail(userId)}
        />
      ) : (
        '-'
      );
    },
  },
  {
    accessorKey: 'state',
    header: t('role:assignments.state'),
    cell: (context) => (
      <StatusBadge
        status={String(context.getValue() ?? '')}
        label={t(`role:assignmentStates.${String(context.getValue() ?? '')}`)}
        toneByStatus={assignmentStateToneMap}
      />
    ),
  },
  {
    accessorKey: 'effectiveAt',
    header: t('role:assignments.effectiveAt'),
    cell: (context) => formatBusinessTimestamp(context.getValue() as number | string),
  },
  {
    accessorKey: 'revokedAt',
    header: t('role:assignments.revokedAt'),
    cell: (context) => {
      const value = context.getValue() as number | string | null | undefined;
      return value === null || value === undefined ? '-' : formatBusinessTimestamp(value);
    },
  },
  {
    id: 'scopeGrants',
    header: t('role:assignments.scopeGrants'),
    cell: ({ row }) => formatAssignmentScopeSummary(row.original.scopeGrants),
  },
  {
    accessorKey: 'reason',
    header: t('role:assignments.reason'),
    cell: (context) => String(context.getValue() ?? '-'),
  },
  {
    id: 'actions',
    header: t('role:table.actions'),
    cell: ({ row }) => {
      const assignment = row.original;
      if (handlers.canRevokeAssignment === false) {
        return null;
      }

      const canRevoke = handlers.roleState === 'ACTIVE' && assignment.state === 'ACTIVE';
      const disabledReason = !canRevoke ? t('common:capabilities.invalidStatus') : undefined;
      const reasonId = `role-assignment-${assignment.assignmentId}-revoke-disabled-reason`;

      return (
        <div className="space-y-1">
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canRevoke || handlers.isActionPending?.(assignment.assignmentId)}
            aria-describedby={disabledReason ? reasonId : undefined}
            title={disabledReason}
            onClick={() => handlers.onRevokeAssignment(assignment)}
          >
            {t('role:actions.revokeAssignment')}
          </button>
          {disabledReason ? (
            <p id={reasonId} className="text-xs leading-5 text-muted">
              {disabledReason}
            </p>
          ) : null}
        </div>
      );
    },
  },
];
