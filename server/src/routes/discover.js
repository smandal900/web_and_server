import { Router } from 'express';
import { HttpError, requireAuth } from '../auth.js';
import { AssetFilter } from '../asset-filter.js';
import { db } from '../db.js';
import { ownedIds } from '../access.js';
import { chunks, placeholders, streamJsonList, stringList, wrap } from '../util.js';
import { toAssetDtos } from '../assets.js';
import { personDto } from '../assets.js';
import { placeAt } from '../geocode.js';
import { purgeAssets } from '../purge.js';

// Finding things (search, map, folders, memories) and the trash can.
export const searchRouter = Router();
export const mapRouter = Router();
export const viewRouter = Router();
export const memoriesRouter = Router();
export const trashRouter = Router();
for (const r of [searchRouter, mapRouter, viewRouter, memoriesRouter, trashRouter]) r.use(requireAuth);

const exifOf = (key) => `json_extract(exif, '$.${key}')`;
const like = (value) => `%${String(value).replace(/[\\%_]/g, '\\$&')}%`;
/** `expr LIKE ?` with backslash as the escape character; the value is built with like(). */
const LIKE = (expr) => `${expr} LIKE ? ESCAPE '\\'`;

// ---- search -------------------------------------------------------------------------------------------------------

/** WHERE clause for the filters shared by metadata search, smart search, random and statistics. */
function filterFor(req, body) {
  const f = new AssetFilter().add('owner_id = ?', req.user.id);

  if (body.isTrashed === true || body.trashedAfter || body.trashedBefore) f.add('deleted_at IS NOT NULL');
  else if (body.withDeleted !== true) f.trashed(false);

  // an unset visibility searches the timeline and the archive, never hidden or locked photos
  f.visibility(req, body.visibility ?? (body.isArchived === true ? 'archive' : undefined), "visibility IN ('timeline', 'archive')");
  f.favorite(body.isFavorite);

  if (body.originalFileName) f.add(LIKE('original_file_name'), like(body.originalFileName));
  if (body.description) f.add(LIKE(exifOf('description')), like(body.description));
  if (body.type === 'IMAGE' || body.type === 'VIDEO') f.add('type = ?', body.type);
  for (const field of ['city', 'state', 'country', 'make', 'model', 'lensModel']) {
    if (body[field]) f.add(`${exifOf(field)} = ? COLLATE NOCASE`, String(body[field]));
  }
  if (body.rating !== undefined && body.rating !== null) f.add(`${exifOf('rating')} = ?`, Number(body.rating));
  f.between('file_created_at', body.takenAfter, body.takenBefore).between('created_at', body.createdAfter, body.createdBefore);
  f.people(stringList(body.personIds)).tags(stringList(body.tagIds)).albums(stringList(body.albumIds));
  if (body.isNotInAlbum === true) f.add('NOT EXISTS (SELECT 1 FROM album_assets aa WHERE aa.asset_id = assets.id)');
  if (body.isOffline === true) f.add('0 = 1');
  if (body.withStacked !== true) f.collapseStacks();
  return f;
}

/** The words of a "smart" query, each of which has to match somewhere (name, description, place, camera, tag or album). */
function addTextQuery(f, text) {
  const words = String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const columns = ['original_file_name', ...['description', 'city', 'state', 'country', 'make', 'model'].map(exifOf)];
  const anyOf = [
    ...columns.map(LIKE),
    `EXISTS (SELECT 1 FROM tag_assets ta JOIN tags t ON t.id = ta.tag_id WHERE ta.asset_id = assets.id AND ${LIKE('t.value')})`,
    `EXISTS (SELECT 1 FROM album_assets aa JOIN albums al ON al.id = aa.album_id WHERE aa.asset_id = assets.id AND ${LIKE('al.name')})`,
  ];
  for (const word of words) f.add(`(${anyOf.join(' OR ')})`, ...anyOf.map(() => like(word)));
}

