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

import {
  talentCommercialParticipationStatusValues,
  talentOriginValues,
} from '@modules/talent/types/talent.types';
import type {
  TalentCommercialParticipationPayload,
  TalentCommercialParticipationStatus,
  TalentCreatePayload,
  TalentEmploymentProfileLinkPayload,
  TalentManagerAssignmentPayload,
  TalentOrigin,
  TalentUpdatePayload,
} from '@modules/talent/types/talent.types';
import { loadEmploymentProfileReferenceOptions } from '@shared/components/reference/admin-reference-options';
import { ModuleMutationSurface } from '@shared/modules';
import {
  CheckboxField,
  FormGrid,
  GeneratedCodeNotice,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type TalentCreateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: TalentCreatePayload) => Promise<void> | void;
};

type TalentEditSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: {
    talentOrigin: TalentOrigin;
    stageName: string;
    legalName: string;
    displayShortName?: string | null;
    externalRef?: string | null;
    profileSummary?: string | null;
  };
  onSubmit: (payload: TalentUpdatePayload) => Promise<void> | void;
};

type TalentManagerAssignmentSurfaceProps = BaseMutationSurfaceProps & {
  currentTalentId: string;
  currentManagerEmploymentProfileId?: string | null;
  onSubmit: (payload: TalentManagerAssignmentPayload) => Promise<void> | void;
};

type TalentEmploymentLinkSurfaceProps = BaseMutationSurfaceProps & {
  currentLinkedEmploymentProfileId?: string | null;
  onSubmit: (payload: TalentEmploymentProfileLinkPayload) => Promise<void> | void;
};

type TalentCommercialParticipationSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: {
    commercialParticipationStatus: TalentCommercialParticipationStatus;
    livestreamEligible: boolean;
    eventEligible: boolean;
  };
  onSubmit: (payload: TalentCommercialParticipationPayload) => Promise<void> | void;
};

const toOptionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const toOptionalEnumValue = <TValue extends string>(value: unknown): TValue | undefined => {
  if (typeof value !== 'string') {
    return value as TValue | undefined;
  }

  return value.trim().length > 0 ? (value as TValue) : undefined;
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

const createTalentCreateSchema = (
  requiredMessage: string,
  tokenMessage: string,
  blockedStatusMessage: string,
) => {
  return z
    .object({
      stageName: z.string().trim().optional(),
      legalName: z.string().trim().optional(),
      talentOrigin: z.preprocess(
        (value) => toOptionalEnumValue<TalentOrigin>(value),
        z.enum(talentOriginValues, {
          required_error: requiredMessage,
        }),
      ),
      commercialParticipationStatus: z.preprocess(
        (value) => toOptionalEnumValue<TalentCommercialParticipationStatus>(value),
        z.enum(talentCommercialParticipationStatusValues, {
          required_error: requiredMessage,
        }),
      ),
      livestreamEligible: z.boolean(),
      eventEligible: z.boolean(),
      managerEmploymentProfileId: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]+$/, tokenMessage)
        .optional()
        .or(z.literal('')),
      linkedEmploymentProfileId: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]+$/, tokenMessage)
        .optional()
        .or(z.literal('')),
      displayShortName: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
      profileSummary: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      if (
        value.commercialParticipationStatus === 'BLOCKED' &&
        (value.livestreamEligible || value.eventEligible)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['commercialParticipationStatus'],
          message: blockedStatusMessage,
        });
      }
      if (value.talentOrigin === 'INTERNAL' && !toOptionalText(value.linkedEmploymentProfileId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['linkedEmploymentProfileId'],
          message: requiredMessage,
        });
      }
      if (value.talentOrigin === 'EXTERNAL') {
        if (!toOptionalText(value.stageName)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stageName'],
            message: requiredMessage,
          });
        }
        if (!toOptionalText(value.legalName)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['legalName'],
            message: requiredMessage,
          });
        }
      }
    });
};

