import { useCallback, useId, useMemo } from 'react';
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
  loadMonthlyRosterHolidayCalendarOptions,
  loadMonthlyRosterOrgUnitOptions,
  loadMonthlyRosterTalentGroupOptions,
  loadMonthlyRosterWorkPatternOptions,
} from '@modules/work-schedule/components/work-schedule-reference-options';
import {
  MONTHLY_ROSTER_TIMEZONE,
  type MonthlyRosterCreatePayload,
  type MonthlyRosterRecord,
  type MonthlyRosterScope,
  type MonthlyRosterTargetType,
  type MonthlyRosterUpdatePayload,
} from '@modules/work-schedule/types/work-schedule.types';
import { AsyncReferencePicker, type ReferenceOption } from '@shared/components/reference';
import { FormGrid } from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type MonthlyRosterFormValues = {
  rosterCode: string;
  rosterMonth: string;
  targetType: MonthlyRosterTargetType;
  targetOrgUnitId: string;
  targetTalentGroupId: string;
  workPatternId: string;
  holidayCalendarId: string;
  scope: MonthlyRosterScope;
  description: string;
  externalRef: string;
};

const monthRegex = /^\d{4}-\d{2}$/;
const VIETNAM_UTC_OFFSET_MILLISECONDS = 7 * 60 * 60 * 1000;

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

const isRealMonth = (value: string): boolean => {
  if (!monthRegex.test(value)) {
    return false;
  }

  const month = Number(value.split('-')[1]);
  return month >= 1 && month <= 12;
};

const toMonthValue = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const getRosterPlanningWindow = (): { min: string; max: string } => {
  const vietnamNow = new Date(Date.now() + VIETNAM_UTC_OFFSET_MILLISECONDS);
  const min = toMonthValue(vietnamNow);
  const max = toMonthValue(
    new Date(Date.UTC(vietnamNow.getUTCFullYear(), vietnamNow.getUTCMonth() + 2, 1)),
  );

  return { min, max };
};

const isMonthWithinPlanningWindow = (value: string): boolean => {
  const { min, max } = getRosterPlanningWindow();
  return value >= min && value <= max;
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
  min,
  max,
}: {
  disabled?: boolean;
  label: string;
  name: Path<TValues>;
  placeholder?: string;
  type?: 'text' | 'month';
  min?: string;
  max?: string;
}): JSX.Element => {
  const id = useId();
  const { register } = useFormContext<TValues>();

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
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

const createSchema = (required: string, month: string, planningWindow: string) =>
  z
    .object({
      rosterCode: z.string().trim().optional(),
      rosterMonth: z
        .string()
        .trim()
        .min(1, required)
        .refine(isRealMonth, month)
        .refine(isMonthWithinPlanningWindow, planningWindow),
      targetType: z.enum(['ORG_UNIT', 'TALENT_GROUP']),
      targetOrgUnitId: z.string().trim(),
      targetTalentGroupId: z.string().trim(),
      workPatternId: z.string().trim().min(1, required),
      holidayCalendarId: z.string().trim().min(1, required),
      scope: z.enum(['department', 'global']),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.targetType === 'ORG_UNIT' && !values.targetOrgUnitId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetOrgUnitId'], message: required });
      }
      if (values.targetType === 'TALENT_GROUP' && !values.targetTalentGroupId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetTalentGroupId'],
          message: required,
        });
      }
    });

const updateSchema = (required: string, month: string) =>
  z
    .object({
      rosterMonth: z.string().trim().min(1, required).refine(isRealMonth, month),
      targetType: z.enum(['ORG_UNIT', 'TALENT_GROUP']),
      targetOrgUnitId: z.string().trim(),
      targetTalentGroupId: z.string().trim(),
      workPatternId: z.string().trim().min(1, required),
      holidayCalendarId: z.string().trim().min(1, required),
      scope: z.enum(['department', 'global']),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.targetType === 'ORG_UNIT' && !values.targetOrgUnitId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetOrgUnitId'], message: required });
      }
      if (values.targetType === 'TALENT_GROUP' && !values.targetTalentGroupId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetTalentGroupId'],
          message: required,
        });
      }
    });

