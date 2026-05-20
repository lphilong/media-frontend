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
  ContractAssignOwnerPayload,
  ContractConfidentialityTier,
  ContractCreatePayload,
  ContractDraftCorePayload,
  ContractFileReferencePayload,
  ContractKind,
  ContractLinkedEntityKind,
  ContractExpirePayload,
  ContractRecord,
  ContractTerminatePayload,
} from '@modules/contract-registry/types/contract-registry.types';
import {
  loadEmploymentProfileReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import {
  FormGrid,
  GeneratedCodeNotice,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';
import { formatUtcDateInputValue } from '@shared/formatting/formatters';
import { ModuleMutationSurface } from '@shared/modules';

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type ContractCreateSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: ContractCreatePayload) => Promise<void> | void;
};

type ContractDraftCoreSurfaceProps = BaseSurfaceProps & {
  initialValues: ContractRecord;
  onSubmit: (payload: ContractDraftCorePayload) => Promise<void> | void;
};

type ContractAssignOwnerSurfaceProps = BaseSurfaceProps & {
  initialOwnerEmploymentProfileId: string;
  onSubmit: (payload: ContractAssignOwnerPayload) => Promise<void> | void;
};

type ContractFileReferenceSurfaceProps = BaseSurfaceProps & {
  initialFileReferenceId?: string | null;
  initialFileDisplayName?: string | null;
  onSubmit: (payload: ContractFileReferencePayload) => Promise<void> | void;
};

type DateActionSurfaceProps = BaseSurfaceProps & {
  action: 'expire' | 'terminate';
  onSubmit: (payload: ContractExpirePayload | ContractTerminatePayload) => Promise<void> | void;
};

const idRegex = /^[A-Za-z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const contractKindOptions: ContractKind[] = ['EMPLOYMENT', 'TALENT_SERVICE', 'TALENT_MANAGEMENT'];
const linkedEntityKindOptions: ContractLinkedEntityKind[] = ['EMPLOYMENT_PROFILE', 'TALENT'];
const confidentialityTierOptions: ContractConfidentialityTier[] = [
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
];

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const toOptionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const toInputDate = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'string' && dateRegex.test(value)) {
    return value;
  }

  return formatUtcDateInputValue(value);
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

const dateField = (requiredMessage: string) =>
  z.string().trim().min(1, requiredMessage).regex(dateRegex, requiredMessage);

const optionalDateField = (dateMessage: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || dateRegex.test(value), dateMessage);

const assertKindCompatibility = (
  contractKind: ContractKind,
  linkedEntityKind: ContractLinkedEntityKind,
): boolean => {
  if (contractKind === 'EMPLOYMENT') {
    return linkedEntityKind === 'EMPLOYMENT_PROFILE';
  }

  return linkedEntityKind === 'TALENT';
};

const linkedPayload = (
  linkedEntityKind: ContractLinkedEntityKind,
  linkedEntityId: string,
): Pick<
  ContractCreatePayload,
  'linkedEntityKind' | 'linkedEmploymentProfileId' | 'linkedTalentId'
> => {
  if (linkedEntityKind === 'EMPLOYMENT_PROFILE') {
    return { linkedEntityKind, linkedEmploymentProfileId: linkedEntityId };
  }

  return { linkedEntityKind, linkedTalentId: linkedEntityId };
};

const loadLinkedEntityOptions = (kind: ContractLinkedEntityKind, search: string) => {
  if (kind === 'EMPLOYMENT_PROFILE') {
    return loadEmploymentProfileReferenceOptions(search);
  }

  return loadTalentReferenceOptions(search);
};

const createSchema = (messages: {
  required: string;
  token: string;
  date: string;
  compatible: string;
  filePair: string;
}) =>
  z
    .object({
      title: z.string().trim().min(1, messages.required),
      contractKind: z.enum(contractKindOptions as [ContractKind, ...ContractKind[]]),
      linkedEntityKind: z.enum(
        linkedEntityKindOptions as [ContractLinkedEntityKind, ...ContractLinkedEntityKind[]],
      ),
      linkedEntityId: z.string().trim().min(1, messages.required).regex(idRegex, messages.token),
      ownerEmploymentProfileId: z
        .string()
        .trim()
        .min(1, messages.required)
        .regex(idRegex, messages.token),
      confidentialityTier: z.enum(
        confidentialityTierOptions as [
          ContractConfidentialityTier,
          ...ContractConfidentialityTier[],
        ],
      ),
      effectiveStartDate: dateField(messages.date),
      effectiveEndDate: optionalDateField(messages.date),
      fileReferenceId: z.string().trim().optional(),
      fileDisplayName: z.string().trim().optional(),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      if (!assertKindCompatibility(value.contractKind, value.linkedEntityKind)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['linkedEntityKind'],
          message: messages.compatible,
        });
      }

      if (Boolean(value.fileReferenceId) !== Boolean(value.fileDisplayName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fileReferenceId'],
          message: messages.filePair,
        });
      }
    });