const createTalentEditSchema = (requiredMessage: string, talentOrigin: TalentOrigin) => {
  return z
    .object({
      stageName: z.string().trim().optional(),
      legalName: z.string().trim().optional(),
      displayShortName: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
      profileSummary: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      if (talentOrigin !== 'EXTERNAL') {
        return;
      }
      if (!toOptionalText(value.stageName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stageName'],
          message: requiredMessage,
        });
      }
      if (!toOptionalText(value.legalName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['legalName'],
          message: requiredMessage,
        });
      }
    });
};

const createManagerAssignmentSchema = (
  tokenMessage: string,
  selfMessage: string,
  currentTalentId: string,
) => {
  return z
    .object({
      newManagerEmploymentProfileId: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]+$/, tokenMessage)
        .optional()
        .or(z.literal('')),
    })
    .superRefine((value, context) => {
      const normalized = toOptionalText(value.newManagerEmploymentProfileId);
      if (normalized && normalized === currentTalentId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newManagerEmploymentProfileId'],
          message: selfMessage,
        });
      }
    });
};

const createEmploymentLinkSchema = (requiredMessage: string, tokenMessage: string) => {
  return z.object({
    linkedEmploymentProfileId: z
      .string()
      .trim()
      .min(1, requiredMessage)
      .regex(/^[A-Za-z0-9_-]+$/, tokenMessage),
  });
};

const createCommercialParticipationSchema = (
  requiredMessage: string,
  blockedStatusMessage: string,
) => {
  return z
    .object({
      newCommercialParticipationStatus: z.preprocess(
        (value) => toOptionalEnumValue<TalentCommercialParticipationStatus>(value),
        z.enum(talentCommercialParticipationStatusValues, {
          required_error: requiredMessage,
        }),
      ),
      livestreamEligible: z.boolean(),
      eventEligible: z.boolean(),
    })
    .superRefine((value, context) => {
      if (
        value.newCommercialParticipationStatus === 'BLOCKED' &&
        (value.livestreamEligible || value.eventEligible)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newCommercialParticipationStatus'],
          message: blockedStatusMessage,
        });
      }
    });
};

type TalentCreateFormValues = {
  stageName: string;
  legalName: string;
  talentOrigin: TalentOrigin | '';
  commercialParticipationStatus: TalentCommercialParticipationStatus;
  livestreamEligible: boolean;
  eventEligible: boolean;
  managerEmploymentProfileId: string;
  linkedEmploymentProfileId: string;
  displayShortName: string;
  externalRef: string;
  profileSummary: string;
};

