import { useId, useMemo } from 'react';
import {
  FormProvider,
  get,
  useForm,
  useFormContext,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  HOLIDAY_CALENDAR_TIMEZONE,
  type HolidayCalendarCreatePayload,
  type HolidayCalendarEntryPayload,
  type HolidayCalendarEntryRecord,
  type HolidayCalendarEntryType,
  type HolidayCalendarRecord,
  type HolidayCalendarUpdatePayload,
} from '@modules/work-schedule/types/work-schedule.types';
import { FormGrid } from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type CalendarFormValues = {
  calendarCode: string;
  name: string;
  description: string;
  externalRef: string;
};

type EntryFormValues = {
  date: string;
  entryType: HolidayCalendarEntryType;
  name: string;
  description: string;
  externalRef: string;
};

const entryTypes: readonly HolidayCalendarEntryType[] = [
  'HOLIDAY',
  'COMPANY_OFF_DAY',
  'CUSTOM_OFF_DAY',
];

const codeRegex = /^[A-Z][A-Z0-9_]*$/;
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const applySchemaErrors = <TValues extends FieldValues>(
  setError: ReturnType<typeof useForm<TValues>>['setError'],
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

const isRealDateOnly = (value: string): boolean => {
  if (!dateOnlyRegex.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const FieldError = <TValues extends FieldValues>({
  name,
}: {
  name: Path<TValues>;
}): JSX.Element | null => {
  const {
    formState: { errors },
  } = useFormContext<TValues>();
  const fieldError = get(errors, name)?.message as string | undefined;

  return fieldError ? <p className="text-xs font-medium text-danger">{fieldError}</p> : null;
};

const InputField = <TValues extends FieldValues>({
  disabled,
  label,
  name,
  placeholder,
  type = 'text',
}: {
  disabled?: boolean;
  label: string;
  name: Path<TValues>;
  placeholder?: string;
  type?: 'text' | 'date';
}): JSX.Element => {
  const id = useId();
  const { register } = useFormContext<TValues>();

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <input
        id={id}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        {...register(name)}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2"
      />
      <FieldError<TValues> name={name} />
    </label>
  );
};

const ReadOnlyField = ({ label, value }: { label: string; value: string }): JSX.Element => (
  <div className="rounded border border-border bg-bg px-3 py-2">
    <p className="text-xs font-medium uppercase text-muted">{label}</p>
    <p className="mt-1 text-sm text-text">{value}</p>
  </div>
);

const EntryTypeField = ({
  disabled,
  label,
}: {
  disabled?: boolean;
  label: string;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const id = useId();
  const { register } = useFormContext<EntryFormValues>();

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <select
        id={id}
        disabled={disabled}
        {...register('entryType')}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2"
      >
        {entryTypes.map((entryType) => (
          <option key={entryType} value={entryType}>
            {t(`work-schedule:holidayCalendars.entryTypes.${entryType}`)}
          </option>
        ))}
      </select>
    </label>
  );
};

const createCalendarSchema = (required: string, code: string) =>
  z.object({
    calendarCode: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || codeRegex.test(value), code),
    name: z.string().trim().min(1, required),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
  });

const updateCalendarSchema = (required: string) =>
  createCalendarSchema(required, required).omit({ calendarCode: true });

const createEntrySchema = (required: string, dateOnly: string) =>
  z.object({
    date: z.string().trim().min(1, required).refine(isRealDateOnly, dateOnly),
    entryType: z.enum(entryTypes as [HolidayCalendarEntryType, ...HolidayCalendarEntryType[]]),
    name: z.string().trim().min(1, required),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
  });

const createCalendarDefaults = (initial?: HolidayCalendarRecord): CalendarFormValues => ({
  calendarCode: initial?.calendarCode ?? '',
  name: initial?.name ?? '',
  description: initial?.description ?? '',
  externalRef: initial?.externalRef ?? '',
});

const createEntryDefaults = (initial?: HolidayCalendarEntryRecord): EntryFormValues => ({
  date: initial?.date ?? '',
  entryType: initial?.entryType ?? 'HOLIDAY',
  name: initial?.name ?? '',
  description: initial?.description ?? '',
  externalRef: initial?.externalRef ?? '',
});

export const HolidayCalendarCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: BaseSurfaceProps & {
  onSubmit: (payload: HolidayCalendarCreatePayload) => Promise<void> | void;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const form = useForm<CalendarFormValues>({ defaultValues: createCalendarDefaults() });
  const schema = useMemo(
    () =>
      createCalendarSchema(
        t('work-schedule:holidayCalendars.validation.required'),
        t('work-schedule:holidayCalendars.validation.calendarCode'),
      ),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'calendarCode');
      return;
    }

    await onSubmit({
      name: parsed.data.name,
      scopeType: 'GLOBAL',
      timezone: HOLIDAY_CALENDAR_TIMEZONE,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:holidayCalendars.mutations.create.title')}
        subtitle={t('work-schedule:holidayCalendars.mutations.create.subtitle')}
        kind="create"
        submitLabel={t('work-schedule:holidayCalendars.mutations.create.submit')}
        pendingLabel={t('work-schedule:holidayCalendars.mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <InputField<CalendarFormValues>
            name="name"
            label={t('work-schedule:holidayCalendars.fields.name')}
          />
          <ReadOnlyField
            label={t('work-schedule:holidayCalendars.fields.scopeType')}
            value={t('work-schedule:holidayCalendars.scopeTypes.GLOBAL')}
          />
          <ReadOnlyField
            label={t('work-schedule:holidayCalendars.fields.timezone')}
            value={HOLIDAY_CALENDAR_TIMEZONE}
          />
          <InputField<CalendarFormValues>
            name="externalRef"
            label={t('work-schedule:holidayCalendars.fields.externalRef')}
            placeholder={t('work-schedule:placeholders.optional')}
          />
        </FormGrid>
        <InputField<CalendarFormValues>
          name="description"
          label={t('work-schedule:holidayCalendars.fields.description')}
          placeholder={t('work-schedule:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const HolidayCalendarEditSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: BaseSurfaceProps & {
  initialValues: HolidayCalendarRecord;
  onSubmit: (payload: HolidayCalendarUpdatePayload) => Promise<void> | void;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const archived = initialValues.status === 'ARCHIVED';
  const form = useForm<CalendarFormValues>({
    defaultValues: createCalendarDefaults(initialValues),
  });
  const schema = useMemo(
    () => updateCalendarSchema(t('work-schedule:holidayCalendars.validation.required')),
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

    await onSubmit({
      name: parsed.data.name,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:holidayCalendars.mutations.edit.title')}
        subtitle={t('work-schedule:holidayCalendars.mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('work-schedule:holidayCalendars.mutations.edit.submit')}
        pendingLabel={t('work-schedule:holidayCalendars.mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
        isReadOnly={archived}
        readOnlyNotice={
          archived ? (
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('work-schedule:holidayCalendars.detail.archivedReadOnly')}
            </div>
          ) : undefined
        }
      >
        <FormGrid columns={2}>
          <ReadOnlyField
            label={t('work-schedule:holidayCalendars.fields.calendarCode')}
            value={initialValues.calendarCode}
          />
          <InputField<CalendarFormValues>
            disabled={archived}
            name="name"
            label={t('work-schedule:holidayCalendars.fields.name')}
          />
          <ReadOnlyField
            label={t('work-schedule:holidayCalendars.fields.scopeType')}
            value={t('work-schedule:holidayCalendars.scopeTypes.GLOBAL')}
          />
          <ReadOnlyField
            label={t('work-schedule:holidayCalendars.fields.timezone')}
            value={HOLIDAY_CALENDAR_TIMEZONE}
          />
          <InputField<CalendarFormValues>
            disabled={archived}
            name="externalRef"
            label={t('work-schedule:holidayCalendars.fields.externalRef')}
            placeholder={t('work-schedule:placeholders.optional')}
          />
        </FormGrid>
        <InputField<CalendarFormValues>
          disabled={archived}
          name="description"
          label={t('work-schedule:holidayCalendars.fields.description')}
          placeholder={t('work-schedule:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const HolidayCalendarEntrySurface = ({
  initialValues,
  isReadOnly = false,
  onCancel,
  onSubmit,
  isPending = false,
}: BaseSurfaceProps & {
  initialValues?: HolidayCalendarEntryRecord;
  isReadOnly?: boolean;
  onSubmit: (payload: HolidayCalendarEntryPayload) => Promise<void> | void;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const form = useForm<EntryFormValues>({ defaultValues: createEntryDefaults(initialValues) });
  const schema = useMemo(
    () =>
      createEntrySchema(
        t('work-schedule:holidayCalendars.validation.required'),
        t('work-schedule:holidayCalendars.validation.dateOnly'),
      ),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    if (isReadOnly) {
      return;
    }

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'date');
      return;
    }

    await onSubmit({
      date: parsed.data.date,
      entryType: parsed.data.entryType,
      name: parsed.data.name,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={
          initialValues
            ? t('work-schedule:holidayCalendars.entries.editTitle')
            : t('work-schedule:holidayCalendars.entries.addTitle')
        }
        subtitle={t('work-schedule:holidayCalendars.entries.subtitle')}
        kind={initialValues ? 'edit' : 'create'}
        submitLabel={
          initialValues
            ? t('work-schedule:holidayCalendars.entries.update')
            : t('work-schedule:holidayCalendars.entries.add')
        }
        pendingLabel={t('work-schedule:holidayCalendars.entries.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
        isReadOnly={isReadOnly}
      >
        <FormGrid columns={2}>
          <InputField<EntryFormValues>
            disabled={isReadOnly}
            type="date"
            name="date"
            label={t('work-schedule:holidayCalendars.entries.date')}
          />
          <EntryTypeField
            disabled={isReadOnly}
            label={t('work-schedule:holidayCalendars.entries.type')}
          />
          <InputField<EntryFormValues>
            disabled={isReadOnly}
            name="name"
            label={t('work-schedule:holidayCalendars.entries.name')}
          />
          <InputField<EntryFormValues>
            disabled={isReadOnly}
            name="externalRef"
            label={t('work-schedule:holidayCalendars.fields.externalRef')}
            placeholder={t('work-schedule:placeholders.optional')}
          />
        </FormGrid>
        <InputField<EntryFormValues>
          disabled={isReadOnly}
          name="description"
          label={t('work-schedule:holidayCalendars.fields.description')}
          placeholder={t('work-schedule:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
