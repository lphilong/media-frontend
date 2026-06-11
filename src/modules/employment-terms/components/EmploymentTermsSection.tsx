import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useCreateEmploymentTermsMutation,
  useEmploymentTermsList,
  useTransitionEmploymentTermsMutation,
  useUpdateEmploymentTermsMutation,
} from '@modules/employment-terms/hooks/use-employment-terms';
import type {
  EmploymentTermsAllowancePayload,
  EmploymentTermsPayload,
  EmploymentTermsRecord,
  EmploymentTermsSensitiveRecord,
} from '@modules/employment-terms/types/employment-terms.types';
import type { NormalizedApiError } from '@shared/api';
import {
  hasPermission,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  formatBusinessTimestamp,
  formatCurrency,
  formatUtcDateInputValue,
  formatUtcMidnightDateLike,
} from '@shared/formatting/formatters';

const statusTones = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  SUPERSEDED: 'muted',
  CANCELLED: 'danger',
} as const;

const emptyAllowance = (): EmploymentTermsAllowancePayload => ({
  type: '',
  label: '',
  amount: 0,
  currencyCode: 'VND',
  payrollEligible: true,
  effectiveFrom: null,
  effectiveTo: null,
  sourceNote: null,
});

const emptyPayload = (): EmploymentTermsPayload => ({
  effectiveFrom: '',
  effectiveTo: null,
  baseSalaryAmount: 0,
  currencyCode: 'VND',
  payFrequency: 'MONTHLY',
  allowances: [],
  payrollEligible: true,
  sourceNote: null,
});

const toEditPayload = (record: EmploymentTermsSensitiveRecord): EmploymentTermsPayload => ({
  effectiveFrom: formatUtcDateInputValue(record.effectiveFrom),
  effectiveTo: record.effectiveTo === null ? null : formatUtcDateInputValue(record.effectiveTo),
  baseSalaryAmount: record.baseSalaryAmount,
  currencyCode: record.currencyCode,
  payFrequency: record.payFrequency,
  allowances: record.allowances.map((allowance) => ({
    type: allowance.type,
    label: allowance.label,
    amount: allowance.amount,
    currencyCode: allowance.currencyCode,
    payrollEligible: allowance.payrollEligible,
    effectiveFrom:
      allowance.effectiveFrom === null ? null : formatUtcDateInputValue(allowance.effectiveFrom),
    effectiveTo:
      allowance.effectiveTo === null ? null : formatUtcDateInputValue(allowance.effectiveTo),
    sourceNote: allowance.sourceNote,
  })),
  payrollEligible: record.payrollEligible,
  sourceNote: record.sourceNote,
});

const validate = (payload: EmploymentTermsPayload, t: (key: string) => string): string | null => {
  if (!payload.effectiveFrom || !payload.currencyCode || !payload.payFrequency)
    return t('employment-profile:employmentTerms.validation.required');
  if (payload.effectiveTo && payload.effectiveTo < payload.effectiveFrom)
    return t('employment-profile:employmentTerms.validation.dateRange');
  if (payload.baseSalaryAmount < 0)
    return t('employment-profile:employmentTerms.validation.nonNegative');
  if (!/^[A-Z]{3}$/.test(payload.currencyCode))
    return t('employment-profile:employmentTerms.validation.currency');
  if (payload.allowances.length > 20)
    return t('employment-profile:employmentTerms.validation.allowanceCount');
  for (const allowance of payload.allowances) {
    if (
      !allowance.type ||
      !allowance.label ||
      allowance.type.length > 64 ||
      allowance.label.length > 120
    )
      return t('employment-profile:employmentTerms.validation.allowanceFields');
    if (allowance.amount < 0) return t('employment-profile:employmentTerms.validation.nonNegative');
    if (!/^[A-Z]{3}$/.test(allowance.currencyCode))
      return t('employment-profile:employmentTerms.validation.currency');
    if (
      allowance.effectiveTo &&
      allowance.effectiveFrom &&
      allowance.effectiveTo < allowance.effectiveFrom
    )
      return t('employment-profile:employmentTerms.validation.dateRange');
    if ((allowance.sourceNote?.length ?? 0) > 500)
      return t('employment-profile:employmentTerms.validation.sourceNote');
  }
  if ((payload.sourceNote?.length ?? 0) > 500)
    return t('employment-profile:employmentTerms.validation.sourceNote');
  return null;
};

