import clsx from 'clsx';
import type { PropsWithChildren } from 'react';

type PageContainerProps = PropsWithChildren<{
  className?: string;
}>;

export const PageContainer = ({ className, children }: PageContainerProps): JSX.Element => {
  return (
    <div className={clsx('mx-auto w-full max-w-[1400px] p-4 md:p-6', className)}>{children}</div>
  );
};
