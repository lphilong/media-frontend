import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { usePageActions } from '@app/store/use-page-actions';
import { APP_PATHS } from '@app/router/paths';
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
} from '@shared/components/primitives';
import {
  formatCanonicalDate,
  formatDecimal,
  formatInteger,
  formatUtcMidnightDateLike,
  formatUtcTimestamp,
} from '@shared/formatting/formatters';

type DashboardMetricGroup = 'overview' | 'operations' | 'commercial' | 'attention';
type MetricValueKind = 'count' | 'amount';

type MetricCardDefinition = {
  key: string;
  linkTo?: string;
  valueKind?: MetricValueKind;
};

const metricGroups: Record<DashboardMetricGroup, MetricCardDefinition[]> = {
  overview: [
    { key: 'todayEventCount', linkTo: APP_PATHS.events },
    { key: 'draftTalentKpiCount', linkTo: APP_PATHS.talentKpiRecords },
    { key: 'draftRevenueEntryCount', linkTo: APP_PATHS.revenueEntries },
    { key: 'draftSettlementCount', linkTo: APP_PATHS.commissionSettlements },
    { key: 'activeCommissionRuleCount', linkTo: APP_PATHS.commissionRules },
    { key: 'expiringContractCount30d', linkTo: APP_PATHS.contractRecords },
  ],
  operations: [
    { key: 'todayEventCount', linkTo: APP_PATHS.events },
    { key: 'next7DayEventCount', linkTo: APP_PATHS.events },
    { key: 'draftTalentKpiCount', linkTo: APP_PATHS.talentKpiRecords },
    { key: 'finalizedTalentKpiCount30d', linkTo: APP_PATHS.talentKpiRecords },
  ],
  commercial: [
    { key: 'draftRevenueEntryCount', linkTo: APP_PATHS.revenueEntries },
    { key: 'finalizedRevenueAmount30d', linkTo: APP_PATHS.revenueEntries, valueKind: 'amount' },
    { key: 'reconciledRevenueAmount30d', linkTo: APP_PATHS.revenueEntries, valueKind: 'amount' },
    { key: 'draftSettlementCount', linkTo: APP_PATHS.commissionSettlements },
    {
      key: 'finalizedSettlementAmount30d',
      linkTo: APP_PATHS.commissionSettlements,
      valueKind: 'amount',
    },
    { key: 'activeCommissionRuleCount', linkTo: APP_PATHS.commissionRules },
  ],
  attention: [
    { key: 'staleTalentKpiDraftCount', linkTo: APP_PATHS.talentKpiRecords },
    { key: 'staleRevenueDraftCount', linkTo: APP_PATHS.revenueEntries },
    { key: 'staleSettlementDraftCount', linkTo: APP_PATHS.commissionSettlements },
    { key: 'expiringContractCount30d', linkTo: APP_PATHS.contractRecords },
  ],
};

const groupOrder: DashboardMetricGroup[] = ['overview', 'operations', 'commercial', 'attention'];

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

  usePageActions(
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

  if (isError) {
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
              key: 'generated-at',
              label: t('dashboard-lite:meta.generatedAt'),
              value: formatUtcTimestamp(data.generatedAt),
            },
            {
              key: 'business-date',
              label: t('dashboard-lite:meta.businessDate'),
              value: readBusinessDate(data.businessDate),
            },
          ]}
          columns={2}
        />
      </MetadataSection>

      {groupOrder.map((groupKey) => {
        const group = data[groupKey] as Record<string, number>;
        const cards = metricGroups[groupKey];

        return (
          <section
            key={groupKey}
            className="rounded-lg border border-border bg-panel p-4 shadow-shell"
          >
            <h2 className="mb-3 text-base font-semibold text-text">
              {t(`dashboard-lite:groups.${groupKey}`)}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => {
                const value = group[card.key];
                const formattedValue =
                  card.valueKind === 'amount'
                    ? formatDecimal(value, locale, 2)
                    : formatInteger(value, locale);

                if (card.linkTo) {
                  return (
                    <Link
                      key={`${groupKey}-${card.key}`}
                      to={card.linkTo}
                      className="rounded border border-border bg-bg px-3 py-3 hover:border-accent/50 hover:bg-slate-50"
                    >
                      <p className="text-xs uppercase tracking-wide text-muted">
                        {t(`dashboard-lite:metrics.${card.key}`)}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-text">{formattedValue}</p>
                    </Link>
                  );
                }

                return (
                  <div
                    key={`${groupKey}-${card.key}`}
                    className="rounded border border-border bg-bg px-3 py-3"
                  >
                    <p className="text-xs uppercase tracking-wide text-muted">
                      {t(`dashboard-lite:metrics.${card.key}`)}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-text">{formattedValue}</p>
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
