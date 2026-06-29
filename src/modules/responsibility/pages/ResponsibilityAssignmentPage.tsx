import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';

import { APP_PATHS } from '@app/router/paths';
import {
  useCreateResponsibilityMutation,
  useResponsibilities,
  useRevokeResponsibilityMutation,
} from '@modules/responsibility/hooks/use-responsibility';
import type {
  CreateResponsibilityPayload,
  ResponsibilityAssignment,
  ResponsibilityListQuery,
  ResponsibilitySubjectType,
  ResponsibilityType,
} from '@modules/responsibility/types/responsibility.types';
import type { NormalizedApiError } from '@shared/api';
import {
  canShowAction,
  PERMISSIONS,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  AdminTableShell,
  EmptyState,
  ErrorState,
  LoadingState,
  ReferenceLink,
  StatusBadge,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import { AsyncReferencePicker } from '@shared/components/reference';
import {
  loadEmploymentProfileReferenceOptions,
  loadOrgUnitReferenceOptions,
  loadTalentGroupReferenceOptions,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import { ModuleListScreenShell } from '@shared/modules';
import { formatVietnamTimestamp, readReferenceDisplay } from '@shared/formatting/formatters';

const subjectTypes: ResponsibilitySubjectType[] = [
  'TALENT_GROUP',
  'ORG_UNIT',
  'TALENT',
  'EMPLOYMENT_PROFILE',
];

const responsibilityTypeBySubjectType: Record<ResponsibilitySubjectType, ResponsibilityType> = {
  TALENT_GROUP: 'TALENT_GROUP_MANAGER',
  ORG_UNIT: 'ORG_UNIT_MANAGER',
  TALENT: 'TALENT_DIRECT_MANAGER',
  EMPLOYMENT_PROFILE: 'EMPLOYMENT_REPORTING_MANAGER',
};

const subjectPathByType: Record<ResponsibilitySubjectType, (id: string) => string> = {
  TALENT_GROUP: APP_PATHS.talentGroupDetail,
  ORG_UNIT: APP_PATHS.orgUnitDetail,
  TALENT: APP_PATHS.talentDetail,
  EMPLOYMENT_PROFILE: APP_PATHS.employmentProfileDetail,
};

const subjectLoaders = {
  TALENT_GROUP: loadTalentGroupReferenceOptions,
  ORG_UNIT: loadOrgUnitReferenceOptions,
  TALENT: loadTalentReferenceOptions,
  EMPLOYMENT_PROFILE: loadEmploymentProfileReferenceOptions,
} satisfies Record<ResponsibilitySubjectType, typeof loadTalentReferenceOptions>;

const writePermissionBySubjectType = {
  TALENT_GROUP: PERMISSIONS.TALENT_GROUP_UPDATE,
  ORG_UNIT: PERMISSIONS.ORG_UNIT_UPDATE,
  TALENT: PERMISSIONS.TALENT_MANAGE_MANAGER,
  EMPLOYMENT_PROFILE: PERMISSIONS.EMPLOYMENT_PROFILE_MANAGE_MANAGER_ASSIGNMENT,
} satisfies Record<ResponsibilitySubjectType, string>;

type FormState = {
  subjectType: ResponsibilitySubjectType;
  subjectId: string;
  responsibleEmploymentProfileId: string;
  responsibilityRole: string;
  includeDescendants: boolean;
  isPrimary: boolean;
  effectiveAt: string;
  expiresAt: string;
  reason: string;
};

const createInitialFormState = (
  subjectType: ResponsibilitySubjectType,
  subjectId: string,
): FormState => ({
  subjectType,
  subjectId,
  responsibleEmploymentProfileId: '',
  responsibilityRole: '',
  includeDescendants: subjectType === 'ORG_UNIT',
  isPrimary: true,
  effectiveAt: '',
  expiresAt: '',
  reason: '',
});

const readSubjectTypeParam = (value: string | null): ResponsibilitySubjectType =>
  subjectTypes.includes(value as ResponsibilitySubjectType)
    ? (value as ResponsibilitySubjectType)
    : 'TALENT_GROUP';

const toNullableText = (value: string): string | null => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const toCreatePayload = (form: FormState): CreateResponsibilityPayload => ({
  subjectType: form.subjectType,
  subjectId: form.subjectId,
  responsibleEmploymentProfileId: form.responsibleEmploymentProfileId,
  responsibilityType: responsibilityTypeBySubjectType[form.subjectType],
  responsibilityRole: toNullableText(form.responsibilityRole),
  includeDescendants: form.subjectType === 'ORG_UNIT' ? form.includeDescendants : null,
  isPrimary: form.isPrimary,
  effectiveAt: toNullableText(form.effectiveAt),
  expiresAt: toNullableText(form.expiresAt),
  reason: toNullableText(form.reason),
});

const buildQueryFromParams = (params: URLSearchParams): ResponsibilityListQuery => {
  const subjectType = readSubjectTypeParam(params.get('subjectType'));
  const subjectId = params.get('subjectId')?.trim() || undefined;
  const responsibleEmploymentProfileId =
    params.get('responsibleEmploymentProfileId')?.trim() || undefined;

  return {
    subjectType,
    subjectId,
    responsibleEmploymentProfileId,
    status: 'ACTIVE',
    active: true,
    limit: 100,
  };
};

const canManageSubjectType = (
  capabilities: ReturnType<typeof useCurrentActorCapabilities>['data'],
  subjectType: ResponsibilitySubjectType,
): boolean =>
  canShowAction(capabilities, {
    permission: writePermissionBySubjectType[subjectType],
  });

const referenceLabel = (
  assignment: ResponsibilityAssignment,
  kind: 'subject' | 'responsible',
): string => {
  if (kind === 'subject') {
    return readReferenceDisplay(assignment.subjectRef, assignment.subjectId);
  }

  return readReferenceDisplay(
    assignment.responsibleEmploymentProfileRef,
    assignment.responsibleEmploymentProfileId,
  );
};

export const ResponsibilityAssignmentPage = (): JSX.Element => {
  const { t } = useTranslation(['responsibility', 'common', 'errors']);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSubjectType = readSubjectTypeParam(searchParams.get('subjectType'));
  const [form, setForm] = useState<FormState>(() =>
    createInitialFormState(initialSubjectType, searchParams.get('subjectId')?.trim() ?? ''),
  );

  const query = useMemo(() => buildQueryFromParams(searchParams), [searchParams]);
  const listQuery = useResponsibilities(query);
  const createMutation = useCreateResponsibilityMutation();
  const revokeMutation = useRevokeResponsibilityMutation();
  const capabilitiesQuery = useCurrentActorCapabilities();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const { notifyError, notifySuccess } = useMutationFeedback();

  const canCreate = canManageSubjectType(capabilitiesQuery.data, form.subjectType);

  const patchFilter = useCallback(
    (patch: Partial<Record<string, string | undefined>>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value?.trim()) {
          next.set(key, value.trim());
        } else {
          next.delete(key);
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const onSubjectTypeChange = (nextType: ResponsibilitySubjectType): void => {
    setForm((current) => ({
      ...current,
      subjectType: nextType,
      subjectId: '',
      includeDescendants: nextType === 'ORG_UNIT',
    }));
    patchFilter({ subjectType: nextType, subjectId: undefined });
  };

  const onCreate = async (): Promise<void> => {
    if (!form.subjectId || !form.responsibleEmploymentProfileId || !canCreate) {
      return;
    }

    try {
      await createMutation.mutateAsync(toCreatePayload(form));
      notifySuccess('responsibility:feedback.created');
      patchFilter({ subjectType: form.subjectType, subjectId: form.subjectId });
      setForm((current) => ({
        ...current,
        responsibleEmploymentProfileId: '',
        responsibilityRole: '',
        expiresAt: '',
        reason: '',
      }));
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  const onRevoke = useCallback(
    async (assignment: ResponsibilityAssignment) => {
      const confirmed = await requestDestructiveConfirm({
        description: t('responsibility:confirm.revoke'),
      });
      if (!confirmed) {
        return;
      }

      try {
        await revokeMutation.mutateAsync({
          assignmentId: assignment.id,
          reason: t('responsibility:confirm.revokeReason'),
        });
        notifySuccess('responsibility:feedback.revoked');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [notifyError, notifySuccess, requestDestructiveConfirm, revokeMutation, t],
  );

  const columns = useMemo<ColumnDef<ResponsibilityAssignment>[]>(
    () => [
      {
        id: 'subject',
        header: t('responsibility:table.subject'),
        cell: ({ row }) => {
          const assignment = row.original;
          return (
            <div className="space-y-1">
              <ReferenceLink
                label={referenceLabel(assignment, 'subject')}
                to={subjectPathByType[assignment.subjectType](assignment.subjectId)}
              />
              <p className="text-xs text-muted">
                {t(`responsibility:subjects.${assignment.subjectType}`)}
              </p>
            </div>
          );
        },
      },
      {
        id: 'responsible',
        header: t('responsibility:table.responsible'),
        cell: ({ row }) => (
          <ReferenceLink
            label={referenceLabel(row.original, 'responsible')}
            to={APP_PATHS.employmentProfileDetail(row.original.responsibleEmploymentProfileId)}
          />
        ),
      },
      {
        accessorKey: 'responsibilityType',
        header: t('responsibility:table.type'),
        cell: ({ row }) => (
          <div className="space-y-1">
            <p>{t(`responsibility:types.${row.original.responsibilityType}`)}</p>
            {row.original.responsibilityRole ? (
              <p className="text-xs text-muted">
                {t(`responsibility:roles.${row.original.responsibilityRole}`, {
                  defaultValue: row.original.responsibilityRole,
                })}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'effectiveAt',
        header: t('responsibility:table.effective'),
        cell: ({ row }) => (
          <p className="text-xs text-muted">
            {formatVietnamTimestamp(row.original.effectiveAt)}
            <br />
            {row.original.expiresAt
              ? formatVietnamTimestamp(row.original.expiresAt)
              : t('responsibility:summary.openEnded')}
          </p>
        ),
      },
      {
        id: 'state',
        header: t('responsibility:table.state'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <StatusBadge
              label={t(`responsibility:statuses.${row.original.status}`)}
              status={row.original.status}
              family="lifecycle"
            />
            {row.original.isPrimary ? (
              <StatusBadge label={t('responsibility:summary.primary')} tone="info" />
            ) : null}
            {row.original.includeDescendants ? (
              <StatusBadge label={t('responsibility:summary.descendants')} tone="neutral" />
            ) : null}
            {row.original.reviewNeeded ? (
              <StatusBadge label={t('responsibility:summary.reviewNeeded')} tone="danger" />
            ) : null}
          </div>
        ),
      },
      {
        id: 'actions',
        header: t('common:labels.actions'),
        cell: ({ row }) => {
          const canRevoke = canManageSubjectType(
            capabilitiesQuery.data,
            row.original.subjectType,
          );

          return canRevoke ? (
            <button
              type="button"
              onClick={() => void onRevoke(row.original)}
              disabled={revokeMutation.isPending}
              className="rounded border border-danger px-2 py-1 text-xs font-medium text-danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('responsibility:actions.revoke')}
            </button>
          ) : (
            <span className="text-xs text-muted">{t('responsibility:table.readOnly')}</span>
          );
        },
      },
    ],
    [capabilitiesQuery.data, onRevoke, revokeMutation.isPending, t],
  );

  const shellState = listQuery.isPending
    ? 'loading'
    : listQuery.isError
      ? 'error'
      : 'ready';

  return (
    <ModuleListScreenShell
      filterBar={
        <div className="space-y-4 rounded-lg border border-border bg-panel p-4 shadow-shell">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.subjectType')}
              </span>
              <select
                value={form.subjectType}
                onChange={(event) =>
                  onSubjectTypeChange(event.target.value as ResponsibilitySubjectType)
                }
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              >
                {subjectTypes.map((subjectType) => (
                  <option key={subjectType} value={subjectType}>
                    {t(`responsibility:subjects.${subjectType}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.role')}
              </span>
              <input
                value={form.responsibilityRole}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    responsibilityRole: event.target.value,
                  }))
                }
                placeholder={t('responsibility:form.rolePlaceholder')}
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.subject')}
              </p>
              <AsyncReferencePicker
                pickerId="responsibility-subject"
                value={form.subjectId}
                loadOptions={subjectLoaders[form.subjectType]}
                placeholder={t('responsibility:form.subjectSearch')}
                onChange={(subjectId) => {
                  setForm((current) => ({ ...current, subjectId: subjectId ?? '' }));
                  patchFilter({ subjectType: form.subjectType, subjectId });
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.responsible')}
              </p>
              <AsyncReferencePicker
                pickerId="responsibility-responsible-profile"
                value={form.responsibleEmploymentProfileId}
                loadOptions={loadEmploymentProfileReferenceOptions}
                placeholder={t('responsibility:form.responsibleSearch')}
                onChange={(responsibleEmploymentProfileId) =>
                  setForm((current) => ({
                    ...current,
                    responsibleEmploymentProfileId: responsibleEmploymentProfileId ?? '',
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.effectiveAt')}
              </span>
              <input
                type="datetime-local"
                value={form.effectiveAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, effectiveAt: event.target.value }))
                }
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.expiresAt')}
              </span>
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, expiresAt: event.target.value }))
                }
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isPrimary: event.target.checked }))
                }
              />
              {t('responsibility:form.isPrimary')}
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.includeDescendants}
                disabled={form.subjectType !== 'ORG_UNIT'}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    includeDescendants: event.target.checked,
                  }))
                }
              />
              {t('responsibility:form.includeDescendants')}
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('responsibility:form.reason')}
            </span>
            <input
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder={t('responsibility:form.reasonPlaceholder')}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{t('responsibility:form.helper')}</p>
            <button
              type="button"
              onClick={() => void onCreate()}
              disabled={
                !canCreate ||
                createMutation.isPending ||
                !form.subjectId ||
                !form.responsibleEmploymentProfileId
              }
              className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending
                ? t('responsibility:actions.creating')
                : t('responsibility:actions.create')}
            </button>
          </div>
          {!canCreate ? (
            <p className="text-xs text-muted">{t('responsibility:form.permissionHint')}</p>
          ) : null}
        </div>
      }
      tableSection={
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-text">
                {t('responsibility:list.title')}
              </h2>
              <p className="text-sm text-muted">{t('responsibility:list.subtitle')}</p>
            </div>
            {query.subjectId ? (
              <Link
                to={`${APP_PATHS.responsibilities}?subjectType=${query.subjectType ?? 'TALENT_GROUP'}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                {t('responsibility:actions.clearSubject')}
              </Link>
            ) : null}
          </div>
          {listQuery.data?.length === 0 ? (
            <EmptyState
              title={t('responsibility:list.emptyTitle')}
              message={t('responsibility:list.emptyMessage')}
            />
          ) : (
            <AdminTableShell
              data={listQuery.data ?? []}
              columns={columns}
              isLoading={listQuery.isFetching && !listQuery.data}
              emptyTitle={t('responsibility:list.emptyTitle')}
              emptyMessage={t('responsibility:list.emptyMessage')}
              caption={t('responsibility:table.caption')}
            />
          )}
        </div>
      }
      state={shellState}
      loadingState={<LoadingState lines={8} />}
      errorState={
        <ErrorState
          title={t('responsibility:list.loadErrorTitle')}
          message={t('responsibility:list.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void listQuery.refetch()}
        />
      }
    />
  );
};
