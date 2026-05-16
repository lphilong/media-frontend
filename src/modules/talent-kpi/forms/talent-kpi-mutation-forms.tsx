import { useMemo } from 'react';
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type {
  TalentKpiCreatePayload,
  TalentKpiDraftCorePayload,
  TalentKpiMetric,
  TalentKpiMetricCode,
  TalentKpiMetricInput,
  TalentKpiMetricsReplacementPayload,
  TalentKpiRecord,
} from '@modules/talent-kpi/types/talent-kpi.types';
import { talentKpiMetricCodeValues } from '@modules/talent-kpi/types/talent-kpi.types';
import {
  loadEventReferenceOptions,
  loadPlatformAccountReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import {
  FormGrid,
  GeneratedCodeNotice,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type TalentKpiCreateSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: TalentKpiCreatePayload) => Promise<void> | void;
};

type TalentKpiDraftCoreSurfaceProps = BaseSurfaceProps & {
  initialValues: TalentKpiRecord;
  onSubmit: (payload: TalentKpiDraftCorePayload) => Promise<void> | void;
};

type TalentKpiMetricsSurfaceProps = BaseSurfaceProps & {
  initialMetrics: TalentKpiMetric[];
  onSubmit: (payload: TalentKpiMetricsReplacementPayload) => Promise<void> | void;
};

type MetricFormRow = {
  metricCode: TalentKpiMetricCode;
  numericValue: string;
};

type TalentKpiCreateFormValues = {
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId: string;
  attributionEventId: string;
  measurementSource: 'MANUAL';
  periodStartAt: string;
  periodEndAt: string;
  metrics: MetricFormRow[];
  description: string;
  externalRef: string;
};

type TalentKpiDraftCoreFormValues = Omit<
  TalentKpiCreateFormValues,
  'measurementSource' | 'metrics'
>;

type TalentKpiMetricsFormValues = {
  metrics: MetricFormRow[];
};

const idRegex = /^[A-Za-z0-9_-]+$/;
const decimalMetricCodes: TalentKpiMetricCode[] = ['LIVESTREAM_HOURS', 'REVENUE_ATTRIBUTED_AMOUNT'];
const nonNegativeIntegerMetricCodes: TalentKpiMetricCode[] = [
  'LIVESTREAM_SESSION_COUNT',
  'CONTENT_PUBLISH_COUNT',
  'EVENT_APPEARANCE_COUNT',
  'ENGAGEMENT_COUNT',
];

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const toTimestampText = (value?: number | string | null): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return String(value);
};

const applySchemaErrors = <TValues extends FieldValues>(
  setError: UseFormSetError<TValues>,
  error: z.ZodError,
  fallbackField: Path<TValues>,
): void => {
  error.issues.forEach((issue) => {
    const field = (issue.path.length > 0 ? issue.path.join('.') : fallbackField) as Path<TValues>;
    setError(field, {
      type: 'validate',
      message: issue.message,
    });
  });
};

const parseIntegerTimestamp = (value: string): number | undefined => {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const parseMetricValue = (
  metricCode: TalentKpiMetricCode,
  rawValue: string,
): number | undefined => {
  if (rawValue.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  if (decimalMetricCodes.includes(metricCode)) {
    return parsed >= 0 && /^\d+(\.\d{1,2})?$/.test(rawValue.trim()) ? parsed : undefined;
  }

  if (nonNegativeIntegerMetricCodes.includes(metricCode)) {
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }

  return Number.isInteger(parsed) ? parsed : undefined;
};

const buildMetricRowsSchema = (messages: {
  required: string;
  metricValue: string;
  duplicateMetricCode: string;
}) =>
  z
    .array(
      z.object({
        metricCode: z.enum(
          talentKpiMetricCodeValues as [TalentKpiMetricCode, ...TalentKpiMetricCode[]],
        ),
        numericValue: z.string().trim().min(1, messages.required),
      }),
    )
    .min(1, messages.required)
    .superRefine((metrics, context) => {
      const seen = new Set<TalentKpiMetricCode>();
      metrics.forEach((metric, index) => {
        if (seen.has(metric.metricCode)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'metricCode'],
            message: messages.duplicateMetricCode,
          });
        }
        seen.add(metric.metricCode);

        if (parseMetricValue(metric.metricCode, metric.numericValue) === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'numericValue'],
            message: messages.metricValue,
          });
        }
      });
    });

