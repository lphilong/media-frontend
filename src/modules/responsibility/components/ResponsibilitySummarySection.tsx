import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_PATHS } from '@app/router/paths';
import { useResponsibilitySummary } from '@modules/responsibility/hooks/use-responsibility';
import type {
  ResponsibilityAssignment,
  ResponsibilitySubjectType,
} from '@modules/responsibility/types/responsibility.types';
import {
  EmptyState,
  LoadingState,
  ReferenceLink,
  RelatedSectionShell,
  StatusBadge,
} from '@shared/components/primitives';
import { formatVietnamTimestamp, readReferenceDisplay } from '@shared/formatting/formatters';

type ResponsibilitySummarySectionProps = {
  subjectType: ResponsibilitySubjectType;
  subjectId: string | undefined;
  title?: string;
  subtitle?: string;
  inheritedTitle?: string;
};

const buildResponsibilityHref = (
  subjectType: ResponsibilitySubjectType,
  subjectId: string | undefined,
): string => {
  const params = new URLSearchParams();
  params.set('subjectType', subjectType);
  if (subjectId) {
    params.set('subjectId', subjectId);
  }
  return `${APP_PATHS.responsibilities}?${params.toString()}`;
};

const toReferenceLabel = (assignment: ResponsibilityAssignment): string =>
  readReferenceDisplay(assignment.responsibleEmploymentProfileRef) ??
  assignment.responsibleEmploymentProfileId;

const readInheritedLabelKey = (assignment: ResponsibilityAssignment): string => {
  if (assignment.responsibilityType === 'TALENT_GROUP_MANAGER') {
    return 'responsibility:summary.inheritedFromGroup';
  }

  if (assignment.responsibilityType === 'ORG_UNIT_MANAGER') {
    return 'responsibility:summary.inheritedFromOrgUnit';
  }

  return 'responsibility:summary.inheritedBadge';
};

const ResponsibilityCard = ({
  assignment,
  inherited = false,
}: {
  assignment: ResponsibilityAssignment;
  inherited?: boolean;
}): JSX.Element => {
  const { t } = useTranslation(['responsibility', 'common']);

  return (
    <li className="rounded border border-border bg-bg p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <ReferenceLink
            label={toReferenceLabel(assignment)}
            to={APP_PATHS.employmentProfileDetail(assignment.responsibleEmploymentProfileId)}
          />
          <p className="text-xs text-muted">
            {t(`responsibility:types.${assignment.responsibilityType}`)}
            {assignment.responsibilityRole
              ? ` - ${t(`responsibility:roles.${assignment.responsibilityRole}`, {
                  defaultValue: assignment.responsibilityRole,
                })}`
              : ''}
          </p>
          <p className="text-xs text-muted">
            {t('responsibility:summary.effectiveRange', {
              from: formatVietnamTimestamp(assignment.effectiveAt),
              to: assignment.expiresAt
                ? formatVietnamTimestamp(assignment.expiresAt)
                : t('responsibility:summary.openEnded'),
            })}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <StatusBadge
            label={t(`responsibility:statuses.${assignment.status}`)}
            status={assignment.status}
            family="lifecycle"
          />
          {assignment.isPrimary ? (
            <StatusBadge label={t('responsibility:summary.primary')} tone="info" />
          ) : null}
          {assignment.includeDescendants ? (
            <StatusBadge label={t('responsibility:summary.descendants')} tone="neutral" />
          ) : null}
          {inherited ? (
            <StatusBadge label={t(readInheritedLabelKey(assignment))} tone="indigo" />
          ) : null}
          {assignment.reviewNeeded ? (
            <StatusBadge label={t('responsibility:summary.reviewNeeded')} tone="danger" />
          ) : null}
        </div>
      </div>
    </li>
  );
};

export const ResponsibilitySummarySection = ({
  subjectType,
  subjectId,
  title,
  subtitle,
  inheritedTitle,
}: ResponsibilitySummarySectionProps): JSX.Element => {
  const { t } = useTranslation(['responsibility', 'common']);
  const summaryQuery = useResponsibilitySummary(subjectType, subjectId);

  return (
    <RelatedSectionShell
      title={title ?? t('responsibility:summary.title')}
      subtitle={subtitle ?? t('responsibility:summary.subtitle')}
      actions={
        <Link
          to={buildResponsibilityHref(subjectType, subjectId)}
          className="rounded border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          {t('responsibility:summary.openCentral')}
        </Link>
      }
    >
      <div className="mt-4 space-y-4">
        {summaryQuery.isPending ? <LoadingState lines={4} /> : null}
        {summaryQuery.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('responsibility:summary.loadFailed')}
          </p>
        ) : null}
        {summaryQuery.data ? (
          <>
            {summaryQuery.data.items.length > 0 ? (
              <ul className="space-y-2">
                {summaryQuery.data.items.map((assignment) => (
                  <ResponsibilityCard key={assignment.id} assignment={assignment} />
                ))}
              </ul>
            ) : (
              <EmptyState
                title={t('responsibility:summary.emptyTitle')}
                message={t('responsibility:summary.emptyMessage')}
              />
            )}
            {summaryQuery.data.inherited.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-text">
                  {inheritedTitle ?? t('responsibility:summary.inheritedTitle')}
                </h3>
                <ul className="space-y-2">
                  {summaryQuery.data.inherited.map((assignment) => (
                    <ResponsibilityCard
                      key={`${assignment.id}-inherited`}
                      assignment={assignment}
                      inherited
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </RelatedSectionShell>
  );
};
