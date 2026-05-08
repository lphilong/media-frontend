import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export const PageHeader = ({ title, subtitle, actions }: PageHeaderProps): JSX.Element => {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
      <div className="min-w-[220px]">
        <h1 className="text-xl font-semibold leading-tight text-text">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
};