const createDefaultValues = (initial?: MonthlyRosterRecord): MonthlyRosterFormValues => ({
  rosterCode: initial?.rosterCode ?? '',
  rosterMonth: initial?.rosterMonth ?? '',
  targetType: initial?.targetType ?? 'ORG_UNIT',
  targetOrgUnitId: initial?.targetOrgUnitId ?? initial?.departmentOrgUnitId ?? '',
  targetTalentGroupId: initial?.targetTalentGroupId ?? '',
  workPatternId: initial?.workPatternId ?? '',
  holidayCalendarId: initial?.holidayCalendarId ?? '',
  scope: 'global',
  description: initial?.description ?? '',
  externalRef: initial?.externalRef ?? '',
});

const ReferencePickerField = ({
  disabled,
  fieldName,
  label,
  pickerId,
  placeholder,
  loadOptions,
}: {
  disabled?: boolean;
  fieldName: 'targetOrgUnitId' | 'targetTalentGroupId' | 'workPatternId' | 'holidayCalendarId';
  label: string;
  pickerId: string;
  placeholder: string;
  loadOptions: (search: string) => Promise<ReferenceOption[]>;
}): JSX.Element => {
  const { t } = useTranslation(['common']);
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<MonthlyRosterFormValues>();
  const value = watch(fieldName);
  const loadPickerOptions = useCallback((search: string) => loadOptions(search), [loadOptions]);
  const fieldError = get(errors, fieldName)?.message as string | undefined;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium uppercase text-muted">{label}</span>
      <AsyncReferencePicker
        pickerId={pickerId}
        value={value}
        onChange={(nextId) =>
          setValue(fieldName, nextId ?? '', {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          })
        }
        loadOptions={loadPickerOptions}
        disabled={disabled}
        placeholder={placeholder}
      />
      {value && !disabled ? (
        <button
          type="button"
          aria-label={`${t('common:actions.clear')}: ${label}`}
          onClick={() =>
            setValue(fieldName, '', {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })
          }
          className="rounded border border-border bg-panel px-3 py-1.5 text-sm font-medium"
        >
          {t('common:actions.clear')}
        </button>
      ) : null}
      {fieldError ? <p className="text-xs font-medium text-danger">{fieldError}</p> : null}
    </div>
  );
};

const TargetTypeField = ({ disabled }: { disabled?: boolean }): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);
  const { register, setValue, watch } = useFormContext<MonthlyRosterFormValues>();
  const targetType = watch('targetType');

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase text-muted">
        {t('work-schedule:monthlyRosters.fields.targetType')}
      </span>
      <select
        {...register('targetType', {
          onChange: (event) => {
            const nextType = event.target.value as MonthlyRosterTargetType;
            if (nextType === 'ORG_UNIT') {
              setValue('targetTalentGroupId', '', { shouldDirty: true, shouldValidate: true });
            } else {
              setValue('targetOrgUnitId', '', { shouldDirty: true, shouldValidate: true });
            }
          },
        })}
        disabled={disabled}
        className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent disabled:cursor-not-allowed disabled:opacity-70 focus:ring-2"
      >
        <option value="ORG_UNIT">{t('work-schedule:monthlyRosters.targetTypes.ORG_UNIT')}</option>
        <option value="TALENT_GROUP">
          {t('work-schedule:monthlyRosters.targetTypes.TALENT_GROUP')}
        </option>
      </select>
      <FieldError<MonthlyRosterFormValues> name="targetType" />
      <input type="hidden" value={targetType} readOnly />
    </label>
  );
};

