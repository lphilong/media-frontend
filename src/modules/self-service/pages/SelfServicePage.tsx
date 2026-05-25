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

import { useSelfServiceCurrentPerson } from '@modules/self-service/api/self-service.api';
import {
  ErrorState,
  LoadingState,
  PageContainer,
  ReadOnlyFieldGrid,
  StatusBadge,
} from '@shared/components/primitives';

type NavCard = {
  id: 'profile' | 'workShifts' | 'kpi' | 'events' | 'account';
  icon: typeof IdCard;
  statusKey: string;
};

const navCards: NavCard[] = [
  { id: 'profile', icon: IdCard, statusKey: 'self-service:status.available' },
  { id: 'workShifts', icon: CalendarDays, statusKey: 'self-service:status.comingSoon' },
  { id: 'kpi', icon: ChartNoAxesColumnIncreasing, statusKey: 'self-service:status.comingSoon' },
  { id: 'events', icon: BadgeCheck, statusKey: 'self-service:status.comingSoon' },
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
} as const;

const emptyValue = (value: string | null | undefined, fallback: string): string =>
  value ?? fallback;

export const SelfServicePage = (): JSX.Element => {
  const { t } = useTranslation(['self-service', 'common', 'errors']);
  const currentPersonQuery = useSelfServiceCurrentPerson();
  const currentPerson = currentPersonQuery.data;
  const notAvailable = t('self-service:values.notAvailable');

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
            title={t('self-service:errors.currentPersonTitle')}
            message={t('self-service:errors.currentPersonMessage')}
          />
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
      </PageContainer>
    </main>
  );
};
