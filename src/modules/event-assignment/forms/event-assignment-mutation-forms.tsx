import { useMemo } from 'react';
import {
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  type FieldValues,
  type Path,
  type UseFormSetError,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  EVENT_COMPLETION_EVIDENCE_NOTE_MAX_LENGTH,
  EVENT_COMPLETION_EVIDENCE_REF_LABEL_MAX_LENGTH,
  EVENT_COMPLETION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH,
  EVENT_COMPLETION_EVIDENCE_REF_URL_MAX_LENGTH,
  type EventAssignmentInput,
  type EventAssignmentKind,
  type EventCompletionEvidenceRefType,
  type EventCreatePayload,
  type EventLifecyclePayload,
  type EventReplaceAssignmentsPayload,
  type EventReplacePlatformAccountsPayload,
  type EventReschedulePayload,
  type EventUpdatePayload,
} from '@modules/event-assignment/types/event-assignment.types';
import { loadEmploymentProfileReferenceOptions } from '@modules/employment-profile';
import { loadPlatformAccountReferenceOptions } from '@modules/platform-account';
import { loadTalentReferenceOptions } from '@modules/talent';
import { loadTalentGroupReferenceOptions } from '@modules/talent-group';
import {
  FormGrid,
  GeneratedCodeNotice,
  ReferenceIdSetEditor,
  ReferencePickerField,
  SelectField,
  TextInputField,
} from '@shared/forms';
import {
  formatBusinessDateTimeInputValue,
  parseBusinessDateTimeInputValue,
} from '@shared/formatting/formatters';
import { ModuleMutationSurface } from '@shared/modules';

type BaseSurfaceProps = {
  onCancel: () => void;
  isPending?: boolean;
};

type EventCreateSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: EventCreatePayload) => Promise<void> | void;
};

type EventLifecycleReasonSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: EventLifecyclePayload) => Promise<void> | void;
};

type EventCompletionEvidenceSurfaceProps = BaseSurfaceProps & {
  onSubmit: (payload: EventLifecyclePayload) => Promise<void> | void;
};

type EventEditSurfaceProps = BaseSurfaceProps & {
  initialValues: {
    title: string;
    ownerEmploymentProfileId: string;
    description?: string | null;
    externalRef?: string | null;
  };
  onSubmit: (payload: EventUpdatePayload) => Promise<void> | void;
};

type EventRescheduleSurfaceProps = BaseSurfaceProps & {
  initialValues: {
    eventStartAt: number | string;
    eventEndAt: number | string;
  };
  onSubmit: (payload: EventReschedulePayload) => Promise<void> | void;
};

type EventReplaceAssignmentsSurfaceProps = BaseSurfaceProps & {
  initialAssignments: EventAssignmentInput[];
  rosterAvailable?: boolean;
  onSubmit: (payload: EventReplaceAssignmentsPayload) => Promise<void> | void;
};

type EventReplacePlatformAccountsSurfaceProps = BaseSurfaceProps & {
  initialPlatformAccountIds: string[];
  onSubmit: (payload: EventReplacePlatformAccountsPayload) => Promise<void> | void;
};

const assignmentKindValues = ['EMPLOYMENT_PROFILE', 'TALENT', 'TALENT_GROUP'] as const;
const evidenceRefTypeValues = [
  'URL',
  'PLATFORM_REFERENCE',
  'EXTERNAL_REFERENCE',
  'INTERNAL_REFERENCE',
] as const satisfies readonly EventCompletionEvidenceRefType[];
const tokenRegex = /^[A-Za-z0-9_-]+$/;

const toNullableText = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const idsFromRows = (rows: IdRow[]): string[] =>
  Array.from(new Set(rows.map((row) => row.id.trim()).filter(Boolean)));

const loadAssignmentOptions = (assignmentKind: EventAssignmentKind, search: string) => {
  if (assignmentKind === 'EMPLOYMENT_PROFILE') {
    return loadEmploymentProfileReferenceOptions(search);
  }

  if (assignmentKind === 'TALENT') {
    return loadTalentReferenceOptions(search);
  }

  return loadTalentGroupReferenceOptions(search);
};

