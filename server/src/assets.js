import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './auth.js';
import { db } from './db.js';
import { logEvent } from './log.js';
import { placeFields } from './geocode.js';
import { removeThumbs, thumbFile } from './paths.js';
import { VISIBILITIES, chunks, toIso } from './util.js';
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


export const tagDto = (t) => ({
  id: t.id,
  name: t.value.split('/').pop(),
  value: t.value,
  color: t.color ?? null,
  createdAt: t.created_at,
  updatedAt: t.updated_at,
});

/** Asset DTOs for many rows at once: tags, stack and people are loaded with one query per kind. */
export function toAssetDtos(rows, { exif = true } = {}) {
  const tags = new Map();
  const people = new Map();
  const stacks = new Map();
  const ids = rows.map((r) => r.id);
  for (const part of chunks(ids)) {
    const marks = part.map(() => '?').join(',');
    for (const r of db
      .prepare(`SELECT ta.asset_id, t.* FROM tag_assets ta JOIN tags t ON t.id = ta.tag_id WHERE ta.asset_id IN (${marks})`)
      .all(...part)) {
      (tags.get(r.asset_id) ?? tags.set(r.asset_id, []).get(r.asset_id)).push(tagDto(r));
    }
    for (const r of db
      .prepare(`SELECT pa.asset_id, p.* FROM person_assets pa JOIN people p ON p.id = pa.person_id WHERE pa.asset_id IN (${marks})`)
      .all(...part)) {
      (people.get(r.asset_id) ?? people.set(r.asset_id, []).get(r.asset_id)).push(personDto(r));
    }
  }
  const stackIds = [...new Set(rows.map((r) => r.stack_id).filter(Boolean))];
  for (const part of chunks(stackIds)) {
    const marks = part.map(() => '?').join(',');
    for (const s of db
      .prepare(
        `SELECT s.id, s.primary_asset_id, (SELECT COUNT(*) FROM assets a WHERE a.stack_id = s.id AND a.deleted_at IS NULL) AS n
         FROM stacks s WHERE s.id IN (${marks})`,
      )
      .all(...part)) {
      stacks.set(s.id, { id: s.id, assetCount: s.n, primaryAssetId: s.primary_asset_id });
    }
  }
  return rows.map((row) => assetDtoOf(row, { exif, tags: tags.get(row.id) ?? [], people: people.get(row.id) ?? [], stack: stacks.get(row.stack_id) ?? null }));
}

export const personDto = (p) => ({
  id: p.id,
  name: p.name,
  birthDate: p.birth_date ?? null,
  isHidden: !!p.is_hidden,
  isFavorite: !!p.is_favorite,
  thumbnailPath: '',
  updatedAt: p.updated_at,
});

export const toAssetDto = (row, options) => toAssetDtos([row], options)[0];

function assetDtoOf(row, { exif = true, tags = [], people = [], stack = null } = {}) {
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
    isEdited: !!row.edits,
    isFavorite: !!row.is_favorite,
    isOffline: false,
    isTrashed: !!row.deleted_at,
    libraryId: null,
    livePhotoVideoId: null,
    originalFileName: row.original_file_name,
    originalMimeType: row.mime_type,
    originalPath: row.original_path,
    ownerId: row.owner_id,
    people,
    resized: true,
    stack,
    tags,
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

const MAX_NAME_LENGTH = 150;

/** A file name that is valid on every file system: no folders, no characters Windows rejects, no reserved names. */
export function safeFileName(name) {
  const leaf = String(name ?? '').replace(/\\/g, '/').split('/').pop() ?? '';
  let clean = leaf.replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '');
  const ext = path.extname(clean);
  let stem = clean.slice(0, clean.length - ext.length);
  if (stem.length > MAX_NAME_LENGTH) stem = stem.slice(0, MAX_NAME_LENGTH);
  if (!stem.trim()) stem = 'file';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem.trim())) stem = `_${stem}`;
  return `${stem}${ext}`;
}

