import { useCallback, useId, useMemo, useState } from 'react';
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
  loadMonthlyRosterEmploymentProfileOptions,
  loadWorkShiftStudioResourceOptions,
} from '@modules/work-schedule/components/work-schedule-reference-options';
import {
  ROSTER_EXCEPTION_TYPES,
  type MonthlyRosterRecord,
  type RosterExceptionPayload,
  type RosterExceptionRecord,
  type RosterExceptionType,
} from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import { AsyncReferencePicker, type ReferenceOption } from '@shared/components/reference';
import { FormGrid } from '@shared/forms';
import { ModuleMutationSurface, MutationFieldErrorSummary } from '@shared/modules';

type BaseSurfaceProps = {
  roster: MonthlyRosterRecord;
  initialValues?: RosterExceptionRecord;
  apiError?: NormalizedApiError | null;
  onCancel: () => void;
  onSubmit: (payload: RosterExceptionPayload) => Promise<void> | void;
  isPending?: boolean;
};

type ExceptionFormValues = {
  exceptionType: RosterExceptionType;
  exceptionDate: string;
  subjectEmploymentProfileId: string;
  title: string;
  startLocalTime: string;
  workingMinutes: string;
  breakMinutes: string;
  studioResourceIds: string[];
  reason: string;
  sourceNote: string;
  description: string;
  externalRef: string;
};

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}$/;

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const daysInRosterMonth = (rosterMonth: string): number => {
  const [year, month] = rosterMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

const rosterMonthBounds = (rosterMonth: string): { min: string; max: string } => ({
  min: `${rosterMonth}-01`,
  max: `${rosterMonth}-${String(daysInRosterMonth(rosterMonth)).padStart(2, '0')}`,
});

const isDateInRosterMonth = (date: string, rosterMonth: string): boolean =>
  dateRegex.test(date) && date.startsWith(`${rosterMonth}-`);

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

const createDefaultValues = (
  roster: MonthlyRosterRecord,
  initial?: RosterExceptionRecord,
): ExceptionFormValues => ({
  exceptionType: initial?.exceptionType ?? 'WORKING_TO_OFF',
  exceptionDate: initial?.exceptionDate ?? `${roster.rosterMonth}-01`,
  subjectEmploymentProfileId: initial?.subjectEmploymentProfileId ?? '',
  title: initial?.title ?? '',
  startLocalTime: initial?.startLocalTime ?? '',
  workingMinutes:
    initial?.workingMinutes === undefined || initial.workingMinutes === null
      ? ''
      : String(initial.workingMinutes),
  breakMinutes:
    initial?.breakMinutes === undefined || initial.breakMinutes === null
      ? ''
      : String(initial.breakMinutes),
  studioResourceIds: initial?.studioResourceIds ?? [],
  reason: initial?.reason ?? '',
  sourceNote: initial?.sourceNote ?? '',
  description: initial?.description ?? '',
  externalRef: initial?.externalRef ?? '',
});

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
  min,
  max,
}: {
  disabled?: boolean;
  label: string;
  name: Path<TValues>;
  placeholder?: string;
  type?: 'text' | 'date' | 'time' | 'number';
  min?: string | number;
  max?: string | number;
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
        min={min}
        max={max}
        {...register(name)}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2"
      />
      <FieldError<TValues> name={name} />
    </label>
  );
};

const SelectField = ({ disabled, label }: { disabled?: boolean; label: string }): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const id = useId();
  const { register } = useFormContext<ExceptionFormValues>();

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <select
        id={id}
        disabled={disabled}
        {...register('exceptionType')}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2"
      >
        {ROSTER_EXCEPTION_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`work-schedule:monthlyRosters.exceptions.types.${type}`)}
          </option>
        ))}
      </select>
      <FieldError<ExceptionFormValues> name="exceptionType" />
    </label>
  );
};

const EmploymentProfilePickerField = ({
  disabled,
  roster,
}: {
  disabled?: boolean;
  roster: MonthlyRosterRecord;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<ExceptionFormValues>();
  const value = watch('subjectEmploymentProfileId');
  const orgUnitFilter =
    roster.targetType === 'ORG_UNIT'
      ? (roster.targetOrgUnitId ?? roster.departmentOrgUnitId ?? undefined)
      : undefined;
  const loadOptions = useCallback(
    (search: string) =>
      loadMonthlyRosterEmploymentProfileOptions(search, orgUnitFilter),
    [orgUnitFilter],
  );

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium uppercase text-muted">
        {t('work-schedule:monthlyRosters.exceptions.fields.subjectEmploymentProfileId')}
      </span>
      <AsyncReferencePicker
        pickerId="monthly-roster-exception-employment-profile"
        value={value}
        onChange={(nextId) =>
          setValue('subjectEmploymentProfileId', nextId ?? '', {
            shouldDirty: true,
            shouldTouch: true,
          })
        }
        loadOptions={loadOptions}
        disabled={disabled}
        placeholder={t('work-schedule:monthlyRosters.exceptions.fields.employeeSearch')}
      />
      {get(errors, 'subjectEmploymentProfileId')?.message ? (
        <p className="text-xs font-medium text-danger">
          {String(get(errors, 'subjectEmploymentProfileId')?.message)}
        </p>
      ) : null}
    </div>
  );
};

