import clsx from 'clsx';

import {
  getSemanticInteractionClasses,
  getSemanticToneClasses,
  type SemanticTone,
} from '@shared/components/primitives/semantic-tone';

export type WorkflowProgressItem = {
  id: string;
  title: string;
  summary: string;
  businessTone?: SemanticTone;
  isActive?: boolean;
  isComplete?: boolean;
  isDisabled?: boolean;
  note?: string;
};

type WorkflowProgressProps = {
  items: WorkflowProgressItem[];
  ariaLabel: string;
  onItemSelect?: (id: string) => void;
  className?: string;
};

export const WorkflowProgress = ({
  ariaLabel,
  className,
  items,
  onItemSelect,
}: WorkflowProgressProps): JSX.Element => {
  return (
    <ol
      aria-label={ariaLabel}
      className={clsx('grid gap-3 md:grid-cols-2 xl:grid-cols-4', className)}
    >
      {items.map((item, index) => {
        const tone = item.isDisabled ? 'disabled' : (item.businessTone ?? 'neutral');
        const toneClasses = getSemanticToneClasses(tone);
        const interactionClasses = getSemanticInteractionClasses({
          active: item.isActive,
          disabled: item.isDisabled,
        });
        const content = (
          <>
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                  toneClasses.marker,
                )}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.summary}</p>
              </div>
            </div>
            {item.note ? <p className="mt-3 text-xs text-muted">{item.note}</p> : null}
          </>
        );
        const itemClassName = clsx(
          'h-full rounded border p-3 text-left shadow-sm transition',
          toneClasses.border,
          toneClasses.panel,
          interactionClasses,
        );

        return (
          <li
            key={item.id}
            data-business-tone={tone}
            data-active={item.isActive ? 'true' : undefined}
            data-complete={item.isComplete ? 'true' : undefined}
            className="min-w-0"
          >
            {onItemSelect ? (
              <button
                type="button"
                className={clsx('w-full', itemClassName)}
                onClick={() => onItemSelect(item.id)}
                disabled={item.isDisabled}
                aria-current={item.isActive ? 'step' : undefined}
              >
                {content}
              </button>
            ) : (
              <div className={itemClassName} aria-current={item.isActive ? 'step' : undefined}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};
