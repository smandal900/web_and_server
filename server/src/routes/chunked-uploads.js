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
import { NOW_SQL, toIso, wrap } from '../util.js';

const chunkPath = (id, index) => path.join(dirOf(id), `${index}.part`);

// Pieces being received right now ("<uploadId>:<index>"). A piece is written to <index>.part.tmp and renamed when complete;
// this set keeps two requests for the same piece (a retry while the first attempt is still running) from writing into
// that one file together. The upload worker is a single process, so a set in memory is enough.
const receiving = new Set();
const TOUCH = `updated_at = ${NOW_SQL}`;

/** Every chunk of an upload carries the timestamp the device chose when it started that upload, in this header. */
const TIMESTAMP_HEADER = 'x-chunk-timestamp';

export const router = Router();
router.use(requireAuth);

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
    timestamp: row.device_timestamp, // the device's own timestamp, handed back so a client that resumes can keep sending it
  };
}

// Abandoned uploads are cleaned when this worker starts and by the gateway's sweep job (jobs/sweep.js).
sweepExpiredUploads().catch(async (error) => {
  console.warn(`Could not clean old uploads: ${error.message}`);
  const { logEvent } = await import('../log.js');
  logEvent({ level: 'warn', source: 'service', section: 'jobs', message: `Could not clean old uploads: ${error.message}`, stack: error.stack });
});

router.post(
  '/',
  wrap(async (req, res) => {
    const { filename, size, fileCreatedAt, fileModifiedAt, isFavorite, visibility, timestamp } = req.body ?? {};
    if (typeof filename !== 'string' || !filename.trim()) throw new HttpError(400, 'filename should not be empty');
    if (!Number.isInteger(size) || size <= 0) throw new HttpError(400, 'size should be a positive integer');

    // the device decides the timestamp; the server never makes one up
    const deviceTimestamp = toIso(timestamp);
    if (!deviceTimestamp) throw new HttpError(400, 'timestamp should be the time on the device as an ISO 8601 date');

    const chunkSize = getAdminConfig().upload.chunkSizeMiB * 1024 * 1024;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO chunked_uploads (id, owner_id, filename, size, chunk_size, total_chunks,
         file_created_at, file_modified_at, is_favorite, visibility, device_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      deviceTimestamp,
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

    // A chunk must carry the same device timestamp as the upload it belongs to; any other chunk is ignored (nothing is
    // stored). Uploads started before this check existed have no timestamp and are not checked.
    if (upload.device_timestamp) {
      const sent = req.headers[TIMESTAMP_HEADER];
      if (!sent) throw new HttpError(400, `The ${TIMESTAMP_HEADER} header is required`);
      if (toIso(sent) !== upload.device_timestamp) {
        throw new HttpError(409, `Chunk ${index} ignored: its timestamp does not match the timestamp of this upload`);
      }
    }

    const expected = index === upload.total_chunks - 1 ? upload.size - upload.chunk_size * index : upload.chunk_size;
    const target = chunkPath(upload.id, index);
    const partial = `${target}.tmp`;
    const key = `${upload.id}:${index}`;
    if (receiving.has(key)) throw new HttpError(409, `Chunk ${index} is already being received`, { log: false });
    receiving.add(key);

    try {
      const body = req.headers['content-encoding'] === 'gzip' ? [req, zlib.createGunzip()] : [req];
      await pipeline(...body, fs.createWriteStream(partial));
      const { size } = await fsp.stat(partial);
      if (size !== expected) throw new HttpError(400, `Chunk ${index} has ${size} bytes, expected ${expected}`);
      await fsp.rename(partial, target);
    } catch (error) {
      await fsp.rm(partial, { force: true });
      throw error;
    } finally {
      receiving.delete(key);
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
