import { Router } from 'express';
import crypto from 'node:crypto';
import { HttpError, requireAuth, toPublicUserDto } from '../auth.js';
import { db } from '../db.js';
import { albumFor, findLink, linkByKey, linkExpired, ownedIds } from '../access.js';
import { PAGE_SIZE, chunks, placeholders, stringList, streamJsonList, toIso, wrap } from '../util.js';
import { toAssetDtos } from '../assets.js';
import { albumAssetPager, albumDto } from './albums.js';

// Sharing with other people: partners (see each other's whole library) and public shared links.
export const partnersRouter = Router();
export const sharedLinksRouter = Router();
partnersRouter.use(requireAuth);

// ---- partners -----------------------------------------------------------------------------------------------------

const partnerDto = (user, inTimeline) => ({ ...toPublicUserDto(user), inTimeline: !!inTimeline });

partnersRouter.get('/', (req, res) => {
  const sharedBy = req.query.direction !== 'shared-with'; // "shared-by": the people I share my photos with
  const rows = db
    .prepare(
      sharedBy
        ? 'SELECT u.*, p.in_timeline FROM partners p JOIN users u ON u.id = p.shared_with_id WHERE p.shared_by_id = ? AND u.deleted_at IS NULL ORDER BY u.name'
        : 'SELECT u.*, p.in_timeline FROM partners p JOIN users u ON u.id = p.shared_by_id WHERE p.shared_with_id = ? AND u.deleted_at IS NULL ORDER BY u.name',
    )
    .all(req.user.id);
  res.json(rows.map((u) => partnerDto(u, u.in_timeline)));
});

function addPartner(req, res, otherId) {
  const other = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(otherId);
  if (!other || other.id === req.user.id) throw new HttpError(400, 'Choose another user to share with');
  const { changes } = db.prepare('INSERT OR IGNORE INTO partners (shared_by_id, shared_with_id) VALUES (?, ?)').run(req.user.id, other.id);
  if (!changes) throw new HttpError(400, 'You already share with this user');
  res.status(201).json(partnerDto(other, false));
}
partnersRouter.post('/', (req, res) => addPartner(req, res, String(req.body?.sharedWithId ?? '')));
partnersRouter.post('/:id', (req, res) => addPartner(req, res, req.params.id));

// the person who receives the photos decides whether they also show in their own timeline
partnersRouter.put('/:id', (req, res) => {
  const { changes } = db
    .prepare('UPDATE partners SET in_timeline = ? WHERE shared_by_id = ? AND shared_with_id = ?')
    .run(req.body?.inTimeline ? 1 : 0, req.params.id, req.user.id);
  if (!changes) throw new HttpError(404, 'Partner not found');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(partnerDto(user, req.body?.inTimeline));
});

partnersRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM partners WHERE shared_by_id = ? AND shared_with_id = ?').run(req.user.id, req.params.id);
  res.status(204).end();
});

// ---- shared links -------------------------------------------------------------------------------------------------

/** A shared link as the API shows it, without its photos (those can be thousands: see linkAssetPager). */
const linkDto = (link) => {
  const dto = {
    id: link.id,
    key: link.key,
    type: link.type,
    description: link.description ?? null,
    password: link.password ?? null,
    userId: link.owner_id,
    createdAt: link.created_at,
    expiresAt: link.expires_at ?? null,
    allowUpload: !!link.allow_upload,
    allowDownload: !!link.allow_download,
    showMetadata: !!link.show_metadata,
    slug: link.slug ?? null,
  };
  const album = link.album_id ? db.prepare('SELECT * FROM albums WHERE id = ?').get(link.album_id) : null;
  if (album) dto.album = albumDto(album);
  return dto;
};

/** The photos of a link, a page at a time: `pager(offset, limit)` returns asset DTOs, [] at the end. */
function linkAssetPager(link, { exif = true } = {}) {
  const album = link.album_id ? db.prepare('SELECT * FROM albums WHERE id = ?').get(link.album_id) : null;
  if (link.album_id) return album ? albumAssetPager(album, { exif }) : () => [];
  return (offset, limit = PAGE_SIZE) =>
    toAssetDtos(
      db
        .prepare(
          `SELECT a.* FROM shared_link_assets sa JOIN assets a ON a.id = sa.asset_id WHERE sa.link_id = ? AND a.deleted_at IS NULL
           ORDER BY a.local_date_time DESC, a.id LIMIT ? OFFSET ?`,
        )
        .all(link.id, limit, offset),
      { exif },
    );
}

/** Lists and the reply to creating or editing a link show only the first photos; GET /:id and /me return them all. */
const PREVIEW_ASSETS = 100;
const linkWithPreview = (link) => ({ ...linkDto(link), assets: linkAssetPager(link)(0, PREVIEW_ASSETS) });

const getOwnLink = (id, userId) => {
  const l = db.prepare('SELECT * FROM shared_links WHERE id = ? AND owner_id = ?').get(id, userId);
  if (!l) throw new HttpError(404, 'Shared link not found');
  return l;
};

// What a visitor sees: needs no login, only the key from the link (and its password, if it has one).
sharedLinksRouter.get('/me', wrap(async (req, res) => {
  const key = String(req.query.key ?? req.query.slug ?? '');
  const raw = key ? findLink(key) : null;
  if (!raw || linkExpired(raw)) throw new HttpError(401, 'Invalid share key');
  if (raw.password) {
    if (!req.query.password) throw new HttpError(401, 'Password required');
    if (!linkByKey(key, String(req.query.password))) throw new HttpError(401, 'Invalid password');
  }
  // the visitor never sees the link's password
  await streamJsonList(res, { ...linkDto(raw), password: undefined }, 'assets', linkAssetPager(raw, { exif: !!raw.show_metadata }));
}));

