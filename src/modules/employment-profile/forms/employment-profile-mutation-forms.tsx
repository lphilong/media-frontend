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
  EmploymentContractStatus,
  EmploymentProfileContractStatusPayload,
  EmploymentProfileCreatePayload,
  EmploymentProfileManagerAssignmentPayload,
  EmploymentProfileOrgUnitAssignmentPayload,
  EmploymentProfileTerminatePayload,
  EmploymentProfileUpdatePayload,
  EmploymentProfileUserLinkPayload,
} from '@modules/employment-profile/types/employment-profile.types';
import {
  loadEmploymentProfileReferenceOptions,
  loadOrgUnitReferenceOptions,
  loadUserReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import { ModuleMutationSurface } from '@shared/modules';
import {
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

type EmploymentProfileCreateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: EmploymentProfileCreatePayload) => Promise<void> | void;
};

type EmploymentProfileEditSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: {
    legalName: string;
    displayName: string;
    employmentKind: string;
    jobTitle: string;
    externalRef?: string | null;
    titleDescription?: string | null;
  };
  onSubmit: (payload: EmploymentProfileUpdatePayload) => Promise<void> | void;
};

type EmploymentProfileOrgAssignmentSurfaceProps = BaseMutationSurfaceProps & {
  initialOrgUnitId: string;
  onSubmit: (payload: EmploymentProfileOrgUnitAssignmentPayload) => Promise<void> | void;
};

type EmploymentProfileManagerAssignmentSurfaceProps = BaseMutationSurfaceProps & {
  currentEmploymentProfileId: string;
  currentManagerEmploymentProfileId?: string | null;
  onSubmit: (payload: EmploymentProfileManagerAssignmentPayload) => Promise<void> | void;
};

type EmploymentProfileUserLinkSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: EmploymentProfileUserLinkPayload) => Promise<void> | void;
};

type EmploymentProfileContractStatusSurfaceProps = BaseMutationSurfaceProps & {
  currentStatus: EmploymentContractStatus;
  allowedStatuses?: EmploymentContractStatus[];
  onSubmit: (payload: EmploymentProfileContractStatusPayload) => Promise<void> | void;
};

type EmploymentProfileTerminateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: EmploymentProfileTerminatePayload) => Promise<void> | void;
};

const toOptionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

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

const isCanonicalDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() + 1 === month &&
    utcDate.getUTCDate() === day
  );
};

const employmentKindValues = ['EMPLOYEE', 'CONTRACTOR', 'PART_TIME', 'INTERN'] as const;

const createEmploymentCreateSchema = (requiredMessage: string, dateMessage: string) => {
  return z.object({
    legalName: z.string().trim().min(1, requiredMessage),
    displayName: z.string().trim().min(1, requiredMessage),
    employmentKind: z.enum(employmentKindValues, { required_error: requiredMessage }),
    jobTitle: z.string().trim().min(1, requiredMessage),
    orgUnitId: z.string().trim().min(1, requiredMessage),
    contractStatus: z.enum(['NONE', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
    employmentStartDate: z.string().trim().refine(isCanonicalDate, dateMessage),
    managerEmploymentProfileId: z.string().trim().optional(),
    linkedUserId: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
    titleDescription: z.string().trim().optional(),
  });
};

const createEmploymentEditSchema = (requiredMessage: string) => {
  return z.object({
    legalName: z.string().trim().min(1, requiredMessage),
    displayName: z.string().trim().min(1, requiredMessage),
    employmentKind: z.enum(employmentKindValues, { required_error: requiredMessage }),
    jobTitle: z.string().trim().min(1, requiredMessage),
    externalRef: z.string().trim().optional(),
    titleDescription: z.string().trim().optional(),
  });
};

const createOrgAssignmentSchema = (requiredMessage: string) => {
  return z.object({
    newOrgUnitId: z.string().trim().min(1, requiredMessage),
  });
};

const createManagerAssignmentSchema = (
  tokenMessage: string,
  selfMessage: string,
  currentId: string,
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
      if (normalized && normalized === currentId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newManagerEmploymentProfileId'],
          message: selfMessage,
        });
      }
    });
};

const createUserLinkSchema = (requiredMessage: string, tokenMessage: string) => {
  return z.object({
    linkedUserId: z
      .string()
      .trim()
      .min(1, requiredMessage)
      .regex(/^[A-Za-z0-9_-]+$/, tokenMessage),
  });
};

