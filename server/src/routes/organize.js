import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { HttpError, requireAuth } from '../auth.js';
import { db } from '../db.js';
import { dissolveStack, nowIso, ownedIds, tidyStacks } from '../access.js';
import { chunks, placeholders, stringList } from '../util.js';
import { personDto, tagDto, toAssetDtos } from '../assets.js';
import { THUMB_SIZES, thumbFile } from '../paths.js';

// People, tags and stacks: three ways to organise assets besides albums.
export const peopleRouter = Router();
export const tagsRouter = Router();
export const stacksRouter = Router();
for (const r of [peopleRouter, tagsRouter, stacksRouter]) r.use(requireAuth);

// ---- people -------------------------------------------------------------------------------------------------------
// Faces are found by the machine-learning service, which this server does not include. People can still be created,
// renamed, hidden, favourited and merged; the list stays empty until faces are assigned to them.

const getPerson = (id, userId) => {
  const p = db.prepare('SELECT * FROM people WHERE id = ? AND owner_id = ?').get(id, userId);
  if (!p) throw new HttpError(404, 'Person not found');
  return p;
};

peopleRouter.get('/', (req, res) => {
  const withHidden = req.query.withHidden === 'true';
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.max(1, Math.min(1000, Number(req.query.size) || 500));
  const where = withHidden ? 'owner_id = ?' : 'owner_id = ? AND is_hidden = 0';
  const rows = db
    .prepare(`SELECT * FROM people WHERE ${where} ORDER BY is_favorite DESC, name = '', name COLLATE NOCASE LIMIT ? OFFSET ?`)
    .all(req.user.id, size + 1, (page - 1) * size);
  const total = db.prepare('SELECT COUNT(*) AS n FROM people WHERE owner_id = ?').get(req.user.id).n;
  const hidden = db.prepare('SELECT COUNT(*) AS n FROM people WHERE owner_id = ? AND is_hidden = 1').get(req.user.id).n;
  res.json({ people: rows.slice(0, size).map(personDto), hasNextPage: rows.length > size, total, hidden });
});

peopleRouter.post('/', (req, res) => {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO people (id, owner_id, name, birth_date, is_hidden, is_favorite) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    req.user.id,
    String(req.body?.name ?? '').trim(),
    req.body?.birthDate ?? null,
    req.body?.isHidden ? 1 : 0,
    req.body?.isFavorite ? 1 : 0,
  );
  res.status(201).json(personDto(db.prepare('SELECT * FROM people WHERE id = ?').get(id)));
});

peopleRouter.get('/:id', (req, res) => res.json(personDto(getPerson(req.params.id, req.user.id))));

peopleRouter.get('/:id/statistics', (req, res) => {
  getPerson(req.params.id, req.user.id);
  const n = db
    .prepare('SELECT COUNT(*) AS n FROM person_assets pa JOIN assets a ON a.id = pa.asset_id WHERE pa.person_id = ? AND a.deleted_at IS NULL')
    .get(req.params.id).n;
  res.json({ assets: n });
});

peopleRouter.get('/:id/thumbnail', (req, res, next) => {
  const person = getPerson(req.params.id, req.user.id);
  const assetId =
    person.thumbnail_asset_id ??
    db.prepare('SELECT asset_id FROM person_assets WHERE person_id = ? LIMIT 1').get(person.id)?.asset_id;
  if (!assetId) throw new HttpError(404, 'This person has no photo yet', { log: false });
  const asset = db.prepare('SELECT id, owner_id, original_path FROM assets WHERE id = ?').get(assetId);
  const file = asset && thumbFile(asset, 'thumbnail');
  if (!file || !fs.existsSync(file)) throw new HttpError(404, 'Thumbnail is not available');
  res.sendFile(file, { headers: { 'Content-Type': THUMB_SIZES.thumbnail.mime, 'Cache-Control': 'private, max-age=3600' } }, (err) => err && !res.headersSent && next(err));
});

peopleRouter.put('/:id', (req, res) => {
  const p = getPerson(req.params.id, req.user.id);
  const b = req.body ?? {};
  db.prepare('UPDATE people SET name = ?, birth_date = ?, is_hidden = ?, is_favorite = ?, thumbnail_asset_id = ?, updated_at = ? WHERE id = ?').run(
    typeof b.name === 'string' ? b.name.trim() : p.name,
    b.birthDate !== undefined ? b.birthDate : p.birth_date,
    typeof b.isHidden === 'boolean' ? +b.isHidden : p.is_hidden,
    typeof b.isFavorite === 'boolean' ? +b.isFavorite : p.is_favorite,
    typeof b.featureFaceAssetId === 'string' ? b.featureFaceAssetId : p.thumbnail_asset_id,
    nowIso(),
    p.id,
  );
  res.json(personDto(getPerson(p.id, req.user.id)));
});

