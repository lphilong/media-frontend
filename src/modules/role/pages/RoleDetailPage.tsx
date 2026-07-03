import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { createRoleActionRailItems } from '@modules/role/actions/role-action-rail';
import { RoleBoundaryNotice } from '@modules/role/components/RoleBoundaryNotice';
import {
  RoleEditSurface,
  RoleLifecycleReasonSurface,
} from '@modules/role/forms/role-mutation-forms';
import {
  useRoleDetail,
  useRoleLifecycleMutation,
  useRolePermissionMatrix,
  useUpdateRoleMutation,
} from '@modules/role/hooks/use-role';
import { formatPermissionCapabilitySummary } from '@modules/role/utils/permission-labels';
import type { RoleLifecycleAction, RoleTemplateCode } from '@modules/role/types/role.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ActionRail,
  ErrorState,
  LoadingState,
  MetadataSection,
  NotFoundState,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  ReferenceChip,
  StatusBadge,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { formatCreatedDate, formatBusinessTimestamp } from '@shared/formatting/formatters';
import {
  applyActionCapabilityHints,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import { ModuleDetailScreenShell } from '@shared/modules';
import { useScrollToPanel } from '@shared/hooks/useScrollToPanel';

type ActiveMutationSurface = 'edit' | 'deactivate' | 'archive' | null;

const statusToneMap = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'muted',
} as const;

const readErrorMessage = (
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  if (!error?.message) {
    return t(fallbackKey);
  }

  if (error.message.includes(':')) {
    return t(error.message);
  }

  return error.message;
};

const formatOptionalTimestamp = (value?: number | string | null): string =>
  value === null || value === undefined ? '-' : formatBusinessTimestamp(value);

const roleTemplateDisplayNames: Partial<Record<RoleTemplateCode, string>> = {
  OWNER_ADMIN: 'Quản trị chủ sở hữu',
  ACCESS_ADMIN: 'Quản trị phân quyền',
  HR_OPERATIONS: 'Vận hành nhân sự',
  HR_TERMS_APPROVER: 'Duyệt điều khoản nhân sự',
  PRODUCTION_OPS: 'Vận hành sản xuất',
  PLATFORM_CHANNEL_OPS: 'Vận hành kênh nền tảng',
  CREATIVE_VISUAL_LEAD: 'Phụ trách hình ảnh sáng tạo',
  CONTENT_OPS: 'Vận hành nội dung',
  TALENT_GROUP_MANAGER: 'Quản lý nhóm Talent',
  ORG_UNIT_MANAGER: 'Quản lý phòng ban',
  KPI_OPERATIONS: 'Vận hành KPI',
  COMMERCIAL_CONTRACT_OPS: 'Vận hành hợp đồng thương mại',
  REVENUE_FINANCE_OPS: 'Vận hành tài chính doanh thu',
  REVENUE_APPROVER: 'Duyệt doanh thu',
  REVENUE_RECONCILER: 'Đối soát doanh thu',
  COMMISSION_OPS: 'Vận hành hoa hồng',
  COMMISSION_APPROVER: 'Duyệt hoa hồng',
  ATTENDANCE_OPS: 'Vận hành chấm công',
  LEAVE_REVIEWER: 'Rà soát nghỉ phép',
  ATTENDANCE_APPROVER: 'Duyệt chấm công',
  MONTHLY_CLOSE_OWNER: 'Phụ trách khóa sổ tháng',
  PAYROLL_DRAFT_OPS: 'Vận hành nháp lương',
  PAYROLL_DRAFT_APPROVER: 'Duyệt nháp lương',
  VIEWER_AUDITOR: 'Audit / Chỉ đọc',
  STAFF_CONSOLE_USER: 'Nhân sự tự xem dữ liệu',
};

const legacyTemplateCodes = new Set<RoleTemplateCode>([
  'ADMIN_FULL',
  'TEAM_MANAGER',
  'COMMERCIAL_FINANCE',
  'TALENT_STAFF_SELF',
]);