function runSearch(req, body, { text } = {}) {
  const filter = filterFor(req, body);
  if (text) addTextQuery(filter, text);
  const clause = filter.clause;
  const page = Math.max(1, Number(body.page) || 1);
  const size = Math.max(1, Math.min(1000, Number(body.size) || 100));
  const dir = body.order === 'asc' ? 'ASC' : 'DESC';
  const rows = db
    .prepare(`SELECT * FROM assets WHERE ${clause} ORDER BY local_date_time ${dir}, id ${dir} LIMIT ? OFFSET ?`)
    .all(...filter.params, size + 1, (page - 1) * size);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM assets WHERE ${clause}`).get(...filter.params).n;
  const items = toAssetDtos(rows.slice(0, size), { exif: body.withExif !== false });
  return {
    albums: { total: 0, count: 0, items: [], facets: [] },
    assets: { total, count: items.length, items, facets: [], nextPage: rows.length > size ? String(page + 1) : null },
  };
}

searchRouter.post('/metadata', (req, res) => res.json(runSearch(req, req.body ?? {})));

// No machine-learning model here, so "smart" search matches the words of the query against file names,
// descriptions, places, camera, tags and album names instead of the picture content.
searchRouter.post('/smart', (req, res) => {
  const body = req.body ?? {};
  if (!String(body.query ?? '').trim()) throw new HttpError(400, 'query should not be empty');
  res.json(runSearch(req, body, { text: body.query }));
});

searchRouter.post('/random', (req, res) => {
  const filter = filterFor(req, req.body ?? {});
  const size = Math.max(1, Math.min(1000, Number(req.body?.size) || 250));
  const rows = db.prepare(`SELECT * FROM assets WHERE ${filter.clause} ORDER BY RANDOM() LIMIT ?`).all(...filter.params, size);
  res.json(toAssetDtos(rows));
});

searchRouter.post('/statistics', (req, res) => {
  const filter = filterFor(req, req.body ?? {});
  res.json({ total: db.prepare(`SELECT COUNT(*) AS n FROM assets WHERE ${filter.clause}`).get(...filter.params).n });
});

searchRouter.post('/large-assets', (req, res) => {
  const filter = filterFor(req, req.body ?? {});
  if (req.body?.minFileSize) filter.add('file_size >= ?', Number(req.body.minFileSize));
  const size = Math.max(1, Math.min(1000, Number(req.body?.size) || 50));
  res.json(toAssetDtos(db.prepare(`SELECT * FROM assets WHERE ${filter.clause} ORDER BY file_size DESC LIMIT ?`).all(...filter.params, size)));
});

const SUGGEST = { country: 'country', state: 'state', city: 'city', 'camera-make': 'make', 'camera-model': 'model', 'camera-lens-model': 'lensModel' };

searchRouter.get('/suggestions', (req, res) => {
  const key = SUGGEST[String(req.query.type ?? '')];
  if (!key) throw new HttpError(400, 'type must be country, state, city, camera-make, camera-model or camera-lens-model');
  const f = new AssetFilter().add('owner_id = ?', req.user.id).trashed(false).add(`${exifOf(key)} IS NOT NULL AND ${exifOf(key)} != ''`);
  for (const narrowing of ['country', 'state', 'make', 'model']) {
    if (req.query[narrowing] && narrowing !== key) f.add(`${exifOf(narrowing)} = ?`, String(req.query[narrowing]));
  }
  const rows = db.prepare(`SELECT DISTINCT ${exifOf(key)} AS v FROM assets WHERE ${f.clause} ORDER BY v COLLATE NOCASE LIMIT 500`).all(...f.params);
  res.json(rows.map((r) => r.v));
});

// one photo per city (needs places stored with the photos, which only some imports have)
const cityRows = (uid) =>
  db
    .prepare(
      `SELECT * FROM assets WHERE owner_id = ? AND deleted_at IS NULL AND visibility = 'timeline' AND ${exifOf('city')} IS NOT NULL AND ${exifOf('city')} != ''
       GROUP BY ${exifOf('city')} ORDER BY ${exifOf('city')} COLLATE NOCASE LIMIT 200`,
    )
    .all(uid);

searchRouter.get('/cities', (req, res) => res.json(toAssetDtos(cityRows(req.user.id))));

searchRouter.get('/explore', (req, res) => {
  const rows = cityRows(req.user.id);
  const dtos = toAssetDtos(rows);
  res.json(rows.length ? [{ fieldName: 'exifInfo.city', items: rows.map((r, i) => ({ value: JSON.parse(r.exif).city, data: dtos[i] })) }] : []);
});

searchRouter.get('/person', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM people WHERE owner_id = ? AND ${LIKE('name')} ORDER BY name COLLATE NOCASE LIMIT 100`)
    .all(req.user.id, like(req.query.name ?? ''));
  res.json(rows.map(personDto));
});

