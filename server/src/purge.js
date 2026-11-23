// Permanent deletion of assets: the database row (its album / tag / stack links go with it), the stored file and thumbnails.
import fs from 'node:fs';
import path from 'node:path';
import { tidyStacks } from './access.js';
import { db } from './db.js';
import { LIBRARY_DIR, removeThumbs } from './paths.js';

/** @param {{ id: string, original_path: string }[]} rows */
export function purgeAssets(rows) {
  for (const row of rows) {
    // files imported in place (absolute path) belong to the user and are never deleted
    if (!path.isAbsolute(row.original_path)) fs.rmSync(path.join(LIBRARY_DIR, row.original_path), { force: true });
    removeThumbs(row);
    db.prepare('UPDATE albums SET thumbnail_asset_id = NULL WHERE thumbnail_asset_id = ?').run(row.id);
    db.prepare('UPDATE people SET thumbnail_asset_id = NULL WHERE thumbnail_asset_id = ?').run(row.id);
    db.prepare('DELETE FROM assets WHERE id = ?').run(row.id);
  }
  if (rows.length) tidyStacks();
}
