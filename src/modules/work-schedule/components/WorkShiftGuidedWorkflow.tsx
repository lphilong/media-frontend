import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  loadWorkShiftStudioResourceOptions,
  loadWorkShiftSubjectOptions,
} from '@modules/work-schedule/components/work-schedule-reference-options';
import type {
  WorkScheduleScope,
  WorkShiftCreatePayload,
  WorkShiftSubjectKind,
} from '@modules/work-schedule/types/work-schedule.types';
import {
  formatVietnamLocalDisplay,
  parseVietnamLocalDateTimeToUtcTimestamp,
  VIETNAM_TIME_ZONE,
  VIETNAM_UTC_OFFSET_LABEL,
} from '@modules/work-schedule/utils/vietnam-datetime';
import type { NormalizedApiError } from '@shared/api';
import { AsyncReferencePicker, type ReferenceOption } from '@shared/components/reference';
import { BlockerBanner, TaskWorkflowShell } from '@shared/components/primitives';
import { formatBusinessTimestamp } from '@shared/formatting/formatters';
import { MutationFieldErrorSummary } from '@shared/modules';

type WorkflowStep = 'details' | 'review';

type WorkShiftGuidedWorkflowProps = {
  onCancel: () => void;
  onSubmit: (payload: WorkShiftCreatePayload, scope: WorkScheduleScope) => Promise<void> | void;
  isPending?: boolean;
  error?: NormalizedApiError | null;
  loadSubjectOptions?: (
    subjectKind: WorkShiftSubjectKind,
    search: string,
  ) => Promise<ReferenceOption[]>;
  loadStudioResourceOptions?: (search: string) => Promise<ReferenceOption[]>;
  availableScopes?: readonly WorkScheduleScope[];
};

type WorkflowValidationErrors = Partial<
  Record<'title' | 'subjectId' | 'shiftStartAt' | 'shiftEndAt' | 'window' | 'scope', string>
>;

const subjectKinds: WorkShiftSubjectKind[] = ['EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP'];
const employmentProfileScopes: WorkScheduleScope[] = ['global', 'self', 'team', 'department'];
const globalScopes: WorkScheduleScope[] = ['global'];

const tokenPattern = /^[A-Za-z0-9_-]+$/u;

const toNullableText = (value: string): string | null => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const subjectIdPayload = (
  subjectKind: WorkShiftSubjectKind,
  subjectId: string,
): Pick<
  WorkShiftCreatePayload,
  'subjectEmploymentProfileId' | 'subjectTalentId' | 'subjectTalentGroupId'
> => {
  if (subjectKind === 'EMPLOYMENT_PROFILE') {
    return { subjectEmploymentProfileId: subjectId };
  }

  if (subjectKind === 'TALENT') {
    return { subjectTalentId: subjectId };
  }

  return { subjectTalentGroupId: subjectId };
};

const readableErrorMessage = (
  error: NormalizedApiError | null | undefined,
  translate: (key: string) => string,
): string | null => {
  if (!error?.message) {
    return null;
  }

  return error.message.includes(':') ? translate(error.message) : error.message;
};

const GeneratedShiftCodeInfo = (): JSX.Element => {
  const { t } = useTranslation(['work-schedule']);

  return (
    <div className="max-w-xl rounded border border-border bg-bg px-3 py-2">
      <p className="text-xs font-medium uppercase text-muted">
        {t('work-schedule:task.generatedShiftCodeLabel')}
      </p>
      <p className="mt-1 rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
        {t('work-schedule:task.generatedShiftCodeValue')}
      </p>
      <p className="mt-1 text-xs text-muted">{t('work-schedule:task.generatedShiftCodeHelp')}</p>
    </div>
  );
};