const assignmentKindToPayload = (
  assignmentKind: EventAssignmentKind,
  assignmentId: string,
): EventAssignmentInput => {
  if (assignmentKind === 'EMPLOYMENT_PROFILE') {
    return {
      assignmentKind,
      assignmentEmploymentProfileId: assignmentId,
    };
  }

  if (assignmentKind === 'TALENT') {
    return {
      assignmentKind,
      assignmentTalentId: assignmentId,
    };
  }

  return {
    assignmentKind,
    assignmentTalentGroupId: assignmentId,
  };
};

const readAssignmentId = (assignment: EventAssignmentInput): string => {
  if (assignment.assignmentKind === 'EMPLOYMENT_PROFILE') {
    return assignment.assignmentEmploymentProfileId ?? '';
  }

  if (assignment.assignmentKind === 'TALENT') {
    return assignment.assignmentTalentId ?? '';
  }

  return assignment.assignmentTalentGroupId ?? '';
};

const applySchemaErrors = <TValues extends FieldValues>(
  setError: UseFormSetError<TValues>,
  error: z.ZodError,
  fallbackField: Path<TValues>,
): void => {
  error.issues.forEach((issue) => {
    const field = (issue.path[0] as Path<TValues>) ?? fallbackField;
    setError(field, {
      type: 'validate',
      message: issue.message,
    });
  });
};

const timestampField = (requiredMessage: string) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length > 0
        ? parseBusinessDateTimeInputValue(value)
        : undefined,
    z
      .number({ required_error: requiredMessage, invalid_type_error: requiredMessage })
      .int()
      .nonnegative({ message: requiredMessage }),
  );

const createAssignmentKindSchema = (requiredMessage: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length > 0 ? value : undefined),
    z.enum(assignmentKindValues, {
      required_error: requiredMessage,
    }),
  );

const createRescheduleSchema = (requiredMessage: string, rangeMessage: string) =>
  z
    .object({
      newEventStartAt: timestampField(requiredMessage),
      newEventEndAt: timestampField(requiredMessage),
      reason: z.string().trim().min(1, requiredMessage),
    })
    .superRefine((value, context) => {
      if (value.newEventEndAt <= value.newEventStartAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newEventEndAt'],
          message: rangeMessage,
        });
      }
    });

type EventCreateFormValues = {
  title: string;
  ownerEmploymentProfileId: string;
  assignmentKind: EventAssignmentKind;
  assignmentId: string;
  eventStartAt: string;
  eventEndAt: string;
  platformAccountIds: IdRow[];
  description: string;
  externalRef: string;
};

type IdRow = {
  id: string;
};

type EventReplacementAssignmentFormValue = {
  assignmentKind: EventAssignmentKind;
  assignmentId: string;
};

type EventReplaceAssignmentsFormValues = {
  replacementAssignments: EventReplacementAssignmentFormValue[];
};

type EventCompletionEvidenceRefFormValue = {
  type: EventCompletionEvidenceRefType;
  label: string;
  url: string;
  referenceId: string;
};

type EventCompletionEvidenceFormValues = {
  evidenceNote: string;
  evidenceRefs: EventCompletionEvidenceRefFormValue[];
};

const useAssignmentKindOptions = () => {
  const { t } = useTranslation(['event-assignment']);
  return useMemo(
    () =>
      assignmentKindValues.map((value) => ({
        value,
        label: t(`event-assignment:assignmentKinds.${value}`),
      })),
    [t],
  );
};

