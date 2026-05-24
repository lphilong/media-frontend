import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MonthlyRosterExceptionSurface } from '@modules/work-schedule/forms/monthly-roster-exception-forms';
import type {
  MonthlyRosterRecord,
  RosterExceptionPayload,
  RosterExceptionRecord,
} from '@modules/work-schedule/types/work-schedule.types';
import type { NormalizedApiError } from '@shared/api';
import { MetadataSection } from '@shared/components/primitives';
import {
  formatBusinessTimestamp,
  formatCreatedDate,
  readReferenceDisplay,
} from '@shared/formatting/formatters';

type ExceptionSurfaceState =
  | { mode: 'add'; exception?: undefined }
  | { mode: 'edit'; exception: RosterExceptionRecord }
  | null;

type MonthlyRosterExceptionEditorProps = {
  roster: MonthlyRosterRecord;
  apiError?: NormalizedApiError | null;
  isAddPending?: boolean;
  isUpdatePending?: boolean;
  isRemovePending?: boolean;
  removingExceptionId?: string;
  canMutate?: boolean;
  onAdd: (payload: RosterExceptionPayload) => Promise<void> | void;
  onUpdate: (
    exception: RosterExceptionRecord,
    payload: RosterExceptionPayload,
  ) => Promise<void> | void;
  onRemove: (exception: RosterExceptionRecord) => Promise<void> | void;
  onClearError?: () => void;
};

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const formatNullableTimestamp = (value?: string | number | null): string =>
  value ? formatBusinessTimestamp(value) : '-';

const summarizeException = (
  t: (key: string) => string,
  exception: RosterExceptionRecord,
): string => {
  if (exception.exceptionType === 'WORKING_TO_OFF') {
    return t('work-schedule:monthlyRosters.exceptions.summary.workingToOff');
  }

  if (exception.exceptionType === 'CHANGE_TIME') {
    return t('work-schedule:monthlyRosters.exceptions.summary.changeTime').replace(
      '{{startLocalTime}}',
      exception.startLocalTime ?? '-',
    );
  }

  return t('work-schedule:monthlyRosters.exceptions.summary.addSpecialShift')
    .replace('{{startLocalTime}}', exception.startLocalTime ?? '-')
    .replace('{{workingMinutes}}', String(exception.workingMinutes ?? '-'));
};

export const MonthlyRosterExceptionEditor = ({
  roster,
  apiError,
  isAddPending = false,
  isUpdatePending = false,
  isRemovePending = false,
  removingExceptionId,
  canMutate = false,
  onAdd,
  onUpdate,
  onRemove,
  onClearError,
}: MonthlyRosterExceptionEditorProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common']);
  const [surface, setSurface] = useState<ExceptionSurfaceState>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const isDraft = roster.status === 'DRAFT';
  const canMutateDraft = isDraft && canMutate;
  const activeExceptions = useMemo(
    () => (roster.exceptions ?? []).filter((exception) => exception.status === 'ACTIVE'),
    [roster.exceptions],
  );
  const visibleExceptions = useMemo(() => {
    const exceptions = roster.exceptions ?? [];
    return showRemoved ? exceptions : activeExceptions;
  }, [activeExceptions, roster.exceptions, showRemoved]);
  const closeSurface = (): void => {
    onClearError?.();
    setSurface(null);
  };

  return (
    <MetadataSection title={t('work-schedule:monthlyRosters.exceptions.title')}>
      <div className="space-y-4">
        <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {isDraft
            ? t('work-schedule:monthlyRosters.exceptions.copy.draftOnly')
            : t('work-schedule:monthlyRosters.exceptions.copy.readOnly')}
        </div>
        <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('work-schedule:monthlyRosters.exceptions.copy.previewDeferred')}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(event) => setShowRemoved(event.target.checked)}
            />
            {t('work-schedule:monthlyRosters.exceptions.actions.showRemoved')}
          </label>
          {canMutateDraft ? (
            <button
              type="button"
              className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
              onClick={() => {
                onClearError?.();
                setSurface({ mode: 'add' });
              }}
            >
              {t('work-schedule:monthlyRosters.exceptions.actions.add')}
            </button>
          ) : null}
        </div>

        {surface ? (
          <MonthlyRosterExceptionSurface
            roster={roster}
            initialValues={surface.mode === 'edit' ? surface.exception : undefined}
            apiError={apiError}
            onCancel={closeSurface}
            isPending={surface.mode === 'add' ? isAddPending : isUpdatePending}
            onSubmit={async (payload) => {
              try {
                if (surface.mode === 'add') {
                  await onAdd(payload);
                } else {
                  await onUpdate(surface.exception, payload);
                }
                closeSurface();
              } catch {
                // The page-level mutation handler owns normalized backend errors.
              }
            }}
          />
        ) : null}

        {visibleExceptions.length === 0 ? (
          <div className="rounded border border-border bg-panel px-3 py-6 text-center text-sm text-muted">
            {showRemoved
              ? t('work-schedule:monthlyRosters.exceptions.states.emptyAll')
              : t('work-schedule:monthlyRosters.exceptions.states.emptyActive')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <caption className="sr-only">
                {t('work-schedule:monthlyRosters.exceptions.table.caption')}
              </caption>
              <thead className="bg-bg text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.employee')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.date')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.type')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.status')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.summary')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.reason')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.createdAt')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.updatedAt')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.removedAt')}
                  </th>
                  <th className="px-3 py-2">
                    {t('work-schedule:monthlyRosters.exceptions.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {visibleExceptions.map((exception) => {
                  const editable = canMutateDraft && exception.status === 'ACTIVE';
                  const removePending =
                    isRemovePending && removingExceptionId === exception.rosterExceptionId;

                  return (
                    <tr
                      key={exception.rosterExceptionId}
                      className={exception.status === 'REMOVED' ? 'text-muted' : undefined}
                    >
                      <td className="px-3 py-2">
                        {readReferenceDisplay(
                          exception.subjectEmploymentProfileRef,
                          exception.subjectEmploymentProfileId,
                        )}
                      </td>
                      <td className="px-3 py-2">{exception.exceptionDate}</td>
                      <td className="px-3 py-2">
                        {t(
                          `work-schedule:monthlyRosters.exceptions.types.${exception.exceptionType}`,
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {t(`work-schedule:monthlyRosters.exceptions.statuses.${exception.status}`)}
                      </td>
                      <td className="px-3 py-2">{summarizeException(t, exception)}</td>
                      <td className="px-3 py-2">
                        {formatNullable(exception.reason ?? exception.sourceNote)}
                      </td>
                      <td className="px-3 py-2">{formatCreatedDate(exception.createdAt)}</td>
                      <td className="px-3 py-2">{formatBusinessTimestamp(exception.updatedAt)}</td>
                      <td className="px-3 py-2">{formatNullableTimestamp(exception.removedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {canMutateDraft ? (
                            <>
                              <button
                                type="button"
                                disabled={!editable}
                                onClick={() => {
                                  onClearError?.();
                                  setSurface({ mode: 'edit', exception });
                                }}
                                className="rounded border border-border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {t('work-schedule:monthlyRosters.exceptions.actions.edit')}
                              </button>
                              <button
                                type="button"
                                disabled={!editable || removePending}
                                onClick={() => void onRemove(exception)}
                                className="rounded border border-danger px-2 py-1 text-xs text-danger disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {removePending
                                  ? t('work-schedule:monthlyRosters.exceptions.actions.removing')
                                  : t('work-schedule:monthlyRosters.exceptions.actions.remove')}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MetadataSection>
  );
};
