import { useMemo } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type {
  CommissionBeneficiaryKind,
  CommissionRevenueKind,
  CommissionRuleCreatePayload,
  CommissionRuleDraftCorePayload,
  CommissionRuleRecord,
  CommissionSettlementCreatePayload,
  CommissionSettlementDraftCorePayload,
  CommissionSettlementRecord,
  CommissionSettlementRevenueEntriesPayload,
} from '@modules/commission/types/commission.types';
import {
  commissionBeneficiaryKindValues,
  commissionRevenueKindValues,
  commissionSettlementBasisValues,
  commissionSettlementKindValues,
} from '@modules/commission/types/commission.types';
import {
  loadCommissionRuleReferenceOptions,
  loadContractReferenceOptions,
  loadEmploymentProfileReferenceOptions,
  loadRevenueEntryReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import {
  FormGrid,
  GeneratedCodeNotice,
  ReferenceIdSetEditor,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const idRegex = /^[A-Za-z0-9_-]+$/;
const rateRegex = /^(?:\d+|\d+\.\d{1,4})$/;
const integerTimestampRegex = /^-?\d+$/;

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type CommissionRuleCreateSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: CommissionRuleCreatePayload) => Promise<void> | void;
};

type CommissionRuleDraftCoreSurfaceProps = BaseSurfaceProps & {
  initialValues: CommissionRuleRecord;
  onSubmit: (payload: CommissionRuleDraftCorePayload) => Promise<void> | void;
};

type CommissionSettlementCreateSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: CommissionSettlementCreatePayload) => Promise<void> | void;
};

type CommissionSettlementDraftCoreSurfaceProps = BaseSurfaceProps & {
  initialValues: CommissionSettlementRecord;
  onSubmit: (payload: CommissionSettlementDraftCorePayload) => Promise<void> | void;
};

type CommissionSettlementRevenueEntriesSurfaceProps = BaseSurfaceProps & {
  initialRevenueEntryIds: string[];
  onSubmit: (payload: CommissionSettlementRevenueEntriesPayload) => Promise<void> | void;
};

type RevenueKindSelection = Record<CommissionRevenueKind, boolean>;

type CommissionRuleCreateFormValues = {
  title: string;
  settlementKind: 'REVENUE_SHARE';
  beneficiaryKind: CommissionBeneficiaryKind;
  beneficiaryEmploymentProfileId: string;
  beneficiaryTalentId: string;
  sourceContractRecordId: string;
  settlementBasis: 'RECOGNIZED_GROSS_REVENUE';
  ratePercent: string;
  appliesToRevenueKinds: RevenueKindSelection;
  effectiveStartDate: string;
  effectiveEndDate: string;
  description: string;
  externalRef: string;
};

type CommissionRuleDraftCoreFormValues = Pick<
  CommissionRuleCreateFormValues,
  | 'title'
  | 'ratePercent'
  | 'appliesToRevenueKinds'
  | 'effectiveStartDate'
  | 'effectiveEndDate'
  | 'description'
  | 'externalRef'
>;

type RevenueEntryRow = {
  revenueEntryId: string;
};

type CommissionSettlementCreateFormValues = {
  title: string;
  sourceRuleId: string;
  settlementPeriodStartAt: string;
  settlementPeriodEndAt: string;
  revenueEntryIds: RevenueEntryRow[];
  description: string;
  externalRef: string;
};

type CommissionSettlementDraftCoreFormValues = Omit<
  CommissionSettlementCreateFormValues,
  'sourceRuleId' | 'revenueEntryIds'
>;

type CommissionSettlementRevenueEntriesFormValues = {
  revenueEntryIds: RevenueEntryRow[];
};

const emptyRevenueKindSelection = (): RevenueKindSelection => ({
  PLATFORM_LIVESTREAM: false,
  PLATFORM_CONTENT: false,
  EVENT_OPERATIONAL: false,
});

const revenueKindSelectionFromArray = (items: CommissionRevenueKind[]): RevenueKindSelection => {
  const selection = emptyRevenueKindSelection();
  items.forEach((item) => {
    selection[item] = true;
  });
  return selection;
};

