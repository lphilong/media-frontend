import clsx from 'clsx';

type LoadingStateProps = {
  lines?: number;
  className?: string;
  variant?: 'panel' | 'inline' | 'table';
};

export const LoadingState = ({
  lines = 4,
  className,
  variant = 'panel',
}: LoadingStateProps): JSX.Element => {
  const wrapperClass =
    variant === 'inline'
      ? 'space-y-2 rounded border border-border bg-panel px-3 py-2'
      : variant === 'table'
        ? 'space-y-2 rounded-lg border border-border bg-panel p-3'
        : 'space-y-2 rounded-lg border border-border bg-panel p-4 shadow-shell';

  return (
    <div className={clsx(wrapperClass, className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-4 animate-pulse rounded bg-slate-200" />
      ))}
    </div>
  );
};
