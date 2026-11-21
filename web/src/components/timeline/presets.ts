// Which actions each kind of page offers. The first few become buttons, the rest go in the "more" menu.
import type { ActionId } from '../../hooks/useAssetActions';

export const MAIN_ACTIONS: ActionId[] = ['addToAlbum', 'share', 'favorite', 'download', 'archive', 'changeDate', 'changeDescription', 'changeLocation', 'tag', 'stack', 'linkLivePhoto', 'lock', 'trash'];
export const ARCHIVE_ACTIONS: ActionId[] = ['addToAlbum', 'favorite', 'download', 'archive', 'lock', 'trash'];
export const TRASH_ACTIONS: ActionId[] = ['restore', 'deletePermanent'];
export const LOCKED_ACTIONS: ActionId[] = ['download', 'lock', 'trash'];
export const ALBUM_ACTIONS: ActionId[] = ['addToAlbum', 'share', 'favorite', 'download', 'removeFromAlbum', 'archive', 'changeDate', 'changeDescription', 'changeLocation', 'tag', 'trash'];
export const READONLY_ACTIONS: ActionId[] = ['download'];
export const SHARED_LINK_ACTIONS: ActionId[] = ['download', 'removeFromSharedLink'];