const buildCoreSchema = (messages: {
  required: string;
  token: string;
  timestamp: string;
  periodWindow: string;
}) =>
  z
    .object({
      title: z.string().trim().min(1, messages.required),
      subjectTalentId: z.string().trim().min(1, messages.required).regex(idRegex, messages.token),
      attributionPlatformAccountId: z.string().trim().optional(),
      attributionEventId: z.string().trim().optional(),
      periodStartAt: z.string().trim().min(1, messages.timestamp),
      periodEndAt: z.string().trim().min(1, messages.timestamp),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const start = parseIntegerTimestamp(value.periodStartAt);
      const end = parseIntegerTimestamp(value.periodEndAt);
      if (start === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periodStartAt'],
          message: messages.timestamp,
        });
      }
      if (end === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periodEndAt'],
          message: messages.timestamp,
        });
      }
      if (start !== undefined && end !== undefined && end <= start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periodEndAt'],
          message: messages.periodWindow,
        });
      }
    });

const buildCreateSchema = (messages: {
  required: string;
  token: string;
  timestamp: string;
  periodWindow: string;
  metricValue: string;
  duplicateMetricCode: string;
}) =>
  z
    .object({
      title: z.string().trim().min(1, messages.required),
      subjectTalentId: z.string().trim().min(1, messages.required).regex(idRegex, messages.token),
      attributionPlatformAccountId: z.string().trim().optional(),
      attributionEventId: z.string().trim().optional(),
      measurementSource: z.literal('MANUAL'),
      periodStartAt: z.string().trim().min(1, messages.timestamp),
      periodEndAt: z.string().trim().min(1, messages.timestamp),
      metrics: buildMetricRowsSchema(messages),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const start = parseIntegerTimestamp(value.periodStartAt);
      const end = parseIntegerTimestamp(value.periodEndAt);
      if (start === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periodStartAt'],
          message: messages.timestamp,
        });
      }
      if (end === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periodEndAt'],
          message: messages.timestamp,
        });
      }
      if (start !== undefined && end !== undefined && end <= start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['periodEndAt'],
          message: messages.periodWindow,
        });
      }
    });

const toMetricInputs = (rows: MetricFormRow[]): TalentKpiMetricInput[] =>
  rows.map((row) => ({
    metricCode: row.metricCode,
    numericValue: parseMetricValue(row.metricCode, row.numericValue) ?? 0,
  }));

const useTalentKpiOptions = () => {
  const { t } = useTranslation(['talent-kpi']);
  return {
    metricCodes: talentKpiMetricCodeValues.map((value) => ({
      value,
      label: t(`talent-kpi:metricCodes.${value}`),
    })),
    measurementSources: [{ value: 'MANUAL', label: t('talent-kpi:measurementSources.MANUAL') }],
  };
};

