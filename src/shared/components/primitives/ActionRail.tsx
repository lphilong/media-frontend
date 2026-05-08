import clsx from 'clsx';
import type { ReactNode } from 'react';

type ActionRailTone = 'default' | 'danger';

export type ActionRailItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
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
  return (
    <section className="rounded-lg border border-border bg-panel p-3 shadow-shell">
      <h2 className="mb-2 text-sm font-semibold text-text">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const tone = item.tone ?? 'default';

          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled || !item.onClick}
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
          );
        })}
      </div>
    </section>
  );
};
