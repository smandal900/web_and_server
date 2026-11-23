import { Router } from 'express';
import crypto from 'node:crypto';
import { HttpError, requireAuth, toPublicUserDto } from '../auth.js';
import { db } from '../db.js';
import { ALBUM_ACCESS_SQL, albumFor, nowIso, viewableAssets } from '../access.js';
import { PAGE_SIZE, placeholders, stringList, streamJsonList, wrap } from '../util.js';
import { toAssetDtos } from '../assets.js';

// Albums, who an album is shared with, and the comments / likes on a shared album.
export const router = Router();
export const activitiesRouter = Router();
router.use(requireAuth);
activitiesRouter.use(requireAuth);

const ROLES = new Set(['editor', 'viewer']);
const ORDERS = new Set(['asc', 'desc']);
// an album is shared once it has members or a public link
const IS_SHARED_SQL = '(EXISTS (SELECT 1 FROM album_users x WHERE x.album_id = al.id) OR EXISTS (SELECT 1 FROM shared_links sl WHERE sl.album_id = al.id))';
const reload = (id) => albumDto(db.prepare('SELECT * FROM albums WHERE id = ?').get(id));
const touch = (albumId) => db.prepare('UPDATE albums SET updated_at = ? WHERE id = ?').run(nowIso(), albumId);

/** The album without its photos (they can be thousands; see albumAssetPager). */
export function albumDto(album) {
  const s = db
    .prepare(
      `SELECT COUNT(*) AS n, MIN(a.local_date_time) AS first, MAX(a.local_date_time) AS last, MAX(aa.added_at) AS added
       FROM album_assets aa JOIN assets a ON a.id = aa.asset_id WHERE aa.album_id = ? AND a.deleted_at IS NULL`,
    )
    .get(album.id);
  const members = db
    .prepare('SELECT u.*, au.role FROM album_users au JOIN users u ON u.id = au.user_id WHERE au.album_id = ? ORDER BY u.name')
    .all(album.id);
  const hasSharedLink = !!db.prepare('SELECT 1 FROM shared_links WHERE album_id = ?').get(album.id);
  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(album.owner_id);
  const cover =
    album.thumbnail_asset_id ??
    db
      .prepare(
        `SELECT aa.asset_id FROM album_assets aa JOIN assets a ON a.id = aa.asset_id
         WHERE aa.album_id = ? AND a.deleted_at IS NULL ORDER BY a.local_date_time ${album.sort_order === 'asc' ? 'ASC' : 'DESC'} LIMIT 1`,
      )
      .get(album.id)?.asset_id ??
    null;

  const dto = {
    id: album.id,
    albumName: album.name,
    description: album.description,
    albumThumbnailAssetId: cover,
    assetCount: s.n,
    shared: members.length > 0 || hasSharedLink,
    hasSharedLink,
    startDate: s.first ? `${s.first.slice(0, 19)}.000Z` : undefined,
    endDate: s.last ? `${s.last.slice(0, 19)}.000Z` : undefined,
    createdAt: album.created_at,
    updatedAt: album.updated_at,
    lastModifiedAssetTimestamp: s.added ?? undefined,
    ownerId: album.owner_id,
    owner: owner ? toPublicUserDto(owner) : undefined,
    albumUsers: members.map((u) => ({ user: toPublicUserDto(u), role: u.role })),
    isActivityEnabled: !!album.is_activity_enabled,
    order: album.sort_order,
  };
  return dto;
}

/**
 * The photos of an album, one page at a time: `pager(offset)` returns the next PAGE_SIZE asset DTOs, [] at the end.
 * An album can hold the whole library, so it is never built as one array (the workers have small heaps).
 */
export function albumAssetPager(album, { exif = true } = {}) {
  let order; // the album's asset ids in display order: a few dozen bytes per photo, instead of sorting the album again for every page
  return (offset, limit = PAGE_SIZE) => {
    order ??= db
      .prepare(
        `SELECT a.id FROM album_assets aa JOIN assets a ON a.id = aa.asset_id WHERE aa.album_id = ? AND a.deleted_at IS NULL
         ORDER BY a.local_date_time ${album.sort_order === 'asc' ? 'ASC' : 'DESC'}, a.id`,
      )
      .all(album.id)
      .map((r) => r.id);
    const ids = order.slice(offset, offset + limit);
    if (ids.length === 0) return [];
    const rows = new Map(db.prepare(`SELECT * FROM assets WHERE id IN (${placeholders(ids)})`).all(...ids).map((r) => [r.id, r]));
    return toAssetDtos(ids.map((id) => rows.get(id)).filter(Boolean), { exif });
  };
}