sharedLinksRouter.use(requireAuth);

sharedLinksRouter.get('/', (req, res) => {
  const rows = req.query.albumId
    ? db.prepare('SELECT * FROM shared_links WHERE owner_id = ? AND album_id = ? ORDER BY created_at DESC').all(req.user.id, String(req.query.albumId))
    : db.prepare('SELECT * FROM shared_links WHERE owner_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map(linkWithPreview));
});

const slugOf = (value) => {
  const slug = typeof value === 'string' ? value.trim() : '';
  if (slug && !/^[A-Za-z0-9._-]+$/.test(slug)) throw new HttpError(400, 'The custom link may only use letters, digits, dots, dashes and underscores');
  return slug || null;
};

const isoOrNull = (value) => {
  if (!value) return null;
  const iso = toIso(value);
  if (!iso) throw new HttpError(400, 'expiresAt should be a date');
  return iso;
};

const uniqueOr400 = (fn) => {
  try {
    return fn();
  } catch (error) {
    if (/UNIQUE/i.test(String(error.message))) throw new HttpError(400, 'That custom link is already in use');
    throw error;
  }
};

sharedLinksRouter.post('/', (req, res) => {
  const b = req.body ?? {};
  if (b.type !== 'ALBUM' && b.type !== 'INDIVIDUAL') throw new HttpError(400, 'type must be ALBUM or INDIVIDUAL');
  let albumId = null;
  let assetIds = [];
  if (b.type === 'ALBUM') {
    albumId = albumFor(String(b.albumId ?? ''), req.user.id, 'owner').album.id;
  } else {
    assetIds = ownedIds(b.assetIds, req.user.id);
    if (assetIds.length === 0) throw new HttpError(400, 'Choose at least one of your assets to share');
  }
  const id = crypto.randomUUID();
  uniqueOr400(() =>
    db
      .prepare(
        `INSERT INTO shared_links (id, key, owner_id, type, album_id, description, password, slug, expires_at, allow_upload, allow_download, show_metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        crypto.randomBytes(18).toString('base64url'),
        req.user.id,
        b.type,
        albumId,
        b.description ?? null,
        b.password || null,
        slugOf(b.slug),
        isoOrNull(b.expiresAt),
        b.allowUpload ? 1 : 0,
        b.allowDownload === false ? 0 : 1,
        b.showMetadata === false ? 0 : 1,
      ),
  );
  const insert = db.prepare('INSERT OR IGNORE INTO shared_link_assets (link_id, asset_id) VALUES (?, ?)');
  for (const assetId of assetIds) insert.run(id, assetId);
  res.status(201).json(linkWithPreview(db.prepare('SELECT * FROM shared_links WHERE id = ?').get(id)));
});

sharedLinksRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const link = getOwnLink(req.params.id, req.user.id);
    await streamJsonList(res, linkDto(link), 'assets', linkAssetPager(link));
  }),
);

sharedLinksRouter.patch('/:id', (req, res) => {
  const l = getOwnLink(req.params.id, req.user.id);
  const b = req.body ?? {};
  const flag = (value, current) => (typeof value === 'boolean' ? +value : current);
  uniqueOr400(() =>
    db
      .prepare('UPDATE shared_links SET description = ?, password = ?, slug = ?, expires_at = ?, allow_upload = ?, allow_download = ?, show_metadata = ? WHERE id = ?')
      .run(
        b.description !== undefined ? b.description || null : l.description,
        b.password !== undefined ? b.password || null : l.password,
        b.slug !== undefined ? slugOf(b.slug) : l.slug,
        b.expiresAt !== undefined || b.changeExpiryTime ? isoOrNull(b.expiresAt) : l.expires_at,
        flag(b.allowUpload, l.allow_upload),
        flag(b.allowDownload, l.allow_download),
        flag(b.showMetadata, l.show_metadata),
        l.id,
      ),
  );
  res.json(linkWithPreview(getOwnLink(l.id, req.user.id)));
});

sharedLinksRouter.delete('/:id', (req, res) => {
  const l = getOwnLink(req.params.id, req.user.id);
  db.prepare('DELETE FROM shared_links WHERE id = ?').run(l.id);
  res.status(204).end();
});

sharedLinksRouter.put('/:id/assets', (req, res) => {
  const l = getOwnLink(req.params.id, req.user.id);
  if (l.type !== 'INDIVIDUAL') throw new HttpError(400, 'Only a link to individual photos can change its photos');
  const asked = stringList(req.body?.assetIds);
  const owned = new Set(ownedIds(asked, req.user.id));
  const insert = db.prepare('INSERT OR IGNORE INTO shared_link_assets (link_id, asset_id) VALUES (?, ?)');
  res.json(asked.map((id) => (owned.has(id) ? (insert.run(l.id, id), { assetId: id, success: true }) : { assetId: id, success: false, error: 'no_permission' })));
});

sharedLinksRouter.delete('/:id/assets', (req, res) => {
  const l = getOwnLink(req.params.id, req.user.id);
  const ids = stringList(req.body?.assetIds);
  for (const part of chunks(ids)) db.prepare(`DELETE FROM shared_link_assets WHERE link_id = ? AND asset_id IN (${placeholders(part)})`).run(l.id, ...part);
  res.json(ids.map((assetId) => ({ assetId, success: true })));
});
