import type { ReactNode } from 'react';

import { PageContainer, PageHeader } from '@shared/components/primitives';
import {
  ModuleSurfaceStateGate,
  type ModuleSurfaceState,
} from '@shared/modules/module-surface-state';

export type ModuleDetailScreenShellProps = {
  title?: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  headerActions?: ReactNode;
  banner?: ReactNode;
  readOnlyNotice?: ReactNode;
  lockedNotice?: ReactNode;
  summarySection?: ReactNode;
  metadataSection?: ReactNode;
  sections?: ReactNode;
  relatedSection?: ReactNode;
  actionRail?: ReactNode;
  state?: ModuleSurfaceState;
  loadingState?: ReactNode;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  deniedState?: ReactNode;
  notFoundState?: ReactNode;
};

export const ModuleDetailScreenShell = ({
  title,
  subtitle,
  statusBadge,
  headerActions,
  banner,
  readOnlyNotice,
  lockedNotice,
  summarySection,
  metadataSection,
  sections,
  relatedSection,
  actionRail,
  state = 'ready',
  loadingState,
  emptyState,
  errorState,
  deniedState,
  notFoundState,
}: ModuleDetailScreenShellProps): JSX.Element => {
  const hasHeaderActions = Boolean(statusBadge) || Boolean(headerActions);

  return (
    <PageContainer className="space-y-4">
      {title ? (
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={
            hasHeaderActions ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {statusBadge}
                {headerActions}
              </div>
            ) : undefined
          }
        />
      ) : null}
      <div className="space-y-4">
        {banner}
        {readOnlyNotice}
        {lockedNotice}
        <ModuleSurfaceStateGate
          state={state}
          slots={{
            ready: (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                  {summarySection}
                  {metadataSection}
                  {sections}
                  {relatedSection}
                </div>
                {actionRail ? <aside className="space-y-3">{actionRail}</aside> : null}
              </div>
            ),
            loading: loadingState,
            empty: emptyState,
            error: errorState,
            denied: deniedState,
            notFound: notFoundState,
          }}
        />
      </div>
    </PageContainer>
  );
};
