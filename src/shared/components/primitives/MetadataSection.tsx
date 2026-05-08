import type { ReactNode } from 'react';

import { SectionHeader } from '@shared/components/primitives/SectionHeader';

type MetadataSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export const MetadataSection = ({
  title,
  subtitle,
  children,
}: MetadataSectionProps): JSX.Element => {
  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-shell">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="pt-1">{children}</div>
    </section>
  );
};
