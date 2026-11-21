import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, requireAuth } from '../auth.js';

export const router = Router();
router.use(requireAuth);

const VISIBILITIES = new Set(['archive', 'timeline', 'hidden', 'locked']);

/** WHERE clause shared by the bucket list and a single bucket. */
function filter(req) {
  const q = req.query;
  const where = ['owner_id = ?'];
  const params = [req.user.id];

  where.push(q.isTrashed === 'true' ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL');
  if (q.isFavorite === 'true') where.push('is_favorite = 1');
  if (q.isFavorite === 'false') where.push('is_favorite = 0');

  if (VISIBILITIES.has(q.visibility)) {
    where.push('visibility = ?');
    params.push(q.visibility);
  } else if (q.isTrashed !== 'true') {
    where.push("visibility = 'timeline'");
  }

  // Albums, people and tags do not exist yet, so nothing can belong to them.
  if (q.albumId || q.personId || q.tagId) where.push('1 = 0');

  return { clause: where.join(' AND '), params, desc: q.order !== 'asc' };
}

router.get('/buckets', (req, res) => {
  const { clause, params, desc } = filter(req);
  const rows = db
    .prepare(
      `SELECT substr(local_date_time, 1, 7) AS month, COUNT(*) AS count FROM assets
       WHERE ${clause} GROUP BY month ORDER BY month ${desc ? 'DESC' : 'ASC'}`,
    )
    .all(...params);
  res.json(rows.map((r) => ({ timeBucket: `${r.month}-01`, count: r.count })));
});

// One month of assets in the column-per-field layout the web app expects.
router.get('/bucket', (req, res) => {
  const month = String(req.query.timeBucket ?? '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, 'timeBucket should be a date');

  const { clause, params, desc } = filter(req);
  const dir = desc ? 'DESC' : 'ASC';
  const rows = db
    .prepare(
      `SELECT * FROM assets WHERE ${clause} AND substr(local_date_time, 1, 7) = ?
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
    ratio: rows.map((r) => (r.width && r.height ? r.width / r.height : 1)),
    thumbhash: rows.map((r) => r.thumbhash),
    visibility: rows.map((r) => r.visibility),
  });
});
