import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './auth.js';
import { db } from './db.js';
import { LIBRARY_DIR, generateThumbnails, mediaInfoFor, readMetadata, sha1File } from './media.js';

export const absolutePath = (row) =>
  path.isAbsolute(row.original_path) ? row.original_path : path.join(LIBRARY_DIR, row.original_path);

/** The web sends SHA-1 as hex, the API documents base64; accept both, store lowercase hex. */
export function normalizeChecksum(value) {
  if (typeof value !== 'string') return null;
  if (/^[0-9a-f]{40}$/i.test(value)) return value.toLowerCase();
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 20 ? bytes.toString('hex') : null;
}

const validIso = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

// --- DTOs ---------------------------------------------------------------

export function toExifDto(row) {
  return {
    city: null,
    country: null,
    state: null,
    rating: null,
    projectionType: null,
    timeZone: null,
    ...(row.exif ? JSON.parse(row.exif) : {}),
    dateTimeOriginal: row.file_created_at,
    modifyDate: row.file_modified_at,
    fileSizeInByte: row.file_size,
  };
}

export function toAssetDto(row, { exif = true } = {}) {
  return {
    id: row.id,
    checksum: Buffer.from(row.checksum, 'hex').toString('base64'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    duplicateId: null,
    duration: row.duration_ms,
    exifInfo: exif ? toExifDto(row) : undefined,
    fileCreatedAt: row.file_created_at,
    fileModifiedAt: row.file_modified_at,
    localDateTime: row.local_date_time,
    hasMetadata: true,
    width: row.width,
    height: row.height,
    isArchived: row.visibility === 'archive',
    isEdited: false,
    isFavorite: !!row.is_favorite,
    isOffline: false,
    isTrashed: !!row.deleted_at,
    libraryId: null,
    livePhotoVideoId: null,
    originalFileName: row.original_file_name,
    originalMimeType: row.mime_type,
    originalPath: row.original_path,
    ownerId: row.owner_id,
    people: [],
    resized: true,
    stack: null,
    tags: [],
    thumbhash: row.thumbhash,
    type: row.type,
    visibility: row.visibility,
  };
}

// --- ingest -------------------------------------------------------------

async function moveFile(from, to) {
  try {
    await fsp.rename(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fsp.copyFile(from, to);
    await fsp.unlink(from);
  }
}

const INSERT = db.prepare(`
  INSERT INTO assets (id, owner_id, original_file_name, original_path, mime_type, type, checksum, file_size,
    file_created_at, file_modified_at, local_date_time, local_offset_hours, width, height, duration_ms,
    is_favorite, visibility, thumbhash, exif)
  VALUES (@id, @owner_id, @original_file_name, @original_path, @mime_type, @type, @checksum, @file_size,
    @file_created_at, @file_modified_at, @local_date_time, @local_offset_hours, @width, @height, @duration_ms,
    @is_favorite, @visibility, @thumbhash, @exif)
`);

/**
 * Add a file to the library.
 *  mode 'move'      the file is moved into the library (uploads: the temp file)
 *  mode 'copy'      the file is copied into the library
 *  mode 'reference' the file stays where it is and the library points at it (no extra disk space)
 * @returns {Promise<{ duplicate: true, id: string, isTrashed: boolean } | { duplicate: false, row: object }>}
 */
export async function ingestAsset({ ownerId, filePath, originalName, mode = 'move', fileCreatedAt, fileModifiedAt, isFavorite, visibility }) {
  const info = mediaInfoFor(originalName);
  if (!info) throw new HttpError(400, `Unsupported file type: ${originalName}`);

  const checksum = await sha1File(filePath);
  const existing = db.prepare('SELECT id, deleted_at FROM assets WHERE owner_id = ? AND checksum = ?').get(ownerId, checksum);
  if (existing) return { duplicate: true, id: existing.id, isTrashed: !!existing.deleted_at };

  const stat = await fsp.stat(filePath);
  const clientCreatedAt = validIso(fileCreatedAt) ?? stat.mtime.toISOString();
  const id = crypto.randomUUID();

  let meta;
  try {
    meta = await readMetadata(filePath, { type: info.type, name: originalName, clientCreatedAt });
  } catch (error) {
    console.warn(`Could not read metadata of ${originalName}: ${error.message}`);
    meta = {
      width: null,
      height: null,
      durationMs: null,
      exif: {},
      fileCreatedAt: clientCreatedAt,
      localDateTime: clientCreatedAt,
      localOffsetHours: 0,
    };
  }

  let storedPath = path.resolve(filePath);
  let diskPath = storedPath;
  if (mode !== 'reference') {
    storedPath = path.join(ownerId, id.slice(0, 2), `${id}${path.extname(originalName).toLowerCase()}`);
    diskPath = path.join(LIBRARY_DIR, storedPath);
    await fsp.mkdir(path.dirname(diskPath), { recursive: true });
    await (mode === 'copy' ? fsp.copyFile(filePath, diskPath) : moveFile(filePath, diskPath));
  }

  let thumbhash = null;
  try {
    thumbhash = await generateThumbnails({ id, type: info.type, filePath: diskPath, durationMs: meta.durationMs });
  } catch (error) {
    // the asset is still stored; thumbnails are generated again on first request
    console.warn(`Could not create thumbnails for ${originalName}: ${error.message}`);
  }

  try {
    INSERT.run({
      id,
      owner_id: ownerId,
      original_file_name: originalName,
      original_path: storedPath,
      mime_type: info.mime,
      type: info.type,
      checksum,
      file_size: stat.size,
      file_created_at: meta.fileCreatedAt,
      file_modified_at: validIso(fileModifiedAt) ?? stat.mtime.toISOString(),
      local_date_time: meta.localDateTime,
      local_offset_hours: meta.localOffsetHours,
      width: meta.width,
      height: meta.height,
      duration_ms: meta.durationMs ?? null,
      is_favorite: isFavorite ? 1 : 0,
      visibility: ['archive', 'timeline', 'hidden', 'locked'].includes(visibility) ? visibility : 'timeline',
      thumbhash,
      exif: JSON.stringify(meta.exif ?? {}),
    });
  } catch (error) {
    if (mode !== 'reference') await fsp.rm(diskPath, { force: true });
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // the same file was uploaded in parallel
      const winner = db.prepare('SELECT id, deleted_at FROM assets WHERE owner_id = ? AND checksum = ?').get(ownerId, checksum);
      return { duplicate: true, id: winner.id, isTrashed: !!winner.deleted_at };
    }
    throw error;
  }

  return { duplicate: false, row: db.prepare('SELECT * FROM assets WHERE id = ?').get(id) };
}
