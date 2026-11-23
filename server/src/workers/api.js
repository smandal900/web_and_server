// One Express worker that serves one OR SEVERAL API groups (core, timeline, media, upload, admin).
// WORKER_GROUPS=core,timeline,media makes a single process answer all three (see GROUP_MERGE in gateway/pool.js).
// Routers are imported only for the groups this process serves (the table lives in routes/index.js).
import http from 'node:http';
import { createApiApp } from './_api.js';
import { listen } from './_boot.js';
import { closeDb } from '../db.js';
import { GROUPS, loadRoutes, mountRoutes } from '../routes/index.js';

const groups = (process.env.WORKER_GROUPS ?? '').split(',').filter(Boolean);
const unknown = groups.filter((g) => !GROUPS[g]);
if (groups.length === 0 || unknown.length > 0) {
  console.error(`[api worker] bad WORKER_GROUPS "${process.env.WORKER_GROUPS}"`);
  process.exit(1);
}

const routes = await loadRoutes(groups);
const app = createApiApp((api) => mountRoutes(api, routes));
listen(http.createServer(app), { onClose: closeDb });
