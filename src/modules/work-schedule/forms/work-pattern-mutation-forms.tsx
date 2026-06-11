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
  WORK_PATTERN_TIMEZONE,
  WORK_PATTERN_WEEKDAYS,
  type WorkPatternCreatePayload,
  type WorkPatternRecord,
  type WorkPatternUpdatePayload,
  type WorkPatternWeekdayToken,
} from '@modules/work-schedule/types/work-schedule.types';
import { FormGrid, TextInputField } from '@shared/forms';
import { ModuleMutationSurface, type ModuleMutationSurfaceProps } from '@shared/modules';

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
  presentation?: ModuleMutationSurfaceProps['presentation'];
};

type WorkPatternCreateSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: WorkPatternCreatePayload) => Promise<void> | void;
};

type WorkPatternEditSurfaceProps = BaseSurfaceProps & {
  initialValues: WorkPatternRecord;
  onSubmit: (payload: WorkPatternUpdatePayload) => Promise<void> | void;
};

type WorkPatternFormValues = {
  patternCode: string;
  name: string;
  startLocalTime: string;
  workingMinutes: string;
  breakMinutes: string;
  workingDays: WorkPatternWeekdayToken[];
  description: string;
  externalRef: string;
};

const patternCodeRegex = /^[A-Z][A-Z0-9_]*$/;
const localTimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutesPerDay = 24 * 60;

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
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

const readScheduleEndMinutes = (
  startLocalTime: string,
  workingMinutes: number,
  breakMinutes: number,
): number | null => {
  if (!localTimeRegex.test(startLocalTime)) {
    return null;
  }

  const [hours, minutes] = startLocalTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  if (startMinutes < 0 || startMinutes >= minutesPerDay) {
    return null;
  }

  return startMinutes + workingMinutes + breakMinutes;
};

const withSameDayValidation = <TSchema extends z.ZodTypeAny>(schema: TSchema, sameDay: string) =>
  schema.superRefine((value, context) => {
    const fields = value as WorkPatternFormValues;
    const endMinutes = readScheduleEndMinutes(
      fields.startLocalTime,
      Number(fields.workingMinutes),
      Number(fields.breakMinutes),
    );

    if (endMinutes === null) {
      return;
    }

    if (endMinutes >= minutesPerDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startLocalTime'],
        message: sameDay,
      });
    }
  });

const createBaseSchema = (required: string, token: string, time: string, weekday: string) =>
  z.object({
    patternCode: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || patternCodeRegex.test(value), token),
    name: z.string().trim().min(1, required),
    startLocalTime: z.string().trim().min(1, required).regex(localTimeRegex, time),
    workingMinutes: z.coerce.number().int().min(1, required).max(1439, time),
    breakMinutes: z.coerce.number().int().min(0, required).max(1439, time),
    workingDays: z
      .array(
        z.enum(WORK_PATTERN_WEEKDAYS as [WorkPatternWeekdayToken, ...WorkPatternWeekdayToken[]]),
      )
      .min(1, weekday),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
  });

const createSchema = (
  required: string,
  token: string,
  time: string,
  sameDay: string,
  weekday: string,
) => withSameDayValidation(createBaseSchema(required, token, time, weekday), sameDay);

const createEditSchema = (required: string, time: string, sameDay: string, weekday: string) =>
  withSameDayValidation(
    createBaseSchema(required, required, time, weekday).omit({ patternCode: true }),
    sameDay,
  );

const calculateEndLocalTime = (
  startLocalTime: string,
  workingMinutesValue: string,
  breakMinutesValue: string,
): string | null => {
  if (!localTimeRegex.test(startLocalTime)) {
    return null;
  }

  const workingMinutes = Number(workingMinutesValue);
  const breakMinutes = Number(breakMinutesValue);
  if (!Number.isFinite(workingMinutes) || !Number.isFinite(breakMinutes)) {
    return null;
  }

  const totalMinutes = readScheduleEndMinutes(startLocalTime, workingMinutes, breakMinutes);
  if (totalMinutes === null || totalMinutes >= minutesPerDay) {
    return null;
  }

  const nextHours = Math.floor(totalMinutes / 60);
  const nextMinutes = totalMinutes % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

const FieldError = ({ name }: { name: keyof WorkPatternFormValues }): JSX.Element | null => {
  const {
    formState: { errors },
  } = useFormContext<WorkPatternFormValues>();
  const fieldError = get(errors, name)?.message as string | undefined;

  return fieldError ? <p className="text-xs font-medium text-danger">{fieldError}</p> : null;
};

const LocalTimeField = ({
  disabled,
  label,
}: {
  disabled?: boolean;
  label: string;
}): JSX.Element => {
  const id = useId();
  const { register } = useFormContext<WorkPatternFormValues>();

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <input
        id={id}
        type="time"
        disabled={disabled}
        {...register('startLocalTime')}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2"
      />
      <FieldError name="startLocalTime" />
    </label>
  );
};

