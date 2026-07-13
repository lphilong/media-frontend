import { TriangleAlert } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@shared/components/primitives/Button';
import {
  getSemanticToneClasses,
  type SemanticTone,
} from '@shared/components/primitives/semantic-tone';

type SensitiveActionDialogProps = {
  open: boolean;
  title: string;
  summary: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  acknowledgementLabel?: string;
  isSubmitting?: boolean;
  riskItems?: string[];
  tone?: Extract<SemanticTone, 'danger' | 'critical' | 'warning'>;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('hidden') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length > 0,
  );

export const SensitiveActionDialog = ({
  acknowledgementLabel,
  cancelLabel,
  confirmLabel,
  isSubmitting = false,
  onCancel,
  onConfirm,
  open,
  riskItems = [],
  summary,
  title,
  tone = 'critical',
}: SensitiveActionDialogProps): JSX.Element | null => {
  const titleId = useId();
  const summaryId = useId();
  const acknowledgementId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const toneClasses = getSemanticToneClasses(tone);
  const needsAcknowledgement = Boolean(acknowledgementLabel);

  useEffect(() => {
    if (!open) {
      setAcknowledged(false);
      return;
    }

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
        previouslyFocusedElement.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const canConfirm = !isSubmitting && (!needsAcknowledgement || acknowledged);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Tab') {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const focusableElements = getFocusableElements(dialog);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (event.shiftKey) {
      if (activeElement === dialog || activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      return;
    }

    if (activeElement === dialog || activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30 px-4">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        aria-busy={isSubmitting || undefined}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-lg rounded-lg border border-border bg-panel p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${toneClasses.badge}`}>
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-text">
              {title}
            </h2>
            <p id={summaryId} className="mt-2 text-sm text-muted">
              {summary}
            </p>
          </div>
        </div>

        {riskItems.length > 0 ? (
          <ul className={`mt-4 space-y-2 rounded border p-3 text-sm ${toneClasses.border}`}>
            {riskItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${toneClasses.marker}`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {acknowledgementLabel ? (
          <label htmlFor={acknowledgementId} className="mt-4 flex gap-2 text-sm text-text">
            <input
              id={acknowledgementId}
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1"
            />
            <span>{acknowledgementLabel}</span>
          </label>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'warning' ? 'primary' : 'danger'}
            onClick={onConfirm}
            disabled={!canConfirm}
            loading={isSubmitting}
            loadingLabel={confirmLabel}
          >
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
};