export const WorkShiftGuidedWorkflow = ({
  onCancel,
  onSubmit,
  isPending = false,
  error,
  loadSubjectOptions = loadWorkShiftSubjectOptions,
  loadStudioResourceOptions = loadWorkShiftStudioResourceOptions,
  availableScopes: allowedScopes,
}: WorkShiftGuidedWorkflowProps): JSX.Element => {
  const { t } = useTranslation(['work-schedule', 'common', 'errors']);
  const [step, setStep] = useState<WorkflowStep>('details');
  const [title, setTitle] = useState('');
  const [subjectKind, setSubjectKind] = useState<WorkShiftSubjectKind>('EMPLOYMENT_PROFILE');
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [subjectOption, setSubjectOption] = useState<ReferenceOption | undefined>();
  const [subjectOptions, setSubjectOptions] = useState<ReferenceOption[]>([]);
  const [scope, setScope] = useState<WorkScheduleScope>('global');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [studioResourceIds, setStudioResourceIds] = useState<string[]>([]);
  const [studioResourceOptions, setStudioResourceOptions] = useState<ReferenceOption[]>([]);
  const [description, setDescription] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [errors, setErrors] = useState<WorkflowValidationErrors>({});

  const availableScopes =
    allowedScopes ??
    (subjectKind === 'EMPLOYMENT_PROFILE' ? employmentProfileScopes : globalScopes);
  const startTimestamp = parseVietnamLocalDateTimeToUtcTimestamp(startLocal);
  const endTimestamp = parseVietnamLocalDateTimeToUtcTimestamp(endLocal);

  const selectedResources = useMemo(() => {
    return studioResourceIds.map((resourceId) => {
      return (
        studioResourceOptions.find((option) => option.id === resourceId) ?? {
          id: resourceId,
          label: resourceId,
        }
      );
    });
  }, [studioResourceIds, studioResourceOptions]);

  const chooseSubjectKind = (nextKind: WorkShiftSubjectKind): void => {
    setSubjectKind(nextKind);
    setSubjectId(undefined);
    setSubjectOption(undefined);
    setSubjectOptions([]);

    if (nextKind !== 'EMPLOYMENT_PROFILE') {
      setScope('global');
    }
  };

  const validate = useCallback((): WorkflowValidationErrors => {
    const nextErrors: WorkflowValidationErrors = {};

    if (!title.trim()) {
      nextErrors.title = t('work-schedule:validation.required');
    }

    if (!subjectId?.trim()) {
      nextErrors.subjectId = t('work-schedule:validation.required');
    } else if (!tokenPattern.test(subjectId.trim())) {
      nextErrors.subjectId = t('work-schedule:validation.invalidReferenceToken');
    }

    if (startTimestamp === null) {
      nextErrors.shiftStartAt = t('work-schedule:task.validation.localDateTime');
    }

    if (endTimestamp === null) {
      nextErrors.shiftEndAt = t('work-schedule:task.validation.localDateTime');
    }

    if (startTimestamp !== null && endTimestamp !== null && endTimestamp <= startTimestamp) {
      nextErrors.window = t('work-schedule:validation.invalidWindow');
    }

    if (subjectKind !== 'EMPLOYMENT_PROFILE' && scope !== 'global') {
      nextErrors.scope = t('work-schedule:validation.nonGlobalEmploymentProfileOnly');
    }

    return nextErrors;
  }, [endTimestamp, scope, startTimestamp, subjectId, subjectKind, t, title]);

  const payload = useMemo<WorkShiftCreatePayload | null>(() => {
    if (!subjectId || startTimestamp === null || endTimestamp === null) {
      return null;
    }

    return {
      title: title.trim(),
      subjectKind,
      ...subjectIdPayload(subjectKind, subjectId.trim()),
      shiftStartAt: startTimestamp,
      shiftEndAt: endTimestamp,
      studioResourceIds,
      description: toNullableText(description),
      externalRef: toNullableText(externalRef),
    };
  }, [
    description,
    endTimestamp,
    externalRef,
    startTimestamp,
    studioResourceIds,
    subjectId,
    subjectKind,
    title,
  ]);

  const moveToReview = (event: FormEvent): void => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      setStep('review');
    }
  };

  const submit = async (): Promise<void> => {
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !payload) {
      setStep('details');
      return;
    }

    await onSubmit(payload, scope);
  };

  const loadSubjects = useCallback(
    async (search: string) => {
      return loadSubjectOptions(subjectKind, search);
    },
    [loadSubjectOptions, subjectKind],
  );

  const loadSubjectPickerOptions = useCallback(
    async (search: string) => {
      const options = await loadSubjects(search);
      setSubjectOptions(options);
      if (subjectId) {
        setSubjectOption(options.find((option) => option.id === subjectId));
      }
      return options;
    },
    [loadSubjects, subjectId],
  );

  const loadResources = useCallback(
    async (search: string) => {
      const options = await loadStudioResourceOptions(search);
      setStudioResourceOptions((current) => {
        const merged = new Map(current.map((option) => [option.id, option]));
        options.forEach((option) => merged.set(option.id, option));
        return Array.from(merged.values());
      });
      return options.map((option) => ({
        ...option,
        disabled: studioResourceIds.includes(option.id),
      }));
    },
    [loadStudioResourceOptions, studioResourceIds],
  );

  const mutationErrorMessage = readableErrorMessage(error, t);

  return (
    <TaskWorkflowShell
      title={t('work-schedule:task.title')}
      description={t('work-schedule:task.description')}
      stepLabel={t(`work-schedule:task.steps.${step}`)}
      cancelLabel={t('common:actions.close')}
      onCancel={onCancel}
    >
      <form className="space-y-5" onSubmit={moveToReview}>
        {mutationErrorMessage ? (
          <BlockerBanner
            title={t('work-schedule:task.backendRejectedTitle')}
            message={mutationErrorMessage}
          />
        ) : null}
        {error?.details ? (
          <dl className="rounded border border-border bg-bg px-3 py-2 text-xs text-muted">
            {Object.entries(error.details).map(([key, value]) => (
              <div key={key} className="grid gap-1 py-1 md:grid-cols-[160px_1fr]">
                <dt className="font-medium text-text">{key}</dt>
                <dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <MutationFieldErrorSummary errors={error?.fieldErrors} />

        {step === 'details' ? (
          <div className="space-y-5">
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('work-schedule:task.authorityNote', {
                timezone: VIETNAM_TIME_ZONE,
                offset: VIETNAM_UTC_OFFSET_LABEL,
              })}
            </div>

            <GeneratedShiftCodeInfo />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:fields.title')}
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                />
                {errors.title ? (
                  <span className="text-xs font-medium text-danger">{errors.title}</span>
                ) : null}
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:fields.subjectKind')}
                </span>
                <select
                  value={subjectKind}
                  onChange={(event) =>
                    chooseSubjectKind(event.target.value as WorkShiftSubjectKind)
                  }
                  className="rounded border border-border bg-panel px-3 py-2 text-sm"
                >
                  {subjectKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`work-schedule:subjectKinds.${kind}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:task.subjectPicker')}
                </span>
                <AsyncReferencePicker
                  key={subjectKind}
                  pickerId={`work-shift-subject-${subjectKind}`}
                  value={subjectId}
                  onChange={(nextId) => {
                    setSubjectId(nextId);
                    setSubjectOption(subjectOptions.find((option) => option.id === nextId));
                  }}
                  loadOptions={loadSubjectPickerOptions}
                  placeholder={t('work-schedule:task.searchPlaceholder')}
                  emptySlot={
                    <p className="text-xs text-muted">{t('work-schedule:task.noPickerResults')}</p>
                  }
                />
                {errors.subjectId ? (
                  <span className="text-xs font-medium text-danger">{errors.subjectId}</span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:task.startVietnamLocal')}
                </span>
                <input
                  type="datetime-local"
                  aria-label={t('work-schedule:task.startVietnamLocal')}
                  value={startLocal}
                  onChange={(event) => setStartLocal(event.target.value)}
                  className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                />
                <span className="text-xs text-muted">{t('work-schedule:task.datetimeHelp')}</span>
                {errors.shiftStartAt ? (
                  <span className="text-xs font-medium text-danger">{errors.shiftStartAt}</span>
                ) : null}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase text-muted">
                  {t('work-schedule:task.endVietnamLocal')}
                </span>
                <input
                  type="datetime-local"
                  aria-label={t('work-schedule:task.endVietnamLocal')}
                  value={endLocal}
                  onChange={(event) => setEndLocal(event.target.value)}
                  className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                />
                <span className="text-xs text-muted">{t('work-schedule:task.datetimeHelp')}</span>
                {errors.shiftEndAt ? (
                  <span className="text-xs font-medium text-danger">{errors.shiftEndAt}</span>
                ) : null}
              </label>
              {errors.window ? (
                <p className="text-xs font-medium text-danger md:col-span-2">{errors.window}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium uppercase text-muted"
                htmlFor="work-shift-guided-scope"
              >
                {t('work-schedule:task.scopeLabel')}
              </label>
              <select
                id="work-shift-guided-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as WorkScheduleScope)}
                className="max-w-xs rounded border border-border bg-panel px-3 py-2 text-sm"
              >
                {availableScopes.map((scopeOption) => (
                  <option key={scopeOption} value={scopeOption}>
                    {t(`work-schedule:scopes.${scopeOption}`)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted">
                {subjectKind === 'EMPLOYMENT_PROFILE'
                  ? t('work-schedule:task.employmentScopeHelp')
                  : t('work-schedule:task.globalScopeHelp')}
              </span>
              {errors.scope ? (
                <span className="text-xs font-medium text-danger">{errors.scope}</span>
              ) : null}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium uppercase text-muted">
                {t('work-schedule:task.resourcesPicker')}
              </span>
              <AsyncReferencePicker
                pickerId="work-shift-studio-resources"
                exactOneId={false}
                onChange={(resourceId) => {
                  if (!resourceId) {
                    return;
                  }
                  setStudioResourceIds((current) =>
                    current.includes(resourceId) ? current : [...current, resourceId],
                  );
                }}
                loadOptions={loadResources}
                placeholder={t('work-schedule:task.searchResourcesPlaceholder')}
                emptySlot={
                  <p className="text-xs text-muted">{t('work-schedule:task.noPickerResults')}</p>
                }
              />
              {selectedResources.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {selectedResources.map((resource) => (
                    <li
                      key={resource.id}
                      className="flex items-center gap-2 rounded border border-border bg-bg px-2 py-1 text-sm"
                    >
                      <span>{resource.label}</span>
                      <button
                        type="button"
                        className="text-xs text-danger"
                        onClick={() =>
                          setStudioResourceIds((current) =>
                            current.filter((resourceId) => resourceId !== resource.id),
                          )
                        }
                      >
                        {t('work-schedule:task.removeResource')}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">{t('work-schedule:task.noResourcesSelected')}</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text">
                {t('work-schedule:task.additionalInformation')}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('work-schedule:fields.description')}
                  </span>
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('work-schedule:task.externalRefLabel')}
                  </span>
                  <input
                    aria-label={t('work-schedule:task.externalRefLabel')}
                    value={externalRef}
                    onChange={(event) => setExternalRef(event.target.value)}
                    className="rounded border border-border bg-panel px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                  />
                  <span className="text-xs text-muted">
                    {t('work-schedule:task.externalRefHelp')}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-border bg-panel px-3 py-2 text-sm"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="submit"
                className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
              >
                {t('work-schedule:task.reviewAction')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <GeneratedShiftCodeInfo />

            <dl
              className="divide-y divide-border rounded border border-border bg-bg text-sm"
              data-testid="work-shift-guided-review-summary"
            >
              {[
                ['title', title.trim()],
                ['subjectKind', t(`work-schedule:subjectKinds.${subjectKind}`)],
                ['subjectId', `${subjectOption?.label ?? subjectId} (${subjectId})`],
                ['scope', t(`work-schedule:scopes.${scope}`)],
                [
                  'startLocal',
                  startTimestamp === null
                    ? '-'
                    : t('work-schedule:task.localReviewValue', {
                        value: formatVietnamLocalDisplay(startTimestamp),
                        timezone: VIETNAM_TIME_ZONE,
                        offset: VIETNAM_UTC_OFFSET_LABEL,
                      }),
                ],
                [
                  'startUtc',
                  startTimestamp === null
                    ? '-'
                    : t('work-schedule:task.utcReviewValue', {
                        timestamp: startTimestamp,
                        value: formatBusinessTimestamp(startTimestamp),
                      }),
                ],
                [
                  'endLocal',
                  endTimestamp === null
                    ? '-'
                    : t('work-schedule:task.localReviewValue', {
                        value: formatVietnamLocalDisplay(endTimestamp),
                        timezone: VIETNAM_TIME_ZONE,
                        offset: VIETNAM_UTC_OFFSET_LABEL,
                      }),
                ],
                [
                  'endUtc',
                  endTimestamp === null
                    ? '-'
                    : t('work-schedule:task.utcReviewValue', {
                        timestamp: endTimestamp,
                        value: formatBusinessTimestamp(endTimestamp),
                      }),
                ],
                [
                  'studioResources',
                  selectedResources.length > 0
                    ? selectedResources.map((resource) => resource.label).join(', ')
                    : t('work-schedule:task.none'),
                ],
                ['description', toNullableText(description) ?? t('work-schedule:task.none')],
                ['externalRef', toNullableText(externalRef) ?? t('work-schedule:task.none')],
              ].map(([key, value]) => (
                <div key={key} className="grid gap-1 px-3 py-2 md:grid-cols-[180px_1fr]">
                  <dt className="font-medium text-text">{t(`work-schedule:task.review.${key}`)}</dt>
                  <dd className="break-words text-muted">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('work-schedule:task.backendAuthorityWarning')}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="rounded border border-border bg-panel px-3 py-2 text-sm"
              >
                {t('common:actions.previous')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-border bg-panel px-3 py-2 text-sm"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => void submit()}
                className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? t('work-schedule:task.submitPending')
                  : t('work-schedule:task.submitAction')}
              </button>
            </div>
          </div>
        )}
      </form>
    </TaskWorkflowShell>
  );
};
