import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import {
  buildCommissionSettlementsBySourceRuleHref,
  buildEntityDetailHref,
} from '@app/router/reference-links';
import { createCommissionRuleActionRailItems } from '@modules/commission/actions/commission-action-rail';
import { CommissionRuleDraftCoreSurface } from '@modules/commission/forms/commission-mutation-forms';
import {
  useCommissionRuleDetail,
  useCommissionRuleLifecycleMutation,
  useUpdateCommissionRuleDraftCoreMutation,
} from '@modules/commission/hooks/use-commission';
import { commissionRuleStatusToneMap } from '@modules/commission/tables/commission-columns';
import type { CommissionRuleLifecycleAction } from '@modules/commission/types/commission.types';
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
  formatDecimal,
  formatCreatedDate,
  formatUtcMidnightDateLike,
  formatBusinessTimestamp,
} from '@shared/formatting/formatters';
import { readReferenceDisplay } from '@shared/formatting/reference-display';
import { ModuleDetailScreenShell } from '@shared/modules';

type ActiveSurface = 'draft-core' | null;

const formatNullable = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const formatNullableUtcMidnight = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return formatUtcMidnightDateLike(value);
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

const readLifecycleConfirmKey = (action: CommissionRuleLifecycleAction): string => {
  switch (action) {
    case 'activate':
      return 'commission:rules.confirm.activate';
    case 'deactivate':
      return 'commission:rules.confirm.deactivate';
    case 'archive':
      return 'commission:rules.confirm.archive';
    default:
      return 'commission:rules.confirm.archive';
  }
};

