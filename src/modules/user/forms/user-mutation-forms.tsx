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

import { userActorKindValues } from '@modules/user/constants/user.constants';
import type {
  UserActorKind,
  UserAuthLinkagePayload,
  UserCreatePayload,
  UserDetailRecord,
  UserUpdatePayload,
} from '@modules/user/types/user.types';
import { FormGrid, SelectField, TextInputField } from '@shared/forms';
import { ModuleMutationSurface } from '@shared/modules';

type BaseMutationSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type UserCreateSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: UserCreatePayload) => Promise<void> | void;
};

type UserUpdateSurfaceProps = BaseMutationSurfaceProps & {
  initialRecord: UserDetailRecord;
  onSubmit: (payload: UserUpdatePayload) => Promise<void> | void;
};

type UserAuthLinkageSurfaceProps = BaseMutationSurfaceProps & {
  initialValues: UserAuthLinkagePayload;
  onSubmit: (payload: UserAuthLinkagePayload) => Promise<void> | void;
};

const nonEmptyOptionalText = (value?: string | null): string | undefined => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
};

const readText = (value?: string | null): string => value ?? '';

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

const createUserCreateSchema = (requiredMessage: string, maxMessage: string) =>
  z.object({
    authSubject: z.string().trim().min(1, requiredMessage),
    actorKind: z.enum(userActorKindValues).optional(),
    displayName: z.string().trim().min(1, requiredMessage).max(128, maxMessage),
    email: z.string().trim(),
    phone: z.string().trim(),
    locale: z.string().trim(),
    timezone: z.string().trim(),
  });

const createUserUpdateSchema = (requiredMessage: string, maxMessage: string) =>
  z.object({
    displayName: z.string().trim().min(1, requiredMessage).max(128, maxMessage),
    email: z.string().trim(),
    phone: z.string().trim(),
    locale: z.string().trim(),
    timezone: z.string().trim(),
  });

const createAuthLinkageSchema = (requiredMessage: string) =>
  z.object({
    provider: z.literal('auth0'),
    subject: z.string().trim().min(1, requiredMessage),
  });

const buildChangedUpdatePayload = (
  initialRecord: UserDetailRecord,
  values: UserUpdateFormValues,
): UserUpdatePayload => {
  const payload: UserUpdatePayload = {};
  const displayName = values.displayName.trim();
  if (displayName !== initialRecord.profile.displayName) {
    payload.displayName = displayName;
  }

  const nextEmail = nonEmptyOptionalText(values.email);
  if (nextEmail && nextEmail !== (initialRecord.profile.email ?? undefined)) {
    payload.email = nextEmail;
  }

  const nextPhone = nonEmptyOptionalText(values.phone);
  if (nextPhone && nextPhone !== (initialRecord.profile.phone ?? undefined)) {
    payload.phone = nextPhone;
  }

  const nextLocale = nonEmptyOptionalText(values.locale);
  if (nextLocale && nextLocale !== (initialRecord.preferences.locale ?? undefined)) {
    payload.locale = nextLocale;
  }

  const nextTimezone = nonEmptyOptionalText(values.timezone);
  if (nextTimezone && nextTimezone !== (initialRecord.preferences.timezone ?? undefined)) {
    payload.timezone = nextTimezone;
  }

  return payload;
};

type UserCreateFormValues = {
  authSubject: string;
  actorKind: UserActorKind;
  displayName: string;
  email: string;
  phone: string;
  locale: string;
  timezone: string;
};

type UserUpdateFormValues = {
  displayName: string;
  email: string;
  phone: string;
  locale: string;
  timezone: string;
};

type UserAuthLinkageFormValues = UserAuthLinkagePayload;