const StudioResourcePickerField = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const { setValue, watch } = useFormContext<ExceptionFormValues>();
  const selectedIds = watch('studioResourceIds') ?? [];
  const [knownOptions, setKnownOptions] = useState<ReferenceOption[]>([]);
  const loadOptions = useCallback(
    async (search: string) => {
      const options = await loadWorkShiftStudioResourceOptions(search);
      setKnownOptions((current) => {
        const byId = new Map(current.map((option) => [option.id, option]));
        options.forEach((option) => byId.set(option.id, option));
        return Array.from(byId.values());
      });
      return options;
    },
    [setKnownOptions],
  );
  const optionLabelById = useMemo(
    () => new Map(knownOptions.map((option) => [option.id, option.label])),
    [knownOptions],
  );
  const setSelectedIds = (ids: string[]): void => {
    setValue('studioResourceIds', ids, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase text-muted">
        {t('work-schedule:monthlyRosters.exceptions.fields.studioResources')}
      </span>
      <AsyncReferencePicker
        pickerId="monthly-roster-exception-studio-resources"
        exactOneId={false}
        onChange={(nextId) => {
          if (!nextId || selectedIds.includes(nextId)) {
            return;
          }
          setSelectedIds([...selectedIds, nextId]);
        }}
        loadOptions={loadOptions}
        placeholder={t('work-schedule:pickers.studioResourceSearch')}
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
                onClick={() => setSelectedIds(selectedIds.filter((id) => id !== resourceId))}
                className="rounded border border-border px-1 text-[11px]"
              >
                {t('work-schedule:pickers.removeSelectedResource')}
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">{t('work-schedule:pickers.noResourcesSelected')}</p>
      )}
    </div>
  );
};

const createExceptionSchema = (
  messages: {
    required: string;
    date: string;
    time: string;
    positive: string;
    nonNegative: string;
    month: string;
  },
  rosterMonth: string,
) =>
  z
    .object({
      exceptionType: z.enum(['WORKING_TO_OFF', 'CHANGE_TIME', 'ADD_SPECIAL_SHIFT']),
      exceptionDate: z.string().trim().min(1, messages.required).regex(dateRegex, messages.date),
      subjectEmploymentProfileId: z.string().trim().min(1, messages.required),
      title: z.string().trim(),
      startLocalTime: z.string().trim(),
      workingMinutes: z.string().trim(),
      breakMinutes: z.string().trim(),
      studioResourceIds: z.array(z.string().trim().min(1)),
      reason: z.string().trim(),
      sourceNote: z.string().trim(),
      description: z.string().trim(),
      externalRef: z.string().trim(),
    })
    .superRefine((value, context) => {
      if (!isDateInRosterMonth(value.exceptionDate, rosterMonth)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exceptionDate'],
          message: messages.month,
        });
      }

      if (value.exceptionType === 'WORKING_TO_OFF') {
        return;
      }

      if (!timeRegex.test(value.startLocalTime)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startLocalTime'],
          message: messages.time,
        });
      }

      if (value.exceptionType === 'ADD_SPECIAL_SHIFT') {
        const workingMinutes = Number(value.workingMinutes);
        const breakMinutes = Number(value.breakMinutes);

        if (!value.title) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['title'],
            message: messages.required,
          });
        }
        if (!Number.isInteger(workingMinutes) || workingMinutes <= 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['workingMinutes'],
            message: messages.positive,
          });
        }
        if (!Number.isInteger(breakMinutes) || breakMinutes < 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['breakMinutes'],
            message: messages.nonNegative,
          });
        }
      }
    });

const translateErrorMessage = (t: (key: string) => string, message: string): string =>
  message.includes(':') ? t(message) : message;

