import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth, requireAdmin, requireAuth } from '../auth.js';
import { logEvent, safeUrl } from '../log.js';

export const router = Router();

const LEVELS = new Set(['warn', 'error', 'fatal']);
const SOURCES = new Set(['api', 'service', 'web']);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);

// The web client reports errors here, including before login, so auth is optional.
router.post('/', optionalAuth, (req, res) => {
  const message = str(req.body?.message, 2000);
  if (!message) return res.status(400).json({ message: 'message should not be empty', statusCode: 400 });
  logEvent({
    source: 'web',
    section: str(req.body?.section, 100) ?? '',
    message,
    stack: str(req.body?.stack, 8000),
    path: safeUrl(str(req.body?.url, 500) ?? ''),
    userId: req.user?.id,
  });
  res.status(204).end();
});

router.get('/', requireAuth, requireAdmin, (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page) || 1);
  const size = Math.min(200, Math.max(1, Number.parseInt(req.query.size) || 50));

  const where = [];
  const params = [];
  if (LEVELS.has(req.query.level)) (where.push('level = ?'), params.push(req.query.level));
  if (SOURCES.has(req.query.source)) (where.push('source = ?'), params.push(req.query.source));
  if (req.query.section) (where.push('section = ?'), params.push(String(req.query.section)));
  if (req.query.search) {
    where.push('(message LIKE ? OR path LIKE ?)');
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db
    .prepare(`SELECT * FROM error_logs ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, size, (page - 1) * size);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM error_logs ${clause}`).get(...params);
  const sections = db
    .prepare('SELECT section, COUNT(*) AS count FROM error_logs GROUP BY section ORDER BY count DESC')
    .all();

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      level: r.level,
      source: r.source,
      section: r.section,
      message: r.message,
      stack: r.stack,
      method: r.method,
      path: r.path,
      status: r.status,
      userId: r.user_id,
    })),
    total,
    page,
    size,
    sections,
  });
});

router.delete('/', requireAuth, requireAdmin, (_req, res) => {
  db.prepare('DELETE FROM error_logs').run();
  res.status(204).end();
});