const NumberField = ({
  disabled,
  label,
  name,
}: {
  disabled?: boolean;
  label: string;
  name: 'workingMinutes' | 'breakMinutes';
}): JSX.Element => {
  const id = useId();
  const { register } = useFormContext<WorkPatternFormValues>();

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <input
        id={id}
        type="number"
        min={name === 'workingMinutes' ? 1 : 0}
        disabled={disabled}
        {...register(name)}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2"
      />
      <FieldError name={name} />
    </label>
  );
};

const WorkingDaysField = ({
  disabled,
  label,
}: {
  disabled?: boolean;
  label: string;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const { register } = useFormContext<WorkPatternFormValues>();

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium uppercase text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {WORK_PATTERN_WEEKDAYS.map((day) => (
          <label
            key={day}
            className="inline-flex items-center gap-2 rounded border border-border bg-bg px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              value={day}
              disabled={disabled}
              {...register('workingDays')}
              className="h-4 w-4 rounded border-border disabled:cursor-not-allowed"
            />
            <span>{t(`work-schedule:patterns.weekdays.${day}`)}</span>
          </label>
        ))}
      </div>
      <FieldError name="workingDays" />
    </fieldset>
  );
};

const ReadOnlyField = ({ label, value }: { label: string; value: string }): JSX.Element => (
  <div className="rounded border border-border bg-bg px-3 py-2">
    <p className="text-xs font-medium uppercase text-muted">{label}</p>
    <p className="mt-1 text-sm text-text">{value}</p>
  </div>
);

const WorkPatternScheduleFields = ({
  calculatedEndLocalTime,
  structuralReadOnly,
}: {
  calculatedEndLocalTime: string | null;
  structuralReadOnly?: boolean;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);

  return (
    <>
      <FormGrid columns={2}>
        <ReadOnlyField
          label={t('work-schedule:patterns.fields.timezone')}
          value={WORK_PATTERN_TIMEZONE}
        />
        <LocalTimeField
          disabled={structuralReadOnly}
          label={t('work-schedule:patterns.fields.startLocalTime')}
        />
        <NumberField
          disabled={structuralReadOnly}
          name="workingMinutes"
          label={t('work-schedule:patterns.fields.workingMinutes')}
        />
        <NumberField
          disabled={structuralReadOnly}
          name="breakMinutes"
          label={t('work-schedule:patterns.fields.breakMinutes')}
        />
        <ReadOnlyField
          label={t('work-schedule:patterns.fields.calculatedEndLocalTime')}
          value={
            calculatedEndLocalTime
              ? t('work-schedule:patterns.form.localEstimate', { value: calculatedEndLocalTime })
              : t('work-schedule:patterns.form.noEstimate')
          }
        />
      </FormGrid>
      <WorkingDaysField
        disabled={structuralReadOnly}
        label={t('work-schedule:patterns.fields.workingDays')}
      />
    </>
  );
};

const createDefaultValues = (initialValues?: WorkPatternRecord): WorkPatternFormValues => ({
  patternCode: initialValues?.patternCode ?? '',
  name: initialValues?.name ?? '',
  startLocalTime: initialValues?.startLocalTime ?? '08:00',
  workingMinutes: String(initialValues?.workingMinutes ?? 480),
  breakMinutes: String(initialValues?.breakMinutes ?? 60),
  workingDays: initialValues?.workingDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  description: initialValues?.description ?? '',
  externalRef: initialValues?.externalRef ?? '',
});

