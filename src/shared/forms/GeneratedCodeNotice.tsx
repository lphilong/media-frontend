import clsx from 'clsx';

type GeneratedCodeNoticeProps = {
  label: string;
  description: string;
  className?: string;
};

export const GeneratedCodeNotice = ({
  label,
  description,
  className,
}: GeneratedCodeNoticeProps): JSX.Element => {
  return (
    <div className={clsx('rounded border border-border bg-panel px-3 py-2', className)}>
      <p className="text-xs font-medium uppercase text-muted">{label}</p>
      <p className="mt-1 text-sm text-text">{description}</p>
    </div>
  );
};
