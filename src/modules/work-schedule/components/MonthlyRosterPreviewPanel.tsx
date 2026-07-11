import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMonthlyRosterPreview } from '@modules/work-schedule/hooks/use-work-schedule';
import type {
  MonthlyRosterPreview,
  MonthlyRosterPreviewExcludedMember,
  MonthlyRosterPreviewRow,
  MonthlyRosterRecord,
  MonthlyRosterScope,
  RosterExceptionRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ErrorState,
  LoadingState,
  MetadataSection,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  StatusBadge,
  TechnicalDetailsDisclosure,
} from '@shared/components/primitives';
import { readReferenceDisplay } from '@shared/formatting/formatters';

type MonthlyRosterPreviewPanelProps = {
  roster: MonthlyRosterRecord;
  scope?: MonthlyRosterScope;
};

type MemberFilter = 'all' | 'issues' | 'exceptions' | 'excluded';

type MemberSummary = {
  memberId: string;
  memberLabel: string;
  rows: MonthlyRosterPreviewRow[];
  publishableCount: number;
  workDayCount: number;
  changedCount: number;
  specialCount: number;
  holidayOffCount: number;
  workingToOffCount: number;
  conflictCount: number;
  blockerCount: number;
  warningCount: number;
};

const hasException = (row: MonthlyRosterPreviewRow): boolean =>
  row.rowKind !== 'STANDARD' || row.sourceExceptionId !== null;

const hasIssues = (summary: MemberSummary): boolean =>
  summary.conflictCount > 0 || summary.blockerCount > 0 || summary.warningCount > 0;

const buildMemberSummaries = (rows: MonthlyRosterPreviewRow[]): MemberSummary[] => {
  const grouped = new Map<string, MonthlyRosterPreviewRow[]>();

  for (const row of rows) {
    grouped.set(row.subjectEmploymentProfileId, [
      ...(grouped.get(row.subjectEmploymentProfileId) ?? []),
      row,
    ]);
  }

  return [...grouped.entries()]
    .map(([memberId, memberRows]) => ({
      memberId,
      memberLabel: readReferenceDisplay(memberRows[0]?.subjectEmploymentProfileRef, memberId),
      rows: memberRows,
      publishableCount: memberRows.filter((row) => row.isCandidateShift).length,
      workDayCount: new Set(
        memberRows.filter((row) => row.isCandidateShift).map((row) => row.localDate),
      ).size,
      changedCount: memberRows.filter((row) => row.rowKind === 'CHANGE_TIME').length,
      specialCount: memberRows.filter((row) => row.rowKind === 'ADD_SPECIAL_SHIFT').length,
      holidayOffCount: memberRows.filter((row) => row.rowKind === 'HOLIDAY_SUPPRESSED').length,
      workingToOffCount: memberRows.filter((row) => row.rowKind === 'WORKING_TO_OFF').length,
      conflictCount: memberRows.reduce((total, row) => total + row.conflicts.length, 0),
      blockerCount: memberRows.reduce((total, row) => total + row.blockers.length, 0),
      warningCount: memberRows.reduce((total, row) => total + row.warnings.length, 0),
    }))
    .sort((left, right) => left.memberLabel.localeCompare(right.memberLabel));
};

const resolveFreshness = (preview: MonthlyRosterPreview): 'generatedReady' | 'staleRefresh' => {
  if (preview.currentPreviewHash && preview.currentPreviewHash !== preview.computedPreviewHash) {
    return 'staleRefresh';
  }

  return 'generatedReady';
};

const memberStatus = (summary: MemberSummary): 'blocked' | 'warnings' | 'exceptions' | 'ready' => {
  if (summary.blockerCount > 0 || summary.conflictCount > 0) {
    return 'blocked';
  }
  if (summary.warningCount > 0) {
    return 'warnings';
  }
  if (summary.rows.some(hasException)) {
    return 'exceptions';
  }
  return 'ready';
};

const readErrorMessage = (
  t: (key: string, options?: Record<string, unknown>) => string,
  error: NormalizedApiError | null | undefined,
): string => {
  if (!error?.message) {
    return t('work-schedule:monthlyRosters.preview.states.loadErrorMessage');
  }
  return error.message.includes(':') ? t(error.message) : error.message;
};

