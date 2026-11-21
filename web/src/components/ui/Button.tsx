import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from './Icon';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'danger-outline';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  outline: 'border border-line hover:bg-panel',
  ghost: 'hover:bg-panel',
  danger: 'bg-danger text-white hover:opacity-90',
  'danger-outline': 'border border-danger text-danger hover:bg-danger/10',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: string;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', icon, loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-5 py-2.5 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner size={16} className="text-current" /> : icon && <Icon path={icon} size={18} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  path: string;
  /** Used for the tooltip and screen readers. */
  label: string;
  size?: number;
  active?: boolean;
}

export function IconButton({ path, label, size = 22, active, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center rounded-full p-2 transition hover:bg-panel disabled:opacity-40',
        active && 'bg-primary/15 text-primary',
        className,
      )}
    >
      <Icon path={path} size={size} />
    </button>
  );
}
