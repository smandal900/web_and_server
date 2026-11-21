import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { DEFAULT_ADMIN_CONFIG, getUserConfig } from '../system-config.js';

export const router = Router();
router.use(requireAuth);

router.get('/', (_req, res) => res.json(getUserConfig()));
router.get('/defaults', (_req, res) => res.json(getUserConfig(DEFAULT_ADMIN_CONFIG)));
