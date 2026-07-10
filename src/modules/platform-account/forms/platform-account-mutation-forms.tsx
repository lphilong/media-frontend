import { useCallback, useEffect, useMemo, useRef } from 'react';
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
  PlatformAccountCapabilitiesPayload,
  PlatformAccountCreatePayload,
  PlatformAccountOwnerKind,
  PlatformAccountOwnershipTransferPayload,
  PlatformAccountUpdatePayload,
} from '@modules/platform-account/types/platform-account.types';
import { ownerKindValues } from '@modules/platform-account/tables/platform-account-columns';
import { loadPlatformOwnerReferenceOptions } from '@modules/platform-account';
import {
  CheckboxField,
  FormGrid,
  GeneratedCodeNotice,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
  presentation?: 'page' | 'drawer';
};

type PlatformAccountCreateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: PlatformAccountCreatePayload) => Promise<void> | void;
};

type PlatformAccountEditSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: {
    displayName: string;
    handle?: string | null;
    externalPlatformId?: string | null;
    profileUrl?: string | null;
    description?: string | null;
    externalRef?: string | null;
  };
  onSubmit: (payload: PlatformAccountUpdatePayload) => Promise<void> | void;
};

type PlatformAccountOwnershipTransferSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: {
    ownerKind: PlatformAccountOwnerKind;
    ownerOrgUnitId?: string | null;
    ownerTalentId?: string | null;
    ownerTalentGroupId?: string | null;
  };
  onSubmit: (payload: PlatformAccountOwnershipTransferPayload) => Promise<void> | void;
};

type PlatformAccountCapabilitiesSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: PlatformAccountCapabilitiesPayload;
  onSubmit: (payload: PlatformAccountCapabilitiesPayload) => Promise<void> | void;
};

const tokenRegex = /^[A-Za-z0-9_-]+$/;
const platformValues = ['TIKTOK', 'YOUTUBE', 'FACEBOOK', 'INSTAGRAM'] as const;
const platformSurfaceTypeValues = ['ACCOUNT', 'CHANNEL', 'PAGE'] as const;

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const toOwnerIdFields = (
  ownerKind: PlatformAccountOwnerKind,
  ownerId: string,
): Pick<
  PlatformAccountCreatePayload,
  'ownerOrgUnitId' | 'ownerTalentId' | 'ownerTalentGroupId'
> => {
  if (ownerKind === 'ORG_UNIT') {
    return { ownerOrgUnitId: ownerId };
  }

  if (ownerKind === 'TALENT') {
    return { ownerTalentId: ownerId };
  }

  return { ownerTalentGroupId: ownerId };
};

const readInitialOwnerId = (
  values: PlatformAccountOwnershipTransferSurfaceProps['initialValues'],
): string => {
  if (values.ownerKind === 'ORG_UNIT') {
    return values.ownerOrgUnitId ?? '';
  }

  if (values.ownerKind === 'TALENT') {
    return values.ownerTalentId ?? '';
  }

  return values.ownerTalentGroupId ?? '';
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

const createOwnerKindSchema = (requiredMessage: string) => {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value : undefined),
    z.enum(ownerKindValues as [PlatformAccountOwnerKind, ...PlatformAccountOwnerKind[]], {
      required_error: requiredMessage,
    }),
  );
};

const createBaseOwnerSchema = (requiredMessage: string, tokenMessage: string) => {
  return z.object({
    ownerKind: createOwnerKindSchema(requiredMessage),
    ownerId: z.string().trim().min(1, requiredMessage).regex(tokenRegex, tokenMessage),
  });
};

