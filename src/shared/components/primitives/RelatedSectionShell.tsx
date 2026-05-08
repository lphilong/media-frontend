import type { ReactNode } from 'react';

import { SectionHeader } from '@shared/components/primitives/SectionHeader';

type RelatedSectionShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export const RelatedSectionShell = ({
  title,
  subtitle,
  actions,
  children,
}: RelatedSectionShellProps): JSX.Element => {
  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-shell">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader title={title} subtitle={subtitle} />
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
};
