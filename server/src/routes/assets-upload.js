import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import { HttpError, requireAuth } from '../auth.js';
import { db } from '../db.js';
import { ingestAsset, normalizeChecksum, toAssetDto } from '../assets.js';
import { TMP_DIR } from '../paths.js';
import { emitToUser } from '../notify.js';
import { wrap } from '../util.js';

// Upload group: POST /assets and POST /assets/bulk-upload-check. Everything that only reads lives in assets.js.
export const router = Router();
router.use(requireAuth);

// Uploads stream straight to disk, so large videos never sit in memory.
const upload = multer({
  storage: multer.diskStorage({ destination: TMP_DIR, filename: (_req, _file, cb) => cb(null, crypto.randomUUID()) }),
});

// Browsers send UTF-8 file names, multer decodes them as latin1.
const fixFileName = (name) => {
  if (!/[\u0080-ÿ]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
};

router.post(
  '/',
  upload.single('assetData'),
  wrap(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'assetData should not be empty');
    try {
      const result = await ingestAsset({
        ownerId: req.user.id,
        filePath: file.path,
        originalName: fixFileName(file.originalname),
        mode: 'move',
        fileCreatedAt: req.body.fileCreatedAt,
        fileModifiedAt: req.body.fileModifiedAt,
        isFavorite: req.body.isFavorite === 'true',
        visibility: req.body.visibility,
      });
      if (result.duplicate) return res.status(200).json({ id: result.id, status: 'duplicate' });

      emitToUser(req.user.id, 'on_upload_success', toAssetDto(result.row));
      res.status(201).json({ id: result.row.id, status: 'created' });
    } finally {
      await fsp.rm(file.path, { force: true }); // no-op once the file was moved into the library
    }
  }),
);

router.post('/bulk-upload-check', (req, res) => {
  const assets = Array.isArray(req.body?.assets) ? req.body.assets : [];
  const find = db.prepare('SELECT id, deleted_at FROM assets WHERE owner_id = ? AND checksum = ?');
  res.json({
    results: assets.map(({ id, checksum }) => {
      const hex = normalizeChecksum(checksum);
      const existing = hex && find.get(req.user.id, hex);
      return existing
        ? { id, action: 'reject', reason: 'duplicate', assetId: existing.id, isTrashed: !!existing.deleted_at }
        : { id, action: 'accept' };
    }),
  });
});