export const EmploymentTermsSection = ({
  employmentProfileId,
}: {
  employmentProfileId: string;
}): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common', 'errors']);
  const capabilities = useCurrentActorCapabilities();
  const canRead = hasPermission(capabilities.data, 'employmentTerms.read');
  const canManage = hasPermission(capabilities.data, 'employmentTerms.manageDraft');
  const canReadSensitive = hasPermission(capabilities.data, 'employmentTerms.readSensitive');
  const canEditAmounts = canManage && canReadSensitive;
  const canApprove = hasPermission(capabilities.data, 'employmentTerms.approve');
  const query = useEmploymentTermsList(canRead ? employmentProfileId : undefined);
  const createMutation = useCreateEmploymentTermsMutation();
  const updateMutation = useUpdateEmploymentTermsMutation();
  const transitionMutation = useTransitionEmploymentTermsMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payload, setPayload] = useState<EmploymentTermsPayload | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const records = useMemo(() => query.data ?? [], [query.data]);

  if (capabilities.isPending && !capabilities.data) {
    return (
      <EmploymentTermsAccessState>
        <LoadingState lines={2} />
      </EmploymentTermsAccessState>
    );
  }

  if (!canRead) {
    return (
      <EmploymentTermsAccessState>
        <p className="rounded bg-slate-100 px-3 py-2 text-sm text-muted">
          {t('employment-profile:employmentTerms.accessRequired')}
        </p>
      </EmploymentTermsAccessState>
    );
  }

  const beginCreate = (): void => {
    setEditingId(null);
    setPayload(emptyPayload());
    setValidationError(null);
  };

  const save = async (): Promise<void> => {
    if (!payload) return;
    const error = validate(payload, t);
    setValidationError(error);
    if (error) return;
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ employmentProfileId, termsId: editingId, payload });
        notifySuccess('employment-profile:employmentTerms.feedback.updated');
      } else {
        await createMutation.mutateAsync({ employmentProfileId, payload });
        notifySuccess('employment-profile:employmentTerms.feedback.created');
      }
      setPayload(null);
      setEditingId(null);
    } catch (mutationError) {
      notifyError(mutationError as NormalizedApiError);
    }
  };

  const transition = async (
    record: EmploymentTermsRecord,
    action: 'submit' | 'approve' | 'cancel',
  ): Promise<void> => {
    try {
      await transitionMutation.mutateAsync({ employmentProfileId, termsId: record.id, action });
      notifySuccess(`employment-profile:employmentTerms.feedback.${action}`);
    } catch (mutationError) {
      const error = mutationError as NormalizedApiError;
      if (error.code === 'EMPLOYMENT_TERMS_CONFLICT') {
        notifyError({ ...error, message: 'employment-profile:employmentTerms.errors.conflict' });
      } else {
        notifyError(error);
      }
    }
  };

  return (
    <section
      id="employment-terms"
      className="rounded-lg border border-border bg-panel p-5 shadow-shell"
      aria-labelledby="employment-terms-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="employment-terms-title" className="text-lg font-semibold">
            {t('employment-profile:employmentTerms.title')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('employment-profile:employmentTerms.subtitle')}
          </p>
        </div>
        {canEditAmounts && !payload ? (
          <button
            type="button"
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-white"
            onClick={beginCreate}
          >
            {t('employment-profile:employmentTerms.actions.create')}
          </button>
        ) : null}
      </div>

      {query.isPending ? (
        <div className="mt-4">
          <LoadingState lines={3} />
        </div>
      ) : null}
      {query.isError ? (
        <div className="mt-4">
          <ErrorState
            title={t('employment-profile:employmentTerms.errors.loadTitle')}
            message={t('employment-profile:employmentTerms.errors.loadMessage')}
            actionLabel={t('common:actions.retry')}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : null}
      {!query.isPending && !query.isError && records.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={t('employment-profile:employmentTerms.empty.title')}
            message={t('employment-profile:employmentTerms.empty.message')}
          />
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {records.map((record) => (
          <article key={record.id} className="rounded border border-border bg-bg p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <strong>{record.termsCode}</strong>
                <StatusBadge
                  label={t(`employment-profile:employmentTerms.statuses.${record.status}`)}
                  status={record.status}
                  toneByStatus={statusTones}
                  uppercase={false}
                />
              </div>
              <span className="text-sm text-muted">
                {t('employment-profile:employmentTerms.version', { version: record.version })}
              </span>
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted">
                  {t('employment-profile:employmentTerms.fields.effectiveDates')}
                </dt>
                <dd>
                  {formatUtcMidnightDateLike(record.effectiveFrom)} -{' '}
                  {record.effectiveTo === null
                    ? t('common:labels.notAvailable')
                    : formatUtcMidnightDateLike(record.effectiveTo)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">
                  {t('employment-profile:employmentTerms.fields.baseSalary')}
                </dt>
                <dd>
                  {record.baseSalaryAmount === undefined
                    ? t('employment-profile:employmentTerms.redacted')
                    : formatCurrency(record.baseSalaryAmount, record.currencyCode)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">
                  {t('employment-profile:employmentTerms.fields.payFrequency')}
                </dt>
                <dd>
                  {t(`employment-profile:employmentTerms.payFrequencies.${record.payFrequency}`)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">
                  {t('employment-profile:employmentTerms.fields.payrollEligible')}
                </dt>
                <dd>
                  {record.payrollEligible
                    ? t('employment-profile:employmentTerms.eligible')
                    : t('employment-profile:employmentTerms.notEligible')}
                </dd>
              </div>
            </dl>
            {record.sensitiveAmountsRedacted ? (
              <p className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm text-muted">
                {t('employment-profile:employmentTerms.sensitivePermission')}
              </p>
            ) : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-accent">
                {t('employment-profile:employmentTerms.actions.details')}
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  {t('employment-profile:employmentTerms.fields.currency')}: {record.currencyCode}
                </p>
                <p>
                  {t('employment-profile:employmentTerms.fields.sourceNote')}:{' '}
                  {record.sourceNote ?? t('common:labels.notAvailable')}
                </p>
                <p>
                  {t('employment-profile:employmentTerms.fields.updatedAt')}:{' '}
                  {formatBusinessTimestamp(record.updatedAt)}
                </p>
                <h3 className="font-medium">
                  {t('employment-profile:employmentTerms.fields.allowances')}
                </h3>
                {record.allowances.length === 0 ? (
                  <p className="text-muted">
                    {t('employment-profile:employmentTerms.empty.allowances')}
                  </p>
                ) : (
                  record.allowances.map((allowance, index) => (
                    <p key={`${allowance.type}-${index}`}>
                      {allowance.label}:{' '}
                      {allowance.amount === undefined
                        ? t('employment-profile:employmentTerms.redacted')
                        : formatCurrency(allowance.amount, allowance.currencyCode)}
                    </p>
                  ))
                )}
              </div>
            </details>
            <div className="mt-4 flex flex-wrap gap-2">
              {canEditAmounts && record.status === 'DRAFT' && !record.sensitiveAmountsRedacted ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => {
                    setEditingId(record.id);
                    setPayload(toEditPayload(record));
                  }}
                >
                  {t('employment-profile:employmentTerms.actions.update')}
                </button>
              ) : null}
              {canManage && record.status === 'DRAFT' ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => void transition(record, 'submit')}
                >
                  {t('employment-profile:employmentTerms.actions.submit')}
                </button>
              ) : null}
              {canApprove && record.status === 'PENDING_APPROVAL' ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => void transition(record, 'approve')}
                >
                  {t('employment-profile:employmentTerms.actions.approve')}
                </button>
              ) : null}
              {canManage && (record.status === 'DRAFT' || record.status === 'PENDING_APPROVAL') ? (
                <button
                  type="button"
                  className="rounded border border-danger/40 px-3 py-2 text-sm text-danger"
                  onClick={() => void transition(record, 'cancel')}
                >
                  {t('employment-profile:employmentTerms.actions.cancel')}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {payload ? (
        <EmploymentTermsForm
          payload={payload}
          setPayload={setPayload}
          validationError={validationError}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSave={() => void save()}
          onCancel={() => {
            setPayload(null);
            setEditingId(null);
          }}
        />
      ) : null}
    </section>
  );
};

const EmploymentTermsAccessState = ({ children }: { children: ReactNode }): JSX.Element => {
  const { t } = useTranslation(['employment-profile']);

  return (
    <section
      id="employment-terms"
      className="rounded-lg border border-border bg-panel p-5 shadow-shell"
      aria-labelledby="employment-terms-title"
    >
      <h2 id="employment-terms-title" className="text-lg font-semibold">
        {t('employment-profile:employmentTerms.title')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('employment-profile:employmentTerms.subtitle')}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
};

const EmploymentTermsForm = ({
  payload,
  setPayload,
  validationError,
  isPending,
  onSave,
  onCancel,
}: {
  payload: EmploymentTermsPayload;
  setPayload: (payload: EmploymentTermsPayload) => void;
  validationError: string | null;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
}): JSX.Element => {
  const { t } = useTranslation(['employment-profile', 'common']);
  const updateAllowance = (index: number, patch: Partial<EmploymentTermsAllowancePayload>): void =>
    setPayload({
      ...payload,
      allowances: payload.allowances.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  const inputClass = 'mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm';
  return (
    <div className="mt-5 rounded border border-border bg-bg p-4">
      <h3 className="font-semibold">{t('employment-profile:employmentTerms.form.title')}</h3>
      {validationError ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {validationError}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          {t('employment-profile:employmentTerms.fields.effectiveFrom')}
          <input
            className={inputClass}
            type="date"
            value={payload.effectiveFrom}
            onChange={(event) => setPayload({ ...payload, effectiveFrom: event.target.value })}
          />
        </label>
        <label className="text-sm">
          {t('employment-profile:employmentTerms.fields.effectiveTo')}
          <input
            className={inputClass}
            type="date"
            value={payload.effectiveTo ?? ''}
            onChange={(event) =>
              setPayload({ ...payload, effectiveTo: event.target.value || null })
            }
          />
        </label>
        <label className="text-sm">
          {t('employment-profile:employmentTerms.fields.baseSalary')}
          <input
            className={inputClass}
            type="number"
            min="0"
            value={payload.baseSalaryAmount}
            onChange={(event) =>
              setPayload({ ...payload, baseSalaryAmount: Number(event.target.value) })
            }
          />
        </label>
        <label className="text-sm">
          {t('employment-profile:employmentTerms.fields.currency')}
          <input
            className={inputClass}
            maxLength={3}
            value={payload.currencyCode}
            onChange={(event) =>
              setPayload({ ...payload, currencyCode: event.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="text-sm">
          {t('employment-profile:employmentTerms.fields.payFrequency')}
          <select className={inputClass} value={payload.payFrequency} onChange={() => undefined}>
            <option value="MONTHLY">
              {t('employment-profile:employmentTerms.payFrequencies.MONTHLY')}
            </option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={payload.payrollEligible}
            onChange={(event) => setPayload({ ...payload, payrollEligible: event.target.checked })}
          />
          {t('employment-profile:employmentTerms.fields.payrollEligible')}
        </label>
        <label className="text-sm sm:col-span-2">
          {t('employment-profile:employmentTerms.fields.sourceNote')}
          <textarea
            className={inputClass}
            maxLength={500}
            value={payload.sourceNote ?? ''}
            onChange={(event) => setPayload({ ...payload, sourceNote: event.target.value || null })}
          />
        </label>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <h4 className="font-medium">{t('employment-profile:employmentTerms.fields.allowances')}</h4>
        <button
          type="button"
          className="rounded border border-border px-3 py-2 text-sm"
          disabled={payload.allowances.length >= 20}
          onClick={() =>
            setPayload({ ...payload, allowances: [...payload.allowances, emptyAllowance()] })
          }
        >
          {t('employment-profile:employmentTerms.actions.addAllowance')}
        </button>
      </div>
      <div className="mt-2 space-y-3">
        {payload.allowances.map((allowance, index) => (
          <fieldset
            key={index}
            className="grid gap-2 rounded border border-border p-3 sm:grid-cols-2"
          >
            <legend className="px-1 text-sm font-medium">
              {t('employment-profile:employmentTerms.allowanceNumber', { number: index + 1 })}
            </legend>
            <label className="text-sm">
              {t('employment-profile:employmentTerms.fields.allowanceType')}
              <input
                className={inputClass}
                maxLength={64}
                value={allowance.type}
                onChange={(event) => updateAllowance(index, { type: event.target.value })}
              />
            </label>
            <label className="text-sm">
              {t('employment-profile:employmentTerms.fields.allowanceLabel')}
              <input
                className={inputClass}
                maxLength={120}
                value={allowance.label}
                onChange={(event) => updateAllowance(index, { label: event.target.value })}
              />
            </label>
            <label className="text-sm">
              {t('employment-profile:employmentTerms.fields.allowanceAmount')}
              <input
                className={inputClass}
                type="number"
                min="0"
                value={allowance.amount}
                onChange={(event) => updateAllowance(index, { amount: Number(event.target.value) })}
              />
            </label>
            <label className="text-sm">
              {t('employment-profile:employmentTerms.fields.currency')}
              <input
                className={inputClass}
                maxLength={3}
                value={allowance.currencyCode}
                onChange={(event) =>
                  updateAllowance(index, { currencyCode: event.target.value.toUpperCase() })
                }
              />
            </label>
            <label className="text-sm">
              {t('employment-profile:employmentTerms.fields.effectiveFrom')}
              <input
                className={inputClass}
                type="date"
                value={allowance.effectiveFrom ?? ''}
                onChange={(event) =>
                  updateAllowance(index, { effectiveFrom: event.target.value || null })
                }
              />
            </label>
            <label className="text-sm">
              {t('employment-profile:employmentTerms.fields.effectiveTo')}
              <input
                className={inputClass}
                type="date"
                value={allowance.effectiveTo ?? ''}
                onChange={(event) =>
                  updateAllowance(index, { effectiveTo: event.target.value || null })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowance.payrollEligible}
                onChange={(event) =>
                  updateAllowance(index, { payrollEligible: event.target.checked })
                }
              />
              {t('employment-profile:employmentTerms.fields.payrollEligible')}
            </label>
            <label className="text-sm sm:col-span-2">
              {t('employment-profile:employmentTerms.fields.sourceNote')}
              <textarea
                className={inputClass}
                maxLength={500}
                value={allowance.sourceNote ?? ''}
                onChange={(event) =>
                  updateAllowance(index, { sourceNote: event.target.value || null })
                }
              />
            </label>
            <button
              type="button"
              className="text-left text-sm text-danger"
              onClick={() =>
                setPayload({
                  ...payload,
                  allowances: payload.allowances.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            >
              {t('employment-profile:employmentTerms.actions.removeAllowance')}
            </button>
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded bg-accent px-3 py-2 text-sm font-medium text-white"
          disabled={isPending}
          onClick={onSave}
        >
          {t('employment-profile:employmentTerms.actions.save')}
        </button>
        <button
          type="button"
          className="rounded border border-border px-3 py-2 text-sm"
          onClick={onCancel}
        >
          {t('common:actions.cancel')}
        </button>
      </div>
    </div>
  );
};
