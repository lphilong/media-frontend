import { X } from 'lucide-react';

import { formatUtcTimestamp } from '@shared/formatting/formatters';

export type AppliedFilterChipItem = {
  id: string;
  label: string;
  value: string;
  onClear?: () => void;
};

type AppliedFilterChipsProps = {
  items: AppliedFilterChipItem[];
  title: string;
  clearFilterLabel: string;
  clearAllLabel?: string;
  emptyLabel?: string;
  onClearAll?: () => void;
};

const timestampFilterChipIds = new Set([
  'createdBeforeAt',
  'eventOverlapEndAt',
  'eventOverlapStartAt',
  'eventStartFromAt',
  'eventStartToAt',
  'finalizedFromAt',
  'finalizedToAt',
  'publishedFromAt',
  'publishedToAt',
  'reconciledFromAt',
  'reconciledToAt',
  'windowEndAt',
  'windowStartAt',
]);

const formatChipValue = (item: AppliedFilterChipItem): string => {
  if (!timestampFilterChipIds.has(item.id)) {
    return item.value;
  }

  const timestampValue = /^-?\d+$/.test(item.value) ? Number(item.value) : item.value;
  return formatUtcTimestamp(timestampValue);
};

export const AppliedFilterChips = ({
  clearAllLabel,
  clearFilterLabel,
  emptyLabel,
  items,
  onClearAll,
  title,
}: AppliedFilterChipsProps): JSX.Element => {
  if (items.length === 0) {
    return emptyLabel ? (
      <section aria-label={title} className="text-xs text-muted">
        {emptyLabel}
      </section>
    ) : (
      <></>
    );
  }

  return (
    <section aria-label={title} className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase text-muted">{title}</span>
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-bg px-2 py-1 text-xs text-text"
        >
          <span className="truncate">
            <span className="font-medium">{item.label}:</span> {formatChipValue(item)}
          </span>
          {item.onClear ? (
            <button
              type="button"
              onClick={item.onClear}
              aria-label={`${clearFilterLabel}: ${item.label}`}
              className="rounded-full p-0.5 text-muted hover:bg-panel hover:text-text"
            >
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
      {onClearAll && clearAllLabel ? (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded border border-border bg-panel px-2 py-1 text-xs font-medium"
        >
          {clearAllLabel}
        </button>
      ) : null}
    </section>
  );
};
