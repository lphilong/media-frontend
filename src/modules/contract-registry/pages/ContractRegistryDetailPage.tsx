import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  buildCommissionRulesByContractHref,
  buildEntityDetailHref,
} from '@app/router/reference-links';
import { createContractActionRailItems } from '@modules/contract-registry/actions/contract-registry-action-rail';
import {
  ContractAssignOwnerSurface,
  ContractDateActionSurface,
  ContractDraftCoreSurface,
  ContractFileReferenceSurface,
} from '@modules/contract-registry/forms/contract-registry-mutation-forms';
import {
  useAssignContractOwnerMutation,
  useContractLifecycleMutation,
  useContractRecordDetail,
  useExpireContractRecordMutation,
  useTerminateContractRecordMutation,
  useUpdateContractDraftCoreMutation,
  useUpdateContractFileReferenceMutation,
} from '@modules/contract-registry/hooks/use-contract-registry';
import { contractStatusToneMap } from '@modules/contract-registry/tables/contract-registry-columns';
import type { ContractLifecycleAction } from '@modules/contract-registry/types/contract-registry.types';
import type { NormalizedApiError } from '@shared/api';
import {
  ActionRail,
  ErrorState,
  LoadingState,
  MetadataSection,
  NotFoundState,
  PermissionDeniedState,
  ReadOnlyFieldGrid,
  ReferenceChip,
  RelatedSectionShell,
  StatusBadge,
  useDestructiveConfirm,
  useMutationFeedback,
} from '@shared/components/primitives';
import {
  applyActionCapabilityHints,
  createActionCapabilityHint,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CapabilityMissingReason,
} from '@shared/auth/current-actor-capabilities';
import {
  formatCreatedDate,
  formatUtcMidnightDateLike,
  formatBusinessTimestamp,
} from '@shared/formatting/formatters';
import { readReferenceDisplay } from '@shared/formatting/reference-display';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface =
  | 'draft-core'
  | 'assign-owner'
  | 'file-reference'
  | 'expire'
  | 'terminate'
  | null;

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const readErrorMessage = (
  t: (key: string) => string,
  error: NormalizedApiError | null | undefined,
  fallbackKey: string,
): string => {
  if (!error?.message) {
    return t(fallbackKey);
  }

  return error.message.includes(':') ? t(error.message) : error.message;
};

const readLifecycleConfirmKey = (action: ContractLifecycleAction): string => {
  switch (action) {
    case 'mark-pending-signature':
      return 'contract-registry:confirm.markPendingSignature';
    case 'reopen-draft':
      return 'contract-registry:confirm.reopenDraft';
    case 'activate':
      return 'contract-registry:confirm.activate';
    case 'archive':
      return 'contract-registry:confirm.archive';
    default:
      return 'contract-registry:confirm.archive';
  }
};

