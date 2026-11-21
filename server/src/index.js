// Gateway. The only process that is always running, so it is deliberately tiny: Node built-ins only,
// no Express, no database driver, no image library (about 30-40 MB resident).
//
// It listens on PORT and forwards each request to a worker process for that part of the app:
// web, core, timeline, media, upload, admin, realtime (see gateway/routes.js). A worker is started on the
// first request and stopped again after IDLE_SEC_<GROUP> seconds without traffic, so RAM is only used
// for what people are actually doing right now. Start the old single-process server with `npm run start:single`.
import { fork } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, nodeArgsFor, workerEnv } from './gateway/pool.js';
import { createProxy } from './gateway/proxy.js';
import { serveWeb } from './static-handler.js';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;

/** Run a script in a short-lived child process and wait for it to exit. */
const runOnce = (file, heapMb = 48) =>
  new Promise((resolve, reject) => {
    const child = fork(path.join(SRC, file), [], {
      execArgv: nodeArgsFor(heapMb),
      env: { ...workerEnv(2), SKIP_MIGRATE: file === 'migrate.js' ? '0' : '1' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${file} exited with code ${code}`))));
  });

// Worker -> gateway messages. 'emit' = push a socket.io event to a user; only matters if the realtime worker is up.
const pool = createPool((_group, message) => {
  if (message?.type !== 'emit') return;
  const realtime = pool.get('realtime');
  if (realtime.state === 'running') realtime.child.send(message);
});
const proxy = createProxy(pool, { serveWeb });

try {
  await runOnce('migrate.js');
} catch (error) {
  console.error(`[gateway] database migration failed: ${error.message}`);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/health' || req.url.startsWith('/api/health?')) {
    const detailed = process.env.STATUS_TOKEN && new URL(req.url, 'http://x').searchParams.get('token') === process.env.STATUS_TOKEN;
    const body = { status: 'ok', uptime: process.uptime() };
    if (detailed) {
      body.gatewayRssMb = +(process.memoryUsage.rss() / 1048576).toFixed(1);
      body.workers = await pool.status();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(body));
  }
  proxy.handleRequest(req, res);
});
server.on('upgrade', proxy.handleUpgrade);
server.headersTimeout = 30_000;
server.requestTimeout = 0; // long uploads / video streams are fine; workers still stop only when idle
server.keepAliveTimeout = 5_000;server.listen(PORT, () => console.log(`[gateway] listening on http://localhost:${PORT}`));

// Clean up abandoned chunked uploads: a short-lived process now and then, instead of a timer inside a worker.
const sweep = () => runOnce('jobs/sweep.js').catch((error) => console.warn(`[gateway] sweep failed: ${error.message}`));
setTimeout(() => {
  sweep();
  setInterval(sweep, SWEEP_EVERY_MS).unref();
}, 60_000).unref();

// The gateway never stops, so hand its unused heap back to the OS now and then (needs --expose-gc, see npm start).
if (global.gc) setInterval(() => global.gc(), 10_000).unref();

let shuttingDown = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close();
    await pool.stopAll('gateway shutting down');
    process.exit(0);
  });
}