const describeAvailabilitySource = (
  t: (key: string, options?: Record<string, unknown>) => string,
  row: MonthlyRosterPreviewRow,
  exception: RosterExceptionRecord | undefined,
): string | null => {
  if (!exception?.sourceAvailabilityLineId) {
    return null;
  }
  const effect =
    row.rowKind === 'WORKING_TO_OFF'
      ? t('work-schedule:monthlyRosters.appliedAvailability.effects.workingToOff')
      : row.rowKind === 'CHANGE_TIME'
        ? t('work-schedule:monthlyRosters.appliedAvailability.effects.changeTime')
        : t('work-schedule:monthlyRosters.appliedAvailability.effects.applied');
  const sourceType = exception.sourceAvailabilityType
    ? t(`work-schedule:availabilityBatches.types.${exception.sourceAvailabilityType}`)
    : '-';
  const sourceTaxonomy = exception.sourceAvailabilityTaxonomyCode
    ? t(`work-schedule:availabilityBatches.taxonomy.${exception.sourceAvailabilityTaxonomyCode}`)
    : '-';

  return t('work-schedule:monthlyRosters.appliedAvailability.previewLabel')
    .replace('{{effect}}', effect)
    .replace('{{type}}', sourceType)
    .replace('{{taxonomy}}', sourceTaxonomy);
};

const describePreviewIssue = (
  t: (key: string, options?: Record<string, unknown>) => string,
  kind: 'blockers' | 'warnings',
  value: string,
): string => {
  if (!/^[A-Z0-9_]+$/u.test(value)) {
    return value;
  }

  return t(`work-schedule:monthlyRosters.preview.${kind}.${value}`, {
    defaultValue: t(`work-schedule:monthlyRosters.preview.detail.${kind}Fallback`),
  });
};