const MetricRowsEditor = (): JSX.Element => {
  const { t } = useTranslation(['talent-kpi']);
  const options = useTalentKpiOptions();
  const { control, register, formState } = useFormContext<TalentKpiMetricsFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metrics',
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">
            {t('talent-kpi:mutations.metrics.rowsTitle')}
          </h3>
        </div>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs"
          onClick={() => append({ metricCode: 'ENGAGEMENT_COUNT', numericValue: '0' })}
        >
          {t('talent-kpi:actions.addMetric')}
        </button>
      </div>
      {fields.map((field, index) => {
        const codeError = formState.errors.metrics?.[index]?.metricCode?.message;
        const valueError = formState.errors.metrics?.[index]?.numericValue?.message;

        return (
          <div key={field.id} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('talent-kpi:fields.metricCode')}
              </span>
              <select
                {...register(`metrics.${index}.metricCode`)}
                className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              >
                {options.metricCodes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {codeError ? <span className="text-xs text-danger">{codeError}</span> : null}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('talent-kpi:fields.numericValue')}
              </span>
              <input
                type="number"
                step="0.01"
                {...register(`metrics.${index}.numericValue`)}
                className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              />
              {valueError ? <span className="text-xs text-danger">{valueError}</span> : null}
            </label>
            <button
              type="button"
              className="self-end rounded border border-border px-2 py-2 text-xs"
              onClick={() => remove(index)}
            >
              {t('talent-kpi:actions.removeMetric')}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const TalentKpiCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: TalentKpiCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent-kpi', 'common']);
  const options = useTalentKpiOptions();
  const form = useForm<TalentKpiCreateFormValues>({
    defaultValues: {
      title: '',
      subjectTalentId: '',
      attributionPlatformAccountId: '',
      attributionEventId: '',
      measurementSource: 'MANUAL',
      periodStartAt: '',
      periodEndAt: '',
      metrics: [{ metricCode: 'ENGAGEMENT_COUNT', numericValue: '0' }],
      description: '',
      externalRef: '',
    },
  });
  const schema = useMemo(
    () =>
      buildCreateSchema({
        required: t('talent-kpi:validation.required'),
        token: t('talent-kpi:validation.invalidToken'),
        timestamp: t('talent-kpi:validation.invalidTimestamp'),
        periodWindow: t('talent-kpi:validation.periodWindow'),
        metricValue: t('talent-kpi:validation.metricValue'),
        duplicateMetricCode: t('talent-kpi:validation.duplicateMetricCode'),
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
      subjectTalentId: parsed.data.subjectTalentId,
      attributionPlatformAccountId: toNullableText(parsed.data.attributionPlatformAccountId),
      attributionEventId: toNullableText(parsed.data.attributionEventId),
      measurementSource: 'MANUAL',
      periodStartAt: parseIntegerTimestamp(parsed.data.periodStartAt) ?? 0,
      periodEndAt: parseIntegerTimestamp(parsed.data.periodEndAt) ?? 0,
      metrics: toMetricInputs(parsed.data.metrics),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent-kpi:mutations.create.title')}
        subtitle={t('talent-kpi:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('talent-kpi:mutations.create.submit')}
        pendingLabel={t('talent-kpi:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('talent-kpi:generatedCode.label')}
            description={t('talent-kpi:generatedCode.description')}
            className="md:col-span-2"
          />
          <TextInputField name="title" label={t('talent-kpi:fields.title')} />
          <ReferencePickerField
            name="subjectTalentId"
            label={t('talent-kpi:fields.subjectTalentId')}
            pickerId="talent-kpi-subject-talent"
            loadOptions={loadTalentReferenceOptions}
            placeholder={t('talent-kpi:placeholders.searchReference')}
          />
          <ReferencePickerField
            name="attributionPlatformAccountId"
            label={t('talent-kpi:fields.attributionPlatformAccountId')}
            pickerId="talent-kpi-platform-account"
            loadOptions={loadPlatformAccountReferenceOptions}
            placeholder={t('talent-kpi:placeholders.searchReference')}
            clearable
            clearLabel={t('talent-kpi:actions.clearReference')}
          />
          <ReferencePickerField
            name="attributionEventId"
            label={t('talent-kpi:fields.attributionEventId')}
            pickerId="talent-kpi-event"
            loadOptions={loadEventReferenceOptions}
            placeholder={t('talent-kpi:placeholders.searchReference')}
            clearable
            clearLabel={t('talent-kpi:actions.clearReference')}
          />
          <SelectField
            name="measurementSource"
            label={t('talent-kpi:fields.measurementSource')}
            options={options.measurementSources}
          />
          <TextInputField
            name="periodStartAt"
            type="number"
            label={t('talent-kpi:fields.periodStartAt')}
          />
          <TextInputField
            name="periodEndAt"
            type="number"
            label={t('talent-kpi:fields.periodEndAt')}
          />
          <TextInputField name="externalRef" label={t('talent-kpi:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('talent-kpi:fields.description')} />
        <MetricRowsEditor />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const TalentKpiDraftCoreSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: TalentKpiDraftCoreSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent-kpi', 'common']);
  const form = useForm<TalentKpiDraftCoreFormValues>({
    defaultValues: {
      title: initialValues.title,
      subjectTalentId: initialValues.subjectTalentId,
      attributionPlatformAccountId: initialValues.attributionPlatformAccountId ?? '',
      attributionEventId: initialValues.attributionEventId ?? '',
      periodStartAt: toTimestampText(initialValues.periodStartAt),
      periodEndAt: toTimestampText(initialValues.periodEndAt),
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });
  const schema = useMemo(
    () =>
      buildCoreSchema({
        required: t('talent-kpi:validation.required'),
        token: t('talent-kpi:validation.invalidToken'),
        timestamp: t('talent-kpi:validation.invalidTimestamp'),
        periodWindow: t('talent-kpi:validation.periodWindow'),
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
      subjectTalentId: parsed.data.subjectTalentId,
      attributionPlatformAccountId: toNullableText(parsed.data.attributionPlatformAccountId),
      attributionEventId: toNullableText(parsed.data.attributionEventId),
      periodStartAt: parseIntegerTimestamp(parsed.data.periodStartAt),
      periodEndAt: parseIntegerTimestamp(parsed.data.periodEndAt),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent-kpi:mutations.draftCore.title')}
        subtitle={t('talent-kpi:mutations.draftCore.subtitle')}
        kind="edit"
        submitLabel={t('talent-kpi:mutations.draftCore.submit')}
        pendingLabel={t('talent-kpi:mutations.draftCore.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="title" label={t('talent-kpi:fields.title')} />
          <ReferencePickerField
            name="subjectTalentId"
            label={t('talent-kpi:fields.subjectTalentId')}
            pickerId="talent-kpi-draft-subject-talent"
            loadOptions={loadTalentReferenceOptions}
            placeholder={t('talent-kpi:placeholders.searchReference')}
          />
          <ReferencePickerField
            name="attributionPlatformAccountId"
            label={t('talent-kpi:fields.attributionPlatformAccountId')}
            pickerId="talent-kpi-draft-platform-account"
            loadOptions={loadPlatformAccountReferenceOptions}
            placeholder={t('talent-kpi:placeholders.searchReference')}
            clearable
            clearLabel={t('talent-kpi:actions.clearReference')}
          />
          <ReferencePickerField
            name="attributionEventId"
            label={t('talent-kpi:fields.attributionEventId')}
            pickerId="talent-kpi-draft-event"
            loadOptions={loadEventReferenceOptions}
            placeholder={t('talent-kpi:placeholders.searchReference')}
            clearable
            clearLabel={t('talent-kpi:actions.clearReference')}
          />
          <TextInputField
            name="periodStartAt"
            type="number"
            label={t('talent-kpi:fields.periodStartAt')}
          />
          <TextInputField
            name="periodEndAt"
            type="number"
            label={t('talent-kpi:fields.periodEndAt')}
          />
          <TextInputField name="externalRef" label={t('talent-kpi:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('talent-kpi:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const TalentKpiMetricsSurface = ({
  initialMetrics,
  onCancel,
  onSubmit,
  isPending = false,
}: TalentKpiMetricsSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent-kpi', 'common']);
  const form = useForm<TalentKpiMetricsFormValues>({
    defaultValues: {
      metrics:
        initialMetrics.length > 0
          ? initialMetrics.map((metric) => ({
              metricCode: metric.metricCode,
              numericValue: String(metric.numericValue),
            }))
          : [{ metricCode: 'ENGAGEMENT_COUNT', numericValue: '0' }],
    },
  });
  const schema = useMemo(
    () =>
      z.object({
        metrics: buildMetricRowsSchema({
          required: t('talent-kpi:validation.required'),
          metricValue: t('talent-kpi:validation.metricValue'),
          duplicateMetricCode: t('talent-kpi:validation.duplicateMetricCode'),
        }),
      }),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'metrics');
      return;
    }

    await onSubmit({ metrics: toMetricInputs(parsed.data.metrics) });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent-kpi:mutations.metrics.title')}
        subtitle={t('talent-kpi:mutations.metrics.subtitle')}
        kind="action"
        submitLabel={t('talent-kpi:mutations.metrics.submit')}
        pendingLabel={t('talent-kpi:mutations.metrics.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <MetricRowsEditor />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const parseTalentKpiMetricRowsForTest = (rows: MetricFormRow[]): TalentKpiMetricInput[] =>
  toMetricInputs(rows);
