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
  RoleAssignmentScopeGrants,
  RoleAssignToUserPayload,
  RoleCreateFromTemplatePayload,
  RoleDelegationBand,
  RoleDetailRecord,
  RoleLifecyclePayload,
  RoleMaxDelegatableBand,
  RoleRevokeAssignmentPayload,
  RoleTemplateListItem,
  RoleTemplatePreview,
  RoleUpdatePayload,
  EventAssignmentScope,
  WorkScheduleAssignmentScope,
  KpiAssignmentScope,
} from '@modules/role/types/role.types';
import { loadUserReferenceOptions } from '@shared/components/reference/admin-reference-options';
import {
  CheckboxField,
  FormGrid,
  GeneratedCodeNotice,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';
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

type RoleAssignUserSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: RoleAssignToUserPayload) => Promise<void> | void;
  recommendedScopeGrants?: RoleAssignmentScopeGrants;
  roleCode: string;
  templateCode?: string | null;
};

type RoleRevokeAssignmentSurfaceProps = BaseMutationSurfaceProps & {
  assignmentId: string;
  onSubmit: (payload: RoleRevokeAssignmentPayload) => Promise<void> | void;
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

type RoleAssignUserFormValues = {
  userId: string;
  reason: string;
  scopeGrants: {
    workSchedule: Record<WorkScheduleAssignmentScope, boolean>;
    eventAssignment: Record<EventAssignmentScope, boolean>;
    contractRegistry: boolean;
    talentKpi: boolean;
    kpi: Record<KpiAssignmentScope, boolean>;
    revenueLedger: boolean;
    commission: boolean;
    dashboardLite: boolean;
  };
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
  OWNER_ADMIN: 'Owner Admin',
  ACCESS_ADMIN: 'Access Admin',
  HR_OPERATIONS: 'HR Operations',
  HR_TERMS_APPROVER: 'HR Terms Approver',
  PRODUCTION_OPS: 'Production Ops',
  PLATFORM_CHANNEL_OPS: 'Platform Channel Ops',
  CREATIVE_VISUAL_LEAD: 'Creative Visual Lead',
  CONTENT_OPS: 'Content Ops',
  TALENT_GROUP_MANAGER: 'Talent Group Manager',
  ORG_UNIT_MANAGER: 'Org Unit Manager',
  KPI_OPERATIONS: 'KPI Operations',
  COMMERCIAL_CONTRACT_OPS: 'Commercial Contract Ops',
  REVENUE_FINANCE_OPS: 'Revenue Finance Ops',
  REVENUE_APPROVER: 'Revenue Approver',
  REVENUE_RECONCILER: 'Revenue Reconciler',
  COMMISSION_OPS: 'Commission Ops',
  COMMISSION_APPROVER: 'Commission Approver',
  ATTENDANCE_OPS: 'Attendance Ops',
  LEAVE_REVIEWER: 'Leave Reviewer',
  ATTENDANCE_APPROVER: 'Attendance Approver',
  MONTHLY_CLOSE_OWNER: 'Monthly Close Owner',
  PAYROLL_DRAFT_OPS: 'Payroll Draft Ops',
  PAYROLL_DRAFT_APPROVER: 'Payroll Draft Approver',
  VIEWER_AUDITOR: 'Viewer Auditor',
  STAFF_CONSOLE_USER: 'Staff Console User',
};

const scopeModuleLabels = {
  workSchedule: 'Work Schedule',
  eventAssignment: 'Event Assignment',
  contractRegistry: 'Contract Registry',
  talentKpi: 'Talent KPI',
  kpi: 'KPI',
  revenueLedger: 'Revenue Ledger',
  commission: 'Commission',
  dashboardLite: 'Dashboard Lite',
} as const;

const workScheduleScopeValues: WorkScheduleAssignmentScope[] = [
  'self',
  'team',
  'department',
  'global',
];
const eventAssignmentScopeValues: EventAssignmentScope[] = ['managedGroup', 'global'];
const kpiScopeValues: KpiAssignmentScope[] = ['global', 'managedGroup', 'self'];

const toTitle = (value: string): string => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const readTemplateLabel = (template: Pick<RoleTemplateListItem, 'code' | 'name'>): string =>
  template.name || templateCodeFallbackLabels[template.code] || template.code;

const buildScopeGrants = (
  values: RoleAssignUserFormValues['scopeGrants'],
): RoleAssignmentScopeGrants | undefined => {
  const scopeGrants: RoleAssignmentScopeGrants = {};

  const selectedWorkSchedule = workScheduleScopeValues.filter(
    (scope) => values.workSchedule[scope],
  );
  if (selectedWorkSchedule.length > 0) {
    scopeGrants.workSchedule = selectedWorkSchedule;
  }
  const selectedEventAssignment = eventAssignmentScopeValues.filter(
    (scope) => values.eventAssignment[scope],
  );
  if (selectedEventAssignment.length > 0) {
    scopeGrants.eventAssignment = selectedEventAssignment;
  }
  if (values.contractRegistry) {
    scopeGrants.contractRegistry = ['global'];
  }
  if (values.talentKpi) {
    scopeGrants.talentKpi = ['global'];
  }
  const selectedKpi = kpiScopeValues.filter((scope) => values.kpi[scope]);
  if (selectedKpi.length > 0) {
    scopeGrants.kpi = selectedKpi;
  }
  if (values.revenueLedger) {
    scopeGrants.revenueLedger = ['global'];
  }
  if (values.commission) {
    scopeGrants.commission = ['global'];
  }
  if (values.dashboardLite) {
    scopeGrants.dashboardLite = ['global'];
  }

  return Object.keys(scopeGrants).length > 0 ? scopeGrants : undefined;
};

const createScopeGrantFormValues = (
  recommendedScopeGrants?: RoleAssignmentScopeGrants,
): RoleAssignUserFormValues['scopeGrants'] => ({
  workSchedule: {
    self: Boolean(recommendedScopeGrants?.workSchedule?.includes('self')),
    team: Boolean(recommendedScopeGrants?.workSchedule?.includes('team')),
    department: Boolean(recommendedScopeGrants?.workSchedule?.includes('department')),
    global: Boolean(recommendedScopeGrants?.workSchedule?.includes('global')),
  },
  eventAssignment: {
    managedGroup: Boolean(recommendedScopeGrants?.eventAssignment?.includes('managedGroup')),
    global: Boolean(recommendedScopeGrants?.eventAssignment?.includes('global')),
  },
  contractRegistry: Boolean(recommendedScopeGrants?.contractRegistry?.includes('global')),
  talentKpi: Boolean(recommendedScopeGrants?.talentKpi?.includes('global')),
  kpi: {
    global: Boolean(recommendedScopeGrants?.kpi?.includes('global')),
    managedGroup: Boolean(recommendedScopeGrants?.kpi?.includes('managedGroup')),
    self: Boolean(recommendedScopeGrants?.kpi?.includes('self')),
  },
  revenueLedger: Boolean(recommendedScopeGrants?.revenueLedger?.includes('global')),
  commission: Boolean(recommendedScopeGrants?.commission?.includes('global')),
  dashboardLite: Boolean(recommendedScopeGrants?.dashboardLite?.includes('global')),
});

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

const formatRecommendedScopeGrants = (scopeGrants?: RoleAssignmentScopeGrants): string => {
  if (!scopeGrants || Object.keys(scopeGrants).length === 0) {
    return '-';
  }

  return Object.entries(scopeGrants)
    .flatMap(([module, scopes]) =>
      scopes && scopes.length > 0
        ? [
            `${scopeModuleLabels[module as keyof typeof scopeModuleLabels] ?? module}: ${scopes
              .map((scope) => (module === 'kpi' ? `kpi.${scope}` : scope))
              .join(', ')}`,
          ]
        : [],
    )
    .join('; ');
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

export const RoleAssignUserSurface = ({
  onCancel,
  onSubmit,
  recommendedScopeGrants,
  isPending = false,
}: RoleAssignUserSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const form = useForm<RoleAssignUserFormValues>({
    defaultValues: {
      userId: '',
      reason: '',
      scopeGrants: createScopeGrantFormValues(recommendedScopeGrants),
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const userId = values.userId.trim();
    if (!userId) {
      form.setError('userId', {
        type: 'validate',
        message: t('role:validation.required'),
      });
      return;
    }

    const scopeGrants = buildScopeGrants(values.scopeGrants);

    await onSubmit({
      userId,
      reason: toNullableText(values.reason),
      ...(scopeGrants ? { scopeGrants } : {}),
    });
  });

  const applyRecommendedScopeGrants = (): void => {
    const nextScopeGrants = createScopeGrantFormValues(recommendedScopeGrants);

    workScheduleScopeValues.forEach((scope) => {
      form.setValue(`scopeGrants.workSchedule.${scope}`, nextScopeGrants.workSchedule[scope]);
    });
    eventAssignmentScopeValues.forEach((scope) => {
      form.setValue(`scopeGrants.eventAssignment.${scope}`, nextScopeGrants.eventAssignment[scope]);
    });
    form.setValue('scopeGrants.contractRegistry', nextScopeGrants.contractRegistry);
    form.setValue('scopeGrants.talentKpi', nextScopeGrants.talentKpi);
    kpiScopeValues.forEach((scope) => {
      form.setValue(`scopeGrants.kpi.${scope}`, nextScopeGrants.kpi[scope]);
    });
    form.setValue('scopeGrants.revenueLedger', nextScopeGrants.revenueLedger);
    form.setValue('scopeGrants.commission', nextScopeGrants.commission);
    form.setValue('scopeGrants.dashboardLite', nextScopeGrants.dashboardLite);
  };

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('role:mutations.assignToUser.title')}
        subtitle={t('role:mutations.assignToUser.subtitle')}
        kind="action"
        submitLabel={t('role:mutations.assignToUser.submit')}
        pendingLabel={t('role:mutations.assignToUser.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <ReferencePickerField
            name="userId"
            label={t('role:fields.userId')}
            pickerId="role-assignment-user"
            loadOptions={loadUserReferenceOptions}
            helperText={t('role:referenceHelp.userId')}
            placeholder={t('role:placeholders.userSearch')}
          />
          <TextInputField name="reason" label={t('role:fields.reason')} />
        </FormGrid>
        <div className="space-y-3 rounded border border-border bg-bg p-3">
          <div>
            <h4 className="text-sm font-semibold text-text">
              {t('role:scopePicker.assignmentScopes')}
            </h4>
            <p className="text-xs text-muted">{t('role:scopePicker.backendValidation')}</p>
          </div>
          <div className="rounded border border-border bg-panel p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 className="font-semibold text-text">
                  {t('role:scopePicker.recommendedScopes')}
                </h5>
                <p className="text-xs text-muted">{t('role:scopePicker.recommendedScopesHelp')}</p>
              </div>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={applyRecommendedScopeGrants}
              >
                {t('role:scopePicker.applyRecommendedScopes')}
              </button>
            </div>
            <p className="mt-2 font-mono text-xs text-text">
              {formatRecommendedScopeGrants(recommendedScopeGrants)}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded border border-border bg-panel p-3">
              <div className="text-xs font-medium uppercase text-muted">
                {scopeModuleLabels.workSchedule}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {workScheduleScopeValues.map((scope) => (
                  <CheckboxField
                    key={scope}
                    name={`scopeGrants.workSchedule.${scope}`}
                    label={t(`role:scopePicker.scopes.${scope}`)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2 rounded border border-border bg-panel p-3">
              <div className="text-xs font-medium uppercase text-muted">
                {scopeModuleLabels.eventAssignment}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {eventAssignmentScopeValues.map((scope) => (
                  <CheckboxField
                    key={scope}
                    name={`scopeGrants.eventAssignment.${scope}`}
                    label={`${scopeModuleLabels.eventAssignment}: ${t(
                      `role:scopePicker.scopes.${scope}`,
                    )}`}
                  />
                ))}
              </div>
            </div>
            {['contractRegistry', 'talentKpi', 'revenueLedger', 'commission', 'dashboardLite'].map(
              (module) => (
                <div key={module} className="rounded border border-border bg-panel p-3">
                  <CheckboxField
                    name={`scopeGrants.${module}`}
                    label={`${scopeModuleLabels[module as keyof typeof scopeModuleLabels]}: ${t(
                      'role:scopePicker.scopes.global',
                    )}`}
                  />
                </div>
              ),
            )}
            <div className="space-y-2 rounded border border-border bg-panel p-3">
              <div className="text-xs font-medium uppercase text-muted">
                {scopeModuleLabels.kpi}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {kpiScopeValues.map((scope) => (
                  <CheckboxField
                    key={scope}
                    name={`scopeGrants.kpi.${scope}`}
                    label={`${scopeModuleLabels.kpi}: ${t(`role:scopePicker.scopes.${scope}`)}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const RoleRevokeAssignmentSurface = ({
  assignmentId,
  onCancel,
  onSubmit,
  isPending = false,
}: RoleRevokeAssignmentSurfaceProps): JSX.Element => {
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
        title={t('role:mutations.revokeAssignment.title')}
        subtitle={t('role:mutations.revokeAssignment.subtitle', { assignmentId })}
        kind="action"
        submitLabel={t('role:mutations.revokeAssignment.submit')}
        pendingLabel={t('role:mutations.revokeAssignment.pending')}
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
