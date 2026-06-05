import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { subjectKindValues } from '@modules/work-schedule/tables/work-schedule-columns';
import {
  loadWorkShiftStudioResourceOptions,
  loadWorkShiftSubjectOptions,
} from '@modules/work-schedule/components/work-schedule-reference-options';
import { canUseWorkScheduleSubjectInScope } from '@modules/work-schedule/scope-guards';
import type {
  WorkScheduleScope,
  WorkShiftCreatePayload,
  WorkShiftReassignSubjectPayload,
  WorkShiftReplaceResourcesPayload,
  WorkShiftReschedulePayload,
  WorkShiftSubjectKind,
  WorkShiftUpdatePayload,
} from '@modules/work-schedule/types/work-schedule.types';
import { AsyncReferencePicker, type ReferenceOption } from '@shared/components/reference';
import { FormGrid, SelectField, TextInputField } from '@shared/forms';
import {
  formatBusinessDateTimeInputValue,
  parseBusinessDateTimeInputValue,
} from '@shared/formatting/formatters';
import { ModuleMutationSurface } from '@shared/modules';

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type WorkShiftCreateSurfaceProps = BaseSurfaceProps & {
  currentScope?: WorkScheduleScope;
  onSubmit: (payload: WorkShiftCreatePayload) => Promise<void> | void;
};

type WorkShiftEditSurfaceProps = BaseSurfaceProps & {
  initialValues: {
    title: string;
    description?: string | null;
    externalRef?: string | null;
  };
  onSubmit: (payload: WorkShiftUpdatePayload) => Promise<void> | void;
};

type WorkShiftRescheduleSurfaceProps = BaseSurfaceProps & {
  initialValues: {
    shiftStartAt: number | string;
    shiftEndAt: number | string;
  };
  onSubmit: (payload: WorkShiftReschedulePayload) => Promise<void> | void;
};

type WorkShiftReassignSubjectSurfaceProps = BaseSurfaceProps & {
  currentScope?: WorkScheduleScope;
  initialValues: {
    subjectKind: WorkShiftSubjectKind;
    subjectEmploymentProfileId?: string | null;
    subjectTalentId?: string | null;
    subjectTalentGroupId?: string | null;
  };
  onSubmit: (payload: WorkShiftReassignSubjectPayload) => Promise<void> | void;
};

type WorkShiftReplaceResourcesSurfaceProps = BaseSurfaceProps & {
  initialResourceIds: string[];
  onSubmit: (payload: WorkShiftReplaceResourcesPayload) => Promise<void> | void;
};

const tokenRegex = /^[A-Za-z0-9_-]+$/;
const upperTokenRegex = /^[A-Z][A-Z0-9_]*$/;

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const subjectKindToIdPayload = (
  subjectId: string,
): Pick<WorkShiftCreatePayload, 'subjectEmploymentProfileId'> => ({
  subjectEmploymentProfileId: subjectId,
});

const subjectKindToReassignPayload = (
  subjectKind: WorkShiftSubjectKind,
  subjectId: string,
): Pick<
  WorkShiftReassignSubjectPayload,
  'newSubjectEmploymentProfileId' | 'newSubjectTalentId' | 'newSubjectTalentGroupId'
> => {
  if (subjectKind === 'EMPLOYMENT_PROFILE') {
    return { newSubjectEmploymentProfileId: subjectId };
  }

  if (subjectKind === 'TALENT') {
    return { newSubjectTalentId: subjectId };
  }

  return { newSubjectTalentGroupId: subjectId };
};

const readInitialSubjectId = (
  values: WorkShiftReassignSubjectSurfaceProps['initialValues'],
): string => {
  if (values.subjectKind === 'EMPLOYMENT_PROFILE') {
    return values.subjectEmploymentProfileId ?? '';
  }

  if (values.subjectKind === 'TALENT') {
    return values.subjectTalentId ?? '';
  }

  return values.subjectTalentGroupId ?? '';
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

const createSubjectKindSchema = (requiredMessage: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value : undefined),
    z.enum(subjectKindValues as [WorkShiftSubjectKind, ...WorkShiftSubjectKind[]], {
      required_error: requiredMessage,
    }),
  );

const timestampField = (requiredMessage: string) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length > 0
        ? parseBusinessDateTimeInputValue(value)
        : undefined,
    z
      .number({ required_error: requiredMessage, invalid_type_error: requiredMessage })
      .int()
      .nonnegative({ message: requiredMessage }),
  );

