// How the gateway writes to the error log. The gateway is deliberately tiny and has no database driver, so events are
// queued for a moment and handed to a short-lived helper process (jobs/log-events.js) that writes them and exits.
// Nothing runs while nothing goes wrong. Identical events inside 10 seconds are sent once, and the queue is capped,
// so a failing worker cannot turn into a stream of helper processes.
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JOB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'jobs', 'log-events.js');
const WINDOW_MS = 10_000;
const FLUSH_AFTER_MS = 1500;
const MAX_QUEUED = 50;

const queue = [];
const recent = new Map();
let timer = null;

/** @param {{ level?: string, section?: string, message: string, method?: string, path?: string, status?: number }} event */
export function gatewayLog(event) {
  const key = `${event.section}|${event.method}|${event.path}|${event.status}|${event.message}`;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < WINDOW_MS || queue.length >= MAX_QUEUED) return;
  recent.set(key, now);
  if (recent.size > 100) for (const [k, t] of recent) if (now - t > WINDOW_MS) recent.delete(k);
  queue.push({ level: 'error', section: 'gateway', ...event, source: 'service' });
  timer ??= setTimeout(flush, FLUSH_AFTER_MS);
}

function flush() {
  timer = null;
  const events = queue.splice(0);
  if (events.length === 0) return;
  try {
    const child = fork(JOB, [], {
      execArgv: ['--max-old-space-size=32', '--max-semi-space-size=1'],
      env: { ...process.env, SKIP_MIGRATE: '1' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      windowsHide: true,
    });
    child.on('error', () => {});
    child.send({ events });
  } catch (error) {
    console.warn(`[gateway] could not write to the error log: ${error.message}`);
  }
}
