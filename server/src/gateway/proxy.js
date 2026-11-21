// Streaming reverse proxy from the gateway to a worker on 127.0.0.1. Nothing is buffered: request and
// response bodies flow through in small pieces, so a 2 GB video costs the gateway a few KB of RAM.
import http from 'node:http';
import { pipeline } from 'node:stream';
import { groupFor } from './routes.js';

// These groups only contain routes behind login. A request with no token at all is answered here with 401, so
// anonymous traffic can never make the gateway start (and pay RAM for) a worker.
const NEEDS_LOGIN = new Set(['timeline', 'media', 'upload', 'admin', 'realtime']);
const hasCredentials = (req) =>
  /^Bearer\s+\S/i.test(req.headers.authorization ?? '') || /(?:^|;\s*)immich_access_token=[^;\s]/.test(req.headers.cookie ?? '');

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer'];

function sendError(res, status, message) {
  if (res.headersSent) return res.destroy();
  const body = JSON.stringify({ message, statusCode: status });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
  if (status >= 502) headers['Retry-After'] = '2';
  res.writeHead(status, headers);
  res.end(body);
}

/** @param serveWeb (req, res) handler for the web app, used when the gateway serves it itself (no web worker) */
export function createProxy(pool, { serveWeb }) {
  function handleRequest(req, res) {
    const name = groupFor(req.method, req.url);
    const group = pool.get(name);
    if (!group) return serveWeb(req, res); // "web" without a worker
    if (NEEDS_LOGIN.has(name) && !hasCredentials(req)) return sendError(res, 401, 'Authentication required');

    // Count the request BEFORE waiting for the worker, so the idle timer cannot stop it under us.
    group.begin();
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        group.end();
      }
    };
    res.on('close', finish);

    group
      .ensure()
      .then((port) => {
        if (res.destroyed) return; // the browser gave up while the worker was starting

        const headers = { ...req.headers };
        for (const h of HOP_BY_HOP) delete headers[h];
        const ip = req.socket.remoteAddress;
        headers['x-forwarded-for'] = headers['x-forwarded-for'] ? `${headers['x-forwarded-for']}, ${ip}` : ip;

        const upstream = http.request(
          { host: '127.0.0.1', port, method: req.method, path: req.url, headers, agent: false },
          (up) => {
            const out = { ...up.headers };
            for (const h of HOP_BY_HOP) delete out[h];
            res.writeHead(up.statusCode, up.statusMessage, out);
            pipeline(up, res, () => {});
          },
        );
        upstream.on('error', () => sendError(res, 502, 'Service temporarily unavailable'));
        res.on('close', () => upstream.destroy()); // browser left: stop the worker's work too
        pipeline(req, upstream, () => {});
      })
      .catch((error) => {
        console.warn(`[gateway] ${group.name}: ${error.message}`);
        sendError(res, 503, 'Service is starting, please retry');
      });
  }

  /** WebSocket upgrade (socket.io). Only the realtime group accepts one. */
  function handleUpgrade(req, socket, head) {
    const name = groupFor(req.method, req.url);
    const group = pool.get(name);
    if (name !== 'realtime' || !hasCredentials(req)) return socket.destroy();

    group.begin(); // an open socket keeps the realtime worker alive
    socket.on('close', () => group.end());
    socket.on('error', () => socket.destroy());

    group
      .ensure()
      .then((port) => {
        if (socket.destroyed) return;
        const upstream = http.request({ host: '127.0.0.1', port, method: 'GET', path: req.url, headers: req.headers, agent: false });

        upstream.on('upgrade', (up, upSocket, upHead) => {
          const lines = ['HTTP/1.1 101 Switching Protocols'];
          for (let i = 0; i < up.rawHeaders.length; i += 2) lines.push(`${up.rawHeaders[i]}: ${up.rawHeaders[i + 1]}`);
          socket.write(`${lines.join('\r\n')}\r\n\r\n`);
          if (upHead?.length) socket.write(upHead);
          if (head?.length) upSocket.write(head);
          upSocket.on('error', () => socket.destroy());
          socket.on('close', () => upSocket.destroy());
          upSocket.on('close', () => socket.destroy());
          upSocket.pipe(socket);
          socket.pipe(upSocket);
        });
        upstream.on('response', (up) => {
          // the worker refused the upgrade (e.g. 400): pass the status on and close
          socket.end(`HTTP/1.1 ${up.statusCode} ${up.statusMessage}\r\nConnection: close\r\n\r\n`);
          up.resume();
        });
        upstream.on('error', () => socket.destroy());
        socket.on('close', () => upstream.destroy());
        upstream.end();
      })
      .catch(() => socket.destroy());
  }

  return { handleRequest, handleUpgrade };
}
