import { NavLink } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getAlbums } from '../../api/library';
import { useFeatures, useStorage, useAbout } from '../../hooks/useServer';
import { usePreferences } from '../../hooks/usePreferences';
import { t } from '../../i18n';
import { cx } from '../../lib/cx';
import { formatBytes } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { adminNavItems, userNavItems, type NavItem } from './navItems';

// Importing a page on hover warms its chunk so the click feels instant.
const prefetchers: Record<string, () => Promise<unknown>> = {
  '/photos': () => import('../../pages/photos/Photos'),
  '/albums': () => import('../../pages/albums/Albums'),
  '/people': () => import('../../pages/people/People'),
  '/map': () => import('../../pages/map/MapPage'),
};

function Link({ item, collapsed }: { item: NavItem; collapsed?: boolean }) {
  return (
    <NavLink
      to={item.to}
      onMouseEnter={() => prefetchers[item.to]?.()}
      title={t(item.label)}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-4 rounded-r-full py-3 pr-6 pl-5 text-sm font-medium transition hover:bg-panel',
          isActive && 'bg-primary/15 text-primary',
          collapsed && 'justify-center px-3',
        )
      }
    >
      <Icon path={item.icon} />
      {!collapsed && <span className="truncate">{t(item.label)}</span>}
    </NavLink>
  );
}

function RecentAlbums() {
  const albums = useQuery({ queryKey: ['albums', 'recent'], queryFn: () => getAlbums(), retry: false });
  const recent = (albums.data ?? []).slice(0, 5);
  if (recent.length === 0) return null;
  return (
    <div className="mb-1 ml-14 flex flex-col">
      {recent.map((a) => (
        <NavLink key={a.id} to={`/albums/${a.id}`} className="truncate py-1.5 text-xs text-muted hover:text-fg">
          {a.albumName}
        </NavLink>
      ))}
    </div>
  );
}

function StorageMeter() {
  const storage = useStorage().data;
  if (!storage) return null;
  return (
    <div className="px-5 py-3 text-xs text-muted">
      <div className="mb-1 flex justify-between">
        <span>{t('Storage')}</span>
        <span>{storage.diskUsagePercentage}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-panel">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, storage.diskUsagePercentage)}%` }} />
      </div>
      <p className="mt-1">
        {formatBytes(storage.diskUseRaw)} {t('of')} {formatBytes(storage.diskSizeRaw)} {t('used')}
      </p>
    </div>
  );
}

/** Left navigation. `variant="admin"` shows the administration links instead. */
export function Sidebar({ variant = 'user', onNavigate }: { variant?: 'user' | 'admin'; onNavigate?: () => void }) {
  const features = useFeatures().data;
  const { preferences } = usePreferences();
  const version = useAbout().data?.version;
  const items = variant === 'admin' ? adminNavItems : userNavItems(features, preferences);

  return (
    <nav className="flex h-full flex-col overflow-y-auto" onClick={onNavigate} aria-label="Main">
      <div className="flex-1 pt-2">
        {items.map((item) => (
          <div key={item.to}>
            <Link item={item} />
            {item.to === '/albums' && <RecentAlbums />}
          </div>
        ))}
      </div>
      <StorageMeter />
      {version && <p className="px-5 pb-3 text-xs text-muted">{version}</p>}
    </nav>
  );
}
