import { useEffect, useId, useMemo, useState } from 'react';
import {
  FormProvider,
  get,
  useForm,
  useFormContext,
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
import type {
  JsonPlainValue,
  RoleAssignmentRule,
  RoleAssignmentRuleReplacementPayload,
  RoleAssignmentScopeGrants,
  RoleAssignToUserPayload,
  RoleCreateFromTemplatePayload,
  RoleCreatePayload,
  RoleDelegationBand,
  RoleDetailRecord,
  RoleLifecyclePayload,
  RoleMaxDelegatableBand,
  RolePermissionReplacementPayload,
  RoleRevokeAssignmentPayload,
  RoleTemplateListItem,
  RoleTemplatePreview,
  RoleUpdatePayload,
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
  onSubmit: (payload: RoleCreatePayload) => Promise<void> | void;
  onTemplateSubmit: (payload: RoleCreateFromTemplatePayload) => Promise<void> | void;
  onPreviewTemplate: (templateCode: string) => Promise<RoleTemplatePreview>;
  templateCatalog: RoleTemplateListItem[];
  isTemplateCatalogLoading?: boolean;
};

type RoleEditSurfaceProps = BaseMutationSurfaceProps & {
  initialRecord: RoleDetailRecord;
  onSubmit: (payload: RoleUpdatePayload) => Promise<void> | void;
};

type RolePermissionsSurfaceProps = BaseMutationSurfaceProps & {
  initialPermissions: string[];
  onSubmit: (payload: RolePermissionReplacementPayload) => Promise<void> | void;
};

type RoleAssignmentRulesSurfaceProps = BaseMutationSurfaceProps & {
  initialRules: RoleAssignmentRule[];
  onSubmit: (payload: RoleAssignmentRuleReplacementPayload) => Promise<void> | void;
};

type RoleLifecycleReasonSurfaceProps = BaseMutationSurfaceProps & {
  action: 'deactivate' | 'archive';
  onSubmit: (payload: RoleLifecyclePayload) => Promise<void> | void;
};

type RoleAssignUserSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: RoleAssignToUserPayload) => Promise<void> | void;
  recommendedScopeGrants?: RoleAssignmentScopeGrants;
};

type RoleRevokeAssignmentSurfaceProps = BaseMutationSurfaceProps & {
  assignmentId: string;
  onSubmit: (payload: RoleRevokeAssignmentPayload) => Promise<void> | void;
};

type RoleCreateFormValues = {
  mode: 'template' | 'custom';
  templateCode: string;
  name: string;
  code: string;
  description: string;
  initialDelegationBand: RoleDelegationBand;
  initialMaxDelegatableBand: RoleMaxDelegatableBand;
  permissionsText: string;
  rulesJson: string;
};

type RoleEditFormValues = {
  name: string;
  description: string;
  delegationBand: RoleDelegationBand;
  maxDelegatableBand: RoleMaxDelegatableBand;
};

type RolePermissionsFormValues = {
  permissionsText: string;
};

type RoleAssignmentRulesFormValues = {
  rulesJson: string;
};

type RoleReasonFormValues = {
  reason: string;
};

type RoleAssignUserFormValues = {
  userId: string;
  reason: string;
  scopeGrants: {
    workSchedule: Record<WorkScheduleAssignmentScope, boolean>;
    eventAssignment: boolean;
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

const parsePermissionText = (text: string): string[] => {
  const values = text
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(values));
};

const templateCodeFallbackLabels: Record<string, string> = {
  ADMIN_FULL: 'Admin Full',
  HR_OPERATIONS: 'HR Operations',
  TEAM_MANAGER: 'Team Manager',
  PRODUCTION_OPS: 'Production Ops',
  COMMERCIAL_FINANCE: 'Commercial Finance',
  TALENT_STAFF_SELF: 'Talent/Staff Self',
  VIEWER_AUDITOR: 'Viewer/Auditor',
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
  if (values.eventAssignment) {
    scopeGrants.eventAssignment = ['global'];
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

const isPlainJsonObject = (value: unknown): value is Record<string, JsonPlainValue> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => {
    if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) {
      return true;
    }

    return isPlainJsonObject(item);
  });
};