const readTemplateDisplay = (templateCode?: RoleTemplateCode | null): string =>
  templateCode && !legacyTemplateCodes.has(templateCode)
    ? `${roleTemplateDisplayNames[templateCode] ?? templateCode} (${templateCode})`
    : '-';

export const RoleDetailPage = (): JSX.Element => {
  const { roleId } = useParams<{ roleId: string }>();
  const { t } = useTranslation(['role', 'common', 'errors']);

  const detailQuery = useRoleDetail(roleId);
  const permissionMatrixQuery = useRolePermissionMatrix(roleId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const updateMutation = useUpdateRoleMutation();
  const lifecycleMutation = useRoleLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();

  const [activeSurface, setActiveSurface] = useState<ActiveMutationSurface>(null);
  const { containerRef: mutationPanelRef } = useScrollToPanel(activeSurface);

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  useEffect(() => {
    setActiveSurface(null);
  }, [roleId]);

  const detailError = detailQuery.error as NormalizedApiError | null;
  const detailState = useMemo(() => {
    if (detailQuery.isPending) {
      return 'loading' as const;
    }

    if (detailQuery.isError) {
      if (detailError?.permissionDenied) {
        return 'denied' as const;
      }

      if (detailError?.notFound) {
        return 'not-found' as const;
      }

      return 'error' as const;
    }

    return 'ready' as const;
  }, [
    detailError?.notFound,
    detailError?.permissionDenied,
    detailQuery.isError,
    detailQuery.isPending,
  ]);

  const record = detailQuery.data;

  const onLifecycleAction = useCallback(
    async (action: RoleLifecycleAction) => {
      if (!record) {
        return;
      }

      if (action === 'activate') {
        const confirmed = await requestDestructiveConfirm({
          description: t('role:confirm.activate'),
        });
        if (!confirmed) {
          return;
        }

        try {
          await lifecycleMutation.mutateAsync({
            roleId: record.id,
            action,
          });
          notifySuccess('role:feedback.lifecycleUpdated');
        } catch (error) {
          notifyError(error as NormalizedApiError);
        }
        return;
      }

      setActiveSurface(action);
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const onUpdateSubmit = async (
    payload: Parameters<typeof updateMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await updateMutation.mutateAsync({ roleId: record.id, payload });
      notifySuccess('role:feedback.updated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onLifecycleReasonSubmit = async (
    action: 'deactivate' | 'archive',
    payload: Parameters<typeof lifecycleMutation.mutateAsync>[0]['payload'],
  ) => {
    if (!record) {
      return;
    }

    try {
      await lifecycleMutation.mutateAsync({ roleId: record.id, action, payload });
      notifySuccess('role:feedback.lifecycleUpdated');
      setActiveSurface(null);
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    return applyActionCapabilityHints(
      createRoleActionRailItems(t, record, {
        onEdit: () => setActiveSurface('edit'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.roleId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        edit: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_UPDATE },
          capabilityCopy,
        ),
        activate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_ACTIVATE },
          capabilityCopy,
        ),
        deactivate: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_DEACTIVATE },
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(
          {
            capabilities: capabilitiesQuery.data,
            isLoading: capabilitiesQuery.isLoading,
            isError: capabilitiesQuery.isError,
          },
          { permission: PERMISSIONS.ROLE_ARCHIVE },
          capabilityCopy,
        ),
      },
    );
  }, [
    capabilityCopy,
    capabilitiesQuery.data,
    capabilitiesQuery.isError,
    capabilitiesQuery.isLoading,
    lifecycleMutation.isPending,
    lifecycleMutation.variables,
    onLifecycleAction,
    record,
    t,
  ]);

  const matrix = permissionMatrixQuery.data;
  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.state}
            label={t(`role:states.${record.state}`)}
            toneByStatus={statusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.state === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('role:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('role:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'code',
                  label: t('role:fields.code'),
                  value: <ReferenceChip label={record.code} />,
                },
                {
                  key: 'name',
                  label: t('role:fields.name'),
                  value: record.name,
                },
                {
                  key: 'state',
                  label: t('role:fields.state'),
                  value: t(`role:states.${record.state}`),
                },
                {
                  key: 'description',
                  label: t('role:fields.description'),
                  value: record.description ?? '-',
                },
                {
                  key: 'delegationBand',
                  label: t('role:fields.delegationBand'),
                  value: t(`role:delegationBands.${record.delegationBand}`),
                },
                {
                  key: 'maxDelegatableBand',
                  label: t('role:fields.maxDelegatableBand'),
                  value: t(`role:maxDelegatableBands.${record.maxDelegatableBand}`),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <div className="space-y-4">
            <MetadataSection title={t('role:detail.policyTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'templateCode',
                    label: t('role:templates.basedOnTemplate'),
                    value: record.templateCode
                      ? readTemplateDisplay(record.templateCode)
                      : t('role:templates.custom'),
                    description: t('role:templates.permissionsRemainExplicit'),
                  },
                  {
                    key: 'templateVersion',
                    label: t('role:templates.templateVersion'),
                    value: record.templateVersion ?? '-',
                  },
                  {
                    key: 'templateAppliedAt',
                    label: t('role:templates.templateAppliedAt'),
                    value: formatOptionalTimestamp(record.templateAppliedAt),
                  },
                  {
                    key: 'permissions',
                    label: t('role:fields.permissions'),
                    value: formatPermissionCapabilitySummary(record.permissions, t),
                  },
                  {
                    key: 'assignmentRules',
                    label: t('role:fields.assignmentRules'),
                    value: String(record.assignmentRules.length),
                  },
                  {
                    key: 'createdAt',
                    label: t('role:fields.createdAt'),
                    value:
                      record.createdAt === null || record.createdAt === undefined
                        ? '-'
                        : formatCreatedDate(record.createdAt),
                  },
                  {
                    key: 'updatedAt',
                    label: t('role:fields.updatedAt'),
                    value: formatBusinessTimestamp(record.updatedAt),
                  },
                  {
                    key: 'activatedAt',
                    label: t('role:fields.activatedAt'),
                    value: formatOptionalTimestamp(record.activatedAt),
                  },
                  {
                    key: 'archivedAt',
                    label: t('role:fields.archivedAt'),
                    value: formatOptionalTimestamp(record.archivedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('role:detail.permissionMatrixTitle')}>
              {permissionMatrixQuery.isPending ? (
                <LoadingState lines={3} />
              ) : matrix ? (
                <ReadOnlyFieldGrid
                  fields={[
                    {
                      key: 'matrix-role-id',
                      label: t('role:fields.roleId'),
                      value: matrix.roleId,
                    },
                    {
                      key: 'matrix-role-code',
                      label: t('role:fields.code'),
                      value: matrix.roleCode,
                    },
                    {
                      key: 'matrix-state',
                      label: t('role:fields.state'),
                      value: t(`role:states.${matrix.roleState}`),
                    },
                    {
                      key: 'matrix-permissions',
                      label: t('role:fields.permissions'),
                      value: formatPermissionCapabilitySummary(matrix.permissions, t),
                    },
                  ]}
                  columns={2}
                />
              ) : (
                <p className="text-sm text-muted">
                  {t('role:statesView.permissionMatrixUnavailable')}
                </p>
              )}
            </MetadataSection>
          </div>
        ) : undefined
      }
      sections={
        record ? (
          <div ref={mutationPanelRef} className="space-y-4">
            <RoleBoundaryNotice />
            {activeSurface === 'edit' ? (
              <RoleEditSurface
                initialRecord={record}
                isPending={updateMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={onUpdateSubmit}
              />
            ) : null}
            {activeSurface === 'deactivate' ? (
              <RoleLifecycleReasonSurface
                action="deactivate"
                isPending={lifecycleMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={(payload) => onLifecycleReasonSubmit('deactivate', payload)}
              />
            ) : null}
            {activeSurface === 'archive' ? (
              <RoleLifecycleReasonSurface
                action="archive"
                isPending={lifecycleMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={(payload) => onLifecycleReasonSubmit('archive', payload)}
              />
            ) : null}
          </div>
        ) : undefined
      }
      actionRail={<ActionRail title={t('role:actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('role:statesView.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'role:statesView.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
