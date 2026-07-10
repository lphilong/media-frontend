import clsx from 'clsx';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useModulePageActions } from '@app/providers/module-runtime';
import { APP_PATHS } from '@app/router/paths';
import type { DashboardLiteSnapshot } from '@modules/dashboard-lite/api/dashboard-lite.api';
import { useDashboardLiteSnapshot } from '@modules/dashboard-lite/hooks/use-dashboard-lite-snapshot';
import type { NormalizedApiError } from '@shared/api';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetadataSection,
  NotFoundState,
  PageContainer,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  StatusBadge,
  type StatusBadgeTone,
} from '@shared/components/primitives';
import {
  DEFAULT_BUSINESS_TIME_ZONE,
  formatBusinessTimestamp,
  formatCanonicalDate,
  formatDecimal,
  formatInteger,
  formatUtcMidnightDateLike,
} from '@shared/formatting/formatters';
import { commissionRulesFlatListQueryConfig, commissionSettlementsFlatListQueryConfig } from '@modules/commission';
import { contractRegistryFlatListQueryConfig } from '@modules/contract-registry';
import { eventFlatListQueryConfig } from '@modules/event-assignment';
import { revenueLedgerFlatListQueryConfig } from '@modules/revenue-ledger';
import { serializeScreenQueryParams } from '@shared/query/screen-query-config';

type DashboardSourceGroup = 'overview' | 'operations' | 'commercial' | 'attention';
type DashboardDisplayGroup =
  | 'needsReview'
  | 'workInProgress'
  | 'finalizedResults'
  | 'upcomingDates';
type MetricValueKind = 'count' | 'amount';

type MetricCardDefinition = {
  key: string;
  sourceGroup: DashboardSourceGroup;
  linkTo?: string | ((windows: DashboardLiteWindows) => string);
  valueKind?: MetricValueKind;
  badgeKey?: DashboardToneBadgeKey;
};

type DashboardLiteWindows = DashboardLiteSnapshot['windows'];

type DashboardToneBadgeKey = 'needsReview' | 'pending' | 'finalized' | 'active' | 'upcoming';

type DashboardToneConfig = {
  tone: StatusBadgeTone;
  badgeKey: DashboardToneBadgeKey;
  sectionId: string;
  sectionClassName: string;
  cardClassName: string;
  focusClassName: string;
  navClassName: string;
};

const buildStatusLink = (path: string, params: URLSearchParams): string => {
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
};

const dashboardMetricStatusLinks = {
  draftRevenueEntry: buildStatusLink(
    APP_PATHS.revenueEntries,
    serializeScreenQueryParams({ status: 'DRAFT' }, revenueLedgerFlatListQueryConfig),
  ),
  draftSettlement: buildStatusLink(
    APP_PATHS.commissionSettlements,
    serializeScreenQueryParams({ status: 'DRAFT' }, commissionSettlementsFlatListQueryConfig),
  ),
  activeCommissionRule: buildStatusLink(
    APP_PATHS.commissionRules,
    serializeScreenQueryParams({ status: 'ACTIVE' }, commissionRulesFlatListQueryConfig),
  ),
} as const;

