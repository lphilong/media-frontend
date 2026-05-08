import type { PropsWithChildren } from 'react';

export const FormActions = ({ children }: PropsWithChildren): JSX.Element => {
  return (
    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
      {children}
    </div>
  );
};