const createCreateSchema = (
  requiredMessage: string,
  tokenMessage: string,
  referenceMessage: string,
  rangeMessage: string,
) =>
  z
    .object({
      title: z.string().trim().min(1, requiredMessage),
      ownerEmploymentProfileId: z
        .string()
        .trim()
        .min(1, requiredMessage)
        .regex(tokenRegex, tokenMessage),
      assignmentKind: createAssignmentKindSchema(requiredMessage),
      assignmentId: z.string().trim().min(1, requiredMessage).regex(tokenRegex, tokenMessage),
      eventStartAt: timestampField(requiredMessage),
      eventEndAt: timestampField(requiredMessage),
      platformAccountIds: z.array(
        z.object({ id: z.string().trim().regex(tokenRegex, tokenMessage) }),
      ),
      description: z.string().trim().optional(),
      externalRef: z.string().trim().optional(),
    })
    .superRefine((value, context) => {
      if (value.eventEndAt <= value.eventStartAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['eventEndAt'],
          message: rangeMessage,
        });
      }

      value.platformAccountIds.forEach((row) => {
        if (row.id && !tokenRegex.test(row.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['platformAccountIds'],
            message: referenceMessage,
          });
        }
      });
    });

const createReplacementSchema = (requiredMessage: string, tokenMessage: string) =>
  z.object({
    replacementAssignments: z.array(
      z.object({
        assignmentKind: createAssignmentKindSchema(requiredMessage),
        assignmentId: z.string().trim().min(1, requiredMessage).regex(tokenRegex, tokenMessage),
      }),
    ),
  });

const createCompletionEvidenceSchema = (
  requiredMessage: string,
  urlMessage: string,
  referenceMessage: string,
  maxMessage: string,
) =>
  z
    .object({
      evidenceNote: z
        .string()
        .trim()
        .min(1, requiredMessage)
        .max(EVENT_COMPLETION_EVIDENCE_NOTE_MAX_LENGTH, maxMessage),
      evidenceRefs: z
        .array(
          z.object({
            type: z.enum(evidenceRefTypeValues),
            label: z
              .string()
              .trim()
              .max(EVENT_COMPLETION_EVIDENCE_REF_LABEL_MAX_LENGTH, maxMessage)
              .optional(),
            url: z
              .string()
              .trim()
              .max(EVENT_COMPLETION_EVIDENCE_REF_URL_MAX_LENGTH, maxMessage)
              .optional(),
            referenceId: z
              .string()
              .trim()
              .max(EVENT_COMPLETION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH, maxMessage)
              .optional(),
          }),
        )
        .max(20, maxMessage),
    })
    .superRefine((value, context) => {
      value.evidenceRefs.forEach((ref, index) => {
        if (ref.type === 'URL') {
          if (!ref.url) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['evidenceRefs', index, 'url'],
              message: requiredMessage,
            });
            return;
          }

          try {
            const parsed = new URL(ref.url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              throw new Error('invalid protocol');
            }
            if (parsed.toString().length > EVENT_COMPLETION_EVIDENCE_REF_URL_MAX_LENGTH) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['evidenceRefs', index, 'url'],
                message: maxMessage,
              });
            }
          } catch {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['evidenceRefs', index, 'url'],
              message: urlMessage,
            });
          }
          return;
        }

        if (!ref.referenceId) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['evidenceRefs', index, 'referenceId'],
            message: referenceMessage,
          });
        }
      });
    });

