import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import {
  PEOPLE_READINESS_CATEGORIES,
  PEOPLE_READINESS_ENTITY_TYPES,
  PEOPLE_READINESS_ISSUE_CODES,
  PEOPLE_READINESS_SEVERITIES,
  type PeopleReadinessCategory,
  type PeopleReadinessEntityType,
  type PeopleReadinessIssue,
  type PeopleReadinessIssueCode,
  type PeopleReadinessIssuesQuery,
  type PeopleReadinessRepairTarget,
  type PeopleReadinessSafeEntitySummary,
  type PeopleReadinessSeverity,
  type PeopleReadinessSummary,
} from '@modules/people-readiness/api/people-readiness.api';
import {
  usePeopleReadinessIssues,
  usePeopleReadinessSummary,
} from '@modules/people-readiness/hooks/use-people-readiness';
import type { NormalizedApiError } from '@shared/api';
import {
  CursorPager,
  EmptyState,
  ErrorState,
  FilterBarShell,
  LoadingState,
  PageContainer,
  PageHeader,
  PermissionDeniedState,
  StatusBadge,
  type StatusBadgeTone,
} from '@shared/components/primitives';
import { formatBusinessTimestamp, formatInteger } from '@shared/formatting/formatters';

const DEFAULT_LIMIT = 10;

type FilterState = {
  category: '' | PeopleReadinessCategory;
  issueCode: '' | PeopleReadinessIssueCode;
  severity: '' | PeopleReadinessSeverity;
  entityType: '' | PeopleReadinessEntityType;
  limit: number;
};

type OverviewCard = {
  id: string;
  labelKey: string;
  helperKey: string;
  value: number;
  tone: StatusBadgeTone;
};

const severityTone: Record<PeopleReadinessSeverity, StatusBadgeTone> = {
  BLOCKER: 'danger',
  WARNING: 'warning',
  INFO: 'info',
};

const asApiError = (error: unknown): NormalizedApiError | null =>
  error && typeof error === 'object' && 'status' in error ? (error as NormalizedApiError) : null;

const readErrorMessage = (
  value: unknown,
  fallback: string,
  translate: (key: string) => unknown,
): string => {
  const apiError = asApiError(value);
  if (!apiError?.message) {
    return fallback;
  }

  if (!apiError.message.includes(':')) {
    return apiError.message;
  }

  const translated = translate(apiError.message);
  return typeof translated === 'string' ? translated : fallback;
};

const countSeverity = (
  summary: PeopleReadinessSummary | undefined,
  severity: PeopleReadinessSeverity,
): number => summary?.countsBySeverity[severity] ?? 0;

const countCategory = (
  summary: PeopleReadinessSummary | undefined,
  category: PeopleReadinessCategory,
): number => summary?.countsByCategory[category] ?? 0;

const buildIssueQuery = (filters: FilterState, cursor?: string): PeopleReadinessIssuesQuery => ({
  ...(filters.category ? { category: filters.category } : {}),
  ...(filters.issueCode ? { issueCode: filters.issueCode } : {}),
  ...(filters.severity ? { severity: filters.severity } : {}),
  ...(filters.entityType ? { entityType: filters.entityType } : {}),
  ...(cursor ? { cursor } : {}),
  limit: filters.limit,
});

const resolveSafeRepairLink = (
  target: PeopleReadinessRepairTarget,
  primaryEntity: PeopleReadinessSafeEntitySummary,
): string | null => {
  const surface = target.suggestedSurface;
  if (!surface.startsWith('/')) {
    return null;
  }

  if (target.targetType === 'EMPLOYMENT_PROFILE') {
    return surface === APP_PATHS.employmentProfileDetail(target.targetId) ? surface : null;
  }
  if (target.targetType === 'USER') {
    return surface === APP_PATHS.userDetail(target.targetId) ? surface : null;
  }
  if (target.targetType === 'TALENT') {
    return surface === APP_PATHS.talentDetail(target.targetId) ? surface : null;
  }
  if (target.targetType === 'ORG_UNIT') {
    return surface === APP_PATHS.orgUnitDetail(target.targetId) ? surface : null;
  }
  if (target.targetType === 'TALENT_GROUP') {
    return surface === APP_PATHS.talentGroupDetail(target.targetId) ? surface : null;
  }
  if (target.targetType === 'TALENT_GROUP_MEMBER' && primaryEntity.adminRepairTarget === surface) {
    return surface.startsWith('/talent-groups/') ? surface : null;
  }

  return null;
};

const readEntityStatus = (entity: PeopleReadinessSafeEntitySummary): string | undefined =>
  entity.lifecycleStatus ?? entity.status;

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

