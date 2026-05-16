import {
  createContext,
  useEffect,
  useRef,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (message: string, tone?: ToastTone) => void;
};

const toneClassMap: Record<ToastTone, string> = {
  success: 'border-emerald-300',
  error: 'border-rose-300',
  info: 'border-blue-300',
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idSequenceRef = useRef(0);
  const timeoutIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIds.clear();
    };
  }, []);

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    idSequenceRef.current += 1;
    const id = idSequenceRef.current;
    setToasts((prev) => [...prev, { id, message, tone }]);

    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
    timeoutIdsRef.current.add(timeoutId);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded border bg-panel px-3 py-2 text-sm shadow-shell ${toneClassMap[toast.tone]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
};
