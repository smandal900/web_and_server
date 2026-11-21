import { Router } from 'express';
import { db } from '../db.js';
import { HttpError, requireAuth, toPublicUserDto } from '../auth.js';

export const router = Router();
router.use(requireAuth);

// Invitations between cluster groups are not implemented yet.
router.get('/requests', (_req, res) => res.json([]));
router.get('/:id/requests', (_req, res) => res.json([]));

router.get('/:id/users', (req, res) => {
  if (req.params.id !== req.user.cluster_group_id) throw new HttpError(403, 'Not a member of this group');
  const rows = db
    .prepare('SELECT * FROM users WHERE cluster_group_id = ? AND deleted_at IS NULL ORDER BY created_at')
    .all(req.params.id);
  res.json(rows.map(toPublicUserDto));
});