const revenueKindSelectionToArray = (selection: RevenueKindSelection): CommissionRevenueKind[] =>
  commissionRevenueKindValues.filter((kind) => selection[kind]);

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
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (!integerTimestampRegex.test(trimmed)) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const parseUtcMidnightTimestamp = (value: string): number | undefined => {
  const parsed = parseIntegerTimestamp(value);
  if (parsed === undefined || parsed % MILLISECONDS_PER_DAY !== 0) {
    return undefined;
  }

  return parsed;
};

const parseRatePercent = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!rateRegex.test(trimmed)) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : undefined;
};

const uniqueIdsFromRows = (rows: RevenueEntryRow[]): string[] =>
  Array.from(
    new Set(rows.map((row) => row.revenueEntryId.trim()).filter((value) => value.length > 0)),
  );

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

const buildRuleCoreSchema = (messages: {
  required: string;
  token: string;
  rate: string;
  revenueKinds: string;
  utcMidnight: string;
  dateWindow: string;
}) =>
  z
    .object({
      title: z.string().trim().min(1, messages.required),
      ratePercent: z.string().trim().min(1, messages.rate),
      appliesToRevenueKinds: z.object({
        PLATFORM_LIVESTREAM: z.boolean(),
        PLATFORM_CONTENT: z.boolean(),
        EVENT_OPERATIONAL: z.boolean(),
      }),
      effectiveStartDate: z.string().trim().min(1, messages.utcMidnight),
      effectiveEndDate: z.string().trim().optional(),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const start = parseUtcMidnightTimestamp(value.effectiveStartDate);
      const hasEnd = Boolean(value.effectiveEndDate && value.effectiveEndDate.length > 0);
      const end = hasEnd ? parseUtcMidnightTimestamp(value.effectiveEndDate ?? '') : undefined;

      if (parseRatePercent(value.ratePercent) === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ratePercent'],
          message: messages.rate,
        });
      }
      if (revenueKindSelectionToArray(value.appliesToRevenueKinds).length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['appliesToRevenueKinds'],
          message: messages.revenueKinds,
        });
      }
      if (start === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effectiveStartDate'],
          message: messages.utcMidnight,
        });
      }
      if (hasEnd && end === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effectiveEndDate'],
          message: messages.utcMidnight,
        });
      }
      if (start !== undefined && end !== undefined && end < start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effectiveEndDate'],
          message: messages.dateWindow,
        });
      }
    });

const buildRuleCreateSchema = (
  messages: Parameters<typeof buildRuleCoreSchema>[0] & {
    beneficiaryRequired: string;
    beneficiaryRevenueShare: string;
  },
) =>
  z
    .object({
      title: z.string().trim().min(1, messages.required),
      settlementKind: z.literal('REVENUE_SHARE'),
      beneficiaryKind: z.enum(['EMPLOYMENT_PROFILE', 'TALENT']),
      beneficiaryEmploymentProfileId: z.string().trim().optional(),
      beneficiaryTalentId: z.string().trim().optional(),
      sourceContractRecordId: z
        .string()
        .trim()
        .min(1, messages.required)
        .regex(idRegex, messages.token),
      settlementBasis: z.literal('RECOGNIZED_GROSS_REVENUE'),
      ratePercent: z.string().trim().min(1, messages.rate),
      appliesToRevenueKinds: z.object({
        PLATFORM_LIVESTREAM: z.boolean(),
        PLATFORM_CONTENT: z.boolean(),
        EVENT_OPERATIONAL: z.boolean(),
      }),
      effectiveStartDate: z.string().trim().min(1, messages.utcMidnight),
      effectiveEndDate: z.string().trim().optional(),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const start = parseUtcMidnightTimestamp(value.effectiveStartDate);
      const hasEnd = Boolean(value.effectiveEndDate && value.effectiveEndDate.length > 0);
      const end = hasEnd ? parseUtcMidnightTimestamp(value.effectiveEndDate ?? '') : undefined;

      if (parseRatePercent(value.ratePercent) === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ratePercent'],
          message: messages.rate,
        });
      }
      if (revenueKindSelectionToArray(value.appliesToRevenueKinds).length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['appliesToRevenueKinds'],
          message: messages.revenueKinds,
        });
      }
      if (start === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effectiveStartDate'],
          message: messages.utcMidnight,
        });
      }
      if (hasEnd && end === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effectiveEndDate'],
          message: messages.utcMidnight,
        });
      }
      if (start !== undefined && end !== undefined && end < start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effectiveEndDate'],
          message: messages.dateWindow,
        });
      }
      if (value.settlementKind === 'REVENUE_SHARE' && value.beneficiaryKind !== 'TALENT') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['beneficiaryKind'],
          message: messages.beneficiaryRevenueShare,
        });
      }

      if (value.beneficiaryKind === 'EMPLOYMENT_PROFILE') {
        if (!value.beneficiaryEmploymentProfileId || value.beneficiaryTalentId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['beneficiaryEmploymentProfileId'],
            message: messages.beneficiaryRequired,
          });
        }
        return;
      }

      if (!value.beneficiaryTalentId || value.beneficiaryEmploymentProfileId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['beneficiaryTalentId'],
          message: messages.beneficiaryRequired,
        });
      }
    });