const draftCoreSchema = (messages: { required: string; token: string; date: string }) =>
  z.object({
    title: z.string().trim().min(1, messages.required),
    linkedEntityKind: z.enum(
      linkedEntityKindOptions as [ContractLinkedEntityKind, ...ContractLinkedEntityKind[]],
    ),
    linkedEntityId: z.string().trim().min(1, messages.required).regex(idRegex, messages.token),
    confidentialityTier: z.enum(
      confidentialityTierOptions as [ContractConfidentialityTier, ...ContractConfidentialityTier[]],
    ),
    effectiveStartDate: dateField(messages.date),
    effectiveEndDate: optionalDateField(messages.date),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
  });

type ContractCoreFormValues = {
  title: string;
  contractKind: ContractKind;
  linkedEntityKind: ContractLinkedEntityKind;
  linkedEntityId: string;
  ownerEmploymentProfileId: string;
  confidentialityTier: ContractConfidentialityTier;
  effectiveStartDate: string;
  effectiveEndDate: string;
  fileReferenceId: string;
  fileDisplayName: string;
  description: string;
  externalRef: string;
};

const useContractOptions = () => {
  const { t } = useTranslation(['contract-registry']);
  return {
    contractKinds: contractKindOptions.map((value) => ({
      value,
      label: t(`contract-registry:contractKinds.${value}`),
    })),
    linkedEntityKinds: linkedEntityKindOptions.map((value) => ({
      value,
      label: t(`contract-registry:linkedEntityKinds.${value}`),
    })),
    confidentialityTiers: confidentialityTierOptions.map((value) => ({
      value,
      label: t(`contract-registry:confidentialityTiers.${value}`),
    })),
  };
};

