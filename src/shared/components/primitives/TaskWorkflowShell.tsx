import type { ReactNode } from 'react';

type TaskWorkflowShellProps = {
  title: string;
  description: string;
  stepLabel?: string;
  cancelLabel: string;
  onCancel: () => void;
  children: ReactNode;
};

export const TaskWorkflowShell = ({
  title,
  description,
  stepLabel,
  cancelLabel,
  onCancel,
  children,
}: TaskWorkflowShellProps): JSX.Element => {
  return (
    <section className="rounded-lg border border-border bg-panel p-4 shadow-shell">
      <header className="mb-4 flex flex-col gap-3 border-b border-border pb-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <p className="max-w-3xl text-sm text-muted">{description}</p>
          {stepLabel ? (
            <p className="text-xs font-medium uppercase text-muted">{stepLabel}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="self-start rounded border border-border bg-panel px-3 py-2 text-sm"
        >
          {cancelLabel}
        </button>
      </header>
      {children}
    </section>
  );
};
