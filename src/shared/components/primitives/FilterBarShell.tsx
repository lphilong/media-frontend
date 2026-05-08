import type { PropsWithChildren } from 'react';

type FilterBarShellProps = PropsWithChildren<{
  searchSlot?: JSX.Element;
  sortSlot?: JSX.Element;
  actions?: JSX.Element;
}>;

export const FilterBarShell = ({
  children,
  searchSlot,
  sortSlot,
  actions,
}: FilterBarShellProps): JSX.Element => {
  return (
    <div className="mb-4 rounded-lg border border-border bg-panel p-3 shadow-shell">
      <div className="flex flex-wrap items-end gap-3">
        {searchSlot}
        {sortSlot}
        {children}
      </div>
      {actions ? <div className="mt-3 flex justify-end">{actions}</div> : null}
    </div>
  );
};
