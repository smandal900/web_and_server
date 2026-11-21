import fsp from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';
import { CHUNK_DIR } from './paths.js';
import { getAdminConfig } from './system-config.js';

export const chunkDir = (id) => path.join(CHUNK_DIR, id);

export const discardUpload = async (id) => {
  db.prepare('DELETE FROM chunked_uploads WHERE id = ?').run(id);
  await fsp.rm(chunkDir(id), { recursive: true, force: true });
};

/** Drop uploads that made no progress for longer than the resume window. */
export async function sweepExpiredUploads() {
  const minutes = getAdminConfig().upload.resumeWindowMinutes;
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  for (const { id } of db.prepare('SELECT id FROM chunked_uploads WHERE updated_at < ?').all(cutoff)) await discardUpload(id);
  // chunk folders whose session is gone (e.g. after a crash)
  for (const name of await fsp.readdir(CHUNK_DIR)) {
    if (!db.prepare('SELECT 1 FROM chunked_uploads WHERE id = ?').get(name)) {
      await fsp.rm(chunkDir(name), { recursive: true, force: true });
    }
  }
}
