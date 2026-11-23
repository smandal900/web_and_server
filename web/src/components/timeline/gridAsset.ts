// What a thumbnail needs to know about a picture. Timeline rows, full assets (search, albums, ...)
// and memory/shared-link assets are all converted to this one small shape.
import type { Asset, TimelineAsset } from '../../api/types';

export interface GridAsset {
  id: string;
  ratio: number;
  thumbhash: string | null;
  isVideo: boolean;
  duration: number | string | null;
  isFavorite: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  isLocked: boolean;
  isLivePhoto: boolean;
  isPanorama: boolean;
  stackCount: number;
  ownerId?: string;
  /** Used to group by day. Only the timeline fills `localOffsetHours`. */
  fileCreatedAt?: string;
  localOffsetHours?: number;
}

/**
 * A photo known only from the "select all" list: enough to run actions on it (favorite, archive, trash, ...), nothing to draw.
 * Flags: 1 favorite, 2 archived, 4 locked, 8 video, 16 trashed.
 */
export const fromSelection = ([id, flags]: [string, number]): GridAsset => ({
  id,
  ratio: 1,
  thumbhash: null,
  isVideo: !!(flags & 8),
  duration: null,
  isFavorite: !!(flags & 1),
  isArchived: !!(flags & 2),
  isTrashed: !!(flags & 16),
  isLocked: !!(flags & 4),
  isLivePhoto: false,
  isPanorama: false,
  stackCount: 0,
});

export const fromTimeline = (a: TimelineAsset): GridAsset => ({
  id: a.id,
  ratio: a.ratio,
  thumbhash: a.thumbhash,
  isVideo: !a.isImage,
  duration: a.duration,
  isFavorite: a.isFavorite,
  isArchived: a.visibility === 'archive',
  isTrashed: a.isTrashed,
  isLocked: a.visibility === 'locked',
  isLivePhoto: !!a.livePhotoVideoId,
  isPanorama: a.projectionType === 'EQUIRECTANGULAR',
  stackCount: a.stack ? a.stack[1] : 0,
  ownerId: a.ownerId,
  fileCreatedAt: a.fileCreatedAt,
  localOffsetHours: a.localOffsetHours,
});

export const fromAsset = (a: Asset): GridAsset => ({
  id: a.id,
  ratio: a.width && a.height ? a.width / a.height : 1,
  thumbhash: a.thumbhash,
  isVideo: a.type === 'VIDEO',
  duration: a.duration,
  isFavorite: a.isFavorite,
  isArchived: a.visibility === 'archive' || a.isArchived,
  isTrashed: a.isTrashed,
  isLocked: a.visibility === 'locked',
  isLivePhoto: !!a.livePhotoVideoId,
  isPanorama: a.exifInfo?.projectionType === 'EQUIRECTANGULAR',
  stackCount: a.stack?.assetCount ?? 0,
  ownerId: a.ownerId,
  fileCreatedAt: a.fileCreatedAt,
  localOffsetHours: 0,
});
