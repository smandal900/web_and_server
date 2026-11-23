// The original all-in-one server: every route in ONE process, always loaded (uses the most RAM).
// Kept for debugging and small dev machines: `npm run start:single`. Production uses index.js (the gateway).
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { closeDb } from './db.js';
import { WEB_BUILD_DIR } from './paths.js';
import { attachSocket, emitLocal } from './socket.js';
import { setLocalEmitter } from './notify.js';
import { apiErrorHandler, apiNotFound } from './error-handler.js';
import { GROUPS, loadRoutes, mountRoutes } from './routes/index.js';
import { BODY_LIMIT } from './util.js';

const PORT = process.env.PORT || 3000;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: BODY_LIMIT }));

// --- API routes (Immich-compatible paths consumed by @immich/sdk in ../web) ---
const api = express.Router();
api.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
mountRoutes(api, await loadRoutes(Object.keys(GROUPS))); // every group in this one process
api.use(apiNotFound);
app.use('/api', api);

// --- Static SPA (web/build) ---
if (fs.existsSync(WEB_BUILD_DIR)) {
  app.use(express.static(WEB_BUILD_DIR, { index: false }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(WEB_BUILD_DIR, 'index.html')));
} else {
  console.warn(`Web build not found at ${WEB_BUILD_DIR} - serving API only.`);
}

// --- Error handler ---
app.use(apiErrorHandler);

const server = app.listen(PORT, () => console.log(`Server (single process) listening on http://localhost:${PORT}`));
attachSocket(server);
setLocalEmitter(emitLocal);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () =>
    server.close(() => {
      closeDb();
      process.exit(0);
    }),
  );
}