export const EventCreateSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: EventCreateSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common']);
  const assignmentKindOptions = useAssignmentKindOptions();
  const form = useForm<EventCreateFormValues>({
    defaultValues: {
      title: '',
      ownerEmploymentProfileId: '',
      assignmentKind: 'EMPLOYMENT_PROFILE',
      assignmentId: '',
      eventStartAt: '',
      eventEndAt: '',
      platformAccountIds: [],
      description: '',
      externalRef: '',
    },
  });

  const schema = useMemo(
    () =>
      createCreateSchema(
        t('event-assignment:validation.required'),
        t('event-assignment:validation.invalidToken'),
        t('event-assignment:validation.invalidReferenceToken'),
        t('event-assignment:validation.invalidWindow'),
      ),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    await onSubmit({
      title: parsed.data.title,
      ownerEmploymentProfileId: parsed.data.ownerEmploymentProfileId,
      assignments: [assignmentKindToPayload(parsed.data.assignmentKind, parsed.data.assignmentId)],
      eventStartAt: parsed.data.eventStartAt,
      eventEndAt: parsed.data.eventEndAt,
      platformAccountIds: idsFromRows(parsed.data.platformAccountIds),
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('event-assignment:mutations.create.title')}
        subtitle={t('event-assignment:mutations.create.subtitle')}
        kind="create"
        submitLabel={t('event-assignment:mutations.create.submit')}
        pendingLabel={t('event-assignment:mutations.create.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <GeneratedCodeNotice
            label={t('event-assignment:generatedCode.label')}
            description={t('event-assignment:generatedCode.description')}
            className="md:col-span-2"
          />
          <TextInputField name="title" label={t('event-assignment:fields.title')} />
          <ReferencePickerField
            name="ownerEmploymentProfileId"
            label={t('event-assignment:fields.ownerEmploymentProfileId')}
            pickerId="event-owner-employment-profile"
            loadOptions={loadEmploymentProfileReferenceOptions}
            placeholder={t('event-assignment:placeholders.searchReference')}
          />
          <SelectField
            name="assignmentKind"
            label={t('event-assignment:fields.assignmentKind')}
            options={assignmentKindOptions}
          />
          <EventAssignmentReferenceField name="assignmentId" kindName="assignmentKind" />
          <TextInputField
            name="eventStartAt"
            label={t('event-assignment:fields.eventStartAt')}
            type="datetime-local"
          />
          <TextInputField
            name="eventEndAt"
            label={t('event-assignment:fields.eventEndAt')}
            type="datetime-local"
          />
          <TextInputField
            name="externalRef"
            label={t('event-assignment:fields.externalRef')}
            placeholder={t('event-assignment:placeholders.optional')}
          />
        </FormGrid>
        <p className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
          {t('event-assignment:detail.bookingReadOnlyHelper')}
        </p>
        <ReferenceIdSetEditor
          name="platformAccountIds"
          idFieldName="id"
          pickerId="event-platform-account"
          loadOptions={loadPlatformAccountReferenceOptions}
          title={t('event-assignment:fields.platformAccounts')}
          fieldLabel={t('event-assignment:fields.platformAccount')}
          addLabel={t('event-assignment:actions.addPlatformAccount')}
          removeLabel={(index) => t('event-assignment:actions.removePlatformAccount', { index })}
          emptyLabel={t('event-assignment:assignments.emptyPlatformAccountSet')}
          placeholder={t('event-assignment:placeholders.searchReference')}
        />
        <TextInputField
          name="description"
          label={t('event-assignment:fields.description')}
          placeholder={t('event-assignment:placeholders.optional')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

const EventAssignmentReferenceField = ({
  name,
  kindName,
  indexedLabel,
}: {
  name: string;
  kindName: string;
  indexedLabel?: string;
}): JSX.Element => {
  const { t } = useTranslation(['event-assignment']);
  const { watch } = useFormContext();
  const assignmentKind = watch(kindName) as EventAssignmentKind;
  const loadOptions = useMemo(
    () => (search: string) => loadAssignmentOptions(assignmentKind, search),
    [assignmentKind],
  );

  return (
    <ReferencePickerField
      name={name}
      label={indexedLabel ?? t('event-assignment:fields.assignment')}
      pickerId={`event-assignment-${name}`}
      loadOptions={loadOptions}
      placeholder={t('event-assignment:placeholders.searchReference')}
    />
  );
};

type EventEditFormValues = {
  title: string;
  ownerEmploymentProfileId: string;
  description: string;
  externalRef: string;
};

export const EventEditSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: EventEditSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common']);
  const form = useForm<EventEditFormValues>({
    defaultValues: {
      title: initialValues.title,
      ownerEmploymentProfileId: initialValues.ownerEmploymentProfileId,
      description: initialValues.description ?? '',
      externalRef: initialValues.externalRef ?? '',
    },
  });

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t('event-assignment:validation.required')),
        ownerEmploymentProfileId: z
          .string()
          .trim()
          .min(1, t('event-assignment:validation.required'))
          .regex(tokenRegex, t('event-assignment:validation.invalidToken')),
        description: z.string().trim().optional(),
        externalRef: z.string().trim().optional(),
      }),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'title');
      return;
    }

    await onSubmit({
      title: parsed.data.title,
      ownerEmploymentProfileId: parsed.data.ownerEmploymentProfileId,
      description: toNullableText(parsed.data.description),
      externalRef: toNullableText(parsed.data.externalRef),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('event-assignment:mutations.edit.title')}
        subtitle={t('event-assignment:mutations.edit.subtitle')}
        kind="edit"
        submitLabel={t('event-assignment:mutations.edit.submit')}
        pendingLabel={t('event-assignment:mutations.edit.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField name="title" label={t('event-assignment:fields.title')} />
          <ReferencePickerField
            name="ownerEmploymentProfileId"
            label={t('event-assignment:fields.ownerEmploymentProfileId')}
            pickerId="event-edit-owner-employment-profile"
            loadOptions={loadEmploymentProfileReferenceOptions}
            placeholder={t('event-assignment:placeholders.searchReference')}
          />
          <TextInputField name="externalRef" label={t('event-assignment:fields.externalRef')} />
        </FormGrid>
        <TextInputField name="description" label={t('event-assignment:fields.description')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const EventRescheduleSurface = ({
  initialValues,
  onCancel,
  onSubmit,
  isPending = false,
}: EventRescheduleSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common']);
  const form = useForm<{ newEventStartAt: string; newEventEndAt: string; reason: string }>({
    defaultValues: {
      newEventStartAt: formatBusinessDateTimeInputValue(initialValues.eventStartAt),
      newEventEndAt: formatBusinessDateTimeInputValue(initialValues.eventEndAt),
      reason: '',
    },
  });
  const schema = useMemo(
    () =>
      createRescheduleSchema(
        t('event-assignment:validation.required'),
        t('event-assignment:validation.invalidWindow'),
      ),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'newEventStartAt');
      return;
    }
    await onSubmit(parsed.data);
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('event-assignment:mutations.reschedule.title')}
        subtitle={t('event-assignment:mutations.reschedule.subtitle')}
        kind="action"
        submitLabel={t('event-assignment:mutations.reschedule.submit')}
        pendingLabel={t('event-assignment:mutations.reschedule.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <TextInputField
            name="newEventStartAt"
            label={t('event-assignment:fields.newEventStartAt')}
            type="datetime-local"
          />
          <TextInputField
            name="newEventEndAt"
            label={t('event-assignment:fields.newEventEndAt')}
            type="datetime-local"
          />
          <TextInputField
            name="reason"
            label={t('event-assignment:fields.reason')}
            placeholder={t('event-assignment:placeholders.requiredReason')}
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const EventReplaceAssignmentsSurface = ({
  initialAssignments,
  rosterAvailable = true,
  onCancel,
  onSubmit,
  isPending = false,
}: EventReplaceAssignmentsSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common']);
  const assignmentKindOptions = useAssignmentKindOptions();
  const form = useForm<EventReplaceAssignmentsFormValues>({
    defaultValues: {
      replacementAssignments: initialAssignments.map((assignment) => ({
        assignmentKind: assignment.assignmentKind,
        assignmentId: readAssignmentId(assignment),
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'replacementAssignments',
  });
  const schema = useMemo(
    () =>
      createReplacementSchema(
        t('event-assignment:validation.required'),
        t('event-assignment:validation.invalidToken'),
      ),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    if (!rosterAvailable) {
      return;
    }

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'replacementAssignments');
      return;
    }

    await onSubmit({
      replacementAssignments: parsed.data.replacementAssignments.map((assignment) =>
        assignmentKindToPayload(assignment.assignmentKind, assignment.assignmentId),
      ),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('event-assignment:mutations.replaceAssignments.title')}
        subtitle={t('event-assignment:mutations.replaceAssignments.subtitle')}
        kind="action"
        submitLabel={t('event-assignment:mutations.replaceAssignments.submit')}
        pendingLabel={t('event-assignment:mutations.replaceAssignments.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
        isLocked={!rosterAvailable}
      >
        {!rosterAvailable ? (
          <p className="rounded border border-warning bg-warning/10 px-3 py-2 text-sm text-text">
            {t('event-assignment:validation.rosterUnavailable')}
          </p>
        ) : null}
        <div className="space-y-3">
          {fields.map((field, index) => (
            <fieldset
              key={field.id}
              className="space-y-3 rounded border border-border bg-panel p-3"
            >
              <legend className="text-sm font-semibold text-text">
                {t('event-assignment:assignments.replacementRowLabel', { index: index + 1 })}
              </legend>
              <FormGrid columns={2}>
                <SelectField
                  name={`replacementAssignments.${index}.assignmentKind`}
                  label={t('event-assignment:fields.assignmentKindIndexed', { index: index + 1 })}
                  options={assignmentKindOptions}
                />
                <EventAssignmentReferenceField
                  name={`replacementAssignments.${index}.assignmentId`}
                  kindName={`replacementAssignments.${index}.assignmentKind`}
                  indexedLabel={t('event-assignment:fields.assignmentIndexed', {
                    index: index + 1,
                  })}
                />
              </FormGrid>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={() => remove(index)}
              >
                {t('event-assignment:actions.removeAssignment', { index: index + 1 })}
              </button>
            </fieldset>
          ))}
        </div>
        {fields.length === 0 ? (
          <p className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('event-assignment:assignments.emptyReplacementSet')}
          </p>
        ) : null}
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs"
          onClick={() => append({ assignmentKind: 'EMPLOYMENT_PROFILE', assignmentId: '' })}
          disabled={!rosterAvailable}
        >
          {t('event-assignment:actions.addAssignment')}
        </button>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const EventLifecycleReasonSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: EventLifecycleReasonSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common']);
  const form = useForm<{ reason: string }>({
    defaultValues: {
      reason: '',
    },
  });
  const schema = useMemo(
    () =>
      z.object({
        reason: z.string().trim().min(1, t('event-assignment:validation.required')),
      }),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'reason');
      return;
    }
    await onSubmit(parsed.data);
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('event-assignment:mutations.cancel.title')}
        subtitle={t('event-assignment:mutations.cancel.subtitle')}
        kind="action"
        submitLabel={t('event-assignment:mutations.cancel.submit')}
        pendingLabel={t('event-assignment:mutations.cancel.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField
          name="reason"
          label={t('event-assignment:fields.reason')}
          placeholder={t('event-assignment:placeholders.requiredReason')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const EventCompletionEvidenceSurface = ({
  onCancel,
  onSubmit,
  isPending = false,
}: EventCompletionEvidenceSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common']);
  const form = useForm<EventCompletionEvidenceFormValues>({
    defaultValues: {
      evidenceNote: '',
      evidenceRefs: [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'evidenceRefs',
  });
  const schema = useMemo(
    () =>
      createCompletionEvidenceSchema(
        t('event-assignment:validation.required'),
        t('event-assignment:validation.invalidEvidenceUrl'),
        t('event-assignment:validation.evidenceReferenceRequired'),
        t('event-assignment:validation.required'),
      ),
    [t],
  );
  const refTypeOptions = useMemo(
    () =>
      evidenceRefTypeValues.map((value) => ({
        value,
        label: t(`event-assignment:evidence.refTypes.${value}`),
      })),
    [t],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      applySchemaErrors(form.setError, parsed.error, 'evidenceNote');
      return;
    }

    await onSubmit({
      evidenceNote: parsed.data.evidenceNote,
      evidenceRefs: parsed.data.evidenceRefs.map((ref) => ({
        type: ref.type,
        label: toNullableText(ref.label),
        url: ref.type === 'URL' ? ref.url : null,
        referenceId: ref.type === 'URL' ? null : ref.referenceId,
      })),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('event-assignment:mutations.complete.title')}
        subtitle={t('event-assignment:mutations.complete.subtitle')}
        kind="action"
        submitLabel={t('event-assignment:mutations.complete.submit')}
        pendingLabel={t('event-assignment:mutations.complete.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField
          name="evidenceNote"
          label={t('event-assignment:fields.evidenceNote')}
          placeholder={t('event-assignment:placeholders.evidenceNote')}
        />
        <div className="space-y-3">
          {fields.map((field, index) => (
            <fieldset
              key={field.id}
              className="space-y-3 rounded border border-border bg-panel p-3"
            >
              <legend className="text-sm font-semibold text-text">
                {t('event-assignment:evidence.referenceRowLabel', { index: index + 1 })}
              </legend>
              <FormGrid columns={2}>
                <SelectField
                  name={`evidenceRefs.${index}.type`}
                  label={t('event-assignment:fields.evidenceRefType')}
                  options={refTypeOptions}
                />
                <TextInputField
                  name={`evidenceRefs.${index}.label`}
                  label={t('event-assignment:fields.evidenceRefLabel')}
                  placeholder={t('event-assignment:placeholders.optional')}
                />
                <TextInputField
                  name={`evidenceRefs.${index}.url`}
                  label={t('event-assignment:fields.evidenceRefUrl')}
                  placeholder={t('event-assignment:placeholders.evidenceUrl')}
                />
                <TextInputField
                  name={`evidenceRefs.${index}.referenceId`}
                  label={t('event-assignment:fields.evidenceRefReferenceId')}
                  placeholder={t('event-assignment:placeholders.evidenceReferenceId')}
                />
              </FormGrid>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={() => remove(index)}
              >
                {t('event-assignment:actions.removeEvidenceRef', { index: index + 1 })}
              </button>
            </fieldset>
          ))}
        </div>
        {fields.length === 0 ? (
          <p className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('event-assignment:evidence.emptyReferences')}
          </p>
        ) : null}
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs"
          onClick={() => append({ type: 'URL', label: '', url: '', referenceId: '' })}
        >
          {t('event-assignment:actions.addEvidenceRef')}
        </button>
        <p className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
          {t('event-assignment:evidence.boundaryHelper')}
        </p>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const EventReplacePlatformAccountsSurface = ({
  initialPlatformAccountIds,
  onCancel,
  onSubmit,
  isPending = false,
}: EventReplacePlatformAccountsSurfaceProps): JSX.Element => {
  const { t } = useTranslation(['event-assignment', 'common']);
  const form = useForm<{ newPlatformAccountIds: IdRow[] }>({
    defaultValues: {
      newPlatformAccountIds: initialPlatformAccountIds.map((id) => ({ id })),
    },
  });
  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      newPlatformAccountIds: idsFromRows(values.newPlatformAccountIds),
    });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        title={t('event-assignment:mutations.replacePlatformAccounts.title')}
        subtitle={t('event-assignment:mutations.replacePlatformAccounts.subtitle')}
        kind="action"
        submitLabel={t('event-assignment:mutations.replacePlatformAccounts.submit')}
        pendingLabel={t('event-assignment:mutations.replacePlatformAccounts.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <ReferenceIdSetEditor
          name="newPlatformAccountIds"
          idFieldName="id"
          pickerId="event-replacement-platform-account"
          loadOptions={loadPlatformAccountReferenceOptions}
          title={t('event-assignment:fields.platformAccounts')}
          fieldLabel={t('event-assignment:fields.platformAccount')}
          addLabel={t('event-assignment:actions.addPlatformAccount')}
          removeLabel={(index) => t('event-assignment:actions.removePlatformAccount', { index })}
          emptyLabel={t('event-assignment:assignments.emptyPlatformAccountSet')}
          placeholder={t('event-assignment:placeholders.searchReference')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};