const createCreateSchema = (
  requiredMessage: string,
  tokenMessage: string,
  rangeMessage: string,
  invalidScopedSubjectMessage: string,
  manualReasonMessage: string,
  currentScope?: WorkScheduleScope,
) =>
  z
    .object({
      shiftCode: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || upperTokenRegex.test(value), tokenMessage),
      title: z.string().trim().min(1, requiredMessage),
      subjectKind: z.literal('EMPLOYMENT_PROFILE'),
      subjectId: z.string().trim().min(1, requiredMessage).regex(tokenRegex, tokenMessage),
      shiftStartAt: timestampField(requiredMessage),
      shiftEndAt: timestampField(requiredMessage),
      studioResourceIds: z.array(z.string().trim().min(1)).optional(),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      if (value.shiftEndAt <= value.shiftStartAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['shiftEndAt'],
          message: rangeMessage,
        });
      }
      if (!canUseWorkScheduleSubjectInScope(value.subjectKind, currentScope)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subjectKind'],
          message: invalidScopedSubjectMessage,
        });
      }
      if (!value.description?.trim() && !value.externalRef?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['description'],
          message: manualReasonMessage,
        });
      }
    });

const createRescheduleSchema = (requiredMessage: string, rangeMessage: string) =>
  z
    .object({
      newShiftStartAt: timestampField(requiredMessage),
      newShiftEndAt: timestampField(requiredMessage),
    })
    .superRefine((value, context) => {
      if (value.newShiftEndAt <= value.newShiftStartAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newShiftEndAt'],
          message: rangeMessage,
        });
      }
    });

type WorkShiftCreateFormValues = {
  shiftCode: string;
  title: string;
  subjectKind: WorkShiftSubjectKind;
  subjectId: string;
  shiftStartAt: string;
  shiftEndAt: string;
  studioResourceIds: string[];
  description: string;
  externalRef: string;
};

const useSubjectKindOptions = () => {
  const { t } = useTranslation(['work-schedule']);
  return useMemo(
    () =>
      subjectKindValues.map((value) => ({
        value,
        label: t(`work-schedule:subjectKinds.${value}`),
      })),
    [t],
  );
};

const SubjectPickerField = <TValues extends FieldValues>({
  disabled,
  label,
  pickerId,
  subjectIdField,
  subjectKindField,
  placeholder,
}: {
  disabled?: boolean;
  label: string;
  pickerId: string;
  subjectIdField: Path<TValues>;
  subjectKindField: Path<TValues>;
  placeholder: string;
}): JSX.Element => {
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<TValues>();
  const subjectKind = watch(subjectKindField) as WorkShiftSubjectKind;
  const subjectId = watch(subjectIdField) as string;
  const previousSubjectKindRef = useRef(subjectKind);
  const loadOptions = useCallback(
    (search: string) => loadWorkShiftSubjectOptions(subjectKind, search),
    [subjectKind],
  );
  const fieldError = get(errors, subjectIdField)?.message as string | undefined;

  useEffect(() => {
    if (previousSubjectKindRef.current === subjectKind) {
      return;
    }

    previousSubjectKindRef.current = subjectKind;
    setValue(subjectIdField, '' as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [setValue, subjectIdField, subjectKind]);

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <AsyncReferencePicker
        pickerId={pickerId}
        value={subjectId}
        onChange={(nextId) =>
          setValue(subjectIdField, (nextId ?? '') as never, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          })
        }
        loadOptions={loadOptions}
        disabled={disabled}
        placeholder={placeholder}
      />
      {fieldError ? <p className="text-xs font-medium text-danger">{fieldError}</p> : null}
    </div>
  );
};

