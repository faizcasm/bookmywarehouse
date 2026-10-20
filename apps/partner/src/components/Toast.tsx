import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, Check, Info, X } from 'lucide-react';
import { errorMessage, isApiError } from '../lib/api';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** Toast an error caught from the API, appending the first field issue if any. */
  errorFrom: (err: unknown, fallback?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((current) => [...current.slice(-3), { id, kind, message }]);
      const timer = setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast,
      success: (message: string) => toast('success', message),
      error: (message: string) => toast('error', message),
      info: (message: string) => toast('info', message),
      errorFrom: (err: unknown, fallback = 'Something went wrong') => {
        let message = errorMessage(err, fallback);
        if (isApiError(err) && err.issues.length > 0 && err.issues[0]) {
          message = `${message} — ${err.issues[0].message}`;
        }
        toast('error', message);
      },
      dismiss,
    }),
    [toasts, toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.kind}`}>
            <span className="toast__icon" aria-hidden="true">
              {item.kind === 'success' ? (
                <Check size={15} strokeWidth={2.6} />
              ) : item.kind === 'error' ? (
                <AlertCircle size={15} strokeWidth={2.4} />
              ) : (
                <Info size={15} strokeWidth={2.4} />
              )}
            </span>
            <span className="toast__message">{item.message}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(item.id)} aria-label="Dismiss notification">
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
