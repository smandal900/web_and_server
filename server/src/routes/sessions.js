import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

export const router = Router();
router.use(requireAuth);

export const toSessionDto = (s, currentId) => ({
  id: s.id,
  createdAt: s.created_at,
  updatedAt: s.updated_at,
  current: s.id === currentId,
  deviceOS: s.device_os,
  deviceType: s.device_type,
  appVersion: null,
  isPendingSyncReset: false,
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  res.json(rows.map((s) => toSessionDto(s, req.sessionId)));
});

// Log out every other device.
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.sessionId);
  res.status(204).end();
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.status(204).end();
});
