// Files copied by hand into data/import-files: list them, and add them one at a time to a user's library
// (Administration > Import files). Ingest is the same code as a web upload.
import fsp from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './auth.js';
import { logEvent } from './log.js';
import { IMPORT_DIR } from './paths.js';
import { mediaInfoFor } from './media.js';
import { emitToUser } from './notify.js';
import { ingestAsset, toAssetDto } from './assets.js';

/** A file changed this recently may still be copying into the folder, so it is left for the next import. */
const SETTLE_MS = 10_000;

/** Every file in the folder and its subfolders; `name` is the path inside the folder, with "/". */
export async function listImportFiles() {
  const files = [];
  const walk = async (dir) => {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        const stat = await fsp.stat(full).catch(() => null);
        if (!stat) continue;
        files.push({
          name: path.relative(IMPORT_DIR, full).split(path.sep).join('/'),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          supported: !!mediaInfoFor(entry.name),
        });
      }
    }
  };
  await walk(IMPORT_DIR);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Add one file of the folder to `ownerId`'s library. A new file leaves the folder; anything else (already uploaded,
 * unsupported, failed) stays where it is.
 * @returns {Promise<{ status: 'uploaded' | 'duplicate' | 'unsupported' | 'waiting' | 'failed', assetId?: string, message?: string }>}
 */
export async function importFolderFile({ ownerId, name }) {
  const file = path.resolve(IMPORT_DIR, name);
  const inside = path.relative(IMPORT_DIR, file);
  if (!inside || inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) {
    throw new HttpError(400, 'Invalid file name');
  }
  const stat = await fsp.lstat(file).catch(() => null);
  if (!stat?.isFile()) return { status: 'failed', message: 'The file is no longer in the folder' };
  const originalName = path.basename(file);
  if (!mediaInfoFor(originalName)) return { status: 'unsupported', message: 'This file type is not supported' };
  if (stat.size === 0) return { status: 'failed', message: 'The file is empty' };
  if (Date.now() - stat.ctimeMs < SETTLE_MS) {
    return { status: 'waiting', message: 'Changed a few seconds ago and may still be copying. Import again.' };
  }

  let result;
  try {
    // "copy", then remove the source: ingest deletes the library file when it fails, which must never be the only copy
    result = await ingestAsset({
      ownerId,
      filePath: file,
      originalName,
      mode: 'copy',
      fileCreatedAt: stat.mtime.toISOString(),
      fileModifiedAt: stat.mtime.toISOString(),
    });
  } catch (error) {
    logEvent({ level: 'warn', source: 'service', section: 'upload', message: `Could not import ${name}: ${error.message}`, stack: error.stack, userId: ownerId });
    return { status: 'failed', message: error.message };
  }
  if (result.duplicate) {
    // the status already says "already uploaded"; a message is only needed when the user would not see the photo
    return { status: 'duplicate', assetId: result.id, message: result.isTrashed ? "It is in this user's Trash" : undefined };
  }

  emitToUser(ownerId, 'on_upload_success', toAssetDto(result.row));
  try {
    await fsp.unlink(file);
  } catch (error) {
    return { status: 'uploaded', assetId: result.row.id, message: `Uploaded, but the file could not be removed from the folder: ${error.message}` };
  }
  return { status: 'uploaded', assetId: result.row.id };
}
