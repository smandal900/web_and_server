import { Router } from 'express';
import fs from 'node:fs';
import { HttpError, requireAuth } from '../auth.js';
import { db } from '../db.js';
import { absolutePath, toAssetDto } from '../assets.js';
import { THUMB_SIZES, thumbFile } from '../paths.js';

// Read-only "media" group: metadata, thumbnails, original files, video playback.
// Uploads live in assets-upload.js. sharp is only imported when a thumbnail is missing (see below).
export const router = Router();
router.use(requireAuth);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

router.get('/statistics', (req, res) => {
  const where = ['owner_id = ?'];
  const params = [req.user.id];
  where.push(req.query.isTrashed === 'true' ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL');
  if (req.query.isFavorite === 'true') where.push('is_favorite = 1');
  if (req.query.isFavorite === 'false') where.push('is_favorite = 0');
  if (req.query.visibility) (where.push('visibility = ?'), params.push(String(req.query.visibility)));

  const rows = db.prepare(`SELECT type, COUNT(*) AS n FROM assets WHERE ${where.join(' AND ')} GROUP BY type`).all(...params);
  const count = (type) => rows.find((r) => r.type === type)?.n ?? 0;
  res.json({ images: count('IMAGE'), videos: count('VIDEO'), total: count('IMAGE') + count('VIDEO') });
});

router.get('/:id', (req, res) => res.json(toAssetDto(getOwned(req.params.id, req.user.id))));

router.get(
  '/:id/thumbnail',
  wrap(async (req, res, next) => {
    const row = getOwned(req.params.id, req.user.id);
    const wanted = req.query.size === 'preview' || req.query.size === 'fullsize' ? 'preview' : 'thumbnail';

    // a browser can show most photos as they are
    if (req.query.size === 'fullsize' && row.type === 'IMAGE' && /^image\/(jpeg|png|webp|gif|avif)$/.test(row.mime_type)) {
      return sendOriginal(res, next, row);
    }

    const file = thumbFile(row.id, wanted);
    if (!fs.existsSync(file)) {
      try {
        // Loaded on first use only: most requests are served from disk and never pay for sharp.
        const { generateThumbnails } = await import('../media.js');
        await generateThumbnails(
          { id: row.id, type: row.type, filePath: absolutePath(row), durationMs: row.duration_ms },
          [wanted],
          false,
        );
      } catch (error) {
        throw new HttpError(404, `Thumbnail is not available: ${error.message}`);
      }
    }
    res.sendFile(file, { headers: { 'Content-Type': THUMB_SIZES[wanted].mime, 'Cache-Control': 'private, max-age=86400' } }, (err) => {
      if (err && !res.headersSent) next(err);
    });
  }),
);

// OCR and face detection need the machine-learning service, which is not part of this server.
router.get('/:id/ocr', (req, res) => {
  getOwned(req.params.id, req.user.id);
  res.json([]);
});

router.get('/:id/original', (req, res, next) => sendOriginal(res, next, getOwned(req.params.id, req.user.id)));

// Range requests are handled by sendFile, so seeking works in the video player.
router.get('/:id/video/playback', (req, res, next) => {
  const row = getOwned(req.params.id, req.user.id);
  if (row.type !== 'VIDEO') throw new HttpError(400, 'Asset is not a video');
  sendOriginal(res, next, row);
});
