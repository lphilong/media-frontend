import {
  BadgeCheck,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  IdCard,
  Mail,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  type SelfServiceKpiMetric,
  useSelfServiceCurrentPerson,
  useSelfServiceEvents,
  useSelfServiceKpi,
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
import {
  formatBusinessTimestamp,
  formatDecimal,
  formatPercent,
} from '@shared/formatting/formatters';

const SELF_SERVICE_CURRENT_PERSON_NOT_LINKED = 'SELF_SERVICE_CURRENT_PERSON_NOT_LINKED';

type NavCard = {
  id: 'profile' | 'workShifts' | 'kpi' | 'events' | 'account';
  icon: typeof IdCard;
  statusKey: string;
};

const navCards: NavCard[] = [
  { id: 'profile', icon: IdCard, statusKey: 'self-service:status.available' },
  { id: 'workShifts', icon: CalendarDays, statusKey: 'self-service:status.available' },
  { id: 'kpi', icon: ChartNoAxesColumnIncreasing, statusKey: 'self-service:status.available' },
  { id: 'events', icon: BadgeCheck, statusKey: 'self-service:status.available' },
  { id: 'account', icon: UserCog, statusKey: 'self-service:status.comingSoon' },
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
  OFFICIAL_PUBLISHED: 'success',
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

export const SelfServicePage = (): JSX.Element => {
  const { t } = useTranslation(['self-service', 'common', 'errors']);
  const currentPersonQuery = useSelfServiceCurrentPerson();
  const currentPerson = currentPersonQuery.data;
  const workShiftsQuery = useSelfServiceWorkShifts(currentPersonQuery.isSuccess);
  const workShifts = workShiftsQuery.data ?? [];
  const kpiQuery = useSelfServiceKpi(currentPersonQuery.isSuccess);
  const kpiItems = kpiQuery.data ?? [];
  const eventsQuery = useSelfServiceEvents(currentPersonQuery.isSuccess);
  const events = eventsQuery.data ?? [];
  const notAvailable = t('self-service:values.notAvailable');
  const currentPersonNotLinked = isCurrentPersonNotLinkedError(currentPersonQuery.error);

  return (
    <main className="min-h-screen bg-bg text-text" data-testid="self-service-shell">
      <header className="border-b border-border bg-panel">
        <PageContainer className="py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">
                {t('self-service:page.eyebrow')}
              </p>
              <h1 className="text-2xl font-semibold">{t('self-service:page.title')}</h1>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-muted">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>{t('self-service:page.readOnly')}</span>
            </div>
          </div>
        </PageContainer>
      </header>

      <PageContainer className="space-y-5">
        <section
          aria-label={t('self-service:navigation.label')}
          className="grid gap-3 md:grid-cols-5"
        >
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="rounded-lg border border-border bg-panel p-3 shadow-sm"
                data-testid={`self-service-nav-${card.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <StatusBadge label={t(card.statusKey)} tone="neutral" uppercase={false} />
                </div>
                <p className="mt-3 text-sm font-semibold">
                  {t(`self-service:sections.${card.id}.title`)}
                </p>
                <p className="mt-1 min-h-10 text-xs text-muted">
                  {t(`self-service:sections.${card.id}.summary`)}
                </p>
              </div>
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

        {currentPerson ? (
          <section className="rounded-lg border border-border bg-panel p-4 shadow-sm">
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

            {!kpiQuery.isLoading && !kpiQuery.isError && kpiItems.length === 0 ? (
              <EmptyState
                title={t('self-service:empty.kpiTitle')}
                message={t('self-service:empty.kpiMessage')}
              />
            ) : null}

            {kpiItems.length > 0 ? (
              <div className="grid gap-3" data-testid="self-service-kpi-list">
                {kpiItems.map((item) => (
                  <article
                    key={item.kpiPlanId}
                    className="rounded border border-border bg-bg p-3"
                    data-testid="self-service-kpi-item"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text">{item.title}</h3>
                        <p className="text-xs text-muted">
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
                      <table
                        className="min-w-full text-left text-sm"
                        aria-label={t('self-service:tables.kpi')}
                      >
                        <thead className="border-b border-border text-xs uppercase text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">
                              {t('self-service:kpiFields.metric')}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t('self-service:kpiFields.target')}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t('self-service:kpiFields.actual')}
                            </th>
                            <th className="px-3 py-2 font-medium">
                              {t('self-service:kpiFields.progress')}
                            </th>
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
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {currentPerson ? (
          <section className="rounded-lg border border-border bg-panel p-4 shadow-sm">
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
                  key: 'locale',
                  label: t('self-service:fields.locale'),
                  value: emptyValue(currentPerson.locale, notAvailable),
                },
                {
                  key: 'timezone',
                  label: t('self-service:fields.timezone'),
                  value: emptyValue(currentPerson.timezone, notAvailable),
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

        {currentPerson ? (
          <section className="rounded-lg border border-border bg-panel p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {t('self-service:sections.workShifts.title')}
                </h2>
                <p className="text-sm text-muted">
                  {t('self-service:sections.workShifts.summary')}
                </p>
              </div>
              <StatusBadge label={t('self-service:status.readOnly')} tone="neutral" />
            </div>

            {workShiftsQuery.isLoading ? <LoadingState lines={4} /> : null}

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
              </div>
            ) : null}
          </section>
        ) : null}

        {currentPerson ? (
          <section className="rounded-lg border border-border bg-panel p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{t('self-service:sections.events.title')}</h2>
                <p className="text-sm text-muted">{t('self-service:sections.events.summary')}</p>
              </div>
              <StatusBadge label={t('self-service:status.readOnly')} tone="neutral" />
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
                        <td className="px-3 py-3 font-mono text-xs text-text">{event.eventCode}</td>
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
                            label={t(`self-service:eventAssignmentKind.${event.ownAssignmentKind}`)}
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
          </section>
        ) : null}
      </PageContainer>
    </main>
  );
};
