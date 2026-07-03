import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import {
  EMPLOYMENT_PROFILE_EMPLOYMENT_STATUSES,
  EMPLOYMENT_TERMS_ADMIN_READINESS_FILTERS,
  EMPLOYMENT_TERMS_STATUSES,
  type EmploymentProfileEmploymentStatus,
  type EmploymentTermsAdminFilters,
  type EmploymentTermsAdminListItem,
  type EmploymentTermsAdminReadinessFilter,
  type EmploymentTermsStatus,
} from '@modules/employment-terms/types/employment-terms.types';
import { useEmploymentTermsAdminList } from '@modules/employment-terms/hooks/use-employment-terms';
import type { NormalizedApiError } from '@shared/api';
import {
  CursorPager,
  EmptyState,
  ErrorState,
  FilterBarShell,
  LoadingState,
  PageContainer,
  StatusBadge,
  type StatusBadgeTone,
} from '@shared/components/primitives';
import {
  formatCurrency,
  formatUtcMidnightDateLike,
  readReferenceDisplay,
} from '@shared/formatting/formatters';

const DEFAULT_LIMIT = 20;

type FilterState = {
  employmentProfileId: string;
  orgUnitId: string;
  employmentStatus: '' | EmploymentProfileEmploymentStatus;
  status: '' | EmploymentTermsStatus;
  payrollEligible: '' | 'true' | 'false';
  readiness: '' | EmploymentTermsAdminReadinessFilter;
  effectiveOn: string;
  expiringBefore: string;
  search: string;
  limit: number;
};

type QuickFilter = {
  id: string;
  labelKey: string;
  readiness: EmploymentTermsAdminReadinessFilter;
};

const statusTone: Record<EmploymentTermsStatus, StatusBadgeTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  SUPERSEDED: 'muted',
  CANCELLED: 'danger',
};

const readinessTone: Record<EmploymentTermsAdminReadinessFilter, StatusBadgeTone> = {
  CURRENT_EFFECTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  EXPIRED: 'muted',
  MISSING_BASE_SALARY: 'danger',
  OVERLAPPING: 'danger',
  PAYROLL_SOURCE_ELIGIBLE: 'success',
  PAYROLL_SOURCE_INELIGIBLE: 'neutral',
};

const quickFilters: QuickFilter[] = [
  { id: 'current', labelKey: 'quickFilters.currentEffective', readiness: 'CURRENT_EFFECTIVE' },
  { id: 'pending', labelKey: 'quickFilters.pendingApproval', readiness: 'PENDING_APPROVAL' },
  { id: 'expired', labelKey: 'quickFilters.expired', readiness: 'EXPIRED' },
  {
    id: 'missing-salary',
    labelKey: 'quickFilters.missingBaseSalary',
    readiness: 'MISSING_BASE_SALARY',
  },
  { id: 'overlap', labelKey: 'quickFilters.overlap', readiness: 'OVERLAPPING' },
  {
    id: 'payroll-source',
    labelKey: 'quickFilters.payrollSourceEligible',
    readiness: 'PAYROLL_SOURCE_ELIGIBLE',
  },
  {
    id: 'not-payroll-source',
    labelKey: 'quickFilters.payrollSourceIneligible',
    readiness: 'PAYROLL_SOURCE_INELIGIBLE',
  },
];

const initialFilters: FilterState = {
  employmentProfileId: '',
  orgUnitId: '',
  employmentStatus: '',
  status: '',
  payrollEligible: '',
  readiness: '',
  effectiveOn: '',
  expiringBefore: '',
  search: '',
  limit: DEFAULT_LIMIT,
};

const trimOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toApiFilters = (filters: FilterState, cursor?: string): EmploymentTermsAdminFilters => ({
  ...(trimOrUndefined(filters.employmentProfileId)
    ? { employmentProfileId: trimOrUndefined(filters.employmentProfileId) }
    : {}),
  ...(trimOrUndefined(filters.orgUnitId) ? { orgUnitId: trimOrUndefined(filters.orgUnitId) } : {}),
  ...(filters.employmentStatus ? { employmentStatus: filters.employmentStatus } : {}),
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.payrollEligible ? { payrollEligible: filters.payrollEligible === 'true' } : {}),
  ...(filters.effectiveOn ? { effectiveOn: filters.effectiveOn } : {}),
  ...(filters.expiringBefore ? { expiringBefore: filters.expiringBefore } : {}),
  ...(filters.readiness ? { readiness: filters.readiness } : {}),
  ...(trimOrUndefined(filters.search) ? { search: trimOrUndefined(filters.search) } : {}),
  ...(cursor ? { cursor } : {}),
  limit: filters.limit,
});