const ResourcePickerField = <TValues extends FieldValues>({
  disabled,
  fieldName,
  label,
  noSelectionLabel,
  pickerId,
  placeholder,
  removeLabel,
}: {
  disabled?: boolean;
  fieldName: Path<TValues>;
  label: string;
  noSelectionLabel: string;
  pickerId: string;
  placeholder: string;
  removeLabel: string;
}): JSX.Element => {
  const { setValue, watch } = useFormContext<TValues>();
  const selectedIds = (watch(fieldName) as string[] | undefined) ?? [];
  const [knownOptions, setKnownOptions] = useState<ReferenceOption[]>([]);
  const loadOptions = useCallback(async (search: string) => {
    const options = await loadWorkShiftStudioResourceOptions(search);
    setKnownOptions((current) => {
      const byId = new Map(current.map((option) => [option.id, option]));
      options.forEach((option) => byId.set(option.id, option));
      return Array.from(byId.values());
    });
    return options;
  }, []);
  const optionLabelById = useMemo(
    () => new Map(knownOptions.map((option) => [option.id, option.label])),
    [knownOptions],
  );

  const setSelectedIds = (ids: string[]): void => {
    setValue(fieldName, ids as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <AsyncReferencePicker
        pickerId={pickerId}
        exactOneId={false}
        onChange={(nextId) => {
          if (!nextId || selectedIds.includes(nextId)) {
            return;
          }
          setSelectedIds([...selectedIds, nextId]);
        }}
        loadOptions={loadOptions}
        disabled={disabled}
        placeholder={placeholder}
      />
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((resourceId) => (
            <span
              key={resourceId}
              className="inline-flex items-center gap-2 rounded border border-border bg-bg px-2 py-1 text-xs text-text"
            >
              {optionLabelById.get(resourceId) ?? resourceId}
              <button
                type="button"
                disabled={disabled}
                onClick={() => setSelectedIds(selectedIds.filter((id) => id !== resourceId))}
                className="rounded border border-border px-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removeLabel}
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">{noSelectionLabel}</p>
      )}
    </div>
  );
};

export const WorkShiftCreateSurface = ({
  currentScope,
  onCancel,
  onSubmit,
  isPending = false,
}: WorkShiftCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const form = useForm<WorkShiftCreateFormValues>({
    defaultValues: {
      shiftCode: '',
      title: '',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectId: '',
      shiftStartAt: '',
      shiftEndAt: '',
      studioResourceIds: [],
      description: '',
      externalRef: '',
    },
  });

  const schema = useMemo(
    () =>
      createCreateSchema(
        t('work-schedule:validation.required'),
        t('work-schedule:validation.invalidToken'),
        t('work-schedule:validation.invalidWindow'),
        t('work-schedule:validation.nonGlobalEmploymentProfileOnly'),
        t('work-schedule:validation.manualCreateReasonRequired'),
        currentScope,
      ),
    [currentScope, t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'shiftCode');
      return;
    }

    await onSubmit({
      ...(parsed.data.shiftCode ? { shiftCode: parsed.data.shiftCode } : {}),
      title: parsed.data.title,
      subjectKind: parsed.data.subjectKind,
      ...subjectKindToIdPayload(parsed.data.subjectId),
      shiftStartAt: parsed.data.shiftStartAt,
      shiftEndAt: parsed.data.shiftEndAt,
      studioResourceIds: parsed.data.studioResourceIds ?? [],
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:mutations.create.title')}
        subtitle={t('work-schedule:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('work-schedule:mutations.create.submit')}
        pendingLabel={t('work-schedule:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('work-schedule:mutations.create.exceptionCopy')}
        </p>
        <details className="rounded border border-border bg-bg px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-text">
            {t('work-schedule:advanced.customCodeTitle')}
          </summary>
          <div className="mt-3 space-y-2">
            <TextInputField
              name="shiftCode"
              label={t('work-schedule:fields.shiftCodeOptional')}
              placeholder={t('work-schedule:placeholders.generatedShiftCode')}
            />
            <p className="text-xs text-muted">{t('work-schedule:advanced.customShiftCodeHelp')}</p>
          </div>
        </details>
        <FormGrid columns={2}>
          <TextInputField name="title" label={t('work-schedule:fields.title')} />
          <TextInputField
            name="shiftStartAt"
            label={t('work-schedule:fields.shiftStartAt')}
            type="datetime-local"
          />
          <TextInputField
            name="shiftEndAt"
            label={t('work-schedule:fields.shiftEndAt')}
            type="datetime-local"
          />
          <TextInputField
            name="externalRef"
            label={t('work-schedule:fields.externalRef')}
            placeholder={t('work-schedule:placeholders.optional')}
          />
        </FormGrid>
        <SubjectPickerField<WorkShiftCreateFormValues>
          pickerId="work-shift-admin-subject"
          subjectKindField="subjectKind"
          subjectIdField="subjectId"
          label={t('work-schedule:fields.employmentProfile')}
          placeholder={t('work-schedule:pickers.subjectSearch')}
        />
        <ResourcePickerField<WorkShiftCreateFormValues>
          fieldName="studioResourceIds"
          pickerId="work-shift-admin-studio-resources"
          label={t('work-schedule:fields.studioResources')}
          placeholder={t('work-schedule:pickers.studioResourceSearch')}
          removeLabel={t('work-schedule:pickers.removeSelectedResource')}
          noSelectionLabel={t('work-schedule:pickers.noResourcesSelected')}
        />
        <TextInputField
          name="description"
          label={t('work-schedule:fields.description')}
          placeholder={t('work-schedule:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type WorkShiftEditFormValues = {
  title: string;
  description: string;
  externalRef: string;
};

export const WorkShiftEditSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: WorkShiftEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const form = useForm<WorkShiftEditFormValues>({
    defaultValues: {
      title: initialValues.title,
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t('work-schedule:validation.required')),
        description: z.string().trim().optional(),
        externalRef: z.string().trim().optional(),
      }),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    await onSubmit({
      title: parsed.data.title,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:mutations.edit.title')}
        subtitle={t('work-schedule:mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('work-schedule:mutations.edit.submit')}
        pendingLabel={t('work-schedule:mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="title" label={t('work-schedule:fields.title')} />
          <TextInputField name="externalRef" label={t('work-schedule:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('work-schedule:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const WorkShiftRescheduleSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: WorkShiftRescheduleSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const form = useForm<{ newShiftStartAt: string; newShiftEndAt: string }>({
    defaultValues: {
      newShiftStartAt: formatBusinessDateTimeInputValue(initialValues.shiftStartAt),
      newShiftEndAt: formatBusinessDateTimeInputValue(initialValues.shiftEndAt),
    },
  });
  const schema = useMemo(
    () =>
      createRescheduleSchema(
        t('work-schedule:validation.required'),
        t('work-schedule:validation.invalidWindow'),
      ),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'newShiftStartAt');
      return;
    }
    await onSubmit(parsed.data);
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:mutations.reschedule.title')}
        subtitle={t('work-schedule:mutations.reschedule.subtitle')}
        kind="action"
        submitLabel={t('work-schedule:mutations.reschedule.submit')}
        pendingLabel={t('work-schedule:mutations.reschedule.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField
            name="newShiftStartAt"
            label={t('work-schedule:fields.newShiftStartAt')}
            type="datetime-local"
          />
          <TextInputField
            name="newShiftEndAt"
            label={t('work-schedule:fields.newShiftEndAt')}
            type="datetime-local"
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const WorkShiftReassignSubjectSurface = ({
  currentScope,
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: WorkShiftReassignSubjectSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const subjectKindOptions = useSubjectKindOptions();
  const form = useForm<{ newSubjectKind: WorkShiftSubjectKind; subjectId: string }>({
    defaultValues: {
      newSubjectKind: initialValues.subjectKind,
      subjectId: readInitialSubjectId(initialValues),
    },
  });
  const schema = useMemo(
    () =>
      z
        .object({
          newSubjectKind: createSubjectKindSchema(t('work-schedule:validation.required')),
          subjectId: z
            .string()
            .trim()
            .min(1, t('work-schedule:validation.required'))
            .regex(tokenRegex, t('work-schedule:validation.invalidReferenceToken')),
        })
        .superRefine((value, context) => {
          if (!canUseWorkScheduleSubjectInScope(value.newSubjectKind, currentScope)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['newSubjectKind'],
              message: t('work-schedule:validation.nonGlobalEmploymentProfileOnly'),
            });
          }
        }),
    [currentScope, t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'subjectId');
      return;
    }
    await onSubmit({
      newSubjectKind: parsed.data.newSubjectKind,
      ...subjectKindToReassignPayload(parsed.data.newSubjectKind, parsed.data.subjectId),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:mutations.reassignSubject.title')}
        subtitle={t('work-schedule:mutations.reassignSubject.subtitle')}
        kind="action"
        submitLabel={t('work-schedule:mutations.reassignSubject.submit')}
        pendingLabel={t('work-schedule:mutations.reassignSubject.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <SelectField
            name="newSubjectKind"
            label={t('work-schedule:fields.newSubjectKind')}
            options={subjectKindOptions}
          />
        </FormGrid>
        <SubjectPickerField<{ newSubjectKind: WorkShiftSubjectKind; subjectId: string }>
          pickerId="work-shift-reassign-subject"
          subjectKindField="newSubjectKind"
          subjectIdField="subjectId"
          label={t('work-schedule:fields.subject')}
          placeholder={t('work-schedule:pickers.subjectSearch')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const WorkShiftReplaceResourcesSurface = ({
  initialResourceIds,
  onCancel,
  onSubmit,
  isPending = false,
}: WorkShiftReplaceResourcesSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const form = useForm<{ newStudioResourceIds: string[] }>({
    defaultValues: {
      newStudioResourceIds: initialResourceIds,
    },
  });
  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      newStudioResourceIds: values.newStudioResourceIds,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:mutations.replaceResources.title')}
        subtitle={t('work-schedule:mutations.replaceResources.subtitle')}
        kind="action"
        submitLabel={t('work-schedule:mutations.replaceResources.submit')}
        pendingLabel={t('work-schedule:mutations.replaceResources.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <ResourcePickerField<{ newStudioResourceIds: string[] }>
          fieldName="newStudioResourceIds"
          pickerId="work-shift-replace-studio-resources"
          label={t('work-schedule:fields.studioResources')}
          placeholder={t('work-schedule:pickers.studioResourceSearch')}
          removeLabel={t('work-schedule:pickers.removeSelectedResource')}
          noSelectionLabel={t('work-schedule:pickers.noResourcesSelected')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
