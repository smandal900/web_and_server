import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, requireAuth } from '../auth.js';
import { albumFor } from '../access.js';
import { AssetFilter } from '../asset-filter.js';
import { VISIBILITIES, placeholders, streamJsonList, wrap } from '../util.js';

export const router = Router();
router.use(requireAuth);

/** WHERE clause shared by the bucket list and a single bucket. */
function filter(req) {
  const q = req.query;
  const uid = req.user.id;
  const f = new AssetFilter();

  if (q.albumId) {
    // an album can hold photos of several people, so it is not limited to the caller's own assets
    const { album } = albumFor(String(q.albumId), uid);
    f.add('id IN (SELECT asset_id FROM album_assets WHERE album_id = ?)', album.id);
  } else {
    let owners = [uid];
    // partners who chose to show the shared photos in the timeline (only the ordinary timeline, not archive or locked)
    if (q.withPartners === 'true' && !VISIBILITIES.has(q.visibility) && q.isTrashed !== 'true') {
      owners = owners.concat(db.prepare('SELECT shared_by_id FROM partners WHERE shared_with_id = ? AND in_timeline = 1').all(uid).map((r) => r.shared_by_id));
    }
    f.add(`owner_id IN (${placeholders(owners)})`, ...owners);
  }

  f.trashed(q.isTrashed === 'true').favorite(q.isFavorite);
  // without a visibility: the ordinary timeline, or inside an album everything except the locked folder
  f.visibility(req, q.visibility, q.albumId ? "visibility != 'locked'" : q.isTrashed !== 'true' ? "visibility = 'timeline'" : null);
  if (q.personId) f.people([String(q.personId)]);
  if (q.tagId) f.tags([String(q.tagId)]);
  if (q.withStacked === 'true') f.collapseStacks(); // only the cover of each stack

  return { clause: f.clause, params: f.params, desc: q.order !== 'asc' };
}

router.get('/buckets', (req, res) => {
  const { clause, params, desc } = filter(req);
  const rows = db
    .prepare(
      `SELECT substr(local_date_time, 1, 7) AS month, COUNT(*) AS count FROM assets
       WHERE ${clause} GROUP BY month ORDER BY month ${desc ? 'DESC' : 'ASC'}`,
    )
    .all(...params);
  res.json(rows.map((r) => ({ timeBucket: `${r.month}-01T00:00:00.000Z`, count: r.count })));
});

// One month of assets in the column-per-field layout the web app expects.
router.get('/bucket', (req, res) => {
  const month = String(req.query.timeBucket ?? '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, 'timeBucket should be a date');

  const { clause, params, desc } = filter(req);
  const dir = desc ? 'DESC' : 'ASC';
  const rows = db
    .prepare(
      `SELECT assets.*, CASE WHEN stack_id IS NULL THEN NULL ELSE
         stack_id || ',' || (SELECT COUNT(*) FROM assets x WHERE x.stack_id = assets.stack_id AND x.deleted_at IS NULL) END AS stack_info
       FROM assets WHERE ${clause} AND substr(local_date_time, 1, 7) = ?
       ORDER BY local_date_time ${dir}, id ${dir}`,
    )
    .all(...params, month);

  res.json({
    id: rows.map((r) => r.id),
    ownerId: rows.map((r) => r.owner_id),
    createdAt: rows.map((r) => r.created_at),
    fileCreatedAt: rows.map((r) => r.file_created_at),
    localOffsetHours: rows.map((r) => r.local_offset_hours),
    duration: rows.map((r) => r.duration_ms),
    isFavorite: rows.map((r) => !!r.is_favorite),
    isImage: rows.map((r) => r.type === 'IMAGE'),
    isTrashed: rows.map((r) => !!r.deleted_at),
    livePhotoVideoId: rows.map(() => null),
    projectionType: rows.map(() => null),
    ratio: rows.map((r) => {
      const w = r.edit_width ?? r.width;
      const h = r.edit_height ?? r.height;
      return w && h ? w / h : 1;
    }),
    stack: rows.map((r) => (r.stack_info ? [r.stack_info.split(',')[0], Number(r.stack_info.split(',')[1])] : null)),
    thumbhash: rows.map((r) => r.thumbhash),
    visibility: rows.map((r) => r.visibility),
  });
});

// "Select all": every photo of the current view, as one small row each: [id, flags].
// The grid only holds the months near the screen, so it cannot select what it has not loaded. This is a few dozen
// bytes per photo, sent in pages, so even a very large library costs the worker almost nothing.
//   flags: 1 favorite, 2 archived, 4 locked, 8 video, 16 trashed
const SELECTION_PAGE = 2000;

router.get(
  '/selection',
  wrap(async (req, res) => {
    const { clause, params } = filter(req);
    const page = db.prepare(
      `SELECT rowid AS rid, id, is_favorite, visibility, type, deleted_at FROM assets WHERE ${clause} AND rowid > ? ORDER BY rowid LIMIT ?`,
    );
    let after = 0;
    await streamJsonList(res, null, '', () => {
      const rows = page.all(...params, after, SELECTION_PAGE);
      if (rows.length) after = rows[rows.length - 1].rid;
      return rows.map((r) => [
        r.id,
        (r.is_favorite ? 1 : 0) | (r.visibility === 'archive' ? 2 : 0) | (r.visibility === 'locked' ? 4 : 0) | (r.type === 'VIDEO' ? 8 : 0) | (r.deleted_at ? 16 : 0),
      ]);
    });
  }),
);