export const CommissionRuleDetailPage = (): JSX.Element => {
  const { commissionRuleId } = useParams<{ commissionRuleId: string }>();
  const { t } = useTranslation(['commission', 'common', 'errors']);
  const detailQuery = useCommissionRuleDetail(commissionRuleId);
  const capabilitiesQuery = useCurrentActorCapabilities();
  const draftCoreMutation = useUpdateCommissionRuleDraftCoreMutation();
  const lifecycleMutation = useCommissionRuleLifecycleMutation();
  const { notifyError, notifySuccess } = useMutationFeedback();
  const requestDestructiveConfirm = useDestructiveConfirm();
  const [activeSurface, setActiveSurface] = useState<ActiveSurface>(null);

  useEffect(() => {
    setActiveSurface(null);
  }, [commissionRuleId]);

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
    async (action: CommissionRuleLifecycleAction) => {
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
          commissionRuleId: record.id,
          action,
        });
        notifySuccess('commission:rules.feedback.lifecycleUpdated');
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
      permission: PERMISSIONS.COMMISSION_RULE_MANAGE_LIFECYCLE,
      scope: { module: 'commission' as const, value: 'global' as const },
    };

    return applyActionCapabilityHints(
      createCommissionRuleActionRailItems(t, record, {
        onDraftCoreEdit: () => setActiveSurface('draft-core'),
        onLifecycleAction,
        isLifecyclePending: (action) =>
          lifecycleMutation.isPending &&
          lifecycleMutation.variables?.commissionRuleId === record.id &&
          lifecycleMutation.variables?.action === action,
      }),
      {
        'draft-core': createActionCapabilityHint(
          capabilityState,
          {
            permission: PERMISSIONS.COMMISSION_RULE_UPDATE,
            scope: { module: 'commission', value: 'global' },
          },
          capabilityCopy,
        ),
        activate: createActionCapabilityHint(capabilityState, lifecycleRequirement, capabilityCopy),
        deactivate: createActionCapabilityHint(
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

  const beneficiaryId =
    record?.beneficiaryKind === 'EMPLOYMENT_PROFILE'
      ? record.beneficiaryEmploymentProfileId
      : record?.beneficiaryTalentId;
  const beneficiaryHref =
    record?.beneficiaryKind === 'EMPLOYMENT_PROFILE'
      ? buildEntityDetailHref('employmentProfile', beneficiaryId)
      : buildEntityDetailHref('talent', beneficiaryId);
  const sourceContractHref = buildEntityDetailHref(
    'contractRecord',
    record?.sourceContractRecordId,
  );
  const settlementsHref = buildCommissionSettlementsBySourceRuleHref(record?.id);

  return (
    <ModuleDetailScreenShell
      statusBadge={
        record ? (
          <StatusBadge
            status={record.status}
            label={t(`commission:rules.statuses.${record.status}`)}
            toneByStatus={commissionRuleStatusToneMap}
          />
        ) : undefined
      }
      readOnlyNotice={
        record?.status === 'ARCHIVED' || record?.status === 'ACTIVE' ? (
          <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
            {record.status === 'ARCHIVED'
              ? t('commission:rules.detail.archivedReadOnly')
              : t('commission:rules.detail.activeReadOnly')}
          </div>
        ) : undefined
      }
      summarySection={
        record ? (
          <MetadataSection title={t('commission:rules.detail.identityTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'rule-code',
                  label: t('commission:rules.fields.ruleCode'),
                  value: <ReferenceChip label={record.ruleCode} />,
                },
                {
                  key: 'title',
                  label: t('commission:rules.fields.title'),
                  value: record.title,
                },
                {
                  key: 'status',
                  label: t('commission:rules.fields.status'),
                  value: t(`commission:rules.statuses.${record.status}`),
                },
                {
                  key: 'scope',
                  label: t('commission:rules.fields.scopeBoundary'),
                  value: t('commission:globalOnly'),
                },
              ]}
              columns={2}
            />
          </MetadataSection>
        ) : undefined
      }
      metadataSection={
        record ? (
          <MetadataSection title={t('commission:rules.detail.ruleTermsTitle')}>
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'settlement-kind',
                  label: t('commission:rules.fields.settlementKind'),
                  value: t(`commission:settlementKinds.${record.settlementKind}`),
                },
                {
                  key: 'basis',
                  label: t('commission:rules.fields.settlementBasis'),
                  value: t(`commission:settlementBases.${record.settlementBasis}`),
                },
                {
                  key: 'rate',
                  label: t('commission:rules.fields.ratePercent'),
                  value: `${formatDecimal(record.ratePercent, undefined, 4)}%`,
                },
                {
                  key: 'revenue-kinds',
                  label: t('commission:rules.fields.appliesToRevenueKinds'),
                  value: record.appliesToRevenueKinds
                    .map((kind) => t(`commission:revenueKinds.${kind}`))
                    .join(', '),
                },
                {
                  key: 'effective-start',
                  label: t('commission:rules.fields.effectiveStartDate'),
                  value: formatUtcMidnightDateLike(record.effectiveStartDate),
                },
                {
                  key: 'effective-end',
                  label: t('commission:rules.fields.effectiveEndDate'),
                  value: formatNullableUtcMidnight(record.effectiveEndDate),
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
            <MetadataSection title={t('commission:rules.detail.beneficiaryTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'beneficiary-kind',
                    label: t('commission:rules.fields.beneficiaryKind'),
                    value: t(`commission:beneficiaryKinds.${record.beneficiaryKind}`),
                  },
                  {
                    key: 'beneficiary-id',
                    label: t('commission:rules.fields.beneficiaryId'),
                    value:
                      beneficiaryHref && beneficiaryId ? (
                        <Link className="text-accent hover:underline" to={beneficiaryHref}>
                          {readReferenceDisplay(record.beneficiaryRef, beneficiaryId)}
                        </Link>
                      ) : (
                        readReferenceDisplay(record.beneficiaryRef, beneficiaryId)
                      ),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('commission:rules.detail.sourceContractTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'source-contract',
                    label: t('commission:rules.fields.sourceContractRecordId'),
                    value:
                      sourceContractHref && record.sourceContractRecordId ? (
                        <Link className="text-accent hover:underline" to={sourceContractHref}>
                          {readReferenceDisplay(
                            record.sourceContractRecordRef,
                            record.sourceContractRecordId,
                          )}
                        </Link>
                      ) : (
                        readReferenceDisplay(
                          record.sourceContractRecordRef,
                          record.sourceContractRecordId,
                        )
                      ),
                  },
                ]}
                columns={1}
              />
            </MetadataSection>
            <MetadataSection title={t('commission:rules.detail.lifecycleTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'created',
                    label: t('commission:rules.fields.createdAt'),
                    value: formatCreatedDate(record.createdAt),
                  },
                  {
                    key: 'updated',
                    label: t('commission:rules.fields.updatedAt'),
                    value: formatBusinessTimestamp(record.updatedAt),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            <MetadataSection title={t('commission:rules.detail.freeTextTitle')}>
              <ReadOnlyFieldGrid
                fields={[
                  {
                    key: 'description',
                    label: t('commission:rules.fields.description'),
                    value: formatNullable(record.description),
                  },
                  {
                    key: 'external-ref',
                    label: t('commission:rules.fields.externalRef'),
                    value: formatNullable(record.externalRef),
                  },
                ]}
                columns={2}
              />
            </MetadataSection>
            {activeSurface === 'draft-core' ? (
              <CommissionRuleDraftCoreSurface
                initialValues={record}
                isPending={draftCoreMutation.isPending}
                onCancel={() => setActiveSurface(null)}
                onSubmit={async (payload) => {
                  try {
                    await draftCoreMutation.mutateAsync({
                      commissionRuleId: record.id,
                      payload,
                    });
                    notifySuccess('commission:rules.feedback.updated');
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
          <RelatedSectionShell title={t('commission:rules.related.navigationTitle')}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {sourceContractHref ? (
                <Link
                  to={sourceContractHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('commission:rules.related.sourceContract')}
                </Link>
              ) : null}
              {beneficiaryHref ? (
                <Link
                  to={beneficiaryHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('commission:rules.related.beneficiary')}
                </Link>
              ) : null}
              {settlementsHref ? (
                <Link
                  to={settlementsHref}
                  className="rounded border border-border bg-bg px-3 py-2 text-sm text-accent hover:underline"
                >
                  {t('commission:rules.related.settlementsByRule')}
                </Link>
              ) : null}
            </div>
          </RelatedSectionShell>
        ) : undefined
      }
      actionRail={<ActionRail title={t('commission:rules.actionRail.title')} items={actionItems} />}
      state={detailState}
      loadingState={<LoadingState lines={8} />}
      deniedState={<PermissionDeniedState />}
      notFoundState={<NotFoundState />}
      errorState={
        <ErrorState
          title={t('commission:rules.states.loadErrorTitle')}
          message={readErrorMessage(t, detailError, 'commission:rules.states.loadErrorMessage')}
          actionLabel={t('common:actions.retry')}
          onRetry={() => void detailQuery.refetch()}
        />
      }
    />
  );
};