const OverviewCards = ({
  cards,
}: {
  cards: readonly OverviewCard[];
}): JSX.Element => {
  const { t, i18n } = useTranslation('people-readiness');
  const locale = i18n.language.startsWith('en')
    ? 'en-US'
    : i18n.language.startsWith('zh')
      ? 'zh-CN'
      : 'vi-VN';

  return (
    <section className="space-y-3" aria-labelledby="people-readiness-overview">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="people-readiness-overview" className="text-base font-semibold text-text">
          {t('sections.overview')}
        </h2>
        <StatusBadge label={t('badges.readOnly')} tone="info" uppercase={false} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.id} className="rounded border border-border bg-panel p-4 shadow-shell">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-muted">{t(card.labelKey)}</p>
              <StatusBadge label={t(`tones.${card.tone}`)} tone={card.tone} uppercase={false} />
            </div>
            <p className="mt-2 text-2xl font-semibold text-text">
              {formatInteger(card.value, locale)}
            </p>
            <p className="mt-2 text-sm text-muted">{t(card.helperKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

const EntitySummary = ({ entity }: { entity: PeopleReadinessSafeEntitySummary }): JSX.Element => {
  const { t } = useTranslation('people-readiness');
  const status = readEntityStatus(entity);

  return (
    <div className="min-w-[180px]">
      <p className="font-medium text-text">{entity.displayName}</p>
      <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted">
        <span>{t(`entities.${entity.entityType}`)}</span>
        {entity.code ? <span>{entity.code}</span> : null}
        {status ? <span>{t(`statuses.${status}`, { defaultValue: status })}</span> : null}
      </div>
    </div>
  );
};

const IssueRow = ({ issue }: { issue: PeopleReadinessIssue }): JSX.Element => {
  const { t } = useTranslation('people-readiness');
  const repairLink = resolveSafeRepairLink(issue.repairTarget, issue.primaryEntity);

  return (
    <article className="rounded border border-border bg-panel p-4 shadow-shell">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[240px] flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={t(`severities.${issue.severity}`)}
              tone={severityTone[issue.severity]}
              uppercase={false}
            />
            {issue.isBlockingForNewOperations ? (
              <StatusBadge label={t('badges.blocking')} tone="danger" uppercase={false} />
            ) : null}
          </div>
          <h3 className="text-base font-semibold text-text">
            {t(`issueTitles.${issue.issueCode}`)}
          </h3>
          <p className="mt-1 text-sm text-muted">{t(`issueDescriptions.${issue.issueCode}`)}</p>
        </div>
        <EntitySummary entity={issue.primaryEntity} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="font-medium text-muted">{t('fields.category')}</dt>
          <dd className="mt-1 text-text">{t(`categories.${issue.category}`)}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted">{t('fields.issueCode')}</dt>
          <dd className="mt-1 break-all font-mono text-xs text-muted">{issue.issueCode}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted">{t('fields.generatedAt')}</dt>
          <dd className="mt-1 text-text">{formatBusinessTimestamp(issue.generatedAt)}</dd>
        </div>
      </dl>

      {issue.relatedEntities.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-muted">{t('fields.relatedEntities')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {issue.relatedEntities.map((entity) => (
              <span
                key={`${entity.entityType}-${entity.id}`}
                className="rounded border border-border bg-bg px-2 py-1 text-xs text-text"
              >
                {entity.displayName} · {t(`entities.${entity.entityType}`)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded border border-dashed border-border bg-bg px-3 py-2 text-sm">
        <span className="font-medium text-muted">{t('fields.repairTarget')} </span>
        {repairLink ? (
          <Link className="font-medium text-accent hover:underline" to={repairLink}>
            {t('actions.openHint')}
          </Link>
        ) : (
          <span className="text-muted">{t('states.hintOnly')}</span>
        )}
      </div>
    </article>
  );
};

export const PeopleReadinessDashboardPage = (): JSX.Element => {
  const { t } = useTranslation(['people-readiness', 'common', 'errors']);
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    issueCode: '',
    severity: '',
    entityType: '',
    limit: DEFAULT_LIMIT,
  });
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const cursor = cursorStack[cursorStack.length - 1];
  const issueQuery = useMemo(() => buildIssueQuery(filters, cursor), [filters, cursor]);
  const summaryQuery = usePeopleReadinessSummary();
  const issuesQuery = usePeopleReadinessIssues(issueQuery);

  const resetCursor = (): void => setCursorStack([]);
  const updateFilter = <TKey extends keyof FilterState>(key: TKey, value: FilterState[TKey]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    resetCursor();
  };

  const combinedError = summaryQuery.error ?? issuesQuery.error;
  const apiError = asApiError(combinedError);

  if ((summaryQuery.isPending && !summaryQuery.data) || (issuesQuery.isPending && !issuesQuery.data)) {
    return (
      <PageContainer>
        <PageHeader title={t('people-readiness:page.title')} subtitle={t('people-readiness:page.subtitle')} />
        <LoadingState lines={10} />
      </PageContainer>
    );
  }

  if ((summaryQuery.isError && !summaryQuery.data) || (issuesQuery.isError && !issuesQuery.data)) {
    if (apiError?.permissionDenied) {
      return (
        <PageContainer>
          <PermissionDeniedState />
        </PageContainer>
      );
    }

    return (
      <PageContainer>
        <PageHeader title={t('people-readiness:page.title')} subtitle={t('people-readiness:page.subtitle')} />
        <ErrorState
          title={t('people-readiness:states.loadErrorTitle')}
          message={readErrorMessage(
            combinedError,
            t('people-readiness:states.loadErrorMessage'),
            t,
          )}
          actionLabel={t('common:actions.retry')}
          onRetry={() => {
            void summaryQuery.refetch();
            void issuesQuery.refetch();
          }}
        />
      </PageContainer>
    );
  }

  const summary = summaryQuery.data;
  const issues = issuesQuery.data;
  const cards: OverviewCard[] = [
    {
      id: 'blocker',
      labelKey: 'overview.blocker',
      helperKey: 'overview.blockerHelper',
      value: countSeverity(summary, 'BLOCKER'),
      tone: 'danger',
    },
    {
      id: 'warning',
      labelKey: 'overview.warning',
      helperKey: 'overview.warningHelper',
      value: countSeverity(summary, 'WARNING'),
      tone: 'warning',
    },
    {
      id: 'login-self-service',
      labelKey: 'overview.loginSelfService',
      helperKey: 'overview.loginSelfServiceHelper',
      value:
        countCategory(summary, 'ACCOUNT_LOGIN_READY') + countCategory(summary, 'SELF_SERVICE_READY'),
      tone: 'info',
    },
    {
      id: 'manager',
      labelKey: 'overview.manager',
      helperKey: 'overview.managerHelper',
      value: countCategory(summary, 'MANAGER_ASSIGNMENT_READY'),
      tone: 'warning',
    },
  ];

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t('people-readiness:page.title')} subtitle={t('people-readiness:page.subtitle')} />

      <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <span className="font-semibold">{t('people-readiness:badges.readOnly')}.</span>{' '}
        {t('people-readiness:page.helper')}
      </div>

      {summary ? <OverviewCards cards={cards} /> : null}

      <section className="space-y-3" aria-labelledby="people-readiness-issues">
        <div>
          <h2 id="people-readiness-issues" className="text-base font-semibold text-text">
            {t('people-readiness:sections.issueInbox')}
          </h2>
          <p className="mt-1 text-sm text-muted">{t('people-readiness:sections.issueInboxHelper')}</p>
        </div>

        <FilterBarShell>
          <SelectFilter
            label={t('people-readiness:filters.category')}
            value={filters.category}
            values={PEOPLE_READINESS_CATEGORIES}
            allLabel={t('people-readiness:filters.allCategories')}
            getLabel={(value) => t(`people-readiness:categories.${value}`)}
            onChange={(value) => updateFilter('category', value)}
          />
          <SelectFilter
            label={t('people-readiness:filters.severity')}
            value={filters.severity}
            values={PEOPLE_READINESS_SEVERITIES}
            allLabel={t('people-readiness:filters.allSeverities')}
            getLabel={(value) => t(`people-readiness:severities.${value}`)}
            onChange={(value) => updateFilter('severity', value)}
          />
          <SelectFilter
            label={t('people-readiness:filters.entityType')}
            value={filters.entityType}
            values={PEOPLE_READINESS_ENTITY_TYPES}
            allLabel={t('people-readiness:filters.allEntityTypes')}
            getLabel={(value) => t(`people-readiness:entities.${value}`)}
            onChange={(value) => updateFilter('entityType', value)}
          />
          <SelectFilter
            label={t('people-readiness:filters.issueCode')}
            value={filters.issueCode}
            values={PEOPLE_READINESS_ISSUE_CODES}
            allLabel={t('people-readiness:filters.allIssueCodes')}
            getLabel={(value) => t(`people-readiness:issueTitles.${value}`)}
            onChange={(value) => updateFilter('issueCode', value)}
          />
          <label className="w-32 text-sm">
            <span className="mb-1 block font-medium text-text">
              {t('people-readiness:filters.limit')}
            </span>
            <select
              value={filters.limit}
              onChange={(event) => updateFilter('limit', Number(event.target.value))}
              className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
            >
              {[2, 10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </FilterBarShell>

        {issuesQuery.isFetching && issues ? (
          <p className="text-sm text-muted">{t('people-readiness:states.refreshingInline')}</p>
        ) : null}
        {issuesQuery.isError && issues ? (
          <ErrorState
            variant="inline"
            title={t('people-readiness:states.refreshErrorTitle')}
            message={readErrorMessage(
              issuesQuery.error,
              t('people-readiness:states.refreshErrorMessage'),
              t,
            )}
          />
        ) : null}

        {issues && issues.items.length === 0 ? (
          <EmptyState
            title={t('people-readiness:states.emptyTitle')}
            message={t('people-readiness:states.emptyMessage')}
          />
        ) : null}

        <div className="space-y-3">
          {issues?.items.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
        </div>

        {issues ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {t('people-readiness:pagination.total', { count: issues.totalCount })}
            </p>
            <CursorPager
              canGoBack={cursorStack.length > 0}
              canGoNext={Boolean(issues.nextCursor)}
              onPrevious={() => setCursorStack((current) => current.slice(0, -1))}
              onNext={() =>
                setCursorStack((current) =>
                  issues.nextCursor ? [...current, issues.nextCursor] : current,
                )
              }
            />
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
};
