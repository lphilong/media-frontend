import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  isAccessAssignmentPeriodScope,
  isAccessAssignmentScopeWithoutTarget,
} from '@modules/role/model/access-assignment-requirements';
import type { AccessAssignmentScopeType } from '@modules/role/types/role.types';
import { EmptyState } from '@shared/components/primitives';
import {
  AsyncReferencePicker,
  type ReferenceOption,
  useReferenceRegistry,
} from '@shared/components/reference';

type AccessAssignmentReferenceLoaders = {
  loadEventReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadOrgUnitReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadPlatformAccountReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadStudioResourceReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
  loadTalentGroupReferenceOptions: (search: string) => Promise<ReferenceOption[]>;
};

export const AccessAssignmentScopeResolver = ({
  requiredScopeTypes,
  unsupportedScopeTypes,
  scopeTargetIds,
  scopePeriodKeys,
  onTargetChange,
  onSelectedTargetChange,
  onPeriodChange,
}: {
  requiredScopeTypes: AccessAssignmentScopeType[];
  unsupportedScopeTypes: AccessAssignmentScopeType[];
  scopeTargetIds: Record<string, string | undefined>;
  scopePeriodKeys: Record<string, string | undefined>;
  onTargetChange: (scopeType: AccessAssignmentScopeType, value?: string) => void;
  onSelectedTargetChange: (
    scopeType: AccessAssignmentScopeType,
    option: ReferenceOption | undefined,
  ) => void;
  onPeriodChange: (scopeType: AccessAssignmentScopeType, value?: string) => void;
}): JSX.Element => {
  const { t } = useTranslation('role');
  const {
    loadEventReferenceOptions,
    loadOrgUnitReferenceOptions,
    loadPlatformAccountReferenceOptions,
    loadStudioResourceReferenceOptions,
    loadTalentGroupReferenceOptions,
  } = useReferenceRegistry<AccessAssignmentReferenceLoaders>();
  const objectScopeLoaders = useMemo<
    Partial<Record<AccessAssignmentScopeType, (search: string) => Promise<ReferenceOption[]>>>
  >(
    () => ({
      managedTalentGroup: loadTalentGroupReferenceOptions,
      managedOrgUnit: loadOrgUnitReferenceOptions,
      assignedPlatformAccount: loadPlatformAccountReferenceOptions,
      assignedEvent: loadEventReferenceOptions,
      assignedStudioResource: loadStudioResourceReferenceOptions,
    }),
    [
      loadEventReferenceOptions,
      loadOrgUnitReferenceOptions,
      loadPlatformAccountReferenceOptions,
      loadStudioResourceReferenceOptions,
      loadTalentGroupReferenceOptions,
    ],
  );
  const scopeLoadOptionsByType = useMemo(
    () =>
      Object.fromEntries(
        requiredScopeTypes.map((scopeType) => [
          scopeType,
          buildAssignmentReferenceLoader(objectScopeLoaders[scopeType] ?? emptyAssignmentOptions),
        ]),
      ) as Partial<
        Record<AccessAssignmentScopeType, (search: string) => Promise<ReferenceOption[]>>
      >,
    [objectScopeLoaders, requiredScopeTypes],
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text">{t('accessAssignment.scopeTitle')}</p>
        <p className="mt-1 text-xs text-muted">{t('accessAssignment.scopeSubtitle')}</p>
      </div>
      {requiredScopeTypes.length === 0 ? (
        <EmptyState
          variant="inline"
          title={t('accessAssignment.noScopeTitle')}
          message={t('accessAssignment.noScopeMessage')}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {requiredScopeTypes.map((scopeType) => (
            <div key={scopeType} className="rounded border border-border bg-bg p-3">
              <p className="text-sm font-semibold text-text">
                {t(`accessAssignment.scopeTypes.${scopeType}`, { defaultValue: scopeType })}
              </p>
              {unsupportedScopeTypes.includes(scopeType) ? (
                <p className="mt-2 text-sm text-danger">{t('accessAssignment.scopeUnavailable')}</p>
              ) : isAccessAssignmentScopeWithoutTarget(scopeType) ? (
                <p className="mt-2 text-sm text-muted">
                  {scopeType === 'self'
                    ? t('accessAssignment.scopeReadOnlyHelp.self')
                    : t('accessAssignment.scopeReadOnlyHelp.default')}
                </p>
              ) : isAccessAssignmentPeriodScope(scopeType) ? (
                <label className="mt-2 block">
                  <span className="text-xs font-medium uppercase text-muted">
                    {t('accessAssignment.periodLabel')}
                  </span>
                  <input
                    type="month"
                    value={scopePeriodKeys[scopeType] ?? ''}
                    onChange={(event) => onPeriodChange(scopeType, event.target.value)}
                    className="mt-1 w-full rounded border border-border bg-panel px-2 py-2 text-sm"
                  />
                </label>
              ) : (
                <AsyncReferencePicker
                  pickerId={`role-access-assignment-scope-${scopeType}`}
                  value={scopeTargetIds[scopeType]}
                  onChange={(value) => onTargetChange(scopeType, value)}
                  onSelectedOptionChange={(option) => onSelectedTargetChange(scopeType, option)}
                  loadOptions={scopeLoadOptionsByType[scopeType] ?? emptyAssignmentOptions}
                  placeholder={t('accessAssignment.scopeSearchPlaceholder')}
                  resourceLabel={t(`accessAssignment.scopeTypes.${scopeType}`, {
                    defaultValue: scopeType,
                  })}
                  showTechnicalMetadata={false}
                  emptySlot={<p className="text-xs text-muted">{t('accessAssignment.scopeNoResults')}</p>}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const sanitizeAssignmentReferenceOption = (option: ReferenceOption): ReferenceOption => ({
  ...option,
  code: undefined,
  status: undefined,
  state: undefined,
  badges: undefined,
  meta: option.meta
    ? {
        employeeCode: option.meta.employeeCode,
        employmentStatus: option.meta.employmentStatus,
      }
    : undefined,
});

const emptyAssignmentOptions = (): Promise<ReferenceOption[]> => Promise.resolve([]);

const buildAssignmentReferenceLoader = (
  loader: (search: string) => Promise<ReferenceOption[]>,
): ((search: string) => Promise<ReferenceOption[]>) =>
  (search) => loader(search).then((options) => options.map(sanitizeAssignmentReferenceOption));
