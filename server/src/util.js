// Small helpers shared by the routes. No imports, so every worker can load it for free.

/** Lets an async route handler throw: the rejection goes to Express' error handler. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** The strings in a request-body array ([] when it is missing or not an array). */
export const stringList = (value) => (Array.isArray(value) ? value.filter((x) => typeof x === 'string') : []);

/** ISO string for a date-like string, or null when it is not a valid date. */
export const toIso = (value) => {
  const t = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

/** SQL placeholders for a list: "?,?,?". */
export const placeholders = (list) => list.map(() => '?').join(',');

/** A list cut into pieces of `size`: SQL "IN (...)" lists stay short and memory stays flat however many ids arrive. */
export const chunks = (list, size = 500) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** Biggest JSON request body. Roughly 25,000 asset ids: enough for "select all" on a big library, small enough for a 48 MB heap. */
export const BODY_LIMIT = '1mb';

/** Largest number of rows one page of a streamed response holds in memory. */
export const PAGE_SIZE = 500;

/**
 * Sends a big list as JSON without ever holding all of it in memory (the workers have small heaps).
 * `nextPage(offset)` returns the next page of JSON-able items, or [] when there are no more.
 *   head === null  ->  [ ...items ]
 *   head = {...}   ->  { ...head, [key]: [ ...items ] }
 * It waits when the client reads slowly and stops when the client goes away.
 */
export async function streamJsonList(res, head, key, nextPage) {
  const flush = (chunk) => {
    if (res.write(chunk) || res.destroyed) return null;
    // wait for the client to catch up; whichever event comes first removes the other listener (no build-up per page)
    return new Promise((resolve) => {
      const done = () => (res.off('drain', done), res.off('close', done), resolve());
      res.once('drain', done);
      res.once('close', done);
    });
  };
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (head === null) await flush('[');
    else {
      const json = JSON.stringify(head);
      await flush(`${json.slice(0, -1)}${json.length > 2 ? ',' : ''}${JSON.stringify(key)}:[`);
    }
    let sent = 0;
    while (!res.destroyed) {
      const items = nextPage(sent);
      if (items.length === 0) break;
      await flush(`${sent ? ',' : ''}${JSON.stringify(items).slice(1, -1)}`);
      sent += items.length;
    }
    res.end(head === null ? ']' : ']}');
  } catch (error) {
    // the status line is already out, so the only honest signal left is a cut connection, and a line in the error log
    import('./log.js').then(({ logRequestFailure }) => logRequestFailure(res.req, 500, error));
    res.destroy(error);
  }
}

/** Where an asset can be shown. */
export const VISIBILITIES = new Set(['archive', 'timeline', 'hidden', 'locked']);

/** SQL expression for "now" in the format every timestamp column uses. */
export const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