const dashboardMetricExactLinks = {
  staleRevenueDraft: (windows: DashboardLiteWindows) =>
    buildStatusLink(
      APP_PATHS.revenueEntries,
      serializeScreenQueryParams(
        {
          status: 'DRAFT',
          createdBeforeAt: windows.staleDrafts.olderThanAtExclusive,
        },
        revenueLedgerFlatListQueryConfig,
      ),
    ),
  staleSettlementDraft: (windows: DashboardLiteWindows) =>
    buildStatusLink(
      APP_PATHS.commissionSettlements,
      serializeScreenQueryParams(
        {
          status: 'DRAFT',
          createdBeforeAt: windows.staleDrafts.olderThanAtExclusive,
        },
        commissionSettlementsFlatListQueryConfig,
      ),
    ),
  expiringContract: (windows: DashboardLiteWindows) =>
    buildStatusLink(
      APP_PATHS.contractRecords,
      serializeScreenQueryParams(
        {
          status: 'ACTIVE',
          effectiveEndDateFrom: windows.contractExpiry30Days.startDateInclusive,
          effectiveEndDateTo: windows.contractExpiry30Days.endDateInclusive,
        },
        contractRegistryFlatListQueryConfig,
      ),
    ),
  finalizedRevenue: (windows: DashboardLiteWindows) =>
    buildStatusLink(
      APP_PATHS.revenueEntries,
      serializeScreenQueryParams(
        {
          status: 'FINALIZED',
          finalizedFromAt: windows.trailing30Days.startAtInclusive,
          finalizedToAt: windows.trailing30Days.endAtExclusive,
        },
        revenueLedgerFlatListQueryConfig,
      ),
    ),
  reconciledRevenue: (windows: DashboardLiteWindows) =>
    buildStatusLink(
      APP_PATHS.revenueEntries,
      serializeScreenQueryParams(
        {
          status: 'RECONCILED',
          reconciledFromAt: windows.trailing30Days.startAtInclusive,
          reconciledToAt: windows.trailing30Days.endAtExclusive,
        },
        revenueLedgerFlatListQueryConfig,
      ),
    ),
  finalizedSettlement: (windows: DashboardLiteWindows) =>
    buildStatusLink(
      APP_PATHS.commissionSettlements,
      serializeScreenQueryParams(
        {
          status: 'FINALIZED',
          finalizedFromAt: windows.trailing30Days.startAtInclusive,
          finalizedToAt: windows.trailing30Days.endAtExclusive,
        },
        commissionSettlementsFlatListQueryConfig,
      ),
    ),
  todayEvents: (windows: DashboardLiteWindows) =>
    buildStatusLink(
      APP_PATHS.events,
      serializeScreenQueryParams(
        {
          statusGroup: 'ACTIVE',
          eventOverlapStartAt: windows.today.startAtInclusive,
          eventOverlapEndAt: windows.today.endAtExclusive,
        },
        eventFlatListQueryConfig,
      ),
    ),
  next7DayEvents: (windows: DashboardLiteWindows) =>
    buildStatusLink(
      APP_PATHS.events,
      serializeScreenQueryParams(
        {
          statusGroup: 'ACTIVE',
          eventStartFromAt: windows.next7Days.startAtInclusive,
          eventStartToAt: windows.next7Days.endAtExclusive,
        },
        eventFlatListQueryConfig,
      ),
    ),
} as const;

const metricGroups: Record<DashboardDisplayGroup, MetricCardDefinition[]> = {
  needsReview: [
    {
      key: 'staleRevenueDraftCount',
      sourceGroup: 'attention',
      linkTo: dashboardMetricExactLinks.staleRevenueDraft,
    },
    {
      key: 'staleSettlementDraftCount',
      sourceGroup: 'attention',
      linkTo: dashboardMetricExactLinks.staleSettlementDraft,
    },
    {
      key: 'expiringContractCount30d',
      sourceGroup: 'attention',
      linkTo: dashboardMetricExactLinks.expiringContract,
    },
  ],
  workInProgress: [
    {
      key: 'draftRevenueEntryCount',
      sourceGroup: 'overview',
      linkTo: dashboardMetricStatusLinks.draftRevenueEntry,
    },
    {
      key: 'draftSettlementCount',
      sourceGroup: 'overview',
      linkTo: dashboardMetricStatusLinks.draftSettlement,
    },
  ],
  finalizedResults: [
    {
      key: 'finalizedRevenueAmount30d',
      sourceGroup: 'commercial',
      linkTo: dashboardMetricExactLinks.finalizedRevenue,
      valueKind: 'amount',
    },
    {
      key: 'reconciledRevenueAmount30d',
      sourceGroup: 'commercial',
      linkTo: dashboardMetricExactLinks.reconciledRevenue,
      valueKind: 'amount',
    },
    {
      key: 'finalizedSettlementAmount30d',
      sourceGroup: 'commercial',
      linkTo: dashboardMetricExactLinks.finalizedSettlement,
      valueKind: 'amount',
    },
    {
      key: 'activeCommissionRuleCount',
      sourceGroup: 'commercial',
      linkTo: dashboardMetricStatusLinks.activeCommissionRule,
      badgeKey: 'active',
    },
  ],
  upcomingDates: [
    {
      key: 'todayEventCount',
      sourceGroup: 'operations',
      linkTo: dashboardMetricExactLinks.todayEvents,
    },
    {
      key: 'next7DayEventCount',
      sourceGroup: 'operations',
      linkTo: dashboardMetricExactLinks.next7DayEvents,
    },
  ],
};

