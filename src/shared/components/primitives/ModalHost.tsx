import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

type ModalVariant = 'modal' | 'drawer';

type ModalPayload = {
  variant: ModalVariant;
  title: string;
  content: ReactNode;
  onDismiss?: () => void;
};

type ModalOpenPayload = Omit<ModalPayload, 'variant'>;

type ModalHostContextValue = {
  openModal: (payload: ModalOpenPayload) => void;
  openDrawer: (payload: ModalOpenPayload) => void;
  close: () => void;
};

const ModalHostContext = createContext<ModalHostContextValue | null>(null);

export const ModalHostProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const { t } = useTranslation('common');
  const [modal, setModal] = useState<ModalPayload | null>(null);
  const modalRef = useRef<ModalPayload | null>(null);

  const open = useCallback((payload: ModalOpenPayload, variant: ModalVariant): void => {
    const nextModal = { ...payload, variant };
    modalRef.current = nextModal;
    setModal(nextModal);
  }, []);

  const close = useCallback((): void => {
    const currentModal = modalRef.current;
    if (!currentModal) {
      return;
    }

    modalRef.current = null;
    setModal(null);
    currentModal.onDismiss?.();
  }, []);

  const value = useMemo<ModalHostContextValue>(
    () => ({
      openModal: (payload) => open(payload, 'modal'),
      openDrawer: (payload) => open(payload, 'drawer'),
      close,
    }),
    [close, open],
  );

  const panelClass =
    modal?.variant === 'drawer'
      ? 'ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-none rounded-l-lg'
      : 'mx-auto max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg';

  return (
    <ModalHostContext.Provider value={value}>
      {children}
      {modal ? (
        <div className="fixed inset-0 z-[95] bg-black/30">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modal.title}
            className={`bg-panel p-5 shadow-xl ${panelClass}`}
          >
            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={value.close}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                {t('actions.close')}
              </button>
            </div>
            <div>{modal.content}</div>
          </div>
        </div>
      ) : null}
    </ModalHostContext.Provider>
  );
};

export const useModalHost = (): ModalHostContextValue => {
  const context = useContext(ModalHostContext);
  if (!context) {
    throw new Error('useModalHost must be used within ModalHostProvider');
  }

  return context;
};
