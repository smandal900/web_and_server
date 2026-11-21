// Small display components that do not deserve their own file.
import { useState, type ReactNode } from 'react';
import { mdiChevronDown, mdiStar, mdiStarOutline } from '@mdi/js';
import { avatarUrl } from '../../api/assets';
import { cx } from '../../lib/cx';
import { initials } from '../../lib/format';
import { Icon } from './Icon';

/** Big icon + message (+ optional action) shown when a list is empty. */
export function EmptyState({ icon, title, text, children }: { icon: string; title: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="rounded-full bg-primary/10 p-6 text-primary">
        <Icon path={icon} size={56} />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {children}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-panel-2 p-5', className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx('animate-pulse rounded-lg bg-panel', className)} />;

const COLORS: Record<string, string> = {
  primary: 'bg-primary text-on-primary',
  pink: 'bg-pink-500 text-white',
  red: 'bg-red-500 text-white',
  yellow: 'bg-yellow-500 text-black',
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-600 text-white',
  purple: 'bg-purple-500 text-white',
  orange: 'bg-orange-500 text-white',
  gray: 'bg-gray-500 text-white',
  amber: 'bg-amber-500 text-black',
};

/** Round user picture; falls back to coloured initials when the user has no image. */
export function Avatar({ user, size = 40 }: { user: { id: string; name: string; avatarColor?: string; profileImagePath?: string }; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImage = !!user.profileImagePath && !failed;
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium select-none', COLORS[user.avatarColor ?? 'primary'] ?? COLORS.primary)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={user.name}
    >
      {showImage ? <img src={avatarUrl(user.id)} alt={user.name} className="size-full object-cover" onError={() => setFailed(true)} /> : initials(user.name)}
    </span>
  );
}

export function TagPill({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
      {children}
      {onRemove && (
        <button aria-label="Remove" onClick={onRemove} className="hover:opacity-70">
          ×
        </button>
      )}
    </span>
  );
}

/** Five stars; clicking the current rating again clears it. */
export function StarRating({ value, onChange, readOnly }: { value: number; onChange?: (rating: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} stars`}
          onClick={() => onChange?.(value === n ? 0 : n)}
          className="p-0.5 text-warning disabled:cursor-default"
        >
          <Icon path={n <= value ? mdiStar : mdiStarOutline} size={22} />
        </button>
      ))}
    </div>
  );
}

/** One collapsible section: used for settings and the admin pages. */
export function Accordion({ title, icon, children, defaultOpen = false, subtitle }: { title: string; icon?: string; subtitle?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-panel">
        {icon && <Icon path={icon} className="text-primary" />}
        <span className="flex-1">
          <span className="block font-medium text-primary">{title}</span>
          {subtitle && <span className="block text-xs text-muted">{subtitle}</span>}
        </span>
        <Icon path={mdiChevronDown} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line p-5">{children}</div>}
    </section>
  );
}

/** Tab strip. The caller shows the content for `value`. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string }>; value: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
          className={cx('border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap', tab.id === value ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-fg')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return <img src="/favicon.svg" width={size} height={size} alt="" />;
}