const buildSettlementCoreSchema = (messages: {
  required: string;
  timestamp: string;
  periodWindow: string;
}) =>
  z
    .object({
      title: z.string().trim().min(1, messages.required),
      settlementPeriodStartAt: z.string().trim().min(1, messages.timestamp),
      settlementPeriodEndAt: z.string().trim().min(1, messages.timestamp),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const start = parseIntegerTimestamp(value.settlementPeriodStartAt);
      const end = parseIntegerTimestamp(value.settlementPeriodEndAt);

      if (start === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settlementPeriodStartAt'],
          message: messages.timestamp,
        });
      }
      if (end === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settlementPeriodEndAt'],
          message: messages.timestamp,
        });
      }
      if (start !== undefined && end !== undefined && end <= start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settlementPeriodEndAt'],
          message: messages.periodWindow,
        });
      }
    });

const buildRevenueEntryRowsSchema = (messages: {
  required: string;
  token: string;
  duplicate: string;
}) =>
  z
    .array(
      z.object({
        revenueEntryId: z.string().trim().min(1, messages.required).regex(idRegex, messages.token),
      }),
    )
    .min(1, messages.required)
    .superRefine((rows, context) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        if (seen.has(row.revenueEntryId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'revenueEntryId'],
            message: messages.duplicate,
          });
        }
        seen.add(row.revenueEntryId);
      });
    });

const buildSettlementCreateSchema = (
  messages: Parameters<typeof buildSettlementCoreSchema>[0] & {
    token: string;
    duplicateRevenueEntry: string;
  },
) =>
  z
    .object({
      title: z.string().trim().min(1, messages.required),
      sourceRuleId: z.string().trim().min(1, messages.required).regex(idRegex, messages.token),
      settlementPeriodStartAt: z.string().trim().min(1, messages.timestamp),
      settlementPeriodEndAt: z.string().trim().min(1, messages.timestamp),
      revenueEntryIds: buildRevenueEntryRowsSchema({
        required: messages.required,
        token: messages.token,
        duplicate: messages.duplicateRevenueEntry,
      }),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      const start = parseIntegerTimestamp(value.settlementPeriodStartAt);
      const end = parseIntegerTimestamp(value.settlementPeriodEndAt);

      if (start === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settlementPeriodStartAt'],
          message: messages.timestamp,
        });
      }
      if (end === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settlementPeriodEndAt'],
          message: messages.timestamp,
        });
      }
      if (start !== undefined && end !== undefined && end <= start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['settlementPeriodEndAt'],
          message: messages.periodWindow,
        });
      }
    });

