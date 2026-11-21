import { Router } from 'express';
import { DEFAULT_ADMIN_CONFIG, getPublicConfig } from '../system-config.js';

export const router = Router();

router.get('/config', (_req, res) => res.json(getPublicConfig()));
router.get('/config/defaults', (_req, res) => res.json(getPublicConfig(DEFAULT_ADMIN_CONFIG)));
