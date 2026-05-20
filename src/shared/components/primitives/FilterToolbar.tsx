import type { PropsWithChildren, ReactNode } from 'react';

type FilterToolbarProps = PropsWithChildren<{
  searchSlot?: ReactNode;
  sortSlot?: ReactNode;
  moreFiltersTrigger?: ReactNode;
  resetAction?: ReactNode;
  appliedFilters?: ReactNode;
  moreFiltersPanel?: ReactNode;
}>;

export const FilterToolbar = ({
  children,
  searchSlot,
  sortSlot,
  moreFiltersTrigger,
  resetAction,
  appliedFilters,
  moreFiltersPanel,
}: FilterToolbarProps): JSX.Element => {
  return (
    <section className="mb-4 rounded-lg border border-border bg-panel p-3 shadow-shell">
      <div className="flex flex-wrap items-end gap-3">
        {searchSlot}
        {sortSlot}
        {children}
        {moreFiltersTrigger || resetAction ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {moreFiltersTrigger}
            {resetAction}
          </div>
        ) : null}
      </div>
      {moreFiltersPanel ? <div className="mt-3">{moreFiltersPanel}</div> : null}
      {appliedFilters ? <div className="mt-3">{appliedFilters}</div> : null}
    </section>
  );
};
