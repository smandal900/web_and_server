import type { ReactNode } from 'react';
import { Logo } from '../ui/Misc';

/** Centered card over a large blurred logo: used by login, sign-up, password change and onboarding. */
export function AuthLayout({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-y-auto bg-bg p-4">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20 blur-3xl" aria-hidden="true">
        <Logo size={640} />
      </div>
      <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} rounded-3xl border border-line bg-bg/90 p-8 shadow-xl backdrop-blur`}>
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo size={64} />
          <h1 className="text-2xl font-semibold text-primary">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
