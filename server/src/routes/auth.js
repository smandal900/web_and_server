import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import {
  HttpError,
  clearAuthCookies,
  createSession,
  hashPassword,
  isElevated,
  requireAuth,
  setAuthCookies,
  toLoginDto,
  toUserDto,
  verifyPassword,
} from '../auth.js';
import { NOW_SQL, wrap } from '../util.js';

export const router = Router();

function requireFields(body, ...fields) {
  for (const f of fields) {
    if (typeof body?.[f] !== 'string' || !body[f].trim()) throw new HttpError(400, `${f} should not be empty`);
  }
}


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
       updated_at = ${NOW_SQL} WHERE id = ?`,
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

// ---- locked folder: a PIN, and a session that is "elevated" for 15 minutes after the PIN (or password) was entered ----

const PIN = /^\d{4,6}$/;

/** Checks the PIN the caller sent, or their account password as the fallback the official apps allow. */
async function proves(user, body) {
  if (typeof body?.pinCode === 'string' && user.pin_hash) return verifyPassword(body.pinCode, user.pin_hash);
  if (typeof body?.password === 'string') return verifyPassword(body.password, user.password_hash);
  return false;
}

router.get('/status', requireAuth, (req, res) => res.json({ isElevated: isElevated(req), password: true, pinCode: !!req.user.pin_hash }));

router.post(
  '/pin-code',
  requireAuth,
  wrap(async (req, res) => {
    if (req.user.pin_hash) throw new HttpError(400, 'A PIN code is already set');
    if (!PIN.test(String(req.body?.pinCode ?? ''))) throw new HttpError(400, 'The PIN code must be 4 to 6 digits');
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(await hashPassword(req.body.pinCode), req.user.id);
    res.status(204).end();
  }),
);

router.put(
  '/pin-code',
  requireAuth,
  wrap(async (req, res) => {
    if (!req.user.pin_hash) throw new HttpError(400, 'No PIN code is set');
    if (!(await proves(req.user, req.body))) throw new HttpError(400, 'Wrong PIN code');
    if (!PIN.test(String(req.body?.newPinCode ?? ''))) throw new HttpError(400, 'The new PIN code must be 4 to 6 digits');
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(await hashPassword(req.body.newPinCode), req.user.id);
    res.status(204).end();
  }),
);

router.delete(
  '/pin-code',
  requireAuth,
  wrap(async (req, res) => {
    if (!(await proves(req.user, req.body))) throw new HttpError(400, 'Wrong PIN code or password');
    db.prepare('UPDATE users SET pin_hash = NULL WHERE id = ?').run(req.user.id);
    db.prepare('UPDATE sessions SET elevated_at = NULL WHERE user_id = ?').run(req.user.id);
    res.status(204).end();
  }),
);

router.post(
  '/session/unlock',
  requireAuth,
  wrap(async (req, res) => {
    if (!(await proves(req.user, req.body))) throw new HttpError(401, 'Wrong PIN code');
    db.prepare(`UPDATE sessions SET elevated_at = ${NOW_SQL} WHERE id = ?`).run(req.sessionId);
    res.status(204).end();
  }),
);

router.post('/session/lock', requireAuth, (req, res) => {
  db.prepare('UPDATE sessions SET elevated_at = NULL WHERE id = ?').run(req.sessionId);
  res.status(204).end();
});

router.post('/validateToken', requireAuth, (_req, res) => res.json({ authStatus: true }));
