import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { HttpError, hashPassword, requireAdmin, requireAuth, toUserDto } from '../auth.js';
import { DEFAULT_PREFERENCES, emptyHeatmap } from './users.js';
import { toSessionDto } from './sessions.js';
import { DEFAULT_ADMIN_CONFIG, getAdminConfig, setAdminConfig } from '../system-config.js';

export const router = Router();
router.use(requireAuth, requireAdmin);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

// --- system config ---
router.get('/config', (_req, res) => res.json(getAdminConfig()));
router.get('/config/defaults', (_req, res) => res.json(DEFAULT_ADMIN_CONFIG));
router.put('/config', (req, res) => res.json(setAdminConfig(req.body ?? {})));

// --- maintenance ---
router.get('/integrity/summary', (_req, res) => res.json({ checksum_mismatch: 0, missing_file: 0, untracked_file: 0 }));

router.get('/database-backups', (_req, res) => res.json({ backups: [] }));

// --- users ---
const getUser = (id) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw new HttpError(404, 'User not found');
  return user;
};

const adminCount = () =>
  db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND deleted_at IS NULL').get().n;

router.get('/users', (req, res) => {
  const withDeleted = req.query.withDeleted === 'true';
  const rows = db
    .prepare(`SELECT * FROM users ${withDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY created_at`)
    .all();
  res.json(rows.map(toUserDto));
});

router.post(
  '/users',
  wrap(async (req, res) => {
    const { email, name, password, isAdmin, shouldChangePassword } = req.body ?? {};
    for (const [k, v] of Object.entries({ email, name, password })) {
      if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${k} should not be empty`);
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.trim())) {
      throw new HttpError(400, 'User exists');
    }
    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO users (id, cluster_group_id, email, name, password_hash, is_admin, should_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, id, email.trim(), name.trim(), await hashPassword(password), isAdmin ? 1 : 0, shouldChangePassword ? 1 : 0);
    res.status(201).json(toUserDto(getUser(id)));
  }),
);

router.get('/users/:id', (req, res) => res.json(toUserDto(getUser(req.params.id))));

router.put(
  '/users/:id',
  wrap(async (req, res) => {
    const user = getUser(req.params.id);
    const { email, name, password, isAdmin, shouldChangePassword } = req.body ?? {};
    if (isAdmin === false && user.is_admin && adminCount() <= 1) {
      throw new HttpError(400, 'The last admin cannot be demoted');
    }
    db.prepare(
      `UPDATE users SET email = ?, name = ?, password_hash = ?, is_admin = ?, should_change_password = ?, updated_at = ${NOW}
       WHERE id = ?`,
    ).run(
      typeof email === 'string' && email.trim() ? email.trim() : user.email,
      typeof name === 'string' && name.trim() ? name.trim() : user.name,
      typeof password === 'string' && password ? await hashPassword(password) : user.password_hash,
      isAdmin === undefined ? user.is_admin : isAdmin ? 1 : 0,
      shouldChangePassword === undefined ? user.should_change_password : shouldChangePassword ? 1 : 0,
      user.id,
    );
    res.json(toUserDto(getUser(user.id)));
  }),
);

router.delete('/users/:id', (req, res) => {
  const user = getUser(req.params.id);
  if (user.id === req.user.id) throw new HttpError(400, 'Admin users cannot delete themselves');
  if (req.body?.force) {
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  } else {
    db.prepare(`UPDATE users SET deleted_at = ${NOW}, updated_at = ${NOW} WHERE id = ?`).run(user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  }
  res.json(toUserDto(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) ?? { ...user, deleted_at: new Date().toISOString() }));
});

router.get('/users/:id/preferences', (req, res) => {
  getUser(req.params.id);
  res.json(DEFAULT_PREFERENCES);
});
router.put('/users/:id/preferences', (req, res) => {
  getUser(req.params.id);
  res.json(DEFAULT_PREFERENCES);
});
router.get('/users/:id/statistics', (req, res) => {
  getUser(req.params.id);
  res.json({ images: 0, total: 0, videos: 0 });
});
router.get('/users/:id/calendar-heatmap', (req, res) => {
  getUser(req.params.id);
  res.json(emptyHeatmap(req.query));
});
router.get('/users/:id/sessions', (req, res) => {
  const user = getUser(req.params.id);
  const rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC').all(user.id);
  res.json(rows.map((s) => toSessionDto(s, null)));
});

router.post('/users/:id/restore', (req, res) => {
  const user = getUser(req.params.id);
  db.prepare(`UPDATE users SET deleted_at = NULL, updated_at = ${NOW} WHERE id = ?`).run(user.id);
  res.json(toUserDto(getUser(user.id)));
});