peopleRouter.post('/:id/merge', (req, res) => {
  const target = getPerson(req.params.id, req.user.id);
  const results = stringList(req.body?.ids).map((id) => {
    if (id === target.id) return { id, success: false, error: 'unknown' };
    const source = db.prepare('SELECT * FROM people WHERE id = ? AND owner_id = ?').get(id, req.user.id);
    if (!source) return { id, success: false, error: 'no_permission' };
    db.prepare('INSERT OR IGNORE INTO person_assets (person_id, asset_id) SELECT ?, asset_id FROM person_assets WHERE person_id = ?').run(target.id, source.id);
    if (!target.name && source.name) db.prepare('UPDATE people SET name = ? WHERE id = ?').run(source.name, target.id);
    db.prepare('DELETE FROM people WHERE id = ?').run(source.id);
    return { id, success: true };
  });
  db.prepare('UPDATE people SET updated_at = ? WHERE id = ?').run(nowIso(), target.id);
  res.json(results);
});

const deletePeople = (req, ids) => {
  for (const id of ids) {
    getPerson(id, req.user.id);
    db.prepare('DELETE FROM people WHERE id = ?').run(id);
  }
};
peopleRouter.delete('/', (req, res) => (deletePeople(req, stringList(req.body?.ids)), res.status(204).end()));
peopleRouter.delete('/:id', (req, res) => (deletePeople(req, [req.params.id]), res.status(204).end()));

// ---- tags ---------------------------------------------------------------------------------------------------------

const cleanTag = (value) =>
  String(value ?? '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');

const getTag = (id, userId) => {
  const t = db.prepare('SELECT * FROM tags WHERE id = ? AND owner_id = ?').get(id, userId);
  if (!t) throw new HttpError(404, 'Tag not found');
  return t;
};

/** The tag with this value, created (with its parent tags, like "Trips" for "Trips/Paris") when missing. */
function upsertTag(userId, value, color = null) {
  const parts = value.split('/');
  let row;
  for (let i = 1; i <= parts.length; i++) {
    const path = parts.slice(0, i).join('/');
    row = db.prepare('SELECT * FROM tags WHERE owner_id = ? AND value = ?').get(userId, path);
    if (!row) {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO tags (id, owner_id, value, color) VALUES (?, ?, ?, ?)').run(id, userId, path, i === parts.length ? color : null);
      row = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    }
  }
  return row;
}

/** Put a tag on assets; returns how many were newly tagged. */
function attachTag(tagId, assetIds) {
  const insert = db.prepare('INSERT OR IGNORE INTO tag_assets (tag_id, asset_id) VALUES (?, ?)');
  return db.transaction(() => assetIds.reduce((n, id) => n + insert.run(tagId, id).changes, 0));
}

tagsRouter.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM tags WHERE owner_id = ? ORDER BY value COLLATE NOCASE').all(req.user.id).map(tagDto));
});

tagsRouter.post('/', (req, res) => {
  const value = cleanTag(req.body?.name);
  if (!value) throw new HttpError(400, 'name should not be empty');
  if (db.prepare('SELECT 1 FROM tags WHERE owner_id = ? AND value = ?').get(req.user.id, value)) throw new HttpError(400, 'A tag with that name already exists');
  res.status(201).json(tagDto(upsertTag(req.user.id, value, req.body?.color ?? null)));
});

// create every tag that does not exist yet and return them all
tagsRouter.put('/', (req, res) => {
  const names = Array.isArray(req.body?.tags) ? req.body.tags.map(cleanTag).filter(Boolean) : [];
  res.json(names.map((value) => tagDto(upsertTag(req.user.id, value))));
});

tagsRouter.put('/assets', (req, res) => {
  const assets = ownedIds(req.body?.assetIds, req.user.id);
  const tags = stringList(req.body?.tagIds).map((id) => getTag(id, req.user.id));
  res.json({ count: tags.reduce((n, tag) => n + attachTag(tag.id, assets), 0) });
});

tagsRouter.get('/:id', (req, res) => res.json(tagDto(getTag(req.params.id, req.user.id))));

tagsRouter.put('/:id', (req, res) => {
  const t = getTag(req.params.id, req.user.id);
  db.prepare('UPDATE tags SET color = ?, updated_at = ? WHERE id = ?').run(req.body?.color !== undefined ? req.body.color : t.color, nowIso(), t.id);
  res.json(tagDto(getTag(t.id, req.user.id)));
});

