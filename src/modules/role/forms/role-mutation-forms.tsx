import { useEffect, useMemo, useState } from 'react';
import {
  FormProvider,
  useForm,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  roleDelegationBandValues,
  roleMaxDelegatableBandValues,
} from '@modules/role/constants/role.constants';
import { formatPermissionCapabilityItems } from '@modules/role/utils/permission-labels';
import type {
  RoleCreateFromTemplatePayload,
  RoleDelegationBand,
  RoleDetailRecord,
  RoleLifecyclePayload,
  RoleMaxDelegatableBand,
  RoleTemplateListItem,
  RoleTemplatePreview,
  RoleUpdatePayload,
} from '@modules/role/types/role.types';
import { FormGrid, GeneratedCodeNotice, SelectField, TextInputField } from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type RoleCreateSurfaceProps = BaseMutationSurfaceProps & {
  onTemplateSubmit: (payload: RoleCreateFromTemplatePayload) => Promise<void> | void;
  onPreviewTemplate: (templateCode: string) => Promise<RoleTemplatePreview>;
  templateCatalog: RoleTemplateListItem[];
  isTemplateCatalogLoading?: boolean;
};

type RoleEditSurfaceProps = BaseMutationSurfaceProps & {
  initialRecord: RoleDetailRecord;
  onSubmit: (payload: RoleUpdatePayload) => Promise<void> | void;
};

type RoleLifecycleReasonSurfaceProps = BaseMutationSurfaceProps & {
  action: 'deactivate' | 'archive';
  onSubmit: (payload: RoleLifecyclePayload) => Promise<void> | void;
};

type RoleCreateFormValues = {
  templateCode: string;
  name: string;
  code: string;
  description: string;
};

type RoleEditFormValues = {
  name: string;
  description: string;
  delegationBand: RoleDelegationBand;
  maxDelegatableBand: RoleMaxDelegatableBand;
};

type RoleReasonFormValues = {
  reason: string;
};

