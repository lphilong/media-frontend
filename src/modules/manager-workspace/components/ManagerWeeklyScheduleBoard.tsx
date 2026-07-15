import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useManagerWeeklySchedule,
  type ManagerWeeklySchedule,
  type ManagerWorkspaceContext,
} from '@modules/manager-workspace/api/manager-workspace.api';

type ScopeOption = { type: 'ORG_UNIT' | 'TALENT_GROUP'; id: string; label: string };

export const ManagerWeeklyScheduleBoard = ({
  context,
  conflictOnly = false,
}: {
  context: ManagerWorkspaceContext;
  conflictOnly?: boolean;
}): JSX.Element => {
  const { t } = useTranslation('manager-workspace');
  const scopes = useMemo<ScopeOption[]>(
    () => [
      ...context.scopes.orgUnits.map((scope) => ({
        type: 'ORG_UNIT' as const,
        id: scope.orgUnitId,
        label: scope.name ?? scope.orgUnitId,
      })),
      ...context.scopes.talentGroups.map((scope) => ({
        type: 'TALENT_GROUP' as const,
        id: scope.talentGroupId,
        label: scope.displayName ?? scope.name ?? scope.code ?? scope.talentGroupId,
      })),
    ],
    [context.scopes.orgUnits, context.scopes.talentGroups],
  );
  const [scopeToken, setScopeToken] = useState(() => scopeValue(scopes[0]));
  const [weekStart, setWeekStart] = useState(currentMonday());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [request, setRequest] = useState('');
  const [mobileDay, setMobileDay] = useState(0);
  const [selectedMember, setSelectedMember] = useState<
    ManagerWeeklySchedule['rows'][number] | null
  >(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const selectedScope = scopes.find((scope) => scopeValue(scope) === scopeToken) ?? scopes[0];
  const query = useManagerWeeklySchedule(
    context,
    selectedScope
      ? {
          scopeType: selectedScope.type,
          scopeId: selectedScope.id,
          weekStart,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(status ? { status } : {}),
          ...(conflictOnly ? { conflict: 'WITH_CONFLICT' } : {}),
          ...(request ? { request } : {}),
        }
      : undefined,
    Boolean(selectedScope),
  );

  useEffect(() => {
    if (!scopes.some((scope) => scopeValue(scope) === scopeToken)) {
      setScopeToken(scopeValue(scopes[0]));
    }
  }, [scopeToken, scopes]);

  const closeDrawer = (): void => {
    setSelectedMember(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  if (!selectedScope) {
    return (
      <BoardState title={t('scheduleBoard.noScopeTitle')} message={t('scheduleBoard.noScope')} />
    );
  }

  return (
    <div className="space-y-4" data-testid="manager-weekly-schedule">
      <div className="grid gap-3 rounded border border-border bg-bg p-3 md:grid-cols-4">
        <label className="text-sm font-medium">
          {t('scheduleBoard.scope')}
          <select
            className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
            value={scopeToken}
            onChange={(event) => setScopeToken(event.target.value)}
          >
            {scopes.map((scope) => (
              <option key={scopeValue(scope)} value={scopeValue(scope)}>
                {scope.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t('scheduleBoard.search')}
          <input
            className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          {t('scheduleBoard.status')}
          <select
            className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{t('scheduleBoard.all')}</option>
            {['READY', 'UNSCHEDULED', 'CONFLICT', 'LOCKED'].map((value) => (
              <option key={value} value={value}>
                {t(`scheduleBoard.readiness.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t('scheduleBoard.requests')}
          <select
            className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
          >
            <option value="">{t('scheduleBoard.all')}</option>
            <option value="WITH_REQUEST">{t('scheduleBoard.withRequest')}</option>
            <option value="WITHOUT_REQUEST">{t('scheduleBoard.withoutRequest')}</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label={t('scheduleBoard.navigation')}>
        <button
          className="rounded border border-border px-3 py-2"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          {t('scheduleBoard.previous')}
        </button>
        <button
          className="rounded border border-border px-3 py-2"
          onClick={() => setWeekStart(currentMonday())}
        >
          {t('scheduleBoard.today')}
        </button>
        <button
          className="rounded border border-border px-3 py-2"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          {t('scheduleBoard.next')}
        </button>
        <span className="text-sm font-medium" aria-live="polite">
          {weekStart}
        </span>
      </div>

      {query.isLoading ? <ScheduleSkeleton /> : null}
      {query.isError ? (
        <BoardState title={t('scheduleBoard.errorTitle')} message={t('scheduleBoard.error')}>
          <button
            className="rounded border border-border px-3 py-2"
            onClick={() => void query.refetch()}
          >
            {t('actions.retry')}
          </button>
        </BoardState>
      ) : null}
      {query.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4" aria-label={t('scheduleBoard.summary')}>
            <Summary
              label={t('scheduleBoard.members')}
              value={query.data.summary.returnedMemberCount}
            />
            <Summary
              label={t('scheduleBoard.shifts')}
              value={query.data.summary.officialShiftCount}
            />
            <Summary
              label={t('scheduleBoard.pending')}
              value={query.data.summary.pendingRequestCount}
            />
            <Summary
              label={t('scheduleBoard.conflicts')}
              value={query.data.summary.conflictCount}
            />
          </div>
          {query.data.window.locked ? (
            <p
              role="status"
              className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm"
            >
              {t('scheduleBoard.locked')}
            </p>
          ) : null}
          {query.data.rows.length === 0 ? (
            <BoardState title={t('scheduleBoard.emptyTitle')} message={t('scheduleBoard.empty')} />
          ) : (
            <>
              <div className="hidden max-h-[32rem] overflow-auto rounded border border-border md:block">
                <table
                  className="min-w-[72rem] border-collapse text-sm"
                  aria-label={t('scheduleBoard.grid')}
                >
                  <thead className="sticky top-0 z-20 bg-panel">
                    <tr>
                      <th className="sticky left-0 z-30 min-w-56 border-b border-r border-border bg-panel p-3 text-left">
                        {t('scheduleBoard.member')}
                      </th>
                      {query.data.days.map((day) => (
                        <th
                          key={day}
                          scope="col"
                          className="min-w-36 border-b border-border p-3 text-left"
                        >
                          {formatDay(day)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.rows.map((row, rowIndex) => (
                      <tr key={row.member.employmentProfileId}>
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-r border-t border-border bg-panel p-3 text-left"
                        >
                          <button
                            className="text-left font-medium underline-offset-2 hover:underline"
                            onClick={(event) => {
                              openerRef.current = event.currentTarget;
                              setSelectedMember(row);
                            }}
                          >
                            {row.member.displayName}
                          </button>
                          <span className="mt-1 block text-xs text-muted">
                            {t(`scheduleBoard.readiness.${row.readiness}`)}
                          </span>
                        </th>
                        {query.data.days.map((day, columnIndex) => (
                          <td
                            key={day}
                            tabIndex={0}
                            data-week-cell={`${rowIndex}-${columnIndex}`}
                            className="border-t border-border p-2 align-top focus:outline focus:outline-2"
                            onKeyDown={(event) =>
                              moveGridFocus(event, rowIndex, columnIndex, query.data.rows.length)
                            }
                          >
                            <DayCell row={row} day={day} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                <label className="block text-sm font-medium">
                  {t('scheduleBoard.day')}
                  <select
                    className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
                    value={mobileDay}
                    onChange={(event) => setMobileDay(Number(event.target.value))}
                  >
                    {query.data.days.map((day, index) => (
                      <option key={day} value={index}>
                        {formatDay(day)}
                      </option>
                    ))}
                  </select>
                </label>
                {query.data.rows.map((row) => (
                  <article
                    key={row.member.employmentProfileId}
                    className="rounded border border-border bg-bg p-3"
                  >
                    <button
                      className="font-medium underline-offset-2 hover:underline"
                      onClick={(event) => {
                        openerRef.current = event.currentTarget;
                        setSelectedMember(row);
                      }}
                    >
                      {row.member.displayName}
                    </button>
                    <DayCell row={row} day={query.data.days[mobileDay]!} />
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}

      {selectedMember ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          role="presentation"
          onMouseDown={closeDrawer}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-schedule-member-title"
            className="h-full w-full max-w-md overflow-y-auto bg-panel p-5 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => handleDialogKeyDown(event, dialogRef.current, closeDrawer)}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="manager-schedule-member-title" className="text-lg font-semibold">
                {selectedMember.member.displayName}
              </h3>
              <button
                autoFocus
                className="rounded border border-border px-3 py-2"
                onClick={closeDrawer}
              >
                {t('scheduleBoard.close')}
              </button>
            </div>
            <p className="mt-3 text-sm">
              {t(`scheduleBoard.readiness.${selectedMember.readiness}`)}
            </p>
            <p className="mt-2 text-sm">
              {t('scheduleBoard.shifts')}: {selectedMember.shifts.length}
            </p>
            <p className="mt-2 text-sm">
              {t('scheduleBoard.requests')}: {selectedMember.requestIndicators.length}
            </p>
            <p className="mt-2 text-sm">
              {t('scheduleBoard.availability')}: {selectedMember.availabilityIndicators.length}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
};

const DayCell = ({
  row,
  day,
}: {
  row: ManagerWeeklySchedule['rows'][number];
  day: string;
}): JSX.Element => {
  const { t } = useTranslation('manager-workspace');
  const shifts = row.shifts.filter((shift) => hcmDate(shift.shiftStartAt) === day);
  const hasAvailability = row.availabilityIndicators.some(
    (indicator) => indicator.dateFrom <= day && indicator.dateTo >= day,
  );
  const requests = row.requestIndicators.filter(
    (indicator) =>
      indicator.requestedStartAt !== null && hcmDate(indicator.requestedStartAt) === day,
  );
  const conflicts = row.conflicts.filter((conflict) => conflict.date === day);
  return (
    <div className="space-y-1">
      {shifts.map((shift) => (
        <span
          key={shift.workShiftId}
          className="block rounded border border-sky-400 bg-sky-50 px-2 py-1 text-xs"
        >
          {formatTime(shift.shiftStartAt)}–{formatTime(shift.shiftEndAt)} {shift.title}
        </span>
      ))}
      {hasAvailability ? (
        <span className="block text-xs">● {t('scheduleBoard.indicatorAvailability')}</span>
      ) : null}
      {requests.length > 0 ? (
        <span className="block text-xs">
          ↻ {t('scheduleBoard.indicatorRequest')} ({requests.length})
        </span>
      ) : null}
      {conflicts.length > 0 ? (
        <span className="block font-medium text-red-700">
          ⚠ {t('scheduleBoard.indicatorConflict')}
        </span>
      ) : null}
      {shifts.length === 0 && !hasAvailability && requests.length === 0 ? (
        <span className="text-xs text-muted">—</span>
      ) : null}
    </div>
  );
};

const Summary = ({ label, value }: { label: string; value: number }): JSX.Element => (
  <div className="rounded border border-border bg-bg p-3">
    <span className="block text-xs text-muted">{label}</span>
    <strong>{value}</strong>
  </div>
);

const BoardState = ({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}): JSX.Element => (
  <div className="rounded border border-border bg-bg p-5" role="status">
    <h3 className="font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-muted">{message}</p>
    {children}
  </div>
);

const ScheduleSkeleton = (): JSX.Element => {
  const { t } = useTranslation('manager-workspace');
  return (
    <div className="space-y-2" aria-busy="true" aria-label={t('scheduleBoard.loading')}>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded bg-slate-200" />
      ))}
    </div>
  );
};

function handleDialogKeyDown(
  event: KeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null,
  close: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== 'Tab' || !dialog) return;
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((item) => !item.hasAttribute('hidden'));
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function scopeValue(scope: ScopeOption | undefined): string {
  return scope ? `${scope.type}:${scope.id}` : '';
}
function currentMonday(): string {
  const date = new Date();
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}
function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function formatDay(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}
function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(value);
}
function hcmDate(value: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(value);
}
function moveGridFocus(event: KeyboardEvent, row: number, column: number, rowCount: number): void {
  const delta =
    event.key === 'ArrowRight'
      ? [0, 1]
      : event.key === 'ArrowLeft'
        ? [0, -1]
        : event.key === 'ArrowDown'
          ? [1, 0]
          : event.key === 'ArrowUp'
            ? [-1, 0]
            : null;
  if (!delta) return;
  event.preventDefault();
  const nextRow = Math.max(0, Math.min(rowCount - 1, row + delta[0]!));
  const nextColumn = Math.max(0, Math.min(6, column + delta[1]!));
  document.querySelector<HTMLElement>(`[data-week-cell="${nextRow}-${nextColumn}"]`)?.focus();
}
