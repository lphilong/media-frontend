import {
  createContext,
  useContext,
  useMemo,
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
};

type ModalHostContextValue = {
  openModal: (payload: Omit<ModalPayload, 'variant'>) => void;
  openDrawer: (payload: Omit<ModalPayload, 'variant'>) => void;
  close: () => void;
};

const ModalHostContext = createContext<ModalHostContextValue | null>(null);

export const ModalHostProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const { t } = useTranslation('common');
  const [modal, setModal] = useState<ModalPayload | null>(null);

  const value = useMemo<ModalHostContextValue>(
    () => ({
      openModal: (payload) => setModal({ ...payload, variant: 'modal' }),
      openDrawer: (payload) => setModal({ ...payload, variant: 'drawer' }),
      close: () => setModal(null),
    }),
    [],
  );

  const panelClass =
    modal?.variant === 'drawer'
      ? 'ml-auto h-full w-full max-w-lg rounded-none rounded-l-lg'
      : 'mx-auto w-full max-w-xl rounded-lg';

  return (
    <ModalHostContext.Provider value={value}>
      {children}
      {modal ? (
        <div className="fixed inset-0 z-[95] bg-black/30">
          <div className={`bg-panel p-5 shadow-xl ${panelClass}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-text">{modal.title}</h3>
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
