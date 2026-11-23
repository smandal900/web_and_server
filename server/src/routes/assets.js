import { Router } from 'express';
import fs from 'node:fs';
import { HttpError, extractToken, isElevated, requireAuth, requireElevated } from '../auth.js';
import { db } from '../db.js';
import { absolutePath, toAssetDto } from '../assets.js';
import { AssetFilter } from '../asset-filter.js';
import { linkByKey, linkHasAsset, nowIso, ownedIds, viewableAsset } from '../access.js';
import { NOW_SQL, VISIBILITIES, chunks, placeholders, wrap } from '../util.js';
import { purgeAssets } from '../purge.js';
import { PREVIEW_FORMATS, THUMB_SIZES, thumbFile } from '../paths.js';
import { previewFormat } from '../system-config.js';

// "media" group: metadata, thumbnails, original files, video playback, and the changes made to existing assets
// (favorite, archive, trash, delete, edits, download). Uploads live in assets-upload.js.
// sharp is only imported when a thumbnail has to be rendered (see below).
export const router = Router();

/** A signed-in user, or a visitor holding the key of a shared link (only for reading assets that the link contains). */
function authOrKey(req, res, next) {
  if (extractToken(req)) return requireAuth(req, res, next);
  const key = req.query.key ?? req.query.slug;
  if (key) {
    const link = linkByKey(String(key), req.query.password);
    if (link) {
      req.sharedLink = link;
      return next();
    }
  }
  next(new HttpError(401, 'Authentication required'));
}
router.use(authOrKey);

const needUser = (req, _res, next) => next(req.user ? undefined : new HttpError(401, 'Authentication required'));

/** An asset the caller may look at. Locked-folder assets also need an unlocked session. */
const getReadable = (req) => {
  const id = req.params.id;
  let row;
  if (req.user) row = viewableAsset(id, req.user.id);
  else if (req.sharedLink && linkHasAsset(req.sharedLink, id)) row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Asset not found');
  if (row.visibility === 'locked' && req.user && !isElevated(req)) throw new HttpError(401, 'Elevated session required');
  return row;
};

const getOwned = (id, userId) => {
  const row = db.prepare('SELECT * FROM assets WHERE id = ? AND owner_id = ?').get(id, userId);
  if (!row) throw new HttpError(404, 'Asset not found');
  return row;
};