const toNullableText = (value?: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const applySchemaErrors = <TValues extends FieldValues>(
  setError: UseFormSetError<TValues>,
  error: z.ZodError,
  fallbackField: Path<TValues>,
): void => {
  error.issues.forEach((issue) => {
    const field = (issue.path[0] as Path<TValues>) ?? fallbackField;
    setError(field, {
      type: 'validate',
      message: issue.message,
    });
  });
};

const templateCodeFallbackLabels: Record<string, string> = {
  OWNER_ADMIN: 'Quản trị chủ sở hữu',
  ACCESS_ADMIN: 'Quản trị quyền truy cập',
  HR_OPERATIONS: 'Vận hành HR',
  HR_TERMS_APPROVER: 'Duyệt điều khoản nhân sự',
  PRODUCTION_OPS: 'Vận hành sản xuất',
  PLATFORM_CHANNEL_OPS: 'Vận hành kênh nền tảng',
  CREATIVE_VISUAL_LEAD: 'Phụ trách hình ảnh sáng tạo',
  CONTENT_OPS: 'Vận hành nội dung',
  TALENT_GROUP_MANAGER: 'Quản lý nhóm nhân sự',
  ORG_UNIT_MANAGER: 'Quản lý đơn vị tổ chức',
  KPI_OPERATIONS: 'Vận hành KPI',
  COMMERCIAL_CONTRACT_OPS: 'Vận hành hợp đồng thương mại',
  REVENUE_FINANCE_OPS: 'Vận hành doanh thu',
  REVENUE_APPROVER: 'Duyệt doanh thu',
  REVENUE_RECONCILER: 'Đối soát doanh thu',
  COMMISSION_OPS: 'Vận hành hoa hồng',
  COMMISSION_APPROVER: 'Duyệt hoa hồng',
  ATTENDANCE_OPS: 'Vận hành chấm công',
  LEAVE_REVIEWER: 'Duyệt nghỉ phép',
  ATTENDANCE_APPROVER: 'Duyệt chấm công',
  MONTHLY_CLOSE_OWNER: 'Phụ trách chốt tháng',
  PAYROLL_DRAFT_OPS: 'Lập nháp bảng lương',
  PAYROLL_DRAFT_APPROVER: 'Duyệt nháp bảng lương',
  VIEWER_AUDITOR: 'Audit / Chỉ đọc',
  STAFF_CONSOLE_USER: 'Nhân sự tự xem dữ liệu',
};

const toTitle = (value: string): string => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const readTemplateLabel = (template: Pick<RoleTemplateListItem, 'code' | 'name'>): string =>
  template.name || templateCodeFallbackLabels[template.code] || 'Quyền truy cập cần rà soát';

const createRoleCreateSchema = (requiredMessage: string) =>
  z.object({
    templateCode: z.string().trim().min(1, requiredMessage),
    name: z.string().trim().min(1, requiredMessage),
    code: z.string().trim().optional(),
    description: z.string().trim().optional(),
  });

const createRoleEditSchema = (requiredMessage: string) =>
  z.object({
    name: z.string().trim().min(1, requiredMessage),
    description: z.string().trim().optional(),
    delegationBand: z.enum(roleDelegationBandValues),
    maxDelegatableBand: z.enum(roleMaxDelegatableBandValues),
  });

const useDelegationBandOptions = () => {
  const { t } = useTranslation('role');
  return useMemo(
    () =>
      roleDelegationBandValues.map((value) => ({
        value,
        label: t(`role:delegationBands.${value}`),
      })),
    [t],
  );
};

const useMaxDelegatableBandOptions = () => {
  const { t } = useTranslation('role');
  return useMemo(
    () =>
      roleMaxDelegatableBandValues.map((value) => ({
        value,
        label: t(`role:maxDelegatableBands.${value}`),
      })),
    [t],
  );
};

export const RoleCreateSurface = ({
  onCancel,
  onTemplateSubmit,
  onPreviewTemplate,
  templateCatalog,
  isTemplateCatalogLoading = false,
  isPending = false,
}: RoleCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const [templatePreview, setTemplatePreview] = useState<RoleTemplatePreview | null>(null);
  const [templatePreviewError, setTemplatePreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const form = useForm<RoleCreateFormValues>({
    defaultValues: {
      templateCode: '',
      name: '',
      code: '',
      description: '',
    },
  });

  const schema = useMemo(() => createRoleCreateSchema(t('role:validation.required')), [t]);
  const templateCode = form.watch('templateCode');

  const templateOptions = useMemo(
    () =>
      templateCatalog.map((template) => ({
        value: template.code,
        label: readTemplateLabel(template),
      })),
    [templateCatalog],
  );

  useEffect(() => {
    if (!templateCode) {
      setTemplatePreview(null);
      setTemplatePreviewError(null);
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setTemplatePreviewError(null);

    onPreviewTemplate(templateCode)
      .then((preview) => {
        if (cancelled) {
          return;
        }
        setTemplatePreview(preview);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setTemplatePreview(null);
        setTemplatePreviewError(
          error instanceof Error ? error.message : t('role:templates.previewError'),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onPreviewTemplate, t, templateCode]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
      return;
    }

    const code = toNullableText(parsed.data.code)?.toUpperCase();
    await onTemplateSubmit({
      templateCode: parsed.data.templateCode as RoleCreateFromTemplatePayload['templateCode'],
      name: parsed.data.name,
      ...(code ? { code } : {}),
      description: toNullableText(parsed.data.description),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('role:mutations.create.title')}
        subtitle={t('role:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('role:mutations.create.submit')}
        pendingLabel={t('role:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <SelectField
          name="templateCode"
          label={t('role:templates.roleTemplate')}
          options={templateOptions}
          placeholder={
            isTemplateCatalogLoading
              ? t('role:templates.loading')
              : t('role:templates.chooseTemplate')
          }
          helperText={t('role:templates.backendAuthority')}
        />
        <RoleTemplatePreviewPanel
          preview={templatePreview}
          isLoading={isPreviewLoading}
          errorMessage={templatePreviewError}
        />
        <FormGrid columns={2}>
          <TextInputField
            name="name"
            label={t('role:fields.name')}
            helperText={t('role:help.name')}
          />
          <TextInputField
            name="code"
            label={t('role:fields.codeOptional')}
            helperText={t('role:help.codeOptional')}
          />
        </FormGrid>
        <GeneratedCodeNotice
          label={t('role:generatedCode.label')}
          description={t('role:generatedCode.description')}
        />
        <TextInputField name="description" label={t('role:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

const RoleTemplatePreviewPanel = ({
  preview,
  isLoading,
  errorMessage,
}: {
  preview: RoleTemplatePreview | null;
  isLoading: boolean;
  errorMessage: string | null;
}): JSX.Element => {
  const { t } = useTranslation('role');

  if (isLoading) {
    return (
      <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
        {t('templates.loadingPreview')}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded border border-danger bg-bg px-3 py-2 text-sm text-danger">
        {errorMessage}
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
        {t('templates.previewEmpty')}
      </div>
    );
  }

  const permissionCapabilityItems = formatPermissionCapabilityItems(preview.permissions, t);

  return (
    <div className="space-y-3 rounded border border-border bg-bg p-3">
      <div>
        <h4 className="text-sm font-semibold text-text">{t('templates.generatedPermissions')}</h4>
        <p className="text-xs text-muted">{t('templates.generatedPermissionsHelp')}</p>
        <div className="mt-2 max-h-44 overflow-auto rounded border border-border bg-panel p-2">
          <ul className="grid gap-1 text-xs md:grid-cols-2">
            {permissionCapabilityItems.map((item) => (
              <li key={item} className="text-text">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-text">{t('templates.warnings')}</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-text">{t('templates.scopePlan')}</h4>
        <p className="text-xs text-muted">{t('templates.scopePlanHelp')}</p>
        <ul className="mt-2 space-y-1 text-xs">
          {preview.scopePlan.map((entry) => (
            <li key={`${entry.module}-${entry.scopes.join('-')}`} className="text-text">
              <span className="font-medium">{entry.module}:</span>{' '}
              {entry.scopes.map(toTitle).join(', ')} - {entry.status} - {entry.note}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-text">{t('templates.implementationNotes')}</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
          {preview.template.implementationNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const RoleEditSurface = ({
  initialRecord,
  onCancel,
  onSubmit,
  isPending = false,
}: RoleEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const delegationBandOptions = useDelegationBandOptions();
  const maxDelegatableBandOptions = useMaxDelegatableBandOptions();
  const form = useForm<RoleEditFormValues>({
    defaultValues: {
      name: initialRecord.name,
      description: initialRecord.description ?? '',
      delegationBand: initialRecord.delegationBand,
      maxDelegatableBand: initialRecord.maxDelegatableBand,
    },
  });

  const schema = useMemo(() => createRoleEditSchema(t('role:validation.required')), [t]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
      return;
    }

    await onSubmit({
      name: parsed.data.name,
      description: toNullableText(parsed.data.description),
      delegationBand: parsed.data.delegationBand,
      maxDelegatableBand: parsed.data.maxDelegatableBand,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('role:mutations.update.title')}
        subtitle={t('role:mutations.update.subtitle')}
        kind="edit"
        submitLabel={t('role:mutations.update.submit')}
        pendingLabel={t('role:mutations.update.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="name" label={t('role:fields.name')} />
          <SelectField
            name="delegationBand"
            label={t('role:fields.delegationBand')}
            options={delegationBandOptions}
          />
          <SelectField
            name="maxDelegatableBand"
            label={t('role:fields.maxDelegatableBand')}
            options={maxDelegatableBandOptions}
          />
        </FormGrid>
        <TextInputField name="description" label={t('role:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const RoleLifecycleReasonSurface = ({
  action,
  onCancel,
  onSubmit,
  isPending = false,
}: RoleLifecycleReasonSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const form = useForm<RoleReasonFormValues>({
    defaultValues: {
      reason: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      reason: toNullableText(values.reason),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t(`role:mutations.${action}.title`)}
        subtitle={t(`role:mutations.${action}.subtitle`)}
        kind="action"
        submitLabel={t(`role:mutations.${action}.submit`)}
        pendingLabel={t(`role:mutations.${action}.pending`)}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField name="reason" label={t('role:fields.reason')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
