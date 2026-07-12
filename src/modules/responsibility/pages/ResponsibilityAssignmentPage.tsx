import { useCallback, useMemo, useRef, useState } from 'react';
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
import { AsyncReferencePicker, type ReferenceOption } from '@shared/components/reference';
import { loadEmploymentProfileReferenceOptions } from '@modules/employment-profile';
import { loadOrgUnitReferenceOptions } from '@modules/org-unit';
import { loadTalentReferenceOptions } from '@modules/talent';
import { loadTalentGroupReferenceOptions } from '@modules/talent-group';
import { ModuleListScreenShell } from '@shared/modules';
import { formatVietnamTimestamp } from '@shared/formatting/formatters';

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

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

const isTechnicalIdentifier = (value: string | undefined): boolean =>
  Boolean(
    value &&
    (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value) ||
      /^[A-Z][A-Z0-9_]*$/u.test(value)),
  );

const safeBusinessCode = (value: string | undefined): string | undefined =>
  value && /^(?:EP|TAL|TG|OU)-[A-Z0-9-]+$/iu.test(value) ? value : undefined;

const unavailableReferenceLabel = (t: TranslationFn): string =>
  t('responsibility:form.selectedReferenceUnavailable');

const toResponsibilityReferenceOption = (
  option: ReferenceOption,
  t: TranslationFn,
): ReferenceOption => {
  const label = option.label.trim();
  const code = safeBusinessCode(option.code);
  const safeLabel =
    label && label !== option.id && !isTechnicalIdentifier(label) ? label : undefined;

  return {
    id: option.id,
    label: safeLabel ?? unavailableReferenceLabel(t),
    description: code,
    href: option.href,
    disabled: option.disabled,
  };
};

const referenceLabel = (
  assignment: ResponsibilityAssignment,
  kind: 'subject' | 'responsible',
  t: TranslationFn,
): string => {
  const reference =
    kind === 'subject' ? assignment.subjectRef : assignment.responsibleEmploymentProfileRef;
  const label = reference?.displayName ?? reference?.name ?? reference?.title;
  return label && label !== reference?.id && !isTechnicalIdentifier(label)
    ? label
    : unavailableReferenceLabel(t);
};

const responsibilityRoleLabel = (value: string, t: TranslationFn): string => {
  const key = `responsibility:roles.${value}`;
  const translated = t(key);
  return translated === key ? t('responsibility:summary.unavailableRole') : translated;
};

