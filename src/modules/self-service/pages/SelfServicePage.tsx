import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Mail,
  RotateCcw,
  Save,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SELF_SERVICE_SUPPORTED_LOCALES,
  SELF_SERVICE_TIMEZONE_OPTIONS,
  type SelfServiceAccountPreferencesPayload,
  type SelfServiceCurrentPerson,
  type SelfServiceWorkShift,
  type SelfServiceKpiActualEntryStatusSummary,
  type SelfServiceKpiItem,
  type SelfServiceKpiMetric,
  useSelfServiceCurrentPerson,
  useSelfServiceEvents,
  useSelfServiceKpi,
  useSelfServiceTalentGroups,
  useUpdateSelfServiceAccountPreferences,
  useSelfServiceWorkShifts,
} from '@modules/self-service/api/self-service.api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  ReadOnlyFieldGrid,
  StatusBadge,
} from '@shared/components/primitives';
import { LocaleSwitcher, SessionArea } from '@shared/components/shell';
import {
  formatBusinessTimestamp,
  formatDecimal,
  formatPercent,
} from '@shared/formatting/formatters';

const SELF_SERVICE_CURRENT_PERSON_NOT_LINKED = 'SELF_SERVICE_CURRENT_PERSON_NOT_LINKED';
const SELF_SERVICE_VALIDATION_ERROR = 'SELF_SERVICE_VALIDATION_ERROR';

type NavCard = {
  id: SelfServiceModuleId;
  icon: typeof IdCard;
  titleKey: string;
  summaryKey: string;
  statusKey: string;
};

type SelfServiceModuleId = 'overview' | 'profile' | 'work' | 'kpi' | 'talentGroups' | 'account';

const navCards: NavCard[] = [
  {
    id: 'overview',
    icon: LayoutDashboard,
    titleKey: 'self-service:overview.title',
    summaryKey: 'self-service:overview.summary',
    statusKey: 'self-service:status.available',
  },
  {
    id: 'profile',
    icon: IdCard,
    titleKey: 'self-service:sections.profile.title',
    summaryKey: 'self-service:sections.profile.summary',
    statusKey: 'self-service:status.available',
  },
  {
    id: 'work',
    icon: CalendarDays,
    titleKey: 'self-service:sections.work.title',
    summaryKey: 'self-service:sections.work.summary',
    statusKey: 'self-service:status.available',
  },
  {
    id: 'kpi',
    icon: ChartNoAxesColumnIncreasing,
    titleKey: 'self-service:sections.kpi.title',
    summaryKey: 'self-service:sections.kpi.summary',
    statusKey: 'self-service:status.available',
  },
  {
    id: 'talentGroups',
    icon: UsersRound,
    titleKey: 'self-service:sections.talentGroups.title',
    summaryKey: 'self-service:sections.talentGroups.summary',
    statusKey: 'self-service:status.available',
  },
  {
    id: 'account',
    icon: UserCog,
    titleKey: 'self-service:sections.account.title',
    summaryKey: 'self-service:sections.account.summary',
    statusKey: 'self-service:status.available',
  },
];

const statusTone = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  SUSPENDED: 'danger',
  TERMINATED: 'muted',
  ARCHIVED: 'muted',
  PENDING: 'warning',
  DISABLED: 'danger',
  LINKED: 'success',
  SCHEDULED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  REMOVED: 'muted',
  EMPLOYMENT_PROFILE: 'info',
  TALENT: 'success',
  INTERNAL: 'info',
  EXTERNAL: 'warning',
  OFFICIAL_PUBLISHED: 'success',
  OFFICIAL_FINALIZED: 'success',
} as const;

const emptyValue = (value: string | null | undefined, fallback: string): string =>
  value ?? fallback;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isCurrentPersonNotLinkedError = (error: unknown): boolean => {
  if (!isRecord(error)) {
    return false;
  }

  const code = typeof error.code === 'string' ? error.code : undefined;
  const status = typeof error.status === 'number' ? error.status : undefined;
  const message = typeof error.message === 'string' ? error.message : undefined;

  return (
    code === SELF_SERVICE_CURRENT_PERSON_NOT_LINKED ||
    (status === 404 &&
      (code === SELF_SERVICE_CURRENT_PERSON_NOT_LINKED ||
        message === 'No linked Employment Profile' ||
        message === 'Current actor is not linked to a non-archived EmploymentProfile'))
  );
};

const formatMetricValue = (metric: SelfServiceKpiMetric, value: number): string => {
  if (metric.unit === 'VND') {
    return formatDecimal(value, 'vi-VN', 0);
  }

  return formatDecimal(value, 'vi-VN', metric.unit === 'HOUR' ? 2 : 0);
};

