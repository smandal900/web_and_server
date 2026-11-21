import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import {
  HttpError,
  clearAuthCookies,
  createSession,
  hashPassword,
  requireAuth,
  setAuthCookies,
  toLoginDto,
  toUserDto,
  verifyPassword,
} from '../auth.js';

export const router = Router();

function requireFields(body, ...fields) {
  for (const f of fields) {
    if (typeof body?.[f] !== 'string' || !body[f].trim()) throw new HttpError(400, `${f} should not be empty`);
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  '/admin-sign-up',
  wrap(async (req, res) => {
    requireFields(req.body, 'email', 'name', 'password');
    if (db.prepare('SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1').get()) {
      throw new HttpError(400, 'The server already has an admin');
    }
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, cluster_group_id, email, name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?, 1)').run(
      id,
      id,
      req.body.email.trim(),
      req.body.name.trim(),
      await hashPassword(req.body.password),
    );
    res.status(201).json(toUserDto(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
  }),
);

router.post(
  '/login',
  wrap(async (req, res) => {
    requireFields(req.body, 'email', 'password');
    const u = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(req.body.email.trim());
    if (!u || !(await verifyPassword(req.body.password, u.password_hash))) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    const token = createSession(u.id, req);
    setAuthCookies(res, token);
    res.json(toLoginDto(u, token));
  }),
);

router.post(
  '/change-password',
  requireAuth,
  wrap(async (req, res) => {
    requireFields(req.body, 'password', 'newPassword');
    if (!(await verifyPassword(req.body.password, req.user.password_hash))) {
      throw new HttpError(400, 'Wrong password');
    }
    if (req.body.newPassword === req.body.password) {
      throw new HttpError(400, 'New password must be different from the current password');
    }
    db.prepare(
      `UPDATE users SET password_hash = ?, should_change_password = 0,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).run(await hashPassword(req.body.newPassword), req.user.id);
    if (req.body.invalidateSessions) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.sessionId);
    }
    res.json(toUserDto(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
  }),
);

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
  clearAuthCookies(res);
  res.json({ successful: true, redirectUri: '/auth/login?autoLaunch=0' });
});

// PIN codes and elevated sessions are not implemented yet, so the locked folder stays unavailable.
router.get('/status', requireAuth, (_req, res) => res.json({ isElevated: false, password: true, pinCode: false }));

router.post('/validateToken', requireAuth, (_req, res) => res.json({ authStatus: true }));