export const ContractRegistryDetailPage = (): JSX.Element => {
  const { contractRecordId } = useParams<{ contractRecordId: string }>();
  const { t } = useTranslation(['contract-registry', 'common', 'errors']);
  const detailQuery = useContractRecordDetail(contractRecordId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const draftCoreMutation = useUpdateContractDraftCoreMutation();
  const assignOwnerMutation = useAssignContractOwnerMutation();
  const fileReferenceMutation = useUpdateContractFileReferenceMutation();
  const expireMutation = useExpireContractRecordMutation();
  const terminateMutation = useTerminateContractRecordMutation();
  const lifecycleMutation = useContractLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [contractRecordId]);

  const capabilityCopy = useMemo<Record<CapabilityMissingReason, string>>(
    () => ({
      loading: t('common:capabilities.checkingPermissions'),
      'missing-permission': t('common:capabilities.missingPermission'),
      'missing-scope': t('common:capabilities.missingScope'),
    }),
    [t],
  );

  const detailError = detailQuery.error as NormalizedApiError | null;
  const detailState = useMemo(() => {
    if (detailQuery.isPending) {
      return 'loading' as const;
    }

    if (detailQuery.isError) {
      if (detailError?.permissionDenied) {
        return 'denied' as const;
      }

      if (detailError?.notFound) {
        return 'not-found' as const;
      }

      return 'error' as const;
    }

    return 'ready' as const;
  }, [
    detailError?.notFound,
    detailError?.permissionDenied,
    detailQuery.isError,
    detailQuery.isPending,
  ]);

  const record = detailQuery.data;

  const onLifecycleAction = useCallback(
    async (action: ContractLifecycleAction) => {
      if (!record) {
        return;
      }

      const confirmed = await requestDestructiveConfirm({
        description: t(readLifecycleConfirmKey(action)),
      });
      if (!confirmed) {
        return;
      }

      try {
        await lifecycleMutation.mutateAsync({
          contractRecordId: record.id,
          action,
        });
        notifySuccess('contract-registry:feedback.lifecycleUpdated');
      } catch (error) {
        notifyError(error as NormalizedApiError);
      }
    },
    [lifecycleMutation, notifyError, notifySuccess, record, requestDestructiveConfirm, t],
  );

  const actionItems = useMemo(() => {
    if (!record) {
      return [];
    }

    const capabilityState = {
      capabilities: capabilitiesQuery.data,
      isLoading: capabilitiesQuery.isLoading,
      isError: capabilitiesQuery.isError,
    };
    const lifecycleRequirement = {
      permission: PERMISSIONS.CONTRACT_REGISTRY_MANAGE_LIFECYCLE,
      scope: { module: 'contractRegistry' as const, value: 'global' as const },
    };

    return applyActionCapabilityHints(
      createContractActionRailItems(t, record, {
        onDraftCoreEdit: () => setActiveSurface('draft-core'),
        onAssignOwner: () => setActiveSurface('assign-owner'),
        onUpdateFileReference: () => setActiveSurface('file-reference'),
        onExpire: () => setActiveSurface('expire'),
        onTerminate: () => setActiveSurface('terminate'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.contractRecordId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        'draft-core': createActionCapabilityHint(
          capabilityState,
          {
            permission: PERMISSIONS.CONTRACT_REGISTRY_UPDATE,
            scope: { module: 'contractRegistry', value: 'global' },
          },
          capabilityCopy,
        ),
        'assign-owner': createActionCapabilityHint(
          capabilityState,
          {
            permission: PERMISSIONS.CONTRACT_REGISTRY_MANAGE_OWNER,
            scope: { module: 'contractRegistry', value: 'global' },
          },
          capabilityCopy,
        ),
        'file-reference': createActionCapabilityHint(
          capabilityState,
          {
            permission: PERMISSIONS.CONTRACT_REGISTRY_MANAGE_FILE_REFERENCE,
            scope: { module: 'contractRegistry', value: 'global' },
          },
          capabilityCopy,
        ),
        'mark-pending-signature': createActionCapabilityHint(
          capabilityState,
          lifecycleRequirement,
          capabilityCopy,
        ),
        'reopen-draft': createActionCapabilityHint(
          capabilityState,
          lifecycleRequirement,
          capabilityCopy,
        ),
        activate: createActionCapabilityHint(capabilityState, lifecycleRequirement, capabilityCopy),
        expire: createActionCapabilityHint(capabilityState, lifecycleRequirement, capabilityCopy),
        terminate: createActionCapabilityHint(
          capabilityState,
          lifecycleRequirement,
          capabilityCopy,
        ),
        archive: createActionCapabilityHint(capabilityState, lifecycleRequirement, capabilityCopy),
      },
    );
  }, [
    capabilityCopy,
    capabilitiesQuery.data,
    capabilitiesQuery.isError,
    capabilitiesQuery.isLoading,
    lifecycleMutation.isPending,
    lifecycleMutation.variables,
    onLifecycleAction,
    record,
    t,
  ]);

  const linkedEntityId =
    record?.linkedEntityKind === 'EMPLOYMENT_PROFILE'
      ? record.linkedEmploymentProfileId
      : record?.linkedTalentId;
  const linkedEntityRef =
    record?.linkedEntityKind === 'EMPLOYMENT_PROFILE'
      ? record.linkedEmploymentProfileRef
      : record?.linkedTalentRef;
  const linkedEntityHref =
    record?.linkedEntityKind === 'EMPLOYMENT_PROFILE'
      ? buildEntityDetailHref('employmentProfile', linkedEntityId)
      : buildEntityDetailHref('talent', linkedEntityId);
  const ownerHref = buildEntityDetailHref('employmentProfile', record?.ownerEmploymentProfileId);
  const commissionRulesHref = buildCommissionRulesByContractHref(record?.id);

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`contract-registry:statuses.${record.status}`)}
            toneByStatus={contractStatusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.status === 'ARCHIVED' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {t('contract-registry:detail.archivedReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('contract-registry:detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'contract-code',
                  label: t('contract-registry:generatedCode.label'),
                  value: <ReferenceChip label={record.contractCode} />,
                },
                {
                  key: 'title',
                  label: t('contract-registry:fields.title'),
                  value: record.title,
                },
                {
                  key: 'status',
                  label: t('contract-registry:fields.status'),
                  value: t(`contract-registry:statuses.${record.status}`),
                },
                {
                  key: 'scope',
                  label: t('contract-registry:fields.scopeBoundary'),
                  value: t('contract-registry:detail.globalOnly'),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('contract-registry:detail.contractMetadataTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'kind',
                  label: t('contract-registry:fields.contractKind'),
                  value: t(`contract-registry:contractKinds.${record.contractKind}`),
                },
                {
                  key: 'confidentiality',
                  label: t('contract-registry:fields.confidentialityTier'),
                  value: t(`contract-registry:confidentialityTiers.${record.confidentialityTier}`),
                },
                {
                  key: 'start',
                  label: t('contract-registry:fields.effectiveStartDate'),
                  value: formatUtcMidnightDateLike(record.effectiveStartDate),
                },
                {
                  key: 'end',
                  label: t('contract-registry:fields.effectiveEndDate'),
                  value: record.effectiveEndDate
                    ? formatUtcMidnightDateLike(record.effectiveEndDate)
                    : '-',
                },
                {
                  key: 'created',
                  label: t('contract-registry:fields.createdAt'),
                  value: formatCreatedDate(record.createdAt),
                },
                {
                  key: 'updated',
                  label: t('contract-registry:fields.updatedAt'),
                  value: formatBusinessTimestamp(record.updatedAt),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      sections={
        record ? (
          <div className="space-y-4">
            <MetadataSection title={t('contract-registry:detail.linkedEntityTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'linked-kind',
                    label: t('contract-registry:fields.linkedEntityKind'),
                    value: t(`contract-registry:linkedEntityKinds.${record.linkedEntityKind}`),
                  },
                  {
                    key: 'linked-id',
                    label: t('contract-registry:fields.linkedEntityId'),
                    value:
                      linkedEntityHref && linkedEntityId ? (
                        <Link className="text-accent hover:underline" to={linkedEntityHref}>
                          {readReferenceDisplay(linkedEntityRef, linkedEntityId)}
                        </Link>
                      ) : (
                        readReferenceDisplay(linkedEntityRef, linkedEntityId)
                      ),
                  },
                  {
                    key: 'owner',
                    label: t('contract-registry:fields.ownerEmploymentProfileId'),
                    value: ownerHref ? (
                      <Link className="text-accent hover:underline" to={ownerHref}>
                        {readReferenceDisplay(
                          record.ownerEmploymentProfileRef,
                          record.ownerEmploymentProfileId,
                        )}
                      </Link>
                    ) : (
                      readReferenceDisplay(
                        record.ownerEmploymentProfileRef,
                        record.ownerEmploymentProfileId,
                      )
                    ),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('contract-registry:detail.fileReferenceTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'file-reference-id',
                    label: t('contract-registry:fields.fileReferenceId'),
                    value: formatNullable(record.fileReferenceId),
                  },
                  {
                    key: 'file-display-name',
                    label: t('contract-registry:fields.fileDisplayName'),
                    value: formatNullable(record.fileDisplayName),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('contract-registry:detail.freeTextTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'description',
                    label: t('contract-registry:fields.description'),
                    value: formatNullable(record.description),
                  },
                  {
                    key: 'external-ref',
                    label: t('contract-registry:fields.externalRef'),
                    value: formatNullable(record.externalRef),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            {activeSurface === 'draft-core' ? (
              <ContractDraftCoreSurface
                initialValues={record}
                isPending={draftCoreMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await draftCoreMutation.mutateAsync({
                      contractRecordId: record.id,
                      payload,
                    });
                    notifySuccess('contract-registry:feedback.updated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'assign-owner' ? (
              <ContractAssignOwnerSurface
                initialOwnerEmploymentProfileId={record.ownerEmploymentProfileId}
                isPending={assignOwnerMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await assignOwnerMutation.mutateAsync({
                      contractRecordId: record.id,
                      payload,
                    });
                    notifySuccess('contract-registry:feedback.ownerAssigned');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'file-reference' ? (
              <ContractFileReferenceSurface
                initialFileReferenceId={record.fileReferenceId}
                initialFileDisplayName={record.fileDisplayName}
                isPending={fileReferenceMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await fileReferenceMutation.mutateAsync({
                      contractRecordId: record.id,
                      payload,
                    });
                    notifySuccess('contract-registry:feedback.fileReferenceUpdated');
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
            {activeSurface === 'expire' || activeSurface === 'terminate' ? (
              <ContractDateActionSurface
                action={activeSurface}
                isPending={
                  activeSurface === 'expire'
                    ? expireMutation.isPending
                    : terminateMutation.isPending
                }
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    if (activeSurface === 'expire') {
                      await expireMutation.mutateAsync({
                        contractRecordId: record.id,
                        payload: payload as { expiryDate: string },
                      });
                      notifySuccess('contract-registry:feedback.expired');
                    } else {
                      await terminateMutation.mutateAsync({
                        contractRecordId: record.id,
                        payload: payload as { terminationDate: string },
                      });
                      notifySuccess('contract-registry:feedback.terminated');
                    }
                    setActiveSurface(null);
                  } catch (error) {
                    notifyError(error as NormalizedApiError);
                  }
                }}
              />
            ) : null}
          </div>
        ) : undefined
      }
      relatedSection={
        record ? (
          <RelatedSectionShell title={t('contract-registry:related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {commissionRulesHref ? (
                <Link
                  to={commissionRulesHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('contract-registry:related.commissionRules')}
                </Link>
              ) : (
                <div className="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
                  {t('contract-registry:related.unavailable')}
                </div>
              )}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={
        <ActionRail title={t('contract-registry:actionRail.title')} items={actionItems} />
      }
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('contract-registry:states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'contract-registry:states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