const buildRevenueEntryReplacementSchema = (messages: {
  required: string;
  token: string;
  duplicateRevenueEntry: string;
}) =>
  z.object({
    revenueEntryIds: buildRevenueEntryRowsSchema({
      required: messages.required,
      token: messages.token,
      duplicate: messages.duplicateRevenueEntry,
    }),
  });

const useCommissionOptions = () => {
  const { t } = useTranslation(['commission', 'common']);
  return {
    settlementKinds: commissionSettlementKindValues.map((value) => ({
      value,
      label: t(`commission:settlementKinds.${value}`),
    })),
    settlementBases: commissionSettlementBasisValues.map((value) => ({
      value,
      label: t(`commission:settlementBases.${value}`),
    })),
    beneficiaryKinds: commissionBeneficiaryKindValues.map((value) => ({
      value,
      label: t(`commission:beneficiaryKinds.${value}`),
    })),
  };
};

const RevenueKindCheckboxes = ({
  fieldName,
}: {
  fieldName: 'appliesToRevenueKinds';
}): JSX.Element => {
  const { t } = useTranslation(['commission', 'common']);
  const {
    register,
    formState: { errors },
  } = useFormContext<CommissionRuleCreateFormValues | CommissionRuleDraftCoreFormValues>();
  const groupError = errors.appliesToRevenueKinds?.message as string | undefined;

  return (
    <fieldset className="rounded border border-border p-3">
      <legend className="px-1 text-xs font-medium uppercase text-muted">
        {t('commission:rules.fields.appliesToRevenueKinds')}
      </legend>
      <div className="mt-2 flex flex-wrap gap-3">
        {commissionRevenueKindValues.map((kind) => (
          <label key={kind} className="inline-flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              {...register(`${fieldName}.${kind}`)}
              className="h-4 w-4 rounded border-border"
            />
            <span>{t(`commission:revenueKinds.${kind}`)}</span>
          </label>
        ))}
      </div>
      {groupError ? <span className="mt-2 block text-xs text-danger">{groupError}</span> : null}
    </fieldset>
  );
};

const RevenueEntrySetEditor = (): JSX.Element => {
  const { t } = useTranslation(['commission']);

  return (
    <ReferenceIdSetEditor
      name="revenueEntryIds"
      idFieldName="revenueEntryId"
      pickerId="commission-settlement-revenue-entry"
      loadOptions={loadRevenueEntryReferenceOptions}
      title={t('commission:settlements.mutations.revenueEntries.rowsTitle')}
      fieldLabel={t('commission:settlements.fields.revenueEntry')}
      addLabel={t('commission:settlements.actions.addRevenueEntry')}
      removeLabel={() => t('commission:settlements.actions.removeRevenueEntry')}
      placeholder={t('commission:settlements.placeholders.searchReference')}
    />
  );
};

const ruleValidationMessages = (t: (key: string) => string) => ({
  required: t('commission:validation.required'),
  token: t('commission:validation.invalidToken'),
  rate: t('commission:validation.invalidRatePercent'),
  revenueKinds: t('commission:validation.revenueKindsRequired'),
  utcMidnight: t('commission:validation.utcMidnightTimestamp'),
  dateWindow: t('commission:validation.effectiveWindow'),
  beneficiaryRequired: t('commission:validation.beneficiaryExactOne'),
  beneficiaryRevenueShare: t('commission:validation.revenueShareTalentOnly'),
});

const settlementValidationMessages = (t: (key: string) => string) => ({
  required: t('commission:validation.required'),
  token: t('commission:validation.invalidToken'),
  timestamp: t('commission:validation.invalidTimestamp'),
  periodWindow: t('commission:validation.periodWindow'),
  duplicateRevenueEntry: t('commission:validation.duplicateRevenueEntry'),
});

const ruleValidationMessagesForTest = {
  required: 'required',
  token: 'token',
  rate: 'rate',
  revenueKinds: 'revenueKinds',
  utcMidnight: 'utcMidnight',
  dateWindow: 'dateWindow',
  beneficiaryRequired: 'beneficiaryRequired',
  beneficiaryRevenueShare: 'beneficiaryRevenueShare',
};

