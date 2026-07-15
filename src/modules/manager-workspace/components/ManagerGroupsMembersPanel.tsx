import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { APP_PATHS } from '@app/router/paths';
import {
  useManagerGroup,
  useManagerGroups,
  useManagerMember,
  useManagerMembers,
  type ManagedGroup,
  type ManagedMember,
  type ManagedScopeType,
  type ManagerWorkspaceContext,
} from '@modules/manager-workspace/api/manager-workspace.api';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@shared/components/primitives';

type PanelMode = 'groups' | 'members';

const isScopeType = (value: string | undefined): value is ManagedScopeType =>
  value === 'ORG_UNIT' || value === 'TALENT_GROUP';

export const ManagerGroupsMembersPanel = ({
  context,
  mode,
}: {
  context: ManagerWorkspaceContext;
  mode: PanelMode;
}): JSX.Element => {
  const { t } = useTranslation(['manager-workspace', 'common']);
  const navigate = useNavigate();
  const params = useParams();
  const [groupSearch, setGroupSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatus, setMemberStatus] = useState<string>();
  const [personKind, setPersonKind] = useState<'INTERNAL' | 'EXTERNAL_ONLY'>();
  const [kpiEligibility, setKpiEligibility] = useState<'ELIGIBLE' | 'INELIGIBLE'>();
  const [scheduleEligibility, setScheduleEligibility] = useState<'ELIGIBLE' | 'INELIGIBLE'>();
  const [scopeTypeFilter, setScopeTypeFilter] = useState<ManagedScopeType | undefined>();
  const [selectedMemberId, setSelectedMemberId] = useState<string>();
  const [groupCursor, setGroupCursor] = useState<string>();
  const [memberCursor, setMemberCursor] = useState<string>();

  const groupsQuery = useManagerGroups(
    context,
    { search: groupSearch || undefined, scopeType: scopeTypeFilter, cursor: groupCursor },
    context.modules.groups.visible,
  );
  const selectedScope = useMemo(() => {
    if (isScopeType(params.scopeType) && params.scopeId) {
      return { scopeType: params.scopeType, scopeId: params.scopeId };
    }
    const first = groupsQuery.data?.items[0];
    return first ? { scopeType: first.scopeType, scopeId: first.scopeId } : undefined;
  }, [groupsQuery.data?.items, params.scopeId, params.scopeType]);
  const membersQuery = useManagerMembers(
    context,
    selectedScope ?? { scopeType: 'ORG_UNIT', scopeId: '' },
    {
      search: memberSearch || undefined,
      operationalStatus: memberStatus,
      personKind,
      kpiEligibility,
      scheduleEligibility,
      cursor: memberCursor,
    },
    mode === 'members' && context.modules.members.visible && Boolean(selectedScope),
  );
  const groupQuery = useManagerGroup(
    context,
    selectedScope ?? { scopeType: 'ORG_UNIT', scopeId: '' },
    Boolean(selectedScope),
  );
  const memberQuery = useManagerMember(
    context,
    selectedScope ?? { scopeType: 'ORG_UNIT', scopeId: '' },
    selectedMemberId,
  );

  useEffect(() => {
    setGroupCursor(undefined);
  }, [groupSearch, scopeTypeFilter]);
  useEffect(() => {
    setMemberCursor(undefined);
    setSelectedMemberId(undefined);
  }, [
    kpiEligibility,
    memberSearch,
    memberStatus,
    personKind,
    scheduleEligibility,
    selectedScope?.scopeId,
    selectedScope?.scopeType,
  ]);

  const openMembers = (group: ManagedGroup): void => {
    navigate(APP_PATHS.managerMembersForGroup(group.scopeType, group.scopeId));
  };
  const openGroup = (group: ManagedGroup): void => {
    navigate(APP_PATHS.managerGroupDetail(group.scopeType, group.scopeId));
  };

  if (!context.modules.groups.visible) {
    return (
      <EmptyState
        title={t('manager-workspace:groupsRead.unavailableTitle')}
        message={t('manager-workspace:groupsRead.unavailableMessage')}
      />
    );
  }

  return (
    <section className="space-y-4" data-testid={`manager-${mode}-read-panel`}>
      <header>
        <h2 className="text-lg font-semibold text-text">
          {t(`manager-workspace:groupsRead.${mode}Title`)}
        </h2>
        <p className="text-sm text-muted">{t('manager-workspace:groupsRead.safeSummary')}</p>
      </header>

      <div className="flex flex-wrap gap-3 rounded border border-border bg-panel p-3">
        <label className="grid gap-1 text-sm text-muted">
          {t('manager-workspace:groupsRead.groupSearch')}
          <input
            className="rounded border border-border bg-bg px-3 py-2 text-text"
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          {t('manager-workspace:groupsRead.scopeType')}
          <select
            className="rounded border border-border bg-bg px-3 py-2 text-text"
            value={scopeTypeFilter ?? ''}
            onChange={(event) =>
              setScopeTypeFilter(
                event.target.value ? (event.target.value as ManagedScopeType) : undefined,
              )
            }
          >
            <option value="">{t('manager-workspace:groupsRead.allScopes')}</option>
            <option value="ORG_UNIT">{t('manager-workspace:groupsRead.orgUnit')}</option>
            <option value="TALENT_GROUP">{t('manager-workspace:groupsRead.talentGroup')}</option>
          </select>
        </label>
      </div>

      {groupsQuery.isLoading ? <LoadingState lines={4} /> : null}
      {groupsQuery.isError ? (
        <ErrorState
          title={t('manager-workspace:groupsRead.loadErrorTitle')}
          message={t('manager-workspace:groupsRead.loadErrorMessage')}
          onRetry={() => void groupsQuery.refetch()}
        />
      ) : null}
      {groupsQuery.data?.items.length === 0 ? (
        <EmptyState
          title={t('manager-workspace:groupsRead.emptyTitle')}
          message={t('manager-workspace:groupsRead.emptyMessage')}
        />
      ) : null}

      {groupsQuery.data?.items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {groupsQuery.data.items.map((group) => (
            <article
              key={`${group.scopeType}:${group.scopeId}`}
              className="rounded border border-border bg-panel p-4"
              data-testid="manager-group-row"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-text">{group.displayName}</h3>
                  <p className="text-sm text-muted">{group.code}</p>
                </div>
                <StatusBadge
                  label={
                    group.scopeType === 'ORG_UNIT'
                      ? t('manager-workspace:groupsRead.orgUnit')
                      : t('manager-workspace:groupsRead.talentGroup')
                  }
                  tone="neutral"
                  uppercase={false}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="secondary" onClick={() => openGroup(group)}>
                  {t('manager-workspace:groupsRead.openGroup')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!group.readiness.memberReadAvailable}
                  onClick={() => openMembers(group)}
                >
                  {t('manager-workspace:groupsRead.openMembers')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {groupsQuery.data?.nextCursor ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setGroupCursor(groupsQuery.data.nextCursor)}
        >
          {t('common:actions.next')}
        </Button>
      ) : null}

      {params.scopeId && groupQuery.isLoading ? <LoadingState lines={2} /> : null}
      {params.scopeId && groupQuery.isError ? (
        <ErrorState
          title={t('manager-workspace:groupsRead.groupDetailErrorTitle')}
          message={t('manager-workspace:groupsRead.groupDetailErrorMessage')}
          onRetry={() => void groupQuery.refetch()}
        />
      ) : null}
      {params.scopeId && groupQuery.data ? (
        <aside
          className="rounded border border-border bg-panel p-4"
          data-testid="manager-group-detail"
        >
          <h3 className="font-semibold text-text">{groupQuery.data.displayName}</h3>
          <p className="text-sm text-muted">{groupQuery.data.code}</p>
          <p className="mt-2 text-sm text-muted">
            {t('manager-workspace:groupsRead.safeGroupDetail')}
          </p>
        </aside>
      ) : null}

      {mode === 'members' && selectedScope ? (
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap gap-3">
            <label className="grid max-w-md gap-1 text-sm text-muted">
              {t('manager-workspace:groupsRead.memberSearch')}
              <input
                className="rounded border border-border bg-bg px-3 py-2 text-text"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
              />
            </label>
            <label className="grid max-w-md gap-1 text-sm text-muted">
              {t('manager-workspace:groupsRead.statusFilter')}
              <select
                className="rounded border border-border bg-bg px-3 py-2 text-text"
                value={memberStatus ?? ''}
                onChange={(event) => setMemberStatus(event.target.value || undefined)}
              >
                <option value="">{t('manager-workspace:groupsRead.allStatuses')}</option>
                <option value="ACTIVE">{t('manager-workspace:employmentStatus.ACTIVE')}</option>
                <option value="ON_LEAVE">{t('manager-workspace:employmentStatus.ON_LEAVE')}</option>
                <option value="SUSPENDED">
                  {t('manager-workspace:employmentStatus.SUSPENDED')}
                </option>
              </select>
            </label>
            <label className="grid max-w-md gap-1 text-sm text-muted">
              {t('manager-workspace:groupsRead.personKindFilter')}
              <select
                className="rounded border border-border bg-bg px-3 py-2 text-text"
                value={personKind ?? ''}
                onChange={(event) =>
                  setPersonKind(
                    (event.target.value || undefined) as 'INTERNAL' | 'EXTERNAL_ONLY' | undefined,
                  )
                }
              >
                <option value="">{t('manager-workspace:groupsRead.allKinds')}</option>
                <option value="INTERNAL">{t('manager-workspace:groupsRead.internalKind')}</option>
                <option value="EXTERNAL_ONLY">
                  {t('manager-workspace:groupsRead.externalKind')}
                </option>
              </select>
            </label>
            <ReadinessFilter
              label={t('manager-workspace:groupsRead.kpiEligibilityFilter')}
              value={kpiEligibility}
              onChange={setKpiEligibility}
              t={t}
            />
            <ReadinessFilter
              label={t('manager-workspace:groupsRead.scheduleEligibilityFilter')}
              value={scheduleEligibility}
              onChange={setScheduleEligibility}
              t={t}
            />
          </div>
          {membersQuery.isLoading ? <LoadingState lines={5} /> : null}
          {membersQuery.isError ? (
            <ErrorState
              title={t('manager-workspace:groupsRead.memberLoadErrorTitle')}
              message={t('manager-workspace:groupsRead.memberLoadErrorMessage')}
              onRetry={() => void membersQuery.refetch()}
            />
          ) : null}
          {membersQuery.data?.items.length === 0 ? (
            <EmptyState
              title={t('manager-workspace:groupsRead.memberEmptyTitle')}
              message={t('manager-workspace:groupsRead.memberEmptyMessage')}
            />
          ) : null}
          {membersQuery.data?.items.length ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/10 text-left text-muted">
                  <tr>
                    <th className="px-3 py-2">{t('manager-workspace:groupsRead.member')}</th>
                    <th className="px-3 py-2">{t('manager-workspace:groupsRead.kind')}</th>
                    <th className="px-3 py-2">{t('manager-workspace:groupsRead.readiness')}</th>
                    <th className="px-3 py-2">{t('manager-workspace:groupsRead.detail')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-panel">
                  {membersQuery.data.items.map((member) => (
                    <MemberRow
                      key={
                        member.operationalMemberId ?? member.trace.talentId ?? member.displayName
                      }
                      member={member}
                      onOpen={() => setSelectedMemberId(member.operationalMemberId ?? undefined)}
                      t={t}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {membersQuery.data?.nextCursor ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMemberCursor(membersQuery.data.nextCursor)}
            >
              {t('common:actions.next')}
            </Button>
          ) : null}
          {memberQuery.isLoading ? <LoadingState lines={3} /> : null}
          {memberQuery.isError ? (
            <ErrorState
              title={t('manager-workspace:groupsRead.memberDetailErrorTitle')}
              message={t('manager-workspace:groupsRead.memberDetailErrorMessage')}
              onRetry={() => void memberQuery.refetch()}
            />
          ) : null}
          {memberQuery.data ? (
            <MemberDetail
              member={memberQuery.data}
              onClose={() => setSelectedMemberId(undefined)}
              t={t}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

const ReadinessFilter = ({
  label,
  value,
  onChange,
  t,
}: {
  label: string;
  value: 'ELIGIBLE' | 'INELIGIBLE' | undefined;
  onChange: (value: 'ELIGIBLE' | 'INELIGIBLE' | undefined) => void;
  t: TFunction;
}): JSX.Element => (
  <label className="grid max-w-md gap-1 text-sm text-muted">
    {label}
    <select
      className="rounded border border-border bg-bg px-3 py-2 text-text"
      value={value ?? ''}
      onChange={(event) =>
        onChange((event.target.value || undefined) as 'ELIGIBLE' | 'INELIGIBLE' | undefined)
      }
    >
      <option value="">{t('manager-workspace:groupsRead.allEligibility')}</option>
      <option value="ELIGIBLE">{t('manager-workspace:groupsRead.eligible')}</option>
      <option value="INELIGIBLE">{t('manager-workspace:groupsRead.ineligible')}</option>
    </select>
  </label>
);

const MemberRow = ({
  member,
  onOpen,
  t,
}: {
  member: ManagedMember;
  onOpen: () => void;
  t: TFunction<['manager-workspace', 'common']>;
}): JSX.Element => (
  <tr data-testid="manager-member-row">
    <td className="px-3 py-2">
      <div className="font-medium text-text">{member.displayName}</div>
      <div className="text-xs text-muted">{member.employeeCode ?? member.trace.talentCode}</div>
    </td>
    <td className="px-3 py-2">
      {member.personKind === 'INTERNAL'
        ? t('manager-workspace:groupsRead.internal')
        : t('manager-workspace:groupsRead.externalOnly')}
    </td>
    <td className="px-3 py-2">
      {member.eligibility.mutation
        ? t('manager-workspace:groupsRead.ready')
        : t('manager-workspace:groupsRead.readOnlyIneligible')}
    </td>
    <td className="px-3 py-2">
      <Button
        type="button"
        variant="secondary"
        disabled={!member.operationalMemberId}
        onClick={onOpen}
      >
        {t('manager-workspace:groupsRead.openDetail')}
      </Button>
    </td>
  </tr>
);

const MemberDetail = ({
  member,
  onClose,
  t,
}: {
  member: ManagedMember;
  onClose: () => void;
  t: TFunction<['manager-workspace', 'common']>;
}): JSX.Element => (
  <aside className="rounded border border-border bg-panel p-4" aria-live="polite">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-text">{member.displayName}</h3>
        <p className="text-sm text-muted">{member.employeeCode}</p>
      </div>
      <Button type="button" variant="secondary" onClick={onClose}>
        {t('common:actions.close')}
      </Button>
    </div>
    <p className="mt-3 text-sm text-muted">{t('manager-workspace:groupsRead.safeDetail')}</p>
  </aside>
);
