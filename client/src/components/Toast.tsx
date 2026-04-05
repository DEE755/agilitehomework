import { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const config: Record<ToastType, { bar: string; icon: string }> = {
  success: { bar: 'bg-olive-500', icon: '✓' },
  error:   { bar: 'bg-red-500',   icon: '✕' },
  info:    { bar: 'bg-sand-400',  icon: 'ℹ' },
};

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const { bar, icon } = config[item.type];
  return (
    <div className="toast-enter pointer-events-auto flex w-80 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
      <div className={`w-1 shrink-0 ${bar}`} />
      <div className="flex flex-1 items-center gap-3 px-4 py-3">
        <span className={`text-sm font-bold ${bar.replace('bg-', 'text-')}`}>{icon}</span>
        <p className="flex-1 text-sm text-zinc-200">{item.message}</p>
        <button
          onClick={onRemove}
          className="text-zinc-500 transition hover:text-zinc-200"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}
