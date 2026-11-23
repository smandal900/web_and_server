import { Router } from 'express';
import { requireAuth } from '../auth.js';

// Endpoints the web and mobile apps call that need services this server does not have (notifications, face
// detection, API keys, passkeys, external libraries, workflows). Each returns the correct empty shape.
// Everything else (albums, people, tags, search, sharing, trash ...) has its own router.
export const router = Router();

const empty = (method, path, body) => router[method](path, requireAuth, (_req, res) => res.json(body));

empty('get', '/notifications', []);
empty('get', '/faces', []);

// User settings
empty('get', '/api-keys', []);
empty('get', '/passkeys', []);

// Admin: libraries
empty('get', '/libraries', []);

// Workflows
empty('get', '/workflows', []);
empty('get', '/workflows/triggers', []);
empty('get', '/plugins/methods', []);
empty('get', '/plugins/templates', []);
