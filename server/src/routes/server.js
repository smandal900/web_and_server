import { Router } from 'express';
import fs from 'node:fs';
import { DATA_DIR, db } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { MEDIA_EXTENSIONS } from '../media.js';
import { getAdminConfig } from '../system-config.js';

const startedAt = Date.now();

import { VERSION } from '../version.js';
export { VERSION };
export const router = Router();

const hasAdmin = (extra = '') =>
  db.prepare(`SELECT 1 FROM users WHERE is_admin = 1 ${extra} LIMIT 1`).get() !== undefined;

router.get('/ping', (_req, res) => res.json({ res: 'pong' }));

router.get('/config', (_req, res) => {
  const c = getAdminConfig();
  res.json({
    externalDomain: c.server.externalDomain,
    isInitialized: hasAdmin(),
    isOnboarded: hasAdmin('AND is_onboarded = 1'),
    loginPageMessage: c.server.loginPageMessage,
    maintenanceMode: false,
    mapDarkStyleUrl: c.map.darkStyle,
    mapLightStyleUrl: c.map.lightStyle,
    minFaces: c.machineLearning.facialRecognition.minFaces,
    oauthButtonText: c.oauth.buttonText,
    publicUsers: c.server.publicUsers,
    trashDays: c.trash.days,
    userDeleteDelay: c.user.deleteDelay,
  });
});

router.get('/features', (_req, res) => {
  const c = getAdminConfig();
  const ml = c.machineLearning;
  res.json({
    configFile: false,
    duplicateDetection: ml.enabled && ml.duplicateDetection.enabled,
    email: c.notifications.smtp.enabled,
    facialRecognition: ml.enabled && ml.facialRecognition.enabled,
    importFaces: c.metadata.faces.import,
    map: c.map.enabled,
    oauth: c.oauth.enabled,
    oauthAutoLaunch: c.oauth.autoLaunch,
    ocr: ml.enabled && ml.ocr.enabled,
    passwordLogin: c.passwordLogin.enabled,
    realtimeTranscoding: c.ffmpeg.realtime.enabled,
    reverseGeocoding: c.reverseGeocoding.enabled,
    search: true,
    sidecar: false,
    smartSearch: ml.enabled && ml.clip.enabled,
    trash: c.trash.enabled,
  });
});

router.get('/version', (_req, res) => res.json(VERSION));
router.get('/about', (_req, res) =>
  res.json({
    licensed: false,
    nodejs: process.version,
    version: `v${VERSION.major}.${VERSION.minor}.${VERSION.patch}`,
    versionUrl: '',
  }),
);
const formatBytes = (n) => {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) (n /= 1024), i++;
  return `${n.toFixed(1)} ${units[i]}`;
};

router.get('/storage', requireAuth, (_req, res) => {
  const { bsize, blocks, bavail } = fs.statfsSync(DATA_DIR);
  const diskSizeRaw = blocks * bsize;
  const diskAvailableRaw = bavail * bsize;
  const diskUseRaw = diskSizeRaw - diskAvailableRaw;
  res.json({
    diskAvailable: formatBytes(diskAvailableRaw),
    diskAvailableRaw,
    diskSize: formatBytes(diskSizeRaw),
    diskSizeRaw,
    diskUsagePercentage: Number(((diskUseRaw / diskSizeRaw) * 100).toFixed(2)),
    diskUse: formatBytes(diskUseRaw),
    diskUseRaw,
  });
});

router.get('/statistics', requireAuth, requireAdmin, (_req, res) => {
  const users = db.prepare('SELECT id, name FROM users WHERE deleted_at IS NULL ORDER BY created_at').all();
  const usage = db.prepare(
    `SELECT
       COALESCE(SUM(type = 'IMAGE'), 0) AS photos, COALESCE(SUM(type = 'VIDEO'), 0) AS videos,
       COALESCE(SUM(CASE WHEN type = 'IMAGE' THEN file_size END), 0) AS usagePhotos,
       COALESCE(SUM(CASE WHEN type = 'VIDEO' THEN file_size END), 0) AS usageVideos
     FROM assets WHERE owner_id = ? AND deleted_at IS NULL`,
  );
  const byUser = users.map((u) => {
    const s = usage.get(u.id);
    return { userId: u.id, userName: u.name, ...s, usage: s.usagePhotos + s.usageVideos, quotaSizeInBytes: null };
  });
  const sum = (key) => byUser.reduce((total, u) => total + u[key], 0);
  res.json({
    photos: sum('photos'),
    videos: sum('videos'),
    usagePhotos: sum('usagePhotos'),
    usageVideos: sum('usageVideos'),
    usage: sum('usage'),
    usageByUser: byUser,
  });
});

router.get('/version-history', requireAuth, (_req, res) =>
  res.json([
    {
      id: '00000000-0000-0000-0000-000000000001',
      createdAt: new Date(startedAt).toISOString(),
      version: `v${VERSION.major}.${VERSION.minor}.${VERSION.patch}`,
    },
  ]),
);

router.get('/media-types', (_req, res) => res.json({ ...MEDIA_EXTENSIONS, sidecar: [] }));
