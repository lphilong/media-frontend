import { useCallback, type FormEventHandler, type ReactNode } from 'react';

import { FormActions } from '@shared/forms';

export type MutationSurfaceKind = 'create' | 'edit' | 'action';
export type MutationSurfacePresentation = 'page' | 'drawer';
export type MutationFieldErrors = Record<string, string[]>;

type MutationFieldErrorSummaryProps = {
  errors?: MutationFieldErrors | null;
};

const hasFieldErrorValues = (errors: MutationFieldErrors): boolean => {
  return Object.values(errors).some((items) => items.length > 0);
};

export const MutationFieldErrorSummary = ({
  errors,
}: MutationFieldErrorSummaryProps): JSX.Element | null => {
  if (!errors || !hasFieldErrorValues(errors)) {
    return null;
  }

  return (
    <ul className="space-y-2 rounded border border-danger/30 bg-rose-50 px-3 py-2 text-sm text-danger">
      {Object.entries(errors).map(([field, messages]) => {
        if (messages.length === 0) {
          return null;
        }

        return (
          <li key={field}>
            <p className="font-semibold">{field}</p>
            <ul className="mt-1 space-y-1 text-xs">
              {messages.map((message) => (
                <li key={`${field}:${message}`}>{message}</li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
};

export type ModuleMutationSurfaceProps = {
  title: string;
  subtitle?: string;
  kind: MutationSurfaceKind;
  presentation?: MutationSurfacePresentation;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onCancel?: () => void;
  submitLabel: string;
  cancelLabel: string;
  pendingLabel?: string;
  isPending?: boolean;
  isReadOnly?: boolean;
  isLocked?: boolean;
  readOnlyNotice?: ReactNode;
  lockedNotice?: ReactNode;
  blocker?: ReactNode;
  banner?: ReactNode;
  fieldErrorSummary?: ReactNode;
  footerStart?: ReactNode;
  children: ReactNode;
};

const CONTAINER_STYLES: Record<MutationSurfacePresentation, string> = {
  page: 'rounded-lg border border-border bg-panel p-4 shadow-shell',
  drawer: 'h-full rounded-none border-l border-border bg-panel p-4 shadow-shell',
};

export const ModuleMutationSurface = ({
  title,
  subtitle,
  kind,
  presentation = 'page',
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel,
  pendingLabel,
  isPending = false,
  isReadOnly = false,
  isLocked = false,
  readOnlyNotice,
  lockedNotice,
  blocker,
  banner,
  fieldErrorSummary,
  footerStart,
  children,
}: ModuleMutationSurfaceProps): JSX.Element => {
  const disableSubmit = isPending || isReadOnly || isLocked;
  const submitText = isPending ? (pendingLabel ?? submitLabel) : submitLabel;

  return (
    <section
      className={CONTAINER_STYLES[presentation]}
      data-mutation-kind={kind}
      data-mutation-presentation={presentation}
    >
      <header className="mb-4 border-b border-border pb-3">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </header>
      <form onSubmit={onSubmit} className="space-y-4">
        {banner}
        {readOnlyNotice}
        {lockedNotice}
        {blocker}
        {fieldErrorSummary}
        <div className="space-y-4">{children}</div>
        <FormActions>
          {footerStart}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-border bg-panel px-3 py-2 text-sm"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={disableSubmit}
              className="rounded border border-accent bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitText}
            </button>
          </div>
        </FormActions>
      </form>
    </section>
  );
};

type MutationLifecycleOptions<TData> = {
  closeOnSuccess?: boolean;
  resetOnSuccess?: boolean;
  onSuccess?: (data: TData) => void;
  onReset?: () => void;
  onClose?: () => void;
};

export const useMutationSurfaceLifecycle = <TData,>({
  closeOnSuccess = true,
  resetOnSuccess = false,
  onSuccess,
  onReset,
  onClose,
}: MutationLifecycleOptions<TData>) => {
  return useCallback(
    (data: TData): void => {
      onSuccess?.(data);

      if (resetOnSuccess) {
        onReset?.();
      }

      if (closeOnSuccess) {
        onClose?.();
      }
    },
    [closeOnSuccess, onClose, onReset, onSuccess, resetOnSuccess],
  );
};