const asApiError = (error: unknown): NormalizedApiError | null =>
  error && typeof error === 'object' && 'status' in error ? (error as NormalizedApiError) : null;

const SelectFilter = <TValue extends string>({
  label,
  value,
  values,
  allLabel,
  getLabel,
  onChange,
}: {
  label: string;
  value: '' | TValue;
  values: readonly TValue[];
  allLabel: string;
  getLabel: (value: TValue) => string;
  onChange: (value: '' | TValue) => void;
}): JSX.Element => (
  <label className="min-w-[180px] flex-1 text-sm">
    <span className="mb-1 block font-medium text-text">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as '' | TValue)}
      className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
    >
      <option value="">{allLabel}</option>
      {values.map((item) => (
        <option key={item} value={item}>
          {getLabel(item)}
        </option>
      ))}
    </select>
  </label>
);

const TextFilter = ({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}): JSX.Element => (
  <label className="min-w-[220px] flex-1 text-sm">
    <span className="mb-1 block font-medium text-text">{label}</span>
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
    />
  </label>
);

const DateFilter = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element => (
  <label className="min-w-[170px] flex-1 text-sm">
    <span className="mb-1 block font-medium text-text">{label}</span>
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
    />
  </label>
);

const AmountDisplay = ({ item }: { item: EmploymentTermsAdminListItem }): JSX.Element => {
  const { t } = useTranslation('employment-terms');

  if (item.sensitiveAmountsRedacted) {
    return (
      <div>
        <p>{t('privacy.redacted')}</p>
        <p className="text-xs text-muted">{t('privacy.permissionRequired')}</p>
      </div>
    );
  }

  return (
    <div>
      <p>
        {item.baseSalaryAmount === undefined
          ? t('labels.notAvailable')
          : formatCurrency(item.baseSalaryAmount, item.currencyCode)}
      </p>
      {item.allowances.length > 0 ? (
        <p className="text-xs text-muted">
          {item.allowances
            .map((allowance) =>
              allowance.amount === undefined
                ? t('privacy.redacted')
                : `${allowance.label}: ${formatCurrency(allowance.amount, allowance.currencyCode)}`,
            )
            .join(', ')}
        </p>
      ) : null}
    </div>
  );
};

const ReadinessBadges = ({ item }: { item: EmploymentTermsAdminListItem }): JSX.Element => {
  const { t } = useTranslation('employment-terms');
  const readiness: EmploymentTermsAdminReadinessFilter[] = [
    ...(item.isCurrentEffective ? (['CURRENT_EFFECTIVE'] as const) : []),
    ...(item.isPendingApproval ? (['PENDING_APPROVAL'] as const) : []),
    ...(item.isExpired ? (['EXPIRED'] as const) : []),
    ...(item.hasMissingBaseSalary ? (['MISSING_BASE_SALARY'] as const) : []),
    ...(item.hasOverlapForProfile ? (['OVERLAPPING'] as const) : []),
    item.payrollSourceEligibility === 'ELIGIBLE'
      ? 'PAYROLL_SOURCE_ELIGIBLE'
      : 'PAYROLL_SOURCE_INELIGIBLE',
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {readiness.map((value) => (
        <StatusBadge
          key={value}
          label={t(`readiness.${value}`)}
          tone={readinessTone[value]}
          uppercase={false}
        />
      ))}
    </div>
  );
};

const EmploymentProfileSummary = ({
  item,
}: {
  item: EmploymentTermsAdminListItem;
}): JSX.Element => {
  const { t } = useTranslation('employment-terms');
  const profile = item.employmentProfile;
  const orgUnitLabel = profile.orgUnitRef ? readReferenceDisplay(profile.orgUnitRef) : null;

  return (
    <div>
      <p className="font-medium text-text">{profile.displayName}</p>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted">
        <span>{profile.employeeCode}</span>
        <span>{t(`employmentStatuses.${profile.employmentStatus}`)}</span>
        {orgUnitLabel ? <span>{orgUnitLabel}</span> : null}
      </div>
    </div>
  );
};

