import clsx from 'clsx';
import type { PropsWithChildren } from 'react';

type FormGridProps = PropsWithChildren<{
  columns?: 1 | 2 | 3;
}>;

const columnClassMap: Record<NonNullable<FormGridProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
};

export const FormGrid = ({ columns = 2, children }: FormGridProps): JSX.Element => {
  return <div className={clsx('grid gap-3', columnClassMap[columns])}>{children}</div>;
};