/** Creates an empty file only if nothing has that name yet (the `wx` flag makes the check and the creation one step). */
async function claimFile(file) {
  try {
    await (await fsp.open(file, 'wx')).close();
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

/**
 * Picks the name an upload is stored under in the owner's library folder (library/<userId>/): its original name, or
 * "name (1).jpg", "name (2).jpg"... when that is taken. The thumbnail name ("name_thumbnail.webp") is claimed at the same time, so
 * IMG_1.HEIC and IMG_1.MOV (a live photo) cannot end up sharing thumbnails. A name is claimed by creating an empty
 * file with the `wx` flag, which is atomic, so two uploads arriving together can never get the same one; the real
 * file then replaces the empty one.
 */
async function claimLibraryName(ownerId, originalName) {
  const wanted = safeFileName(originalName);
  const ext = path.extname(wanted);
  const stem = wanted.slice(0, wanted.length - ext.length);
  // the user's own folder in the library and in the thumbs directory
  await fsp.mkdir(path.join(LIBRARY_DIR, ownerId), { recursive: true });
  await fsp.mkdir(path.dirname(thumbFile({ id: '', original_path: `${ownerId}/x` }, 'thumbnail')), { recursive: true });
  for (let n = 0; n < 100000; n++) {
    const candidate = `${ownerId}/${n === 0 ? wanted : `${stem} (${n})${ext}`}`;
    const libraryFile = path.join(LIBRARY_DIR, candidate);
    if (!(await claimFile(libraryFile))) continue;
    if (await claimFile(thumbFile({ id: '', original_path: candidate }, 'thumbnail'))) return candidate;
    await fsp.rm(libraryFile, { force: true }); // the thumbnail name belongs to another photo: try the next name
  }
  throw new HttpError(500, `Could not find a free name for ${wanted}`);
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
  const clientCreatedAt = toIso(fileCreatedAt) ?? stat.mtime.toISOString();
  const id = crypto.randomUUID();

  let meta;
  try {
    meta = await readMetadata(filePath, { type: info.type, name: originalName, clientCreatedAt });
  } catch (error) {
    logEvent({ level: 'warn', source: 'service', section: 'upload', message: `Could not read the metadata of ${originalName}; the file date is used instead: ${error.message}`, stack: error.stack, userId: ownerId });
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

  // the place (city, state, country) of the GPS position, from the offline place list
  Object.assign((meta.exif ??= {}), placeFields(meta.exif.latitude, meta.exif.longitude));

  let storedPath = path.resolve(filePath);
  let diskPath = storedPath;
  if (mode !== 'reference') {
    storedPath = await claimLibraryName(ownerId, originalName);
    diskPath = path.join(LIBRARY_DIR, storedPath);
    try {
      await (mode === 'copy' ? fsp.copyFile(filePath, diskPath) : moveFile(filePath, diskPath));
    } catch (error) {
      await fsp.rm(diskPath, { force: true }); // release the claimed names
      removeThumbs({ id, owner_id: ownerId, original_path: storedPath });
      throw error;
    }
  }

  let thumbhash = null;
  try {
    thumbhash = await generateThumbnails({ id, ownerId, originalPath: storedPath, type: info.type, filePath: diskPath, durationMs: meta.durationMs });
  } catch (error) {
    // the asset is still stored; thumbnails are generated again on first request
    logEvent({ level: 'warn', source: 'service', section: 'media', message: `Could not create thumbnails for ${originalName}; they are created when first requested: ${error.message}`, stack: error.stack, userId: ownerId });
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
      file_modified_at: toIso(fileModifiedAt) ?? stat.mtime.toISOString(),
      local_date_time: meta.localDateTime,
      local_offset_hours: meta.localOffsetHours,
      width: meta.width,
      height: meta.height,
      duration_ms: meta.durationMs ?? null,
      is_favorite: isFavorite ? 1 : 0,
      visibility: VISIBILITIES.has(visibility) ? visibility : 'timeline',
      thumbhash,
      exif: JSON.stringify(meta.exif ?? {}),
    });
  } catch (error) {
    if (mode !== 'reference') await fsp.rm(diskPath, { force: true });
    removeThumbs({ id, owner_id: ownerId, original_path: storedPath });
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // the same file was uploaded in parallel
      const winner = db.prepare('SELECT id, deleted_at FROM assets WHERE owner_id = ? AND checksum = ?').get(ownerId, checksum);
      return { duplicate: true, id: winner.id, isTrashed: !!winner.deleted_at };
    }
    throw error;
  }

  return { duplicate: false, row: db.prepare('SELECT * FROM assets WHERE id = ?').get(id) };
}
