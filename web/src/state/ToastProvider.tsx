import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiClose, mdiInformationOutline } from '@mdi/js';
import { Icon } from '../components/ui/Icon';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}
const ToastContext = createContext<ToastApi>(null!);
export const useToast = () => useContext(ToastContext);

const ICONS = { success: mdiCheckCircleOutline, error: mdiAlertCircleOutline, info: mdiInformationOutline };
const COLORS = { success: 'text-success', error: 'text-danger', info: 'text-primary' };
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const api = useMemo<ToastApi>(() => {
    const show = (kind: ToastKind) => (text: string) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-3), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    };
    return { success: show('success'), error: show('error'), info: show('info') };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[10000] flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border border-line bg-bg p-3 shadow-lg"
          >
            <Icon path={ICONS[toast.kind]} className={`mt-0.5 shrink-0 ${COLORS[toast.kind]}`} />
            <p className="flex-1 text-sm">{toast.text}</p>
            <button aria-label="Dismiss" onClick={() => dismiss(toast.id)} className="text-muted hover:text-fg">
              <Icon path={mdiClose} size={18} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