export const MonthlyRosterExceptionSurface = ({
  roster,
  initialValues,
  apiError,
  onCancel,
  onSubmit,
  isPending = false,
}: BaseSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const form = useForm<ExceptionFormValues>({
    defaultValues: createDefaultValues(roster, initialValues),
  });
  const exceptionType = form.watch('exceptionType');
  const bounds = rosterMonthBounds(roster.rosterMonth);
  const translatedFieldErrors = apiError?.fieldErrors
    ? Object.fromEntries(
        Object.entries(apiError.fieldErrors).map(([field, messages]) => [
          field,
          messages.map((message) => translateErrorMessage(t, message)),
        ]),
      )
    : undefined;
  const schema = useMemo(
    () =>
      createExceptionSchema(
        {
          required: t('work-schedule:monthlyRosters.exceptions.validation.required'),
          date: t('work-schedule:monthlyRosters.exceptions.validation.date'),
          time: t('work-schedule:monthlyRosters.exceptions.validation.time'),
          positive: t('work-schedule:monthlyRosters.exceptions.validation.positiveMinutes'),
          nonNegative: t('work-schedule:monthlyRosters.exceptions.validation.nonNegativeMinutes'),
          month: t('work-schedule:monthlyRosters.exceptions.validation.dateInMonth'),
        },
        roster.rosterMonth,
      ),
    [roster.rosterMonth, t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'exceptionType');
      return;
    }

    const common = {
      exceptionType: parsed.data.exceptionType,
      exceptionDate: parsed.data.exceptionDate,
      subjectEmploymentProfileId: parsed.data.subjectEmploymentProfileId,
      reason: toNullableText(parsed.data.reason),
      sourceNote: toNullableText(parsed.data.sourceNote),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    };

    if (parsed.data.exceptionType === 'WORKING_TO_OFF') {
      await onSubmit(common);
      return;
    }

    if (parsed.data.exceptionType === 'CHANGE_TIME') {
      await onSubmit({
        ...common,
        startLocalTime: parsed.data.startLocalTime,
      });
      return;
    }

    await onSubmit({
      ...common,
      title: parsed.data.title,
      startLocalTime: parsed.data.startLocalTime,
      workingMinutes: Number(parsed.data.workingMinutes),
      breakMinutes: Number(parsed.data.breakMinutes),
      studioResourceIds: parsed.data.studioResourceIds,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={
          initialValues
            ? t('work-schedule:monthlyRosters.exceptions.mutations.edit.title')
            : t('work-schedule:monthlyRosters.exceptions.mutations.add.title')
        }
        subtitle={t('work-schedule:monthlyRosters.exceptions.mutations.subtitle')}
        kind={initialValues ? 'edit' : 'create'}
        submitLabel={
          initialValues
            ? t('work-schedule:monthlyRosters.exceptions.mutations.edit.submit')
            : t('work-schedule:monthlyRosters.exceptions.mutations.add.submit')
        }
        pendingLabel={t('work-schedule:monthlyRosters.exceptions.mutations.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
        blocker={
          apiError ? (
            <div className="rounded border border-danger/30 bg-rose-50 px-3 py-2 text-sm text-danger">
              {translateErrorMessage(t, apiError.message)}
            </div>
          ) : undefined
        }
        fieldErrorSummary={<MutationFieldErrorSummary errors={translatedFieldErrors} />}
      >
        <FormGrid columns={2}>
          <SelectField label={t('work-schedule:monthlyRosters.exceptions.fields.type')} />
          <InputField<ExceptionFormValues>
            type="date"
            min={bounds.min}
            max={bounds.max}
            name="exceptionDate"
            label={t('work-schedule:monthlyRosters.exceptions.fields.exceptionDate')}
          />
        </FormGrid>
        <EmploymentProfilePickerField roster={roster} />
        {exceptionType === 'WORKING_TO_OFF' ? (
          <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
            {t('work-schedule:monthlyRosters.exceptions.copy.workingToOffNoTime')}
          </div>
        ) : null}
        {exceptionType === 'CHANGE_TIME' ? (
          <FormGrid columns={2}>
            <InputField<ExceptionFormValues>
              type="time"
              name="startLocalTime"
              label={t('work-schedule:monthlyRosters.exceptions.fields.startLocalTime')}
            />
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              <p className="text-xs font-medium uppercase text-muted">
                {t('work-schedule:monthlyRosters.exceptions.fields.endLocalTime')}
              </p>
              <p className="mt-1">
                {t('work-schedule:monthlyRosters.exceptions.copy.endCalculated')}
              </p>
            </div>
          </FormGrid>
        ) : null}
        {exceptionType === 'ADD_SPECIAL_SHIFT' ? (
          <>
            <FormGrid columns={2}>
              <InputField<ExceptionFormValues>
                name="title"
                label={t('work-schedule:monthlyRosters.exceptions.fields.title')}
              />
              <InputField<ExceptionFormValues>
                type="time"
                name="startLocalTime"
                label={t('work-schedule:monthlyRosters.exceptions.fields.startLocalTime')}
              />
              <InputField<ExceptionFormValues>
                type="number"
                min={1}
                name="workingMinutes"
                label={t('work-schedule:monthlyRosters.exceptions.fields.workingMinutes')}
              />
              <InputField<ExceptionFormValues>
                type="number"
                min={0}
                name="breakMinutes"
                label={t('work-schedule:monthlyRosters.exceptions.fields.breakMinutes')}
              />
              <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
                <p className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:monthlyRosters.exceptions.fields.endLocalTime')}
                </p>
                <p className="mt-1">
                  {t('work-schedule:monthlyRosters.exceptions.copy.endCalculated')}
                </p>
              </div>
            </FormGrid>
            <StudioResourcePickerField />
          </>
        ) : null}
        <FormGrid columns={2}>
          <InputField<ExceptionFormValues>
            name="reason"
            label={t('work-schedule:monthlyRosters.exceptions.fields.reason')}
          />
          <InputField<ExceptionFormValues>
            name="sourceNote"
            label={t('work-schedule:monthlyRosters.exceptions.fields.sourceNote')}
          />
          <InputField<ExceptionFormValues>
            name="externalRef"
            label={t('work-schedule:monthlyRosters.exceptions.fields.externalRef')}
          />
          <InputField<ExceptionFormValues>
            name="description"
            label={t('work-schedule:monthlyRosters.exceptions.fields.description')}
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};