export const UserCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: UserCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['user', 'common']);
  const form = useForm<UserCreateFormValues>({
    defaultValues: {
      authSubject: '',
      actorKind: 'STAFF',
      displayName: '',
      email: '',
      phone: '',
      locale: '',
      timezone: '',
    },
  });

  const schema = useMemo(
    () => createUserCreateSchema(t('user:validation.required'), t('user:validation.maxText')),
    [t],
  );

  const actorKindOptions = useMemo(
    () =>
      userActorKindValues.map((value) => ({
        value,
        label: t(`user:actorKinds.${value}`),
      })),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'authSubject');
      return;
    }

    await onSubmit({
      authSubject: parsed.data.authSubject,
      actorKind: parsed.data.actorKind,
      displayName: parsed.data.displayName,
      email: nonEmptyOptionalText(parsed.data.email),
      phone: nonEmptyOptionalText(parsed.data.phone),
      locale: nonEmptyOptionalText(parsed.data.locale),
      timezone: nonEmptyOptionalText(parsed.data.timezone),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('user:mutations.create.title')}
        subtitle={t('user:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('user:mutations.create.submit')}
        pendingLabel={t('user:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="authSubject" label={t('user:fields.authSubject')} />
          <SelectField
            name="actorKind"
            label={t('user:fields.actorKind')}
            options={actorKindOptions}
          />
          <TextInputField name="displayName" label={t('user:fields.displayName')} />
          <TextInputField name="email" label={t('user:fields.email')} />
          <TextInputField name="phone" label={t('user:fields.phone')} />
          <TextInputField name="locale" label={t('user:fields.locale')} />
          <TextInputField name="timezone" label={t('user:fields.timezone')} />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const UserUpdateSurface = ({
  initialRecord,
  onCancel,
  onSubmit,
  isPending = false,
}: UserUpdateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['user', 'common']);
  const form = useForm<UserUpdateFormValues>({
    defaultValues: {
      displayName: initialRecord.profile.displayName,
      email: readText(initialRecord.profile.email),
      phone: readText(initialRecord.profile.phone),
      locale: readText(initialRecord.preferences.locale),
      timezone: readText(initialRecord.preferences.timezone),
    },
  });

  const schema = useMemo(
    () => createUserUpdateSchema(t('user:validation.required'), t('user:validation.maxText')),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'displayName');
      return;
    }

    const payload = buildChangedUpdatePayload(initialRecord, parsed.data);
    if (Object.keys(payload).length === 0) {
      form.setError('displayName', {
        type: 'validate',
        message: t('user:validation.noChangedFields'),
      });
      return;
    }

    await onSubmit(payload);
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('user:mutations.update.title')}
        subtitle={t('user:mutations.update.subtitle')}
        kind="edit"
        submitLabel={t('user:mutations.update.submit')}
        pendingLabel={t('user:mutations.update.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="displayName" label={t('user:fields.displayName')} />
          <TextInputField name="email" label={t('user:fields.email')} />
          <TextInputField name="phone" label={t('user:fields.phone')} />
          <TextInputField name="locale" label={t('user:fields.locale')} />
          <TextInputField name="timezone" label={t('user:fields.timezone')} />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const UserAuthLinkageSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: UserAuthLinkageSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['user', 'common']);
  const form = useForm<UserAuthLinkageFormValues>({
    defaultValues: initialValues,
  });

  const schema = useMemo(() => createAuthLinkageSchema(t('user:validation.required')), [t]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'subject');
      return;
    }

    await onSubmit({
      provider: 'auth0',
      subject: parsed.data.subject,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('user:mutations.authLinkage.title')}
        subtitle={t('user:mutations.authLinkage.subtitle')}
        kind="action"
        submitLabel={t('user:mutations.authLinkage.submit')}
        pendingLabel={t('user:mutations.authLinkage.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('user:fields.authProvider')}
            </span>
            <input
              type="text"
              value="auth0"
              readOnly
              className="rounded border border-border bg-slate-50 px-3 py-2 text-sm text-muted outline-none"
            />
          </label>
          <TextInputField name="subject" label={t('user:fields.authSubject')} />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};