tagsRouter.delete('/:id', (req, res) => {
  const t = getTag(req.params.id, req.user.id);
  // child tags ("Trips/Paris" under "Trips") go with their parent
  db.prepare("DELETE FROM tags WHERE owner_id = ? AND (id = ? OR value LIKE ? ESCAPE '\\')").run(req.user.id, t.id, `${t.value.replace(/[\\%_]/g, '\\$&')}/%`);
  res.status(204).end();
});

tagsRouter.put('/:id/assets', (req, res) => {
  const t = getTag(req.params.id, req.user.id);
  const owned = new Set(ownedIds(req.body?.ids, req.user.id));
  res.json(stringList(req.body?.ids).map((id) => (owned.has(id) ? (attachTag(t.id, [id]), { id, success: true }) : { id, success: false, error: 'no_permission' })));
});

tagsRouter.delete('/:id/assets', (req, res) => {
  const t = getTag(req.params.id, req.user.id);
  const remove = db.prepare('DELETE FROM tag_assets WHERE tag_id = ? AND asset_id = ?');
  res.json(stringList(req.body?.ids).map((id) => (remove.run(t.id, id).changes ? { id, success: true } : { id, success: false, error: 'not_found' })));
});

// ---- stacks -------------------------------------------------------------------------------------------------------

const stackDto = (stack) => {
  const rows = db.prepare('SELECT * FROM assets WHERE stack_id = ? AND deleted_at IS NULL ORDER BY (id = ?) DESC, local_date_time DESC').all(stack.id, stack.primary_asset_id);
  return { id: stack.id, primaryAssetId: stack.primary_asset_id, assets: toAssetDtos(rows) };
};

const getStack = (id, userId) => {
  const s = db.prepare('SELECT * FROM stacks WHERE id = ? AND owner_id = ?').get(id, userId);
  if (!s) throw new HttpError(404, 'Stack not found');
  return s;
};

stacksRouter.get('/', (req, res) => {
  const rows = req.query.primaryAssetId
    ? db.prepare('SELECT * FROM stacks WHERE owner_id = ? AND primary_asset_id = ?').all(req.user.id, String(req.query.primaryAssetId))
    : db.prepare('SELECT * FROM stacks WHERE owner_id = ?').all(req.user.id);
  res.json(rows.map(stackDto));
});

stacksRouter.post('/', (req, res) => {
  const ids = ownedIds(stringList(req.body?.assetIds), req.user.id);
  if (ids.length < 2) throw new HttpError(400, 'A stack needs at least two of your assets');
  // the first id sent becomes the cover
  const primary = stringList(req.body.assetIds).find((id) => ids.includes(id));
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO stacks (id, owner_id, primary_asset_id) VALUES (?, ?, ?)').run(id, req.user.id, primary);
  for (const part of chunks(ids)) db.prepare(`UPDATE assets SET stack_id = ? WHERE id IN (${placeholders(part)})`).run(id, ...part);
  tidyStacks(); // an old stack that lost members is dissolved when it is down to one
  res.status(201).json(stackDto(getStack(id, req.user.id)));
});

stacksRouter.delete('/', (req, res) => {
  for (const id of stringList(req.body?.ids)) {
    dissolveStack(getStack(id, req.user.id).id);
  }
  res.status(204).end();
});

stacksRouter.get('/:id', (req, res) => res.json(stackDto(getStack(req.params.id, req.user.id))));

stacksRouter.put('/:id', (req, res) => {
  const s = getStack(req.params.id, req.user.id);
  const primary = req.body?.primaryAssetId;
  if (!db.prepare('SELECT 1 FROM assets WHERE id = ? AND stack_id = ?').get(primary, s.id)) throw new HttpError(400, 'The cover must be part of the stack');
  db.prepare('UPDATE stacks SET primary_asset_id = ?, updated_at = ? WHERE id = ?').run(primary, nowIso(), s.id);
  res.json(stackDto(getStack(s.id, req.user.id)));
});

stacksRouter.delete('/:id', (req, res) => {
  dissolveStack(getStack(req.params.id, req.user.id).id);
  res.status(204).end();
});

stacksRouter.delete('/:id/assets/:assetId', (req, res) => {
  const s = getStack(req.params.id, req.user.id);
  const { changes } = db.prepare('UPDATE assets SET stack_id = NULL WHERE id = ? AND stack_id = ?').run(req.params.assetId, s.id);
  if (!changes) throw new HttpError(404, 'That asset is not in the stack');
  tidyStacks();
  res.status(204).end();
});

