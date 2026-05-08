import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useTranslation } from 'react-i18next';

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: 'default' | 'danger';
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export const ConfirmDialogProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const { t } = useTranslation('common');
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<(value: boolean) => void>();

  const contextValue = useMemo<ConfirmDialogContextValue>(
    () => ({
      confirm: (options) => {
        setRequest(options);
        return new Promise<boolean>((resolve) => {
          resolverRef.current = resolve;
        });
      },
    }),
    [],
  );

  const resolve = (value: boolean): void => {
    resolverRef.current?.(value);
    resolverRef.current = undefined;
    setRequest(null);
  };

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}
      {request ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/30 px-4"
          data-testid="confirm-dialog"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-panel p-5 shadow-xl">
            <h3 className="text-base font-semibold text-text">{request.title}</h3>
            <p className="mt-2 text-sm text-muted">{request.description}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resolve(false)}
                className="rounded border border-border px-3 py-2 text-sm"
                data-testid="confirm-dialog-cancel"
              >
                {request.cancelLabel ?? t('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={() => resolve(true)}
                className={`rounded px-3 py-2 text-sm text-white ${
                  request.confirmTone === 'danger'
                    ? 'bg-danger hover:bg-red-700'
                    : 'bg-accent hover:bg-blue-700'
                }`}
                data-testid="confirm-dialog-confirm"
              >
                {request.confirmLabel ?? t('actions.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirmDialog = (): ConfirmDialogContextValue => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }

  return context;
};
