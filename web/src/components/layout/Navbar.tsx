import { lazy, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { mdiBellOutline, mdiBrightness6, mdiCogOutline, mdiHelpCircleOutline, mdiMenu, mdiShieldAccountOutline } from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../../api/admin';
import { useAuth } from '../../state/AuthProvider';
import { useTheme } from '../../state/ThemeProvider';
import { t } from '../../i18n';
import { UploadButton } from '../upload/UploadButton';
import { Boundary } from '../ui/Boundary';
import { IconButton } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { Avatar, Logo } from '../ui/Misc';
import { SearchBar } from './SearchBar';

const NotificationPanel = lazy(() => import('./NotificationPanel'));
const ShortcutsModal = lazy(() => import('../modals/ShortcutsModal'));
const AboutModal = lazy(() => import('../modals/AboutModal'));
const AppDownloadModal = lazy(() => import('../modals/AppDownloadModal'));
const HelpModal = lazy(() => import('../modals/HelpModal'));

export function Navbar({ onMenu, admin }: { onMenu: () => void; admin?: boolean }) {
  const { user, isAdmin, logout } = useAuth();
  const { toggle, isDark } = useTheme();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<'notifications' | 'shortcuts' | 'about' | 'app' | 'help' | null>(null);
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: getNotifications, retry: false, refetchInterval: 60_000 });
  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;

  return (
    <header className="relative z-[6000] flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg px-2 md:h-[4.5rem] md:px-4">
      <IconButton path={mdiMenu} label="Menu" onClick={onMenu} className="md:hidden" />
      <Link to="/photos" className="flex w-auto shrink-0 items-center gap-2 md:w-60">
        <Logo />
        <span className="text-xl font-semibold text-primary max-md:hidden">{admin ? t('Administration') : t('Photos')}</span>
      </Link>

      <div className="flex min-w-0 flex-1 justify-center">{!admin && <SearchBar />}</div>

      <div className="flex shrink-0 items-center gap-1">
        {!admin && <UploadButton compact />}
        {isAdmin && !admin && <IconButton path={mdiShieldAccountOutline} label={t('Administration')} onClick={() => navigate('/admin/users')} />}
        <IconButton path={mdiBrightness6} label={isDark ? t('Switch to light theme') : t('Switch to dark theme')} onClick={toggle} className="max-md:hidden" />

        <div className="relative">
          <IconButton path={mdiBellOutline} label={t('Notifications')} onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')} />
          {unread > 0 && <span className="absolute top-1 right-1 size-2.5 rounded-full bg-primary" />}
          {panel === 'notifications' && (
            <Boundary compact>
              <NotificationPanel onClose={() => setPanel(null)} />
            </Boundary>
          )}
        </div>

        <Menu
          className="max-md:hidden"
          trigger={({ toggle: open }) => <IconButton path={mdiHelpCircleOutline} label={t('Help')} onClick={open} />}
          items={[
            { label: t('Keyboard shortcuts'), onClick: () => setPanel('shortcuts') },
            { label: t('Download the app'), onClick: () => setPanel('app') },
            { label: t('About this server'), onClick: () => setPanel('about') },
            { label: t('Help & feedback'), onClick: () => setPanel('help') },
          ]}
        />

        <Menu
          trigger={({ toggle: open }) => (
            <button onClick={open} aria-label={t('Account')} className="ml-1 rounded-full">
              {user && <Avatar user={user} size={36} />}
            </button>
          )}
          items={[
            { label: user ? `${user.name} · ${user.email}`.slice(0, 40) : '', disabled: true },
            { label: t('Account settings'), icon: mdiCogOutline, onClick: () => navigate('/user-settings'), divider: true },
            { label: t('Administration'), icon: mdiShieldAccountOutline, onClick: () => navigate('/admin/users'), hidden: !isAdmin },
            {
              label: t('Sign out'),
              onClick: async () => {
                await logout();
                navigate('/auth/login');
              },
              divider: true,
            },
          ]}
        />
      </div>

      <Boundary compact fallback={null}>
        {panel === 'shortcuts' && <ShortcutsModal onClose={() => setPanel(null)} />}
        {panel === 'about' && <AboutModal onClose={() => setPanel(null)} />}
        {panel === 'app' && <AppDownloadModal onClose={() => setPanel(null)} />}
        {panel === 'help' && <HelpModal onClose={() => setPanel(null)} />}
      </Boundary>
    </header>
  );
}