export const MonthlyRosterCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: BaseSurfaceProps & {
  onSubmit: (payload: MonthlyRosterCreatePayload) => Promise<void> | void;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const planningWindow = useMemo(getRosterPlanningWindow, []);
  const form = useForm<MonthlyRosterFormValues>({ defaultValues: createDefaultValues() });
  const schema = useMemo(
    () =>
      createSchema(
        t('work-schedule:monthlyRosters.validation.required'),
        t('work-schedule:monthlyRosters.validation.month'),
        t('work-schedule:monthlyRosters.validation.planningWindow'),
      ),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'rosterCode');
      return;
    }

    await onSubmit({
      rosterMonth: parsed.data.rosterMonth,
      timezone: MONTHLY_ROSTER_TIMEZONE,
      targetType: parsed.data.targetType,
      targetMode: 'EXACT_ONLY',
      targetOrgUnitId: parsed.data.targetType === 'ORG_UNIT' ? parsed.data.targetOrgUnitId : null,
      targetTalentGroupId:
        parsed.data.targetType === 'TALENT_GROUP' ? parsed.data.targetTalentGroupId : null,
      workPatternId: parsed.data.workPatternId,
      holidayCalendarId: parsed.data.holidayCalendarId,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
      scope: parsed.data.scope,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:monthlyRosters.mutations.create.title')}
        subtitle={t('work-schedule:monthlyRosters.mutations.create.subtitle')}
        kind="create"
        submitLabel={t('work-schedule:monthlyRosters.mutations.create.submit')}
        pendingLabel={t('work-schedule:monthlyRosters.mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
        banner={
          <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
            {t('work-schedule:monthlyRosters.copy.setupInvariants')}
          </div>
        }
      >
        <FormGrid columns={2}>
          <InputField<MonthlyRosterFormValues>
            type="month"
            name="rosterMonth"
            label={t('work-schedule:monthlyRosters.fields.rosterMonth')}
            min={planningWindow.min}
            max={planningWindow.max}
          />
          <ReadOnlyField
            label={t('work-schedule:monthlyRosters.fields.timezone')}
            value={MONTHLY_ROSTER_TIMEZONE}
          />
          <InputField<MonthlyRosterFormValues>
            name="externalRef"
            label={t('work-schedule:monthlyRosters.fields.externalRef')}
            placeholder={t('work-schedule:placeholders.optional')}
          />
        </FormGrid>
        <FormGrid columns={3}>
          <TargetTypeField />
          <ReferencePickerField
            fieldName={
              form.watch('targetType') === 'ORG_UNIT' ? 'targetOrgUnitId' : 'targetTalentGroupId'
            }
            pickerId={
              form.watch('targetType') === 'ORG_UNIT'
                ? 'monthly-roster-org-unit'
                : 'monthly-roster-talent-group'
            }
            label={
              form.watch('targetType') === 'ORG_UNIT'
                ? t('work-schedule:monthlyRosters.fields.targetOrgUnitId')
                : t('work-schedule:monthlyRosters.fields.targetTalentGroupId')
            }
            placeholder={
              form.watch('targetType') === 'ORG_UNIT'
                ? t('work-schedule:monthlyRosters.pickers.orgUnitSearch')
                : t('work-schedule:monthlyRosters.pickers.talentGroupSearch')
            }
            loadOptions={
              form.watch('targetType') === 'ORG_UNIT'
                ? loadMonthlyRosterOrgUnitOptions
                : loadMonthlyRosterTalentGroupOptions
            }
          />
          <ReferencePickerField
            fieldName="workPatternId"
            pickerId="monthly-roster-work-pattern"
            label={t('work-schedule:monthlyRosters.fields.workPatternId')}
            placeholder={t('work-schedule:monthlyRosters.pickers.workPatternSearch')}
            loadOptions={loadMonthlyRosterWorkPatternOptions}
          />
          <ReferencePickerField
            fieldName="holidayCalendarId"
            pickerId="monthly-roster-holiday-calendar"
            label={t('work-schedule:monthlyRosters.fields.holidayCalendarId')}
            placeholder={t('work-schedule:monthlyRosters.pickers.holidayCalendarSearch')}
            loadOptions={loadMonthlyRosterHolidayCalendarOptions}
          />
        </FormGrid>
        <InputField<MonthlyRosterFormValues>
          name="description"
          label={t('work-schedule:monthlyRosters.fields.description')}
          placeholder={t('work-schedule:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const MonthlyRosterEditSurface = ({
  initialValues,
  structuralLocked = false,
  onCancel,
  onSubmit,
  isPending = false,
}: BaseSurfaceProps & {
  initialValues: MonthlyRosterRecord;
  structuralLocked?: boolean;
  onSubmit: (payload: MonthlyRosterUpdatePayload) => Promise<void> | void;
}): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const planningWindow = useMemo(getRosterPlanningWindow, []);
  const readOnly = initialValues.status !== 'DRAFT';
  const form = useForm<MonthlyRosterFormValues>({
    defaultValues: createDefaultValues(initialValues),
  });
  const schema = useMemo(
    () =>
      updateSchema(
        t('work-schedule:monthlyRosters.validation.required'),
        t('work-schedule:monthlyRosters.validation.month'),
      ),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    if (readOnly) {
      return;
    }

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'rosterMonth');
      return;
    }

    const metadataPayload = {
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
      scope: parsed.data.scope,
    };

    await onSubmit(
      structuralLocked
        ? metadataPayload
        : {
            ...metadataPayload,
            rosterMonth: parsed.data.rosterMonth,
            timezone: MONTHLY_ROSTER_TIMEZONE,
            targetType: parsed.data.targetType,
            targetMode: 'EXACT_ONLY',
            targetOrgUnitId:
              parsed.data.targetType === 'ORG_UNIT' ? parsed.data.targetOrgUnitId : null,
            targetTalentGroupId:
              parsed.data.targetType === 'TALENT_GROUP' ? parsed.data.targetTalentGroupId : null,
            workPatternId: parsed.data.workPatternId,
            holidayCalendarId: parsed.data.holidayCalendarId,
          },
    );
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('work-schedule:monthlyRosters.mutations.edit.title')}
        subtitle={t('work-schedule:monthlyRosters.mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('work-schedule:monthlyRosters.mutations.edit.submit')}
        pendingLabel={t('work-schedule:monthlyRosters.mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
        isReadOnly={readOnly}
        banner={
          <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
            {t('work-schedule:monthlyRosters.copy.setupInvariants')}
          </div>
        }
        readOnlyNotice={
          readOnly ? (
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('work-schedule:monthlyRosters.detail.readOnlyDraftSetup')}
            </div>
          ) : undefined
        }
        lockedNotice={
          structuralLocked && !readOnly ? (
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('work-schedule:monthlyRosters.detail.structuralLock')}
            </div>
          ) : undefined
        }
      >
        <FormGrid columns={2}>
          <ReadOnlyField
            label={t('work-schedule:monthlyRosters.fields.rosterCode')}
            value={initialValues.rosterCode}
          />
          <InputField<MonthlyRosterFormValues>
            disabled={readOnly || structuralLocked}
            type="month"
            name="rosterMonth"
            label={t('work-schedule:monthlyRosters.fields.rosterMonth')}
            min={planningWindow.min}
            max={planningWindow.max}
          />
          <ReadOnlyField
            label={t('work-schedule:monthlyRosters.fields.timezone')}
            value={MONTHLY_ROSTER_TIMEZONE}
          />
          <InputField<MonthlyRosterFormValues>
            disabled={readOnly}
            name="externalRef"
            label={t('work-schedule:monthlyRosters.fields.externalRef')}
            placeholder={t('work-schedule:placeholders.optional')}
          />
        </FormGrid>
        <FormGrid columns={3}>
          <TargetTypeField disabled={readOnly || structuralLocked} />
          <ReferencePickerField
            disabled={readOnly || structuralLocked}
            fieldName={
              form.watch('targetType') === 'ORG_UNIT' ? 'targetOrgUnitId' : 'targetTalentGroupId'
            }
            pickerId={
              form.watch('targetType') === 'ORG_UNIT'
                ? 'monthly-roster-org-unit'
                : 'monthly-roster-talent-group'
            }
            label={
              form.watch('targetType') === 'ORG_UNIT'
                ? t('work-schedule:monthlyRosters.fields.targetOrgUnitId')
                : t('work-schedule:monthlyRosters.fields.targetTalentGroupId')
            }
            placeholder={
              form.watch('targetType') === 'ORG_UNIT'
                ? t('work-schedule:monthlyRosters.pickers.orgUnitSearch')
                : t('work-schedule:monthlyRosters.pickers.talentGroupSearch')
            }
            loadOptions={
              form.watch('targetType') === 'ORG_UNIT'
                ? loadMonthlyRosterOrgUnitOptions
                : loadMonthlyRosterTalentGroupOptions
            }
          />
          <ReferencePickerField
            disabled={readOnly || structuralLocked}
            fieldName="workPatternId"
            pickerId="monthly-roster-work-pattern"
            label={t('work-schedule:monthlyRosters.fields.workPatternId')}
            placeholder={t('work-schedule:monthlyRosters.pickers.workPatternSearch')}
            loadOptions={loadMonthlyRosterWorkPatternOptions}
          />
          <ReferencePickerField
            disabled={readOnly || structuralLocked}
            fieldName="holidayCalendarId"
            pickerId="monthly-roster-holiday-calendar"
            label={t('work-schedule:monthlyRosters.fields.holidayCalendarId')}
            placeholder={t('work-schedule:monthlyRosters.pickers.holidayCalendarSearch')}
            loadOptions={loadMonthlyRosterHolidayCalendarOptions}
          />
        </FormGrid>
        <InputField<MonthlyRosterFormValues>
          disabled={readOnly}
          name="description"
          label={t('work-schedule:monthlyRosters.fields.description')}
          placeholder={t('work-schedule:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
