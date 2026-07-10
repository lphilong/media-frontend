import type { ReactNode } from 'react';

import { SessionArea } from '@shared/components/shell/SessionArea';
import { BreadcrumbTrail } from '@shared/components/shell/BreadcrumbTrail';

type BreadcrumbItem = {
  label: string;
  to?: string;
};

type AppTopBarProps = {
  breadcrumbs: BreadcrumbItem[];
  pageTitle: string;
  pageSubtitle?: string;
  pageActions?: ReactNode;
  utilityArea?: ReactNode;
};

export const AppTopBar = ({
  breadcrumbs,
  pageTitle,
  pageSubtitle,
  pageActions,
  utilityArea,
}: AppTopBarProps): JSX.Element => {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-panel/95 px-4 py-3 backdrop-blur">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <BreadcrumbTrail items={breadcrumbs} />
        <div className="flex items-center gap-2">
          {utilityArea}
          <SessionArea />
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text">{pageTitle}</h1>
          {pageSubtitle ? <p className="text-sm text-muted">{pageSubtitle}</p> : null}
        </div>
        <div
          id="page-action-region"
          data-testid="page-action-region"
          className="flex items-center gap-2"
        >
          {pageActions}
        </div>
      </div>
    </div>
  );
};