type RuleCorePayloadValues = {
  title: string;
  ratePercent: string;
  appliesToRevenueKinds: RevenueKindSelection;
  effectiveStartDate: string;
  effectiveEndDate?: string;
  description?: string;
  externalRef?: string;
};

type SettlementCorePayloadValues = {
  title: string;
  settlementPeriodStartAt: string;
  settlementPeriodEndAt: string;
  description?: string;
  externalRef?: string;
};

const toRuleCorePayload = (values: RuleCorePayloadValues): CommissionRuleDraftCorePayload => ({
  title: values.title,
  ratePercent: parseRatePercent(values.ratePercent),
  appliesToRevenueKinds: revenueKindSelectionToArray(values.appliesToRevenueKinds),
  effectiveStartDate: parseUtcMidnightTimestamp(values.effectiveStartDate),
  effectiveEndDate: values.effectiveEndDate
    ? parseUtcMidnightTimestamp(values.effectiveEndDate)
    : null,
  description: toNullableText(values.description),
  externalRef: toNullableText(values.externalRef),
});

const toSettlementCorePayload = (
  values: SettlementCorePayloadValues,
): CommissionSettlementDraftCorePayload => ({
  title: values.title,
  settlementPeriodStartAt: parseIntegerTimestamp(values.settlementPeriodStartAt),
  settlementPeriodEndAt: parseIntegerTimestamp(values.settlementPeriodEndAt),
  description: toNullableText(values.description),
  externalRef: toNullableText(values.externalRef),
});