/** Add assets, returning one { id, success, error } per id like the official API. */
function addAssets(albumId, userId, ids) {
  const insert = db.prepare('INSERT OR IGNORE INTO album_assets (album_id, asset_id) VALUES (?, ?)');
  const viewable = viewableAssets(ids, userId, 'a.id');
  const results = db.transaction(() =>
    ids.map((id) => {
      if (!viewable.has(id)) return { id, success: false, error: 'no_permission' };
      const { changes } = insert.run(albumId, id);
      return changes ? { id, success: true } : { id, success: false, error: 'duplicate' };
    }),
  );
  if (results.some((r) => r.success)) touch(albumId);
  return results;
}

function setMembers(albumId, ownerId, members) {
  const upsert = db.prepare(
    'INSERT INTO album_users (album_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT (album_id, user_id) DO UPDATE SET role = excluded.role',
  );
  for (const m of members) {
    const role = ROLES.has(m?.role) ? m.role : 'editor';
    if (typeof m?.userId !== 'string' || m.userId === ownerId) continue;
    if (!db.prepare('SELECT 1 FROM users WHERE id = ? AND deleted_at IS NULL').get(m.userId)) throw new HttpError(400, 'User not found');
    upsert.run(albumId, m.userId, role);
  }
}

// ---- albums -------------------------------------------------------------------------------------------------------

router.get('/', (req, res) => {
  const uid = req.user.id;
  const where = [ALBUM_ACCESS_SQL];
  const params = [uid, uid];
  if (req.query.shared === 'true') where.push(`(al.owner_id != ? OR ${IS_SHARED_SQL})`), params.push(uid);
  if (req.query.shared === 'false') where.push(`al.owner_id = ? AND NOT ${IS_SHARED_SQL}`), params.push(uid);
  if (req.query.assetId) where.push('EXISTS (SELECT 1 FROM album_assets aa WHERE aa.album_id = al.id AND aa.asset_id = ?)'), params.push(String(req.query.assetId));
  const rows = db.prepare(`SELECT al.* FROM albums al WHERE ${where.join(' AND ')} ORDER BY al.updated_at DESC`).all(...params);
  res.json(rows.map((a) => albumDto(a)));
});

router.get('/statistics', (req, res) => {
  const uid = req.user.id;
  const owned = db.prepare('SELECT COUNT(*) AS n FROM albums WHERE owner_id = ?').get(uid).n;
  const notShared = db.prepare(`SELECT COUNT(*) AS n FROM albums al WHERE al.owner_id = ? AND NOT ${IS_SHARED_SQL}`).get(uid).n;
  const shared = db.prepare('SELECT COUNT(*) AS n FROM album_users WHERE user_id = ?').get(uid).n +
    db.prepare(`SELECT COUNT(*) AS n FROM albums al WHERE al.owner_id = ? AND ${IS_SHARED_SQL}`).get(uid).n;
  res.json({ owned, shared, notShared });
});

router.post('/', (req, res) => {
  const name = typeof req.body?.albumName === 'string' ? req.body.albumName.trim() : '';
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO albums (id, owner_id, name, description) VALUES (?, ?, ?, ?)').run(
    id,
    req.user.id,
    name,
    typeof req.body?.description === 'string' ? req.body.description : '',
  );
  setMembers(id, req.user.id, Array.isArray(req.body?.albumUsers) ? req.body.albumUsers : []);
  addAssets(id, req.user.id, stringList(req.body?.assetIds));
  res.status(201).json(reload(id));
});

