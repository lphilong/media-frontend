import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMonthlyRosterPreview } from '@modules/work-schedule/hooks/use-work-schedule';
import type {
  MonthlyRosterPreview,
  MonthlyRosterPreviewConflict,
  MonthlyRosterPreviewRow,
  MonthlyRosterRecord,
  MonthlyRosterScope,
} from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ErrorState,
  LoadingState,
  MetadataSection,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  StatusBadge,
} from '@shared/components/primitives';
import { formatUtcTimestamp } from '@shared/formatting/formatters';

type MonthlyRosterPreviewPanelProps = {
  roster: MonthlyRosterRecord;
  scope?: MonthlyRosterScope;
};

type ConflictPanelItem =
  | {
      kind: 'conflict';
      row: MonthlyRosterPreviewRow;
      conflict: MonthlyRosterPreviewConflict;
    }
  | {
      kind: 'blocker';
      row: MonthlyRosterPreviewRow;
      blocker: string;
    };

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const formatNullableTimestamp = (value?: string | number | null): string =>
  value ? formatUtcTimestamp(value) : '-';

const getMonthEndDate = (rosterMonth: string): string => {
  const [yearPart, monthPart] = rosterMonth.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return `${rosterMonth}-31`;
  }

  return `${rosterMonth}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(
    2,
    '0',
  )}`;
};

const hasExceptionSource = (row: MonthlyRosterPreviewRow): boolean =>
  row.sourceExceptionId !== null ||
  row.rowKind === 'WORKING_TO_OFF' ||
  row.rowKind === 'CHANGE_TIME' ||
  row.rowKind === 'ADD_SPECIAL_SHIFT';

const hasConflictOrBlocker = (row: MonthlyRosterPreviewRow): boolean =>
  row.conflicts.length > 0 || row.blockers.length > 0;

const buildConflictItems = (rows: MonthlyRosterPreviewRow[]): ConflictPanelItem[] =>
  rows.flatMap((row) => [
    ...row.conflicts.map((conflict) => ({ kind: 'conflict' as const, row, conflict })),
    ...row.blockers.map((blocker) => ({ kind: 'blocker' as const, row, blocker })),
  ]);

const resolveFreshness = (preview: MonthlyRosterPreview): 'notPreviewed' | 'current' | 'stale' => {
  if (!preview.currentPreviewHash) {
    return 'notPreviewed';
  }

  return preview.currentPreviewHash === preview.computedPreviewHash ? 'current' : 'stale';
};

const rowReason = (
  t: (key: string, options?: Record<string, unknown>) => string,
  row: MonthlyRosterPreviewRow,
): string => {
  if (row.rowKind === 'HOLIDAY_SUPPRESSED') {
    return t('work-schedule:monthlyRosters.preview.rows.reason.holidaySuppressed', {
      name: row.holidayName ?? row.holidayEntryType ?? '-',
    });
  }

  if (row.rowKind === 'WORKING_TO_OFF') {
    return t('work-schedule:monthlyRosters.preview.rows.reason.workingToOff');
  }

  if (row.rowKind === 'CHANGE_TIME') {
    return t('work-schedule:monthlyRosters.preview.rows.reason.changeTime', {
      startLocalTime: row.startLocalTime ?? '-',
    });
  }

  if (row.rowKind === 'ADD_SPECIAL_SHIFT') {
    return t('work-schedule:monthlyRosters.preview.rows.reason.addSpecialShift', {
      startLocalTime: row.startLocalTime ?? '-',
    });
  }

  return t('work-schedule:monthlyRosters.preview.rows.reason.standard');
};

const readErrorMessage = (
  t: (key: string, options?: Record<string, unknown>) => string,
  error: NormalizedApiError | null | undefined,
): string => {
  if (!error?.message) {
    return t('work-schedule:monthlyRosters.preview.states.loadErrorMessage');
  }

  if (error.message.includes(':')) {
    return t(error.message);
  }

  return error.message;
};