export const CommissionRuleCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: CommissionRuleCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['commission', 'common']);
  const options = useCommissionOptions();
  const form = useForm<CommissionRuleCreateFormValues>({
    defaultValues: {
      title: '',
      settlementKind: 'REVENUE_SHARE',
      beneficiaryKind: 'TALENT',
      beneficiaryEmploymentProfileId: '',
      beneficiaryTalentId: '',
      sourceContractRecordId: '',
      settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
      ratePercent: '',
      appliesToRevenueKinds: revenueKindSelectionFromArray(['PLATFORM_LIVESTREAM']),
      effectiveStartDate: '',
      effectiveEndDate: '',
      description: '',
      externalRef: '',
    },
  });
  const schema = useMemo(() => buildRuleCreateSchema(ruleValidationMessages(t)), [t]);
  const beneficiaryKind = form.watch('beneficiaryKind');
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse({
      ...values,
      beneficiaryEmploymentProfileId:
        values.beneficiaryKind === 'EMPLOYMENT_PROFILE'
          ? values.beneficiaryEmploymentProfileId
          : '',
      beneficiaryTalentId: values.beneficiaryKind === 'TALENT' ? values.beneficiaryTalentId : '',
    });
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    const corePayload = toRuleCorePayload(parsed.data);
    await onSubmit({
      title: parsed.data.title,
      settlementKind: 'REVENUE_SHARE',
      beneficiaryKind: parsed.data.beneficiaryKind,
      beneficiaryEmploymentProfileId:
        parsed.data.beneficiaryKind === 'EMPLOYMENT_PROFILE'
          ? parsed.data.beneficiaryEmploymentProfileId
          : undefined,
      beneficiaryTalentId:
        parsed.data.beneficiaryKind === 'TALENT' ? parsed.data.beneficiaryTalentId : undefined,
      sourceContractRecordId: parsed.data.sourceContractRecordId,
      settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
      ratePercent: corePayload.ratePercent ?? 0,
      appliesToRevenueKinds: corePayload.appliesToRevenueKinds ?? [],
      effectiveStartDate: corePayload.effectiveStartDate ?? 0,
      effectiveEndDate: corePayload.effectiveEndDate ?? null,
      description: corePayload.description ?? null,
      externalRef: corePayload.externalRef ?? null,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('commission:rules.mutations.create.title')}
        subtitle={t('commission:rules.mutations.create.subtitle')}
        kind="create"
        submitLabel={t('commission:rules.mutations.create.submit')}
        pendingLabel={t('commission:rules.mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('commission:generatedCode.label')}
            description={t('commission:generatedCode.description')}
            className="md:col-span-2"
          />
          <TextInputField name="title" label={t('commission:rules.fields.title')} />
          <SelectField
            name="settlementKind"
            label={t('commission:rules.fields.settlementKind')}
            options={options.settlementKinds}
          />
          <SelectField
            name="beneficiaryKind"
            label={t('commission:rules.fields.beneficiaryKind')}
            options={options.beneficiaryKinds}
          />
          {beneficiaryKind === 'EMPLOYMENT_PROFILE' ? (
            <ReferencePickerField
              name="beneficiaryEmploymentProfileId"
              label={t('commission:rules.fields.beneficiaryEmploymentProfileId')}
              pickerId="commission-rule-beneficiary-employment-profile"
              loadOptions={loadEmploymentProfileReferenceOptions}
              placeholder={t('commission:rules.placeholders.searchReference')}
            />
          ) : (
            <ReferencePickerField
              name="beneficiaryTalentId"
              label={t('commission:rules.fields.beneficiaryTalentId')}
              pickerId="commission-rule-beneficiary-talent"
              loadOptions={loadTalentReferenceOptions}
              placeholder={t('commission:rules.placeholders.searchReference')}
            />
          )}
          <ReferencePickerField
            name="sourceContractRecordId"
            label={t('commission:rules.fields.sourceContractRecordId')}
            pickerId="commission-rule-source-contract"
            loadOptions={loadContractReferenceOptions}
            placeholder={t('commission:rules.placeholders.searchReference')}
          />
          <SelectField
            name="settlementBasis"
            label={t('commission:rules.fields.settlementBasis')}
            options={options.settlementBases}
          />
          <TextInputField
            name="ratePercent"
            type="number"
            step="0.0001"
            min="0"
            label={t('commission:rules.fields.ratePercent')}
          />
          <TextInputField
            name="effectiveStartDate"
            type="number"
            label={t('commission:rules.fields.effectiveStartDate')}
          />
          <TextInputField
            name="effectiveEndDate"
            type="number"
            label={t('commission:rules.fields.effectiveEndDate')}
          />
          <TextInputField name="externalRef" label={t('commission:rules.fields.externalRef')} />
        </FormGrid>
        <RevenueKindCheckboxes fieldName="appliesToRevenueKinds" />
        <TextInputField name="description" label={t('commission:rules.fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const CommissionRuleDraftCoreSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: CommissionRuleDraftCoreSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['commission', 'common']);
  const form = useForm<CommissionRuleDraftCoreFormValues>({
    defaultValues: {
      title: initialValues.title,
      ratePercent: String(initialValues.ratePercent),
      appliesToRevenueKinds: revenueKindSelectionFromArray(initialValues.appliesToRevenueKinds),
      effectiveStartDate: toTimestampText(initialValues.effectiveStartDate),
      effectiveEndDate: toTimestampText(initialValues.effectiveEndDate),
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });
  const schema = useMemo(() => buildRuleCoreSchema(ruleValidationMessages(t)), [t]);
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    await onSubmit(toRuleCorePayload(parsed.data));
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('commission:rules.mutations.draftCore.title')}
        subtitle={t('commission:rules.mutations.draftCore.subtitle')}
        kind="edit"
        submitLabel={t('commission:rules.mutations.draftCore.submit')}
        pendingLabel={t('commission:rules.mutations.draftCore.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="title" label={t('commission:rules.fields.title')} />
          <TextInputField
            name="ratePercent"
            type="number"
            step="0.0001"
            min="0"
            label={t('commission:rules.fields.ratePercent')}
          />
          <TextInputField
            name="effectiveStartDate"
            type="number"
            label={t('commission:rules.fields.effectiveStartDate')}
          />
          <TextInputField
            name="effectiveEndDate"
            type="number"
            label={t('commission:rules.fields.effectiveEndDate')}
          />
          <TextInputField name="externalRef" label={t('commission:rules.fields.externalRef')} />
        </FormGrid>
        <RevenueKindCheckboxes fieldName="appliesToRevenueKinds" />
        <TextInputField name="description" label={t('commission:rules.fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const CommissionSettlementCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: CommissionSettlementCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['commission', 'common']);
  const form = useForm<CommissionSettlementCreateFormValues>({
    defaultValues: {
      title: '',
      sourceRuleId: '',
      settlementPeriodStartAt: '',
      settlementPeriodEndAt: '',
      revenueEntryIds: [{ revenueEntryId: '' }],
      description: '',
      externalRef: '',
    },
  });
  const schema = useMemo(() => buildSettlementCreateSchema(settlementValidationMessages(t)), [t]);
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    const corePayload = toSettlementCorePayload(parsed.data);
    await onSubmit({
      title: parsed.data.title,
      sourceRuleId: parsed.data.sourceRuleId,
      settlementPeriodStartAt: corePayload.settlementPeriodStartAt ?? 0,
      settlementPeriodEndAt: corePayload.settlementPeriodEndAt ?? 0,
      revenueEntryIds: uniqueIdsFromRows(parsed.data.revenueEntryIds),
      description: corePayload.description ?? null,
      externalRef: corePayload.externalRef ?? null,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('commission:settlements.mutations.create.title')}
        subtitle={t('commission:settlements.mutations.create.subtitle')}
        kind="create"
        submitLabel={t('commission:settlements.mutations.create.submit')}
        pendingLabel={t('commission:settlements.mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('commission:generatedCode.label')}
            description={t('commission:generatedCode.description')}
            className="md:col-span-2"
          />
          <TextInputField name="title" label={t('commission:settlements.fields.title')} />
          <ReferencePickerField
            name="sourceRuleId"
            label={t('commission:settlements.fields.sourceRuleId')}
            pickerId="commission-settlement-source-rule"
            loadOptions={loadCommissionRuleReferenceOptions}
            placeholder={t('commission:settlements.placeholders.searchReference')}
          />
          <TextInputField
            name="settlementPeriodStartAt"
            type="number"
            label={t('commission:settlements.fields.settlementPeriodStartAt')}
          />
          <TextInputField
            name="settlementPeriodEndAt"
            type="number"
            label={t('commission:settlements.fields.settlementPeriodEndAt')}
          />
          <TextInputField
            name="externalRef"
            label={t('commission:settlements.fields.externalRef')}
          />
        </FormGrid>
        <RevenueEntrySetEditor />
        <TextInputField name="description" label={t('commission:settlements.fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const CommissionSettlementDraftCoreSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: CommissionSettlementDraftCoreSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['commission', 'common']);
  const form = useForm<CommissionSettlementDraftCoreFormValues>({
    defaultValues: {
      title: initialValues.title,
      settlementPeriodStartAt: toTimestampText(initialValues.settlementPeriodStartAt),
      settlementPeriodEndAt: toTimestampText(initialValues.settlementPeriodEndAt),
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });
  const schema = useMemo(() => buildSettlementCoreSchema(settlementValidationMessages(t)), [t]);
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    await onSubmit(toSettlementCorePayload(parsed.data));
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('commission:settlements.mutations.draftCore.title')}
        subtitle={t('commission:settlements.mutations.draftCore.subtitle')}
        kind="edit"
        submitLabel={t('commission:settlements.mutations.draftCore.submit')}
        pendingLabel={t('commission:settlements.mutations.draftCore.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="title" label={t('commission:settlements.fields.title')} />
          <TextInputField
            name="settlementPeriodStartAt"
            type="number"
            label={t('commission:settlements.fields.settlementPeriodStartAt')}
          />
          <TextInputField
            name="settlementPeriodEndAt"
            type="number"
            label={t('commission:settlements.fields.settlementPeriodEndAt')}
          />
          <TextInputField
            name="externalRef"
            label={t('commission:settlements.fields.externalRef')}
          />
        </FormGrid>
        <TextInputField name="description" label={t('commission:settlements.fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const CommissionSettlementRevenueEntriesSurface = ({
  initialRevenueEntryIds,
  onCancel,
  onSubmit,
  isPending = false,
}: CommissionSettlementRevenueEntriesSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['commission', 'common']);
  const form = useForm<CommissionSettlementRevenueEntriesFormValues>({
    defaultValues: {
      revenueEntryIds:
        initialRevenueEntryIds.length > 0
          ? initialRevenueEntryIds.map((revenueEntryId) => ({ revenueEntryId }))
          : [{ revenueEntryId: '' }],
    },
  });
  const schema = useMemo(
    () => buildRevenueEntryReplacementSchema(settlementValidationMessages(t)),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'revenueEntryIds');
      return;
    }

    await onSubmit({
      revenueEntryIds: uniqueIdsFromRows(parsed.data.revenueEntryIds),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('commission:settlements.mutations.revenueEntries.title')}
        subtitle={t('commission:settlements.mutations.revenueEntries.subtitle')}
        kind="action"
        submitLabel={t('commission:settlements.mutations.revenueEntries.submit')}
        pendingLabel={t('commission:settlements.mutations.revenueEntries.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <RevenueEntrySetEditor />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const parseCommissionRuleCreateForTest = (
  values: CommissionRuleCreateFormValues,
): CommissionRuleCreatePayload => {
  const parsed = buildRuleCreateSchema(ruleValidationMessagesForTest).parse(values);
  const core = toRuleCorePayload(parsed);
  return {
    title: parsed.title,
    settlementKind: 'REVENUE_SHARE',
    beneficiaryKind: parsed.beneficiaryKind,
    beneficiaryEmploymentProfileId:
      parsed.beneficiaryKind === 'EMPLOYMENT_PROFILE'
        ? parsed.beneficiaryEmploymentProfileId
        : undefined,
    beneficiaryTalentId:
      parsed.beneficiaryKind === 'TALENT' ? parsed.beneficiaryTalentId : undefined,
    sourceContractRecordId: parsed.sourceContractRecordId,
    settlementBasis: 'RECOGNIZED_GROSS_REVENUE',
    ratePercent: core.ratePercent ?? 0,
    appliesToRevenueKinds: core.appliesToRevenueKinds ?? [],
    effectiveStartDate: core.effectiveStartDate ?? 0,
    effectiveEndDate: core.effectiveEndDate ?? null,
    description: core.description ?? null,
    externalRef: core.externalRef ?? null,
  };
};

export const parseCommissionRuleDraftCoreForTest = (
  values: CommissionRuleDraftCoreFormValues,
): CommissionRuleDraftCorePayload =>
  toRuleCorePayload(buildRuleCoreSchema(ruleValidationMessagesForTest).parse(values));

export const validateCommissionRuleCreateForTest = (values: CommissionRuleCreateFormValues) =>
  buildRuleCreateSchema(ruleValidationMessagesForTest).safeParse(values);

export const validateCommissionRuleDraftCoreForTest = (values: CommissionRuleDraftCoreFormValues) =>
  buildRuleCoreSchema(ruleValidationMessagesForTest).safeParse(values);

export const parseCommissionSettlementCreateForTest = (
  values: CommissionSettlementCreateFormValues,
): CommissionSettlementCreatePayload => {
  const core = toSettlementCorePayload(values);
  return {
    title: values.title,
    sourceRuleId: values.sourceRuleId,
    settlementPeriodStartAt: core.settlementPeriodStartAt ?? 0,
    settlementPeriodEndAt: core.settlementPeriodEndAt ?? 0,
    revenueEntryIds: uniqueIdsFromRows(values.revenueEntryIds),
    description: core.description ?? null,
    externalRef: core.externalRef ?? null,
  };
};

export const parseCommissionSettlementDraftCoreForTest = (
  values: CommissionSettlementDraftCoreFormValues,
): CommissionSettlementDraftCorePayload => toSettlementCorePayload(values);

export const parseCommissionSettlementRevenueEntriesForTest = (
  values: CommissionSettlementRevenueEntriesFormValues,
): CommissionSettlementRevenueEntriesPayload => ({
  revenueEntryIds: uniqueIdsFromRows(values.revenueEntryIds),
});
