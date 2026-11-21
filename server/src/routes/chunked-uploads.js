import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import { HttpError, requireAuth } from '../auth.js';
import { db } from '../db.js';
import { ingestAsset, toAssetDto } from '../assets.js';
import { TMP_DIR } from '../paths.js';
import { emitToUser } from '../notify.js';
import { chunkDir as dirOf, discardUpload as discard, sweepExpiredUploads } from '../chunk-sweep.js';
import { getAdminConfig } from '../system-config.js';

const chunkPath = (id, index) => path.join(dirOf(id), `${index}.part`);
const TOUCH = "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')";

export const router = Router();
router.use(requireAuth);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getUpload = (id, userId) => {
  const row = db.prepare('SELECT * FROM chunked_uploads WHERE id = ? AND owner_id = ?').get(id, userId);
  if (!row) throw new HttpError(404, 'Upload not found');
  return row;
};

const receivedChunks = async (id) => {
  try {
    return (await fsp.readdir(dirOf(id)))
      .filter((f) => f.endsWith('.part'))
      .map((f) => Number.parseInt(f, 10))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
};

async function toDto(row) {
  return {
    uploadId: row.id,
    chunkSize: row.chunk_size,
    totalChunks: row.total_chunks,
    receivedChunks: await receivedChunks(row.id),
    resumeWindowMinutes: getAdminConfig().upload.resumeWindowMinutes,
  };
}

// Abandoned uploads are cleaned when this worker starts and by the gateway's sweep job (jobs/sweep.js).
sweepExpiredUploads().catch((error) => console.warn(`Could not clean old uploads: ${error.message}`));

router.post(
  '/',
  wrap(async (req, res) => {
    const { filename, size, fileCreatedAt, fileModifiedAt, isFavorite, visibility } = req.body ?? {};
    if (typeof filename !== 'string' || !filename.trim()) throw new HttpError(400, 'filename should not be empty');
    if (!Number.isInteger(size) || size <= 0) throw new HttpError(400, 'size should be a positive integer');

    const chunkSize = getAdminConfig().upload.chunkSizeMiB * 1024 * 1024;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO chunked_uploads (id, owner_id, filename, size, chunk_size, total_chunks,
         file_created_at, file_modified_at, is_favorite, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.user.id,
      filename,
      size,
      chunkSize,
      Math.ceil(size / chunkSize),
      fileCreatedAt ?? now,
      fileModifiedAt ?? now,
      isFavorite ? 1 : 0,
      visibility ?? null,
    );
    await fsp.mkdir(dirOf(id), { recursive: true });
    res.status(201).json(await toDto(getUpload(id, req.user.id)));
  }),
);

router.get(
  '/:id',
  wrap(async (req, res) => res.json(await toDto(getUpload(req.params.id, req.user.id)))),
);

router.delete(
  '/:id',
  wrap(async (req, res) => {
    await discard(getUpload(req.params.id, req.user.id).id);
    res.status(204).end();
  }),
);

// A chunk arrives as the raw request body, optionally gzip-compressed by the browser.
router.put(
  '/:id/chunks/:index',
  wrap(async (req, res) => {
    const upload = getUpload(req.params.id, req.user.id);
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= upload.total_chunks) throw new HttpError(400, 'Invalid chunk index');

    const expected = index === upload.total_chunks - 1 ? upload.size - upload.chunk_size * index : upload.chunk_size;
    const target = chunkPath(upload.id, index);
    const partial = `${target}.${crypto.randomUUID()}.tmp`;

    try {
      const body = req.headers['content-encoding'] === 'gzip' ? [req, zlib.createGunzip()] : [req];
      await pipeline(...body, fs.createWriteStream(partial));
      const { size } = await fsp.stat(partial);
      if (size !== expected) throw new HttpError(400, `Chunk ${index} has ${size} bytes, expected ${expected}`);
      await fsp.rename(partial, target);
    } catch (error) {
      await fsp.rm(partial, { force: true });
      throw error;
    }

    db.prepare(`UPDATE chunked_uploads SET ${TOUCH} WHERE id = ?`).run(upload.id);
    res.status(204).end();
  }),
);

router.post(
  '/:id/complete',
  wrap(async (req, res) => {
    const upload = getUpload(req.params.id, req.user.id);
    const have = new Set(await receivedChunks(upload.id));
    const missing = Array.from({ length: upload.total_chunks }, (_, i) => i).filter((i) => !have.has(i));
    if (missing.length > 0) throw new HttpError(400, `Missing chunks: ${missing.slice(0, 20).join(', ')}`);

    const assembled = path.join(TMP_DIR, `${upload.id}.assembled`);
    try {
      const out = fs.createWriteStream(assembled);
      for (let i = 0; i < upload.total_chunks; i++) {
        await pipeline(fs.createReadStream(chunkPath(upload.id, i)), out, { end: false });
      }
      await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));

      if ((await fsp.stat(assembled)).size !== upload.size) throw new HttpError(400, 'Assembled file has the wrong size');

      const result = await ingestAsset({
        ownerId: req.user.id,
        filePath: assembled,
        originalName: upload.filename,
        mode: 'move',
        fileCreatedAt: upload.file_created_at,
        fileModifiedAt: upload.file_modified_at,
        isFavorite: !!upload.is_favorite,
        visibility: upload.visibility,
      });

      await discard(upload.id);
      if (result.duplicate) return res.status(200).json({ id: result.id, status: 'duplicate' });

      emitToUser(req.user.id, 'on_upload_success', toAssetDto(result.row));
      res.status(201).json({ id: result.row.id, status: 'created' });
    } finally {
      await fsp.rm(assembled, { force: true });
    }
  }),
);