const kpiSummaryFields: Array<{
  key: keyof SelfServiceKpiActualEntryStatusSummary;
  labelKey: string;
}> = [
  { key: 'expectedEntryCount', labelKey: 'self-service:kpiStatusSummary.expected' },
  { key: 'enteredEntryCount', labelKey: 'self-service:kpiStatusSummary.entered' },
  { key: 'enteredZeroCount', labelKey: 'self-service:kpiStatusSummary.enteredZero' },
  { key: 'pendingEntryCount', labelKey: 'self-service:kpiStatusSummary.dueOpen' },
  { key: 'overdueEntryCount', labelKey: 'self-service:kpiStatusSummary.overdue' },
  { key: 'excusedEntryCount', labelKey: 'self-service:kpiStatusSummary.excused' },
  { key: 'notRequiredEntryCount', labelKey: 'self-service:kpiStatusSummary.notRequired' },
  { key: 'notDueEntryCount', labelKey: 'self-service:kpiStatusSummary.notDue' },
];

type SelfServiceKpiCardProps = {
  item: SelfServiceKpiItem;
  periodKind: 'current' | 'previous';
  notAvailable: string;
};

const SelfServiceKpiCard = ({
  item,
  periodKind,
  notAvailable,
}: SelfServiceKpiCardProps): JSX.Element => {
  const { t } = useTranslation(['self-service']);
  const summary = item.actualEntryStatusSummary;

  return (
    <article
      className="rounded border border-border bg-bg p-3"
      data-period-kind={periodKind}
      data-testid="self-service-kpi-item"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text">{item.title}</h3>
            <StatusBadge
              label={t(`self-service:kpiPeriod.${periodKind}`)}
              tone={periodKind === 'current' ? 'info' : 'neutral'}
              uppercase={false}
            />
            {periodKind === 'previous' ? (
              <>
                <StatusBadge
                  label={t('self-service:kpiPeriod.notCurrent')}
                  tone="neutral"
                  uppercase={false}
                />
                <StatusBadge
                  label={t('self-service:status.readOnly')}
                  tone="neutral"
                  uppercase={false}
                />
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {t('self-service:kpiFields.period')}: {item.periodMonth}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={t(`self-service:kpiStatus.${item.officialStatus}`)}
            status={item.officialStatus}
            toneByStatus={statusTone}
            uppercase={false}
          />
          <span className="text-xs text-muted">
            {t('self-service:kpiFields.lastUpdatedAt')}:{' '}
            {formatBusinessTimestamp(item.lastUpdatedAt)}
          </span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm" aria-label={t('self-service:tables.kpi')}>
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t('self-service:kpiFields.metric')}</th>
              <th className="px-3 py-2 font-medium">{t('self-service:kpiFields.target')}</th>
              <th className="px-3 py-2 font-medium">{t('self-service:kpiFields.actual')}</th>
              <th className="px-3 py-2 font-medium">{t('self-service:kpiFields.progress')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {item.metrics.map((metric) => (
              <tr
                key={`${item.kpiPlanId}-${metric.metricCode}`}
                data-testid="self-service-kpi-metric-row"
              >
                <td className="px-3 py-3 font-medium text-text">
                  {t(`self-service:kpiMetric.${metric.metricCode}`)}
                </td>
                <td className="px-3 py-3">
                  {formatMetricValue(metric, metric.targetValue)}{' '}
                  {t(`self-service:kpiUnit.${metric.unit}`)}
                </td>
                <td className="px-3 py-3">
                  {formatMetricValue(metric, metric.actualValue)}{' '}
                  {t(`self-service:kpiUnit.${metric.unit}`)}
                </td>
                <td className="px-3 py-3">
                  {metric.progressPercent === null
                    ? notAvailable
                    : formatPercent(metric.progressPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary ? (
        <div
          className="mt-3 rounded border border-border bg-panel px-3 py-2"
          data-testid="self-service-kpi-status-summary"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-xs font-semibold uppercase text-muted">
              {t('self-service:kpiStatusSummary.title')}
            </h4>
            <span className="text-xs text-muted">
              {t('self-service:kpiStatusSummary.readOnlySource')}
            </span>
          </div>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {kpiSummaryFields.map((field) => (
              <div key={field.key} className="rounded border border-border bg-bg px-2 py-1">
                <dt className="text-xs text-muted">{t(field.labelKey)}</dt>
                <dd className="text-sm font-semibold text-text">{summary[field.key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </article>
  );
};

const formatPreferenceError = (error: unknown, fallback: string): string => {
  if (!isRecord(error)) {
    return fallback;
  }

  const code = typeof error.code === 'string' ? error.code : undefined;
  const message = typeof error.message === 'string' ? error.message : undefined;

  if (code === SELF_SERVICE_VALIDATION_ERROR) {
    return fallback;
  }

  return message && !message.startsWith('errors:') ? message : fallback;
};

type AccountPreferencesFormProps = {
  currentPerson: SelfServiceCurrentPerson;
  notAvailable: string;
};

const AccountPreferencesForm = ({
  currentPerson,
  notAvailable,
}: AccountPreferencesFormProps): JSX.Element => {
  const { t } = useTranslation(['self-service']);
  const updatePreferences = useUpdateSelfServiceAccountPreferences();
  const [locale, setLocale] = useState(currentPerson.locale ?? 'en');
  const [timezone, setTimezone] = useState(currentPerson.timezone ?? 'Asia/Saigon');
  const [clientError, setClientError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setLocale(currentPerson.locale ?? 'en');
    setTimezone(currentPerson.timezone ?? 'Asia/Saigon');
    setClientError(null);
  }, [currentPerson.locale, currentPerson.timezone]);

  const timezoneOptions = useMemo(() => {
    const options: string[] = [...SELF_SERVICE_TIMEZONE_OPTIONS];
    if (currentPerson.timezone && !options.includes(currentPerson.timezone)) {
      options.unshift(currentPerson.timezone);
    }

    return options;
  }, [currentPerson.timezone]);

  const normalizedCurrentLocale = currentPerson.locale ?? 'en';
  const normalizedCurrentTimezone = currentPerson.timezone ?? 'Asia/Saigon';
  const isDirty = locale !== normalizedCurrentLocale || timezone !== normalizedCurrentTimezone;
  const isSaving = updatePreferences.isPending;
  const preferenceError =
    clientError ??
    (updatePreferences.isError
      ? formatPreferenceError(
          updatePreferences.error,
          t('self-service:account.preferencesSaveError'),
        )
      : null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setClientError(null);
    setShowSuccess(false);

    const localeValue = locale as (typeof SELF_SERVICE_SUPPORTED_LOCALES)[number];

    if (!SELF_SERVICE_SUPPORTED_LOCALES.includes(localeValue)) {
      setClientError(t('self-service:account.unsupportedLocale'));
      return;
    }

    if (!timezone.trim()) {
      setClientError(t('self-service:account.invalidTimezone'));
      return;
    }

    const payload: SelfServiceAccountPreferencesPayload = {
      locale: localeValue,
      timezone: timezone.trim(),
    };

    updatePreferences.mutate(payload, {
      onSuccess: (updated) => {
        setLocale(updated.locale ?? 'en');
        setTimezone(updated.timezone ?? 'Asia/Saigon');
        setShowSuccess(true);
      },
    });
  };

  const handleReset = (): void => {
    setLocale(normalizedCurrentLocale);
    setTimezone(normalizedCurrentTimezone);
    setClientError(null);
    setShowSuccess(false);
    updatePreferences.reset();
  };

  return (
    <form
      className="mt-4 rounded border border-border bg-bg p-3"
      onSubmit={handleSubmit}
      data-testid="self-service-account-preferences-form"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{t('self-service:account.preferencesTitle')}</h3>
        <p className="text-xs text-muted">{t('self-service:account.preferencesSummary')}</p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label
            className="block text-xs font-medium uppercase tracking-wide text-muted"
            htmlFor="self-service-account-locale"
          >
            {t('self-service:fields.locale')}
          </label>
          <select
            id="self-service-account-locale"
            value={locale}
            onChange={(event) => {
              setLocale(event.target.value);
              setShowSuccess(false);
            }}
            className="mt-1 w-full rounded border border-border bg-panel px-3 py-2 text-sm text-text"
            data-testid="self-service-account-locale-select"
          >
            {SELF_SERVICE_SUPPORTED_LOCALES.map((option) => (
              <option key={option} value={option}>
                {t(`self-service:localeOptions.${option}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-xs font-medium uppercase tracking-wide text-muted"
            htmlFor="self-service-account-timezone"
          >
            {t('self-service:fields.timezone')}
          </label>
          <select
            id="self-service-account-timezone"
            value={timezone}
            onChange={(event) => {
              setTimezone(event.target.value);
              setShowSuccess(false);
            }}
            className="mt-1 w-full rounded border border-border bg-panel px-3 py-2 text-sm text-text"
            data-testid="self-service-account-timezone-select"
          >
            {timezoneOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            {t('self-service:account.currentTimezone', {
              timezone: currentPerson.timezone ?? notAvailable,
            })}
          </span>
        </div>
      </div>

      {preferenceError ? (
        <p className="mt-3 text-sm font-medium text-danger" role="alert">
          {preferenceError}
        </p>
      ) : null}

      {showSuccess && !preferenceError ? (
        <p className="mt-3 text-sm font-medium text-accent" role="status">
          {t('self-service:account.preferencesSaved')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!isDirty || isSaving}
          className="inline-flex items-center gap-2 rounded border border-text bg-text px-3 py-2 text-sm font-medium text-bg disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="self-service-account-save-preferences"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? t('self-service:actions.saving') : t('self-service:actions.savePreferences')}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!isDirty || isSaving}
          className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-medium text-text hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t('self-service:actions.resetPreferences')}
        </button>
      </div>
    </form>
  );
};

export const SelfServicePage = (): JSX.Element => {
  const { t } = useTranslation(['self-service', 'common', 'errors']);
  const currentPersonQuery = useSelfServiceCurrentPerson();
  const currentPerson = currentPersonQuery.data;
  const [activeModule, setActiveModule] = useState<SelfServiceModuleId>('overview');
  const [workShiftCursor, setWorkShiftCursor] = useState<string | undefined>(undefined);
  const [workShiftPages, setWorkShiftPages] = useState<SelfServiceWorkShift[]>([]);
  const [workShiftNextCursor, setWorkShiftNextCursor] = useState<string | undefined>(undefined);
  const workShiftsQuery = useSelfServiceWorkShifts(currentPersonQuery.isSuccess, workShiftCursor);
  const workShifts = workShiftPages;
  const isLoadingMoreWorkShifts = workShiftCursor !== undefined && workShiftsQuery.isFetching;
  const kpiQuery = useSelfServiceKpi(currentPersonQuery.isSuccess);
  const kpiData = kpiQuery.data;
  const hasCurrentKpiField =
    kpiData !== undefined && Object.prototype.hasOwnProperty.call(kpiData, 'current');
  const currentKpi = hasCurrentKpiField ? (kpiData.current ?? null) : (kpiData?.items[0] ?? null);
  const latestPreviousKpi = kpiData?.latestPrevious ?? null;
  const kpiHistory = kpiData?.history ?? [];
  const eventsQuery = useSelfServiceEvents(currentPersonQuery.isSuccess);
  const events = eventsQuery.data?.items ?? [];
  const eventsMeta = eventsQuery.data?.meta;
  const talentGroupsQuery = useSelfServiceTalentGroups(currentPersonQuery.isSuccess);
  const talentGroups = talentGroupsQuery.data?.items ?? [];
  const talentGroupsMeta = talentGroupsQuery.data?.meta;
  const notAvailable = t('self-service:values.notAvailable');
  const currentPersonNotLinked = isCurrentPersonNotLinkedError(currentPersonQuery.error);

  useEffect(() => {
    if (!currentPersonQuery.isSuccess) {
      setWorkShiftCursor(undefined);
      setWorkShiftPages([]);
      setWorkShiftNextCursor(undefined);
    }
  }, [currentPersonQuery.isSuccess]);

  useEffect(() => {
    const page = workShiftsQuery.data;

    if (!page) {
      return;
    }

    setWorkShiftPages((previous) => {
      if (!workShiftCursor) {
        return page.items;
      }

      const seen = new Set(previous.map((shift) => shift.workShiftId));
      return [
        ...previous,
        ...page.items.filter((shift) => {
          if (seen.has(shift.workShiftId)) {
            return false;
          }

          seen.add(shift.workShiftId);
          return true;
        }),
      ];
    });
    setWorkShiftNextCursor(page.meta?.nextCursor);
  }, [workShiftCursor, workShiftsQuery.data]);

  return (
    <main className="min-h-screen bg-bg text-text" data-testid="self-service-shell">
      <header className="border-b border-border bg-panel">
        <PageContainer className="py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-muted">
                {t('self-service:page.eyebrow')}
              </p>
              <h1 className="text-2xl font-semibold text-text">{t('self-service:page.title')}</h1>
              <p className="text-sm text-muted">{t('self-service:page.subtitle')}</p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                <div data-testid="self-service-locale-control">
                  <LocaleSwitcher />
                </div>
                <SessionArea />
              </div>
              {currentPerson ? (
                <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                  <StatusBadge
                    label={t(`self-service:employmentStatus.${currentPerson.employmentStatus}`)}
                    status={currentPerson.employmentStatus}
                    toneByStatus={statusTone}
                  />
                  <span className="rounded border border-border bg-bg px-2 py-1 text-xs font-medium text-text">
                    {currentPerson.displayName}
                  </span>
                  <span className="rounded border border-border bg-bg px-2 py-1 font-mono text-xs text-muted">
                    {currentPerson.employeeCode}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </PageContainer>
      </header>

      <PageContainer className="space-y-5 py-5">
        <section
          aria-label={t('self-service:navigation.label')}
          role="tablist"
          className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          {navCards.map((card) => {
            const Icon = card.icon;
            const active = activeModule === card.id;
            return (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveModule(card.id)}
                className={`rounded border p-3 text-left shadow-sm transition ${
                  active
                    ? 'border-text bg-text text-bg'
                    : 'border-border bg-panel text-text hover:bg-bg'
                }`}
                data-testid={`self-service-nav-${card.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Icon
                    className={`h-5 w-5 ${active ? 'text-bg' : 'text-primary'}`}
                    aria-hidden="true"
                  />
                  <StatusBadge
                    label={t(
                      active ? 'self-service:status.selectedModule' : card.statusKey,
                    )}
                    tone={active ? 'success' : 'neutral'}
                    uppercase={false}
                  />
                </div>
                <p className="mt-3 text-sm font-semibold">
                  {t(card.titleKey)}
                </p>
                <p className={`mt-1 min-h-10 text-xs ${active ? 'text-bg/80' : 'text-muted'}`}>
                  {t(card.summaryKey)}
                </p>
              </button>
            );
          })}
        </section>

        {currentPersonQuery.isLoading && !currentPerson ? <LoadingState lines={6} /> : null}

        {currentPersonQuery.isError ? (
          <ErrorState
            title={t(
              currentPersonNotLinked
                ? 'self-service:errors.currentPersonNotLinkedTitle'
                : 'self-service:errors.currentPersonLoadTitle',
            )}
            message={t(
              currentPersonNotLinked
                ? 'self-service:errors.currentPersonNotLinkedMessage'
                : 'self-service:errors.currentPersonLoadMessage',
            )}
          />
        ) : null}

        {currentPerson && activeModule === 'overview' ? (
          <section
            className="rounded border border-border bg-panel p-4 shadow-sm"
            data-testid="self-service-overview"
            role="tabpanel"
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text">
                  {t('self-service:overview.title')}
                </h2>
                <p className="text-sm text-muted">{t('self-service:overview.summary')}</p>
              </div>
              <StatusBadge label={t('self-service:status.ownDataOnly')} tone="info" />
            </div>

            <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded border border-border bg-bg px-3 py-2">
                <dt className="text-xs font-medium uppercase text-muted">
                  {t('self-service:overview.profileReadiness')}
                </dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={t(`self-service:employmentStatus.${currentPerson.employmentStatus}`)}
                    status={currentPerson.employmentStatus}
                    toneByStatus={statusTone}
                  />
                </dd>
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <dt className="text-xs font-medium uppercase text-muted">
                  {t('self-service:overview.accountLink')}
                </dt>
                <dd className="mt-1">
                  <StatusBadge
                    label={t(`self-service:accountLinkStatus.${currentPerson.accountLinkStatus}`)}
                    status={currentPerson.accountLinkStatus}
                    toneByStatus={statusTone}
                  />
                </dd>
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <dt className="text-xs font-medium uppercase text-muted">
                  {t('self-service:overview.todayWork')}
                </dt>
                <dd className="mt-1 text-sm font-medium text-text">
                  {t('self-service:overview.todayWorkValue', {
                    workShiftCount: workShifts.length,
                    eventCount: events.length,
                  })}
                </dd>
              </div>
              <div className="rounded border border-border bg-bg px-3 py-2">
                <dt className="text-xs font-medium uppercase text-muted">
                  {t('self-service:overview.preferences')}
                </dt>
                <dd className="mt-1 text-sm font-medium text-text">
                  {emptyValue(currentPerson.locale, notAvailable)} /{' '}
                  {emptyValue(currentPerson.timezone, notAvailable)}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        {currentPerson && activeModule === 'kpi' ? (
          <section
            className="rounded border border-border bg-panel p-4 shadow-sm"
            data-testid="self-service-panel-kpi"
            role="tabpanel"
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{t('self-service:sections.kpi.title')}</h2>
                <p className="text-sm text-muted">{t('self-service:sections.kpi.summary')}</p>
              </div>
              <StatusBadge label={t('self-service:status.readOnly')} tone="neutral" />
            </div>

            {kpiQuery.isLoading ? (
              <div data-testid="self-service-kpi-loading">
                <LoadingState lines={4} />
              </div>
            ) : null}

            {kpiQuery.isError ? (
              <ErrorState
                title={t('self-service:errors.kpiTitle')}
                message={t('self-service:errors.kpiMessage')}
              />
            ) : null}

            {!kpiQuery.isLoading && !kpiQuery.isError ? (
              <div className="space-y-4" data-testid="self-service-kpi-list">
                <div className="grid gap-2" data-testid="self-service-kpi-current">
                  <h3 className="text-sm font-semibold">{t('self-service:kpiSections.current')}</h3>
                  {currentKpi ? (
                    <SelfServiceKpiCard
                      item={currentKpi}
                      periodKind="current"
                      notAvailable={notAvailable}
                    />
                  ) : (
                    <EmptyState
                      title={t('self-service:empty.kpiCurrentTitle')}
                      message={t(
                        latestPreviousKpi
                          ? 'self-service:empty.kpiCurrentWithPreviousMessage'
                          : 'self-service:empty.kpiCurrentMessage',
                      )}
                    />
                  )}
                </div>

                {!currentKpi && latestPreviousKpi ? (
                  <div className="grid gap-2" data-testid="self-service-kpi-latest-previous">
                    <h3 className="text-sm font-semibold">
                      {t('self-service:kpiSections.latestPrevious')}
                    </h3>
                    <SelfServiceKpiCard
                      item={latestPreviousKpi}
                      periodKind="previous"
                      notAvailable={notAvailable}
                    />
                  </div>
                ) : null}

                <div className="grid gap-2" data-testid="self-service-kpi-history">
                  <h3 className="text-sm font-semibold">{t('self-service:kpiSections.history')}</h3>
                  {kpiHistory.length > 0 ? (
                    kpiHistory.map((item) => (
                      <SelfServiceKpiCard
                        key={item.kpiPlanId}
                        item={item}
                        periodKind="previous"
                        notAvailable={notAvailable}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title={t('self-service:empty.kpiHistoryTitle')}
                      message={t('self-service:empty.kpiHistoryMessage')}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {currentPerson && activeModule === 'profile' ? (
          <section
            className="rounded border border-border bg-panel p-4 shadow-sm"
            data-testid="self-service-panel-profile"
            role="tabpanel"
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {t('self-service:sections.profile.title')}
                </h2>
                <p className="text-sm text-muted">{t('self-service:sections.profile.summary')}</p>
              </div>
              <StatusBadge
                label={t(`self-service:employmentStatus.${currentPerson.employmentStatus}`)}
                status={currentPerson.employmentStatus}
                toneByStatus={statusTone}
              />
            </div>

            <ReadOnlyFieldGrid
              columns={3}
              fields={[
                {
                  key: 'displayName',
                  label: t('self-service:fields.displayName'),
                  value: currentPerson.displayName,
                },
                {
                  key: 'employeeCode',
                  label: t('self-service:fields.employeeCode'),
                  value: currentPerson.employeeCode,
                  monospace: true,
                },
              ]}
            />

            {currentPerson.linkedInternalTalent ? (
              <div className="mt-4 rounded border border-border bg-bg p-3">
                <h3 className="text-sm font-semibold">
                  {t('self-service:sections.linkedTalent.title')}
                </h3>
                <ReadOnlyFieldGrid
                  columns={3}
                  fields={[
                    {
                      key: 'talentCode',
                      label: t('self-service:fields.talentCode'),
                      value: currentPerson.linkedInternalTalent.talentCode,
                      monospace: true,
                    },
                    {
                      key: 'talentDisplayName',
                      label: t('self-service:fields.talentDisplayName'),
                      value: currentPerson.linkedInternalTalent.displayName,
                    },
                    {
                      key: 'performanceAlias',
                      label: t('self-service:fields.performanceAlias'),
                      value: emptyValue(
                        currentPerson.linkedInternalTalent.performanceAlias,
                        notAvailable,
                      ),
                    },
                  ]}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {currentPerson && activeModule === 'talentGroups' ? (
          <section
            className="rounded border border-border bg-panel p-4 shadow-sm"
            data-testid="self-service-panel-talentGroups"
            role="tabpanel"
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {t('self-service:sections.talentGroups.title')}
                </h2>
                <p className="text-sm text-muted">
                  {t('self-service:sections.talentGroups.summary')}
                </p>
              </div>
              <StatusBadge label={t('self-service:status.readOnly')} tone="neutral" />
            </div>

            {talentGroupsQuery.isLoading ? (
              <div data-testid="self-service-talent-groups-loading">
                <LoadingState lines={4} />
              </div>
            ) : null}

            {talentGroupsQuery.isError ? (
              <ErrorState
                title={t('self-service:errors.talentGroupsTitle')}
                message={t('self-service:errors.talentGroupsMessage')}
              />
            ) : null}

            {!talentGroupsQuery.isLoading &&
            !talentGroupsQuery.isError &&
            talentGroups.length === 0 ? (
              <EmptyState
                title={t('self-service:empty.talentGroupsTitle')}
                message={t('self-service:empty.talentGroupsMessage')}
              />
            ) : null}

            {talentGroups.length > 0 ? (
              <div className="grid gap-3" data-testid="self-service-talent-groups-list">
                {talentGroupsMeta?.groupsTruncated ? (
                  <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
                    {t('self-service:talentGroups.groupsTruncated', {
                      maxGroups: talentGroupsMeta.maxGroups,
                    })}
                  </p>
                ) : null}
                {talentGroups.map((group) => (
                  <article
                    key={group.talentGroupCode}
                    className="rounded border border-border bg-bg p-3"
                    data-testid="self-service-talent-group-card"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text">{group.name}</h3>
                        <p className="font-mono text-xs text-muted">{group.talentGroupCode}</p>
                      </div>
                      <StatusBadge
                        label={t('self-service:talentGroupStatus.ACTIVE')}
                        tone="success"
                      />
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted">
                          {t('self-service:talentGroupFields.managers')}
                        </h4>
                        {group.managers.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {group.managers.map((manager) => (
                              <li
                                key={`${group.talentGroupCode}-${manager.displayName}-${manager.employeeCode ?? ''}`}
                                className="rounded border border-border bg-panel px-3 py-2"
                              >
                                <span className="block text-sm font-medium text-text">
                                  {manager.displayName}
                                </span>
                                {manager.employeeCode ? (
                                  <span className="font-mono text-xs text-muted">
                                    {manager.employeeCode}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-muted">
                            {t('self-service:values.notAvailable')}
                          </p>
                        )}
                        {group.managersTruncated ? (
                          <p className="mt-2 text-xs text-muted">
                            {t('self-service:talentGroups.managersTruncated', {
                              maxManagers: group.maxManagers,
                            })}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted">
                          {t('self-service:talentGroupFields.members')}
                        </h4>
                        {group.members.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {group.members.map((member) => (
                              <li
                                key={`${group.talentGroupCode}-${member.talentCode}`}
                                className="rounded border border-border bg-panel px-3 py-2"
                                data-testid="self-service-talent-group-member"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <span className="block text-sm font-medium text-text">
                                      {member.displayName}
                                    </span>
                                    <span className="font-mono text-xs text-muted">
                                      {member.talentCode}
                                    </span>
                                    {member.performanceAlias ? (
                                      <span className="mt-1 block text-xs text-muted">
                                        {t('self-service:fields.performanceAlias')}:{' '}
                                        {member.performanceAlias}
                                      </span>
                                    ) : null}
                                  </div>
                                  <StatusBadge
                                    label={t(`self-service:talentOrigin.${member.origin}`)}
                                    status={member.origin}
                                    toneByStatus={statusTone}
                                    uppercase={false}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-muted">
                            {t('self-service:values.notAvailable')}
                          </p>
                        )}
                        {group.membersTruncated ? (
                          <p className="mt-2 text-xs text-muted">
                            {t('self-service:talentGroups.membersTruncated', {
                              maxMembers: group.maxMembers,
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {currentPerson && activeModule === 'account' ? (
          <section
            className="rounded border border-border bg-panel p-4 shadow-sm"
            data-testid="self-service-account-card"
            role="tabpanel"
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {t('self-service:sections.account.title')}
                </h2>
                <p className="text-sm text-muted">{t('self-service:sections.account.summary')}</p>
              </div>
              <StatusBadge label={t('self-service:status.preferencesOnly')} tone="neutral" />
            </div>

            <ReadOnlyFieldGrid
              columns={3}
              fields={[
                {
                  key: 'accountEmail',
                  label: t('self-service:fields.accountEmail'),
                  value: (
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted" aria-hidden="true" />
                      {emptyValue(currentPerson.accountEmail, notAvailable)}
                    </span>
                  ),
                },
                {
                  key: 'accountStatus',
                  label: t('self-service:fields.accountStatus'),
                  value: currentPerson.accountStatus ? (
                    <StatusBadge
                      label={t(`self-service:accountStatus.${currentPerson.accountStatus}`)}
                      status={currentPerson.accountStatus}
                      toneByStatus={statusTone}
                    />
                  ) : (
                    notAvailable
                  ),
                },
                {
                  key: 'accountLinkStatus',
                  label: t('self-service:fields.accountLinkStatus'),
                  value: (
                    <StatusBadge
                      label={t(`self-service:accountLinkStatus.${currentPerson.accountLinkStatus}`)}
                      status={currentPerson.accountLinkStatus}
                      toneByStatus={statusTone}
                    />
                  ),
                },
                {
                  key: 'displayName',
                  label: t('self-service:fields.displayName'),
                  value: currentPerson.displayName,
                },
                {
                  key: 'employeeCode',
                  label: t('self-service:fields.employeeCode'),
                  value: currentPerson.employeeCode,
                  monospace: true,
                },
              ]}
            />

            <AccountPreferencesForm currentPerson={currentPerson} notAvailable={notAvailable} />

            <div className="mt-4 rounded border border-border bg-bg p-3">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold">
                    {t('self-service:account.securityTitle')}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {t('self-service:account.passwordInstruction')}
                  </p>
                </div>
              </div>
            </div>

            {currentPerson.linkedInternalTalent ? (
              <div className="mt-4 rounded border border-border bg-bg p-3">
                <h3 className="text-sm font-semibold">
                  {t('self-service:sections.linkedTalent.title')}
                </h3>
                <ReadOnlyFieldGrid
                  columns={3}
                  fields={[
                    {
                      key: 'talentCode',
                      label: t('self-service:fields.talentCode'),
                      value: currentPerson.linkedInternalTalent.talentCode,
                      monospace: true,
                    },
                    {
                      key: 'talentDisplayName',
                      label: t('self-service:fields.talentDisplayName'),
                      value: currentPerson.linkedInternalTalent.displayName,
                    },
                    {
                      key: 'performanceAlias',
                      label: t('self-service:fields.performanceAlias'),
                      value: emptyValue(
                        currentPerson.linkedInternalTalent.performanceAlias,
                        notAvailable,
                      ),
                    },
                  ]}
                />
              </div>
            ) : null}

            <p className="mt-4 text-sm text-muted">{t('self-service:account.operationsNote')}</p>
          </section>
        ) : null}

        {currentPerson && activeModule === 'work' ? (
          <section
            className="rounded border border-border bg-panel p-4 shadow-sm"
            data-testid="self-service-panel-work"
            role="tabpanel"
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{t('self-service:sections.work.title')}</h2>
                <p className="text-sm text-muted">{t('self-service:sections.work.summary')}</p>
              </div>
              <StatusBadge label={t('self-service:status.readOnly')} tone="neutral" />
            </div>

            <div className="mb-4 rounded border border-border bg-bg p-3">
              <div className="mb-4">
                <h3 className="text-base font-semibold">
                  {t('self-service:sections.workShifts.title')}
                </h3>
                <p className="text-sm text-muted">
                  {t('self-service:sections.workShifts.summary')}
                </p>
              </div>

              {workShiftsQuery.isLoading && workShifts.length === 0 ? (
                <LoadingState lines={4} />
              ) : null}

              {workShiftsQuery.isError ? (
                <ErrorState
                  title={t('self-service:errors.workShiftsTitle')}
                  message={t('self-service:errors.workShiftsMessage')}
                />
              ) : null}

              {!workShiftsQuery.isLoading && !workShiftsQuery.isError && workShifts.length === 0 ? (
                <EmptyState
                  title={t('self-service:empty.workShiftsTitle')}
                  message={t('self-service:empty.workShiftsMessage')}
                />
              ) : null}

              {workShifts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table
                    className="min-w-full text-left text-sm"
                    aria-label={t('self-service:tables.workShifts')}
                  >
                    <thead className="border-b border-border text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:workShiftFields.title')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:workShiftFields.status')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:workShiftFields.startsAt')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:workShiftFields.endsAt')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:workShiftFields.sourceType')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {workShifts.map((shift) => (
                        <tr key={shift.workShiftId} data-testid="self-service-work-shift-row">
                          <td className="px-3 py-3 font-medium text-text">{shift.title}</td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              label={t(`self-service:workShiftStatus.${shift.status}`)}
                              status={shift.status}
                              toneByStatus={statusTone}
                            />
                          </td>
                          <td className="px-3 py-3">{formatBusinessTimestamp(shift.startsAt)}</td>
                          <td className="px-3 py-3">{formatBusinessTimestamp(shift.endsAt)}</td>
                          <td className="px-3 py-3">
                            {t(`self-service:workShiftSourceType.${shift.sourceType}`)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {workShiftNextCursor ? (
                    <div className="mt-3 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setWorkShiftCursor(workShiftNextCursor)}
                        disabled={isLoadingMoreWorkShifts}
                        className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-medium text-text hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        {isLoadingMoreWorkShifts
                          ? t('self-service:actions.loadingMore')
                          : t('self-service:actions.loadMore')}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded border border-border bg-bg p-3">
              <div className="mb-4">
                <h3 className="text-base font-semibold">
                  {t('self-service:sections.events.title')}
                </h3>
                <p className="text-sm text-muted">{t('self-service:sections.events.summary')}</p>
              </div>
              {eventsQuery.isLoading ? (
                <div data-testid="self-service-events-loading">
                  <LoadingState lines={4} />
                </div>
              ) : null}

              {eventsQuery.isError ? (
                <ErrorState
                  title={t('self-service:errors.eventsTitle')}
                  message={t('self-service:errors.eventsMessage')}
                />
              ) : null}

              {eventsMeta?.window ? (
                <p className="mb-3 rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
                  {t('self-service:events.windowCopy', {
                    recentPastDays: eventsMeta.window.recentPastDays,
                    upcomingDays: eventsMeta.window.upcomingDays,
                    windowStartAt: formatBusinessTimestamp(eventsMeta.window.windowStartAt),
                    windowEndAt: formatBusinessTimestamp(eventsMeta.window.windowEndAt),
                  })}
                  {eventsMeta.truncated ? ` ${t('self-service:events.truncatedCopy')}` : ''}
                </p>
              ) : null}

              {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 ? (
                <EmptyState
                  title={t('self-service:empty.eventsTitle')}
                  message={t('self-service:empty.eventsMessage')}
                />
              ) : null}

              {events.length > 0 ? (
                <div className="overflow-x-auto">
                  <table
                    className="min-w-full text-left text-sm"
                    aria-label={t('self-service:tables.events')}
                  >
                    <thead className="border-b border-border text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:eventFields.eventCode')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:eventFields.title')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:eventFields.status')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:eventFields.startsAt')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:eventFields.endsAt')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:eventFields.assignmentKind')}
                        </th>
                        <th className="px-3 py-2 font-medium">
                          {t('self-service:eventFields.assignmentStatus')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {events.map((event) => (
                        <tr key={event.eventId} data-testid="self-service-event-row">
                          <td className="px-3 py-3 font-mono text-xs text-text">
                            {event.eventCode}
                          </td>
                          <td className="px-3 py-3 font-medium text-text">{event.title}</td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              label={t(`self-service:eventStatus.${event.status}`)}
                              status={event.status}
                              toneByStatus={statusTone}
                            />
                          </td>
                          <td className="px-3 py-3">{formatBusinessTimestamp(event.startsAt)}</td>
                          <td className="px-3 py-3">{formatBusinessTimestamp(event.endsAt)}</td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              label={t(
                                `self-service:eventAssignmentKind.${event.ownAssignmentKind}`,
                              )}
                              status={event.ownAssignmentKind}
                              toneByStatus={statusTone}
                              uppercase={false}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              label={t(
                                `self-service:eventAssignmentStatus.${event.ownAssignmentStatus}`,
                              )}
                              status={event.ownAssignmentStatus}
                              toneByStatus={statusTone}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </PageContainer>
    </main>
  );
};
