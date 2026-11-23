// The server's error log: one table (error_logs) that the admin sees under "Error log" in the web app.
// Used by every worker process. Writing a log entry must never break a request, so nothing here throws.
import { db } from './db.js';

const WINDOW_MS = 10_000; // the same failure repeating inside this window is written once
const MAX_ROWS = 5000; // the newest entries are kept
const PRUNE_EVERY = 100; // check the size after this many inserts
const recent = new Map();
let inserts = 0;

const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : null);

/** Query-string values that must never reach the log (share links, passwords, tokens). */
const SECRET_PARAMS = /([?&](?:key|slug|password|token|apikey|api_key|access_token)=)[^&#]*/gi;

/** A URL that is safe to store: secrets in the query string are hidden. */
export const safeUrl = (url = '') => String(url).replace(SECRET_PARAMS, '$1***').slice(0, 500);

/** The part of the app a URL belongs to: "/api/albums/1/assets" -> "albums". */
export const sectionOf = (url = '') => /^\/api\/([^/?#]+)/.exec(String(url))?.[1] ?? '';

/**
 * Write one entry.
 * level: warn | error | fatal   source: api (a request) | service (a background part of the server) | web (browser)
 * @returns {boolean} whether a row was written (false for a repeat inside the window, or when the log itself is unavailable)
 */
export function logEvent({ level = 'error', source = 'api', section = '', message, stack, method, path, status, userId }) {
  try {
    const text = clip(String(message ?? 'Unknown error'), 2000);
    const key = `${source}|${section}|${method}|${path}|${status}|${text}`;
    const now = Date.now();
    if (now - (recent.get(key) ?? 0) < WINDOW_MS) return false;
    recent.set(key, now);
    if (recent.size > 300) for (const [k, t] of recent) if (now - t > WINDOW_MS) recent.delete(k);

    db.prepare(
      `INSERT INTO error_logs (level, source, section, message, stack, method, path, status, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(level, source, section, text, clip(stack, 8000), method ?? null, clip(path, 500), status ?? null, userId ?? null);

    if (++inserts % PRUNE_EVERY === 0) db.prepare('DELETE FROM error_logs WHERE id <= (SELECT MAX(id) FROM error_logs) - ?').run(MAX_ROWS);
    return true;
  } catch {
    return false;
  }
}

/** A failed request: 4xx is a warning (the caller did something wrong), 5xx an error (the server did). */
export function logRequestFailure(req, status, error) {
  // for refused logins and forbidden requests the address they came from is part of the story (the gateway passes it on)
  const ip = status === 401 || status === 403 ? String(req.headers?.['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '').split(',')[0].trim() : '';
  return logEvent({
    level: status >= 500 ? 'error' : 'warn',
    source: 'api',
    section: sectionOf(req.originalUrl),
    message: `${error?.message || `Request failed with ${status}`}${ip ? ` (from ${ip})` : ''}`,
    stack: status >= 500 ? error?.stack : undefined,
    method: req.method,
    path: safeUrl(req.originalUrl),
    status,
    userId: req.user?.id,
  });
}
