import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { HttpError, requireAuth, toPublicUserDto, toUserDto } from '../auth.js';
import { PROFILE_DIR, TMP_DIR } from '../paths.js';
import { NOW_SQL } from '../util.js';

export const router = Router();
router.use(requireAuth);

export const DEFAULT_PREFERENCES = {
  albums: { defaultAssetOrder: 'desc' },
  cast: { gCastEnabled: false },
  download: { archiveSize: 4294967296, includeEmbeddedVideos: false },
  folders: { enabled: false, sidebarWeb: false },
  memories: { duration: 5, enabled: true, sidebarWeb: false },
  people: { enabled: true, sidebarWeb: false, updateStrategy: 'immediate' },
  purchase: { hideBuyButtonUntil: '2022-02-12T00:00:00.000Z', showSupportBadge: true },
  ratings: { enabled: false },
  recentlyAdded: { sidebarWeb: false },
  sharedLinks: { enabled: true, sidebarWeb: false },
  tags: { enabled: false, sidebarWeb: false },
};

router.get('/me', (req, res) => res.json(toUserDto(req.user)));
router.get('/me/preferences', (_req, res) => res.json(DEFAULT_PREFERENCES));
router.put('/me/preferences', (_req, res) => res.json(DEFAULT_PREFERENCES));
/** Empty activity series for the requested range (no assets are stored yet). */
export const emptyHeatmap = (query) => ({
  from: String(query.from ?? ''),
  to: String(query.to ?? ''),
  series: [],
  totalCount: 0,
});

router.get('/me/calendar-heatmap', (req, res) => res.json(emptyHeatmap(req.query)));
router.get('/me/onboarding', (req, res) => res.json({ isOnboarded: !!req.user.is_onboarded }));
router.put('/me/onboarding', (req, res) => {
  const isOnboarded = req.body?.isOnboarded ? 1 : 0;
  db.prepare(`UPDATE users SET is_onboarded = ?, updated_at = ${NOW_SQL} WHERE id = ?`).run(
    isOnboarded,
    req.user.id,
  );
  res.json({ isOnboarded: !!isOnboarded });
});

// ---- profile ------------------------------------------------------------------------------------------------------

router.put('/me', (req, res) => {
  const b = req.body ?? {};
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim() : req.user.name;
  const email = typeof b.email === 'string' && b.email.trim() ? b.email.trim() : req.user.email;
  if (email !== req.user.email && db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, req.user.id)) {
    throw new HttpError(400, 'That email address is already in use');
  }
  db.prepare(`UPDATE users SET name = ?, email = ?, updated_at = ${NOW_SQL} WHERE id = ?`).run(name, email, req.user.id);
  res.json(toUserDto(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
});

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const IMAGE_MIME = Object.fromEntries(Object.entries(IMAGE_EXT).map(([mime, ext]) => [ext, mime]));
const upload = multer({
  storage: multer.diskStorage({ destination: TMP_DIR, filename: (_req, _file, cb) => cb(null, crypto.randomUUID()) }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const removeProfileFile = (name) => name && fs.rmSync(path.join(PROFILE_DIR, path.basename(name)), { force: true });

router.post('/profile-image', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'file should not be empty');
  const ext = IMAGE_EXT[file.mimetype];
  if (!ext) {
    fs.rmSync(file.path, { force: true });
    throw new HttpError(400, 'The profile picture must be a JPEG, PNG, WebP or GIF image');
  }
  // a new name per upload, so clients that cache the picture see the change
  const name = `${req.user.id}-${Date.now()}.${ext}`;
  fs.renameSync(file.path, path.join(PROFILE_DIR, name));
  removeProfileFile(req.user.profile_image_path);
  const changedAt = new Date().toISOString();
  db.prepare('UPDATE users SET profile_image_path = ?, updated_at = ? WHERE id = ?').run(name, changedAt, req.user.id);
  res.status(201).json({ userId: req.user.id, profileImagePath: name, profileChangedAt: changedAt });
});

router.delete('/profile-image', (req, res) => {
  removeProfileFile(req.user.profile_image_path);
  db.prepare("UPDATE users SET profile_image_path = '', updated_at = ? WHERE id = ?").run(new Date().toISOString(), req.user.id);
  res.status(204).end();
});

// ---- other users (for sharing) ------------------------------------------------------------------------------------

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE').all().map(toPublicUserDto));
});

router.get('/:id/profile-image', (req, res, next) => {
  const user = db.prepare('SELECT profile_image_path FROM users WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  const name = user?.profile_image_path;
  if (!name) throw new HttpError(404, 'User has no profile picture', { log: false }); // the apps show initials instead: not a problem
  res.sendFile(
    path.join(PROFILE_DIR, path.basename(name)),
    { headers: { 'Content-Type': IMAGE_MIME[path.extname(name).slice(1)] ?? 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } },
    (err) => err && !res.headersSent && next(err.code === 'ENOENT' ? new HttpError(404, 'Profile picture is missing') : err),
  );
});

router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  res.json(toPublicUserDto(user));
});