export const TalentCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: TalentCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent', 'common']);
  const talentOriginOptions = useMemo(
    () => [
      { value: '', label: t('talent:fields.selectTalentOrigin') },
      ...talentOriginValues.map((value) => ({
        value,
        label: t(`talent:origins.${value}`),
      })),
    ],
    [t],
  );
  const commercialParticipationOptions = useMemo(
    () =>
      talentCommercialParticipationStatusValues.map((value) => ({
        value,
        label: t(`talent:commercialStatuses.${value}`),
      })),
    [t],
  );
  const form = useForm<TalentCreateFormValues>({
    defaultValues: {
      stageName: '',
      legalName: '',
      talentOrigin: '',
      commercialParticipationStatus: 'ELIGIBLE',
      livestreamEligible: true,
      eventEligible: true,
      managerEmploymentProfileId: '',
      linkedEmploymentProfileId: '',
      displayShortName: '',
      externalRef: '',
      profileSummary: '',
    },
  });
  const selectedTalentOrigin = form.watch('talentOrigin');

  const schema = useMemo(
    () =>
      createTalentCreateSchema(
        t('talent:validation.required'),
        t('talent:validation.invalidToken'),
        t('talent:validation.blockedCommercialStatus'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'stageName');
      return;
    }

    await onSubmit({
      stageName: toNullableText(parsed.data.stageName),
      legalName:
        parsed.data.talentOrigin === 'EXTERNAL' ? toNullableText(parsed.data.legalName) : null,
      talentOrigin: parsed.data.talentOrigin,
      commercialParticipationStatus: parsed.data.commercialParticipationStatus,
      livestreamEligible: parsed.data.livestreamEligible,
      eventEligible: parsed.data.eventEligible,
      managerEmploymentProfileId: toNullableText(parsed.data.managerEmploymentProfileId),
      linkedEmploymentProfileId: toNullableText(parsed.data.linkedEmploymentProfileId),
      displayShortName: toNullableText(parsed.data.displayShortName),
      externalRef: toNullableText(parsed.data.externalRef),
      profileSummary: toNullableText(parsed.data.profileSummary),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent:mutations.create.title')}
        subtitle={t('talent:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('talent:mutations.create.submit')}
        pendingLabel={t('talent:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('talent:generatedCode.label')}
            description={t('talent:generatedCode.description')}
            className="md:col-span-2"
          />
          <SelectField
            name="talentOrigin"
            label={t('talent:fields.talentOrigin')}
            options={talentOriginOptions}
          />
          <TextInputField
            name="stageName"
            label={
              selectedTalentOrigin === 'EXTERNAL'
                ? t('talent:fields.stageName')
                : t('talent:fields.performanceAlias')
            }
            placeholder={t('talent:placeholders.optional')}
            helperText={
              selectedTalentOrigin === 'EXTERNAL'
                ? t('talent:referenceHelp.externalStageName')
                : t('talent:referenceHelp.performanceAlias')
            }
          />
          {selectedTalentOrigin === 'EXTERNAL' ? (
            <TextInputField name="legalName" label={t('talent:fields.externalProfileName')} />
          ) : null}
          <SelectField
            name="commercialParticipationStatus"
            label={t('talent:fields.commercialParticipationStatus')}
            options={commercialParticipationOptions}
          />
          <ReferencePickerField
            name="managerEmploymentProfileId"
            label={t('talent:fields.managerEmploymentProfileId')}
            pickerId="talent-manager"
            loadOptions={loadEmploymentProfileReferenceOptions}
            helperText={t('talent:referenceHelp.managerEmploymentProfileId')}
            placeholder={t('talent:placeholders.employmentProfileSearch')}
            clearable
            clearLabel={t('talent:actions.clearManager')}
          />
          <ReferencePickerField
            name="linkedEmploymentProfileId"
            label={t('talent:fields.linkedEmploymentProfileId')}
            pickerId="talent-linked-employment-profile"
            loadOptions={loadEmploymentProfileReferenceOptions}
            helperText={
              selectedTalentOrigin === 'INTERNAL'
                ? t('talent:referenceHelp.internalDisplayNameSource')
                : t('talent:referenceHelp.linkedEmploymentProfileId')
            }
            placeholder={t('talent:placeholders.employmentProfileSearch')}
            clearable
            clearLabel={t('talent:actions.clearLinkedEmploymentProfile')}
          />
          {selectedTalentOrigin === 'EXTERNAL' ? (
            <TextInputField
              name="displayShortName"
              label={t('talent:fields.displayShortName')}
              placeholder={t('talent:placeholders.optional')}
            />
          ) : null}
          <TextInputField
            name="externalRef"
            label={t('talent:fields.externalRef')}
            placeholder={t('talent:placeholders.optional')}
          />
        </FormGrid>
        <div className="flex flex-wrap gap-4">
          <CheckboxField name="livestreamEligible" label={t('talent:fields.livestreamEligible')} />
          <CheckboxField name="eventEligible" label={t('talent:fields.eventEligible')} />
        </div>
        <TextInputField
          name="profileSummary"
          label={t('talent:fields.profileSummary')}
          placeholder={t('talent:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type TalentEditFormValues = {
  stageName: string;
  legalName: string;
  displayShortName: string;
  externalRef: string;
  profileSummary: string;
};

export const TalentEditSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: TalentEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent', 'common']);
  const form = useForm<TalentEditFormValues>({
    defaultValues: {
      stageName: initialValues.stageName,
      legalName: initialValues.legalName,
      displayShortName: initialValues.displayShortName ?? '',
      externalRef: initialValues.externalRef ?? '',
      profileSummary: initialValues.profileSummary ?? '',
    },
  });

  const schema = useMemo(
    () => createTalentEditSchema(t('talent:validation.required'), initialValues.talentOrigin),
    [initialValues.talentOrigin, t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'stageName');
      return;
    }

    await onSubmit({
      stageName: toNullableText(parsed.data.stageName),
      legalName:
        initialValues.talentOrigin === 'EXTERNAL'
          ? toOptionalText(parsed.data.legalName)
          : undefined,
      displayShortName:
        initialValues.talentOrigin === 'EXTERNAL'
          ? toNullableText(parsed.data.displayShortName)
          : undefined,
      externalRef: toNullableText(parsed.data.externalRef),
      profileSummary: toNullableText(parsed.data.profileSummary),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent:mutations.edit.title')}
        subtitle={t('talent:mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('talent:mutations.edit.submit')}
        pendingLabel={t('talent:mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField
            name="stageName"
            label={
              initialValues.talentOrigin === 'EXTERNAL'
                ? t('talent:fields.stageName')
                : t('talent:fields.performanceAlias')
            }
            placeholder={t('talent:placeholders.optional')}
            helperText={
              initialValues.talentOrigin === 'EXTERNAL'
                ? t('talent:referenceHelp.externalStageName')
                : t('talent:referenceHelp.performanceAlias')
            }
          />
          {initialValues.talentOrigin === 'EXTERNAL' ? (
            <>
              <TextInputField name="legalName" label={t('talent:fields.externalProfileName')} />
              <TextInputField
                name="displayShortName"
                label={t('talent:fields.displayShortName')}
                placeholder={t('talent:placeholders.optional')}
              />
            </>
          ) : (
            <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('talent:referenceHelp.internalDisplayNameSource')}
            </p>
          )}
          <TextInputField
            name="externalRef"
            label={t('talent:fields.externalRef')}
            placeholder={t('talent:placeholders.optional')}
          />
        </FormGrid>
        <TextInputField
          name="profileSummary"
          label={t('talent:fields.profileSummary')}
          placeholder={t('talent:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type TalentManagerAssignmentFormValues = {
  newManagerEmploymentProfileId: string;
};

export const TalentManagerAssignmentSurface = ({
  currentTalentId,
  currentManagerEmploymentProfileId,
  onCancel,
  onSubmit,
  isPending = false,
}: TalentManagerAssignmentSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent', 'common']);
  const form = useForm<TalentManagerAssignmentFormValues>({
    defaultValues: {
      newManagerEmploymentProfileId: currentManagerEmploymentProfileId ?? '',
    },
  });

  const schema = useMemo(
    () =>
      createManagerAssignmentSchema(
        t('talent:validation.invalidReferenceToken'),
        t('talent:validation.managerCannotMatchTalentId'),
        currentTalentId,
      ),
    [currentTalentId, t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'newManagerEmploymentProfileId');
      return;
    }

    await onSubmit({
      newManagerEmploymentProfileId: toNullableText(parsed.data.newManagerEmploymentProfileId),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent:mutations.assignManager.title')}
        subtitle={t('talent:mutations.assignManager.subtitle')}
        kind="action"
        submitLabel={t('talent:mutations.assignManager.submit')}
        pendingLabel={t('talent:mutations.assignManager.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <ReferencePickerField
          name="newManagerEmploymentProfileId"
          label={t('talent:fields.newManagerEmploymentProfileId')}
          pickerId="talent-new-manager"
          loadOptions={loadEmploymentProfileReferenceOptions}
          helperText={t('talent:referenceHelp.newManagerEmploymentProfileId')}
          placeholder={t('talent:placeholders.employmentProfileSearch')}
          clearable
          clearLabel={t('talent:actions.clearManager')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type TalentEmploymentLinkFormValues = {
  linkedEmploymentProfileId: string;
};

export const TalentEmploymentLinkSurface = ({
  currentLinkedEmploymentProfileId,
  onCancel,
  onSubmit,
  isPending = false,
}: TalentEmploymentLinkSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent', 'common']);
  const form = useForm<TalentEmploymentLinkFormValues>({
    defaultValues: {
      linkedEmploymentProfileId: currentLinkedEmploymentProfileId ?? '',
    },
  });

  const schema = useMemo(
    () =>
      createEmploymentLinkSchema(
        t('talent:validation.required'),
        t('talent:validation.invalidReferenceToken'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'linkedEmploymentProfileId');
      return;
    }

    await onSubmit({
      linkedEmploymentProfileId: parsed.data.linkedEmploymentProfileId,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent:mutations.linkEmploymentProfile.title')}
        subtitle={t('talent:mutations.linkEmploymentProfile.subtitle')}
        kind="action"
        submitLabel={t('talent:mutations.linkEmploymentProfile.submit')}
        pendingLabel={t('talent:mutations.linkEmploymentProfile.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <ReferencePickerField
          name="linkedEmploymentProfileId"
          label={t('talent:fields.linkedEmploymentProfileId')}
          pickerId="talent-link-employment-profile"
          loadOptions={loadEmploymentProfileReferenceOptions}
          helperText={t('talent:referenceHelp.linkedEmploymentProfileId')}
          placeholder={t('talent:placeholders.employmentProfileSearch')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type TalentCommercialParticipationFormValues = {
  newCommercialParticipationStatus: TalentCommercialParticipationStatus;
  livestreamEligible: boolean;
  eventEligible: boolean;
};

export const TalentCommercialParticipationSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: TalentCommercialParticipationSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent', 'common']);
  const commercialParticipationOptions = useMemo(
    () =>
      talentCommercialParticipationStatusValues.map((value) => ({
        value,
        label: t(`talent:commercialStatuses.${value}`),
      })),
    [t],
  );
  const form = useForm<TalentCommercialParticipationFormValues>({
    defaultValues: {
      newCommercialParticipationStatus: initialValues.commercialParticipationStatus,
      livestreamEligible: initialValues.livestreamEligible,
      eventEligible: initialValues.eventEligible,
    },
  });

  const schema = useMemo(
    () =>
      createCommercialParticipationSchema(
        t('talent:validation.required'),
        t('talent:validation.blockedCommercialStatus'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'newCommercialParticipationStatus');
      return;
    }

    await onSubmit({
      newCommercialParticipationStatus: parsed.data.newCommercialParticipationStatus,
      livestreamEligible: parsed.data.livestreamEligible,
      eventEligible: parsed.data.eventEligible,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent:mutations.commercialParticipation.title')}
        subtitle={t('talent:mutations.commercialParticipation.subtitle')}
        kind="action"
        submitLabel={t('talent:mutations.commercialParticipation.submit')}
        pendingLabel={t('talent:mutations.commercialParticipation.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <SelectField
          name="newCommercialParticipationStatus"
          label={t('talent:fields.newCommercialParticipationStatus')}
          options={commercialParticipationOptions}
        />
        <div className="flex flex-wrap gap-4">
          <CheckboxField name="livestreamEligible" label={t('talent:fields.livestreamEligible')} />
          <CheckboxField name="eventEligible" label={t('talent:fields.eventEligible')} />
        </div>
      </ModuleMutationSurface>
    </FormProvider>
  );
};