// add the same assets to several albums at once
router.put('/assets', (req, res) => {
  const albumIds = stringList(req.body?.albumIds);
  const assetIds = stringList(req.body?.assetIds);
  let success = false;
  for (const albumId of albumIds) {
    albumFor(albumId, req.user.id, 'editor');
    if (addAssets(albumId, req.user.id, assetIds).some((r) => r.success)) success = true;
  }
  res.json(success || assetIds.length === 0 ? { success: true } : { success: false, error: 'duplicate' });
});

router.get(
  '/:id',
  wrap(async (req, res) => {
    const { album } = albumFor(req.params.id, req.user.id);
    if (req.query.withoutAssets === 'true') return res.json(albumDto(album));
    await streamJsonList(res, albumDto(album), 'assets', albumAssetPager(album));
  }),
);

router.patch('/:id', (req, res) => {
  const { album } = albumFor(req.params.id, req.user.id, 'owner');
  const b = req.body ?? {};
  const next = {
    name: typeof b.albumName === 'string' ? b.albumName.trim() : album.name,
    description: typeof b.description === 'string' ? b.description : album.description,
    thumb: album.thumbnail_asset_id,
    order: ORDERS.has(b.order) ? b.order : album.sort_order,
    activity: typeof b.isActivityEnabled === 'boolean' ? (b.isActivityEnabled ? 1 : 0) : album.is_activity_enabled,
  };
  if (b.albumThumbnailAssetId !== undefined) {
    if (b.albumThumbnailAssetId !== null && !db.prepare('SELECT 1 FROM album_assets WHERE album_id = ? AND asset_id = ?').get(album.id, b.albumThumbnailAssetId)) {
      throw new HttpError(400, 'The cover photo must be in the album');
    }
    next.thumb = b.albumThumbnailAssetId;
  }
  db.prepare('UPDATE albums SET name = ?, description = ?, thumbnail_asset_id = ?, sort_order = ?, is_activity_enabled = ?, updated_at = ? WHERE id = ?').run(
    next.name,
    next.description,
    next.thumb,
    next.order,
    next.activity,
    nowIso(),
    album.id,
  );
  res.json(reload(album.id));
});

router.delete('/:id', (req, res) => {
  const { album } = albumFor(req.params.id, req.user.id, 'owner');
  db.prepare('DELETE FROM albums WHERE id = ?').run(album.id);
  res.status(204).end();
});

router.put('/:id/assets', (req, res) => {
  const { album } = albumFor(req.params.id, req.user.id, 'editor');
  res.json(addAssets(album.id, req.user.id, stringList(req.body?.ids)));
});

router.delete('/:id/assets', (req, res) => {
  const { album, role } = albumFor(req.params.id, req.user.id, 'editor');
  const ids = stringList(req.body?.ids);
  const results = ids.map((id) => {
    const asset = db.prepare('SELECT owner_id FROM assets WHERE id = ?').get(id);
    const inAlbum = db.prepare('SELECT 1 FROM album_assets WHERE album_id = ? AND asset_id = ?').get(album.id, id);
    if (!inAlbum) return { id, success: false, error: 'not_found' };
    // an editor may only take out their own photos
    if (role !== 'owner' && asset?.owner_id !== req.user.id) return { id, success: false, error: 'no_permission' };
    db.prepare('DELETE FROM album_assets WHERE album_id = ? AND asset_id = ?').run(album.id, id);
    if (album.thumbnail_asset_id === id) db.prepare('UPDATE albums SET thumbnail_asset_id = NULL WHERE id = ?').run(album.id);
    return { id, success: true };
  });
  if (results.some((r) => r.success)) touch(album.id);
  res.json(results);
});

// ---- sharing with other users ------------------------------------------------------------------------------------

router.put('/:id/users', (req, res) => {
  const { album } = albumFor(req.params.id, req.user.id, 'owner');
  const members = Array.isArray(req.body?.albumUsers) ? req.body.albumUsers : [];
  setMembers(album.id, album.owner_id, members);
  touch(album.id);
  res.json(reload(album.id));
});

router.put('/:id/user/:userId', (req, res) => {
  const { album } = albumFor(req.params.id, req.user.id, 'owner');
  if (!ROLES.has(req.body?.role)) throw new HttpError(400, 'role must be editor or viewer');
  const { changes } = db.prepare('UPDATE album_users SET role = ? WHERE album_id = ? AND user_id = ?').run(req.body.role, album.id, req.params.userId);
  if (!changes) throw new HttpError(404, 'User is not part of this album');
  res.status(204).end();
});

