import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  useAcceptContractObligationMutation,
  useArchiveContractObligationMutation,
  useCancelContractObligationMutation,
  useContractObligationEventEvidenceLinks,
  useContractObligations,
  useCreateContractObligationMutation,
  useDeliverContractObligationMutation,
  useLinkContractObligationEventEvidenceMutation,
  useOpenContractObligationMutation,
  useRejectContractObligationMutation,
  useReopenContractObligationMutation,
  useRemoveContractObligationEventEvidenceMutation,
  useUpdateContractObligationMutation,
} from '@modules/contract-registry/hooks/use-contract-registry';
import { loadCompletedEventReferenceOptions } from '@modules/event-assignment';
import type {
  ContractEvidenceRefType,
  ContractObligation,
  ContractObligationDeliverPayload,
  ContractObligationEventEvidenceLink,
  ContractObligationPayload,
  ContractObligationType,
  ContractRecord,
} from '@modules/contract-registry/types/contract-registry.types';
import {
  CONTRACT_OBLIGATION_DELIVERY_NOTE_MAX_LENGTH,
  CONTRACT_OBLIGATION_DESCRIPTION_MAX_LENGTH,
  CONTRACT_OBLIGATION_EVIDENCE_REF_LABEL_MAX_LENGTH,
  CONTRACT_OBLIGATION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH,
  CONTRACT_OBLIGATION_EVIDENCE_REF_URL_MAX_LENGTH,
  CONTRACT_OBLIGATION_EVENT_EVIDENCE_REASON_MAX_LENGTH,
  CONTRACT_OBLIGATION_REASON_MAX_LENGTH,
  CONTRACT_OBLIGATION_TITLE_MAX_LENGTH,
} from '@modules/contract-registry/types/contract-registry.types';
import type { NormalizedApiError } from '@shared/api';
import {
  PERMISSIONS,
  hasPermission,
  hasScopeGrant,
  useCurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import {
  ErrorState,
  LoadingState,
  MetadataSection,
  StatusBadge,
  type StatusBadgeTone,
  useMutationFeedback,
} from '@shared/components/primitives';
import { loadEmploymentProfileReferenceOptions } from '@modules/employment-profile';
import { FormGrid, ReferencePickerField, SelectField, TextInputField } from '@shared/forms';
import {
  formatBusinessTimestamp,
  formatUtcMidnightDateLike,
  readReferenceDisplay,
} from '@shared/formatting/formatters';
import { ModuleMutationSurface } from '@shared/modules';

type Surface =
  | 'create'
  | 'edit'
  | 'deliver'
  | 'link-event'
  | 'remove-link'
  | 'reject'
  | 'reopen'
  | 'cancel'
  | 'archive'
  | 'accept'
  | null;

type ObligationFormValues = {
  obligationType: ContractObligationType;
  title: string;
  description: string;
  dueDate: string;
  responsibleOwnerEmploymentProfileId: string;
  evidencePolicy: 'OPTIONAL' | 'REQUIRED';
};

type ReasonFormValues = {
  reason: string;
};

type AcceptFormValues = {
  reviewNote: string;
};

type LinkEventFormValues = {
  eventId: string;
  linkReason: string;
};

type DeliveryFormValues = {
  deliveryNote: string;
  selectedEventEvidenceLinkIds: string[];
  directRefType: ContractEvidenceRefType;
  directRefLabel: string;
  directRefUrl: string;
  directRefReferenceId: string;
};

const obligationStatusTone: Record<string, StatusBadgeTone> = {
  DRAFT: 'neutral',
  OPEN: 'info',
  DELIVERED: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  ARCHIVED: 'neutral',
};

const eventEvidenceLinkTone: Record<string, StatusBadgeTone> = {
  ACTIVE: 'success',
  REMOVED: 'neutral',
};

const obligationTypes: ContractObligationType[] = [
  'DELIVERABLE',
  'SERVICE_MILESTONE',
  'REPORTING',
  'OTHER',
];
const evidencePolicies = ['OPTIONAL', 'REQUIRED'] as const;
const evidenceRefTypes: ContractEvidenceRefType[] = [
  'URL',
  'PLATFORM_REFERENCE',
  'EXTERNAL_REFERENCE',
  'INTERNAL_REFERENCE',
];

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const toInputDate = (value?: number | string | null): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && dateRegex.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const isObligationManagementAvailable = (record: ContractRecord): boolean =>
  record.status === 'ACTIVE' &&
  record.boundaryMetadata.semanticBoundary === 'COMMERCIAL_LEGAL' &&
  record.boundaryMetadata.commercialLegalRegistry &&
  record.boundaryMetadata.obligationAcceptanceImplemented &&
  record.boundaryMetadata.eventEvidenceLinkImplemented;

const toNullable = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readApiErrorMessage = (error: unknown): string | undefined => {
  const apiError = error as NormalizedApiError | undefined;
  return apiError?.message;
};

const buildObligationPayload = (values: ObligationFormValues): ContractObligationPayload => ({
  obligationType: values.obligationType,
  title: values.title.trim(),
  description: toNullable(values.description),
  dueDate: toNullable(values.dueDate),
  responsibleOwnerEmploymentProfileId: values.responsibleOwnerEmploymentProfileId.trim(),
  evidencePolicy: values.evidencePolicy,
});

const buildDeliveryPayload = (values: DeliveryFormValues): ContractObligationDeliverPayload => {
  const evidenceRefs =
    values.directRefLabel.trim().length > 0
      ? [
          {
            type: values.directRefType,
            label: values.directRefLabel.trim(),
            url: values.directRefType === 'URL' ? toNullable(values.directRefUrl) : null,
            referenceId:
              values.directRefType === 'URL' ? null : toNullable(values.directRefReferenceId),
          },
        ]
      : [];

  return {
    deliveryNote: toNullable(values.deliveryNote),
    evidenceRefs,
    eventEvidenceLinkIds: values.selectedEventEvidenceLinkIds,
  };
};

const ActorReferenceDisplay = ({
  actorId,
  label,
}: {
  actorId: string | null | undefined;
  label?: string;
}) => {
  const { t } = useTranslation('contract-registry');

  if (!actorId) {
    return <span>-</span>;
  }

  return (
    <span>
      {label ? `${label}: ` : null}
      {t('obligations.values.displayUnavailable')}
      <span className="block text-xs text-muted">
        {t('obligations.fields.technicalReference')}: {readReferenceDisplay(null, actorId)}
      </span>
    </span>
  );
};

const ObligationForm = ({
  initial,
  isPending,
  onCancel,
  onSubmit,
}: {
  initial?: ContractObligation;
  isPending?: boolean;
  onCancel: () => void;
  onSubmit: (payload: ContractObligationPayload) => Promise<void>;
}) => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const form = useForm<ObligationFormValues>({
    defaultValues: {
      obligationType: initial?.obligationType ?? 'DELIVERABLE',
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      dueDate: toInputDate(initial?.dueDate),
      responsibleOwnerEmploymentProfileId: initial?.responsibleOwnerEmploymentProfileId ?? '',
      evidencePolicy: initial?.evidencePolicy ?? 'OPTIONAL',
    },
  });
  const schema = useMemo(
    () =>
      z.object({
        obligationType: z.enum(['DELIVERABLE', 'SERVICE_MILESTONE', 'REPORTING', 'OTHER']),
        title: z
          .string()
          .trim()
          .min(1, t('contract-registry:validation.required'))
          .max(CONTRACT_OBLIGATION_TITLE_MAX_LENGTH),
        description: z.string().max(CONTRACT_OBLIGATION_DESCRIPTION_MAX_LENGTH),
        dueDate: z
          .string()
          .trim()
          .refine((value) => value.length === 0 || dateRegex.test(value), {
            message: t('contract-registry:validation.invalidDate'),
          }),
        responsibleOwnerEmploymentProfileId: z
          .string()
          .trim()
          .min(1, t('contract-registry:validation.required')),
        evidencePolicy: z.enum(['OPTIONAL', 'REQUIRED']),
      }),
    [t],
  );
  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        form.setError((issue.path[0] ?? 'title') as keyof ObligationFormValues, {
          message: issue.message,
        });
      });
      return;
    }
    await onSubmit(buildObligationPayload(parsed.data));
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        kind={initial ? 'edit' : 'create'}
        title={t(
          initial
            ? 'contract-registry:obligations.forms.editTitle'
            : 'contract-registry:obligations.forms.createTitle',
        )}
        subtitle={t('contract-registry:obligations.forms.metadataSubtitle')}
        submitLabel={t('contract-registry:obligations.actions.save')}
        pendingLabel={t('contract-registry:obligations.forms.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <SelectField
            name="obligationType"
            label={t('contract-registry:obligations.fields.type')}
            options={obligationTypes.map((value) => ({
              value,
              label: t(`contract-registry:obligations.types.${value}`),
            }))}
          />
          <SelectField
            name="evidencePolicy"
            label={t('contract-registry:obligations.fields.evidencePolicy')}
            options={evidencePolicies.map((value) => ({
              value,
              label: t(`contract-registry:obligations.evidencePolicies.${value}`),
            }))}
          />
          <TextInputField name="title" label={t('contract-registry:obligations.fields.title')} />
          <TextInputField
            name="dueDate"
            type="date"
            label={t('contract-registry:obligations.fields.dueDate')}
          />
          <ReferencePickerField
            name="responsibleOwnerEmploymentProfileId"
            label={t('contract-registry:obligations.fields.responsibleOwner')}
            pickerId="contract-obligation-responsible-owner"
            loadOptions={loadEmploymentProfileReferenceOptions}
            placeholder={t('contract-registry:placeholders.searchReference')}
          />
        </FormGrid>
        <TextInputField
          name="description"
          label={t('contract-registry:obligations.fields.description')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

const ReasonForm = ({
  surface,
  isPending,
  onCancel,
  onSubmit,
}: {
  surface: 'reject' | 'reopen' | 'cancel' | 'archive' | 'remove-link';
  isPending?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const form = useForm<ReasonFormValues>({ defaultValues: { reason: '' } });
  const handleSubmit = form.handleSubmit(async (values) => {
    const reason = values.reason.trim();
    if (!reason) {
      form.setError('reason', { message: t('contract-registry:validation.required') });
      return;
    }
    const maxLength =
      surface === 'remove-link'
        ? CONTRACT_OBLIGATION_EVENT_EVIDENCE_REASON_MAX_LENGTH
        : CONTRACT_OBLIGATION_REASON_MAX_LENGTH;
    if (reason.length > maxLength) {
      form.setError('reason', {
        message: t('contract-registry:validation.maxLength', { max: maxLength }),
      });
      return;
    }
    await onSubmit(reason);
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        kind="action"
        title={t(`contract-registry:obligations.forms.${surface}Title`)}
        subtitle={t(
          surface === 'reopen'
            ? 'contract-registry:obligations.helpers.reopen'
            : 'contract-registry:obligations.forms.reasonSubtitle',
        )}
        submitLabel={t(`contract-registry:obligations.actions.${surface}`)}
        pendingLabel={t('contract-registry:obligations.forms.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField name="reason" label={t('contract-registry:obligations.fields.reason')} />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

const AcceptForm = ({
  isPending,
  onCancel,
  onSubmit,
}: {
  isPending?: boolean;
  onCancel: () => void;
  onSubmit: (reviewNote: string | null) => Promise<void>;
}) => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const form = useForm<AcceptFormValues>({ defaultValues: { reviewNote: '' } });
  const handleSubmit = form.handleSubmit(async (values) => {
    if (values.reviewNote.trim().length > CONTRACT_OBLIGATION_REASON_MAX_LENGTH) {
      form.setError('reviewNote', {
        message: t('contract-registry:validation.maxLength', {
          max: CONTRACT_OBLIGATION_REASON_MAX_LENGTH,
        }),
      });
      return;
    }
    await onSubmit(toNullable(values.reviewNote));
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        kind="action"
        title={t('contract-registry:obligations.forms.acceptTitle')}
        subtitle={t('contract-registry:obligations.helpers.review')}
        submitLabel={t('contract-registry:obligations.actions.accept')}
        pendingLabel={t('contract-registry:obligations.forms.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField
          name="reviewNote"
          label={t('contract-registry:obligations.fields.reviewNote')}
        />
      </ModuleMutationSurface>
    </FormProvider>
  );
};

const LinkEventForm = ({
  isPending,
  onCancel,
  onSubmit,
}: {
  isPending?: boolean;
  onCancel: () => void;
  onSubmit: (values: LinkEventFormValues) => Promise<void>;
}) => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const form = useForm<LinkEventFormValues>({ defaultValues: { eventId: '', linkReason: '' } });
  const handleSubmit = form.handleSubmit(async (values) => {
    if (!values.eventId.trim()) {
      form.setError('eventId', { message: t('contract-registry:validation.required') });
      return;
    }
    if (!values.linkReason.trim()) {
      form.setError('linkReason', { message: t('contract-registry:validation.required') });
      return;
    }
    if (values.linkReason.trim().length > CONTRACT_OBLIGATION_EVENT_EVIDENCE_REASON_MAX_LENGTH) {
      form.setError('linkReason', {
        message: t('contract-registry:validation.maxLength', {
          max: CONTRACT_OBLIGATION_EVENT_EVIDENCE_REASON_MAX_LENGTH,
        }),
      });
      return;
    }
    await onSubmit({ eventId: values.eventId.trim(), linkReason: values.linkReason.trim() });
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        kind="action"
        title={t('contract-registry:obligations.forms.linkEventTitle')}
        subtitle={t('contract-registry:obligations.helpers.linkEvent')}
        submitLabel={t('contract-registry:obligations.actions.linkEvent')}
        pendingLabel={t('contract-registry:obligations.forms.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <FormGrid columns={2}>
          <ReferencePickerField
            name="eventId"
            label={t('contract-registry:obligations.fields.eventId')}
            pickerId="contract-obligation-completed-event"
            loadOptions={loadCompletedEventReferenceOptions}
            placeholder={t('contract-registry:obligations.placeholders.searchCompletedEvent')}
            helperText={t('contract-registry:obligations.helpers.completedEventSelection')}
          />
          <TextInputField
            name="linkReason"
            label={t('contract-registry:obligations.fields.linkReason')}
          />
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

const DeliveryForm = ({
  obligation,
  links,
  isPending,
  onCancel,
  onSubmit,
}: {
  obligation: ContractObligation;
  links: ContractObligationEventEvidenceLink[];
  isPending?: boolean;
  onCancel: () => void;
  onSubmit: (payload: ContractObligationDeliverPayload) => Promise<void>;
}) => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const activeLinks = links.filter((link) => link.status === 'ACTIVE');
  const form = useForm<DeliveryFormValues>({
    defaultValues: {
      deliveryNote: '',
      selectedEventEvidenceLinkIds: [],
      directRefType: 'URL',
      directRefLabel: '',
      directRefUrl: '',
      directRefReferenceId: '',
    },
  });
  const selectedIds = form.watch('selectedEventEvidenceLinkIds');
  const directRefType = form.watch('directRefType');
  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = buildDeliveryPayload(values);
    if (values.deliveryNote.trim().length > CONTRACT_OBLIGATION_DELIVERY_NOTE_MAX_LENGTH) {
      form.setError('deliveryNote', {
        message: t('contract-registry:validation.maxLength', {
          max: CONTRACT_OBLIGATION_DELIVERY_NOTE_MAX_LENGTH,
        }),
      });
      return;
    }
    if (values.directRefLabel.trim().length > CONTRACT_OBLIGATION_EVIDENCE_REF_LABEL_MAX_LENGTH) {
      form.setError('directRefLabel', {
        message: t('contract-registry:validation.maxLength', {
          max: CONTRACT_OBLIGATION_EVIDENCE_REF_LABEL_MAX_LENGTH,
        }),
      });
      return;
    }
    if (values.directRefUrl.trim().length > CONTRACT_OBLIGATION_EVIDENCE_REF_URL_MAX_LENGTH) {
      form.setError('directRefUrl', {
        message: t('contract-registry:validation.maxLength', {
          max: CONTRACT_OBLIGATION_EVIDENCE_REF_URL_MAX_LENGTH,
        }),
      });
      return;
    }
    if (
      values.directRefReferenceId.trim().length >
      CONTRACT_OBLIGATION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH
    ) {
      form.setError('directRefReferenceId', {
        message: t('contract-registry:validation.maxLength', {
          max: CONTRACT_OBLIGATION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH,
        }),
      });
      return;
    }
    if (
      obligation.evidencePolicy === 'REQUIRED' &&
      (payload.evidenceRefs?.length ?? 0) === 0 &&
      (payload.eventEvidenceLinkIds?.length ?? 0) === 0
    ) {
      form.setError('directRefLabel', {
        message: t('contract-registry:obligations.validation.requiredEvidence'),
      });
      return;
    }
    if (payload.evidenceRefs?.[0]?.type === 'URL' && !payload.evidenceRefs[0].url) {
      form.setError('directRefUrl', {
        message: t('contract-registry:obligations.validation.urlRequired'),
      });
      return;
    }
    if (
      payload.evidenceRefs?.[0]?.type !== 'URL' &&
      payload.evidenceRefs?.[0]?.referenceId === null
    ) {
      form.setError('directRefReferenceId', {
        message: t('contract-registry:obligations.validation.referenceRequired'),
      });
      return;
    }
    await onSubmit(payload);
  });

  return (
    <FormProvider {...form}>
      <ModuleMutationSurface
        kind="action"
        title={t('contract-registry:obligations.forms.deliverTitle')}
        subtitle={t('contract-registry:obligations.helpers.delivery')}
        submitLabel={t('contract-registry:obligations.actions.deliver')}
        pendingLabel={t('contract-registry:obligations.forms.pending')}
        cancelLabel={t('common:actions.cancel')}
        onCancel={onCancel}
        onSubmit={(event) => void handleSubmit(event)}
        isPending={isPending}
      >
        <TextInputField
          name="deliveryNote"
          label={t('contract-registry:obligations.fields.deliveryNote')}
        />
        <div className="space-y-2">
          <p className="text-sm font-medium text-text">
            {t('contract-registry:obligations.fields.eventEvidenceLinks')}
          </p>
          {links.length === 0 ? (
            <p className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('contract-registry:obligations.empty.noEventEvidence')}
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <label
                  key={link.id}
                  className="flex items-start gap-2 rounded border border-border bg-bg px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={link.status !== 'ACTIVE'}
                    checked={selectedIds.includes(link.id)}
                    onChange={(event) => {
                      const next = event.currentTarget.checked
                        ? [...selectedIds, link.id]
                        : selectedIds.filter((id) => id !== link.id);
                      form.setValue('selectedEventEvidenceLinkIds', next, { shouldDirty: true });
                    }}
                  />
                  <span>
                    <span className="font-medium">
                      {link.snapshot.eventCode} - {link.snapshot.eventTitle}
                    </span>
                    <span className="ml-2 text-muted">
                      {t(`contract-registry:obligations.linkStatuses.${link.status}`)}
                    </span>
                  </span>
                </label>
              ))}
              {activeLinks.length === 0 ? (
                <p className="text-sm text-muted">
                  {t('contract-registry:obligations.empty.noActiveEventEvidence')}
                </p>
              ) : null}
            </div>
          )}
        </div>
        <FormGrid columns={2}>
          <SelectField
            name="directRefType"
            label={t('contract-registry:obligations.fields.directRefType')}
            options={evidenceRefTypes.map((value) => ({
              value,
              label: t(`contract-registry:obligations.evidenceRefTypes.${value}`),
            }))}
          />
          <TextInputField
            name="directRefLabel"
            label={t('contract-registry:obligations.fields.directRefLabel')}
          />
          {directRefType === 'URL' ? (
            <TextInputField
              name="directRefUrl"
              label={t('contract-registry:obligations.fields.directRefUrl')}
            />
          ) : (
            <TextInputField
              name="directRefReferenceId"
              label={t('contract-registry:obligations.fields.directRefReferenceId')}
            />
          )}
        </FormGrid>
      </ModuleMutationSurface>
    </FormProvider>
  );
};

export const ContractObligationEvidenceSection = ({
  record,
}: {
  record: ContractRecord;
}): JSX.Element => {
  const { t } = useTranslation(['contract-registry', 'common']);
  const [selectedObligationId, setSelectedObligationId] = useState<string | null>(null);
  const [surface, setSurface] = useState<Surface>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const { notifyError, notifySuccess } = useMutationFeedback();
  const capabilitiesQuery = useCurrentActorCapabilities();
  const available = isObligationManagementAvailable(record);
  const obligationsQuery = useContractObligations(record.id, { enabled: available });
  const obligations = obligationsQuery.data?.data ?? [];
  const selectedObligation =
    obligations.find((item) => item.id === selectedObligationId) ?? obligations[0];
  const linksQuery = useContractObligationEventEvidenceLinks(selectedObligation?.id, {
    enabled:
      available &&
      Boolean(selectedObligation) &&
      hasPermission(
        capabilitiesQuery.data,
        PERMISSIONS.CONTRACT_OBLIGATION_EVENT_EVIDENCE_LINK_READ,
      ),
  });
  const links = linksQuery.data?.data ?? [];
  const selectedLink = links.find((link) => link.id === selectedLinkId) ?? null;
  const capabilities = capabilitiesQuery.data;
  const hasGlobalScope = hasScopeGrant(capabilities, 'contractRegistry', 'global');
  const canReadObligations =
    available &&
    hasGlobalScope &&
    hasPermission(capabilities, PERMISSIONS.CONTRACT_OBLIGATION_READ);
  const canManageDraft =
    available &&
    hasGlobalScope &&
    hasPermission(capabilities, PERMISSIONS.CONTRACT_OBLIGATION_MANAGE_DRAFT);
  const canManageLifecycle =
    available &&
    hasGlobalScope &&
    hasPermission(capabilities, PERMISSIONS.CONTRACT_OBLIGATION_MANAGE_LIFECYCLE);
  const canDeliver =
    available &&
    hasGlobalScope &&
    hasPermission(capabilities, PERMISSIONS.CONTRACT_OBLIGATION_DELIVER);
  const canReview =
    available &&
    hasGlobalScope &&
    hasPermission(capabilities, PERMISSIONS.CONTRACT_OBLIGATION_REVIEW);
  const canLinkEvent =
    available &&
    hasGlobalScope &&
    hasPermission(capabilities, PERMISSIONS.CONTRACT_OBLIGATION_EVENT_EVIDENCE_LINK);
  const canRemoveEvent =
    available &&
    hasGlobalScope &&
    hasPermission(capabilities, PERMISSIONS.CONTRACT_OBLIGATION_EVENT_EVIDENCE_REMOVE);
  const canReadEventEvidence =
    available &&
    hasGlobalScope &&
    hasPermission(capabilities, PERMISSIONS.CONTRACT_OBLIGATION_EVENT_EVIDENCE_LINK_READ);
  const createMutation = useCreateContractObligationMutation();
  const updateMutation = useUpdateContractObligationMutation();
  const openMutation = useOpenContractObligationMutation();
  const deliverMutation = useDeliverContractObligationMutation();
  const acceptMutation = useAcceptContractObligationMutation();
  const rejectMutation = useRejectContractObligationMutation();
  const reopenMutation = useReopenContractObligationMutation();
  const cancelMutation = useCancelContractObligationMutation();
  const archiveMutation = useArchiveContractObligationMutation();
  const linkMutation = useLinkContractObligationEventEvidenceMutation();
  const removeLinkMutation = useRemoveContractObligationEventEvidenceMutation();

  if (!available) {
    return (
      <MetadataSection title={t('contract-registry:obligations.sectionTitle')}>
        <div className="rounded border border-border bg-panel px-3 py-3 text-sm text-muted">
          {t('contract-registry:obligations.unavailable')}
        </div>
      </MetadataSection>
    );
  }

  if (capabilitiesQuery.isLoading || obligationsQuery.isPending) {
    return (
      <MetadataSection title={t('contract-registry:obligations.sectionTitle')}>
        <LoadingState lines={4} />
      </MetadataSection>
    );
  }

  if (!canReadObligations) {
    return (
      <MetadataSection title={t('contract-registry:obligations.sectionTitle')}>
        <div className="rounded border border-border bg-panel px-3 py-3 text-sm text-muted">
          {t('contract-registry:obligations.noAccess')}
        </div>
      </MetadataSection>
    );
  }

  if (obligationsQuery.isError) {
    return (
      <MetadataSection title={t('contract-registry:obligations.sectionTitle')}>
        <ErrorState
          title={t('contract-registry:obligations.errors.loadTitle')}
          message={
            readApiErrorMessage(obligationsQuery.error) ??
            t('contract-registry:states.loadErrorMessage')
          }
          actionLabel={t('common:actions.retry')}
          onRetry={() => void obligationsQuery.refetch()}
        />
      </MetadataSection>
    );
  }

  const closeSurface = () => {
    setSurface(null);
    setSelectedLinkId(null);
  };

  const runMutation = async (callback: () => Promise<unknown>, successKey: string) => {
    try {
      await callback();
      notifySuccess(successKey);
      closeSurface();
    } catch (error) {
      notifyError(error as NormalizedApiError);
    }
  };

  return (
    <MetadataSection title={t('contract-registry:obligations.sectionTitle')}>
      <div className="space-y-4">
        <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
          {t('contract-registry:obligations.helpers.boundary')}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text">
            {t('contract-registry:obligations.listTitle')}
          </h3>
          {canManageDraft ? (
            <button
              type="button"
              className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white"
              onClick={() => setSurface('create')}
            >
              {t('contract-registry:obligations.actions.create')}
            </button>
          ) : null}
        </div>
        {obligations.length === 0 ? (
          <div className="rounded border border-border bg-panel px-3 py-3 text-sm text-muted">
            {t('contract-registry:obligations.empty.noObligations')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-bg text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">
                    {t('contract-registry:obligations.fields.identity')}
                  </th>
                  <th className="px-3 py-2">{t('contract-registry:obligations.fields.type')}</th>
                  <th className="px-3 py-2">{t('contract-registry:obligations.fields.status')}</th>
                  <th className="px-3 py-2">
                    {t('contract-registry:obligations.fields.evidencePolicy')}
                  </th>
                  <th className="px-3 py-2">{t('contract-registry:obligations.fields.dueDate')}</th>
                  <th className="px-3 py-2">
                    {t('contract-registry:obligations.fields.responsibleOwner')}
                  </th>
                  <th className="px-3 py-2">
                    {t('contract-registry:obligations.fields.latestWorkflowContext')}
                  </th>
                  <th className="px-3 py-2">{t('contract-registry:table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-panel">
                {obligations.map((obligation) => {
                  const responsibleOwnerRef =
                    obligation.responsibleOwnerEmploymentProfileId ===
                    record.ownerEmploymentProfileId
                      ? record.ownerEmploymentProfileRef
                      : null;
                  const responsibleOwnerDisplay = responsibleOwnerRef
                    ? readReferenceDisplay(
                        responsibleOwnerRef,
                        obligation.responsibleOwnerEmploymentProfileId,
                      )
                    : null;
                  const selectObligation = () => setSelectedObligationId(obligation.id);

                  return (
                    <tr key={obligation.id}>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left text-accent hover:underline"
                          onClick={selectObligation}
                        >
                          <span className="font-medium">{obligation.code}</span>
                          <span className="block text-text">{obligation.title}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {t(`contract-registry:obligations.types.${obligation.obligationType}`)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          status={obligation.status}
                          label={t(`contract-registry:obligations.statuses.${obligation.status}`)}
                          toneByStatus={obligationStatusTone}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          `contract-registry:obligations.evidencePolicies.${obligation.evidencePolicy}`,
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {obligation.dueDate ? formatUtcMidnightDateLike(obligation.dueDate) : '-'}
                      </td>
                      <td className="px-3 py-2">
                        {responsibleOwnerDisplay ??
                          t('contract-registry:obligations.values.displayUnavailable')}
                        {!responsibleOwnerDisplay ? (
                          <span className="block text-xs text-muted">
                            {t('contract-registry:obligations.fields.technicalReference')}:{' '}
                            {readReferenceDisplay(
                              null,
                              obligation.responsibleOwnerEmploymentProfileId,
                            )}
                          </span>
                        ) : null}
                      </td>
                      <td className="min-w-56 px-3 py-2">
                        {obligation.latestDeliveredAt ? (
                          <span className="block">
                            {t('contract-registry:obligations.fields.deliveredAt')}:{' '}
                            {formatBusinessTimestamp(obligation.latestDeliveredAt)}
                            <span className="block text-xs text-muted">
                              <ActorReferenceDisplay
                                actorId={obligation.latestDeliveredByActorId}
                                label={t('contract-registry:obligations.fields.deliveredBy')}
                              />
                            </span>
                            {obligation.latestDeliveryNote ? (
                              <span className="block text-xs text-muted">
                                {obligation.latestDeliveryNote}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {obligation.latestReviewedAt ? (
                          <span className="mt-1 block">
                            {t('contract-registry:obligations.fields.reviewedAt')}:{' '}
                            {formatBusinessTimestamp(obligation.latestReviewedAt)}
                            <span className="block text-xs text-muted">
                              <ActorReferenceDisplay
                                actorId={obligation.latestReviewedByActorId}
                                label={t('contract-registry:obligations.fields.reviewedBy')}
                              />
                            </span>
                            {obligation.rejectionReason ? (
                              <span className="block text-xs text-danger">
                                {t('contract-registry:obligations.fields.rejectionReason')}:{' '}
                                {obligation.rejectionReason}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {!obligation.latestDeliveredAt && !obligation.latestReviewedAt ? '-' : null}
                      </td>
                      <td className="min-w-48 px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-1 text-xs"
                            onClick={selectObligation}
                          >
                            {t('contract-registry:obligations.actions.detail')}
                          </button>
                          {canManageDraft && ['DRAFT', 'OPEN'].includes(obligation.status) ? (
                            <span className="rounded border border-border px-2 py-1 text-xs">
                              {t('contract-registry:obligations.actions.edit')}
                            </span>
                          ) : null}
                          {canManageLifecycle && obligation.status === 'DRAFT' ? (
                            <span className="rounded border border-border px-2 py-1 text-xs">
                              {t('contract-registry:obligations.actions.open')}
                            </span>
                          ) : null}
                          {canDeliver && obligation.status === 'OPEN' ? (
                            <span className="rounded border border-border px-2 py-1 text-xs">
                              {t('contract-registry:obligations.actions.deliver')}
                            </span>
                          ) : null}
                          {canReview && obligation.status === 'DELIVERED' ? (
                            <>
                              <span className="rounded border border-accent px-2 py-1 text-xs text-accent">
                                {t('contract-registry:obligations.actions.accept')}
                              </span>
                              <span className="rounded border border-danger px-2 py-1 text-xs text-danger">
                                {t('contract-registry:obligations.actions.reject')}
                              </span>
                            </>
                          ) : null}
                          {canManageLifecycle && obligation.status === 'REJECTED' ? (
                            <span className="rounded border border-border px-2 py-1 text-xs">
                              {t('contract-registry:obligations.actions.reopen')}
                            </span>
                          ) : null}
                          {canManageLifecycle && ['DRAFT', 'OPEN'].includes(obligation.status) ? (
                            <span className="rounded border border-danger px-2 py-1 text-xs text-danger">
                              {t('contract-registry:obligations.actions.cancel')}
                            </span>
                          ) : null}
                          {canManageLifecycle &&
                          ['ACCEPTED', 'CANCELLED'].includes(obligation.status) ? (
                            <span className="rounded border border-border px-2 py-1 text-xs">
                              {t('contract-registry:obligations.actions.archive')}
                            </span>
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
        {selectedObligation ? (
          <div className="space-y-4 rounded border border-border bg-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-text">{selectedObligation.title}</h3>
                <p className="text-sm text-muted">{selectedObligation.code}</p>
              </div>
              <StatusBadge
                status={selectedObligation.status}
                label={t(`contract-registry:obligations.statuses.${selectedObligation.status}`)}
                toneByStatus={obligationStatusTone}
              />
            </div>
            <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.description')}
                </dt>
                <dd>{selectedObligation.description || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.responsibleOwner')}
                </dt>
                <dd>
                  {selectedObligation.responsibleOwnerEmploymentProfileId ===
                    record.ownerEmploymentProfileId && record.ownerEmploymentProfileRef ? (
                    readReferenceDisplay(
                      record.ownerEmploymentProfileRef,
                      selectedObligation.responsibleOwnerEmploymentProfileId,
                    )
                  ) : (
                    <>
                      {t('contract-registry:obligations.values.displayUnavailable')}
                      <span className="block text-xs text-muted">
                        {t('contract-registry:obligations.fields.technicalReference')}:{' '}
                        {readReferenceDisplay(
                          null,
                          selectedObligation.responsibleOwnerEmploymentProfileId,
                        )}
                      </span>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.type')}
                </dt>
                <dd>
                  {t(`contract-registry:obligations.types.${selectedObligation.obligationType}`)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.evidencePolicy')}
                </dt>
                <dd>
                  {t(
                    `contract-registry:obligations.evidencePolicies.${selectedObligation.evidencePolicy}`,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.dueDate')}
                </dt>
                <dd>
                  {selectedObligation.dueDate
                    ? formatUtcMidnightDateLike(selectedObligation.dueDate)
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.deliveryNote')}
                </dt>
                <dd>{selectedObligation.latestDeliveryNote || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.deliveredAt')}
                </dt>
                <dd>
                  {selectedObligation.latestDeliveredAt
                    ? formatBusinessTimestamp(selectedObligation.latestDeliveredAt)
                    : '-'}
                  {selectedObligation.latestDeliveredByActorId ? (
                    <span className="block text-xs text-muted">
                      {t('contract-registry:obligations.fields.deliveredBy')}:{' '}
                      {t('contract-registry:obligations.values.displayUnavailable')} (
                      {readReferenceDisplay(null, selectedObligation.latestDeliveredByActorId)})
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.reviewedAt')}
                </dt>
                <dd>
                  {selectedObligation.latestReviewedAt
                    ? formatBusinessTimestamp(selectedObligation.latestReviewedAt)
                    : '-'}
                  {selectedObligation.latestReviewedByActorId ? (
                    <span className="block text-xs text-muted">
                      {t('contract-registry:obligations.fields.reviewedBy')}:{' '}
                      {t('contract-registry:obligations.values.displayUnavailable')} (
                      {readReferenceDisplay(null, selectedObligation.latestReviewedByActorId)})
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.rejectionReason')}
                </dt>
                <dd>{selectedObligation.rejectionReason || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.createdAt')}
                </dt>
                <dd>{formatBusinessTimestamp(selectedObligation.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">
                  {t('contract-registry:obligations.fields.updatedAt')}
                </dt>
                <dd>{formatBusinessTimestamp(selectedObligation.updatedAt)}</dd>
              </div>
            </dl>
            <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
              {t('contract-registry:obligations.helpers.acceptance')}
            </div>
            <div className="flex flex-wrap gap-2">
              {canManageDraft && ['DRAFT', 'OPEN'].includes(selectedObligation.status) ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => setSurface('edit')}
                >
                  {t('contract-registry:obligations.actions.edit')}
                </button>
              ) : null}
              {canManageLifecycle && selectedObligation.status === 'DRAFT' ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() =>
                    void runMutation(
                      () => openMutation.mutateAsync({ obligationId: selectedObligation.id }),
                      'contract-registry:obligations.feedback.opened',
                    )
                  }
                >
                  {t('contract-registry:obligations.actions.open')}
                </button>
              ) : null}
              {canDeliver && selectedObligation.status === 'OPEN' ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => setSurface('deliver')}
                >
                  {t('contract-registry:obligations.actions.deliver')}
                </button>
              ) : null}
              {canLinkEvent && selectedObligation.status === 'OPEN' ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => setSurface('link-event')}
                >
                  {t('contract-registry:obligations.actions.linkEvent')}
                </button>
              ) : null}
              {canReview && selectedObligation.status === 'DELIVERED' ? (
                <>
                  <button
                    type="button"
                    className="rounded border border-accent bg-accent px-3 py-2 text-sm text-white"
                    onClick={() => setSurface('accept')}
                  >
                    {t('contract-registry:obligations.actions.accept')}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-danger px-3 py-2 text-sm text-danger"
                    onClick={() => setSurface('reject')}
                  >
                    {t('contract-registry:obligations.actions.reject')}
                  </button>
                </>
              ) : null}
              {canManageLifecycle && selectedObligation.status === 'REJECTED' ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => setSurface('reopen')}
                >
                  {t('contract-registry:obligations.actions.reopen')}
                </button>
              ) : null}
              {canManageLifecycle && ['DRAFT', 'OPEN'].includes(selectedObligation.status) ? (
                <button
                  type="button"
                  className="rounded border border-danger px-3 py-2 text-sm text-danger"
                  onClick={() => setSurface('cancel')}
                >
                  {t('contract-registry:obligations.actions.cancel')}
                </button>
              ) : null}
              {canManageLifecycle &&
              ['ACCEPTED', 'CANCELLED'].includes(selectedObligation.status) ? (
                <button
                  type="button"
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => setSurface('archive')}
                >
                  {t('contract-registry:obligations.actions.archive')}
                </button>
              ) : null}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-text">
                {t('contract-registry:obligations.historyTitle')}
              </h4>
              <ul className="space-y-2 text-sm">
                {selectedObligation.statusHistory.map((transition, index) => (
                  <li
                    key={`${transition.occurredAt}:${transition.toStatus}:${index}`}
                    className="rounded border border-border bg-bg px-3 py-2"
                  >
                    {transition.fromStatus
                      ? t(`contract-registry:obligations.statuses.${transition.fromStatus}`)
                      : t('contract-registry:obligations.values.created')}{' '}
                    -&gt; {t(`contract-registry:obligations.statuses.${transition.toStatus}`)}
                    <span className="block text-xs text-muted">
                      {formatBusinessTimestamp(transition.occurredAt)} ·{' '}
                      {t('contract-registry:obligations.values.displayUnavailable')} (
                      {readReferenceDisplay(null, transition.actorId)})
                    </span>
                    {transition.reason ? (
                      <span className="block text-muted">{transition.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-text">
                {t('contract-registry:obligations.directRefsTitle')}
              </h4>
              {selectedObligation.latestEvidenceRefs.length === 0 ? (
                <p className="text-sm text-muted">
                  {t('contract-registry:obligations.empty.noDirectRefs')}
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {selectedObligation.latestEvidenceRefs.map((ref, index) => (
                    <li key={`${ref.type}:${ref.label}:${index}`}>
                      {t(`contract-registry:obligations.evidenceRefTypes.${ref.type}`)} -{' '}
                      {ref.label}: {ref.url ?? ref.referenceId ?? '-'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canReadEventEvidence ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-text">
                  {t('contract-registry:obligations.eventEvidenceTitle')}
                </h4>
                <p className="mb-2 text-sm text-muted">
                  {t('contract-registry:obligations.helpers.snapshot')}
                </p>
                {linksQuery.isPending ? <LoadingState lines={3} /> : null}
                {!linksQuery.isPending && links.length === 0 ? (
                  <p className="text-sm text-muted">
                    {t('contract-registry:obligations.empty.noEventEvidence')}
                  </p>
                ) : null}
                {links.length > 0 ? (
                  <div className="overflow-x-auto rounded border border-border">
                    <table className="min-w-full divide-y divide-border text-left text-sm">
                      <thead className="bg-bg text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">
                            {t('contract-registry:obligations.fields.eventSnapshot')}
                          </th>
                          <th className="px-3 py-2">
                            {t('contract-registry:obligations.fields.linkStatus')}
                          </th>
                          <th className="px-3 py-2">
                            {t('contract-registry:obligations.fields.completedAt')}
                          </th>
                          <th className="px-3 py-2">
                            {t('contract-registry:obligations.fields.linkedAt')}
                          </th>
                          <th className="px-3 py-2">{t('contract-registry:table.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {links.map((link) => (
                          <tr key={link.id}>
                            <td className="px-3 py-2">
                              <span className="font-medium">{link.snapshot.eventCode}</span>
                              <span className="block">{link.snapshot.eventTitle}</span>
                              <span className="block text-muted">
                                {t(
                                  `contract-registry:obligations.eventStatuses.${link.snapshot.eventStatus}`,
                                )}{' '}
                                · {t('contract-registry:obligations.fields.eventUpdatedAt')}:{' '}
                                {formatBusinessTimestamp(link.snapshot.eventUpdatedAt)}
                              </span>
                              <span className="block text-muted">
                                {link.snapshot.completionEvidenceNote}
                              </span>
                              {selectedObligation.latestEventEvidenceLinkIds.includes(link.id) ? (
                                <span className="block font-medium text-accent">
                                  {t('contract-registry:obligations.values.selectedForDelivery')}
                                </span>
                              ) : null}
                              {link.snapshot.completionEvidenceRefs.map((ref, index) => (
                                <span
                                  key={`${ref.type}:${ref.label}:${index}`}
                                  className="block text-muted"
                                >
                                  {t(`contract-registry:obligations.evidenceRefTypes.${ref.type}`)}{' '}
                                  - {ref.label}: {ref.url ?? ref.referenceId ?? '-'}
                                </span>
                              ))}
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge
                                status={link.status}
                                label={t(
                                  `contract-registry:obligations.linkStatuses.${link.status}`,
                                )}
                                toneByStatus={eventEvidenceLinkTone}
                              />
                            </td>
                            <td className="px-3 py-2">
                              {formatBusinessTimestamp(link.snapshot.eventCompletedAt)}
                              <span className="block text-muted">
                                {t('contract-registry:obligations.fields.completedBy')}:{' '}
                                {t('contract-registry:obligations.values.displayUnavailable')} (
                                {readReferenceDisplay(null, link.snapshot.eventCompletedByActorId)})
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {formatBusinessTimestamp(link.linkedAt)}
                              <span className="block text-muted">
                                {t('contract-registry:obligations.fields.linkedBy')}:{' '}
                                {t('contract-registry:obligations.values.displayUnavailable')} (
                                {readReferenceDisplay(null, link.linkedByActorId)})
                              </span>
                              <span className="block text-muted">{link.linkReason}</span>
                              {link.status === 'REMOVED' ? (
                                <span className="block text-muted">
                                  {t('contract-registry:obligations.fields.removedAt')}:{' '}
                                  {formatBusinessTimestamp(link.removedAt ?? link.updatedAt)} -{' '}
                                  {t('contract-registry:obligations.values.displayUnavailable')} (
                                  {readReferenceDisplay(null, link.removedByActorId)}) -{' '}
                                  {link.removeReason}
                                </span>
                              ) : null}
                              {link.actionHistory.map((action, index) => (
                                <span
                                  key={`${action.action}:${action.occurredAt}:${index}`}
                                  className="mt-1 block border-t border-border pt-1 text-xs text-muted"
                                >
                                  <span className="font-medium text-text">
                                    {t(
                                      `contract-registry:obligations.linkActions.${action.action}`,
                                    )}
                                  </span>{' '}
                                  - {formatBusinessTimestamp(action.occurredAt)}
                                  <span className="block">{action.reason}</span>
                                  <ActorReferenceDisplay
                                    actorId={action.actorId}
                                    label={t('contract-registry:obligations.fields.actionActor')}
                                  />
                                </span>
                              ))}
                            </td>
                            <td className="px-3 py-2">
                              {canRemoveEvent &&
                              selectedObligation.status === 'OPEN' &&
                              link.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  className="rounded border border-danger px-2 py-1 text-xs text-danger"
                                  onClick={() => {
                                    setSelectedLinkId(link.id);
                                    setSurface('remove-link');
                                  }}
                                >
                                  {t('contract-registry:obligations.actions.removeLink')}
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
                {t('contract-registry:obligations.eventEvidenceReadRestricted')}
              </div>
            )}
          </div>
        ) : null}
        {surface === 'create' ? (
          <ObligationForm
            isPending={createMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(payload) =>
              runMutation(
                () => createMutation.mutateAsync({ contractRecordId: record.id, payload }),
                'contract-registry:obligations.feedback.created',
              )
            }
          />
        ) : null}
        {surface === 'edit' && selectedObligation ? (
          <ObligationForm
            initial={selectedObligation}
            isPending={updateMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(payload) =>
              runMutation(
                () => updateMutation.mutateAsync({ obligationId: selectedObligation.id, payload }),
                'contract-registry:obligations.feedback.updated',
              )
            }
          />
        ) : null}
        {surface === 'deliver' && selectedObligation ? (
          <DeliveryForm
            obligation={selectedObligation}
            links={links}
            isPending={deliverMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(payload) =>
              runMutation(
                () => deliverMutation.mutateAsync({ obligationId: selectedObligation.id, payload }),
                'contract-registry:obligations.feedback.delivered',
              )
            }
          />
        ) : null}
        {surface === 'accept' && selectedObligation ? (
          <AcceptForm
            isPending={acceptMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(reviewNote) =>
              runMutation(
                () =>
                  acceptMutation.mutateAsync({
                    obligationId: selectedObligation.id,
                    payload: { reviewNote },
                  }),
                'contract-registry:obligations.feedback.accepted',
              )
            }
          />
        ) : null}
        {surface === 'reject' && selectedObligation ? (
          <ReasonForm
            surface="reject"
            isPending={rejectMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(reason) =>
              runMutation(
                () =>
                  rejectMutation.mutateAsync({
                    obligationId: selectedObligation.id,
                    payload: { reason },
                  }),
                'contract-registry:obligations.feedback.rejected',
              )
            }
          />
        ) : null}
        {surface === 'reopen' && selectedObligation ? (
          <ReasonForm
            surface="reopen"
            isPending={reopenMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(reason) =>
              runMutation(
                () =>
                  reopenMutation.mutateAsync({
                    obligationId: selectedObligation.id,
                    payload: { reason },
                  }),
                'contract-registry:obligations.feedback.reopened',
              )
            }
          />
        ) : null}
        {surface === 'cancel' && selectedObligation ? (
          <ReasonForm
            surface="cancel"
            isPending={cancelMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(reason) =>
              runMutation(
                () =>
                  cancelMutation.mutateAsync({
                    obligationId: selectedObligation.id,
                    payload: { reason },
                  }),
                'contract-registry:obligations.feedback.cancelled',
              )
            }
          />
        ) : null}
        {surface === 'archive' && selectedObligation ? (
          <ReasonForm
            surface="archive"
            isPending={archiveMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(reason) =>
              runMutation(
                () =>
                  archiveMutation.mutateAsync({
                    obligationId: selectedObligation.id,
                    payload: { reason },
                  }),
                'contract-registry:obligations.feedback.archived',
              )
            }
          />
        ) : null}
        {surface === 'link-event' && selectedObligation ? (
          <LinkEventForm
            isPending={linkMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(payload) =>
              runMutation(
                () => linkMutation.mutateAsync({ obligationId: selectedObligation.id, payload }),
                'contract-registry:obligations.feedback.eventLinked',
              )
            }
          />
        ) : null}
        {surface === 'remove-link' && selectedLink ? (
          <ReasonForm
            surface="remove-link"
            isPending={removeLinkMutation.isPending}
            onCancel={closeSurface}
            onSubmit={(removeReason) =>
              runMutation(
                () =>
                  removeLinkMutation.mutateAsync({
                    linkId: selectedLink.id,
                    payload: { removeReason },
                  }),
                'contract-registry:obligations.feedback.eventRemoved',
              )
            }
          />
        ) : null}
      </div>
    </MetadataSection>
  );
};