const groupOrder: DashboardDisplayGroup[] = [
  'needsReview',
  'workInProgress',
  'finalizedResults',
  'upcomingDates',
];

const dashboardToneConfig: Record<DashboardDisplayGroup, DashboardToneConfig> = {
  needsReview: {
    tone: 'danger',
    badgeKey: 'needsReview',
    sectionId: 'dashboard-needs-review',
    sectionClassName: 'border-rose-200 border-l-rose-500',
    cardClassName: 'border-rose-200 hover:border-rose-300 hover:bg-rose-50/40',
    focusClassName: 'focus-visible:ring-rose-400',
    navClassName: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300',
  },
  workInProgress: {
    tone: 'warning',
    badgeKey: 'pending',
    sectionId: 'dashboard-work-in-progress',
    sectionClassName: 'border-amber-200 border-l-amber-500',
    cardClassName: 'border-amber-200 hover:border-amber-300 hover:bg-amber-50/40',
    focusClassName: 'focus-visible:ring-amber-400',
    navClassName: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300',
  },
  finalizedResults: {
    tone: 'success',
    badgeKey: 'finalized',
    sectionId: 'dashboard-finalized-results',
    sectionClassName: 'border-emerald-200 border-l-emerald-500',
    cardClassName: 'border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/40',
    focusClassName: 'focus-visible:ring-emerald-400',
    navClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300',
  },
  upcomingDates: {
    tone: 'info',
    badgeKey: 'upcoming',
    sectionId: 'dashboard-upcoming-dates',
    sectionClassName: 'border-sky-200 border-l-sky-500',
    cardClassName: 'border-sky-200 hover:border-sky-300 hover:bg-sky-50/40',
    focusClassName: 'focus-visible:ring-sky-400',
    navClassName: 'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300',
  },
};

const cardBaseClassName =
  'rounded border bg-bg px-3 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const resolveLocale = (language: string): string => {
  if (language.startsWith('en')) {
    return 'en-US';
  }

  if (language.startsWith('zh')) {
    return 'zh-CN';
  }

  return 'vi-VN';
};

const readBusinessDate = (value: string | number): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatCanonicalDate(value);
  }

  return formatUtcMidnightDateLike(value);
};

const readErrorMessage = (
  value: unknown,
  fallback: string,
  translate: (key: string) => unknown,
): string => {
  const apiError = value as NormalizedApiError | null;
  if (!apiError?.message) {
    return fallback;
  }

  if (!apiError.message.includes(':')) {
    return apiError.message;
  }

  const translated = translate(apiError.message);
  return typeof translated === 'string' ? translated : fallback;
};

