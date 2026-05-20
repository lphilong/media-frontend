import clsx from 'clsx';
import { useId } from 'react';
import type { ReactNode } from 'react';

type ActionRailTone = 'default' | 'danger';

export type ActionRailItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  tone?: ActionRailTone;
  onClick?: () => void;
};

type ActionRailProps = {
  title: string;
  items: ActionRailItem[];
};

const TONE_CLASS: Record<ActionRailTone, string> = {
  default: 'border-border text-text hover:bg-slate-50',
  danger: 'border-danger/40 text-danger hover:bg-rose-50',
};

export const ActionRail = ({ title, items }: ActionRailProps): JSX.Element => {
  const railId = useId();

  return (
    <section className="rounded-lg border border-border bg-panel p-3 shadow-shell">
      <h2 className="mb-2 text-sm font-semibold text-text">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const tone = item.tone ?? 'default';
          const isDisabled = item.disabled || !item.onClick;
          const reasonId = `${railId}-${item.id}-disabled-reason`;

          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                disabled={isDisabled}
                aria-describedby={isDisabled && item.disabledReason ? reasonId : undefined}
                title={isDisabled ? item.disabledReason : undefined}
                onClick={item.onClick}
                className={clsx(
                  'flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  TONE_CLASS[tone],
                )}
              >
                <span>{item.label}</span>
                {item.icon ? <span className="text-muted">{item.icon}</span> : null}
              </button>
              {isDisabled && item.disabledReason ? (
                <p id={reasonId} className="px-1 text-xs leading-5 text-muted">
                  {item.disabledReason}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};