// ---- map ----------------------------------------------------------------------------------------------------------

const MARKER_PAGE = 2000;

// Up to every photo of the library has a marker, so they are sent in pages instead of one big array.
mapRouter.get('/markers', wrap(async (req, res) => {
  const f = new AssetFilter()
    .add('owner_id = ?', req.user.id)
    .trashed(false)
    .add(`${exifOf('latitude')} IS NOT NULL AND ${exifOf('longitude')} IS NOT NULL`)
    .add(req.query.isArchived === 'true' ? "visibility IN ('timeline', 'archive')" : "visibility = 'timeline'")
    .favorite(req.query.isFavorite)
    .between('file_created_at', req.query.fileCreatedAfter, req.query.fileCreatedBefore);
  const page = db.prepare(
    `SELECT rowid AS rid, id, ${exifOf('latitude')} AS lat, ${exifOf('longitude')} AS lon, ${exifOf('city')} AS city, ${exifOf('state')} AS state,
            ${exifOf('country')} AS country FROM assets WHERE ${f.clause} AND rowid > ? ORDER BY rowid LIMIT ?`,
  );
  let after = 0;
  await streamJsonList(res, null, '', () => {
    const rows = page.all(...f.params, after, MARKER_PAGE);
    if (rows.length) after = rows[rows.length - 1].rid;
    return rows.map(({ rid, ...marker }) => marker);
  });
}));

// the nearest place to a point, from the offline place list (see geocode.js); an empty list when there is none
mapRouter.get('/reverse-geocode', (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new HttpError(400, 'lat and lon should be numbers: lat from -90 to 90, lon from -180 to 180');
  }
  const place = placeAt(lat, lon);
  res.json(place ? [place] : []);
});

// ---- folders ------------------------------------------------------------------------------------------------------
// Photos imported in place keep their real folder. Uploaded photos live in the managed library, so they are shown
// under "upload/<year>/<month>".

const SLASHED = "replace(original_path, '\\', '/')";
const FOLDER = `CASE WHEN original_path LIKE '/%' OR original_path GLOB '[A-Za-z]:*'
  THEN substr(${SLASHED}, 1, length(rtrim(${SLASHED}, replace(${SLASHED}, '/', ''))) - 1)
  ELSE 'upload/' || substr(local_date_time, 1, 4) || '/' || substr(local_date_time, 6, 2) END`;

viewRouter.get('/folder/unique-paths', (req, res) => {
  const rows = db
    .prepare(`SELECT DISTINCT ${FOLDER} AS folder FROM assets WHERE owner_id = ? AND deleted_at IS NULL AND visibility = 'timeline' ORDER BY folder COLLATE NOCASE`)
    .all(req.user.id);
  res.json(rows.map((r) => r.folder));
});

viewRouter.get('/folder', (req, res) => {
  const folder = String(req.query.path ?? '');
  const rows = db
    .prepare(
      `SELECT * FROM assets WHERE owner_id = ? AND deleted_at IS NULL AND visibility = 'timeline' AND ${FOLDER} = ? ORDER BY original_file_name COLLATE NOCASE LIMIT 5000`,
    )
    .all(req.user.id, folder);
  res.json(toAssetDtos(rows));
});

// ---- memories: "on this day" in earlier years ---------------------------------------------------------------------

// Few photos per year and a limited number of years: a memory is a taste, not the whole day.
const MEMORY_ASSETS = 50;
const MEMORY_YEARS = 15;

