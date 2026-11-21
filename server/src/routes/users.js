import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, toUserDto } from '../auth.js';

export const router = Router();
router.use(requireAuth);

export const DEFAULT_PREFERENCES = {
  albums: { defaultAssetOrder: 'desc' },
  cast: { gCastEnabled: false },
  download: { archiveSize: 4294967296, includeEmbeddedVideos: false },
  emailNotifications: { albumInvite: true, albumUpdate: true, enabled: true },
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
  db.prepare("UPDATE users SET is_onboarded = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(
    isOnboarded,
    req.user.id,
  );
  res.json({ isOnboarded: !!isOnboarded });
});
