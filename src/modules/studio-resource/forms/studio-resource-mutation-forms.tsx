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
  StudioResourceCreatePayload,
  StudioResourceUpdatePayload,
} from '@modules/studio-resource/types/studio-resource.types';
import { FormGrid, GeneratedCodeNotice, SelectField, TextInputField } from '@shared/forms';
import { ModuleMutationSurface, type ModuleMutationSurfaceProps } from '@shared/modules';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
  presentation?: ModuleMutationSurfaceProps['presentation'];
};

type StudioResourceCreateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: StudioResourceCreatePayload) => Promise<void> | void;
};

type StudioResourceEditSurfaceProps = BaseMutationSurfaceProps & {
  resourceClass: string;
  initialValues: {
    name: string;
    shortName?: string | null;
    locationLabel?: string | null;
    description?: string | null;
    externalRef?: string | null;
    maxOccupancy?: number | null;
  };
  onSubmit: (payload: StudioResourceUpdatePayload) => Promise<void> | void;
};

const resourceClassValues = ['SPACE', 'EQUIPMENT', 'KIT'] as const;

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const toNullablePositiveInteger = (value?: string): number | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return Number(trimmed);
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

const maxOccupancyFieldSchema = (integerMessage: string) => {
  return z
    .string()
    .trim()
    .optional()
    .refine((value) => {
      if (!value) {
        return true;
      }

      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed > 0;
    }, integerMessage);
};

const createStudioResourceCreateSchema = (
  requiredMessage: string,
  integerMessage: string,
  spaceOnlyMessage: string,
) => {
  return z
    .object({
      name: z.string().trim().min(1, requiredMessage),
      resourceClass: z.enum(resourceClassValues, { required_error: requiredMessage }),
      shortName: z.string().trim().optional(),
      locationLabel: z.string().trim().optional(),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
      maxOccupancy: maxOccupancyFieldSchema(integerMessage),
    })
    .superRefine((value, context) => {
      if (value.resourceClass !== 'SPACE' && value.maxOccupancy?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxOccupancy'],
          message: spaceOnlyMessage,
        });
      }
    });
};

const createStudioResourceEditSchema = (requiredMessage: string, integerMessage: string) => {
  return z.object({
    name: z.string().trim().min(1, requiredMessage),
    shortName: z.string().trim().optional(),
    locationLabel: z.string().trim().optional(),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
    maxOccupancy: maxOccupancyFieldSchema(integerMessage),
  });
};

type StudioResourceCreateFormValues = {
  name: string;
  resourceClass: string;
  shortName: string;
  locationLabel: string;
  description: string;
  externalRef: string;
  maxOccupancy: string;
};

export const StudioResourceCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
  presentation,
}: StudioResourceCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['studio-resource', 'common']);
  const form = useForm<StudioResourceCreateFormValues>({
    defaultValues: {
      name: '',
      resourceClass: 'SPACE',
      shortName: '',
      locationLabel: '',
      description: '',
      externalRef: '',
      maxOccupancy: '',
    },
  });

  const schema = useMemo(
    () =>
      createStudioResourceCreateSchema(
        t('studio-resource:validation.required'),
        t('studio-resource:validation.invalidPositiveInteger'),
        t('studio-resource:validation.maxOccupancySpaceOnly'),
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
      resourceClass: parsed.data.resourceClass,
      shortName: toNullableText(parsed.data.shortName),
      locationLabel: toNullableText(parsed.data.locationLabel),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
      maxOccupancy: toNullablePositiveInteger(parsed.data.maxOccupancy),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('studio-resource:mutations.create.title')}
        subtitle={t('studio-resource:mutations.create.subtitle')}
        kind="create"
        presentation={presentation}
        submitLabel={t('studio-resource:mutations.create.submit')}
        pendingLabel={t('studio-resource:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('studio-resource:generatedCode.label')}
            description={t('studio-resource:generatedCode.description')}
            className="md:col-span-2"
          />
          <SelectField
            name="resourceClass"
            label={t('studio-resource:fields.resourceClass')}
            options={resourceClassValues.map((value) => ({
              value,
              label: t(`studio-resource:resourceClasses.${value}`),
            }))}
          />
          <TextInputField name="name" label={t('studio-resource:fields.name')} />
          <TextInputField name="shortName" label={t('studio-resource:fields.shortName')} />
          <TextInputField
            name="locationLabel"
            label={t('studio-resource:fields.locationLabel')}
            placeholder={t('studio-resource:placeholders.locationLabel')}
            helperText={t('studio-resource:help.locationLabel')}
          />
          <TextInputField
            name="maxOccupancy"
            label={t('studio-resource:fields.maxOccupancy')}
            type="number"
          />
          <TextInputField name="externalRef" label={t('studio-resource:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('studio-resource:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type StudioResourceEditFormValues = {
  name: string;
  shortName: string;
  locationLabel: string;
  description: string;
  externalRef: string;
  maxOccupancy: string;
};

export const StudioResourceEditSurface = ({
  resourceClass,
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
  presentation,
}: StudioResourceEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['studio-resource', 'common']);
  const canEditOccupancy = resourceClass === 'SPACE';
  const form = useForm<StudioResourceEditFormValues>({
    defaultValues: {
      name: initialValues.name,
      shortName: initialValues.shortName ?? '',
      locationLabel: initialValues.locationLabel ?? '',
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
      maxOccupancy:
        initialValues.maxOccupancy === null || initialValues.maxOccupancy === undefined
          ? ''
          : String(initialValues.maxOccupancy),
    },
  });

  const schema = useMemo(
    () =>
      createStudioResourceEditSchema(
        t('studio-resource:validation.required'),
        t('studio-resource:validation.invalidPositiveInteger'),
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
      shortName: toNullableText(parsed.data.shortName),
      locationLabel: toNullableText(parsed.data.locationLabel),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
      ...(canEditOccupancy
        ? { maxOccupancy: toNullablePositiveInteger(parsed.data.maxOccupancy) }
        : {}),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('studio-resource:mutations.edit.title')}
        subtitle={t('studio-resource:mutations.edit.subtitle')}
        kind="edit"
        presentation={presentation}
        submitLabel={t('studio-resource:mutations.edit.submit')}
        pendingLabel={t('studio-resource:mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="name" label={t('studio-resource:fields.name')} />
          <TextInputField name="shortName" label={t('studio-resource:fields.shortName')} />
          <TextInputField
            name="locationLabel"
            label={t('studio-resource:fields.locationLabel')}
            placeholder={t('studio-resource:placeholders.locationLabel')}
            helperText={t('studio-resource:help.locationLabel')}
          />
          {canEditOccupancy ? (
            <TextInputField
              name="maxOccupancy"
              label={t('studio-resource:fields.maxOccupancy')}
              type="number"
            />
          ) : null}
          <TextInputField name="externalRef" label={t('studio-resource:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('studio-resource:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
