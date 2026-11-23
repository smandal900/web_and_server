import fsp from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';
import { TMP_DIR } from './paths.js';
import { getAdminConfig } from './system-config.js';

/** The pieces of a resumable upload wait in a folder named by the upload id, directly inside tmp/. */
export const chunkDir = (id) => path.join(TMP_DIR, id);

export const discardUpload = async (id) => {
  db.prepare('DELETE FROM chunked_uploads WHERE id = ?').run(id);
  await fsp.rm(chunkDir(id), { recursive: true, force: true });
};

/** Drop uploads that made no progress for longer than the resume window. */
export async function sweepExpiredUploads() {
  const minutes = getAdminConfig().upload.resumeWindowMinutes;
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  for (const { id } of db.prepare('SELECT id FROM chunked_uploads WHERE updated_at < ?').all(cutoff)) await discardUpload(id);
  // chunk folders whose session is gone (e.g. after a crash). Only folders count: the files in tmp/ belong to uploads
  // that are being received or processed right now.
  for (const entry of await fsp.readdir(TMP_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'chunked') {
      await fsp.rmdir(chunkDir(entry.name)).catch(() => {}); // the old layout's folder: removed once it is empty
    } else if (!db.prepare('SELECT 1 FROM chunked_uploads WHERE id = ?').get(entry.name)) {
      await fsp.rm(chunkDir(entry.name), { recursive: true, force: true });
    }
  }
}
