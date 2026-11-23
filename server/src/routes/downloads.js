import { Router } from 'express';
import { HttpError, requireAuth } from '../auth.js';
import { db } from '../db.js';
import { albumFor, viewableAssets } from '../access.js';
import { absolutePath } from '../assets.js';
import { stringList } from '../util.js';
import { streamZip } from '../zip.js';

// Downloading several photos as one zip (the paths of the official Immich API: POST /download/info and /download/archive).
// Files are streamed 64 KB at a time, so the size of the download does not matter to the worker's memory.
export const router = Router();
router.use(requireAuth);

const ARCHIVE_LIMIT = 4 * 1024 ** 3 - 1; // a classic zip tops out at 4 GiB

// only the columns a download needs: a big selection must not hold every photo's metadata in memory
const DOWNLOAD_COLUMNS = 'a.id, a.original_file_name, a.original_path, a.file_size, a.file_created_at, a.visibility';

function downloadRows(req) {
  let ids = stringList(req.body?.assetIds);
  if (req.body?.albumId) {
    const { album } = albumFor(String(req.body.albumId), req.user.id);
    ids = db.prepare('SELECT asset_id FROM album_assets WHERE album_id = ?').all(album.id).map((r) => r.asset_id);
  }
  const rows = viewableAssets(ids, req.user.id, DOWNLOAD_COLUMNS);
  return ids.map((id) => rows.get(id)).filter((r) => r && r.visibility !== 'locked');
}

/** How many zips the photos need and how big they are (one zip cannot pass 4 GiB). */
router.post('/info', (req, res) => {
  const archives = [];
  let current = { assetIds: [], size: 0 };
  for (const row of downloadRows(req)) {
    if (current.assetIds.length && current.size + row.file_size > ARCHIVE_LIMIT) (archives.push(current), (current = { assetIds: [], size: 0 }));
    current.assetIds.push(row.id);
    current.size += row.file_size;
  }
  if (current.assetIds.length) archives.push(current);
  res.json({ archives, totalSize: archives.reduce((n, a) => n + a.size, 0) });
});

router.post('/archive', (req, res, next) => {
  const rows = downloadRows(req);
  if (rows.length === 0) throw new HttpError(400, 'No assets to download');
  const total = rows.reduce((n, r) => n + r.file_size, 0);
  if (total > ARCHIVE_LIMIT) {
    throw new HttpError(400, `These ${rows.length} photos are ${(total / 1024 ** 3).toFixed(1)} GiB, more than one zip can hold (4 GiB). Download them in smaller groups.`);
  }
  const used = new Set();
  const entries = rows.map((row) => {
    let name = row.original_file_name;
    for (let i = 1; used.has(name.toLowerCase()); i++) name = row.original_file_name.replace(/(\.[^.]*)?$/, `_${i}$1`);
    used.add(name.toLowerCase());
    return { name, file: absolutePath(row), date: new Date(row.file_created_at) };
  });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="immich-${new Date().toISOString().slice(0, 10)}.zip"`);
  streamZip(entries, res).catch(next);
});
