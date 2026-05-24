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
  TalentGroupAddMemberPayload,
  TalentGroupAssignManagerPayload,
  TalentGroupCreatePayload,
  TalentGroupUpdateLineupPayload,
  TalentGroupUpdatePayload,
} from '@modules/talent-group/types/talent-group.types';
import {
  loadEmploymentProfileReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import { ModuleMutationSurface } from '@shared/modules';
import { FormGrid, GeneratedCodeNotice, ReferencePickerField, TextInputField } from '@shared/forms';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type TalentGroupCreateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: TalentGroupCreatePayload) => Promise<void> | void;
};

type TalentGroupEditSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: {
    name: string;
    shortName?: string | null;
    description?: string | null;
    displayOrder: number;
    externalRef?: string | null;
  };
  onSubmit: (payload: TalentGroupUpdatePayload) => Promise<void> | void;
};

type TalentGroupAddMemberSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: TalentGroupAddMemberPayload) => Promise<void> | void;
};

type TalentGroupUpdateLineupSurfaceProps = BaseMutationSurfaceProps & {
  initialLineupOrder: number;
  onSubmit: (payload: TalentGroupUpdateLineupPayload) => Promise<void> | void;
};

type TalentGroupAssignManagerSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: TalentGroupAssignManagerPayload) => Promise<void> | void;
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

const createGroupCreateSchema = (requiredMessage: string, numberMessage: string) => {
  return z.object({
    name: z.string().trim().min(1, requiredMessage),
    displayOrder: z.coerce.number().int(numberMessage).min(0, numberMessage),
    shortName: z.string().trim().optional(),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
  });
};

const createGroupEditSchema = (requiredMessage: string, numberMessage: string) => {
  return z.object({
    name: z.string().trim().min(1, requiredMessage),
    shortName: z.string().trim().optional(),
    description: z.string().trim().optional(),
    displayOrder: z.coerce.number().int(numberMessage).min(0, numberMessage),
    externalRef: z.string().trim().optional(),
  });
};

const createGroupAddMemberSchema = (
  requiredMessage: string,
  tokenMessage: string,
  numberMessage: string,
) => {
  return z.object({
    talentId: z
      .string()
      .trim()
      .min(1, requiredMessage)
      .regex(/^[A-Za-z0-9_-]+$/, tokenMessage),
    lineupOrder: z.coerce.number().int(numberMessage).min(0, numberMessage),
  });
};

const createLineupSchema = (numberMessage: string) => {
  return z.object({
    newLineupOrder: z.coerce.number().int(numberMessage).min(0, numberMessage),
  });
};

const createAssignManagerSchema = (requiredMessage: string, tokenMessage: string) => {
  return z.object({
    managerEmploymentProfileId: z
      .string()
      .trim()
      .min(1, requiredMessage)
      .regex(/^[A-Za-z0-9_-]+$/, tokenMessage),
    reason: z.string().trim().optional(),
  });
};

type TalentGroupCreateFormValues = {
  name: string;
  shortName: string;
  description: string;
  displayOrder: string;
  externalRef: string;
};

