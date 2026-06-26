import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'error' | 'info';
}

const ToastContext = createContext<(text: string, tone?: 'error' | 'info') => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const push = useCallback((text: string, tone: 'error' | 'info' = 'info') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4000);
  }, []);

  const toastItem = (t: ToastMessage) => (
    <div
      key={t.id}
      className={`rounded-md border px-4 py-2 text-sm ${
        t.tone === 'error'
          ? 'border-red-300 bg-red-50 text-red-800'
          : 'border-gray-300 bg-white text-gray-800'
      }`}
    >
      {t.text}
    </div>
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
        <div aria-live="polite">
          {toasts.filter((t) => t.tone === 'info').map(toastItem)}
        </div>
        <div aria-live="assertive" aria-atomic="true">
          {toasts.filter((t) => t.tone === 'error').map(toastItem)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