export const DashboardLitePage = (): JSX.Element => {
  const { t, i18n } = useTranslation(['dashboard-lite', 'common', 'errors']);
  const { data, isPending, isFetching, isError, error, refetch } = useDashboardLiteSnapshot();

  const locale = useMemo(() => resolveLocale(i18n.language), [i18n.language]);

  const refreshLabel = isFetching
    ? t('dashboard-lite:actions.refreshing')
    : t('common:actions.refresh');

  useModulePageActions(
    <button
      type="button"
      onClick={() => void refetch()}
      disabled={isFetching}
      className="rounded border border-border bg-panel px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      {refreshLabel}
    </button>,
  );

  if (isPending) {
    return (
      <PageContainer>
        <LoadingState lines={10} />
      </PageContainer>
    );
  }

  if (isError && !data) {
    const apiError = error as unknown as NormalizedApiError | null;

    if (apiError?.permissionDenied) {
      return (
        <PageContainer>
          <PermissionDeniedState />
        </PageContainer>
      );
    }

    if (apiError?.notFound) {
      return (
        <PageContainer>
          <NotFoundState />
        </PageContainer>
      );
    }

    return (
      <PageContainer>
        <ErrorState
          title={t('dashboard-lite:states.loadErrorTitle')}
          message={readErrorMessage(error, t('dashboard-lite:states.loadErrorMessage'), t)}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <EmptyState
          title={t('dashboard-lite:states.emptyTitle')}
          message={t('dashboard-lite:states.emptyMessage')}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-4">
      <MetadataSection title={t('dashboard-lite:meta.title')}>
        <ReadOnlyFieldGrid
          fields={[
            {
              key: 'last-updated',
              label: t('dashboard-lite:meta.lastUpdated'),
              value: formatBusinessTimestamp(
                data.generatedAt,
                data.windows.businessTimeZone || DEFAULT_BUSINESS_TIME_ZONE,
              ),
              description: t('dashboard-lite:meta.autoRefreshHelper'),
            },
            {
              key: 'business-date',
              label: t('dashboard-lite:meta.businessDate'),
              value: readBusinessDate(data.businessDate),
            },
          ]}
          columns={2}
        />
        <div className="mt-3 space-y-1 text-sm" aria-live="polite">
          {isFetching ? (
            <p className="text-muted">{t('dashboard-lite:states.refreshingInline')}</p>
          ) : null}
          {isError ? (
            <p className="text-danger">{t('dashboard-lite:states.refreshErrorInline')}</p>
          ) : null}
        </div>
      </MetadataSection>

      <nav
        aria-label={t('dashboard-lite:sectionNav.label')}
        className="rounded border border-border bg-panel p-3"
      >
        <div className="flex flex-wrap gap-2">
          {groupOrder.map((groupKey) => {
            const toneConfig = dashboardToneConfig[groupKey];

            return (
              <a
                key={groupKey}
                href={`#${toneConfig.sectionId}`}
                className={clsx(
                  'inline-flex min-h-9 items-center rounded border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  toneConfig.navClassName,
                )}
              >
                {t(`dashboard-lite:groups.${groupKey}`)}
              </a>
            );
          })}
        </div>
      </nav>

      {groupOrder.map((groupKey) => {
        const cards = metricGroups[groupKey];
        const toneConfig = dashboardToneConfig[groupKey];

        return (
          <section
            key={groupKey}
            id={toneConfig.sectionId}
            className={clsx(
              'scroll-mt-4 rounded-lg border border-l-4 bg-panel p-4 shadow-shell',
              toneConfig.sectionClassName,
            )}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-text">
                {t(`dashboard-lite:groups.${groupKey}`)}
              </h2>
              <StatusBadge
                label={t(`dashboard-lite:severityBadges.${toneConfig.badgeKey}`)}
                tone={toneConfig.tone}
              />
            </div>
            <p className="mb-4 text-sm text-muted">
              {t(`dashboard-lite:groupDescriptions.${groupKey}`)}
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => {
                const group = data[card.sourceGroup] as Record<string, number>;
                const value = group[card.key];
                const formattedValue =
                  card.valueKind === 'amount'
                    ? formatDecimal(value, locale, 2)
                    : formatInteger(value, locale);
                const badgeKey = card.badgeKey ?? toneConfig.badgeKey;
                const badgeTone = card.badgeKey === 'active' ? 'success' : toneConfig.tone;
                const cardClassName = clsx(
                  cardBaseClassName,
                  toneConfig.cardClassName,
                  toneConfig.focusClassName,
                );
                const linkTo =
                  typeof card.linkTo === 'function' ? card.linkTo(data.windows) : card.linkTo;

                if (linkTo) {
                  return (
                    <Link key={`${groupKey}-${card.key}`} to={linkTo} className={cardClassName}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs uppercase tracking-wide text-muted">
                          {t(`dashboard-lite:metrics.${card.key}`)}
                        </p>
                        <StatusBadge
                          label={t(`dashboard-lite:severityBadges.${badgeKey}`)}
                          tone={badgeTone}
                          className="shrink-0"
                        />
                      </div>
                      <p className="mt-2 text-xl font-semibold text-text">{formattedValue}</p>
                      <p className="mt-2 text-sm text-muted">
                        {t(`dashboard-lite:metricDescriptions.${card.key}`)}
                      </p>
                    </Link>
                  );
                }

                return (
                  <div key={`${groupKey}-${card.key}`} className={cardClassName}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs uppercase tracking-wide text-muted">
                        {t(`dashboard-lite:metrics.${card.key}`)}
                      </p>
                      <StatusBadge
                        label={t(`dashboard-lite:severityBadges.${badgeKey}`)}
                        tone={badgeTone}
                        className="shrink-0"
                      />
                    </div>
                    <p className="mt-2 text-xl font-semibold text-text">{formattedValue}</p>
                    <p className="mt-2 text-sm text-muted">
                      {t(`dashboard-lite:metricDescriptions.${card.key}`)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </PageContainer>
  );
};