router.delete('/:id/user/:userId', (req, res) => {
  const target = req.params.userId === 'me' ? req.user.id : req.params.userId;
  // the owner removes anyone; a member may remove themselves (leave the album)
  albumFor(req.params.id, req.user.id, target === req.user.id ? 'viewer' : 'owner');
  db.prepare('DELETE FROM album_users WHERE album_id = ? AND user_id = ?').run(req.params.id, target);
  touch(req.params.id);
  res.status(204).end();
});

// ---- comments and likes on an album ------------------------------------------------------------------------------

const activityDto = (a) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(a.user_id);
  return { id: a.id, createdAt: a.created_at, type: a.type, comment: a.comment ?? null, assetId: a.asset_id ?? null, user: user ? toPublicUserDto(user) : null };
};

activitiesRouter.get('/', (req, res) => {
  albumFor(String(req.query.albumId ?? ''), req.user.id);
  const where = ['album_id = ?'];
  const params = [String(req.query.albumId)];
  if (req.query.assetId) where.push('asset_id = ?'), params.push(String(req.query.assetId));
  if (req.query.level === 'album') where.push('asset_id IS NULL');
  if (req.query.type === 'comment' || req.query.type === 'like') where.push('type = ?'), params.push(req.query.type);
  if (req.query.userId) where.push('user_id = ?'), params.push(String(req.query.userId));
  res.json(db.prepare(`SELECT * FROM activities WHERE ${where.join(' AND ')} ORDER BY created_at ASC`).all(...params).map(activityDto));
});

activitiesRouter.get('/statistics', (req, res) => {
  albumFor(String(req.query.albumId ?? ''), req.user.id);
  const where = ['album_id = ?'];
  const params = [String(req.query.albumId)];
  if (req.query.assetId) where.push('asset_id = ?'), params.push(String(req.query.assetId));
  const count = (type) => db.prepare(`SELECT COUNT(*) AS n FROM activities WHERE ${where.join(' AND ')} AND type = ?`).get(...params, type).n;
  res.json({ comments: count('comment'), likes: count('like') });
});

activitiesRouter.post('/', (req, res) => {
  const { album } = albumFor(String(req.body?.albumId ?? ''), req.user.id);
  if (!album.is_activity_enabled) throw new HttpError(400, 'Activity is disabled for this album');
  const type = req.body?.type;
  const assetId = typeof req.body?.assetId === 'string' ? req.body.assetId : null;
  if (type !== 'comment' && type !== 'like') throw new HttpError(400, 'type must be comment or like');
  if (assetId && !db.prepare('SELECT 1 FROM album_assets WHERE album_id = ? AND asset_id = ?').get(album.id, assetId)) {
    throw new HttpError(400, 'The asset is not in this album');
  }
  if (type === 'comment' && !String(req.body?.comment ?? '').trim()) throw new HttpError(400, 'comment should not be empty');
  if (type === 'like') {
    const existing = db
      .prepare('SELECT * FROM activities WHERE album_id = ? AND user_id = ? AND type = ? AND asset_id IS ?')
      .get(album.id, req.user.id, 'like', assetId);
    if (existing) return res.json(activityDto(existing));
  }
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO activities (id, album_id, asset_id, user_id, type, comment) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    album.id,
    assetId,
    req.user.id,
    type,
    type === 'comment' ? String(req.body.comment).trim() : null,
  );
  res.status(201).json(activityDto(db.prepare('SELECT * FROM activities WHERE id = ?').get(id)));
});

activitiesRouter.delete('/:id', (req, res) => {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) throw new HttpError(404, 'Activity not found');
  const album = db.prepare('SELECT owner_id FROM albums WHERE id = ?').get(activity.album_id);
  if (activity.user_id !== req.user.id && album?.owner_id !== req.user.id) throw new HttpError(403, 'Not allowed');
  db.prepare('DELETE FROM activities WHERE id = ?').run(activity.id);
  res.status(204).end();
});

