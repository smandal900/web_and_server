// An icon from @mdi/js: <Icon path={mdiHeart} />. The icon takes the current text colour.
export function Icon({ path, size = 24, className }: { path: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      <path d={path} />
    </svg>
  );
}
