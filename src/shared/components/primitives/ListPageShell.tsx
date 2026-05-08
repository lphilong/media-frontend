import type { ReactNode } from 'react';

import { PageContainer } from '@shared/components/primitives/PageContainer';

type ListPageShellProps = {
  filterBar?: ReactNode;
  banner?: ReactNode;
  tableSection: ReactNode;
  pager?: ReactNode;
  relatedSection?: ReactNode;
};

export const ListPageShell = ({
  filterBar,
  banner,
  tableSection,
  pager,
  relatedSection,
}: ListPageShellProps): JSX.Element => {
  return (
    <PageContainer className="space-y-4">
      {banner}
      {filterBar}
      <section className="space-y-3">{tableSection}</section>
      {pager ? <div className="flex justify-end">{pager}</div> : null}
      {relatedSection}
    </PageContainer>
  );
};