export const TalentGroupCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: TalentGroupCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent-group', 'common']);
  const form = useForm<TalentGroupCreateFormValues>({
    defaultValues: {
      name: '',
      shortName: '',
      description: '',
      displayOrder: '0',
      externalRef: '',
    },
  });

  const schema = useMemo(
    () =>
      createGroupCreateSchema(
        t('talent-group:validation.required'),
        t('talent-group:validation.invalidDisplayOrder'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
      return;
    }

    await onSubmit({
      name: parsed.data.name,
      displayOrder: parsed.data.displayOrder,
      shortName: toNullableText(parsed.data.shortName),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent-group:mutations.create.title')}
        subtitle={t('talent-group:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('talent-group:mutations.create.submit')}
        pendingLabel={t('talent-group:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('talent-group:generatedCode.label')}
            description={t('talent-group:generatedCode.description')}
            className="md:col-span-2"
          />
          <TextInputField name="name" label={t('talent-group:fields.name')} />
          <TextInputField
            name="displayOrder"
            label={t('talent-group:fields.displayOrder')}
            type="number"
            helperText={t('talent-group:help.displayOrder')}
          />
          <TextInputField
            name="shortName"
            label={t('talent-group:fields.shortName')}
            placeholder={t('talent-group:placeholders.optional')}
          />
          <TextInputField
            name="externalRef"
            label={t('talent-group:fields.externalRef')}
            placeholder={t('talent-group:placeholders.optional')}
          />
        </FormGrid>
        <TextInputField
          name="description"
          label={t('talent-group:fields.description')}
          placeholder={t('talent-group:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type TalentGroupEditFormValues = {
  name: string;
  shortName: string;
  description: string;
  displayOrder: string;
  externalRef: string;
};

export const TalentGroupEditSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: TalentGroupEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent-group', 'common']);
  const form = useForm<TalentGroupEditFormValues>({
    defaultValues: {
      name: initialValues.name,
      shortName: initialValues.shortName ?? '',
      description: initialValues.description ?? '',
      displayOrder: String(initialValues.displayOrder),
      externalRef: initialValues.externalRef ?? '',
    },
  });

  const schema = useMemo(
    () =>
      createGroupEditSchema(
        t('talent-group:validation.required'),
        t('talent-group:validation.invalidDisplayOrder'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'name');
      return;
    }

    await onSubmit({
      name: parsed.data.name,
      shortName: toNullableText(parsed.data.shortName),
      description: toNullableText(parsed.data.description),
      displayOrder: parsed.data.displayOrder,
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent-group:mutations.edit.title')}
        subtitle={t('talent-group:mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('talent-group:mutations.edit.submit')}
        pendingLabel={t('talent-group:mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="name" label={t('talent-group:fields.name')} />
          <TextInputField
            name="displayOrder"
            label={t('talent-group:fields.displayOrder')}
            type="number"
            helperText={t('talent-group:help.displayOrder')}
          />
          <TextInputField
            name="shortName"
            label={t('talent-group:fields.shortName')}
            placeholder={t('talent-group:placeholders.optional')}
          />
          <TextInputField
            name="externalRef"
            label={t('talent-group:fields.externalRef')}
            placeholder={t('talent-group:placeholders.optional')}
          />
        </FormGrid>
        <TextInputField
          name="description"
          label={t('talent-group:fields.description')}
          placeholder={t('talent-group:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type TalentGroupAddMemberFormValues = {
  talentId: string;
  lineupOrder: string;
};

export const TalentGroupAddMemberSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: TalentGroupAddMemberSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent-group', 'common']);
  const form = useForm<TalentGroupAddMemberFormValues>({
    defaultValues: {
      talentId: '',
      lineupOrder: '0',
    },
  });

  const schema = useMemo(
    () =>
      createGroupAddMemberSchema(
        t('talent-group:validation.required'),
        t('talent-group:validation.invalidReferenceToken'),
        t('talent-group:validation.invalidLineupOrder'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'talentId');
      return;
    }

    await onSubmit({
      talentId: parsed.data.talentId,
      lineupOrder: parsed.data.lineupOrder,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent-group:mutations.addMember.title')}
        subtitle={t('talent-group:mutations.addMember.subtitle')}
        kind="action"
        submitLabel={t('talent-group:mutations.addMember.submit')}
        pendingLabel={t('talent-group:mutations.addMember.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <ReferencePickerField
            name="talentId"
            label={t('talent-group:fields.talentId')}
            pickerId="talent-group-member-talent"
            loadOptions={loadTalentReferenceOptions}
            helperText={t('talent-group:referenceHelp.talentId')}
            placeholder={t('talent-group:placeholders.talentSearch')}
          />
          <TextInputField
            name="lineupOrder"
            label={t('talent-group:fields.lineupOrder')}
            type="number"
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type TalentGroupUpdateLineupFormValues = {
  newLineupOrder: string;
};

export const TalentGroupUpdateLineupSurface = ({
  initialLineupOrder,
  onCancel,
  onSubmit,
  isPending = false,
}: TalentGroupUpdateLineupSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent-group', 'common']);
  const form = useForm<TalentGroupUpdateLineupFormValues>({
    defaultValues: {
      newLineupOrder: String(initialLineupOrder),
    },
  });

  const schema = useMemo(
    () => createLineupSchema(t('talent-group:validation.invalidLineupOrder')),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'newLineupOrder');
      return;
    }

    await onSubmit({
      newLineupOrder: parsed.data.newLineupOrder,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent-group:mutations.updateLineup.title')}
        subtitle={t('talent-group:mutations.updateLineup.subtitle')}
        kind="action"
        submitLabel={t('talent-group:mutations.updateLineup.submit')}
        pendingLabel={t('talent-group:mutations.updateLineup.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField
          name="newLineupOrder"
          label={t('talent-group:fields.newLineupOrder')}
          type="number"
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type TalentGroupAssignManagerFormValues = {
  managerEmploymentProfileId: string;
  reason: string;
};

export const TalentGroupAssignManagerSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: TalentGroupAssignManagerSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['talent-group', 'common']);
  const form = useForm<TalentGroupAssignManagerFormValues>({
    defaultValues: {
      managerEmploymentProfileId: '',
      reason: '',
    },
  });

  const schema = useMemo(
    () =>
      createAssignManagerSchema(
        t('talent-group:validation.required'),
        t('talent-group:validation.invalidReferenceToken'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'managerEmploymentProfileId');
      return;
    }

    await onSubmit({
      managerEmploymentProfileId: parsed.data.managerEmploymentProfileId,
      reason: toNullableText(parsed.data.reason),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('talent-group:mutations.assignManager.title')}
        subtitle={t('talent-group:mutations.assignManager.subtitle')}
        kind="action"
        submitLabel={t('talent-group:mutations.assignManager.submit')}
        pendingLabel={t('talent-group:mutations.assignManager.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <ReferencePickerField
            name="managerEmploymentProfileId"
            label={t('talent-group:fields.managerEmploymentProfileId')}
            pickerId="talent-group-manager-employment-profile"
            loadOptions={loadEmploymentProfileReferenceOptions}
            helperText={t('talent-group:referenceHelp.managerEmploymentProfileId')}
            placeholder={t('talent-group:placeholders.managerSearch')}
          />
          <TextInputField
            name="reason"
            label={t('talent-group:fields.reason')}
            placeholder={t('talent-group:placeholders.optional')}
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};
