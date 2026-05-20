import { useMemo } from 'react';
import {
  FormProvider,
  useForm,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type {
  OrgUnitCreatePayload,
  OrgUnitMovePayload,
  OrgUnitUpdatePayload,
} from '@modules/org-unit/types/org-unit.types';
import { loadOrgUnitReferenceOptions } from '@shared/components/reference/admin-reference-options';
import { ModuleMutationSurface } from '@shared/modules';
import {
  FormGrid,
  GeneratedCodeNotice,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type OrgUnitCreateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: OrgUnitCreatePayload) => Promise<void> | void;
};

type OrgUnitEditSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: {
    name: string;
    displayOrder: number;
    description?: string | null;
    externalRef?: string | null;
  };
  onSubmit: (payload: OrgUnitUpdatePayload) => Promise<void> | void;
};

type OrgUnitMoveSurfaceProps = BaseMutationSurfaceProps & {
  currentOrgUnitId: string;
  currentParentOrgUnitId?: string | null;
  onSubmit: (payload: OrgUnitMovePayload) => Promise<void> | void;
};

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const toOptionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const orgUnitTypeValues = ['DEPARTMENT', 'TEAM', 'BUSINESS_UNIT', 'SUPPORT_UNIT'] as const;

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

const createOrgUnitCreateFormSchema = (requiredMessage: string, numberMessage: string) => {
  return z.object({
    name: z.string().trim().min(1, requiredMessage),
    type: z.enum(orgUnitTypeValues, { required_error: requiredMessage }),
    displayOrder: z.coerce.number().int(numberMessage).min(0, numberMessage),
    parentOrgUnitId: z.string().trim().optional(),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
  });
};

const createOrgUnitEditFormSchema = (requiredMessage: string, numberMessage: string) => {
  return z.object({
    name: z.string().trim().min(1, requiredMessage),
    displayOrder: z.coerce.number().int(numberMessage).min(0, numberMessage),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
  });
};

const createOrgUnitMoveFormSchema = (
  tokenMessage: string,
  duplicateMoveMessage: string,
  currentOrgUnitId: string,
) => {
  return z
    .object({
      newParentOrgUnitId: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]+$/, tokenMessage)
        .optional()
        .or(z.literal('')),
    })
    .superRefine((value, context) => {
      const normalizedParentId = toOptionalText(value.newParentOrgUnitId);
      if (normalizedParentId && normalizedParentId === currentOrgUnitId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: duplicateMoveMessage,
          path: ['newParentOrgUnitId'],
        });
      }
    });
};

type OrgUnitCreateFormValues = {
  name: string;
  type: string;
  displayOrder: string;
  parentOrgUnitId: string;
  description: string;
  externalRef: string;
};

