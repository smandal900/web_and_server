import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from './Icon';

export interface MenuItem {
  label: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  /** Hide the item without removing it from the list. */
  hidden?: boolean;
  disabled?: boolean;
  /** Draw a thin line above this item. */
  divider?: boolean;
  /** Show a check mark (for choice lists). */
  checked?: boolean;
}

interface MenuProps {
  /** The button that opens the menu. It receives `open`/`toggle`. */
  trigger: (api: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

/** A dropdown list of actions. Closes on outside click, Esc, or after choosing an item. */
export function Menu({ trigger, items, align = 'right', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter((i) => !i.hidden);
  return (
    <div ref={root} className={cx('relative inline-block', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <ul
          role="menu"
          className={cx(
            'absolute z-[8000] mt-1 min-w-48 overflow-hidden rounded-xl border border-line bg-bg py-1 text-sm shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {visible.map((item, i) => (
            <li key={`${item.label}-${i}`} role="none" className={cx(item.divider && i > 0 && 'mt-1 border-t border-line pt-1')}>
              <button
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={cx(
                  'flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-panel disabled:opacity-40',
                  item.danger && 'text-danger',
                )}
              >
                {item.icon && <Icon path={item.icon} size={20} />}
                <span className="flex-1">{item.label}</span>
                {item.checked && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
