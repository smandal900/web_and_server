// Which links the sidebar shows. Visibility follows the server's feature flags and the user's preferences,
// exactly like a normal Immich install: features the user (or admin) turned off disappear.
import {
  mdiAccountMultipleOutline,
  mdiAccountOutline,
  mdiArchiveArrowDownOutline,
  mdiBookshelf,
  mdiCog,
  mdiCompassOutline,
  mdiDatabaseOutline,
  mdiFolderOutline,
  mdiHeartOutline,
  mdiImageMultipleOutline,
  mdiImageAlbum,
  mdiLockOutline,
  mdiMapMarkerOutline,
  mdiMapOutline,
  mdiServer,
  mdiShareVariantOutline,
  mdiTagOutline,
  mdiToolboxOutline,
  mdiTrashCanOutline,
  mdiTimerSand,
  mdiAlertOctagonOutline,
  mdiClockOutline,
  mdiLibraryShelves,
} from '@mdi/js';
import type { Preferences, ServerFeatures } from '../../api/types';

export interface NavItem {
  label: string;
  to: string;
  icon: string;
  show: boolean;
}

export function userNavItems(features: Partial<ServerFeatures> | undefined, prefs: Preferences): NavItem[] {
  return [
    { label: 'Photos', to: '/photos', icon: mdiImageMultipleOutline, show: true },
    { label: 'Explore', to: '/explore', icon: mdiCompassOutline, show: features?.search !== false },
    { label: 'Map', to: '/map', icon: mdiMapOutline, show: features?.map !== false },
    { label: 'People', to: '/people', icon: mdiAccountMultipleOutline, show: prefs.people.enabled },
    { label: 'Places', to: '/places', icon: mdiMapMarkerOutline, show: true },
    { label: 'Favorites', to: '/favorites', icon: mdiHeartOutline, show: true },
    { label: 'Albums', to: '/albums', icon: mdiImageAlbum, show: true },
    { label: 'Sharing', to: '/sharing', icon: mdiShareVariantOutline, show: true },
    { label: 'Memories', to: '/memories', icon: mdiTimerSand, show: prefs.memories.enabled && !!prefs.memories.sidebarWeb },
    { label: 'Recently added', to: '/recently-added', icon: mdiClockOutline, show: prefs.recentlyAdded.sidebarWeb },
    { label: 'Folders', to: '/folders', icon: mdiFolderOutline, show: prefs.folders.enabled && prefs.folders.sidebarWeb },
    { label: 'Tags', to: '/tags', icon: mdiTagOutline, show: prefs.tags.enabled && prefs.tags.sidebarWeb },
    { label: 'Utilities', to: '/utilities', icon: mdiToolboxOutline, show: true },
    { label: 'Archive', to: '/archive', icon: mdiArchiveArrowDownOutline, show: true },
    { label: 'Locked folder', to: '/locked', icon: mdiLockOutline, show: true },
    { label: 'Trash', to: '/trash', icon: mdiTrashCanOutline, show: features?.trash !== false },
  ].filter((i) => i.show);
}

export const adminNavItems: NavItem[] = [
  { label: 'Users', to: '/admin/users', icon: mdiAccountOutline, show: true },
  { label: 'Server status', to: '/admin/server-status', icon: mdiServer, show: true },
  { label: 'System settings', to: '/admin/system-settings', icon: mdiCog, show: true },
  { label: 'Libraries', to: '/admin/library-management', icon: mdiLibraryShelves, show: true },
  { label: 'Maintenance', to: '/admin/maintenance', icon: mdiDatabaseOutline, show: true },
  { label: 'Error log', to: '/admin/error-log', icon: mdiAlertOctagonOutline, show: true },
  { label: 'Back to photos', to: '/photos', icon: mdiBookshelf, show: true },
];