export const OrgUnitCreateSurface = ({
  onSubmit,
  onCancel,
  isPending = false,
}: OrgUnitCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['org-unit', 'common']);
  const form = useForm<OrgUnitCreateFormValues>({
    defaultValues: {
      name: '',
      type: '',
      displayOrder: '0',
      parentOrgUnitId: '',
      description: '',
      externalRef: '',
    },
  });

  const schema = useMemo(
    () =>
      createOrgUnitCreateFormSchema(
        t('org-unit:validation.required'),
        t('org-unit:validation.invalidDisplayOrder'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
      return;
    }

    await onSubmit({
      name: parsed.data.name,
      type: parsed.data.type,
      displayOrder: parsed.data.displayOrder,
      parentOrgUnitId: toOptionalText(parsed.data.parentOrgUnitId),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('org-unit:mutations.create.title')}
        subtitle={t('org-unit:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('org-unit:mutations.create.submit')}
        pendingLabel={t('org-unit:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onSubmit={(event) => void handleSubmit(event)}
        onCancel={onCancel}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('org-unit:generatedCode.label')}
            description={t('org-unit:generatedCode.description')}
            className="md:col-span-2"
          />
          <TextInputField name="name" label={t('org-unit:fields.name')} />
          <SelectField
            name="type"
            label={t('org-unit:fields.type')}
            placeholder={t('org-unit:placeholders.selectType')}
            options={orgUnitTypeValues.map((value) => ({
              value,
              label: t(`org-unit:types.${value}`),
            }))}
          />
          <TextInputField
            name="displayOrder"
            label={t('org-unit:fields.displayOrder')}
            type="number"
            helperText={t('org-unit:help.displayOrder')}
          />
          <TextInputField
            name="externalRef"
            label={t('org-unit:fields.externalRef')}
            placeholder={t('org-unit:placeholders.optional')}
          />
          <ReferencePickerField
            name="parentOrgUnitId"
            label={t('org-unit:fields.parentOrgUnitId')}
            pickerId="org-unit-parent"
            loadOptions={loadOrgUnitReferenceOptions}
            helperText={t('org-unit:referenceHelp.parentOrgUnitId')}
            placeholder={t('org-unit:placeholders.parentOrgUnitSearch')}
            clearable
            clearLabel={t('org-unit:actions.clearParent')}
          />
        </FormGrid>
        <TextInputField
          name="description"
          label={t('org-unit:fields.description')}
          placeholder={t('org-unit:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type OrgUnitEditFormValues = {
  name: string;
  displayOrder: string;
  description: string;
  externalRef: string;
};

export const OrgUnitEditSurface = ({
  initialValues,
  onSubmit,
  onCancel,
  isPending = false,
}: OrgUnitEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['org-unit', 'common']);
  const form = useForm<OrgUnitEditFormValues>({
    defaultValues: {
      name: initialValues.name,
      displayOrder: String(initialValues.displayOrder),
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });

  const schema = useMemo(
    () =>
      createOrgUnitEditFormSchema(
        t('org-unit:validation.required'),
        t('org-unit:validation.invalidDisplayOrder'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
      return;
    }

    await onSubmit({
      name: parsed.data.name,
      displayOrder: parsed.data.displayOrder,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('org-unit:mutations.edit.title')}
        subtitle={t('org-unit:mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('org-unit:mutations.edit.submit')}
        pendingLabel={t('org-unit:mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onSubmit={(event) => void handleSubmit(event)}
        onCancel={onCancel}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="name" label={t('org-unit:fields.name')} />
          <TextInputField
            name="displayOrder"
            label={t('org-unit:fields.displayOrder')}
            type="number"
            helperText={t('org-unit:help.displayOrder')}
          />
          <TextInputField
            name="externalRef"
            label={t('org-unit:fields.externalRef')}
            placeholder={t('org-unit:placeholders.optional')}
          />
        </FormGrid>
        <TextInputField
          name="description"
          label={t('org-unit:fields.description')}
          placeholder={t('org-unit:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type OrgUnitMoveFormValues = {
  newParentOrgUnitId: string;
};

export const OrgUnitMoveSurface = ({
  currentOrgUnitId,
  currentParentOrgUnitId,
  onSubmit,
  onCancel,
  isPending = false,
}: OrgUnitMoveSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['org-unit', 'common']);
  const form = useForm<OrgUnitMoveFormValues>({
    defaultValues: {
      newParentOrgUnitId: currentParentOrgUnitId ?? '',
    },
  });

  const schema = useMemo(
    () =>
      createOrgUnitMoveFormSchema(
        t('org-unit:validation.invalidReferenceToken'),
        t('org-unit:validation.moveSelfForbidden'),
        currentOrgUnitId,
      ),
    [currentOrgUnitId, t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'newParentOrgUnitId');
      return;
    }

    await onSubmit({
      newParentOrgUnitId: toNullableText(parsed.data.newParentOrgUnitId),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('org-unit:mutations.move.title')}
        subtitle={t('org-unit:mutations.move.subtitle')}
        kind="action"
        submitLabel={t('org-unit:mutations.move.submit')}
        pendingLabel={t('org-unit:mutations.move.pending')}
        cancelLabel={t('common:actions.cancel')}
        onSubmit={(event) => void handleSubmit(event)}
        onCancel={onCancel}
        isPending={isPending}
      >
        <ReferencePickerField
          name="newParentOrgUnitId"
          label={t('org-unit:fields.newParentOrgUnitId')}
          pickerId="org-unit-new-parent"
          loadOptions={loadOrgUnitReferenceOptions}
          helperText={t('org-unit:referenceHelp.newParentOrgUnitId')}
          placeholder={t('org-unit:placeholders.parentOrgUnitSearch')}
          clearable
          clearLabel={t('org-unit:actions.clearParent')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
