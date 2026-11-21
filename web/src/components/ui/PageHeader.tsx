import type { ReactNode } from 'react';

/** The 4rem bar with a bottom border at the top of every page: title on the left, actions on the right. */
export function PageHeader({ title, children, left }: { title: ReactNode; children?: ReactNode; left?: ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
      <div className="flex min-w-0 items-center gap-2">
        {left}
        <h1 className="truncate text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </header>
  );
}

/** Scrollable page body with sensible padding. */
export function PageBody({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className={narrow ? 'mx-auto max-w-3xl' : ''}>{children}</div>
    </div>
  );
}
