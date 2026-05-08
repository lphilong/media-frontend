import clsx from 'clsx';
import type { ReactNode } from 'react';

export type ReadOnlyField = {
  key: string;
  label: string;
  value: ReactNode;
  monospace?: boolean;
};

type ReadOnlyFieldGridProps = {
  fields: ReadOnlyField[];
  columns?: 1 | 2 | 3;
};

const COLUMN_CLASS: Record<NonNullable<ReadOnlyFieldGridProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
};

export const ReadOnlyFieldGrid = ({ fields, columns = 2 }: ReadOnlyFieldGridProps): JSX.Element => {
  return (
    <dl className={clsx('grid gap-3', COLUMN_CLASS[columns])}>
      {fields.map((field) => (
        <div key={field.key} className="rounded border border-border bg-bg px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{field.label}</dt>
          <dd className={clsx('mt-1 text-sm text-text', field.monospace ? 'font-mono' : '')}>
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};
