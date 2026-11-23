// Who may see or change what. Small and import-light: every API worker loads it.
import { HttpError } from './auth.js';
import { db } from './db.js';
import { chunks, placeholders, stringList } from './util.js';

export const nowIso = () => new Date().toISOString();

const RANK = { viewer: 1, editor: 2, owner: 3 };

/** SQL for "album `al` belongs to the user or was shared with them". Takes the user id twice. */
export const ALBUM_ACCESS_SQL = '(al.owner_id = ? OR EXISTS (SELECT 1 FROM album_users au WHERE au.album_id = al.id AND au.user_id = ?))';

/**
 * An asset the user may look at: their own, one in an album they own or were invited to,
 * or one that a partner shares with them. `columns` limits what is loaded (the full row carries the whole EXIF JSON).
 */
export function viewableAsset(id, userId, columns = 'a.*') {
  return db
    .prepare(
      `SELECT ${columns} FROM assets a WHERE a.id = ? AND (
         a.owner_id = ?
         OR EXISTS (SELECT 1 FROM album_assets aa JOIN albums al ON al.id = aa.album_id
                    WHERE aa.asset_id = a.id AND ${ALBUM_ACCESS_SQL})
         OR EXISTS (SELECT 1 FROM partners p WHERE p.shared_by_id = a.owner_id AND p.shared_with_id = ?)
       )`,
    )
    .get(id, userId, userId, userId, userId);
}

/**
 * viewableAsset for many ids at once: Map of id -> row (ids the user may not see are missing). The user's own assets, the usual
 * case, come from a few bulk queries; only the rest (shared albums, partners) are looked up one by one. A "select all" on a
 * big library sends tens of thousands of ids, and one query per id would block the worker for seconds.
 */
export function viewableAssets(ids, userId, columns = 'a.*') {
  const found = new Map();
  const unique = [...new Set(stringList(ids))];
  for (const part of chunks(unique)) {
    // +owner_id keeps SQLite on the primary-key lookups of the id list
    for (const row of db.prepare(`SELECT ${columns} FROM assets a WHERE a.id IN (${placeholders(part)}) AND +a.owner_id = ?`).all(...part, userId)) found.set(row.id, row);
  }
  for (const id of unique) {
    if (found.has(id)) continue;
    const row = viewableAsset(id, userId, columns);
    if (row) found.set(id, row);
  }
  return found;
}

/** An album plus the caller's role in it. Throws 404 when the user cannot see it, 403 when the role is too low. */
export function albumFor(albumId, userId, need = 'viewer') {
  const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(albumId);
  let role = null;
  if (album) {
    role = album.owner_id === userId ? 'owner' : (db.prepare('SELECT role FROM album_users WHERE album_id = ? AND user_id = ?').get(albumId, userId)?.role ?? null);
  }
  if (!album || !role) throw new HttpError(404, 'Album not found');
  if ((RANK[role] ?? 0) < RANK[need]) throw new HttpError(403, 'You do not have permission for this album');
  return { album, role };
}

/** Keep only the ids of assets the user owns (the ones they may change). */
export function ownedIds(ids, userId) {
  return chunks(stringList(ids)).flatMap((part) =>
    // +owner_id keeps SQLite on the primary-key lookups of the id list instead of scanning the owner's whole library per batch
    db.prepare(`SELECT id FROM assets WHERE id IN (${placeholders(part)}) AND +owner_id = ?`).all(...part, userId).map((r) => r.id),
  );
}

/** Break a stack up: its assets become ordinary assets again. */
export function dissolveStack(id) {
  db.prepare('UPDATE assets SET stack_id = NULL WHERE stack_id = ?').run(id);
  db.prepare('DELETE FROM stacks WHERE id = ?').run(id);
}

/** Remove stack rows that no longer hold two assets, and make sure every stack has a valid primary asset. */
export function tidyStacks() {
  db.exec('UPDATE assets SET stack_id = NULL WHERE stack_id IS NOT NULL AND stack_id NOT IN (SELECT id FROM stacks)');
  const small = db.prepare('SELECT s.id FROM stacks s WHERE (SELECT COUNT(*) FROM assets a WHERE a.stack_id = s.id) < 2').all();
  for (const { id } of small) {
    dissolveStack(id);
  }
  db.exec(
    `UPDATE stacks SET primary_asset_id = (SELECT a.id FROM assets a WHERE a.stack_id = stacks.id ORDER BY a.local_date_time LIMIT 1)
     WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = stacks.primary_asset_id AND a.stack_id = stacks.id)`,
  );
}

// ---- shared links -------------------------------------------------------------------------------------------------

/** The shared link with this public key (or custom slug), whatever its state. */
export const findLink = (key) => db.prepare('SELECT * FROM shared_links WHERE key = ? OR slug = ?').get(key, key);

export const linkExpired = (link) => !!link.expires_at && Date.parse(link.expires_at) < Date.now();

/** The link behind a public key (or custom slug), or null when it does not exist, expired or needs another password. */
export function linkByKey(key, password) {
  const link = findLink(key);
  if (!link || linkExpired(link)) return null;
  if (link.password && link.password !== (password ?? '')) return null;
  return link;
}

export function linkHasAsset(link, assetId) {
  if (link.album_id) return !!db.prepare('SELECT 1 FROM album_assets WHERE album_id = ? AND asset_id = ?').get(link.album_id, assetId);
  return !!db.prepare('SELECT 1 FROM shared_link_assets WHERE link_id = ? AND asset_id = ?').get(link.id, assetId);
}
