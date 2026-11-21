import { lazy, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useRealtime } from '../../state/realtime';
import { UploadProvider, useUpload } from '../../state/UploadProvider';
import { useShortcut } from '../../hooks/useShortcuts';
import { cx } from '../../lib/cx';
import { DropOverlay } from '../upload/DropOverlay';
import { Boundary } from '../ui/Boundary';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

const UploadPanel = lazy(() => import('../upload/UploadPanel'));
const ShortcutsModal = lazy(() => import('../modals/ShortcutsModal'));

function Shell({ admin }: { admin?: boolean }) {
  const { panelOpen } = useUpload();
  const [drawer, setDrawer] = useState(false);
  const [help, setHelp] = useState(false);
  const { pathname } = useLocation();
  useRealtime(true);
  useShortcut('?', () => setHelp(true), { modifier: 'shift' });
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="flex h-full flex-col">
      <Navbar admin={admin} onMenu={() => setDrawer((d) => !d)} />
      <div className="relative flex min-h-0 flex-1">
        {/* Desktop: fixed 16rem column. Mobile (<850px): slides in over the page. */}
        <aside
          className={cx(
            'z-[5500] w-64 shrink-0 border-r border-line bg-bg max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:shadow-xl max-md:transition-transform',
            !drawer && 'max-md:-translate-x-full',
          )}
        >
          <Sidebar variant={admin ? 'admin' : 'user'} onNavigate={() => setDrawer(false)} />
        </aside>
        {drawer && <div className="absolute inset-0 z-[5400] bg-black/40 md:hidden" onClick={() => setDrawer(false)} />}
        <main className="min-w-0 flex-1">
          <Boundary>
            <Outlet />
          </Boundary>
        </main>
      </div>

      {!admin && <DropOverlay />}
      {panelOpen && (
        <Boundary compact fallback={null}>
          <UploadPanel />
        </Boundary>
      )}
      {help && (
        <Boundary compact fallback={null}>
          <ShortcutsModal onClose={() => setHelp(false)} />
        </Boundary>
      )}
    </div>
  );
}

/** Navbar + sidebar + page for every logged-in screen. `admin` swaps the links for the admin menu. */
export function AppShell({ admin }: { admin?: boolean }) {
  return (
    <UploadProvider>
      <Shell admin={admin} />
    </UploadProvider>
  );
}