const ResultsTable = ({ items }: { items: EmploymentTermsAdminListItem[] }): JSX.Element => {
  const { t } = useTranslation('employment-terms');

  return (
    <div className="overflow-x-auto rounded border border-border bg-panel shadow-shell">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
          <tr>
            <th scope="col" className="px-4 py-3">
              {t('table.profile')}
            </th>
            <th scope="col" className="px-4 py-3">
              {t('table.terms')}
            </th>
            <th scope="col" className="px-4 py-3">
              {t('table.effectiveDates')}
            </th>
            <th scope="col" className="px-4 py-3">
              {t('table.payrollSource')}
            </th>
            <th scope="col" className="px-4 py-3">
              {t('table.amounts')}
            </th>
            <th scope="col" className="px-4 py-3">
              {t('table.readiness')}
            </th>
            <th scope="col" className="px-4 py-3">
              {t('table.action')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-panel">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 align-top">
                <EmploymentProfileSummary item={item} />
              </td>
              <td className="px-4 py-3 align-top">
                <div className="space-y-2">
                  <p className="font-medium">{item.termsCode}</p>
                  <StatusBadge
                    label={t(`statuses.${item.status}`)}
                    tone={statusTone[item.status]}
                    uppercase={false}
                  />
                  <p className="text-xs text-muted">{t(`payFrequencies.${item.payFrequency}`)}</p>
                </div>
              </td>
              <td className="px-4 py-3 align-top">
                {formatUtcMidnightDateLike(item.effectiveFrom)}
                <span className="text-muted"> - </span>
                {item.effectiveTo === null
                  ? t('labels.openEnded')
                  : formatUtcMidnightDateLike(item.effectiveTo)}
              </td>
              <td className="px-4 py-3 align-top">
                <StatusBadge
                  label={
                    item.payrollEligible
                      ? t('payrollSource.eligible')
                      : t('payrollSource.ineligible')
                  }
                  tone={item.payrollEligible ? 'success' : 'neutral'}
                  uppercase={false}
                />
              </td>
              <td className="px-4 py-3 align-top">
                <AmountDisplay item={item} />
              </td>
              <td className="px-4 py-3 align-top">
                <ReadinessBadges item={item} />
              </td>
              <td className="px-4 py-3 align-top">
                <Link
                  className="font-medium text-accent hover:underline"
                  to={`${APP_PATHS.employmentProfileDetail(item.employmentProfile.id)}#employment-terms`}
                >
                  {t('actions.openProfile')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const EmploymentTermsWorkspacePage = (): JSX.Element => {
  const { t } = useTranslation(['employment-terms', 'common', 'errors']);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const cursor = cursorStack[cursorStack.length - 1];
  const apiFilters = useMemo(() => toApiFilters(filters, cursor), [filters, cursor]);
  const query = useEmploymentTermsAdminList(apiFilters);
  const apiError = asApiError(query.error);

  const resetCursor = (): void => setCursorStack([]);
  const updateFilter = <TKey extends keyof FilterState>(key: TKey, value: FilterState[TKey]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    resetCursor();
  };
  const toggleQuickFilter = (readiness: EmploymentTermsAdminReadinessFilter): void => {
    updateFilter('readiness', filters.readiness === readiness ? '' : readiness);
  };
  const clearFilters = (): void => {
    setFilters(initialFilters);
    resetCursor();
  };

  if (query.isPending && !query.data) {
    return (
      <PageContainer>
        <LoadingState lines={10} />
      </PageContainer>
    );
  }

  if (query.isError && !query.data) {
    return (
      <PageContainer>
        <ErrorState
          title={t('employment-terms:states.loadErrorTitle')}
          message={apiError?.message ?? t('employment-terms:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }

  const data = query.data;

  return (
    <PageContainer className="space-y-5">
      <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <span className="font-semibold">{t('employment-terms:notices.readOnlyTitle')}.</span>{' '}
        {t('employment-terms:notices.structuredTerms')}
      </div>

      <section className="space-y-3" aria-labelledby="employment-terms-quick-filters">
        <h2 id="employment-terms-quick-filters" className="text-base font-semibold text-text">
          {t('employment-terms:sections.quickFilters')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickFilters.map((filter) => {
            const active = filters.readiness === filter.readiness;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleQuickFilter(filter.readiness)}
                className={`rounded border p-3 text-left text-sm shadow-shell transition focus:outline-none focus:ring-2 focus:ring-accent ${
                  active
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-panel text-text hover:border-accent/50'
                }`}
              >
                <span className="font-medium">{t(`employment-terms:${filter.labelKey}`)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label={t('employment-terms:sections.filters')}>
        <FilterBarShell
          actions={
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm"
              onClick={clearFilters}
            >
              {t('employment-terms:actions.clearFilters')}
            </button>
          }
        >
          <TextFilter
            label={t('employment-terms:filters.search')}
            placeholder={t('employment-terms:filters.searchPlaceholder')}
            value={filters.search}
            onChange={(value) => updateFilter('search', value)}
          />
          <TextFilter
            label={t('employment-terms:filters.employmentProfileId')}
            value={filters.employmentProfileId}
            onChange={(value) => updateFilter('employmentProfileId', value)}
          />
          <TextFilter
            label={t('employment-terms:filters.orgUnitId')}
            value={filters.orgUnitId}
            onChange={(value) => updateFilter('orgUnitId', value)}
          />
          <SelectFilter
            label={t('employment-terms:filters.employmentStatus')}
            value={filters.employmentStatus}
            values={EMPLOYMENT_PROFILE_EMPLOYMENT_STATUSES}
            allLabel={t('employment-terms:filters.allEmploymentStatuses')}
            getLabel={(value) => t(`employment-terms:employmentStatuses.${value}`)}
            onChange={(value) => updateFilter('employmentStatus', value)}
          />
          <SelectFilter
            label={t('employment-terms:filters.status')}
            value={filters.status}
            values={EMPLOYMENT_TERMS_STATUSES}
            allLabel={t('employment-terms:filters.allStatuses')}
            getLabel={(value) => t(`employment-terms:statuses.${value}`)}
            onChange={(value) => updateFilter('status', value)}
          />
          <label className="min-w-[180px] flex-1 text-sm">
            <span className="mb-1 block font-medium text-text">
              {t('employment-terms:filters.payrollEligible')}
            </span>
            <select
              value={filters.payrollEligible}
              onChange={(event) =>
                updateFilter(
                  'payrollEligible',
                  event.target.value as FilterState['payrollEligible'],
                )
              }
              className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
            >
              <option value="">{t('employment-terms:filters.allPayrollSource')}</option>
              <option value="true">{t('employment-terms:payrollSource.eligible')}</option>
              <option value="false">{t('employment-terms:payrollSource.ineligible')}</option>
            </select>
          </label>
          <SelectFilter
            label={t('employment-terms:filters.readiness')}
            value={filters.readiness}
            values={EMPLOYMENT_TERMS_ADMIN_READINESS_FILTERS}
            allLabel={t('employment-terms:filters.allReadiness')}
            getLabel={(value) => t(`employment-terms:readiness.${value}`)}
            onChange={(value) => updateFilter('readiness', value)}
          />
          <DateFilter
            label={t('employment-terms:filters.effectiveOn')}
            value={filters.effectiveOn}
            onChange={(value) => updateFilter('effectiveOn', value)}
          />
          <DateFilter
            label={t('employment-terms:filters.expiringBefore')}
            value={filters.expiringBefore}
            onChange={(value) => updateFilter('expiringBefore', value)}
          />
          <label className="w-32 text-sm">
            <span className="mb-1 block font-medium text-text">
              {t('employment-terms:filters.limit')}
            </span>
            <select
              value={filters.limit}
              onChange={(event) => updateFilter('limit', Number(event.target.value))}
              className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
            >
              {[10, 20, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </FilterBarShell>
      </section>

      {query.isFetching && data ? (
        <p className="text-sm text-muted">{t('employment-terms:states.refreshingInline')}</p>
      ) : null}
      {query.isError && data ? (
        <ErrorState
          variant="inline"
          title={t('employment-terms:states.refreshErrorTitle')}
          message={apiError?.message ?? t('employment-terms:states.refreshErrorMessage')}
        />
      ) : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          title={t('employment-terms:states.emptyTitle')}
          message={t('employment-terms:states.emptyMessage')}
        />
      ) : null}

      {data && data.items.length > 0 ? <ResultsTable items={data.items} /> : null}

      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {t('employment-terms:pagination.loaded', { count: data.items.length })}
          </p>
          <CursorPager
            canGoBack={cursorStack.length > 0}
            canGoNext={Boolean(data.nextCursor)}
            onPrevious={() => setCursorStack((current) => current.slice(0, -1))}
            onNext={() =>
              setCursorStack((current) =>
                data.nextCursor ? [...current, data.nextCursor] : current,
              )
            }
          />
        </div>
      ) : null}
    </PageContainer>
  );
};
