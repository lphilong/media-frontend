import type { PropsWithChildren } from 'react';

type MoreFiltersPanelProps = PropsWithChildren<{
  id: string;
  title: string;
  isOpen: boolean;
  closeLabel?: string;
  onClose?: () => void;
}>;

export const MoreFiltersPanel = ({
  children,
  closeLabel,
  id,
  isOpen,
  onClose,
  title,
}: MoreFiltersPanelProps): JSX.Element | null => {
  if (!isOpen) {
    return null;
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="rounded border border-border bg-bg p-3"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-sm font-semibold text-text">
          {title}
        </h2>
        {onClose && closeLabel ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-panel px-2 py-1 text-xs font-medium"
          >
            {closeLabel}
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
};
