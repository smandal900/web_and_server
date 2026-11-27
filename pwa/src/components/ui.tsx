// The few building blocks the phone screens share.
import type { ReactNode } from 'react';
import { Icon } from '@web/components/ui/Icon';

export function IconButton({ path, label, onClick, active, disabled, className = '' }: { path: string; label: string; onClick: () => void; active?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={`flex size-11 shrink-0 items-center justify-center rounded-full active:bg-panel ${className}`}>
      <Icon path={path} />
    </button>
  );
}

export function TopBar({ title, left, children }: { title: ReactNode; left?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
      {left}
      <h1 className="min-w-0 flex-1 truncate py-4 pl-2 text-xl font-semibold">{title}</h1>
      {children}
    </header>
  );
}

/** A panel sliding up from the bottom, closed by tapping outside it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div role="dialog" aria-label={title} className="max-h-[75%] w-full overflow-y-auto rounded-t-3xl bg-bg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-fg" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, text, action, onYes, onClose }: { title: string; text: string; action: string; onYes: () => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-muted">{text}</p>
      <div className="flex justify-end gap-3">
        <button type="button" className="rounded-full px-5 py-2.5 text-sm font-medium" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="rounded-full bg-danger px-5 py-2.5 text-sm font-medium text-white"
          onClick={() => {
            onClose();
            onYes();
          }}
        >
          {action}
        </button>
      </div>
    </Sheet>
  );
}

export function Row({ icon, label, onClick, children }: { icon: string; label: string; onClick?: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-2 py-3.5 text-left text-sm font-medium active:bg-panel">
      <Icon path={icon} />
      <span className="flex-1">{label}</span>
      {children}
    </button>
  );
}

export const Message = ({ icon, text }: { icon?: string; text: string }) => (
  <div className="flex flex-col items-center gap-3 px-8 py-16 text-center text-muted">
    {icon && <Icon path={icon} size={48} />}
    <p className="text-sm">{text}</p>
  </div>
);

export const Spinner = () => <div role="status" aria-label="Loading" className="mx-auto my-16 size-8 animate-spin rounded-full border-4 border-panel border-t-primary" />;
