import { useTranslation } from 'react-i18next';

import { ActionRail } from '@shared/components/primitives/ActionRail';
import { BlockerBanner } from '@shared/components/primitives/BlockerBanner';
import { EmptyState } from '@shared/components/primitives/EmptyState';
import { FilterBarShell } from '@shared/components/primitives/FilterBarShell';
import { MetadataSection } from '@shared/components/primitives/MetadataSection';
import { ReadOnlyFieldGrid } from '@shared/components/primitives/ReadOnlyFieldGrid';
import { ReferenceChip } from '@shared/components/primitives/ReferenceChip';
import { RelatedSectionShell } from '@shared/components/primitives/RelatedSectionShell';
import { SearchBoxSeam } from '@shared/components/primitives/SearchBoxSeam';
import { SortControlSeam } from '@shared/components/primitives/SortControlSeam';
import { StatusBadge } from '@shared/components/primitives/StatusBadge';
import type { I18nNamespace } from '@shared/i18n/constants';
import { ModuleDetailScreenShell, ModuleListScreenShell } from '@shared/modules';
import { noop } from '@shared/utils/noop';

type ModulePlaceholderPageProps = {
  namespace: I18nNamespace;
  placeholderKey: string;
  mode?: 'list' | 'detail';
  entityId?: string;
};

export const ModulePlaceholderPage = ({
  namespace,
  placeholderKey,
  mode = 'list',
  entityId,
}: ModulePlaceholderPageProps): JSX.Element => {
  const { t } = useTranslation([namespace, 'common']);

  if (mode === 'detail') {
    return (
      <ModuleDetailScreenShell
        statusBadge={<StatusBadge label={t('common:placeholders.waveStubState')} />}
        readOnlyNotice={
          <BlockerBanner
            title={t('common:placeholders.foundationOnlyTitle')}
            message={t('common:placeholders.waveStubSubtitle')}
          />
        }
        summarySection={
          <MetadataSection
            title={t('common:placeholders.detailSummaryTitle')}
            subtitle={t('common:placeholders.waveStubSubtitle')}
          >
            <ReadOnlyFieldGrid
              fields={[
                {
                  key: 'record-id',
                  label: t('common:labels.recordId'),
                  value: <ReferenceChip label={entityId ?? '-'} />,
                },
                {
                  key: 'wave-state',
                  label: t('common:labels.waveState'),
                  value: t('common:placeholders.waveStubState'),
                },
              ]}
            />
          </MetadataSection>
        }
        metadataSection={
          <MetadataSection title={t('common:placeholders.detailMetadataTitle')}>
            <EmptyState
              title={t('common:placeholders.foundationOnlyTitle')}
              message={t(placeholderKey)}
              variant="inline"
            />
          </MetadataSection>
        }
        relatedSection={
          <RelatedSectionShell
            title={t('common:placeholders.relatedSectionTitle')}
            subtitle={t('common:placeholders.relatedSectionSubtitle')}
          >
            <EmptyState
              title={t('common:placeholders.relatedSectionTitle')}
              message={t('common:placeholders.relatedSectionMessage')}
              variant="inline"
            />
          </RelatedSectionShell>
        }
        actionRail={
          <ActionRail
            title={t('common:placeholders.actionRailTitle')}
            items={[
              {
                id: 'detail-action-placeholder',
                label: t('common:placeholders.actionRailPlaceholder'),
                disabled: true,
              },
            ]}
          />
        }
      />
    );
  }

  return (
    <ModuleListScreenShell
      filterBar={
        <FilterBarShell
          searchSlot={<SearchBoxSeam value="" onApply={noop} />}
          sortSlot={<SortControlSeam options={[]} onChange={noop} />}
        >
          <p className="text-xs text-muted">{t('common:placeholders.waveStubSubtitle')}</p>
        </FilterBarShell>
      }
      pageActionRegion={
        <button
          type="button"
          disabled
          className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted disabled:cursor-not-allowed"
        >
          {t('common:actions.stubAction')}
        </button>
      }
      tableSection={
        <MetadataSection
          title={t('common:placeholders.listSectionTitle')}
          subtitle={t('common:placeholders.waveStubSubtitle')}
        >
          <EmptyState
            title={t('common:placeholders.foundationOnlyTitle')}
            message={t(placeholderKey)}
            variant="inline"
          />
        </MetadataSection>
      }
      rowActionRegion={
        <div className="flex justify-end">
          <button
            type="button"
            disabled
            className="rounded border border-border bg-panel px-3 py-1.5 text-xs text-muted disabled:cursor-not-allowed"
          >
            {t('common:placeholders.actionRailPlaceholder')}
          </button>
        </div>
      }
      relatedSection={
        <RelatedSectionShell
          title={t('common:placeholders.relatedSectionTitle')}
          subtitle={t('common:placeholders.relatedSectionSubtitle')}
        >
          <EmptyState
            title={t('common:placeholders.relatedSectionTitle')}
            message={t('common:placeholders.relatedSectionMessage')}
            variant="inline"
          />
        </RelatedSectionShell>
      }
    />
  );
};
