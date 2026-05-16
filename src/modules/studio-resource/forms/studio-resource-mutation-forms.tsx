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
import { FormGrid, GeneratedCodeNotice, TextInputField } from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
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

const upperTokenRegex = /^[A-Z][A-Z0-9_]*$/;

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
  tokenMessage: string,
  integerMessage: string,
  spaceOnlyMessage: string,
) => {
  return z
    .object({
      name: z.string().trim().min(1, requiredMessage),
      resourceClass: z.string().trim().min(1, requiredMessage).regex(upperTokenRegex, tokenMessage),
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
        t('studio-resource:validation.invalidToken'),
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
          <TextInputField name="resourceClass" label={t('studio-resource:fields.resourceClass')} />
          <TextInputField name="name" label={t('studio-resource:fields.name')} />
          <TextInputField name="shortName" label={t('studio-resource:fields.shortName')} />
          <TextInputField name="locationLabel" label={t('studio-resource:fields.locationLabel')} />
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
          <TextInputField name="locationLabel" label={t('studio-resource:fields.locationLabel')} />
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
