import { Router } from 'express';
import { requireAuth } from '../auth.js';

// Library endpoints consumed by the web app. There is no asset storage yet, so each
// of these returns the correct empty shape. Replace a handler when its feature is built.
export const router = Router();

const empty = (method, path, body) => router[method](path, requireAuth, (_req, res) => res.json(body));

// Photos page
empty('get', '/memories', []);
empty('get', '/memories/statistics', { total: 0 });
empty('get', '/notifications', []);
empty('get', '/albums', []);

// Explore, People, Places, Search
empty('get', '/search/explore', []);
empty('get', '/search/cities', []);
empty('get', '/faces', []);
empty('get', '/people', { hasNextPage: false, hidden: 0, people: [], total: 0 });
empty('post', '/search/metadata', {
  albums: { count: 0, facets: [], items: [], total: 0 },
  assets: { count: 0, facets: [], items: [], nextCursor: null, nextPage: null, total: 0 },
});

// Sharing
empty('get', '/partners', []);
empty('get', '/shared-links', []);

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