const parseAssignmentRules = (text: string, errorMessage: string): RoleAssignmentRule[] => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(errorMessage);
  }

  return parsed.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(errorMessage);
    }

    const candidate = item as Record<string, unknown>;
    if (typeof candidate.code !== 'string' || candidate.code.trim().length === 0) {
      throw new Error(errorMessage);
    }

    if (
      candidate.conditions !== undefined &&
      candidate.conditions !== null &&
      !isPlainJsonObject(candidate.conditions)
    ) {
      throw new Error(errorMessage);
    }

    return {
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : undefined,
      code: candidate.code.trim(),
      description:
        typeof candidate.description === 'string'
          ? candidate.description
          : candidate.description === null
            ? null
            : undefined,
      state:
        typeof candidate.state === 'string'
          ? candidate.state
          : candidate.state === null
            ? null
            : undefined,
      conditions:
        candidate.conditions === null || candidate.conditions === undefined
          ? null
          : candidate.conditions,
    };
  });
};

const createRoleCreateSchema = (requiredMessage: string) =>
  z.object({
    mode: z.enum(['template', 'custom']),
    templateCode: z.string(),
    name: z.string().trim().min(1, requiredMessage),
    code: z.string().trim().optional(),
    description: z.string().trim().optional(),
    initialDelegationBand: z.enum(roleDelegationBandValues),
    initialMaxDelegatableBand: z.enum(roleMaxDelegatableBandValues),
    permissionsText: z.string(),
    rulesJson: z.string(),
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

const formatRulesJson = (rules: RoleAssignmentRule[]): string =>
  rules.length === 0 ? '' : JSON.stringify(rules, null, 2);

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
  onSubmit,
  onTemplateSubmit,
  onPreviewTemplate,
  templateCatalog,
  isTemplateCatalogLoading = false,
  isPending = false,
}: RoleCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const delegationBandOptions = useDelegationBandOptions();
  const maxDelegatableBandOptions = useMaxDelegatableBandOptions();
  const [templatePreview, setTemplatePreview] = useState<RoleTemplatePreview | null>(null);
  const [templatePreviewError, setTemplatePreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const form = useForm<RoleCreateFormValues>({
    defaultValues: {
      mode: 'template',
      templateCode: '',
      name: '',
      code: '',
      description: '',
      initialDelegationBand: 'LIMITED',
      initialMaxDelegatableBand: 'NONE',
      permissionsText: '',
      rulesJson: '',
    },
  });

  const schema = useMemo(() => createRoleCreateSchema(t('role:validation.required')), [t]);
  const mode = form.watch('mode');
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
    if (mode !== 'template' || !templateCode) {
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
  }, [mode, onPreviewTemplate, t, templateCode]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
      return;
    }

    if (parsed.data.mode === 'template') {
      if (!parsed.data.templateCode) {
        form.setError('templateCode', {
          type: 'validate',
          message: t('role:validation.required'),
        });
        return;
      }

      const code = toNullableText(parsed.data.code)?.toUpperCase();
      await onTemplateSubmit({
        templateCode: parsed.data.templateCode as RoleCreateFromTemplatePayload['templateCode'],
        name: parsed.data.name,
        ...(code ? { code } : {}),
        description: toNullableText(parsed.data.description),
      });
      return;
    }

    let initialAssignmentRules: RoleAssignmentRule[];
    try {
      initialAssignmentRules = parseAssignmentRules(
        parsed.data.rulesJson,
        t('role:validation.invalidRulesJson'),
      );
    } catch {
      form.setError('rulesJson', {
        type: 'validate',
        message: t('role:validation.invalidRulesJson'),
      });
      return;
    }

    const code = toNullableText(parsed.data.code)?.toUpperCase();
    await onSubmit({
      name: parsed.data.name,
      ...(code ? { code } : {}),
      description: toNullableText(parsed.data.description),
      initialPermissions: parsePermissionText(parsed.data.permissionsText),
      initialDelegationBand: parsed.data.initialDelegationBand,
      initialMaxDelegatableBand: parsed.data.initialMaxDelegatableBand,
      initialAssignmentRules,
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
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm">
            <input type="radio" value="template" {...form.register('mode')} />
            {t('role:templates.templateMode')}
          </label>
          <label className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm">
            <input type="radio" value="custom" {...form.register('mode')} />
            {t('role:templates.customMode')}
          </label>
        </div>
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
        {mode === 'template' ? (
          <div className="space-y-3">
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
          </div>
        ) : (
          <>
            <FormGrid columns={2}>
              <SelectField
                name="initialDelegationBand"
                label={t('role:fields.delegationBand')}
                options={delegationBandOptions}
              />
              <SelectField
                name="initialMaxDelegatableBand"
                label={t('role:fields.maxDelegatableBand')}
                options={maxDelegatableBandOptions}
              />
            </FormGrid>
            <RoleTextareaField
              name="permissionsText"
              label={t('role:fields.permissions')}
              placeholder={t('role:placeholders.permissions')}
            />
            <RoleTextareaField
              name="rulesJson"
              label={t('role:fields.assignmentRules')}
              placeholder={t('role:placeholders.assignmentRules')}
            />
          </>
        )}
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

  return (
    <div className="space-y-3 rounded border border-border bg-bg p-3">
      <div>
        <h4 className="text-sm font-semibold text-text">{t('templates.generatedPermissions')}</h4>
        <p className="text-xs text-muted">{t('templates.generatedPermissionsHelp')}</p>
        <div className="mt-2 max-h-44 overflow-auto rounded border border-border bg-panel p-2">
          <ul className="grid gap-1 text-xs md:grid-cols-2">
            {preview.permissions.map((permission) => (
              <li key={permission.code} className="font-mono text-text">
                {permission.code}
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

export const RolePermissionsSurface = ({
  initialPermissions,
  onCancel,
  onSubmit,
  isPending = false,
}: RolePermissionsSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const form = useForm<RolePermissionsFormValues>({
    defaultValues: {
      permissionsText: initialPermissions.join('\n'),
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      permissions: parsePermissionText(values.permissionsText),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('role:mutations.permissions.title')}
        subtitle={t('role:mutations.permissions.subtitle')}
        kind="action"
        submitLabel={t('role:mutations.permissions.submit')}
        pendingLabel={t('role:mutations.permissions.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <RoleTextareaField
          name="permissionsText"
          label={t('role:fields.permissions')}
          placeholder={t('role:placeholders.permissions')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const RoleAssignmentRulesSurface = ({
  initialRules,
  onCancel,
  onSubmit,
  isPending = false,
}: RoleAssignmentRulesSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const form = useForm<RoleAssignmentRulesFormValues>({
    defaultValues: {
      rulesJson: formatRulesJson(initialRules),
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    let rules: RoleAssignmentRule[];
    try {
      rules = parseAssignmentRules(values.rulesJson, t('role:validation.invalidRulesJson'));
    } catch {
      form.setError('rulesJson', {
        type: 'validate',
        message: t('role:validation.invalidRulesJson'),
      });
      return;
    }

    await onSubmit({ rules });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('role:mutations.assignmentRules.title')}
        subtitle={t('role:mutations.assignmentRules.subtitle')}
        kind="action"
        submitLabel={t('role:mutations.assignmentRules.submit')}
        pendingLabel={t('role:mutations.assignmentRules.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <RoleTextareaField
          name="rulesJson"
          label={t('role:fields.assignmentRules')}
          placeholder={t('role:placeholders.assignmentRules')}
        />
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
      scopeGrants: {
        workSchedule: {
          self: false,
          team: false,
          department: false,
          global: false,
        },
        eventAssignment: false,
        contractRegistry: false,
        talentKpi: false,
        kpi: {
          global: false,
          managedGroup: false,
          self: false,
        },
        revenueLedger: false,
        commission: false,
        dashboardLite: false,
      },
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
    form.setValue(
      'scopeGrants.workSchedule.self',
      Boolean(recommendedScopeGrants?.workSchedule?.includes('self')),
    );
    form.setValue(
      'scopeGrants.workSchedule.team',
      Boolean(recommendedScopeGrants?.workSchedule?.includes('team')),
    );
    form.setValue(
      'scopeGrants.workSchedule.department',
      Boolean(recommendedScopeGrants?.workSchedule?.includes('department')),
    );
    form.setValue(
      'scopeGrants.workSchedule.global',
      Boolean(recommendedScopeGrants?.workSchedule?.includes('global')),
    );
    form.setValue(
      'scopeGrants.eventAssignment',
      Boolean(recommendedScopeGrants?.eventAssignment?.includes('global')),
    );
    form.setValue(
      'scopeGrants.contractRegistry',
      Boolean(recommendedScopeGrants?.contractRegistry?.includes('global')),
    );
    form.setValue(
      'scopeGrants.talentKpi',
      Boolean(recommendedScopeGrants?.talentKpi?.includes('global')),
    );
    form.setValue(
      'scopeGrants.kpi.global',
      Boolean(recommendedScopeGrants?.kpi?.includes('global')),
    );
    form.setValue(
      'scopeGrants.kpi.managedGroup',
      Boolean(recommendedScopeGrants?.kpi?.includes('managedGroup')),
    );
    form.setValue('scopeGrants.kpi.self', Boolean(recommendedScopeGrants?.kpi?.includes('self')));
    form.setValue(
      'scopeGrants.revenueLedger',
      Boolean(recommendedScopeGrants?.revenueLedger?.includes('global')),
    );
    form.setValue(
      'scopeGrants.commission',
      Boolean(recommendedScopeGrants?.commission?.includes('global')),
    );
    form.setValue(
      'scopeGrants.dashboardLite',
      Boolean(recommendedScopeGrants?.dashboardLite?.includes('global')),
    );
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
            {[
              'eventAssignment',
              'contractRegistry',
              'talentKpi',
              'revenueLedger',
              'commission',
              'dashboardLite',
            ].map((module) => (
              <div key={module} className="rounded border border-border bg-panel p-3">
                <CheckboxField
                  name={`scopeGrants.${module}`}
                  label={`${scopeModuleLabels[module as keyof typeof scopeModuleLabels]}: ${t(
                    'role:scopePicker.scopes.global',
                  )}`}
                />
              </div>
            ))}
            <div className="space-y-2 rounded border border-border bg-panel p-3">
              <div className="text-xs font-medium uppercase text-muted">
                {scopeModuleLabels.kpi}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {kpiScopeValues.map((scope) => (
                  <CheckboxField
                    key={scope}
                    name={`scopeGrants.kpi.${scope}`}
                    label={`kpi.${scope}`}
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

type RoleTextareaFieldProps = {
  name: string;
  label: string;
  placeholder?: string;
};

const RoleTextareaField = ({ name, label, placeholder }: RoleTextareaFieldProps): JSX.Element => {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const form = useFormContextBridge();
  const fieldError = form.errorMessage(name);

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span id={labelId} className="text-xs font-medium uppercase text-muted">
        {label}
      </span>
      <textarea
        id={id}
        {...form.register(name)}
        placeholder={placeholder}
        rows={6}
        aria-labelledby={labelId}
        aria-describedby={fieldError ? errorId : undefined}
        aria-invalid={fieldError ? true : undefined}
        className="rounded border border-border bg-panel px-3 py-2 font-mono text-sm outline-none ring-accent focus:ring-2"
      />
      {fieldError ? (
        <span id={errorId} className="text-xs font-medium text-danger">
          {fieldError}
        </span>
      ) : null}
    </label>
  );
};

const useFormContextBridge = () => {
  const { register, formState } = useFormContext<FieldValues>();

  return {
    register,
    errorMessage: (name: string) => get(formState.errors, name)?.message as string | undefined,
  };
};
