import type { ReactNode } from 'react';

import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
  variant?: 'panel' | 'inline';
};

export const EmptyState = ({
  title,
  message,
  action,
  variant = 'panel',
}: EmptyStateProps): JSX.Element => {
  const wrapperClass =
    variant === 'inline'
      ? 'rounded border border-dashed border-border bg-panel px-4 py-3'
      : 'rounded-lg border border-dashed border-border bg-panel p-8 text-center shadow-shell';

  return (
    <div className={wrapperClass}>
      <Inbox className="mx-auto mb-3 h-8 w-8 text-muted" />
      <p className="text-base font-medium text-text">{title}</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
};