export const WorkPatternCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
  presentation,
}: WorkPatternCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const form = useForm<WorkPatternFormValues>({
    defaultValues: createDefaultValues(),
  });
  const schema = useMemo(
    () =>
      createSchema(
        t('work-schedule:patterns.validation.required'),
        t('work-schedule:patterns.validation.patternCode'),
        t('work-schedule:patterns.validation.time'),
        t('work-schedule:patterns.validation.sameDay'),
        t('work-schedule:patterns.validation.workingDays'),
      ),
    [t],
  );
  const startLocalTime = form.watch('startLocalTime');
  const workingMinutes = form.watch('workingMinutes');
  const breakMinutes = form.watch('breakMinutes');
  const calculatedEndLocalTime = useMemo(
    () => calculateEndLocalTime(startLocalTime, workingMinutes, breakMinutes),
    [breakMinutes, startLocalTime, workingMinutes],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'patternCode');
      return;
    }

    await onSubmit({
      name: parsed.data.name,
      timezone: WORK_PATTERN_TIMEZONE,
      startLocalTime: parsed.data.startLocalTime,
      workingMinutes: parsed.data.workingMinutes,
      breakMinutes: parsed.data.breakMinutes,
      workingDays: parsed.data.workingDays,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:patterns.mutations.create.title')}
        subtitle={t('work-schedule:patterns.mutations.create.subtitle')}
        kind="create"
        presentation={presentation}
        submitLabel={t('work-schedule:patterns.mutations.create.submit')}
        pendingLabel={t('work-schedule:patterns.mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="name" label={t('work-schedule:patterns.fields.name')} />
        </FormGrid>
        <WorkPatternScheduleFields calculatedEndLocalTime={calculatedEndLocalTime} />
        <FormGrid columns={2}>
          <TextInputField
            name="externalRef"
            label={t('work-schedule:patterns.fields.externalRef')}
            placeholder={t('work-schedule:placeholders.optional')}
          />
        </FormGrid>
        <TextInputField
          name="description"
          label={t('work-schedule:patterns.fields.description')}
          placeholder={t('work-schedule:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const WorkPatternEditSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
  presentation,
}: WorkPatternEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const structuralReadOnly = initialValues.status !== 'DRAFT';
  const archived = initialValues.status === 'ARCHIVED';
  const form = useForm<WorkPatternFormValues>({
    defaultValues: createDefaultValues(initialValues),
  });
  const startLocalTime = form.watch('startLocalTime');
  const workingMinutes = form.watch('workingMinutes');
  const breakMinutes = form.watch('breakMinutes');
  const calculatedEndLocalTime = useMemo(
    () => calculateEndLocalTime(startLocalTime, workingMinutes, breakMinutes),
    [breakMinutes, startLocalTime, workingMinutes],
  );
  const schema = useMemo(
    () =>
      createEditSchema(
        t('work-schedule:patterns.validation.required'),
        t('work-schedule:patterns.validation.time'),
        t('work-schedule:patterns.validation.sameDay'),
        t('work-schedule:patterns.validation.workingDays'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    if (archived) {
      return;
    }

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
      return;
    }

    const metadataPayload = {
      name: parsed.data.name,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    };

    await onSubmit(
      structuralReadOnly
        ? metadataPayload
        : {
            ...metadataPayload,
            timezone: WORK_PATTERN_TIMEZONE,
            startLocalTime: parsed.data.startLocalTime,
            workingMinutes: parsed.data.workingMinutes,
            breakMinutes: parsed.data.breakMinutes,
            workingDays: parsed.data.workingDays,
          },
    );
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:patterns.mutations.edit.title')}
        subtitle={
          structuralReadOnly
            ? t('work-schedule:patterns.mutations.edit.activeSubtitle')
            : t('work-schedule:patterns.mutations.edit.subtitle')
        }
        kind="edit"
        presentation={presentation}
        submitLabel={t('work-schedule:patterns.mutations.edit.submit')}
        pendingLabel={t('work-schedule:patterns.mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
        isReadOnly={archived}
        readOnlyNotice={
          archived ? (
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('work-schedule:patterns.detail.archivedReadOnly')}
            </div>
          ) : undefined
        }
        banner={
          structuralReadOnly && !archived ? (
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('work-schedule:patterns.form.activeStructuralReadOnly')}
            </div>
          ) : undefined
        }
      >
        <FormGrid columns={2}>
          <ReadOnlyField
            label={t('work-schedule:patterns.fields.patternCode')}
            value={initialValues.patternCode}
          />
          <TextInputField name="name" label={t('work-schedule:patterns.fields.name')} />
        </FormGrid>
        <WorkPatternScheduleFields
          structuralReadOnly={structuralReadOnly}
          calculatedEndLocalTime={initialValues.endLocalTime ?? calculatedEndLocalTime}
        />
        <FormGrid columns={2}>
          <TextInputField
            name="externalRef"
            label={t('work-schedule:patterns.fields.externalRef')}
            placeholder={t('work-schedule:placeholders.optional')}
          />
        </FormGrid>
        <TextInputField
          name="description"
          label={t('work-schedule:patterns.fields.description')}
          placeholder={t('work-schedule:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
