// Serves the built React app (web/build) with node:http + fs only. Used by the gateway itself (default,
// costs no extra process) or by the optional `web` worker (WEB_MODE=worker). Files are streamed in 64 KiB
// pieces, nothing is cached in RAM.
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { WEB_BUILD_DIR } from './paths.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

const ROOT = path.resolve(WEB_BUILD_DIR);
const INDEX = path.join(ROOT, 'index.html');

function resolveFile(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const file = path.join(ROOT, path.normalize(rel));
  return file === ROOT || file.startsWith(ROOT + path.sep) ? file : null; // no ../ escapes
}

function send(req, res, file) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    // Vite names files assets/<name>-<hash>.js, so they never change under the same URL.
    const immutable = file.includes(`${path.sep}assets${path.sep}`);
    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Last-Modified': stat.mtime.toUTCString(),
      ETag: etag,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    pipeline(fs.createReadStream(file), res, () => {});
  });
}

/** (req, res) handler: static file, or index.html for client-side routes like /photos or /albums/123. */
export function serveWeb(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const { pathname } = new URL(req.url, 'http://localhost');
  const file = resolveFile(pathname);
  if (!file) {
    res.writeHead(400);
    return res.end();
  }
  fs.stat(file, (err, stat) => {
    if (!err && stat.isFile()) return send(req, res, file);
    // a missing file WITH an extension is a real 404; anything else is an app route
    if (path.extname(pathname)) return send(req, res, file);
    send(req, res, INDEX);
  });
}
