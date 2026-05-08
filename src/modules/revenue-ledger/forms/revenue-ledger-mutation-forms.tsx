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
  RevenueEntryCreatePayload,
  RevenueEntryDraftCorePayload,
  RevenueEntryReconcilePayload,
  RevenueEntryRecord,
  RevenueKind,
} from '@modules/revenue-ledger/types/revenue-ledger.types';
import { revenueKindValues } from '@modules/revenue-ledger/types/revenue-ledger.types';
import { FormGrid, SelectField, TextInputField } from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type RevenueEntryCreateSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: RevenueEntryCreatePayload) => Promise<void> | void;
};

type RevenueEntryDraftCoreSurfaceProps = BaseSurfaceProps & {
  initialValues: RevenueEntryRecord;
  onSubmit: (payload: RevenueEntryDraftCorePayload) => Promise<void> | void;
};

type RevenueEntryReconcileSurfaceProps = BaseSurfaceProps & {
  initialReconciliationReference?: string | null;
  onSubmit: (payload: RevenueEntryReconcilePayload) => Promise<void> | void;
};

type RevenueEntryCreateFormValues = {
  revenueEntryCode: string;
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId: string;
  attributionEventId: string;
  revenueKind: RevenueKind;
  entrySource: 'MANUAL';
  currencyCode: string;
  recognizedAmount: string;
  recognizedAt: string;
  description: string;
  externalRef: string;
};

type RevenueEntryDraftCoreFormValues = Omit<
  RevenueEntryCreateFormValues,
  'revenueEntryCode' | 'entrySource'
>;

type RevenueEntryReconcileFormValues = {
  reconciliationReference: string;
};

const idRegex = /^[A-Za-z0-9_-]+$/;
const codeRegex = /^[A-Z][A-Z0-9_]*$/;
const currencyRegex = /^[A-Z]{3}$/;
const amountRegex = /^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/;

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

const parseIntegerTimestamp = (value: string): number | undefined => {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const parseAmount = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!amountRegex.test(trimmed)) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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

const buildCoreSchema = (messages: {
  required: string;
  token: string;
  currency: string;
  amount: string;
  timestamp: string;
  futureTimestamp: string;
  attributionPlatformRequired: string;
  attributionEventRequired: string;
}) =>
  z
    .object({
      title: z.string().trim().min(1, messages.required),
      subjectTalentId: z.string().trim().min(1, messages.required).regex(idRegex, messages.token),
      attributionPlatformAccountId: z.string().trim().optional(),
      attributionEventId: z.string().trim().optional(),
      revenueKind: z.enum(revenueKindValues as [RevenueKind, ...RevenueKind[]]),
      currencyCode: z.string().trim().regex(currencyRegex, messages.currency),
      recognizedAmount: z.string().trim().min(1, messages.amount),
      recognizedAt: z.string().trim().min(1, messages.timestamp),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const recognizedAmount = parseAmount(value.recognizedAmount);
      const recognizedAt = parseIntegerTimestamp(value.recognizedAt);

      if (recognizedAmount === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recognizedAmount'],
          message: messages.amount,
        });
      }

      if (recognizedAt === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recognizedAt'],
          message: messages.timestamp,
        });
      } else if (recognizedAt > Date.now()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recognizedAt'],
          message: messages.futureTimestamp,
        });
      }

      if (
        (value.revenueKind === 'PLATFORM_LIVESTREAM' || value.revenueKind === 'PLATFORM_CONTENT') &&
        !value.attributionPlatformAccountId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attributionPlatformAccountId'],
          message: messages.attributionPlatformRequired,
        });
      }

      if (value.revenueKind === 'EVENT_OPERATIONAL' && !value.attributionEventId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attributionEventId'],
          message: messages.attributionEventRequired,
        });
      }
    });

