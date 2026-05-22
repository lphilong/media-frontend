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
  UserProvisionPayload,
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

type UserProvisionSurfaceProps = BaseMutationSurfaceProps & {
  onSubmit: (payload: UserProvisionPayload) => Promise<void> | void;
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

const USER_LOCALE_OPTIONS = ['vi', 'en', 'zh'] as const;
const USER_TIMEZONE_OPTIONS = ['Asia/Ho_Chi_Minh', 'Asia/Saigon', 'UTC'] as const;
const DEFAULT_USER_TIMEZONE = 'Asia/Ho_Chi_Minh';

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
    actorKind: z.enum(userActorKindValues).optional(),
    displayName: z.string().trim().min(1, requiredMessage).max(128, maxMessage),
    email: z.string().trim(),
    phone: z.string().trim(),
    locale: z.enum(USER_LOCALE_OPTIONS).or(z.literal('')),
    timezone: z.enum(USER_TIMEZONE_OPTIONS),
  });

const createUserProvisionSchema = (requiredMessage: string, maxMessage: string) =>
  z.object({
    actorKind: z.enum(userActorKindValues).optional(),
    displayName: z.string().trim().min(1, requiredMessage).max(128, maxMessage),
    email: z.string().trim().email(requiredMessage),
    phone: z.string().trim(),
    locale: z.enum(USER_LOCALE_OPTIONS).or(z.literal('')),
    timezone: z.enum(USER_TIMEZONE_OPTIONS),
  });

const createUserUpdateSchema = (requiredMessage: string, maxMessage: string) =>
  z.object({
    displayName: z.string().trim().min(1, requiredMessage).max(128, maxMessage),
    email: z.string().trim(),
    phone: z.string().trim(),
    locale: z.enum(USER_LOCALE_OPTIONS).or(z.literal('')),
    timezone: z.enum(USER_TIMEZONE_OPTIONS).or(z.literal('')),
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
  actorKind: UserActorKind;
  displayName: string;
  email: string;
  phone: string;
  locale: string;
  timezone: string;
};

type UserProvisionFormValues = UserCreateFormValues;

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
      actorKind: 'STAFF',
      displayName: '',
      email: '',
      phone: '',
      locale: '',
      timezone: DEFAULT_USER_TIMEZONE,
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

  const localeOptions = useMemo(
    () =>
      USER_LOCALE_OPTIONS.map((value) => ({
        value,
        label: t(`common:locales.${value}`),
      })),
    [t],
  );

  const timezoneOptions = useMemo(
    () =>
      USER_TIMEZONE_OPTIONS.map((value) => ({
        value,
        label: value,
      })),
    [],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'displayName');
      return;
    }

    await onSubmit({
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
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text">{t('user:sections.profile')}</h3>
          <FormGrid columns={2}>
            <TextInputField
              name="displayName"
              label={t('user:fields.displayName')}
              helperText={t('user:help.displayName')}
            />
            <SelectField
              name="actorKind"
              label={t('user:fields.actorKind')}
              options={actorKindOptions}
            />
            <TextInputField name="email" type="email" label={t('user:fields.email')} />
            <TextInputField name="phone" type="tel" label={t('user:fields.phone')} />
          </FormGrid>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text">{t('user:sections.preferences')}</h3>
          <FormGrid columns={2}>
            <SelectField
              name="locale"
              label={t('user:fields.locale')}
              options={localeOptions}
              placeholder={t('user:placeholders.locale')}
            />
            <SelectField
              name="timezone"
              label={t('user:fields.timezone')}
              options={timezoneOptions}
              helperText={t('user:help.timezone')}
            />
          </FormGrid>
        </section>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const UserProvisionSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: UserProvisionSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['user', 'common']);
  const form = useForm<UserProvisionFormValues>({
    defaultValues: {
      actorKind: 'STAFF',
      displayName: '',
      email: '',
      phone: '',
      locale: '',
      timezone: DEFAULT_USER_TIMEZONE,
    },
  });

  const schema = useMemo(
    () => createUserProvisionSchema(t('user:validation.required'), t('user:validation.maxText')),
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

  const localeOptions = useMemo(
    () =>
      USER_LOCALE_OPTIONS.map((value) => ({
        value,
        label: t(`common:locales.${value}`),
      })),
    [t],
  );

  const timezoneOptions = useMemo(
    () =>
      USER_TIMEZONE_OPTIONS.map((value) => ({
        value,
        label: value,
      })),
    [],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'email');
      return;
    }

    await onSubmit({
      actorKind: parsed.data.actorKind,
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      phone: nonEmptyOptionalText(parsed.data.phone),
      locale: nonEmptyOptionalText(parsed.data.locale),
      timezone: nonEmptyOptionalText(parsed.data.timezone),
      credentialMode: 'INVITE_LINK',
      sendInvitation: true,
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('user:mutations.provision.title')}
        subtitle={t('user:mutations.provision.subtitle')}
        kind="create"
        submitLabel={t('user:mutations.provision.submit')}
        pendingLabel={t('user:mutations.provision.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text">{t('user:sections.profile')}</h3>
          <FormGrid columns={2}>
            <TextInputField
              name="email"
              type="email"
              label={t('user:fields.email')}
              helperText={t('user:help.provisionEmail')}
            />
            <TextInputField
              name="displayName"
              label={t('user:fields.displayName')}
              helperText={t('user:help.displayName')}
            />
            <SelectField
              name="actorKind"
              label={t('user:fields.actorKind')}
              options={actorKindOptions}
            />
            <TextInputField name="phone" type="tel" label={t('user:fields.phone')} />
          </FormGrid>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text">{t('user:sections.preferences')}</h3>
          <FormGrid columns={2}>
            <SelectField
              name="locale"
              label={t('user:fields.locale')}
              options={localeOptions}
              placeholder={t('user:placeholders.locale')}
            />
            <SelectField
              name="timezone"
              label={t('user:fields.timezone')}
              options={timezoneOptions}
              helperText={t('user:help.timezone')}
            />
          </FormGrid>
        </section>
        <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('user:help.employmentProfileLater')}
        </div>
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

  const localeOptions = useMemo(
    () =>
      USER_LOCALE_OPTIONS.map((value) => ({
        value,
        label: t(`common:locales.${value}`),
      })),
    [t],
  );

  const timezoneOptions = useMemo(
    () =>
      USER_TIMEZONE_OPTIONS.map((value) => ({
        value,
        label: value,
      })),
    [],
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
          <TextInputField name="email" type="email" label={t('user:fields.email')} />
          <TextInputField name="phone" type="tel" label={t('user:fields.phone')} />
          <SelectField
            name="locale"
            label={t('user:fields.locale')}
            options={localeOptions}
            placeholder={t('user:placeholders.locale')}
          />
          <SelectField
            name="timezone"
            label={t('user:fields.timezone')}
            options={timezoneOptions}
            placeholder={t('user:placeholders.timezone')}
          />
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
          <TextInputField
            name="subject"
            label={t('user:fields.authSubject')}
            helperText={t('user:help.authSubjectExact')}
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};