const sendOriginal = (res, next, row) =>
  res.sendFile(
    absolutePath(row),
    {
      headers: {
        'Content-Type': row.mime_type,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.original_file_name)}`,
        'Cache-Control': 'private, max-age=86400',
      },
    },
    (err) => {
      if (err && !res.headersSent) next(err.code === 'ENOENT' ? new HttpError(404, 'Original file is missing') : err);
    },
  );

router.get('/statistics', needUser, (req, res) => {
  const f = new AssetFilter().add('owner_id = ?', req.user.id).trashed(req.query.isTrashed === 'true').favorite(req.query.isFavorite).visibility(req, req.query.visibility);
  const rows = db.prepare(`SELECT type, COUNT(*) AS n FROM assets WHERE ${f.clause} GROUP BY type`).all(...f.params);
  const count = (type) => rows.find((r) => r.type === type)?.n ?? 0;
  res.json({ images: count('IMAGE'), videos: count('VIDEO'), total: count('IMAGE') + count('VIDEO') });
});

// The server does not track which asset ids a phone deleted from its own storage, so there is nothing to sync back.
router.get('/device-deletions', needUser, (_req, res) => res.json({ assetIds: [] }));
router.delete('/device-deletions', needUser, (_req, res) => res.json({ assetIds: [] }));

// ---- changing assets ----------------------------------------------------------------------------------------------

/** Wall-clock part, UTC instant and offset of a date the user typed (with or without a UTC offset). */
function parseTakenAt(value) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(String(value));
  if (!m) throw new HttpError(400, 'dateTimeOriginal should be a valid date');
  const zone = m[3] && m[3] !== 'Z' ? m[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2') : 'Z';
  const instant = new Date(`${m[1]}T${m[2]}${zone}`);
  if (Number.isNaN(instant.getTime())) throw new HttpError(400, 'dateTimeOriginal should be a valid date');
  const offset = zone === 'Z' ? 0 : (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) + Number(zone.slice(4, 6)) / 60);
  return { fileCreatedAt: instant.toISOString(), localDateTime: `${m[1]}T${m[2]}.000Z`, offset };
}

function applyUpdate(req, ids, body) {
  // check the request first, so a bad one is refused (and logged) even when none of the ids belong to the caller
  if (body.visibility !== undefined) {
    if (!VISIBILITIES.has(body.visibility)) throw new HttpError(400, 'visibility must be one of: archive, timeline, hidden, locked');
    if (body.visibility === 'locked') requireElevated(req);
  }
  const taken = body.dateTimeOriginal !== undefined ? parseTakenAt(body.dateTimeOriginal) : null;

  const owned = ownedIds(ids, req.user.id);
  if (owned.length === 0) return owned;
  const touched = `updated_at = ${NOW_SQL}`;
  const exifChanges = {};
  if (body.description !== undefined) exifChanges.description = String(body.description ?? '') || null;
  if (body.rating !== undefined) exifChanges.rating = body.rating === null ? null : Math.max(0, Math.min(5, Number(body.rating) || 0)) || null;
  if (body.latitude !== undefined && body.longitude !== undefined) {
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) throw new HttpError(400, 'latitude / longitude are out of range');
    exifChanges.latitude = lat;
    exifChanges.longitude = lon;
  }
  const write = db.prepare(`UPDATE assets SET exif = ?, ${touched} WHERE id = ?`);
  // a piece at a time: the id list can be as long as the whole library, the SQL and memory use must not grow with it
  const updatePart = (part) => {
    const marks = placeholders(part);
    if (typeof body.isFavorite === 'boolean') {
      db.prepare(`UPDATE assets SET is_favorite = ?, ${touched} WHERE id IN (${marks})`).run(body.isFavorite ? 1 : 0, ...part);
    }
    if (body.visibility !== undefined) db.prepare(`UPDATE assets SET visibility = ?, ${touched} WHERE id IN (${marks})`).run(body.visibility, ...part);
    if (taken) {
      db.prepare(`UPDATE assets SET file_created_at = ?, local_date_time = ?, local_offset_hours = ?, ${touched} WHERE id IN (${marks})`).run(
        taken.fileCreatedAt,
        taken.localDateTime,
        taken.offset,
        ...part,
      );
    }
    if (Object.keys(exifChanges).length) {
      for (const row of db.prepare(`SELECT id, exif FROM assets WHERE id IN (${marks})`).all(...part)) {
        write.run(JSON.stringify({ ...(row.exif ? JSON.parse(row.exif) : {}), ...exifChanges }), row.id);
      }
    }
  };
  db.transaction(() => chunks(owned).forEach(updatePart)); // one disk sync for the whole batch
  return owned;
}

router.put('/', needUser, (req, res) => {
  applyUpdate(req, req.body?.ids, req.body ?? {});
  res.status(204).end();
});

router.delete('/', needUser, (req, res) => {
  const ids = ownedIds(req.body?.ids, req.user.id);
  const deletedAt = nowIso();
  if (req.body?.force) {
    for (const part of chunks(ids)) purgeAssets(db.prepare(`SELECT id, owner_id, original_path FROM assets WHERE id IN (${placeholders(part)})`).all(...part));
  } else {
    db.transaction(() => {
      for (const part of chunks(ids)) db.prepare(`UPDATE assets SET deleted_at = ? WHERE id IN (${placeholders(part)}) AND deleted_at IS NULL`).run(deletedAt, ...part);
    });
  }
  res.status(204).end();
});

// ---- reading ---------------------------------------------------------------------------------------------------------

router.get('/:id', (req, res) => res.json(toAssetDto(getReadable(req))));

router.put('/:id', needUser, (req, res) => {
  getOwned(req.params.id, req.user.id);
  applyUpdate(req, [req.params.id], req.body ?? {});
  res.json(toAssetDto(getOwned(req.params.id, req.user.id)));
});

router.get(
  '/:id/thumbnail',
  wrap(async (req, res, next) => {
    const row = getReadable(req);
    const wanted = req.query.size === 'preview' || req.query.size === 'fullsize' ? 'preview' : 'thumbnail';

    // a browser can show most photos as they are (edited photos go through the rendered preview)
    if (req.query.size === 'fullsize' && row.type === 'IMAGE' && !row.edits && /^image\/(jpeg|png|webp|gif|avif)$/.test(row.mime_type)) {
      return sendOriginal(res, next, row);
    }

    // an empty file is only the name claimed at upload time, the thumbnail itself was never written
    const present = (f) => fs.existsSync(f) && fs.statSync(f).size > 0;
    const format = previewFormat();
    let file = thumbFile(row, wanted, format);
    let mime = wanted === 'preview' ? PREVIEW_FORMATS[format].mime : THUMB_SIZES.thumbnail.mime;
    if (wanted === 'preview' && !present(file)) {
      // a preview made in the other format (before webp became the default, or before the setting changed) is served as it is
      for (const [other, info] of Object.entries(PREVIEW_FORMATS)) {
        const old = thumbFile(row, 'preview', other);
        if (other !== format && present(old)) [file, mime] = [old, info.mime];
      }
    }
    if (!present(file)) {
      try {
        // Loaded on first use only: most requests are served from disk and never pay for sharp.
        const { generateThumbnails } = await import('../media.js');
        await generateThumbnails(
          { id: row.id, ownerId: row.owner_id, originalPath: row.original_path, type: row.type, filePath: absolutePath(row), durationMs: row.duration_ms, edits: row.edits ? JSON.parse(row.edits) : null },
          [wanted],
          false,
        );
      } catch (error) {
        throw new HttpError(404, `Thumbnail is not available: ${error.message}`);
      }
    }
    res.sendFile(file, { headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=86400' } }, (err) => {
      if (err && !res.headersSent) next(err);
    });
  }),
);

// OCR and face detection need the machine-learning service, which is not part of this server.
router.get('/:id/ocr', (req, res) => {
  getReadable(req);
  res.json([]);
});

router.get('/:id/original', (req, res, next) => {
  const row = getReadable(req);
  if (req.sharedLink && !req.sharedLink.allow_download) throw new HttpError(403, 'Downloads are not allowed for this link');
  sendOriginal(res, next, row);
});

// Range requests are handled by sendFile, so seeking works in the video player.
router.get('/:id/video/playback', (req, res, next) => {
  const row = getReadable(req);
  if (row.type !== 'VIDEO') throw new HttpError(400, 'Asset is not a video');
  sendOriginal(res, next, row);
});

// ---- edits (crop / rotate / mirror), applied to the thumbnails and the preview ----------------------------------------

const EDIT_ACTIONS = {
  crop: (p) => ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(p?.[k])) && p.width > 0 && p.height > 0 && p.x >= 0 && p.y >= 0,
  rotate: (p) => [90, 180, 270].includes(p?.angle),
  mirror: (p) => p?.axis === 'horizontal' || p?.axis === 'vertical',
};

const readEdits = (row) => (row.edits ? JSON.parse(row.edits) : []);

router.get('/:id/edits', needUser, (req, res) => {
  const row = getOwned(req.params.id, req.user.id);
  res.json({ assetId: row.id, edits: readEdits(row) });
});

async function storeEdits(row, edits) {
  const { generateThumbnails, editedSize } = await import('../media.js');
  const job = { id: row.id, ownerId: row.owner_id, originalPath: row.original_path, type: row.type, filePath: absolutePath(row), durationMs: row.duration_ms, edits };
  const thumbhash = await generateThumbnails(job, ['thumbnail', 'preview'], true);
  const size = edits.length ? await editedSize(job.filePath, edits, row.id) : { width: null, height: null };
  db.prepare(
    `UPDATE assets SET edits = ?, edit_width = ?, edit_height = ?, thumbhash = COALESCE(?, thumbhash),
     updated_at = ${NOW_SQL} WHERE id = ?`,
  ).run(edits.length ? JSON.stringify(edits) : null, size.width, size.height, thumbhash, row.id);
}

router.put(
  '/:id/edits',
  needUser,
  wrap(async (req, res) => {
    const row = getOwned(req.params.id, req.user.id);
    if (row.type !== 'IMAGE') throw new HttpError(400, 'Only photos can be edited');
    const edits = req.body?.edits;
    if (!Array.isArray(edits) || edits.length === 0) throw new HttpError(400, 'edits should not be empty');
    for (const e of edits) {
      if (!EDIT_ACTIONS[e?.action]?.(e.parameters)) throw new HttpError(400, `Invalid edit: ${JSON.stringify(e)}`);
    }
    const clean = edits.map((e) => ({ action: e.action, parameters: e.parameters }));
    await storeEdits(row, clean);
    res.json({ assetId: row.id, edits: clean });
  }),
);

router.delete(
  '/:id/edits',
  needUser,
  wrap(async (req, res) => {
    const row = getOwned(req.params.id, req.user.id);
    if (readEdits(row).length) await storeEdits(row, []);
    res.status(204).end();
  }),
);