const createPlatformAccountCreateSchema = (
  requiredMessage: string,
  tokenMessage: string,
  locatorMessage: string,
) => {
  return createBaseOwnerSchema(requiredMessage, tokenMessage)
    .extend({
      platform: z.enum(platformValues, { required_error: requiredMessage }),
      platformSurfaceType: z.enum(platformSurfaceTypeValues, {
        required_error: requiredMessage,
      }),
      displayName: z.string().trim().min(1, requiredMessage),
      handle: z.string().trim().optional(),
      externalPlatformId: z.string().trim().optional(),
      profileUrl: z.string().trim().optional(),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
      livestreamEnabled: z.boolean(),
      contentPublishingEnabled: z.boolean(),
      monetizationEnabled: z.boolean(),
    })
    .superRefine((value, context) => {
      const hasLocator = [value.handle, value.externalPlatformId, value.profileUrl].some((item) =>
        item?.trim(),
      );

      if (!hasLocator) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['handle'],
          message: locatorMessage,
        });
      }
    });
};

const createPlatformAccountEditSchema = (requiredMessage: string) => {
  return z.object({
    displayName: z.string().trim().min(1, requiredMessage),
    handle: z.string().trim().optional(),
    externalPlatformId: z.string().trim().optional(),
    profileUrl: z.string().trim().optional(),
    description: z.string().trim().optional(),
    externalRef: z.string().trim().optional(),
  });
};

type PlatformAccountCreateFormValues = {
  platform: string;
  platformSurfaceType: string;
  displayName: string;
  ownerKind: PlatformAccountOwnerKind;
  ownerId: string;
  handle: string;
  externalPlatformId: string;
  profileUrl: string;
  description: string;
  externalRef: string;
  livestreamEnabled: boolean;
  contentPublishingEnabled: boolean;
  monetizationEnabled: boolean;
};

const useOwnerKindOptions = () => {
  const { t } = useTranslation(['platform-account']);
  return useMemo(
    () =>
      ownerKindValues.map((value) => ({
        value,
        label: t(`platform-account:ownerKinds.${value}`),
      })),
    [t],
  );
};

const useOwnerKindReset = (ownerKind: PlatformAccountOwnerKind, resetOwnerId: () => void): void => {
  const previousOwnerKindRef = useRef(ownerKind);

  useEffect(() => {
    if (previousOwnerKindRef.current !== ownerKind) {
      resetOwnerId();
      previousOwnerKindRef.current = ownerKind;
    }
  }, [ownerKind, resetOwnerId]);
};