const buildCreateSchema = (messages: Parameters<typeof buildCoreSchema>[0]) =>
  z
    .object({
      revenueEntryCode: z
        .string()
        .trim()
        .min(1, messages.required)
        .regex(codeRegex, messages.token),
      title: z.string().trim().min(1, messages.required),
      subjectTalentId: z.string().trim().min(1, messages.required).regex(idRegex, messages.token),
      attributionPlatformAccountId: z.string().trim().optional(),
      attributionEventId: z.string().trim().optional(),
      revenueKind: z.enum(revenueKindValues as [RevenueKind, ...RevenueKind[]]),
      entrySource: z.literal('MANUAL'),
      currencyCode: z.string().trim().regex(currencyRegex, messages.currency),
      recognizedAmount: z.string().trim().min(1, messages.amount),
      recognizedAt: z.string().trim().min(1, messages.timestamp),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const recognizedAmount = parseAmount(value.recognizedAmount);
      const recognizedAt = parseIntegerTimestamp(value.recognizedAt);

      if (recognizedAmount === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recognizedAmount'],
          message: messages.amount,
        });
      }

      if (recognizedAt === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recognizedAt'],
          message: messages.timestamp,
        });
      } else if (recognizedAt > Date.now()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recognizedAt'],
          message: messages.futureTimestamp,
        });
      }

      if (
        (value.revenueKind === 'PLATFORM_LIVESTREAM' || value.revenueKind === 'PLATFORM_CONTENT') &&
        !value.attributionPlatformAccountId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attributionPlatformAccountId'],
          message: messages.attributionPlatformRequired,
        });
      }

      if (value.revenueKind === 'EVENT_OPERATIONAL' && !value.attributionEventId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attributionEventId'],
          message: messages.attributionEventRequired,
        });
      }
    });

const useRevenueOptions = () => {
  const { t } = useTranslation(['revenue-ledger']);
  return {
    revenueKinds: revenueKindValues.map((value) => ({
      value,
      label: t(`revenue-ledger:revenueKinds.${value}`),
    })),
    entrySources: [{ value: 'MANUAL', label: t('revenue-ledger:entrySources.MANUAL') }],
  };
};

const buildValidationMessages = (t: (key: string) => string) => ({
  required: t('revenue-ledger:validation.required'),
  token: t('revenue-ledger:validation.invalidToken'),
  currency: t('revenue-ledger:validation.invalidCurrency'),
  amount: t('revenue-ledger:validation.invalidAmount'),
  timestamp: t('revenue-ledger:validation.invalidTimestamp'),
  futureTimestamp: t('revenue-ledger:validation.futureTimestamp'),
  attributionPlatformRequired: t('revenue-ledger:validation.attributionPlatformRequired'),
  attributionEventRequired: t('revenue-ledger:validation.attributionEventRequired'),
});

const toCorePayload = (values: {
  title: string;
  subjectTalentId: string;
  attributionPlatformAccountId?: string;
  attributionEventId?: string;
  revenueKind: RevenueKind;
  currencyCode: string;
  recognizedAmount: string;
  recognizedAt: string;
  description?: string;
  externalRef?: string;
}): RevenueEntryDraftCorePayload => ({
  title: values.title,
  subjectTalentId: values.subjectTalentId,
  attributionPlatformAccountId: toNullableText(values.attributionPlatformAccountId),
  attributionEventId: toNullableText(values.attributionEventId),
  revenueKind: values.revenueKind,
  currencyCode: values.currencyCode,
  recognizedAmount: parseAmount(values.recognizedAmount),
  recognizedAt: parseIntegerTimestamp(values.recognizedAt),
  description: toNullableText(values.description),
  externalRef: toNullableText(values.externalRef),
});

