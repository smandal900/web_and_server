// Assets: single asset info, URLs for pictures, timeline buckets, bulk actions, trash, stacks, downloads.
import { buildUrl, call } from './client';
import { E } from './endpoints';
import type { Asset, TimelineAsset, TimelineBucket, TimelineQuery, Visibility } from './types';

export type ImageSize = 'thumbnail' | 'preview' | 'fullsize';

// --- URLs (used directly in <img>/<video>) -------------------------------
// `key` is a shared-link key: public pages send it so no login is needed.
export const thumbnailUrl = (id: string, size: ImageSize = 'thumbnail', key?: string) =>
  buildUrl('/assets/{id}/thumbnail', { id }, { size, key });
export const originalUrl = (id: string, key?: string) => buildUrl('/assets/{id}/original', { id }, { key });
export const videoUrl = (id: string, key?: string) => buildUrl('/assets/{id}/video/playback', { id }, { key });
export const personThumbnailUrl = (id: string) => buildUrl('/people/{id}/thumbnail', { id });
export const avatarUrl = (userId: string) => buildUrl('/users/{id}/profile-image', { id: userId });

// --- single asset ---------------------------------------------------------
export const getAsset = (id: string, key?: string) => call<Asset>(E.assets.get, { params: { id }, query: { key } });
export const getOcr = (id: string) =>
  call<Array<{ text: string; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; x4: number; y4: number }>>(
    E.assets.ocr,
    { params: { id } },
  );
export const getAssetStatistics = (query: Record<string, unknown> = {}) =>
  call<{ images: number; videos: number; total: number }>(E.assets.statistics, { query });

export interface AssetPatch {
  isFavorite?: boolean;
  visibility?: Visibility;
  description?: string;
  rating?: number;
  dateTimeOriginal?: string;
  latitude?: number;
  longitude?: number;
  livePhotoVideoId?: string | null;
}
export const updateAsset = (id: string, body: AssetPatch) => call<Asset>(E.assets.update, { params: { id }, body });
/** Change many assets at once (favorite, archive, date, location, ...). */
export const updateAssets = (ids: string[], patch: AssetPatch) =>
  call(E.assets.bulkUpdate, { body: { ids, ...patch } });
export const deleteAssets = (ids: string[], force = false) => call(E.assets.delete, { body: { ids, force } });

// --- edits (crop / rotate / mirror) -------------------------------------
export type EditAction =
  | { action: 'crop'; parameters: { x: number; y: number; width: number; height: number } }
  | { action: 'rotate'; parameters: { angle: 90 | 180 | 270 } }
  | { action: 'mirror'; parameters: { axis: 'horizontal' | 'vertical' } };
export const saveEdits = (id: string, edits: EditAction[]) => call(E.assets.saveEdits, { params: { id }, body: { edits } });
export const removeEdits = (id: string) => call(E.assets.removeEdits, { params: { id } });

// --- timeline -----------------------------------------------------------
export const getTimelineBuckets = (query: TimelineQuery, signal?: AbortSignal) =>
  call<TimelineBucket[]>(E.timeline.buckets, { query: { ...query }, signal });
export const getTimelineBucket = (timeBucket: string, query: TimelineQuery, signal?: AbortSignal) =>
  call<Record<string, unknown[]>>(E.timeline.bucket, { query: { ...query, timeBucket }, signal });

/** One photo of the current view as "select all" needs it: its id and a few flags (see flagsOf). */
export type SelectionRow = [id: string, flags: number];
/** Every photo matching the filters, not only the months that are loaded: [id, flags] per photo. */
export const getTimelineSelection = (query: TimelineQuery, signal?: AbortSignal) =>
  call<SelectionRow[]>(E.timeline.selection, { query: { ...query }, signal });

/** The server sends one array per field; turn it into a list of objects. */
export function zipBucket(data: Record<string, unknown[]>): TimelineAsset[] {
  const ids = (data.id ?? []) as string[];
  const stack = data.stack as Array<[string, number] | null> | undefined;
  return ids.map((id, i) => ({
    id,
    ownerId: data.ownerId?.[i] as string,
    fileCreatedAt: data.fileCreatedAt?.[i] as string,
    localOffsetHours: (data.localOffsetHours?.[i] as number) ?? 0,
    ratio: (data.ratio?.[i] as number) || 1,
    thumbhash: (data.thumbhash?.[i] as string | null) ?? null,
    isImage: data.isImage?.[i] !== false,
    isFavorite: !!data.isFavorite?.[i],
    isTrashed: !!data.isTrashed?.[i],
    duration: (data.duration?.[i] as number | null) ?? null,
    livePhotoVideoId: (data.livePhotoVideoId?.[i] as string | null) ?? null,
    projectionType: (data.projectionType?.[i] as string | null) ?? null,
    visibility: (data.visibility?.[i] as Visibility) ?? 'timeline',
    stack: stack?.[i] ?? null,
  }));
}

// --- trash --------------------------------------------------------------
export const emptyTrash = () => call(E.trash.empty);
export const restoreAllTrash = () => call(E.trash.restoreAll);
export const restoreAssets = (ids: string[]) => call(E.trash.restore, { body: { ids } });

// --- stacks -------------------------------------------------------------
export const createStack = (assetIds: string[]) => call(E.stacks.create, { body: { assetIds } });
export const deleteStacks = (ids: string[]) => call(E.stacks.deleteMany, { body: { ids } });

// --- download -----------------------------------------------------------
export const downloadArchive = (assetIds: string[]) =>
  call<Blob>(E.download.archive, { body: { assetIds }, as: 'blob' });

/** Save a blob or URL through a temporary link. */
export function saveFile(href: string, fileName: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
}
