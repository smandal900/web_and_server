// Starts one child process per worker group when a request needs it, and stops it again when it has been idle.
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKERS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'workers');

// heapMb   V8 old-space cap. A runaway request is killed by Node instead of eating the whole server.
// idleSec  seconds without any request before the process is stopped and its RAM returned to the OS.
// threads  libuv thread pool size (each thread costs RAM; fs/crypto work only needs a couple).
// Override per group with HEAP_MB_<GROUP> and IDLE_SEC_<GROUP>, e.g. IDLE_SEC_UPLOAD=30.
const DEFAULTS = {
  web: { heapMb: 32, idleSec: 120, threads: 2 },
  core: { heapMb: 48, idleSec: 120, threads: 2 },
  timeline: { heapMb: 64, idleSec: 90, threads: 2 },
  media: { heapMb: 64, idleSec: 90, threads: 3 },
  upload: { heapMb: 96, idleSec: 60, threads: 3 },
  admin: { heapMb: 48, idleSec: 60, threads: 2 },
  realtime: { heapMb: 48, idleSec: 30, threads: 1 },
};

// GROUP_MERGE puts several API groups into ONE process, e.g. GROUP_MERGE=core+timeline+media. A process costs about
// 20 MB before it does any work, so groups that are used together (a browsing session uses core, timeline and
// media at once) are cheaper merged. Separate sets with a comma: GROUP_MERGE=core+timeline+media,admin+upload.
// web and realtime always stay on their own. Default: no merging, every group has its own process.
const API_GROUPS = ['core', 'timeline', 'media', 'upload', 'admin'];
function parseMerge(spec = '') {
  const alias = {}; // group -> process name ("core+timeline+media")
  const used = new Set();
  for (const set of spec.split(',').map((x) => x.trim()).filter(Boolean)) {
    const members = [...new Set(set.split('+').map((x) => x.trim().toLowerCase()))].filter((m) => API_GROUPS.includes(m) && !used.has(m));
    if (members.length < 2) continue;
    const name = members.join('+');
    for (const m of members) (alias[m] = name), used.add(m);
  }
  return alias;
}

const START_TIMEOUT_MS = 20_000;
const STOP_TIMEOUT_MS = 5_000;
const RETRY_AFTER_FAILURE_MS = 2_000;

const envNumber = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 && process.env[name] !== '' && process.env[name] !== undefined ? n : fallback;
};

const log = (msg) => console.log(`[gateway] ${msg}`);

export function nodeArgsFor(heapMb) {
  return [
    `--max-old-space-size=${heapMb}`,
    '--max-semi-space-size=1', // young generation 1 MB instead of 16 MB
    '--expose-gc', // lets _boot.js hand memory back between bursts
  ];
}

export function workerEnv(threads) {
  return {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
    SKIP_MIGRATE: '1', // the gateway migrated once at boot
    UV_THREADPOOL_SIZE: String(threads),
    MALLOC_ARENA_MAX: '2', // glibc: far fewer per-thread arenas, big saving with sharp/libvips
    MALLOC_TRIM_THRESHOLD_: '131072', // give freed memory back to the OS sooner
  };
}

class Group {
  state = 'stopped'; // stopped | starting | running | stopping
  child = null;
  port = null;
  active = 0; // requests (and open websockets) currently being served
  lastUsed = Date.now();
  failedAt = 0;
  #startPromise = null;
  #stopDone = null;
  #stopPromise = null;

  constructor(name, onMessage) {
    this.name = name; // "upload", or "core+timeline+media" for a merged process
    this.members = name.split('+');
    // a merged process takes the largest limit of its members
    const largest = (envPrefix, field) =>
      Math.max(...this.members.map((m) => envNumber(`${envPrefix}_${m.toUpperCase()}`, DEFAULTS[m][field])));
    this.heapMb = largest('HEAP_MB', 'heapMb');
    this.idleMs = largest('IDLE_SEC', 'idleSec') * 1000;
    this.threads = Math.max(...this.members.map((m) => DEFAULTS[m].threads));
    this.onMessage = onMessage;
  }

  begin() {
    this.active++;
    this.lastUsed = Date.now();
  }

  end() {
    this.active = Math.max(0, this.active - 1);
    this.lastUsed = Date.now();
  }

  /** Resolves with the worker's port, starting the process first when needed. */
  async ensure() {
    for (;;) {
      if (this.state === 'running') return this.port;
      if (this.state === 'starting') return this.#startPromise;
      if (this.state === 'stopping') {
        await this.#stopPromise;
        continue;
      }
      if (Date.now() - this.failedAt < RETRY_AFTER_FAILURE_MS) throw new Error(`${this.name} worker failed to start`);
      return this.#start();
    }
  }

