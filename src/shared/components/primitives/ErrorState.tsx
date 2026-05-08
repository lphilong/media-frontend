type ErrorStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onRetry?: () => void;
  variant?: 'panel' | 'inline';
};

export const ErrorState = ({
  title,
  message,
  actionLabel,
  onRetry,
  variant = 'panel',
}: ErrorStateProps): JSX.Element => {
  const wrapperClass =
    variant === 'inline'
      ? 'rounded border border-danger/30 bg-panel px-4 py-3'
      : 'rounded-lg border border-danger/30 bg-panel p-6 text-center shadow-shell';

  return (
    <div className={wrapperClass}>
      <p className="text-base font-semibold text-danger">{title}</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {actionLabel && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text hover:bg-slate-50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
};