export const MonthlyRosterPreviewPanel = ({
  roster,
  scope,
}: MonthlyRosterPreviewPanelProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const previewEnabled = Boolean(roster.monthlyRosterId) && roster.status !== 'ARCHIVED';
  const previewQuery = useMonthlyRosterPreview(roster.monthlyRosterId, scope, {
    enabled: previewEnabled,
  });
  const previewError = previewQuery.error as NormalizedApiError | null;
  const [conflictOnly, setConflictOnly] = useState(false);
  const [exceptionOnly, setExceptionOnly] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const monthStart = `${roster.rosterMonth}-01`;
  const monthEnd = getMonthEndDate(roster.rosterMonth);

  const visibleRows = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    return (previewQuery.data?.rows ?? []).filter((row) => {
      if (conflictOnly && !hasConflictOrBlocker(row)) {
        return false;
      }

      if (exceptionOnly && !hasExceptionSource(row)) {
        return false;
      }

      if (query && !row.subjectEmploymentProfileId.toLowerCase().includes(query)) {
        return false;
      }

      if (dateStart && row.localDate < dateStart) {
        return false;
      }

      if (dateEnd && row.localDate > dateEnd) {
        return false;
      }

      return true;
    });
  }, [conflictOnly, dateEnd, dateStart, employeeSearch, exceptionOnly, previewQuery.data?.rows]);

  const conflictItems = useMemo(
    () => buildConflictItems(previewQuery.data?.rows ?? []),
    [previewQuery.data?.rows],
  );
  const selectedRow = useMemo(
    () => previewQuery.data?.rows.find((row) => row.previewRowId === selectedRowId) ?? null,
    [previewQuery.data?.rows, selectedRowId],
  );
  const blockerCount = useMemo(
    () => (previewQuery.data?.rows ?? []).reduce((total, row) => total + row.blockers.length, 0),
    [previewQuery.data?.rows],
  );

  const focusRow = (rowId: string): void => {
    setSelectedRowId(rowId);
    document.getElementById(`preview-row-${encodeURIComponent(rowId)}`)?.scrollIntoView({
      block: 'center',
    });
  };

  if (!previewEnabled) {
    return (
      <MetadataSection title={t('work-schedule:monthlyRosters.preview.title')}>
        <div className="space-y-3">
          <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
            {t('work-schedule:monthlyRosters.preview.copy.readOnly')}
          </div>
          <div className="rounded border border-border bg-panel px-3 py-4 text-sm text-muted">
            {t('work-schedule:monthlyRosters.preview.states.archivedUnavailable')}
          </div>
        </div>
      </MetadataSection>
    );
  }

  return (
    <MetadataSection title={t('work-schedule:monthlyRosters.preview.title')}>
      <div className="space-y-4">
        <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('work-schedule:monthlyRosters.preview.copy.readOnly')}
        </div>
        <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('work-schedule:monthlyRosters.preview.copy.noPublish')}
        </div>

        {previewQuery.isPending ? <LoadingState lines={5} /> : null}

        {previewQuery.isError ? (
          previewError?.permissionDenied ? (
            <PermissionDeniedState />
          ) : (
            <ErrorState
              title={t('work-schedule:monthlyRosters.preview.states.loadErrorTitle')}
              message={readErrorMessage(t, previewError)}
              actionLabel={t('common:actions.retry')}
              onRetry={() => void previewQuery.refetch()}
            />
          )
        ) : null}

        {previewQuery.data ? (
          <>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'eligible',
                  label: t('work-schedule:monthlyRosters.preview.summary.eligibleProfiles'),
                  value: String(previewQuery.data.summary.totalEligibleProfiles),
                },
                {
                  key: 'standard',
                  label: t('work-schedule:monthlyRosters.preview.summary.standardCandidates'),
                  value: String(previewQuery.data.summary.totalStandardCandidateShifts),
                },
                {
                  key: 'suppressed',
                  label: t('work-schedule:monthlyRosters.preview.summary.suppressed'),
                  value: String(previewQuery.data.summary.totalHolidaySuppressions),
                },
                {
                  key: 'exceptions',
                  label: t('work-schedule:monthlyRosters.preview.summary.exceptions'),
                  value: String(
                    previewQuery.data.summary.totalWorkingToOff +
                      previewQuery.data.summary.totalChangeTime +
                      previewQuery.data.summary.totalAddSpecialShift,
                  ),
                },
                {
                  key: 'candidate-after-exceptions',
                  label: t(
                    'work-schedule:monthlyRosters.preview.summary.candidatesAfterExceptions',
                  ),
                  value: String(previewQuery.data.summary.totalCandidateShiftsAfterExceptions),
                },
                {
                  key: 'special',
                  label: t('work-schedule:monthlyRosters.preview.summary.specialShift'),
                  value: String(previewQuery.data.summary.totalAddSpecialShift),
                },
                {
                  key: 'changed',
                  label: t('work-schedule:monthlyRosters.preview.summary.changedTime'),
                  value: String(previewQuery.data.summary.totalChangeTime),
                },
                {
                  key: 'working-off',
                  label: t('work-schedule:monthlyRosters.preview.summary.workingToOff'),
                  value: String(previewQuery.data.summary.totalWorkingToOff),
                },
                {
                  key: 'conflicts',
                  label: t('work-schedule:monthlyRosters.preview.summary.conflicts'),
                  value: String(previewQuery.data.summary.totalConflicts),
                },
                {
                  key: 'blockers',
                  label: t('work-schedule:monthlyRosters.preview.summary.blockers'),
                  value: String(blockerCount),
                },
              ]}
              columns={3}
            />

            <div className="rounded border border-border bg-panel p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-text">
                  {t('work-schedule:monthlyRosters.preview.conflicts.title')}
                </h3>
                <StatusBadge
                  tone={conflictItems.length > 0 ? 'danger' : 'success'}
                  label={
                    conflictItems.length > 0
                      ? t('work-schedule:monthlyRosters.preview.conflicts.hasIssues')
                      : t('work-schedule:monthlyRosters.preview.conflicts.none')
                  }
                  uppercase={false}
                />
              </div>
              {conflictItems.length === 0 ? (
                <p className="text-sm text-muted">
                  {t('work-schedule:monthlyRosters.preview.conflicts.empty')}
                </p>
              ) : (
                <div className="space-y-2">
                  {conflictItems.map((item, index) => (
                    <button
                      key={`${item.kind}-${item.row.previewRowId}-${index}`}
                      type="button"
                      className="block w-full rounded border border-border bg-bg px-3 py-2 text-left text-sm hover:border-accent"
                      onClick={() => focusRow(item.row.previewRowId)}
                    >
                      <span className="font-medium text-text">
                        {item.kind === 'conflict'
                          ? t(
                              `work-schedule:monthlyRosters.preview.conflicts.kinds.${item.conflict.conflictKind}`,
                            )
                          : t('work-schedule:monthlyRosters.preview.conflicts.blocker')}
                      </span>
                      <span className="ml-2 text-muted">
                        {item.row.subjectEmploymentProfileId} · {item.row.localDate}
                      </span>
                      <span className="mt-1 block text-muted">
                        {item.kind === 'conflict'
                          ? t('work-schedule:monthlyRosters.preview.conflicts.message', {
                              title: item.conflict.title ?? item.conflict.shiftCode ?? '-',
                              rowId: item.conflict.relatedPreviewRowId ?? item.row.previewRowId,
                            })
                          : t(`work-schedule:monthlyRosters.preview.blockers.${item.blocker}`, {
                              defaultValue: item.blocker,
                            })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded border border-border bg-panel p-3">
              <div className="mb-3 grid gap-3 md:grid-cols-5">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={conflictOnly}
                    onChange={(event) => setConflictOnly(event.target.checked)}
                  />
                  {t('work-schedule:monthlyRosters.preview.filters.conflictOnly')}
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={exceptionOnly}
                    onChange={(event) => setExceptionOnly(event.target.checked)}
                  />
                  {t('work-schedule:monthlyRosters.preview.filters.exceptionOnly')}
                </label>
                <label className="text-sm text-muted">
                  <span className="mb-1 block">
                    {t('work-schedule:monthlyRosters.preview.filters.employeeSearch')}
                  </span>
                  <input
                    type="search"
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder={t(
                      'work-schedule:monthlyRosters.preview.filters.employeeSearchPlaceholder',
                    )}
                    className="w-full rounded border border-border bg-bg px-2 py-1 text-text"
                  />
                </label>
                <label className="text-sm text-muted">
                  <span className="mb-1 block">
                    {t('work-schedule:monthlyRosters.preview.filters.dateStart')}
                  </span>
                  <input
                    type="date"
                    min={monthStart}
                    max={monthEnd}
                    value={dateStart}
                    onChange={(event) => setDateStart(event.target.value)}
                    className="w-full rounded border border-border bg-bg px-2 py-1 text-text"
                  />
                </label>
                <label className="text-sm text-muted">
                  <span className="mb-1 block">
                    {t('work-schedule:monthlyRosters.preview.filters.dateEnd')}
                  </span>
                  <input
                    type="date"
                    min={monthStart}
                    max={monthEnd}
                    value={dateEnd}
                    onChange={(event) => setDateEnd(event.target.value)}
                    className="w-full rounded border border-border bg-bg px-2 py-1 text-text"
                  />
                </label>
              </div>

              {visibleRows.length === 0 ? (
                <div className="rounded border border-border bg-bg px-3 py-6 text-center text-sm text-muted">
                  {t('work-schedule:monthlyRosters.preview.states.emptyRows')}
                </div>
              ) : (
                <div className="overflow-x-auto rounded border border-border">
                  <table className="min-w-full divide-y divide-border text-left text-sm">
                    <caption className="sr-only">
                      {t('work-schedule:monthlyRosters.preview.table.caption')}
                    </caption>
                    <thead className="bg-bg text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.employee')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.date')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.kind')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.status')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.time')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.exception')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.holiday')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.issues')}
                        </th>
                        <th className="px-3 py-2">
                          {t('work-schedule:monthlyRosters.preview.table.reason')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-bg">
                      {visibleRows.map((row) => (
                        <tr
                          id={`preview-row-${encodeURIComponent(row.previewRowId)}`}
                          key={row.previewRowId}
                          className={
                            selectedRowId === row.previewRowId
                              ? 'bg-amber-50'
                              : hasConflictOrBlocker(row)
                                ? 'bg-rose-50'
                                : undefined
                          }
                          onClick={() => setSelectedRowId(row.previewRowId)}
                        >
                          <td className="px-3 py-2 font-mono">{row.subjectEmploymentProfileId}</td>
                          <td className="px-3 py-2">{row.localDate}</td>
                          <td className="px-3 py-2">
                            {t(`work-schedule:monthlyRosters.preview.rowKinds.${row.rowKind}`)}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              tone={row.isCandidateShift ? 'success' : 'muted'}
                              label={
                                row.isCandidateShift
                                  ? t('work-schedule:monthlyRosters.preview.rows.candidate')
                                  : t('work-schedule:monthlyRosters.preview.rows.suppressed')
                              }
                              uppercase={false}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {row.startLocalTime && row.endLocalTime
                              ? `${row.startLocalTime} - ${row.endLocalTime}`
                              : '-'}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {formatNullable(row.sourceExceptionId)}
                          </td>
                          <td className="px-3 py-2">
                            {formatNullable(row.holidayName ?? row.holidayEntryType)}
                          </td>
                          <td className="px-3 py-2">
                            {row.conflicts.length > 0 || row.blockers.length > 0 ? (
                              <StatusBadge
                                tone="danger"
                                label={t('work-schedule:monthlyRosters.preview.rows.hasIssues', {
                                  count: row.conflicts.length + row.blockers.length,
                                })}
                                uppercase={false}
                              />
                            ) : (
                              <StatusBadge
                                tone="success"
                                label={t('work-schedule:monthlyRosters.preview.rows.noIssues')}
                                uppercase={false}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">{rowReason(t, row)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedRow ? (
              <div className="rounded border border-border bg-panel p-3">
                <h3 className="mb-3 text-sm font-semibold text-text">
                  {t('work-schedule:monthlyRosters.preview.detail.title')}
                </h3>
                <ReadOnlyFieldGrid
                  fields={[
                    {
                      key: 'row-id',
                      label: t('work-schedule:monthlyRosters.preview.detail.rowId'),
                      value: selectedRow.previewRowId,
                      monospace: true,
                    },
                    {
                      key: 'employee',
                      label: t('work-schedule:monthlyRosters.preview.table.employee'),
                      value: selectedRow.subjectEmploymentProfileId,
                      monospace: true,
                    },
                    {
                      key: 'date',
                      label: t('work-schedule:monthlyRosters.preview.table.date'),
                      value: selectedRow.localDate,
                    },
                    {
                      key: 'kind',
                      label: t('work-schedule:monthlyRosters.preview.table.kind'),
                      value: t(
                        `work-schedule:monthlyRosters.preview.rowKinds.${selectedRow.rowKind}`,
                      ),
                    },
                    {
                      key: 'start',
                      label: t('work-schedule:monthlyRosters.preview.detail.shiftStartAt'),
                      value: formatNullableTimestamp(selectedRow.shiftStartAt),
                    },
                    {
                      key: 'end',
                      label: t('work-schedule:monthlyRosters.preview.detail.shiftEndAt'),
                      value: formatNullableTimestamp(selectedRow.shiftEndAt),
                    },
                    {
                      key: 'exception',
                      label: t('work-schedule:monthlyRosters.preview.table.exception'),
                      value: formatNullable(selectedRow.sourceExceptionId),
                      monospace: true,
                    },
                    {
                      key: 'slot',
                      label: t('work-schedule:monthlyRosters.preview.detail.slotKey'),
                      value: formatNullable(selectedRow.sourceRosterSlotKey),
                      monospace: true,
                    },
                    {
                      key: 'warnings',
                      label: t('work-schedule:monthlyRosters.preview.detail.warnings'),
                      value:
                        selectedRow.warnings.length > 0 ? selectedRow.warnings.join(', ') : '-',
                    },
                    {
                      key: 'blockers',
                      label: t('work-schedule:monthlyRosters.preview.detail.blockers'),
                      value:
                        selectedRow.blockers.length > 0 ? selectedRow.blockers.join(', ') : '-',
                    },
                  ]}
                  columns={2}
                />
              </div>
            ) : null}

            <details className="rounded border border-border bg-panel p-4 shadow-shell">
              <summary className="cursor-pointer text-sm font-semibold text-text">
                {t('work-schedule:monthlyRosters.preview.admin.title')}
              </summary>
              <div className="pt-3">
                <ReadOnlyFieldGrid
                  fields={[
                    {
                      key: 'freshness',
                      label: t('work-schedule:monthlyRosters.preview.admin.freshness'),
                      value: t(
                        `work-schedule:monthlyRosters.preview.freshness.${resolveFreshness(
                          previewQuery.data,
                        )}`,
                      ),
                    },
                    {
                      key: 'draft-version',
                      label: t('work-schedule:monthlyRosters.fields.draftVersion'),
                      value: String(previewQuery.data.draftVersion),
                    },
                    {
                      key: 'current-hash',
                      label: t('work-schedule:monthlyRosters.fields.currentPreviewHash'),
                      value: formatNullable(previewQuery.data.currentPreviewHash),
                      monospace: true,
                    },
                    {
                      key: 'computed-hash',
                      label: t('work-schedule:monthlyRosters.preview.admin.computedPreviewHash'),
                      value: previewQuery.data.computedPreviewHash,
                      monospace: true,
                    },
                  ]}
                  columns={2}
                />
              </div>
            </details>
          </>
        ) : null}
      </div>
    </MetadataSection>
  );
};