  #start() {
    this.state = 'starting';
    this.#startPromise = new Promise((resolve, reject) => {
      const isApi = API_GROUPS.includes(this.members[0]);
      const child = fork(path.join(WORKERS_DIR, isApi ? 'api.js' : `${this.name}.js`), [], {
        execArgv: nodeArgsFor(this.heapMb),
        env: { ...workerEnv(this.threads), WORKER_GROUPS: this.members.join(',') },
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        windowsHide: true,
      });
      this.child = child;

      const timer = setTimeout(() => child.kill('SIGKILL'), START_TIMEOUT_MS);

      child.on('message', (m) => {
        if (m?.type === 'ready') {
          clearTimeout(timer);
          this.port = m.port;
          this.state = 'running';
          this.lastUsed = Date.now();
          log(`started ${this.name} (pid ${child.pid}, heap cap ${this.heapMb} MB, idle stop ${this.idleMs / 1000}s)`);
          resolve(m.port);
        } else {
          this.onMessage?.(this, m);
        }
      });

      child.on('error', (error) => log(`${this.name} process error: ${error.message}`));

      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        const wasStarting = this.state === 'starting';
        const expected = this.state === 'stopping';
        if (this.child === child) {
          this.child = null;
          this.port = null;
          this.state = 'stopped';
        }
        if (wasStarting) {
          this.failedAt = Date.now();
          reject(new Error(`${this.name} worker exited during start (code ${code}, signal ${signal})`));
        } else if (!expected) {
          log(`${this.name} worker crashed (code ${code}, signal ${signal}); it restarts on the next request`);
        }
        this.#stopDone?.();
        this.#stopDone = null;
      });
    });
    this.#startPromise.catch(() => {}); // callers handle the error; this just avoids an unhandled rejection
    return this.#startPromise;
  }

  /** Ask the worker to finish and exit; kill it if it does not. */
  stop(reason) {
    if (this.state !== 'running' || !this.child) return Promise.resolve();
    const child = this.child;
    this.state = 'stopping';
    log(`stopping ${this.name} (${reason})`);
    this.#stopPromise = new Promise((resolve) => (this.#stopDone = resolve));
    try {
      child.send({ type: 'shutdown' });
    } catch {
      child.kill('SIGKILL');
    }
    const killer = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);
    child.once('exit', () => clearTimeout(killer));
    return this.#stopPromise;
  }

  /** Stop when nothing used this worker for idleMs. Called by the pool's timer. */
  stopIfIdle(now) {
    if (this.state === 'running' && this.active === 0 && now - this.lastUsed >= this.idleMs) {
      this.stop(`idle ${Math.round(this.idleMs / 1000)}s`);
    }
  }

  /** Ask a running worker for its memory use. */
  stats() {
    if (this.state !== 'running' || !this.child) return Promise.resolve(null);
    const child = this.child;
    return new Promise((resolve) => {
      const timer = setTimeout(() => (child.off('message', onMsg), resolve(null)), 1000);
      const onMsg = (m) => {
        if (m?.type !== 'stats') return;
        clearTimeout(timer);
        child.off('message', onMsg);
        resolve(m);
      };
      child.on('message', onMsg);
      try {
        child.send({ type: 'stats' });
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }
}

export function createPool(onMessage) {
  const alias = parseMerge(process.env.GROUP_MERGE);
  const webInGateway = process.env.WEB_MODE !== 'worker'; // default: the gateway serves the app itself
  const names = new Set(Object.keys(DEFAULTS).map((n) => alias[n] ?? n));
  if (webInGateway) names.delete('web');
  const groups = Object.fromEntries([...names].map((name) => [name, new Group(name, onMessage)]));
  if (Object.keys(alias).length) console.log(`[gateway] merged processes: ${[...new Set(Object.values(alias))].join(', ')}`);

  const timer = setInterval(() => {
    const now = Date.now();
    for (const g of Object.values(groups)) g.stopIfIdle(now);
  }, 5_000);
  timer.unref();

  return {
    groups,
    /** The process that answers a group (a merged process answers several). undefined for web when the gateway serves it. */
    get: (name) => groups[alias[name] ?? name],
    stopAll: (reason) => Promise.all(Object.values(groups).map((g) => g.stop(reason))),
    async status() {
      return Promise.all(
        Object.values(groups).map(async (g) => {
          const s = await g.stats();
          return {
            group: g.name,
            state: g.state,
            pid: g.child?.pid ?? null,
            activeRequests: g.active,
            rssMb: s ? +(s.rss / 1048576).toFixed(1) : null,
            heapMb: s ? +(s.heap / 1048576).toFixed(1) : null,
            heapCapMb: g.heapMb,
            stopsInSec: g.state === 'running' && g.active === 0 ? Math.max(0, Math.round((g.idleMs - (Date.now() - g.lastUsed)) / 1000)) : null,
          };
        }),
      );
    },
  };
}