export const PlatformAccountCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
  presentation,
}: PlatformAccountCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['platform-account', 'common']);
  const ownerKindOptions = useOwnerKindOptions();
  const form = useForm<PlatformAccountCreateFormValues>({
    defaultValues: {
      platform: '',
      platformSurfaceType: '',
      displayName: '',
      ownerKind: 'ORG_UNIT',
      ownerId: '',
      handle: '',
      externalPlatformId: '',
      profileUrl: '',
      description: '',
      externalRef: '',
      livestreamEnabled: true,
      contentPublishingEnabled: true,
      monetizationEnabled: false,
    },
  });

  const schema = useMemo(
    () =>
      createPlatformAccountCreateSchema(
        t('platform-account:validation.required'),
        t('platform-account:validation.invalidToken'),
        t('platform-account:validation.locatorRequired'),
      ),
    [t],
  );
  const { setValue } = form;
  const selectedOwnerKind = form.watch('ownerKind');
  const resetOwnerId = useCallback(() => {
    setValue('ownerId', '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [setValue]);
  useOwnerKindReset(selectedOwnerKind, resetOwnerId);
  const loadOwnerOptions = useCallback(
    (search: string) => loadPlatformOwnerReferenceOptions(selectedOwnerKind, search),
    [selectedOwnerKind],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'platform');
      return;
    }

    await onSubmit({
      platform: parsed.data.platform,
      platformSurfaceType: parsed.data.platformSurfaceType,
      displayName: parsed.data.displayName,
      ownerKind: parsed.data.ownerKind,
      ...toOwnerIdFields(parsed.data.ownerKind, parsed.data.ownerId),
      livestreamEnabled: parsed.data.livestreamEnabled,
      contentPublishingEnabled: parsed.data.contentPublishingEnabled,
      monetizationEnabled: parsed.data.monetizationEnabled,
      handle: toNullableText(parsed.data.handle),
      externalPlatformId: toNullableText(parsed.data.externalPlatformId),
      profileUrl: toNullableText(parsed.data.profileUrl),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('platform-account:mutations.create.title')}
        subtitle={t('platform-account:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('platform-account:mutations.create.submit')}
        pendingLabel={t('platform-account:mutations.create.pending')}
        presentation={presentation}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('platform-account:generatedCode.label')}
            description={t('platform-account:generatedCode.description')}
            className="md:col-span-2"
          />
          <SelectField
            name="platform"
            label={t('platform-account:fields.platform')}
            placeholder={t('platform-account:placeholders.selectPlatform')}
            options={platformValues.map((value) => ({
              value,
              label: t(`platform-account:platforms.${value}`),
            }))}
          />
          <SelectField
            name="platformSurfaceType"
            label={t('platform-account:fields.platformSurfaceType')}
            placeholder={t('platform-account:placeholders.selectSurfaceType')}
            options={platformSurfaceTypeValues.map((value) => ({
              value,
              label: t(`platform-account:surfaceTypes.${value}`),
            }))}
          />
          <TextInputField name="displayName" label={t('platform-account:fields.displayName')} />
          <SelectField
            name="ownerKind"
            label={t('platform-account:fields.ownerKind')}
            options={ownerKindOptions}
          />
          <ReferencePickerField
            name="ownerId"
            label={t('platform-account:fields.ownerId')}
            pickerId={`platform-account-owner-${selectedOwnerKind.toLowerCase()}`}
            loadOptions={loadOwnerOptions}
            helperText={t('platform-account:referenceHelp.ownerId')}
            placeholder={t('platform-account:placeholders.ownerSearch')}
          />
          <TextInputField
            name="handle"
            label={t('platform-account:fields.handle')}
            placeholder={t('platform-account:placeholders.handle')}
            helperText={t('platform-account:help.handle')}
          />
          <TextInputField
            name="externalPlatformId"
            label={t('platform-account:fields.externalPlatformId')}
            placeholder={t('platform-account:placeholders.optional')}
          />
          <TextInputField
            name="profileUrl"
            label={t('platform-account:fields.profileUrl')}
            placeholder={t('platform-account:placeholders.optional')}
          />
          <TextInputField
            name="externalRef"
            label={t('platform-account:fields.externalRef')}
            placeholder={t('platform-account:placeholders.optional')}
          />
        </FormGrid>
        <div className="flex flex-wrap gap-4">
          <CheckboxField
            name="livestreamEnabled"
            label={t('platform-account:fields.livestreamEnabled')}
          />
          <CheckboxField
            name="contentPublishingEnabled"
            label={t('platform-account:fields.contentPublishingEnabled')}
          />
          <CheckboxField
            name="monetizationEnabled"
            label={t('platform-account:fields.monetizationEnabled')}
          />
        </div>
        <TextInputField
          name="description"
          label={t('platform-account:fields.description')}
          placeholder={t('platform-account:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type PlatformAccountEditFormValues = {
  displayName: string;
  handle: string;
  externalPlatformId: string;
  profileUrl: string;
  description: string;
  externalRef: string;
};

export const PlatformAccountEditSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: PlatformAccountEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['platform-account', 'common']);
  const form = useForm<PlatformAccountEditFormValues>({
    defaultValues: {
      displayName: initialValues.displayName,
      handle: initialValues.handle ?? '',
      externalPlatformId: initialValues.externalPlatformId ?? '',
      profileUrl: initialValues.profileUrl ?? '',
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });

  const schema = useMemo(
    () => createPlatformAccountEditSchema(t('platform-account:validation.required')),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'displayName');
      return;
    }

    await onSubmit({
      displayName: parsed.data.displayName,
      handle: toNullableText(parsed.data.handle),
      externalPlatformId: toNullableText(parsed.data.externalPlatformId),
      profileUrl: toNullableText(parsed.data.profileUrl),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('platform-account:mutations.edit.title')}
        subtitle={t('platform-account:mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('platform-account:mutations.edit.submit')}
        pendingLabel={t('platform-account:mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="displayName" label={t('platform-account:fields.displayName')} />
          <TextInputField
            name="handle"
            label={t('platform-account:fields.handle')}
            placeholder={t('platform-account:placeholders.handle')}
            helperText={t('platform-account:help.handle')}
          />
          <TextInputField
            name="externalPlatformId"
            label={t('platform-account:fields.externalPlatformId')}
          />
          <TextInputField name="profileUrl" label={t('platform-account:fields.profileUrl')} />
          <TextInputField name="externalRef" label={t('platform-account:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('platform-account:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type PlatformAccountOwnershipTransferFormValues = {
  ownerKind: PlatformAccountOwnerKind;
  ownerId: string;
};

export const PlatformAccountOwnershipTransferSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: PlatformAccountOwnershipTransferSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['platform-account', 'common']);
  const ownerKindOptions = useOwnerKindOptions();
  const form = useForm<PlatformAccountOwnershipTransferFormValues>({
    defaultValues: {
      ownerKind: initialValues.ownerKind,
      ownerId: readInitialOwnerId(initialValues),
    },
  });

  const schema = useMemo(
    () =>
      createBaseOwnerSchema(
        t('platform-account:validation.required'),
        t('platform-account:validation.invalidReferenceToken'),
      ),
    [t],
  );
  const { setValue } = form;
  const selectedOwnerKind = form.watch('ownerKind');
  const resetOwnerId = useCallback(() => {
    setValue('ownerId', '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [setValue]);
  useOwnerKindReset(selectedOwnerKind, resetOwnerId);
  const loadOwnerOptions = useCallback(
    (search: string) => loadPlatformOwnerReferenceOptions(selectedOwnerKind, search),
    [selectedOwnerKind],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'ownerId');
      return;
    }

    await onSubmit({
      ownerKind: parsed.data.ownerKind,
      ...toOwnerIdFields(parsed.data.ownerKind, parsed.data.ownerId),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('platform-account:mutations.transferOwnership.title')}
        subtitle={t('platform-account:mutations.transferOwnership.subtitle')}
        kind="action"
        submitLabel={t('platform-account:mutations.transferOwnership.submit')}
        pendingLabel={t('platform-account:mutations.transferOwnership.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <SelectField
            name="ownerKind"
            label={t('platform-account:fields.ownerKind')}
            options={ownerKindOptions}
          />
          <ReferencePickerField
            name="ownerId"
            label={t('platform-account:fields.ownerId')}
            pickerId={`platform-account-transfer-owner-${selectedOwnerKind.toLowerCase()}`}
            loadOptions={loadOwnerOptions}
            helperText={t('platform-account:referenceHelp.ownerId')}
            placeholder={t('platform-account:placeholders.ownerSearch')}
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

type PlatformAccountCapabilitiesFormValues = PlatformAccountCapabilitiesPayload;

export const PlatformAccountCapabilitiesSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: PlatformAccountCapabilitiesSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['platform-account', 'common']);
  const form = useForm<PlatformAccountCapabilitiesFormValues>({
    defaultValues: initialValues,
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      livestreamEnabled: Boolean(values.livestreamEnabled),
      contentPublishingEnabled: Boolean(values.contentPublishingEnabled),
      monetizationEnabled: Boolean(values.monetizationEnabled),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('platform-account:mutations.capabilities.title')}
        subtitle={t('platform-account:mutations.capabilities.subtitle')}
        kind="action"
        submitLabel={t('platform-account:mutations.capabilities.submit')}
        pendingLabel={t('platform-account:mutations.capabilities.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <div className="flex flex-wrap gap-4">
          <CheckboxField
            name="livestreamEnabled"
            label={t('platform-account:fields.livestreamEnabled')}
          />
          <CheckboxField
            name="contentPublishingEnabled"
            label={t('platform-account:fields.contentPublishingEnabled')}
          />
          <CheckboxField
            name="monetizationEnabled"
            label={t('platform-account:fields.monetizationEnabled')}
          />
        </div>
      </ModuleMutationSurface>
    </FormProvider>
  );
};
