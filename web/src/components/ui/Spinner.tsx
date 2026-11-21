import { cx } from '../../lib/cx';

export function Spinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cx('animate-spin text-primary', className)}
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Centered spinner used as the Suspense fallback of lazy pages. */
export function PageSpinner() {
  return (
    <div className="flex h-full min-h-40 w-full items-center justify-center">
      <Spinner size={36} />
    </div>
  );
}
