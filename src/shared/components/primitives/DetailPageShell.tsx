import type { ReactNode } from 'react';

import { PageContainer } from '@shared/components/primitives/PageContainer';

type DetailPageShellProps = {
  banner?: ReactNode;
  summarySection?: ReactNode;
  metadataSection?: ReactNode;
  relatedSection?: ReactNode;
  actionRail?: ReactNode;
  children?: ReactNode;
};

export const DetailPageShell = ({
  banner,
  summarySection,
  metadataSection,
  relatedSection,
  actionRail,
  children,
}: DetailPageShellProps): JSX.Element => {
  return (
    <PageContainer className="space-y-4">
      {banner}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          {summarySection}
          {metadataSection}
          {children}
          {relatedSection}
        </div>
        {actionRail ? <aside className="space-y-3">{actionRail}</aside> : null}
      </div>
    </PageContainer>
  );
};
