import { useId, useMemo } from 'react';
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
  RoleAssignToUserPayload,
  RoleCreatePayload,
  RoleDelegationBand,
  RoleDetailRecord,
  RoleLifecyclePayload,
  RoleMaxDelegatableBand,
  RolePermissionReplacementPayload,
  RoleRevokeAssignmentPayload,
  RoleUpdatePayload,
} from '@modules/role/types/role.types';
import { FormGrid, SelectField, TextInputField } from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type RoleCreateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: RoleCreatePayload) => Promise<void> | void;
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
};

type RoleRevokeAssignmentSurfaceProps = BaseMutationSurfaceProps & {
  assignmentId: string;
  onSubmit: (payload: RoleRevokeAssignmentPayload) => Promise<void> | void;
};

type RoleCreateFormValues = {
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
    name: z.string().trim().min(1, requiredMessage),
    code: z.string().trim().min(1, requiredMessage),
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

export const RoleCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: RoleCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const delegationBandOptions = useDelegationBandOptions();
  const maxDelegatableBandOptions = useMaxDelegatableBandOptions();
  const form = useForm<RoleCreateFormValues>({
    defaultValues: {
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

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
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

    await onSubmit({
      name: parsed.data.name,
      code: parsed.data.code.toUpperCase(),
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
        <FormGrid columns={2}>
          <TextInputField name="name" label={t('role:fields.name')} />
          <TextInputField name="code" label={t('role:fields.code')} />
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
        <TextInputField name="description" label={t('role:fields.description')} />
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
      </ModuleMutationSurface>
    </FormProvider>
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
  isPending = false,
}: RoleAssignUserSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['role', 'common']);
  const form = useForm<RoleAssignUserFormValues>({
    defaultValues: {
      userId: '',
      reason: '',
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

    await onSubmit({
      userId,
      reason: toNullableText(values.reason),
    });
  });

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
          <TextInputField name="userId" label={t('role:fields.userId')} />
          <TextInputField name="reason" label={t('role:fields.reason')} />
        </FormGrid>
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
