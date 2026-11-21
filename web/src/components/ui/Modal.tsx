import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { mdiClose } from '@mdi/js';
import { cx } from '../../lib/cx';
import { IconButton } from './Button';

interface ModalProps {
  title?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
  /** Buttons shown at the bottom. */
  footer?: ReactNode;
  /** Full-screen dark overlay used for viewers (no card). */
  bare?: boolean;
}
const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' };

/** A centered dialog. Esc or a click on the backdrop closes it; focus moves inside while it is open. */
export function Modal({ title, onClose, size = 'md', children, footer, bare }: ModalProps) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        className={cx(
          'flex max-h-[90vh] w-full flex-col',
          !bare && 'rounded-3xl border border-line bg-bg shadow-2xl',
          SIZES[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-2 px-6 pt-5 pb-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <IconButton path={mdiClose} label="Close" onClick={onClose} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 pt-2 pb-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