function onThisDay(userId, forDate, onlyYear) {
  const day = Number.isNaN(Date.parse(forDate)) ? new Date() : new Date(forDate);
  const pad = (n) => String(n).padStart(2, '0');
  const monthDay = `${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  const year = day.getFullYear();
  // the database keeps only the first MEMORY_ASSETS of each year, so a busy day never loads thousands of rows
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT assets.*, ROW_NUMBER() OVER (PARTITION BY substr(local_date_time, 1, 4) ORDER BY local_date_time) AS n FROM assets
         WHERE owner_id = ? AND deleted_at IS NULL AND visibility = 'timeline' AND substr(local_date_time, 6, 5) = ?
           AND CAST(substr(local_date_time, 1, 4) AS INTEGER) < ? AND CAST(substr(local_date_time, 1, 4) AS INTEGER) >= ?
           AND (? IS NULL OR CAST(substr(local_date_time, 1, 4) AS INTEGER) = ?)
       ) WHERE n <= ? ORDER BY local_date_time`,
    )
    .all(userId, monthDay, year, year - MEMORY_YEARS, onlyYear ?? null, onlyYear ?? null, MEMORY_ASSETS);
  const byYear = new Map();
  for (const row of rows) {
    const y = Number(row.local_date_time.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(row);
  }
  const showAt = new Date(year, day.getMonth(), day.getDate()).toISOString();
  const hideAt = new Date(year, day.getMonth(), day.getDate(), 23, 59, 59, 999).toISOString();
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, items]) => ({
      id: `otd-${year}${monthDay.replace('-', '')}-${y}`,
      createdAt: showAt,
      updatedAt: showAt,
      memoryAt: `${y}-${monthDay}T00:00:00.000Z`,
      showAt,
      hideAt,
      isSaved: false,
      type: 'on_this_day',
      data: { year: y },
      ownerId: userId,
      assets: toAssetDtos(items),
    }));
}

memoriesRouter.get('/', (req, res) => res.json(onThisDay(req.user.id, req.query.for)));
memoriesRouter.get('/statistics', (req, res) => {
  const day = Number.isNaN(Date.parse(req.query.for)) ? new Date() : new Date(req.query.for);
  const monthDay = `${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const total = db
    .prepare(
      `SELECT COUNT(DISTINCT substr(local_date_time, 1, 4)) AS n FROM assets WHERE owner_id = ? AND deleted_at IS NULL AND visibility = 'timeline'
       AND substr(local_date_time, 6, 5) = ? AND CAST(substr(local_date_time, 1, 4) AS INTEGER) < ? AND CAST(substr(local_date_time, 1, 4) AS INTEGER) >= ?`,
    )
    .get(req.user.id, monthDay, day.getFullYear(), day.getFullYear() - MEMORY_YEARS).n;
  res.json({ total });
});
// a memory id ends with its year, so only that year is built
const memoryById = (userId, id) => onThisDay(userId, undefined, Number(id.slice(-4))).find((m) => m.id === id);

memoriesRouter.get('/:id', (req, res) => {
  const memory = memoryById(req.user.id, req.params.id);
  if (!memory) throw new HttpError(404, 'Memory not found');
  res.json(memory);
});
// memories are generated, so there is nothing to save or delete
memoriesRouter.put('/:id', (req, res) => {
  const memory = memoryById(req.user.id, req.params.id);
  if (!memory) throw new HttpError(404, 'Memory not found');
  res.json({ ...memory, isSaved: !!req.body?.isSaved });
});
memoriesRouter.delete('/:id', (_req, res) => res.status(204).end());

// ---- trash --------------------------------------------------------------------------------------------------------

trashRouter.post('/empty', (req, res) => {
  const rows = db.prepare('SELECT id, owner_id, original_path FROM assets WHERE owner_id = ? AND deleted_at IS NOT NULL').all(req.user.id);
  purgeAssets(rows);
  res.json({ count: rows.length });
});

trashRouter.post('/restore', (req, res) => {
  const { changes } = db.prepare('UPDATE assets SET deleted_at = NULL WHERE owner_id = ? AND deleted_at IS NOT NULL').run(req.user.id);
  res.json({ count: changes });
});

trashRouter.post('/restore/assets', (req, res) => {
  const parts = chunks(ownedIds(req.body?.ids, req.user.id));
  const count = db.transaction(() =>
    parts.reduce((n, part) => n + db.prepare(`UPDATE assets SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND id IN (${placeholders(part)})`).run(...part).changes, 0),
  );
  res.json({ count });
});
