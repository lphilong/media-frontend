import type { ReactNode } from 'react';

import { PageContainer, PageHeader } from '@shared/components/primitives';
import {
  ModuleSurfaceStateGate,
  type ModuleSurfaceState,
} from '@shared/modules/module-surface-state';

export type ModuleListMode = 'flat-list' | 'related-list';

export type ModuleListScreenShellProps = {
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  mode?: ModuleListMode;
  banner?: ReactNode;
  pageActionRegion?: ReactNode;
  interactionSection?: ReactNode;
  filterBar?: ReactNode;
  tableSection: ReactNode;
  rowActionRegion?: ReactNode;
  pager?: ReactNode;
  relatedSection?: ReactNode;
  state?: ModuleSurfaceState;
  loadingState?: ReactNode;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  deniedState?: ReactNode;
  notFoundState?: ReactNode;
};

export const ModuleListScreenShell = ({
  title,
  subtitle,
  headerActions,
  mode = 'flat-list',
  banner,
  pageActionRegion,
  interactionSection,
  filterBar,
  tableSection,
  rowActionRegion,
  pager,
  relatedSection,
  state = 'ready',
  loadingState,
  emptyState,
  errorState,
  deniedState,
  notFoundState,
}: ModuleListScreenShellProps): JSX.Element => {
  const canShowQueryControls = state !== 'denied' && state !== 'not-found';

  return (
    <PageContainer className="space-y-4">
      {title ? <PageHeader title={title} subtitle={subtitle} actions={headerActions} /> : null}
      <div className="space-y-4" data-testid="module-list-shell" data-module-list-mode={mode}>
        {banner}
        {pageActionRegion ? <div className="flex justify-end">{pageActionRegion}</div> : null}
        {interactionSection}
        {canShowQueryControls ? filterBar : null}
        <ModuleSurfaceStateGate
          state={state}
          slots={{
            ready: (
              <div className="space-y-4">
                <section className="space-y-3">{tableSection}</section>
                {rowActionRegion}
                {pager ? <div className="flex justify-end">{pager}</div> : null}
                {relatedSection}
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