const MemberDayDetails = ({
  summary,
  availabilitySourceByExceptionId,
  t,
}: {
  summary: MemberSummary;
  availabilitySourceByExceptionId: Map<string, RosterExceptionRecord>;
  t: (key: string, options?: Record<string, unknown>) => string;
}): JSX.Element => {
  const shownAvailabilityLineIds = new Set<string>();

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table
        className="min-w-full divide-y divide-border text-left text-sm"
        aria-label={t('work-schedule:monthlyRosters.preview.detail.memberCaption', {
          member: summary.memberLabel,
        })}
      >
        <thead className="bg-bg text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">{t('work-schedule:monthlyRosters.preview.table.date')}</th>
            <th className="px-3 py-2">{t('work-schedule:monthlyRosters.preview.table.time')}</th>
            <th className="px-3 py-2">{t('work-schedule:monthlyRosters.preview.table.kind')}</th>
            <th className="px-3 py-2">{t('work-schedule:monthlyRosters.preview.table.status')}</th>
            <th className="px-3 py-2">{t('work-schedule:monthlyRosters.preview.table.reason')}</th>
            <th className="px-3 py-2">{t('work-schedule:monthlyRosters.preview.table.issues')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-bg">
          {summary.rows.map((row) => {
            const availabilitySource = row.sourceExceptionId
              ? availabilitySourceByExceptionId.get(row.sourceExceptionId)
              : undefined;
            const availabilityLineId = availabilitySource?.sourceAvailabilityLineId;
            const showAvailabilityDescription =
              typeof availabilityLineId === 'string' &&
              !shownAvailabilityLineIds.has(availabilityLineId);
            if (typeof availabilityLineId === 'string' && showAvailabilityDescription) {
              shownAvailabilityLineIds.add(availabilityLineId);
            }
            const availabilityDescription =
              showAvailabilityDescription && availabilitySource
                ? describeAvailabilitySource(t, row, availabilitySource)
                : null;

            return (
              <tr
                key={row.previewRowId}
                className={row.blockers.length > 0 ? 'bg-rose-50' : undefined}
              >
                <td className="px-3 py-2">{row.localDate}</td>
                <td className="px-3 py-2">
                  {row.startLocalTime && row.endLocalTime
                    ? `${row.startLocalTime} - ${row.endLocalTime}`
                    : '-'}
                </td>
                <td className="px-3 py-2">
                  {t(`work-schedule:monthlyRosters.preview.rowKinds.${row.rowKind}`)}
                </td>
                <td className="px-3 py-2">
                  {row.isCandidateShift
                    ? t('work-schedule:monthlyRosters.preview.rows.candidate')
                    : t('work-schedule:monthlyRosters.preview.rows.suppressed')}
                </td>
                <td className="px-3 py-2">
                  {availabilityDescription ? (
                    <div className="space-y-1">
                      <div>{availabilityDescription}</div>
                      <TechnicalDetailsDisclosure
                        label={t('work-schedule:monthlyRosters.preview.detail.technicalDetails')}
                        details={{
                          previewRowId: row.previewRowId,
                          sourceExceptionId: row.sourceExceptionId,
                          sourceAvailabilityLineId: availabilityLineId,
                        }}
                      />
                    </div>
                  ) : (
                    (row.holidayName ??
                    row.holidayEntryType ??
                    t('work-schedule:monthlyRosters.preview.rows.reason.standard'))
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.blockers.length > 0 ? (
                    <div className="text-danger">
                      {t('work-schedule:monthlyRosters.preview.detail.blockers')}:{' '}
                      {row.blockers
                        .map((issue) => describePreviewIssue(t, 'blockers', issue))
                        .join(', ')}
                    </div>
                  ) : null}
                  {row.conflicts.length > 0 ? (
                    <div className="text-danger">
                      {t('work-schedule:monthlyRosters.preview.detail.conflicts')}:{' '}
                      {t('work-schedule:monthlyRosters.preview.rows.hasIssues', {
                        count: row.conflicts.length,
                      })}
                    </div>
                  ) : null}
                  {row.warnings.length > 0 ? (
                    <div className="text-warning">
                      {t('work-schedule:monthlyRosters.preview.detail.warnings')}:{' '}
                      {row.warnings
                        .map((issue) => describePreviewIssue(t, 'warnings', issue))
                        .join(', ')}
                    </div>
                  ) : null}
                  {row.blockers.length === 0 &&
                  row.conflicts.length === 0 &&
                  row.warnings.length === 0
                    ? t('work-schedule:monthlyRosters.preview.rows.noIssues')
                    : null}
                  {row.blockers.length > 0 ||
                  row.conflicts.length > 0 ||
                  row.warnings.length > 0 ? (
                    <TechnicalDetailsDisclosure
                      className="mt-1 text-left text-xs text-muted"
                      label={t('work-schedule:monthlyRosters.preview.detail.technicalDetails')}
                      details={{
                        blockers: row.blockers,
                        warnings: row.warnings,
                        conflicts: row.conflicts,
                      }}
                    />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ExcludedMembers = ({
  members,
  t,
}: {
  members: MonthlyRosterPreviewExcludedMember[];
  t: (key: string, options?: Record<string, unknown>) => string;
}): JSX.Element => (
  <div className="overflow-x-auto rounded border border-border">
    <table
      className="min-w-full divide-y divide-border text-left text-sm"
      aria-label={t('work-schedule:monthlyRosters.preview.excludedMembers.title')}
    >
      <thead className="bg-bg text-xs uppercase text-muted">
        <tr>
          <th className="px-3 py-2">
            {t('work-schedule:monthlyRosters.preview.excludedMembers.member')}
          </th>
          <th className="px-3 py-2">
            {t('work-schedule:monthlyRosters.preview.excludedMembers.profile')}
          </th>
          <th className="px-3 py-2">
            {t('work-schedule:monthlyRosters.preview.excludedMembers.reason')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border bg-bg">
        {members.map((member) => (
          <tr key={member.memberId}>
            <td className="px-3 py-2 font-mono">{member.memberId}</td>
            <td className="px-3 py-2">
              {readReferenceDisplay(
                member.linkedEmploymentProfileRef,
                member.linkedEmploymentProfileId ?? '-',
              )}
            </td>
            <td className="px-3 py-2">
              {t(`work-schedule:monthlyRosters.preview.exclusionReasons.${member.reasonCode}`)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const MonthlyRosterPreviewPanel = ({
  roster,
  scope,
}: MonthlyRosterPreviewPanelProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const previewEnabled = Boolean(roster.monthlyRosterId) && roster.status !== 'ARCHIVED';
  const previewQuery = useMonthlyRosterPreview(roster.monthlyRosterId, scope, {
    enabled: previewEnabled,
  });
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const preview = previewQuery.data;
  const excludedMembers = preview?.excludedMembers ?? [];
  const summaries = useMemo(() => buildMemberSummaries(preview?.rows ?? []), [preview?.rows]);
  const availabilitySourceByExceptionId = useMemo(() => {
    const sources = new Map<string, RosterExceptionRecord>();
    for (const exception of roster.exceptions ?? []) {
      if (exception.sourceAvailabilityLineId) {
        sources.set(exception.rosterExceptionId, exception);
      }
    }
    return sources;
  }, [roster.exceptions]);
  const expandedSummary = summaries.find((member) => member.memberId === expandedMemberId);
  const blockerCount = summaries.reduce((total, member) => total + member.blockerCount, 0);
  const warningCount = summaries.reduce((total, member) => total + member.warningCount, 0);
  const visibleSummaries = summaries.filter((member) => {
    const matchesSearch =
      !search.trim() ||
      member.memberId.toLowerCase().includes(search.trim().toLowerCase()) ||
      member.memberLabel.toLowerCase().includes(search.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'issues') return hasIssues(member);
    if (filter === 'exceptions') return member.rows.some(hasException);
    return filter === 'all';
  });

  if (!previewEnabled) {
    return (
      <MetadataSection title={t('work-schedule:monthlyRosters.preview.title')}>
        <div className="rounded border border-border bg-panel px-3 py-4 text-sm text-muted">
          {t('work-schedule:monthlyRosters.preview.states.archivedUnavailable')}
        </div>
      </MetadataSection>
    );
  }

  return (
    <MetadataSection title={t('work-schedule:monthlyRosters.preview.title')}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          <span>{t('work-schedule:monthlyRosters.preview.copy.summaryFirst')}</span>
          <button
            type="button"
            className="rounded border border-border bg-panel px-3 py-2 font-medium text-text"
            disabled={previewQuery.isFetching}
            onClick={() => void previewQuery.refetch()}
          >
            {t(
              preview
                ? 'work-schedule:monthlyRosters.preview.actions.refresh'
                : 'work-schedule:monthlyRosters.preview.actions.generate',
            )}
          </button>
        </div>

        {previewQuery.isPending ? <LoadingState lines={5} /> : null}
        {previewQuery.isError ? (
          (previewQuery.error as unknown as NormalizedApiError | null)?.permissionDenied ? (
            <PermissionDeniedState />
          ) : (
            <ErrorState
              title={t('work-schedule:monthlyRosters.preview.states.loadErrorTitle')}
              message={readErrorMessage(
                t,
                previewQuery.error as unknown as NormalizedApiError | null,
              )}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void previewQuery.refetch()}
            />
          )
        ) : null}

        {preview ? (
          <>
            {preview.summary.totalConflicts > 0 || blockerCount > 0 ? (
              <div role="alert" className="rounded border border-danger bg-panel px-3 py-3 text-sm">
                <p className="font-semibold text-danger">
                  {t('work-schedule:monthlyRosters.preview.issueSummary.title')}
                </p>
                <p className="mt-1 text-muted">
                  {t('work-schedule:monthlyRosters.preview.issueSummary.copy', {
                    conflicts: preview.summary.totalConflicts,
                    blockers: blockerCount,
                  })}
                </p>
              </div>
            ) : null}

            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'included',
                  label: t('work-schedule:monthlyRosters.preview.summary.includedMembers'),
                  value: String(preview.summary.includedMemberCount),
                },
                {
                  key: 'excluded',
                  label: t('work-schedule:monthlyRosters.preview.summary.excludedMembers'),
                  value: String(preview.summary.excludedMemberCount),
                },
                {
                  key: 'publishable',
                  label: t(
                    'work-schedule:monthlyRosters.preview.summary.candidatesAfterExceptions',
                  ),
                  value: String(preview.summary.totalCandidateShiftsAfterExceptions),
                },
                {
                  key: 'off',
                  label: t('work-schedule:monthlyRosters.preview.summary.suppressed'),
                  value: String(
                    preview.summary.totalHolidaySuppressions + preview.summary.totalWorkingToOff,
                  ),
                },
                {
                  key: 'exceptions',
                  label: t('work-schedule:monthlyRosters.preview.summary.exceptions'),
                  value: String(
                    preview.summary.totalWorkingToOff +
                      preview.summary.totalChangeTime +
                      preview.summary.totalAddSpecialShift,
                  ),
                },
                {
                  key: 'conflicts',
                  label: t('work-schedule:monthlyRosters.preview.summary.conflicts'),
                  value: String(preview.summary.totalConflicts),
                },
                {
                  key: 'blockers',
                  label: t('work-schedule:monthlyRosters.preview.detail.blockers'),
                  value: String(blockerCount),
                },
                {
                  key: 'warnings',
                  label: t('work-schedule:monthlyRosters.preview.detail.warnings'),
                  value: String(warningCount),
                },
              ]}
              columns={3}
            />

            <div className="rounded border border-border bg-panel p-3">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                {(['all', 'issues', 'exceptions', 'excluded'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded border px-3 py-2 text-sm ${
                      filter === value
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-bg'
                    }`}
                    disabled={value === 'excluded' && excludedMembers.length === 0}
                    onClick={() => setFilter(value)}
                  >
                    {t(`work-schedule:monthlyRosters.preview.filters.${value}`)}
                  </button>
                ))}
                <label className="ml-auto text-sm text-muted">
                  <span className="mb-1 block">
                    {t('work-schedule:monthlyRosters.preview.filters.employeeSearch')}
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="rounded border border-border bg-bg px-2 py-1 text-text"
                  />
                </label>
              </div>

              {filter === 'excluded' ? (
                <ExcludedMembers members={excludedMembers} t={t} />
              ) : visibleSummaries.length === 0 ? (
                <div className="rounded border border-border bg-bg px-3 py-6 text-center text-sm text-muted">
                  {t('work-schedule:monthlyRosters.preview.states.emptyMembers')}
                </div>
              ) : (
                <div className="overflow-x-auto rounded border border-border">
                  <table
                    className="min-w-full divide-y divide-border text-left text-sm"
                    aria-label={t('work-schedule:monthlyRosters.preview.memberTable.caption')}
                  >
                    <thead className="bg-bg text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.employee')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.memberTable.status')}
                        </th>
                        {[
                          'publishable',
                          'workDays',
                          'changed',
                          'special',
                          'offDays',
                          'issues',
                          'actions',
                        ].map((key) => (
                          <th key={key} className="px-3 py-2">
                            {t(`work-schedule:monthlyRosters.preview.memberTable.${key}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-bg">
                      {visibleSummaries.map((member) => {
                        const status = memberStatus(member);
                        const expanded = expandedMemberId === member.memberId;
                        return (
                          <tr key={member.memberId}>
                            <td className="px-3 py-2 font-medium">{member.memberLabel}</td>
                            <td className="px-3 py-2">
                              <StatusBadge
                                tone={
                                  status === 'blocked'
                                    ? 'danger'
                                    : status === 'ready'
                                      ? 'success'
                                      : 'warning'
                                }
                                label={t(
                                  `work-schedule:monthlyRosters.preview.memberStatuses.${status}`,
                                )}
                                uppercase={false}
                              />
                            </td>
                            <td className="px-3 py-2">{member.publishableCount}</td>
                            <td className="px-3 py-2">{member.workDayCount}</td>
                            <td className="px-3 py-2">{member.changedCount}</td>
                            <td className="px-3 py-2">{member.specialCount}</td>
                            <td className="px-3 py-2">
                              {member.holidayOffCount + member.workingToOffCount}
                            </td>
                            <td className="px-3 py-2">
                              {member.conflictCount + member.blockerCount + member.warningCount}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                className="rounded border border-border px-2 py-1"
                                aria-expanded={expanded}
                                onClick={() =>
                                  setExpandedMemberId(expanded ? null : member.memberId)
                                }
                              >
                                {t(
                                  expanded
                                    ? 'work-schedule:monthlyRosters.preview.actions.hideDetails'
                                    : 'work-schedule:monthlyRosters.preview.actions.showDetails',
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {expandedSummary ? (
                <div className="mt-3">
                  <MemberDayDetails
                    summary={expandedSummary}
                    availabilitySourceByExceptionId={availabilitySourceByExceptionId}
                    t={t}
                  />
                </div>
              ) : null}
            </div>

            <TechnicalDetailsDisclosure
              className="rounded border border-border bg-panel p-4 text-left text-xs text-muted shadow-shell"
              label={t('work-schedule:monthlyRosters.preview.admin.title')}
              details={{
                freshness: t(
                  `work-schedule:monthlyRosters.preview.freshness.${resolveFreshness(preview)}`,
                ),
                storedPreviewFingerprint: preview.currentPreviewHash,
                computedPreviewFingerprint: preview.computedPreviewHash,
                expectedPublishFingerprint: preview.computedPreviewHash,
              }}
            />
          </>
        ) : null}
      </div>
    </MetadataSection>
  );
};