const createContractStatusSchema = () => {
  return z.object({
    newContractStatus: z.enum(['NONE', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
  });
};

const createTerminateSchema = (requiredMessage: string, dateMessage: string) => {
  return z.object({
    employmentEndDate: z
      .string()
      .trim()
      .min(1, requiredMessage)
      .refine(isCanonicalDate, dateMessage),
  });
};

const contractStatusOptions: Array<{
  value: EmploymentContractStatus;
  labelKey: string;
}> = [
  { value: 'NONE', labelKey: 'employment-profile:contractStatuses.NONE' },
  { value: 'PENDING_SIGNATURE', labelKey: 'employment-profile:contractStatuses.PENDING_SIGNATURE' },
  { value: 'ACTIVE', labelKey: 'employment-profile:contractStatuses.ACTIVE' },
  { value: 'EXPIRED', labelKey: 'employment-profile:contractStatuses.EXPIRED' },
  { value: 'TERMINATED', labelKey: 'employment-profile:contractStatuses.TERMINATED' },
];

type EmploymentProfileCreateFormValues = {
  legalName: string;
  displayName: string;
  employmentKind: string;
  jobTitle: string;
  orgUnitId: string;
  contractStatus: EmploymentContractStatus;
  employmentStartDate: string;
  managerEmploymentProfileId: string;
  linkedUserId: string;
  externalRef: string;
  titleDescription: string;
};

export const EmploymentProfileCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: EmploymentProfileCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common']);
  const form = useForm<EmploymentProfileCreateFormValues>({
    defaultValues: {
      legalName: '',
      displayName: '',
      employmentKind: '',
      jobTitle: '',
      orgUnitId: '',
      contractStatus: 'NONE',
      employmentStartDate: '',
      managerEmploymentProfileId: '',
      linkedUserId: '',
      externalRef: '',
      titleDescription: '',
    },
  });

  const schema = useMemo(
    () =>
      createEmploymentCreateSchema(
        t('employment-profile:validation.required'),
        t('employment-profile:validation.invalidDate'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'legalName');
      return;
    }

    await onSubmit({
      legalName: parsed.data.legalName,
      displayName: parsed.data.displayName,
      employmentKind: parsed.data.employmentKind,
      jobTitle: parsed.data.jobTitle,
      orgUnitId: parsed.data.orgUnitId,
      contractStatus: parsed.data.contractStatus,
      employmentStartDate: parsed.data.employmentStartDate,
      managerEmploymentProfileId: toNullableText(parsed.data.managerEmploymentProfileId),
      linkedUserId: toNullableText(parsed.data.linkedUserId),
      externalRef: toNullableText(parsed.data.externalRef),
      titleDescription: toNullableText(parsed.data.titleDescription),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('employment-profile:mutations.create.title')}
        subtitle={t('employment-profile:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('employment-profile:mutations.create.submit')}
        pendingLabel={t('employment-profile:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('employment-profile:generatedCode.label')}
            description={t('employment-profile:generatedCode.description')}
            className="md:col-span-2"
          />
          <SelectField
            name="employmentKind"
            label={t('employment-profile:fields.employmentKind')}
            placeholder={t('employment-profile:placeholders.selectEmploymentKind')}
            options={employmentKindValues.map((value) => ({
              value,
              label: t(`employment-profile:employmentKinds.${value}`),
            }))}
          />
          <TextInputField name="legalName" label={t('employment-profile:fields.legalName')} />
          <TextInputField name="displayName" label={t('employment-profile:fields.displayName')} />
          <TextInputField name="jobTitle" label={t('employment-profile:fields.jobTitle')} />
          <ReferencePickerField
            name="orgUnitId"
            label={t('employment-profile:fields.orgUnitId')}
            pickerId="employment-profile-org-unit"
            loadOptions={loadOrgUnitReferenceOptions}
            helperText={t('employment-profile:referenceHelp.orgUnitId')}
            placeholder={t('employment-profile:placeholders.orgUnitSearch')}
          />
          <SelectField
            name="contractStatus"
            label={t('employment-profile:fields.contractStatus')}
            options={contractStatusOptions.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
          />
          <TextInputField
            name="employmentStartDate"
            label={t('employment-profile:fields.employmentStartDate')}
            type="date"
          />
          <ReferencePickerField
            name="managerEmploymentProfileId"
            label={t('employment-profile:fields.managerEmploymentProfileId')}
            pickerId="employment-profile-manager"
            loadOptions={loadEmploymentProfileReferenceOptions}
            helperText={t('employment-profile:referenceHelp.managerEmploymentProfileId')}
            placeholder={t('employment-profile:placeholders.employmentProfileSearch')}
            clearable
            clearLabel={t('employment-profile:actions.clearManager')}
          />
          <ReferencePickerField
            name="linkedUserId"
            label={t('employment-profile:fields.linkedUserId')}
            pickerId="employment-profile-linked-user"
            loadOptions={loadUserReferenceOptions}
            helperText={t('employment-profile:referenceHelp.linkedUserId')}
            placeholder={t('employment-profile:placeholders.userSearch')}
            clearable
            clearLabel={t('employment-profile:actions.clearLinkedUser')}
          />
          <TextInputField
            name="externalRef"
            label={t('employment-profile:fields.externalRef')}
            placeholder={t('employment-profile:placeholders.optional')}
          />
        </FormGrid>
        <TextInputField
          name="titleDescription"
          label={t('employment-profile:fields.titleDescription')}
          placeholder={t('employment-profile:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type EmploymentProfileEditFormValues = {
  legalName: string;
  displayName: string;
  employmentKind: string;
  jobTitle: string;
  externalRef: string;
  titleDescription: string;
};

export const EmploymentProfileEditSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: EmploymentProfileEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common']);
  const form = useForm<EmploymentProfileEditFormValues>({
    defaultValues: {
      legalName: initialValues.legalName,
      displayName: initialValues.displayName,
      employmentKind: initialValues.employmentKind,
      jobTitle: initialValues.jobTitle,
      externalRef: initialValues.externalRef ?? '',
      titleDescription: initialValues.titleDescription ?? '',
    },
  });

  const schema = useMemo(
    () => createEmploymentEditSchema(t('employment-profile:validation.required')),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'legalName');
      return;
    }

    await onSubmit({
      legalName: parsed.data.legalName,
      displayName: parsed.data.displayName,
      employmentKind: parsed.data.employmentKind,
      jobTitle: parsed.data.jobTitle,
      externalRef: toNullableText(parsed.data.externalRef),
      titleDescription: toNullableText(parsed.data.titleDescription),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('employment-profile:mutations.edit.title')}
        subtitle={t('employment-profile:mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('employment-profile:mutations.edit.submit')}
        pendingLabel={t('employment-profile:mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="legalName" label={t('employment-profile:fields.legalName')} />
          <TextInputField name="displayName" label={t('employment-profile:fields.displayName')} />
          <SelectField
            name="employmentKind"
            label={t('employment-profile:fields.employmentKind')}
            options={employmentKindValues.map((value) => ({
              value,
              label: t(`employment-profile:employmentKinds.${value}`),
            }))}
          />
          <TextInputField name="jobTitle" label={t('employment-profile:fields.jobTitle')} />
          <TextInputField
            name="externalRef"
            label={t('employment-profile:fields.externalRef')}
            placeholder={t('employment-profile:placeholders.optional')}
          />
        </FormGrid>
        <TextInputField
          name="titleDescription"
          label={t('employment-profile:fields.titleDescription')}
          placeholder={t('employment-profile:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type EmploymentProfileOrgAssignmentFormValues = {
  newOrgUnitId: string;
};

export const EmploymentProfileOrgAssignmentSurface = ({
  initialOrgUnitId,
  onCancel,
  onSubmit,
  isPending = false,
}: EmploymentProfileOrgAssignmentSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common']);
  const form = useForm<EmploymentProfileOrgAssignmentFormValues>({
    defaultValues: {
      newOrgUnitId: initialOrgUnitId,
    },
  });

  const schema = useMemo(
    () => createOrgAssignmentSchema(t('employment-profile:validation.required')),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'newOrgUnitId');
      return;
    }

    await onSubmit({
      newOrgUnitId: parsed.data.newOrgUnitId,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('employment-profile:mutations.assignOrgUnit.title')}
        subtitle={t('employment-profile:mutations.assignOrgUnit.subtitle')}
        kind="action"
        submitLabel={t('employment-profile:mutations.assignOrgUnit.submit')}
        pendingLabel={t('employment-profile:mutations.assignOrgUnit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <ReferencePickerField
          name="newOrgUnitId"
          label={t('employment-profile:fields.newOrgUnitId')}
          pickerId="employment-profile-new-org-unit"
          loadOptions={loadOrgUnitReferenceOptions}
          helperText={t('employment-profile:referenceHelp.newOrgUnitId')}
          placeholder={t('employment-profile:placeholders.orgUnitSearch')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type EmploymentProfileManagerAssignmentFormValues = {
  newManagerEmploymentProfileId: string;
};

export const EmploymentProfileManagerAssignmentSurface = ({
  currentEmploymentProfileId,
  currentManagerEmploymentProfileId,
  onCancel,
  onSubmit,
  isPending = false,
}: EmploymentProfileManagerAssignmentSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common']);
  const form = useForm<EmploymentProfileManagerAssignmentFormValues>({
    defaultValues: {
      newManagerEmploymentProfileId: currentManagerEmploymentProfileId ?? '',
    },
  });

  const schema = useMemo(
    () =>
      createManagerAssignmentSchema(
        t('employment-profile:validation.invalidReferenceToken'),
        t('employment-profile:validation.managerCannotBeSelf'),
        currentEmploymentProfileId,
      ),
    [currentEmploymentProfileId, t],
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
        title={t('employment-profile:mutations.assignManager.title')}
        subtitle={t('employment-profile:mutations.assignManager.subtitle')}
        kind="action"
        submitLabel={t('employment-profile:mutations.assignManager.submit')}
        pendingLabel={t('employment-profile:mutations.assignManager.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <ReferencePickerField
          name="newManagerEmploymentProfileId"
          label={t('employment-profile:fields.newManagerEmploymentProfileId')}
          pickerId="employment-profile-new-manager"
          loadOptions={loadEmploymentProfileReferenceOptions}
          helperText={t('employment-profile:referenceHelp.newManagerEmploymentProfileId')}
          placeholder={t('employment-profile:placeholders.employmentProfileSearch')}
          clearable
          clearLabel={t('employment-profile:actions.clearManager')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type EmploymentProfileUserLinkFormValues = {
  linkedUserId: string;
};

export const EmploymentProfileUserLinkSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: EmploymentProfileUserLinkSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common']);
  const form = useForm<EmploymentProfileUserLinkFormValues>({
    defaultValues: {
      linkedUserId: '',
    },
  });

  const schema = useMemo(
    () =>
      createUserLinkSchema(
        t('employment-profile:validation.required'),
        t('employment-profile:validation.invalidReferenceToken'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'linkedUserId');
      return;
    }

    await onSubmit({
      linkedUserId: parsed.data.linkedUserId,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('employment-profile:mutations.linkUser.title')}
        subtitle={t('employment-profile:mutations.linkUser.subtitle')}
        kind="action"
        submitLabel={t('employment-profile:mutations.linkUser.submit')}
        pendingLabel={t('employment-profile:mutations.linkUser.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <ReferencePickerField
          name="linkedUserId"
          label={t('employment-profile:fields.linkedUserId')}
          pickerId="employment-profile-link-user"
          loadOptions={loadUserReferenceOptions}
          helperText={t('employment-profile:referenceHelp.linkedUserId')}
          placeholder={t('employment-profile:placeholders.userSearch')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type EmploymentProfileContractStatusFormValues = {
  newContractStatus: EmploymentContractStatus;
};

export const EmploymentProfileContractStatusSurface = ({
  currentStatus,
  allowedStatuses,
  onCancel,
  onSubmit,
  isPending = false,
}: EmploymentProfileContractStatusSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common']);
  const form = useForm<EmploymentProfileContractStatusFormValues>({
    defaultValues: {
      newContractStatus: currentStatus,
    },
  });

  const schema = useMemo(() => createContractStatusSchema(), []);
  const selectableStatuses = useMemo(() => {
    return allowedStatuses ?? contractStatusOptions.map((option) => option.value);
  }, [allowedStatuses]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'newContractStatus');
      return;
    }

    if (
      selectableStatuses.length === 0 ||
      !selectableStatuses.includes(parsed.data.newContractStatus)
    ) {
      form.setError('newContractStatus', {
        type: 'validate',
        message: t('employment-profile:validation.contractStatusTransitionNotAllowed'),
      });
      return;
    }

    await onSubmit({
      newContractStatus: parsed.data.newContractStatus,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('employment-profile:mutations.contractStatus.title')}
        subtitle={t('employment-profile:mutations.contractStatus.subtitle')}
        kind="action"
        submitLabel={t('employment-profile:mutations.contractStatus.submit')}
        pendingLabel={t('employment-profile:mutations.contractStatus.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <SelectField
          name="newContractStatus"
          label={t('employment-profile:fields.newContractStatus')}
          options={contractStatusOptions
            .filter((option) => selectableStatuses.includes(option.value))
            .map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type EmploymentProfileTerminateFormValues = {
  employmentEndDate: string;
};

export const EmploymentProfileTerminateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: EmploymentProfileTerminateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common']);
  const form = useForm<EmploymentProfileTerminateFormValues>({
    defaultValues: {
      employmentEndDate: '',
    },
  });

  const schema = useMemo(
    () =>
      createTerminateSchema(
        t('employment-profile:validation.required'),
        t('employment-profile:validation.invalidDate'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'employmentEndDate');
      return;
    }

    await onSubmit({
      employmentEndDate: parsed.data.employmentEndDate,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('employment-profile:mutations.terminate.title')}
        subtitle={t('employment-profile:mutations.terminate.subtitle')}
        kind="action"
        submitLabel={t('employment-profile:mutations.terminate.submit')}
        pendingLabel={t('employment-profile:mutations.terminate.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField
          name="employmentEndDate"
          label={t('employment-profile:fields.employmentEndDate')}
          type="date"
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