export const ResponsibilityAssignmentPage = (): JSX.Element => {
  const { t } = useTranslation(['responsibility', 'common', 'errors']);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSubjectType = readSubjectTypeParam(searchParams.get('subjectType'));
  const [form, setForm] = useState<FormState>(() =>
    createInitialFormState(initialSubjectType, searchParams.get('subjectId')?.trim() ?? ''),
  );
  const [selectedSubject, setSelectedSubject] = useState<ReferenceOption | undefined>();
  const [selectedResponsibleProfile, setSelectedResponsibleProfile] = useState<
    ReferenceOption | undefined
  >();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [completedAssignment, setCompletedAssignment] = useState<ResponsibilityAssignment | null>(
    null,
  );
  const createInFlightRef = useRef(false);

  const query = useMemo(() => buildQueryFromParams(searchParams), [searchParams]);
  const listQuery = useResponsibilities(query);
  const createMutation = useCreateResponsibilityMutation();
  const revokeMutation = useRevokeResponsibilityMutation();
  const capabilitiesQuery = useCurrentActorCapabilities();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const { notifyError, notifySuccess } = useMutationFeedback();

  const loadSubjectOptions = useCallback(
    async (search: string): Promise<ReferenceOption[]> =>
      (await subjectLoaders[form.subjectType](search)).map((option) =>
        toResponsibilityReferenceOption(option, t),
      ),
    [form.subjectType, t],
  );
  const loadResponsibleProfileOptions = useCallback(
    async (search: string): Promise<ReferenceOption[]> =>
      (await loadEmploymentProfileReferenceOptions(search)).map((option) =>
        toResponsibilityReferenceOption(option, t),
      ),
    [t],
  );

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
    if (completedAssignment) {
      return;
    }
    setForm((current) => ({
      ...current,
      subjectType: nextType,
      subjectId: '',
      includeDescendants: nextType === 'ORG_UNIT',
    }));
    patchFilter({ subjectType: nextType, subjectId: undefined });
    setSelectedSubject(undefined);
    setSelectedResponsibleProfile(undefined);
    setReviewOpen(false);
    setCompletedAssignment(null);
  };

  const onCreate = async (): Promise<void> => {
    if (
      completedAssignment ||
      createInFlightRef.current ||
      !form.subjectId ||
      !form.responsibleEmploymentProfileId ||
      !canCreate
    ) {
      return;
    }

    createInFlightRef.current = true;
    try {
      const result = await createMutation.mutateAsync(toCreatePayload(form));
      notifySuccess('responsibility:feedback.created');
      patchFilter({ subjectType: form.subjectType, subjectId: form.subjectId });
      setCompletedAssignment(result);
      setReviewOpen(false);
    } catch {
      notifyError({
        status: null,
        message: 'responsibility:feedback.createFailed',
        fieldErrors: {},
        retryable: true,
        permissionDenied: false,
        notFound: false,
      });
    } finally {
      createInFlightRef.current = false;
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
                label={referenceLabel(assignment, 'subject', t)}
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
            label={referenceLabel(row.original, 'responsible', t)}
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
                {responsibilityRoleLabel(row.original.responsibilityRole, t)}
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
        header: t('responsibility:table.actions'),
        cell: ({ row }) => {
          const canRevoke = canManageSubjectType(capabilitiesQuery.data, row.original.subjectType);

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

  const shellState = listQuery.isPending ? 'loading' : listQuery.isError ? 'error' : 'ready';
  const canReview = Boolean(
    !completedAssignment && form.subjectId && form.responsibleEmploymentProfileId && canCreate,
  );
  const resetWorkflow = (): void => {
    createInFlightRef.current = false;
    setForm(createInitialFormState('TALENT_GROUP', ''));
    setSelectedSubject(undefined);
    setSelectedResponsibleProfile(undefined);
    setReviewOpen(false);
    setCompletedAssignment(null);
    createMutation.reset();
    patchFilter({
      subjectType: 'TALENT_GROUP',
      subjectId: undefined,
      responsibleEmploymentProfileId: undefined,
    });
  };

  return (
    <ModuleListScreenShell
      filterBar={
        <div className="space-y-4 rounded-lg border border-border bg-panel p-4 shadow-shell">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.subjectType')} · {t('responsibility:form.required')}
              </span>
              <select
                value={form.subjectType}
                disabled={Boolean(completedAssignment)}
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
                {t('responsibility:form.role')} · {t('responsibility:form.optional')}
              </span>
              <input
                value={form.responsibilityRole}
                disabled={Boolean(completedAssignment)}
                onChange={(event) =>
                  !completedAssignment &&
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
                {t('responsibility:form.subject')} · {t('responsibility:form.required')}
              </p>
              <AsyncReferencePicker
                pickerId="responsibility-subject"
                value={form.subjectId}
                loadOptions={loadSubjectOptions}
                placeholder={t('responsibility:form.subjectSearch')}
                resourceLabel={t('responsibility:form.subject')}
                clearable
                clearLabel={t('responsibility:actions.clearSelection')}
                showTechnicalMetadata={false}
                selectedLabelFallback={unavailableReferenceLabel(t)}
                disabled={Boolean(completedAssignment)}
                onChange={(subjectId) => {
                  if (completedAssignment) {
                    return;
                  }
                  setForm((current) => ({ ...current, subjectId: subjectId ?? '' }));
                  patchFilter({ subjectType: form.subjectType, subjectId });
                  setReviewOpen(false);
                }}
                onSelectedOptionChange={setSelectedSubject}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.responsible')} · {t('responsibility:form.required')}
              </p>
              <AsyncReferencePicker
                pickerId="responsibility-responsible-profile"
                value={form.responsibleEmploymentProfileId}
                loadOptions={loadResponsibleProfileOptions}
                placeholder={t('responsibility:form.responsibleSearch')}
                resourceLabel={t('responsibility:form.responsible')}
                disabled={!form.subjectId || Boolean(completedAssignment)}
                disabledSlot={
                  completedAssignment ? null : (
                    <p className="text-xs text-muted">
                      {t('responsibility:form.chooseSubjectFirst')}
                    </p>
                  )
                }
                clearable
                clearLabel={t('responsibility:actions.clearSelection')}
                showTechnicalMetadata={false}
                selectedLabelFallback={unavailableReferenceLabel(t)}
                onChange={(responsibleEmploymentProfileId) => {
                  if (completedAssignment) {
                    return;
                  }
                  setForm((current) => ({
                    ...current,
                    responsibleEmploymentProfileId: responsibleEmploymentProfileId ?? '',
                  }));
                  setReviewOpen(false);
                }}
                onSelectedOptionChange={setSelectedResponsibleProfile}
              />
            </div>
          </div>

          <div className="rounded border border-warning/30 bg-warning/10 p-3 text-sm text-text">
            <p className="font-semibold">{t('responsibility:form.accessBoundaryTitle')}</p>
            <p className="mt-1 text-muted">{t('responsibility:form.helper')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.effectiveAt')} · {t('responsibility:form.optional')}
              </span>
              <input
                type="datetime-local"
                value={form.effectiveAt}
                disabled={Boolean(completedAssignment)}
                onChange={(event) =>
                  !completedAssignment &&
                  setForm((current) => ({ ...current, effectiveAt: event.target.value }))
                }
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted">
                {t('responsibility:form.expiresAt')} · {t('responsibility:form.optional')}
              </span>
              <input
                type="datetime-local"
                value={form.expiresAt}
                disabled={Boolean(completedAssignment)}
                onChange={(event) =>
                  !completedAssignment &&
                  setForm((current) => ({ ...current, expiresAt: event.target.value }))
                }
                className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.isPrimary}
                disabled={Boolean(completedAssignment)}
                onChange={(event) =>
                  !completedAssignment &&
                  setForm((current) => ({ ...current, isPrimary: event.target.checked }))
                }
              />
              {t('responsibility:form.isPrimary')} · {t('responsibility:form.optional')}
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.includeDescendants}
                disabled={form.subjectType !== 'ORG_UNIT' || Boolean(completedAssignment)}
                onChange={(event) =>
                  !completedAssignment &&
                  setForm((current) => ({
                    ...current,
                    includeDescendants: event.target.checked,
                  }))
                }
              />
              {t('responsibility:form.includeDescendants')} · {t('responsibility:form.conditional')}
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted">
              {t('responsibility:form.reason')} · {t('responsibility:form.optional')}
            </span>
            <input
              value={form.reason}
              disabled={Boolean(completedAssignment)}
              onChange={(event) =>
                !completedAssignment &&
                setForm((current) => ({ ...current, reason: event.target.value }))
              }
              placeholder={t('responsibility:form.reasonPlaceholder')}
              className="rounded border border-border bg-panel px-2 py-1.5 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{t('responsibility:form.reviewHelper')}</p>
            {!completedAssignment ? (
              <button
                type="button"
                onClick={() => setReviewOpen(true)}
                disabled={!canReview || createMutation.isPending}
                className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('responsibility:actions.review')}
              </button>
            ) : null}
          </div>
          {reviewOpen && !completedAssignment ? (
            <div
              className="rounded border border-border bg-bg p-4"
              data-testid="responsibility-review"
            >
              <p className="font-semibold text-text">{t('responsibility:review.title')}</p>
              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-muted">
                    {t('responsibility:review.subject')}
                  </dt>
                  <dd className="mt-1 text-text">
                    {selectedSubject?.label ??
                      (form.subjectId
                        ? unavailableReferenceLabel(t)
                        : t('responsibility:form.selectedReference'))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted">
                    {t('responsibility:review.responsible')}
                  </dt>
                  <dd className="mt-1 text-text">
                    {selectedResponsibleProfile?.label ??
                      (form.responsibleEmploymentProfileId
                        ? unavailableReferenceLabel(t)
                        : t('responsibility:form.selectedReference'))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted">
                    {t('responsibility:review.type')}
                  </dt>
                  <dd className="mt-1 text-text">
                    {t(`responsibility:types.${responsibilityTypeBySubjectType[form.subjectType]}`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-muted">
                    {t('responsibility:review.period')}
                  </dt>
                  <dd className="mt-1 text-text">
                    {form.effectiveAt || t('responsibility:summary.openEnded')} ·{' '}
                    {form.expiresAt || t('responsibility:summary.openEnded')}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 rounded border border-warning/30 bg-warning/10 p-3 text-sm text-text">
                {t('responsibility:form.helper')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text"
                >
                  {t('common:actions.back')}
                </button>
                <button
                  type="button"
                  onClick={() => void onCreate()}
                  disabled={createMutation.isPending}
                  className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createMutation.isPending
                    ? t('responsibility:actions.creating')
                    : t('responsibility:actions.create')}
                </button>
              </div>
            </div>
          ) : null}
          {completedAssignment ? (
            <div className="rounded border border-success/40 bg-success/10 p-4" role="status">
              <p className="font-semibold text-success">{t('responsibility:completion.title')}</p>
              <p className="mt-1 text-sm text-muted">{t('responsibility:completion.message')}</p>
              <p className="mt-3 text-sm text-text">
                {selectedSubject?.label ??
                  (form.subjectId
                    ? unavailableReferenceLabel(t)
                    : t('responsibility:form.selectedReference'))}{' '}
                ·{' '}
                {selectedResponsibleProfile?.label ??
                  (form.responsibleEmploymentProfileId
                    ? unavailableReferenceLabel(t)
                    : t('responsibility:form.selectedReference'))}
              </p>
              <button
                type="button"
                onClick={resetWorkflow}
                className="mt-4 rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
              >
                {t('responsibility:actions.assignAnother')}
              </button>
            </div>
          ) : null}
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
