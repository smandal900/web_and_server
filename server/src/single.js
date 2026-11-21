// The original all-in-one server: every route in ONE process, always loaded (uses the most RAM).
// Kept for debugging and small dev machines: `npm run start:single`. Production uses index.js (the gateway).
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { closeDb } from './db.js';
import { WEB_BUILD_DIR } from './paths.js';
import { router as serverRouter } from './routes/server.js';
import { router as publicRouter } from './routes/public.js';
import { attachSocket, emitLocal } from './socket.js';
import { setLocalEmitter } from './notify.js';
import { router as libraryRouter } from './routes/library.js';
import { router as clusterGroupsRouter } from './routes/cluster-groups.js';
import { router as chunkedUploadsRouter } from './routes/chunked-uploads.js';
import { router as assetUploadRouter } from './routes/assets-upload.js';
import { router as assetsRouter } from './routes/assets.js';
import { router as timelineRouter } from './routes/timeline.js';
import { router as sessionsRouter } from './routes/sessions.js';
import { router as adminRouter } from './routes/admin.js';
import { router as configRouter } from './routes/config.js';
import { router as errorLogsRouter, logError } from './routes/error-logs.js';
import { router as authRouter } from './routes/auth.js';
import { router as usersRouter } from './routes/users.js';

const PORT = process.env.PORT || 3000;

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// --- API routes (Immich-compatible paths consumed by @immich/sdk in ../web) ---
const api = express.Router();
api.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
api.use('/server', serverRouter);
api.use('/public', publicRouter);
api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/config', configRouter);
api.use('/admin', adminRouter);
api.use('/assets/chunked', chunkedUploadsRouter);
api.use('/assets', assetUploadRouter);
api.use('/assets', assetsRouter);
api.use('/timeline', timelineRouter);
api.use('/sessions', sessionsRouter);
api.use('/cluster-groups', clusterGroupsRouter);
api.use(libraryRouter);
api.use('/error-logs', errorLogsRouter);
api.use((_req, res) => res.status(404).json({ message: 'Not found', statusCode: 404 }));
app.use('/api', api);

// --- Static SPA (web/build) ---
if (fs.existsSync(WEB_BUILD_DIR)) {
  app.use(express.static(WEB_BUILD_DIR, { index: false }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(WEB_BUILD_DIR, 'index.html')));
} else {
  console.warn(`Web build not found at ${WEB_BUILD_DIR} - serving API only.`);
}

// --- Error handler ---
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
    logError({
      section: 'server',
      message: err.message,
      stack: err.stack,
      method: req.method,
      path: req.originalUrl,
      status,
      userId: req.user?.id,
    });
  }
  res.status(status).json({ message: err.message || 'Internal server error', statusCode: status });
});

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
