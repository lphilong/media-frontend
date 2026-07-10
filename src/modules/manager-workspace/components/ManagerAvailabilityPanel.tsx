import { Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useCancelManagerAvailabilityBatchMutation,
  useCancelManagerAvailabilityLineMutation,
  useManagerAvailabilityBatchDetail,
  useManagerAvailabilityBatches,
  useManagerAvailabilityTargetMembers,
  useSubmitManagerAvailabilityBatchMutation,
  type ManagerSubmitAvailabilityBatchLinePayload,
  type ManagerWorkScheduleAvailabilityTaxonomyCode,
  type ManagerWorkScheduleAvailabilityType,
  type ManagerWorkspaceContext,
} from '@modules/manager-workspace/api/manager-workspace.api';
import { WorkScheduleDeadlineCue } from '@modules/work-schedule';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';

type TargetOption = {
  key: string;
  label: string;
  targetType: 'ORG_UNIT' | 'TALENT_GROUP';
  targetId: string;
  targetOrgUnitId?: string | null;
  targetTalentGroupId?: string | null;
};
type DraftAvailabilityLine = ManagerSubmitAvailabilityBatchLinePayload & {
  localId: string;
};

const availabilityTypeOptions: readonly ManagerWorkScheduleAvailabilityType[] = [
  'UNAVAILABLE_FULL_DAY',
  'PREFERRED_TIME',
  'OTHER_AVAILABILITY_NOTE',
];
const taxonomyOptions: readonly ManagerWorkScheduleAvailabilityTaxonomyCode[] = [
  'SICK_LEAVE',
  'AUTHORIZED_LEAVE',
  'SHIFT_CHANGE',
  'OTHER',
];

const todayForMonth = (periodMonth: string): string => `${periodMonth}-01`;

