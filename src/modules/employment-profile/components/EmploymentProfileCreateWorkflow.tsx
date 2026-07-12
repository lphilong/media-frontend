import { useCallback, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { APP_PATHS } from '@app/router/paths';
import {
  loadEmploymentProfileReferenceOptions,
  loadUnlinkedUserReferenceOptions,
} from '@modules/employment-profile';
import type {
  EmploymentContractStatus,
  EmploymentProfileCreatePayload,
  EmploymentProfileRecord,
} from '@modules/employment-profile/types/employment-profile.types';
import { loadOrgUnitReferenceOptions } from '@modules/org-unit';
import type { NormalizedApiError } from '@shared/api';
import type { ReferenceOption } from '@shared/components/reference';
import { TechnicalDetailsDisclosure } from '@shared/components/primitives';
import { formatLocalizedUtcMidnightDateLike } from '@shared/formatting/formatters';
import {
  FormGrid,
  GeneratedCodeNotice,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';

type CreateFormValues = {
  legalName: string;
  displayName: string;
  employmentKind: string;
  jobTitle: string;
  orgUnitId: string;
  contractStatus: EmploymentContractStatus;
  employmentStartDate: string;
  linkedUserId: string;
  recruiterEmploymentProfileId: string;
  hrOwnerEmploymentProfileId: string;
  onboardingOwnerEmploymentProfileId: string;
  sourcedByEmploymentProfileId: string;
  hiredAt: string;
  onboardedAt: string;
  externalRef: string;
  titleDescription: string;
};

type EmploymentProfileCreateWorkflowProps = {
  onSubmit: (payload: EmploymentProfileCreatePayload) => Promise<EmploymentProfileRecord>;
};

type StepId = 'identity' | 'relationship' | 'attribution' | 'review';

const STEPS: Array<{ id: StepId; labelKey: string }> = [
  { id: 'identity', labelKey: 'createWorkflow.steps.identity' },
  { id: 'relationship', labelKey: 'createWorkflow.steps.relationship' },
  { id: 'attribution', labelKey: 'createWorkflow.steps.attribution' },
  { id: 'review', labelKey: 'createWorkflow.steps.review' },
];

const employmentKindValues = ['EMPLOYEE', 'CONTRACTOR', 'PART_TIME', 'INTERN'] as const;
const contractStatuses: EmploymentContractStatus[] = [
  'NONE',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
];

const defaultValues: CreateFormValues = {
  legalName: '',
  displayName: '',
  employmentKind: '',
  jobTitle: '',
  orgUnitId: '',
  contractStatus: 'NONE',
  employmentStartDate: '',
  linkedUserId: '',
  recruiterEmploymentProfileId: '',
  hrOwnerEmploymentProfileId: '',
  onboardingOwnerEmploymentProfileId: '',
  sourcedByEmploymentProfileId: '',
  hiredAt: '',
  onboardedAt: '',
  externalRef: '',
  titleDescription: '',
};

const isCanonicalDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const nullable = (value: string): string | null => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const safeReferenceLoader =
  (loader: (search: string) => Promise<ReferenceOption[]>) =>
  async (search: string): Promise<ReferenceOption[]> =>
    (await loader(search)).map((option) => ({
      ...option,
      description: option.description,
      type: undefined,
      status: undefined,
      state: undefined,
      meta: undefined,
    }));

const referenceLabel = (option: ReferenceOption | undefined, fallback: string): string =>
  option?.label ?? fallback;

const reviewText = (value: string, emptyValue: string): string => value.trim() || emptyValue;

export const EmploymentProfileCreateWorkflow = ({
  onSubmit,
}: EmploymentProfileCreateWorkflowProps): JSX.Element => {
  const { t, i18n } = useTranslation(['employment-profile', 'common']);
  const form = useForm<CreateFormValues>({ defaultValues });
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, ReferenceOption | undefined>
  >({});
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<EmploymentProfileRecord | null>(null);
  const submitLockRef = useRef(false);

  const rememberOption = useCallback((field: string, option: ReferenceOption | undefined) => {
    setSelectedOptions((current) =>
      current[field] === option ? current : { ...current, [field]: option },
    );
  }, []);
  const rememberOrgUnit = useCallback(
    (option: ReferenceOption | undefined) => rememberOption('orgUnitId', option),
    [rememberOption],
  );
  const rememberLinkedUser = useCallback(
    (option: ReferenceOption | undefined) => rememberOption('linkedUserId', option),
    [rememberOption],
  );
  const rememberRecruiter = useCallback(
    (option: ReferenceOption | undefined) => rememberOption('recruiterEmploymentProfileId', option),
    [rememberOption],
  );
  const rememberHrOwner = useCallback(
    (option: ReferenceOption | undefined) => rememberOption('hrOwnerEmploymentProfileId', option),
    [rememberOption],
  );
  const rememberOnboardingOwner = useCallback(
    (option: ReferenceOption | undefined) =>
      rememberOption('onboardingOwnerEmploymentProfileId', option),
    [rememberOption],
  );
  const rememberSourcedBy = useCallback(
    (option: ReferenceOption | undefined) => rememberOption('sourcedByEmploymentProfileId', option),
    [rememberOption],
  );

  const requiredLabel = useCallback(
    (key: string) =>
      `${t(`employment-profile:${key}`)} · ${t('employment-profile:createWorkflow.fieldState.required')}`,
    [t],
  );
  const optionalLabel = useCallback(
    (key: string) =>
      `${t(`employment-profile:${key}`)} · ${t('employment-profile:createWorkflow.fieldState.optional')}`,
    [t],
  );

  const schema = useMemo(
    () =>
      z
        .object({
          legalName: z.string().trim().min(1, t('employment-profile:validation.required')),
          displayName: z.string().trim().min(1, t('employment-profile:validation.required')),
          employmentKind: z.enum(employmentKindValues, {
            required_error: t('employment-profile:validation.required'),
          }),
          jobTitle: z.string().trim().min(1, t('employment-profile:validation.required')),
          orgUnitId: z.string().trim().min(1, t('employment-profile:validation.required')),
          contractStatus: z.enum(['NONE', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
          employmentStartDate: z
            .string()
            .trim()
            .refine(isCanonicalDate, t('employment-profile:validation.invalidDate')),
          linkedUserId: z.string().trim(),
          recruiterEmploymentProfileId: z.string().trim(),
          hrOwnerEmploymentProfileId: z.string().trim(),
          onboardingOwnerEmploymentProfileId: z.string().trim(),
          sourcedByEmploymentProfileId: z.string().trim(),
          hiredAt: z
            .string()
            .trim()
            .refine(
              (value) => !value || isCanonicalDate(value),
              t('employment-profile:validation.invalidDate'),
            ),
          onboardedAt: z
            .string()
            .trim()
            .refine(
              (value) => !value || isCanonicalDate(value),
              t('employment-profile:validation.invalidDate'),
            ),
          externalRef: z.string().trim(),
          titleDescription: z.string().trim(),
        })
        .superRefine((values, context) => {
          if (values.hiredAt && values.onboardedAt && values.onboardedAt < values.hiredAt) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['onboardedAt'],
              message: t('employment-profile:validation.onboardedBeforeHired'),
            });
          }
        }),
    [t],
  );

  const setSchemaErrors = useCallback(
    (issues: z.ZodIssue[], allowedFields?: Set<keyof CreateFormValues>) => {
      for (const issue of issues) {
        const field = issue.path[0] as keyof CreateFormValues | undefined;
        if (!field || (allowedFields && !allowedFields.has(field))) continue;
        form.setError(field, { type: 'manual', message: issue.message });
      }
    },
    [form],
  );

  const validateCurrentStep = (): boolean => {
    const result = schema.safeParse(form.getValues());
    if (result.success) return true;

    const fieldsByStep: Array<Set<keyof CreateFormValues>> = [
      new Set(['employmentKind', 'legalName', 'displayName', 'jobTitle']),
      new Set(['orgUnitId', 'contractStatus', 'employmentStartDate']),
      new Set(['hiredAt', 'onboardedAt']),
    ];
    const fields = fieldsByStep[stepIndex];
    if (!fields) return false;
    for (const field of fields) form.clearErrors(field);
    const relevant = result.error.issues.filter((issue) =>
      fields.has(issue.path[0] as keyof CreateFormValues),
    );
    setSchemaErrors(relevant, fields);
    return relevant.length === 0;
  };

  const goNext = (): void => {
    if (!validateCurrentStep()) return;
    setMutationError(null);
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = (): void => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const buildPayload = (values: CreateFormValues): EmploymentProfileCreatePayload => ({
    legalName: values.legalName.trim(),
    displayName: values.displayName.trim(),
    employmentKind: values.employmentKind,
    jobTitle: values.jobTitle.trim(),
    orgUnitId: values.orgUnitId,
    contractStatus: values.contractStatus,
    employmentStartDate: values.employmentStartDate,
    linkedUserId: nullable(values.linkedUserId),
    recruiterEmploymentProfileId: nullable(values.recruiterEmploymentProfileId),
    hrOwnerEmploymentProfileId: nullable(values.hrOwnerEmploymentProfileId),
    onboardingOwnerEmploymentProfileId: nullable(values.onboardingOwnerEmploymentProfileId),
    sourcedByEmploymentProfileId: nullable(values.sourcedByEmploymentProfileId),
    hiredAt: nullable(values.hiredAt),
    onboardedAt: nullable(values.onboardedAt),
    externalRef: nullable(values.externalRef),
    titleDescription: nullable(values.titleDescription),
  });

  const confirmCreate = async (): Promise<void> => {
    if (submitLockRef.current || created) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      const parsed = schema.safeParse(form.getValues());
      if (!parsed.success) {
        setSchemaErrors(parsed.error.issues);
        setMutationError({
          status: 422,
          code: 'CLIENT_VALIDATION',
          message: t('employment-profile:createWorkflow.errors.validationSummary'),
          fieldErrors: {},
          retryable: false,
          permissionDenied: false,
          notFound: false,
        });
        return;
      }

      const result = await onSubmit(buildPayload(parsed.data));
      setCreated(result);
    } catch (error) {
      const normalized = error as NormalizedApiError;
      setMutationError(normalized);
      const knownFields = new Set<keyof CreateFormValues>(
        Object.keys(defaultValues) as Array<keyof CreateFormValues>,
      );
      for (const fieldName of Object.keys(normalized.fieldErrors ?? {})) {
        if (knownFields.has(fieldName as keyof CreateFormValues)) {
          form.setError(fieldName as Path<CreateFormValues>, {
            type: 'server',
            message: t('employment-profile:createWorkflow.errors.backendField'),
          });
        }
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const resetWorkflow = (): void => {
    form.reset(defaultValues);
    form.clearErrors();
    setSelectedOptions({});
    setMutationError(null);
    setCreated(null);
    setIsSubmitting(false);
    submitLockRef.current = false;
    setStepIndex(0);
  };

  const values = form.watch();
  const reviewEmptyValue = t('employment-profile:createWorkflow.review.notProvided');
  const reviewReference = (field: keyof CreateFormValues): string =>
    values[field]
      ? referenceLabel(
          selectedOptions[field],
          t('employment-profile:createWorkflow.fallback.referenceUnavailable'),
        )
      : reviewEmptyValue;
  const reviewDate = (value: string): string =>
    value
      ? formatLocalizedUtcMidnightDateLike(`${value}T00:00:00.000Z`, i18n.language)
      : reviewEmptyValue;
  const safeOrgUnitLoader = useMemo(() => safeReferenceLoader(loadOrgUnitReferenceOptions), []);
  const safeUserLoader = useMemo(() => safeReferenceLoader(loadUnlinkedUserReferenceOptions), []);
  const safeProfileLoader = useMemo(
    () => safeReferenceLoader(loadEmploymentProfileReferenceOptions),
    [],
  );

  if (created) {
    const orgUnitLabel =
      created.orgUnitRef?.displayName ??
      ([created.orgUnitRef?.name, created.orgUnitRef?.code].filter(Boolean).join(' · ') ||
        t('employment-profile:createWorkflow.fallback.referenceUnavailable'));

    return (
      <section
        data-testid="employment-profile-complex-create"
        data-container="dedicated-page"
        className="space-y-5"
      >
        <div
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
        >
          {t('employment-profile:feedback.created')}
        </div>
        <div className="space-y-4 rounded border border-border bg-panel p-5 shadow-shell">
          <h2 className="text-xl font-semibold text-text">
            {t('employment-profile:createWorkflow.completion.title')}
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t('employment-profile:fields.displayName')}</dt>
              <dd className="font-medium">{created.displayName}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('employment-profile:fields.employeeCode')}</dt>
              <dd className="font-medium">{created.employeeCode}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('employment-profile:fields.orgUnitId')}</dt>
              <dd className="font-medium">{orgUnitLabel}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('employment-profile:fields.employmentStartDate')}</dt>
              <dd className="font-medium">{values.employmentStartDate}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded bg-accent px-3 py-2 text-sm font-medium text-white"
              to={APP_PATHS.employmentProfileDetail(created.id)}
            >
              {t('employment-profile:createWorkflow.actions.viewProfile')}
            </Link>
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm font-medium"
              onClick={resetWorkflow}
            >
              {t('employment-profile:createWorkflow.actions.createAnother')}
            </button>
            <Link
              className="rounded border border-border px-3 py-2 text-sm font-medium"
              to={APP_PATHS.employmentProfiles}
            >
              {t('employment-profile:createWorkflow.actions.returnToPeople')}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="employment-profile-complex-create"
      data-container="dedicated-page"
      className="space-y-5"
    >
      <ol
        className="grid gap-2 sm:grid-cols-4"
        aria-label={t('employment-profile:createWorkflow.progressLabel')}
      >
        {STEPS.map((step, index) => (
          <li
            key={step.id}
            aria-current={index === stepIndex ? 'step' : undefined}
            className={`rounded border px-3 py-2 text-sm ${index === stepIndex ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-border text-muted'}`}
          >
            {index + 1}. {t(`employment-profile:${step.labelKey}`)}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3 rounded border border-border bg-bg p-3 text-xs text-muted">
        <span>
          <strong>{t('employment-profile:createWorkflow.fieldState.requiredGroup')}</strong>{' '}
          {t('employment-profile:createWorkflow.fieldState.requiredHelp')}
        </span>
        <span>
          <strong>{t('employment-profile:createWorkflow.fieldState.optionalGroup')}</strong>{' '}
          {t('employment-profile:createWorkflow.fieldState.optionalHelp')}
        </span>
        <span>
          <strong>{t('employment-profile:createWorkflow.fieldState.derived')}</strong>{' '}
          {t('employment-profile:generatedCode.description')}
        </span>
      </div>

      <FormProvider {...form}>
        <div className="space-y-5 rounded border border-border bg-panel p-5 shadow-shell">
          {stepIndex === 0 ? (
            <section className="space-y-4" aria-labelledby="employment-profile-create-identity">
              <div>
                <h2 id="employment-profile-create-identity" className="text-lg font-semibold">
                  {t('employment-profile:createWorkflow.steps.identity')}
                </h2>
                <p className="text-sm text-muted">
                  {t('employment-profile:createWorkflow.sections.identityHelp')}
                </p>
              </div>
              <GeneratedCodeNotice
                label={t('employment-profile:generatedCode.label')}
                description={t('employment-profile:generatedCode.description')}
              />
              <FormGrid columns={2}>
                <SelectField
                  name="employmentKind"
                  label={requiredLabel('fields.employmentKind')}
                  placeholder={t('employment-profile:placeholders.selectEmploymentKind')}
                  options={employmentKindValues.map((value) => ({
                    value,
                    label: t(`employment-profile:employmentKinds.${value}`),
                  }))}
                />
                <TextInputField name="legalName" label={requiredLabel('fields.legalName')} />
                <TextInputField name="displayName" label={requiredLabel('fields.displayName')} />
                <TextInputField name="jobTitle" label={requiredLabel('fields.jobTitle')} />
                <TextInputField name="externalRef" label={optionalLabel('fields.externalRef')} />
                <TextInputField
                  name="titleDescription"
                  label={optionalLabel('fields.titleDescription')}
                />
              </FormGrid>
            </section>
          ) : null}

          {stepIndex === 1 ? (
            <section className="space-y-4" aria-labelledby="employment-profile-create-relationship">
              <div>
                <h2 id="employment-profile-create-relationship" className="text-lg font-semibold">
                  {t('employment-profile:createWorkflow.steps.relationship')}
                </h2>
                <p className="text-sm text-muted">
                  {t('employment-profile:createWorkflow.sections.relationshipHelp')}
                </p>
              </div>
              <FormGrid columns={2}>
                <ReferencePickerField
                  name="orgUnitId"
                  label={requiredLabel('fields.orgUnitId')}
                  pickerId="employment-profile-create-org-unit"
                  loadOptions={safeOrgUnitLoader}
                  clearable
                  clearLabel={t('employment-profile:createWorkflow.actions.clearOrgUnit')}
                  showTechnicalMetadata={false}
                  selectedLabelFallback={t(
                    'employment-profile:createWorkflow.fallback.referenceUnavailable',
                  )}
                  onSelectedOptionChange={rememberOrgUnit}
                />
                <SelectField
                  name="contractStatus"
                  label={requiredLabel('fields.contractStatus')}
                  options={contractStatuses.map((value) => ({
                    value,
                    label: t(`employment-profile:contractStatuses.${value}`),
                  }))}
                />
                <TextInputField
                  name="employmentStartDate"
                  label={requiredLabel('fields.employmentStartDate')}
                  type="date"
                />
                <ReferencePickerField
                  name="linkedUserId"
                  label={optionalLabel('fields.linkedUserId')}
                  pickerId="employment-profile-create-linked-user"
                  loadOptions={safeUserLoader}
                  clearable
                  showTechnicalMetadata={false}
                  selectedLabelFallback={t(
                    'employment-profile:createWorkflow.fallback.referenceUnavailable',
                  )}
                  onSelectedOptionChange={rememberLinkedUser}
                />
              </FormGrid>
            </section>
          ) : null}

          {stepIndex === 2 ? (
            <section className="space-y-4" aria-labelledby="employment-profile-create-attribution">
              <div>
                <h2 id="employment-profile-create-attribution" className="text-lg font-semibold">
                  {t('employment-profile:createWorkflow.steps.attribution')}
                </h2>
                <p className="text-sm text-muted">
                  {t('employment-profile:createWorkflow.sections.attributionHelp')}
                </p>
              </div>
              <FormGrid columns={2}>
                <ReferencePickerField
                  name="recruiterEmploymentProfileId"
                  label={optionalLabel('fields.recruiterEmploymentProfileId')}
                  pickerId="employment-profile-create-recruiter"
                  loadOptions={safeProfileLoader}
                  clearable
                  showTechnicalMetadata={false}
                  selectedLabelFallback={t(
                    'employment-profile:createWorkflow.fallback.referenceUnavailable',
                  )}
                  onSelectedOptionChange={rememberRecruiter}
                />
                <ReferencePickerField
                  name="hrOwnerEmploymentProfileId"
                  label={optionalLabel('fields.hrOwnerEmploymentProfileId')}
                  pickerId="employment-profile-create-hr-owner"
                  loadOptions={safeProfileLoader}
                  clearable
                  showTechnicalMetadata={false}
                  selectedLabelFallback={t(
                    'employment-profile:createWorkflow.fallback.referenceUnavailable',
                  )}
                  onSelectedOptionChange={rememberHrOwner}
                />
                <ReferencePickerField
                  name="onboardingOwnerEmploymentProfileId"
                  label={optionalLabel('fields.onboardingOwnerEmploymentProfileId')}
                  pickerId="employment-profile-create-onboarding-owner"
                  loadOptions={safeProfileLoader}
                  clearable
                  showTechnicalMetadata={false}
                  selectedLabelFallback={t(
                    'employment-profile:createWorkflow.fallback.referenceUnavailable',
                  )}
                  onSelectedOptionChange={rememberOnboardingOwner}
                />
                <ReferencePickerField
                  name="sourcedByEmploymentProfileId"
                  label={optionalLabel('fields.sourcedByEmploymentProfileId')}
                  pickerId="employment-profile-create-sourced-by"
                  loadOptions={safeProfileLoader}
                  clearable
                  showTechnicalMetadata={false}
                  selectedLabelFallback={t(
                    'employment-profile:createWorkflow.fallback.referenceUnavailable',
                  )}
                  onSelectedOptionChange={rememberSourcedBy}
                />
                <TextInputField
                  name="hiredAt"
                  label={optionalLabel('fields.hiredAt')}
                  type="date"
                />
                <TextInputField
                  name="onboardedAt"
                  label={optionalLabel('fields.onboardedAt')}
                  type="date"
                />
              </FormGrid>
            </section>
          ) : null}

          {stepIndex === 3 ? (
            <section className="space-y-4" aria-labelledby="employment-profile-create-review">
              <div>
                <h2 id="employment-profile-create-review" className="text-lg font-semibold">
                  {t('employment-profile:createWorkflow.review.title')}
                </h2>
                <p className="text-sm text-muted">
                  {t('employment-profile:createWorkflow.review.help')}
                </p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.displayName')}</dt>
                  <dd className="font-medium">{values.displayName}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.legalName')}</dt>
                  <dd className="font-medium">{values.legalName}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.employmentKind')}</dt>
                  <dd className="font-medium">
                    {t(`employment-profile:employmentKinds.${values.employmentKind}`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.jobTitle')}</dt>
                  <dd className="font-medium">{values.jobTitle}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.orgUnitId')}</dt>
                  <dd className="font-medium">{reviewReference('orgUnitId')}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.contractStatus')}</dt>
                  <dd className="font-medium">
                    {t(`employment-profile:contractStatuses.${values.contractStatus}`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">
                    {t('employment-profile:fields.employmentStartDate')}
                  </dt>
                  <dd className="font-medium">{reviewDate(values.employmentStartDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.linkedUserId')}</dt>
                  <dd className="font-medium">{reviewReference('linkedUserId')}</dd>
                </div>
                <div>
                  <dt className="text-muted">
                    {t('employment-profile:fields.recruiterEmploymentProfileId')}
                  </dt>
                  <dd className="font-medium">{reviewReference('recruiterEmploymentProfileId')}</dd>
                </div>
                <div>
                  <dt className="text-muted">
                    {t('employment-profile:fields.hrOwnerEmploymentProfileId')}
                  </dt>
                  <dd className="font-medium">{reviewReference('hrOwnerEmploymentProfileId')}</dd>
                </div>
                <div>
                  <dt className="text-muted">
                    {t('employment-profile:fields.onboardingOwnerEmploymentProfileId')}
                  </dt>
                  <dd className="font-medium">
                    {reviewReference('onboardingOwnerEmploymentProfileId')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">
                    {t('employment-profile:fields.sourcedByEmploymentProfileId')}
                  </dt>
                  <dd className="font-medium">{reviewReference('sourcedByEmploymentProfileId')}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.hiredAt')}</dt>
                  <dd className="font-medium">{reviewDate(values.hiredAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.onboardedAt')}</dt>
                  <dd className="font-medium">{reviewDate(values.onboardedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.externalRef')}</dt>
                  <dd className="font-medium">
                    {reviewText(values.externalRef, reviewEmptyValue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t('employment-profile:fields.titleDescription')}</dt>
                  <dd className="whitespace-pre-wrap font-medium">
                    {reviewText(values.titleDescription, reviewEmptyValue)}
                  </dd>
                </div>
              </dl>
              <p className="rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                {t('employment-profile:createWorkflow.boundary.noAutomaticAccess')}
              </p>
              {mutationError ? (
                <div
                  role="alert"
                  className="rounded border border-danger/30 bg-red-50 p-3 text-sm text-danger"
                >
                  {mutationError.retryable
                    ? t('employment-profile:createWorkflow.errors.retryableSummary')
                    : t('employment-profile:createWorkflow.errors.validationSummary')}
                  <TechnicalDetailsDisclosure
                    label={t('employment-profile:createWorkflow.technicalDetails')}
                    details={{ code: mutationError.code, requestId: mutationError.requestId }}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <div>
              {stepIndex > 0 ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={goBack}
                  disabled={isSubmitting}
                >
                  {t('employment-profile:createWorkflow.actions.back')}
                </button>
              ) : (
                <Link
                  className="rounded border border-border px-3 py-2 text-sm"
                  to={APP_PATHS.employmentProfiles}
                >
                  {t('common:actions.cancel')}
                </Link>
              )}
            </div>
            {stepIndex < 2 ? (
              <button
                type="button"
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-white"
                onClick={goNext}
              >
                {t('employment-profile:createWorkflow.actions.continue')}
              </button>
            ) : null}
            {stepIndex === 2 ? (
              <button
                type="button"
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-white"
                onClick={goNext}
              >
                {t('employment-profile:createWorkflow.actions.continueToReview')}
              </button>
            ) : null}
            {stepIndex === 3 ? (
              <button
                type="button"
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => void confirmCreate()}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t('employment-profile:createWorkflow.actions.pending')
                  : t('employment-profile:createWorkflow.actions.confirm')}
              </button>
            ) : null}
          </div>
        </div>
      </FormProvider>
    </section>
  );
};