export const RevenueEntryCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: RevenueEntryCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['revenue-ledger', 'common']);
  const options = useRevenueOptions();
  const form = useForm<RevenueEntryCreateFormValues>({
    defaultValues: {
      revenueEntryCode: '',
      title: '',
      subjectTalentId: '',
      attributionPlatformAccountId: '',
      attributionEventId: '',
      revenueKind: 'PLATFORM_LIVESTREAM',
      entrySource: 'MANUAL',
      currencyCode: 'VND',
      recognizedAmount: '',
      recognizedAt: '',
      description: '',
      externalRef: '',
    },
  });
  const schema = useMemo(() => buildCreateSchema(buildValidationMessages(t)), [t]);
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'revenueEntryCode');
      return;
    }

    const corePayload = toCorePayload(parsed.data);
    await onSubmit({
      revenueEntryCode: parsed.data.revenueEntryCode,
      title: corePayload.title ?? parsed.data.title,
      subjectTalentId: corePayload.subjectTalentId ?? parsed.data.subjectTalentId,
      attributionPlatformAccountId: corePayload.attributionPlatformAccountId ?? null,
      attributionEventId: corePayload.attributionEventId ?? null,
      revenueKind: corePayload.revenueKind ?? parsed.data.revenueKind,
      entrySource: 'MANUAL',
      currencyCode: corePayload.currencyCode ?? parsed.data.currencyCode,
      recognizedAmount: corePayload.recognizedAmount ?? 0,
      recognizedAt: corePayload.recognizedAt ?? 0,
      description: corePayload.description ?? null,
      externalRef: corePayload.externalRef ?? null,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('revenue-ledger:mutations.create.title')}
        subtitle={t('revenue-ledger:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('revenue-ledger:mutations.create.submit')}
        pendingLabel={t('revenue-ledger:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField
            name="revenueEntryCode"
            label={t('revenue-ledger:fields.revenueEntryCode')}
          />
          <TextInputField name="title" label={t('revenue-ledger:fields.title')} />
          <TextInputField
            name="subjectTalentId"
            label={t('revenue-ledger:fields.subjectTalentId')}
          />
          <SelectField
            name="revenueKind"
            label={t('revenue-ledger:fields.revenueKind')}
            options={options.revenueKinds}
          />
          <TextInputField
            name="attributionPlatformAccountId"
            label={t('revenue-ledger:fields.attributionPlatformAccountId')}
          />
          <TextInputField
            name="attributionEventId"
            label={t('revenue-ledger:fields.attributionEventId')}
          />
          <SelectField
            name="entrySource"
            label={t('revenue-ledger:fields.entrySource')}
            options={options.entrySources}
          />
          <TextInputField name="currencyCode" label={t('revenue-ledger:fields.currencyCode')} />
          <TextInputField
            name="recognizedAmount"
            type="number"
            step="0.01"
            min="0"
            label={t('revenue-ledger:fields.recognizedAmount')}
          />
          <TextInputField
            name="recognizedAt"
            type="number"
            label={t('revenue-ledger:fields.recognizedAt')}
          />
          <TextInputField name="externalRef" label={t('revenue-ledger:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('revenue-ledger:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const RevenueEntryDraftCoreSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: RevenueEntryDraftCoreSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['revenue-ledger', 'common']);
  const options = useRevenueOptions();
  const form = useForm<RevenueEntryDraftCoreFormValues>({
    defaultValues: {
      title: initialValues.title,
      subjectTalentId: initialValues.subjectTalentId,
      attributionPlatformAccountId: initialValues.attributionPlatformAccountId ?? '',
      attributionEventId: initialValues.attributionEventId ?? '',
      revenueKind: initialValues.revenueKind,
      currencyCode: initialValues.currencyCode,
      recognizedAmount: String(initialValues.recognizedAmount),
      recognizedAt: toTimestampText(initialValues.recognizedAt),
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });
  const schema = useMemo(() => buildCoreSchema(buildValidationMessages(t)), [t]);
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    await onSubmit(toCorePayload(parsed.data));
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('revenue-ledger:mutations.draftCore.title')}
        subtitle={t('revenue-ledger:mutations.draftCore.subtitle')}
        kind="edit"
        submitLabel={t('revenue-ledger:mutations.draftCore.submit')}
        pendingLabel={t('revenue-ledger:mutations.draftCore.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="title" label={t('revenue-ledger:fields.title')} />
          <TextInputField
            name="subjectTalentId"
            label={t('revenue-ledger:fields.subjectTalentId')}
          />
          <SelectField
            name="revenueKind"
            label={t('revenue-ledger:fields.revenueKind')}
            options={options.revenueKinds}
          />
          <TextInputField
            name="attributionPlatformAccountId"
            label={t('revenue-ledger:fields.attributionPlatformAccountId')}
          />
          <TextInputField
            name="attributionEventId"
            label={t('revenue-ledger:fields.attributionEventId')}
          />
          <TextInputField name="currencyCode" label={t('revenue-ledger:fields.currencyCode')} />
          <TextInputField
            name="recognizedAmount"
            type="number"
            step="0.01"
            min="0"
            label={t('revenue-ledger:fields.recognizedAmount')}
          />
          <TextInputField
            name="recognizedAt"
            type="number"
            label={t('revenue-ledger:fields.recognizedAt')}
          />
          <TextInputField name="externalRef" label={t('revenue-ledger:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('revenue-ledger:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const RevenueEntryReconcileSurface = ({
  initialReconciliationReference,
  onCancel,
  onSubmit,
  isPending = false,
}: RevenueEntryReconcileSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['revenue-ledger', 'common']);
  const form = useForm<RevenueEntryReconcileFormValues>({
    defaultValues: {
      reconciliationReference: initialReconciliationReference ?? '',
    },
  });
  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      reconciliationReference: toNullableText(values.reconciliationReference),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('revenue-ledger:mutations.reconcile.title')}
        subtitle={t('revenue-ledger:mutations.reconcile.subtitle')}
        kind="action"
        submitLabel={t('revenue-ledger:mutations.reconcile.submit')}
        pendingLabel={t('revenue-ledger:mutations.reconcile.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField
          name="reconciliationReference"
          label={t('revenue-ledger:fields.reconciliationReference')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const parseRevenueEntryCoreForTest = (
  values: RevenueEntryDraftCoreFormValues,
): RevenueEntryDraftCorePayload => toCorePayload(values);