const createDraftLine = (
  memberEmploymentProfileId: string,
  periodMonth: string,
): DraftAvailabilityLine => ({
  localId: `availability-line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  memberEmploymentProfileId,
  availabilityType: 'UNAVAILABLE_FULL_DAY',
  taxonomyCode: 'AUTHORIZED_LEAVE',
  availabilityDate: todayForMonth(periodMonth),
  dateRangeStart: todayForMonth(periodMonth),
  dateRangeEnd: todayForMonth(periodMonth),
  preferredStartLocalTime: null,
  preferredEndLocalTime: null,
  reason: '',
});

const compactLabel = (displayName: string, employeeCode?: string): string =>
  employeeCode ? `${displayName} (${employeeCode})` : displayName;

const badgeClass = (value: string): string => {
  if (value === 'APPROVED' || value === 'APPLIED') {
    return 'border-success text-success';
  }
  if (value === 'REJECTED' || value === 'CANCELLED') {
    return 'border-danger text-danger';
  }
  if (value === 'ADVISORY_ONLY') {
    return 'border-warning text-warning';
  }
  return 'border-border text-muted';
};

export const ManagerAvailabilityPanel = ({
  context,
  allowedMonths,
}: {
  context: ManagerWorkspaceContext;
  allowedMonths: string[];
}): JSX.Element => {
  const { t } = useTranslation(['manager-workspace']);
  const [periodMonth, setPeriodMonth] = useState(allowedMonths[0] ?? '');
  const [batchNote, setBatchNote] = useState('');
  const [draftLines, setDraftLines] = useState<DraftAvailabilityLine[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>();
  const [cancelReason, setCancelReason] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const orgUnitOptions = context.scopes.orgUnits.map((scope) => ({
      key: `ORG_UNIT:${scope.orgUnitId}`,
      label: scope.code ? `${scope.name} (${scope.code})` : scope.name,
      targetType: 'ORG_UNIT' as const,
      targetId: scope.orgUnitId,
      targetOrgUnitId: scope.orgUnitId,
      targetTalentGroupId: null,
    }));
    const talentGroupOptions = context.scopes.talentGroups.map((scope) => ({
      key: `TALENT_GROUP:${scope.talentGroupId}`,
      label: scope.code ? `${scope.name} (${scope.code})` : scope.name,
      targetType: 'TALENT_GROUP' as const,
      targetId: scope.talentGroupId,
      targetOrgUnitId: null,
      targetTalentGroupId: scope.talentGroupId,
    }));
    return [...orgUnitOptions, ...talentGroupOptions];
  }, [context.scopes.orgUnits, context.scopes.talentGroups]);
  const [targetKey, setTargetKey] = useState(() => targetOptions[0]?.key ?? '');
  const selectedTarget =
    targetOptions.find((option) => option.key === targetKey) ?? targetOptions[0];
  const membersQuery = useManagerAvailabilityTargetMembers(
    selectedTarget?.targetType,
    selectedTarget?.targetId,
    context.modules.workShifts.visible,
  );
  const managedMembers = useMemo(
    () => membersQuery.data?.members ?? [],
    [membersQuery.data?.members],
  );
  const managedMemberIds = useMemo(
    () => new Set(managedMembers.map((member) => member.employmentProfileId)),
    [managedMembers],
  );
  const batchesQuery = useManagerAvailabilityBatches(
    { periodMonth: periodMonth || undefined },
    context.modules.workShifts.visible,
  );
  const selectedBatchIdOrFirst = selectedBatchId ?? batchesQuery.data?.items[0]?.id;
  const detailQuery = useManagerAvailabilityBatchDetail(
    selectedBatchIdOrFirst,
    context.modules.workShifts.visible,
  );
  const submitMutation = useSubmitManagerAvailabilityBatchMutation();
  const cancelBatchMutation = useCancelManagerAvailabilityBatchMutation();
  const cancelLineMutation = useCancelManagerAvailabilityLineMutation();

  useEffect(() => {
    setDraftLines([]);
    setValidationMessage(null);
  }, [targetKey]);

  const updateLine = (localId: string, patch: Partial<DraftAvailabilityLine>): void => {
    setDraftLines((current) =>
      current.map((line) => {
        if (line.localId !== localId) {
          return line;
        }
        const next = { ...line, ...patch };
        if (patch.availabilityType && patch.availabilityType !== 'PREFERRED_TIME') {
          next.preferredStartLocalTime = null;
          next.preferredEndLocalTime = null;
        }
        return next;
      }),
    );
  };

  const addLine = (): void => {
    const firstMember = managedMembers[0];
    if (membersQuery.isError || !firstMember || draftLines.length >= 50) {
      setValidationMessage(t('manager-workspace:availability.validation.maxLines'));
      return;
    }
    setDraftLines((current) => [
      ...current,
      createDraftLine(firstMember.employmentProfileId, periodMonth),
    ]);
    setValidationMessage(null);
  };

  const validateDraft = (): DraftAvailabilityLine[] | null => {
    if (!selectedTarget) {
      setValidationMessage(t('manager-workspace:availability.validation.targetRequired'));
      return null;
    }
    if (draftLines.length === 0) {
      setValidationMessage(t('manager-workspace:availability.validation.lineRequired'));
      return null;
    }
    for (const line of draftLines) {
      if (!line.memberEmploymentProfileId) {
        setValidationMessage(t('manager-workspace:availability.validation.memberRequired'));
        return null;
      }
      if (!managedMemberIds.has(line.memberEmploymentProfileId)) {
        setValidationMessage(t('manager-workspace:availability.validation.memberTargetMismatch'));
        return null;
      }
      if (!line.reason.trim()) {
        setValidationMessage(t('manager-workspace:availability.validation.reasonRequired'));
        return null;
      }
      if (!line.dateRangeStart || !line.dateRangeEnd) {
        setValidationMessage(t('manager-workspace:availability.validation.dateRequired'));
        return null;
      }
      if (line.dateRangeStart > line.dateRangeEnd) {
        setValidationMessage(t('manager-workspace:availability.validation.dateOrder'));
        return null;
      }
      if (
        line.availabilityType === 'PREFERRED_TIME' &&
        (!line.preferredStartLocalTime ||
          !line.preferredEndLocalTime ||
          line.preferredStartLocalTime >= line.preferredEndLocalTime)
      ) {
        setValidationMessage(t('manager-workspace:availability.validation.preferredTime'));
        return null;
      }
    }
    setValidationMessage(null);
    return draftLines;
  };

  const submitDraft = async (): Promise<void> => {
    const validLines = validateDraft();
    if (!validLines || !selectedTarget) {
      return;
    }
    const batch = await submitMutation.mutateAsync({
      payload: {
        periodMonth,
        targetType: selectedTarget.targetType,
        targetMode: 'EXACT_ONLY',
        targetOrgUnitId: selectedTarget.targetOrgUnitId,
        targetTalentGroupId: selectedTarget.targetTalentGroupId,
        clientToken: `manager-availability-ui-${Date.now()}`,
        note: batchNote,
        lines: validLines.map((line) => ({
          memberEmploymentProfileId: line.memberEmploymentProfileId,
          availabilityType: line.availabilityType,
          taxonomyCode: line.taxonomyCode,
          availabilityDate: line.dateRangeStart === line.dateRangeEnd ? line.dateRangeStart : null,
          dateRangeStart: line.dateRangeStart,
          dateRangeEnd: line.dateRangeEnd,
          preferredStartLocalTime:
            line.availabilityType === 'PREFERRED_TIME' ? line.preferredStartLocalTime : null,
          preferredEndLocalTime:
            line.availabilityType === 'PREFERRED_TIME' ? line.preferredEndLocalTime : null,
          reason: line.reason,
        })),
      },
    });
    setSelectedBatchId(batch.id);
    setDraftLines([]);
    setBatchNote('');
  };

  const cancelSelectedBatch = async (): Promise<void> => {
    const batchId = detailQuery.data?.id;
    if (!batchId || !cancelReason.trim()) {
      setValidationMessage(t('manager-workspace:availability.validation.cancelReasonRequired'));
      return;
    }
    await cancelBatchMutation.mutateAsync({
      batchId,
      payload: { cancellationReason: cancelReason },
    });
    setCancelReason('');
    setValidationMessage(null);
  };

  const cancelSelectedLine = async (lineId: string): Promise<void> => {
    const batchId = detailQuery.data?.id;
    if (!batchId || !cancelReason.trim()) {
      setValidationMessage(t('manager-workspace:availability.validation.cancelReasonRequired'));
      return;
    }
    await cancelLineMutation.mutateAsync({
      batchId,
      lineId,
      payload: { cancellationReason: cancelReason },
    });
    setCancelReason('');
    setValidationMessage(null);
  };

  return (
    <div className="space-y-4" data-testid="manager-work-availability">
      <div className="rounded border border-border bg-bg p-3 text-sm text-muted">
        <p>{t('manager-workspace:availability.copy.planning')}</p>
        <p>{t('manager-workspace:availability.copy.noAttendance')}</p>
        <p>{t('manager-workspace:availability.copy.noAutoApply')}</p>
        <p>{t('manager-workspace:availability.copy.otherAdvisory')}</p>
        <p>{t('manager-workspace:availability.copy.independentOfShifts')}</p>
      </div>

      <WorkScheduleDeadlineCue targetMonth={periodMonth} cueType="AVAILABILITY_CUTOFF" />

      <label className="block rounded border border-border bg-bg p-3 text-sm font-medium text-text">
        {t('manager-workspace:availability.fields.target')}
        <select
          className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
          value={targetKey}
          onChange={(event) => setTargetKey(event.target.value)}
        >
          {targetOptions.map((target) => (
            <option key={target.key} value={target.key}>
              {target.label}
            </option>
          ))}
        </select>
      </label>

      {membersQuery.isLoading ? (
        <div className="rounded border border-border bg-bg px-3 py-6 text-center text-sm text-muted">
          {t('manager-workspace:availability.states.loadingMembers')}
        </div>
      ) : membersQuery.isError ? (
        <div className="rounded border border-danger bg-danger/10 px-3 py-6 text-center text-sm text-danger">
          {t('manager-workspace:availability.states.memberLoadError')}
        </div>
      ) : managedMembers.length === 0 ? (
        <div className="rounded border border-border bg-bg px-3 py-6 text-center text-sm text-muted">
          {t('manager-workspace:availability.states.emptyMembersMessage')}
        </div>
      ) : (
        <div className="space-y-4 rounded border border-border bg-bg p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-text">
              {t('manager-workspace:availability.fields.periodMonth')}
              <select
                className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
                value={periodMonth}
                onChange={(event) => {
                  setPeriodMonth(event.target.value);
                  setDraftLines((current) =>
                    current.map((line) => ({
                      ...line,
                      availabilityDate: todayForMonth(event.target.value),
                      dateRangeStart: todayForMonth(event.target.value),
                      dateRangeEnd: todayForMonth(event.target.value),
                    })),
                  );
                }}
              >
                {allowedMonths.map((allowedMonth) => (
                  <option key={allowedMonth} value={allowedMonth}>
                    {allowedMonth}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-text">
              {t('manager-workspace:availability.fields.note')}
              <input
                className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
                value={batchNote}
                onChange={(event) => setBatchNote(event.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-medium"
              onClick={addLine}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('manager-workspace:availability.actions.addLine')}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={draftLines.length === 0 || submitMutation.isPending}
              onClick={() => void submitDraft()}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {t('manager-workspace:availability.actions.submit')}
            </button>
          </div>

          {validationMessage ? (
            <div className="rounded border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
              {validationMessage}
            </div>
          ) : null}

          {draftLines.map((line, index) => (
            <div key={line.localId} className="space-y-3 rounded border border-border bg-panel p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-text">
                  {t('manager-workspace:availability.lineTitle').replace(
                    '{{index}}',
                    String(index + 1),
                  )}
                </h3>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-danger px-2 py-1 text-xs text-danger"
                  onClick={() =>
                    setDraftLines((current) =>
                      current.filter((item) => item.localId !== line.localId),
                    )
                  }
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  {t('manager-workspace:availability.actions.removeLine')}
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-medium text-text">
                  {t('manager-workspace:availability.fields.member')}
                  <select
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                    value={line.memberEmploymentProfileId}
                    onChange={(event) =>
                      updateLine(line.localId, { memberEmploymentProfileId: event.target.value })
                    }
                  >
                    {managedMembers.map((member) => (
                      <option key={member.employmentProfileId} value={member.employmentProfileId}>
                        {compactLabel(member.displayName, member.employeeCode)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-text">
                  {t('manager-workspace:availability.fields.availabilityType')}
                  <select
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                    value={line.availabilityType}
                    onChange={(event) =>
                      updateLine(line.localId, {
                        availabilityType: event.target.value as ManagerWorkScheduleAvailabilityType,
                      })
                    }
                  >
                    {availabilityTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {t(`manager-workspace:availability.types.${type}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-text">
                  {t('manager-workspace:availability.fields.taxonomyCode')}
                  <select
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                    value={line.taxonomyCode}
                    onChange={(event) =>
                      updateLine(line.localId, {
                        taxonomyCode: event.target
                          .value as ManagerWorkScheduleAvailabilityTaxonomyCode,
                      })
                    }
                  >
                    {taxonomyOptions.map((code) => (
                      <option key={code} value={code}>
                        {t(`manager-workspace:availability.taxonomy.${code}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-text">
                  {t('manager-workspace:availability.fields.reason')}
                  <input
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                    value={line.reason}
                    onChange={(event) => updateLine(line.localId, { reason: event.target.value })}
                  />
                </label>
                <label className="text-sm font-medium text-text">
                  {t('manager-workspace:availability.fields.dateRangeStart')}
                  <input
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                    type="date"
                    value={line.dateRangeStart ?? ''}
                    onChange={(event) =>
                      updateLine(line.localId, {
                        dateRangeStart: event.target.value,
                        availabilityDate:
                          event.target.value === line.dateRangeEnd ? event.target.value : null,
                      })
                    }
                  />
                </label>
                <label className="text-sm font-medium text-text">
                  {t('manager-workspace:availability.fields.dateRangeEnd')}
                  <input
                    className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                    type="date"
                    value={line.dateRangeEnd ?? ''}
                    onChange={(event) =>
                      updateLine(line.localId, {
                        dateRangeEnd: event.target.value,
                        availabilityDate:
                          event.target.value === line.dateRangeStart ? event.target.value : null,
                      })
                    }
                  />
                </label>
                {line.availabilityType === 'PREFERRED_TIME' ? (
                  <>
                    <label className="text-sm font-medium text-text">
                      {t('manager-workspace:availability.fields.preferredStart')}
                      <input
                        className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                        type="time"
                        value={line.preferredStartLocalTime ?? ''}
                        onChange={(event) =>
                          updateLine(line.localId, {
                            preferredStartLocalTime: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium text-text">
                      {t('manager-workspace:availability.fields.preferredEnd')}
                      <input
                        className="mt-1 w-full rounded border border-border bg-bg px-3 py-2"
                        type="time"
                        value={line.preferredEndLocalTime ?? ''}
                        onChange={(event) =>
                          updateLine(line.localId, { preferredEndLocalTime: event.target.value })
                        }
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded border border-border bg-bg">
          <div className="border-b border-border px-3 py-2 text-sm font-semibold text-text">
            {t('manager-workspace:availability.batches.title')}
          </div>
          {batchesQuery.isLoading ? (
            <div className="px-3 py-6 text-sm text-muted">
              {t('manager-workspace:availability.states.loading')}
            </div>
          ) : null}
          {(batchesQuery.data?.items ?? []).map((batch) => (
            <button
              key={batch.id}
              type="button"
              className={`block w-full border-b border-border px-3 py-3 text-left text-sm hover:bg-panel ${
                selectedBatchIdOrFirst === batch.id ? 'bg-panel' : ''
              }`}
              onClick={() => setSelectedBatchId(batch.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-text">{batch.availabilityBatchCode}</span>
                <span className={`rounded border px-2 py-0.5 text-xs ${badgeClass(batch.status)}`}>
                  {batch.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">
                {batch.periodMonth} - {batch.lineCounts.total}{' '}
                {t('manager-workspace:availability.batches.lines')}
              </div>
              {batch.lineCounts.pending > 0 || batch.lineCounts.approved > 0 ? (
                <div className="mt-1 text-xs text-warning">
                  {t('manager-workspace:availability.batches.planningAttention')}
                </div>
              ) : null}
            </button>
          ))}
          {!batchesQuery.isLoading && (batchesQuery.data?.items ?? []).length === 0 ? (
            <div className="px-3 py-6 text-sm text-muted">
              {t('manager-workspace:availability.states.emptyBatches')}
            </div>
          ) : null}
        </div>

        <div className="rounded border border-border bg-bg p-3">
          {detailQuery.data ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text">
                    {detailQuery.data.availabilityBatchCode}
                  </h3>
                  <p className="text-xs text-muted">
                    {formatBusinessTimestamp(detailQuery.data.submittedAt)}
                  </p>
                </div>
                <span
                  className={`rounded border px-2 py-1 text-xs ${badgeClass(detailQuery.data.status)}`}
                >
                  {detailQuery.data.status}
                </span>
              </div>
              <label className="block text-sm font-medium text-text">
                {t('manager-workspace:availability.fields.cancelReason')}
                <input
                  className="mt-1 w-full rounded border border-border bg-panel px-3 py-2"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="rounded border border-danger px-3 py-2 text-sm font-medium text-danger disabled:opacity-50"
                disabled={detailQuery.data.status !== 'PENDING' || cancelBatchMutation.isPending}
                onClick={() => void cancelSelectedBatch()}
              >
                {t('manager-workspace:availability.actions.cancelBatch')}
              </button>
              <div className="overflow-x-auto rounded border border-border">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="bg-panel text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">
                        {t('manager-workspace:availability.table.member')}
                      </th>
                      <th className="px-3 py-2">
                        {t('manager-workspace:availability.table.type')}
                      </th>
                      <th className="px-3 py-2">
                        {t('manager-workspace:availability.table.date')}
                      </th>
                      <th className="px-3 py-2">
                        {t('manager-workspace:availability.table.status')}
                      </th>
                      <th className="px-3 py-2">
                        {t('manager-workspace:availability.table.applyStatus')}
                      </th>
                      <th className="px-3 py-2">
                        {t('manager-workspace:availability.table.policy')}
                      </th>
                      <th className="px-3 py-2">
                        {t('manager-workspace:availability.table.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-bg">
                    {detailQuery.data.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2">{line.member.displayName}</td>
                        <td className="px-3 py-2">
                          <div>{line.availabilityType}</div>
                          <div className="text-xs text-muted">{line.taxonomyCode}</div>
                        </td>
                        <td className="px-3 py-2">
                          {line.dateRangeStart ?? line.availabilityDate} -{' '}
                          {line.dateRangeEnd ?? line.availabilityDate}
                          {line.preferredStartLocalTime ? (
                            <div className="text-xs text-muted">
                              {line.preferredStartLocalTime} - {line.preferredEndLocalTime}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded border px-2 py-0.5 text-xs ${badgeClass(line.status)}`}
                          >
                            {line.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded border px-2 py-0.5 text-xs ${badgeClass(line.applyStatus)}`}
                          >
                            {line.applyStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2">{line.policyEvaluationStatus}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="rounded border border-danger px-2 py-1 text-xs text-danger disabled:opacity-50"
                            disabled={line.status !== 'PENDING' || cancelLineMutation.isPending}
                            onClick={() => void cancelSelectedLine(line.id)}
                          >
                            {t('manager-workspace:availability.actions.cancelLine')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted">
              {t('manager-workspace:availability.states.selectBatch')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