export const ContractCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: ContractCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const options = useContractOptions();
  const form = useForm<ContractCoreFormValues>({
    defaultValues: {
      title: '',
      contractKind: 'EMPLOYMENT',
      linkedEntityKind: 'EMPLOYMENT_PROFILE',
      linkedEntityId: '',
      ownerEmploymentProfileId: '',
      confidentialityTier: 'INTERNAL',
      effectiveStartDate: '',
      effectiveEndDate: '',
      fileReferenceId: '',
      fileDisplayName: '',
      description: '',
      externalRef: '',
    },
  });
  const schema = useMemo(
    () =>
      createSchema({
        required: t('contract-registry:validation.required'),
        token: t('contract-registry:validation.invalidToken'),
        date: t('contract-registry:validation.invalidDate'),
        compatible: t('contract-registry:validation.kindCompatibility'),
        filePair: t('contract-registry:validation.filePair'),
      }),
    [t],
  );
  const linkedEntityKind = form.watch('linkedEntityKind');
  const loadLinkedOptions = useMemo(
    () => (search: string) => loadLinkedEntityOptions(linkedEntityKind, search),
    [linkedEntityKind],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    await onSubmit({
      title: parsed.data.title,
      contractKind: parsed.data.contractKind,
      ...linkedPayload(parsed.data.linkedEntityKind, parsed.data.linkedEntityId),
      ownerEmploymentProfileId: parsed.data.ownerEmploymentProfileId,
      confidentialityTier: parsed.data.confidentialityTier,
      effectiveStartDate: parsed.data.effectiveStartDate,
      effectiveEndDate: toNullableText(parsed.data.effectiveEndDate),
      fileReferenceId: toOptionalText(parsed.data.fileReferenceId),
      fileDisplayName: toOptionalText(parsed.data.fileDisplayName),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('contract-registry:mutations.create.title')}
        subtitle={t('contract-registry:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('contract-registry:mutations.create.submit')}
        pendingLabel={t('contract-registry:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('contract-registry:generatedCode.label')}
            description={t('contract-registry:generatedCode.description')}
            className="md:col-span-2"
          />
          <TextInputField name="title" label={t('contract-registry:fields.title')} />
          <SelectField
            name="contractKind"
            label={t('contract-registry:fields.contractKind')}
            options={options.contractKinds}
          />
          <SelectField
            name="linkedEntityKind"
            label={t('contract-registry:fields.linkedEntityKind')}
            options={options.linkedEntityKinds}
          />
          <ReferencePickerField
            name="linkedEntityId"
            label={t('contract-registry:fields.linkedEntityId')}
            pickerId="contract-linked-entity"
            loadOptions={loadLinkedOptions}
            placeholder={t('contract-registry:placeholders.searchReference')}
          />
          <ReferencePickerField
            name="ownerEmploymentProfileId"
            label={t('contract-registry:fields.ownerEmploymentProfileId')}
            pickerId="contract-owner-employment-profile"
            loadOptions={loadEmploymentProfileReferenceOptions}
            placeholder={t('contract-registry:placeholders.searchReference')}
          />
          <SelectField
            name="confidentialityTier"
            label={t('contract-registry:fields.confidentialityTier')}
            options={options.confidentialityTiers}
          />
          <TextInputField
            name="effectiveStartDate"
            type="date"
            label={t('contract-registry:fields.effectiveStartDate')}
          />
          <TextInputField
            name="effectiveEndDate"
            type="date"
            label={t('contract-registry:fields.effectiveEndDate')}
          />
          <TextInputField
            name="fileReferenceId"
            label={t('contract-registry:fields.fileReferenceId')}
          />
          <TextInputField
            name="fileDisplayName"
            label={t('contract-registry:fields.fileDisplayName')}
          />
          <TextInputField name="externalRef" label={t('contract-registry:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('contract-registry:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const ContractDraftCoreSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: ContractDraftCoreSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const options = useContractOptions();
  const initialLinkedId =
    initialValues.linkedEntityKind === 'EMPLOYMENT_PROFILE'
      ? (initialValues.linkedEmploymentProfileId ?? '')
      : (initialValues.linkedTalentId ?? '');
  const form = useForm<
    Omit<
      ContractCoreFormValues,
      | 'contractCode'
      | 'contractKind'
      | 'ownerEmploymentProfileId'
      | 'fileReferenceId'
      | 'fileDisplayName'
    >
  >({
    defaultValues: {
      title: initialValues.title,
      linkedEntityKind: initialValues.linkedEntityKind,
      linkedEntityId: initialLinkedId,
      confidentialityTier: initialValues.confidentialityTier,
      effectiveStartDate: toInputDate(initialValues.effectiveStartDate),
      effectiveEndDate: toInputDate(initialValues.effectiveEndDate),
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });
  const schema = useMemo(
    () =>
      draftCoreSchema({
        required: t('contract-registry:validation.required'),
        token: t('contract-registry:validation.invalidToken'),
        date: t('contract-registry:validation.invalidDate'),
      }),
    [t],
  );
  const linkedEntityKind = form.watch('linkedEntityKind');
  const loadLinkedOptions = useMemo(
    () => (search: string) => loadLinkedEntityOptions(linkedEntityKind, search),
    [linkedEntityKind],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    await onSubmit({
      title: parsed.data.title,
      ...linkedPayload(parsed.data.linkedEntityKind, parsed.data.linkedEntityId),
      confidentialityTier: parsed.data.confidentialityTier,
      effectiveStartDate: parsed.data.effectiveStartDate,
      effectiveEndDate: toNullableText(parsed.data.effectiveEndDate),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('contract-registry:mutations.draftCore.title')}
        subtitle={t('contract-registry:mutations.draftCore.subtitle')}
        kind="edit"
        submitLabel={t('contract-registry:mutations.draftCore.submit')}
        pendingLabel={t('contract-registry:mutations.draftCore.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="title" label={t('contract-registry:fields.title')} />
          <SelectField
            name="linkedEntityKind"
            label={t('contract-registry:fields.linkedEntityKind')}
            options={options.linkedEntityKinds}
          />
          <ReferencePickerField
            name="linkedEntityId"
            label={t('contract-registry:fields.linkedEntityId')}
            pickerId="contract-draft-linked-entity"
            loadOptions={loadLinkedOptions}
            placeholder={t('contract-registry:placeholders.searchReference')}
          />
          <SelectField
            name="confidentialityTier"
            label={t('contract-registry:fields.confidentialityTier')}
            options={options.confidentialityTiers}
          />
          <TextInputField
            name="effectiveStartDate"
            type="date"
            label={t('contract-registry:fields.effectiveStartDate')}
          />
          <TextInputField
            name="effectiveEndDate"
            type="date"
            label={t('contract-registry:fields.effectiveEndDate')}
          />
          <TextInputField name="externalRef" label={t('contract-registry:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('contract-registry:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const ContractAssignOwnerSurface = ({
  initialOwnerEmploymentProfileId,
  onCancel,
  onSubmit,
  isPending = false,
}: ContractAssignOwnerSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const form = useForm<{ newOwnerEmploymentProfileId: string }>({
    defaultValues: { newOwnerEmploymentProfileId: initialOwnerEmploymentProfileId },
  });
  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({ newOwnerEmploymentProfileId: values.newOwnerEmploymentProfileId.trim() });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('contract-registry:mutations.assignOwner.title')}
        subtitle={t('contract-registry:mutations.assignOwner.subtitle')}
        kind="action"
        submitLabel={t('contract-registry:mutations.assignOwner.submit')}
        pendingLabel={t('contract-registry:mutations.assignOwner.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <ReferencePickerField
          name="newOwnerEmploymentProfileId"
          label={t('contract-registry:fields.newOwnerEmploymentProfileId')}
          pickerId="contract-new-owner-employment-profile"
          loadOptions={loadEmploymentProfileReferenceOptions}
          placeholder={t('contract-registry:placeholders.searchReference')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const ContractFileReferenceSurface = ({
  initialFileReferenceId,
  initialFileDisplayName,
  onCancel,
  onSubmit,
  isPending = false,
}: ContractFileReferenceSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const form = useForm<{ newFileReferenceId: string; newFileDisplayName: string }>({
    defaultValues: {
      newFileReferenceId: initialFileReferenceId ?? '',
      newFileDisplayName: initialFileDisplayName ?? '',
    },
  });
  const handleSubmit = form.handleSubmit(async (values) => {
    const newFileReferenceId = toNullableText(values.newFileReferenceId);
    const newFileDisplayName = toNullableText(values.newFileDisplayName);
    if (Boolean(newFileReferenceId) !== Boolean(newFileDisplayName)) {
      form.setError('newFileReferenceId', {
        type: 'validate',
        message: t('contract-registry:validation.filePair'),
      });
      return;
    }
    await onSubmit({ newFileReferenceId, newFileDisplayName });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('contract-registry:mutations.fileReference.title')}
        subtitle={t('contract-registry:mutations.fileReference.subtitle')}
        kind="action"
        submitLabel={t('contract-registry:mutations.fileReference.submit')}
        pendingLabel={t('contract-registry:mutations.fileReference.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField
            name="newFileReferenceId"
            label={t('contract-registry:fields.newFileReferenceId')}
          />
          <TextInputField
            name="newFileDisplayName"
            label={t('contract-registry:fields.newFileDisplayName')}
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const ContractDateActionSurface = ({
  action,
  onCancel,
  onSubmit,
  isPending = false,
}: DateActionSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const fieldName = action === 'expire' ? 'expiryDate' : 'terminationDate';
  const form = useForm<{ actionDate: string }>({ defaultValues: { actionDate: '' } });
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = dateField(t('contract-registry:validation.invalidDate')).safeParse(
      values.actionDate,
    );
    if (!parsed.success) {
      form.setError('actionDate', {
        type: 'validate',
        message: t('contract-registry:validation.invalidDate'),
      });
      return;
    }
    await onSubmit(
      action === 'expire' ? { expiryDate: parsed.data } : { terminationDate: parsed.data },
    );
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t(`contract-registry:mutations.${action}.title`)}
        subtitle={t(`contract-registry:mutations.${action}.subtitle`)}
        kind="action"
        submitLabel={t(`contract-registry:mutations.${action}.submit`)}
        pendingLabel={t(`contract-registry:mutations.${action}.pending`)}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField
          name="actionDate"
          type="date"
          label={t(`contract-registry:fields.${fieldName}`)}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
